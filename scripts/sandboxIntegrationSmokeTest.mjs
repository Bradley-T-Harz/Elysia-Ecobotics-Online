import { spawn } from "node:child_process";
import { createAndRunSnapshotRun, doctor } from "../services/sandbox-runner/runner.mjs";
import { loadRunnerConfig } from "../services/sandbox-runner/serviceConfig.mjs";

function assert(condition, message) { if (!condition) throw new Error(message); }

function runEngine(config, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.engine, args, { shell: false, env: config.engineEnv, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || "engine_command_failed")));
  });
}

async function waitForActiveContainer(config) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const name = await runEngine(config, ["ps", "--filter", "label=io.elysia.sandbox=true", "--format", "{{.Names}}"]);
    if (name) return name.split(/\r?\n/, 1)[0];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("active_container_not_observed");
}

async function assertNoSandboxContainers(config, context) {
  const names = await runEngine(config, ["ps", "--all", "--filter", "label=io.elysia.sandbox=true", "--format", "{{.Names}}"]);
  assert(names === "", `${context} left an orphan sandbox container.`);
}

if (process.env.ELYSIA_SANDBOX_INTEGRATION !== "1") {
  const source = await import("../services/sandbox-runner/dockerRunner.mjs");
  const text = String(source.buildContainerArgs);
  assert(text.includes("--network=none") && text.includes("--read-only") && text.includes("--pull=never"), "Integration contract lost mandatory container isolation flags.");
  console.log("Sandbox integration contract ok (rootless Podman execution not requested in this environment). Set ELYSIA_SANDBOX_INTEGRATION=1 on the prepared server for live enforcement tests.");
  process.exit(0);
}

const config = loadRunnerConfig(process.env);
assert(config.production, "Live integration requires production-equivalent configuration.");
assert(
  config.engine === "podman" || (config.engine === "docker" && process.env.ELYSIA_SANDBOX_DOCKER_STANDBY_TEST === "1"),
  "Live production acceptance requires Podman; Docker requires the explicit cold-standby test gate."
);
const readiness = await doctor(config);
assert(readiness.ready && readiness.rootless, "Rootless Podman and both immutable runtime images must be ready.");

function payload(language, fileName, code, suffix) {
  return {
    snapshot_id: `acceptance-${suffix}`,
    language,
    file_name: fileName,
    code,
    network_policy: "disabled",
    filesystem_policy: "temporary_workspace_only"
  };
}

for (const test of [
  payload("python", "main.py", "print('python-ok')", "python"),
  payload("javascript", "main.js", "console.log('javascript-ok')", "javascript"),
  payload("typescript", "main.ts", "const value: number = 7; console.log(`typescript-${value}`);", "typescript")
]) {
  const result = await createAndRunSnapshotRun(test, { confirmLocalExecution: true, config });
  assert(result.ok && result.status === "completed", `${test.language} execution failed.`);
}

const timeoutPromise = createAndRunSnapshotRun(payload("python", "main.py", "while True: pass", "timeout"), { confirmLocalExecution: true, config });
const busy = await createAndRunSnapshotRun(payload("python", "main.py", "print('must-not-queue')", "concurrent"), { confirmLocalExecution: true, config });
assert(busy.busy === true && busy.retryAfter === 4, "A concurrent live execution did not receive immediate busy state.");
const activeContainer = await waitForActiveContainer(config);
const inspected = JSON.parse(await runEngine(config, ["inspect", activeContainer]));
const hostConfig = inspected?.[0]?.HostConfig ?? {};
const cpuRatio = Number(hostConfig.CpuPeriod) > 0 ? Number(hostConfig.CpuQuota) / Number(hostConfig.CpuPeriod) : null;
assert(Number(hostConfig.Memory) === 256 * 1024 * 1024, "The live container did not receive the 256 MiB memory limit.");
assert(Number(hostConfig.MemorySwap) === 256 * 1024 * 1024, "The live container did not receive the no-extra-swap memory limit.");
assert(Number(hostConfig.PidsLimit) === 32, "The live container did not receive the 32-PID limit.");
assert(cpuRatio === 0.5 || Number(hostConfig.NanoCpus) === 500_000_000, "The live container did not receive the 0.5-CPU quota.");
assert(hostConfig.NetworkMode === "none" && hostConfig.ReadonlyRootfs === true, "The live container did not retain no-network and read-only-root isolation.");
assert(Array.isArray(hostConfig.CapDrop) && hostConfig.CapDrop.some((entry) => String(entry).toUpperCase() === "ALL"), "The live container did not drop all capabilities.");
assert(Array.isArray(hostConfig.SecurityOpt) && hostConfig.SecurityOpt.some((entry) => /no-new-privileges/i.test(String(entry))), "The live container did not enable no-new-privileges.");
assert(inspected?.[0]?.Config?.User === "65534:65534", "The live container did not run as the fixed non-root user.");
assert(Array.isArray(inspected?.[0]?.Mounts) && inspected[0].Mounts.every((mount) => mount.Destination === "/workspace" && mount.RW === false), "The live container received an unexpected or writable host mount.");
assert(Array.isArray(hostConfig.Ulimits) && hostConfig.Ulimits.some((limit) => limit.Name === "core" && Number(limit.Soft) === 0 && Number(limit.Hard) === 0), "The live container did not disable core dumps.");
const timeout = await timeoutPromise;
assert(!timeout.ok && timeout.diagnostics.some((item) => item.category === "timeout"), "Wall-clock timeout was not enforced.");
await assertNoSandboxContainers(config, "Timeout cleanup");
const flood = await createAndRunSnapshotRun(payload("python", "main.py", "print('x' * 200000)", "output"), { confirmLocalExecution: true, config });
assert(!flood.ok && flood.outputTruncated, "Hard output flood limit was not enforced.");
await assertNoSandboxContainers(config, "Output-overflow cleanup");
const memory = await createAndRunSnapshotRun(payload("python", "main.py", "x = bytearray(400 * 1024 * 1024); print(len(x))", "memory"), { confirmLocalExecution: true, config });
assert(!memory.ok, "Memory limit was not enforced.");
const pids = await createAndRunSnapshotRun(payload("python", "main.py", "import os, time\nfor _ in range(100):\n os.fork()\ntime.sleep(1)", "pids"), { confirmLocalExecution: true, config });
assert(!pids.ok, "PID limit was not enforced.");
const network = await createAndRunSnapshotRun(payload("python", "main.py", "s = __import__('so' + 'cket'); s.create_connection(('example.com', 443), 0.5)", "network"), { confirmLocalExecution: true, config });
assert(!network.ok, "Network isolation was not enforced.");
const shell = await createAndRunSnapshotRun(payload("python", "main.py", "o = __import__('os'); raise SystemExit(getattr(o, 'sys' + 'tem')('id'))", "shell"), { confirmLocalExecution: true, config });
assert(!shell.ok, "Shell removal was not enforced.");
const readOnlyRoot = await createAndRunSnapshotRun(payload("python", "main.py", "open('/probe-write', 'w').write('x')", "read-only-root"), { confirmLocalExecution: true, config });
assert(!readOnlyRoot.ok, "Read-only container root was not enforced.");
const packageInstall = await createAndRunSnapshotRun(payload("python", "main.py", "module = __import__('pi' + 'p'); print(module)", "package-tooling"), { confirmLocalExecution: true, config });
assert(!packageInstall.ok, "Removed package tooling unexpectedly remained available.");
const privatePath = await createAndRunSnapshotRun(payload("python", "main.py", "path = '/' + 'ho' + 'me/elysia-sandbox/private'; print(open(path).read())", "private-path"), { confirmLocalExecution: true, config });
assert(!privatePath.ok, "An unmounted private host path was unexpectedly readable.");
const secretAttempt = await createAndRunSnapshotRun(payload("python", "main.py", "print(__import__('os').getenv('SANDBOX_SERVICE_TOKEN'))", "secret-policy"), { confirmLocalExecution: true, config });
assert(!secretAttempt.ok && secretAttempt.status === "policy_blocked", "A direct environment-secret access attempt was not blocked before execution.");

await assertNoSandboxContainers(config, "Acceptance suite");
console.log(`Sandbox live rootless ${config.engine === "podman" ? "Podman production" : "Docker cold-standby"} integration test ok.`);

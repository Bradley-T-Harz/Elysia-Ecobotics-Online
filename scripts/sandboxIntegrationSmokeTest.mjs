import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { resolve } from "node:path";
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
  const deadline = Date.now() + 15_000;
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

const temporaryIntegrationRoot = process.env.ELYSIA_SANDBOX_INTEGRATION_RUNTIME_ROOT
  ? resolve(process.env.ELYSIA_SANDBOX_INTEGRATION_RUNTIME_ROOT)
  : null;
if (temporaryIntegrationRoot) {
  assert(/^\/tmp\/elysia-sandbox-integration-[A-Za-z0-9_-]+$/.test(temporaryIntegrationRoot), "A local integration runtime root must be a dedicated /tmp/elysia-sandbox-integration-* directory.");
}
const config = loadRunnerConfig(temporaryIntegrationRoot
  ? { ...process.env, ELYSIA_SANDBOX_MODE: "development", ELYSIA_SANDBOX_RUNTIME_ROOT: temporaryIntegrationRoot }
  : process.env);
assert(config.production || temporaryIntegrationRoot, "Live integration requires production configuration or the explicit constrained temporary integration root.");
assert(
  config.engine === "podman" || (config.engine === "docker" && process.env.ELYSIA_SANDBOX_DOCKER_STANDBY_TEST === "1"),
  "Live production acceptance requires Podman; Docker requires the explicit cold-standby test gate."
);
const readiness = await doctor(config);
assert(readiness.ready && readiness.rootless, "Rootless Podman and both immutable runtime images must be ready.");

function payload(language, fileName, code, suffix) {
  const reservationId = randomUUID();
  return {
    reservation_id: reservationId,
    client_request_id: randomUUID(),
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    snapshot_id: `reservation-${reservationId}`,
    language,
    file_name: fileName,
    code,
    code_sha256: createHash("sha256").update(code).digest("hex"),
    code_bytes: Buffer.byteLength(code, "utf8"),
    network_policy: "disabled",
    filesystem_policy: "temporary_workspace_only"
  };
}

for (const test of [
  payload("python", "main.py", "print('python-ok')", "python"),
  payload("javascript", "main.js", "console.log('javascript-ok')", "javascript"),
  payload("typescript", "main.ts", "const value: number = 7; console.log(`typescript-${value}`);", "typescript")
]) {
  const result = await createAndRunSnapshotRun(test, { confirmLocalExecution: true, config, requireReservation: true });
  assert(result.ok && result.status === "completed", `${test.language} execution failed.`);
}

const capabilityProbe = await createAndRunSnapshotRun(payload("python", "main.py", "print(next(line for line in open('/proc/self/status') if line.startswith('CapEff:')).strip())", "capability-probe"), { confirmLocalExecution: true, config, requireReservation: true });
assert(capabilityProbe.ok && /^CapEff:\s+0+$/m.test(capabilityProbe.stdout), "The live execution process retained an effective Linux capability.");
const resourceProbe = await createAndRunSnapshotRun(payload("python", "main.py", "import resource\nprint('core', resource.getrlimit(resource.RLIMIT_CORE))\nprint('fsize', resource.getrlimit(resource.RLIMIT_FSIZE))\nprint('nofile', resource.getrlimit(resource.RLIMIT_NOFILE))\nprint('nproc', resource.getrlimit(resource.RLIMIT_NPROC))", "resource-probe"), { confirmLocalExecution: true, config, requireReservation: true });
assert(resourceProbe.ok && resourceProbe.stdout.includes("core (0, 0)") && resourceProbe.stdout.includes("fsize (16777216, 16777216)") && resourceProbe.stdout.includes("nofile (64, 64)") && resourceProbe.stdout.includes("nproc (32, 32)"), "The live process did not receive the exact core/file-size/file-descriptor/process limits.");

const timeoutPromise = createAndRunSnapshotRun(payload("python", "main.py", "while True: pass", "timeout"), { confirmLocalExecution: true, config, requireReservation: true });
try {
  const busy = await createAndRunSnapshotRun(payload("python", "main.py", "print('must-not-queue')", "concurrent"), { confirmLocalExecution: true, config, requireReservation: true });
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
  const droppedCapabilities = Array.isArray(hostConfig.CapDrop) ? hostConfig.CapDrop.map((entry) => String(entry).toUpperCase()) : [];
  assert((!Array.isArray(hostConfig.CapAdd) || hostConfig.CapAdd.length === 0) && ["CAP_CHOWN", "CAP_SETUID", "CAP_SETGID", "CAP_SYS_CHROOT"].every((entry) => droppedCapabilities.includes(entry)), "The live container did not apply Podman's expanded cap-drop=ALL set.");
  assert(Array.isArray(hostConfig.SecurityOpt) && hostConfig.SecurityOpt.some((entry) => /no-new-privileges/i.test(String(entry))), "The live container did not enable no-new-privileges.");
  assert(hostConfig.PidMode === "private", "The live container did not use a private PID namespace.");
  assert(inspected?.[0]?.Config?.User === "65534:65534", "The live container did not run as the fixed non-root user.");
  assert(Array.isArray(inspected?.[0]?.Mounts) && inspected[0].Mounts.every((mount) => String(mount.Type).toLowerCase() !== "bind"), "The live container received a host bind mount.");
  assert(hostConfig.Tmpfs?.["/workspace"] && hostConfig.Tmpfs?.["/tmp"], "The live container did not receive both bounded scratch tmpfs mounts.");
} finally {
  await timeoutPromise;
  await assertNoSandboxContainers(config, "Timeout inspection cleanup");
}
const timeout = await timeoutPromise;
assert(!timeout.ok && timeout.diagnostics.some((item) => item.category === "timeout"), "Wall-clock timeout was not enforced.");
await assertNoSandboxContainers(config, "Timeout cleanup");
const cancellation = new AbortController();
const cancellationPromise = createAndRunSnapshotRun(payload("python", "main.py", "while True: pass", "cancelled"), { confirmLocalExecution: true, config, requireReservation: true, signal: cancellation.signal });
await waitForActiveContainer(config);
cancellation.abort();
const cancelled = await cancellationPromise;
assert(!cancelled.ok && cancelled.diagnostics.some((item) => item.message.includes("caller disconnected")), "Caller disconnect cancellation was not enforced.");
await assertNoSandboxContainers(config, "Cancellation cleanup");
const flood = await createAndRunSnapshotRun(payload("python", "main.py", "print('x' * 200000)", "output"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!flood.ok && flood.outputTruncated, "Hard output flood limit was not enforced.");
await assertNoSandboxContainers(config, "Output-overflow cleanup");
const memory = await createAndRunSnapshotRun(payload("python", "main.py", "x = bytearray(400 * 1024 * 1024); print(len(x))", "memory"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!memory.ok, "Memory limit was not enforced.");
const pids = await createAndRunSnapshotRun(payload("python", "main.py", "import os, time\nfor _ in range(100):\n os.fork()\ntime.sleep(1)", "pids"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!pids.ok, "PID limit was not enforced.");
const network = await createAndRunSnapshotRun(payload("python", "main.py", "s = __import__('so' + 'cket'); s.create_connection(('example.com', 443), 0.5)", "network"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!network.ok, "Network isolation was not enforced.");
const shell = await createAndRunSnapshotRun(payload("python", "main.py", "o = __import__('os'); result = getattr(o, 'sys' + 'tem')('id'); raise SystemExit(0 if result == 0 else 1)", "shell"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!shell.ok, "Shell removal was not enforced.");
const readOnlyRoot = await createAndRunSnapshotRun(payload("python", "main.py", "open('/probe-write', 'w').write('x')", "read-only-root"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!readOnlyRoot.ok, "Read-only container root was not enforced.");
const packageInstall = await createAndRunSnapshotRun(payload("python", "main.py", "module = __import__('pi' + 'p'); print(module)", "package-tooling"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!packageInstall.ok, "Removed package tooling unexpectedly remained available.");
const privatePath = await createAndRunSnapshotRun(payload("python", "main.py", "path = '/' + 'ho' + 'me/elysia-sandbox/private'; print(open(path).read())", "private-path"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!privatePath.ok, "An unmounted private host path was unexpectedly readable.");
const secretAttempt = await createAndRunSnapshotRun(payload("python", "main.py", "print(__import__('os').getenv('SANDBOX_SERVICE_TOKEN'))", "secret-policy"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!secretAttempt.ok && secretAttempt.status === "policy_blocked", "A direct environment-secret access attempt was not blocked before execution.");
const fileSize = await createAndRunSnapshotRun(payload("python", "main.py", "open('/tmp/large.bin', 'wb').write(b'x' * (32 * 1024 * 1024))", "file-size"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!fileSize.ok, "The file-size/tmpfs limit was not enforced.");
const childProcess = await createAndRunSnapshotRun(payload("javascript", "main.js", "const cp = require('child_' + 'process'); cp.spawnSync(process.execPath, ['-e', 'console.log(1)']);", "node-child-process"), { confirmLocalExecution: true, config, requireReservation: true });
assert(!childProcess.ok, "The Node permission boundary allowed child-process execution.");

await assertNoSandboxContainers(config, "Acceptance suite");
if (temporaryIntegrationRoot) await fs.rm(temporaryIntegrationRoot, { recursive: true, force: true });
const integrationLabel = config.engine === "docker"
  ? "Docker cold-standby"
  : temporaryIntegrationRoot
    ? "Podman local-isolation"
    : "Podman production";
console.log(`Sandbox live rootless ${integrationLabel} integration test ok.`);

import { spawnSync } from "node:child_process";

function run(args) {
  return spawnSync(process.execPath, ["services/sandbox-runner/cli.mjs", ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
    shell: false
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const doctor = run(["doctor"]);
assert(doctor.status === 0, `doctor command failed: ${doctor.stderr || doctor.stdout}`);
const doctorState = JSON.parse(doctor.stdout);
assert(doctorState.local_only === true, "doctor must report local_only=true.");
assert(doctorState.network_default === "disabled", "doctor must report network_default=disabled.");
assert(doctorState.host_execution_fallback === false, "doctor must report host_execution_fallback=false.");
assert(doctorState.image_pull_automatic === false, "doctor must report image_pull_automatic=false.");
assert(doctorState.runtime_directory_ready === true, "doctor must report runtime_directory_ready=true.");
assert(typeof doctorState.note === "string" && doctorState.note.includes("local-only"), "doctor must explain local-only boundary.");

if (!doctorState.engine) {
  assert(doctorState.host_execution_fallback === false, "missing Docker/Podman must fail closed with no host fallback.");
} else {
  for (const available of Object.values(doctorState.images || {})) {
    assert(typeof available === "boolean", "doctor image availability should be advisory boolean state.");
  }
}

const help = run(["--help"]);
assert(help.status === 0, "help command should succeed.");
assert(help.stdout.includes("elysia-sandbox-runner local CLI"), "help text missing CLI heading.");
assert(help.stdout.includes("No command executes") || help.stdout.includes("never runs code"), "help text must state non-execution boundary.");

const missingValidate = run(["validate", "services/sandbox-runner/fixtures/does-not-exist.json"]);
assert(missingValidate.status !== 0, "validate with missing file should fail cleanly.");
assert(/ENOENT|no such file|cannot find/i.test(`${missingValidate.stderr}${missingValidate.stdout}`), "validate missing-file failure should be explicit.");

const missingInspect = run(["inspect", "services/sandbox-runner/fixtures/does-not-exist.json"]);
assert(missingInspect.status !== 0, "inspect with missing file should fail cleanly.");
assert(/ENOENT|no such file|cannot find/i.test(`${missingInspect.stderr}${missingInspect.stdout}`), "inspect missing-file failure should be explicit.");

console.log("Sandbox runner smoke test ok.");

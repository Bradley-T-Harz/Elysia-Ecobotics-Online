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

const approvedFixture = "services/sandbox-runner/fixtures/approved-python.elysia-sandbox-request.json";
const approvedValidate = run(["validate", approvedFixture]);
assert(approvedValidate.status === 0, `approved fixture should validate without execution: ${approvedValidate.stderr || approvedValidate.stdout}`);
const approvedValidateState = JSON.parse(approvedValidate.stdout);
assert(approvedValidateState.ok === true, "approved fixture validator result should be ok=true.");
assert(approvedValidateState.info.some((item) => item.code === "local_only"), "approved fixture validation should report local-only non-execution info.");

const approvedInspect = run(["inspect", approvedFixture]);
assert(approvedInspect.status === 0, `approved fixture inspect should succeed without execution: ${approvedInspect.stderr || approvedInspect.stdout}`);
const approvedInspectState = JSON.parse(approvedInspect.stdout);
assert(approvedInspectState.runnable_after_confirmation === true, "approved fixture inspect should be runnable only after explicit confirmation.");
assert(approvedInspectState.network_policy === "disabled", "approved fixture inspect should show network disabled.");

const unapprovedValidate = run(["validate", "services/sandbox-runner/fixtures/unapproved-python.elysia-sandbox-request.json"]);
assert(unapprovedValidate.status !== 0, "unapproved fixture should fail validation.");
const unapprovedState = JSON.parse(unapprovedValidate.stdout);
assert(unapprovedState.ok === false, "unapproved fixture validator result should be ok=false.");
assert(unapprovedState.errors.some((item) => item.code === "not_approved"), "unapproved fixture should fail because it is not approved.");

const blockedSecretValidate = run(["validate", "services/sandbox-runner/fixtures/blocked-secret.elysia-sandbox-request.json"]);
assert(blockedSecretValidate.status !== 0, "secret-like fixture should fail validation.");
const blockedSecretState = JSON.parse(blockedSecretValidate.stdout);
assert(blockedSecretState.ok === false, "secret-like fixture validator result should be ok=false.");
assert(blockedSecretState.errors.some((item) => item.code.startsWith("secret_")), "secret-like fixture should fail on secret detection.");

console.log("Sandbox runner smoke test ok.");

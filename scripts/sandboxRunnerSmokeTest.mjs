import fs from "node:fs/promises";
import {
  createAndRunSnapshotRun,
  doctor,
  inspectBundle,
  readBundle,
  validateHandoffBundle,
  validateSnapshotRunPayload
} from "../services/sandbox-runner/runner.mjs";

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const doctorState = await doctor();
assert(doctorState.local_only === true, "doctor must report local_only=true.");
assert(doctorState.network_default === "disabled", "doctor must report network_default=disabled.");
assert(doctorState.host_execution_fallback === false, "doctor must report host_execution_fallback=false.");
assert(doctorState.image_pull_automatic === false, "doctor must report image_pull_automatic=false.");
assert(doctorState.runtime_directory_ready === true, "doctor must report runtime_directory_ready=true.");
assert(typeof doctorState.note === "string" && doctorState.note.includes("local-only"), "doctor must explain local-only boundary.");

if (!doctorState.engine) {
  assert(doctorState.host_execution_fallback === false, "missing Docker/Podman must fail closed with no host fallback.");
} else {
  for (const imageMap of Object.values(doctorState.images || {})) {
    for (const available of Object.values(imageMap || {})) {
      assert(typeof available === "boolean", "doctor image availability should be advisory boolean state.");
    }
  }
}

const cliSource = await fs.readFile(new URL("../services/sandbox-runner/cli.mjs", import.meta.url), "utf8");
assert(cliSource.includes("elysia-sandbox-runner local CLI"), "help text missing CLI heading.");
assert(cliSource.includes("never runs code"), "help text must state non-execution boundary.");
assert(cliSource.includes("run-snapshot"), "help text should expose snapshot run command.");

const approvedFixture = await readBundle("services/sandbox-runner/fixtures/approved-python.elysia-sandbox-request.json");
const approvedValidateState = validateHandoffBundle(approvedFixture);
assert(approvedValidateState.ok === true, "approved fixture validator result should be ok=true.");
assert(approvedValidateState.info.some((item) => item.code === "local_only"), "approved fixture validation should report local-only non-execution info.");

const approvedInspectState = inspectBundle(approvedFixture);
assert(approvedInspectState.runnable_after_confirmation === true, "approved fixture inspect should be runnable only after explicit confirmation.");
assert(approvedInspectState.network_policy === "disabled", "approved fixture inspect should show network disabled.");

const snapshotFixture = JSON.parse(await fs.readFile(new URL("../services/sandbox-runner/fixtures/snapshot-javascript-run.json", import.meta.url), "utf8"));
const snapshotValidateState = validateSnapshotRunPayload(snapshotFixture);
assert(snapshotValidateState.ok === true, "snapshot fixture validator result should be ok=true.");
assert(snapshotValidateState.language === "javascript", "snapshot fixture should normalize to javascript.");

const snapshotRunDeniedState = await createAndRunSnapshotRun(snapshotFixture);
assert(snapshotRunDeniedState.status === "denied", "snapshot run without confirmation should return denied.");

const unapprovedFixture = await readBundle("services/sandbox-runner/fixtures/unapproved-python.elysia-sandbox-request.json");
const unapprovedState = validateHandoffBundle(unapprovedFixture);
assert(unapprovedState.ok === false, "unapproved fixture validator result should be ok=false.");
assert(unapprovedState.errors.some((item) => item.code === "not_approved"), "unapproved fixture should fail because it is not approved.");

const blockedSecretFixture = await readBundle("services/sandbox-runner/fixtures/blocked-secret.elysia-sandbox-request.json");
const blockedSecretState = validateHandoffBundle(blockedSecretFixture);
assert(blockedSecretState.ok === false, "secret-like fixture validator result should be ok=false.");
assert(blockedSecretState.errors.some((item) => item.code.startsWith("secret_")), "secret-like fixture should fail on secret detection.");

console.log("Sandbox runner smoke test ok.");

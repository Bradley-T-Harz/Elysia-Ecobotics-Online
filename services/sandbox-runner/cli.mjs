#!/usr/bin/env node
import { createAndRunJob, createAndRunSnapshotRun, doctor, inspectBundle, killJob, readBundle, readJob, readSnapshotPayload, validateHandoffBundle, validateSnapshotRunPayload } from "./runner.mjs";

function usage() {
  return `elysia-sandbox-runner local CLI\n\nCommands:\n  doctor\n  validate <handoff.json>\n  inspect <handoff.json>\n  run <handoff.json> --confirm-local-execution\n  validate-snapshot <snapshot-run.json>\n  run-snapshot <snapshot-run.json> --confirm-local-execution\n  status <job-id>\n  kill <job-id>\n\nThis CLI is local-only. It never runs code in the website, browser, Supabase, or Cloudflare. Docker/Podman images must exist locally; no images are pulled automatically.`;
}

async function main(argv) {
  const [command, target, ...flags] = argv;
  if (!command || ["-h", "--help", "help"].includes(command)) { console.log(usage()); return; }
  if (command === "doctor") { console.log(JSON.stringify(await doctor(), null, 2)); return; }
  if (command === "status") { if (!target) throw new Error("status requires <job-id>"); console.log(JSON.stringify(await readJob(target), null, 2)); return; }
  if (command === "kill") { if (!target) throw new Error("kill requires <job-id>"); console.log(JSON.stringify(await killJob(target), null, 2)); return; }
  if (command === "validate-snapshot" || command === "run-snapshot") {
    if (!target) throw new Error(`${command} requires <snapshot-run.json>`);
    const payload = await readSnapshotPayload(target);
    if (command === "validate-snapshot") { const result = validateSnapshotRunPayload(payload); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; return; }
    const result = await createAndRunSnapshotRun(payload, { confirmLocalExecution: flags.includes("--confirm-local-execution") });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (!["validate", "inspect", "run"].includes(command)) throw new Error(`Unknown command: ${command}\n${usage()}`);
  if (!target) throw new Error(`${command} requires <handoff.json>`);
  const bundle = await readBundle(target);
  if (command === "validate") { const result = validateHandoffBundle(bundle); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; return; }
  if (command === "inspect") { console.log(JSON.stringify(inspectBundle(bundle), null, 2)); return; }
  if (command === "run") {
    const result = await createAndRunJob(bundle, { confirmLocalExecution: flags.includes("--confirm-local-execution") });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok || result.job?.status === "validation_failed") process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });

import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateHandoffBundle } from "./handoffValidator.mjs";
import { defaultLimits, runtimeForLanguage } from "./policy.mjs";
import { createJobId, ensureRuntime, inputDir, readJob, writeInputFile, writeJob } from "./jobStore.mjs";
import { writeAuditEvent } from "./auditLog.mjs";
import { findContainerEngine, imageAvailable, runContainerJob, killJob } from "./dockerRunner.mjs";

export async function readBundle(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function doctor() {
  await ensureRuntime();
  const engine = await findContainerEngine();
  const images = {};
  if (engine) {
    for (const image of ["python:3.12-alpine", "node:22-alpine"]) images[image] = await imageAvailable(engine.bin, image);
  }
  return {
    local_only: true,
    engine,
    images,
    runtime_directory_ready: true,
    network_default: "disabled",
    host_execution_fallback: false,
    image_pull_automatic: false,
    note: "The sandbox runner is local-only. Missing Docker/Podman or images fails closed. It never pulls images automatically."
  };
}

export function inspectBundle(bundle) {
  const validation = validateHandoffBundle(bundle);
  return {
    source: bundle.source,
    language: bundle.execution_intent?.language ?? null,
    expected_command: bundle.execution_intent?.expected_command ?? null,
    network_policy: bundle.execution_intent?.declared_network_policy ?? null,
    filesystem_policy: bundle.execution_intent?.declared_filesystem_policy ?? null,
    requested_limits: bundle.execution_intent?.requested_limits ?? null,
    payload_bytes: Buffer.byteLength(String(bundle.payload?.code_text ?? ""), "utf8"),
    runnable_after_confirmation: validation.ok,
    validation
  };
}

export async function createAndRunJob(bundle, { confirmLocalExecution = false } = {}) {
  if (!confirmLocalExecution) return { ok: false, message: "Refused. Re-run with --confirm-local-execution after local review." };
  const validation = validateHandoffBundle(bundle);
  if (!validation.ok) return { ok: false, message: "Bundle validation failed.", validation };
  const runtime = runtimeForLanguage(bundle.execution_intent.language);
  const jobId = createJobId();
  const timeoutSeconds = Number(bundle.execution_intent.requested_limits?.timeout_seconds ?? defaultLimits.timeoutSeconds);
  const job = {
    job_id: jobId,
    request_id: bundle.request_id,
    source_type: bundle.source?.source_type,
    language: bundle.execution_intent.language,
    status: "created",
    created_at: new Date().toISOString(),
    exit_code: null,
    timed_out: false,
    killed: false,
    policy_summary: "Docker/Podman container, network none, read-only root, cap-drop all, no-new-privileges, temporary workspace only.",
    resource_limits: { cpus: defaultLimits.cpus, memory: defaultLimits.memory, timeout_seconds: Math.min(timeoutSeconds, 60) },
    bundle_sha256: validation.bundleSha256
  };
  await writeJob(job);
  await writeAuditEvent(jobId, "job_created", "Local user confirmed execution after handoff validation.", { request_id: bundle.request_id, bundle_sha256: validation.bundleSha256 });
  await writeInputFile(jobId, runtime.fileName, bundle.payload.code_text);
  const inputDirectory = fileURLToPath(inputDir(jobId));
  const finalJob = await runContainerJob(job, runtime, inputDirectory);
  return { ok: ["succeeded", "failed", "timed_out", "validation_failed"].includes(finalJob.status), job: finalJob };
}

export { validateHandoffBundle, readJob, killJob };

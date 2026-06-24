import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { diagnosticsBlockExecution, diagnostic, staticDiagnostics } from "./diagnostics.mjs";
import { validateHandoffBundle } from "./handoffValidator.mjs";
import { defaultLimits, languagePolicyStatus, maxOutputBytes, normalizeLanguage, runtimeForLanguage, staticDiagnosticLanguages } from "./policy.mjs";
import { createJobId, ensureRuntime, inputDir, readJob, stderrPath, stdoutPath, writeInputFile, writeJob } from "./jobStore.mjs";
import { writeAuditEvent } from "./auditLog.mjs";
import { findContainerEngine, findContainerEngines, imageAvailable, runContainerJob, killJob } from "./dockerRunner.mjs";

export async function readBundle(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function readSnapshotPayload(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function doctor() {
  await ensureRuntime();
  const engine = await findContainerEngine();
  const engines = await findContainerEngines();
  const images = {};
  for (const foundEngine of engines) {
    images[foundEngine.bin] = {};
    for (const image of ["python:3.12-alpine", "node:22-alpine"]) images[foundEngine.bin][image] = await imageAvailable(foundEngine.bin, image);
  }
  return {
    local_only: true,
    engine,
    engines,
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

function outputTruncated(text) {
  return Buffer.byteLength(String(text || ""), "utf8") >= maxOutputBytes;
}

function durationMs(job) {
  const started = job.started_at ? new Date(job.started_at).getTime() : 0;
  const finished = job.finished_at ? new Date(job.finished_at).getTime() : 0;
  return started && finished ? Math.max(0, finished - started) : null;
}

function mapJobStatus(job) {
  if (job.status === "succeeded") return "completed";
  if (job.status === "failed") return "failed";
  if (job.status === "timed_out") return "failed";
  if (job.status === "validation_failed") return "sandbox_unavailable";
  return "failed";
}

async function readOutput(jobId) {
  const [stdout, stderr] = await Promise.all([
    fs.readFile(stdoutPath(jobId), "utf8").catch(() => ""),
    fs.readFile(stderrPath(jobId), "utf8").catch(() => "")
  ]);
  return { stdout, stderr };
}

function runtimeDiagnostics(finalJob, { language, fileName, stdout, stderr }) {
  const diagnostics = [];
  if (finalJob.status === "validation_failed") {
    diagnostics.push(diagnostic({ severity: "error", phase: "sandbox", category: "sandbox_internal_failure", language, file: fileName, message: finalJob.result || "Sandbox runtime validation failed before execution.", source: "Sandbox runner" }));
    return diagnostics;
  }
  if (finalJob.timed_out) diagnostics.push(diagnostic({ severity: "error", phase: "sandbox", category: "timeout", language, file: fileName, message: "Sandbox run exceeded the wall-clock timeout and was killed.", source: "Sandbox runner" }));
  if (finalJob.exit_code && finalJob.exit_code !== 0) diagnostics.push(diagnostic({ severity: "error", phase: "runtime", category: "runtime_error", language, file: fileName, message: stderr.trim().slice(0, 1200) || `Process exited with code ${finalJob.exit_code}.`, source: "Container runtime" }));
  if (outputTruncated(stdout) || outputTruncated(stderr)) diagnostics.push(diagnostic({ severity: "warning", phase: "sandbox", category: "output_truncated", language, file: fileName, message: "Sandbox output reached the configured output limit and was truncated.", source: "Sandbox runner" }));
  if (!diagnostics.length) diagnostics.push(diagnostic({ phase: "runtime", category: "policy_info", language, file: fileName, message: "Sandbox run completed without runtime errors. This is evidence only, not trust or approval.", source: "Sandbox runner" }));
  return diagnostics;
}

export function validateSnapshotRunPayload(payload) {
  const language = normalizeLanguage(payload?.language);
  const fileName = String(payload?.file_name ?? payload?.fileName ?? "").trim() || null;
  const code = String(payload?.code ?? "");
  const diagnostics = staticDiagnostics({ language, fileName, code });
  const errors = [];
  if (!String(payload?.snapshot_id ?? payload?.snapshotId ?? "").trim()) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: fileName, message: "Snapshot id is required. Sandbox runs must target explicit snapshots.", source: "Snapshot policy" }));
  if (!code.trim()) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: fileName, message: "Code payload is required.", source: "Snapshot policy" }));
  if (Buffer.byteLength(code, "utf8") > 100000) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: fileName, message: "Code payload exceeds the 100,000 byte V1 limit.", source: "Snapshot policy" }));
  if (payload?.network_policy && payload.network_policy !== "disabled") errors.push(diagnostic({ severity: "error", phase: "policy", category: "network_denied", language, file: fileName, message: "V1 snapshot runs require network_policy=disabled.", source: "Sandbox policy" }));
  if (payload?.filesystem_policy && !["none", "temporary_workspace_only"].includes(payload.filesystem_policy)) errors.push(diagnostic({ severity: "error", phase: "policy", category: "filesystem_denied", language, file: fileName, message: "V1 snapshot runs allow only none or temporary_workspace_only filesystem policy.", source: "Sandbox policy" }));
  return { ok: !diagnosticsBlockExecution(diagnostics) && !errors.length, diagnostics: [...diagnostics, ...errors], language, fileName, code };
}

export async function createAndRunSnapshotRun(payload, { confirmLocalExecution = false } = {}) {
  const validation = validateSnapshotRunPayload(payload);
  const snapshotId = String(payload?.snapshot_id ?? payload?.snapshotId ?? "");
  const sourceType = String(payload?.source_type ?? payload?.sourceType ?? "manual");
  const sourceId = payload?.source_id ?? payload?.sourceId ?? null;
  if (!confirmLocalExecution) {
    return { ok: false, status: "denied", language: validation.language, file: validation.fileName, snapshotId, diagnostics: validation.diagnostics, message: "Refused. Start the service/CLI with explicit local execution confirmation." };
  }
  if (!validation.ok) {
    return { ok: false, status: "policy_blocked", language: validation.language, file: validation.fileName, snapshotId, diagnostics: validation.diagnostics, message: "Snapshot run blocked by language or safety policy." };
  }
  if (staticDiagnosticLanguages.includes(validation.language)) {
    return { ok: true, runId: null, status: "completed", language: validation.language, file: validation.fileName, snapshotId, stdout: "", stderr: "", exitCode: 0, durationMs: 0, diagnostics: validation.diagnostics, message: "Static diagnostics completed. No code execution was needed." };
  }
  if (languagePolicyStatus(validation.language) !== "active_sandbox") {
    return { ok: false, status: "policy_blocked", language: validation.language, file: validation.fileName, snapshotId, diagnostics: validation.diagnostics, message: "Language is not enabled for V1 sandbox execution." };
  }
  const runtime = runtimeForLanguage(validation.language);
  if (!runtime) {
    return { ok: false, status: "policy_blocked", language: validation.language, file: validation.fileName, snapshotId, diagnostics: validation.diagnostics, message: "No runtime is configured for this language." };
  }
  const jobId = createJobId();
  const job = {
    job_id: jobId,
    request_id: snapshotId,
    source_type: sourceType,
    source_id: sourceId,
    language: validation.language,
    file_name: validation.fileName,
    status: "created",
    created_at: new Date().toISOString(),
    exit_code: null,
    timed_out: false,
    killed: false,
    policy_summary: "Snapshot run, Docker/Podman container, network none, read-only root, cap-drop all, no-new-privileges, temporary workspace only.",
    resource_limits: { cpus: defaultLimits.cpus, memory: defaultLimits.memory, timeout_seconds: defaultLimits.timeoutSeconds }
  };
  await writeJob(job);
  await writeAuditEvent(jobId, "snapshot_run_created", "Snapshot run created after policy validation.", { snapshot_id: snapshotId, source_type: sourceType, source_id: sourceId });
  await writeInputFile(jobId, runtime.fileName, validation.code);
  const finalJob = await runContainerJob(job, runtime, fileURLToPath(inputDir(jobId)));
  const { stdout, stderr } = await readOutput(jobId);
  const diagnostics = [...validation.diagnostics, ...runtimeDiagnostics(finalJob, { language: validation.language, fileName: validation.fileName, stdout, stderr })];
  return {
    ok: finalJob.status === "succeeded",
    runId: jobId,
    status: mapJobStatus(finalJob),
    language: validation.language,
    file: validation.fileName,
    snapshotId,
    stdout,
    stderr,
    exitCode: finalJob.exit_code ?? null,
    durationMs: durationMs(finalJob),
    diagnostics,
    message: finalJob.status === "succeeded" ? "Sandbox run completed. This is not a trust or Marketplace approval signal." : finalJob.status === "timed_out" ? "Sandbox run timed out and was killed." : finalJob.result || "Sandbox run failed."
  };
}

export { validateHandoffBundle, readJob, killJob };

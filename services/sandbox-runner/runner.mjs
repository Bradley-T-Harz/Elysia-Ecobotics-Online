import fs from "node:fs/promises";
import { basename } from "node:path";
import { diagnosticsBlockExecution, diagnostic, staticDiagnostics } from "./diagnostics.mjs";
import { validateHandoffBundle } from "./handoffValidator.mjs";
import {
  defaultLimits,
  languagePolicyStatus,
  maxCodeBytes,
  normalizeLanguage,
  runtimeForLanguage,
  sanitizeOutput,
  staticDiagnosticLanguages
} from "./policy.mjs";
import {
  cleanupExpiredJobs,
  createJobId,
  ensureRuntime,
  inputDir,
  readJob,
  removeJob,
  stderrPath,
  stdoutPath,
  writeInputFile,
  writeJob
} from "./jobStore.mjs";
import { cleanupExpiredAuditLogs, writeAuditEvent } from "./auditLog.mjs";
import {
  findContainerEngine,
  imageAvailable,
  killJob,
  cleanupOrphanContainers,
  runContainerJob,
  terminateAllActiveContainers,
  verifyRootlessEngine
} from "./dockerRunner.mjs";
import { loadRunnerConfig, publicConfigReady } from "./serviceConfig.mjs";

const SNAPSHOT_KEYS = new Set(["snapshot_id", "language", "file_name", "code", "network_policy", "filesystem_policy"]);
let executionActive = false;
let acceptingRuns = true;

export function runnerState() {
  return Object.freeze({ acceptingRuns, executionActive });
}

export function beginRunnerShutdown() {
  acceptingRuns = false;
}

export async function shutdownRunner() {
  beginRunnerShutdown();
  return terminateAllActiveContainers();
}

export async function readBundle(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size > 70_000) throw new Error("bundle_too_large");
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function readSnapshotPayload(filePath) {
  return readBundle(filePath);
}

export async function doctor(config = loadRunnerConfig(), options = {}) {
  await ensureRuntime(config);
  const engine = await findContainerEngine(config, options);
  const rootless = Boolean(engine) && await verifyRootlessEngine(config, options);
  const images = {};
  for (const [name, image] of Object.entries(config.images)) {
    images[name] = Boolean(engine) && await imageAvailable(config.engine, image, config, options);
  }
  return {
    ready: publicConfigReady(config) && rootless && Object.values(images).every(Boolean),
    enabled: config.enabled,
    confirmed: config.confirmServiceExecution,
    accepting_runs: acceptingRuns,
    execution_active: executionActive,
    configured_engine: config.engine,
    engine_available: Boolean(engine),
    rootless,
    images,
    runtime_directory_ready: true,
    network_default: "disabled",
    host_execution_fallback: false,
    automatic_engine_fallback: false,
    automatic_image_pull: false
  };
}

export function inspectBundle(bundle) {
  const validation = validateHandoffBundle(bundle);
  return {
    language: bundle.execution_intent?.language ?? null,
    expected_command: bundle.execution_intent?.expected_command ?? null,
    network_policy: bundle.execution_intent?.declared_network_policy ?? null,
    filesystem_policy: bundle.execution_intent?.declared_filesystem_policy ?? null,
    payload_bytes: Buffer.byteLength(String(bundle.payload?.code_text ?? ""), "utf8"),
    runnable_after_confirmation: validation.ok,
    validation
  };
}

export async function createAndRunJob(bundle, { confirmLocalExecution = false, config = loadRunnerConfig() } = {}) {
  if (!confirmLocalExecution) return { ok: false, message: "Refused. Explicit local execution confirmation is required." };
  const validation = validateHandoffBundle(bundle);
  if (!validation.ok) return { ok: false, message: "Bundle validation failed.", validation };
  return createAndRunSnapshotRun({
    snapshot_id: String(bundle.request_id || "local-handoff").slice(0, 160),
    language: bundle.execution_intent.language,
    file_name: validation.runtime?.fileName ?? null,
    code: bundle.payload.code_text,
    network_policy: "disabled",
    filesystem_policy: "temporary_workspace_only"
  }, { confirmLocalExecution: true, config });
}

function validateFileName(fileName, language) {
  if (!fileName) return null;
  if (basename(fileName) !== fileName || fileName.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName)) return null;
  const extensions = {
    python: [".py"],
    javascript: [".js", ".mjs", ".cjs"],
    typescript: [".ts"],
    json: [".json"],
    yaml: [".yaml", ".yml"],
    markdown: [".md"],
    html: [".html", ".htm"],
    css: [".css"]
  };
  const allowed = extensions[language] || [];
  return allowed.some((extension) => fileName.toLowerCase().endsWith(extension)) ? fileName : null;
}

export function validateSnapshotRunPayload(payload) {
  const object = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const language = normalizeLanguage(object.language);
  const rawFileName = String(object.file_name ?? "").trim() || null;
  const fileName = validateFileName(rawFileName, language);
  const code = typeof object.code === "string" ? object.code : "";
  const diagnostics = staticDiagnostics({ language, fileName: rawFileName, code });
  const errors = [];
  if (Object.keys(object).some((key) => !SNAPSHOT_KEYS.has(key))) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: null, message: "Request contains unsupported fields.", source: "Request schema" }));
  const snapshotId = String(object.snapshot_id ?? "");
  if (!snapshotId || snapshotId.length > 160 || /[\u0000-\u001f\u007f]/.test(snapshotId)) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: null, message: "Snapshot id is invalid.", source: "Snapshot policy" }));
  if (!code.trim()) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: rawFileName, message: "Code payload is required.", source: "Snapshot policy" }));
  if (code.includes("\u0000")) errors.push(diagnostic({ severity: "error", phase: "security", category: "forbidden_operation", language, file: rawFileName, message: "Code payload contains a forbidden null byte.", source: "Request schema" }));
  if (Buffer.byteLength(code, "utf8") > maxCodeBytes) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: rawFileName, message: "Code payload exceeds the governed limit.", source: "Snapshot policy" }));
  if (rawFileName && !fileName) errors.push(diagnostic({ severity: "error", phase: "policy", category: "policy_info", language, file: null, message: "File name is invalid for the selected language.", source: "File policy" }));
  if (object.network_policy !== "disabled") errors.push(diagnostic({ severity: "error", phase: "policy", category: "network_denied", language, file: fileName, message: "network_policy must be disabled.", source: "Sandbox policy" }));
  if (object.filesystem_policy !== "temporary_workspace_only") errors.push(diagnostic({ severity: "error", phase: "policy", category: "filesystem_denied", language, file: fileName, message: "Only a temporary workspace is allowed.", source: "Sandbox policy" }));
  return {
    ok: !diagnosticsBlockExecution(diagnostics) && !errors.length,
    diagnostics: [...diagnostics, ...errors].slice(0, 40),
    language,
    fileName,
    code,
    snapshotId
  };
}

function durationMs(job) {
  const started = Date.parse(job.started_at || "");
  const finished = Date.parse(job.finished_at || "");
  return Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : null;
}

function mapJobStatus(job) {
  if (job.status === "succeeded") return "completed";
  if (job.status === "validation_failed" || job.status === "cleanup_failed") return "sandbox_unavailable";
  return "failed";
}

async function readOutput(jobId, config) {
  const [stdout, stderr] = await Promise.all([
    fs.readFile(stdoutPath(jobId, config), "utf8").catch(() => ""),
    fs.readFile(stderrPath(jobId, config), "utf8").catch(() => "")
  ]);
  return { stdout: sanitizeOutput(stdout), stderr: sanitizeOutput(stderr) };
}

function runtimeDiagnostics(job, context) {
  const diagnostics = [];
  if (job.status === "validation_failed" || job.status === "cleanup_failed") diagnostics.push(diagnostic({ severity: "error", phase: "sandbox", category: "sandbox_internal_failure", ...context, message: "Sandbox runtime was unavailable or cleanup could not be verified.", source: "Sandbox runner" }));
  if (job.timed_out) diagnostics.push(diagnostic({ severity: "error", phase: "sandbox", category: "timeout", ...context, message: "The wall-clock timeout was enforced and the container was removed.", source: "Sandbox runner" }));
  if (job.output_overflow) diagnostics.push(diagnostic({ severity: "error", phase: "sandbox", category: "output_truncated", ...context, message: "The hard output limit was enforced and the container was removed.", source: "Sandbox runner" }));
  if (job.status === "failed" && job.exit_code !== 0) diagnostics.push(diagnostic({ severity: "error", phase: "runtime", category: "runtime_error", ...context, message: context.stderr.trim().slice(0, 1000) || "The program exited with a non-zero status.", source: "Container runtime" }));
  if (job.output_truncated && !job.output_overflow) diagnostics.push(diagnostic({ severity: "warning", phase: "sandbox", category: "output_truncated", ...context, message: "Output reached the response limit and was truncated.", source: "Sandbox runner" }));
  if (!diagnostics.length) diagnostics.push(diagnostic({ phase: "runtime", category: "policy_info", ...context, message: "Execution completed. This is evidence only, never trust or approval.", source: "Sandbox runner" }));
  return diagnostics;
}

export async function createAndRunSnapshotRun(payload, { confirmLocalExecution = false, config = loadRunnerConfig(), runContainer = runContainerJob } = {}) {
  const validation = validateSnapshotRunPayload(payload);
  if (!confirmLocalExecution || !config.enabled || !config.confirmServiceExecution || !acceptingRuns) {
    return { ok: false, status: "denied", language: validation.language, file: validation.fileName, snapshotId: validation.snapshotId, stdout: "", stderr: "", exitCode: null, durationMs: null, outputTruncated: false, diagnostics: validation.diagnostics, message: "Sandbox execution is disabled." };
  }
  if (!validation.ok) {
    return { ok: false, status: "policy_blocked", language: validation.language, file: validation.fileName, snapshotId: validation.snapshotId, stdout: "", stderr: "", exitCode: null, durationMs: null, outputTruncated: false, diagnostics: validation.diagnostics, message: "Sandbox request was blocked by policy." };
  }
  if (staticDiagnosticLanguages.includes(validation.language)) {
    const hasError = validation.diagnostics.some((item) => item.severity === "error");
    return {
      ok: !hasError,
      runId: null,
      status: hasError ? "failed" : "completed",
      language: validation.language,
      file: validation.fileName,
      snapshotId: validation.snapshotId,
      stdout: "",
      stderr: "",
      exitCode: hasError ? null : 0,
      durationMs: 0,
      outputTruncated: false,
      diagnostics: validation.diagnostics,
      message: hasError
        ? "Static diagnostics found errors; no code was executed."
        : "Static diagnostics completed without code execution."
    };
  }
  if (languagePolicyStatus(validation.language) !== "active_sandbox") {
    return { ok: false, status: "policy_blocked", language: validation.language, file: validation.fileName, snapshotId: validation.snapshotId, stdout: "", stderr: "", exitCode: null, durationMs: null, outputTruncated: false, diagnostics: validation.diagnostics, message: "Language is not enabled for execution." };
  }
  if (executionActive) return { ok: false, busy: true, status: "sandbox_unavailable", retryAfter: config.retryAfterSeconds, diagnostics: [], message: "Sandbox is busy." };

  const runtime = runtimeForLanguage(validation.language);
  const jobId = createJobId();
  executionActive = true;
  try {
    await ensureRuntime(config);
    const job = {
      job_id: jobId,
      request_id: validation.snapshotId,
      language: validation.language,
      file_name: validation.fileName,
      status: "created",
      created_at: new Date().toISOString(),
      exit_code: null,
      timed_out: false,
      killed: false,
      resource_limits: defaultLimits
    };
    await writeJob(job, config);
    await writeAuditEvent(jobId, "job_created", "Request passed runner policy validation.", {}, config);
    await writeInputFile(jobId, runtime.fileName, validation.code, config);
    const finalJob = await runContainer(job, runtime, inputDir(jobId, config), { config });
    const { stdout, stderr } = await readOutput(jobId, config);
    const diagnostics = [...validation.diagnostics, ...runtimeDiagnostics(finalJob, { language: validation.language, file: validation.fileName, stdout, stderr })].slice(0, 40);
    const status = mapJobStatus(finalJob);
    return {
      ok: finalJob.status === "succeeded",
      runId: jobId,
      status,
      language: validation.language,
      file: validation.fileName,
      snapshotId: validation.snapshotId,
      stdout,
      stderr,
      exitCode: finalJob.exit_code ?? null,
      durationMs: durationMs(finalJob),
      outputTruncated: finalJob.output_truncated === true || finalJob.output_overflow === true,
      diagnostics,
      message: finalJob.status === "succeeded" ? "Sandbox execution completed. This is evidence only, never trust or approval." : finalJob.timed_out ? "Sandbox execution timed out and cleanup was verified." : finalJob.output_overflow ? "Sandbox output limit was enforced and cleanup was verified." : "Sandbox execution failed safely."
    };
  } finally {
    try { await removeJob(jobId, config); }
    finally { executionActive = false; }
  }
}

export async function cleanupRunnerState(config = loadRunnerConfig(), options = {}) {
  const [jobs, audit] = await Promise.all([cleanupExpiredJobs(config), cleanupExpiredAuditLogs(config)]);
  const containers = await cleanupOrphanContainers(config, { preserveRecent: options.removeAllOrphans !== true });
  return { jobs, audit, containers };
}

export { validateHandoffBundle, readJob, killJob };

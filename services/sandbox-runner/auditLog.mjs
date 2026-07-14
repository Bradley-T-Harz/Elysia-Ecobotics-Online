import fs from "node:fs/promises";
import { join } from "node:path";
import { assertJobId, ensureRuntime } from "./jobStore.mjs";
import { redactSecrets } from "./policy.mjs";
import { loadRunnerConfig } from "./serviceConfig.mjs";

const MAX_AUDIT_BYTES = 5 * 1024 * 1024;
const MAX_ROTATIONS = 5;

function boundedMetadata(metadata) {
  const source = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const allowed = {};
  for (const key of ["status", "exit_code", "duration_ms", "timed_out", "output_overflow", "cleanup_ok"]) {
    if (key in source) allowed[key] = source[key];
  }
  return JSON.parse(redactSecrets(JSON.stringify(allowed)));
}

async function rotateIfNeeded(path) {
  const stat = await fs.stat(path).catch(() => null);
  if (!stat || stat.size < MAX_AUDIT_BYTES) return;
  await fs.rm(`${path}.${MAX_ROTATIONS}`, { force: true });
  for (let index = MAX_ROTATIONS - 1; index >= 1; index -= 1) {
    await fs.rename(`${path}.${index}`, `${path}.${index + 1}`).catch(() => {});
  }
  await fs.rename(path, `${path}.1`);
}

export async function writeAuditEvent(jobId, action, reason, metadata = {}, config = loadRunnerConfig()) {
  assertJobId(jobId);
  await ensureRuntime(config);
  const path = join(config.auditRoot, "events.ndjson");
  await rotateIfNeeded(path);
  const event = {
    job_id: jobId,
    action: String(action).slice(0, 80),
    actor: "sandbox_service",
    timestamp: new Date().toISOString(),
    reason: redactSecrets(String(reason)).slice(0, 500),
    metadata: boundedMetadata(metadata)
  };
  await fs.appendFile(path, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  await fs.chmod(path, 0o600);
  return event;
}

export async function cleanupExpiredAuditLogs(config = loadRunnerConfig(), now = Date.now()) {
  await ensureRuntime(config);
  const entries = await fs.readdir(config.auditRoot, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(config.auditRoot, entry.name);
    const stat = await fs.stat(path).catch(() => null);
    if (stat && now - stat.mtimeMs > config.auditRetentionMs) {
      await fs.rm(path, { force: true });
      removed += 1;
    }
  }
  return { removed };
}

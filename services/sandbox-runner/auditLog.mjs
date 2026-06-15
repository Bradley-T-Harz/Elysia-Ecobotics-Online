import fs from "node:fs/promises";
import { auditRoot, redactSecrets } from "./policy.mjs";

export async function writeAuditEvent(jobId, action, reason, metadata = {}) {
  await fs.mkdir(auditRoot, { recursive: true });
  const event = { job_id: jobId, action, actor: "local_user", timestamp: new Date().toISOString(), reason, metadata: JSON.parse(redactSecrets(JSON.stringify(metadata))) };
  await fs.appendFile(new URL("events.ndjson", auditRoot), `${JSON.stringify(event)}\n`);
  return event;
}

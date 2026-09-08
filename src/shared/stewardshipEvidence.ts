export const proofMaxBytes = 10 * 1024 * 1024;
const formats: Record<string, { mime: string; alternatives?: string[] }> = {
  pdf: { mime: "application/pdf" }, png: { mime: "image/png" },
  jpg: { mime: "image/jpeg" }, jpeg: { mime: "image/jpeg" },
  txt: { mime: "text/plain" }, md: { mime: "text/markdown", alternatives: ["text/plain", "text/x-markdown"] }
};
export function proofFileError(file: Pick<File, "name" | "type" | "size"> | null): string | null {
  if (!file) return null;
  const format = formats[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!format) return "Receipt/proof must be a PDF, PNG, JPG, TXT, or Markdown file.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > proofMaxBytes) return "Choose a nonempty proof file no larger than 10 MiB.";
  if (file.type && file.type !== "application/octet-stream" && file.type !== format.mime && !format.alternatives?.includes(file.type)) return "The proof file type does not match its extension.";
  return null;
}

// Basic format validation is defense in depth, not a malware or authenticity scan.
// Never execute, embed, OCR or send these bytes to a third-party scanner.
export async function prepareProofFile(file: File): Promise<{ name: string; mime: string; sha256: string }> {
  const error = proofFileError(file);
  if (error) throw new Error(error);
  const extension = file.name.split(".").pop()!.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let valid = false;
  if (extension === "pdf") valid = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  else if (extension === "png") valid = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  else if (extension === "jpg" || extension === "jpeg") valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  else {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      valid = !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
    } catch { valid = false; }
  }
  if (!valid) throw new Error("The proof contents do not match an accepted file format.");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return { name: `redacted-proof.${extension === "jpeg" ? "jpg" : extension}`, mime: formats[extension].mime,
    sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") };
}

export function proofStorageMetadataMatches(file: { request_id?: string; user_id?: string; bucket?: string; storage_path?: string }, requestId: string, ownerId: string): boolean {
  return file.request_id === requestId && file.user_id === ownerId && file.bucket === "stewardship-receipts"
    && typeof file.storage_path === "string" && file.storage_path.startsWith(`${ownerId}/${requestId}/`)
    && file.storage_path.split("/").length === 3 && !/[\\\u0000-\u001f]/.test(file.storage_path)
    && !file.storage_path.split("/").includes("..");
}

export type ProofLifecycle = {
  id: string; state: "pending" | "completed" | "appeal" | "withdrawn";
  finalAt: string | null; appealClosedAt: string | null;
  hold: { reason: "legal" | "abuse"; reviewAt: string } | null;
  backupInventoryVerified: boolean; restoredCopy: boolean;
};
export type ProofRetentionPolicy = { version: string; daysAfterFinal: number } | null;
// Pure planning: no storage client, credentials, scheduler or deletion capability.
export function planProofRetention(records: ProofLifecycle[], policy: ProofRetentionPolicy, now: Date) {
  if (!Number.isFinite(now.getTime()) || records.length > 1000 || new Set(records.map(r => r.id)).size !== records.length) throw new Error("Invalid retention batch.");
  if (policy && (!/^[a-zA-Z0-9._:-]{1,120}$/.test(policy.version) || !Number.isSafeInteger(policy.daysAfterFinal) || policy.daysAfterFinal < 1 || policy.daysAfterFinal > 3650)) throw new Error("Invalid proposed retention policy.");
  return records.map(record => {
    if (!["pending", "completed", "appeal", "withdrawn"].includes(record.state) || typeof record.backupInventoryVerified !== "boolean" || typeof record.restoredCopy !== "boolean") throw new Error("Invalid proof lifecycle state.");
    let reason: string = "policy_not_adopted";
    let candidate = false;
    if (policy) {
      const finalTime = Date.parse(record.appealClosedAt ?? record.finalAt ?? "");
      const reviewTime = Date.parse(record.hold?.reviewAt ?? "");
      if (record.hold) reason = Number.isFinite(reviewTime) && reviewTime > now.getTime() ? "hold_pending_review" : "hold_review_overdue";
      else if (record.state === "pending" || record.state === "appeal") reason = "review_or_appeal_open";
      else if (!Number.isFinite(finalTime) || finalTime > now.getTime()) reason = "final_date_unverified";
      else if (!record.backupInventoryVerified || record.restoredCopy) reason = "backup_or_restoration_review";
      else if (now.getTime() - finalTime < policy.daysAfterFinal * 86400000) reason = "within_proposed_window";
      else { reason = "candidate_requires_separate_authorization"; candidate = true; }
    }
    return { id: record.id, dryRun: true as const, candidate, reason, policyVersion: policy?.version ?? null };
  });
}

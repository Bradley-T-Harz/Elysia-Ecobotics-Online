import { type SandboxHandoffBundle, type SandboxRequestRecord } from "./sandboxHandoffTypes";
import { validateSandboxRequestInput } from "./sandboxRequestValidator";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortValue(value), null, 2);
}

export async function computeBundleSha256(value: unknown) {
  const text = canonicalJson(value);
  if (!globalThis.crypto?.subtle) return "sha256-unavailable-in-this-browser";
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function handoffFileName(request: Pick<SandboxRequestRecord, "title" | "id">) {
  const slug = (request.title || "sandbox-request").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sandbox-request";
  return `${slug}-${request.id.slice(0, 8)}.elysia-sandbox-request.json`;
}

export async function buildLocalHandoffBundle(request: SandboxRequestRecord): Promise<{ ok: true; bundle: SandboxHandoffBundle; checksum: string; json: string } | { ok: false; message: string }> {
  if (request.request_status !== "approved_for_local_handoff" || request.review_status !== "approved") return { ok: false, message: "Only approved sandbox requests can export a Local Elysia handoff bundle." };
  const validation = validateSandboxRequestInput(request);
  if (!validation.ok) return { ok: false, message: `Handoff export blocked: ${validation.errors.map((item) => item.message).join(" ")}` };
  const createdAt = new Date().toISOString();
  const base: SandboxHandoffBundle = {
    schema_version: "elysia.sandbox_request.v1",
    handoff_kind: "local_elysia_sandbox_request",
    request_id: request.id,
    source: {
      source_type: request.source_type,
      source_id: request.source_id ?? request.code_document_id ?? request.addon_submission_id ?? null,
      title: request.title,
      origin: "elysia_ecobotics_online"
    },
    execution_intent: {
      language: request.language ?? null,
      expected_command: request.expected_command ?? null,
      declared_dependencies: request.declared_dependencies ?? [],
      declared_network_policy: request.declared_network_policy,
      declared_network_domains: request.declared_network_domains ?? [],
      declared_filesystem_policy: request.declared_filesystem_policy,
      declared_file_scopes: request.declared_file_scopes ?? [],
      requested_limits: {
        cpu: request.requested_cpu_limit ?? null,
        memory: request.requested_memory_limit ?? null,
        timeout_seconds: request.requested_timeout_seconds ?? null
      }
    },
    payload: {
      code_text: request.code_text ?? null,
      package_reference: request.package_id ?? null,
      manifest_summary: null
    },
    review: {
      review_status: "approved",
      approved_for_local_handoff: true,
      reviewed_at: request.reviewed_at ?? null,
      reviewer_public_feedback: request.reviewer_public_feedback ?? null,
      security_notes_public: request.security_hold_reason ? [request.security_hold_reason] : []
    },
    safety_contract: {
      website_executed_code: false,
      requires_local_elysia_revalidation: true,
      requires_explicit_local_user_approval: true,
      network_default: "disabled",
      filesystem_default: "isolated_temporary_workspace",
      secrets_included: false,
      private_reviewer_notes_included: false
    },
    integrity: {
      bundle_sha256: "pending",
      created_at: createdAt,
      created_by: "elysia_ecobotics_online"
    }
  };
  const checksum = await computeBundleSha256({ ...base, integrity: { ...base.integrity, bundle_sha256: null } });
  const bundle = { ...base, integrity: { ...base.integrity, bundle_sha256: checksum } };
  return { ok: true, bundle, checksum, json: canonicalJson(bundle) };
}

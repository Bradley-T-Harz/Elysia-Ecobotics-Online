import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(await fs.readFile("docs/security/abuse-control-manifest.json", "utf8"));
const rateMigration = await fs.readFile(
  "supabase/migrations/20260904040000_online_action_rate_and_abuse_decisions.sql",
  "utf8"
);
const storageMigration = await fs.readFile(
  "supabase/migrations/20260904030000_storage_upload_policy_hardening.sql",
  "utf8"
);
const identityWorker = await fs.readFile("services/identity-worker/worker.ts", "utf8");
const identityAbuse = await fs.readFile("services/identity-worker/_shared/abuse.ts", "utf8");
const identityProxy = await fs.readFile("functions/api/identity/[[path]].ts", "utf8");
const sandboxProxy = await fs.readFile("functions/api/sandbox/run.ts", "utf8");

assert(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(manifest.version), "Abuse manifest needs a dated version.");
assert(Array.isArray(manifest.controls) && manifest.controls.length >= 10, "Abuse manifest control coverage is incomplete.");

const ids = manifest.controls.map((control) => control.control_id);
assert(new Set(ids).size === ids.length, "Abuse control IDs must be unique.");
const covered = new Set(manifest.controls.flatMap((control) => control.surface_groups));
for (const surface of manifest.required_surface_groups) {
  assert(covered.has(surface), `Required abuse-control surface is unmapped: ${surface}.`);
}
for (const control of manifest.controls) {
  assert(
    ["enforced", "enforced_dormant", "provider_visibility_partial"].includes(control.status),
    `${control.control_id} has an invalid status.`
  );
  assert(control.primary_owner && control.server_enforcement?.length, `${control.control_id} lacks a server owner/control.`);
  assert(control.source_contracts?.length, `${control.control_id} lacks source evidence.`);
  if (control.status === "provider_visibility_partial") {
    assert(control.surface_groups.includes("edge") && control.known_boundary, `${control.control_id} hides an unresolved provider boundary.`);
  }
}

const expectedPolicyKeys = new Set([
  "account_profile_mutation", "commune_post_create", "commune_comment_create",
  "commune_reaction_write", "commune_vote_write", "commune_realtime_message",
  "community_save_follow", "commons_circle_invitation", "content_report_create",
  "participation_request_create", "stewardship_request_create", "forge_draft_write",
  "marketplace_submission_create", "profile_upload", "private_document_upload",
  "commune_upload", "forge_package_upload"
]);
const documentedPolicyKeys = new Set(
  manifest.controls.flatMap((control) => control.database_policy_keys ?? [])
);
for (const policyKey of expectedPolicyKeys) {
  assert(rateMigration.includes(`('${policyKey}',`), `Rate migration omits ${policyKey}.`);
  assert(documentedPolicyKeys.has(policyKey), `Abuse manifest omits database policy ${policyKey}.`);
}
assert(documentedPolicyKeys.size === expectedPolicyKeys.size, "Manifest contains an unknown database rate policy.");

for (const marker of [
  "private.online_action_rate_counters",
  "private.online_abuse_decisions",
  "online_action_rate_limited",
  "online_rate_storage_upload",
  "public.online_abuse_decision_summary",
  "public.review_online_abuse_decision",
  "public.expire_online_abuse_decisions",
]) assert(rateMigration.includes(marker), `Rate authority omits ${marker}.`);

for (const marker of [
  "request.id::text = pg_catalog.split_part(objects.name, '/', 2)",
  "draft.id::text = pg_catalog.split_part(objects.name, '/', 2)",
  "name ~ '^[^/]+/[^/]+/[^/]+$'",
]) assert(storageMigration.includes(marker), `Storage authority omits ${marker}.`);

assert(identityAbuse.includes("`${operation}:${userId}`"), "Identity rate keys are not operation-scoped.");
assert(identityWorker.includes('"messaging_profile_search"'), "Messaging profile search is not edge-rate-limited.");
assert(identityProxy.includes("MAXIMUM_IDENTITY_PROXY_BODY_BYTES = 65_536"), "Identity proxy body limit is missing.");
assert(sandboxProxy.includes("sandbox_quota_exceeded") && sandboxProxy.includes("sandbox_busy"), "Sandbox quota/concurrency refusals are missing.");

const excluded = new Set(manifest.excluded_signals);
for (const item of [
  "persistent device fingerprint",
  "payment or support status",
  "badge or recognition",
  "private content body",
]) assert(excluded.has(item), `Privacy exclusion is missing: ${item}.`);
assert(
  manifest.decision_record.content_minimization.includes("No request body")
    && manifest.decision_record.content_minimization.includes("IP address")
    && manifest.decision_record.content_minimization.includes("payment state"),
  "Decision record does not state its privacy boundary."
);

console.log("Abuse control manifest test ok.");

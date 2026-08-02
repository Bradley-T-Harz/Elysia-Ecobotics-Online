import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(bin, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      const result = { code, stdout, stderr };
      if (code === 0 || allowFailure) resolve(result);
      else reject(new Error(`${bin} ${args.join(" ")} failed (${code})\n${stderr || stdout}`));
    });
  });
}

const baselinePaths = [
  "supabase/migrations/20260714010000_remote_public_schema_baseline.sql",
  "supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql",
  "supabase/migrations/20260714020000_repository_showcase_structured_metadata_repair.sql",
  "supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql",
];

const economicPaths = [
  "supabase/migrations/20260716010000_badge_security_and_semantics_hardening.sql",
  "supabase/migrations/20260716011000_notification_read_state_hardening.sql",
  "supabase/migrations/20260716011500_economic_notification_authenticity.sql",
  "supabase/migrations/20260716012000_marketplace_identifier_compatibility.sql",
  "supabase/migrations/20260716020000_private_economic_core.sql",
  "supabase/migrations/20260716021000_economic_test_provider_catalog.sql",
  "supabase/migrations/20260716030000_sandbox_credit_ledger_and_metering.sql",
  "supabase/migrations/20260716032000_economic_operator_separation_of_duties.sql",
  "supabase/migrations/20260716034000_sandbox_credit_commerce_and_compensation.sql",
  "supabase/migrations/20260716040000_job_post_economic_sidecar_and_publication_gate.sql",
  "supabase/migrations/20260716050000_marketplace_commerce_licenses_and_seller_accounting.sql",
  "supabase/migrations/20260716060000_organization_sponsorship_waiver_sidecars.sql",
  "supabase/migrations/20260716070000_economic_projections_reporting_notifications_lifecycle.sql",
  "supabase/migrations/20260716071000_economic_route_kill_switch_boundaries.sql",
];

const artisanPaths = [
  "supabase/migrations/20260718010000_shared_identity_profile_governance.sql",
  "supabase/migrations/20260718020000_artisan_core_content_and_media.sql",
  "supabase/migrations/20260718030000_artisan_authorization_rpcs_and_storage.sql",
];

const onlineCompatibilityPaths = [
  "supabase/migrations/20260722010000_public_commons_profile_legacy_compatibility.sql",
  "supabase/migrations/20260723010000_public_commons_profile_cutover_marker_correction.sql",
  "supabase/migrations/20260724010000_commune_canonical_author_attribution.sql",
];

const accountLifecyclePaths = [
  "supabase/migrations/20260728010000_auth_user_deletion_lifecycle.sql",
];

const accountCommunicationPaths = [
  "supabase/migrations/20260802010000_code_proposal_integrity_and_idempotency.sql",
  "supabase/migrations/20260802020000_account_event_foundation.sql",
  "supabase/migrations/20260802030000_code_proposal_account_events.sql",
  "supabase/migrations/20260802040000_account_requests_and_reviews_projection.sql",
];

const activePaths = [
  ...baselinePaths,
  ...economicPaths,
  ...artisanPaths,
  ...onlineCompatibilityPaths,
  ...accountLifecyclePaths,
  ...accountCommunicationPaths,
];

const legacyHashes = new Map(Object.entries({
  "2026_06_02_profile_bootstrap_for_saved_addons.sql": "8750ff6eec1865b10543353131654843411b1ceea27bef19f3933671edf99364",
  "2026_06_02_profile_sync_fields.sql": "b8b2fac3e80b2e229d11a18289ee26b27423cfc7c229a125b36bf042a81d2ab2",
  "2026_06_02_saved_addons_permissions.sql": "15c01b906f7c5f029d696763b81e5b4bf3efc8a45654166107089132db92e4f6",
  "2026_06_10_commons_circle_homebase.sql": "107a0b0646c1fe092bdfb006572790200ea0dde7218f709b800d8b8f565a2299",
  "2026_06_10_commons_circle_homebase_tables_fix.sql": "8fa4c33b22386b3ef10a9f8885518e737207377a6c2c4bcd0555045cca426b92",
  "2026_06_10_commons_profile_setup_columns.sql": "63d5fb852879da44febb730e1eb1c02bf8e3484d1228cebf58031140262d1ec7",
  "2026_06_10_commune_future_account_mode.sql": "7f90b49b3fc2b197da944244d23cbbc8e66c8c1f360cd764fae0014398dfcf6f",
  "2026_06_10_governance_review_system.sql": "d3d7fc8b10aa4a9201dd40813567efb93974dbd369e58fe302ef44ab29ed2f09",
  "2026_06_10_marketplace_local_install_machinery.sql": "b67ee9e7096db005b4758e5c00df44363491488d23f111f335370d2f0e859504",
  "2026_06_10_marketplace_saved_addons_and_install_intents_fix.sql": "3b6c48c9a5ccacb7eb32f4cf6f7fc2b9de01b2309985e90e5138b69f95212f33",
  "2026_06_10_work_with_private_attachments.sql": "4c43ebed4c7d49c2fae5d51fedcb14a5dea8d45471412d98da6e00a33bcae3e7",
  "2026_06_12_admin_moderation_completion_pass.sql": "62a0a2f426ce3462d9b5dfb17e4a719c1239f17a8cf6b9558b140c0193baef2b",
  "2026_06_12_commons_circle_badge_credits_system.sql": "0b8e174141580b8343bb8ebcd9c6c172bbcf165584a827ff31059d46911301dd",
  "2026_06_12_commons_circle_final_badge_definitions.sql": "38731b526244153d7eae0fa154281e02302bdc0361abaca5f029fd3156675668",
  "2026_06_12_commune_full_system.sql": "e7380e18a58d8bd31abdb263de08d9fe650c8d7c19363a4c619c226b4bed71b6",
  "2026_06_12_developer_forge_full_system.sql": "0dc80458dd2201c02a34ccfc524c5501bdcf1b7736ef9749dc0cd95c2b41568b",
  "2026_06_12_zz_backfill_free_member_badges.sql": "36e0ee27afedfcac14d8ca4e19e7244a96056bed97580ab1d037bac8903ce7df",
  "2026_06_13_marketplace_publish_revoke_pipeline.sql": "ded56233033b342499dbcd64f36c75502d87d29756c4f9b3137974f0b00fae00",
  "2026_06_14_addon_archive_inspection_metadata.sql": "ddd727bc80ba1b475d6bbbe2d24128399ac8beea2278b2e4282fec88669d1def",
  "2026_06_14_commune_collaborative_code_review.sql": "453b0eb112a1a9b947ba0ad7e3baf371352017201b7274086985b3bab1fa1a8d",
  "2026_06_14_commune_realtime_chat_moderation.sql": "169366917059b67805b3ec23b888b205950ab077f7b603042916d5cd603d804d",
  "2026_06_14_sandbox_request_local_handoff.sql": "4afaabe0c3c24dd7ab61a95f26c971fed38b31d693fdf9984e94118744ca856d",
  "2026_06_21_commune_comment_direct_publish_policy.sql": "7ef5aef56e881f18a799dca8170cf8fd038874326350d5eea036f5486f745b1f",
  "2026_06_21_commune_content_reactions.sql": "366b01a33db7aecf0885dcae7da56a4b3c04616b3c093e68c341c0efb6d4570b",
  "2026_06_21_commune_thread_participant_approvals.sql": "26a69833e8e27330939615343a75eb7e215e4e3b4ad7dbd0bcef5c0d25193557",
  "2026_06_22_commons_public_profile_fields.sql": "5a24fa2f81bf71a20525f769f7f3b381b88c5cad0337263bf452916bfee42938",
  "2026_06_22_commune_comment_notification_dependency_repair.sql": "b5c738f4622a695c236f342466b75cba4684bc583fc3c1b5a47c705fecb14bd8",
  "2026_06_22_commune_comments_schema_drift_repair.sql": "6bc9b6cc7b73dc25c0ee9ad2c704142e2dad957bab53f357d58eea00a69eda4b",
  "2026_06_23_commune_room_post_admin_and_media_policy_repair.sql": "b4c2ec51ce5aabafd619a3239d31b81808c591e3c92001cd011b9726eda7f59a",
  "2026_06_24_coding_cornucopia_runs_and_diagnostics.sql": "da3a000897838dd5a04b09ee6c39c236aa56f27db106ee387d1b04cff541388e",
  "2026_06_24_commune_published_media_display_policy.sql": "1366c8e82be16d6b732d67fce83ec9ea4cc776546db3a6e98b7d9ee628a00352",
  "2026_06_25_coding_cornucopia_author_revision_proposals.sql": "e9ce3e57029b1a3dcf87c63a10ec42476f557dbfe98368b7db7b46e5a8714d74",
  "2026_06_25_coding_cornucopia_run_result_recording.sql": "3b84d391e621304a5790569a98d4ee9abe1e05a2658b8a97cae3ddf2df6129dc",
  "2026_06_26_elysia_iteration_showcase_structured_metadata.sql": "06e06d3c9a0cb66507302433316b17b4edb156247c65be402e3ceea1e0df00de",
  "2026_06_26_job_post_structured_workflow.sql": "2f867f447d25e63cfb69c46cbb88ee769cbf1c7a2079a4fba14570454d87e7a4",
  "2026_06_26_official_update_structured_workflow.sql": "73e157cfaa1158d94301cd47da30c7a11f6b93f3d05c7aa2c0ab82f0031d9390",
  "2026_06_26_repository_showcase_structured_metadata.sql": "9675a895b8aa12d672d2c0e3f50c2a499ad33351b2df9d970c603b92bc58d8e5",
  "2026_06_26_research_notes_structured_workflow.sql": "ece0f2259d70d0c019bd929f2a372600088cd4232d67d4bdb170e8d53e55b4a2",
  "2026_06_26_troubleshooting_grove_structured_workflow.sql": "793ba9f251e7e04a21e3ec731e260017b0db6972a9bbcaff565289ba861172b5",
  "2026_06_27_developer_forge_submission_snapshots.sql": "900bec1dc37014ed07bc16cfdb592744eedce49419987d20f3e65a51bb0dad6b",
  "2026_07_02_commons_banner_framing.sql": "6e435fdbf593c9a94d049830df8f81bb249fb59a6728b018d839d84a09576c27",
  "2026_07_05_01_commune_community_voting_room_enum.sql": "66a833842c7f69cc18cdfabd21156eef12f5ffa69caebdc55d91cfe5611de47c",
  "2026_07_05_02_commune_community_voting_room.sql": "5f2541048ad522ec3462fe7e72322841496e6c97cd0f0db596e9d3b4244d5f24",
  "2026_07_07_commune_soft_delete_cleanup.sql": "bbb93a056ccb4f7e4219c4817a8ae75a25e9ccfe80827cc3c4842a8aae3329f3",
  "2026_07_08_commune_vote_delete_parent_filter.sql": "05b9909c12aa66d5995e7b933b2c45473b6c34772a6b325de4bd6744e116b255",
  "2026_07_11_fix_commune_vote_soft_delete_rpc.sql": "01639303ca2fcd36754dea8f51a4c8b71f452bcb3a2f31467d302db19ddcdec1",
  "2026_07_13_sandbox_proxy_access_and_reservation.sql": "0113cd913db0774227388fecdfbbb7f7e78de591d1e2a80f3b48f5564fb35145",
}));

const activeNames = (await fs.readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
assert(activeNames.length === activePaths.length, `Expected exactly ${activePaths.length} active migrations, found ${activeNames.length}.`);
assert(activeNames.every((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)), "Every active migration needs a unique 14-digit Supabase version.");
assert(activeNames.join("\n") === activePaths.map((value) => path.basename(value)).join("\n"), "Active migration order or filenames changed.");

const legacyNames = (await fs.readdir("supabase/legacy-migrations")).filter((name) => name.endsWith(".sql")).sort();
assert(legacyNames.length === legacyHashes.size, `Expected ${legacyHashes.size} archived migrations, found ${legacyNames.length}.`);
assert(legacyNames.join("\n") === [...legacyHashes.keys()].sort().join("\n"), "Legacy migration archive membership changed.");
const manifest = await fs.readFile("supabase/legacy-migrations/MANIFEST.md", "utf8");
for (const name of legacyNames) {
  const bytes = await fs.readFile(path.join("supabase/legacy-migrations", name));
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  assert(digest === legacyHashes.get(name), `Archived migration content changed: ${name}.`);
  const manifestRow = manifest.split("\n").find((line) => line.includes(`\`${name}\``));
  assert(manifestRow, `Legacy manifest omits ${name}.`);
  assert(manifestRow.includes(`\`${digest}\``), `Legacy manifest hash is wrong for ${name}.`);
}

const [baseline, reactionMigration, repositoryMigration, sandboxMigration, schemaSnapshot, policySnapshot] = await Promise.all([
  fs.readFile(activePaths[0], "utf8"),
  fs.readFile(activePaths[1], "utf8"),
  fs.readFile(activePaths[2], "utf8"),
  fs.readFile(activePaths[3], "utf8"),
  fs.readFile("supabase/schema.sql", "utf8"),
  fs.readFile("supabase/policies.sql", "utf8"),
]);

const economicMigrations = await Promise.all(economicPaths.map((file) => fs.readFile(file, "utf8")));
const artisanMigrations = await Promise.all(artisanPaths.map((file) => fs.readFile(file, "utf8")));
const onlineCompatibilityMigrations = await Promise.all(
  onlineCompatibilityPaths.map((file) => fs.readFile(file, "utf8"))
);
const accountLifecycleMigrations = await Promise.all(
  accountLifecyclePaths.map((file) => fs.readFile(file, "utf8"))
);
const accountCommunicationMigrations = await Promise.all(
  accountCommunicationPaths.map((file) => fs.readFile(file, "utf8"))
);
const routeKillSwitchMigration = economicMigrations.at(-1);
assert(routeKillSwitchMigration, "Economic route kill-switch migration is missing.");
const economicBehaviorFixture = await fs.readFile("scripts/fixtures/economicDatabaseBehavior.sql", "utf8");
for (const [index, migration] of economicMigrations.entries()) {
  assert(migration.startsWith("--"), `${economicPaths[index]} needs an explanatory header.`);
  assert(/^begin;/im.test(migration), `${economicPaths[index]} must start a transaction.`);
  assert(/commit;\s*$/i.test(migration), `${economicPaths[index]} must commit atomically.`);
  assert(!/postgres(?:ql)?:\/\//i.test(migration), `${economicPaths[index]} contains a connection string.`);
  assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(migration), `${economicPaths[index]} contains a token-like value.`);
}
for (const [index, migration] of artisanMigrations.entries()) {
  assert(migration.startsWith("--"), `${artisanPaths[index]} needs an explanatory header.`);
  assert(/^begin;/im.test(migration), `${artisanPaths[index]} must start a transaction.`);
  assert(/commit;\s*$/i.test(migration), `${artisanPaths[index]} must commit atomically.`);
  assert(!/postgres(?:ql)?:\/\//i.test(migration), `${artisanPaths[index]} contains a connection string.`);
  assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(migration), `${artisanPaths[index]} contains a token-like value.`);
}
for (const [index, migration] of onlineCompatibilityMigrations.entries()) {
  assert(migration.startsWith("--"), `${onlineCompatibilityPaths[index]} needs an explanatory header.`);
  assert(/^begin;/im.test(migration), `${onlineCompatibilityPaths[index]} must start a transaction.`);
  assert(/commit;\s*$/i.test(migration), `${onlineCompatibilityPaths[index]} must commit atomically.`);
  assert(!/postgres(?:ql)?:\/\//i.test(migration), `${onlineCompatibilityPaths[index]} contains a connection string.`);
  assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(migration), `${onlineCompatibilityPaths[index]} contains a token-like value.`);
}
for (const [index, migration] of accountLifecycleMigrations.entries()) {
  assert(migration.startsWith("--"), `${accountLifecyclePaths[index]} needs an explanatory header.`);
  assert(/^begin;/im.test(migration), `${accountLifecyclePaths[index]} must start a transaction.`);
  assert(/commit;\s*$/i.test(migration), `${accountLifecyclePaths[index]} must commit atomically.`);
  assert(!/postgres(?:ql)?:\/\//i.test(migration), `${accountLifecyclePaths[index]} contains a connection string.`);
  assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(migration), `${accountLifecyclePaths[index]} contains a token-like value.`);
}
for (const [index, migration] of accountCommunicationMigrations.entries()) {
  assert(migration.startsWith("--"), `${accountCommunicationPaths[index]} needs an explanatory header.`);
  assert(/^begin;/im.test(migration), `${accountCommunicationPaths[index]} must start a transaction.`);
  assert(/commit;\s*$/i.test(migration), `${accountCommunicationPaths[index]} must commit atomically.`);
  assert(!/postgres(?:ql)?:\/\//i.test(migration), `${accountCommunicationPaths[index]} contains a connection string.`);
  assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(migration), `${accountCommunicationPaths[index]} contains a token-like value.`);
}
const accountCommunicationSource = accountCommunicationMigrations.join("\n");
for (const marker of [
  "client_request_id",
  "commune_code_revision_proposals_post_snippet_fk",
  "submit_commune_code_revision_proposal_v2",
  "code_proposal_idempotency_conflict",
  "withdraw_commune_code_revision_proposal",
  "revoke insert, update, delete",
  "snippet.post_id = proposal.post_id",
  "private.account_events",
  "public.account_inbox_items",
  "public.account_notifications",
  "private.account_delivery_outbox",
  "account_event_is_immutable",
  "current_user_event_counts",
  "account_event_idempotency_conflict",
  "project_code_proposal_account_event",
  "code-proposal:",
  "private.current_user_request_review_rows",
  "public.current_user_request_counts",
  "public.current_user_requests_and_reviews",
]) assert(accountCommunicationSource.includes(marker), `Account communication migration chain omits ${marker}.`);
const accountCommunicationPlpgsqlFunctions = [...new Set(
  [...accountCommunicationSource.matchAll(/create or replace function\s+(public|private)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`),
)];
const accountLifecycleSource = accountLifecycleMigrations.join("\n");
for (const marker of [
  "account_participation_user_id_fkey",
  "community_notification_preferences_user_id_fkey",
  "on delete cascade",
  "auth_user_deletion_lifecycle_prerequisite_drift",
  "auth_user_deletion_lifecycle_constraints_missing",
]) assert(accountLifecycleSource.includes(marker), `Account Auth deletion lifecycle migration omits ${marker}.`);
assert(
  (accountLifecycleSource.match(/on delete cascade/gi) || []).length === 2,
  "Account Auth deletion lifecycle migration must change exactly the two automatically bootstrapped constraints."
);
for (const protectedRelation of [
  "age_assurance_events",
  "guardian_relationships",
  "guardian_consents",
  "account_legal_holds",
  "community_audit_events",
  "commune_posts",
  "commune_comments",
  "artisan.artworks",
  "artisan.comments",
  "economic_orders",
]) assert(
  !accountLifecycleSource.includes(`alter table ${protectedRelation}`)
    && !accountLifecycleSource.includes(`alter table private.${protectedRelation}`)
    && !accountLifecycleSource.includes(`alter table public.${protectedRelation}`),
  `Account Auth deletion lifecycle migration must not broaden deletion semantics for ${protectedRelation}.`
);
const artisanSource = artisanMigrations.join("\n");
for (const marker of [
  "private.community_profile_is_public",
  "private.recompute_community_participation",
  "public.profile_public_cards",
  "private.community_provider_transactions",
  "create schema if not exists artisan",
  "artisan.media_processing_jobs",
  "public.artisan_public_media_asset",
  "approved_checksum_sha256",
  "thumbnail_checksum_sha256",
  "private_original_requires_safe_transform",
]) assert(artisanSource.includes(marker), `Artisan migration chain omits ${marker}.`);
const artisanPlpgsqlFunctions = [...new Set(
  [...artisanSource.matchAll(/create or replace function\s+(public|private)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`),
)];
const onlineCompatibilitySource = onlineCompatibilityMigrations.join("\n");
for (const marker of [
  "private.community_legacy_online_profile_is_public",
  "private.community_safe_online_public_profile_cards",
  "public.get_public_commons_profile_presentation",
  "public.resolve_online_public_profile_handle",
  "public.get_online_public_profile_avatar_asset",
  "public.get_online_public_profile_banner_asset",
  "public.resolve_public_commune_attributions",
]) assert(
  onlineCompatibilitySource.includes(marker),
  `Online profile compatibility migration omits ${marker}.`
);
const onlineCompatibilityPlpgsqlFunctions = [...new Set(
  [...onlineCompatibilitySource.matchAll(/create or replace function\s+(public|private)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`),
)];
const economicSource = economicMigrations.join("\n");
const economicPlpgsqlFunctions = [...new Set(
  [...economicSource.matchAll(/create or replace function\s+(public|private)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`),
)];
for (const marker of [
  "private.economic_orders", "private.economic_payment_transactions",
  "private.economic_subscriptions", "private.economic_refunds",
  "private.economic_disputes", "private.economic_operator_assignments",
  "private.sandbox_credit_ledger_entries", "private.job_post_economic_conditions",
  "private.marketplace_licenses", "private.organization_service_engagements",
  "private.sponsorship_agreements", "private.economic_assistance_programs",
  "public.process_economic_provider_event", "public.current_user_economic_account_summary",
  "public.current_user_economic_operator_overview", "public.current_user_economic_audit_events",
  "PREPARE TEST MARKETPLACE PAYOUT", "economic_marketplace_payout_execution_unavailable",
  "providerExecutionAvailable", "paymentTransactionId", "sponsorship_checkout",
  "organizationServiceCheckoutEnabled", "sponsorshipCheckoutEnabled",
  "recognitionPreferenceAvailable",
  "private.sandbox_credit_recurring_payment_fulfillments",
  "private.sandbox_credit_recurring_adjustment_shortfalls",
  "public.set_sandbox_test_credit_program_status",
  "public.operator_grant_sandbox_credit_program",
  "sandboxCreditTerms",
  "economic_customer_portal_rate_limited",
  "marketplace_seller_onboarding_rate_limited",
  "marketplace_seller_status_rate_limited",
  "private.economic_seller_provider_status_requests",
  "private.marketplace_fulfillment_holds",
  "marketplace_paid_fulfillment_quarantined",
  "marketplace_fulfillment_review",
  "private.job_post_payment_holds",
  "private.job_post_checkout_is_eligible",
  "job_post_payment_quarantined",
  "job_post_payment_review",
  "private.organization_sponsorship_settlement_holds",
  "organization_service_payment_review",
  "sponsorship_payment_review",
  "organization_service_settlement_hold",
  "sponsorship_settlement_hold",
  "economic_operator_ineligible_assignment_closed",
  "break_glass_recovery",
  "public.expire_stale_economic_checkouts",
  "public.attach_economic_checkout_billing_customer",
  "checkout_billing_customer_attached",
  "economic_billing_customer_required",
  "private.economic_account_is_recoverable",
  "economic_recoverable_account_required",
  "economic_billing_customer_initialization_in_progress",
  "checkout_session_expired",
  "v_projected_order_status",
]) assert(economicSource.includes(marker), `Economic migration chain omits ${marker}.`);
for (const marker of [
  "evt_payment_success_delivered_after_refund",
  "evt_payment_success_delivered_after_dispute"
]) assert(economicBehaviorFixture.includes(marker), `Economic disposable fixture omits ${marker}.`);
assert(
  economicBehaviorFixture.includes("unresolved Marketplace fulfillment hold revived license, entitlement, or payable state"),
  "Economic disposable fixture omits Marketplace hold non-revival coverage."
);
assert(
  /checkout_expires_at\s*=\s*pg_catalog\.now\(\)\s*\+\s*interval '35 minutes'/i.test(economicSource)
    && /expire_stale_economic_checkouts_core\(20, p_actor_user_id\)/i.test(economicSource),
  "Account-linked Checkout initialization must retain a bounded, skew-safe stale-session recovery path.",
);
assert(
  economicSource.includes("check (row_limit between 1 and 100)")
    && economicSource.includes("p_limit not between 1 and 100")
    && economicSource.includes("economic_accounting_export_rate_limited")
    && economicSource.includes("economic_accounting_export_actions_actor_created_idx"),
  "Accounting exports must stay within the browser transport bound and a server-side generation rate bound.",
);
assert(
  /revoke all privileges on function public\.process_economic_provider_event\(text, text, text, timestamptz, text, jsonb\)[\s\S]*from public, anon, authenticated, service_role;/i.test(economicSource),
  "Verified webhook state mutation must be server-only.",
);
assert(
  /grant execute on function public\.current_user_economic_account_summary\(\) to authenticated;/i.test(economicSource),
  "The self-only account projection must remain available to authenticated users.",
);
assert(
  /drop function public\.request_economic_account_action\(uuid, text, text, text\);/i.test(routeKillSwitchMigration)
    && /revoke all privileges on function public\.request_economic_account_action\(uuid, uuid, text, text, text\)[\s\S]*?from public, anon, authenticated, service_role;/i.test(routeKillSwitchMigration)
    && /grant execute on function public\.request_economic_account_action\(uuid, uuid, text, text, text\)\s+to service_role;/i.test(routeKillSwitchMigration)
    && !/grant execute on function public\.request_economic_account_action\([^)]*\)\s+to (?:anon|authenticated)/i.test(routeKillSwitchMigration),
  "Economic account actions must remain Worker-only after verified actor derivation.",
);
for (const recognitionFunction of ["public_support_recognition", "public_sponsorship_recognition"]) {
  assert(
    new RegExp(`revoke all privileges on function public\\.${recognitionFunction}\\(\\)[\\s\\S]*?from public, anon, authenticated, service_role;`, "i").test(routeKillSwitchMigration)
      && new RegExp(`grant execute on function public\\.${recognitionFunction}\\(\\)\\s+to service_role;`, "i").test(routeKillSwitchMigration)
      && !new RegExp(`grant execute on function public\\.${recognitionFunction}\\(\\)\\s+to (?:anon|authenticated)`, "i").test(routeKillSwitchMigration),
    `Public ${recognitionFunction} projection must be loaded only by the environment-gated Worker endpoint.`,
  );
}
const declaredEconomicPublicFunctions = new Set(
  [...economicSource.matchAll(/create or replace function\s+public\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1]),
);
const aclManifestFunctions = new Set(
  [...economicBehaviorFixture.matchAll(/'public\.([a-z0-9_]+)\([^']*\)'::regprocedure/gi)]
    .map((match) => match[1]),
);
const hardenedExistingBadgeFunctions = new Set([
  "create_badge_credit_event", "grant_user_badge", "revoke_badge_credit_event",
]);
for (const functionName of declaredEconomicPublicFunctions) {
  assert(aclManifestFunctions.has(functionName), `Economic ACL manifest omits public.${functionName}.`);
}
for (const functionName of hardenedExistingBadgeFunctions) {
  assert(aclManifestFunctions.has(functionName), `Economic ACL manifest omits hardened public.${functionName}.`);
}
for (const functionName of aclManifestFunctions) {
  assert(
    declaredEconomicPublicFunctions.has(functionName) || hardenedExistingBadgeFunctions.has(functionName),
    `Economic ACL manifest contains an unmanaged function: public.${functionName}.`,
  );
}
const publicSupportProjection = economicSource.match(
  /create or replace function public\.public_support_recognition\(\)[\s\S]*?\n\$\$;/i,
);
assert(publicSupportProjection, "Public support recognition projection is missing.");
assert(!publicSupportProjection[0].includes("'profileId'"), "Public support recognition must not expose an auth/profile UUID.");
assert(publicSupportProjection[0].includes("'username'"), "Public support recognition needs a bounded public handle.");
const economicOperatorOverview = economicSource.match(
  /create or replace function public\.current_user_economic_operator_overview\(\)[\s\S]*?\n\$\$;/gi,
);
assert(economicOperatorOverview?.length, "Economic operator overview projection is missing.");
const finalEconomicOperatorOverview = economicOperatorOverview.at(-1);
assert(finalEconomicOperatorOverview.includes("'queueLimit', 10"), "Economic operator overview queue limit must remain 10.");
assert(!/\blimit\s+50\b/i.test(finalEconomicOperatorOverview), "Economic operator overview contains an oversized queue.");
assert(
  /'featureFlags'[\s\S]*?where feature_key = any\(array\[[\s\S]*?limit 25/i.test(finalEconomicOperatorOverview),
  "Economic operator feature flags need an explicit reviewed allowlist and hard maximum.",
);
assert(
  /create trigger economic_payments_grant_recurring_sandbox_program[\s\S]*?private\.grant_recurring_sandbox_program_from_payment\(\)/i.test(economicSource),
  "Configured recurring sandbox programs need transaction-scoped fulfillment.",
);
assert(
  !/drop trigger if exists economic_payments_grant_recurring_sandbox_program/i.test(economicSource),
  "Recurring sandbox program fulfillment is disconnected from verified payments.",
);

assert(baseline.startsWith("-- REMOTE PUBLIC-SCHEMA BASELINE — HISTORY RECONCILIATION ONLY."), "Baseline warning header missing.");
assert(baseline.includes("NEVER execute this baseline against the existing production project"), "Baseline production prohibition missing.");
assert(!/CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(auth|storage)["']?/i.test(baseline), "Baseline must not recreate Supabase-managed auth/storage schemas.");
assert(!/postgres(?:ql)?:\/\//i.test(baseline), "Baseline contains a connection string.");
assert(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,})\b/.test(baseline), "Baseline contains a token-like value.");
assert(!/^[ \t]*COPY[ \t]+.+[ \t]+FROM[ \t]+stdin/im.test(baseline), "Schema-only baseline contains table rows.");

for (const marker of [
  "begin;", "public.commune_content_reaction_totals", "enable row level security",
  "visible content reaction totals are readable", "public.commune_posts as post",
  "public.commune_comments as comment", "public.sync_commune_content_reaction_totals",
  "security definer", "set search_path = ''", "security_invoker = true",
  "security_barrier = true", "from public, anon, authenticated, service_role",
  "commit;",
]) assert(reactionMigration.includes(marker), `Reaction-count security repair omits ${marker}.`);
assert(
  /revoke all privileges on function public\.sync_commune_content_reaction_totals\(\)[\s\S]*from public, anon, authenticated, service_role;/i.test(reactionMigration),
  "Reaction aggregate trigger function must not be directly executable by API roles.",
);
assert(
  /insert into public\.commune_content_reaction_totals[\s\S]*count\(\*\) filter/i.test(reactionMigration),
  "Reaction-count security repair must backfill userless aggregates transactionally.",
);

const repositoryFields = [
  "provider", "default_branch", "commit_sha", "manifest_status", "elysia_compatibility",
  "short_description", "readme_preview", "file_tree_preview", "screenshot_notes_or_urls",
  "risk_flags", "sandbox_review_status", "sandbox_review_request_id", "import_source",
  "imported_metadata", "imported_at", "redaction_notes",
];
for (const field of repositoryFields) assert(repositoryMigration.includes(`add column if not exists ${field}`), `Repository repair omits ${field}.`);
for (const marker of [
  "begin;", "do $repository_repair$", "commune_repository_showcases_sandbox_review_status_check",
  "commune_repository_showcases_post_idx", "commune_repository_showcases_owner_status_idx",
  "commune_repository_showcases_sandbox_review_idx", "commune_repository_showcases_sandbox_request_idx",
  "p.status = 'published'", "p.visibility = 'public'",
  "revoke all privileges on table public.commune_repository_showcases", "commit;",
]) assert(repositoryMigration.includes(marker), `Repository repair omits ${marker}.`);
assert(!repositoryMigration.includes("exception when others"), "Repository constraint validation must fail closed and roll back.");

for (const marker of [
  "revoke all privileges on table public.commune_sandbox_runs",
  "revoke all privileges on table public.commune_code_diagnostics",
  "from public, anon, authenticated, service_role",
  "private.sandbox_actor_is_active", "account.deleted_at is null",
  "account.is_anonymous is false", "account.banned_until",
  "sandbox_account_disabled", "post.status = 'published' and post.visibility = 'public'",
  "public reads published commune code snippets", "reservation_expires_at",
  "pg_catalog.pg_advisory_xact_lock", "sandbox_idempotency_conflict",
  "sandbox_final_result_inconsistent", "reconcile_stale_commune_sandbox_runs",
  "alter schema private owner to postgres", "alter table private.sandbox_proxy_secrets owner to postgres",
  "commit;",
]) assert(sandboxMigration.includes(marker), `Sandbox repair omits ${marker}.`);

const protectedFunctionMatches = [...sandboxMigration.matchAll(/create or replace function\s+(?:public|private)\.([a-z0-9_]+)\s*\([^]*?\n\$\$;/gi)];
assert(protectedFunctionMatches.length === 9, `Expected nine governed functions, found ${protectedFunctionMatches.length}.`);
for (const match of protectedFunctionMatches) {
  assert(/security definer/i.test(match[0]), `${match[1]} must be SECURITY DEFINER.`);
  assert(/set search_path = ''/i.test(match[0]), `${match[1]} must use an empty search_path.`);
  assert(
    new RegExp(`alter function\\s+(?:public|private)\\.${match[1]}\\s*\\(`, "i").test(sandboxMigration),
    `${match[1]} must have an explicit owner statement.`,
  );
}
assert((sandboxMigration.match(/owner to postgres;/gi) || []).length === 11, "Private schema/table and all nine protected functions must be postgres-owned.");

for (const [snapshotPath, snapshot] of [
  ["supabase/schema.sql", schemaSnapshot],
  ["supabase/policies.sql", policySnapshot],
]) {
  assert(snapshot.includes("-- Active migration repair snapshot (2026-07-14)."), `${snapshotPath} is missing its pre-economic 2026-07-14 repair marker.`);
  assert(snapshot.includes(reactionMigration.trim()), `${snapshotPath} does not contain the complete 2026-07-14 reaction-count repair checkpoint.`);
  assert(snapshot.includes(repositoryMigration.trim()), `${snapshotPath} does not contain the complete 2026-07-14 Repository repair checkpoint.`);
  assert(snapshot.endsWith(`${sandboxMigration.trim()}\n`), `${snapshotPath} must end at the pre-economic 2026-07-14 sandbox repair checkpoint.`);
  assert(
    !snapshot.includes("private.economic_feature_flags") && !snapshot.includes("private.economic_orders"),
    `${snapshotPath} unexpectedly contains forward 20260716 economic state; it is a pre-economic reference snapshot, not a synchronized current schema.`,
  );
}

console.log("Sandbox database migration static checks ok.");

if (process.env.ELYSIA_SANDBOX_DATABASE_INTEGRATION !== "1") {
  console.log("Disposable database execution skipped; set ELYSIA_SANDBOX_DATABASE_INTEGRATION=1 to enable it.");
  process.exit(0);
}

const image = process.env.ELYSIA_SUPABASE_POSTGRES_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.127";
const container = `elysia-sandbox-migration-test-${process.pid}`;
const requestedRuntime = process.env.ELYSIA_CONTAINER_RUNTIME?.trim();

async function selectContainerRuntime() {
  const candidates = requestedRuntime ? [requestedRuntime] : ["podman", "docker"];
  const failures = [];
  for (const candidate of candidates) {
    const probe = await run(candidate, ["version"], { allowFailure: true }).catch((error) => ({
      code: -1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: "",
    }));
    if (probe.code === 0) return candidate;
    failures.push(`${candidate}: ${(probe.stderr || probe.stdout || `exit ${probe.code}`).trim()}`);
  }
  throw new Error(`No usable rootless/user-scoped container runtime was found.\n${failures.join("\n")}`);
}

const containerRuntime = await selectContainerRuntime();
let started = false;
try {
  console.log(`Using disposable container runtime: ${containerRuntime}.`);
  await run(containerRuntime, [
    "run", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=elysia_disposable_only",
    "-d", image,
  ]);
  started = true;

  const deadline = Date.now() + 60_000;
  let databaseReady = false;
  while (Date.now() < deadline) {
    const readiness = await run(containerRuntime, [
      "exec", container, "pg_isready", "-q", "-U", "supabase_admin", "-d", "postgres",
    ], { allowFailure: true });
    if (readiness.code === 0) {
      databaseReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!databaseReady) {
    const state = await run(containerRuntime, ["inspect", container, "--format", "{{.State.Status}}"], { allowFailure: true });
    const logs = await run(containerRuntime, ["logs", "--tail", "80", container], { allowFailure: true });
    throw new Error(`Disposable database did not become ready (state: ${state.stdout.trim() || "unknown"}).\n${logs.stderr || logs.stdout}`);
  }

  for (const file of [
    ...activePaths,
    "scripts/fixtures/sandboxDatabaseBehavior.sql",
    "scripts/fixtures/codeRevisionProposalBehavior.sql",
    "scripts/fixtures/economicDatabaseBehavior.sql",
    "scripts/fixtures/artisanDatabaseBehavior.sql",
    "scripts/fixtures/onlinePublicProfileBehavior.sql",
    "scripts/fixtures/communeCanonicalAttributionBehavior.sql",
    "scripts/fixtures/accountAuthDeletionLifecycleBehavior.sql",
    "scripts/fixtures/codeProposalIntegrityBehavior.sql",
    "scripts/fixtures/accountEventFoundationBehavior.sql",
    "scripts/fixtures/accountRequestsReviewsBehavior.sql",
    "scripts/sql/supabase_read_only_inventory.sql",
  ]) {
    await run(containerRuntime, ["cp", file, `${container}:/tmp/${path.basename(file)}`]);
  }

  const psql = async (args) => run(containerRuntime, ["exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", ...args]);

  const invalidOrder = await run(containerRuntime, [
    "exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres",
    "-f", `/tmp/${path.basename(activePaths[1])}`,
  ], { allowFailure: true });
  assert(invalidOrder.code !== 0, "Reaction-count repair unexpectedly applied before the public-schema baseline.");
  assert(
    /commune_posts|commune_comments|commune_content_reactions|commune_content_reaction_totals/i.test(`${invalidOrder.stderr}\n${invalidOrder.stdout}`),
    "Invalid-order failure did not identify the missing Commune reaction prerequisite.",
  );

  const invalidRepositoryOrder = await run(containerRuntime, [
    "exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres",
    "-f", `/tmp/${path.basename(activePaths[2])}`,
  ], { allowFailure: true });
  assert(invalidRepositoryOrder.code !== 0, "Repository repair unexpectedly applied before the public-schema baseline.");
  assert(
    /commune_repository_showcases/i.test(`${invalidRepositoryOrder.stderr}\n${invalidRepositoryOrder.stdout}`),
    "Invalid-order failure did not identify the missing Repository Showcase prerequisite.",
  );

  await psql(["-f", `/tmp/${path.basename(activePaths[0])}`]);

  // The currently cached Supabase Postgres image has an older auth.users test
  // fixture. Production was verified read-only to have these exact columns.
  await psql(["-c", "alter table auth.users add column if not exists banned_until timestamptz, add column if not exists deleted_at timestamptz, add column if not exists is_anonymous boolean not null default false, add column if not exists email_confirmed_at timestamptz;"]);

  await psql(["-c", `
    alter table public.commune_repository_showcases add column sandbox_review_status text;
    insert into auth.users(id, email, created_at, updated_at)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'drift-probe@example.invalid', now(), now());
    insert into public.commune_posts(id, user_id, post_type, title, body, status, visibility)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'repository_showcase', 'Drift probe', 'Synthetic disposable row.', 'draft', 'private_draft');
    insert into public.commune_repository_showcases(id, user_id, post_id, repository_url, status, sandbox_review_status)
      values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://example.invalid/drift-probe', 'pending_review', 'unexpected_drift_value');
  `]);
  const incompatibleDrift = await run(containerRuntime, [
    "exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres",
    "-f", `/tmp/${path.basename(activePaths[2])}`,
  ], { allowFailure: true });
  assert(incompatibleDrift.code !== 0, "Repository repair accepted an incompatible pre-existing sandbox_review_status value.");
  assert(
    /commune_repository_showcases_sandbox_review_status_check/i.test(`${incompatibleDrift.stderr}\n${incompatibleDrift.stdout}`),
    "Repository drift failure did not identify the sandbox review status constraint.",
  );
  const transactionRollback = await psql(["-tAc", `
    select not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'commune_repository_showcases'
        and column_name = 'provider'
    );
  `]);
  assert(transactionRollback.stdout.trim() === "t", "Repository repair did not roll back atomically after constraint validation failed.");
  await psql(["-c", `
    delete from public.commune_repository_showcases where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    delete from public.commune_posts where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    alter table public.commune_repository_showcases drop column sandbox_review_status;
  `]);

  await psql(["-f", `/tmp/${path.basename(activePaths[1])}`]);
  await psql(["-f", `/tmp/${path.basename(activePaths[2])}`]);
  await psql(["-f", `/tmp/${path.basename(activePaths[3])}`]);
  const behavior = await psql(["-f", "/tmp/sandboxDatabaseBehavior.sql"]);
  assert(behavior.stdout.includes("sandbox_database_behavior_ok"), "Disposable database behavior marker missing.");
  const proposalBehavior = await psql(["-f", "/tmp/codeRevisionProposalBehavior.sql"]);
  assert(proposalBehavior.stdout.includes("code_revision_proposal_behavior_ok"), "Disposable Coding Workbench proposal lifecycle behavior marker missing.");
  for (const file of economicPaths) {
    await psql(["-f", `/tmp/${path.basename(file)}`]);
  }
  const economicBehavior = await psql(["-f", "/tmp/economicDatabaseBehavior.sql"]);
  assert(economicBehavior.stdout.includes("Economic database behavior checks ok."), "Economic database behavior marker missing.");
  // The database-only image does not install the Storage API catalog. Create
  // the narrow catalog shape used by migrations; hosted Supabase supplies the
  // same relations before application migrations run.
  await psql(["-c", `
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null unique,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner_id uuid,
      created_at timestamptz not null default now(),
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as \$\$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    \$\$;
  `]);
  for (const file of artisanPaths) {
    await psql(["-f", `/tmp/${path.basename(file)}`]);
  }
  for (const file of onlineCompatibilityPaths) {
    await psql(["-f", `/tmp/${path.basename(file)}`]);
  }
  for (const file of accountLifecyclePaths) {
    await psql(["-f", `/tmp/${path.basename(file)}`]);
  }
  for (const file of accountCommunicationPaths) {
    await psql(["-f", `/tmp/${path.basename(file)}`]);
  }
  const artisanBehavior = await psql(["-f", "/tmp/artisanDatabaseBehavior.sql"]);
  assert(artisanBehavior.stdout.includes("Artisan database behavior checks ok."), "Artisan database behavior marker missing.");
  const onlineProfileBehavior = await psql(["-f", "/tmp/onlinePublicProfileBehavior.sql"]);
  assert(
    onlineProfileBehavior.stdout.includes("Online public profile compatibility behavior checks ok."),
    "Online public profile compatibility behavior marker missing."
  );
  const communeAttributionBehavior = await psql(["-f", "/tmp/communeCanonicalAttributionBehavior.sql"]);
  assert(
    communeAttributionBehavior.stdout.includes("Canonical Commune attribution behavior checks ok."),
    "Canonical Commune attribution behavior marker missing."
  );
  const accountAuthDeletionLifecycleBehavior = await psql([
    "-f",
    "/tmp/accountAuthDeletionLifecycleBehavior.sql",
  ]);
  assert(
    accountAuthDeletionLifecycleBehavior.stdout.includes("Account Auth deletion lifecycle behavior checks ok."),
    "Account Auth deletion lifecycle behavior marker missing."
  );
  const codeProposalIntegrityBehavior = await psql([
    "-f",
    "/tmp/codeProposalIntegrityBehavior.sql",
  ]);
  assert(
    codeProposalIntegrityBehavior.stdout.includes("code_proposal_integrity_behavior_ok"),
    "Code proposal integrity behavior marker missing."
  );
  const accountEventFoundationBehavior = await psql([
    "-f",
    "/tmp/accountEventFoundationBehavior.sql",
  ]);
  assert(
    accountEventFoundationBehavior.stdout.includes("account_event_foundation_behavior_ok"),
    "Account event foundation behavior marker missing."
  );
  const accountRequestsReviewsBehavior = await psql([
    "-f",
    "/tmp/accountRequestsReviewsBehavior.sql",
  ]);
  assert(
    accountRequestsReviewsBehavior.stdout.includes("account_requests_reviews_behavior_ok"),
    "Account Requests & Reviews behavior marker missing."
  );
  // Hosted Supabase owns this ledger. The database-only image omits it, so
  // provide the catalog shape required by the read-only inventory rehearsal.
  await psql(["-c", `
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `]);
  const readOnlyInventory = await psql(["-f", "/tmp/supabase_read_only_inventory.sql"]);
  const parsedReadOnlyInventory = JSON.parse(readOnlyInventory.stdout.trim());
  assert(
    Array.isArray(parsedReadOnlyInventory.auth_user_foreign_keys)
      && parsedReadOnlyInventory.auth_user_foreign_keys.length >= 299,
    "Read-only inventory omitted direct auth.users dependencies."
  );
  assert(
    parsedReadOnlyInventory.auth_user_foreign_keys.some((constraint) =>
      constraint.constraint_name === "account_participation_user_id_fkey"
      && constraint.on_delete === "CASCADE"
      && constraint.validated === true
    ),
    "Read-only inventory did not confirm the account_participation Auth lifecycle constraint."
  );
  assert(
    parsedReadOnlyInventory.auth_user_foreign_keys.some((constraint) =>
      constraint.constraint_name === "community_notification_preferences_user_id_fkey"
      && constraint.on_delete === "CASCADE"
      && constraint.validated === true
    ),
    "Read-only inventory did not confirm the notification-preferences Auth lifecycle constraint."
  );
  assert(
    parsedReadOnlyInventory.auth_user_triggers.some((trigger) =>
      trigger.trigger_name === "bootstrap_community_account_state"
      && /AFTER INSERT ON users/i.test(trigger.definition)
      && !/\bDELETE\b/i.test(trigger.definition)
    ),
    "Read-only inventory did not prove the Auth bootstrap trigger remains INSERT-only."
  );
  assert(
    parsedReadOnlyInventory.storage_object_ownership_columns.some((column) =>
      column.column_name === "owner_id"
    ),
    "Read-only inventory omitted Storage object ownership."
  );

  const catalogIntegrity = await psql(["-tAc", `
    select
      (select count(*) from pg_catalog.pg_index index_state
       join pg_catalog.pg_class indexed_relation on indexed_relation.oid = index_state.indexrelid
       join pg_catalog.pg_namespace indexed_namespace on indexed_namespace.oid = indexed_relation.relnamespace
       where indexed_namespace.nspname in ('public', 'private')
         and (not index_state.indisvalid or not index_state.indisready))
      || '|' ||
      (select count(*) from pg_catalog.pg_constraint constraint_state
       join pg_catalog.pg_namespace constraint_namespace on constraint_namespace.oid = constraint_state.connamespace
       where constraint_namespace.nspname in ('public', 'private')
         and not constraint_state.convalidated);
  `]);
  assert(catalogIntegrity.stdout.trim() === "0|0", `Invalid indexes or unvalidated constraints remain: ${catalogIntegrity.stdout.trim()}.`);

  const plpgsqlCheckAvailable = await psql(["-tAc", "select exists (select 1 from pg_catalog.pg_available_extensions where name = 'plpgsql_check');"]);
  if (plpgsqlCheckAvailable.stdout.trim() === "t") {
    await psql(["-c", "create extension if not exists plpgsql_check;"]);
    const governedPlpgsqlFunctions = [...new Set([
      ...economicPlpgsqlFunctions,
      ...artisanPlpgsqlFunctions,
      ...onlineCompatibilityPlpgsqlFunctions,
      ...accountCommunicationPlpgsqlFunctions,
    ])];
    const lintTargets = governedPlpgsqlFunctions.map((name) => `'${name}'`).join(", ");
    const lintErrors = await psql(["-tAc", `
      select count(*)
      from pg_catalog.pg_proc checked_function
      join pg_catalog.pg_namespace checked_namespace on checked_namespace.oid = checked_function.pronamespace
      join pg_catalog.pg_language checked_language on checked_language.oid = checked_function.prolang
      cross join lateral public.plpgsql_check_function_tb(checked_function.oid, fatal_errors := false) lint
      where checked_namespace.nspname || '.' || checked_function.proname = any (array[${lintTargets}]::text[])
        and checked_language.lanname = 'plpgsql'
        and checked_function.prokind = 'f'
        and checked_function.prorettype <> 'pg_catalog.trigger'::pg_catalog.regtype
        and pg_catalog.lower(coalesce(lint.level, '')) in ('error', 'fatal');
    `]);
    if (lintErrors.stdout.trim() !== "0") {
      const lintDetails = await psql(["-AtF", " | ", "-c", `
        select checked_function.oid::pg_catalog.regprocedure, lint.level, lint.sqlstate, lint.message, lint.lineno, lint.statement
        from pg_catalog.pg_proc checked_function
        join pg_catalog.pg_namespace checked_namespace on checked_namespace.oid = checked_function.pronamespace
        join pg_catalog.pg_language checked_language on checked_language.oid = checked_function.prolang
        cross join lateral public.plpgsql_check_function_tb(checked_function.oid, fatal_errors := false) lint
        where checked_namespace.nspname || '.' || checked_function.proname = any (array[${lintTargets}]::text[])
          and checked_language.lanname = 'plpgsql'
          and checked_function.prokind = 'f'
          and checked_function.prorettype <> 'pg_catalog.trigger'::pg_catalog.regtype
          and pg_catalog.lower(coalesce(lint.level, '')) in ('error', 'fatal')
        order by checked_function.oid::pg_catalog.regprocedure::text, lint.lineno;
      `]);
      assert(false, `plpgsql_check found ${lintErrors.stdout.trim()} error-level findings in economic functions:\n${lintDetails.stdout.trim()}`);
    }
    console.log(`plpgsql_check found no error-level findings across ${governedPlpgsqlFunctions.length} economic and Artisan function names.`);
  } else {
    console.log("plpgsql_check is not available in the disposable Supabase Postgres image; catalog integrity checks still passed.");
  }
  console.log("Sandbox, economic, Artisan, and Online profile database disposable migration and behavior checks ok.");
} finally {
  if (started) await run(containerRuntime, ["rm", "-f", container], { allowFailure: true });
}

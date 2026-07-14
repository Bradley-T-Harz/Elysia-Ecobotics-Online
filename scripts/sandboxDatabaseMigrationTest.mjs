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

const activePaths = [
  "supabase/migrations/20260714010000_remote_public_schema_baseline.sql",
  "supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql",
  "supabase/migrations/20260714020000_repository_showcase_structured_metadata_repair.sql",
  "supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql",
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
assert(activeNames.length === 4, `Expected exactly four active migrations, found ${activeNames.length}.`);
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

for (const snapshot of [schemaSnapshot, policySnapshot]) {
  assert(snapshot.includes("-- Active migration repair snapshot (2026-07-14)."), "Snapshot repair marker missing.");
  assert(snapshot.includes(reactionMigration.trim()), "Snapshot is not synchronized with the reaction-count repair.");
  assert(snapshot.includes(repositoryMigration.trim()), "Snapshot is not synchronized with the Repository repair.");
  assert(snapshot.endsWith(`${sandboxMigration.trim()}\n`), "Snapshot is not synchronized with the sandbox repair.");
}

console.log("Sandbox database migration static checks ok.");

if (process.env.ELYSIA_SANDBOX_DATABASE_INTEGRATION !== "1") {
  console.log("Disposable database execution skipped; set ELYSIA_SANDBOX_DATABASE_INTEGRATION=1 to enable it.");
  process.exit(0);
}

const image = process.env.ELYSIA_SUPABASE_POSTGRES_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.127";
const container = `elysia-sandbox-migration-test-${process.pid}`;
let started = false;
try {
  await run("docker", ["version", "--format", "{{.Server.Version}}"]);
  await run("docker", [
    "run", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=elysia_disposable_only",
    "-d", image,
  ]);
  started = true;

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const state = await run("docker", ["inspect", container, "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"], { allowFailure: true });
    if (state.code === 0 && state.stdout.trim() === "healthy") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const health = await run("docker", ["inspect", container, "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"]).then((result) => result.stdout.trim());
  assert(health === "healthy", `Disposable database did not become healthy: ${health}.`);

  for (const file of [...activePaths, "scripts/fixtures/sandboxDatabaseBehavior.sql"]) {
    await run("docker", ["cp", file, `${container}:/tmp/${path.basename(file)}`]);
  }

  const psql = async (args) => run("docker", ["exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", ...args]);

  const invalidOrder = await run("docker", [
    "exec", container, "psql", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres",
    "-f", `/tmp/${path.basename(activePaths[1])}`,
  ], { allowFailure: true });
  assert(invalidOrder.code !== 0, "Reaction-count repair unexpectedly applied before the public-schema baseline.");
  assert(
    /commune_posts|commune_comments|commune_content_reactions|commune_content_reaction_totals/i.test(`${invalidOrder.stderr}\n${invalidOrder.stdout}`),
    "Invalid-order failure did not identify the missing Commune reaction prerequisite.",
  );

  const invalidRepositoryOrder = await run("docker", [
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
  await psql(["-c", "alter table auth.users add column if not exists banned_until timestamptz, add column if not exists deleted_at timestamptz, add column if not exists is_anonymous boolean not null default false;"]);

  await psql(["-c", `
    alter table public.commune_repository_showcases add column sandbox_review_status text;
    insert into auth.users(id, email, created_at, updated_at)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'drift-probe@example.invalid', now(), now());
    insert into public.commune_posts(id, user_id, post_type, title, body, status, visibility)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'repository_showcase', 'Drift probe', 'Synthetic disposable row.', 'draft', 'private_draft');
    insert into public.commune_repository_showcases(id, user_id, post_id, repository_url, status, sandbox_review_status)
      values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://example.invalid/drift-probe', 'pending_review', 'unexpected_drift_value');
  `]);
  const incompatibleDrift = await run("docker", [
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
  console.log("Sandbox database disposable migration and behavior checks ok.");
} finally {
  if (started) await run("docker", ["rm", "-f", container], { allowFailure: true });
}

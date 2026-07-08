import fs from "node:fs/promises";
import path from "node:path";

const roots = ["src", "supabase", "public", "docs", "packages", "scripts", "services"];
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".md", ".json", ".txt"]);

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const checks = [
  { name: "service role key strings", pattern: /SERVICE_ROLE|SUPABASE_SERVICE|SUPABASE_SERVICE_ROLE|service_role/ },
  { name: "private key material", pattern: /BEGIN [A-Z ]*PRIVATE KEY/ },
  { name: "obvious OpenAI key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
  { name: "runtime eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /new Function\s*\(/ },
  { name: "Node child process", pattern: /\bchild_process\b/ },
  { name: "process exec", pattern: /\bexec\s*\(/ },
  { name: "process spawn", pattern: /\bspawn\s*\(/ },
  { name: "package hook execution", pattern: /\b(postinstall|preinstall)\b/ }
];

function allowHit(file, line, checkName) {
  const normalized = file.replaceAll(path.sep, "/");
  if (normalized.endsWith("scripts/securitySmokeTest.mjs")) return true;
  if ((normalized.endsWith("scripts/communeSmokeTest.mjs") || normalized.endsWith("scripts/siteContentSmokeTest.mjs")) && /scanner|fixture|assert|secret|SUPABASE_SERVICE_ROLE|service_role|BEGIN \[A-Z \]\*PRIVATE KEY|AWS_ACCESS_KEY_ID/i.test(line)) return true;
  if (normalized.endsWith("scripts/addonSdkSmokeTest.mjs") && /scanner|fixture|assert|inspect|archive|service-role|private key|package install hook|postinstall|preinstall|SUPABASE_SERVICE_ROLE|BEGIN PRIVATE KEY/i.test(line)) return true;
  if (normalized.endsWith("scripts/sandboxRunnerSmokeTest.mjs") && /child_process|spawnSync|assert|help|missing file|does not execute|never runs code/i.test(line)) return true;
  if (normalized.endsWith("packages/addon-sdk/core.mjs") && /pattern|scanner|scan|blocked|inspect|archive|does not execute|will not execute|SUPABASE_SERVICE_ROLE|service_role|postinstall|preinstall|child_process|exec|spawn|eval|new\s\+Function/i.test(line)) return true;
  if (normalized.includes("services/sandbox-runner/") && /pattern|scanner|blocked|validate|local-only|Docker|Podman|controlled argument|shell: false|child_process|spawn|exec|postinstall|preinstall|SUPABASE_SERVICE_ROLE|service_role|does not execute|will not execute|never runs code/i.test(line)) return true;
  if (normalized.endsWith("src/pages/The-Elysia-Commune/communeSafety.ts") && /pattern|blocked|scanner|scan|blocks/i.test(line)) return true;
  if (normalized.endsWith("src/pages/The-Elysia-Commune/communeCodeReviewApi.ts") && /pattern|secret|scanner|scan|block|SUPABASE_SERVICE_ROLE|service_role/i.test(line)) return true;
  if (normalized.endsWith("src/pages/The-Elysia-Commune/communeRealtimeApi.ts") && /pattern|secret|scanner|scan|block|SUPABASE_SERVICE_ROLE|service_role/i.test(line)) return true;
  if (normalized.endsWith("src/shared/sandbox/sandboxRequestValidator.ts") && /pattern|secret|scanner|scan|block|dangerous|SUPABASE_SERVICE_ROLE|service_role|postinstall|preinstall|child_process|exec|spawn|eval|new\s\+Function/i.test(line)) return true;
  if (normalized.endsWith("src/shared/sandbox/sandboxHandoffBuilder.ts") && /does not execute|website_executed_code|private_reviewer_notes_included/i.test(line)) return true;
  if (normalized.endsWith("src/shared/addons/browserArchiveInspector.ts") && /pattern|scanner|scan|blocked|inspect|archive|does not execute|will not execute|SUPABASE_SERVICE_ROLE|service_role|postinstall|preinstall|child_process|exec|spawn|eval|new\s\+Function/i.test(line)) return true;
  if (normalized.endsWith("src/pages/The-Developer-Forge/developerForgeValidator.ts") && /pattern|blocked|scanner|scan|Static scan|secret-looking|dangerousShellPattern|forbiddenManifestFields/i.test(line)) return true;
  if (normalized.includes("docs/") && /flag|scanner|warning|policy|`|does not execute|never executes|never installs|archive inspection|service-role|SUPABASE_SERVICE_ROLE|postinstall|preinstall/i.test(line)) return true;
  if (checkName === "package hook execution" && /blocked|scan|scanner|policy|documentation|does not execute|will not execute/i.test(line)) return true;
  if (["runtime eval", "Function constructor", "process exec", "process spawn", "Node child process"].includes(checkName) && /pattern|grep|scan|scanner|does not execute|will not execute/i.test(line)) return true;
  if (normalized.includes("Legal/legalPolicyPages.ts") && /policy|prohibited|do not|vulnerability|security/i.test(line)) return true;
  return false;
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (includeExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const failures = [];
for (const root of roots) {
  try {
    for (const file of await listFiles(root)) {
      const text = await fs.readFile(file, "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        for (const check of checks) {
          if (check.pattern.test(line) && !allowHit(file, line, check.name)) failures.push(`${file}:${index + 1}: ${check.name}: ${line.trim()}`);
        }
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (failures.length) {
  console.error(`Security smoke test failed:\n${failures.join("\n")}`);
  process.exit(1);
}

const communityVoteMigration = await fs.readFile("supabase/migrations/2026_07_05_02_commune_community_voting_room.sql", "utf8");
const softDeleteCleanupMigration = await fs.readFile("supabase/migrations/2026_07_07_commune_soft_delete_cleanup.sql", "utf8");
const communityVoteDeleteFilterMigration = await fs.readFile("supabase/migrations/2026_07_08_commune_vote_delete_parent_filter.sql", "utf8");
const commonsCircleApi = await fs.readFile("src/pages/The-Commons-Circle/commonsCircleApi.ts", "utf8");
const communeAccountApi = await fs.readFile("src/pages/The-Elysia-Commune/communeAccountApi.ts", "utf8");
const communePage = await fs.readFile("src/pages/The-Elysia-Commune/index.tsx", "utf8");
const communeSafety = await fs.readFile("src/pages/The-Elysia-Commune/communeSafety.ts", "utf8");
const secretSafetyWarningFixture = "Do not upload .env files, API keys, tokens, credentials, private logs, or vault data.";
assert(secretSafetyWarningFixture.includes(".env") && secretSafetyWarningFixture.includes("API keys") && secretSafetyWarningFixture.includes("credentials"), "Security fixture should cover .env warning language without secret assignments.");
const realSecretAssignmentFixtures = [
  "fixture SUPABASE_SERVICE_ROLE_KEY=...",
  "fixture OPENAI_API_KEY=...",
  "fixture CLOUDFLARE_API_TOKEN=...",
  "fixture password=...",
  "fixture SECRET_KEY=...",
  "fixture -----BEGIN PRIVATE KEY-----"
];
for (const realSecretFixture of realSecretAssignmentFixtures) {
  assert(/=|BEGIN/.test(realSecretFixture), `Real secret fixture should remain hard-blockable: ${realSecretFixture}`);
}
assert(communeSafety.includes("hardSecretPatterns") && communeSafety.includes("hardSecretHit") && communeSafety.includes("blocked: hardSecretHit"), "Commune secret scanner should hard-block actual secret material.");
assert(communeSafety.includes("secretReferencePatterns") && communeSafety.includes("warningOnlyHit") && communeSafety.includes("containsSecretSafetyInstruction"), "Commune secret scanner should differentiate warning-only/prohibitive references from secret material.");
assert(communeSafety.includes(".env file reference") && communeSafety.includes("sensitive key/value assignment") && communeSafety.includes("service-role secret assignment"), "Commune scanner should mention both .env warning references and real assignment blocks.");
assert(!communeSafety.includes("isAdmin") && !communeSafety.includes("adminDirectPublish"), "Commune secret scanner must not contain a blanket admin bypass.");
assert(communeAccountApi.includes("if (scan.blocked) return { ok: false, message: \"Official Update blocked") && communeAccountApi.includes("if (!account.userId || !account.isAdmin) return"), "Official Update should remain admin-only while still hard-blocking scanner failures.");
assert(communePage.includes("Code snippets in Media Garden are visual/read-only material. They are not executed by the website and are not a trust signal."), "Media Garden code snippet copy should say read-only, not executed, and not a trust signal.");
assert(communePage.includes("This Media Garden preview is read-only visual material. No run button, sandbox diagnostics, execution status, proposal flow, or trust label is enabled."), "Media Garden preview should explicitly exclude execution controls.");
assert(communePage.includes("showSandboxCapableCodeFields && <label") && communePage.includes("sandboxCapable && <CodingSandboxRunPanel"), "Media Garden must not expose sandbox request or run controls outside sandbox-capable code contexts.");
assert(communePage.includes("isSandboxCapableCodePost(postType)") && communePage.includes('postType === "media_garden"'), "Media Garden code snippets should be separated from sandbox-capable code post types.");
assert(!/media[-_]garden\/sandbox/i.test(communePage) && !/media[-_]garden[\s\S]{0,240}(\/api\/sandbox|VITE_CODING_SANDBOX_ENDPOINT|requestSandboxRun|CodingSandboxRunPanel)/i.test(communePage), "Media Garden must not call sandbox routes, sandbox endpoint config, sandbox client runs, or SandboxRunPanel.");
const communityVoteSecurity = [
  ["RLS enabled on vote posts", /alter table public\.commune_vote_posts enable row level security/i],
  ["RLS enabled on vote options", /alter table public\.commune_vote_options enable row level security/i],
  ["RLS enabled on vote ballots", /alter table public\.commune_vote_ballots enable row level security/i],
  ["RLS enabled on vote events", /alter table public\.commune_vote_events enable row level security/i],
  ["anon cannot insert ballots", /grant select, insert, update on table public\.commune_vote_ballots to authenticated/i],
  ["own-ballot insert policy", /users insert own open vote ballots/i],
  ["own-ballot update policy", /users update own open vote ballots/i],
  ["open vote status restriction", /v\.vote_status = 'open'/i],
  ["open window starts restriction", /v\.opens_at is null or now\(\) >= v\.opens_at/i],
  ["open window closes restriction", /v\.closes_at is null or now\(\) <= v\.closes_at/i],
  ["unique ballot per voter", /unique \(vote_post_id, voter_user_id\)/i],
  ["option belongs to same vote", /foreign key \(option_id, vote_post_id\)[\s\S]*references public\.commune_vote_options\(id, vote_post_id\)/i],
  ["admin manage metadata policy", /admins manage vote metadata/i],
  ["admin manage options policy", /admins manage vote options/i],
  ["admin manage events policy", /admins create vote events/i],
  ["aggregate result function", /commune_vote_result_summary/i],
  ["aggregate result omits voter ids", /returns table \([\s\S]*vote_post_id uuid[\s\S]*option_id uuid[\s\S]*ballot_count bigint[\s\S]*total_ballots bigint[\s\S]*percentage numeric[\s\S]*\)/i],
  ["staff/public event visibility", /event_visibility = 'public'/i]
];
const communityVoteFailures = communityVoteSecurity
  .filter(([, pattern]) => !pattern.test(communityVoteMigration))
  .map(([name]) => name);
if (communityVoteFailures.length) {
  console.error(`Community Voting Room security checks failed:\n${communityVoteFailures.join("\n")}`);
  process.exit(1);
}

const softDeleteCleanupSecurity = [
  ["cleanup RPC exists", /create or replace function public\.soft_delete_commune_post/i],
  ["cleanup RPC is security definer", /security definer/i],
  ["cleanup RPC has safe search path", /set search_path = public, auth/i],
  ["cleanup RPC requires Commune reviewer", /current_user_can_review_domain\('commune'::public\.review_domain\)/i],
  ["cleanup removes saved shelf rows", /delete from public\.user_saved_commune_posts/i],
  ["cleanup removes legacy saved rows", /delete from public\.commune_saved_posts/i],
  ["cleanup removes notifications", /delete from public\.user_notifications/i],
  ["cleanup removes followed threads", /delete from public\.user_followed_commune_threads/i],
  ["cleanup removes reactions", /delete from public\.commune_content_reactions/i],
  ["cleanup hides code proposals", /commune_code_revision_proposals[\s\S]*hidden_by_moderation/i],
  ["cleanup archives Community Voting Room sidecar", /commune_vote_posts[\s\S]*vote_status = 'archived'/i],
  ["cleanup preserves audit history", /audit_preserved[\s\S]*commune_reports[\s\S]*commune_moderation_events[\s\S]*review_items[\s\S]*review_events[\s\S]*commune_vote_ballots[\s\S]*commune_vote_events/i],
  ["Community Vote parent filter migration exists", /Community Voting Room moderation-delete visibility hardening/i],
  ["Community Vote metadata parent-filtered", /public reads published public vote metadata[\s\S]*p\.post_type = 'community_vote'[\s\S]*p\.removed_at is null[\s\S]*p\.archived_at is null/i],
  ["Community Vote ballot reads are active-parent or audit-only", /users read own vote ballots[\s\S]*voter_user_id = auth\.uid\(\)[\s\S]*p\.removed_at is null[\s\S]*public\.current_user_can_review_domain\('commune'::public\.review_domain\)/i],
  ["Community Vote public events parent-filtered", /public reads public vote events[\s\S]*event_visibility = 'public'[\s\S]*p\.removed_at is null/i],
  ["Community Vote aggregate results parent-filtered", /commune_vote_result_summary[\s\S]*p\.post_type = 'community_vote'[\s\S]*p\.removed_at is null[\s\S]*p\.archived_at is null/i],
  ["cleanup grants execute only to authenticated", /revoke all on function public\.soft_delete_commune_post\(uuid, text\) from public;[\s\S]*grant execute on function public\.soft_delete_commune_post\(uuid, text\) to authenticated/i],
  ["saved rows require active parent on select", /users select own active saved commune posts[\s\S]*post\.status = 'published'[\s\S]*post\.visibility = 'public'[\s\S]*post\.removed_at is null/i],
  ["delete helper calls cleanup RPC", /rpc\("soft_delete_commune_post"/i],
  ["missing RPC has migration drift error", /Commune soft-delete cleanup is not available yet\. Apply the latest Commune cleanup migration before deleting posts\./i],
  ["delete helper tolerates RPC signature drift only", /isSoftDeleteRpcSignatureError[\s\S]*PGRST202[\s\S]*p_target_post_id[\s\S]*callSoftDeleteCommunePostRpc/i],
  ["delete helper surfaces backend details", /softDeleteRpcErrorMessage[\s\S]*Backend detail/i],
  ["Commune loader filters active public parents", /isActivePublicCommunePost[\s\S]*activePosts[\s\S]*loadVotePostsForPosts\(postIds, account\)/i],
  ["Vote sidecar loader only uses loaded parent ids", /activeParentPostIds[\s\S]*activeParentPostIds\.has\(row\.post_id\)/i],
  ["Detail page locally suppresses deleted parent", /locallyDeletedPostId === postId \? null : state\.posts\[0\][\s\S]*onDeleted=\{setLocallyDeletedPostId\}/i],
  ["Commons loaders have active parent filter", /isActivePublicCommunePost[\s\S]*loadActivePublicCommunePostMap[\s\S]*filterNotificationsByActiveCommunePost/i],
  ["Signal Console sidecars use visible filtered rows", /visibleMyCommunityVoteRows[\s\S]*visibleReviewCommunityVoteRows[\s\S]*officialPostById/i],
  ["Public profile comments filtered by parent", /visiblePublicComments[\s\S]*activeCommentPostById/i]
];
const softDeleteFailures = softDeleteCleanupSecurity
  .filter(([, pattern]) => !pattern.test(softDeleteCleanupMigration + "\n" + communityVoteDeleteFilterMigration + "\n" + communeAccountApi + "\n" + communePage + "\n" + commonsCircleApi))
  .map(([name]) => name);
if (softDeleteFailures.length) {
  console.error(`Commune soft-delete cleanup security checks failed:\n${softDeleteFailures.join("\n")}`);
  process.exit(1);
}

console.log("Security smoke test ok.");

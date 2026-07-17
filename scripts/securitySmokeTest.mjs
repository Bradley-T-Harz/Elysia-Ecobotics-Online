import fs from "node:fs/promises";
import path from "node:path";

const roots = ["src", "functions", "supabase", "public", "docs", "packages", "scripts", "services"];
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".md", ".json", ".txt"]);

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const documentShell = await fs.readFile("index.html", "utf8");
assert(
  /<meta\s+name="referrer"\s+content="no-referrer"\s*\/?>/.test(documentShell),
  "The document shell must not leak guest order references or recovery URLs through browser referrers."
);

const checks = [
  { name: "service role key strings", pattern: /SERVICE_ROLE|SUPABASE_SERVICE|SUPABASE_SERVICE_ROLE|service_role/ },
  { name: "private key material", pattern: /BEGIN [A-Z ]*PRIVATE KEY/ },
  { name: "obvious OpenAI key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Stripe secret material", pattern: /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/ },
  { name: "Stripe webhook secret material", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { name: "Supabase secret material", pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}\b/ },
  { name: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
  { name: "runtime eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /new Function\s*\(/ },
  { name: "Node child process", pattern: /\bchild_process\b/ },
  { name: "process exec", pattern: /(?<!\.)\bexec(?:File)?(?:Sync)?\s*\(/ },
  { name: "process spawn", pattern: /\bspawn\s*\(/ },
  { name: "package hook execution", pattern: /\b(postinstall|preinstall)\b/ }
];

const readOnlyInventorySource = await fs.readFile("scripts/supabaseReadOnlyInventory.mjs", "utf8");
const readOnlyInventoryUsesControlledPsqlSpawn = /spawn\(\s*"psql"\s*,\s*\[\s*"--no-psqlrc"\s*,\s*"--quiet"\s*,\s*"--set"\s*,\s*"ON_ERROR_STOP=1"\s*,\s*"--file"\s*,\s*sqlPath\s*\]\s*,\s*\{[\s\S]{0,240}\bshell:\s*false\b/.test(readOnlyInventorySource);
assert(readOnlyInventoryUsesControlledPsqlSpawn, "Read-only Supabase inventory must spawn only fixed-argument psql with shell:false.");

const reviewedBillingServerBindingFiles = new Set([
  "functions/api/billing/_shared/auth.ts",
  "functions/api/billing/_shared/config.ts",
  "functions/api/billing/_shared/types.ts"
]);
const reviewedEconomicServiceCredentialScripts = new Set([
  "scripts/billingStripeTestCatalog.mjs",
  "scripts/billingStripeFixedPriceTestCatalog.mjs",
  "scripts/billingSandboxRecurringTestProgram.mjs"
]);
const reviewed20260716ServiceRoleMigrations = new Set([
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
  "supabase/migrations/20260716071000_economic_route_kill_switch_boundaries.sql"
]);

function allowHit(file, line, checkName) {
  const normalized = file.replaceAll(path.sep, "/");
  const controlledSpawnScripts = new Set([
    "scripts/packageSandboxRelease.mjs",
    "scripts/sandboxDatabaseMigrationTest.mjs",
    "scripts/sandboxDeploymentSmokeTest.mjs",
    "scripts/sandboxIntegrationSmokeTest.mjs",
    "scripts/verifySandboxRelease.mjs"
  ]);
  if (
    controlledSpawnScripts.has(normalized)
    && ["Node child process", "process spawn"].includes(checkName)
    && (/node:child_process/.test(line) || /shell:\s*false/.test(line))
  ) return true;
  if (
    normalized === "scripts/supabaseReadOnlyInventory.mjs"
    && readOnlyInventoryUsesControlledPsqlSpawn
    && ["Node child process", "process spawn"].includes(checkName)
    && (/node:child_process/.test(line) || /spawn\("psql"/.test(line))
  ) return true;
  if (checkName === "service role key strings") {
    if (
      reviewedBillingServerBindingFiles.has(normalized)
      && /\bSUPABASE_SERVICE_ROLE_KEY\b|\bservice_role\b/.test(line)
    ) return true;
    if (
      reviewedEconomicServiceCredentialScripts.has(normalized)
      && /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(line)
    ) return true;
    if (
      normalized === "scripts/economicTestActivation.mjs"
      && /serviceRoleKey:\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\?\?\s*""/.test(line)
    ) return true;
    if (
      normalized === "scripts/billingProxySmokeTest.mjs"
      && (
        /SUPABASE_SERVICE_ROLE_KEY/.test(line)
        || /SUPABASE_PUBLISHABLE_KEY:\s*env\.SUPABASE_SERVICE_ROLE_KEY/.test(line)
        || /SUPABASE_PUBLISHABLE_KEY:\s*legacyKey\("service_role"\)/.test(line)
      )
    ) return true;
    if (
      reviewed20260716ServiceRoleMigrations.has(normalized)
      && /\bservice_role\b|economic_caller_is_service_role|economic_[a-z0-9_]*service_role_required/i.test(line)
      && !/SUPABASE_SERVICE_ROLE_KEY\s*=|SERVICE_ROLE_KEY\s*=/.test(line)
    ) return true;
    if (normalized === "supabase/migrations/20260714010000_remote_public_schema_baseline.sql" && /(?:GRANT|ALTER DEFAULT PRIVILEGES).*\bservice_role\b/i.test(line)) return true;
    if ([
      "supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql",
      "supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql",
      "supabase/schema.sql",
      "supabase/policies.sql",
    ].includes(normalized) && /\brevoke\b|from public, anon, authenticated, service_role/i.test(line)) return true;
    if (normalized === "scripts/fixtures/sandboxDatabaseBehavior.sql" && /has_(?:function|table)_privilege\('service_role'/i.test(line)) return true;
    if (
      normalized === "scripts/fixtures/economicDatabaseBehavior.sql"
      && (
        /set_config\('request\.jwt\.claim\.role', 'service_role', true\)/i.test(line)
        || /has_(?:function|table)_privilege\('service_role'/i.test(line)
        || /'service_role', 'private\.organization_sponsorship_settlement_hold(?:s|_events)'/i.test(line)
      )
    ) return true;
    if (normalized === "scripts/sandboxDatabaseMigrationTest.mjs" && /assert|marker|service_role/i.test(line)) return true;
  }
  if (normalized.endsWith("scripts/securitySmokeTest.mjs")) return true;
  if (
    normalized.endsWith("scripts/billingWorkerIsolationSmokeTest.mjs")
    && checkName === "service role key strings"
    && /assert|scan|binding|credential|service-role/i.test(line)
  ) return true;
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

const browserSource = (await Promise.all((await listFiles("src")).map((file) => fs.readFile(file, "utf8")))).join("\n");
for (const forbiddenBrowserBinding of ["VITE_CODING_SANDBOX_ENDPOINT", "VITE_SANDBOX_SERVICE_TOKEN", "VITE_SUPABASE_SERVICE_ROLE_KEY"]) {
  assert(!browserSource.includes(forbiddenBrowserBinding), `${forbiddenBrowserBinding} must not exist in browser source.`);
}

const directImportMetaEnvBindings = [...browserSource.matchAll(/import\.meta\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([^"']+)["']\s*\])/g)]
  .map((match) => match[1] ?? match[2]);
const forbiddenDirectServerBindingPatterns = [
  /^(?:VITE_)?STRIPE_(?:SECRET_KEY(?:_TEST)?|WEBHOOK_SECRET(?:_TEST)?)$/,
  /^(?:VITE_)?SUPABASE_SERVICE_ROLE(?:_KEY)?$/,
  /^(?:VITE_)?BILLING_[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE_KEY|SERVICE_ROLE)[A-Z0-9_]*$/,
  /^(?:VITE_)?(?:BILLING_)?WEBHOOK_SECRET(?:_TEST)?$/,
  /^(?:VITE_)?SANDBOX_(?:RUNNER_TOKEN|SERVICE_TOKEN|DB_FINALIZER_TOKEN)$/,
  /^(?:VITE_)?CLOUDFLARE_ACCESS_CLIENT_SECRET$/
];
for (const binding of directImportMetaEnvBindings) {
  assert(
    !forbiddenDirectServerBindingPatterns.some((pattern) => pattern.test(binding)),
    `${binding} is a server-only secret binding and must not be read through import.meta.env in browser source.`
  );
}

const forbiddenBrowserViteSecretPatterns = [
  /\bVITE_STRIPE_[A-Z0-9_]*(?:SECRET|WEBHOOK|TOKEN|PRIVATE_KEY)[A-Z0-9_]*\b/,
  /\bVITE_SUPABASE_SERVICE_ROLE(?:_KEY)?\b/,
  /\bVITE_BILLING_[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE_KEY|SERVICE_ROLE)[A-Z0-9_]*\b/,
  /\bVITE_(?:BILLING_)?WEBHOOK_SECRET(?:_TEST)?\b/,
  /\bVITE_SANDBOX_(?:RUNNER_TOKEN|SERVICE_TOKEN|DB_FINALIZER_TOKEN)\b/,
  /\bVITE_CLOUDFLARE_ACCESS_CLIENT_SECRET\b/
];
for (const pattern of forbiddenBrowserViteSecretPatterns) {
  assert(!pattern.test(browserSource), `Browser source contains a prohibited VITE server-secret binding matching ${pattern}.`);
}

const communityVoteMigration = await fs.readFile("supabase/legacy-migrations/2026_07_05_02_commune_community_voting_room.sql", "utf8");
const softDeleteCleanupMigration = await fs.readFile("supabase/legacy-migrations/2026_07_07_commune_soft_delete_cleanup.sql", "utf8");
const communityVoteDeleteFilterMigration = await fs.readFile("supabase/legacy-migrations/2026_07_08_commune_vote_delete_parent_filter.sql", "utf8");
const communityVoteSoftDeleteRepairMigration = await fs.readFile("supabase/legacy-migrations/2026_07_11_fix_commune_vote_soft_delete_rpc.sql", "utf8");
const supabaseSchema = await fs.readFile("supabase/schema.sql", "utf8");
const reactionMigration = await fs.readFile("supabase/legacy-migrations/2026_06_21_commune_content_reactions.sql", "utf8");
const codeProposalMigration = await fs.readFile("supabase/legacy-migrations/2026_06_25_coding_cornucopia_author_revision_proposals.sql", "utf8");
const troubleshootingMigration = await fs.readFile("supabase/legacy-migrations/2026_06_26_troubleshooting_grove_structured_workflow.sql", "utf8");
const researchMigration = await fs.readFile("supabase/legacy-migrations/2026_06_26_research_notes_structured_workflow.sql", "utf8");
const jobMigration = await fs.readFile("supabase/legacy-migrations/2026_06_26_job_post_structured_workflow.sql", "utf8");
const iterationMigration = await fs.readFile("supabase/legacy-migrations/2026_06_26_elysia_iteration_showcase_structured_metadata.sql", "utf8");
const officialUpdateMigration = await fs.readFile("supabase/legacy-migrations/2026_06_26_official_update_structured_workflow.sql", "utf8");
const badgeSecurityMigration = await fs.readFile("supabase/migrations/20260716010000_badge_security_and_semantics_hardening.sql", "utf8");
const commonsCircleApi = await fs.readFile("src/pages/The-Commons-Circle/commonsCircleApi.ts", "utf8");
const communeAccountApi = await fs.readFile("src/pages/The-Elysia-Commune/communeAccountApi.ts", "utf8");
const communePage = await fs.readFile("src/pages/The-Elysia-Commune/index.tsx", "utf8");
const communeSafety = await fs.readFile("src/pages/The-Elysia-Commune/communeSafety.ts", "utf8");
const badgeVisibilityUpdate = commonsCircleApi.match(/export async function updateBadgeVisibility[\s\S]*?\n}/)?.[0] ?? "";
assert(
  /revoke all privileges on table public\.user_badges[\s\S]*from public, anon, authenticated;[\s\S]*grant update \(visibility\) on public\.user_badges to authenticated;/i.test(badgeSecurityMigration)
    && !/grant update\s+on\s+public\.user_badges\s+to\s+authenticated/i.test(badgeSecurityMigration),
  "Authenticated badge owners must receive only the visibility column update privilege, never a table-wide user_badges update grant."
);
assert(
  /create or replace function public\.synchronize_user_badge_updated_at\(\)[\s\S]*returns trigger[\s\S]*new\.updated_at := pg_catalog\.now\(\);[\s\S]*revoke all privileges on function public\.synchronize_user_badge_updated_at\(\)[\s\S]*from public, anon, authenticated, service_role;[\s\S]*create trigger synchronize_user_badge_updated_at[\s\S]*before update on public\.user_badges[\s\S]*execute function public\.synchronize_user_badge_updated_at\(\);/i.test(badgeSecurityMigration),
  "user_badges.updated_at must remain trigger-owned, non-callable, and synchronized on every badge update."
);
assert(
  badgeVisibilityUpdate.includes('.from("user_badges").update({ visibility })')
    && badgeVisibilityUpdate.includes('.eq("user_id", auth.user.id)')
    && badgeVisibilityUpdate.includes('.eq("badge_key", badgeKey)')
    && badgeVisibilityUpdate.includes('.is("revoked_at", null)')
    && !badgeVisibilityUpdate.includes("updated_at"),
  "The ordinary Commons badge mutation must update only visibility on the signed-in owner\'s active award and leave updated_at to the database trigger."
);
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
assert(communeAccountApi.includes("publicRepositoryUrlOrNull") && communeAccountApi.includes("Repository Showcase posts must use a public HTTP(S) repository URL") && communeAccountApi.includes("Localhost/private repository URLs are not accepted"), "Repository Showcase normal-user flow must require public HTTP(S) URLs and reject localhost/private repository URLs.");
assert(communeAccountApi.includes("adminGuidancePost?: boolean") && communeAccountApi.includes("Repository Showcase guidance/template posts are admin-only") && communeAccountApi.includes("repository_sidecar_created: false"), "Repository Showcase guidance mode must be explicit, admin-only, and sidecar-free.");
assert(communeAccountApi.includes("Admin guidance posts cannot request selected-artifact sandbox review") && communePage.includes("Guidance posts cannot request selected-artifact sandbox review."), "Repository Showcase guidance posts must not introduce selected-artifact sandbox review behavior.");
assert(communePage.includes("Admin room guidance / template post") && communePage.includes("Publish as Repository Showcase guidance, not a repository listing"), "Repository Showcase guidance mode should be visible and deliberate in the admin UI.");
assert(communePage.includes("It is not a repository approval, compatibility review, Marketplace listing, install recommendation, or trust signal") && communePage.includes("signing/versioning decision") && communePage.includes("Developer Forge review"), "Repository Showcase guidance posts must not imply trust, approval, compatibility review, Marketplace eligibility, or Developer Forge authority.");
assert(communePage.includes("Metadata and presentation only, never execution") && communePage.includes("does not access private repositories or fetch, clone, install, build, run, execute, or validate repository code"), "Repository Showcase hub must not introduce private-repository access or repository execution claims.");
assert(communePage.includes("Selected-artifact sandbox review is a separate governed request") && communePage.includes("It does not approve, trust, or execute the whole repository"), "Repository Showcase hub must keep selected-artifact review bounded and separate from whole-repository trust.");
assert(communePage.includes('<CommunePostBody body={distinctContextDiscussion} />') && communePage.includes("renderCommuneInlineMarkdown") && communePage.includes("<strong key="), "Distinct Research Notes discussion should reuse safe Commune Markdown rendering for headings and bold labels.");
assert(!communePage.includes("dangerouslySetInnerHTML"), "Commune Markdown rendering must not enable raw HTML.");
assert(communePage.includes("Troubleshooting safety boundary") && communePage.includes("Official Update boundary") && communePage.includes("Repository trust boundary"), "Commune post detail layout must preserve room safety and trust-boundary callouts.");
assert(communePage.includes("function AdminContentControls") && communePage.includes("if (!isModerator) return null"), "Commune admin moderation controls should remain role-gated.");
assert(communePage.indexOf("Comments and replies") < communePage.indexOf("<AdminContentControls targetType=\"post\""), "Post admin moderation controls should remain below comments in the detail render order.");
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
  ["cleanup RPC exists", /create or replace function public\.soft_delete_commune_post\(target_post_id uuid, moderation_note text default null\)/i],
  ["cleanup RPC is security definer", /security definer/i],
  ["cleanup RPC has safe search path", /set search_path = public, auth, pg_temp/i],
  ["cleanup RPC requires Commune reviewer", /current_user_can_review_domain\('commune'::public\.review_domain\)[\s\S]*errcode = '42501'/i],
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
  ["cleanup grants execute only to authenticated", /revoke all on function public\.soft_delete_commune_post\(uuid, text\) from public;[\s\S]*revoke all on function public\.soft_delete_commune_post\(uuid, text\) from anon;[\s\S]*grant execute on function public\.soft_delete_commune_post\(uuid, text\) to authenticated/i],
  ["saved rows require active parent on select", /users select own active saved commune posts[\s\S]*post\.status = 'published'[\s\S]*post\.visibility = 'public'[\s\S]*post\.removed_at is null/i],
  ["delete helper calls cleanup RPC", /rpc\("soft_delete_commune_post"/i],
  ["missing RPC has migration drift error", /Commune soft-delete cleanup is not available yet\. Apply the latest Commune cleanup migration before deleting posts\./i],
  ["delete helper uses exact repaired arguments", /rpc\("soft_delete_commune_post", \{[\s\S]*target_post_id: input\.targetId,[\s\S]*moderation_note: input\.reason \|\| null/i],
  ["delete helper safely maps undefined-column deployment drift", /error\.code === "42703"[\s\S]*communeSoftDeleteUndefinedColumnMessage/i],
  ["Commune loader filters active public parents", /isActivePublicCommunePost[\s\S]*activePosts[\s\S]*loadVotePostsForPosts\(postIds, account\)/i],
  ["Vote sidecar loader only uses loaded parent ids", /activeParentPostIds[\s\S]*activeParentPostIds\.has\(row\.post_id\)/i],
  ["Detail page suppresses deleted parent and navigates", /handlePostDeleted[\s\S]*navigate\("\/commune", \{ replace: true \}\)[\s\S]*locallyDeletedPostId === postId \? null : state\.posts\[0\][\s\S]*onDeleted=\{handlePostDeleted\}/i],
  ["Commons loaders have active parent filter", /isActivePublicCommunePost[\s\S]*loadActivePublicCommunePostMap[\s\S]*filterNotificationsByActiveCommunePost/i],
  ["Signal Console sidecars use visible filtered rows", /visibleMyCommunityVoteRows[\s\S]*visibleReviewCommunityVoteRows[\s\S]*officialPostById/i],
  ["Public profile comments filtered by parent", /visiblePublicComments[\s\S]*activeCommentPostById/i]
];
const softDeleteFailures = softDeleteCleanupSecurity
  .filter(([, pattern]) => !pattern.test(softDeleteCleanupMigration + "\n" + communityVoteSoftDeleteRepairMigration + "\n" + communityVoteDeleteFilterMigration + "\n" + communeAccountApi + "\n" + communePage + "\n" + commonsCircleApi))
  .map(([name]) => name);
if (softDeleteFailures.length) {
  console.error(`Commune soft-delete cleanup security checks failed:\n${softDeleteFailures.join("\n")}`);
  process.exit(1);
}

const canonicalRepositoryColumns = supabaseSchema.match(/create table if not exists public\.commune_repository_showcases \(([\s\S]*?)\n\);/)?.[1] ?? "";
const brokenRepositoryCleanup = softDeleteCleanupMigration.match(/update public\.commune_repository_showcases([\s\S]*?)get diagnostics v_repository_rows/)?.[1] ?? "";
const repairedRepositoryCleanup = communityVoteSoftDeleteRepairMigration.match(/update public\.commune_repository_showcases([\s\S]*?)get diagnostics v_repository_rows/)?.[1] ?? "";
assert(!canonicalRepositoryColumns.includes("sandbox_review_status") && brokenRepositoryCleanup.includes("sandbox_review_status"), "Old cleanup RPC should retain a regression fixture proving the undefined repository-sidecar column mismatch.");
assert(!repairedRepositoryCleanup.includes("sandbox_review_status") && /status = 'rejected'[\s\S]*updated_at = v_now/.test(repairedRepositoryCleanup), "Repaired cleanup RPC must use only canonical commune_repository_showcases columns.");
assert(communeAccountApi.includes("Database cleanup failed because the deployed cleanup function references an unavailable column. Apply the latest cleanup migration."), "Undefined-column cleanup errors must remain safe and actionable without raw SQL details.");
assert(/if v_post_type = 'community_vote'[\s\S]*update public\.commune_vote_posts[\s\S]*vote_status = 'archived'[\s\S]*updated_at = v_now/.test(communityVoteSoftDeleteRepairMigration), "Community vote cleanup must be scoped and use real vote_status/updated_at columns.");
for (const voteColumn of ["post_id", "vote_status", "updated_at"]) {
  assert(new RegExp(`\\b${voteColumn}\\b`).test(communityVoteMigration), `Community vote cleanup column ${voteColumn} must exist in the vote schema migration.`);
}
for (const preservedTable of ["commune_vote_options", "commune_vote_ballots", "commune_vote_events"]) {
  assert(communityVoteSoftDeleteRepairMigration.includes(`'${preservedTable}'`) && !new RegExp(`delete from public\\.${preservedTable}|update public\\.${preservedTable}`, "i").test(communityVoteSoftDeleteRepairMigration), `${preservedTable} must remain preserved and audit-only after parent moderation deletion.`);
}

function tableDefinitionShape(source, table) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const createBlock = source.match(new RegExp(`create table if not exists public\\.${escapedTable}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"))?.[1] ?? "";
  const alterBlocks = [...source.matchAll(new RegExp(`alter table public\\.${escapedTable}([\\s\\S]*?);`, "gi"))].map((match) => match[1]).join("\n");
  return `${createBlock}\n${alterBlocks}`;
}

const cleanupColumnAudit = [
  ["commune_posts", ["id", "status", "post_type", "visibility", "visibility_state", "moderation_status", "moderation_reason", "hidden_at", "hidden_by", "removed_at", "updated_at", "last_activity_at"], supabaseSchema],
  ["user_saved_commune_posts", ["post_id"], supabaseSchema],
  ["commune_saved_posts", ["post_id"], supabaseSchema],
  ["user_followed_commune_threads", ["thread_id"], supabaseSchema],
  ["commune_threads", ["id", "post_id"], supabaseSchema],
  ["commune_content_reactions", ["target_type", "target_id"], reactionMigration],
  ["commune_comments", ["id", "post_id", "status", "visibility_state", "hidden_at", "hidden_by", "removed_at", "updated_at", "moderation_reason"], supabaseSchema],
  ["commune_media", ["post_id", "visibility_state", "updated_at"], supabaseSchema],
  ["commune_uploads", ["post_id", "status", "hidden_at", "hidden_by", "moderation_reason"], supabaseSchema],
  ["commune_code_revision_proposals", ["id", "post_id", "proposal_status", "hidden_at", "updated_at"], codeProposalMigration],
  ["commune_troubleshooting_posts", ["id", "post_id", "troubleshooting_status", "archived_at", "updated_at"], troubleshootingMigration],
  ["commune_research_notes", ["id", "post_id", "review_status", "archived_at", "updated_at"], researchMigration],
  ["commune_job_posts", ["id", "post_id", "application_status", "anti_scam_review_status", "archived_at", "updated_at"], jobMigration],
  ["commune_repository_showcases", ["id", "post_id", "status", "updated_at"], supabaseSchema],
  ["commune_iteration_showcases", ["id", "post_id", "status", "sandbox_review_status", "updated_at"], iterationMigration],
  ["commune_official_updates", ["id", "post_id", "official_status", "correction_status", "archived_at", "retracted_at", "updated_at"], officialUpdateMigration],
  ["commune_official_update_code_snippets", ["post_id", "public_visible", "edited_by", "edited_at", "updated_at"], officialUpdateMigration],
  ["commune_vote_posts", ["post_id", "vote_status", "updated_at"], communityVoteMigration],
  ["user_notifications", ["action_url", "source_id", "source_type"], supabaseSchema],
  ["commune_moderation_events", ["actor_id", "target_type", "target_id", "action", "from_status", "to_status", "reason", "metadata"], supabaseSchema]
];
for (const [table, columns, source] of cleanupColumnAudit) {
  const shape = tableDefinitionShape(source, table);
  assert(shape, `Cleanup column audit could not find the table definition for ${table}.`);
  for (const column of columns) assert(new RegExp(`\\b${column}\\b`).test(shape), `Cleanup RPC column ${table}.${column} is missing from its canonical schema/migration definition.`);
}

console.log("Security smoke test ok.");

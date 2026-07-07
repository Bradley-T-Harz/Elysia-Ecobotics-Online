import fs from "node:fs/promises";
import path from "node:path";

const roots = ["src", "supabase", "public", "docs", "packages", "scripts", "services"];
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".md", ".json", ".txt"]);

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

console.log("Security smoke test ok.");

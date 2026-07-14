import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) { return fs.readFile(path, "utf8"); }

function run(bin, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `${bin}_failed`)));
  });
}

const packageJson = JSON.parse(await read("package.json"));
const lock = JSON.parse(await read("package-lock.json"));
const gitignore = await read(".gitignore");
assert(gitignore.includes(".dev.vars") && gitignore.includes("runner.env") && gitignore.includes("**/cloudflared/*.json") && gitignore.includes("containers/auth.json"), "Local Pages, runner, registry, and Tunnel credential files must be ignored by git.");
for (const [name, version] of Object.entries({
  "@supabase/supabase-js": "2.106.2",
  "@vitejs/plugin-react": "6.0.2",
  "lucide-react": "1.17.0",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "typescript": "6.0.3",
  "vite": "8.0.16"
})) {
  assert(packageJson.dependencies[name] === version, `${name} must be pinned to its existing lockfile version.`);
  assert(lock.packages[`node_modules/${name}`]?.version === version, `${name} lockfile resolution drifted.`);
}
assert(packageJson.devDependencies["@cloudflare/workers-types"] === "4.20260623.1", "Cloudflare runtime types must be pinned.");

const fileChecks = [
  "functions/api/sandbox/run.ts",
  "functions/api/sandbox/health.ts",
  "tsconfig.functions.json",
  "public/_routes.json",
  ".dev.vars.example",
  "wrangler.example.jsonc",
  "services/sandbox-runner/package.json",
  "services/sandbox-runner/package-lock.json",
  "services/sandbox-runner/.npmrc",
  "services/sandbox-runner/.env.example",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-runner.service",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.service",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.timer",
  "services/sandbox-runner/deployment/cloudflared/config.example.yml",
  "services/sandbox-runner/deployment/install-verified-release.sh",
  "services/sandbox-runner/images/python.Containerfile",
  "services/sandbox-runner/images/node.Containerfile",
  "services/sandbox-runner/fixtures/snapshot-python-run.json",
  "services/sandbox-runner/fixtures/snapshot-timeout-run.json",
  "services/sandbox-runner/fixtures/snapshot-blocked-secret-run.json",
  "docs/deployment/governed-sandbox-deployment.md",
  "docs/security/governed-sandbox-incident-response.md",
  "scripts/packageSandboxRelease.mjs",
  "scripts/verifySandboxRelease.mjs",
  "supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql"
];
for (const file of fileChecks) await fs.access(file);
assert(!(await fs.stat("wrangler.example.jsonc")).isDirectory(), "Wrangler example configuration missing.");
let liveWrangler = false;
try { await fs.access("wrangler.jsonc"); liveWrangler = true; } catch {}
assert(!liveWrangler, "A live wrangler.jsonc must not be created before the existing Pages project is verified.");

const migration = await read("supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql");
for (const required of ["client_request_id", "reservation_expires_at", "code_sha256", "pg_advisory_xact_lock", "reserve_commune_sandbox_run", "start_commune_sandbox_run", "finalize_commune_sandbox_run", "sandbox_finalizer_token_is_valid", "sandbox_source_is_authorized", "enforce_sandbox_run_status_transition", "reconcile_stale_commune_sandbox_runs", "revoke execute on function public.record_commune_sandbox_run_result", "secret_hash_hex is not null", "sandbox_final_result_inconsistent"]) {
  assert(migration.includes(required), `Governed reservation migration missing ${required}.`);
}
assert(migration.includes("values ('sandbox_db_finalizer', null)"), "Migration must provision only a NULL finalizer hash slot.");
assert(!/secret_hash_hex\s*\)\s*values\s*\([^,]+,\s*'[0-9a-f]{64}'/i.test(migration), "Migration must not contain a real finalizer token hash.");
assert(migration.includes("alter column client_request_id set not null") && migration.includes("and client_request_id = p_client_request_id"), "Idempotency must be non-null and matched during start/finalization.");
assert(migration.includes("v_existing.code_bytes is distinct from p_code_bytes") && migration.includes("v_existing.code_version_id is distinct from p_code_version_id"), "Idempotent replays must bind all source associations and code size.");
assert((migration.match(/reservation_expires_at = null/g) || []).length >= 3, "Every successful or stale finalization path must clear its lease.");
assert(migration.includes("'tier', case") && migration.includes("v_hour_limit := 30") && migration.includes("v_hour_limit := 20") && migration.includes("v_hour_limit := 10"), "Member/reviewer/admin quota tiers must be derived inside trusted database functions.");
const schemaSnapshot = await read("supabase/schema.sql");
const policySnapshot = await read("supabase/policies.sql");
assert(schemaSnapshot.includes("Governed sandbox schema snapshot") && schemaSnapshot.includes("reconcile_stale_commune_sandbox_runs"), "Supabase schema snapshot is not reconciled with the governed migration.");
assert(policySnapshot.includes("Governed sandbox policy snapshot") && policySnapshot.includes("grant execute on function public.finalize_commune_sandbox_run"), "Supabase policy snapshot is not reconciled with final grants.");

const serviceUnit = await read("services/sandbox-runner/deployment/systemd/elysia-sandbox-runner.service");
assert(serviceUnit.includes("ProtectSystem=strict") && serviceUnit.includes("ProtectHome=read-only") && serviceUnit.includes("ReadWritePaths=%h/.local/state/elysia-sandbox-runner %h/.local/share/containers") && serviceUnit.includes("Delegate=yes"), "Runner user unit hardening or rootless Podman writable/delegation boundary is incomplete.");
assert(serviceUnit.includes("LimitCORE=0"), "Runner user unit must disable core dumps.");
assert(!serviceUnit.includes("NoNewPrivileges=true") && !serviceUnit.includes("ProtectControlGroups=true"), "The outer service must not block rootless Podman's newuidmap or delegated cgroup setup; no-new-privileges remains mandatory inside each container.");
const cleanupUnit = await read("services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.service");
assert(cleanupUnit.includes("ProtectSystem=strict") && cleanupUnit.includes("ProtectHome=read-only") && cleanupUnit.includes("ReadWritePaths=%h/.local/state/elysia-sandbox-runner %h/.local/share/containers") && cleanupUnit.includes("Delegate=yes"), "Cleanup user unit must be able to remove rootless Podman containers and storage state.");
assert(cleanupUnit.includes("LimitCORE=0"), "Cleanup user unit must disable core dumps.");
assert(!cleanupUnit.includes("NoNewPrivileges=true") && !cleanupUnit.includes("ProtectControlGroups=true"), "The cleanup service must not block rootless Podman's newuidmap or delegated cgroup setup.");
const containerRunner = await read("services/sandbox-runner/dockerRunner.mjs");
assert(containerRunner.includes("cleanupOrphanContainers") && containerRunner.includes("label=io.elysia.sandbox=true") && containerRunner.includes("preserveRecent"), "Crash-safe strict container orphan cleanup is missing.");
assert(containerRunner.includes('"--ulimit", "core=0:0"'), "Execution containers must disable core dumps.");
const runnerNpmrc = await read("services/sandbox-runner/.npmrc");
assert(runnerNpmrc.includes("package-lock=true") && runnerNpmrc.includes("fund=false") && runnerNpmrc.includes("ignore-scripts=true"), "Minimal runner npm policy must retain lockfiles and disable lifecycle scripts.");
const runnerEnvironmentExample = await read("services/sandbox-runner/.env.example");
assert(runnerEnvironmentExample.includes("ELYSIA_SANDBOX_RUNTIME_ROOT=/home/elysia-sandbox/") && !runnerEnvironmentExample.includes("RUNTIME_ROOT=%h"), "EnvironmentFile paths must not rely on unexpanded systemd specifiers.");
const deploymentGuide = await read("docs/deployment/governed-sandbox-deployment.md");
assert(deploymentGuide.includes("-m 0640 -o root -g elysia-sandbox") && deploymentGuide.includes("-m 0755 -o root -g root /home/elysia-sandbox/.config/systemd"), "Service environment and user-unit paths must remain root-controlled rather than writable by the runner account.");
const legalPages = await read("src/pages/Legal/legalPolicyPages.ts");
const communePage = await read("src/pages/The-Elysia-Commune/index.tsx");
assert(legalPages.includes("Governed code sandbox processing") && legalPages.includes("Cloudflare") && legalPages.includes("Hetzner") && legalPages.includes("Supabase may retain bounded metadata"), "Privacy and terms must disclose governed sandbox processing truthfully.");
assert(communePage.includes("Submitted code crosses Cloudflare and the Hetzner sandbox host") && communePage.includes("No browser execution"), "Run UI must disclose the external processing boundary without implying trust.");
const cloudflared = await read("services/sandbox-runner/deployment/cloudflared/config.example.yml");
assert(cloudflared.includes("http://127.0.0.1:8788") && cloudflared.includes("http_status:404"), "Tunnel example must route only to the localhost runner and fail closed otherwise.");
const pythonImage = await read("services/sandbox-runner/images/python.Containerfile");
const nodeImage = await read("services/sandbox-runner/images/node.Containerfile");
assert(pythonImage.includes("/bin/*") && pythonImage.includes("ensurepip") && nodeImage.includes("/bin/*") && nodeImage.includes("/usr/local/bin/npm"), "Minimal images must remove shells and package installers.");

const resultRoot = await fs.mkdtemp(join(os.tmpdir(), "elysia-release-result-"));
const functionsBuildRoot = join(resultRoot, "functions-build");
const functionsRoutes = join(resultRoot, "functions-routes.json");
await run(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js",
  "pages", "functions", "build", "functions",
  "--outdir", functionsBuildRoot,
  "--output-routes-path", functionsRoutes,
  "--project-directory", ".",
  "--compatibility-date", "2026-07-13",
  "--compatibility-flag", "nodejs_compat"
], { ...process.env, XDG_CONFIG_HOME: join(resultRoot, "wrangler-config") });
const compiledRoutes = JSON.parse(await fs.readFile(functionsRoutes, "utf8"));
assert(
  compiledRoutes.include?.includes("/api/sandbox/run")
  && compiledRoutes.include?.includes("/api/sandbox/health")
  && !compiledRoutes.include?.some((route) => route.includes("_shared")),
  "Wrangler Pages build must expose only the two governed sandbox endpoints."
);
const packageResult = join(resultRoot, "package.json");
const verifyResult = join(resultRoot, "verify.json");
const allowlistProbe = "services/sandbox-runner/.release-allowlist-probe";
let sourceAllowlistRejected = false;
await fs.writeFile(allowlistProbe, "must never be packaged\n", { flag: "wx" });
try {
  await run(process.execPath, ["scripts/packageSandboxRelease.mjs"], { ...process.env, SANDBOX_RELEASE_ALLOW_DIRTY: "1" });
} catch (error) {
  sourceAllowlistRejected = error.message.includes("release_source_allowlist_mismatch");
} finally {
  await fs.rm(allowlistProbe, { force: true });
}
assert(sourceAllowlistRejected, "Release packaging must reject every unexpected runner source file.");
await run(process.execPath, ["scripts/packageSandboxRelease.mjs"], { ...process.env, SANDBOX_RELEASE_ALLOW_DIRTY: "1", SANDBOX_RELEASE_RESULT_FILE: packageResult });
const packaged = JSON.parse(await fs.readFile(packageResult, "utf8"));
await run(process.execPath, ["scripts/verifySandboxRelease.mjs", packaged.archive], { ...process.env, SANDBOX_RELEASE_RESULT_FILE: verifyResult });
const verified = JSON.parse(await fs.readFile(verifyResult, "utf8"));
assert(verified.ok === true && verified.releaseId === packaged.releaseId, "Immutable release bundle verification failed.");
const tamperedRoot = join(resultRoot, "tampered");
await fs.mkdir(tamperedRoot, { recursive: true });
await run("tar", ["--extract", "--gzip", "--file", packaged.archive, "--directory", tamperedRoot]);
await fs.writeFile(join(tamperedRoot, "bundle", "services", "sandbox-runner", "unexpected.txt"), "not in manifest\n");
const tamperedArchive = join(resultRoot, "tampered.tar.gz");
await run("tar", ["--create", "--gzip", "--file", tamperedArchive, "--directory", tamperedRoot, "bundle"]);
const tamperedHash = await run("sha256sum", [tamperedArchive]);
await fs.writeFile(`${tamperedArchive}.sha256`, `${tamperedHash.split(/\s+/)[0]}  ${tamperedArchive.split("/").at(-1)}\n`);
let unmanifestedFileRejected = false;
try {
  await run(process.execPath, ["scripts/verifySandboxRelease.mjs", tamperedArchive]);
} catch (error) {
  unmanifestedFileRejected = error.message.includes("release_unmanifested_file");
}
assert(unmanifestedFileRejected, "Release verification must reject extra unmanifested files even when the outer checksum is recomputed.");
await fs.rm("services/sandbox-runner/release-output", { recursive: true, force: true });
await fs.rm(resultRoot, { recursive: true, force: true });

console.log("Sandbox deployment smoke test ok.");

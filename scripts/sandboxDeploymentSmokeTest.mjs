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
  "@supabase/supabase-js": "2.112.3",
  "@vitejs/plugin-react": "6.1.0",
  "lucide-react": "1.17.0",
  "react": "19.2.8",
  "react-dom": "19.2.8",
  "typescript": "6.0.3",
  "vite": "8.2.2"
})) {
  assert(packageJson.dependencies[name] === version, `${name} must be pinned to its existing lockfile version.`);
  assert(lock.packages[`node_modules/${name}`]?.version === version, `${name} lockfile resolution drifted.`);
}
assert(packageJson.devDependencies["@cloudflare/workers-types"] === "5.20260823.1", "Cloudflare runtime types must be pinned.");
for (const requiredScript of ["test:sandbox-access", "test:sandbox-finalizer", "test:sandbox-eligibility", "test:sandbox-production-gate", "sandbox:finalizer:check", "sandbox:production-gate"]) {
  assert(typeof packageJson.scripts[requiredScript] === "string", `Missing ${requiredScript} repository verification command.`);
}

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
  "services/sandbox-runner/accessValidator.mjs",
  "services/sandbox-runner/deployment/README.md",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-runner.service",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.service",
  "services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.timer",
  "services/sandbox-runner/deployment/cloudflared/config.example.yml",
  "services/sandbox-runner/deployment/host-preflight.sh",
  "services/sandbox-runner/deployment/install-verified-release.sh",
  "services/sandbox-runner/deployment/install-user-service.sh",
  "services/sandbox-runner/deployment/post-install-verify.sh",
  "services/sandbox-runner/deployment/rollback-release.sh",
  "services/sandbox-runner/deployment/uninstall-user-service.sh",
  "services/sandbox-runner/deployment/build-runtime-images.sh",
  "services/sandbox-runner/deployment/validate-rootless-podman.sh",
  "services/sandbox-runner/deployment/validate-rootless-docker-standby.sh",
  "services/sandbox-runner/deployment/cloudflared/validate-config.sh",
  "services/sandbox-runner/deployment/cloudflare/access-contract.example.json",
  "services/sandbox-runner/images/python.Containerfile",
  "services/sandbox-runner/images/node.Containerfile",
  "services/sandbox-runner/fixtures/snapshot-python-run.json",
  "services/sandbox-runner/fixtures/snapshot-timeout-run.json",
  "services/sandbox-runner/fixtures/snapshot-blocked-secret-run.json",
  "docs/deployment/governed-sandbox-deployment.md",
  "docs/security/governed-sandbox-incident-response.md",
  "scripts/packageSandboxRelease.mjs",
  "scripts/sandboxAccessSmokeTest.mjs",
  "scripts/sandboxFinalizerTokenSmokeTest.mjs",
  "scripts/sandboxFinalizerTokenTool.mjs",
  "scripts/sandboxProductionReleaseGate.mjs",
  "scripts/sandboxProductionReleaseGateTest.mjs",
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
assert(
  serviceUnit.includes("Delegate=yes")
    && serviceUnit.includes("RestrictRealtime=true")
    && serviceUnit.includes("RestrictSUIDSGID=true")
    && serviceUnit.includes("RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK")
    && serviceUnit.includes("LockPersonality=true"),
  "Runner user unit compatible rootless-Podman hardening is incomplete."
);
assert(
  serviceUnit.includes("LimitCORE=0") && serviceUnit.includes("UMask=0077"),
  "Runner user unit must disable core dumps and retain its restrictive umask."
);
for (const incompatibleDirective of [
  "PrivateTmp=",
  "ProtectSystem=",
  "ProtectHome=",
  "ReadWritePaths=",
  "ProtectKernelTunables=",
  "ProtectKernelModules=",
  "ProtectClock=",
  "ProtectHostname=",
  "NoNewPrivileges=",
  "ProtectControlGroups="
]) {
  assert(
    !serviceUnit.includes(incompatibleDirective),
    `Runner user unit must omit rootless-Podman-incompatible directive ${incompatibleDirective}`
  );
}

const cleanupUnit = await read("services/sandbox-runner/deployment/systemd/elysia-sandbox-cleanup.service");
assert(
  cleanupUnit.includes("Delegate=yes")
    && cleanupUnit.includes("RestrictRealtime=true")
    && cleanupUnit.includes("RestrictSUIDSGID=true")
    && cleanupUnit.includes("RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK")
    && cleanupUnit.includes("LockPersonality=true"),
  "Cleanup user unit compatible rootless-Podman hardening is incomplete."
);
assert(
  cleanupUnit.includes("LimitCORE=0") && cleanupUnit.includes("UMask=0077"),
  "Cleanup user unit must disable core dumps and retain its restrictive umask."
);
for (const incompatibleDirective of [
  "PrivateTmp=",
  "ProtectSystem=",
  "ProtectHome=",
  "ReadWritePaths=",
  "ProtectKernelTunables=",
  "ProtectKernelModules=",
  "ProtectClock=",
  "ProtectHostname=",
  "NoNewPrivileges=",
  "ProtectControlGroups="
]) {
  assert(
    !cleanupUnit.includes(incompatibleDirective),
    `Cleanup user unit must omit rootless-Podman-incompatible directive ${incompatibleDirective}`
  );
}
const containerRunner = await read("services/sandbox-runner/dockerRunner.mjs");
assert(containerRunner.includes("cleanupOrphanContainers") && containerRunner.includes("label=io.elysia.sandbox=true") && containerRunner.includes("preserveRecent"), "Crash-safe strict container orphan cleanup is missing.");
assert(containerRunner.includes('config.engine === "podman" ? ["--time", "0"]'), "Podman force removal must bypass its default stop grace period before verifying absence.");
assert(containerRunner.includes('"--ulimit", "core=0:0"'), "Execution containers must disable core dumps.");
assert(containerRunner.includes('`fsize=${config.limits.fileSizeBytes}:${config.limits.fileSizeBytes}`'), "Execution containers must enforce a hard file-size limit.");
assert(containerRunner.includes('stdio: ["pipe", "pipe", "pipe"]') && containerRunner.includes('child.stdin?.end(sourceCode, "utf8")'), "Submitted source must reach the container over stdin only.");
assert(containerRunner.includes('addEventListener("abort"') && containerRunner.includes('terminate("request_cancelled")') && containerRunner.includes('status: "cancelled"'), "Caller disconnect must terminate and clean the active container.");
assert(!containerRunner.includes('"--mount"') && !containerRunner.includes("type=bind"), "The production runner must not bind-mount submitted source or other host paths.");
assert(containerRunner.includes('/workspace:rw,nosuid,nodev,noexec') && containerRunner.includes('/tmp:rw,nosuid,nodev,noexec'), "Execution scratch filesystems must be bounded noexec tmpfs mounts.");
const runnerServer = await read("services/sandbox-runner/server.mjs");
const accessValidator = await read("services/sandbox-runner/accessValidator.mjs");
const runnerConfig = await read("services/sandbox-runner/serviceConfig.mjs");
assert(runnerServer.includes('request.headers["cf-access-jwt-assertion"]') && runnerServer.includes("startup_cleanup_unverified"), "The origin must require an Access assertion and refuse unverifiable startup cleanup.");
for (const accessInvariant of ["RS256", "accessTeamDomain", "accessAudience", "/cdn-cgi/access/certs", "redirect: \"error\"", "MAX_ASSERTION_BYTES", "MAX_JWKS_BYTES"]) {
  assert(accessValidator.includes(accessInvariant), `Access verifier missing ${accessInvariant}.`);
}
assert(runnerConfig.includes("cloudflareaccess") && runnerConfig.includes("ACCESS_TEAM_HOST") && runnerConfig.includes("access_team_domain_invalid") && runnerConfig.includes("access_audience_invalid"), "Production runner configuration must validate Access issuer and audience exactly.");
const runnerNpmrc = await read("services/sandbox-runner/.npmrc");
assert(runnerNpmrc.includes("package-lock=true") && runnerNpmrc.includes("fund=false") && runnerNpmrc.includes("ignore-scripts=true"), "Minimal runner npm policy must retain lockfiles and disable lifecycle scripts.");
const runnerEnvironmentExample = await read("services/sandbox-runner/.env.example");
assert(runnerEnvironmentExample.includes("ELYSIA_SANDBOX_RUNTIME_ROOT=/home/elysia-sandbox/") && !runnerEnvironmentExample.includes("RUNTIME_ROOT=%h"), "EnvironmentFile paths must not rely on unexpanded systemd specifiers.");
assert(runnerEnvironmentExample.includes("ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN=") && runnerEnvironmentExample.includes("ELYSIA_SANDBOX_ACCESS_AUDIENCE="), "Runner environment example must name the Access assertion trust configuration without including credentials.");
const postInstallVerifier = await read("services/sandbox-runner/deployment/post-install-verify.sh");
assert(postInstallVerifier.includes("SANDBOX_DB_FINALIZER_TOKEN") && postInstallVerifier.includes("SUPABASE_" + "SERVICE_" + "ROLE_KEY") && postInstallVerifier.includes("DOCKER_HOST") && postInstallVerifier.includes("single_key"), "Production Podman verification must reject proxy/database secrets, standby sockets, and duplicate configuration keys.");

const userServiceInstaller = await read("services/sandbox-runner/deployment/install-user-service.sh");
assert(
  userServiceInstaller.includes('"$unit_dir/timers.target.wants"') &&
  userServiceInstaller.includes('"$unit_dir/default.target.wants"') &&
  userServiceInstaller.includes('run ln -sfn ../elysia-sandbox-cleanup.timer') &&
  userServiceInstaller.includes('run ln -sfn ../elysia-sandbox-runner.service'),
  "Root-controlled user units must receive root-created persistent enablement links."
);
assert(
  !userServiceInstaller.includes("systemctl --user enable") &&
  userServiceInstaller.includes('systemctl --user start elysia-sandbox-cleanup.timer'),
  "The unprivileged service account must not be asked to write enablement links inside the root-controlled unit directory."
);
const deploymentGuide = await read("docs/deployment/governed-sandbox-deployment.md");
assert(deploymentGuide.includes("-m 0640 -o root -g elysia-sandbox") && deploymentGuide.includes("-m 0755 -o root -g root /home/elysia-sandbox/.config/systemd"), "Service environment and user-unit paths must remain root-controlled rather than writable by the runner account.");
assert(
  deploymentGuide.includes("normal Pages control-plane state is `SANDBOX_ENABLED=true`")
    && deploymentGuide.includes("A routine application release must preserve the current production variable and binding inventory")
    && deploymentGuide.includes("stop and reconcile it; do not automatically change a feature switch, binding, or secret")
    && deploymentGuide.includes("Preview must retain `SANDBOX_ENABLED=false`")
    && deploymentGuide.includes('HTTP 503 with `{"ok":false,"error":"sandbox_disabled"}` is reserved for a deliberate emergency or maintenance shutdown'),
  "The deployment contract must preserve the enabled production sandbox, keep preview disabled, and forbid stale-baseline control-plane changes."
);
const productionGate = await read("scripts/sandboxProductionReleaseGate.mjs");
assert(
  productionGate.includes("profileless_health_contract_failed")
    && productionGate.includes("eligible_health_contract_failed")
    && productionGate.includes("bounded_run_finalization_not_recorded")
    && productionGate.includes("idempotent_replay_contract_failed")
    && productionGate.includes("release_gate_requires_online_main_alignment")
    && productionGate.includes('exactKeys(envVars, [...ordinaryVariables.keys(), ...secretVariables], "production_variable")')
    && productionGate.includes('for (const name of secretVariables) assert(!(name in previewVars)'),
  "The production release gate must verify profile-less denial, eligible health, a finalized idempotent run, source alignment, and exact Pages control-plane state."
);
assert(
  productionGate.includes("CLOUDFLARE_API_TOKEN_FILE")
    && productionGate.includes("ELYSIA_SANDBOX_PROFILELESS_TOKEN_FILE")
    && productionGate.includes("ELYSIA_SANDBOX_ELIGIBLE_TOKEN_FILE")
    && productionGate.includes("must_be_owner_only")
    && !productionGate.includes("process.argv[2]"),
  "Production acceptance credentials must be read only from owner-only files outside Git, never argv."
);
assert(
  deploymentGuide.includes("Mandatory post-deployment production release gate")
    && deploymentGuide.includes("a governed signed-in profile-less fixture returns `profile_required`")
    && deploymentGuide.includes("an eligible profile-backed fixture receives sanitized availability")
    && deploymentGuide.includes("one small Python `manual_snapshot` run returns a UUID run ID")
    && deploymentGuide.includes("there is no bypass or magic account"),
  "The runbook must require real profile-less, eligible, and bounded execution proof after routine releases."
);
const legalPages = await read("src/pages/Legal/legalPolicyPages.ts");
const communePage = await read("src/pages/The-Elysia-Commune/index.tsx");
assert(legalPages.includes("Governed code sandbox processing") && legalPages.includes("Cloudflare") && legalPages.includes("Hetzner") && legalPages.includes("Supabase may retain bounded metadata"), "Privacy and terms must disclose governed sandbox processing truthfully.");
assert(communePage.includes("Submitted code crosses Cloudflare and the Hetzner sandbox host") && communePage.includes("No browser execution"), "Run UI must disclose the external processing boundary without implying trust.");
const cloudflared = await read("services/sandbox-runner/deployment/cloudflared/config.example.yml");
assert(cloudflared.includes("http://127.0.0.1:8788") && cloudflared.includes("http_status:404"), "Tunnel example must route only to the localhost runner and fail closed otherwise.");
const cloudflaredValidator = await read("services/sandbox-runner/deployment/cloudflared/validate-config.sh");
assert(cloudflaredValidator.includes("tunnel_id") && cloudflaredValidator.includes('/etc/cloudflared/${tunnel_id}') && cloudflaredValidator.includes("cloudflared --config"), "Tunnel validation must bind the UUID to its root credential path and invoke the official ingress validator.");
const accessContract = JSON.parse(await read("services/sandbox-runner/deployment/cloudflare/access-contract.example.json"));
assert(accessContract.documentKind === "non-deployable-access-contract" && accessContract.policyDecision === "service_auth" && accessContract.originAssertionHeader === "Cf-Access-Jwt-Assertion" && accessContract.originValidation?.failClosed === true, "Access repository contract must remain non-deployable and fail closed.");
const podmanValidator = await read("services/sandbox-runner/deployment/validate-rootless-podman.sh");
const dockerValidator = await read("services/sandbox-runner/deployment/validate-rootless-docker-standby.sh");
const hostPreflight = await read("services/sandbox-runner/deployment/host-preflight.sh");
const imageBuilder = await read("services/sandbox-runner/deployment/build-runtime-images.sh");
assert(podmanValidator.includes("rootless") && podmanValidator.includes("cgroupVersion") && podmanValidator.includes("subuid_count") && podmanValidator.includes("subgid_count"), "Podman validator must enforce rootless cgroup-v2 and subordinate-ID prerequisites.");
assert(dockerValidator.includes('unix:///run/user/${uid}/docker.sock') && dockerValidator.includes("rootless") && dockerValidator.includes("CgroupVersion") && dockerValidator.includes("coldStandby"), "Docker standby validator must reject the rootful socket and require rootless cgroup v2.");
assert(hostPreflight.includes("permitrootlogin no") && hostPreflight.includes("passwordauthentication no") && hostPreflight.includes("/var/lib/systemd/linger/elysia-sandbox") && hostPreflight.includes("loopbackOnly"), "Host preflight must read-only verify SSH, lingering, account, and runner-listener boundaries.");
assert(imageBuilder.includes("--pull=never") && imageBuilder.includes("podman export") && imageBuilder.includes("pip[^/]*") && imageBuilder.includes("65534:65534"), "Runtime image builder must avoid pulls and inspect exported stripped filesystems and non-root identity.");
const finalizerTool = await read("scripts/sandboxFinalizerTokenTool.mjs");
assert(finalizerTool.includes("randomBytes(48)") && finalizerTool.includes('createHash("sha256")') && finalizerTool.includes("flag: \"wx\"") && finalizerTool.includes("operator_output_path_must_be_absolute_and_outside_repository"), "Finalizer tooling must generate strong tokens and keep private outputs outside Git.");
assert(finalizerTool.includes("Raw tokens are never accepted in argv or printed") && !finalizerTool.includes("supabase db") && !finalizerTool.includes("migration repair"), "Finalizer tooling must not accept token argv values or mutate Supabase.");
const pythonImage = await read("services/sandbox-runner/images/python.Containerfile");
const nodeImage = await read("services/sandbox-runner/images/node.Containerfile");
assert(pythonImage.includes("/bin/*") && pythonImage.includes("ensurepip") && nodeImage.includes("/bin/*") && nodeImage.includes("/usr/local/bin/npm"), "Minimal images must remove shells and package installers.");

for (const script of [
  "services/sandbox-runner/deployment/build-runtime-images.sh",
  "services/sandbox-runner/deployment/cloudflared/validate-config.sh",
  "services/sandbox-runner/deployment/host-preflight.sh",
  "services/sandbox-runner/deployment/install-user-service.sh",
  "services/sandbox-runner/deployment/post-install-verify.sh",
  "services/sandbox-runner/deployment/rollback-release.sh",
  "services/sandbox-runner/deployment/uninstall-user-service.sh",
  "services/sandbox-runner/deployment/validate-rootless-docker-standby.sh",
  "services/sandbox-runner/deployment/validate-rootless-podman.sh"
]) await run("bash", ["-n", script]);

const tunnelValidationRoot = await fs.mkdtemp(join(os.tmpdir(), "elysia-tunnel-contract-"));
try {
  const tunnelId = "00000000-0000-4000-8000-000000000001";
  const tunnelConfig = join(tunnelValidationRoot, "config.yml");
  await fs.writeFile(tunnelConfig, [
    `tunnel: ${tunnelId}`,
    `credentials-file: /etc/cloudflared/${tunnelId}.json`,
    "originRequest:",
    "  connectTimeout: 5s",
    "  noTLSVerify: false",
    "ingress:",
    "  - hostname: sandbox.elysiaecobotics.com",
    "    service: http://127.0.0.1:8788",
    "  - service: http_status:404",
    ""
  ].join("\n"), { mode: 0o600 });
  await run("bash", ["services/sandbox-runner/deployment/cloudflared/validate-config.sh", tunnelConfig]);
  const linkedConfig = join(tunnelValidationRoot, "linked.yml");
  await fs.symlink(tunnelConfig, linkedConfig);
  let symlinkRejected = false;
  try { await run("bash", ["services/sandbox-runner/deployment/cloudflared/validate-config.sh", linkedConfig]); }
  catch { symlinkRejected = true; }
  assert(symlinkRejected, "Tunnel validation must reject a symlinked configuration path.");
} finally {
  await fs.rm(tunnelValidationRoot, { recursive: true, force: true });
}

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

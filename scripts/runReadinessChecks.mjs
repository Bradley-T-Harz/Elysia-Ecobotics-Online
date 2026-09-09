import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deliberately do not spread process.env or load dotenv. The fixed command list
// excludes deployments, provider catalog creation and external account actions.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selected = process.argv[2];
const extra = process.argv.slice(3);
if (extra.length && (extra.length !== 2 || extra[0] !== "--output" || !extra[1])) {
  throw new Error("Usage: node scripts/runReadinessChecks.mjs <check> [--output <evidence-directory>]");
}
const commands = {
  forgeBrowser: ["node", ["scripts/developerForgeBrowserSmokeTest.mjs"]],
  publisher: ["node", ["--experimental-strip-types", "scripts/publisherOwnershipContractTest.mts"]],
  publisherBrowser: ["node", ["scripts/publisherOwnershipBrowserTest.mjs"]],
  jobFeesBrowser: ["node", ["scripts/jobPostFeeBrowserTest.mjs"]],
  jobOpportunityBrowser: ["node", ["scripts/jobOpportunityBrowserSmokeTest.mjs"]],
  jobFees: ["node", ["--experimental-strip-types", "scripts/jobPostFeeContractTest.mts"]],
  preProvider: ["node", ["scripts/preProviderSmokeTest.mjs"]],
  preProviderBrowser: ["node", ["scripts/preProviderBrowserTest.mjs"]],
  legal: ["node", ["scripts/prepareReadinessLegal.mjs", "--check"]],
  billing: ["npm", ["run", "test:billing"]],
  types: ["npm", ["run", "typecheck"]],
  functions: ["npm", ["run", "typecheck:functions"]],
  publication: ["node", ["scripts/preparePublicationCandidate.mjs"]],
  publicationBrowser: ["node", ["scripts/stripeReadinessBrowserTest.mjs", "--publication"]],
  baseline: ["node", ["scripts/readinessBaselineBuild.mjs"]],
  browser: ["node", ["scripts/stripeReadinessBrowserTest.mjs"]],
  regression: ["node", ["scripts/readinessRegression.mjs"]],
  build: ["npm", ["run", "build"]],
  frontend: ["node", ["scripts/economicFrontendSmokeTest.mjs"]],
  readiness: ["node", ["scripts/stripeReadinessSmokeTest.mjs"]],
  integration: ["node", ["scripts/sandboxDatabaseMigrationTest.mjs"]],
  database: ["node", ["scripts/sandboxDatabaseMigrationTest.mjs"]],
};
if (!(selected in commands)) throw new Error(`Choose a local readiness check: ${Object.keys(commands).join(", ")}`);
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: "C.UTF-8",
  CI: "1",
  NO_COLOR: "1",
  ELYSIA_ISOLATED_TEST: "1",
  WRANGLER_SEND_METRICS: "false",
  NODE_OPTIONS: `--require=${path.join(root, "scripts/readinessNetworkGuard.cjs")}`,
};
if (extra.length) {
  env.ELYSIA_READINESS_EVIDENCE_DIR = path.resolve(extra[1]);
  if (selected === "jobOpportunityBrowser") env.ELYSIA_JOB_OPPORTUNITY_EVIDENCE_DIR = path.resolve(extra[1]);
}
if (["build", "baseline", "publication"].includes(selected)) {
  // Public, synthetic configuration only. Browser fixtures intercept this host.
  env.VITE_SUPABASE_URL = "https://readiness-fixture.supabase.co";
  env.VITE_SUPABASE_ANON_KEY = "synthetic-public-anon-fixture";
}
if (selected === "integration") {
  env.ELYSIA_SANDBOX_DATABASE_INTEGRATION = "1";
  env.ELYSIA_CONTAINER_RUNTIME = "podman";
}
const [command, args] = commands[selected];
const child = spawn(command, args, { cwd: root, env, shell: false, stdio: "inherit" });
child.on("error", () => { console.error("Could not start the isolated local check."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });

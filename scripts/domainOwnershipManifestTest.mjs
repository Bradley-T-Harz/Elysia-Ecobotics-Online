import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [manifestText, routeContractText, packageText, ...runtimeSources] = await Promise.all([
  read("docs/architecture/domain-ownership-manifest.json"),
  read("docs/navigation/route-preservation-contract.json"),
  read("package.json"),
  read("src/App.tsx"),
  read("src/main.tsx"),
  read("src/shared/navigation/publicNavigation.ts"),
  read("src/shared/components/SiteNav.tsx")
]);

const manifest = JSON.parse(manifestText);
const routeContract = JSON.parse(routeContractText);
const packageJson = JSON.parse(packageText);
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

function selectorMatches(routePattern, selectors = {}) {
  if (selectors.excludeExact?.includes(routePattern)) return false;
  if (selectors.excludePrefixes?.some((prefix) => routePattern === prefix || routePattern.startsWith(`${prefix}/`))) return false;
  if (routePattern === "*") return selectors.wildcard === true;
  if (selectors.exact?.includes(routePattern)) return true;
  if (selectors.prefix?.some((prefix) => routePattern === prefix || routePattern.startsWith(`${prefix}/`))) return true;
  return selectors.prefixLiteral?.some((prefix) => routePattern.startsWith(prefix)) ?? false;
}

check(manifest.schemaVersion === 1, "Domain ownership manifest schema version changed without a validator update.");
check(manifest.status === "current-state-documentation-and-test-contract", "Manifest must remain documentation/test authority only.");
check(manifest.authoritativeSources.routes === "src/App.tsx", "Manifest must preserve App.tsx as executable route truth.");
check(manifest.authoritativeSources.routePreservation === "docs/navigation/route-preservation-contract.json", "Manifest must consume the preservation baseline rather than replace it.");

const domainIds = manifest.domains.map(({ domainId }) => domainId);
check(new Set(domainIds).size === domainIds.length, "Domain IDs must be unique.");

const routedDomains = manifest.domains.filter(({ routeSelectors }) => routeSelectors);
const ownedRouteCounts = new Map(routedDomains.map(({ domainId }) => [domainId, 0]));
for (const route of routeContract.routes) {
  if (route.resolvedPattern === null) continue;
  const owners = routedDomains.filter(({ routeSelectors }) => selectorMatches(route.resolvedPattern, routeSelectors));
  check(owners.length === 1, `${route.id} ${route.resolvedPattern} must have exactly one presentation owner; found ${owners.map(({ domainId }) => domainId).join(", ") || "none"}.`);
  if (owners.length === 1) ownedRouteCounts.set(owners[0].domainId, ownedRouteCounts.get(owners[0].domainId) + 1);
}
for (const [domainId, count] of ownedRouteCounts) check(count > 0, `${domainId} has route selectors but owns no preservation-baseline route.`);

const expectedApiSelectors = new Map([
  ["/api/identity/*", "identity-accounts"],
  ["/api/billing/*", "support-economics"],
  ["/api/sandbox/credits", "support-economics"],
  ["/api/sandbox/health", "sandbox-execution"],
  ["/api/sandbox/run", "sandbox-execution"]
]);
const observedApiSelectors = new Map();
for (const owner of [...manifest.domains, ...manifest.sharedServices]) {
  for (const selector of owner.apiSelectors ?? []) {
    check(!observedApiSelectors.has(selector), `${selector} has duplicate owners ${observedApiSelectors.get(selector)} and ${owner.domainId ?? owner.serviceId}.`);
    observedApiSelectors.set(selector, owner.domainId ?? owner.serviceId);
  }
}
assert.deepEqual([...observedApiSelectors.entries()].sort(), [...expectedApiSelectors.entries()].sort(), "Owned Pages API boundaries drifted");

const requiredInvariants = [
  "Frontend visibility and route guards are user-experience controls, never authorization.",
  "Public Commons Profile remains canonical public profile authority; Artisan is a consumer and must not create a second identity authority.",
  "Payment, voluntary support, hosted-execution allowance, and community participation remain separate concepts.",
  "Hosted-execution credits are non-transferable service-use units with no cash value and never weaken sandbox security.",
  "Local Elysia, local computation, and community participation are not metered by EcoSyneva."
];
for (const invariant of requiredInvariants) check(manifest.invariants.includes(invariant), `Required preservation invariant missing: ${invariant}`);

const forbiddenPairs = new Set(manifest.forbiddenCouplings.map(({ from, to }) => `${from}->${to}`));
for (const pair of [
  "support-economics->recognition-badges",
  "support-economics->moderation-admin",
  "support-economics->marketplace",
  "sandbox-execution->support-economics",
  "artisan-bridge->identity-accounts",
  "public-shell->all-authority",
  "local-elysia->support-economics"
]) check(forbiddenPairs.has(pair), `Forbidden coupling is not recorded: ${pair}`);

for (const source of runtimeSources) {
  check(!source.includes("domain-ownership-manifest"), "The domain ownership manifest must not be imported by runtime application code.");
}
check(packageJson.scripts["test:domain-ownership"] === "node scripts/domainOwnershipManifestTest.mjs", "Package script must expose the ownership contract test.");
check(packageJson.scripts["test:all"].includes("npm run test:domain-ownership"), "The ownership contract must remain in the complete test gate.");

if (errors.length) {
  console.error(`Domain ownership manifest failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Domain ownership manifest ok (${manifest.domains.length} domains, ${routeContract.routes.filter(({ resolvedPattern }) => resolvedPattern !== null).length} owned route declarations, ${manifest.sharedServices.length} shared services, ${manifest.forbiddenCouplings.length} forbidden couplings).`);

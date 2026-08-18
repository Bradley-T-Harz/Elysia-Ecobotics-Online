import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

const [
  contractText,
  app,
  siteNav,
  publicNavigation,
  siteHeader,
  accountButton,
  siteFooter,
  homepage,
  routeSmoke,
  sitemap,
  siteUrls,
  legalPolicies
] = await Promise.all([
  read("docs/navigation/route-preservation-contract.json"),
  read("src/App.tsx"),
  read("src/shared/components/SiteNav.tsx"),
  read("src/shared/navigation/publicNavigation.ts"),
  read("src/shared/components/SiteHeader.tsx"),
  read("src/shared/components/AccountButton.tsx"),
  read("src/shared/components/SiteFooter.tsx"),
  read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx"),
  read("scripts/routeSmokeTest.mjs"),
  read("public/sitemap.xml"),
  read("src/config/siteUrls.ts"),
  read("src/pages/Legal/legalPolicyPages.ts")
]);

const contract = JSON.parse(contractText);
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

function arrayEqual(actual, expected, label) {
  try {
    assert.deepEqual(actual, expected);
  } catch {
    errors.push(`${label} differs.\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
  }
}

function extractRouteDeclarations(source) {
  return [...source.matchAll(/<Route\b[^>]*>/g)].map((match) => {
    const tag = match[0];
    return {
      tag,
      declaredPath: tag.match(/\bpath="([^"]+)"/)?.[1] ?? null,
      index: /\sindex(?:\s|=|\/|>)/.test(tag),
      owner: tag.match(/\belement=\{<([A-Z][A-Za-z0-9_]*)\b/)?.[1] ?? null
    };
  });
}

function routeCanResolve(path) {
  return contract.routes.some((route) => {
    if (!route.resolvedPattern || route.resolvedPattern === "*") return false;
    if (route.resolvedPattern === path) return true;
    if (!route.resolvedPattern.includes(":")) return false;
    const patternParts = route.resolvedPattern.split("/");
    const pathParts = path.split("/");
    return patternParts.length === pathParts.length && patternParts.every((part, index) => (
      part.startsWith(":") ? Boolean(pathParts[index]) : part === pathParts[index]
    ));
  });
}

function routeForExactPath(path) {
  return contract.routes.find((route) => route.resolvedPattern === path && !["layout", "nested-layout"].includes(route.kind));
}

function literalLinks(source) {
  return [...source.matchAll(/\bto="(\/[^"#?]*)"/g)].map((match) => match[1]);
}

const declarations = extractRouteDeclarations(app);
check(contract.baseline.routerSource === "src/App.tsx", "Contract must name src/App.tsx as executable router evidence.");
check(contract.baseline.routerDeclarationCount === declarations.length, `Baseline count ${contract.baseline.routerDeclarationCount} does not match ${declarations.length} router declarations.`);
check(contract.routes.length === declarations.length, `Contract has ${contract.routes.length} records for ${declarations.length} router declarations.`);

for (let index = 0; index < contract.routes.length; index += 1) {
  const route = contract.routes[index];
  const declaration = declarations[index];
  const expectedId = `RT-${String(index + 1).padStart(4, "0")}`;
  check(route.id === expectedId, `Route record ${index + 1} must have stable ID ${expectedId}, found ${route.id}.`);
  if (!declaration) continue;
  check(route.declaredPath === declaration.declaredPath, `${route.id} declaredPath does not match App.tsx (${JSON.stringify(route.declaredPath)} vs ${JSON.stringify(declaration.declaredPath)}).`);
  check(route.owner === declaration.owner, `${route.id} owner does not match App.tsx (${route.owner} vs ${declaration.owner}).`);
  check(declaration.index === ["index", "nested-index"].includes(route.kind), `${route.id} index classification does not match App.tsx.`);
  check(Object.hasOwn(contract.stateProfiles, route.stateProfile), `${route.id} references unknown state profile ${route.stateProfile}.`);
  check(Object.hasOwn(contract.accessProfiles, route.accessProfile), `${route.id} references unknown access profile ${route.accessProfile}.`);
  check(Object.hasOwn(contract.statusProfiles, route.statusProfile), `${route.id} references unknown status profile ${route.statusProfile}.`);
  check(Object.hasOwn(contract.zoneProfiles, route.zone), `${route.id} references unknown zone ${route.zone}.`);
  check(Array.isArray(route.reachability) && route.reachability.length > 0, `${route.id} must record current reachability.`);
  check(Array.isArray(route.smokePaths), `${route.id} must record smoke-test expectations.`);
  if (route.parentId) check(contract.routes.some((candidate) => candidate.id === route.parentId), `${route.id} references missing parent ${route.parentId}.`);
  if (route.kind === "layout") {
    check(route.resolvedPattern === null, `${route.id} pathless layout must not claim a destination pattern.`);
  } else if (route.kind === "index") {
    check(route.resolvedPattern === "/", `${route.id} root index must resolve to /.`);
  } else if (route.kind === "nested-index") {
    const parent = contract.routes.find((candidate) => candidate.id === route.parentId);
    check(route.resolvedPattern === parent?.resolvedPattern, `${route.id} nested index must resolve to its parent pattern.`);
  } else if (route.resolvedPattern !== "*") {
    const parent = contract.routes.find((candidate) => candidate.id === route.parentId);
    const parentPrefix = parent?.kind === "nested-layout" ? parent.resolvedPattern : "";
    const derivedPattern = `${parentPrefix}/${route.declaredPath}`.replace(/\/{2,}/g, "/");
    check(route.resolvedPattern === derivedPattern, `${route.id} resolved pattern ${route.resolvedPattern} is not derived from App.tsx declaration ${route.declaredPath} and parent ${route.parentId}.`);
  }
  if (route.resolvedPattern?.includes(":")) {
    check(Boolean(route.dynamicSource), `${route.id} is dynamic but has no valid-record source.`);
  }
  if (route.dynamicSource) {
    check(Object.hasOwn(contract.dynamicSources, route.dynamicSource), `${route.id} references unknown dynamic source ${route.dynamicSource}.`);
  }
  if (["redirect", "redirect-dynamic", "wildcard", "static-with-conditional-query-redirect"].includes(route.kind)) {
    check(Boolean(route.redirectTarget), `${route.id} must record a redirect target.`);
  }
}

const duplicatePatterns = new Map();
for (const route of contract.routes.filter((candidate) => candidate.resolvedPattern)) {
  const ids = duplicatePatterns.get(route.resolvedPattern) ?? [];
  ids.push(route.id);
  duplicatePatterns.set(route.resolvedPattern, ids);
}
const duplicates = [...duplicatePatterns.entries()].filter(([, ids]) => ids.length > 1);
arrayEqual(duplicates, [["/marketplace", ["RT-0004", "RT-0005"]]], "Intentional resolved-pattern duplicates");

for (const route of contract.routes) {
  if (!route.redirectTarget) continue;
  check(routeCanResolve(route.redirectTarget), `${route.id} redirect target ${route.redirectTarget} is not a canonical route pattern.`);
  const declaration = declarations[Number(route.id.slice(3)) - 1];
  const literalTarget = declaration?.tag.match(/\b(?:to|target)="([^"]+)"/)?.[1];
  if (!["LegacyAddonAlias", "CanonicalInboxEntry"].includes(route.owner)) {
    check(literalTarget === route.redirectTarget, `${route.id} redirect target does not match App.tsx (${route.redirectTarget} vs ${literalTarget ?? "missing"}).`);
  }
}

check(app.includes('return <Navigate to={`/marketplace/addons/${id ?? ""}`} replace />;'), "Legacy add-on alias implementation changed; review path-parameter compatibility.");
check(app.includes('return <Navigate to={`${target}${location.search}`} replace />;'), "Legacy search alias must preserve query only.");
check(app.includes("state={location.state}") && app.includes("search: location.search") && app.includes("hash: location.hash"), "Legacy communication aliases must preserve query, hash, and location state.");
check(app.includes('search.delete("conversation")') && app.includes('search.delete("view")'), "Canonical inbox query redirect must remove only conversation and view routing parameters.");
check(app.includes("pathname: `/commons-circle/signals/inbox/conversations/${conversationId}`"), "Canonical inbox query redirect target changed.");

const territoryBody = publicNavigation.match(/export const publicNavigationTerritories = \[([\s\S]*?)\n\] as const;/)?.[1] ?? "";
const territoryPaths = [...territoryBody.matchAll(/\bto:\s*"([^"]+)"/g)].map((match) => match[1]);
const contractedHeaderPaths = contract.currentNavigationBaselines.globalHeader.map(({ path }) => path);
arrayEqual([...new Set(["/", ...territoryPaths])].sort(), [...contractedHeaderPaths].sort(), "Preserved former top-level destinations");

for (const item of contract.currentNavigationBaselines.globalHeader) {
  const route = routeForExactPath(item.path);
  check(route?.id === item.routeId, `Preserved top-level destination ${item.path} does not reference its exact contract route ${item.routeId}.`);
  check(route?.accessProfile === "public-entry", `Top-level destination ${item.path} is not classified as a public entry.`);
  check(route?.reachability.includes("global-header"), `Top-level destination ${item.path} lacks historical global-header reachability evidence.`);
  check(!route?.reachability.includes("restricted"), `Restricted route ${item.path} appears in anonymous public navigation.`);
  check(!item.path.includes(":"), `Dynamic pattern ${item.path} must not appear in anonymous public navigation.`);
}

const expectedUtilities = contract.currentNavigationBaselines.headerUtilities.map(({ path }) => path);
arrayEqual(expectedUtilities, ["/", "/commons-circle"], "Header utility contract");
check(siteHeader.includes('className="site-brand" to="/"'), "Home/brand utility no longer targets /.");
check(!siteHeader.includes('to="/archive"') && !siteHeader.includes("Download Elysia"), "Unpublished download utility must stay hidden.");
check(accountButton.includes('to="/commons-circle"'), "Existing AccountButton no longer targets /commons-circle.");

arrayEqual(literalLinks(siteFooter), contract.currentNavigationBaselines.footer, "Footer route baseline");
arrayEqual([...new Set(literalLinks(homepage))].sort(), [...contract.currentNavigationBaselines.homepage].sort(), "Homepage route baseline");

const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/elysiaecobotics\.com([^<]*)<\/loc>/g)].map((match) => match[1] || "/");
arrayEqual(sitemapPaths, contract.sitemapBaseline, "Sitemap baseline");
for (const path of sitemapPaths) {
  check(routeCanResolve(path), `Sitemap path ${path} does not resolve through the contract.`);
  if (path.startsWith("/legal/") && path !== "/legal/") {
    check(legalPolicies.includes(`"route": "${path}"`) || legalPolicies.includes(`route: "${path}"`), `Sitemap legal path ${path} is absent from legalPolicyPages.`);
  }
}

const smokeBody = routeSmoke.match(/const requiredRoutes = \[([\s\S]*?)\n\];/)?.[1] ?? "";
const smokePaths = [...smokeBody.matchAll(/"(\/[^"\n]*)"/g)].map((match) => match[1]);
const requiredContractSmokePaths = [...new Set(contract.routes.flatMap((route) => route.smokePaths))];
for (const path of requiredContractSmokePaths) {
  check(smokePaths.includes(path), `Route smoke test is missing contract path ${path}.`);
}
for (const path of new Set(smokePaths)) {
  check(routeCanResolve(path), `Route smoke path ${path} does not resolve through the contract.`);
}
for (const knownOmission of [
  "/account/export",
  "/account/delete",
  "/commons-circle/admin/messaging-access",
  "/commons-circle/signals/inbox/settings"
]) {
  check(smokePaths.includes(knownOmission), `Known route-smoke omission remains: ${knownOmission}.`);
}

const approvedExternalUrls = [...siteUrls.matchAll(/export const ARTISAN_COLLECTIVE_(?:PAGES|CUSTOM_DOMAIN)_URL = "([^"]+)"/g)].map((match) => match[1]).sort();
arrayEqual(contract.externalDestinations.map(({ url }) => url).sort(), approvedExternalUrls, "Approved Artisan external destinations");
for (const external of contract.externalDestinations) {
  check(external.accessProfile === "external-approved-boundary", `${external.id} must use the external approved-boundary profile.`);
  check(external.zone === "orange-boundary", `${external.id} must remain an orange-zone boundary.`);
}

const prototypeMarkers = [
  "ian-wms.chatgpt.site",
  "elysia-navigation-prototype",
  "/codex-handoff",
  "/prototype"
];
for (const marker of prototypeMarkers) {
  check(!contractText.includes(marker), `Noncanonical prototype marker appears in the preservation contract: ${marker}`);
  check(!publicNavigation.includes(marker), `Noncanonical prototype marker appears in public navigation: ${marker}`);
  check(!siteNav.includes(marker), `Noncanonical prototype marker appears in the navigation shell: ${marker}`);
}

const applicationSources = await Promise.all([
  read("src/App.tsx"),
  read("src/main.tsx"),
  read("src/shared/components/SiteNav.tsx")
]);
check(applicationSources.every((source) => !source.includes("route-preservation-contract")), "The preservation contract must not become runtime route authority.");

if (errors.length) {
  console.error(`Route preservation contract failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

const uniqueSmokeCount = new Set(smokePaths).size;
const duplicateSmokeCount = smokePaths.length - uniqueSmokeCount;
console.log(
  `Route preservation contract ok (${contract.routes.length} router declarations, ${contract.externalDestinations.length} approved external boundaries, ${contract.currentNavigationBaselines.globalHeader.length} public header destinations, ${contract.sitemapBaseline.length} sitemap destinations, ${uniqueSmokeCount} unique smoke paths${duplicateSmokeCount ? `; ${duplicateSmokeCount} pre-existing duplicate smoke entry` : ""}).`
);

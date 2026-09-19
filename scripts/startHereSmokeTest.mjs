import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFile(path.join(root, relative), "utf8");

const [
  app,
  homepage,
  page,
  content,
  metadata,
  redirects,
  sitemap,
  publicNavigation,
  footer,
  styles,
  contractText,
  domainOwnershipText,
  releaseManifestText
] = await Promise.all([
  read("src/App.tsx"),
  read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx"),
  read("src/pages/Start-Here/index.tsx"),
  read("src/pages/Start-Here/startHereContent.ts"),
  read("src/shared/navigation/routeMetadata.ts"),
  read("public/_redirects"),
  read("public/sitemap.xml"),
  read("src/shared/navigation/publicNavigation.ts"),
  read("src/shared/components/SiteFooter.tsx"),
  read("src/styles.css"),
  read("docs/navigation/route-preservation-contract.json"),
  read("docs/architecture/domain-ownership-manifest.json"),
  read("src/pages/The-Elysia-Archive/releaseManifest.json")
]);

const contract = JSON.parse(contractText);
const domainOwnership = JSON.parse(domainOwnershipText);
const releaseManifest = JSON.parse(releaseManifestText);

assert(app.includes('const StartHerePage = lazy(() => import("./pages/Start-Here"))'), "Start Here is not lazy-loaded.");
assert(app.includes('path="start-here" element={<StartHerePage />}'), "Missing /start-here route.");

assert(
  homepage.includes('className="home-start-here"')
    && homepage.includes('to="/start-here"')
    && homepage.includes("New to Elysia?")
    && homepage.includes("Start Here →"),
  "Homepage Start Here doorway is missing or no longer separated from the ordinary CTA cluster."
);

assert(metadata.includes('"/start-here": "Start Here"'), "Start Here route title metadata is missing.");
assert(metadata.includes('"/start-here": "A plain-English guide'), "Start Here description metadata is missing.");

assert(redirects.includes("/start-here / 200"), "Cloudflare direct-load rewrite for /start-here is missing.");
assert.equal(
  (sitemap.match(/https:\/\/elysiaecobotics\.com\/start-here<\/loc>/g) ?? []).length,
  1,
  "Sitemap must contain exactly one canonical Start Here URL."
);

const startHereRoute = contract.routes.find((route) => route.resolvedPattern === "/start-here");
assert(startHereRoute, "Route preservation contract is missing /start-here.");
assert.equal(startHereRoute.id, "RT-0146");
assert.equal(startHereRoute.owner, "StartHerePage");
assert.equal(startHereRoute.accessProfile, "public-entry");
assert.equal(startHereRoute.zone, "lower-risk-presentation");
assert(startHereRoute.reachability.includes("homepage"));
assert(startHereRoute.reachability.includes("direct-load"));
assert(contract.currentNavigationBaselines.homepage.includes("/start-here"), "Homepage preservation baseline is missing /start-here.");
assert(contract.sitemapBaseline.includes("/start-here"), "Sitemap preservation baseline is missing /start-here.");

const publicShell = domainOwnership.domains.find((domain) => domain.domainId === "public-shell");
assert(publicShell?.routeSelectors?.exact?.includes("/start-here"), "Public-shell ownership is missing /start-here.");
assert(publicShell?.uiOwners?.includes("src/pages/Start-Here"), "Public-shell ownership is missing Start Here source ownership.");

assert(page.includes('brandMark="standard"'), "Start Here must use the standard Elysia Ecobotics page mark.");
assert(page.includes("releaseManifest.version"), "Start Here must read current release truth rather than hardcode a version.");
assert.equal(releaseManifest.version, "1.1.0", "Unexpected release manifest version at this qualified baseline.");

for (const phrase of [
  "The whole thing in 60 seconds",
  "How to use Elysia",
  "Where should I go on the website?",
  "Find your place",
  "The ecological side of Elysia",
  "How to know what is real right now",
  "Your local Elysia account and your Website Account are separate"
]) {
  assert(page.includes(phrase), `Start Here page is missing required orientation copy: ${phrase}`);
}

for (const mode of ["Default", "Tutor", "Researcher", "Writer", "Coder"]) {
  assert(content.includes(`title: "${mode}"`), `Start Here is missing Elysia mode: ${mode}`);
}

for (const room of [
  "Conversations",
  "Projects",
  "Artifacts",
  "Requests",
  "Codev",
  "Memory",
  "Personal Identity",
  "Governance",
  "Capabilities",
  "Add-ons",
  "Health"
]) {
  assert(content.includes(`name: "${room}"`), `Start Here is missing app room: ${room}`);
}

for (const domain of [
  "Verdante",
  "Sylphora",
  "Ecotiva",
  "Aurania",
  "Terraflux",
  "Aquaria",
  "Aetheria"
]) {
  assert(content.includes(`name: "${domain}"`), `Start Here is missing ecological domain: ${domain}`);
}

for (const route of [
  "/archive",
  "/living-library",
  "/developer-forge",
  "/artisan-collective",
  "/commune",
  "/commons-circle",
  "/marketplace",
  "/work-with-elysia-ecobotics",
  "/commune/rooms/job-post/posts"
]) {
  assert(content.includes(`to: "${route}"`) || page.includes(`to="${route}"`), `Start Here is missing canonical doorway: ${route}`);
}

const publicCopy = `${page}\n${content}`;
for (const jargon of [
  /\bFastAPI\b/,
  /\bRLS\b/,
  /\bRPC\b/,
  /\bXDG\b/,
  /\bSearXNG\b/,
  /\bSupabase\b/,
  /\bpolicy gate\b/i
]) {
  assert(!jargon.test(publicCopy), `Start Here leaked implementation jargon matching ${jargon}.`);
}

for (const fakeDomainRoute of [
  "/verdante",
  "/sylphora",
  "/ecotiva",
  "/aurania",
  "/terraflux",
  "/aquaria",
  "/aetheria"
]) {
  assert(!publicCopy.includes(`to: "${fakeDomainRoute}"`) && !publicCopy.includes(`to="${fakeDomainRoute}"`), `Start Here invented a non-existent domain route: ${fakeDomainRoute}`);
}

assert(
  !publicNavigation.includes('to: "/start-here"'),
  "Start Here must not silently expand the five-territory global navigation in this pass."
);
assert(
  !footer.includes('to="/start-here"'),
  "Start Here must not silently alter the footer in this pass."
);

assert(styles.includes(".home-start-here"), "Homepage Start Here doorway styling is missing.");
assert(styles.includes(".start-here-page"), "Start Here scoped styling is missing.");

console.log("Start Here orientation route, content, preservation, ownership, and plain-language contract ok.");

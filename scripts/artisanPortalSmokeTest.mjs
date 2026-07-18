import fs from "node:fs/promises";

async function read(file) {
  return fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const [
  app,
  nav,
  footer,
  portal,
  urls,
  metadata,
  portalDocument,
  viteConfig,
  redirects,
  routesText,
  sitemap,
  robots,
  headers,
  styles
] = await Promise.all([
  read("src/App.tsx"),
  read("src/shared/components/SiteNav.tsx"),
  read("src/shared/components/SiteFooter.tsx"),
  read("src/pages/Elysia-Artisan-Collective/index.tsx"),
  read("src/config/siteUrls.ts"),
  read("src/shared/components/PageMetadata.tsx"),
  read("artisan-collective.html"),
  read("vite.config.ts"),
  read("public/_redirects"),
  read("public/_routes.json"),
  read("public/sitemap.xml"),
  read("public/robots.txt"),
  read("public/_headers"),
  read("src/styles.css")
]);

assert(app.includes('import("./pages/Elysia-Artisan-Collective")'), "Artisan portal component is not lazy-loaded by the Online router.");
assert(app.includes('path="artisan-collective" element={<ElysiaArtisanCollectivePage />}'), "Missing /artisan-collective route.");

for (const source of [nav, footer]) {
  const commons = source.indexOf("Commons Circle");
  const artisan = source.indexOf("Artisan Collective");
  const story = source.indexOf("Story");
  assert(commons >= 0 && commons < artisan && artisan < story, "Artisan Collective must appear between Commons Circle and Story.");
}

assert(urls.includes('ARTISAN_COLLECTIVE_PAGES_URL = "https://elysiaartisancollective.pages.dev"'), "The current unhyphenated Pages destination is not centralized exactly.");
assert(urls.includes('ARTISAN_COLLECTIVE_CUSTOM_DOMAIN_URL = "https://artisans.elysiaecobotics.com"'), "The future Artisan custom domain is not centralized.");
assert(urls.includes("APPROVED_ARTISAN_COLLECTIVE_URLS.find"), "The environment override must fail closed to the approved Artisan destinations.");
assert(urls.includes("export function artisanProfileReportUrl"), "The canonical cross-origin public-profile report URL helper is missing.");
assert(urls.includes("encodeURIComponent(`@${normalizedHandle}`)"), "Public-profile report URLs must encode a canonical handle rather than expose a person UUID.");
assert(!portal.includes("elysiaartisancollective.pages.dev") && !portal.includes("artisans.elysiaecobotics.com"), "Portal components must consume centralized destinations rather than hardcoding them.");
assert(!urls.includes("https://elysia-artisan-collective.pages.dev"), "The superseded hyphenated Pages hostname must not return.");

for (const phrase of [
  "Enter the Artisan Collective",
  "existing Elysia Commons account",
  "Artists retain authorship",
  "no automatic AI-training rights",
  "Private local Elysia stays private",
  "does not receive private local Elysia memory"
]) assert(portal.includes(phrase), `Portal content is missing required boundary copy: ${phrase}`);
assert(portal.includes('href={ARTISAN_COLLECTIVE_URL}') && !portal.includes('target="_blank"'), "The portal CTA must use the centralized destination with normal same-tab navigation.");
assert(portal.includes('brandMark="standard"'), "The portal must retain the native Online page brand treatment.");

for (const marker of ["og:title", "og:description", "og:url", "twitter:card", 'link[rel="canonical"]']) {
  assert(metadata.includes(marker), `Route metadata helper is missing ${marker}.`);
}
assert(portalDocument.includes('<link rel="canonical" href="https://elysiaecobotics.com/artisan-collective"'), "Direct portal HTML is missing its exact canonical URL.");
assert(portalDocument.includes('property="og:url" content="https://elysiaecobotics.com/artisan-collective"'), "Direct portal HTML is missing its Open Graph URL.");
assert(portalDocument.includes('name="twitter:card" content="summary"'), "Direct portal HTML is missing Twitter card metadata.");
assert(viteConfig.includes('artisanCollective: new URL("./artisan-collective.html"'), "Vite must emit the direct portal metadata entry.");

assert(!redirects.includes("/artisan-collective "), "Pages serves artisan-collective.html at its clean URL automatically; an explicit rewrite would create a redirect loop.");
assert(redirects.includes("/* /index.html 200"), "The existing SPA fallback must remain available for all other client routes.");

const sitemapCommons = sitemap.indexOf("https://elysiaecobotics.com/commons-circle</loc>");
const sitemapArtisan = sitemap.indexOf("https://elysiaecobotics.com/artisan-collective</loc>");
const sitemapStory = sitemap.indexOf("https://elysiaecobotics.com/story</loc>");
assert(sitemapCommons >= 0 && sitemapCommons < sitemapArtisan && sitemapArtisan < sitemapStory, "Sitemap ordering must place Artisan between Commons Circle and Story.");
assert(robots.includes("Sitemap: https://elysiaecobotics.com/sitemap.xml"), "robots.txt must advertise the canonical sitemap.");

for (const directive of [
  "Content-Security-Policy:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: no-referrer",
  "Permissions-Policy:",
  "Strict-Transport-Security:"
]) assert(headers.includes(directive), `Static Pages headers are missing ${directive}`);

const routes = JSON.parse(routesText);
assert(
  routes.include.length === 4
    && routes.include[0] === "/api/sandbox/*"
    && routes.include[1] === "/api/identity/*"
    && routes.include[2] === "/api/public/profile-avatars/*"
    && routes.include[3] === "/api/public/profile-banners/*",
  "Pages Function invocation must remain limited to the governed sandbox, private identity proxy, and safe public-profile derivative proxies."
);
assert(routes.exclude.includes("/api/sandbox/_shared/*"), "Pages Function source internals must remain excluded.");

assert(styles.includes(".artisan-portal-page .page-hero-block"), "Native portal styling is missing.");
assert(styles.includes("@media (prefers-reduced-motion: reduce)") && styles.includes(".artisan-portal-page *"), "Portal styling must respect reduced-motion preferences.");

console.log("Artisan portal route, content, metadata, and security contract ok.");

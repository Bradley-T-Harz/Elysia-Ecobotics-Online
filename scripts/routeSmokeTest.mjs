const requiredRoutes = [
  "/", "/archive", "/marketplace", "/marketplace/browse", "/marketplace/addons/:id",
  "/marketplace/action-preview", "/marketplace/account", "/marketplace/submit", "/marketplace/trust",
  "/marketplace/manifest-api", "/marketplace/admin", "/products", "/lab", "/developer-forge",
  "/living-library", "/commune", "/work-with-elysia-ecobotics", "/commons-circle",
  "/commons-circle/onboarding", "/story",
  "/about", "/mission", "/legal", "/legal/privacy-policy", "/legal/terms-of-use",
  "/legal/community-guidelines", "/legal/marketplace-developer-agreement",
  "/legal/add-on-submission-policy", "/legal/security-review-policy",
  "/legal/vulnerability-disclosure-policy", "/legal/dmca-copyright-policy",
  "/legal/acceptable-use-policy", "/legal/code-of-conduct",
  "/legal/volunteer-contributor-disclaimer", "/legal/donation-recognition-terms",
  "/legal/trademark-notice", "/browse", "/addons/:id", "/action-preview", "/account", "/submit",
  "/trust", "/manifest-api", "/admin"
];
const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8"));
const missing = requiredRoutes.filter((route) => {
  if (route === "/") return !app.includes("<Route index");
  const path = route.replace(/^\//, "");
  const nestedPath = path.replace(/^marketplace\//, "");
  const legalPolicyRoute = path.startsWith("legal/") && app.includes(`path=\"legal/:slug\"`);
  return !(legalPolicyRoute || app.includes(`path=\"${path}\"`) || app.includes(`path=\"${nestedPath}\"`) || app.includes(`to=\"${route}\"`) || app.includes(`target=\"${route}\"`));
});
if (missing.length) {
  console.error(`Missing route wiring: ${missing.join(", ")}`);
  process.exit(1);
}
const redirects = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/_redirects", import.meta.url), "utf8"));
if (!redirects.includes("/* /index.html 200")) {
  console.error("Missing Cloudflare Pages SPA redirect.");
  process.exit(1);
}

const fs = await import("node:fs/promises");
async function readSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return readSourceFiles(child);
    if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) return [child];
    return [];
  }));
  return files.flat();
}
const canonicalScanRoots = [
  new URL("../src/pages/The-Elysia-Marketplace/", import.meta.url),
  new URL("../src/shared/", import.meta.url),
  new URL("../src/layouts/", import.meta.url)
];
const staleMarketplaceLinkPatterns = [
  'to="/browse"', 'to="/addons/', 'to="/action-preview"', 'to="/account"',
  'to="/submit"', 'to="/trust"', 'to="/manifest-api"', 'to="/admin"'
];
const staleHits = [];
for (const root of canonicalScanRoots) {
  for (const sourceFile of await readSourceFiles(root)) {
    const text = await fs.readFile(sourceFile, "utf8");
    for (const pattern of staleMarketplaceLinkPatterns) {
      if (text.includes(pattern)) staleHits.push(`${sourceFile.pathname}: ${pattern}`);
    }
  }
}
if (staleHits.length) {
  console.error(`Noncanonical Marketplace links found:\n${staleHits.join("\n")}`);
  process.exit(1);
}
console.log(`Route contract ok (${requiredRoutes.length} routes/aliases).`);

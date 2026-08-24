import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { build } from "esbuild";

const repositoryRoot = new URL("../", import.meta.url).pathname;
const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), "utf8");
const asset = await fs.readFile(new URL("../public/images/home/flower-of-life-pattern.png", import.meta.url));
assert.equal(createHash("sha256").update(asset).digest("hex"), "a787f33e58163dbb02447e4ebad5c4c711fbcbed23b70ca0228bb382e5cb8bc2", "Flower asset bytes changed");

const bundled = await build({
  stdin: {
    contents: 'export { legalPolicyGroups, legalPolicyMetadata, legalPolicyPages } from "./src/pages/Legal/legalPolicyPages.ts";',
    resolveDir: repositoryRoot,
    sourcefile: "third-party-media-credits-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const model = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const slug = "third-party-media-credits";
const route = `/legal/${slug}`;
const policy = model.legalPolicyPages.find((entry) => entry.slug === slug);
assert.ok(policy, "Third-party media credits policy is missing");
assert.equal(policy.route, route);
assert.equal(model.legalPolicyMetadata[slug]?.category, "Stewardship and Brand");
assert.ok(model.legalPolicyGroups.some((group) => group.slugs.includes(slug)), "Media credits policy is not grouped in Legal");

for (const expected of [
  "Flower Of Life Pattern Animated Symbol Of Sacred Geometry",
  "Contributor / public artist identity:** U8",
  "Pond5, Item 168538192",
  "https://www.pond5.com/stock-footage/item/168538192-flower-life-pattern-animated-symbol-sacred-geometry",
  "LICENSE / STILL-IMAGE PERMISSION EVIDENCE PENDING BRADLEY",
  "Credit and provenance do not themselves grant permission or a license",
  "does not state or imply that the Website use is already licensed, authorized, purchased, royalty-free, or otherwise cleared",
]) assert.ok(policy.body.includes(expected), `Media credits policy is missing: ${expected}`);

const [legalIndex, home, licensing, rootNotices, publicNotices, thirdPartyNotices, sitemap, routeSmoke, preservation] = await Promise.all([
  read("src/pages/Legal/index.tsx"),
  read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx"),
  read("LICENSING.md"),
  read("ASSET_NOTICES.md"),
  read("public/legal/ASSET_NOTICES.md"),
  read("public/legal/THIRD_PARTY_NOTICES.txt"),
  read("public/sitemap.xml"),
  read("scripts/routeSmokeTest.mjs"),
  read("docs/navigation/route-preservation-contract.json"),
]);
assert.ok(legalIndex.includes(`to="${route}"`), "Media credits route is not linked from Legal quick links");
assert.ok(home.includes("/legal/third-party-media-credits") && home.includes("/legal/ASSET_NOTICES.md"), "Homepage source lacks a durable provenance pointer");
assert.ok(!home.includes(">U8<") && !home.includes(">Pond5<"), "Homepage gained a visible stock-media credit");
for (const notice of [rootNotices, publicNotices, thirdPartyNotices]) {
  assert.ok(notice.includes("U8") && notice.includes("168538192"), "A required notice location lacks the source credit");
  assert.ok(/pending/i.test(notice) && /does not (?:state or imply|substitute)/i.test(notice), "A notice does not preserve the pending-license boundary");
}
assert.ok(licensing.includes("ASSET_NOTICES.md") && licensing.includes(route), "Licensing policy does not point to the media record");
assert.ok(sitemap.includes(`<loc>https://elysiaecobotics.com${route}</loc>`), "Media credits route is absent from sitemap");
assert.ok(routeSmoke.includes(`"${route}"`), "Media credits route is absent from route smoke coverage");
assert.ok(preservation.includes(`"${route}"`), "Media credits route is absent from the preservation contract");

console.log("Third-party media credits mitigation verified without changing Flower asset bytes.");

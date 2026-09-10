import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";

const repositoryRoot = new URL("../", import.meta.url).pathname;
const bundled = await build({
  stdin: {
    contents: [
      'export { legalPolicyGroups, legalPolicyMetadata, legalPolicyPages } from "./src/pages/Legal/legalPolicyPages.ts";',
      'export { activeLivingLibrarySources, allLivingLibrarySources } from "./src/pages/The-Living-Library/livingLibraryCatalog.ts";',
    ].join("\n"),
    resolveDir: repositoryRoot,
    sourcefile: "living-library-legal-hardening-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const moduleSource = bundled.outputFiles[0].text;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
const {
  activeLivingLibrarySources,
  allLivingLibrarySources,
  legalPolicyGroups,
  legalPolicyMetadata,
  legalPolicyPages,
} = catalog;

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [legalIndex, sourceDetail, styles, sitemap, routeSmoke, preservationContract] = await Promise.all([
  read("src/pages/Legal/index.tsx"),
  read("src/pages/The-Living-Library/LivingLibrarySourceDetail.tsx"),
  read("src/styles.css"),
  read("public/sitemap.xml"),
  read("scripts/routeSmokeTest.mjs"),
  read("docs/navigation/route-preservation-contract.json"),
]);

const policySlug = "living-library-third-party-resources";
const policyRoute = `/legal/${policySlug}`;
const policy = legalPolicyPages.find((entry) => entry.slug === policySlug);
const group = legalPolicyGroups.find((entry) => entry.category === "Research, Reference, and External Resources");
const groupedSlugs = legalPolicyGroups.flatMap((entry) => entry.slugs);

assert.equal(legalPolicyPages.length, 23, "Only current public policy cards belong in the Legal model; /legal/legal is a compatibility redirect.");
assert.equal(legalPolicyGroups.length, 8, "the new research/external-resources section must be a top-level Legal group");
assert.equal(groupedSlugs.length, 23, "every public policy card must be represented exactly once in Legal grouping");
assert.equal(new Set(groupedSlugs).size, groupedSlugs.length, "Legal groups must not duplicate policy cards");
assert.deepEqual(group?.slugs, [policySlug], "the new Legal section must contain the focused Living Library policy only");
assert.ok(group?.description.includes("Independent resource listings"), "the new Legal section needs a clear scope description");
assert.ok(groupedSlugs.every((slug) => legalPolicyPages.some((entry) => entry.slug === slug)), "every grouped policy must resolve");
assert.equal(new Set(legalPolicyPages.map((entry) => entry.slug)).size, legalPolicyPages.length, "Legal policy slugs must remain unique");
assert.equal(new Set(legalPolicyPages.map((entry) => entry.route)).size, legalPolicyPages.length, "Legal policy routes must remain unique");

assert.ok(policy, "Living Library third-party policy is missing");
assert.equal(policy.route, policyRoute);
assert.equal(policy.title, "Living Library & Third-Party Resources");
assert.equal(policy.status, "Public operating policy");
assert.equal(policy.lastUpdated, "2026-08-07");
assert.equal(legalPolicyMetadata[policySlug]?.category, "Research, Reference, and External Resources");
for (const requiredMeaning of [
  "independently curated discovery index and gateway",
  "does not imply affiliation, sponsorship, endorsement, partnership, or approval",
  "Names, trademarks, service marks, and other identifiers remain the property of their respective owners",
  "independent editorial summaries",
  "does not control third-party sites",
  "links to third-party material rather than reproducing, mirroring, or redistributing it",
  "Citations and attribution support responsible scholarship, but they do not by themselves grant permission",
  "None automatically establishes peer review, an open license, public-domain status, redistribution rights",
  "inaccurate description, broken link, rights concern, attribution issue, or removal request",
  "does not excuse infringement, deception, or other unlawful conduct",
]) assert.ok(policy.body.includes(requiredMeaning), `policy is missing required meaning: ${requiredMeaning}`);

assert.ok(legalIndex.includes(`to="${policyRoute}"`), "Legal quick links must include the Living Library resource policy");
assert.ok(legalIndex.includes("group.slugs.length"), "Legal category counts must remain derived from the grouped policy model");
assert.ok(sitemap.includes(`<loc>https://elysiaecobotics.com${policyRoute}</loc>`), "the dedicated policy route must be in the public sitemap");
assert.ok(routeSmoke.includes(`"${policyRoute}"`), "the dedicated policy route must be in route smoke coverage");
assert.ok(preservationContract.includes(`"${policyRoute}"`), "the dedicated policy route must remain in the preservation contract");

assert.match(sourceDetail, /function IndependentListingNotice\(\)/, "the source-detail independence language must be a reusable component");
assert.equal((sourceDetail.match(/<IndependentListingNotice \/>/g) ?? []).length, 1, "the reusable notice should be rendered once per source detail");
for (const requiredMeaning of [
  "Independent listing.",
  "This third-party resource is operated by the organization identified above.",
  "does not imply affiliation, sponsorship, endorsement, or partnership",
  "Elysia Ecobotics or EcoSyneva Commons LLC",
]) assert.ok(sourceDetail.includes(requiredMeaning), `source-detail notice is missing required meaning: ${requiredMeaning}`);
const noticeRule = styles.match(/\.library-independence-note\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert.ok(noticeRule.includes("font-size: 0.86rem") && noticeRule.includes("border-top:") && !noticeRule.includes("background:"), "the independence notice must remain visually subdued rather than becoming a warning banner");

const livingLibraryPresentation = await Promise.all([
  "src/pages/The-Living-Library/index.tsx",
  "src/pages/The-Living-Library/LivingLibrarySourceCard.tsx",
  "src/pages/The-Living-Library/LivingLibrarySourceDetail.tsx",
].map(read));
const combinedPresentation = livingLibraryPresentation.join("\n");
assert.doesNotMatch(combinedPresentation, /<(?:img|picture|svg)\b/i, "Living Library presentation should keep third-party resources as plain-text listings without copied brand assets");
assert.match(combinedPresentation, /external site, opens in a new tab/, "external-link boundary labels must remain intact");
assert.match(sourceDetail, /Rights are record-specific/, "record-specific rights language must remain intact");

assert.equal(activeLivingLibrarySources.length, 200, "legal hardening must preserve exactly 200 active resources");
assert.equal(allLivingLibrarySources.length, 232, "legal hardening must preserve all active and compatibility records");
assert.equal(new Set(allLivingLibrarySources.map((source) => source.id)).size, 232, "all Living Library IDs must remain unique");

console.log(`Living Library legal hardening tests passed: ${legalPolicyGroups.length} Legal groups, ${groupedSlugs.length} policy cards, ${activeLivingLibrarySources.length} active resources.`);

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [model, contractText] = await Promise.all([
  read("src/shared/navigation/publicNavigation.ts"),
  read("docs/navigation/route-preservation-contract.json")
]);
const contract = JSON.parse(contractText);

const expectedTerritories = ["Explore", "Build", "Community", "About & Trust"];
const expectedDestinations = [
  ["Marketplace", "/marketplace"],
  ["Living Library", "/living-library"],
  ["Developer Forge", "/developer-forge"],
  ["Work With Elysia Ecobotics", "/work-with-elysia-ecobotics"],
  ["Commons Circle", "/commons-circle"],
  ["Artisan Collective", "/artisan-collective"],
  ["Story", "/story"],
  ["About", "/about"],
  ["Mission", "/mission"],
  ["Support", "/support"],
  ["Legal", "/legal"]
];
const expectedUtilities = [
  ["Home", "/"],
  ["Account / Sign In", "/commons-circle"]
];

let cursor = -1;
for (const territory of expectedTerritories) {
  const next = model.indexOf(`label: "${territory}"`, cursor + 1);
  assert(next > cursor, `Territory missing or out of order: ${territory}`);
  cursor = next;
}

for (const [label, path] of [...expectedUtilities, ...expectedDestinations]) {
  assert(model.includes(`label: "${label}"`), `Missing public-navigation label: ${label}`);
  assert(model.includes(`to: "${path}"`), `Missing public-navigation target: ${path}`);
}

const destinationPaths = expectedDestinations.map(([, path]) => path);
const preservedTopLevelPaths = contract.currentNavigationBaselines.globalHeader.map(({ path }) => path);
for (const path of destinationPaths) assert(preservedTopLevelPaths.includes(path), `Released navigation target is absent from the preserved baseline: ${path}`);

for (const path of destinationPaths) {
  const route = contract.routes.find((candidate) => candidate.resolvedPattern === path && !["layout", "nested-layout"].includes(candidate.kind));
  assert(route, `Navigation target is absent from the preservation contract: ${path}`);
  assert.equal(route.accessProfile, "public-entry", `Navigation target is not a public entry: ${path}`);
  assert(!route.reachability.includes("restricted"), `Restricted route entered the public model: ${path}`);
}

assert(model.includes('bridge: "separate-elysia-portal"'), "Artisan Collective must be identified as a separate Elysia portal.");
assert(model.includes('to: "/artisan-collective"'), "Artisan Collective must link first to the canonical Online bridge.");

for (const forbidden of [
  "/admin",
  "/commons-circle/signals",
  "/commons-circle/support-billing",
  "/marketplace/admin",
  "/developer-forge/drafts",
  "/commune/moderation",
  "ian-wms.chatgpt.site",
  "elysia-navigation-prototype",
  "/prototype",
  "/codex-handoff"
]) {
  assert(!model.includes(forbidden), `Forbidden public-navigation value found: ${forbidden}`);
}

assert(!/status\s*:|badge\s*:|role\s*:|capabilit(?:y|ies)\s*:/i.test(model), "The public model must not encode status, badge, role, or capability authority.");
for (const hiddenReleasePath of ["/archive", "/products", "/lab", "/commune"]) assert(!model.includes(`to: "${hiddenReleasePath}"`), `Unproven release surface remains in public navigation: ${hiddenReleasePath}`);
assert.equal(expectedDestinations.length, 11, "The four released territories must expose exactly eleven working public destinations.");

console.log("Public navigation model ok (4 territories, 2 utilities, 11 released destinations; unproven release surfaces hidden).");

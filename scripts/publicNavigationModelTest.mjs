import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [model, contractText] = await Promise.all([
  read("src/shared/navigation/publicNavigation.ts"),
  read("docs/navigation/route-preservation-contract.json")
]);
const contract = JSON.parse(contractText);

const expectedTerritories = ["Get Elysia", "Explore", "Build", "Community", "About & Trust"];
const expectedDestinations = [
  ["Archive & Release Status", "/archive"],
  ["Marketplace", "/marketplace"],
  ["Products", "/products"],
  ["Living Library", "/living-library"],
  ["Developer Forge", "/developer-forge"],
  ["Lab", "/lab"],
  ["Commune", "/commune"],
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
  ["Download", "/archive"],
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
assert.deepEqual([...new Set(["/", ...destinationPaths])].sort(), [...preservedTopLevelPaths].sort(), "The model must preserve all sixteen former top-level destinations through Home or a territory.");

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
assert.equal(expectedDestinations.length, 15, "The five territories must expose exactly fifteen destinations; Home supplies the sixteenth former top-level route.");

console.log("Public navigation model ok (5 territories, 3 utilities, 15 territory destinations, 16 preserved former top-level routes).");

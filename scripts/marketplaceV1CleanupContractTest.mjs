import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildCleanupPlan, parseCleanupPlanArguments } from "./marketplaceV1CleanupPlan.mjs";

const targets = [
  ["00000000-0000-4000-8000-000000000001", "advanced-pdf-parser", "Advanced PDF Parser"],
  ["00000000-0000-4000-8000-000000000002", "ollama-local-models", "Ollama Local Models"],
  ["00000000-0000-4000-8000-000000000003", "searxng-research", "SearXNG Research"]
];
const inventory = {
  inventory_contract: "marketplace-v1-legacy-listing-read-only-1",
  mutation_eligible: true,
  marketplace_listings: targets.map(([id, slug, name]) => ({ id, slug, name, listing_status: "published" })),
  legacy_addons: targets.map(([id, slug, name], index) => ({ id: id.replace(/.$/, String(index + 4)), slug, name, status: "approved", trust_tier: "reviewed" }))
};
const source = JSON.stringify(inventory);
const plan = buildCleanupPlan(inventory, source);
assert.equal(plan.executes_database_changes, false);
assert.equal(plan.apply_authorized, false);
assert.equal(plan.marketplace_listings.length, 3);
assert(plan.marketplace_listings.every((row) => row.proposed_listing_status === "revoked"));
assert(plan.legacy_addons.every((row) => row.proposed_status === "deprecated" && row.proposed_trust_tier === "deprecated"));
assert.throws(() => buildCleanupPlan({ ...inventory, mutation_eligible: false }, source), /ambiguous/);
assert.throws(() => buildCleanupPlan({ ...inventory, marketplace_listings: [{ id: "x", slug: "unrelated", name: "Unrelated" }] }, source), /does not exactly match/);
assert.throws(() => parseCleanupPlanArguments(["--apply"]), /Unknown argument/);
assert.throws(() => parseCleanupPlanArguments(["--inventory", path.resolve("inventory.json"), "--output", path.resolve("plan.json")]), /outside the repository/);

const [inventoryScript, inventorySql, seedSql, policiesSql, publicationBoundaryMigration] = await Promise.all([
  fs.readFile("scripts/marketplaceV1LegacyInventory.mjs", "utf8"),
  fs.readFile("scripts/sql/marketplace_v1_legacy_listing_inventory.sql", "utf8"),
  fs.readFile("supabase/seed.sql", "utf8"),
  fs.readFile("supabase/policies.sql", "utf8"),
  fs.readFile("supabase/migrations/20260818010000_legacy_marketplace_publication_boundary.sql", "utf8")
]);
assert.match(inventorySql, /begin transaction read only;/i);
assert.match(inventorySql, /rollback;/i);
assert(!/\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke)\b\s+(?:table|into|from|on|schema|function|policy|role)/i.test(inventorySql));
for (const name of ["Advanced PDF Parser", "Ollama Local Models", "SearXNG Research"]) assert(inventorySql.includes(name));
for (const staleSeed of ["advanced-pdf-parser", "ollama-local-models", "searxng-research"]) {
  assert(!seedSql.includes(staleSeed), `Public seed still creates stale pseudo-add-on ${staleSeed}`);
}
for (const policySource of [policiesSql, publicationBoundaryMigration]) {
  assert.match(policySource, /status\s*=\s*'approved'/i);
  assert(!/status\s+in\s*\([^)]*'deprecated'/i.test(policySource), "Deprecated legacy add-ons must not remain public-readable");
}
assert(inventoryScript.includes('mode: 0o600') && inventoryScript.includes('flag: "wx"'));
assert(inventoryScript.includes("PGHOST: parsed.hostname") && inventoryScript.includes("PGPASSWORD: decodeURIComponent(parsed.password)"));
assert(!inventoryScript.includes('"--dbname", databaseUrl') && !inventoryScript.includes("PGDATABASE: databaseUrl"));
assert(!inventoryScript.includes("console.log(configured)"));

console.log("Marketplace v1 read-only inventory and reversible cleanup-plan contract passed.");

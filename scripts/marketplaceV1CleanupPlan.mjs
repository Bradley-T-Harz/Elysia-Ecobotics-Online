#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = new Map([
  ["advanced-pdf-parser", "Advanced PDF Parser"],
  ["ollama-local-models", "Ollama Local Models"],
  ["searxng-research", "SearXNG Research"]
]);

export function parseCleanupPlanArguments(argv) {
  const options = { inventory: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--inventory") options.inventory = path.resolve(argv[++index] ?? "");
    else if (argv[index] === "--output") options.output = path.resolve(argv[++index] ?? "");
    else if (["--help", "-h"].includes(argv[index])) {
      console.log("Usage: node scripts/marketplaceV1CleanupPlan.mjs --inventory /private/inventory.json --output /private/cleanup-plan.json\nThis command never connects to or mutates a database.");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!options.inventory || !options.output) throw new Error("--inventory and --output are required");
  for (const file of [options.inventory, options.output]) {
    const relative = path.relative(root, file);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error("Inventory and plan files must remain outside the repository");
  }
  return options;
}

function validatedRows(rows, table) {
  if (!Array.isArray(rows)) throw new Error(`${table} inventory must be an array`);
  const seen = new Set();
  return rows.map((row) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || typeof row.slug !== "string" || typeof row.name !== "string") throw new Error(`${table} inventory row is incomplete`);
    const expected = targets.get(row.slug.toLowerCase());
    if (!expected || expected.toLowerCase() !== row.name.toLowerCase()) throw new Error(`${table} row does not exactly match an approved stale target`);
    if (seen.has(row.id)) throw new Error(`${table} inventory contains a duplicate ID`);
    seen.add(row.id);
    return row;
  });
}

export function buildCleanupPlan(inventory, source) {
  if (inventory.inventory_contract !== "marketplace-v1-legacy-listing-read-only-1") throw new Error("Unsupported Marketplace inventory contract");
  if (inventory.mutation_eligible !== true) throw new Error("Inventory is ambiguous; cleanup planning refused");
  const listings = validatedRows(inventory.marketplace_listings, "marketplace_listings");
  const legacy = validatedRows(inventory.legacy_addons, "addons");
  return {
    plan_contract: "marketplace-v1-reversible-cleanup-dry-run-1",
    generated_at: new Date().toISOString(),
    inventory_sha256: createHash("sha256").update(source).digest("hex"),
    apply_authorized: false,
    executes_database_changes: false,
    marketplace_listings: listings.map((row) => ({ id: row.id, slug: row.slug, name: row.name, expected_listing_status: row.listing_status, proposed_listing_status: "revoked", preserve_original_in_inventory: true, reason: "Retired from public v1 catalog; not a reviewed installable add-on." })),
    legacy_addons: legacy.map((row) => ({ id: row.id, slug: row.slug, name: row.name, expected_status: row.status, expected_trust_tier: row.trust_tier, proposed_status: "deprecated", proposed_trust_tier: "deprecated", preserve_original_in_inventory: true })),
    operator_gate: "A Marketplace administrator must compare exact IDs and current values immediately before a separately approved reversible mutation."
  };
}

async function main() {
  const options = parseCleanupPlanArguments(process.argv.slice(2));
  const source = await fs.readFile(options.inventory, "utf8");
  const plan = buildCleanupPlan(JSON.parse(source), source);
  await fs.writeFile(options.output, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log(`Non-mutating cleanup plan written privately to ${options.output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Marketplace cleanup planning failed");
    process.exitCode = 1;
  });
}

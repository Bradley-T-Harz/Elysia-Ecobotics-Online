#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(root, "scripts", "sql", "marketplace_v1_legacy_listing_inventory.sql");
const usage = `Usage:
  node scripts/marketplaceV1LegacyInventory.mjs --print-sql
  SUPABASE_READONLY_DATABASE_URL=postgresql://... node scripts/marketplaceV1LegacyInventory.mjs --execute --output /private/path/marketplace-v1-inventory.json

Execution requires a dedicated read-only PostgreSQL role. Output is operationally sensitive,
must be outside the repository, is created mode 0600, and is never printed by this command.`;

function parseArguments(argv) {
  const options = { execute: false, printSql: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--print-sql") options.printSql = true;
    else if (argument === "--output") {
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error("--output requires a path");
      options.output = path.resolve(argv[index + 1]);
      index += 1;
    } else if (["--help", "-h"].includes(argument)) { console.log(usage); process.exit(0); }
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.execute === options.printSql) throw new Error("Choose exactly one of --execute or --print-sql");
  if (options.execute && !options.output) throw new Error("--execute requires --output");
  return options;
}

function assertPrivateOutput(output) {
  const relative = path.relative(root, output);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error("Inventory output must be outside the repository");
}

async function runPsql(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const connectionEnvironment = {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGSSLMODE: parsed.searchParams.get("sslmode") || "require"
  };
  return await new Promise((resolve, reject) => {
    const child = spawn("psql", ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--file", sqlPath], {
      shell: false,
      cwd: root,
      env: { PATH: process.env.PATH, ...connectionEnvironment, PGCONNECT_TIMEOUT: "8", PSQL_PAGER: "off" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`Read-only Marketplace inventory failed with psql exit code ${code}: ${stderr.trim() || "no diagnostic"}`)));
  });
}

try {
  const options = parseArguments(process.argv.slice(2));
  const sql = await fs.readFile(sqlPath, "utf8");
  if (options.printSql) process.stdout.write(sql);
  else {
    assertPrivateOutput(options.output);
    const configured = process.env.SUPABASE_READONLY_DATABASE_URL;
    if (!configured) throw new Error("SUPABASE_READONLY_DATABASE_URL is required for --execute");
    let parsed;
    try { parsed = new URL(configured); } catch { throw new Error("SUPABASE_READONLY_DATABASE_URL is not a valid URL"); }
    if (!["postgresql:", "postgres:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username) throw new Error("SUPABASE_READONLY_DATABASE_URL must be a complete PostgreSQL URL");
    const output = await runPsql(configured);
    JSON.parse(output);
    await fs.writeFile(options.output, `${output}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(`Read-only Marketplace inventory written privately to ${options.output}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Read-only Marketplace inventory failed");
  process.exitCode = 1;
}

#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(root, "scripts", "sql", "supabase_read_only_inventory.sql");
const usage = `Usage:
  node scripts/supabaseReadOnlyInventory.mjs --print-sql
  SUPABASE_READONLY_DATABASE_URL=postgresql://... node scripts/supabaseReadOnlyInventory.mjs --execute [--output /secure/path/inventory.json]

The execution path opens a READ ONLY transaction, never prints the connection URL, and refuses
non-PostgreSQL URLs. Inventory output is operationally sensitive even though secret values and
function bodies are intentionally omitted.`;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function parseArguments(argv) {
  const result = { execute: false, printSql: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") result.execute = true;
    else if (argument === "--print-sql") result.printSql = true;
    else if (argument === "--output") {
      const output = argv[index + 1];
      if (!output || output.startsWith("--")) throw new Error("--output requires a path");
      result.output = path.resolve(output);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.execute === result.printSql) throw new Error("Choose exactly one of --execute or --print-sql");
  if (result.output && !result.execute) throw new Error("--output is available only with --execute");
  return result;
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
      env: {
        PATH: process.env.PATH,
        ...connectionEnvironment,
        PGCONNECT_TIMEOUT: "8",
        PSQL_PAGER: "off"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Read-only inventory failed with psql exit code ${code}: ${stderr.trim() || "no diagnostic"}`));
    });
  });
}

try {
  const options = parseArguments(process.argv.slice(2));
  const sql = await fs.readFile(sqlPath, "utf8");
  if (options.printSql) {
    process.stdout.write(sql);
  } else {
    const configured = process.env.SUPABASE_READONLY_DATABASE_URL;
    if (!configured) throw new Error("SUPABASE_READONLY_DATABASE_URL is required for --execute");
    let parsed;
    try { parsed = new URL(configured); }
    catch { throw new Error("SUPABASE_READONLY_DATABASE_URL is not a valid URL"); }
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error("SUPABASE_READONLY_DATABASE_URL must use postgresql:// or postgres://");
    }
    if (!parsed.hostname || !parsed.username) throw new Error("The read-only database URL is incomplete");
    const output = await runPsql(configured);
    JSON.parse(output);
    if (options.output) {
      await fs.writeFile(options.output, `${output}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      console.log(`Read-only inventory written with mode 0600 to ${options.output}`);
    } else {
      process.stdout.write(`${output}\n`);
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "Read-only inventory failed");
}

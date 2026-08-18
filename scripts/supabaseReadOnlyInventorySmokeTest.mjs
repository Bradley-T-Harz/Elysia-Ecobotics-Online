import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [script, sql] = await Promise.all([
  fs.readFile("scripts/supabaseReadOnlyInventory.mjs", "utf8"),
  fs.readFile("scripts/sql/supabase_read_only_inventory.sql", "utf8")
]);

assert(script.includes("SUPABASE_READONLY_DATABASE_URL"), "Inventory must require a narrowly named read-only URL.");
assert(script.includes("PGHOST: parsed.hostname") && script.includes("PGPASSWORD: decodeURIComponent(parsed.password)"), "Inventory must parse the connection URL into bounded libpq environment fields.");
assert(!script.includes('"--dbname", databaseUrl') && !script.includes("PGDATABASE: databaseUrl"), "Inventory must not expose or misuse the full connection URL in psql arguments or PGDATABASE.");
assert(script.includes('flag: "wx"') && script.includes("mode: 0o600"), "Inventory output must be exclusive and private.");
assert(!script.includes("console.log(configured)"), "Inventory tooling must never print the connection URL.");
assert(/begin transaction read only;/i.test(sql), "Inventory SQL must start a read-only transaction.");
assert(/rollback;/i.test(sql), "Inventory SQL must explicitly roll back.");
assert(!/\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke)\b\s+(?:table|into|from|on|schema|function|policy|role)/i.test(sql), "Inventory SQL contains a mutation statement.");
for (const required of [
  "pg_policies",
  "role_table_grants",
  "role_column_grants",
  "role_routine_grants",
  "pg_trigger",
  "schema_migrations",
  "storage.buckets",
  "definition_sha256",
  "auth_user_foreign_keys",
  "auth_user_triggers",
  "storage_object_ownership_columns",
]) {
  assert(sql.includes(required), `Inventory SQL omits ${required}.`);
}
assert(
  sql.includes("'public', 'private', 'artisan', 'storage'"),
  "Inventory SQL must cover the complete Online and Artisan application schema set."
);
assert(!sql.includes("pg_get_functiondef(p.oid) as definition"), "Raw function bodies must not be emitted by default.");

console.log("Supabase read-only inventory smoke test ok.");

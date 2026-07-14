import fs from "node:fs/promises";

const marker = "-- Active migration repair snapshot (2026-07-14).";
const reactionMigrationPath = "supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql";
const repositoryMigrationPath = "supabase/migrations/20260714020000_repository_showcase_structured_metadata_repair.sql";
const sandboxMigrationPath = "supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql";

const [reactionMigration, repositoryMigration, sandboxMigration] = await Promise.all([
  fs.readFile(reactionMigrationPath, "utf8"),
  fs.readFile(repositoryMigrationPath, "utf8"),
  fs.readFile(sandboxMigrationPath, "utf8"),
]);

const repairSnapshot = [
  marker,
  "-- Generated from the three additive migrations that follow the remote baseline.",
  `-- Canonical source: ${reactionMigrationPath}`,
  reactionMigration.trim(),
  `-- Canonical source: ${repositoryMigrationPath}`,
  repositoryMigration.trim(),
  `-- Canonical source: ${sandboxMigrationPath}`,
  sandboxMigration.trim(),
].join("\n\n");

for (const snapshotPath of ["supabase/schema.sql", "supabase/policies.sql"]) {
  const current = await fs.readFile(snapshotPath, "utf8");
  const base = current.split(marker, 1)[0].trimEnd();
  await fs.writeFile(snapshotPath, `${base}\n\n${repairSnapshot}\n`, "utf8");
}

console.log("Supabase schema and policy snapshots synchronized.");

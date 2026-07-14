#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = await fs.realpath(resolve(fileURLToPath(new URL("../", import.meta.url))));
const TOKEN_PREFIX = "elysia_sandbox_finalizer_v1_";
const TOKEN_PATTERN = /^elysia_sandbox_finalizer_v1_([A-Za-z0-9_-]{64})$/;

export function validateFinalizerToken(token) {
  const value = String(token ?? "").trim();
  const match = value.match(TOKEN_PATTERN);
  if (!match || /replace|placeholder|example|changeme|password|secret/i.test(value)) return false;
  return new Set(match[1]).size >= 20;
}

export function finalizerTokenHash(token) {
  if (!validateFinalizerToken(token)) throw new Error("finalizer_token_invalid");
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function renderFinalizerSql(token, action = "rotate") {
  if (action === "revoke") {
    return `begin;\nupdate private.sandbox_proxy_secrets\nset secret_hash_hex = null, rotated_at = pg_catalog.now()\nwhere secret_name = 'sandbox_db_finalizer';\ndo $elysia_verify$\nbegin\n  if (select pg_catalog.count(*) from private.sandbox_proxy_secrets where secret_name = 'sandbox_db_finalizer' and secret_hash_hex is null) <> 1 then\n    raise exception 'sandbox_finalizer_revocation_not_verified';\n  end if;\nend\n$elysia_verify$;\ncommit;\n`;
  }
  const digest = finalizerTokenHash(token);
  return `begin;\nupdate private.sandbox_proxy_secrets\nset secret_hash_hex = '${digest}', rotated_at = pg_catalog.now()\nwhere secret_name = 'sandbox_db_finalizer';\ndo $elysia_verify$\nbegin\n  if (select pg_catalog.count(*) from private.sandbox_proxy_secrets where secret_name = 'sandbox_db_finalizer' and secret_hash_hex = '${digest}') <> 1 then\n    raise exception 'sandbox_finalizer_rotation_not_verified';\n  end if;\nend\n$elysia_verify$;\ncommit;\n`;
}

function insideProject(path) {
  const absolute = resolve(path);
  return absolute === projectRoot || absolute.startsWith(`${projectRoot}${sep}`);
}

export function assertPrivateOutputPath(path) {
  if (!path || !isAbsolute(path) || insideProject(path)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
  return resolve(path);
}

async function assertPrivateDirectory(path, { create = false } = {}) {
  let absolute = assertPrivateOutputPath(path);
  if (create) {
    const canonicalParent = await fs.realpath(dirname(absolute));
    if (insideProject(canonicalParent)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
    absolute = resolve(canonicalParent, basename(absolute));
    if (insideProject(absolute)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
    await fs.mkdir(absolute, { mode: 0o700 });
  }
  const stat = await fs.lstat(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error("operator_output_directory_not_private");
  const canonical = await fs.realpath(absolute);
  if (insideProject(canonical)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
  return canonical;
}

async function writePrivateFile(path, contents) {
  const requested = assertPrivateOutputPath(path);
  const canonicalParent = await assertPrivateDirectory(dirname(requested));
  const destination = resolve(canonicalParent, basename(requested));
  if (insideProject(destination)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
  await fs.writeFile(destination, contents, { mode: 0o600, flag: "wx" });
  await fs.chmod(destination, 0o600);
  return destination;
}

async function readPrivateToken(path) {
  const absolute = assertPrivateOutputPath(path);
  const stat = await fs.lstat(absolute);
  const canonical = await fs.realpath(absolute);
  if (insideProject(canonical)) throw new Error("operator_output_path_must_be_absolute_and_outside_repository");
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.size > 1_024) throw new Error("finalizer_token_file_not_private");
  const token = (await fs.readFile(canonical, "utf8")).trim();
  if (!validateFinalizerToken(token)) throw new Error("finalizer_token_invalid");
  return token;
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${flag.replace(/^--/, "")}_required`);
  return args[index + 1];
}

function assertKnownArgs(args, allowed) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--") || !allowed.has(value)) throw new Error("unknown_argument");
    index += 1;
  }
}

function usage() {
  return [
    "Governed sandbox finalizer operator tool",
    "",
    "Commands:",
    "  check",
    "  validate-token-file --token-file <absolute-private-path>",
    "  prepare-rotation --output-dir <new-absolute-private-directory>",
    "  render-rotation --token-file <absolute-private-path> --sql-output <absolute-private-path>",
    "  prepare-revocation --sql-output <absolute-private-path>",
    "",
    "Raw tokens are never accepted in argv or printed. Production SQL is never executed by this tool."
  ].join("\n");
}

async function main(args) {
  const [command = "check", ...rest] = args;
  if (["-h", "--help", "help"].includes(command)) {
    console.log(usage());
    return;
  }
  if (command === "check") {
    if (rest.length) throw new Error("unknown_argument");
    console.log(JSON.stringify({ ok: true, mode: "check", secretMaterialCreated: false, productionChanged: false }));
    return;
  }
  if (command === "validate-token-file") {
    assertKnownArgs(rest, new Set(["--token-file"]));
    await readPrivateToken(valueAfter(rest, "--token-file"));
    console.log(JSON.stringify({ ok: true, valid: true, tokenPrinted: false }));
    return;
  }
  if (command === "prepare-rotation") {
    assertKnownArgs(rest, new Set(["--output-dir"]));
    const outputDirectory = await assertPrivateDirectory(valueAfter(rest, "--output-dir"), { create: true });
    const token = `${TOKEN_PREFIX}${randomBytes(48).toString("base64url")}`;
    if (!validateFinalizerToken(token)) throw new Error("generated_finalizer_token_invalid");
    await writePrivateFile(resolve(outputDirectory, "sandbox-finalizer.token"), `${token}\n`);
    await writePrivateFile(resolve(outputDirectory, "sandbox-finalizer.sha256"), `${finalizerTokenHash(token)}\n`);
    await writePrivateFile(resolve(outputDirectory, "sandbox-finalizer-set-hash.sql"), renderFinalizerSql(token));
    console.log(JSON.stringify({ ok: true, mode: "prepare-rotation", outputDirectory, tokenPrinted: false, hashPrinted: false, productionChanged: false }));
    return;
  }
  if (command === "render-rotation") {
    assertKnownArgs(rest, new Set(["--token-file", "--sql-output"]));
    const token = await readPrivateToken(valueAfter(rest, "--token-file"));
    const output = await writePrivateFile(valueAfter(rest, "--sql-output"), renderFinalizerSql(token));
    console.log(JSON.stringify({ ok: true, mode: "render-rotation", output, tokenPrinted: false, hashPrinted: false, productionChanged: false }));
    return;
  }
  if (command === "prepare-revocation") {
    assertKnownArgs(rest, new Set(["--sql-output"]));
    const output = await writePrivateFile(valueAfter(rest, "--sql-output"), renderFinalizerSql("", "revoke"));
    console.log(JSON.stringify({ ok: true, mode: "prepare-revocation", output, productionChanged: false }));
    return;
  }
  throw new Error("unknown_command");
}

const directRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directRun) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "finalizer_tool_failed" }));
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

function run(bin, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolvePromise(stdout.trim()) : reject(new Error(stderr.trim() || `${bin}_failed`)));
  });
}

function hash(contents) { return createHash("sha256").update(contents).digest("hex"); }

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error("release_extracted_type_invalid");
  }
  return files;
}

async function directoriesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directories = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      directories.push(path, ...await directoriesBelow(path));
    } else if (!entry.isFile()) {
      throw new Error("release_extracted_type_invalid");
    }
  }
  return directories;
}

const archive = resolve(process.argv[2] || "");
if (!archive.endsWith(".tar.gz")) throw new Error("release_archive_required");
if ((await fs.stat(archive)).size > 20 * 1024 * 1024) throw new Error("release_archive_too_large");
const checksumFile = `${archive}.sha256`;
const checksumContents = await fs.readFile(checksumFile, "utf8");
const checksumMatch = checksumContents.match(/^([0-9a-f]{64})  ([^/\r\n]+)\r?\n?$/);
if (!checksumMatch || checksumMatch[2] !== basename(archive)) throw new Error("release_archive_checksum_file_invalid");
const expectedArchiveHash = checksumMatch[1];
if (hash(await fs.readFile(archive)) !== expectedArchiveHash) throw new Error("release_archive_checksum_mismatch");

const listing = (await run("tar", ["--list", "--file", archive], dirname(archive))).split("\n").filter(Boolean);
if (
  !listing.length
  || listing.length > 2_000
  || new Set(listing).size !== listing.length
  || listing.some((entry) => (entry !== "bundle" && entry !== "bundle/" && !entry.startsWith("bundle/")) || entry.split("/").includes(".."))
) throw new Error("release_archive_path_invalid");
const verboseListing = (await run("tar", ["--list", "--verbose", "--file", archive], dirname(archive))).split("\n").filter(Boolean);
if (verboseListing.length !== listing.length || verboseListing.some((entry) => !/^[d-]/.test(entry))) {
  throw new Error("release_archive_type_invalid");
}
if (listing.some((entry) => entry.includes("/node_modules/") && !entry.endsWith("/node_modules/") && !entry.includes("/node_modules/yaml/"))) {
  throw new Error("release_contains_unapproved_dependency");
}

const temporaryRoot = await fs.mkdtemp(join(os.tmpdir(), "elysia-sandbox-verify-"));
try {
await run("tar", ["--extract", "--gzip", "--file", archive, "--directory", temporaryRoot, "--no-same-owner", "--no-same-permissions"], temporaryRoot);
const bundleRoot = join(temporaryRoot, "bundle");
const realBundleRoot = await fs.realpath(bundleRoot);
const manifest = await fs.readFile(join(bundleRoot, "RELEASE-MANIFEST.sha256"), "utf8");
const manifestFiles = new Set();
for (const line of manifest.trim().split("\n")) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) throw new Error("release_manifest_invalid");
  if (!match[2].startsWith("services/sandbox-runner/") || manifestFiles.has(match[2])) throw new Error("release_manifest_path_invalid");
  manifestFiles.add(match[2]);
  const path = resolve(bundleRoot, match[2]);
  if (path !== realBundleRoot && !path.startsWith(`${realBundleRoot}${sep}`)) throw new Error("release_manifest_path_invalid");
  const stat = await fs.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0) throw new Error("release_file_permissions_invalid");
  if (hash(await fs.readFile(path)) !== match[1]) throw new Error("release_file_checksum_mismatch");
}
const extractedFiles = (await filesBelow(bundleRoot)).map((path) => relative(bundleRoot, path));
const expectedExtractedFiles = new Set([...manifestFiles, "RELEASE-MANIFEST.sha256", "RELEASE-METADATA.json"]);
if (
  extractedFiles.length !== expectedExtractedFiles.size
  || extractedFiles.some((path) => !expectedExtractedFiles.has(path))
) throw new Error("release_unmanifested_file");
const expectedDirectories = new Set();
for (const path of expectedExtractedFiles) {
  const components = path.split("/");
  for (let index = 1; index < components.length; index += 1) {
    expectedDirectories.add(components.slice(0, index).join("/"));
  }
}
const extractedDirectories = (await directoriesBelow(bundleRoot)).map((path) => relative(bundleRoot, path));
if (extractedDirectories.some((path) => !expectedDirectories.has(path))) throw new Error("release_unmanifested_directory");

const metadata = JSON.parse(await fs.readFile(join(bundleRoot, "RELEASE-METADATA.json"), "utf8"));
if (!/^sandbox-[0-9a-f]{20}$/.test(metadata.releaseId)) throw new Error("release_id_invalid");
if (metadata.releaseId !== `sandbox-${hash(manifest).slice(0, 20)}`) throw new Error("release_id_manifest_mismatch");
const runnerRoot = join(bundleRoot, "services", "sandbox-runner");
const runnerPackage = JSON.parse(await fs.readFile(join(runnerRoot, "package.json"), "utf8"));
const yamlPackage = JSON.parse(await fs.readFile(join(runnerRoot, "node_modules", "yaml", "package.json"), "utf8"));
if (runnerPackage.dependencies.yaml !== "2.9.0" || yamlPackage.version !== "2.9.0") throw new Error("release_dependency_invalid");
for (const file of ["server.mjs", "runner.mjs", "dockerRunner.mjs", "serviceConfig.mjs", "jobStore.mjs", "cleanup.mjs", "accessValidator.mjs"]) {
  await run(process.execPath, ["--check", join(runnerRoot, file)], bundleRoot);
}
for (const file of [
  "deployment/build-runtime-images.sh",
  "deployment/cloudflared/validate-config.sh",
  "deployment/host-preflight.sh",
  "deployment/install-user-service.sh",
  "deployment/post-install-verify.sh",
  "deployment/rollback-release.sh",
  "deployment/uninstall-user-service.sh",
  "deployment/validate-rootless-docker-standby.sh",
  "deployment/validate-rootless-podman.sh"
]) {
  await run("bash", ["-n", join(runnerRoot, file)], bundleRoot);
}
const forbidden = listing.some((entry) => /(^|\/)(runtime|jobs|audit|\.env|runner\.env)(\/|$)/.test(entry));
if (forbidden) throw new Error("release_contains_runtime_or_secret_file");

const result = { ok: true, releaseId: metadata.releaseId, archive: basename(archive), dirty: metadata.dirty === true };
if (process.env.SANDBOX_RELEASE_RESULT_FILE) {
  await fs.writeFile(process.env.SANDBOX_RELEASE_RESULT_FILE, `${JSON.stringify(result)}\n`, { mode: 0o600 });
}
await new Promise((resolvePromise, reject) => {
  process.stdout.write(`${JSON.stringify(result)}\n`, (error) => error ? reject(error) : resolvePromise());
});
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

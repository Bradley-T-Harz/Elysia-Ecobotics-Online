#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const projectRoot = fileURLToPath(root);
const runnerRoot = join(projectRoot, "services", "sandbox-runner");
const outputRoot = join(runnerRoot, "release-output");
const RELEASE_FILES = Object.freeze([
  ".env.example",
  ".npmrc",
  "README.md",
  "accessValidator.mjs",
  "auditLog.mjs",
  "cleanup.mjs",
  "cli.mjs",
  "deployment/cloudflared/config.example.yml",
  "deployment/cloudflared/validate-config.sh",
  "deployment/cloudflare/access-contract.example.json",
  "deployment/README.md",
  "deployment/build-runtime-images.sh",
  "deployment/containers/policy.json",
  "deployment/containers/registries.conf",
  "deployment/host-preflight.sh",
  "deployment/install-verified-release.sh",
  "deployment/install-user-service.sh",
  "deployment/post-install-verify.sh",
  "deployment/rollback-release.sh",
  "deployment/systemd/elysia-sandbox-cleanup.service",
  "deployment/systemd/elysia-sandbox-cleanup.timer",
  "deployment/systemd/elysia-sandbox-runner.service",
  "deployment/uninstall-user-service.sh",
  "deployment/validate-rootless-docker-standby.sh",
  "deployment/validate-rootless-podman.sh",
  "diagnostics.mjs",
  "dockerRunner.mjs",
  "fixtures/approved-python.elysia-sandbox-request.json",
  "fixtures/blocked-secret.elysia-sandbox-request.json",
  "fixtures/snapshot-blocked-secret-run.json",
  "fixtures/snapshot-javascript-run.json",
  "fixtures/snapshot-python-run.json",
  "fixtures/snapshot-timeout-run.json",
  "fixtures/unapproved-python.elysia-sandbox-request.json",
  "handoffValidator.mjs",
  "images/README.md",
  "images/node.Containerfile",
  "images/python.Containerfile",
  "jobStore.mjs",
  "package-lock.json",
  "package.json",
  "policy.mjs",
  "runner.mjs",
  "server.mjs",
  "serviceConfig.mjs"
]);

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: projectRoot, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `${bin}_failed`)));
  });
}

async function filesBelow(directory, excludedDirectories = new Set()) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path, excludedDirectories));
    else if (entry.isFile()) files.push(path);
    else throw new Error("release_source_type_invalid");
  }
  return files;
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

const status = await run("git", ["status", "--porcelain"]);
const dirty = Boolean(status);
if (dirty && process.env.SANDBOX_RELEASE_ALLOW_DIRTY !== "1") {
  throw new Error("release_refused_dirty_tree");
}

const temporaryRoot = await fs.mkdtemp(join(os.tmpdir(), "elysia-sandbox-release-"));
try {
const stagedProject = join(temporaryRoot, "bundle");
const stagedRunner = join(stagedProject, "services", "sandbox-runner");
await fs.mkdir(stagedRunner, { recursive: true, mode: 0o755 });

const sourceFiles = await filesBelow(runnerRoot, new Set(["runtime", "release-output", "node_modules"]));
const discoveredFiles = sourceFiles.map((path) => relative(runnerRoot, path)).sort();
if (discoveredFiles.length !== RELEASE_FILES.length || discoveredFiles.some((path, index) => path !== [...RELEASE_FILES].sort()[index])) {
  throw new Error("release_source_allowlist_mismatch");
}
for (const relativePath of RELEASE_FILES) {
  const source = join(runnerRoot, relativePath);
  const destination = join(stagedRunner, relativePath);
  await fs.mkdir(dirname(destination), { recursive: true, mode: 0o755 });
  await fs.copyFile(source, destination);
}

const installedYaml = join(projectRoot, "node_modules", "yaml");
const yamlPackage = JSON.parse(await fs.readFile(join(installedYaml, "package.json"), "utf8"));
if (yamlPackage.version !== "2.9.0") throw new Error("runner_dependency_version_mismatch");
await fs.cp(installedYaml, join(stagedRunner, "node_modules", "yaml"), { recursive: true, force: false });

const commit = await run("git", ["rev-parse", "HEAD"]);
const stagedFiles = (await filesBelow(stagedProject)).sort();
const manifestLines = [];
for (const path of stagedFiles) {
  await fs.chmod(path, 0o644);
  const contents = await fs.readFile(path);
  manifestLines.push(`${sha256(contents)}  ${relative(stagedProject, path)}`);
}
const manifest = `${manifestLines.join("\n")}\n`;
const releaseId = `sandbox-${sha256(manifest).slice(0, 20)}`;
await fs.writeFile(join(stagedProject, "RELEASE-MANIFEST.sha256"), manifest, { mode: 0o644 });
await fs.writeFile(join(stagedProject, "RELEASE-METADATA.json"), `${JSON.stringify({ releaseId, commit, dirty, createdAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o644 });

await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 });
const archive = join(outputRoot, `${releaseId}.tar.gz`);
await run("tar", ["--create", "--gzip", "--file", archive, "--directory", temporaryRoot, basename(stagedProject)]);
await fs.chmod(archive, 0o600);
await fs.writeFile(`${archive}.sha256`, `${sha256(await fs.readFile(archive))}  ${basename(archive)}\n`, { mode: 0o600 });
const result = { ok: true, releaseId, archive, dirty };
if (process.env.SANDBOX_RELEASE_RESULT_FILE) {
  await fs.writeFile(process.env.SANDBOX_RELEASE_RESULT_FILE, `${JSON.stringify(result)}\n`, { mode: 0o600 });
}
await new Promise((resolvePromise, reject) => {
  process.stdout.write(`${JSON.stringify(result)}\n`, (error) => error ? reject(error) : resolvePromise());
});
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDistDirectory = path.join(repositoryRoot, "dist");

export const productionAuthCaptchaMode = "required";
export const productionAuthTurnstileSiteKey = "0x4AAAAAAECNSZYyGXT8LPJC";

const authClientContract = "auth-turnstile-2026-07-30.1";
const turnstileScriptSource = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const commonsBundlePattern = /^assets\/safe-assets-v1-commons-circle-[A-Za-z0-9_-]+\.js$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectArtifactFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(current, entry.name);
    assert(!entry.isSymbolicLink(), "production_artifact_must_not_contain_symlinks");
    if (entry.isDirectory()) {
      files.push(...await collectArtifactFiles(root, absolute));
      continue;
    }
    assert(entry.isFile(), "production_artifact_contains_unsupported_entry");
    files.push({
      absolute,
      relative: path.relative(root, absolute).split(path.sep).join("/"),
    });
  }
  return files;
}

export async function verifyProductionAuthArtifact(distDirectory = defaultDistDirectory) {
  const dist = path.resolve(distDirectory);
  const stat = await fs.lstat(dist);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), "production_dist_directory_invalid");
  const files = await collectArtifactFiles(dist);
  assert(files.length > 0, "production_artifact_empty");

  const commonsBundles = files.filter((file) => commonsBundlePattern.test(file.relative));
  assert(commonsBundles.length === 1, "production_commons_auth_bundle_count_invalid");
  const bundle = commonsBundles[0];
  const bundleBytes = await fs.readFile(bundle.absolute);
  const bundleSource = bundleBytes.toString("utf8");

  const quotedRequired = "(?:`required`|\\\"required\\\"|'required')";
  const quotedSiteKey = `(?:\`${escapeRegExp(productionAuthTurnstileSiteKey)}\`|\\\"${escapeRegExp(productionAuthTurnstileSiteKey)}\\\"|'${escapeRegExp(productionAuthTurnstileSiteKey)}')`;
  const compiledRequiredConfig = new RegExp(
    `Object\\.freeze\\(\\{mode:[A-Za-z_$][\\w$]*\\(${quotedRequired}\\),siteKey:[A-Za-z_$][\\w$]*\\(${quotedSiteKey}\\)\\}\\)`,
  );
  const compiledMissingConfig = /Object\.freeze\(\{mode:[A-Za-z_$][\w$]*\((?:void 0|undefined|[`"']off[`"'])\),siteKey:[A-Za-z_$][\w$]*\((?:void 0|undefined|null)\)\}\)/;

  if (!compiledRequiredConfig.test(bundleSource)) {
    assert(!compiledMissingConfig.test(bundleSource), "compiled_production_auth_config_is_off_or_missing");
    throw new Error("compiled_production_auth_config_is_not_required");
  }
  assert(bundleSource.includes(turnstileScriptSource), "production_auth_turnstile_script_contract_missing");
  assert(bundleSource.includes(authClientContract), "production_auth_client_contract_missing");

  let siteKeyOccurrences = 0;
  const artifactDigest = createHash("sha256");
  for (const file of files) {
    const bytes = await fs.readFile(file.absolute);
    if (file.relative.endsWith(".js")) {
      siteKeyOccurrences += bytes.toString("utf8").split(productionAuthTurnstileSiteKey).length - 1;
    }
    const fileDigest = sha256(bytes);
    artifactDigest.update(file.relative);
    artifactDigest.update("\0");
    artifactDigest.update(String(bytes.byteLength));
    artifactDigest.update("\0");
    artifactDigest.update(fileDigest);
    artifactDigest.update("\n");
  }
  assert(siteKeyOccurrences === 1, "production_auth_public_site_key_occurrence_invalid");

  return Object.freeze({
    mode: productionAuthCaptchaMode,
    publicSiteKeyMatched: true,
    bundlePath: bundle.relative,
    bundleSha256: sha256(bundleBytes),
    artifactSha256: artifactDigest.digest("hex"),
    fileCount: files.length,
  });
}

function printVerification(result) {
  console.log("Production Auth compiled-artifact gate passed.");
  console.log(`Mode: ${result.mode}`);
  console.log("Public Turnstile site key: exact match");
  console.log(`Commons/Auth bundle: ${result.bundlePath}`);
  console.log(`Commons/Auth bundle SHA-256: ${result.bundleSha256}`);
  console.log(`Complete artifact SHA-256: ${result.artifactSha256}`);
  console.log(`Artifact file count: ${result.fileCount}`);
}

async function main() {
  const command = process.argv[2];
  if (command === "verify") {
    assert(process.argv.length === 3, "production_verify_does_not_accept_arguments");
    printVerification(await verifyProductionAuthArtifact());
    return;
  }
  throw new Error("usage: authProductionRelease.mjs verify");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Production Auth release command failed: ${error instanceof Error ? error.message : "unknown_failure"}`);
    process.exitCode = 1;
  });
}

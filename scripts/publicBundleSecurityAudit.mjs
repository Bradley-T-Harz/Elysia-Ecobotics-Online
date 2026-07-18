import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const allowedExtensions = new Set(["", ".css", ".html", ".ico", ".jpg", ".jpeg", ".js", ".json", ".png", ".svg", ".txt", ".webmanifest", ".webp", ".xml"]);
const textExtensions = new Set(["", ".css", ".html", ".js", ".json", ".svg", ".txt", ".xml"]);
const forbiddenMaterial = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/u,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/u,
  /\bwhsec_[A-Za-z0-9]{16,}\b/u,
  /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /(?:\/home\/ojiji-chhaya(?:\/|\b)|MAIN_Projects|\/var\/run\/(?:docker|podman)\.sock)/iu,
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const metadata = await lstat(absolute);
    assert.equal(metadata.isSymbolicLink(), false, `Public bundle contains a symbolic link: ${path.relative(root, absolute)}`);
    if (metadata.isDirectory()) files.push(...await walk(absolute));
    else if (metadata.isFile()) files.push(absolute);
  }
  return files;
}

const files = await walk(root);
assert.ok(files.length > 0, "The public bundle is missing.");
for (const absolute of files) {
  const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
  const extension = path.extname(relative).toLowerCase();
  assert.equal(relative.endsWith(".map"), false, `Source maps must not enter the public bundle: ${relative}`);
  assert.equal(allowedExtensions.has(extension), true, `Unexpected public bundle artifact: ${relative}`);
  assert.equal(/(?:^|\/)(?:\.env|\.dev\.vars)(?:\.|$)/u.test(relative), false, `Runtime environment file entered the public bundle: ${relative}`);
  if (!textExtensions.has(extension)) continue;
  const text = await readFile(absolute, "utf8");
  for (const pattern of forbiddenMaterial) assert.equal(pattern.test(text), false, `Secret-looking or private-machine material detected in dist/${relative}`);
}

console.log(`Online public-bundle security audit passed: ${files.length} artifacts, no symlinks, source maps, runtime environment files, secret material, or private-machine paths.`);

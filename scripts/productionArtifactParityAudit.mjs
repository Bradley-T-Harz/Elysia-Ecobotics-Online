import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const origin = new URL(process.env.ELYSIA_WEBSITE_ORIGIN ?? "https://elysiaecobotics.com").origin;
const dist = path.resolve("dist");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const indexResponse = await fetch(`${origin}/`, { redirect: "error" });
assert.equal(indexResponse.status, 200);
assert(indexResponse.headers.get("content-type")?.startsWith("text/html"));
assert(indexResponse.headers.get("cache-control")?.includes("must-revalidate"));
const deployedIndex = Buffer.from(await indexResponse.arrayBuffer());
const localIndex = await fs.readFile(path.join(dist, "index.html"));
assert.equal(sha256(deployedIndex), sha256(localIndex), "Canonical index is not byte-identical to the verified production artifact.");

const html = deployedIndex.toString("utf8");
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
const uniqueAssetPaths = [...new Set(assetPaths)];
assert(uniqueAssetPaths.length > 0);
const results = [];
for (const assetPath of uniqueAssetPaths) {
  const response = await fetch(`${origin}${assetPath}`, { redirect: "error" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const localBytes = await fs.readFile(path.join(dist, assetPath.replace(/^\//, "")));
  const contentType = response.headers.get("content-type") ?? "";
  assert.equal(response.status, 200, `${assetPath} did not return 200.`);
  if (assetPath.endsWith(".js")) assert(contentType.includes("javascript"), `${assetPath} did not return JavaScript MIME.`);
  if (assetPath.endsWith(".css")) assert(contentType.includes("text/css"), `${assetPath} did not return CSS MIME.`);
  assert(response.headers.get("x-content-type-options")?.toLowerCase() === "nosniff", `${assetPath} lost nosniff.`);
  assert(response.headers.get("cache-control")?.includes("immutable"), `${assetPath} lost immutable caching.`);
  assert.equal(sha256(bytes), sha256(localBytes), `${assetPath} differs from the verified artifact.`);
  results.push({ assetPath, bytes: bytes.length, contentType, sha256: sha256(bytes) });
}

const missingPath = "/assets/pre-10d-deliberately-missing-module.js";
const missing = await fetch(`${origin}${missingPath}`, { redirect: "error" });
const missingBody = await missing.text();
assert.equal(missing.status, 404);
assert(missing.headers.get("content-type")?.startsWith("text/html"));
assert(missing.headers.get("cache-control")?.includes("no-store"));
assert(missing.headers.get("x-content-type-options")?.toLowerCase() === "nosniff");
assert(!missingBody.includes('id="root"') && !/<script\b/i.test(missingBody), "Missing JavaScript received an executable SPA shell.");

console.log(JSON.stringify({
  schemaVersion: 1,
  origin,
  indexSha256: sha256(deployedIndex),
  assetCount: results.length,
  assets: results,
  missingAsset: { path: missingPath, status: missing.status, contentType: missing.headers.get("content-type"), cacheControl: missing.headers.get("cache-control") },
  passed: true,
}, null, 2));

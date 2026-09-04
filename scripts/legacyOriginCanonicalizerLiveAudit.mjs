import assert from "node:assert/strict";
import fs from "node:fs/promises";

const sourceOrigin = new URL(process.env.ELYSIA_LEGACY_ORIGIN ?? "https://elysia-marketplace.pages.dev").origin;
const canonicalOrigin = "https://elysiaecobotics.com";
const inventoryPath = process.env.ELYSIA_LEGACY_ROUTE_INVENTORY;
const allowNonGet = process.env.ELYSIA_ALLOW_NON_GET === "1";

assert(inventoryPath, "ELYSIA_LEGACY_ROUTE_INVENTORY is required.");
assert(sourceOrigin.endsWith(".elysia-marketplace.pages.dev") || sourceOrigin === "https://elysia-marketplace.pages.dev", "Only the governed legacy Pages project may be audited.");

function materialize(route) {
  return route
    .replaceAll(":publicHandle", "%40phase-b-route-audit")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "phase-b-route-audit");
}

const raw = await fs.readFile(inventoryPath, "utf8");
const lines = raw.trim().split(/\r?\n/);
const headers = lines.shift().split("\t");
const pathIndex = headers.indexOf("full_path");
assert(pathIndex >= 0, "Route inventory must contain full_path.");

const paths = [...new Set(lines
  .map((line) => line.split("\t")[pathIndex])
  .filter((route) => route?.startsWith("/") && !route.includes("*"))
  .map(materialize))];
assert(paths.length >= 90, `Expected the complete legacy route inventory, received ${paths.length} materialized paths.`);

async function verifyPath(pathname) {
  const source = new URL(pathname, sourceOrigin);
  source.searchParams.set("phase_b_redirect_audit", "1");
  source.searchParams.set("next", "https://evil.example/not-a-destination");
  const expected = new URL(canonicalOrigin);
  expected.pathname = source.pathname;
  expected.search = source.search;
  const response = await fetch(source, {
    redirect: "manual",
    headers: { "User-Agent": "Elysia-Phase-B-Legacy-Origin-Audit/1.0" },
  });
  assert.equal(response.status, 308, `${source.pathname} must return 308.`);
  assert.equal(response.headers.get("location"), expected.href, `${source.pathname} must preserve path/query under the fixed canonical origin.`);
  assert.equal(response.headers.get("cache-control"), "no-store", `${source.pathname} must remain rollback-friendly during qualification.`);
  await response.body?.cancel();
}

for (let offset = 0; offset < paths.length; offset += 8) {
  await Promise.all(paths.slice(offset, offset + 8).map(verifyPath));
}

const methods = allowNonGet ? ["HEAD", "POST", "PUT", "PATCH", "DELETE"] : ["HEAD"];
for (const method of methods) {
  const source = `${sourceOrigin}/api/sandbox/run?phase_b_method=${method.toLowerCase()}`;
  const response = await fetch(source, {
    method,
    redirect: "manual",
    headers: { "User-Agent": "Elysia-Phase-B-Legacy-Origin-Audit/1.0" },
  });
  assert.equal(response.status, 308, `${method} must receive a method-preserving redirect.`);
  assert.equal(response.headers.get("location"), `${canonicalOrigin}/api/sandbox/run?phase_b_method=${method.toLowerCase()}`);
  await response.body?.cancel();
}

console.log(JSON.stringify({ ok: true, sourceOrigin, routeCount: paths.length, methodCount: methods.length }));

import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { canonicalLocation, onRequest } from "../legacy-origin-canonicalizer/functions/_middleware.js";

const cases = [
  ["https://elysia-marketplace.pages.dev/", "https://elysiaecobotics.com/"],
  ["https://elysia-marketplace.pages.dev/archive", "https://elysiaecobotics.com/archive"],
  ["https://elysia-marketplace.pages.dev/marketplace/browse?category=tools&sort=new", "https://elysiaecobotics.com/marketplace/browse?category=tools&sort=new"],
  ["https://elysia-marketplace.pages.dev//example.com/%2e%2e/legal?next=https%3A%2F%2Fevil.example", "https://elysiaecobotics.com//legal?next=https%3A%2F%2Fevil.example"],
  ["https://elysia-marketplace.pages.dev/commons/%40river?tab=work", "https://elysiaecobotics.com/commons/%40river?tab=work"],
];

for (const [source, expected] of cases) {
  assert.equal(canonicalLocation(source), expected);
  const response = onRequest({ request: new Request(source, { method: "GET" }) });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), expected);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}

for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
  const response = onRequest({ request: new Request("https://elysia-marketplace.pages.dev/deep/path?keep=1", { method }) });
  assert.equal(response.status, 308, `${method} must use a method-preserving redirect.`);
  assert.equal(response.headers.get("location"), "https://elysiaecobotics.com/deep/path?keep=1");
}

const routes = JSON.parse(await fs.readFile("legacy-origin-canonicalizer/public/_routes.json", "utf8"));
assert.deepEqual(routes, { version: 1, include: ["/*"], exclude: [] });

const fallbackScript = await fs.readFile("legacy-origin-canonicalizer/public/canonicalize.js", "utf8");
assert(fallbackScript.includes('new URL("https://elysiaecobotics.com")'));
assert(fallbackScript.includes("window.location.pathname"));
assert(fallbackScript.includes("window.location.search"));
assert(fallbackScript.includes("window.location.hash"));
assert(!fallbackScript.includes("URLSearchParams"), "Query parameters must never select a redirect origin.");

console.log(`Legacy origin canonicalizer passed ${cases.length} URL cases and six HTTP method checks.`);

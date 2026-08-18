#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build } from "esbuild";

const repositoryRoot = path.resolve(new URL("../", import.meta.url).pathname);
const outputArgumentIndex = process.argv.indexOf("--output");
const outputPath = outputArgumentIndex >= 0 && process.argv[outputArgumentIndex + 1]
  ? path.resolve(process.argv[outputArgumentIndex + 1])
  : null;
const timeoutMs = 10_000;
const concurrency = 8;

if (!outputPath) {
  throw new Error("usage: npm run audit:living-library-urls -- --output /secure/new/path.json");
}

const bundled = await build({
  stdin: {
    contents: 'export { activeLivingLibrarySources } from "./src/pages/The-Living-Library/livingLibraryCatalog.ts";',
    resolveDir: repositoryRoot,
    sourcefile: "living-library-url-audit-entry.ts",
    loader: "ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false
});
const moduleSource = bundled.outputFiles[0].text;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);

const byUrl = new Map();
for (const source of catalog.activeLivingLibrarySources) {
  const url = new URL(source.officialUrl).toString();
  const current = byUrl.get(url) ?? [];
  current.push(source.id);
  byUrl.set(url, current);
}

function classify(httpStatus, errorCode) {
  if (errorCode) return "network_unverified";
  if (httpStatus >= 200 && httpStatus < 400) return "reachable";
  if ([401, 403, 429].includes(httpStatus)) return "access_controlled_or_rate_limited";
  if ([404, 410].includes(httpStatus)) return "missing";
  if (httpStatus >= 500) return "remote_server_error";
  return "unexpected_response";
}

async function request(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/json;q=0.8,*/*;q=0.5",
        "User-Agent": "Elysia-Living-Library-Link-Audit/1.0"
      }
    });
    if (response.body) await response.body.cancel();
    return { httpStatus: response.status, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

async function auditOne([url, sourceIds]) {
  try {
    let response = await request(url, "HEAD");
    // Many otherwise healthy catalog sites reject or misroute HEAD. Confirm any
    // non-successful HEAD response with a bounded GET before classifying it.
    if (response.httpStatus < 200 || response.httpStatus >= 400) response = await request(url, "GET");
    return {
      sourceIds,
      url,
      ...response,
      status: classify(response.httpStatus, null),
      errorCode: null
    };
  } catch (error) {
    const errorCode = error instanceof Error && error.name === "AbortError" ? "timeout" : "request_failed";
    return { sourceIds, url, httpStatus: null, finalUrl: null, status: classify(0, errorCode), errorCode };
  }
}

const entries = [...byUrl.entries()];
const results = new Array(entries.length);
let nextIndex = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
  while (nextIndex < entries.length) {
    const index = nextIndex;
    nextIndex += 1;
    results[index] = await auditOne(entries[index]);
  }
}));

const counts = {};
for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
const evidence = {
  capturedAt: new Date().toISOString(),
  scope: "active Living Library primary URLs",
  sourceCount: catalog.activeLivingLibrarySources.length,
  uniqueUrlCount: entries.length,
  timeoutMs,
  concurrency,
  counts,
  note: "HTTP reachability is point-in-time operational evidence, not an endorsement, safety guarantee, license conclusion, or proof that hosted content is unchanged.",
  results
};

await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(`Living Library URL audit completed: ${entries.length} unique active primary URLs.`);
for (const key of Object.keys(counts).sort()) console.log(`${key}: ${counts[key]}`);
console.log(`Private evidence written with mode 0600 to ${outputPath}`);

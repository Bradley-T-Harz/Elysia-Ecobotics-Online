import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const assetDirectory = resolve("dist/assets");
const ordinaryChunkLimit = 500 * 1024;
const monacoCoreLimit = 2.5 * 1024 * 1024;
const monacoCoreGzipLimit = 675 * 1024;
const workerLimits = new Map([
  ["editor.worker-", 300 * 1024],
  ["json.worker-", 448 * 1024],
  ["html.worker-", 768 * 1024],
  ["css.worker-", 1.1 * 1024 * 1024],
  ["ts.worker-", 6 * 1024 * 1024],
]);
const failures = [];
let ordinaryChunks = 0;
let monacoCoreChunks = 0;
let workerChunks = 0;

for (const entry of (await readdir(assetDirectory)).sort()) {
  if (entry.endsWith(".map")) failures.push(`${entry}: source maps are forbidden`);
  if (!entry.endsWith(".js")) continue;
  const path = resolve(assetDirectory, entry);
  const size = (await stat(path)).size;
  const workerBudget = [...workerLimits].find(([prefix]) => entry.startsWith(prefix));
  if (workerBudget) {
    workerChunks += 1;
    if (size > workerBudget[1]) failures.push(`${entry}: ${size} bytes exceeds worker budget ${workerBudget[1]}`);
    continue;
  }
  if (entry.includes("editor.api-")) {
    monacoCoreChunks += 1;
    const gzipSize = gzipSync(await readFile(path)).byteLength;
    if (size > monacoCoreLimit) failures.push(`${entry}: ${size} bytes exceeds local Monaco budget ${monacoCoreLimit}`);
    if (gzipSize > monacoCoreGzipLimit) failures.push(`${entry}: ${gzipSize} gzip bytes exceeds local Monaco gzip budget ${monacoCoreGzipLimit}`);
    for (const htmlName of ["index.html", "artisan-collective.html"]) {
      const html = await readFile(resolve("dist", htmlName), "utf8");
      if (html.includes(entry)) failures.push(`${htmlName}: eagerly references demand-loaded ${entry}`);
    }
    continue;
  }
  ordinaryChunks += 1;
  if (size > ordinaryChunkLimit) failures.push(`${entry}: ${size} bytes exceeds ordinary chunk budget ${ordinaryChunkLimit}`);
}

if (ordinaryChunks === 0) failures.push("No ordinary production JavaScript chunks were found.");
if (monacoCoreChunks !== 1) failures.push(`Expected one demand-loaded Monaco core chunk; found ${monacoCoreChunks}.`);
if (workerChunks !== workerLimits.size) failures.push(`Expected ${workerLimits.size} Monaco workers; found ${workerChunks}.`);
if (failures.length > 0) throw new Error(`Website bundle budget failed:\n${failures.join("\n")}`);

console.log(
  `Website bundle budget passed: ${ordinaryChunks} ordinary chunks at or below ${ordinaryChunkLimit} bytes; one demand-loaded local Monaco core within raw/gzip budgets; ${workerChunks} bounded workers; no source maps.`,
);

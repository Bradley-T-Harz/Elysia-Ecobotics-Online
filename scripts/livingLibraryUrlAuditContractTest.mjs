import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile("scripts/livingLibraryUrlAudit.mjs", "utf8");

assert.match(source, /activeLivingLibrarySources/, "URL audit must stay scoped to active Living Library primary URLs.");
assert.match(source, /const timeoutMs = 10_000/, "URL audit must use a bounded per-request timeout.");
assert.match(source, /const concurrency = 8/, "URL audit must use bounded concurrency.");
assert.match(source, /response\.httpStatus < 200 \|\| response\.httpStatus >= 400/, "URL audit must confirm failed HEAD responses with a bounded GET.");
assert.match(source, /flag: "wx"/, "URL evidence must not overwrite an existing report.");
assert.match(source, /mode: 0o600/, "URL evidence must be private by default.");
assert.match(source, /access_controlled_or_rate_limited/, "Authentication and bot controls must not be mislabeled as missing resources.");
assert.match(source, /network_unverified/, "Network failures must remain unverified rather than being mislabeled as broken links.");
assert.doesNotMatch(source, /rejectUnauthorized:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, "URL audit must not weaken TLS verification.");

console.log("Living Library URL audit contract passed.");

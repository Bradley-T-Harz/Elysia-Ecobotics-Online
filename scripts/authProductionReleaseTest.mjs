import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  productionAuthTurnstileSiteKey,
  verifyProductionAuthArtifact,
} from "./authProductionRelease.mjs";

const scriptSource = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const clientContract = "auth-turnstile-2026-07-30.1";

function requiredBundle(siteKey = productionAuthTurnstileSiteKey) {
  return [
    `const config=Object.freeze({mode:a(\`required\`),siteKey:b(\`${siteKey}\`)});`,
    `const script=${JSON.stringify(scriptSource)};`,
    `const contract=${JSON.stringify(clientContract)};`,
  ].join("\n");
}

async function fixture(bundleSource, { secondBundle = false, extraJs = "" } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "elysia-auth-production-gate-"));
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.writeFile(path.join(root, "index.html"), "<!doctype html><title>fixture</title>\n");
  await fs.writeFile(path.join(root, "assets", "commons-circle-fixture.js"), bundleSource);
  await fs.writeFile(path.join(root, "assets", "main-fixture.js"), extraJs);
  if (secondBundle) {
    await fs.writeFile(path.join(root, "assets", "commons-circle-second.js"), bundleSource);
  }
  return root;
}

async function expectFailure(root, pattern) {
  await assert.rejects(() => verifyProductionAuthArtifact(root), pattern);
  await fs.rm(root, { recursive: true, force: true });
}

const valid = await fixture(requiredBundle());
const verified = await verifyProductionAuthArtifact(valid);
assert.equal(verified.mode, "required");
assert.equal(verified.publicSiteKeyMatched, true);
assert.equal(verified.bundlePath, "assets/commons-circle-fixture.js");
assert.match(verified.bundleSha256, /^[0-9a-f]{64}$/);
assert.match(verified.artifactSha256, /^[0-9a-f]{64}$/);
assert.equal(verified.fileCount, 3);
await fs.rm(valid, { recursive: true, force: true });

await expectFailure(
  await fixture(`const config=Object.freeze({mode:a(void 0),siteKey:b(void 0)});\n${scriptSource}\n${clientContract}`),
  /compiled_production_auth_config_is_off_or_missing/,
);
await expectFailure(
  await fixture(requiredBundle("1x00000000000000000000AA")),
  /compiled_production_auth_config_is_not_required/,
);
await expectFailure(
  await fixture(requiredBundle(), { extraJs: productionAuthTurnstileSiteKey }),
  /production_auth_public_site_key_occurrence_invalid/,
);
await expectFailure(
  await fixture(requiredBundle(), { secondBundle: true }),
  /production_commons_auth_bundle_count_invalid/,
);
await expectFailure(
  await fixture(requiredBundle().replace(scriptSource, "https://example.invalid/turnstile.js")),
  /production_auth_turnstile_script_contract_missing/,
);

const buildWrapper = await fs.readFile(new URL("./buildProductionPages.sh", import.meta.url), "utf8");
const deployWrapper = await fs.readFile(new URL("./deployVerifiedProductionPages.sh", import.meta.url), "utf8");
assert.match(buildWrapper, /VITE_AUTH_CAPTCHA_MODE=required/);
assert.match(buildWrapper, new RegExp(`VITE_AUTH_TURNSTILE_SITE_KEY=${productionAuthTurnstileSiteKey}`));
assert.match(buildWrapper, /npm run build[\s\S]*node scripts\/authProductionRelease\.mjs verify/);
assert.match(deployWrapper, /node scripts\/authProductionRelease\.mjs verify[\s\S]*pages deploy dist/);
assert.match(deployWrapper, /production_release_requires_online_main_alignment/);
assert.match(deployWrapper, /--commit-dirty=false/);

console.log("Production Auth compiled-artifact release-gate tests passed.");

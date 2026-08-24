import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const origin = new URL(process.env.ELYSIA_WEBSITE_ORIGIN ?? "https://elysiaecobotics.com").origin;
const staleShellUrl = process.env.ELYSIA_STALE_SHELL_URL;
assert(staleShellUrl, "ELYSIA_STALE_SHELL_URL is required.");
const staleUrl = new URL(staleShellUrl);
assert(staleUrl.protocol === "https:" && staleUrl.hostname.endsWith(".elysia-ecobotics-online.pages.dev"), "The stale shell must come from a prior Elysia Pages deployment.");
const browserLabel = process.env.ELYSIA_BROWSER_LABEL ?? "chromium";
const evidenceDir = path.resolve(process.env.ELYSIA_BROWSER_EVIDENCE_DIR ?? `/tmp/elysia-${browserLabel}-cache-upgrade-evidence`);

const staleResponse = await fetch(staleUrl, { redirect: "error" });
assert.equal(staleResponse.status, 200, "The prior deployment shell is unavailable.");
const staleShell = await staleResponse.text();
assert(staleShell.includes("/assets/") && !staleShell.includes("/assets/safe-assets-v1-"), "The fixture is not a pre-safe-namespace shell.");

const browserType = browserLabel === "firefox" ? firefox : chromium;
const launchOptions = { headless: true };
if (browserLabel === "brave") launchOptions.executablePath = "/usr/bin/brave-browser";
const browser = await browserType.launch(launchOptions);
await fs.mkdir(evidenceDir, { recursive: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const firstPhaseErrors = [];
  const recoveryErrors = [];
  let phase = "stale";
  page.on("pageerror", (error) => (phase === "stale" ? firstPhaseErrors : recoveryErrors).push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text === "%c%d font-size:0;color:transparent NaN" || text.includes("Acquiring an exclusive Navigator LockManager lock")) return;
    (phase === "stale" ? firstPhaseErrors : recoveryErrors).push(text);
  });

  let servedStaleShell = false;
  const staleHandler = async (route) => {
    if (!servedStaleShell && route.request().resourceType() === "document") {
      servedStaleShell = true;
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "cache-control": "public, max-age=0, must-revalidate" }, body: staleShell });
      return;
    }
    await route.continue();
  };
  await page.route(`${origin}/`, staleHandler);
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(5_000);
  assert(servedStaleShell, "The stale shell fixture was not exercised.");
  const staleState = await page.evaluate(() => ({
    bodyText: (document.body?.innerText || "").trim(),
    rootChildren: document.querySelector("#root")?.childElementCount ?? 0,
    scripts: Array.from(document.scripts).map((element) => element.src).filter(Boolean),
  }));
  assert(staleState.scripts.some((value) => value.includes("/assets/") && !value.includes("/assets/safe-assets-v1-")), "The browser did not consume the stale generation.");

  await page.unroute(`${origin}/`, staleHandler);
  phase = "recovery";
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(3_000);
  const recovered = await page.evaluate(() => ({
    pathname: location.pathname,
    bodyTextLength: (document.body?.innerText || "").trim().length,
    rootChildren: document.querySelector("#root")?.childElementCount ?? 0,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    moduleScripts: Array.from(document.scripts).filter((element) => element.type === "module" && element.src.startsWith(location.origin)).map((element) => element.src),
  }));
  assert.equal(recovered.pathname, "/");
  assert(recovered.bodyTextLength >= 40 && recovered.rootChildren > 0 && !recovered.horizontalOverflow, "A normal reload did not recover the current Website shell.");
  assert(recovered.moduleScripts.length > 0 && recovered.moduleScripts.every((value) => value.includes("/assets/safe-assets-v1-")), "Recovered shell loaded a pre-safe JavaScript generation.");
  assert.deepEqual(recoveryErrors, [], `Recovery produced browser errors: ${recoveryErrors.join("\n")}`);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
  const visit = async (pathname) => {
    await page.goto(`${origin}${pathname}`, { waitUntil: "load", timeout: 120_000 });
    await page.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForTimeout(2_500);
    assert.equal(new URL(page.url()).pathname, pathname, `Navigation did not settle on ${pathname}.`);
  };
  await visit("/archive");
  await visit("/legal");
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 120_000 });
  assert.equal(new URL(page.url()).pathname, "/archive", "Back navigation did not restore Archive after cache recovery.");
  await page.goForward({ waitUntil: "domcontentloaded", timeout: 120_000 });
  assert.equal(new URL(page.url()).pathname, "/legal", "Forward navigation did not restore Legal after cache recovery.");
  const screenshotFile = path.join(evidenceDir, `${browserLabel}-cache-upgrade-recovered.png`);
  await page.screenshot({ path: screenshotFile, fullPage: false });
  await fs.writeFile(path.join(evidenceDir, `${browserLabel}-cache-upgrade.json`), `${JSON.stringify({
    schemaVersion: 1,
    browserLabel,
    browserVersion: browser.version(),
    origin,
    staleShellUrl: `${staleUrl.origin}/[prior-deployment-shell]`,
    staleState,
    firstPhaseErrors,
    recovered,
    recoveryErrors,
    screenshotFile: path.basename(screenshotFile),
    passed: true,
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(`${browserLabel} stale-shell/cache-upgrade recovery passed on ${browser.version()}. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
}

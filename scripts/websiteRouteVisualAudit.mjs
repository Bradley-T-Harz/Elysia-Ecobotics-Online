import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const origin = new URL(process.env.ELYSIA_WEBSITE_ORIGIN ?? "https://elysiaecobotics.com").origin;
const browserLabel = process.env.ELYSIA_BROWSER_LABEL ?? "chromium";
const evidenceDir = path.resolve(process.env.ELYSIA_BROWSER_EVIDENCE_DIR ?? `/tmp/elysia-${browserLabel}-route-evidence`);
const settleMs = Number.parseInt(process.env.ELYSIA_BROWSER_SETTLE_MS ?? "3000", 10);
const fullInventory = process.env.ELYSIA_ROUTE_INVENTORY === "full";
const captureAll = process.env.ELYSIA_CAPTURE_ALL_SCREENSHOTS === "1";
const keyPaths = [
  "/",
  "/archive",
  "/legal",
  "/commune",
  "/commune/coding-cornucopia/review",
  "/developer-forge",
  "/marketplace",
  "/living-library",
  "/admin",
];
const viewportCatalog = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const requestedViewports = (process.env.ELYSIA_BROWSER_VIEWPORTS ?? "desktop")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = requestedViewports.map((label) => {
  assert(viewportCatalog[label], `Unknown viewport ${label}.`);
  return [label, viewportCatalog[label]];
});

assert(Number.isFinite(settleMs) && settleMs >= 0 && settleMs <= 30_000, "ELYSIA_BROWSER_SETTLE_MS must be between 0 and 30000.");

function materializePath(value) {
  return value
    .replaceAll(":roomSlug", "coding-cornucopia")
    .replaceAll(":postId", "a1100000-0000-4000-8000-000000000001")
    .replaceAll(":conversationId", "a1200000-0000-4000-8000-000000000001")
    .replaceAll(":publicHandle", "@synthetic-route-audit")
    .replaceAll(":categorySlug", "earth-environment")
    .replaceAll(":sourceId", "nasa-earthdata")
    .replaceAll(":step", "profile")
    .replaceAll(":id", "synthetic-route-audit")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "synthetic-route-audit");
}

async function inventoryPaths() {
  const explicit = process.env.ELYSIA_BROWSER_AUDIT_PATHS;
  if (explicit) return explicit.split(",").map((value) => value.trim()).filter(Boolean);
  if (!fullInventory) return keyPaths;
  const contract = JSON.parse(await fs.readFile("docs/navigation/route-preservation-contract.json", "utf8"));
  const paths = contract.routes.flatMap((route) => route.smokePaths ?? []).map(materializePath);
  return [...new Set(paths.filter((value) => value.startsWith("/") && !value.includes("*")))];
}

function safeName(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function isKnownNonBlockingConsole(message) {
  return (
    (origin.startsWith("http://127.0.0.1:") && message.includes("Content-Security-Policy") && message.includes("blocked an inline script"))
    || message.includes("Acquiring an exclusive Navigator LockManager lock")
  );
}

const auditPaths = await inventoryPaths();
assert(auditPaths.length > 0, "The browser audit route inventory is empty.");
assert(auditPaths.every((value) => value.startsWith("/") && !value.startsWith("//")), "Every audit path must be same-origin and root-relative.");

const browserType = browserLabel === "firefox" ? firefox : chromium;
const launchOptions = { headless: true };
if (browserLabel === "brave") launchOptions.executablePath = "/usr/bin/brave-browser";
const browser = await browserType.launch(launchOptions);
await fs.mkdir(evidenceDir, { recursive: true });

try {
  const results = [];
  for (const [viewportLabel, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    for (const route of auditPaths) {
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];
      const failedAssets = [];
      const httpErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) => failedRequests.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`));
      page.on("response", (response) => {
        if (response.status() < 400) return;
        const resourceType = response.request().resourceType();
        httpErrors.push({ status: response.status(), resourceType, url: response.url() });
        if (["script", "stylesheet", "image", "font", "media", "manifest"].includes(resourceType)) {
          failedAssets.push(`${response.status()} ${resourceType} ${response.url()}`);
        }
      });

      let documentStatus = 0;
      let navigationError = "";
      try {
        const response = await page.goto(new URL(route, origin).href, { waitUntil: "domcontentloaded", timeout: 120_000 });
        documentStatus = response?.status() ?? 0;
        await page.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
        await page.waitForTimeout(settleMs);
      } catch (error) {
        navigationError = error instanceof Error ? error.message : String(error);
      }

      const visual = await page.evaluate(() => {
        const root = document.querySelector("#root");
        const rect = root?.getBoundingClientRect();
        return {
          title: document.title,
          pathname: location.pathname,
          bodyTextLength: (document.body?.innerText || "").trim().length,
          rootChildCount: root?.childElementCount || 0,
          rootWidth: Math.round(rect?.width || 0),
          rootHeight: Math.round(rect?.height || 0),
          scrollX: Math.round(window.scrollX),
          scrollY: Math.round(window.scrollY),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          loadingOnly: (document.body?.innerText || "").trim() === "Loading Elysia Ecobotics Online...",
        };
      }).catch(() => ({
        title: "",
        pathname: "",
        bodyTextLength: 0,
        rootChildCount: 0,
        rootWidth: 0,
        rootHeight: 0,
        scrollX: 0,
        scrollY: 0,
        horizontalOverflow: false,
        loadingOnly: false,
      }));
      const nonBlockingConsole = consoleErrors.filter((message) => (
        isKnownNonBlockingConsole(message)
        || (message.startsWith("Failed to load resource: the server responded with a status of") && httpErrors.length > 0 && failedAssets.length === 0)
      ));
      const fatalConsole = consoleErrors.filter((message) => !nonBlockingConsole.includes(message));
      const passed = documentStatus === 200
        && !navigationError
        && visual.bodyTextLength >= 40
        && visual.rootChildCount > 0
        && visual.rootWidth > 100
        && visual.rootHeight > 100
        && !visual.loadingOnly
        && !visual.horizontalOverflow
        && pageErrors.length === 0
        && fatalConsole.length === 0
        && failedAssets.length === 0;

      let screenshotFile = null;
      if (captureAll || keyPaths.includes(route) || !passed) {
        screenshotFile = `${browserLabel}-${safeName(route)}-${viewportLabel}.png`;
        await page.screenshot({ path: path.join(evidenceDir, screenshotFile), fullPage: false });
      }
      results.push({
        route,
        viewportLabel,
        viewport,
        documentStatus,
        finalUrl: page.url(),
        navigationError,
        visual,
        pageErrors,
        fatalConsole,
        nonBlockingConsole,
        failedRequests,
        failedAssets,
        httpErrors,
        screenshotFile,
        passed,
      });
      await page.close();
    }

    const historyPage = await context.newPage();
    await historyPage.goto(`${origin}/archive`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await historyPage.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
    await historyPage.waitForTimeout(settleMs);
    await historyPage.goto(`${origin}/legal`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await historyPage.locator("#root > *").first().waitFor({ state: "visible", timeout: 90_000 });
    await historyPage.waitForTimeout(settleMs);
    await historyPage.goBack({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await historyPage.waitForTimeout(settleMs);
    assert.equal(new URL(historyPage.url()).pathname, "/archive", `${browserLabel}: back navigation did not restore Archive`);
    await historyPage.goForward({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await historyPage.waitForTimeout(settleMs);
    assert.equal(new URL(historyPage.url()).pathname, "/legal", `${browserLabel}: forward navigation did not restore Legal`);
    await historyPage.close();
    await context.close();
  }

  const report = {
    schemaVersion: 1,
    browserLabel,
    browserVersion: browser.version(),
    origin,
    fullInventory,
    routeCount: auditPaths.length,
    viewportCount: viewports.length,
    results,
  };
  await fs.writeFile(path.join(evidenceDir, `${browserLabel}-audit.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  const failures = results.filter((result) => !result.passed);
  assert.equal(failures.length, 0, `${browserLabel} failed: ${failures.map((result) => `${result.route}@${result.viewportLabel}`).join(", ")}`);
  console.log(`${browserLabel} visual route audit passed for ${auditPaths.length} routes across ${viewports.length} viewport(s) on ${browser.version()}. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
}

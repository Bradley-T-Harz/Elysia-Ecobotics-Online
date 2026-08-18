import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDirectory = process.env.ELYSIA_ROUTE_ENTRY_EVIDENCE_DIR || "";
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = path.resolve(dist, `.${pathname}`);
    const safeAsset = candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
    let body = indexHtml;
    let extension = ".html";
    if (safeAsset) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          body = await fs.readFile(candidate);
          extension = path.extname(candidate);
        }
      } catch (error) {
        if (pathname.startsWith("/assets/")) throw error;
      }
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert(address && typeof address === "object", "Route-entry browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;

async function settle(page, selector = "main h1") {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(250);
}

async function pagePosition(page, selector = "main h1") {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const header = document.querySelector(".site-header");
    const targetBox = target?.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    return {
      activeId: document.activeElement?.id ?? "",
      activeTag: document.activeElement?.tagName.toLowerCase() ?? "",
      headerBottom: headerBox?.bottom ?? 0,
      scrollY,
      targetBottom: targetBox?.bottom ?? -1,
      targetTop: targetBox?.top ?? -1,
    };
  }, selector);
}

async function assertTopEntry(page, label) {
  const position = await pagePosition(page);
  assert(position.scrollY <= 2, `${label} should begin at true top, got ${position.scrollY}.`);
  assert(position.targetBottom > position.headerBottom, `${label} page heading should be visible below the sticky header.`);
  assert(["h1", "main"].includes(position.activeTag), `${label} should focus page context, got ${position.activeTag}#${position.activeId}.`);
}

async function assertVisibleTarget(page, selector, expectedActiveId, label) {
  const position = await pagePosition(page, selector);
  assert(position.targetTop >= position.headerBottom + 4, `${label} target should clear the sticky header.`);
  assert(position.targetTop < (await page.evaluate(() => innerHeight * 0.6)), `${label} target should be framed near the viewport beginning.`);
  assert.equal(position.activeId, expectedActiveId, `${label} should focus its named heading.`);
}

async function capture(page, filename) {
  if (!evidenceDirectory) return;
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, filename), fullPage: false });
}

const forgeDraft = {
  id: "route-entry-browser-fixture",
  addon_slug: "route-entry-browser-fixture",
  addon_name: "Route Entry Browser Fixture",
  short_summary: "Synthetic browser-local inert Forge fixture.",
  long_description: "# Route Entry Browser Fixture\n\nREADME target content.",
  version: "0.1.0",
  license: "MIT",
  category: "static",
  tags: [],
  manifest_json: { schema_version: "1.0.0", addon_id: "developer.route-entry-browser-fixture", name: "Route Entry Browser Fixture", version: "0.1.0", description: "Synthetic inert fixture.", license: "MIT", runtime: { kind: "static", entrypoint: "index.mjs" }, permissions: [], compatibility: {} },
  risk_level: "unknown",
  validation_status: "not_validated",
  package_status: "not_uploaded",
  submission_status: "draft",
  review_status: "not_submitted",
  created_at: "2026-08-06T12:00:00.000Z",
  updated_at: "2026-08-06T12:00:00.000Z",
};

const profileTransitions = [
  ["/commons-circle/setup/profile", "2. Stewardship", "/commons-circle/setup/stewardship"],
  ["/commons-circle/setup/profile", "3. Work With", "/commons-circle/setup/work-with"],
  ["/commons-circle/setup/profile", "4. Final confirmation", "/commons-circle/setup/confirm"],
  ["/commons-circle/setup/stewardship", "1. Commons Profile draft", "/commons-circle/setup/profile"],
  ["/commons-circle/setup/stewardship", "Continue to Work With Elysia Ecobotics", "/commons-circle/setup/work-with"],
  ["/commons-circle/setup/stewardship", "3. Work With", "/commons-circle/setup/work-with"],
  ["/commons-circle/setup/stewardship", "4. Final confirmation", "/commons-circle/setup/confirm"],
  ["/commons-circle/setup/work-with", "1. Commons Profile draft", "/commons-circle/setup/profile"],
  ["/commons-circle/setup/work-with", "2. Stewardship", "/commons-circle/setup/stewardship"],
  ["/commons-circle/setup/work-with", "Continue to final confirmation", "/commons-circle/setup/confirm"],
  ["/commons-circle/setup/work-with", "4. Final confirmation", "/commons-circle/setup/confirm"],
  ["/commons-circle/setup/confirm", "Back to profile draft", "/commons-circle/setup/profile"],
  ["/commons-circle/setup/confirm", "1. Commons Profile draft", "/commons-circle/setup/profile"],
  ["/commons-circle/setup/confirm", "2. Stewardship", "/commons-circle/setup/stewardship"],
  ["/commons-circle/setup/confirm", "3. Work With", "/commons-circle/setup/work-with"],
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [viewportName, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, colorScheme: "dark" });
    await context.addInitScript(({ draft }) => {
      localStorage.setItem("developerForge.localDrafts.v1", JSON.stringify([draft]));
    }, { draft: forgeDraft });
    const page = await context.newPage();

    await page.goto(`${origin}/legal/privacy-policy`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.72));
    const legalScroll = await page.evaluate(() => scrollY);
    assert(legalScroll > 500, `${viewportName} legal source should be deeply scrolled.`);
    await page.locator("a.site-brand").click();
    await page.waitForURL((url) => url.pathname === "/");
    await settle(page);
    await assertTopEntry(page, `${viewportName} ordinary PUSH`);
    const topSamples = [];
    for (const delay of [100, 350, 700]) {
      await page.waitForTimeout(delay);
      topSamples.push(Math.round(await page.evaluate(() => scrollY)));
    }
    assert(topSamples.every((value) => value <= 2), `${viewportName} ordinary entry should not have a delayed second jump: ${topSamples.join(", ")}.`);
    await capture(page, `ordinary-top-${viewportName}.png`);

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/legal/privacy-policy");
    await settle(page);
    await page.waitForFunction((expected) => scrollY > Math.max(500, expected * 0.7), legalScroll, { timeout: 10_000 });
    await capture(page, `pop-back-${viewportName}.png`);
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/");
    await settle(page);
    assert((await page.evaluate(() => scrollY)) <= 2, `${viewportName} Forward POP should restore the home top position.`);

    await page.goto(`${origin}/archive`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await assertTopEntry(page, `${viewportName} Archive release blocker`);
    assert.equal(await page.getByRole("heading", { name: "No public Elysia download is published", exact: true }).count(), 1, `${viewportName} Archive must expose the release blocker`);
    await capture(page, `archive-release-${viewportName}.png`);

    await page.goto(`${origin}/support?source=products`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/support" && url.search === "?source=products" && !url.hash);
    await settle(page);
    await assertTopEntry(page, `${viewportName} historical release-context support entry`);

    await page.goto(`${origin}/account/forgot-password`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await assertTopEntry(page, `${viewportName} Forgot Password`);
    assert.equal(await page.locator("#recovery-email").evaluate((element) => element === document.activeElement), false, `${viewportName} recovery email must not receive route-entry focus.`);

    for (const [source, buttonName, destination] of profileTransitions) {
      await page.goto(`${origin}${source}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.getByRole("button", { name: buttonName, exact: false }).click();
      await page.waitForURL((url) => url.pathname === destination);
      await settle(page);
      await assertTopEntry(page, `${viewportName} profile transition ${source} -> ${destination} via ${buttonName}`);
    }
    for (const setupRoute of ["profile", "stewardship", "work-with", "confirm"]) {
      await page.goto(`${origin}/commons-circle/setup/${setupRoute}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.reload({ waitUntil: "domcontentloaded" });
      await settle(page);
      await assertTopEntry(page, `${viewportName} profile reload ${setupRoute}`);
    }
    await page.goto(`${origin}/commons-circle/setup/profile`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.getByRole("button", { name: "Continue: Stewardship & Donations", exact: true }).scrollIntoViewIfNeeded();
    const profileValidationBefore = await page.evaluate(() => scrollY);
    await page.getByRole("button", { name: "Continue: Stewardship & Donations", exact: true }).click();
    await page.getByRole("alert").waitFor({ state: "visible" });
    const profileValidationAfter = await page.evaluate(() => scrollY);
    assert(Math.abs(profileValidationAfter - profileValidationBefore) <= 2, `${viewportName} Profile validation should not shift the viewport.`);
    assert.equal(await page.getByRole("alert").evaluate((element) => element === document.activeElement), true, `${viewportName} Profile validation should focus its stable summary.`);

    await page.getByRole("button", { name: "2. Stewardship", exact: true }).click();
    await page.waitForURL((url) => url.pathname.endsWith("/setup/stewardship"));
    await page.getByRole("button", { name: "Prepare stewardship recognition", exact: true }).scrollIntoViewIfNeeded();
    const stewardshipValidationBefore = await page.evaluate(() => scrollY);
    await page.getByRole("button", { name: "Prepare stewardship recognition", exact: true }).click();
    await page.getByRole("alert").waitFor({ state: "visible" });
    const stewardshipValidationAfter = await page.evaluate(() => scrollY);
    assert(Math.abs(stewardshipValidationAfter - stewardshipValidationBefore) <= 2, `${viewportName} Stewardship validation should not shift the viewport.`);

    await page.goto(`${origin}/living-library`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const categoryLink = page.locator(".library-browse-grid a").first();
    await categoryLink.click();
    await page.waitForURL((url) => url.pathname.startsWith("/living-library/browse/"));
    await settle(page, "#library-results");
    assert.equal(await page.locator("#library-results h2").first().evaluate((element) => element === document.activeElement), true, `${viewportName} Living Library browse route should focus the results heading.`);
    const categoryPosition = await pagePosition(page, "#library-results");
    assert(categoryPosition.targetTop >= categoryPosition.headerBottom + 4, `${viewportName} Living Library target should clear the sticky header.`);

    await page.goto(`${origin}/commune/rooms/coding-cornucopia`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/");
    await settle(page);
    await assertTopEntry(page, `${viewportName} hidden Commune compatibility route`);

    await page.goto(`${origin}/developer-forge/drafts/${forgeDraft.id}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.locator('.forge-left-rail a[href="#forge-preview"]').click();
    await settle(page, "#forge-preview");
    const previewHeading = page.locator("#forge-preview h3");
    assert.equal(await previewHeading.evaluate((element) => element === document.activeElement), true, `${viewportName} Forge Preview hash should focus its heading.`);
    await page.getByRole("button", { name: "Command palette", exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Command palette", exact: true }).click();
    await page.getByText("Open README preview", { exact: true }).last().click();
    await settle(page, "#forge-readme-preview-heading");
    await assertVisibleTarget(page, "#forge-readme-preview-heading", "forge-readme-preview-heading", `${viewportName} Forge README command`);
    assert(await page.locator("#forge-readme-preview").getByText("README target content.", { exact: true }).isVisible(), `${viewportName} Forge README content should be visible.`);
    await capture(page, `forge-readme-${viewportName}.png`);

    await context.close();
  }
  console.log("Route-entry browser regression passed for PUSH, POP restoration, delayed settling, approved targets, Support top entry, Forgot Password, profile transitions/validation, Living Library, hidden Commune compatibility routing, and Forge README at desktop/mobile widths.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

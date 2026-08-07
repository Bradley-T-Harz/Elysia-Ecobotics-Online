import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"], [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".png", "image/png"],
  [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"],
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
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentTypes.get(extension) ?? "application/octet-stream" });
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
assert(address && typeof address === "object", "Living Library browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;

async function settle(page, selector = ".living-library-page") {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(200);
}

async function resultIds(page) {
  return page.locator(".library-result-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-source-id")));
}

async function exercise(browserType, browserName, viewportName, viewport) {
  const browser = await browserType.launch({ headless: true });
  const consoleErrors = [];
  const failedRequests = [];
  try {
    const context = await browser.newContext({ viewport, colorScheme: "dark" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "failed"}`));

    await page.goto(`${origin}/living-library`, { waitUntil: "domcontentloaded" });
    await settle(page);
    assert.equal(await page.getByRole("heading", { level: 1, name: "The Living Library" }).isVisible(), true, `${browserName}/${viewportName}: landing heading missing.`);
    assert.equal(await page.getByRole("search").count(), 1, `${browserName}/${viewportName}: expected one primary search region.`);
    assert.equal(await page.locator(".library-result-card").count(), 12, `${browserName}/${viewportName}: landing must mount only the first 12 source cards.`);
    const structure = await page.evaluate(() => ({
      nodes: document.querySelectorAll("*").length,
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert(structure.nodes < 2_500, `${browserName}/${viewportName}: landing DOM is too large (${structure.nodes} nodes).`);
    assert(structure.overflow <= 1, `${browserName}/${viewportName}: landing has horizontal overflow (${structure.overflow}px).`);

    await page.getByRole("link", { name: /Browse by field/ }).click();
    await page.waitForURL((url) => url.hash === "#library-browse");
    await page.waitForTimeout(300);
    const browsePosition = await page.evaluate(() => ({
      headerBottom: document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0,
      targetTop: document.querySelector("#library-browse")?.getBoundingClientRect().top ?? -1,
    }));
    assert(browsePosition.targetTop >= browsePosition.headerBottom + 4, `${browserName}/${viewportName}: browse target is hidden beneath the sticky header (${JSON.stringify(browsePosition)}).`);
    await page.evaluate(() => scrollTo(0, 0));

    const search = page.getByLabel("Search scientific resources");
    await search.fill("atmospheric");
    await page.getByRole("button", { name: "Search the library" }).click();
    await page.waitForURL((url) => url.pathname === "/living-library" && url.searchParams.get("q") === "atmospheric");
    await settle(page, "#library-results");
    const atmospheric = await resultIds(page);
    assert(atmospheric.includes("nasa-earthdata"), `${browserName}/${viewportName}: atmospheric must surface NASA Earthdata.`);
    assert(atmospheric.some((id) => id?.includes("noaa")), `${browserName}/${viewportName}: atmospheric must surface NOAA.`);
    assert(atmospheric.some((id) => id?.includes("air") || id?.includes("epa") || id?.includes("firms")), `${browserName}/${viewportName}: atmospheric must surface air-quality or wildfire infrastructure.`);
    assert.equal(await page.locator("#library-results h2").evaluate((element) => element === document.activeElement), true, `${browserName}/${viewportName}: committed search must focus the results heading.`);

    for (const [query, expectedId] of [
      ["peer reviewed", "pubmed"], ["preprint", "arxiv"], ["DOI", "crossref"],
      ["genomics", "ncbi-datasets"], ["materials", "materials-project"], ["hydrology", "usgs-epa-water-quality-portal"],
      ["repository finder", "re3data"], ["African journals", "ajol"], ["doctoral thesis India", "shodhganga"],
      ["long term ecology", "lter-network"], ["GNSS", "earthscope-consortium"], ["marine biodiversity", "obis"],
      ["clinical trial", "clinicaltrials-gov"], ["high energy physics", "cern-open-data"],
      ["space telescope data", "mast"], ["special functions", "nist-dlmf"],
      ["DOE research", "osti-gov"], ["science textbook", "openstax"], ["AI models", "hugging-face-hub"],
    ]) {
      await search.fill(query);
      await page.getByRole("button", { name: "Search the library" }).click();
      await page.waitForURL((url) => url.searchParams.get("q") === query);
      await settle(page, "#library-results");
      assert((await resultIds(page)).includes(expectedId), `${browserName}/${viewportName}: ${query} must surface ${expectedId}.`);
    }

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.searchParams.get("q") === "science textbook");
    assert((await resultIds(page)).includes("openstax"), `${browserName}/${viewportName}: Back must restore science-textbook results.`);
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.searchParams.get("q") === "AI models");

    const filters = page.locator(".library-filter-panel");
    await filters.locator("summary").click();
    assert.equal(await filters.getAttribute("open"), "", `${browserName}/${viewportName}: filters must expand.`);
    await filters.getByLabel("API access").selectOption("open/no credential");
    await page.waitForURL((url) => url.searchParams.get("api") === "open/no credential");
    assert((await resultIds(page)).length > 0, `${browserName}/${viewportName}: structured API filter returned no visible results.`);
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await page.waitForURL((url) => url.pathname === "/living-library" && !url.search);

    const firstBrowseLink = page.locator(".library-browse-grid a").first();
    const browsePath = new URL(await firstBrowseLink.getAttribute("href"), origin).pathname;
    await firstBrowseLink.click();
    await page.waitForURL((url) => url.pathname === browsePath);
    await settle(page, "#library-results");
    assert((await resultIds(page)).length > 0, `${browserName}/${viewportName}: browse route returned no cards.`);
    assert.equal(await page.locator("#library-results h2").evaluate((element) => element === document.activeElement), true, `${browserName}/${viewportName}: browse route must focus results.`);

    await page.goto(`${origin}/living-library/source/nasa-earthdata`, { waitUntil: "domcontentloaded" });
    await settle(page, "#library-source-detail");
    assert.equal(await page.getByText("Account, API, download, and cloud", { exact: true }).isVisible(), true, `${browserName}/${viewportName}: structured access section missing.`);
    assert.equal(await page.getByText("Rights are record-specific", { exact: true }).isVisible(), true, `${browserName}/${viewportName}: licensing section missing.`);
    const external = page.locator("a.library-external-link").first();
    assert.equal(await external.getAttribute("target"), "_blank", `${browserName}/${viewportName}: external destination must open a new tab.`);
    assert.match(await external.getAttribute("aria-label"), /external site, opens in a new tab/, `${browserName}/${viewportName}: external destination needs an accessible boundary label.`);

    await page.getByRole("button", { name: "Save to shelf" }).click();
    assert.equal(await page.getByRole("button", { name: "Saved to shelf" }).getAttribute("aria-pressed"), "true", `${browserName}/${viewportName}: saved source state is not exposed.`);
    await page.getByRole("button", { name: "Create citation" }).click();
    await page.locator(".library-citation-panel").waitFor({ state: "visible" });
    assert.equal(await page.locator("#library-citation-title").evaluate((element) => element === document.activeElement), true, `${browserName}/${viewportName}: citation panel must announce and focus its heading.`);
    assert.match(await page.locator(".library-citation-date").innerText(), /Access date generated at this citation action: \d{4}-\d{2}-\d{2}/, `${browserName}/${viewportName}: citation must show action-time access date.`);
    await page.getByRole("button", { name: "Save citation locally" }).click();
    const stored = await page.evaluate(() => ({
      ids: JSON.parse(localStorage.getItem("elysiaLivingLibrary.savedSources.v1") ?? "[]"),
      citations: JSON.parse(localStorage.getItem("elysiaLivingLibrary.savedCitationRecords.v2") ?? "[]"),
    }));
    assert(stored.ids.includes("nasa-earthdata"), `${browserName}/${viewportName}: v1 saved-source compatibility key not preserved.`);
    assert.equal(stored.citations[0]?.sourceId, "nasa-earthdata", `${browserName}/${viewportName}: v2 citation record missing.`);
    assert.match(stored.citations[0]?.citationText ?? "", /Accessed \d{4}-\d{2}-\d{2}/, `${browserName}/${viewportName}: stored citation lacks its action-time date.`);

    await page.goto(`${origin}/living-library/source/hugging-face-datasets`, { waitUntil: "domcontentloaded" });
    await settle(page, "#library-source-detail");
    const family = page.locator('[aria-labelledby="library-source-family-heading"]');
    assert.equal(await family.getByText("Resource family", { exact: true }).isVisible(), true, `${browserName}/${viewportName}: parent/child resource family is missing.`);
    assert.equal(await family.getByRole("link", { name: "Hugging Face Hub", exact: true }).isVisible(), true, `${browserName}/${viewportName}: Hugging Face parent link is missing.`);

    await page.goto(`${origin}/living-library/source/ndltd`, { waitUntil: "domcontentloaded" });
    await settle(page, "#library-source-detail");
    assert.equal(await page.getByText(/former Global ETD Search is currently offline/).isVisible(), true, `${browserName}/${viewportName}: NDLTD's offline search status is not visible.`);
    assert.equal(await page.locator('a[href*="search.ndltd.org"]').count(), 0, `${browserName}/${viewportName}: offline Global ETD Search endpoint must not be exposed.`);

    await page.goto(`${origin}/living-library/source/microsoft-academic-graph-legacy`, { waitUntil: "domcontentloaded" });
    await settle(page);
    assert.equal(await page.getByText("No longer in active discovery", { exact: true }).isVisible(), true, `${browserName}/${viewportName}: legacy route needs a visible tombstone warning.`);
    assert.equal(await page.getByRole("link", { name: /View historical context — external site/ }).isVisible(), true, `${browserName}/${viewportName}: retired route must label its surviving destination as historical context.`);
    assert.equal(await page.getByText("Historical context only; this is not a current active resource destination.", { exact: true }).isVisible(), true, `${browserName}/${viewportName}: retired route needs an explicit historical-link caution.`);

    if (viewportName === "mobile") {
      const mobileLayout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        actionColumns: getComputedStyle(document.querySelector(".library-detail-actions")).gridTemplateColumns,
      }));
      assert(mobileLayout.overflow <= 1, `${browserName}/mobile: source detail has horizontal overflow (${mobileLayout.overflow}px).`);
    }

    await page.goto(`${origin}/living-library?q=atmospheric`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.keyboard.press("Tab");
    const focusVisible = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && active !== document.body && getComputedStyle(active).outlineStyle !== "none");
    });
    assert(focusVisible, `${browserName}/${viewportName}: keyboard focus must remain visually discernible.`);

    assert.deepEqual(consoleErrors, [], `${browserName}/${viewportName}: console errors:\n${consoleErrors.join("\n")}`);
    assert.deepEqual(failedRequests, [], `${browserName}/${viewportName}: failed requests:\n${failedRequests.join("\n")}`);
    await context.close();
    return structure;
  } finally {
    await browser.close();
  }
}

const results = [];
for (const [browserType, browserName] of [[chromium, "chromium"], [firefox, "firefox"]]) {
  for (const [viewportName, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    results.push({ browserName, viewportName, ...(await exercise(browserType, browserName, viewportName, viewport)) });
  }
}

await new Promise((resolve) => server.close(resolve));
console.log(`Living Library browser smoke passed (${results.map((item) => `${item.browserName}/${item.viewportName}: ${item.nodes} nodes`).join(", ")}).`);

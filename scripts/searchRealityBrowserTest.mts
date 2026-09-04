import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Route } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
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

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

type ExternalMode = "empty" | "failure";

async function installExternalBoundary(context: BrowserContext, mode: ExternalMode, observations: string[]) {
  await context.route("**/*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    observations.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    if (url.hostname.endsWith(".supabase.co")) {
      if (mode === "failure") {
        return route.fulfill({
          status: 503,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ message: "synthetic_search_upstream_unavailable" }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: "[]" });
    }
    return route.fulfill({ status: 204, body: "" });
  });
}

function capturePageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

try {
  const observations: string[] = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await installExternalBoundary(context, "empty", observations);
  await context.addInitScript(() => {
    localStorage.setItem("commune.postDrafts.v1", JSON.stringify([{
      id: "synthetic-search-draft",
      title: "Synthetic Troubleshooting Draft",
      summary: "A browser-local diagnostic note for search qualification.",
      status: "local draft",
      postType: "troubleshooting",
      tags: "diagnostic",
    }]));
  });
  const page = await context.newPage();
  const pageErrors = capturePageErrors(page);

  await page.goto(`${origin}/living-library`, { waitUntil: "networkidle" });
  const librarySearch = page.getByLabel("Search scientific resources");
  assert.equal(await librarySearch.getAttribute("maxlength"), "160", "Living Library local query state must be bounded.");
  let beforeInteraction = observations.length;
  await librarySearch.fill("atmospheric");
  await page.getByRole("button", { name: "Search the library" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "atmospheric");
  await page.locator('[data-source-id="nasa-earthdata"]').waitFor({ state: "visible" });
  assert.equal(observations.length, beforeInteraction, "Living Library client search must not issue a server search request.");
  await librarySearch.fill("synthetic-no-result-term-zzzzzz");
  await page.getByRole("button", { name: "Search the library" }).click();
  await page.getByRole("heading", { name: "No active resources match this search" }).waitFor({ state: "visible" });

  await page.goto(`${origin}/marketplace/browse`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Browse Elysia add-ons" }).waitFor({ state: "visible" });
  const marketplaceSearch = page.getByLabel("Search", { exact: true });
  assert.equal(await marketplaceSearch.getAttribute("maxlength"), "160", "Marketplace local query state must be bounded.");
  beforeInteraction = observations.length;
  await marketplaceSearch.fill("codev");
  await page.getByRole("heading", { name: "Codev", exact: true }).waitFor({ state: "visible" });
  await marketplaceSearch.fill("synthetic-no-addon-zzzzzz");
  await page.getByText("No reviewed public add-ons match this view.", { exact: false }).waitFor({ state: "visible" });
  assert.equal(observations.length, beforeInteraction, "Marketplace filtering must not issue a server search request.");

  await page.goto(`${origin}/commune`, { waitUntil: "networkidle" });
  const communeSearch = page.getByLabel("Search keyword");
  assert.equal(await communeSearch.getAttribute("maxlength"), "160", "Commune local query state must be bounded.");
  beforeInteraction = observations.length;
  await communeSearch.fill("troubleshooting");
  await page.locator(".commune-draft-grid").getByRole("heading", { name: "Synthetic Troubleshooting Draft" }).waitFor({ state: "visible" });
  await communeSearch.fill("synthetic-no-zone-zzzzzz");
  await page.getByText("No local drafts match the active filters.", { exact: true }).waitFor({ state: "visible" });
  assert.equal(observations.length, beforeInteraction, "Commune filtering must not issue a server search request.");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false, "Search states must not overflow at 390px.");
  assert.deepEqual(pageErrors, [], `Search interactions raised page errors: ${pageErrors.join("; ")}`);
  await context.close();

  const failureObservations: string[] = [];
  const failureContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await installExternalBoundary(failureContext, "failure", failureObservations);
  const failurePage = await failureContext.newPage();
  const failureErrors = capturePageErrors(failurePage);
  await failurePage.goto(`${origin}/marketplace/browse`, { waitUntil: "networkidle" });
  await failurePage.getByRole("heading", { name: "Codev", exact: true }).waitFor({ state: "visible" });
  await failurePage.getByText(/query failed.*Showing only the exact static official Codev release record/i).waitFor({ state: "visible" });
  assert(failureObservations.some((entry) => entry.includes("supabase.co")), "The failure fixture must exercise the Marketplace upstream boundary.");
  assert.deepEqual(failureErrors, [], `Search upstream failure handling raised page errors: ${failureErrors.join("; ")}`);
  await failureContext.close();

  console.log("Search reality browser matrix passed: Library, Marketplace, and Commune local filtering; bounded inputs; relevant/empty/degraded states; mobile overflow; and no query-triggered server search.");
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

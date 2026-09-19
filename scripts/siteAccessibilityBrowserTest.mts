import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const contract = JSON.parse(await fs.readFile(path.join(root, "docs/navigation/route-preservation-contract.json"), "utf8"));
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

function materializePath(value: string) {
  return value
    .replaceAll(":roomSlug", "coding-cornucopia")
    .replaceAll(":postId", "a1100000-0000-4000-8000-000000000001")
    .replaceAll(":conversationId", "a1200000-0000-4000-8000-000000000001")
    .replaceAll(":publicHandle", "@synthetic-accessibility")
    .replaceAll(":categorySlug", "earth-environment")
    .replaceAll(":sourceId", "nasa-earthdata")
    .replaceAll(":step", "profile")
    .replaceAll(":slug", "building-elysia-in-public-without-building-a-surveillance-goblin")
    .replaceAll(":id", "synthetic-accessibility")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "synthetic-accessibility");
}

const smokePaths = [...new Set<string>(contract.routes
  .flatMap((route: { smokePaths?: string[] }) => route.smokePaths ?? [])
  .map(materializePath))]
  .filter((pathname) => pathname.startsWith("/") && !pathname.includes("*"));
assert.ok(smokePaths.length >= 168, "Accessibility must cover the current complete preservation smoke-path baseline.");

const mobilePaths = [
  "/", "/start-here", "/archive", "/marketplace", "/developer-forge", "/living-library", "/commune",
  "/commons-circle", "/products", "/lab", "/work-with-elysia-ecobotics", "/support",
  "/artisan-collective", "/story", "/build-log", "/about", "/mission", "/legal", "/admin",
];

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

async function installExternalBoundary(context: Awaited<ReturnType<typeof browser.newContext>>) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      return route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: "[]" });
    }
    return route.fulfill({ status: 204, body: "" });
  });
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await installExternalBoundary(desktop);
  const page = await desktop.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const inputPath of smokePaths) {
    pageErrors.length = 0;
    const response = await page.goto(`${origin}${inputPath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.equal(response?.status(), 200, `${inputPath} must retain an HTML entry response.`);
    await page.locator("#root > *").first().waitFor({ state: "visible" });
    await page.locator('a.skip-link[href="#main-content"]').waitFor({ state: "attached", timeout: 5_000 });
    try {
      await page.locator("main#main-content h1").first().waitFor({ state: "attached", timeout: 5_000 });
    } catch (error) {
      throw new Error(`${inputPath} did not settle to a main page heading.`, { cause: error });
    }
    const finalPath = new URL(page.url()).pathname;
    const observed = await page.evaluate(() => {
      const duplicateIds = [...document.querySelectorAll<HTMLElement>("[id]")]
        .map((node) => node.id)
        .filter((id, index, all) => all.indexOf(id) !== index);
      const missingAlt = [...document.querySelectorAll<HTMLImageElement>("img:not([alt])")]
        .map((node) => node.outerHTML.slice(0, 180));
      const unnamedControls = [...document.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea")]
        .filter((node) => {
          const labelledBy = (node.getAttribute("aria-labelledby") ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));
          const labels = "labels" in node && Boolean((node as HTMLInputElement).labels?.length);
          const inputValue = node instanceof HTMLInputElement && ["button", "submit", "reset"].includes(node.type) && Boolean(node.value);
          return !node.getAttribute("aria-label")
            && !labelledBy
            && !labels
            && !node.textContent?.trim()
            && !node.getAttribute("title")
            && !inputValue;
        })
        .map((node) => node.outerHTML.slice(0, 180));
      const main = document.querySelector<HTMLElement>("main#main-content.site-main");
      return {
        activeElement: document.activeElement?.tagName ?? null,
        duplicateIds,
        h1Count: document.querySelectorAll("main h1").length,
        mainCount: document.querySelectorAll("main").length,
        mainFocusable: main?.tabIndex === -1,
        missingAlt,
        skipCount: document.querySelectorAll<HTMLAnchorElement>('a.skip-link[href="#main-content"]').length,
        unnamedControls,
      };
    });
    assert.deepEqual(observed.duplicateIds, [], `${inputPath} -> ${finalPath} has duplicate IDs.`);
    assert.deepEqual(observed.missingAlt, [], `${inputPath} -> ${finalPath} has images without an explicit alt boundary.`);
    assert.deepEqual(observed.unnamedControls, [], `${inputPath} -> ${finalPath} has unnamed form controls.`);
    assert.equal(observed.mainCount, 1, `${inputPath} -> ${finalPath} must expose exactly one main landmark.`);
    assert.equal(observed.mainFocusable, true, `${inputPath} -> ${finalPath} must keep the skip target programmatically focusable: ${JSON.stringify(observed)}`);
    assert.equal(observed.skipCount, 1, `${inputPath} -> ${finalPath} must preserve one skip link.`);
    assert.equal(observed.h1Count, 1, `${inputPath} -> ${finalPath} must expose one main page heading.`);
    assert.deepEqual(pageErrors, [], `${inputPath} -> ${finalPath} raised an uncaught page error.`);
  }

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator("#root > *").first().waitFor({ state: "visible" });
  await page.locator('a.skip-link[href="#main-content"]').waitFor({ state: "attached", timeout: 5_000 });
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");
  const skipLink = page.locator("a.skip-link");
  await skipLink.waitFor({ state: "visible" });
  assert.equal(await skipLink.evaluate((node) => document.activeElement === node), true, "The skip link must be the first keyboard stop from the document boundary.");
  const visibleSkip = await skipLink.evaluate((node) => {
    const rectangle = node.getBoundingClientRect();
    return rectangle.width > 0 && rectangle.height >= 40 && rectangle.top >= 0 && rectangle.left >= 0;
  });
  assert.equal(visibleSkip, true, "The focused skip link must be visibly usable and touch-sized.");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#main-content" && document.activeElement?.id === "main-content");
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await installExternalBoundary(mobile);
  const mobilePage = await mobile.newPage();
  for (const inputPath of mobilePaths) {
    await mobilePage.goto(`${origin}${inputPath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await mobilePage.locator("#root > *").first().waitFor({ state: "visible" });
    await mobilePage.locator('a.skip-link[href="#main-content"]').waitFor({ state: "attached", timeout: 5_000 });
    const overflows = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    assert.equal(overflows, false, `${inputPath} must not introduce horizontal overflow at 390px.`);
  }
  await mobile.close();

  console.log(`Accessibility browser sweep passed for ${smokePaths.length} preserved paths, keyboard skip entry, and ${mobilePaths.length} mobile domain roots.`);
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

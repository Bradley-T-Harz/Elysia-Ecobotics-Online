import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
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
    let body = indexHtml;
    let extension = ".html";
    if (candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/") {
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
assert(address && typeof address === "object", "hidden-surface test server did not start");
const origin = `http://127.0.0.1:${address.port}`;

const hiddenPaths = [
  "/products",
  "/lab",
  "/commune",
  "/commune/rooms",
  "/commune/rooms/coding-cornucopia",
  "/commune/coding-cornucopia/review",
  "/commune/posts/00000000-0000-4000-8000-000000000001",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const backendRequests = [];
    const pageErrors = [];
    page.on("request", (request) => {
      if (/\.supabase\.co\//.test(request.url())) backendRequests.push(request.url());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const hiddenPath of hiddenPaths) {
      const response = await page.goto(`${origin}${hiddenPath}`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      assert.equal(response?.status(), 200, `${hiddenPath}: document status`);
      await page.waitForURL((url) => url.pathname === "/");
      await page.locator("main h1").first().waitFor({ state: "visible" });
      assert.equal(await page.locator('nav a[href="/products"], nav a[href="/lab"], nav a[href="/commune"]').count(), 0, `${hiddenPath}: hidden surface leaked into public navigation`);
      assert.equal(await page.getByText("Coming soon", { exact: true }).count(), 0, `${hiddenPath}: release promise leaked into public UI`);
    }

    assert.deepEqual(backendRequests, [], "hidden compatibility routes must not contact Supabase");
    assert.deepEqual(pageErrors, [], "hidden compatibility routes raised browser errors");
    await context.close();
  }
  console.log("Hidden release surfaces redirect safely without backend calls at desktop and mobile widths.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

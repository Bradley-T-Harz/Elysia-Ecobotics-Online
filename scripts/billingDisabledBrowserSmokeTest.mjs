import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

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
    if (pathname.startsWith("/api/billing/")) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }
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
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

const cases = [
  { path: "/marketplace/creator-studio", heading: "Creator Studio", disabledText: "Create an add-on" },
  { path: "/developer-forge", heading: "Developer Forge", disabledText: "Creator Studio" },
  { path: "/support", heading: "Keep the commons alive", disabledText: "Stripe" },
  { path: "/commons-circle/support-billing", heading: "Support & Billing", disabledText: "Billing disabled" },
  { path: "/marketplace/account", heading: "Cloud profile here. Local account stays local.", disabledText: "Sign in to view account licenses" },
];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  for (const testCase of cases) {
    const page = await context.newPage();
    const billingRequests = [];
    const pageErrors = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/billing/")) billingRequests.push(request.url());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: testCase.heading }).first().waitFor();
    await page.waitForTimeout(250);
    assert((await page.locator("body").innerText()).toLowerCase().includes(testCase.disabledText.toLowerCase()), `${testCase.path} lost its truthful disabled presentation.`);
    assert.deepEqual(billingRequests, [], `${testCase.path} probed an unpublished /api/billing endpoint.`);
    assert.deepEqual(pageErrors, [], `${testCase.path} emitted page errors: ${pageErrors.join(" | ")}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `${testCase.path} overflowed by ${overflow}px.`);
    await page.close();
  }
  await context.close();
  console.log("Disabled billing-client browser boundary passed: five affected routes issued zero /api/billing requests.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

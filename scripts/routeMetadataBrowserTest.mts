import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { routeMetadataForPath } from "../src/shared/navigation/routeMetadata.ts";

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
    .replaceAll(":publicHandle", "@synthetic-route-metadata")
    .replaceAll(":categorySlug", "earth-environment")
    .replaceAll(":sourceId", "nasa-earthdata")
    .replaceAll(":step", "profile")
    .replaceAll(":slug", "building-elysia-in-public-without-building-a-surveillance-goblin")
    .replaceAll(":id", "synthetic-route-metadata")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "synthetic-route-metadata");
}

const smokePaths = [...new Set<string>(contract.routes.flatMap((route: { smokePaths?: string[] }) => route.smokePaths ?? []).map(materializePath))]
  .filter((pathname) => pathname.startsWith("/") && !pathname.includes("*"));
assert.equal(smokePaths.length, 167);

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

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname.endsWith(".supabase.co")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await context.newPage();
  for (const inputPath of smokePaths) {
    await page.goto(`${origin}${inputPath}`, { waitUntil: "domcontentloaded" });
    await page.locator("#root > *").first().waitFor({ state: "visible" });
    await page.waitForTimeout(25);
    const finalPath = new URL(page.url()).pathname;
    const expected = routeMetadataForPath(finalPath);
    await page.waitForFunction((metadata) => {
      const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
      const canonicalUrl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "";
      return document.title === metadata.title
        && description === metadata.description
        && canonicalUrl === metadata.canonicalUrl;
    }, expected, { timeout: 5_000 });
    const observed = await page.evaluate(() => ({
      title: document.title,
      description: document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
      canonicalUrl: document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "",
    }));
    assert.equal(observed.title, expected.title, `${inputPath} -> ${finalPath} rendered the wrong title.`);
    assert.equal(observed.description, expected.description, `${inputPath} -> ${finalPath} rendered the wrong description.`);
    assert.equal(observed.canonicalUrl, expected.canonicalUrl, `${inputPath} -> ${finalPath} rendered the wrong canonical URL.`);
  }
  await context.close();
  console.log(`Route metadata browser sweep passed for ${smokePaths.length} preserved smoke paths.`);
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

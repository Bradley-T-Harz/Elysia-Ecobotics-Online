import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const contentTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript"],
  [".json", "application/json"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const candidate = path.join(dist, requestPath === "/" ? "index.html" : requestPath.replace(/^\//, ""));
  const file = candidate.startsWith(dist) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(dist, "index.html");
  response.writeHead(200, {
    "Cache-Control": file.endsWith(".html") ? "public, max-age=0, must-revalidate" : "public, max-age=31536000, immutable",
    "Content-Type": contentTypes.get(path.extname(file)) ?? "application/octet-stream",
  });
  fs.createReadStream(file).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`${origin}/archive`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Elysia Archive" }).waitFor();

  const reloaded = page.waitForNavigation({ waitUntil: "networkidle" });
  const firstWasCanceled = await page.evaluate(() => {
    const event = new CustomEvent("vite:preloadError", { cancelable: true, detail: new Error("synthetic stale chunk") });
    return !window.dispatchEvent(event);
  });
  assert.equal(firstWasCanceled, true, "The stale preload failure must be canceled before the automatic reload.");
  await reloaded;
  await page.getByRole("heading", { name: "Elysia Archive" }).waitFor();

  const secondWasCanceled = await page.evaluate(() => {
    const event = new CustomEvent("vite:preloadError", { cancelable: true, detail: new Error("synthetic repeated stale chunk") });
    return !window.dispatchEvent(event);
  });
  assert.equal(secondWasCanceled, true, "The repeated stale preload failure must be canceled before the visible recovery boundary.");
  await page.getByRole("heading", { name: "This page needs a fresh copy" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Reload current page" }).isVisible(), true);
  assert.equal(page.url(), `${origin}/archive`, "Recovery must preserve the current route.");

  console.log("Stale chunk recovery browser regression passed (one automatic reload, then visible loop-free recovery at the same route). ");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

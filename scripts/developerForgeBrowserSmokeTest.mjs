import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(
  path.join(root, "public/_headers"),
  "utf8",
);
const csp = headersSource
  .match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]
  ?.trim();
assert(
  csp,
  "The production Content-Security-Policy must be available for the browser regression test.",
);
assert(
  !csp.includes("'unsafe-eval'"),
  "Developer Forge must work without weakening CSP with unsafe-eval.",
);

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
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const candidate = path.resolve(dist, `.${pathname}`);
    const isSafeAsset =
      candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
    let body = indexHtml;
    let extension = ".html";
    if (isSafeAsset) {
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
      "Content-Security-Policy": csp,
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
assert(
  address && typeof address === "object",
  "Local regression server did not start.",
);
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const intakeZip = new JSZip();
intakeZip.file("manifest.json", JSON.stringify({
  schema_version: "1.0",
  addon_id: "developer.browser-intake",
  name: "Browser Intake",
  version: "0.1.0",
  description: "Synthetic browser regression package.",
  author: { name: "Regression Test", url: "https://example.com" },
  license: "MIT",
  entrypoints: [],
  permissions: ["public_docs_read"],
  compatibility: { elysia_min_version: "0.1.0", addon_api_version: "0.1" },
  runtime: { kind: "static", requires_network: false, requires_filesystem: false },
  security: { sandbox_required: false, network_domains: [], file_access: [] }
}, null, 2));
intakeZip.file("README.md", "# Browser Intake\n\nSynthetic regression package only.");
intakeZip.file("LICENSE", "MIT");
const intakeBytes = await intakeZip.generateAsync({ type: "nodebuffer" });
const blockedIntakeZip = new JSZip();
blockedIntakeZip.file("manifest.json", JSON.stringify({
  schema_version: "1.0",
  addon_id: "developer.blocked-browser-intake",
  name: "Blocked Browser Intake",
  version: "0.1.0"
}));
blockedIntakeZip.file(".env", "EXAMPLE_SECRET=must-not-transfer");
const blockedIntakeBytes = await blockedIntakeZip.generateAsync({ type: "nodebuffer" });

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 600,
    });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    const badResponses = [];
    const loadedScripts = [];
    const sandboxRequests = [];
    let currentPhase = "initial Developer Forge route";

    page.on("pageerror", (error) =>
      pageErrors.push(`${currentPhase}: ${error.stack || error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/sandbox/"))
        sandboxRequests.push(request.url());
    });
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(origin))
        failedRequests.push(
          `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
        );
    });
    page.on("response", (response) => {
      if (!response.url().startsWith(origin)) return;
      if (response.status() >= 400)
        badResponses.push(`${response.status()} ${response.url()}`);
      if (response.request().resourceType() === "script")
        loadedScripts.push({
          url: response.url(),
          status: response.status(),
          type: response.headers()["content-type"] ?? "",
        });
    });

    const response = await page.goto(`${origin}/developer-forge`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    assert.equal(
      response?.status(),
      200,
      "Developer Forge route must return the application document.",
    );
    await page
      .getByRole("heading", { name: "The Developer Forge", exact: true })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.locator("header").count(),
      1,
      "The application header must render.",
    );
    assert(
      (await page.locator("nav").count()) >= 2,
      "Site and Developer Forge navigation must render.",
    );
    assert.equal(
      await page.locator("footer").count(),
      1,
      "The application footer must render.",
    );
    assert(
      await page
        .getByText("The website never runs uploaded add-on code", {
          exact: false,
        })
        .isVisible(),
      "The no-execution boundary must remain visible.",
    );
    currentPhase = "create local draft";
    await page.goto(`${origin}/developer-forge/drafts/new`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Create blank manifest draft" }).click();
    await page.waitForFunction(() => {
      try { return (JSON.parse(localStorage.getItem("developerForge.localDrafts.v1") ?? "[]")?.length ?? 0) > 0; }
      catch { return false; }
    });
    currentPhase = "open draft workbench";
    await page.goto(`${origin}/developer-forge/drafts`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Package and repository intake" }).waitFor({ state: "visible" });
    assert(await page.getByText("Package or source bundle", { exact: true }).isVisible(), "Forge must expose .elysia-addon/ZIP/manifest intake.");
    assert(await page.getByText("Folder or repository", { exact: true }).isVisible(), "Forge must expose browser folder/repository intake.");
    const packageInput = page.locator('input[type="file"]:not([webkitdirectory])').last();
    currentPhase = "inspect inert package";
    await packageInput.setInputFiles({ name: "browser-intake.elysia-addon", mimeType: "application/vnd.elysia-addon+zip", buffer: intakeBytes });
    await page.getByText("3 files held in browser memory", { exact: false }).waitFor({ state: "visible" });
    assert(await page.getByText("no remote transfer occurred", { exact: false }).isVisible(), "Selecting a Forge package must remain local until separate confirmation.");
    const transferButton = page.getByRole("button", { name: "Transfer selected package privately" });
    assert(await transferButton.isDisabled(), "Private package transfer must require explicit disclosure confirmation.");
    assert(await page.getByText("will leave my computer", { exact: false }).isVisible(), "Forge private transfer disclosure is missing.");
    currentPhase = "refuse credential-bearing package";
    await packageInput.setInputFiles({ name: "blocked-browser-intake.elysia-addon", mimeType: "application/vnd.elysia-addon+zip", buffer: blockedIntakeBytes });
    await page.getByText(/\.env files are (?:blocked|not accepted)/i).first().waitFor({ state: "visible" });
    assert(await transferButton.isDisabled(), "A package with blocked credential-bearing material must not become transferable.");

    currentPhase = "open Marketplace Submit";
    await page.goto(`${origin}/marketplace/submit`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Submit a complete add-on source for review" }).waitFor({ state: "visible" });
    assert(await page.getByText("Package or source bundle", { exact: true }).isVisible(), "Marketplace Submit must expose package/source-bundle intake.");
    assert(await page.getByText("Folder or repository", { exact: true }).isVisible(), "Marketplace Submit must expose folder/repository intake.");
    assert(await page.getByText("Git repository URL (metadata only)", { exact: true }).isVisible(), "Marketplace Submit must label Git URLs as metadata-only.");
    assert(await page.getByRole("button", { name: "Submit private pending review" }).isDisabled(), "Remote Marketplace submission must be blocked without sign-in and confirmation.");
    assert(await page.getByText("Admin review reduces risk but does not guarantee safety", { exact: false }).isVisible(), "Marketplace submission review disclaimer is missing.");

    currentPhase = "open Marketplace Browse";
    await page.goto(`${origin}/marketplace/browse`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Browse Elysia add-ons" }).waitFor({ state: "visible" });
    assert(await page.getByRole("heading", { name: "Codev" }).isVisible(), "Codev official candidate must appear in the local fallback catalog.");
    assert(await page.getByRole("button", { name: "Candidate · not installable" }).isDisabled(), "Codev candidate must not expose a working install action.");
    for (const staleListing of ["Advanced PDF Parser", "Ollama Local Models", "SearXNG Research"]) {
      assert.equal(await page.getByText(staleListing, { exact: true }).count(), 0, `${staleListing} must not appear in the v1 Marketplace catalog.`);
    }
    assert.equal(
      await page
        .getByRole("button", { name: /^(run|execute|install|enable)$/i })
        .count(),
      0,
      "Developer Forge must not expose code execution or installation controls.",
    );
    assert.equal(
      sandboxRequests.length,
      0,
      `Developer Forge must not call the sandbox: ${sandboxRequests.join(", ")}`,
    );
    assert(
      loadedScripts.some(
        (asset) =>
          /\/assets\/developer-forge-[^/]+\.js$/.test(
            new URL(asset.url).pathname,
          ) &&
          asset.status === 200 &&
          asset.type.includes("javascript"),
      ),
      "The Developer Forge chunk must load successfully as JavaScript.",
    );
    assert.deepEqual(
      failedRequests,
      [],
      `Same-origin requests failed: ${failedRequests.join("\n")}`,
    );
    assert.deepEqual(
      badResponses,
      [],
      `Same-origin responses failed: ${badResponses.join("\n")}`,
    );
    assert.deepEqual(
      pageErrors,
      [],
      `Uncaught browser errors occurred: ${pageErrors.join("\n")}\nConsole: ${consoleErrors.join("\n")}\nFailed requests: ${failedRequests.join("\n")}\nBad responses: ${badResponses.join("\n")}`,
    );
    assert.deepEqual(
      consoleErrors,
      [],
      `Browser console errors occurred: ${consoleErrors.join("\n")}`,
    );
    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    assert(
      horizontalOverflow <= 1,
      `Developer Forge overflows horizontally by ${horizontalOverflow}px at ${viewport.width}px.`,
    );
    await context.close();
  }
  console.log(
    "Developer Forge CSP browser regression test passed at desktop and mobile widths.",
  );
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

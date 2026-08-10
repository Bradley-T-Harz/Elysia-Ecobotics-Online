import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = path.resolve(process.env.ELYSIA_COMMUNE_QUICK_ACCESS_EVIDENCE_DIR || "/tmp/elysia-commune-quick-access-browser-evidence");
await fs.mkdir(evidenceDir, { recursive: true });

const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "production CSP missing");
const contentTypes = new Map([[".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".js", "application/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"]]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = path.resolve(dist, `.${pathname}`);
    let body = indexHtml;
    let extension = ".html";
    if (candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/") {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); }
      } catch (error) {
        if (pathname.startsWith("/assets/")) throw error;
      }
    }
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Security-Policy": csp, "Content-Type": contentTypes.get(extension) ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const address = server.address();
assert(address && typeof address === "object", "browser server did not start");
const origin = `http://127.0.0.1:${address.port}`;
const jsonHeaders = { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };

async function installBackendFixtures(context) {
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: jsonHeaders, body: "" });
    let body = [];
    if (url.pathname.endsWith("/rest/v1/commune_realtime_rooms")) body = [];
    else if (url.pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) body = [];
    await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify(body) });
  });
}

const localFixtures = {
  "commune.postDrafts.v1": [{
    id: "quick-local-post",
    title: "Wetland notes for later",
    status: "draft_local",
    postType: "research_note",
    tags: "wetlands, local-first",
    summary: "A browser-local draft that has not entered an account-backed queue.",
  }],
  "commune.postRequests.v1": [{
    id: "quick-local-request",
    title: "Community mapping request draft",
    status: "pending_moderator_review_local",
    postType: "community_network",
    tags: "mapping, collaboration",
    summary: "Saved locally as a request draft; it has not been submitted for review.",
  }],
};

async function installLocalFixtures(context, populated) {
  if (!populated) return;
  await context.addInitScript((fixtures) => {
    for (const [key, value] of Object.entries(fixtures)) window.localStorage.setItem(key, JSON.stringify(value));
  }, localFixtures);
}

async function placeBelowHeader(page, selector) {
  await page.locator(selector).evaluate((element) => {
    const header = document.querySelector("header");
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - headerHeight - 16));
  });
  await page.waitForTimeout(100);
}

async function openLobby(page) {
  const response = await page.goto(`${origin}/commune`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, "Commune lobby document status");
  await page.locator(".commune-quick-access").waitFor();
}

async function verifyResponsiveState(browser, label, viewport, populated) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, deviceScaleFactor: 2 });
  await installBackendFixtures(context);
  await installLocalFixtures(context, populated);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => { if (request.url().startsWith(origin)) failedRequests.push(request.url()); });
  await openLobby(page);

  const selectors = ["#commune-lobby", ".commune-quick-access", "#commune-search", "#commune-redaction-checklist", "#commune-rooms", "#commune-feed"];
  const tops = await page.locator(selectors.join(",")).evaluateAll((items) => Object.fromEntries(items.map((item) => [item.id || item.className, item.getBoundingClientRect().top + window.scrollY])));
  const orderedTops = [tops["commune-lobby"], tops["commune-quick-access"], tops["commune-search"], tops["commune-redaction-checklist"], tops["commune-rooms"], tops["commune-feed"]];
  assert(orderedTops.every((top) => Number.isFinite(top)), `${label}: all preferred layout regions must exist`);
  assert(orderedTops.every((top, index) => index === 0 || orderedTops[index - 1] < top), `${label}: preferred top-to-feed order`);
  assert.equal(await page.locator(".commune-quick-access").count(), 1, `${label}: one quick-access composition`);
  assert.equal(await page.locator("#commune-quick-access-tools").count(), 1, `${label}: one chat/code tools panel`);
  assert.equal(await page.locator("#commune-local-drafts").count(), 1, `${label}: one local-drafts panel`);
  assert.equal(await page.locator("#commune-feed ~ #commune-quick-access-tools, #commune-feed ~ #commune-local-drafts").count(), 0, `${label}: no lower duplicate utilities`);

  assert.equal(await page.getByRole("link", { name: "Open live room chat" }).getAttribute("href"), "/commune/realtime", `${label}: canonical live chat route`);
  assert.equal(await page.getByRole("link", { name: "Coding workbench" }).getAttribute("href"), "/commune/coding-cornucopia/review#coding-workbench-heading", `${label}: canonical workbench route`);
  assert.equal(await page.getByRole("link", { name: "Sandbox request" }).getAttribute("href"), "/commune/coding-cornucopia/sandbox-request", `${label}: canonical sandbox route`);
  assert.equal(await page.getByText("Local drafts and saved request drafts", { exact: true }).count(), 1, `${label}: truthful local heading`);
  assert.equal(await page.getByText(/has not been submitted to an account-backed review queue/).count(), 1, `${label}: local request boundary`);
  assert.equal(await page.getByText("Local drafts and pending review requests", { exact: true }).count(), 0, `${label}: misleading pending-review claim removed`);
  assert.equal(await page.locator(".commune-feed-room-section").count(), 10, `${label}: ten-room grouped feed retained`);

  if (populated) {
    assert.equal(await page.locator("#commune-local-drafts .commune-draft-grid article").count(), 2, `${label}: populated browser-local drafts`);
    assert.equal(await page.getByRole("heading", { name: "Wetland notes for later" }).count(), 1, `${label}: local post draft visible`);
    assert.equal(await page.getByRole("heading", { name: "Community mapping request draft" }).count(), 1, `${label}: local request draft visible`);
    assert.equal(await page.locator("#commune-local-drafts").getByText("local request draft", { exact: true }).count(), 1, `${label}: local request is not presented as submitted review work`);
    assert.equal(await page.locator("#commune-local-drafts").getByText("pending moderator review local", { exact: true }).count(), 0, `${label}: internal local status is not shown as account-backed moderation`);
  } else {
    assert.equal(await page.getByText("No browser-local drafts or request drafts yet.", { exact: true }).count(), 1, `${label}: empty local state`);
  }

  const toolColumns = await page.locator("#commune-quick-access-tools").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter((value) => Number.parseFloat(value) > 1).length);
  assert.equal(toolColumns, viewport.width < 600 ? 1 : 2, `${label}: responsive tools column count`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
  assert.deepEqual(pageErrors, [], `${label}: uncaught browser errors`);
  assert.deepEqual(consoleErrors, [], `${label}: console errors`);
  assert.deepEqual(failedRequests, [], `${label}: first-party request failures`);

  const captures = [
    ["01-lobby-and-quick-access", "#commune-lobby"],
    ["02-live-chat-card", "#commune-quick-access-tools article:nth-child(1)"],
    ["03-code-and-sandbox-card", "#commune-quick-access-tools article:nth-child(2)"],
    ["04-local-drafts", "#commune-local-drafts"],
    ["05-search-redaction", "#commune-search"],
    ["06-grouped-feed", "#commune-feed"],
  ];
  for (const [file, selector] of captures) {
    await placeBelowHeader(page, selector);
    await page.screenshot({ path: path.join(evidenceDir, `${label}-${file}.png`), fullPage: false, animations: "disabled" });
  }
  await context.close();
}

async function verifyEntryRoutes(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await installBackendFixtures(context);
  const page = await context.newPage();

  await openLobby(page);
  await page.getByRole("link", { name: "Open live room chat" }).click();
  await page.waitForURL((url) => url.pathname === "/commune/realtime");
  await page.getByRole("heading", { name: "Governed live chat rooms" }).waitFor();
  assert.equal(await page.getByText("Signed-in users only may post. Everyone sees only published messages allowed by RLS.", { exact: true }).count(), 1, "logged-out realtime boundary");
  assert.equal(await page.getByLabel("Plain-text message").isDisabled(), true, "logged-out realtime composer disabled");
  assert.equal(await page.getByText("no private DMs", { exact: true }).count() > 0, true, "realtime no-DM boundary");
  assert.equal(await page.getByText("no file uploads", { exact: true }).count() > 0, true, "realtime no-upload boundary");
  assert.equal(await page.getByText("no code execution", { exact: true }).count() > 0, true, "realtime no-execution boundary");
  await placeBelowHeader(page, "#commune-realtime-chat");
  await page.screenshot({ path: path.join(evidenceDir, "entry-live-chat-logged-out.png"), fullPage: false, animations: "disabled" });

  await openLobby(page);
  await page.getByRole("link", { name: "Coding workbench" }).click();
  await page.waitForURL((url) => url.pathname === "/commune/coding-cornucopia/review" && url.hash === "#coding-workbench-heading");
  await page.locator("#coding-workbench-heading").waitFor();
  assert.equal(await page.getByText(/Real execution is allowed only from explicit snapshots/).count(), 1, "workbench execution boundary");
  await placeBelowHeader(page, "#commune-code-review");
  await page.screenshot({ path: path.join(evidenceDir, "entry-coding-workbench.png"), fullPage: false, animations: "disabled" });

  await openLobby(page);
  await page.getByRole("link", { name: "Sandbox request" }).click();
  await page.waitForURL((url) => url.pathname === "/commune/coding-cornucopia/sandbox-request");
  await page.getByRole("heading", { name: "Prepare a Local Elysia handoff request." }).waitFor();
  assert.equal(await page.getByText(/website does not execute code, install dependencies, clone repositories/).count(), 1, "sandbox no-execution boundary");
  await page.getByRole("button", { name: "Save account draft" }).click();
  await page.getByText("Sign in to save sandbox request drafts.", { exact: true }).waitFor();
  await placeBelowHeader(page, "#commune-sandbox-review");
  await page.screenshot({ path: path.join(evidenceDir, "entry-sandbox-request-logged-out.png"), fullPage: false, animations: "disabled" });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `entry routes horizontal overflow ${overflow}px`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyResponsiveState(browser, "desktop-1600-populated", { width: 1600, height: 1000 }, true);
  await verifyResponsiveState(browser, "half-screen-900-populated", { width: 900, height: 900 }, true);
  await verifyResponsiveState(browser, "mobile-390-populated", { width: 390, height: 844 }, true);
  await verifyResponsiveState(browser, "desktop-1600-empty", { width: 1600, height: 1000 }, false);
  await verifyEntryRoutes(browser);
  console.log(`Commune quick-access browser regression passed. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

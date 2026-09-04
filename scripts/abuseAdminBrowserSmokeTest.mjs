import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "The production Content-Security-Policy must be available.");

let projectRef = "";
for (const assetName of (await fs.readdir(path.join(dist, "assets"))).filter((name) => name.endsWith(".js"))) {
  const source = await fs.readFile(path.join(dist, "assets", assetName), "utf8");
  const match = source.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match) { projectRef = match[1]; break; }
}
assert(projectRef, "The production-equivalent build must contain its configured public Supabase origin.");

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
        if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); }
      } catch (error) {
        if (pathname.startsWith("/assets/")) throw error;
      }
    }
    response.writeHead(200, {
      "Cache-Control": "no-store", "Content-Security-Policy": csp,
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
assert(address && typeof address === "object", "Local browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const administratorId = "aa000000-0000-4000-8000-000000000001";
const actorId = "aa000000-0000-4000-8000-000000000002";
const decisionId = "aa000000-0000-4000-8000-000000000003";
const fixtureUser = {
  id: administratorId, aud: "authenticated", role: "authenticated",
  email: "abuse-admin-fixture@example.invalid", app_metadata: {}, user_metadata: {},
  created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z",
};
const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: administratorId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureSession = { access_token: accessToken, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser };
const operationalOverviewFixture = {
  generatedAt: "2026-09-04T12:00:00.000Z",
  scope: "database_aggregate_only",
  administratorOnly: true,
  metrics: [
    ["account_lifecycle_open", "identity", "Open account lifecycle requests", 0, null, "clear"],
    ["account_delivery_attention", "notifications", "Account delivery work", 0, null, "clear"],
    ["account_support_open", "identity", "Open account support conversations", 0, null, "clear"],
    ["review_queue_open", "review", "Open shared review items", 3, "2026-09-04T10:00:00.000Z", "attention"],
    ["forge_scan_attention", "developer_forge", "Add-on packages needing scan attention", 0, null, "clear"],
    ["badge_suppressions_active", "badges", "Active badge suppressions", 0, null, "clear"],
    ["online_abuse_unreviewed", "abuse", "Unreviewed active velocity decisions", 2, "2026-09-04T11:00:00.000Z", "attention"],
    ["sandbox_runs_inflight", "sandbox", "Hosted sandbox runs in flight", 0, null, "clear"],
    ["sandbox_credit_holds", "sandbox_credits", "Hosted execution allowance holds", 1, "2026-09-04T11:30:00.000Z", "critical"],
    ["economic_reconciliation_open", "economic_operations", "Open economic reconciliation cases", 0, null, "clear"],
    ["economic_delivery_attention", "economic_operations", "Economic notification work", 0, null, "clear"],
    ["artisan_media_attention", "artisan", "Artisan media processing work", 0, null, "clear"],
  ].map(([key, domain, label, count, oldestAt, state]) => ({ key, domain, label, count, oldestAt, state })),
  externalBoundaries: [
    { key: "cloudflare_controls", label: "Cloudflare controls and alerts", state: "unknown_pending_purpose_scoped_inspection", boundary: "Not observed by this database projection." },
    { key: "sandbox_host", label: "Hosted sandbox operating host", state: "bounded_credential_checkpoint", boundary: "Host isolation and service health require the separate production acceptance gate." },
    { key: "notification_provider", label: "External notification delivery provider", state: "not_observed_by_database", boundary: "An empty outbox does not prove provider delivery health." },
    { key: "stripe", label: "Stripe live financial flows", state: "disabled_pending_review", boundary: "No live financial activation is performed or inferred here." },
    { key: "media_providers", label: "External media providers", state: "not_observed_by_database", boundary: "Database jobs do not prove provider availability or licensing state." },
  ],
};

function responseHeaders() {
  return { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
}

async function installFixtures(context, { administrator, captures, overviewMode = "valid" }) {
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = responseHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    if (url.pathname.endsWith("/rest/v1/user_roles")) return route.fulfill({ status: 200, headers, body: JSON.stringify([{ role: administrator ? "administrator" : "reviewer" }]) });
    if (url.pathname.endsWith("/rest/v1/profiles")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ is_admin: administrator }) });
    if (url.pathname.includes("/rest/v1/rpc/")) {
      const rpc = url.pathname.split("/").at(-1);
      const payload = request.postDataJSON();
      captures.push({ rpc, payload });
      if (rpc === "current_admin_operational_overview" && overviewMode === "invalid") return route.fulfill({ status: 200, headers, body: "{}" });
      if (rpc === "current_admin_operational_overview") return route.fulfill({ status: 200, headers, body: JSON.stringify(operationalOverviewFixture) });
      if (rpc === "online_abuse_decision_summary") return route.fulfill({ status: 200, headers, body: JSON.stringify([{
        decision_id: decisionId,
        actor_user_id: actorId,
        action: "participation_request",
        resource_domain: "work",
        resource_type: "work_with_requests",
        policy_key: "participation_request_create",
        decision: "restricted",
        reason_class: "velocity_limit_reached",
        decided_at: "2026-09-04T00:00:00.000Z",
        expires_at: "2099-09-04T01:00:00.000Z",
        review_state: "unreviewed",
        reviewed_at: null,
        reviewed_by: null,
        private_review_note: null,
      }]) });
      if (rpc === "review_online_abuse_decision") return route.fulfill({ status: 200, headers, body: JSON.stringify({ decisionId, reviewState: "escalated", reviewedAt: "2026-09-04T00:05:00.000Z" }) });
      return route.fulfill({ status: 200, headers, body: "[]" });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

async function waitForRpc(page, captures, name) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (captures.some(({ rpc }) => rpc === name)) return;
    await page.waitForTimeout(20);
  }
  assert.fail(`Abuse Admin browser flow did not call ${name}.`);
}

async function runCase(browser, { administrator, viewport }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  const captures = [];
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    window.__elysiaCspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => window.__elysiaCspViolations.push({ directive: event.effectiveDirective, blockedUri: event.blockedURI }));
  }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  await installFixtures(context, { administrator, captures });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(`${origin}/admin/audit`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Audit Trail" }).waitFor();

  if (!administrator) {
    await page.getByRole("heading", { name: "Administrator authority required" }).waitFor();
    assert(!captures.some(({ rpc }) => rpc === "online_abuse_decision_summary"), "A non-administrator requested private restriction decisions.");
  } else {
    await page.getByRole("heading", { name: "Action-velocity decisions" }).waitFor();
    await page.getByText(actorId, { exact: true }).waitFor();
    await page.getByText("They do not contain request bodies", { exact: false }).waitFor();
    await page.getByLabel(`Review state for ${decisionId}`).selectOption("escalated");
    await page.getByLabel(`Private review note for ${decisionId}`).fill("Escalated after bounded fixture review.");
    await page.getByRole("button", { name: "Save restriction review" }).click();
    await waitForRpc(page, captures, "review_online_abuse_decision");
    const review = captures.find(({ rpc }) => rpc === "review_online_abuse_decision")?.payload;
    assert.deepEqual(review, {
      p_decision_id: decisionId,
      p_review_state: "escalated",
      p_private_review_note: "Escalated after bounded fixture review.",
    });
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Abuse Admin overflowed by ${overflow}px at ${viewport.width}px.`);
  assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations), [], "Abuse Admin triggered CSP violations.");
  assert.deepEqual(pageErrors, [], `Abuse Admin page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `Abuse Admin console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

async function runOverviewCase(browser, { administrator, viewport, overviewMode = "valid" }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  const captures = [];
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    window.__elysiaCspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => window.__elysiaCspViolations.push({ directive: event.effectiveDirective, blockedUri: event.blockedURI }));
  }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  await installFixtures(context, { administrator, captures, overviewMode });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Governance Console" }).waitFor();

  if (!administrator) {
    await page.getByRole("heading", { name: "Administrator authority required" }).waitFor();
    assert(!captures.some(({ rpc }) => rpc === "current_admin_operational_overview"), "A non-administrator requested the cross-domain operational overview.");
  } else if (overviewMode === "invalid") {
    await page.getByText("The operational overview returned an invalid or unexpected aggregate shape.", { exact: true }).waitFor();
    assert.equal(captures.filter(({ rpc }) => rpc === "current_admin_operational_overview").length, 1, "Invalid operational response produced unexpected retries.");
    assert.equal(await page.getByRole("heading", { name: "Unreviewed active velocity decisions" }).count(), 0, "A degraded operational response rendered metric data.");
  } else {
    await page.getByRole("heading", { name: "Operational attention overview" }).waitFor();
    await waitForRpc(page, captures, "current_admin_operational_overview");
    const abuseMetric = page.locator("article.feature-card").filter({ hasText: "Unreviewed active velocity decisions" });
    await abuseMetric.getByText("2", { exact: true }).waitFor();
    await page.getByText("Stripe live financial flows", { exact: true }).waitFor();
    await page.getByText("disabled pending review", { exact: true }).waitFor();
    await page.getByText("A clear database queue is not proof", { exact: false }).waitFor();
    assert(!/abuse-admin-fixture@example\.invalid|aa000000-/i.test(await page.locator('[aria-labelledby="operational-overview-title"]').innerText()), "Operational overview rendered fixture record identifiers.");
    await page.getByRole("button", { name: "Refresh overview" }).click();
    for (let attempt = 0; attempt < 100 && captures.filter(({ rpc }) => rpc === "current_admin_operational_overview").length < 2; attempt += 1) {
      await page.waitForTimeout(20);
    }
    assert.equal(captures.filter(({ rpc }) => rpc === "current_admin_operational_overview").length, 2, "Operational overview refresh did not make exactly one additional request.");
    for (const request of captures.filter(({ rpc }) => rpc === "current_admin_operational_overview")) {
      assert.deepEqual(request.payload, {}, "Operational overview request unexpectedly carried parameters.");
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Operational overview overflowed by ${overflow}px at ${viewport.width}px.`);
  assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations), [], "Operational overview triggered CSP violations.");
  assert.deepEqual(pageErrors, [], `Operational overview page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `Operational overview console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runCase(browser, { administrator: true, viewport: { width: 1280, height: 1000 } });
  await runCase(browser, { administrator: true, viewport: { width: 390, height: 844 } });
  await runCase(browser, { administrator: false, viewport: { width: 390, height: 844 } });
  await runOverviewCase(browser, { administrator: true, viewport: { width: 1280, height: 1000 } });
  await runOverviewCase(browser, { administrator: true, viewport: { width: 390, height: 844 } });
  await runOverviewCase(browser, { administrator: true, viewport: { width: 390, height: 844 }, overviewMode: "invalid" });
  await runOverviewCase(browser, { administrator: false, viewport: { width: 390, height: 844 } });
  console.log("Abuse administration browser smoke test ok.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

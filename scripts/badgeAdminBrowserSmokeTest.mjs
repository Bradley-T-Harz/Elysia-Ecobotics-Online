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
const administratorId = "ba000000-0000-4000-8000-000000000001";
const targetId = "ba000000-0000-4000-8000-000000000002";
const evidenceId = "ba000000-0000-4000-8000-000000000003";
const reviewItemId = "ba000000-0000-4000-8000-000000000004";
const creditId = "ba000000-0000-4000-8000-000000000005";
const awardId = "ba000000-0000-4000-8000-000000000006";
const fixtureUser = {
  id: administratorId, aud: "authenticated", role: "authenticated",
  email: "badge-admin-fixture@example.invalid", app_metadata: {}, user_metadata: {},
  created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z",
};
const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: administratorId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureSession = { access_token: accessToken, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser };

function responseHeaders() {
  return { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
}

async function installFixtures(context, { administrator, captures }) {
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = responseHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    if (url.pathname.endsWith("/rest/v1/user_roles")) return route.fulfill({ status: 200, headers, body: JSON.stringify(administrator ? [{ role: "administrator" }] : []) });
    if (url.pathname.endsWith("/rest/v1/profiles")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ is_admin: administrator }) });
    if (url.pathname.endsWith("/rest/v1/badge_definitions")) return route.fulfill({ status: 200, headers, body: JSON.stringify([
      { badge_key: "free_member", name: "Free Member", description: "Completed Commons onboarding.", category: "membership", award_mode: "automatic", is_manual_only: false },
      { badge_key: "seed_sower", name: "Seed Sower", description: "Reviewed source contribution.", category: "contribution", award_mode: "review_triggered", is_manual_only: false },
    ]) });
    if (url.pathname.endsWith("/rest/v1/badge_rules")) return route.fulfill({ status: 200, headers, body: JSON.stringify([
      { badge_slug: "seed_sower", rule_type: "credit_count", required_credit_type: "source_contribution", required_count: 1, required_credit_sum: null, requires_major: false, distinct_subject_min: null, description: "One reviewed source contribution." },
    ]) });
    if (url.pathname.endsWith("/rest/v1/user_badges")) return route.fulfill({ status: 200, headers, body: JSON.stringify([
      { id: awardId, user_id: targetId, badge_key: "seed_sower", awarded_at: "2026-09-04T00:00:00.000Z", award_source: "credit_rule", visibility: "public", revoked_at: null },
    ]) });
    if (url.pathname.includes("/rest/v1/rpc/")) {
      const rpc = url.pathname.split("/").at(-1);
      const payload = request.postDataJSON();
      captures.push({ rpc, payload });
      if (rpc === "badge_administration_timeline") return route.fulfill({ status: 200, headers, body: JSON.stringify({
        targetUserId: targetId, badgeKey: "seed_sower",
        awards: [{ id: awardId, user_id: targetId, badge_key: "seed_sower", awarded_at: "2026-09-04T00:00:00.000Z", award_source: "credit_rule", visibility: "public", revoked_at: "2026-09-04T00:05:00.000Z", awarded_by: administratorId, award_reason: "Rule qualification", evidence_type: "badge_credit_rule", evidence_id: creditId, revoked_by: administratorId, revoked_reason: "Evidence correction", created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:05:00.000Z" }],
        credits: [{ id: creditId, credit_type: "source_contribution", credit_amount: 1, contribution_type: "living_library_source_suggestions", contribution_id: evidenceId, review_item_id: reviewItemId, awarded_by: administratorId, awarded_at: "2026-09-04T00:00:00.000Z", is_major: false, distinct_subject_key: null, notes: "Reviewed evidence", revoked_at: null, revoked_by: null, revoked_reason: null }],
        suppressions: [{ id: "ba000000-0000-4000-8000-000000000007", badge_key: "seed_sower", suppressed_by: administratorId, suppressed_at: "2026-09-04T00:05:00.000Z", reason: "Evidence correction", lifted_by: null, lifted_at: null, lift_reason: null }],
        auditEvents: [{ id: "ba000000-0000-4000-8000-000000000008", actor_user_id: administratorId, action: "badge_revoked", badge_slug: "seed_sower", credit_event_id: null, evidence_type: "badge_credit_rule", evidence_id: creditId, metadata: { reason: "Evidence correction" }, created_at: "2026-09-04T00:05:00.000Z" }],
      }) });
      if (rpc === "create_badge_credit_event") return route.fulfill({ status: 200, headers, body: JSON.stringify(creditId) });
      if (rpc === "restore_user_badge") return route.fulfill({ status: 200, headers, body: JSON.stringify({ restored: true }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify(true) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

async function waitForRpc(page, captures, name) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (captures.some(({ rpc }) => rpc === name)) return;
    await page.waitForTimeout(20);
  }
  assert.fail(`Badge Admin browser flow did not call ${name}.`);
}

async function waitForInputValue(page, label, expected) {
  const input = page.getByLabel(label);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await input.inputValue() === expected) return;
    await page.waitForTimeout(20);
  }
  assert.fail(`Badge Admin input ${label} did not settle to the expected state.`);
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
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`${origin}/admin/badges`, { waitUntil: "networkidle" });

  if (!administrator) {
    await page.getByRole("heading", { name: "Review access required" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Badge Management" }).count(), 0, "A non-administrator must not receive badge management.");
  } else {
    await page.getByRole("heading", { name: "Badge Management" }).waitFor();
    await page.getByText("Seed Sower", { exact: true }).first().waitFor();
    assert.equal(await page.getByRole("heading", { name: "Active qualification rules" }).count(), 1);

    const manual = page.getByRole("heading", { name: "Manual badge grant" }).locator("xpath=ancestor::div[contains(@class,'section-card')][1]");
    await manual.getByLabel("Target user auth UUID").fill(targetId);
    await manual.getByLabel("Badge").selectOption("seed_sower");
    await manual.getByLabel("Audited reason").fill("Verified manual recognition reason.");
    await manual.getByRole("button", { name: "Grant badge" }).click();

    const producer = page.getByRole("heading", { name: "Record reviewed contribution evidence" }).locator("xpath=ancestor::div[contains(@class,'section-card')][1]");
    await producer.getByLabel("Target user auth UUID").fill(targetId);
    await producer.getByLabel("Credit type").selectOption("source_contribution");
    await producer.getByLabel("Evidence/source table type").fill("living_library_source_suggestions");
    await producer.getByLabel("Evidence/source UUID").fill(evidenceId);
    await producer.getByLabel("Approved review-item UUID (optional for administrator)").fill(reviewItemId);
    await producer.getByLabel("Private review note").fill("Reviewed source evidence is authoritative.");
    await producer.getByRole("button", { name: "Record reviewed credit" }).click();

    const history = page.getByRole("heading", { name: "Per-account award, evidence, suppression, and audit history" }).locator("xpath=ancestor::section[1]");
    await history.getByLabel("Target user auth UUID").fill(targetId);
    await history.getByLabel("Badge filter").selectOption("seed_sower");
    await history.getByRole("button", { name: "Load private badge history" }).click();
    await history.getByText("Reviewed evidence", { exact: true }).waitFor();
    await page.getByLabel("Reason for the next revoke or restore action").fill("Correct reviewed evidence and retain audit history.");
    await history.getByRole("button", { name: "Revoke credit and re-evaluate" }).click();
    await waitForRpc(page, captures, "revoke_badge_credit_event");
    await waitForInputValue(page, "Reason for the next revoke or restore action", "");
    await page.getByLabel("Reason for the next revoke or restore action").fill("Restore recognition after verified correction.");
    await history.getByRole("button", { name: "Restore or re-evaluate badge" }).waitFor();
    await history.getByRole("button", { name: "Restore or re-evaluate badge" }).click();
    await waitForRpc(page, captures, "restore_user_badge");

    const rpcNames = captures.map(({ rpc }) => rpc);
    for (const expected of ["grant_user_badge", "create_badge_credit_event", "badge_administration_timeline", "revoke_badge_credit_event", "restore_user_badge"]) {
      assert(rpcNames.includes(expected), `Badge Admin browser flow did not call ${expected}.`);
    }
    const credit = captures.find(({ rpc }) => rpc === "create_badge_credit_event")?.payload;
    assert.equal(credit.p_target_user_id, targetId);
    assert.equal(credit.p_contribution_id, evidenceId);
    assert.equal(credit.p_review_item_id, reviewItemId);
    assert.equal(credit.p_credit_type, "source_contribution");
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Badge Admin overflowed by ${overflow}px at ${viewport.width}px.`);
  assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations), [], "Badge Admin triggered CSP violations.");
  assert.deepEqual(pageErrors, [], `Badge Admin page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `Badge Admin console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runCase(browser, { administrator: true, viewport: { width: 1280, height: 1000 } });
  await runCase(browser, { administrator: true, viewport: { width: 390, height: 844 } });
  await runCase(browser, { administrator: false, viewport: { width: 390, height: 844 } });
  console.log("Badge administration browser smoke test ok.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

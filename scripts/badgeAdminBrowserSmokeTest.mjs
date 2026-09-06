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
const selfAwardId = "ba000000-0000-4000-8000-000000000009";
const badgeCatalog = [
  ["free_member", "Free Member", "membership", "automatic", false],
  ["stewardship_supporter", "Stewardship Supporter", "stewardship", "automatic", false],
  ["water_steward", "Water Steward", "stewardship", "review_triggered", false],
  ["forest_steward", "Forest Steward", "stewardship", "review_triggered", false],
  ["reef_steward", "Reef Steward", "stewardship", "review_triggered", false],
  ["health_steward", "Health Steward", "stewardship", "review_triggered", false],
  ["knowledge_commons_supporter", "Knowledge Commons Supporter", "knowledge", "review_triggered", false],
  ["source_curator", "Source Curator", "knowledge", "review_triggered", false],
  ["troubleshooting_helper", "Troubleshooting Helper", "community", "review_triggered", false],
  ["developer_contributor", "Developer Contributor", "development", "review_triggered", false],
  ["founding_steward", "Founding Steward", "membership", "manual", true],
  ["guardian_reviewer", "Guardian Reviewer", "review", "manual", true],
  ["seed_sower", "Seed Sower", "contribution", "review_triggered", false],
  ["bridge_builder", "Bridge Builder", "community", "review_triggered", false],
  ["archive_warden", "Archive Warden", "knowledge", "review_triggered", false],
  ["forge_tester", "Forge Tester", "development", "review_triggered", false],
  ["field_witness", "Field Witness", "research", "review_triggered", false],
  ["radiant_scribe", "Radiant Scribe", "knowledge", "review_triggered", false],
  ["hearth_keeper", "Hearth Keeper", "community", "review_triggered", false],
  ["ecobotics_forgewright", "Ecobotics Forgewright", "development", "review_triggered", false],
  ["elysian_artwright", "Elysian Artwright", "art", "review_triggered", false],
  ["kindred_ally", "Kindred Ally", "community", "review_triggered", false],
  ["open_pathmaker", "Open Pathmaker", "community", "review_triggered", false],
  ["boundary_lantern", "Boundary Lantern", "review", "review_triggered", false],
].map(([badge_key, name, category, award_mode, is_manual_only]) => ({
  badge_key, name, category, award_mode, is_manual_only,
  description: `${name} governed recognition fixture.`,
}));
const badgeRules = badgeCatalog.map((definition, index) => ({
  badge_slug: definition.badge_key,
  rule_type: definition.is_manual_only ? "manual_only" : "credit_count",
  required_credit_type: definition.badge_key === "seed_sower" ? "source_contribution" : definition.is_manual_only ? null : `${definition.badge_key}_credit`,
  required_count: definition.is_manual_only ? null : 1,
  required_credit_sum: null,
  requires_major: index % 6 === 0,
  distinct_subject_min: index % 7 === 0 ? 2 : null,
  description: `${definition.name} qualification remains recognition only.`,
}));
const recentAwards = [
  { id: awardId, user_id: targetId, badge_key: "seed_sower", awarded_at: "2026-09-04T00:00:00.000Z", award_source: "credit_rule", visibility: "public", revoked_at: null },
  { id: selfAwardId, user_id: administratorId, badge_key: "founding_steward", awarded_at: "2026-09-04T00:01:00.000Z", award_source: "manual_admin", visibility: "public", revoked_at: null },
  ...badgeCatalog.map((definition, index) => ({
    id: `ba100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    user_id: `ba110000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    badge_key: definition.badge_key,
    awarded_at: `2026-09-04T01:${String(index).padStart(2, "0")}:00.000Z`,
    award_source: definition.award_mode,
    visibility: "public",
    revoked_at: null,
  })),
];
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
    if (url.pathname.endsWith("/rest/v1/badge_definitions")) return route.fulfill({ status: 200, headers, body: JSON.stringify(badgeCatalog) });
    if (url.pathname.endsWith("/rest/v1/badge_rules")) return route.fulfill({ status: 200, headers, body: JSON.stringify(badgeRules) });
    if (url.pathname.endsWith("/rest/v1/user_badges")) return route.fulfill({ status: 200, headers, body: JSON.stringify(recentAwards) });
    if (url.pathname.includes("/rest/v1/rpc/")) {
      const rpc = url.pathname.split("/").at(-1);
      const payload = request.postDataJSON();
      captures.push({ rpc, payload });
      if (rpc === "badge_administration_timeline") {
        const selfTarget = payload.p_target_user_id === administratorId;
        const targetAwards = Array.from({ length: 14 }, (_, index) => ({
          id: index === 0 ? awardId : `ba200000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          user_id: targetId,
          badge_key: badgeCatalog[index % badgeCatalog.length].badge_key,
          awarded_at: `2026-09-04T02:${String(index).padStart(2, "0")}:00.000Z`,
          award_source: index === 0 ? "credit_rule" : "automatic_rule",
          visibility: "public",
          revoked_at: "2026-09-04T03:00:00.000Z",
          awarded_by: administratorId,
          award_reason: index === 0 ? "Rule qualification" : `Governed fixture award ${index}.`,
          evidence_type: "badge_credit_rule",
          evidence_id: index === 0 ? creditId : null,
          revoked_by: administratorId,
          revoked_reason: index === 0 ? "Evidence correction" : "Fixture history retention.",
          created_at: `2026-09-04T02:${String(index).padStart(2, "0")}:00.000Z`,
          updated_at: "2026-09-04T03:00:00.000Z",
        }));
        const targetCredits = Array.from({ length: 14 }, (_, index) => ({
          id: index === 0 ? creditId : `ba300000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          credit_type: index === 0 ? "source_contribution" : "fixture_contribution",
          credit_amount: 1,
          contribution_type: "living_library_source_suggestions",
          contribution_id: index === 0 ? evidenceId : `ba310000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          review_item_id: index === 0 ? reviewItemId : null,
          awarded_by: administratorId,
          awarded_at: `2026-09-04T04:${String(index).padStart(2, "0")}:00.000Z`,
          is_major: false,
          distinct_subject_key: null,
          notes: index === 0 ? "Reviewed evidence" : `Reviewed fixture evidence ${index}.`,
          revoked_at: index === 0 ? null : "2026-09-04T05:00:00.000Z",
          revoked_by: index === 0 ? null : administratorId,
          revoked_reason: index === 0 ? null : "Fixture credit history retention.",
        }));
        const targetSuppressions = Array.from({ length: 10 }, (_, index) => ({
          id: `ba400000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          badge_key: badgeCatalog[index % badgeCatalog.length].badge_key,
          suppressed_by: administratorId,
          suppressed_at: `2026-09-04T06:${String(index).padStart(2, "0")}:00.000Z`,
          reason: index === 0 ? "Evidence correction" : "Fixture suppression history.",
          lifted_by: index === 0 ? null : administratorId,
          lifted_at: index === 0 ? null : "2026-09-04T07:00:00.000Z",
          lift_reason: index === 0 ? null : "Fixture suppression was resolved.",
        }));
        const targetAuditEvents = Array.from({ length: 24 }, (_, index) => ({
          id: `ba500000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          actor_user_id: administratorId,
          action: index % 2 === 0 ? "badge_revoked" : "badge_restored",
          badge_slug: badgeCatalog[index % badgeCatalog.length].badge_key,
          credit_event_id: index === 0 ? creditId : null,
          evidence_type: "badge_credit_rule",
          evidence_id: index === 0 ? creditId : null,
          metadata: { reason: `Audited fixture event ${index}.` },
          created_at: `2026-09-04T08:${String(index).padStart(2, "0")}:00.000Z`,
        }));
        return route.fulfill({ status: 200, headers, body: JSON.stringify({
          targetUserId: selfTarget ? administratorId : targetId,
          badgeKey: selfTarget ? "founding_steward" : "seed_sower",
          awards: selfTarget
            ? [{ id: selfAwardId, user_id: administratorId, badge_key: "founding_steward", awarded_at: "2026-09-04T00:01:00.000Z", award_source: "manual_admin", visibility: "public", revoked_at: "2026-09-04T00:06:00.000Z", awarded_by: administratorId, award_reason: "Administrator self-recognition review.", evidence_type: "manual_admin_review", evidence_id: null, revoked_by: administratorId, revoked_reason: "Exercise self-management lifecycle.", created_at: "2026-09-04T00:01:00.000Z", updated_at: "2026-09-04T00:06:00.000Z" }]
            : targetAwards,
          credits: selfTarget ? [] : targetCredits,
          suppressions: selfTarget ? [{ id: "ba000000-0000-4000-8000-000000000007", badge_key: "founding_steward", suppressed_by: administratorId, suppressed_at: "2026-09-04T00:05:00.000Z", reason: "Exercise self-management lifecycle.", lifted_by: null, lifted_at: null, lift_reason: null }] : targetSuppressions,
          auditEvents: selfTarget ? [{ id: "ba000000-0000-4000-8000-000000000008", actor_user_id: administratorId, action: "badge_revoked", badge_slug: "founding_steward", credit_event_id: null, evidence_type: "manual_admin_review", evidence_id: null, metadata: { reason: "Exercise self-management lifecycle." }, created_at: "2026-09-04T00:05:00.000Z" }] : targetAuditEvents,
        }) });
      }
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
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Badge Admin browser flow did not call ${name}.`);
}

async function waitForRpcCount(page, captures, name, expected) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (captures.filter(({ rpc }) => rpc === name).length >= expected) return;
    await page.waitForTimeout(20);
  }
  assert.fail(`Badge Admin browser flow did not call ${name} ${expected} times.`);
}

async function waitForInputValue(input, expected) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await input.inputValue() === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("Badge Admin input did not settle to the expected state.");
}

async function assertBoundedScrollable(region, label) {
  await region.waitFor();
  const state = await region.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert(["auto", "scroll"].includes(state.overflowY), `${label} does not expose vertical scrolling.`);
  assert(state.scrollHeight > state.clientHeight, `${label} fixture did not exercise bounded overflow.`);
  assert(state.scrollWidth - state.clientWidth <= 1, `${label} has horizontal overflow.`);
  await region.focus();
  await region.press("End");
  await region.page().waitForTimeout(50);
  assert(await region.evaluate((element) => element.scrollTop > 0), `${label} did not respond to keyboard scrolling.`);
  await region.press("Home");
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

    const definitionsRegion = page.getByRole("region", { name: "Active badge definitions" });
    const rulesRegion = page.getByRole("region", { name: "Active badge qualification rules" });
    assert.equal(await definitionsRegion.locator("article").count(), 24, "All 24 active badge definitions must remain reachable.");
    assert.equal(await rulesRegion.locator("article").count(), 24, "All 24 active qualification rules must remain reachable.");
    await assertBoundedScrollable(definitionsRegion, "Active badge definitions");
    await assertBoundedScrollable(rulesRegion, "Active badge qualification rules");

    const manual = page.getByRole("heading", { name: "Manual badge grant" }).locator("xpath=ancestor::div[contains(@class,'section-card')][1]");
    await manual.getByLabel("Target user auth UUID").fill(targetId);
    await manual.getByLabel("Badge").selectOption("seed_sower");
    await manual.getByLabel("Audited reason").fill("Verified manual recognition reason.");
    await manual.getByRole("button", { name: "Grant badge" }).click();
    await waitForRpcCount(page, captures, "grant_user_badge", 1);

    await manual.getByRole("button", { name: "Use my signed-in account" }).click();
    await waitForInputValue(manual.getByLabel("Target user auth UUID"), administratorId);
    await manual.getByLabel("Badge").selectOption("founding_steward");
    await manual.getByLabel("Audited reason").fill("Administrator self-recognition review.");
    await manual.getByRole("button", { name: "Grant badge" }).click();
    await waitForRpcCount(page, captures, "grant_user_badge", 2);

    const recent = page.getByRole("heading", { name: "Recent badge awards" }).locator("xpath=ancestor::section[1]");
    const recentReason = recent.getByLabel("Reason for the next revoke action in Recent Badge Awards");
    const recentRegion = recent.getByRole("region", { name: "Recent active badge awards" });
    await assertBoundedScrollable(recentRegion, "Recent badge awards");
    const selfAward = page.getByText(`Target: ${administratorId}`, { exact: true }).locator("xpath=ancestor::article[1]");
    const revokeCountBeforeValidation = captures.filter(({ rpc }) => rpc === "revoke_user_badge").length;
    await selfAward.getByRole("button", { name: "Revoke badge" }).click();
    await recent.getByText("Record a reason here before you revoke.", { exact: true }).waitFor();
    assert.equal(captures.filter(({ rpc }) => rpc === "revoke_user_badge").length, revokeCountBeforeValidation, "Recent-award blank reason must fail locally.");
    await recentReason.fill("Exercise self-management lifecycle.");
    await selfAward.getByRole("button", { name: "Revoke badge" }).click();
    await waitForRpc(page, captures, "revoke_user_badge");
    await recentReason.fill("Recent Awards keeps its own draft reason.");

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
    const timelineReason = history.getByLabel("Reason for the next revoke or restore action in this account history");
    assert.equal(await timelineReason.inputValue(), "", "Per-account reason must not inherit the Recent Awards draft.");
    const revokeCreditCountBeforeValidation = captures.filter(({ rpc }) => rpc === "revoke_badge_credit_event").length;
    await history.getByRole("button", { name: "Revoke credit and re-evaluate" }).click();
    await history.getByText("Record a reason here before you revoke.", { exact: true }).waitFor();
    assert.equal(captures.filter(({ rpc }) => rpc === "revoke_badge_credit_event").length, revokeCreditCountBeforeValidation, "Per-account blank reason must fail locally.");
    await timelineReason.fill("Correct reviewed evidence and retain audit history.");
    await history.getByRole("button", { name: "Revoke credit and re-evaluate" }).click();
    await waitForRpc(page, captures, "revoke_badge_credit_event");
    await waitForInputValue(timelineReason, "");
    assert.equal(await recentReason.inputValue(), "Recent Awards keeps its own draft reason.", "Per-account action must not clear Recent Awards reason state.");

    const historyRegions = [
      [history.getByRole("region", { name: /^Awards \(/ }), "Per-account awards"],
      [history.getByRole("region", { name: /^Suppressions \(/ }), "Per-account suppressions"],
      [history.getByRole("region", { name: /^Reviewed credit events \(/ }), "Per-account reviewed credits"],
      [history.getByRole("region", { name: /^Audit events \(/ }), "Per-account audit events"],
    ];
    for (const [region, label] of historyRegions) await assertBoundedScrollable(region, label);

    await timelineReason.fill("Restore recognition after verified correction.");
    await history.getByRole("button", { name: "Restore or re-evaluate badge" }).waitFor();
    await history.getByRole("button", { name: "Restore or re-evaluate badge" }).click();
    await waitForRpc(page, captures, "restore_user_badge");

    await history.getByLabel("Target user auth UUID").fill(administratorId);
    await history.getByLabel("Badge filter").selectOption("founding_steward");
    await history.getByRole("button", { name: "Load private badge history" }).click();
    await history.getByText("Administrator self-recognition review.", { exact: true }).waitFor();
    await timelineReason.fill("Restore self-managed recognition with history.");
    await history.getByRole("button", { name: "Restore or re-evaluate badge" }).click();
    await waitForRpcCount(page, captures, "restore_user_badge", 2);

    const rpcNames = captures.map(({ rpc }) => rpc);
    for (const expected of ["grant_user_badge", "create_badge_credit_event", "badge_administration_timeline", "revoke_badge_credit_event", "restore_user_badge"]) {
      assert(rpcNames.includes(expected), `Badge Admin browser flow did not call ${expected}.`);
    }
    const credit = captures.find(({ rpc }) => rpc === "create_badge_credit_event")?.payload;
    assert.equal(credit.p_target_user_id, targetId);
    assert.equal(credit.p_contribution_id, evidenceId);
    assert.equal(credit.p_review_item_id, reviewItemId);
    assert.equal(credit.p_credit_type, "source_contribution");
    const grants = captures.filter(({ rpc }) => rpc === "grant_user_badge").map(({ payload }) => payload);
    assert(grants.some((payload) => payload.p_target_user_id === targetId && payload.p_badge_key === "seed_sower"), "Administrator did not grant another account through the governed RPC.");
    assert(grants.some((payload) => payload.p_target_user_id === administratorId && payload.p_badge_key === "founding_steward" && payload.p_evidence_type === "manual_admin_review"), "Administrator self-grant did not retain governed provenance.");
    assert(captures.some(({ rpc, payload }) => rpc === "revoke_user_badge" && payload.p_target_user_id === administratorId && payload.p_badge_key === "founding_steward"), "Administrator self-revoke did not use the governed RPC.");
    assert(captures.some(({ rpc, payload }) => rpc === "restore_user_badge" && payload.p_target_user_id === administratorId && payload.p_badge_key === "founding_steward"), "Administrator self-restore did not use the governed RPC.");
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
  await runCase(browser, { administrator: true, viewport: { width: 820, height: 900 } });
  await runCase(browser, { administrator: true, viewport: { width: 390, height: 844 } });
  await runCase(browser, { administrator: false, viewport: { width: 390, height: 844 } });
  console.log("Badge administration browser smoke test ok.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

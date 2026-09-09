import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

assert.equal(process.env.ELYSIA_ISOLATED_TEST, "1", "Use runReadinessChecks.mjs jobFeesBrowser");
const root = process.cwd(), dist = path.join(root, "dist");
const output = process.env.ELYSIA_READINESS_EVIDENCE_DIR || "/tmp/elysia-job-fee-browser";
await fs.mkdir(output, { recursive: true });
const index = await fs.readFile(path.join(dist, "index.html"));
const sources = await Promise.all((await fs.readdir(path.join(dist, "assets"))).filter(n => n.endsWith(".js")).map(n => fs.readFile(path.join(dist, "assets", n), "utf8")));
assert(sources.some(s => s.includes("https://readiness-fixture.supabase.co")), "Synthetic build required");
assert(!sources.some(s => /https:\/\/(?!readiness-fixture\.)[a-z0-9-]+\.supabase\.co/.test(s)), "Refuse any production Supabase origin");
assert(index.includes('name="elysia-billing-api-publication" content="disabled"'));
assert(index.includes('name="elysia-economic-preparation-publication" content="disabled"'));
const mime = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".html": "text/html" };
const csp = (await fs.readFile("public/_headers", "utf8")).match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
const server = http.createServer(async (request, response) => {
  try {
    const file = path.resolve(dist, "." + new URL(request.url, "http://localhost").pathname);
    if (!file.startsWith(dist + path.sep) && file !== dist) throw Error("Invalid path");
    let body = index, type = "text/html";
    try { if ((await fs.stat(file)).isFile()) { body = await fs.readFile(file); type = mime[path.extname(file)] || "application/octet-stream"; } } catch { /* SPA */ }
    response.writeHead(200, { "content-type": type, "cache-control": "no-store", "content-security-policy": csp }); response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const ids = { owner: "f1000000-0000-4000-8000-000000000001", operator: "f1000000-0000-4000-8000-000000000004", job: "f3000000-0000-4000-8000-000000000001", post: "f2000000-0000-4000-8000-000000000001" };
const feesPath = "/commons-circle/signals/requests-reviews?domain=job_posts#posting-fees";
const results = [], forbidden = [], pageErrors = [];
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "content-type": "application/json" };
async function fixture(role, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: "block" });
  const capabilities = role === "operator" ? ["job_fee_assess", "economic_assistance_manage"] : role === "fee_assessor" ? ["job_fee_assess"] : role === "assistance_operator" ? ["economic_assistance_manage"] : [];
  const user = { id: capabilities.length ? ids.operator : ids.owner, aud: "authenticated", role: "authenticated", email: "synthetic-job-fee@example.invalid", email_confirmed_at: "2026-09-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" };
  const token = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url") + ".synthetic";
  const session = { access_token: token, refresh_token: "synthetic-only", expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: "bearer", user };
  if (role !== "visitor") await context.addInitScript(session => localStorage.setItem("sb-readiness-fixture-auth-token", JSON.stringify(session)), session);
  const item = { jobPostId: ids.job, postId: ids.post, authorUserId: null, title: "Synthetic community restoration opportunity", contentStatus: "pending_review", classification: "not_assessed", conditionStatus: "not_assessed", request: null, ...options.item };
  const commands = [], saved = new Map(); let writes = 0, reads = 0, failedOnce = false;
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (/\/api\/(billing|economic-preparation)(\/|$)|stripe\.com/.test(url.href)) { forbidden.push(url.href); return route.abort(); }
    if (url.origin === origin) return route.continue();
    if (url.origin !== "https://readiness-fixture.supabase.co") return route.fulfill({ status: 200, body: "" });
    const fulfill = (body, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const name = url.pathname.split("/").at(-1), obj = request.headers().accept?.includes("vnd.pgrst.object");
    if (name === "user") return fulfill(user);
    if (name === "logout") return fulfill({});
    if (name === "profiles") return fulfill(obj ? { id: user.id, username: "synthetic-job-fee", display_name: "Synthetic Job Poster", is_admin: role === "admin", commons_onboarding_completed_at: "2026-09-01T00:00:00Z" } : []);
    if (name === "user_roles") return fulfill(role === "admin" ? [{ role: "administrator", revoked_at: null }] : []);
    if (name === "current_user_economic_operator_overview") return fulfill({ authorized: capabilities.length > 0, capabilities, test_mode: true });
    if (name === "current_user_requests_and_reviews") return fulfill([]);
    if (name === "current_user_request_counts") return fulfill({ total: 0, pending: 0, by_domain: {} });
    if (name === "current_user_job_post_fee_workspace") {
      reads++;
      if (options.unavailable) return fulfill({ code: "PGRST202" }, 404);
      const args = request.postDataJSON();
      if (role === "outsider" || (args.p_operator && !capabilities.length)) return fulfill({ code: "42501" }, 403);
      return fulfill({ items: options.empty ? [] : [{ ...item, authorUserId: args.p_operator ? ids.owner : null }], hasMore: false, cursor: null, canReview: args.p_operator && capabilities.includes("economic_assistance_manage"), canAssess: args.p_operator && capabilities.includes("job_fee_assess"), paymentsCollected: options.invalidTruth ? true : false });
    }
    if (name === "submit_job_post_fee_request_command") {
      const command = request.postDataJSON().p_command; commands.push(command);
      if (role === "visitor" || role === "outsider" || (command.action === "review" && !capabilities.includes("economic_assistance_manage"))) return fulfill({ code: "42501" }, 403);
      if (saved.has(command.commandId)) return fulfill(saved.get(command.commandId));
      if (options.conflict || command.expectedRevision !== (item.request?.revision ?? 0)) return fulfill({ code: "40001" }, 409);
      writes++;
      item.request = { category: null, explanation: "Synthetic request", response: "", ...item.request, ...(command.action === "submit" ? { category: command.category, explanation: command.explanation } : {}), status: command.action === "submit" ? "submitted" : command.action === "withdraw" ? "withdrawn" : command.status, response: command.response ?? item.request?.response ?? "", revision: command.expectedRevision + 1, updatedAt: new Date().toISOString() };
      const result = { jobPostId: item.jobPostId, commandId: command.commandId, revision: item.request.revision }; saved.set(command.commandId, result);
      if (options.ambiguous && !failedOnce) { failedOnce = true; return route.abort("failed"); }
      return fulfill(result);
    }
    return fulfill(obj ? null : []);
  });
  const page = await context.newPage(); page.on("pageerror", error => pageErrors.push(error.message));
  page.setDefaultTimeout(15_000);
  return { context, page, item, commands, counts: () => ({ writes, reads }) };
}
async function evidence(f, name) {
  const overflow = await f.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 1, `${name}: horizontal overflow ${overflow}`);
  await f.page.locator("#posting-fees").scrollIntoViewIfNeeded().catch(() => {});
  await f.page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
  const form = f.page.locator("#posting-fees details[open] form").first();
  if (await form.count()) await form.evaluate(el => el.scrollIntoView({ block: "start" }));
  else await f.page.locator("#posting-fees").evaluate(el => el.scrollIntoView({ block: "start" })).catch(() => {});
  await f.page.evaluate(() => scrollBy(0, -150));
  await f.page.screenshot({ path: path.join(output, name + "-viewport.png"), fullPage: false });
  results.push({ name, route: new URL(f.page.url()).pathname + new URL(f.page.url()).search + new URL(f.page.url()).hash, overflow, ...f.counts(), screenshot: name + ".png" });
}
async function openFees(f) { await f.page.goto(origin + feesPath); await f.page.locator("#posting-fees").waitFor(); await f.page.getByRole("button", { name: "Refresh fee status" }).waitFor(); await f.page.waitForFunction(() => !document.querySelector("#posting-fees button")?.disabled); }
async function fillRequest(f) {
  await f.page.getByText("Request a fee waiver or assistance", { exact: true }).click();
  await f.page.getByLabel("Reason category (optional)").selectOption("community_benefit");
  await f.page.getByLabel("Short explanation", { exact: true }).fill("PRIVATE synthetic community assistance request.");
}
try {
  for (const mobile of [false, true]) {
    const f = await fixture("owner", { mobile }); await openFees(f);
    await f.page.getByText("Economic review required", { exact: true }).waitFor();
    await fillRequest(f); await evidence(f, `participant-${mobile ? "mobile" : "desktop"}-request`);
    await f.page.getByRole("button", { name: "Send private request" }).click();
    await f.page.getByText("submitted", { exact: true }).waitFor();
    assert.equal(f.item.contentStatus, "pending_review"); assert.equal(f.item.conditionStatus, "not_assessed");
    assert.equal(f.counts().writes, 1);
    assert(!await f.page.evaluate(() => JSON.stringify(localStorage).includes("PRIVATE synthetic")), "Private explanation persisted in local storage");
    await f.page.getByText("Private request details", { exact: true }).click();
    await evidence(f, `participant-${mobile ? "mobile" : "desktop"}-saved`);
    await f.page.getByRole("button", { name: "Withdraw this request" }).click(); await f.page.getByText("withdrawn", { exact: true }).waitFor();
    assert.equal(f.counts().writes, 2); await f.context.close();
  }
  const request = { category: "community_benefit", explanation: "PRIVATE synthetic explanation for economic review only", status: "submitted", response: "", revision: 1, updatedAt: "2026-09-09T10:00:00Z" };
  for (const mobile of [false, true]) {
    const f = await fixture("operator", { mobile, item: { request } });
    await f.page.goto(origin + "/admin/economic-operations/job-fees");
    await f.page.getByText("Respond to this private request", { exact: true }).click();
    await f.page.getByLabel("Request handling status").selectOption("needs_information");
    await f.page.getByLabel("Reply visible to the poster").fill("Please clarify the public benefit. No financial documents are needed.");
    await f.page.getByRole("button", { name: "Record private reply" }).click(); await f.page.getByText("needs information", { exact: true }).waitFor();
    const assessment = await f.page.getByRole("link", { name: "Open governed fee assessment" }).getAttribute("href");
    assert.equal(new URL(assessment, origin).searchParams.get("jobPostId"), ids.job);
    const assistance = await f.page.getByRole("link", { name: "Open governed assistance tools" }).getAttribute("href");
    assert.equal(new URL(assistance, origin).searchParams.get("beneficiaryUserId"), ids.owner);
    assert.equal(f.item.conditionStatus, "not_assessed"); await evidence(f, `operator-${mobile ? "mobile" : "desktop"}`); await f.context.close();
  }
  for (const role of ["fee_assessor", "assistance_operator"]) {
    const f = await fixture(role, { item: { request } });
    await f.page.goto(origin + "/admin/economic-operations/job-fees");
    await f.page.getByText("Economic review required", { exact: true }).waitFor();
    assert.equal(await f.page.getByText("Respond to this private request", { exact: true }).count(), role === "assistance_operator" ? 1 : 0);
    assert.equal(await f.page.getByRole("link", { name: "Open governed fee assessment" }).count(), role === "fee_assessor" ? 1 : 0);
    assert.equal(await f.page.getByRole("link", { name: "Open governed assistance tools" }).count(), role === "assistance_operator" ? 1 : 0);
    await evidence(f, `narrow-authority-${role}`); await f.context.close();
  }
  for (const role of ["visitor", "owner", "admin"]) {
    const f = await fixture(role); await f.page.goto(origin + "/admin/economic-operations/job-fees");
    await f.page.waitForTimeout(1000);
    assert.equal(await f.page.getByText("Respond to this private request", { exact: true }).count(), 0, `${role} received operator controls`);
    assert.equal(f.counts().reads, 0, `${role} fetched private operator queue`);
    await evidence(f, `operator-boundary-${role}`); await f.context.close();
  }
  for (const [name, options] of Object.entries({ unavailable: { unavailable: true }, invalidTruth: { invalidTruth: true }, outsider: {} })) {
    const f = await fixture(name === "outsider" ? "outsider" : "owner", options); await openFees(f);
    await f.page.locator("#posting-fees [role=alert]").waitFor();
    assert.equal(await f.page.getByText("Request a fee waiver or assistance", { exact: true }).count(), 0);
    assert.equal(await f.page.getByText("No fee required", { exact: true }).count(), 0);
    await evidence(f, `fail-closed-${name}`); await f.context.close();
  }
  for (const [name, options] of Object.entries({ retry: { ambiguous: true }, conflict: { conflict: true } })) {
    const f = await fixture("owner", options); await openFees(f); await fillRequest(f);
    await f.page.getByRole("button", { name: "Send private request" }).click(); await f.page.locator("#posting-fees [role=alert]").waitFor();
    if (name === "retry") {
      await f.page.getByRole("button", { name: "Send private request" }).click(); await f.page.getByText("submitted", { exact: true }).waitFor();
      assert.equal(f.commands[0].commandId, f.commands[1].commandId); assert.equal(f.counts().writes, 1);
    } else assert.equal(await f.page.getByRole("button", { name: "Send private request" }).count(), 0);
    await evidence(f, name); await f.context.close();
  }
  for (const [classification, conditionStatus, label] of [["community_free", "not_required", "No fee required"], ["commercial", "payment_required", "Commercial fee may apply"], ["waived", "waived", "No fee required"], ["subsidized", "subsidized", "No fee required"], ["waived", "reconciliation_required", "Economic review required"]]) {
    const f = await fixture("owner", { item: { classification, conditionStatus, request: { ...request, status: "answered", response: "A reply does not change your assessment." } } }); await openFees(f);
    await f.page.getByText(label, { exact: true }).waitFor();
    assert.equal(await f.page.getByRole("button", { name: /pay|checkout|stripe/i }).count(), 0);
    await evidence(f, `truth-${classification}-${conditionStatus}`); await f.context.close();
  }
  const f = await fixture("owner", { item: { request } }); await openFees(f);
  await f.page.getByText("Private request details", { exact: true }).click(); await f.page.getByText(request.explanation, { exact: true }).first().waitFor();
  await f.page.getByRole("button", { name: /^Sign out$/i }).click();
  await f.page.getByText("Sign in to view your private Job Post fee status or request a waiver or assistance.", { exact: true }).waitFor();
  assert.equal(await f.page.getByText(request.explanation, { exact: true }).count(), 0);
  await evidence(f, "sign-out-clears-private-state"); await f.context.close();
  const door = await fixture("owner"); await door.page.goto(origin + "/commune/rooms/job-post");
  await door.page.getByRole("link", { name: "My Job Post fees & requests", exact: true }).first().click();
  await door.page.getByText("Economic review required", { exact: true }).waitFor();
  await door.page.getByRole("link", { name: "Create a Job Post", exact: true }).click();
  await door.page.getByText("Fee eligibility will be shown from the assessment of your saved opportunity.", { exact: true }).waitFor();
  await evidence(door, "room-to-status-to-creation-doorways"); await door.context.close();
  assert.deepEqual(forbidden, [], "Financial dispatch occurred"); assert.deepEqual(pageErrors, [], "Browser exception");
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ syntheticOnly: true, results, forbiddenFinancialRequests: forbidden, pageErrors }, null, 2) + "\n");
  console.log(`Job Post fee browser checks passed: ${results.length} scenarios; desktop/mobile, owner/operator boundaries, privacy, retry, conflict, truth and UI reachability. No financial dispatch.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

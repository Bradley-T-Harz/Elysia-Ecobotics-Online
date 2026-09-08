import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { readinessEvidenceDirectory } from "./readinessPaths.mjs";
import { preparationFixture, applyInternalFixtureCommand, id, fixtureTime } from "./fixtures/preProviderBrowserFixture.mjs";

const root = process.cwd(), dist = path.join(root, "dist"), evidence = await readinessEvidenceDirectory();
const screenshots = path.join(evidence, "screenshots"); await fs.mkdir(screenshots, { recursive: true });
const index = await fs.readFile(path.join(dist, "index.html"), "utf8");
assert.match(index, /name="elysia-economic-preparation-publication" content="disabled"/);
assert.match(index, /name="elysia-billing-api-publication" content="disabled"/);
const csp = (await fs.readFile(path.join(root, "public/_headers"), "utf8")).match(/^\s*Content-Security-Policy:\s*(.+)$/m)[1].trim();
const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain" };
async function serve(enabled) {
  const server = http.createServer(async (req, res) => {
    try {
      assert.equal(req.method, "GET");
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      let file = path.resolve(dist, "." + decodeURIComponent(pathname));
      if (!file.startsWith(dist + path.sep)) file = path.join(dist, "index.html");
      try { if (!(await fs.stat(file)).isFile()) file = path.join(dist, "index.html"); } catch { file = path.join(dist, "index.html"); }
      let data = await fs.readFile(file);
      if (enabled && file === path.join(dist, "index.html")) data = Buffer.from(index.replace('name="elysia-economic-preparation-publication" content="disabled"', 'name="elysia-economic-preparation-publication" content="pre_provider"'));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "Content-Security-Policy": csp }); res.end(data);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
const disabled = await serve(false), enabled = await serve(true);
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
const state = preparationFixture(), observations = [], commands = [], reads = [], billingRequests = [], pageErrors = [];
const user = { id: id(90), aud: "authenticated", role: "authenticated", email: "synthetic-preparation@example.invalid", email_confirmed_at: fixtureTime, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: fixtureTime };
let loseFirstSaveResponse = true; const results = new Map();
async function contextFor(operator = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
  await context.addInitScript(({ user }) => { if (location.hostname !== "127.0.0.1") return; localStorage.setItem("sb-readiness-fixture-auth-token", JSON.stringify({ access_token: "synthetic-readiness-token", refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })); }, { user });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith("/api/billing/")) { billingRequests.push(url.pathname); return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"disabled"}' }); }
    if ([disabled.origin, enabled.origin].includes(url.origin)) {
      if (url.pathname.startsWith("/api/economic-preparation/")) {
        assert.equal(url.origin, enabled.origin, "Disabled build dispatched preparation");
        assert.equal(request.headers().authorization, "Bearer synthetic-readiness-token");
        if (url.pathname.endsWith("/state")) {
          reads.push(url.searchParams.get("audience"));
          const projection = structuredClone(state);
          if (!operator) { projection.capabilities = []; projection.waivers = []; projection.audit = []; }
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, state: projection }) });
        }
        assert.equal(request.method(), "POST"); const command = request.postDataJSON(); commands.push(command);
        let result = results.get(command.requestId);
        if (!result) { result = applyInternalFixtureCommand(state, command); results.set(command.requestId, result); }
        else result = { ...result, idempotentReplay: true };
        if (loseFirstSaveResponse && command.action === "seller_save") { loseFirstSaveResponse = false; return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"synthetic_lost_response"}' }); }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result }) });
      }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"synthetic_unavailable"}' });
      return route.continue();
    }
    if (url.hostname === "readiness-fixture.supabase.co") {
      const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
      let body = [];
      if (url.pathname === "/auth/v1/user") body = user;
      else if (url.pathname === "/rest/v1/user_roles") body = operator ? [{ role: "administrator" }] : [];
      else if (url.pathname === "/rest/v1/profiles") {
        const profile = { id: user.id, username: "synthetic-preparation", display_name: "Synthetic Preparation Account", is_admin: operator, is_developer: true, saved_addon_ids: [] };
        body = request.headers().accept?.includes("vnd.pgrst.object") ? profile : [profile];
      }
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
    }
    return route.abort("blockedbyclient");
  });
  context.on("page", page => page.on("pageerror", error => pageErrors.push(error.message)));
  return context;
}
function form(page, title) { return page.locator("form").filter({ has: page.getByRole("heading", { name: title, exact: true }) }); }
async function submit(page, title, label) {
  await form(page, title).getByRole("button", { name: label, exact: true }).click();
  await page.getByText("Internal preparation recorded. No payment, provider onboarding, refund or payout was executed.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Recording…", exact: true }).first().waitFor({ state: "hidden" });
}
async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `Horizontal overflow: ${name}`);
  await page.screenshot({ path: path.join(screenshots, `${name}.png`), fullPage: true });
  observations.push({ name, route: new URL(page.url()).pathname, viewport: page.viewportSize(), horizontalOverflow: false });
}
try {
  const sellerContext = await contextFor(), sellerPage = await sellerContext.newPage();
  for (const route of ["/marketplace/account", "/commons-circle/support-billing", "/admin/economic-operations/readiness"]) {
    await sellerPage.goto(disabled.origin + route);
    await sellerPage.getByText(/Their production endpoint remains unpublished/).waitFor();
    await shot(sellerPage, "disabled-" + route.slice(1).replaceAll("/", "-"));
  }
  assert.equal(reads.length, 0); assert.equal(commands.length, 0);
  await sellerPage.goto(enabled.origin + "/marketplace/account");
  const profile = form(sellerPage, "Seller profile");
  await profile.getByLabel("Seller display name").fill("Synthetic Creator");
  await profile.getByLabel("Offering intent").selectOption("both");
  await profile.getByRole("button", { name: "Save seller preparation", exact: true }).click();
  await sellerPage.getByRole("alert").filter({ hasText: "No completed action should be assumed" }).waitFor();
  assert.equal(await sellerPage.getByText(/Internal preparation recorded\./).count(), 0);
  await submit(sellerPage, "Seller profile", "Save seller preparation");
  assert.equal(commands[0].requestId, commands[1].requestId, "Ambiguous-response retry lost its idempotency key");
  await form(sellerPage, "Terms acknowledgment").getByRole("checkbox").check();
  await submit(sellerPage, "Terms acknowledgment", "Record terms acknowledgment");
  const publisher = form(sellerPage, "Link your publisher identity");
  await publisher.getByLabel("Your publisher").selectOption(id(2));
  await publisher.getByLabel("Private audit reason").fill("Synthetic publisher ownership link");
  await submit(sellerPage, "Link your publisher identity", "Record publisher link");
  await sellerPage.getByRole("button", { name: "Submit internal seller review", exact: true }).click();
  await sellerPage.getByText(/Application: submitted/).waitFor();
  for (const kind of ["free", "commercial"]) {
    const offer = form(sellerPage, "Prepare an offering");
    await offer.getByLabel("Reviewed add-on version").selectOption(id(kind === "free" ? 3 : 4));
    await offer.getByLabel("Offering kind").selectOption(kind);
    if (kind === "commercial") await offer.getByLabel("Proposed price in USD cents").fill("1000");
    await offer.getByLabel("Buyer license identifier").fill("synthetic-license");
    await offer.getByLabel("License version").fill("1");
    await submit(sellerPage, "Prepare an offering", "Save offering draft");
  }
  assert.equal(await sellerPage.getByRole("button", { name: "Payment-provider onboarding unavailable", exact: true }).isDisabled(), true);
  assert.equal(await sellerPage.locator('input[autocomplete="cc-number"], input[name*="bank"], input[name*="card"]').count(), 0);
  await shot(sellerPage, "seller-submitted-free-and-commercial-desktop");
  await sellerPage.setViewportSize({ width: 390, height: 844 }); await shot(sellerPage, "seller-submitted-mobile");
  await sellerPage.setViewportSize({ width: 1440, height: 1000 });
  await sellerPage.goto(enabled.origin + "/commons-circle/support-billing");
  const support = form(sellerPage, "Request support follow-up");
  await support.getByLabel("Your recurring subscription").selectOption(id(7));
  await support.getByLabel("Private audit reason").fill("Synthetic cancellation request only");
  await submit(sellerPage, "Request support follow-up", "Record follow-up request");
  assert.equal(state.subscriptions[0].cancelAtPeriodEnd, false);
  await shot(sellerPage, "support-records-and-request-desktop");
  const operatorContext = await contextFor(true), operatorPage = await operatorContext.newPage();
  await operatorPage.goto(enabled.origin + "/admin/economic-operations/sellers");
  const review = form(operatorPage, "Record internal review");
  await review.getByRole("combobox", { name: /^Decision/ }).selectOption("approved");
  await review.getByLabel("Private audit reason").fill("Synthetic independent review accepted");
  await submit(operatorPage, "Record internal review", "Record seller decision");
  await shot(operatorPage, "seller-internal-review-desktop");
  await operatorPage.goto(enabled.origin + "/admin/economic-operations/waivers");
  const waiver = form(operatorPage, "Approve an owned-fee waiver preparation");
  await waiver.getByLabel("EcoSyneva-owned component").waitFor();
  assert.equal(await waiver.getByLabel("EcoSyneva-owned component").locator("option").count(), 3);
  await waiver.getByLabel("Existing uncommitted internal order UUID").fill(id(6));
  await waiver.getByLabel("Waived amount in the order's minor currency units").fill("50");
  await waiver.getByLabel("Private audit reason").fill("Synthetic platform fee waiver only");
  await waiver.getByLabel("Type WAIVE ECOSYNEVA OWNED AMOUNT ONLY").fill("WAIVE ECOSYNEVA OWNED AMOUNT ONLY");
  await submit(operatorPage, "Approve an owned-fee waiver preparation", "Approve owned-fee preparation");
  await shot(operatorPage, "owned-fee-waiver-desktop");
  await form(operatorPage, "Revoke this preparation").getByLabel("Private audit reason").fill("Synthetic preparation revoked with history");
  await submit(operatorPage, "Revoke this preparation", "Record waiver revocation");
  assert.equal(state.waivers[0].status, "revoked");
  const sections = ["readiness", "support", "sellers", "offers", "onboarding", "settlement", "refunds", "receipts", "organizations", "sponsorship", "job-fees", "hosted-allowance", "legal", "provider", "waivers", "audit"];
  for (const section of sections) {
    await operatorPage.goto(enabled.origin + "/admin/economic-operations/" + section);
    await operatorPage.getByRole("heading", { name: "Internal preparation · provider actions disabled", exact: true }).waitFor();
    await shot(operatorPage, "operations-" + section + "-desktop");
  }
  for (const route of ["/admin/economic-operations/settlement", "/admin/economic-operations/waivers", "/admin/economic-operations/receipts", "/commons-circle/support-billing"]) {
    await operatorPage.setViewportSize({ width: 390, height: 844 }); await operatorPage.goto(enabled.origin + route);
    await operatorPage.getByRole("heading", { name: /Internal preparation · provider actions disabled|Support records and service requests/ }).waitFor();
    await shot(operatorPage, "mobile-" + route.slice(1).replaceAll("/", "-"));
  }
  await operatorPage.setViewportSize({ width: 1440, height: 1000 });
  await operatorPage.goto(enabled.origin + "/commons-circle/admin-console");
  await operatorPage.locator('.commons-admin-link[href="/admin/economic-operations/readiness"]').waitFor();
  const originalLinks = await operatorPage.locator(".commons-admin-link").evaluateAll(links => links.map(link => link.getAttribute("href")));
  for (const route of ["/admin/roles", "/admin/badges", "/admin/audit"]) assert.ok(originalLinks.includes(route), `Missing admin capability ${route}`);
  await shot(operatorPage, "preserved-admin-console-desktop");
  await operatorPage.goto(enabled.origin + "/admin/economic-operations"); await operatorPage.locator("h1").waitFor();
  await shot(operatorPage, "preserved-economic-console-desktop");
  await operatorPage.keyboard.press("Tab"); assert.ok(await operatorPage.evaluate(() => document.activeElement !== document.body));
  assert.deepEqual(billingRequests, []); assert.deepEqual(pageErrors, []);
  assert.equal(state.settlements[0].providerPayoutStatus, "not_verified");
  assert.ok(state.proposals.every(proposal => !proposal.adopted));
  assert.equal(await fs.readFile(path.join(dist, "index.html"), "utf8"), index, "Local preview modified production build marker");
  await fs.writeFile(path.join(evidence, "pre-provider-browser-evidence.json"), JSON.stringify({ localOnly: true, syntheticOnly: true, externalNetwork: "all requests blocked or fixture-fulfilled", observations, internalActions: commands.map(command => ({ action: command.action, requestId: command.requestId })), billingRequests, pageErrors, originalAdminLinks: originalLinks, idempotentRetry: true, markersOnDiskRemainDisabled: true }, null, 2) + "\n");
  console.log(`Pre-provider browser checks passed: ${observations.length} route/viewport screenshots; seller profile, terms, publisher, review, free/commercial drafts, ambiguous-response retry, Support cancellation request, owned-fee waiver/revocation, all 16 operations destinations, preserved admin links, disabled payment controls and zero billing dispatch.`);
  await sellerContext.close(); await operatorContext.close();
} finally {
  await browser.close(); await Promise.all([new Promise(resolve => disabled.server.close(resolve)), new Promise(resolve => enabled.server.close(resolve))]);
}

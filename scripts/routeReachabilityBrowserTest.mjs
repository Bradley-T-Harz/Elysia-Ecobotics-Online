import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { readinessEvidenceDirectory } from "./readinessPaths.mjs";
import { userId, fixtureUser, fixtureSession, fixtureProfile, bootstrap, now } from "./fixtures/routeReachabilityFixture.mjs";

const root = process.cwd(), dist = path.join(root, "dist");
const outputArgument = process.argv.indexOf("--output");
const requestedOutput = outputArgument >= 0 ? process.argv[outputArgument + 1] : undefined;
assert(requestedOutput?.startsWith("/"), "Pass an absolute --output evidence directory outside the source repository");
process.env.ELYSIA_READINESS_EVIDENCE_DIR = requestedOutput;
const output = await readinessEvidenceDirectory();
assert(!process.argv.includes("--qualify") || process.argv.includes("--direct-only"), "Use --qualify with --direct-only for the adversarial account fixtures");
const index = await fs.readFile(path.join(dist, "index.html"), "utf8");
const buildIndexSha256 = createHash("sha256").update(index).digest("hex");
for (const name of ["elysia-billing-api-publication", "elysia-economic-preparation-publication"]) assert(index.includes(`name="${name}" content="disabled"`));
const assets = await fs.readdir(path.join(dist, "assets"));
const assetText = (await Promise.all(assets.filter(f => f.endsWith(".js")).map(f => fs.readFile(path.join(dist, "assets", f), "utf8")))).join("\n");
assert(assetText.includes("https://readiness-fixture.supabase.co"), "Requires sanitized readiness build");
assert(!assetText.includes("qwmcstyfegvpzjmjrylc.supabase.co"), "Production backend forbidden");
const csp = (await fs.readFile("public/_headers", "utf8")).match(/^\s*Content-Security-Policy:\s*(.+)$/m)[1];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon" };
const server = http.createServer(async (req, res) => {
  if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
  let file = path.resolve(dist, "." + decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname));
  if (!file.startsWith(dist + path.sep)) file = path.join(dist, "index.html");
  try { if (!(await fs.stat(file)).isFile()) file = path.join(dist, "index.html"); } catch { file = path.join(dist, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream", "Content-Security-Policy": csp }); res.end(await fs.readFile(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
const profiles = {
  visitor: { signedIn: false, roles: [] }, buyer: { signedIn: true, roles: [] },
  creator: { signedIn: true, creator: true, roles: [] },
  reviewer: { signedIn: true, roles: ["marketplace_reviewer"] },
  administrator: { signedIn: true, roles: ["administrator"] },
  economic_operator: { signedIn: true, roles: [], capabilities: ["economic_orders_view", "economic_payments_view", "economic_refunds_manage", "economic_reconciliation_manage", "recurring_support_manage", "sandbox_credits_adjust", "job_fee_assess", "marketplace_payout_manage", "organization_billing_manage", "sponsorship_manage", "economic_assistance_manage", "economic_feature_flags_manage", "economic_audit_view", "accounting_export"] },
  economic_auditor: { signedIn: true, roles: [], capabilities: ["economic_audit_view"] },
  foreign_profile: { signedIn: true, creator: true, foreignProfile: true, roles: [] },
  creator_records: { signedIn: true, creator: true, recordData: true, roles: [] },
  creator_offline: { signedIn: true, creator: true, offlineDrafts: true, roles: [] }
};
const results = [];
async function run(role, mobile = false) {
  const actor = profiles[role], errors = [], forbiddenRequests = [], blockedExternal = [], rpcReads = [];
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: "block" });
  if (actor.signedIn) await context.addInitScript(session => { if (location.hostname === "127.0.0.1") localStorage.setItem("sb-readiness-fixture-auth-token", JSON.stringify(session)); }, fixtureSession);
  if (actor.offlineDrafts) await context.addInitScript(userId => localStorage.setItem("developerForge.localDrafts.v1", JSON.stringify([{ id: "synthetic-cached-draft", owner_user_id: userId, addon_name: "Cached draft must stay local", version: "1.0.0", manifest_json: {} }])), userId);
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Range": "0-0/0" }, body: JSON.stringify(body) });
    if (url.origin === origin) {
      if (url.pathname.startsWith("/api/billing/") || url.pathname.startsWith("/api/economic-preparation/")) { forbiddenRequests.push(url.pathname); return fulfill({ error: "disabled" }, 503); }
      if (url.pathname === "/api/identity/v1/bootstrap") return fulfill({ ok: true, data: bootstrap(false) });
      if (url.pathname.startsWith("/api/")) return fulfill({ error: "fixture_unavailable" }, 503);
      return route.continue();
    }
    if (url.hostname !== "readiness-fixture.supabase.co") { blockedExternal.push(url.hostname); return route.abort("blockedbyclient"); }
    if (req.method() === "OPTIONS") return fulfill(null, 200);
    if (url.pathname === "/auth/v1/user") return actor.signedIn ? fulfill({ ...fixtureUser, email_confirmed_at: now }) : fulfill({ error: "not_signed_in" }, 401);
    if (url.pathname.startsWith("/rest/v1/rpc/")) rpcReads.push(url.pathname);
    else if (!["GET", "HEAD"].includes(req.method())) { forbiddenRequests.push(url.pathname); return fulfill({ error: "no_mutations_in_navigation_crawl" }, 403); }
    const one = row => req.headers().accept?.includes("vnd.pgrst.object") ? row : row ? [row] : [];
    if (url.pathname === "/rest/v1/profiles") return fulfill(one({ ...fixtureProfile, is_admin: actor.roles.includes("administrator"), is_developer: true })); // Cosmetic flag alone must never qualify a buyer.
    if (url.pathname === "/rest/v1/user_roles") return fulfill(actor.roles.map(role => ({ role })));
    if (url.pathname === "/rest/v1/developer_profiles") return fulfill(one(actor.creator ? { id: "a2900000-0000-4000-8000-000000000002", user_id: actor.foreignProfile ? "a2900000-0000-4000-8000-000000000099" : userId, developer_slug: "synthetic-creator", display_name: "Synthetic Creator", status: "active" } : null));
    if (url.pathname === "/rest/v1/addon_drafts" && (actor.recordData || actor.offlineDrafts)) {
      assert.equal(url.searchParams.get("owner_user_id"), `eq.${userId}`, "Creator queries must scope cloud drafts to the actor");
      if (actor.offlineDrafts) return fulfill({ message: "synthetic_cloud_read_unavailable" }, 503);
      return fulfill([{ id: "a2900000-0000-4000-8000-000000000010", owner_user_id: userId, addon_name: "Owned synthetic draft", version: "1.0.0", manifest_json: {} }, { id: "a2900000-0000-4000-8000-000000000011", owner_user_id: "a2900000-0000-4000-8000-000000000099", addon_name: "Foreign synthetic draft", version: "1.0.0", manifest_json: {} }]);
    }
    if (url.pathname === "/rest/v1/addon_submissions" && actor.recordData) {
      assert.equal(url.searchParams.get("submitted_by"), `eq.${userId}`);
      return fulfill([{ id: "a2900000-0000-4000-8000-000000000012", submitted_by: userId, addon_draft_id: "a2900000-0000-4000-8000-000000000010", status: "needs_information" }]);
    }
    if (url.pathname === "/rest/v1/marketplace_listings" && actor.recordData && url.searchParams.has("developer_profile_id")) {
      assert.equal(url.searchParams.get("developer_profile_id"), "eq.a2900000-0000-4000-8000-000000000002");
      return fulfill([{ id: "a2900000-0000-4000-8000-000000000013", addon_id: "legacy-record-reference", slug: "owned-synthetic-listing", name: "Owned synthetic listing", current_version: "1.0.0", listing_status: "published" }]);
    }
    if (url.pathname.endsWith("/current_user_economic_operator_overview")) return fulfill({ authorized: Boolean(actor.capabilities?.length), capabilities: actor.capabilities ?? [], test_mode: true });
    return fulfill([]);
  });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  const inspectRoute = process.argv.includes("--inspect-only") ? process.argv[process.argv.indexOf("--inspect-only") + 1] : null;
  const queue = [inspectRoute ?? "/"], visited = new Set(), edges = [], pages = [];
  const directChecks = [];
  if (process.argv.includes("--qualify")) {
    const isCreator = Boolean(actor.creator && !actor.foreignProfile), isReviewer = actor.roles.length > 0, isAdmin = actor.roles.includes("administrator"), economic = Boolean(actor.capabilities?.length);
    for (const route of ["/marketplace/creator-studio", "/marketplace/account", "/commons-circle/signals", "/admin/review", "/admin/review/marketplace", "/admin/roles", "/admin/badges", "/commons-circle/admin-console", "/admin/economic-operations/readiness", "/admin/economic-operations/audit"]) {
      await page.goto(origin + route, { waitUntil: "networkidle" });
      const visibleLink = async href => page.locator(`a[href="${href}"]`).evaluateAll(links => links.some(a => a.getClientRects().length));
      if (route === "/marketplace/creator-studio") {
        assert.equal(await page.getByRole("region", { name: "Creator workspaces" }).count(), isCreator ? 1 : 0, `${role}: private Creator Studio boundary`);
        if (actor.recordData) {
          assert.equal(await page.getByRole("link", { name: "Owned synthetic draft · 1.0.0" }).count(), 1);
          assert.equal(await page.getByText("Foreign synthetic draft", { exact: false }).count(), 0);
          assert.equal(await page.locator('a[href="/marketplace/addons/owned-synthetic-listing"]').count(), 1, "Published listings must use the canonical catalog slug");
          const timeline = page.getByRole("link", { name: "Submission timeline · needs information", exact: true });
          assert.equal(await timeline.getAttribute("href"), "/developer-forge/submissions", "Record links must accurately open the whole timeline");
          assert.equal(await page.locator('a[href^="/developer-forge/submissions/"]').count(), 0, "Studio must not imply an ID-specific submission view");
          await page.screenshot({ path: path.join(output, `${role}-owned-records.png`), fullPage: true });
        }
        if (actor.offlineDrafts) assert.equal(await page.getByText("Cached draft must stay local", { exact: false }).count(), 0, "Browser cache must not become a cloud-owned Creator Studio record");
      }
      if (route === "/marketplace/account") assert.equal(await page.getByRole("heading", { name: "Prepare your seller account", exact: true }).count(), isCreator ? 1 : 0, `${role}: seller controls must require recorded creator ownership`);
      if (route === "/commons-circle/signals") {
        assert.equal(await visibleLink("/admin/review"), isReviewer, `${role}: independent Review Center doorway`);
        assert.equal(await visibleLink("/admin/economic-operations/readiness"), economic, `${role}: independently assigned economic doorway`);
        assert.equal(await visibleLink("/marketplace/creator-studio"), isCreator, `${role}: creator doorway`);
      }
      if (route === "/admin/review" || route === "/admin/review/marketplace") assert.equal(await page.getByRole("heading", { name: "Review access required", exact: true }).count(), isReviewer ? 0 : 1, `${role}: direct reviewer URL boundary`);
      if (["/admin/roles", "/admin/badges"].includes(route)) assert.equal(await page.getByRole("heading", { name: "Review access required", exact: true }).count(), isAdmin ? 0 : 1, `${role}: direct administrator URL boundary`);
      if (route.startsWith("/admin/economic-operations")) {
        assert.equal(await page.getByRole("navigation", { name: "Economic Operations sections" }).count(), economic ? 1 : 0);
        assert.equal(await visibleLink("/commons-circle/admin-console"), economic && isReviewer, `${role}: economic authority must not advertise community authority`);
        assert.equal(await visibleLink("/admin/economic-operations/sellers"), Boolean(actor.capabilities?.includes("marketplace_payout_manage")), `${role}: separate seller authority`);
      }
      directChecks.push({ route, pass: true });
    }
    if (isCreator) {
      for (const [label, target] of [["Review outcomes", "/commons-circle/signals/notifications?filter=marketplace"], ["Submission timeline", "/developer-forge/submissions"]]) {
        await page.goto(origin + "/marketplace/creator-studio", { waitUntil: "networkidle" });
        const link = page.getByRole("link", { name: label, exact: true });
        assert.equal(await link.getAttribute("href"), target);
        await link.focus(); await page.keyboard.press("Enter");
        await page.waitForURL(origin + target);
        await page.locator("main h1").first().waitFor();
        await page.waitForLoadState("networkidle");
        assert.equal(page.url(), origin + target, "A primary doorway must not settle on an alias redirect");
        if (label === "Review outcomes") assert.equal(await page.getByRole("tab", { name: "Marketplace & Economic", exact: true }).getAttribute("aria-selected"), "true");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        directChecks.push({ route: "/marketplace/creator-studio", label, target, keyboard: "Enter", pass: true });
      }
      for (const route of ["/marketplace", "/commons-circle/signals", "/marketplace/account"]) {
        await page.goto(origin + route, { waitUntil: "networkidle" });
        const doorway = page.getByRole("link", { name: "Open Creator Studio", exact: true });
        await doorway.focus(); await page.keyboard.press("Enter");
        await page.waitForURL("**/marketplace/creator-studio");
        await page.getByRole("heading", { name: "Creator Studio", exact: true }).waitFor();
        directChecks.push({ route, keyboard: "Enter", target: "/marketplace/creator-studio", pass: true });
      }
      for (const [label, target] of [["Marketplace profile", "marketplace-profile"], ["Seller preparation", "seller-preparation"], ["Account licenses", "marketplace-licenses"], ["Seller records & payout status", "seller-records"]]) {
        await page.goto(origin + "/marketplace/creator-studio", { waitUntil: "networkidle" });
        await page.getByRole("link", { name: label, exact: true }).click();
        await page.waitForURL(`**/marketplace/account#${target}`);
        await page.waitForFunction(id => { const element = document.getElementById(id); if (!element) return false; const box = element.getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; }, target);
        directChecks.push({ route: "/marketplace/creator-studio", target: `/marketplace/account#${target}`, anchorVisible: true, pass: true });
      }
    }
    if (isCreator || economic || isReviewer) {
      const route = isCreator ? "/marketplace/creator-studio" : economic ? "/admin/economic-operations/readiness" : "/commons-circle/signals";
      await page.goto(origin + route, { waitUntil: "networkidle" });
      await page.evaluate(() => { const channel = new BroadcastChannel("sb-readiness-fixture-auth-token"); channel.postMessage({ event: "SIGNED_OUT", session: null }); channel.close(); });
      await page.waitForTimeout(250);
      assert.equal(await page.getByRole("region", { name: "Creator workspaces" }).count(), 0, "Creator state survived sign-out");
      assert.equal(await page.getByRole("navigation", { name: "Economic Operations sections" }).count(), 0, "Economic state survived sign-out");
      if (route === "/commons-circle/signals") assert.equal(await page.locator('a[href="/admin/review"]').count(), 0, "Reviewer doorway survived sign-out");
      directChecks.push({ route, authTransition: "signed_out", pass: true });
    }
    if (process.argv.includes("--direct-only")) queue.length = 0;
  }
  if (process.argv.includes("--qualify")) {
    for (const alias of ["/legal/legal", "/legal/legal/", "/legal/legal?version=2026-06-09"]) {
      // This local server deliberately does not interpret Pages _redirects, so
      // these checks exercise the client-side compatibility redirect as well.
      await page.goto(origin + alias, { waitUntil: "networkidle" });
      await page.waitForURL(origin + "/legal");
      await page.getByRole("heading", { name: "Legal, Safety, and Community Policies", exact: true }).waitFor();
      assert.equal(await page.getByText("Proposed routes", { exact: true }).count(), 0);
      assert.equal(await page.getByText("Publication readiness checklist", { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      directChecks.push({ route: alias, target: "/legal", clientRedirect: true, pass: true });
    }
  }
  async function collect(from) {
    const links = await page.locator("a[href]").evaluateAll(elements => elements.filter(a => a.getClientRects().length && getComputedStyle(a).visibility !== "hidden").map(a => ({ href: a.href, label: a.textContent.trim().replace(/\s+/g, " ").slice(0, 150) })));
    for (const link of links) {
      const url = new URL(link.href);
      if (url.origin !== origin || /\.(?:zip|json|exe|dmg|png|svg|txt|xml|webmanifest)$/.test(url.pathname)) continue;
      edges.push({ from, to: url.pathname, query: url.search, hash: url.hash, label: link.label });
      const recordFamily = url.pathname.startsWith("/living-library/source/");
      const alreadySampled = recordFamily && role !== "visitor" && [...visited, ...queue].some(item => item.startsWith("/living-library/source/"));
      if (!alreadySampled && !visited.has(url.pathname) && !queue.includes(url.pathname)) queue.push(url.pathname);
    }
  }
  while (queue.length && visited.size < 500) {
    const route = queue.shift(); if (visited.has(route)) continue; visited.add(route);
    await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator("main h1").first().waitFor({ timeout: 12000 });
    await page.waitForTimeout(180);
    // The public catalog is paginated in the UI. Reveal every active record without inventing URLs.
    while (await page.locator(".library-load-more button").isVisible()) await page.locator(".library-load-more button").click();
    await collect(route);
    if (route === "/marketplace/browse") {
      const details = page.getByRole("button", { name: "View Details", exact: true }).first();
      if (await details.count()) {
        await details.click(); await page.waitForURL("**/marketplace/addons/*");
        const target = new URL(page.url()).pathname; edges.push({ from: route, to: target, query: "", hash: "", label: "View Details", interaction: "button" });
        if (!visited.has(target)) queue.push(target);
        await page.goto(origin + route); await page.locator("main h1").first().waitFor(); await page.waitForTimeout(180);
      }
    }
    if (route.startsWith("/commons-circle/setup/")) {
      const steps = await page.locator(".commons-setup-progress button").allTextContents();
      for (const label of steps) {
        await page.locator(".commons-setup-progress button").filter({ hasText: label.replace(" ✓", "") }).click();
        const target = new URL(page.url()).pathname; edges.push({ from: route, to: target, query: "", hash: "", label, interaction: "setup-step-button" });
        if (!visited.has(target) && !queue.includes(target)) queue.push(target);
      }
      await page.goto(origin + route); await page.locator("main h1").first().waitFor(); await page.waitForTimeout(180);
    }
    // Global menu links are collected only after ordinary user clicks; hidden DOM does not count.
    if (route === "/") {
      if (mobile) {
        await page.locator(".site-nav-toggle").click();
        const count = await page.locator(".site-nav-mobile__territory").count();
        for (let i = 0; i < count; i++) { await page.locator(".site-nav-mobile__territory").nth(i).click(); await collect(route); await page.locator(".site-nav-mobile__back").click(); }
      } else for (const button of await page.locator(".site-nav-territory__trigger").all()) { await button.click(); await collect(route); }
      await page.keyboard.press("Escape");
    }
    for (const summary of await page.locator("main details:not([open]) > summary").all()) { if (await summary.isVisible()) { await summary.click(); await collect(route); } }
    if (visited.size % 25 === 0) console.log(`${role}: ${visited.size} routes crawled, ${queue.length} pending`);
    pages.push({ route, finalRoute: new URL(page.url()).pathname, title: await page.title(), heading: await page.locator("h1").allTextContents(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2) });
    if (inspectRoute) {
      await page.screenshot({ path: path.join(output, `${role}-inspection.png`), fullPage: true });
      await fs.writeFile(path.join(output, `${role}-layout.json`), JSON.stringify(await page.locator("main *").evaluateAll(elements => elements.filter(e => e.getBoundingClientRect().right > innerWidth + 2).slice(0, 30).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, text: e.textContent.slice(0, 100) }))), null, 2));
      queue.length = 0;
    }
    if (["/marketplace", "/marketplace/creator-studio", "/marketplace/account", "/commons-circle/signals", "/admin/review", "/commons-circle/admin-console", "/admin/economic-operations/audit"].includes(route)) await page.screenshot({ path: path.join(output, `${role}-${mobile ? "mobile" : "desktop"}-${route.slice(1).replaceAll("/", "-")}.png`), fullPage: true });
  }
  const result = { role, mobile, buildIndexSha256, syntheticOnly: true, entry: "/", directChecks, pages, edges, errors, forbiddenRequests, blockedExternal: [...new Set(blockedExternal)], rpcReads: [...new Set(rpcReads)] };
  await fs.writeFile(path.join(output, `${role}-${mobile ? "mobile" : "desktop"}.json`), JSON.stringify(result, null, 2) + "\n"); results.push(result);
  console.log(`${role} ${mobile ? "mobile" : "desktop"}: ${pages.length} UI-reached routes, ${edges.length} edges, ${errors.length} page errors, ${forbiddenRequests.length} forbidden dispatches`);
  await context.close();
}
try {
  const standardRoles = ["visitor", "buyer", "creator", "reviewer", "administrator", "economic_operator", "economic_auditor"];
  const roles = process.env.REACHABILITY_ROLES?.split(",") ?? (process.argv.includes("--qualify") ? Object.keys(profiles) : standardRoles);
  for (let offset = 0; offset < roles.length; offset += 2) await Promise.all(roles.slice(offset, offset + 2).map(role => run(role, process.argv.includes("--mobile"))));
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(results.map(({ edges, pages, ...rest }) => ({ ...rest, routes: pages.length, edges: edges.length })), null, 2) + "\n");
  assert(results.every(r => r.errors.length === 0), "Browser page errors occurred");
  assert(results.every(r => r.pages.every(p => !p.horizontalOverflow)), "A route overflowed the viewport");
  assert(results.every(r => r.forbiddenRequests.length === 0), "Navigation dispatched a financial request or mutation");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_CIRCLE_PRIVATE_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_CIRCLE_PRIVATE_EVIDENCE_DIR)
  : path.join("/tmp", "elysia-circle-private-browser-evidence");
await fs.mkdir(evidenceDir, { recursive: true });
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "The production Content-Security-Policy must be available.");
const assetNames = await fs.readdir(path.join(dist, "assets"));
let projectRef = "";
for (const assetName of assetNames.filter((name) => name.endsWith(".js"))) {
  const source = await fs.readFile(path.join(dist, "assets", assetName), "utf8");
  const match = source.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match) { projectRef = match[1]; break; }
}
assert(projectRef, "The production-equivalent build must include its configured public Supabase origin.");

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
    const isSafeAsset = candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
    let body = indexHtml;
    let extension = ".html";
    if (isSafeAsset) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); }
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
assert(address && typeof address === "object", "Local browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const ownerId = "cb000000-0000-4000-8000-000000000001";
const relationshipId = "cb300000-0000-4000-8000-000000000001";
const participantId = "cb000000-0000-4000-8000-000000000002";
const fixtureUser = {
  id: ownerId, aud: "authenticated", role: "authenticated",
  email: "circle-private-owner@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
  created_at: "2026-08-10T00:00:00.000Z", updated_at: "2026-08-10T00:00:00.000Z",
};
const fixtureAccessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: ownerId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureSession = {
  access_token: fixtureAccessToken, refresh_token: "fixture-refresh-token", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser,
};
const circleOverview = {
  accepted: [{
    relationshipId, status: "accepted", acceptedAt: "2026-08-10T00:00:00.000Z",
    profile: {
      handle: "circle-recipient", displayName: "Circle Recipient", avatarUrl: null,
      shortPublicBio: "Accepted mutual Circle fixture.", profileUrl: "/commons-circle/@circle-recipient",
    },
  }],
  incoming: [], sent: [], counts: { accepted: 1, incoming: 0, sent: 0 },
};

function jsonHeaders() {
  return {
    "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8",
  };
}

async function installSupabaseFixtures(context, { admin = false, captures } = {}) {
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = jsonHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    if (url.pathname.endsWith("/rest/v1/user_roles")) return route.fulfill({ status: 200, headers, body: JSON.stringify(admin ? [{ role: "administrator" }] : []) });
    if (url.pathname.endsWith("/rest/v1/profiles")) {
      const profile = { username: "circle-private-owner", display_name: "Private Owner", is_admin: admin };
      return route.fulfill({ status: 200, headers, body: JSON.stringify(objectResponse ? profile : [profile]) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle")) return route.fulfill({ status: 200, headers, body: JSON.stringify(circleOverview) });
    if (url.pathname.endsWith("/rest/v1/rpc/add_commune_post_circle_participants")) {
      captures.rpcs.push({ name: "add_commune_post_circle_participants", payload: request.postDataJSON() });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ postId: request.postDataJSON()?.p_post_id, added: 1, participantIds: [participantId] }) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) return route.fulfill({ status: 200, headers, body: "[]" });
    if (url.pathname.endsWith("/rest/v1/commune_posts")) {
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        captures.posts.push(...(Array.isArray(payload) ? payload : [payload]));
        return route.fulfill({ status: 201, headers, body: JSON.stringify(objectResponse ? { id: captures.posts.at(-1)?.id } : []) });
      }
      return route.fulfill({ status: 200, headers, body: "[]" });
    }
    if (url.pathname.endsWith("/rest/v1/commune_threads")) {
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        captures.threads.push(...(Array.isArray(payload) ? payload : [payload]));
        return route.fulfill({ status: 201, headers, body: JSON.stringify(objectResponse ? { id: "cb200000-0000-4000-8000-000000000001" } : []) });
      }
      return route.fulfill({ status: 200, headers, body: "[]" });
    }
    if (request.method() === "POST") {
      const payload = request.postDataJSON();
      captures.mutations.push({ path: url.pathname, payload });
      return route.fulfill({ status: 201, headers, body: JSON.stringify(objectResponse ? { id: crypto.randomUUID() } : []) });
    }
    if (url.pathname.includes("/rest/v1/rpc/")) return route.fulfill({ status: 200, headers, body: JSON.stringify(objectResponse ? {} : []) });
    const mutation = ["PATCH", "DELETE"].includes(request.method());
    return route.fulfill({ status: mutation ? 204 : 200, headers, body: mutation ? "" : JSON.stringify(objectResponse ? null : []) });
  });
}

async function createContext(browser, { admin, viewport }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  await context.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession,
  });
  return context;
}

async function choosePrivateAudience(page) {
  const selector = page.locator(".commune-audience-selector");
  await selector.waitFor({ timeout: 30_000 });
  assert.equal(await selector.count(), 1, "Each composer must use exactly one shared audience selector.");
  await selector.getByRole("radio", { name: /Private to selected Circle members/ }).check();
  const member = selector.locator(".commune-circle-member-option input");
  await member.waitFor({ timeout: 20_000 });
  await member.check();
  await selector.locator(".commune-circle-boundary-ack input").check();
  assert.equal(await selector.getByText("1 Circle member selected. You are included automatically.", { exact: true }).count(), 1);
}

function viewportLabel(viewport) {
  if (viewport.width < 600) return "mobile";
  if (viewport.width < 1100) return "half-screen";
  return "desktop";
}

async function fillSafeRequiredFields(page, slug) {
  if (slug === "job-post") {
    await page.getByLabel("Opportunity type *").selectOption("paid_employment");
    await page.getByLabel("Poster / organization type *").selectOption("business_company");
    await page.getByLabel("Compensation status *").selectOption("paid");
    await page.getByLabel("Salary").check();
    await page.getByLabel("Currency *").fill("USD");
    await page.getByLabel("Amount / minimum *").fill("100");
    await page.getByLabel("Amount basis *").selectOption("year");
    await page.getByLabel("Work arrangement *").selectOption("remote");
    await page.getByLabel("Time basis *").selectOption("full_time");
    await page.getByLabel("Duration *").selectOption("ongoing");
    await page.getByLabel("Application route type *").selectOption("official_application_webpage");
  }
  const textInputs = page.locator('input:visible:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"])');
  for (let index = 0; index < await textInputs.count(); index += 1) {
    const input = textInputs.nth(index);
    if ((await input.inputValue()).trim()) continue;
    const labelText = (await input.locator("xpath=ancestor::label[1]").innerText().catch(() => "")).toLowerCase();
    if (labelText.includes("official update post id")) continue;
    const inputType = await input.getAttribute("type");
    const value = inputType === "number" ? "100"
      : /website|url|link|contact|application (?:path|destination)/.test(labelText) ? `https://example.com/${slug}/reference`
      : labelText.includes("filename") ? "fixture.txt" : `Fixture ${slug}`;
    await input.fill(value);
  }
  const textareas = page.locator("textarea:visible");
  for (let index = 0; index < await textareas.count(); index += 1) {
    const textarea = textareas.nth(index);
    if ((await textarea.inputValue()).trim()) continue;
    const labelText = (await textarea.locator("xpath=ancestor::label[1]").innerText().catch(() => "")).toLowerCase();
    const value = /url|link/.test(labelText) ? `https://example.com/${slug}/related` : `Fixture private content for ${slug}.`;
    await textarea.fill(value);
  }
  const checkboxes = page.locator('#commune-post-composer > .commune-checklist:not(.commune-warning-checks) input[type="checkbox"]:visible');
  for (let index = 0; index < await checkboxes.count(); index += 1) {
    const checkbox = checkboxes.nth(index);
    const text = await checkbox.locator("xpath=ancestor::label[1]").innerText().catch(() => "");
    if (!/request .*sandbox/i.test(text)) await checkbox.check();
  }
}

const roomCases = [
  { slug: "media-garden", postType: "media_garden", submit: /Create private room post/ },
  { slug: "troubleshooting-grove", postType: "troubleshooting", submit: /Create private room post/, sidecar: "/rest/v1/commune_troubleshooting_posts" },
  { slug: "coding-cornucopia", postType: "code_sharing", submit: /Create private room post/ },
  { slug: "repository-showcase", postType: "repository_showcase", submit: /Create private Repository Showcase/, sidecar: "/rest/v1/commune_repository_showcases", repository: true },
  { slug: "community-network", postType: "community_network", submit: /Create private room post/ },
  { slug: "job-post", postType: "job_post", submit: /Create private room post/, sidecar: "/rest/v1/commune_job_posts" },
  { slug: "research-notes", postType: "research_note", submit: /Create private room post/, sidecar: "/rest/v1/commune_research_notes" },
  { slug: "elysia-iteration-showcase", postType: "elysia_iteration_showcase", submit: /Create private room post/, sidecar: "/rest/v1/commune_iteration_showcases" },
  { slug: "community-vote", postType: "community_vote", submit: /Create community vote/, sidecar: "/rest/v1/commune_vote_posts", admin: true },
  { slug: "official-updates", postType: "official_update", submit: /Create private room post/, sidecar: "/rest/v1/commune_official_updates", admin: true },
];

async function verifyRoom(browser, room, viewport, screenshot = false) {
  const context = await createContext(browser, { admin: Boolean(room.admin), viewport });
  const captures = { posts: [], threads: [], rpcs: [], mutations: [] };
  await installSupabaseFixtures(context, { admin: Boolean(room.admin), captures });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`${origin}/commune/rooms/${room.slug}/new`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${room.slug} route should load`);
  await choosePrivateAudience(page);
  await fillSafeRequiredFields(page, room.slug);
  if (screenshot) {
    const sandboxRequest = page.getByLabel("Request sandbox review for repository/code metadata. This is not execution permission.");
    if (room.slug === "coding-cornucopia" && await sandboxRequest.count()) await sandboxRequest.check();
    await page.locator(".commune-audience-selector").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidenceDir, `${viewportLabel(viewport)}-${room.slug}-private-composer.png`), fullPage: false });
    if (room.slug === "coding-cornucopia" && await sandboxRequest.count()) await sandboxRequest.uncheck();
  }
  await page.getByRole("button", { name: room.submit }).click();
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const capturedPost = captures.posts.find((item) => item.post_type === room.postType);
    if (capturedPost && captures.rpcs.some((item) => item.payload?.p_post_id === capturedPost.id)) break;
    await page.waitForTimeout(50);
  }
  const post = captures.posts.find((item) => item.post_type === room.postType);
  assert(post, `${room.slug} did not submit a ${room.postType} post: ${(await page.locator(".message").allTextContents()).join(" | ")}`);
  assert.deepEqual({
    audience: post.audience, visibility: post.visibility, status: post.status,
    moderation_status: post.moderation_status, visibility_state: post.visibility_state,
    circle_privacy_acknowledged: post.circle_privacy_acknowledged,
  }, {
    audience: "circle", visibility: "private_draft", status: "published",
    moderation_status: "circle_private", visibility_state: "published",
    circle_privacy_acknowledged: true,
  }, `${room.slug} submitted the wrong private post shape`);
  const thread = captures.threads.find((item) => item.post_id === post.id);
  assert(thread && thread.visibility === "circle", `${room.slug} must create a Circle-private room thread`);
  const share = captures.rpcs.find((item) => item.payload?.p_post_id === post.id);
  assert.deepEqual(share?.payload?.p_circle_relationship_ids, [relationshipId], `${room.slug} must finalize the explicit accepted-Circle ACL; RPCs=${JSON.stringify(captures.rpcs)} post=${post.id}`);
  if (room.sidecar) assert(captures.mutations.some((item) => item.path === room.sidecar), `${room.slug} did not preserve its room-native sidecar`);
  assert(!captures.mutations.some((item) => /review_items|review_history/.test(item.path)), `${room.slug} private post entered an ordinary review queue`);
  assert.deepEqual(pageErrors, [], `${room.slug} emitted uncaught browser errors`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${room.slug} overflowed ${viewport.width}px viewport by ${overflow}px`);
  await context.close();
  console.log(`ok ${room.slug} ${viewport.width}px`);
}

async function verifyEmptyCircleBoundary(browser) {
  const context = await createContext(browser, { admin: false, viewport: { width: 1280, height: 900 } });
  const captures = { posts: [], threads: [], rpcs: [], mutations: [] };
  await installSupabaseFixtures(context, { captures });
  await context.route(/^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/rpc\/current_user_circle/, (route) => route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ accepted: [], incoming: [], sent: [], counts: { accepted: 0, incoming: 0, sent: 0 } }) }));
  const page = await context.newPage();
  await page.goto(`${origin}/commune/rooms/media-garden/new`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.locator(".commune-audience-selector").getByRole("radio", { name: /Private to selected Circle members/ }).check();
  await page.getByText("You do not have accepted Circle members available yet.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Open Your Circle" }).getAttribute("href"), "/commons-circle/signals/circle");
  assert.equal(captures.posts.length, 0, "Empty Circle state must not create a private post");
  await page.locator(".commune-audience-selector").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDir, "desktop-media-garden-empty-circle.png"), fullPage: false });
  await context.close();
}

async function verifyPublicAudienceLayout(browser, viewport) {
  const context = await createContext(browser, { admin: false, viewport });
  const captures = { posts: [], threads: [], rpcs: [], mutations: [] };
  await installSupabaseFixtures(context, { captures });
  const page = await context.newPage();
  await page.goto(`${origin}/commune/rooms/media-garden/new`, { waitUntil: "networkidle", timeout: 45_000 });
  const selector = page.locator(".commune-audience-selector");
  await selector.waitFor();
  assert.equal(await selector.getByRole("radio", { name: /^Public Uses this room's existing moderation and publication path\./ }).isChecked(), true);
  await selector.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDir, `${viewportLabel(viewport)}-media-garden-public-composer.png`), fullPage: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Public composer overflowed ${viewport.width}px by ${overflow}px`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  const filteredRooms = process.env.ELYSIA_CIRCLE_PRIVATE_ROOM
    ? roomCases.filter((room) => room.slug === process.env.ELYSIA_CIRCLE_PRIVATE_ROOM)
    : roomCases;
  assert(filteredRooms.length, "Requested Circle/private browser room fixture does not exist.");
  for (const room of filteredRooms) await verifyRoom(browser, room, { width: 1440, height: 1000 }, room.slug === "media-garden" || room.slug === "community-vote");
  for (const room of filteredRooms) await verifyRoom(browser, room, { width: 820, height: 900 }, room.slug === "coding-cornucopia" || room.slug === "community-network");
  for (const room of filteredRooms) await verifyRoom(browser, room, { width: 390, height: 844 }, room.slug === "repository-showcase" || room.slug === "job-post");
  if (!process.env.ELYSIA_CIRCLE_PRIVATE_ROOM) {
    await verifyEmptyCircleBoundary(browser);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 900 }, { width: 390, height: 844 }]) await verifyPublicAudienceLayout(browser, viewport);
  }
  console.log(`Circle/private Commune browser contract passed for ${filteredRooms.length} room fixture(s) at desktop, half-screen, and mobile widths. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

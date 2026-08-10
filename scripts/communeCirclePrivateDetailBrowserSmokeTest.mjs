import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_CIRCLE_PRIVATE_DETAIL_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_CIRCLE_PRIVATE_DETAIL_EVIDENCE_DIR)
  : "/tmp/elysia-circle-private-detail-browser-evidence";
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

const ids = {
  post: "cd000000-0000-4000-8000-000000000001",
  thread: "cd100000-0000-4000-8000-000000000001",
  owner: "cd200000-0000-4000-8000-000000000001",
  participant: "cd200000-0000-4000-8000-000000000002",
  unrelated: "cd200000-0000-4000-8000-000000000003",
  admin: "cd200000-0000-4000-8000-000000000004",
  relationship: "cd300000-0000-4000-8000-000000000001",
  access: "cd400000-0000-4000-8000-000000000001",
  comment: "cd500000-0000-4000-8000-000000000001",
  media: "cd600000-0000-4000-8000-000000000001",
  room: "cd700000-0000-4000-8000-000000000001",
};
const privateTitle = "Circle-only ecological coordination fixture";
const privateBody = "Private fixture body for selected Circle participants only.";
const roles = {
  owner: { userId: ids.owner, email: "private-owner@example.invalid", username: "private-owner", admin: false, authorized: true },
  participant: { userId: ids.participant, email: "private-participant@example.invalid", username: "private-participant", admin: false, authorized: true },
  unrelated: { userId: ids.unrelated, email: "unrelated-member@example.invalid", username: "unrelated-member", admin: false, authorized: false },
  admin: { userId: ids.admin, email: "nonparticipant-admin@example.invalid", username: "nonparticipant-admin", admin: true, authorized: false },
  anonymous: { userId: null, email: null, username: null, admin: false, authorized: false },
};

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function sessionFor(role) {
  if (!role.userId) return null;
  const user = {
    id: role.userId, aud: "authenticated", role: "authenticated", email: role.email,
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
    created_at: "2026-08-10T00:00:00.000Z", updated_at: "2026-08-10T00:00:00.000Z",
  };
  const token = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: role.userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
  return { access_token: token, refresh_token: "fixture-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };
}
function headers() {
  return {
    "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8",
  };
}
function privatePost(postType = "community_network") {
  return {
    id: ids.post, user_id: ids.owner, author_username: "private-owner",
    title: privateTitle, body: privateBody, excerpt: "Private coordination summary.",
    tags: ["circle-private", "coordination"], links: ["Fixture resource | https://example.com/private-fixture"],
    repository_url: null, status: "published", visibility: "private_draft", audience: "circle",
    visibility_state: "published", hidden_at: null, removed_at: null, archived_at: null,
    published_at: "2026-08-10T01:00:00.000Z", last_activity_at: "2026-08-10T01:05:00.000Z",
    created_at: "2026-08-10T00:55:00.000Z",
    post_type: postType,
  };
}
function participantCards(viewerIsOwner) {
  return {
    viewerIsOwner,
    participants: [{
      accessId: ids.access, relationshipId: ids.relationship, addedAt: "2026-08-10T01:00:00.000Z",
      circleAccepted: viewerIsOwner ? false : null,
      profile: {
        handle: "private-participant", displayName: "Private Participant", avatarUrl: null,
        shortPublicBio: "Explicit Circle post participant.", profileUrl: "/commons-circle/@private-participant",
      },
    }],
  };
}

async function installFixtures(context, role, captures, postType = "community_network") {
  let participantAccess = true;
  await context.route(`${origin}/api/sandbox/health`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "available" }) }));
  await context.route(`${origin}/api/sandbox/credits`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "sandbox_service_unavailable" }) }));
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const responseHeaders = headers();
    const method = request.method();
    const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: responseHeaders, body: "" });
    if (url.pathname.endsWith("/auth/v1/user")) {
      const session = sessionFor(role);
      return route.fulfill({ status: session ? 200 : 401, headers: responseHeaders, body: JSON.stringify(session?.user ?? { message: "not signed in" }) });
    }
    if (url.pathname.endsWith("/rest/v1/user_roles")) return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(role.admin ? [{ role: "administrator" }] : []) });
    if (url.pathname.endsWith("/rest/v1/profiles")) {
      const profile = role.userId ? { username: role.username, display_name: role.username, is_admin: role.admin } : null;
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? profile : profile ? [profile] : []) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_rooms")) {
      const room = postType === "community_vote"
        ? { slug: "community-vote", name: "Community Voting Room", room_type: "community_vote" }
        : postType === "code_sharing"
        ? { slug: "coding-cornucopia", name: "Coding Cornucopia", room_type: "code_sharing" }
        : { slug: "community-network", name: "Community Network", room_type: "community_network" };
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify([{ id: ids.room, ...room, description: "Private room-native fixture.", requires_moderation: true }]) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_posts")) {
      if (method === "POST") return route.fulfill({ status: 403, headers: responseHeaders, body: JSON.stringify({ message: "unexpected post insert" }) });
      if (url.searchParams.get("select") === "audience") {
        return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? { audience: "circle" } : [{ audience: "circle" }]) });
      }
      const asksPublic = url.searchParams.get("audience")?.includes("public");
      const rows = role.authorized && !asksPublic ? [privatePost(postType)] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? rows[0] ?? null : rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_threads")) {
      const rows = role.authorized ? [{ id: ids.thread, post_id: ids.post, room_id: ids.room, title: privateTitle, status: "open", visibility: "circle", last_reply_at: "2026-08-10T01:05:00.000Z" }] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? rows[0] ?? null : rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_comments")) {
      if (method === "POST") {
        const payload = request.postDataJSON();
        captures.comments.push(...(Array.isArray(payload) ? payload : [payload]));
        return route.fulfill({ status: role.authorized ? 201 : 403, headers: responseHeaders, body: JSON.stringify(role.authorized ? [] : { message: "row-level security" }) });
      }
      const rows = role.authorized ? [{ id: ids.comment, thread_id: ids.thread, post_id: ids.post, parent_comment_id: null, author_username: "private-participant", body: "Existing private participant comment.", status: "published", created_at: "2026-08-10T01:05:00.000Z", published_at: "2026-08-10T01:05:00.000Z" }] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_media")) {
      const rows = role.authorized ? [{ id: ids.media, post_id: ids.post, storage_bucket: "commune-media", storage_path: `${ids.owner}/private-fixture.txt`, file_name: "private-fixture.txt", mime_type: "text/plain", file_size: 31, media_kind: "document", visibility_state: "published", created_at: "2026-08-10T01:00:00.000Z" }] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.includes("/storage/v1/object/commune-media/")) {
      captures.downloads.push(url.pathname);
      return route.fulfill({ status: role.authorized ? 200 : 403, headers: { ...responseHeaders, "Content-Type": "text/plain" }, body: role.authorized ? "authorized private fixture file" : "denied" });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/commune_post_circle_participant_cards")) {
      const cards = participantCards(role.userId === ids.owner);
      if (!participantAccess) cards.participants = [];
      return route.fulfill({ status: role.authorized ? 200 : 403, headers: responseHeaders, body: JSON.stringify(role.authorized ? cards : { message: "row-level security" }) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle")) {
      const overview = role.userId === ids.owner ? {
        accepted: [{ relationshipId: ids.relationship, status: "accepted", acceptedAt: "2026-08-10T00:00:00.000Z", profile: participantCards(true).participants[0].profile }],
        incoming: [], sent: [], counts: { accepted: 1, incoming: 0, sent: 0 },
      } : { accepted: [], incoming: [], sent: [], counts: { accepted: 0, incoming: 0, sent: 0 } };
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(overview) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/remove_commune_post_circle_participant")) {
      captures.removals.push(request.postDataJSON());
      if (role.userId === ids.owner) participantAccess = false;
      return route.fulfill({ status: role.userId === ids.owner ? 200 : 403, headers: responseHeaders, body: JSON.stringify(role.userId === ids.owner ? { removed: true } : { message: "Only owner" }) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) return route.fulfill({ status: 200, headers: responseHeaders, body: "[]" });
    if (url.pathname.endsWith("/rest/v1/commune_saved_posts") || url.pathname.endsWith("/rest/v1/user_followed_commune_threads")) return route.fulfill({ status: 200, headers: responseHeaders, body: "[]" });
    if (url.pathname.endsWith("/rest/v1/commune_code_snippets")) {
      const rows = role.authorized && postType === "code_sharing" ? [{
        id: "cd800000-0000-4000-8000-000000000001", post_id: ids.post, language: "javascript", file_name: "circle-fixture.js",
        code_text: "export function circleFixture() {\n  return 'explicit participants only';\n}", secret_scan_status: "clear",
        sandbox_warning_acknowledged: true, accepted_revision_id: null, accepted_version_number: 1, accepted_revision_summary: null,
        created_at: "2026-08-10T01:00:00.000Z", updated_at: "2026-08-10T01:00:00.000Z",
      }] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_vote_posts")) {
      const rows = role.authorized && postType === "community_vote" ? [{
        post_id: ids.post, question: "Which private Circle path should we prototype?", context: "A private advisory vote visible only to explicitly selected participants.",
        decision_type: "single_choice_guidance", vote_status: "open", visibility: "public", opens_at: "2026-08-10T00:00:00.000Z",
        closes_at: "2026-08-20T00:00:00.000Z", results_visibility: "after_vote", allow_comments: true,
        admin_outcome_summary: null, official_update_post_id: null, created_at: "2026-08-10T00:55:00.000Z", updated_at: "2026-08-10T00:55:00.000Z",
      }] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_vote_options")) {
      const rows = role.authorized && postType === "community_vote" ? [
        { id: "cd810000-0000-4000-8000-000000000001", vote_post_id: ids.post, option_label: "Prototype A", option_description: "Start with the smallest private workflow.", display_order: 0 },
        { id: "cd810000-0000-4000-8000-000000000002", vote_post_id: ids.post, option_label: "Prototype B", option_description: "Start with the room-native collaboration workflow.", display_order: 1 },
      ] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/commune_vote_result_summary")) {
      const rows = role.authorized && postType === "community_vote" ? [
        { vote_post_id: ids.post, option_id: "cd810000-0000-4000-8000-000000000001", ballot_count: 1, total_ballots: 1, percentage: 100 },
        { vote_post_id: ids.post, option_id: "cd810000-0000-4000-8000-000000000002", ballot_count: 0, total_ballots: 1, percentage: 0 },
      ] : [];
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith("/rest/v1/commune_vote_ballots")) return route.fulfill({ status: 200, headers: responseHeaders, body: "[]" });
    if (url.pathname.endsWith("/rest/v1/commune_vote_events")) return route.fulfill({ status: 200, headers: responseHeaders, body: "[]" });
    if (url.pathname.includes("/rest/v1/rpc/")) return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? {} : []) });
    if (method === "POST") {
      captures.otherMutations.push({ path: url.pathname, payload: request.postDataJSON() });
      return route.fulfill({ status: 201, headers: responseHeaders, body: JSON.stringify(objectResponse ? { id: crypto.randomUUID() } : []) });
    }
    if (["PATCH", "DELETE"].includes(method)) return route.fulfill({ status: 204, headers: responseHeaders, body: "" });
    return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(objectResponse ? null : []) });
  });
}

async function contextFor(browser, role, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  const session = sessionFor(role);
  if (session) await context.addInitScript(({ storageKey, value }) => localStorage.setItem(storageKey, JSON.stringify(value)), { storageKey: `sb-${projectRef}-auth-token`, value: session });
  return context;
}

async function scrollBelowStickyHeader(locator) {
  await locator.evaluate((element) => {
    const header = document.querySelector(".site-header");
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  });
}

async function verifyAuthorized(browser, roleName, viewport, screenshotName) {
  const role = roles[roleName];
  const context = await contextFor(browser, role, viewport);
  const captures = { comments: [], downloads: [], removals: [], otherMutations: [] };
  await installFixtures(context, role, captures);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`${origin}/commune/posts/${ids.post}`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: privateTitle }).waitFor();
  await page.getByText("Private Circle record", { exact: true }).waitFor();
  await page.getByText(privateBody, { exact: true }).waitFor();
  await page.getByText("Existing private participant comment.", { exact: true }).waitFor();
  await page.getByText("private-fixture.txt", { exact: true }).first().waitFor();
  assert(captures.downloads.length >= 1, `${roleName} should fetch the authorized attachment through its signed-in session`);
  assert.equal(await page.locator(".commune-private-participants").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Remove access" }).count(), roleName === "owner" ? 1 : 0);
  assert.equal(await page.getByText("No longer in Your Circle", { exact: true }).count(), roleName === "owner" ? 1 : 0, "Only the owner should see former-Circle relationship state");
  assert.equal(await page.getByText("Role-gated moderation", { exact: true }).count(), 0, "Private content must not expose ordinary moderation controls");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${roleName} private detail overflowed by ${overflow}px`);
  assert.deepEqual(pageErrors, []);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidenceDir, screenshotName), fullPage: false });
  if (roleName === "owner") {
    const participantPanel = page.locator(".commune-private-participants");
    await participantPanel.screenshot({ path: path.join(evidenceDir, "desktop-private-owner-former-circle-participant.png") });
    await participantPanel.getByRole("button", { name: "Remove access" }).click();
    await page.getByText("Participant access removed. Their existing authored thread history remains part of the post.", { exact: true }).waitFor();
    await participantPanel.getByText("1 person including author", { exact: true }).waitFor();
    assert.deepEqual(captures.removals, [{ p_access_id: ids.access }]);
    await participantPanel.screenshot({ path: path.join(evidenceDir, "desktop-private-owner-after-explicit-access-removal.png") });
  }
  if (roleName === "participant") {
    await page.getByLabel("Comment on this post").fill("New direct private participant comment.");
    await page.getByRole("button", { name: "Submit comment" }).click();
    for (let attempt = 0; attempt < 100 && captures.comments.length === 0; attempt += 1) await page.waitForTimeout(50);
    assert.equal(captures.comments.length, 1, "Participant comment was not written");
    assert.equal(captures.comments[0].status, "published", "Private participant comment must publish inside the ACL without entering public review");
    assert.equal(captures.comments[0].post_id, ids.post);
    assert(!captures.otherMutations.some((item) => /review_items|review_history/.test(item.path)), "Private participant comment entered an ordinary review queue");
    await page.screenshot({ path: path.join(evidenceDir, screenshotName.replace(/\.png$/, "-after-comment.png")), fullPage: false });
  }
  await context.close();
}

async function verifyDenied(browser, roleName, screenshotName) {
  const role = roles[roleName];
  const context = await contextFor(browser, role, { width: 1280, height: 900 });
  const captures = { comments: [], downloads: [], removals: [], otherMutations: [] };
  await installFixtures(context, role, captures);
  const page = await context.newPage();
  const response = await page.goto(`${origin}/commune/posts/${ids.post}`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Post not found" }).waitFor();
  assert.equal(await page.getByText(privateTitle, { exact: true }).count(), 0, `${roleName} learned the private title`);
  assert.equal(await page.getByText(privateBody, { exact: true }).count(), 0, `${roleName} learned the private body`);
  assert.equal(captures.downloads.length, 0, `${roleName} fetched a private attachment`);
  assert.equal(captures.comments.length, 0, `${roleName} wrote a private comment`);
  await page.screenshot({ path: path.join(evidenceDir, screenshotName), fullPage: false });
  await context.close();
}

async function verifyNativeDetail(browser, postType, viewport, prefix) {
  const role = roles.participant;
  const context = await contextFor(browser, role, viewport);
  const captures = { comments: [], downloads: [], removals: [], otherMutations: [] };
  await installFixtures(context, role, captures, postType);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/commune/posts/${ids.post}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByText("Private Circle record", { exact: true }).waitFor();
  if (postType === "code_sharing") {
    await page.getByText("Code attached to this post", { exact: true }).waitFor();
    await page.getByText("Sandbox available", { exact: true }).waitFor();
    const codeSection = page.locator(".commune-code-section");
    await scrollBelowStickyHeader(codeSection);
    await page.screenshot({ path: path.join(evidenceDir, `${prefix}-private-coding-native.png`), fullPage: false });
    await scrollBelowStickyHeader(page.locator(".coding-sandbox-panel"));
    await page.screenshot({ path: path.join(evidenceDir, `${prefix}-private-coding-sandbox.png`), fullPage: false });
  } else {
    await page.getByRole("heading", { name: "Which private Circle path should we prototype?", exact: true }).waitFor();
    await page.getByText("Prototype A", { exact: true }).waitFor();
    await scrollBelowStickyHeader(page.locator(".commune-vote-detail"));
    await page.screenshot({ path: path.join(evidenceDir, `${prefix}-private-community-vote.png`), fullPage: false });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${postType} private detail overflowed ${viewport.width}px by ${overflow}px`);
  assert.deepEqual(pageErrors, [], `${postType} private detail emitted browser errors`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyAuthorized(browser, "owner", { width: 1440, height: 1000 }, "desktop-private-owner.png");
  await verifyAuthorized(browser, "participant", { width: 1440, height: 1000 }, "desktop-private-participant.png");
  await verifyAuthorized(browser, "participant", { width: 820, height: 900 }, "half-screen-private-participant.png");
  await verifyAuthorized(browser, "participant", { width: 390, height: 844 }, "mobile-private-participant.png");
  await verifyDenied(browser, "unrelated", "desktop-unrelated-member-denied.png");
  await verifyDenied(browser, "admin", "desktop-admin-nonparticipant-denied.png");
  await verifyDenied(browser, "anonymous", "desktop-logged-out-denied.png");
  await verifyNativeDetail(browser, "code_sharing", { width: 1440, height: 1000 }, "desktop");
  await verifyNativeDetail(browser, "community_vote", { width: 1440, height: 1000 }, "desktop");
  await verifyNativeDetail(browser, "community_vote", { width: 390, height: 844 }, "mobile");
  console.log(`Circle/private post detail browser contract passed for owner, participant, unrelated member, admin nonparticipant, logged-out, Coding Cornucopia sandbox, and Community Voting Room views. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

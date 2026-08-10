import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_CIRCLE_MUTUAL_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_CIRCLE_MUTUAL_EVIDENCE_DIR)
  : path.join("/tmp", "elysia-circle-mutual-browser-evidence");
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
assert(projectRef, "The production-equivalent build must include its public Supabase origin.");

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
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const userId = "cc000000-0000-4000-8000-000000000001";
const fixtureUser = {
  id: userId, aud: "authenticated", role: "authenticated", email: "circle-owner@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
  created_at: "2026-08-10T00:00:00.000Z", updated_at: "2026-08-10T00:00:00.000Z",
};
const token = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
const session = { access_token: token, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser };

const ids = {
  existing: "cc300000-0000-4000-8000-000000000001",
  accept: "cc300000-0000-4000-8000-000000000002",
  decline: "cc300000-0000-4000-8000-000000000003",
  sent: "cc300000-0000-4000-8000-000000000004",
};
function item(relationshipId, handle, displayName, status) {
  return {
    relationshipId, status, createdAt: "2026-08-10T00:00:00.000Z",
    acceptedAt: status === "accepted" ? "2026-08-10T00:05:00.000Z" : null,
    profile: { handle, displayName, avatarUrl: null, shortPublicBio: `${displayName} browser fixture.`, profileUrl: `/commons-circle/@${handle}` },
  };
}
function initialOverview() {
  return {
    accepted: [item(ids.existing, "existing-mutual", "Existing Mutual", "accepted")],
    incoming: [item(ids.accept, "incoming-accept", "Incoming Accept", "pending"), item(ids.decline, "incoming-decline", "Incoming Decline", "pending")],
    sent: [item(ids.sent, "waiting-consent", "Waiting Consent", "pending")],
  };
}
function withCounts(state) {
  return { ...state, counts: { accepted: state.accepted.length, incoming: state.incoming.length, sent: state.sent.length } };
}
function reviewFixture(profileKind = "former") {
  const posts = [
    { accessId: "cc400000-0000-4000-8000-000000000001", postId: "cc100000-0000-4000-8000-000000000001", title: "Private Research Planning", postType: "research_note", postUrl: "/commune/posts/cc100000-0000-4000-8000-000000000001", sharedAt: "2026-08-10T01:00:00.000Z" },
    { accessId: "cc400000-0000-4000-8000-000000000002", postId: "cc100000-0000-4000-8000-000000000002", title: "Private Community Coordination", postType: "community_network", postUrl: "/commune/posts/cc100000-0000-4000-8000-000000000002", sharedAt: "2026-08-10T02:00:00.000Z" },
  ];
  return {
    members: [{
      relationshipId: profileKind === "existing" ? ids.existing : "cc300000-0000-4000-8000-000000000005",
      profile: profileKind === "existing"
        ? { handle: "existing-mutual", displayName: "Existing Mutual", avatarUrl: null, shortPublicBio: "Existing Mutual browser fixture.", profileUrl: "/commons-circle/@existing-mutual" }
        : { handle: "former-collaborator", displayName: "Former Collaborator", avatarUrl: null, shortPublicBio: "Former collaborator browser fixture.", profileUrl: "/commons-circle/@former-collaborator" },
      privatePostCount: posts.length,
      posts,
    }],
    counts: { formerMembers: 1, privatePosts: posts.length },
  };
}
function jsonHeaders() {
  return { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
}

function viewportLabel(viewport) {
  if (viewport.width < 600) return "mobile";
  if (viewport.width < 1100) return "half-screen";
  return "desktop";
}

async function verify(viewport, exerciseMutations, stateKind = "mixed") {
  let state = stateKind === "empty" ? { accepted: [], incoming: [], sent: [] } : initialOverview();
  let accessReview = stateKind === "review" ? reviewFixture() : { members: [], counts: { formerMembers: 0, privatePosts: 0 } };
  const calls = [];
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  await context.addInitScript(({ storageKey, value }) => localStorage.setItem(storageKey, JSON.stringify(value)), { storageKey: `sb-${projectRef}-auth-token`, value: session });
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = jsonHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle")) return route.fulfill({ status: 200, headers, body: JSON.stringify(withCounts(state)) });
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle_access_review")) return route.fulfill({ status: 200, headers, body: JSON.stringify(accessReview) });
    if (url.pathname.endsWith("/rest/v1/rpc/respond_to_commons_circle_invitation")) {
      const payload = request.postDataJSON();
      calls.push({ name: "respond", payload });
      const selected = state.incoming.find((entry) => entry.relationshipId === payload.p_relationship_id);
      if (selected) {
        state = {
          ...state,
          incoming: state.incoming.filter((entry) => entry.relationshipId !== selected.relationshipId),
          accepted: payload.p_accept ? [...state.accepted, { ...selected, status: "accepted", acceptedAt: "2026-08-10T00:10:00.000Z" }] : state.accepted,
        };
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ state: payload.p_accept ? "accepted" : "declined" }) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/remove_from_commons_circle")) {
      const payload = request.postDataJSON();
      calls.push({ name: "remove", payload });
      state = { ...state, accepted: state.accepted.filter((entry) => entry.relationshipId !== payload.p_relationship_id) };
      accessReview = reviewFixture("existing");
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ state: "removed", remainingOwnedPrivatePostCount: 2 }) });
    }
    if (url.pathname.endsWith("/rest/v1/rpc/remove_commune_post_circle_participant")) {
      const payload = request.postDataJSON();
      calls.push({ name: "remove-access", payload });
      const members = accessReview.members.flatMap((member) => {
        const posts = member.posts.filter((post) => post.accessId !== payload.p_access_id);
        return posts.length ? [{ ...member, privatePostCount: posts.length, posts }] : [];
      });
      accessReview = { members, counts: { formerMembers: members.length, privatePosts: members.reduce((total, member) => total + member.posts.length, 0) } };
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ removed: true }) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/commons-circle/signals/circle`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByRole("heading", { name: "Your Circle", exact: true }).waitFor();
  await page.getByRole("heading", { name: stateKind === "empty" ? "0 mutual Circle members" : "1 mutual Circle member", exact: true }).waitFor();
  assert.equal(await page.getByText("Circle membership is not a follower count, endorsement, employment relationship, reviewer status, moderator status, or administrator authority.", { exact: true }).count(), 1);
  assert.equal(await page.getByText("Administrators do not receive blanket access.", { exact: false }).count(), 1);
  await page.screenshot({ path: path.join(evidenceDir, `${viewportLabel(viewport)}-circle-${stateKind === "empty" ? "empty" : stateKind === "review" ? "review-overview" : "before"}.png`), fullPage: true });
  if (stateKind === "review") {
    const review = page.locator("#access-review");
    await review.getByRole("heading", { name: "Review durable private-post access", exact: true }).waitFor();
    assert.equal(await review.getByRole("button", { name: "Remove access" }).count(), 2);
    await review.screenshot({ path: path.join(evidenceDir, `${viewportLabel(viewport)}-circle-access-review.png`) });
  }
  if (exerciseMutations) {
    const acceptCard = page.getByRole("heading", { name: "Incoming Accept", exact: true }).locator("xpath=ancestor::article[1]");
    await acceptCard.getByRole("button", { name: "Accept invitation" }).click();
    await page.getByRole("heading", { name: "2 mutual Circle members", exact: true }).waitFor();
    const declineCard = page.getByRole("heading", { name: "Incoming Decline", exact: true }).locator("xpath=ancestor::article[1]");
    await declineCard.getByRole("button", { name: "Decline" }).click();
    await page.getByText("No incoming Circle invitations.", { exact: true }).waitFor();
    const existingCard = page.getByRole("heading", { name: "Existing Mutual", exact: true }).locator("xpath=ancestor::article[1]");
    await existingCard.getByRole("button", { name: "Remove from Circle" }).click();
    await page.getByRole("heading", { name: "1 mutual Circle member", exact: true }).waitFor();
    await page.getByText("Removed from Your Circle. They still have access to 2 private posts you own. Existing private-post access was not changed.", { exact: true }).waitFor();
    const accessReviewSection = page.locator("#access-review");
    await accessReviewSection.getByRole("heading", { name: "Review durable private-post access", exact: true }).waitFor();
    await accessReviewSection.screenshot({ path: path.join(evidenceDir, "desktop-circle-access-review-after-remove.png") });
    assert.deepEqual(calls.slice(0, 3), [
      { name: "respond", payload: { p_relationship_id: ids.accept, p_accept: true } },
      { name: "respond", payload: { p_relationship_id: ids.decline, p_accept: false } },
      { name: "remove", payload: { p_relationship_id: ids.existing } },
    ]);

    await page.goto(`${origin}/commons-circle/signals`, { waitUntil: "networkidle", timeout: 45_000 });
    const circleCard = page.getByRole("heading", { name: "Your Circle", exact: true }).locator("xpath=ancestor::article[1]");
    await circleCard.getByText("1 former Circle member still has access to 2 private posts you own.", { exact: true }).waitFor();
    assert.equal(await circleCard.getByText("Private Research Planning", { exact: true }).count(), 0, "Signals must not embed private post titles.");
    await circleCard.screenshot({ path: path.join(evidenceDir, "desktop-signals-circle-access-review-warning.png") });
    await circleCard.getByRole("link", { name: "Review access" }).click();
    await accessReviewSection.getByRole("heading", { name: "Review durable private-post access", exact: true }).waitFor();

    await accessReviewSection.getByRole("button", { name: "Remove access" }).first().click();
    await accessReviewSection.getByText("1 private post", { exact: true }).waitFor();
    await accessReviewSection.screenshot({ path: path.join(evidenceDir, "desktop-circle-access-review-after-one-explicit-removal.png") });
    await accessReviewSection.getByRole("button", { name: "Remove access" }).click();
    await page.getByText("Participant access removed from this private post. Other private-post access was not changed.", { exact: true }).waitFor();
    await page.locator("#access-review").waitFor({ state: "detached" });
    assert.deepEqual(calls.slice(3), [
      { name: "remove-access", payload: { p_access_id: "cc400000-0000-4000-8000-000000000001" } },
      { name: "remove-access", payload: { p_access_id: "cc400000-0000-4000-8000-000000000002" } },
    ]);
    await page.screenshot({ path: path.join(evidenceDir, "desktop-circle-after-accept-decline-remove.png"), fullPage: true });
  }
  assert.deepEqual(pageErrors, []);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Your Circle overflowed ${viewport.width}px by ${overflow}px`);
  await context.close();
}

async function verifySignedOutBoundary() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let circleRpcCalls = 0;
  let accessReviewRpcCalls = 0;
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = jsonHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle")) circleRpcCalls += 1;
    if (url.pathname.endsWith("/rest/v1/rpc/current_user_circle_access_review")) accessReviewRpcCalls += 1;
    return route.fulfill({ status: 401, headers, body: JSON.stringify({ message: "authentication required" }) });
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(`${origin}/commons-circle/signals/circle`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByText("Sign in to use Your Circle.", { exact: true }).waitFor();
  assert.equal(circleRpcCalls, 0, "Signed-out Circle page must not call the authenticated Circle RPC.");
  assert.equal(accessReviewRpcCalls, 0, "Signed-out Circle page must not call the owner-only Access Review RPC.");
  assert.deepEqual(consoleErrors, [], "Signed-out Circle page must not emit a 401 console error.");
  await page.screenshot({ path: path.join(evidenceDir, "desktop-circle-signed-out-boundary.png"), fullPage: true });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verify({ width: 1440, height: 1000 }, true);
  await verify({ width: 820, height: 900 }, false);
  await verify({ width: 390, height: 844 }, false);
  await verify({ width: 820, height: 900 }, false, "review");
  await verify({ width: 390, height: 844 }, false, "review");
  await verify({ width: 1440, height: 1000 }, false, "empty");
  await verifySignedOutBoundary();
  console.log(`Mutual Commons Circle browser flow passed for accept, decline, Circle removal, compact Signals review routing, explicit ACL removal, desktop, half-screen, mobile, empty, and signed-out no-RPC states. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

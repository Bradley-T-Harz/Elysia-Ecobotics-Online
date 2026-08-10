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
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ state: "removed" }) });
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
  await page.screenshot({ path: path.join(evidenceDir, `${viewportLabel(viewport)}-circle-${stateKind === "empty" ? "empty" : "before"}.png`), fullPage: true });
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
    assert.deepEqual(calls, [
      { name: "respond", payload: { p_relationship_id: ids.accept, p_accept: true } },
      { name: "respond", payload: { p_relationship_id: ids.decline, p_accept: false } },
      { name: "remove", payload: { p_relationship_id: ids.existing } },
    ]);
    await page.screenshot({ path: path.join(evidenceDir, "desktop-circle-after-accept-decline-remove.png"), fullPage: true });
  }
  assert.deepEqual(pageErrors, []);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Your Circle overflowed ${viewport.width}px by ${overflow}px`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verify({ width: 1440, height: 1000 }, true);
  await verify({ width: 820, height: 900 }, false);
  await verify({ width: 390, height: 844 }, false);
  await verify({ width: 1440, height: 1000 }, false, "empty");
  console.log(`Mutual Commons Circle browser flow passed for accept, decline, remove, desktop, half-screen, mobile, and empty states. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

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

const assetNames = await fs.readdir(path.join(dist, "assets"));
let projectRef = "";
for (const assetName of assetNames.filter((name) => name.endsWith(".js"))) {
  const source = await fs.readFile(path.join(dist, "assets", assetName), "utf8");
  const match = source.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match) { projectRef = match[1]; break; }
}
assert(projectRef, "The built Online application must contain its configured public Supabase origin.");

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const userId = "b9100000-0000-4000-8000-000000000001";
const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "account-communications-fixture@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-08-02T12:00:00.000Z",
  updated_at: "2026-08-02T12:00:00.000Z",
};
const fixtureSession = {
  access_token: accessToken,
  refresh_token: "fixture-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: fixtureUser,
};

const inboxItemId = "b9200000-0000-4000-8000-000000000001";
const proposalId = "b9300000-0000-4000-8000-000000000001";
const conversationId = "b9400000-0000-4000-8000-000000000001";
const messageId = "b9500000-0000-4000-8000-000000000001";
const inboxPayload = {
  items: [{
    id: inboxItemId,
    kind: "action",
    domain: "code_proposals",
    sourceType: "commune_code_revision_proposal",
    category: "work_reviews",
    title: "A revision proposal is ready for review",
    preview: "Open the proposal review route to make an established author decision.",
    deepLink: `/commune/coding-cornucopia/review?proposal=${proposalId}`,
    actionKind: "review_proposal",
    priority: 75,
    readAt: null,
    archivedAt: null,
    completedAt: null,
    supersededAt: null,
    createdAt: "2026-08-02T12:00:00.000Z",
    sourceAvailable: true,
    actor: { handle: "fixture-contributor", displayName: "Fixture Contributor", avatarUrl: null },
  }],
  limit: 30,
};
const requestsPayload = {
  items: [{
    key: `code_proposals:${proposalId}`,
    domain: "code_proposals",
    sourceType: "commune_code_revision_proposal",
    title: "Revision proposal for “Fixture code post”",
    status: "submitted",
    secondaryStatus: null,
    pending: true,
    deepLink: `/commune/coding-cornucopia/review?proposal=${proposalId}`,
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
  }],
  limit: 40,
  hasMore: false,
  nextCursor: null,
};
const conversationSummary = {
  id: conversationId,
  type: "direct",
  subject: "Fixture professional conversation",
  state: "active",
  replyPolicy: "participants",
  sourceDomain: null,
  sourceType: null,
  sourceAvailable: true,
  participantRole: "recipient",
  participationState: "accepted",
  incomingRequest: false,
  outgoingRequest: false,
  canReply: true,
  blockedByCurrentUser: false,
  unreadCount: 1,
  archivedAt: null,
  mutedAt: null,
  lastMessageAt: "2026-08-02T12:15:00.000Z",
  updatedAt: "2026-08-02T12:15:00.000Z",
  counterpart: { handle: "fixture-colleague", displayName: "Fixture Colleague", avatarUrl: null },
};
const conversationListPayload = { items: [conversationSummary], limit: 50 };
const conversationDetailPayload = {
  conversation: { ...conversationSummary, createdAt: "2026-08-02T12:10:00.000Z" },
  participants: [
    { role: "recipient", state: "accepted", self: true, profile: { handle: "fixture-account", displayName: "Fixture Account", avatarUrl: null } },
    { role: "requester", state: "accepted", self: false, profile: conversationSummary.counterpart },
  ],
  messages: [{ id: messageId, senderKind: "user", senderSelf: false, sender: conversationSummary.counterpart, body: "SYNTHETIC_BROWSER_PRIVATE_MESSAGE", editedAt: null, deletedAt: null, createdAt: "2026-08-02T12:15:00.000Z" }],
  privacy: { storedInSupabase: true, endToEndEncrypted: false, participantScoped: true, attachmentsEnabled: false },
};

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const requested = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const candidate = path.normalize(path.join(dist, requested === "/" ? "index.html" : requested));
    const safeCandidate = candidate.startsWith(dist) ? candidate : path.join(dist, "index.html");
    let body;
    let filePath = safeCandidate;
    try { body = await fs.readFile(filePath); }
    catch { filePath = path.join(dist, "index.html"); body = indexHtml; }
    response.writeHead(200, {
      "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "Content-Security-Policy": csp,
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of [
    { path: "/commons-circle/inbox", width: 1280, heading: "Inbox" },
    { path: "/commons-circle/inbox", width: 390, heading: "Inbox" },
    { path: "/commons-circle/requests-reviews", width: 1280, heading: "Requests & Reviews" },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
      window.__elysiaCspViolations = [];
      window.addEventListener("securitypolicyviolation", (event) => {
        window.__elysiaCspViolations.push({ blockedUri: event.blockedURI, directive: event.effectiveDirective });
      });
    }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
    await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,PATCH,POST,OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
      if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_event_counts")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ inboxNeedsAttention: 1, inboxUnread: 1, messagesUnread: 0, notificationsUnread: 2 }) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_request_counts")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ total: 1, pending: 1, byDomain: { code_proposals: { total: 1, pending: 1 } } }) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_inbox_items")) return route.fulfill({ status: 200, headers, body: JSON.stringify(inboxPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_requests_and_reviews")) return route.fulfill({ status: 200, headers, body: JSON.stringify(requestsPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_messaging_preferences")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ preferenceVersion: 1, receiveDirectRequests: true, receiveOptionalAnnouncements: false, allowSourceLinkedMessages: true, ordinaryMessagingEligible: true, storedInSupabase: true, endToEndEncrypted: false }) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_conversations")) return route.fulfill({ status: 200, headers, body: JSON.stringify(conversationListPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_conversation")) return route.fulfill({ status: 200, headers, body: JSON.stringify(conversationDetailPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/mark_current_user_conversation_read")) return route.fulfill({ status: 200, headers, body: "null" });
      if (/\/rest\/v1\/rpc\/set_current_user_inbox_(?:read|archived)$/.test(url.pathname)) return route.fulfill({ status: 200, headers, body: "null" });
      return route.fulfill({ status: 200, headers, body: "[]" });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(`${origin}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert.equal(response?.status(), 200, `${scenario.path} should load.`);
    await page.getByRole("heading", { name: scenario.heading, exact: true }).first().waitFor();
    assert.equal(await page.locator("body").getByText("PRIVATE_WORK_WITH_BODY_MUST_NOT_PROJECT", { exact: false }).count(), 0, "Private source bodies must not render.");
    assert.equal(await page.locator("body").getByText(proposalId, { exact: false }).count(), 0, "Raw source identifiers must not render as ordinary UI text.");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false, `${scenario.path} must not overflow at ${scenario.width}px.`);
    assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations ?? []), [], `${scenario.path} must not violate CSP.`);
    assert.deepEqual(pageErrors, [], `${scenario.path} should have no page errors.`);
    if (scenario.path.endsWith("/inbox")) {
      await page.getByRole("tab", { name: /Needs attention/ }).waitFor();
      await page.getByText("A revision proposal is ready for review", { exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Review Proposal" }).getAttribute("href"), `/commune/coding-cornucopia/review?proposal=${proposalId}`);
      await page.getByRole("tab", { name: "Messages" }).click();
      await page.getByText("Governed private communication", { exact: true }).waitFor();
      await page.getByText("Fixture professional conversation", { exact: true }).first().waitFor();
      await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
      assert.equal(await page.getByText(conversationId, { exact: false }).count(), 0, "Raw conversation identifiers must not render as ordinary UI text.");
      await page.getByText("Messages are stored in Supabase and are not end-to-end encrypted.", { exact: false }).waitFor();
    } else {
      await page.getByText("Revision proposal for “Fixture code post”", { exact: true }).waitFor();
      await page.getByText("Pending / needs action", { exact: true }).waitFor();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Account communications production-build browser smoke test passed for recipient rendering, exact counts, safe deep links, privacy, CSP, and responsive layout.");

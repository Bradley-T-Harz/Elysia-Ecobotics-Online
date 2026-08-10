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
const notificationId = "b9250000-0000-4000-8000-000000000001";
const proposalId = "b9300000-0000-4000-8000-000000000001";
const conversationId = "b9400000-0000-4000-8000-000000000001";
const messageId = "b9500000-0000-4000-8000-000000000001";
const resolvedRecipient = {
  state: "can_request",
  profile: { handle: "fixture-colleague", displayName: "Fixture Colleague", avatarUrl: null, shortPublicBio: "Synthetic public profile descriptor." },
};
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
const notificationsPayload = {
  items: [{
    id: notificationId,
    kind: "outcome",
    domain: "code_proposals",
    sourceType: "commune_code_revision_proposal",
    category: "work_reviews",
    mandatory: false,
    title: "Your revision proposal was accepted",
    preview: "Open the published post to see the accepted revision.",
    deepLink: `/commune/coding-cornucopia/review?proposal=${proposalId}`,
    readAt: null,
    archivedAt: null,
    createdAt: "2026-08-02T12:20:00.000Z",
    sourceAvailable: true,
    actor: { handle: "fixture-author", displayName: "Fixture Author", avatarUrl: null },
  }],
  limit: 30,
};
const eventPreferencesPayload = {
  taxonomyVersion: 1,
  preferences: [{ category: "work_reviews", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: false, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: "UTC" }],
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
const screenshotDir = process.env.ELYSIA_ACCOUNT_COMMUNICATIONS_SCREENSHOT_DIR || "";
if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of [
    { path: "/commons-circle/signals/inbox", width: 1280, heading: "Inbox", kind: "inbox" },
    { path: "/commons-circle/signals/inbox", width: 390, heading: "Inbox", kind: "inbox" },
    { path: "/commons-circle/signals/inbox/new?recipient=%40fixture-colleague", width: 1280, heading: "Start a private conversation", kind: "new-conversation" },
    { path: "/commons-circle/signals/inbox/new?recipient=%40fixture-colleague", width: 390, heading: "Start a private conversation", kind: "new-conversation-mobile" },
    { path: "/commons-circle/signals/inbox/new", width: 1280, heading: "Start a private conversation", kind: "profile-search" },
    { path: "/commons-circle/signals/inbox/new?fixture=search-without-initiation", width: 1280, heading: "Start a private conversation", kind: "search-without-initiation" },
    { path: "/commons-circle/signals/inbox/new?recipient=%40fixture-existing", width: 1280, heading: "Start a private conversation", kind: "existing-conversation" },
    { path: "/commons-circle/signals/inbox/settings", width: 1280, heading: "Messaging settings", kind: "messaging-settings" },
    { path: "/commons-circle/signals/inbox/settings", width: 390, heading: "Messaging settings", kind: "messaging-settings" },
    { path: `/commons-circle/signals/inbox/conversations/${conversationId}`, width: 1280, heading: "Private conversation", kind: "conversation-detail" },
    { path: `/commons-circle/signals/inbox/conversations/${conversationId}`, width: 390, heading: "Private conversation", kind: "conversation-detail" },
    { path: "/commons-circle/inbox?domain=code_proposals#inbox-list", canonical: "/commons-circle/signals/inbox?domain=code_proposals#inbox-list", width: 1280, heading: "Inbox", kind: "inbox" },
    { path: `/commons-circle/inbox?conversation=${conversationId}&from=stored-link#message`, canonical: `/commons-circle/signals/inbox/conversations/${conversationId}?from=stored-link#message`, width: 1280, heading: "Private conversation", kind: "conversation-alias" },
    { path: "/commons-circle/signals/notifications", width: 1280, heading: "Notifications", kind: "notifications" },
    { path: "/commons-circle/signals/notifications", width: 390, heading: "Notifications", kind: "notifications" },
    { path: "/commons-circle/notifications?filter=all#preferences", canonical: "/commons-circle/signals/notifications?filter=all#preferences", width: 1280, heading: "Notifications", kind: "notifications" },
    { path: "/commons-circle/signals/requests-reviews", width: 1280, heading: "Requests & Reviews", kind: "requests" },
    { path: "/commons-circle/requests-reviews?domain=code_proposals#request-list", canonical: "/commons-circle/signals/requests-reviews?domain=code_proposals#request-list", width: 1280, heading: "Requests & Reviews", kind: "requests" },
    { path: "/commons-circle/signals?legacy-bookmark=preserved", width: 1280, heading: "Signals", kind: "signals" },
    { path: "/commons-circle/signals", width: 820, heading: "Signals", kind: "signals" },
    { path: "/commons-circle/signals", width: 390, heading: "Signals", kind: "signals" },
    { path: "/commons-circle/signals", width: 1280, heading: "Signals", kind: "signals-admin", admin: true },
    { path: "/commons-circle/admin/messaging-access", width: 1280, heading: "Messaging access", kind: "messaging-access-denied" },
    { path: "/commons-circle/admin/messaging-access", width: 1280, heading: "Messaging access", kind: "messaging-access-admin", admin: true },
    { path: "/commons-circle/signals/coding-proposals", width: 1280, heading: "Coding proposal signals", kind: "signal-detail" },
    { path: "/commons-circle/signals/work-with", width: 1280, heading: "Work With signals", kind: "signal-work-with" },
    { path: "/commons-circle/signals/marketplace-forge", width: 1280, heading: "Marketplace & Developer Forge signals", kind: "signal-marketplace-forge" },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 } });
    const observed = { totalRequests: 0, inboxLoads: 0, readMutations: 0, eventCountLoads: 0, resolverLoads: 0, searchLoads: 0, adminStatusLoads: 0, requestBodies: [], preferenceBodies: [], tables: new Set() };
    const canInitiateDirectConversation = scenario.kind !== "search-without-initiation";
    const messagingPreferences = {
      preferenceVersion: 1,
      receiveDirectRequests: false,
      receiveOptionalAnnouncements: false,
      allowSourceLinkedMessages: true,
      ordinaryMessagingEligible: canInitiateDirectConversation,
      broadMessagingEligibility: canInitiateDirectConversation,
      canSearchPublishedProfiles: true,
      canInitiateDirectConversation,
      acceptsIncomingDirectRequests: false,
      canUseExistingConversations: true,
      messagingLaunchMode: "controlled_beta",
      betaEnrolled: canInitiateDirectConversation,
      ownerMessagingStatus: canInitiateDirectConversation ? "enabled" : "beta_access_required",
      currentPublicHandle: "fixture-account",
      storedInSupabase: true,
      endToEndEncrypted: false,
    };
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
      window.__elysiaCspViolations = [];
      window.addEventListener("securitypolicyviolation", (event) => {
        window.__elysiaCspViolations.push({ blockedUri: event.blockedURI, directive: event.effectiveDirective });
      });
    }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
    await context.route(/\/api\/identity\/v1\/messaging\/public-profile-search\?/, async (route) => {
      observed.searchLoads += 1;
      const request = route.request();
      const url = new URL(request.url());
      assert.equal(request.headers().authorization, `Bearer ${accessToken}`, "Messaging profile search must use the authenticated Identity Worker boundary.");
      assert.equal(url.searchParams.get("q"), "Fixture Coll", "Profile search must send only the bounded public query.");
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, data: { items: [{ handle: "fixture-colleague", displayName: "Fixture Colleague", avatarUrl: null, shortPublicBio: "Synthetic public profile descriptor." }], minimumQueryLength: 3, resultLimit: 8 } }),
      });
    });
    await context.route(/\/api\/identity\/v1\/staff\/messaging-access(?:\?|$)/, async (route) => {
      observed.adminStatusLoads += 1;
      const request = route.request();
      assert.equal(request.method(), "GET", "The admin page status lookup must remain read-only until an explicit confirmed action.");
      assert.equal(request.headers().authorization, `Bearer ${accessToken}`, "Messaging-access administration must use the authenticated Identity Worker boundary.");
      const handle = new URL(request.url()).searchParams.get("handle");
      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, data: {
          authorized: true,
          launchMode: "controlled_beta",
          generalAvailabilityReady: false,
          target: handle ? { handle: "fixture-colleague", displayName: "Fixture Colleague", avatarUrl: null, shortPublicBio: "Synthetic public profile descriptor.", published: true, betaEnrolled: false, status: "eligible_for_enrollment" } : null,
        } }),
      });
    });
    await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,PATCH,POST,OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Content-Range": "0-0/0",
        "Content-Type": "application/json; charset=utf-8",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
      observed.totalRequests += 1;
      const tableMatch = url.pathname.match(/\/rest\/v1\/([^/]+)$/);
      if (tableMatch && !url.pathname.includes("/rpc/")) observed.tables.add(tableMatch[1]);
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_inbox_items")) observed.inboxLoads += 1;
      if (url.pathname.endsWith("/rest/v1/rpc/mark_current_user_conversation_read")) observed.readMutations += 1;
      if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
      if (url.pathname.endsWith("/rest/v1/user_roles")) return route.fulfill({ status: 200, headers, body: JSON.stringify(scenario.admin ? [{ role: "administrator" }] : []) });
      if (url.pathname.endsWith("/rest/v1/profiles") && scenario.admin) return route.fulfill({ status: 200, headers, body: JSON.stringify({ is_admin: true }) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_event_counts")) { observed.eventCountLoads += 1; return route.fulfill({ status: 200, headers, body: JSON.stringify({ inboxNeedsAttention: 1, inboxUnread: 1, messagesUnread: 0, notificationsUnread: 2 }) }); }
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_request_counts")) return route.fulfill({ status: 200, headers, body: JSON.stringify({ total: 1, pending: 1, byDomain: { code_proposals: { total: 1, pending: 1 } } }) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_inbox_items")) return route.fulfill({ status: 200, headers, body: JSON.stringify(inboxPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_notification_items")) return route.fulfill({ status: 200, headers, body: JSON.stringify(notificationsPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_account_event_preferences")) return route.fulfill({ status: 200, headers, body: JSON.stringify(eventPreferencesPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_requests_and_reviews")) return route.fulfill({ status: 200, headers, body: JSON.stringify(requestsPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_messaging_preferences")) return route.fulfill({ status: 200, headers, body: JSON.stringify(messagingPreferences) });
      if (url.pathname.endsWith("/rest/v1/rpc/update_current_user_messaging_preferences")) {
        observed.preferenceBodies.push(request.postDataJSON());
        return route.fulfill({ status: 200, headers, body: JSON.stringify({ ...messagingPreferences, preferenceVersion: 2, receiveDirectRequests: true, acceptsIncomingDirectRequests: true }) });
      }
      if (url.pathname.endsWith("/rest/v1/rpc/resolve_account_messaging_destination")) {
        observed.resolverLoads += 1;
        const requestBody = request.postDataJSON();
        const payload = scenario.kind === "search-without-initiation"
          ? { state: "unavailable" }
          : requestBody?.p_public_handle === "@fixture-existing"
          ? { state: "existing_active", profile: { handle: "fixture-existing", displayName: "Fixture Existing", avatarUrl: null }, deepLink: `/commons-circle/signals/inbox/conversations/${conversationId}` }
          : resolvedRecipient;
        return route.fulfill({ status: 200, headers, body: JSON.stringify(payload) });
      }
      if (url.pathname.endsWith("/rest/v1/rpc/request_account_conversation")) {
        observed.requestBodies.push(request.postDataJSON());
        if (observed.requestBodies.length === 1) return route.fulfill({ status: 503, headers, body: JSON.stringify({ message: "synthetic_lost_response" }) });
        return route.fulfill({ status: 200, headers, body: JSON.stringify({ conversationId, state: "requested", deepLink: `/commons-circle/inbox?conversation=${conversationId}` }) });
      }
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_conversations")) return route.fulfill({ status: 200, headers, body: JSON.stringify(conversationListPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/current_user_conversation")) return route.fulfill({ status: 200, headers, body: JSON.stringify(conversationDetailPayload) });
      if (url.pathname.endsWith("/rest/v1/rpc/mark_current_user_conversation_read")) return route.fulfill({ status: 200, headers, body: "null" });
      if (/\/rest\/v1\/rpc\/set_current_user_(?:inbox|notification)_(?:read|archived)$/.test(url.pathname)) return route.fulfill({ status: 200, headers, body: "null" });
      if (url.pathname.endsWith("/rest/v1/rpc/mark_all_current_user_notifications_read")) return route.fulfill({ status: 200, headers, body: "1" });
      if (url.pathname.endsWith("/rest/v1/rpc/update_current_user_account_event_preference")) return route.fulfill({ status: 200, headers, body: JSON.stringify(eventPreferencesPayload.preferences[0]) });
      if (url.pathname.endsWith("/rest/v1/work_with_requests")) return route.fulfill({ status: 200, headers: { ...headers, "Content-Range": "0-0/1" }, body: JSON.stringify([{ id: "b9600000-0000-4000-8000-000000000001", request_type: "collaboration", status: "pending_review", source_context: "standalone", created_at: "2026-08-02T12:00:00.000Z", updated_at: "2026-08-02T12:05:00.000Z" }]) });
      if (url.pathname.endsWith("/rest/v1/addon_submissions")) return route.fulfill({ status: 200, headers: { ...headers, "Content-Range": "0-0/1" }, body: JSON.stringify([{ id: "b9700000-0000-4000-8000-000000000001", status: "published", submitted_at: "2026-08-02T12:00:00.000Z", updated_at: "2026-08-02T12:05:00.000Z" }]) });
      if (url.pathname.endsWith("/rest/v1/marketplace_listings")) return route.fulfill({ status: 200, headers: { ...headers, "Content-Range": "0-0/1" }, body: JSON.stringify([{ source_submission_id: "b9700000-0000-4000-8000-000000000001", listing_status: "published", slug: "fixture-addon" }]) });
      return route.fulfill({ status: 200, headers, body: "[]" });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(`${origin}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert.equal(response?.status(), 200, `${scenario.path} should load.`);
    await page.getByRole("heading", { name: scenario.heading, exact: true }).first().waitFor();
    if (scenario.canonical) {
      const current = new URL(page.url());
      assert.equal(`${current.pathname}${current.search}${current.hash}`, scenario.canonical, `${scenario.path} must replace-navigate to one canonical page while preserving query and hash.`);
    }
    assert.equal(await page.locator("body").getByText("PRIVATE_WORK_WITH_BODY_MUST_NOT_PROJECT", { exact: false }).count(), 0, "Private source bodies must not render.");
    assert.equal(await page.locator("body").getByText(proposalId, { exact: false }).count(), 0, "Raw source identifiers must not render as ordinary UI text.");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false, `${scenario.path} must not overflow at ${scenario.width}px.`);
    assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations ?? []), [], `${scenario.path} must not violate CSP.`);
    assert.deepEqual(pageErrors, [], `${scenario.path} should have no page errors.`);
    if (new URL(page.url()).pathname.startsWith("/commons-circle/signals/inbox")) {
      const inboxNavigation = page.getByRole("navigation", { name: "Inbox section navigation" });
      await inboxNavigation.waitFor();
      const inboxLink = inboxNavigation.getByRole("link", { name: "Inbox", exact: true });
      const newConversationLink = inboxNavigation.getByRole("link", { name: "Start a private conversation", exact: true });
      const settingsLink = inboxNavigation.getByRole("link", { name: "Messaging settings", exact: true });
      assert.equal(await inboxLink.getAttribute("href"), "/commons-circle/signals/inbox");
      assert.equal(await newConversationLink.getAttribute("href"), "/commons-circle/signals/inbox/new");
      assert.equal(await settingsLink.getAttribute("href"), "/commons-circle/signals/inbox/settings");
      const canonicalPath = new URL(page.url()).pathname;
      if (canonicalPath.endsWith("/new")) assert.equal(await newConversationLink.getAttribute("aria-current"), "page", "New conversation must expose its active Inbox destination.");
      else if (canonicalPath.endsWith("/settings")) assert.equal(await settingsLink.getAttribute("aria-current"), "page", "Messaging settings must expose its active Inbox destination.");
      else if (canonicalPath.includes("/conversations/")) assert.equal(await inboxLink.getAttribute("aria-current"), "location", "Conversation detail must retain Inbox as its active parent destination.");
      else assert.equal(await inboxLink.getAttribute("aria-current"), "page", "Inbox overview must expose its active destination.");
      await inboxLink.focus();
      await inboxLink.press("Tab");
      assert.equal(await newConversationLink.evaluate((element) => document.activeElement === element), true, "Inbox navigation must follow a predictable keyboard order.");
      await newConversationLink.press("Tab");
      assert.equal(await settingsLink.evaluate((element) => document.activeElement === element), true, "Messaging settings must remain keyboard reachable after New conversation.");
      const clearance = await page.evaluate(() => {
        const header = document.querySelector(".site-header")?.getBoundingClientRect();
        const navigation = document.querySelector(".inbox-section-navigation")?.getBoundingClientRect();
        return {
          clearsHeader: Boolean(header && navigation && navigation.top >= header.bottom - 1),
          position: navigation ? getComputedStyle(document.querySelector(".inbox-section-navigation")).position : "missing",
        };
      });
      assert.equal(clearance.clearsHeader, true, "Inbox navigation must render below the sticky global header without obscuring content.");
      assert.equal(clearance.position, "static", "Inbox navigation must not add a second sticky layer beneath the variable-height global header.");
      assert.equal(await inboxNavigation.evaluate((element) => element.scrollWidth > element.clientWidth + 2), false, "Inbox navigation must not overflow its own desktop or mobile bounds.");
    }
    if (scenario.kind === "inbox") {
      await page.getByRole("tab", { name: /Needs attention/ }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Start a private conversation" }).first().getAttribute("href"), "/commons-circle/signals/inbox/new");
      if (scenario.width === 1280 && !scenario.canonical) {
        for (const tabName of ["Sent", "Completed", "Archived"]) {
          await page.getByRole("tab", { name: tabName, exact: true }).click();
          assert.equal(await page.getByRole("link", { name: "Messaging settings", exact: true }).count(), 1, `Messaging settings must remain persistently available from ${tabName}.`);
          assert.equal(await page.getByRole("navigation", { name: "Inbox section navigation" }).count(), 1, `${tabName} must retain exactly one shared Inbox navigation instance.`);
        }
        await page.getByRole("tab", { name: /Needs attention/ }).click();
      }
      await page.getByText("A revision proposal is ready for review", { exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Review Proposal" }).getAttribute("href"), `/commune/coding-cornucopia/review?proposal=${proposalId}`);
      await page.getByRole("tab", { name: "Messages" }).click();
      await page.getByText("Governed private communication", { exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Messaging settings", exact: true }).count(), 1, "Messages must use the shared Messaging settings destination without a duplicate status-panel link.");
      assert.equal(await page.getByRole("link", { name: "Start a private conversation", exact: true }).count(), 1, "Messages must use the shared New conversation destination without a duplicate panel action.");
      await page.getByText("Fixture professional conversation", { exact: true }).first().waitFor();
      assert.equal(await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).count(), 0, "The concise conversation list must not preload private message bodies.");
      await page.getByRole("button", { name: /Fixture professional conversation/ }).click();
      await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, `/commons-circle/signals/inbox/conversations/${conversationId}`, "Conversation rows must open the focused canonical detail route.");
      assert.equal(await page.getByText(conversationId, { exact: false }).count(), 0, "Raw conversation identifiers must not render as ordinary UI text.");
      await page.getByText("Messages are stored in Supabase and are not end-to-end encrypted.", { exact: true }).first().waitFor();
      await page.waitForTimeout(750);
      assert.equal(observed.readMutations, 1, "Opening a genuinely unread visible conversation must acknowledge it once.");
      assert.equal(observed.eventCountLoads >= 2, true, "A genuine read mutation must reconcile exact event counts once in addition to the Inbox overview load.");
      const inboxLoadsBeforeResume = observed.inboxLoads;
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
      await page.waitForTimeout(900);
      assert.equal(observed.readMutations, 1, "Passive messaging refresh must perform zero additional read mutations.");
      assert.equal(observed.inboxLoads, inboxLoadsBeforeResume, "The parent actionable-Inbox loader must stay suspended while Messages owns refresh.");
      assert(observed.totalRequests <= 38, `Inbox, Messages, and focused detail exceeded the bounded request budget: ${observed.totalRequests}.`);
    } else if (scenario.kind === "new-conversation" || scenario.kind === "new-conversation-mobile") {
      const handleInput = page.getByLabel("Search public profiles or enter an exact @handle");
      assert.equal(await handleInput.inputValue(), "@fixture-colleague", "Recipient query parameters must safely prefill the exact-handle field.");
      assert.equal(observed.resolverLoads, 0, "Recipient query parameters must never trigger an automatic lookup.");
      await page.getByText("You are not accepting new conversation requests, but you may still contact eligible public profiles.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Search or check" }).isEnabled(), true, "Incoming opt-out must not disable outbound recipient resolution.");
      await page.getByRole("button", { name: "Search or check" }).click();
      await page.getByText("Synthetic public profile descriptor.", { exact: true }).waitFor();
      assert.equal(observed.resolverLoads, 1, "One explicit recipient check must issue exactly one resolver call.");
      assert.equal(await page.getByText(/@fixture-colleague/).count() > 0, true, "The safe recipient card must show the public handle.");
      if (scenario.kind === "new-conversation") {
        await page.getByLabel("Subject").fill("Synthetic professional request");
        await page.getByLabel("Plain-text first message").fill("SYNTHETIC_BROWSER_FIRST_REQUEST");
        await page.getByRole("button", { name: "Send conversation request" }).click();
        await page.getByRole("button", { name: "Send conversation request" }).waitFor();
        assert.equal(observed.requestBodies.length, 1, "The first logical submission should issue one request attempt.");
        await page.getByRole("button", { name: "Send conversation request" }).click();
        await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
        assert.equal(observed.requestBodies.length, 2, "A user retry should issue one additional attempt.");
        assert.equal(observed.requestBodies[0].p_client_request_id, observed.requestBodies[1].p_client_request_id, "Conversation request retries must reuse the logical client request ID.");
        assert.equal(observed.requestBodies[0].p_client_message_id, observed.requestBodies[1].p_client_message_id, "First-message retries must reuse the logical client message ID.");
        assert.equal(new URL(page.url()).pathname, `/commons-circle/signals/inbox/conversations/${conversationId}`);
      }
    } else if (scenario.kind === "profile-search") {
      const searchInput = page.getByLabel("Search public profiles or enter an exact @handle");
      await searchInput.fill("Fixture Coll");
      await page.getByRole("button", { name: "Search or check" }).click();
      await page.getByRole("heading", { name: "Published profile results", exact: true }).waitFor();
      assert.equal(observed.searchLoads, 1, "One explicit bounded search must issue one Identity Worker request.");
      assert.equal(observed.resolverLoads, 0, "Search results must not imply or pre-query messaging availability.");
      await page.getByRole("button", { name: /Fixture Colleague/ }).last().click();
      await page.getByText("This published Commons Profile can receive a conversation request.", { exact: true }).waitFor();
      assert.equal(observed.resolverLoads, 1, "Selecting a public result must issue one privacy-safe destination resolution.");
      assert.equal(await page.getByText(userId, { exact: false }).count(), 0, "Search UI must not render a private account identifier.");
    } else if (scenario.kind === "search-without-initiation") {
      await page.getByText("You may search published profiles. Starting a new conversation requires controlled messaging access.", { exact: true }).waitFor();
      const searchInput = page.getByLabel("Search public profiles or enter an exact @handle");
      await searchInput.fill("Fixture Coll");
      assert.equal(await page.getByRole("button", { name: "Search or check" }).isEnabled(), true, "Controlled-beta enrollment must not gate published-profile search.");
      await page.getByRole("button", { name: "Search or check" }).click();
      await page.getByRole("button", { name: /Fixture Colleague/ }).last().click();
      await page.getByText("This profile is unavailable for a new private conversation.", { exact: true }).waitFor();
      assert.equal(observed.searchLoads, 1, "A non-enrolled active account must retain one bounded public-profile search request.");
      assert.equal(observed.resolverLoads, 1, "Selecting a result must still apply the private destination gate once.");
      assert.equal(await page.getByLabel("Subject").count(), 0, "A search-capable but non-enrolled account must not receive the request composer.");
    } else if (scenario.kind === "messaging-settings") {
      await page.getByText("You are not accepting new conversation requests, but you may still contact eligible public profiles.", { exact: true }).waitFor();
      const directRequests = page.getByLabel("Allow eligible members to send me conversation requests");
      assert.equal(await directRequests.isChecked(), false, "Incoming request opt-in must render independently from outbound eligibility.");
      assert.equal(await page.getByRole("link", { name: "Start a private conversation", exact: true }).getAttribute("href"), "/commons-circle/signals/inbox/new");
      if (scenario.width === 1280) {
        await directRequests.check();
        await page.getByText("Messaging settings saved.", { exact: true }).waitFor();
        assert.equal(observed.preferenceBodies.length, 1, "One settings change must issue one versioned preference update.");
        assert.equal(observed.preferenceBodies[0].p_receive_direct_requests, true, "Settings must update incoming opt-in without changing outbound capability.");
      }
    } else if (scenario.kind === "messaging-access-denied") {
      await page.getByRole("heading", { name: "Messaging access management is private.", exact: true }).waitFor();
      assert.equal(observed.adminStatusLoads, 0, "An ordinary account must not call the staff messaging-access endpoint.");
      assert.equal(await page.getByText("Controlled account enrollment", { exact: true }).count(), 0, "An ordinary account must not see enrollment controls.");
    } else if (scenario.kind === "messaging-access-admin") {
      await page.getByRole("heading", { name: "Controlled beta", exact: true }).waitFor();
      assert.equal(observed.adminStatusLoads, 1, "An authorized administrator must load the sanitized launch status once.");
      await page.getByLabel("Published Commons handle").fill("@fixture-colleague");
      await page.getByRole("button", { name: "Check exact handle" }).click();
      await page.getByText("Published public profile · Not enrolled", { exact: true }).waitFor();
      assert.equal(observed.adminStatusLoads, 2, "One explicit exact-handle lookup must issue one additional governed status request.");
      assert.equal(await page.getByText(userId, { exact: false }).count(), 0, "The messaging-access admin UI must not render private account identifiers.");
    } else if (scenario.kind === "existing-conversation") {
      assert.equal(observed.resolverLoads, 0, "A profile-originated handle must not auto-resolve.");
      await page.getByRole("button", { name: "Search or check" }).click();
      await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
      assert.equal(observed.resolverLoads, 1, "Existing-conversation reuse must come from one explicit resolver call.");
      assert.equal(new URL(page.url()).pathname, `/commons-circle/signals/inbox/conversations/${conversationId}`);
    } else if (scenario.kind === "conversation-alias" || scenario.kind === "conversation-detail") {
      await page.getByText("SYNTHETIC_BROWSER_PRIVATE_MESSAGE", { exact: true }).waitFor();
      assert.equal(observed.readMutations, 1, "Canonical and stored legacy conversation links must resolve to one focused participant view and one read acknowledgment.");
    } else if (scenario.kind === "notifications") {
      await page.getByRole("tab", { name: "Unread (2)" }).waitFor();
      await page.getByText("Your revision proposal was accepted", { exact: true }).waitFor();
      await page.getByText("Fixture Author", { exact: false }).waitFor();
      await page.getByText("Choose optional in-app and email delivery", { exact: true }).waitFor();
      assert.equal(await page.getByText(notificationId, { exact: false }).count(), 0, "Raw notification identifiers must not render as ordinary UI text.");
      if (scenario.width === 1280 && !scenario.canonical) {
        await page.evaluate(() => scrollTo(0, Math.min(400, document.documentElement.scrollHeight - innerHeight)));
        const beforeFilterScroll = await page.evaluate(() => Math.round(scrollY));
        await page.getByRole("tab", { name: "Unread (2)" }).evaluate((element) => element.click());
        await page.waitForURL((url) => url.pathname === "/commons-circle/signals/notifications" && url.searchParams.get("filter") === "unread");
        await page.waitForTimeout(200);
        const afterFilterScroll = await page.evaluate(() => Math.round(scrollY));
        assert(Math.abs(afterFilterScroll - beforeFilterScroll) <= 2, `Notification query-only filter navigation must preserve the in-page position (${beforeFilterScroll} -> ${afterFilterScroll}).`);
      }
      const settledTitle = page.getByText("Your revision proposal was accepted", { exact: true });
      const requestsBeforeResume = observed.totalRequests;
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      await settledTitle.waitFor();
      await page.waitForTimeout(900);
      assert(observed.totalRequests - requestsBeforeResume <= 4, "Focus plus visibility return must coalesce into one Notification refresh sequence.");
      assert.equal(await page.getByText("Loading private notifications…", { exact: true }).count(), 0, "Background Notification refresh must retain settled content.");
      assert(observed.totalRequests <= 14, `Notifications exceeded the bounded request budget: ${observed.totalRequests}.`);
    } else if (scenario.kind === "requests") {
      await page.getByText("Revision proposal for “Fixture code post”", { exact: true }).waitFor();
      await page.getByText("Pending / needs action", { exact: true }).waitFor();
      const requestsBeforeResume = observed.totalRequests;
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      await page.getByText("Revision proposal for “Fixture code post”", { exact: true }).waitFor();
      await page.waitForTimeout(900);
      assert(observed.totalRequests - requestsBeforeResume <= 3, "Focus plus visibility return must coalesce into one Requests & Reviews refresh sequence.");
      assert.equal(await page.getByText("Loading authoritative request states…", { exact: true }).count(), 0, "Background Requests & Reviews refresh must retain settled content.");
      assert(observed.totalRequests <= 10, `Requests & Reviews exceeded the bounded request budget: ${observed.totalRequests}.`);
    } else if (scenario.kind === "signals" || scenario.kind === "signals-admin") {
      await page.getByRole("heading", { name: "Inbox & Private Messages", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
      await page.getByRole("heading", { name: "My Requests & Reviews", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Local requests and recognition", exact: true }).waitFor();
      const codingCategory = page.locator("summary").filter({ hasText: "Coding & Technical" });
      await codingCategory.focus();
      assert.equal(await codingCategory.evaluate((element) => document.activeElement === element), true, "Signal categories must be keyboard focusable.");
      await codingCategory.press("Enter");
      assert.equal(await codingCategory.locator("xpath=..").getAttribute("open"), "", "Signal categories must expand from the keyboard.");
      assert.equal(await page.getByRole("link", { name: "Coding proposals" }).getAttribute("href"), "/commons-circle/signals/coding-proposals");
      assert.equal(await page.getByRole("heading", { name: "Signals that need review", exact: true }).count(), 0, "Signals hub must not render the old monolithic queue.");
      assert.equal(await page.getByRole("link", { name: "Open Review Center", exact: true }).count(), scenario.admin ? 1 : 0, "Review Center visibility must follow established role truth.");
      assert.equal(await page.getByRole("link", { name: "Open Admin Console", exact: true }).count(), scenario.admin ? 1 : 0, "Admin Console visibility must be administrator-only.");
      if (scenario.path.includes("legacy-bookmark")) assert.match(page.url(), /legacy-bookmark=preserved/, "Signals compatibility route must preserve query strings.");
    } else if (scenario.kind === "signal-detail") {
      await page.getByRole("link", { name: "Back to Signals", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Proposals awaiting your decision", exact: true }).waitFor();
      assert.equal(await page.getByText("Reviewer follow-up", { exact: true }).count(), 0, "Ordinary users must not see specialist reviewer lanes.");
      assert(observed.tables.has("commune_code_revision_proposals"), "Coding Proposals must load its authoritative proposal source.");
      for (const unrelated of ["work_with_requests", "addon_submissions", "commune_research_notes", "commune_job_posts"]) assert.equal(observed.tables.has(unrelated), false, `Coding Proposals must not load unrelated ${unrelated} rows.`);
    } else if (scenario.kind === "signal-work-with") {
      await page.getByText("Work With request activity", { exact: true }).waitFor();
      await page.getByText("private owner status", { exact: false }).waitFor();
      assert(observed.tables.has("work_with_requests"), "Work With Signals must load safe authoritative request status.");
      for (const unrelated of ["addon_submissions", "marketplace_listings", "commune_code_revision_proposals", "commune_research_notes"]) assert.equal(observed.tables.has(unrelated), false, `Work With Signals must not load unrelated ${unrelated} rows.`);
    } else if (scenario.kind === "signal-marketplace-forge") {
      await page.getByText("Forge and Marketplace activity", { exact: true }).waitFor();
      await page.getByText("Open published Marketplace listing", { exact: true }).waitFor();
      assert(observed.tables.has("addon_submissions") && observed.tables.has("marketplace_listings"), "Marketplace/Forge Signals must load safe owner submission and visible listing state.");
      for (const unrelated of ["work_with_requests", "commune_code_revision_proposals", "commune_research_notes"]) assert.equal(observed.tables.has(unrelated), false, `Marketplace/Forge Signals must not load unrelated ${unrelated} rows.`);
    }
    if (screenshotDir && scenario.kind === "signals") {
      await page.getByRole("heading", { name: "Your Circle", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(screenshotDir, `signals-your-circle-${scenario.width}.png`), fullPage: false });
    }
    if (screenshotDir && scenario.kind === "signal-detail") await page.screenshot({ path: path.join(screenshotDir, "signals-coding-proposals-1280.png"), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Account communications production-build browser smoke test passed for recipient rendering, exact counts, safe deep links, privacy, CSP, and responsive layout.");

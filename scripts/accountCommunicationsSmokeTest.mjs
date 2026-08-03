import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, authPanel, refreshController, homebase, api, commonsApi, inbox, notifications, messaging, adminCommunications, adminConsole, requests, signals, signalDetails, migration, messagingMigration, messagingFixture, styles] = await Promise.all([
  fs.readFile("src/App.tsx", "utf8"),
  fs.readFile("src/pages/The-Elysia-Marketplace/components/AuthPanel.tsx", "utf8"),
  fs.readFile("src/shared/hooks/useCoordinatedRefresh.ts", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/index.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/accountCommunicationsApi.ts", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/commonsCircleApi.ts", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/InboxPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/NotificationsPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/InboxMessagingPanel.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/AdminCommunicationsPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/CommonsCircleAdminConsolePage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/RequestsReviewsPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/SignalConsolePage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/SignalDetailPage.tsx", "utf8"),
  fs.readFile("supabase/migrations/20260802040000_account_requests_and_reviews_projection.sql", "utf8"),
  fs.readFile("supabase/migrations/20260802050000_governed_account_conversations.sql", "utf8"),
  fs.readFile("scripts/fixtures/accountMessagingBehavior.sql", "utf8"),
  fs.readFile("src/styles.css", "utf8"),
]);

for (const route of ["commons-circle/inbox", "commons-circle/notifications", "commons-circle/requests-reviews", "commons-circle/admin-communications", "commons-circle/signals", "commons-circle/signals/inbox", "commons-circle/signals/notifications", "commons-circle/signals/requests-reviews", "commons-circle/signals/coding-proposals", "commons-circle/signals/troubleshooting", "commons-circle/signals/research-notes", "commons-circle/signals/repository-showcases", "commons-circle/signals/iteration-showcases", "commons-circle/signals/job-posts", "commons-circle/signals/voting-room", "commons-circle/signals/official-updates", "commons-circle/signals/sandbox-reviews", "commons-circle/signals/work-with", "commons-circle/signals/marketplace-forge"]) {
  assert(app.includes(`path="${route}"`), `Missing account communications route: ${route}`);
}
assert(app.includes("function LegacyCommunicationAlias") && app.includes("state={location.state}") && app.includes("search: location.search") && app.includes("hash: location.hash"), "Legacy communication aliases must preserve safe state, query strings, and hash fragments.");
for (const [legacy, canonical] of [
  ["commons-circle/inbox", "/commons-circle/signals/inbox"],
  ["commons-circle/notifications", "/commons-circle/signals/notifications"],
  ["commons-circle/requests-reviews", "/commons-circle/signals/requests-reviews"],
]) {
  assert(app.includes(`path="${legacy}" element={<LegacyCommunicationAlias target="${canonical}" />}`), `${legacy} must be a redirect-only compatibility route.`);
}

for (const rpc of [
  "current_user_event_counts",
  "current_user_inbox_items",
  "set_current_user_inbox_read",
  "set_current_user_inbox_archived",
  "current_user_request_counts",
  "current_user_requests_and_reviews",
  "current_user_notification_items",
  "set_current_user_notification_read",
  "set_current_user_notification_archived",
  "mark_all_current_user_notifications_read",
  "current_user_account_event_preferences",
  "update_current_user_account_event_preference",
]) assert(api.includes(`"${rpc}"`), `Account communications client omits ${rpc}.`);

for (const rpc of [
  "current_user_messaging_preferences",
  "lookup_account_messaging_recipient",
  "request_account_conversation",
  "start_source_linked_account_conversation",
  "start_account_support_conversation",
  "current_user_conversations",
  "current_user_conversation",
  "send_account_conversation_message",
  "report_account_conversation",
  "admin_send_account_message",
  "prepare_admin_account_announcement",
  "send_admin_account_announcement",
  "current_account_message_moderation_queue",
  "read_reported_account_message_evidence",
]) assert(api.includes(`"${rpc}"`), `Governed communication client omits ${rpc}.`);

assert(!/\.from\(["'](?:account_events|account_inbox_items|account_notifications)["']\)\.(?:insert|upsert)/.test(api), "Browser client must not insert authoritative account events or projections.");
assert(authPanel.includes("onAuthChangedRef") && authPanel.includes("authenticatedUserIdRef"), "AuthPanel must retain current callbacks and account identity through stable refs.");
assert(authPanel.includes('event === "SIGNED_IN" && accountChanged') && authPanel.includes('event === "SIGNED_OUT" && previousUserId !== null'), "AuthPanel must refresh domain data only for meaningful account transitions.");
assert(!authPanel.includes("void onAuthChanged()") && !authPanel.includes("await onAuthChanged()"), "Auth transitions must have one listener-owned domain refresh path.");
for (const marker of ["initialLoading", "backgroundRefreshing", "generationRef", "queueRef", "structurallyEqual", "visibilitychange", "window.setTimeout", "lastResumeAt"]) {
  assert(refreshController.includes(marker), `Shared refresh controller omits ${marker}.`);
}
assert(!refreshController.includes("setInterval"), "Shared refresh polling must not retain an interval while the document is hidden.");
assert(inbox.includes("Needs attention") && inbox.includes("Messages") && inbox.includes("Sent") && inbox.includes("Completed") && inbox.includes("Archived"), "Inbox tabs are incomplete.");
assert(inbox.includes("safeInternalActionPath") && inbox.includes("sourceAvailable"), "Inbox must validate deep links and render unavailable sources safely.");
assert(inbox.includes("useCoordinatedRefresh") && inbox.includes("45_000") && inbox.includes('activeTab !== "messages"'), "Inbox must use the shared bounded controller and suspend its parent poller during Messages.");
assert(notifications.includes("Account & Security") && notifications.includes("Marketplace & Economic") && notifications.includes("Archived"), "Notification filters are incomplete.");
assert(notifications.includes("useCoordinatedRefresh") && notifications.includes("45_000"), "Notifications must use the shared bounded refresh controller.");
assert(notifications.includes("safeInternalActionPath") && notifications.includes("sourceAvailable"), "Notifications must validate deep links and render unavailable sources safely.");
assert(notifications.includes("Mandatory events in this category remain visible") && notifications.toLowerCase().includes("quiet hours"), "Notification preference and mandatory-delivery truth is incomplete.");
assert(messaging.includes("stored in Supabase") && messaging.includes("not end-to-end encrypted"), "Messaging privacy limitations must be explicit.");
assert(messaging.includes("Attachments, HTML, embeds, and anonymous messages are not supported"), "Messaging content boundaries are not explained.");
assert(messaging.includes("Accept request") && messaging.includes("Block account") && messaging.includes("Submit report"), "Participant messaging safety controls are incomplete.");
assert(messaging.includes("acknowledgedReadRef") && messaging.includes("selectedSummary.unreadCount <= 0") && messaging.includes('document.visibilityState !== "visible"'), "Messaging must acknowledge genuinely unread visible conversations only once.");
assert(!messaging.includes("refreshDetail") && messaging.includes("runMessagingOperation"), "Messaging list, detail, participant state, and mutations must use one refresh owner.");
assert(adminCommunications.includes("roleState.isAdmin") && adminCommunications.includes('role === "moderator"') && adminCommunications.includes('role === "commune_moderator"'), "Staff messaging UI role separation is missing.");
assert(adminCommunications.includes("confirmationPhrase") && adminCommunications.includes("Preview exact audience"), "Administrator audience preview/confirmation is missing.");
assert(adminConsole.includes("canOpenPrivateCommunications") && !adminConsole.includes('role === "reviewer" || role === "moderator"'), "Generic reviewers must not inherit private-message tooling.");
assert(requests.includes("Your submissions only") && requests.includes("excludes moderator, administrator"), "Requests & Reviews must explicitly exclude specialist queues.");
assert(requests.includes("useCoordinatedRefresh") && requests.includes("60_000"), "Requests & Reviews must use the shared bounded refresh controller.");
assert(requests.includes("current") || api.includes("current_user_requests_and_reviews"), "Requests & Reviews must use account-owned source projection.");
assert(signals.includes("Choose the room that matches your task") && signals.includes("This route remains compatible with existing bookmarks and query strings"), "Signals must be a compact compatibility hub during production reconciliation.");
for (const destination of ["/commons-circle/signals/inbox", "/commons-circle/signals/notifications", "/commons-circle/signals/requests-reviews"]) {
  assert(signals.includes(`to="${destination}"`), `Signals compatibility map omits ${destination}.`);
}
assert(signals.includes("state.isAdmin &&") && signals.includes('to="/commons-circle/admin-console"'), "Signals must expose Admin Console navigation only to administrators.");
assert(signals.includes("state.canOpenReviewCenter &&") && signals.includes('to="/admin/review"'), "Signals must expose Review Center navigation only through established role truth.");
assert(signals.includes("Local requests and recognition") && signals.includes("pending_admin_review_local"), "Signals must preserve browser-local request and recognition continuity without treating drafts as authoritative.");
assert(signals.includes("Inbox &amp; Private Messages") && signals.includes("Start a private conversation"), "Signals must make the governed private Inbox unmistakable.");
for (const category of ["Coding & Technical", "Research & Work", "Stewardship & Official"]) assert(signals.includes(category), `Signals hub omits ${category}.`);
assert((signalDetails.match(/data\.canReviewCommune &&/g) ?? []).length >= 5, "Signals specialist lanes must remain hidden from ordinary accounts while their role-gated source snapshots remain intact.");
assert(signalDetails.includes("Perform specialist decisions in") && signalDetails.includes("Review Center"), "Signal detail rooms must preserve Review Center as the specialist authority.");
assert(signalDetails.includes("Proposal code and private explanation are not duplicated"), "Signal detail summaries must not duplicate private proposal content.");
assert(commonsApi.includes("canReviewCommune") && commonsApi.includes("canOpenReviewCenter"), "Signal loader must return explicit reviewer navigation truth.");

assert(homebase.includes("Signals compatibility") && homebase.includes("existing author, reviewer, administrator"), "Signals compatibility and queue-preservation copy is missing.");
for (const removed of ["Private actions for you", "Updates and outcomes", "Your submitted workflows", "Browser-local drafts", "CommonsCircleAdminEntryCard", "Admin-only backend status", "loadAccountHomebaseCounts"]) {
  assert(!homebase.includes(removed), `Commons Homebase still duplicates moved communication/admin content: ${removed}`);
}
assert((homebase.match(/Open Saved Shelves/g) ?? []).length === 1 && (homebase.match(/Your private saved archive/g) ?? []).length === 1, "Commons Homebase must render exactly one Saved Shelves card.");
assert(!homebase.includes("homebase?.notifications.map") && !homebase.includes("markAllNotificationsRead"), "Commons Homebase compatibility card must not render or mutate the long legacy row list.");
assert(!homebase.includes("Promise.all([loadCommonsHomebase()") && homebase.includes("useEffect(() => { void refreshSavedShelves();"), "Homebase profile/avatar and Saved Shelves count loaders must remain independent.");
assert(homebase.includes("loadAccountSavedShelvesCounts") && api.includes('count: "exact"'), "Commons Homebase must use exact recipient-scoped Saved Shelves counts.");

for (const marker of [
  "private.current_user_request_review_rows",
  "public.current_user_request_counts",
  "public.current_user_requests_and_reviews",
  "security definer",
  "auth.uid()",
  "revoke all privileges",
  "limit v_limit",
]) assert(migration.includes(marker), `Requests & Reviews migration omits ${marker}.`);

for (const sensitive of ["request.message", "request.preferred_contact", "proposal.proposed_code_text", "proposal.explanation"]) {
  assert(!migration.includes(sensitive), `Requests & Reviews projection includes private source field: ${sensitive}`);
}

assert(styles.includes(".account-communications-card") && styles.includes(".account-communications-tabs"), "Account communications responsive styling is missing.");
assert(styles.includes(".inbox-messaging-panel") && styles.includes(".account-admin-communications"), "Governed messaging responsive styling is missing.");

for (const marker of [
  "private.account_conversations",
  "private.account_messages",
  "private.account_conversation_reports",
  "private.account_conversation_moderation_cases",
  "private.account_conversation_audit_events",
  "account_conversation_creation_fingerprint",
  "account_private_messaging_allowed",
  "account_message_moderator_allowed",
  "account_announcement_confirmation_invalid",
  "reported_message_evidence_accessed",
  "enable row level security",
  "revoke all privileges",
]) assert(messagingMigration.includes(marker), `Governed messaging migration omits ${marker}.`);

for (const privateBody of [
  "SYNTHETIC_PRIVATE_FIRST_MESSAGE",
  "SYNTHETIC_PRIVATE_SOURCE_MESSAGE",
  "SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY",
  "SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY",
]) assert(messagingFixture.includes(privateBody), `Messaging behavior fixture omits privacy canary ${privateBody}.`);
assert(messagingFixture.includes("account_conversation_changed_replay_was_accepted") && messagingFixture.includes("admin_message_changed_replay_was_accepted"), "Changed-payload replay conflicts are not tested.");

console.log("Account communications, Inbox, and governed private-messaging contract ok.");

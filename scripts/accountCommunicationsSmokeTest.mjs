import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, homebase, api, inbox, messaging, adminCommunications, adminConsole, requests, migration, messagingMigration, messagingFixture, styles] = await Promise.all([
  fs.readFile("src/App.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/index.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/accountCommunicationsApi.ts", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/InboxPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/InboxMessagingPanel.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/AdminCommunicationsPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/CommonsCircleAdminConsolePage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/RequestsReviewsPage.tsx", "utf8"),
  fs.readFile("supabase/migrations/20260802040000_account_requests_and_reviews_projection.sql", "utf8"),
  fs.readFile("supabase/migrations/20260802050000_governed_account_conversations.sql", "utf8"),
  fs.readFile("scripts/fixtures/accountMessagingBehavior.sql", "utf8"),
  fs.readFile("src/styles.css", "utf8"),
]);

for (const route of ["commons-circle/inbox", "commons-circle/requests-reviews", "commons-circle/admin-communications", "commons-circle/signals"]) {
  assert(app.includes(`path="${route}"`), `Missing account communications route: ${route}`);
}

for (const rpc of [
  "current_user_event_counts",
  "current_user_inbox_items",
  "set_current_user_inbox_read",
  "set_current_user_inbox_archived",
  "current_user_request_counts",
  "current_user_requests_and_reviews",
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
assert(inbox.includes("Needs attention") && inbox.includes("Messages") && inbox.includes("Sent") && inbox.includes("Completed") && inbox.includes("Archived"), "Inbox tabs are incomplete.");
assert(inbox.includes("safeInternalActionPath") && inbox.includes("sourceAvailable"), "Inbox must validate deep links and render unavailable sources safely.");
assert(inbox.includes("45_000") && inbox.includes('addEventListener("focus"'), "Inbox must use bounded polling and focus revalidation.");
assert(messaging.includes("stored in Supabase") && messaging.includes("not end-to-end encrypted"), "Messaging privacy limitations must be explicit.");
assert(messaging.includes("Attachments, HTML, embeds, and anonymous messages are not supported"), "Messaging content boundaries are not explained.");
assert(messaging.includes("Accept request") && messaging.includes("Block account") && messaging.includes("Submit report"), "Participant messaging safety controls are incomplete.");
assert(adminCommunications.includes("roleState.isAdmin") && adminCommunications.includes('role === "moderator"') && adminCommunications.includes('role === "commune_moderator"'), "Staff messaging UI role separation is missing.");
assert(adminCommunications.includes("confirmationPhrase") && adminCommunications.includes("Preview exact audience"), "Administrator audience preview/confirmation is missing.");
assert(adminConsole.includes("canOpenPrivateCommunications") && !adminConsole.includes('role === "reviewer" || role === "moderator"'), "Generic reviewers must not inherit private-message tooling.");
assert(requests.includes("Your submissions only") && requests.includes("excludes moderator, administrator"), "Requests & Reviews must explicitly exclude specialist queues.");
assert(requests.includes("current") || api.includes("current_user_requests_and_reviews"), "Requests & Reviews must use account-owned source projection.");

for (const label of ["Inbox", "Notifications", "Requests &amp; Reviews", "Saved Shelves"]) {
  assert(homebase.includes(label), `Commons Homebase omits ${label}.`);
}
assert(homebase.includes("Signals compatibility") && homebase.includes("existing author, reviewer, administrator"), "Signals compatibility and queue-preservation copy is missing.");
assert(homebase.includes("loadAccountHomebaseCounts"), "Commons Homebase must use exact account count RPCs.");

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

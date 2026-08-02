import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, homebase, api, inbox, requests, migration, styles] = await Promise.all([
  fs.readFile("src/App.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/index.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/accountCommunicationsApi.ts", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/InboxPage.tsx", "utf8"),
  fs.readFile("src/pages/The-Commons-Circle/RequestsReviewsPage.tsx", "utf8"),
  fs.readFile("supabase/migrations/20260802040000_account_requests_and_reviews_projection.sql", "utf8"),
  fs.readFile("src/styles.css", "utf8"),
]);

for (const route of ["commons-circle/inbox", "commons-circle/requests-reviews", "commons-circle/signals"]) {
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

assert(!/\.from\(["'](?:account_events|account_inbox_items|account_notifications)["']\)\.(?:insert|upsert)/.test(api), "Browser client must not insert authoritative account events or projections.");
assert(inbox.includes("Needs attention") && inbox.includes("Messages") && inbox.includes("Sent") && inbox.includes("Completed") && inbox.includes("Archived"), "Inbox tabs are incomplete.");
assert(inbox.includes("safeInternalActionPath") && inbox.includes("sourceAvailable"), "Inbox must validate deep links and render unavailable sources safely.");
assert(inbox.includes("45_000") && inbox.includes('addEventListener("focus"'), "Inbox must use bounded polling and focus revalidation.");
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

console.log("Account communications Task C UI contract ok.");

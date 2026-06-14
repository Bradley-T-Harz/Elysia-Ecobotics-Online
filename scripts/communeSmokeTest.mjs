import fs from "node:fs/promises";

async function read(file) {
  return fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const app = await read("src/App.tsx");
const page = await read("src/pages/The-Elysia-Commune/index.tsx");
const safety = await read("src/pages/The-Elysia-Commune/communeSafety.ts");
const migration = await read("supabase/migrations/2026_06_12_commune_full_system.sql");
const realtimeMigration = await read("supabase/migrations/2026_06_14_commune_realtime_chat_moderation.sql");
const realtimeApi = await read("src/pages/The-Elysia-Commune/communeRealtimeApi.ts");

for (const route of ["/commune", "commune/new", "commune/repository-showcase", "commune/troubleshooting", "commune/sandbox-review", "commune/realtime", "commune/moderation"]) {
  assert(app.includes(route.replace(/^\//, "")) || app.includes(route), `Missing Commune route: ${route}`);
}

for (const anchor of ["commune-lobby", "commune-search", "commune-feed", "commune-rooms", "commune-post-composer", "commune-repository-showcase", "commune-sandbox-review", "commune-local-drafts", "commune-moderation-doctrine"]) {
  assert(page.includes(anchor), `Missing Commune anchor: ${anchor}`);
}

for (const reason of ["spam", "harassment", "unsafe_code", "secret_or_private_data", "misinformation", "copyright_or_license", "malware_or_suspicious", "privacy_violation", "other"]) {
  assert(safety.includes(`"${reason}"`), `Missing report reason: ${reason}`);
}

for (const secret of [".env", "SUPABASE_SERVICE_ROLE", "service_role", "BEGIN [A-Z ]*PRIVATE KEY", "github_pat_", "AWS_ACCESS_KEY_ID", "\\/home\\/"]) {
  assert(safety.includes(secret), `Missing secret scanner pattern: ${secret}`);
}

for (const category of ["general", "troubleshooting", "repositories", "living-library", "developer-forge", "marketplace-addons", "field-notes", "announcements", "questions", "safety-and-boundaries"]) {
  assert(safety.includes(`"${category}"`), `Missing fallback category: ${category}`);
  assert(migration.includes(`'${category}'`), `Missing seeded DB category: ${category}`);
}

assert(page.includes("<pre><code>"), "Code snippets are not displayed as inert pre/code text.");
assert(page.includes("The public website does not execute code."), "Code execution boundary copy missing.");
assert(page.includes("Governed live chat rooms"), "Governed realtime chat panel missing.");
assert(page.includes("Realtime Commune messages are cloud-hosted public/community data."), "Realtime public/community data warning missing.");
assert(page.includes("no private DMs"), "Realtime no-DM copy missing.");
assert(page.includes("no file uploads"), "Realtime no-file-upload copy missing.");
assert(page.includes("no code execution"), "Realtime no-code-execution copy missing.");
assert(page.includes("Report message"), "Realtime message report UI missing.");
assert(page.includes("Send message"), "Realtime composer send action missing.");
assert(!page.includes("dangerouslySetInnerHTML"), "Commune page must not render chat/code with dangerouslySetInnerHTML.");
assert(page.includes("Canonical account-backed paths"), "Commune canonical table path status copy missing.");
assert(page.includes("Report comment"), "Commune comment report action missing.");
assert(page.includes("Copy snippet"), "Commune inert code snippet copy action missing.");
assert(page.includes("metadata for review only"), "Commune sandbox metadata-only acknowledgement missing.");
assert(page.includes("FoundationStatusPanel"), "Commune foundation status panel missing.");
assert(safety.includes("blockedCommuneUploadExtensions"), "Media upload blocklist missing.");
assert(migration.includes("commune_realtime_messages"), "Realtime foundation table missing.");
assert(realtimeMigration.includes("commune_realtime_rooms"), "Realtime rooms table missing.");
assert(realtimeMigration.includes("commune_realtime_reports"), "Realtime reports table missing.");
assert(realtimeMigration.includes("commune_room_moderation_events"), "Realtime moderation events table missing.");
assert(realtimeMigration.includes("can_post_commune_realtime_message"), "Realtime slow-mode/posting policy function missing.");
assert(realtimeApi.includes("validateChatMessageInput"), "Realtime chat input validator missing.");
assert(realtimeApi.includes("subscribeToRoomMessages"), "Realtime subscription helper missing.");
assert(realtimeApi.includes("hideRealtimeMessage") && realtimeApi.includes("removeRealtimeMessage"), "Realtime moderation helpers missing.");
assert(migration.includes("commune_sandbox_reviews"), "Sandbox review foundation table missing.");
assert(migration.includes("commune_code_snippets"), "Code snippet table missing.");
assert(migration.includes("commune_reports"), "Commune reports table missing.");

console.log("Commune smoke test ok.");

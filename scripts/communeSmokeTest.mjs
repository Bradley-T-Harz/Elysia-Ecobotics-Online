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
const accountApi = await read("src/pages/The-Elysia-Commune/communeAccountApi.ts");
const migration = await read("supabase/migrations/2026_06_12_commune_full_system.sql");
const realtimeMigration = await read("supabase/migrations/2026_06_14_commune_realtime_chat_moderation.sql");
const realtimeApi = await read("src/pages/The-Elysia-Commune/communeRealtimeApi.ts");
const codeReviewMigration = await read("supabase/migrations/2026_06_14_commune_collaborative_code_review.sql");
const codeReviewApi = await read("src/pages/The-Elysia-Commune/communeCodeReviewApi.ts");
const sandboxHandoffMigration = await read("supabase/migrations/2026_06_14_sandbox_request_local_handoff.sql");
const sandboxHandoffApi = await read("src/pages/The-Elysia-Commune/communeSandboxHandoffApi.ts");
const sandboxValidator = await read("src/shared/sandbox/sandboxRequestValidator.ts");
const sandboxBuilder = await read("src/shared/sandbox/sandboxHandoffBuilder.ts");

for (const route of ["/commune", "commune/new", "commune/repository-showcase", "commune/troubleshooting", "commune/sandbox-review", "commune/code-sharing/review", "commune/realtime", "commune/moderation"]) {
  assert(app.includes(route.replace(/^\//, "")) || app.includes(route), `Missing Commune route: ${route}`);
}

for (const roomSlug of ["media-garden", "troubleshooting-grove", "code-sharing", "repository-showcase", "community-network", "job-post", "official-updates", "research-notes", "elysia-iteration-showcase"]) {
  assert(page.includes(roomSlug), `Missing Commune room slug: ${roomSlug}`);
}

const requiredLobbyRooms = ["Media Garden", "Troubleshooting Grove", "Code Sharing", "Repository Showcase", "Community Network", "Job Post", "Official Update", "Research Note", "Elysia Iteration Showcase"];
let roomCursor = -1;
for (const roomName of requiredLobbyRooms) {
  const nextRoom = page.indexOf(`name: "${roomName}"`);
  assert(nextRoom > roomCursor, `Commune room definition missing or out of order: ${roomName}`);
  roomCursor = nextRoom;
}

for (const anchor of ["commune-lobby", "commune-search", "commune-feed", "commune-rooms", "commune-post-composer", "commune-repository-showcase", "commune-sandbox-review", "commune-code-review", "commune-local-drafts"]) {
  assert(page.includes(anchor), `Missing Commune anchor: ${anchor}`);
}

const lobbyBranchStart = page.indexOf("{isLobby && <>");
const lobbyBranchEnd = page.indexOf("</>}", lobbyBranchStart);
assert(lobbyBranchStart > -1 && lobbyBranchEnd > lobbyBranchStart, "Could not find consolidated Commune lobby render branch.");
const lobbyBranch = page.slice(lobbyBranchStart, lobbyBranchEnd);
for (const heavyPanel of ["<PostComposer", "<RepositoryShowcaseForm", "<SandboxDraftPanel", "<CollaborativeCodeReviewPanel", "<RealtimeFoundationPanel", "<CodeExecutionBoundaryPanel", "<FoundationStatusPanel"]) {
  assert(!lobbyBranch.includes(heavyPanel), `Commune lobby still renders heavy panel: ${heavyPanel}`);
}
assert(!lobbyBranch.includes("<AccountModePanel"), "Commune lobby still renders the account-backed mode panel.");
for (const lobbyPanel of ["<CommuneLobby", "<CommuneSearchPanel", "<RoomCards", "<CommunityFeed", "<CommuneSideChannelPanel", "<LocalDraftStudio"]) {
  assert(page.includes(lobbyPanel), `Commune lobby panel missing: ${lobbyPanel}`);
}
assert(page.includes("!isLobby && <AccountModePanel"), "Account-backed Commune functionality should remain available outside the public lobby.");
assert(page.includes("function RoomPage"), "Focused Commune room page component missing.");
assert(page.includes("postTypeByRoomSlug"), "Commune room slug to post type mapping missing.");
assert(page.includes("Posting in: {selectedPostTypeLabel}"), "Room composer should show a simple read-only room context line.");
assert(page.includes("postType: defaultType"), "Room composer should preserve the locked room post type internally.");
assert(page.includes("current.postType === defaultType"), "Room composer should relock post type when navigating between rooms.");
assert(!page.includes("<label><span>Post type</span><select"), "Room composer should not show the generic Post type dropdown.");
assert(!page.includes("<label><span>Category</span><select"), "Room composer should not show the generic Category dropdown.");
assert(safety.includes("parseCommuneTags"), "Commune tag parser missing.");
assert(safety.includes("MAX_COMMUNE_TAGS = 12"), "Commune tag max-count limit missing.");
assert(safety.includes("MAX_COMMUNE_TAG_LENGTH = 32"), "Commune tag max-length limit missing.");
assert(safety.includes(".replace(/^#+/"), "Commune tag parser should strip leading hashtags.");
assert(safety.includes(".replace(/\\s+/g, \"-\""), "Commune tag parser should convert tag phrase spaces to dashes.");
assert(safety.includes(".replace(/[^a-z0-9_-]+/g, \"\""), "Commune tag parser should keep conservative tag characters only.");
assert(safety.includes("Array.from(new Set(tags)).slice(0, MAX_COMMUNE_TAGS)"), "Commune tag parser should deduplicate and limit tags.");
assert(page.includes("TagChips"), "Commune tag chip display component missing.");
assert(page.includes("Add tags like #wetlands, #qgis, local-ai"), "Commune tag input helper placeholder missing.");
assert(page.includes("Use hashtags, commas, or simple words. Tags help people find posts later."), "Commune tag helper copy missing.");
assert(page.includes("replace(/#/g, \"\")"), "Commune search should normalize hashtag searches.");
assert(accountApi.includes("parseCommuneTags(input.tags)"), "Commune Supabase submission should normalize tags before insert.");
assert(migration.includes("tags text[]"), "Commune Supabase schema should support post tags.");
assert(page.includes("function RoomCards()"), "Commune lobby room cards should render the complete room list.");
assert(page.includes("postTypes.map((type)"), "Commune lobby room cards should include every post type doorway.");
assert(page.includes("Enter room"), "Commune room entry copy missing.");
assert(page.includes("Shared code is not trusted and is not executed by the website or Elysia by default."), "Code Sharing caution copy missing.");
assert(page.includes("function RoomPickerPanel()"), "Commune /new room picker compatibility panel missing.");
assert(page.includes("Choose a room before posting"), "Commune /new room picker title missing.");
assert(page.includes("Posts are created from inside their room so the format, safety notes, and context match what you are sharing."), "Commune /new room picker copy missing.");
assert(page.includes('{mode === "new" && <RoomPickerPanel />}'), "Commune /new should render the room picker instead of the generic composer.");
assert(!page.includes('{mode === "new" && <PostComposer'), "Commune /new still renders the generic post composer.");
assert(!page.includes('to="/commune/new"'), "Commune page still links users to the generic /commune/new composer.");
assert(!page.includes("Request to post"), "Generic Request to post copy should not be visible in Commune UI.");

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
assert(page.includes("Collaborative Code Review"), "Collaborative code review section missing.");
assert(page.includes("Shared code documents for review, not execution"), "Code review safety heading missing.");
assert(page.includes("Create version snapshot"), "Code review version snapshot action missing.");
assert(page.includes("Line annotations"), "Code review annotation UI missing.");
assert(page.includes("Acquire edit lock"), "Code review edit lock action missing.");
assert(page.includes("Report code document"), "Code review report action missing.");
assert(page.includes("Create Commune code post from this document"), "Code review Commune post linkage missing.");
assert(!page.includes("dangerouslySetInnerHTML"), "Commune page must not render chat/code with dangerouslySetInnerHTML.");
assert(page.includes("Canonical account-backed paths"), "Commune canonical table path status copy missing.");
assert(page.includes("Report comment"), "Commune comment report action missing.");
assert(page.includes("Copy snippet"), "Commune inert code snippet copy action missing.");
assert(page.includes("metadata for review only"), "Commune sandbox metadata-only acknowledgement missing.");
assert(page.includes("Prepare a Local Elysia handoff request."), "Sandbox handoff request builder missing.");
assert(page.includes("Export for Local Elysia"), "Sandbox local handoff export action missing.");
assert(page.includes("Local Elysia must revalidate"), "Local Elysia revalidation copy missing.");
assert(page.includes("I understand the website will not execute this"), "Sandbox no-execution acknowledgement missing.");
assert(page.includes("I confirm I am not including secrets"), "Sandbox no-secrets acknowledgement missing.");
assert(page.includes("Prepare sandbox review request"), "Code review to sandbox request link missing.");
assert(safety.includes("blockedCommuneUploadExtensions"), "Media upload blocklist missing.");
assert(migration.includes("commune_realtime_messages"), "Realtime foundation table missing.");
assert(realtimeMigration.includes("commune_realtime_rooms"), "Realtime rooms table missing.");
assert(realtimeMigration.includes("commune_realtime_reports"), "Realtime reports table missing.");
assert(realtimeMigration.includes("commune_room_moderation_events"), "Realtime moderation events table missing.");
assert(realtimeMigration.includes("can_post_commune_realtime_message"), "Realtime slow-mode/posting policy function missing.");
assert(realtimeApi.includes("validateChatMessageInput"), "Realtime chat input validator missing.");
assert(realtimeApi.includes("subscribeToRoomMessages"), "Realtime subscription helper missing.");
assert(realtimeApi.includes("hideRealtimeMessage") && realtimeApi.includes("removeRealtimeMessage"), "Realtime moderation helpers missing.");
assert(codeReviewMigration.includes("commune_code_documents"), "Code review documents table missing.");
assert(codeReviewMigration.includes("commune_code_document_versions"), "Code review versions table missing.");
assert(codeReviewMigration.includes("commune_code_annotations"), "Code review annotations table missing.");
assert(codeReviewMigration.includes("commune_code_reports"), "Code review reports table missing.");
assert(codeReviewApi.includes("createCodeDocument"), "Code document creation helper missing.");
assert(codeReviewApi.includes("createDocumentVersion"), "Code version snapshot helper missing.");
assert(codeReviewApi.includes("createAnnotation"), "Code annotation helper missing.");
assert(codeReviewApi.includes("acquireEditLock"), "Code edit lock helper missing.");
assert(codeReviewApi.includes("reportCodeDocument"), "Code report helper missing.");
assert(sandboxHandoffMigration.includes("sandbox_handoff_events"), "Sandbox handoff event table missing.");
assert(sandboxHandoffMigration.includes("approved_for_local_handoff"), "Sandbox approved-for-handoff status missing.");
assert(sandboxHandoffMigration.includes("reviewer_private_note"), "Sandbox private reviewer note column missing.");
assert(sandboxHandoffApi.includes("exportLocalHandoffBundle"), "Sandbox handoff export API missing.");
assert(sandboxValidator.includes("curl_bash") && sandboxValidator.includes("git_clone"), "Sandbox dangerous-command validation missing.");
assert(sandboxValidator.includes("SUPABASE_SERVICE_ROLE") && sandboxValidator.includes("BEGIN [A-Z ]*PRIVATE KEY"), "Sandbox secret validation missing.");
assert(sandboxBuilder.includes("private_reviewer_notes_included: false"), "Sandbox handoff private-note exclusion missing.");
assert(sandboxBuilder.includes("website_executed_code: false"), "Sandbox handoff no-execution contract missing.");
assert(migration.includes("commune_sandbox_reviews"), "Sandbox review foundation table missing.");
assert(migration.includes("commune_code_snippets"), "Code snippet table missing.");
assert(migration.includes("commune_reports"), "Commune reports table missing.");

console.log("Commune smoke test ok.");

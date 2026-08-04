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
const attributionApi = await read("src/pages/The-Elysia-Commune/communeAttribution.ts");
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const jobPostReviewClient = await read("src/shared/review/jobPostReviewClient.ts");
const migration = await read("supabase/legacy-migrations/2026_06_12_commune_full_system.sql");
const realtimeMigration = await read("supabase/legacy-migrations/2026_06_14_commune_realtime_chat_moderation.sql");
const realtimeApi = await read("src/pages/The-Elysia-Commune/communeRealtimeApi.ts");
const canonicalAttributionMigration = await read("supabase/migrations/20260724010000_commune_canonical_author_attribution.sql");
const codeReviewMigration = await read("supabase/legacy-migrations/2026_06_14_commune_collaborative_code_review.sql");
const codeReviewApi = await read("src/pages/The-Elysia-Commune/communeCodeReviewApi.ts");
const sandboxHandoffMigration = await read("supabase/legacy-migrations/2026_06_14_sandbox_request_local_handoff.sql");
const sandboxHandoffApi = await read("src/pages/The-Elysia-Commune/communeSandboxHandoffApi.ts");
const sandboxValidator = await read("src/shared/sandbox/sandboxRequestValidator.ts");
const sandboxBuilder = await read("src/shared/sandbox/sandboxHandoffBuilder.ts");
const languagePolicies = await read("src/pages/The-Elysia-Commune/codeLanguagePolicies.ts");
const diagnosticTypes = await read("src/pages/The-Elysia-Commune/codeDiagnosticTypes.ts");
const sandboxClient = await read("src/pages/The-Elysia-Commune/codingSandboxClient.ts");
const sandboxCreditsClient = await read("src/pages/The-Elysia-Commune/sandboxCreditsClient.ts");
const commonsPage = await read("src/pages/The-Commons-Circle/index.tsx");
const commonsApi = await read("src/pages/The-Commons-Circle/commonsCircleApi.ts");
const signalConsolePage = await read("src/pages/The-Commons-Circle/SignalConsolePage.tsx");
const signalDetailPage = await read("src/pages/The-Commons-Circle/SignalDetailPage.tsx");
const sandboxRunner = await read("services/sandbox-runner/runner.mjs");
const sandboxServer = await read("services/sandbox-runner/server.mjs");
const sandboxBoundaryDoc = await read("docs/security/coding-cornucopia-sandbox-boundary.md");
const sandboxThreatDoc = await read("docs/security/coding-cornucopia-threat-model.md");
const sandboxContractDoc = await read("docs/api/coding-cornucopia-sandbox-contract.md");
const participantApprovalMigration = await read("supabase/legacy-migrations/2026_06_21_commune_thread_participant_approvals.sql");
const reactionMigration = await read("supabase/legacy-migrations/2026_06_21_commune_content_reactions.sql");
const reactionSecurityRepair = await read("supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql");
const commentDirectPublishMigration = await read("supabase/legacy-migrations/2026_06_21_commune_comment_direct_publish_policy.sql");
const commentSchemaRepairMigration = await read("supabase/legacy-migrations/2026_06_22_commune_comments_schema_drift_repair.sql");
const commentNotificationRepairMigration = await read("supabase/legacy-migrations/2026_06_22_commune_comment_notification_dependency_repair.sql");
const accountNotificationProducerMigration = await read("supabase/migrations/20260802060000_account_notification_producers.sql");
const roomPostMediaPolicyRepairMigration = await read("supabase/legacy-migrations/2026_06_23_commune_room_post_admin_and_media_policy_repair.sql");
const publishedMediaDisplayPolicyMigration = await read("supabase/legacy-migrations/2026_06_24_commune_published_media_display_policy.sql");
const codingRunsMigration = await read("supabase/legacy-migrations/2026_06_24_coding_cornucopia_runs_and_diagnostics.sql");
const codeProposalMigration = await read("supabase/legacy-migrations/2026_06_25_coding_cornucopia_author_revision_proposals.sql");
const runResultRecordingMigration = await read("supabase/legacy-migrations/2026_06_25_coding_cornucopia_run_result_recording.sql");
const governedSandboxMigration = await read("supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql");
const sandboxProxyRun = await read("functions/api/sandbox/run.ts");
const repositoryMetadataMigration = await read("supabase/migrations/20260714020000_repository_showcase_structured_metadata_repair.sql");
const iterationMetadataMigration = await read("supabase/legacy-migrations/2026_06_26_elysia_iteration_showcase_structured_metadata.sql");
const officialUpdateMigration = await read("supabase/legacy-migrations/2026_06_26_official_update_structured_workflow.sql");
const troubleshootingWorkflowMigration = await read("supabase/legacy-migrations/2026_06_26_troubleshooting_grove_structured_workflow.sql");
const repositoryPolicyDoc = await read("docs/commune/repo-showcase-policy.md");
const repositoryBoundaryDoc = await read("docs/security/repository-showcase-boundary.md");
const repositoryContractDoc = await read("docs/api/repository-showcase-contract.md");
const iterationPolicyDoc = await read("docs/commune/elysia-iteration-showcase-policy.md");
const iterationBoundaryDoc = await read("docs/security/elysia-iteration-showcase-boundary.md");
const iterationContractDoc = await read("docs/api/elysia-iteration-showcase-contract.md");
const officialUpdatePolicyDoc = await read("docs/commune/official-update-policy.md");
const officialUpdateBoundaryDoc = await read("docs/security/official-update-boundary.md");
const officialUpdateContractDoc = await read("docs/api/official-update-contract.md");
const troubleshootingPolicyDoc = await read("docs/commune/troubleshooting-grove-policy.md");
const troubleshootingBoundaryDoc = await read("docs/security/troubleshooting-grove-boundary.md");
const troubleshootingContractDoc = await read("docs/api/troubleshooting-grove-contract.md");
const researchNotesWorkflowMigration = await read("supabase/legacy-migrations/2026_06_26_research_notes_structured_workflow.sql");
const researchNotesPolicyDoc = await read("docs/commune/research-notes-policy.md");
const researchNotesBoundaryDoc = await read("docs/security/research-notes-boundary.md");
const researchNotesContractDoc = await read("docs/api/research-notes-contract.md");
const jobPostWorkflowMigration = await read("supabase/legacy-migrations/2026_06_26_job_post_structured_workflow.sql");
const jobPostEconomicMigration = await read("supabase/migrations/20260716040000_job_post_economic_sidecar_and_publication_gate.sql");
const jobPostPolicyDoc = await read("docs/commune/job-post-policy.md");
const jobPostBoundaryDoc = await read("docs/security/job-post-boundary.md");
const jobPostContractDoc = await read("docs/api/job-post-contract.md");
const communityVoteEnumMigration = await read("supabase/legacy-migrations/2026_07_05_01_commune_community_voting_room_enum.sql");
const communityVoteMigration = await read("supabase/legacy-migrations/2026_07_05_02_commune_community_voting_room.sql");
const softDeleteCleanupMigration = await read("supabase/legacy-migrations/2026_07_07_commune_soft_delete_cleanup.sql");
const communityVoteDeleteFilterMigration = await read("supabase/legacy-migrations/2026_07_08_commune_vote_delete_parent_filter.sql");
const communityVoteSoftDeleteRepairMigration = await read("supabase/legacy-migrations/2026_07_11_fix_commune_vote_soft_delete_rpc.sql");
const supabaseSchema = await read("supabase/schema.sql");
const communityVotePolicyDoc = await read("docs/commune/community-voting-room-policy.md");
const communityVoteBoundaryDoc = await read("docs/security/community-voting-room-boundary.md");
const communityVoteContractDoc = await read("docs/api/community-vote-contract.md");
const workWithPage = await read("src/pages/Work-With-Elysia-Ecobotics/index.tsx");
const communeCommentSchemaCoverage = `${migration}\n${commentDirectPublishMigration}\n${commentSchemaRepairMigration}\n${commentNotificationRepairMigration}`;
const styles = await read("src/styles.css");

for (const route of ["/commune", "commune/rooms/:roomSlug", "commune/rooms/:roomSlug/new", "commune/rooms/:roomSlug/posts", "commune/new", "commune/:roomSlug", "commune/:roomSlug/new", "commune/repository-showcase", "commune/repository-showcase/new", "commune/repository-showcase/sandbox-request", "commune/elysia-iteration-showcase/sandbox-request", "commune/troubleshooting", "commune/troubleshooting-grove/review", "commune/troubleshooting-grove/sandbox-request", "commune/sandbox-review", "commune/coding-cornucopia/review", "commune/coding-cornucopia/sandbox-request", "commune/code-sharing/review", "commune/code-sharing/sandbox-request", "commune/realtime", "commune/moderation"]) {
  assert(app.includes(route.replace(/^\//, "")) || app.includes(route), `Missing Commune route: ${route}`);
}
assert(app.includes('path="commons-circle/signals"'), "Signal Console route missing.");
assert(commonsApi.includes("loadSignalConsole") && commonsApi.includes("codeProposalCount"), "Commons Circle Signal Console loader should expose proposal signal counts.");
assert(commonsApi.includes("RepositoryShowcaseSignalPreview") && commonsApi.includes("commune_repository_showcases") && commonsApi.includes("repositoryShowcaseActivity"), "Signal Console should load direct Repository Showcase activity records.");
assert(commonsApi.includes("repositoryShowcasesNeedingReview") && commonsApi.includes("repositorySandboxActivity") && commonsApi.includes("/commune/repository-showcase/sandbox-request?"), "Signal Console should split Repository Showcase review and selected-artifact sandbox activity.");
assert(commonsApi.includes("ElysiaIterationShowcaseSignalPreview") && commonsApi.includes("commune_iteration_showcases") && commonsApi.includes("iterationShowcaseActivity"), "Signal Console should load direct Elysia Iteration Showcase activity records.");
assert(commonsApi.includes("iterationShowcasesNeedingReview") && commonsApi.includes("iterationSandboxActivity") && commonsApi.includes("/commune/elysia-iteration-showcase/sandbox-request?"), "Signal Console should split Elysia Iteration Showcase review and selected-artifact sandbox activity.");
assert(commonsApi.includes("OfficialUpdateSignalPreview") && commonsApi.includes("commune_official_updates") && commonsApi.includes("officialUpdateActivity"), "Signal Console should load direct Official Update lifecycle records.");
assert(commonsApi.includes("officialUpdatesNeedingAttention") && commonsApi.includes("officialUpdateCount") && commonsApi.includes("/commune/rooms/official-updates"), "Signal Console should split Official Update admin/reviewer attention activity.");
assert(commonsApi.includes("TroubleshootingSignalPreview") && commonsApi.includes("commune_troubleshooting_posts") && commonsApi.includes("troubleshootingActivity"), "Signal Console should load direct Troubleshooting Grove issue activity records.");
assert(commonsApi.includes("myTroubleshootingIssues") && commonsApi.includes("troubleshootingNeedingReview") && commonsApi.includes("troubleshootingResolutionActivity"), "Signal Console should split Troubleshooting Grove owner, reviewer, and accepted resolution activity.");
assert(commonsApi.includes("troubleshootingCount") && commonsApi.includes("/commune/posts/"), "Signal Console should count and link direct Troubleshooting Grove issue activity.");
assert(commonsApi.includes("commune_code_revision_proposals") && commonsApi.includes("original_author_user_id.eq") && commonsApi.includes("proposer_user_id.eq"), "Signal Console should load direct Coding Cornucopia proposal records for both authors and proposers.");
assert(commonsApi.includes("needsMyReview") && commonsApi.includes("mySubmittedProposals") && commonsApi.includes("codeProposalActivity"), "Signal Console loader should split direct proposal activity into review and submitted sections.");
assert(commonsApi.includes("source_room") && commonsApi.includes("troubleshooting_grove") && commonsApi.includes("/commune/troubleshooting-grove/review") && commonsApi.includes("?proposal="), "Signal Console should distinguish Troubleshooting Grove proposed fixes from Coding Cornucopia revisions.");
assert(signalConsolePage.includes("Browse focused signal rooms") && signalConsolePage.includes("/commons-circle/signals/coding-proposals"), "Signals hub should prioritize focused Coding proposal navigation.");
assert(signalDetailPage.includes("Repository Showcase activity") && signalDetailPage.includes("Repository review snapshot"), "Focused Signals routes should retain Repository Showcase activity sections.");
assert(signalDetailPage.includes("Selected-artifact sandbox review") && signalDetailPage.includes("does not clone, install, build, trust, approve"), "Focused Signals routes should preserve Repository Showcase sandbox boundary copy.");
assert(signalDetailPage.includes("Iteration Showcase activity") && signalDetailPage.includes("Iteration review snapshot"), "Focused Signals routes should retain Iteration Showcase activity sections.");
assert(signalDetailPage.includes("Official Updates, releases, and Marketplace approval"), "Focused Signals routes should preserve Iteration Showcase authority boundary copy.");
assert(signalDetailPage.includes("Official Update signals") && signalDetailPage.includes("Critical Official Update snapshot"), "Focused Signals routes should retain Official Update lifecycle sections.");
assert(signalDetailPage.includes("Community users cannot self-assign official publishing"), "Focused Signals routes should preserve Official Update authority boundary copy.");
assert(signalDetailPage.includes("Troubleshooting proposed fix") && signalDetailPage.includes("Open proposed fix workbench"), "Focused Signals routes should label troubleshooting proposed fixes distinctly.");
assert(signalDetailPage.includes("Troubleshooting activity") && signalDetailPage.includes("Troubleshooting review snapshot") && signalDetailPage.includes("Accepted fixes and workarounds"), "Focused Signals routes should retain Troubleshooting issue/status/resolution activity.");
assert(signalDetailPage.includes("publication changes only through established author acceptance"), "Focused Signals routes should preserve proposal author-control copy.");
assert(commonsApi.includes("ResearchNotesSignalPreview") && commonsApi.includes("commune_research_notes") && commonsApi.includes("researchNotesActivity"), "Signal Console should load direct Research Notes activity records.");
assert(commonsApi.includes("myResearchNotes") && commonsApi.includes("researchNotesNeedingReview") && commonsApi.includes("researchClarificationActivity"), "Signal Console should split Research Notes owner, reviewer, and clarification activity.");
assert(commonsApi.includes("JobPostSignalPreview") && commonsApi.includes("commune_job_posts") && commonsApi.includes("jobPostActivity"), "Signal Console should load direct Job Post activity records.");
assert(commonsApi.includes("myJobPosts") && commonsApi.includes("jobPostsNeedingReview") && commonsApi.includes("jobPostStatusActivity"), "Signal Console should split Job Post owner, reviewer, and status activity.");
assert(signalDetailPage.includes("Research Notes activity") && signalDetailPage.includes("Research Notes review snapshot"), "Focused Signals routes should retain Research Notes activity/review sections.");
assert(signalDetailPage.includes("Citation, source, and uncertainty activity") && signalDetailPage.includes("correction follow-up"), "Focused Signals routes should retain Research Notes clarification/evidence-boundary sections.");
assert(signalDetailPage.includes("Research Notes are public evidence discussions") && signalDetailPage.includes("not Official Updates"), "Focused Signals routes should preserve Research Notes boundary copy.");
assert(signalDetailPage.includes("Job Post activity") && signalDetailPage.includes("Job Post review snapshot") && signalDetailPage.includes("anti-scam outcomes"), "Focused Signals routes should retain Job Post activity/review sections.");
assert(signalDetailPage.includes("Private applications, resumes, contact details, and Work With uploads never appear here"), "Focused Signals routes should preserve the Job Post public-board/private-intake boundary.");
assert(signalDetailPage.includes("Proposals awaiting your decision") && signalDetailPage.includes("Proposals submitted by you"), "Focused Signals routes should distinguish direct proposal activity sections without a duplicate recent list.");
assert(commonsApi.includes("/commune/coding-cornucopia/review") && commonsApi.includes("?proposal=") && signalDetailPage.includes("Open proposal in Coding Workbench"), "Focused proposal cards should link to the Coding Cornucopia proposal workbench.");
assert(signalDetailPage.includes("direct-source lane remains as a parity fallback") && signalConsolePage.includes("not a second notification feed"), "Signals should preserve direct-source parity without duplicating the Notifications feed.");
assert(signalConsolePage.includes("Research Notes") && signalConsolePage.includes("Job Posts"), "Signals hub should retain Research Notes and Job Post destinations.");
assert(signalDetailPage.includes("Author approval, moderator safety review, and sandbox evidence remain separate"), "Focused Signals routes should preserve author approval doctrine.");
assert(signalDetailPage.includes("Sandbox diagnostics are evidence only") || signalDetailPage.includes("selected-artifact review evidence"), "Focused Signals routes should preserve sandbox-is-not-approval doctrine.");
assert(commonsPage.includes("<h2>Signals</h2>") && commonsPage.includes("Open Signals"), "Commons Circle must preserve one broad doorway to the dedicated Signals hub.");
assert(!commonsPage.includes("Signals compatibility") && !commonsPage.includes("Existing notification preview") && !commonsPage.includes("legacy preview") && !commonsPage.includes("remains during migration"), "Commons Circle must not retain migration-era Signals wording.");
assert(!commonsPage.includes("<h2>Updates and outcomes</h2>") && commonsPage.includes("/commons-circle/signals/notifications") && commonsPage.includes("/commons-circle/signals"), "Commons Circle should avoid a duplicate Notifications card while preserving canonical preferences and the Signals doorway.");
assert(signalConsolePage.includes("/commons-circle/signals/troubleshooting") && signalDetailPage.includes("Troubleshooting activity"), "Signals compatibility routes must preserve Troubleshooting Grove support activity.");
assert(signalConsolePage.includes("/commons-circle/signals/research-notes") && signalDetailPage.includes("Research Notes activity"), "Signals compatibility routes must preserve Research Notes activity.");

for (const roomSlug of ["media-garden", "troubleshooting-grove", "coding-cornucopia", "code-sharing", "repository-showcase", "community-network", "job-post", "research-notes", "elysia-iteration-showcase", "community-vote", "official-updates"]) {
  assert(page.includes(roomSlug), `Missing Commune room slug: ${roomSlug}`);
}

const requiredLobbyRooms = ["Media Garden", "Troubleshooting Grove", "Coding Cornucopia", "Repository Showcase", "Community Network", "Job Post", "Research Notes", "Elysia Iteration Showcase", "Community Voting Room", "Official Update"];
let roomCursor = -1;
for (const roomName of requiredLobbyRooms) {
  const nextRoom = page.indexOf(`name: "${roomName}"`);
  assert(nextRoom > roomCursor, `Commune room definition missing or out of order: ${roomName}`);
  roomCursor = nextRoom;
}
const finalRoomOrder = requiredLobbyRooms.slice(-3).join(" > ");
assert(finalRoomOrder === "Elysia Iteration Showcase > Community Voting Room > Official Update", "Community Voting Room must be second-last and Official Update last.");
assert(accountApi.includes('"community_vote"') && accountApi.includes("submitCommunityVotePost") && accountApi.includes("castCommunityVoteBallot") && accountApi.includes("updateCommunityVoteLifecycle"), "Community Voting Room API helpers/types missing.");
assert(accountApi.includes("loadVotePostsForPosts") && accountApi.includes("commune_vote_result_summary") && accountApi.includes("Community Voting Room tables are not available yet"), "Community Voting Room loader or friendly drift error missing.");
assert(page.includes("CommunityVoteComposer") && page.includes("Create community vote") && page.includes("CommunityVoteDetail") && page.includes("commune-vote-result-bar") && page.includes("CommunityVoteAdminPanel"), "Community Voting Room UI create/detail/result/admin controls missing.");
assert(page.includes("Community votes guide stewardship decisions") && page.includes("They do not automatically change site policy") && page.includes("Official Updates"), "Community Voting Room advisory governance copy missing.");
assert(page.includes("Anonymous visitors can view Community Voting Room votes") && page.includes("Signed-in members can cast one ballot"), "Community Voting Room anonymous/member voting copy missing.");
assert(page.includes("Open") && page.includes("Close") && page.includes("Reopen") && page.includes("Accept") && page.includes("Decline") && page.includes("Mark posted to Official Update"), "Community Voting Room lifecycle control labels missing.");
assert(styles.includes(".commune-vote-card") && styles.includes(".commune-vote-detail") && styles.includes(".commune-vote-option-card") && styles.includes(".commune-vote-result-fill") && styles.includes(".commune-vote-admin-panel"), "Community Voting Room scoped styles missing.");
assert(communityVoteEnumMigration.includes("add value if not exists 'community_vote'"), "Community Voting Room enum migration missing community_vote.");
assert(communityVoteMigration.includes("commune_vote_posts") && communityVoteMigration.includes("commune_vote_options") && communityVoteMigration.includes("commune_vote_ballots") && communityVoteMigration.includes("commune_vote_events"), "Community Voting Room migration missing vote tables.");
assert(communityVoteMigration.includes("commune_vote_result_summary") && communityVoteMigration.includes("security definer") && !/returns table \([^)]*voter_user_id/i.test(communityVoteMigration), "Community Voting Room aggregate result function should not expose voter_user_id.");
assert(communityVoteMigration.includes("enable row level security") && communityVoteMigration.includes("users insert own open vote ballots") && communityVoteMigration.includes("users update own open vote ballots"), "Community Voting Room migration missing ballot RLS.");
assert(communityVotePolicyDoc.includes("advisory governance") && communityVotePolicyDoc.includes("Official Update remains separate"), "Community Voting Room policy doc missing advisory/Official Update boundary.");
assert(communityVoteBoundaryDoc.includes("aggregate counts only") && communityVoteBoundaryDoc.includes("Closed") && communityVoteBoundaryDoc.includes("reject ballot writes"), "Community Voting Room security boundary doc missing privacy/closed-vote boundary.");
assert(communityVoteContractDoc.includes("loadVotePostsForPosts") && communityVoteContractDoc.includes("submitCommunityVotePost") && communityVoteContractDoc.includes("castCommunityVoteBallot") && communityVoteContractDoc.includes("Signal Console"), "Community Voting Room API contract doc missing helper/signal contract.");
assert(commonsApi.includes("CommunityVoteSignalPreview") && commonsApi.includes("commune_vote_posts") && commonsApi.includes("communityVoteActivity"), "Signal Console should load direct Community Voting Room activity records.");
assert(signalConsolePage.includes("/commons-circle/signals/voting-room") && signalDetailPage.includes("Voting stewardship snapshot") && signalDetailPage.includes("separate from Official Updates"), "Focused Signals routes should retain Community Voting Room lifecycle sections and boundary copy.");

for (const anchor of ["commune-lobby", "commune-search", "commune-feed", "commune-rooms", "commune-post-composer", "commune-repository-showcase", "commune-repository-showcase-sandbox-request", "commune-elysia-iteration-showcase-sandbox-request", "commune-sandbox-review", "commune-code-review", "commune-local-drafts"]) {
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
for (const lobbyPanel of ["<CommuneLobby", "<CommuneSearchPanel", "<CommuneRoomsGateway", "<CommunityFeed", "<CommuneSideChannelPanel", "<LocalDraftStudio"]) {
  assert(page.includes(lobbyPanel), `Commune lobby panel missing: ${lobbyPanel}`);
}
assert(!lobbyBranch.includes("<RoomCards"), "Commune lobby should link to the Rooms directory instead of rendering the full room-card grid.");
assert(page.includes('routeMode === "rooms-index" && <CommuneRoomsIndexPage />'), "Commune /rooms should render the room directory index page.");
assert(page.includes("function CommuneRoomsGateway()") && page.includes("Browse Commune Rooms"), "Commune lobby should render a compact Rooms gateway.");
assert(page.includes("function CommuneRoomsIndexPage()") && page.includes("<RoomCards />"), "Commune /rooms should render the extracted full room-card directory.");
assert(page.includes('!isLobby && routeMode !== "rooms-index" && <AccountModePanel'), "Account-backed Commune functionality should remain available outside the public lobby and rooms directory.");
assert(page.includes("function RoomPage"), "Focused Commune room page component missing.");
assert(page.includes("postTypeByRoomSlug"), "Commune room slug to post type mapping missing.");
assert(page.includes("Posting in: {selectedPostTypeLabel}"), "Room composer should show a simple read-only room context line.");
assert(page.includes("postType: defaultType"), "Room composer should preserve the locked room post type internally.");
assert(page.includes("current.postType === defaultType"), "Room composer should relock post type when navigating between rooms.");
assert(page.includes('type RoomPageMode = "hub" | "posts" | "composer"') && page.includes("mode={roomPageMode}"), "Room-specific routes should render hub, posts, or composer modes instead of reopening the lobby picker.");
assert(page.includes("roomPostTypeForLoad") && page.includes("loadCommuneData(roomSlug, postId, postType)") && accountApi.includes('postQuery.eq("post_type", postType)'), "Room post pages should load active public posts by post type instead of relying on thread room ids.");
assert(page.includes("function RoomPostsGateway") && page.includes("Browse all {type.name} posts"), "Room hubs should show a compact posts gateway.");
assert(page.includes('href: "/commune/rooms/repository-showcase"') && page.includes('if (type.backendValue === "repository_showcase") return "Create Repository Showcase Post"'), "Repository Showcase actions should enter the canonical hub and use its dedicated create label.");
assert(page.includes('type.backendValue === "repository_showcase" && mode === "hub"') && page.includes("Repository Showcase boundaries") && page.includes("Metadata and presentation only, never execution"), "Repository Showcase canonical route should render its compact shared hub boundary container.");
assert(page.includes("No private repository access") && page.includes("Selected-artifact review separate") && page.includes("Developer Forge separate") && page.includes("Marketplace separate"), "Repository Showcase hub should preserve private-repo, selected-artifact, Forge, and Marketplace boundaries.");
assert(page.includes("Admin guidance/template posts explain safe room use") && page.includes("not repository listings, compatibility guarantees"), "Repository Showcase hub should distinguish admin guidance posts from repository approvals or trust signals.");
assert(!page.includes('routeMode === "repository-showcase" && <RepositoryShowcaseForm') && !page.includes('"new", "repository-showcase", "troubleshooting"'), "Repository Showcase hub must not be swallowed by the legacy specialized form route mode.");
assert((page.match(/<RepositoryShowcaseForm/g) ?? []).length === 1 && page.includes('if (type.backendValue === "repository_showcase") return <RepositoryShowcaseForm'), "The canonical Repository Showcase /new route should reuse one existing complete form implementation.");
assert(app.includes('path="commune/repository-showcase" element={<Navigate replace to="/commune/rooms/repository-showcase/new" />}'), "Legacy Repository Showcase composer URL should redirect to the canonical /new route.");
assert(page.includes('const roomPosts = type ? posts.filter((post) => post.post_type === type.backendValue)') && accountApi.includes('postQuery = postQuery.eq("post_type", postType)'), "Repository Showcase /posts should load active public parent posts by post_type without requiring historical thread room ids.");
assert(page.includes("<PostCard key={post.id}") && page.includes("saved={savedPostIds.includes(post.id)}") && page.includes("onSave={onSave}"), "Repository Showcase /posts should retain the shared PostCard read/save/reaction feed path.");
assert(page.includes('repoShowcaseDrafts: "commune.repoShowcaseDrafts.v1"'), "Repository Showcase local draft storage key must remain unchanged.");
assert(page.includes("roomId={selectedRoom?.id}"), "Room composer should receive the selected backend room id.");
assert(page.includes("defaultRoomId={roomId}"), "Room page should pass the backend room id into the post composer.");
assert(page.includes("isAdmin={state.isAdmin}"), "Room composer should receive admin state for direct-publish labeling.");
assert(page.includes('isAdmin ? "Publish as admin" : "Submit for moderation"'), "Room composer should show admin direct-publish copy while keeping member moderation copy.");
assert(page.includes("Admins can publish room posts directly. Attachments still follow Commune media safety rules."), "Room composer should explain admin direct-publish without bypassing media safety.");
assert(page.includes("Video uploads are not enabled for this room yet."), "Room composer should clearly reject unsupported video uploads instead of implying video support.");
for (const roomNativeField of ["Issue type", "Affected area", "Expected behavior", "Actual behavior", "Known workaround", "Introduction type", "Collaboration interest", "Role interest", "Project circle/topic", "Paid / volunteer status", "Compensation clarity", "Location / remote / hybrid", "Contact path", "Research question / topic", "Evidence strength / confidence", "Living Library source link", "Citation notes", "Evidence summary", "Observation", "Interpretation", "Uncertainty", "Geographic scope", "Ecological subsystem", "Ethics / sensitivity note", "Iteration type", "Version / build label", "What changed", "Why it matters", "Known limitations", "Next step", "Official notice type", "Audit-safe note"]) {
  assert(page.includes(roomNativeField), `Missing room-native composer field/copy: ${roomNativeField}`);
}
for (const jobPostField of ["Role title", "Organization / project", "Role type", "Paid / volunteer status", "Location details", "Time commitment", "Deadline", "Role summary", "Requirements / skills", "Safety notes", "Application status", "Anti-scam review", "Admin public-safe application clarification optional"]) {
  assert(page.includes(jobPostField), `Missing Job Post structured field/copy: ${jobPostField}`);
}
const permanentJobPrivateApplicationNotice = "Use Work With Elysia Ecobotics for private application materials such as resumes/CVs. Do not post resumes, CVs, identity documents, private contact details, SSNs, bank details, or private application materials in public comments.";
assert(page.includes(permanentJobPrivateApplicationNotice), "Job Post composer/detail should include the permanent system-owned Work With/private application notice.");
assert(!page.includes("<span>Private application note</span>"), "Normal Job Post authors should not see an editable Private application note field.");
assert(!page.includes("checked={form.jobWorkWithLinkEnabled}") && page.includes("Admin public-safe application clarification optional"), "Work With bridge should be always-on, and only the optional public-safe clarification should be admin-only.");
assert(accountApi.includes("work_with_link_enabled: true") && accountApi.includes("private_application_note: account.isModerator ? input.privateApplicationNote || null : null"), "Job Post API should prevent normal users from disabling or overriding the permanent Work With/private application warning.");
assert(page.includes("Create Job Post") && !page.includes("Create Job Post Post"), "Job Post room action should avoid duplicate Post wording.");
assert(page.includes("Normal users submit for mandatory admin approval before publication"), "Job Post composer should explain mandatory admin approval.");
assert(page.includes("Job Posts are public listings; Work With is the private intake path"), "Job Post room should link public listings to private Work With intake.");
assert(workWithPage.includes("Job Posts are the public board; Work With is the private intake path") && workWithPage.includes("/commune/rooms/job-post/posts") && workWithPage.includes("/commune/rooms/job-post/new"), "Work With page should link back to public Job Posts without merging private intake.");
assert(accountApi.includes("export async function submitJobPost") && accountApi.includes("commune_job_posts") && accountApi.includes('post_type: "job_post"'), "Job Post API should create normal Commune posts plus structured sidecar metadata.");
assert(accountApi.includes('status: adminDirectPublish ? "published" : "pending_review"') && accountApi.includes("mandatory admin approval"), "Job Post API should keep normal-user submissions pending until admin approval.");
assert(accountApi.includes("updateJobPostApplicationStatus") && accountApi.includes("updateJobPostReviewStatus"), "Job Post API should support listing status and anti-scam review updates.");
assert(accountApi.includes("update_own_commune_job_post_application_status") && jobPostWorkflowMigration.includes("update_own_commune_job_post_application_status"), "Job Post author listing status updates should use a narrow RPC instead of direct anti-scam table writes.");
assert(accountApi.includes("job_public_board") && accountApi.includes("work_with_private_path_separate") && accountApi.includes("no_private_applicant_data"), "Job Post safety acknowledgements should preserve public board/private intake boundaries.");
assert(page.includes("JobPostDetail") && page.includes("Structured job listing") && page.includes("Anti-scam and privacy safety"), "Job Post public detail should render structured fields and anti-scam safety copy.");
assert(page.includes("JobPostReviewControls") && page.includes("Save anti-scam review") && page.includes("Hidden reviewer notes belong in Admin Review history"), "Job Post detail should expose reviewer-controlled anti-scam states without public hidden notes.");
assert(page.includes("jobSearchValues") && page.includes("jobByPostId") && page.includes("anti_scam_review_status"), "Job Post feed/search should include structured metadata values.");
assert(jobPostWorkflowMigration.includes("commune_job_posts") && jobPostWorkflowMigration.includes("paid_volunteer_status") && jobPostWorkflowMigration.includes("anti_scam_review_status"), "Job Post structured workflow migration missing sidecar table or anti-scam fields.");
assert(jobPostWorkflowMigration.includes("public reads published job post metadata") && jobPostWorkflowMigration.includes("signed users create own job post metadata") && jobPostWorkflowMigration.includes("reviewers manage job post metadata"), "Job Post migration should enforce public/author/reviewer RLS boundaries.");
assert(!jobPostWorkflowMigration.includes("authors maintain own non-trust job post status"), "Job Post authors should not have a broad direct update policy on the public sidecar table.");
assert(jobPostWorkflowMigration.includes("p.status in ('pending_review','published')") && jobPostWorkflowMigration.includes("p.status <> 'published' or public.current_user_is_admin()"), "Job Post migration should prevent normal users from creating direct-published sidecar rows.");
assert(jobPostWorkflowMigration.includes("reviewed_clear") && jobPostWorkflowMigration.includes("needs_pay_clarification") && jobPostWorkflowMigration.includes("needs_contact_clarification") && jobPostWorkflowMigration.includes("needs_location_clarification") && jobPostWorkflowMigration.includes("suspicious"), "Job Post migration should define anti-scam review states.");
assert(jobPostReviewClient.includes('rpc("review_commune_job_post"') && jobPostReviewClient.includes("p_job_post_id") && jobPostReviewClient.includes("p_action") && jobPostReviewClient.includes("p_reason"), "Job Post moderation must use the exact authenticated publication-gate RPC contract.");
for (const action of ["approve", "reject", "hide", "archive", "needs_information", "escalate"]) {
  assert(jobPostReviewClient.includes(`"${action}"`), `Governed Job Post review client is missing action: ${action}`);
}
for (const field of ["jobPostId", "postId", "action", "contentApproved", "contentStatus", "economicStatus", "publicationStatus", "published", "feeEnforcement"]) {
  assert(jobPostReviewClient.includes(`row.${field}`), `Governed Job Post review parser is missing response field: ${field}`);
}
assert(jobPostReviewClient.includes("No publication result should be assumed") || jobPostReviewClient.includes("no publication result should be assumed"), "Job Post RPC errors must use a non-leaking, fail-closed publication message.");
assert(accountApi.includes('item.kind === "job" || (item.kind === "post" && ownerRow.post_type === "job_post")') && accountApi.includes("resolveCommuneJobPostId(item.id)") && accountApi.includes("reviewCommuneJobPost(jobPostTarget.jobPostId"), "Both Job Post sidecar and linked Commune post moderation paths must resolve through the governed RPC.");
assert(accountApi.includes("finalizeGovernedJobPostPublication") && accountApi.includes("if (!supabase || !result.published) return"), "Job Post thread approval and attachment publication must run only after the database reports published=true.");
const moderationFunction = accountApi.slice(accountApi.indexOf("export async function moderateCommuneItem"));
assert(!moderationFunction.includes('ownerRow.post_type === "job_post") {\n    const jobReviewStatus') && !moderationFunction.includes('(item.kind === "repo" || item.kind === "iteration" || item.kind === "job") && postId'), "Job Post moderation must not retain the old direct sidecar/linked-post publication branch.");
assert(reviewClient.includes("resolveReviewItemJobPostTarget") && reviewClient.includes('item.source_table === "commune_job_posts"') && reviewClient.includes('item.source_table !== "commune_posts"'), "Admin Review must recognize both Job Post review records and linked Commune post review records.");
assert(reviewClient.includes("reviewJobPostFromReviewItem") && reviewClient.includes("governedJobPostReview.handled") && reviewClient.includes("finalizeGovernedJobPostReviewPublication"), "Admin Review status changes must bypass generic direct post updates for Job Posts and condition ancillary publication on the RPC result.");
assert(reviewClient.includes('currentRow.post_type === "job_post"') && reviewClient.includes('action === "approve_and_restore" ? "approve" : "needs_information"'), "Job Post restore and rejected-recovery approval paths must also retain the database publication gate.");
assert(jobPostEconomicMigration.includes("create or replace function public.review_commune_job_post") && jobPostEconomicMigration.includes("private.publish_job_post_if_eligible"), "Job Post migration must centralize content review and conditional publication.");
assert(jobPostEconomicMigration.includes("v_economic_satisfied := not v_fee_enabled") && jobPostEconomicMigration.includes("'feeEnforcement', v_fee_enabled"), "Fee-off mode must preserve existing approved Job Post publication while returning the explicit enforcement state.");
assert(jobPostEconomicMigration.includes("condition_status in ('not_required', 'satisfied', 'waived', 'subsidized')") && jobPostEconomicMigration.includes("Payment may satisfy a Job Post economic condition"), "Fee-on Job Post publication must require an independent satisfied/waived/subsidized condition without making payment content approval.");
assert(jobPostEconomicMigration.includes("create trigger enforce_job_post_economic_publication_gate\nbefore update of status on public.commune_posts"), "Job Post publication gating must fail closed on status updates when fee enforcement is enabled.");
assert(jobPostEconomicMigration.includes("create trigger enforce_job_post_economic_publication_gate_on_insert\nbefore insert on public.commune_posts"), "Job Post publication gating must also fail closed on direct published inserts when fee enforcement is enabled.");
assert(jobPostPolicyDoc.includes("Normal community users may submit Job Posts") && jobPostPolicyDoc.includes("Every normal-user Job Post requires admin approval"), "Job Post policy doc missing public submission/admin approval doctrine.");
assert(jobPostPolicyDoc.includes("Work With Elysia Ecobotics is the private application/intake path") && jobPostPolicyDoc.includes("not Work With Elysia Ecobotics"), "Job Post policy doc missing public board/private Work With separation.");
assert(jobPostBoundaryDoc.includes("must not store or expose") && jobPostBoundaryDoc.includes("resumes/CVs") && jobPostBoundaryDoc.includes("SSNs") && jobPostBoundaryDoc.includes("Work With private uploads"), "Job Post security boundary doc missing private applicant data prohibitions.");
assert(jobPostContractDoc.includes("submitJobPost") && jobPostContractDoc.includes("commune_job_posts") && jobPostContractDoc.includes("Signal Console") && jobPostContractDoc.includes("Work With Bridge"), "Job Post API contract doc missing helper/table/signal/Work With contract.");
for (const officialField of ["Official status", "Severity", "Audience", "Effective date", "Affected systems", "Related room", "Related public repository/reference URL", "Related migration", "User action required", "Pin this notice", "Comments enabled", "Official read-only code", "Official code filename", "Official code context"]) {
  assert(page.includes(officialField), `Missing Official Update structured field/copy: ${officialField}`);
}
assert(page.includes("Publish Official Update") && page.includes("Official Update composer") && page.includes("Community members can read and report Official Updates, but cannot submit, self-assign, or impersonate official authority"), "Official Update composer should be admin-only and brand-authoritative.");
assert(page.includes("Official code preview") && page.includes("No workbench, sandbox run, proposal, install, deploy, or Local Elysia execution controls are exposed"), "Official Update composer should preview official code as read-only/copy-only.");
assert(page.includes("supportsCommuneCodeSnippetFields(form.postType)") && page.includes('postType === "code_sharing" || postType === "troubleshooting"'), "Troubleshooting Grove should reuse optional code/reproduction snippet composer support.");
assert(page.includes("Code / reproduction snippet optional") && page.includes("minimal redacted reproduction"), "Troubleshooting Grove composer should include redacted optional reproduction snippet copy.");
assert(page.includes("Environment notes") && page.includes("Error message") && page.includes("Redacted logs"), "Troubleshooting Grove composer should include environment notes, error message, and redacted logs fields.");
assert(page.includes("submitTroubleshootingPost") && page.includes("stepsToReproduce: form.stepsTried") && page.includes("redactedLogs: form.redactedLogs"), "Troubleshooting Grove composer should submit through the structured troubleshooting helper.");
assert(accountApi.includes("export async function submitTroubleshootingPost") && accountApi.includes("commune_troubleshooting_posts") && accountApi.includes("createCodeSnippet"), "Troubleshooting Grove API should persist structured metadata and optional reproduction snippets.");
assert(accountApi.includes("updateTroubleshootingStatus") && accountApi.includes("markTroubleshootingResolved"), "Troubleshooting Grove API should support status and accepted fix/workaround updates.");
assert(page.includes("Troubleshooting Grove detail") && page.includes("Structured issue report") && page.includes("Accepted fix / workaround"), "Troubleshooting Grove post detail should render structured support panels.");
assert(page.includes("Author resolution controls") && page.includes("Record accepted fix/workaround"), "Troubleshooting Grove post detail should expose author-controlled resolution controls.");
assert(page.includes("Code attached for troubleshooting") && page.includes("Reproduction snippet") && page.includes("Propose fix"), "Troubleshooting Grove detail should keep reproduction snippets attached to the post flow with propose-fix affordances.");
assert(page.includes("Open troubleshooting workbench") && page.includes("/commune/troubleshooting-grove/review"), "Troubleshooting Grove code snippets should route to the troubleshooting workbench.");
for (const troubleshootingCodeWarning of [".env files", "private logs", "local Elysia memory", "vault data", "credentials"]) {
  assert(page.includes(troubleshootingCodeWarning), `Troubleshooting Grove code warning missing: ${troubleshootingCodeWarning}`);
}
for (const troubleshootingStatus of ["Needs information", "In progress", "Workaround found", "Fix proposed", "Resolved", "Closed", "Archived"]) {
  assert(page.includes(troubleshootingStatus), `Troubleshooting Grove status option missing: ${troubleshootingStatus}`);
}
assert(page.includes("function splitPostSections") && page.includes("function explicitFormSectionValue") && page.includes("roomNativeFormHeadingsByPostType"), "Post detail should keep legacy form-generated structured fields explicit instead of treating all Markdown headings as metadata.");
assert(page.includes("function CommunePostBody") && page.includes("parseCommuneMarkdownBlocks") && page.includes("commune-post-prose"), "Post detail should render body Markdown through a distinct prose renderer.");
assert(page.includes("function RoomNativeDetails") && page.includes("commune-room-native-details"), "Post detail should render room-native metadata through a distinct native details renderer.");
assert(!page.includes("parsedBody.sections.map"), "Post detail must not map arbitrary body Markdown headings into room-native metadata cards.");
for (const proseHeading of ["A simple introduction template", "The vibe", "What this room is for"]) {
  assert(!page.includes(`["${proseHeading}", explicitFormSectionValue`), `Markdown prose heading should not be whitelisted as room-native metadata: ${proseHeading}`);
}
assert(page.includes("legacyCommunityNetworkDetails") && page.includes("Project circle/topic") && page.includes("Public contact preference") && page.includes("Boundary note"), "Community Network detail should include only explicit form-generated metadata fields.");
assert(page.includes("Structured issue report") && page.includes("Operating system") && page.includes("Expected result") && page.includes("Known workaround"), "Troubleshooting Grove detail should keep explicit support metadata near the top.");
assert(page.includes("Structured official metadata") && page.includes("Notice type") && page.includes("Audience") && page.includes("User action required"), "Official Update detail should keep explicit official metadata near the top.");
const postDetailStart = page.indexOf("function PostDetail");
const detailStatusIndex = page.indexOf("<StatusBadges labels={[post.status, post.visibility]}", postDetailStart);
const detailNativeIndex = page.indexOf("<RoomNativeDetails label=\"Room-native details\"", postDetailStart);
const detailBodyIndex = page.indexOf("<CommunePostBody body={bodyMarkdown}", postDetailStart);
const detailMediaIndex = page.indexOf("commune-media-section", detailBodyIndex);
const detailCodeIndex = page.indexOf("<AttachedCodeSnippets", detailBodyIndex);
const detailTagsIndex = page.indexOf("<TagChips tags={post.tags}", detailBodyIndex);
const detailReactionIndex = page.indexOf("<ReactionBar targetType=\"post\"", detailBodyIndex);
const detailCommentsIndex = page.indexOf("Comments and replies", detailBodyIndex);
const detailAdminIndex = page.indexOf("<AdminContentControls targetType=\"post\"", detailBodyIndex);
assert(detailStatusIndex > postDetailStart && detailNativeIndex > detailStatusIndex && detailNativeIndex < detailBodyIndex, "Post detail render order should place room-native details after status badges and before body Markdown.");
assert(detailBodyIndex > detailNativeIndex && detailMediaIndex > detailBodyIndex && detailCodeIndex > detailMediaIndex && detailTagsIndex > detailCodeIndex && detailReactionIndex > detailTagsIndex, "Post detail body, media, code, tags, and reaction controls should render in the requested order.");
assert(detailCommentsIndex > detailReactionIndex && detailAdminIndex > detailCommentsIndex, "Comments should remain below post content and post admin moderation should remain at the bottom.");
assert(styles.includes(".commune-room-native-details"), "Room-native post detail styling missing.");
assert(styles.includes(".commune-post-prose") && styles.includes(".commune-post-prose h2"), "Commune post prose styling should keep Markdown headings inside body content.");
assert(!page.includes("defaultRoomId={undefined}"), "Room post composer should not drop the backend room id.");
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
assert(page.includes("function RoomCards()"), "Commune rooms directory should render the complete room list.");
assert(page.includes("postTypes.map((type)"), "Commune rooms directory cards should include every post type doorway.");
assert(page.includes("Enter room"), "Commune room entry copy missing.");
assert(page.includes("function RoomCardEnterAction"), "Commune room cards should use a shared Enter room CTA component.");
assert(page.includes('className="commune-room-card-actions"'), "Commune room cards should render a shared CTA/action area.");
assert(page.includes('className="button-link commune-room-enter-button"'), "Commune room Enter room links should use the shared room-card button class.");
const roomCardEnterActionUses = page.match(/<RoomCardEnterAction type=\{type\} \/>/g) ?? [];
assert(roomCardEnterActionUses.length === 2, "Commune lobby and room picker cards should both use the shared Enter room CTA path.");
for (const roomName of requiredLobbyRooms) {
  assert(page.includes(`name: "${roomName}"`), `Commune room should remain on the shared room-card CTA path: ${roomName}`);
}
assert(styles.includes(".commune-room-card-actions") && styles.includes(".commune-room-enter-button"), "Commune room-card CTA action/button styles missing.");
assert(styles.includes(".commune-room-card {\n  display: flex;\n  flex-direction: column;"), "Commune room cards should use a column layout for bottom-pinned CTAs.");
assert(styles.includes("margin-top: auto;") && styles.includes("width: 100%;") && styles.includes("min-height: 2.65rem;"), "Commune room Enter room buttons should have consistent bottom placement, width, and height.");
assert(page.includes("Shared code is public knowledge, not automatic trust."), "Coding Cornucopia caution copy missing.");
assert(page.includes("function RoomPickerPanel()"), "Commune /new room picker compatibility panel missing.");
assert(page.includes("Choose a room before posting"), "Commune /new room picker title missing.");
assert(page.includes("Posts are created from inside their room so the format, safety notes, and context match what you are sharing."), "Commune /new room picker copy missing.");
assert(page.includes('{routeMode === "new" && <RoomPickerPanel />}'), "Commune /new should render the room picker instead of the generic composer.");
assert(!page.includes('{mode === "new" && <PostComposer'), "Commune /new still renders the generic post composer.");
assert(!page.includes('to="/commune/new"'), "Commune page still links users to the generic /commune/new composer.");
assert(!page.includes("Request to post"), "Generic Request to post copy should not be visible in Commune UI.");

for (const reason of ["spam", "harassment", "unsafe_code", "secret_or_private_data", "misinformation", "copyright_or_license", "malware_or_suspicious", "privacy_violation", "other"]) {
  assert(safety.includes(`"${reason}"`), `Missing report reason: ${reason}`);
}

for (const secret of [".env", "SUPABASE_SERVICE_ROLE", "service_role", "BEGIN [A-Z ]*PRIVATE KEY", "github_pat_", "AWS_ACCESS_KEY_ID", "\\/home\\/"]) {
  assert(safety.includes(secret), `Missing secret scanner pattern: ${secret}`);
}

const warningOnlySecretSafetyFixtures = [
  "Do not upload .env files, API keys, tokens, credentials, private logs, or vault data.",
  "Never share credentials, access tokens, private machine logs, local vault material, or environment-variable files.",
  "Users should redact secrets before posting."
];
for (const warningOnlyFixture of warningOnlySecretSafetyFixtures) {
  assert(/do not|never|redact|should/i.test(warningOnlyFixture), `Secret safety warning fixture is not prohibitive: ${warningOnlyFixture}`);
}
assert(safety.includes("classifyCommuneSecretRisk") && safety.includes("hasHardSecretMaterial") && safety.includes("containsSecretSafetyInstruction") && safety.includes("isWarningOnlySecretReference"), "Commune secret scanner should expose hard-secret and warning-only classifier helpers.");
assert(safety.includes("hardSecretPatterns") && safety.includes("secretReferencePatterns") && safety.includes("blocked: hardSecretHit") && safety.includes("warningOnlyHit"), "Commune secret scanner should separate hard secret hits from warning-only references.");
assert(safety.includes(".env file reference") && safety.includes("API key reference") && safety.includes("credentials reference") && safety.includes("private log reference") && safety.includes("vault reference"), "Warning-only secret safety references should be classified without requiring removal.");
assert(!/\.env[^\n]+blocks:\s*true/i.test(safety), ".env warning language must not be hard-blocked by mention alone.");
assert(page.includes("Do not upload .env files, API keys, tokens, credentials, private logs, or vault data."), "Commune public safety copy should preserve direct .env/API key/token/credential/private log/vault warning language.");
const hardSecretAssignmentFixtures = [
  "fixture SUPABASE_SERVICE_ROLE_KEY=...",
  "fixture OPENAI_API_KEY=...",
  "fixture CLOUDFLARE_API_TOKEN=...",
  "fixture password=...",
  "fixture SECRET_KEY=...",
  "fixture DATABASE_URL=...",
  "fixture -----BEGIN PRIVATE KEY-----",
  "fixture -----BEGIN OPENSSH PRIVATE KEY-----"
];
for (const hardSecretFixture of hardSecretAssignmentFixtures) {
  assert(/=|BEGIN/.test(hardSecretFixture), `Hard secret fixture should represent assignment or key block material: ${hardSecretFixture}`);
}
for (const hardSecretPattern of ["OPENAI_API_KEY", "CLOUDFLARE_API_TOKEN", "SUPABASE[_-]?SERVICE[_-]?ROLE", "DATABASE[_-]?URL", "PRIVATE[_-]?KEY", "PASSWORD", "TOKEN", "BEGIN OPENSSH PRIVATE KEY"]) {
  assert(safety.includes(hardSecretPattern), `Missing hard secret scanner coverage: ${hardSecretPattern}`);
}
assert(!safety.includes("isAdmin") && !safety.includes("adminDirectPublish"), "Commune secret scanner must not implement an admin bypass.");
assert(accountApi.includes("if (scan.blocked) return { ok: false, message: \"Official Update blocked") && accountApi.includes("if (!account.userId || !account.isAdmin) return"), "Official Update publishing should stay admin-restricted while still blocking hard secret hits.");

for (const category of ["general", "troubleshooting", "repositories", "living-library", "developer-forge", "marketplace-addons", "field-notes", "announcements", "questions", "safety-and-boundaries"]) {
  assert(safety.includes(`"${category}"`), `Missing fallback category: ${category}`);
  assert(migration.includes(`'${category}'`), `Missing seeded DB category: ${category}`);
}

assert(page.includes("CodeWorkspaceEditor") && page.includes("Inert code snippet"), "Code snippets should render through the inert Coding Cornucopia editor/viewer.");
assert(page.includes("The public website does not execute code."), "Code execution boundary copy missing.");
assert(page.includes("supportsCommuneCodeSnippetFields(form.postType)") && page.includes('postType === "media_garden"'), "Media Garden should opt into the shared optional code snippet fields.");
assert(page.includes("Code language") && page.includes("Code filename") && page.includes("Inert visual code snippet"), "Media Garden code snippet form should include language, filename, and inert visual snippet controls.");
assert(page.includes("visual-snippet.css, shader.glsl"), "Media Garden code filename field should use Media Garden-specific visual-code placeholder copy.");
assert(page.includes("Code snippets in Media Garden are visual/read-only material. They are not executed by the website and are not a trust signal."), "Media Garden visual code safety copy missing.");
assert(page.includes("This Media Garden preview is read-only visual material. No run button, sandbox diagnostics, execution status, proposal flow, or trust label is enabled."), "Media Garden code preview should explicitly exclude sandbox/run controls.");
assert(page.includes("showSandboxCapableCodeFields && <label") && page.includes("Request sandbox review for repository/code metadata"), "Sandbox request checkbox should remain limited to sandbox-capable code contexts.");
assert(page.includes("sandboxCapable && <CodingSandboxRunPanel") && page.includes("isSandboxCapableCodePost(postType)"), "Attached snippets should only render sandbox controls for intended sandbox-capable contexts.");
assert(page.includes("Open Coding Workbench") && page.includes("Run in sandbox"), "Coding Cornucopia should keep existing workbench and sandbox controls.");
assert(page.includes("Governed live chat rooms"), "Governed realtime chat panel missing.");
assert(page.includes("Realtime Commune messages are cloud-hosted public/community data."), "Realtime public/community data warning missing.");
assert(page.includes("no private DMs"), "Realtime no-DM copy missing.");
assert(page.includes("no file uploads"), "Realtime no-file-upload copy missing.");
assert(page.includes("no code execution"), "Realtime no-code-execution copy missing.");
assert(page.includes("Report message"), "Realtime message report UI missing.");
assert(page.includes("Send message"), "Realtime composer send action missing.");
assert(page.includes("Coding Cornucopia Workbench"), "Coding Cornucopia workbench section missing.");
assert(page.includes("Shared code documents, snapshots, diagnostics, and governed sandbox runs"), "Coding Cornucopia workbench heading missing.");
assert(page.includes("Create version snapshot"), "Code review version snapshot action missing.");
assert(page.includes("Line annotations"), "Code review annotation UI missing.");
assert(page.includes("Acquire edit lock"), "Code review edit lock action missing.");
assert(page.includes("Report code document"), "Code review report action missing.");
assert(page.includes("Create Commune code post from this document"), "Code review Commune post linkage missing.");
assert(page.includes("Run snapshot in sandbox"), "Coding Cornucopia snapshot sandbox run action missing.");
assert(page.includes('runLabel="Run in sandbox"'), "Published attached snippets should expose a Run in sandbox action.");
assert(page.includes('snapshotId={snippet.accepted_revision_id ?? snippet.id}'), "Attached snippets should run the explicit published or attached revision snapshot.");
assert(page.includes("currentSnapshotRunLabel(publishedSnapshot)"), "Workbench published/attached snapshot should expose a governed sandbox run action.");
assert(page.includes('"Base snapshot at proposal submission"') && !page.includes('selectedProposal.base_snapshot_label ??'), "Historical proposal comparisons must use truthful submission-time base wording without rendering legacy stored labels.");
assert(accountApi.includes("loadCommunePostPublicationState") && accountApi.includes('select("id,status,visibility,visibility_state,hidden_at,removed_at,archived_at")') && accountApi.includes("isActivePublicCommunePost(data"), "Workbench publication wording must come from a narrow read-only projection evaluated by the existing active-public-post rule.");
assert(page.includes("loadedParentPublication?.postId === activeSnippet.post_id") && page.includes("parentPublicationState !== \"published\""), "Proposal workbench should fail closed to attached wording and disallow submission when the parent is not verified published and public.");
assert(page.includes('runLabel="Run proposed revision in sandbox"'), "Proposal snapshots should expose a governed sandbox run action.");
assert(page.includes('runLabel={isTroubleshootingWorkbench ? "Run proposed fix in sandbox" : "Run proposed revision in sandbox"}'), "Troubleshooting Grove proposed fixes should reuse sandbox runs with troubleshooting-specific copy.");
assert(page.includes("publishedSnapshotSandboxInput(publishedSnapshot)") && page.includes("proposalDraftSandboxInput(publishedSnapshot, activeDraft)"), "Workbench sandbox actions must be built from explicit independent published and proposal-draft inputs.");
assert(page.includes('update the {publishedSnapshot.parentPublicationState === "published" ? "published" : "attached"} code'), "Proposal draft sandbox run copy must keep run separate from submit/approval without falsely calling nonpublic attached code public.");
assert(sandboxClient.includes('fetcher("/api/sandbox/run"') && sandboxClient.includes('"authorization": `Bearer ${accessToken}`'), "Coding Cornucopia must use only the authenticated same-origin sandbox proxy.");
assert(sandboxClient.includes("new AbortController()") && sandboxClient.includes("signal: controller.signal"), "Browser sandbox requests must have an explicit abort timeout.");
assert(!sandboxClient.includes("VITE_CODING_SANDBOX_ENDPOINT"), "The removed direct sandbox endpoint must not return to browser code.");
assert(sandboxCreditsClient.includes('fetch("/api/sandbox/credits"') && sandboxCreditsClient.includes('authorization: `Bearer ${accessToken}`') && sandboxCreditsClient.includes('credentials: "same-origin"') && sandboxCreditsClient.includes('cache: "no-store"'), "Sandbox credit display must use only the authenticated, no-store, same-origin summary endpoint.");
assert(sandboxCreditsClient.includes("new AbortController()") && sandboxCreditsClient.includes("15_000") && sandboxCreditsClient.includes("clearTimeout(timeout)"), "Sandbox credit summary requests must retain the bounded 15-second timeout and cleanup.");
assert(sandboxCreditsClient.includes("MAX_RESPONSE_BYTES") && sandboxCreditsClient.includes("content-length") && sandboxCreditsClient.includes("TextEncoder().encode(text).byteLength"), "Sandbox credit summary parsing must bound both declared and actual response sizes.");
assert(sandboxCreditsClient.includes("envelope?.ok !== true") && sandboxCreditsClient.includes("parseSummary(envelope.summary)"), "Sandbox credit client must require the canonical ok/summary response envelope.");
assert(sandboxCreditsClient.includes("CACHE_MILLISECONDS = 30_000") && sandboxCreditsClient.includes("inFlight?.token === accessToken") && sandboxCreditsClient.includes("cache?.token === accessToken"), "Sandbox credit summaries should be briefly cached and in-flight deduplicated across repeated Commune panels.");
const sandboxCreditSummaryFixture = {
  available: true,
  mode: "test",
  display_enabled: false,
  enforcement_enabled: false,
  test_mode: true,
  unit_scale: 100,
  balance_units: 250,
  reserved_units: 50,
  available_units: 200,
  available_credits: 2,
  purchased_credits: 0,
  sponsored_credits: 0,
  waived_credits: 0,
  operator_granted_credits: 2,
  active_rate: { rate_key: "sandbox_test_v1", base_units: 1, input_kib_units: 10, output_kib_units: 1, cpu_second_units: 1, memory_gib_second_units: 5, maximum_run_units: 100, approved_for_live_use: false },
  source_categories: [{ category: "starter", available_units: 200 }],
  active_reservations: [{ run_id: "00000000-0000-4000-8000-000000000001", reserved_units: 50, expires_at: "2026-07-16T00:00:00Z" }],
  recent_receipts: [{ id: "00000000-0000-4000-8000-000000000002", entry_type: "reserve", units_delta: -50, source_category: "starter", run_id: "00000000-0000-4000-8000-000000000001", created_at: "2026-07-16T00:00:00Z" }],
  warnings: ["Credits never change safety limits, network policy, reviewer status, or governance authority."]
};
for (const key of Object.keys(sandboxCreditSummaryFixture)) {
  assert(sandboxCreditsClient.includes(`row.${key}`), `Sandbox credit client is missing the exact database summary key: ${key}`);
}
for (const key of Object.keys(sandboxCreditSummaryFixture.active_rate)) {
  assert(sandboxCreditsClient.includes(`row.${key}`), `Sandbox credit rate parser is missing the exact database key: ${key}`);
}
for (const category of ["starter", "recurring_support", "purchased", "sponsored", "waiver", "waived", "operational", "operator", "test", "sandbox_run", "refund", "dispute"]) {
  assert(sandboxCreditsClient.includes(`"${category}"`), `Sandbox credit client is missing a repository-declared source category: ${category}`);
}
for (const entryType of ["grant", "reserve", "consume", "release", "expire", "refund_adjustment", "dispute_hold", "admin_correction", "compensating_credit", "compensating_debit"]) {
  assert(sandboxCreditsClient.includes(`"${entryType}"`), `Sandbox credit client is missing a repository-declared receipt type: ${entryType}`);
}
assert(page.includes("Private sandbox service credits") && page.includes("creditSummary?.displayEnabled"), "Commune sandbox panels should render the authenticated private summary only when its display flag is enabled.");
assert(page.includes("Credit enforcement is off") && page.includes("Existing free operational sandbox behavior remains available"), "Sandbox credit display must preserve and explain enforcement-off/free behavior.");
assert(page.includes("Maximum per run") && page.includes("Conservative full-limit estimate") && page.includes("Low balance for a full-limit run."), "Sandbox credit display should explain the provisional maximum, conservative estimate, and low-balance state.");
assert(page.includes("Latest matched run receipts") && page.includes("receipt.runId === result.runId") && page.includes("No charge or release is being claimed by this panel."), "Sandbox credit receipts must be shown only when safely matched to the latest run id, without inventing a charge or release.");
assert(page.includes('to="/support"') && page.includes("No automatic purchase or charge will occur") && page.includes("never starts an automatic sandbox-credit purchase"), "Low credit balance must offer only optional support information and must never imply an automatic purchase.");
assert(page.includes("Credits never enable network access, secrets, package installation, host files, private Elysia context, approval, or trust."), "Sandbox credit display must preserve the execution, privacy, and authority boundary.");
const sandboxPanelStart = page.indexOf("function CodingSandboxRunPanel");
const sandboxDisabledStart = page.indexOf("const disabledReason", sandboxPanelStart);
const sandboxRunStart = page.indexOf("async function runSnapshot", sandboxDisabledStart);
const sandboxRunEligibility = page.slice(sandboxDisabledStart, sandboxRunStart);
assert(sandboxRunEligibility.includes("const canRun = !disabledReason") && !sandboxRunEligibility.includes("creditSummary"), "Client sandbox execution eligibility must remain independent from the informational credit balance.");
assert(page.includes("if (runResult.runId) void refreshCreditSummary(true)"), "A completed sandbox run should refresh its private credit summary so a safely matched receipt can appear.");
assert(styles.includes(".coding-sandbox-credit-summary") && styles.includes(".coding-sandbox-credit-summary--low") && styles.includes(".sandbox-credit-source-list") && styles.includes(".sandbox-credit-low-balance"), "Commune sandbox credit summary and low-balance styles are missing.");
assert(page.includes("No terminal") && page.includes("No package install"), "Coding Cornucopia must preserve no-terminal/no-package-install boundary copy.");
assert(!page.includes("dangerouslySetInnerHTML"), "Commune page must not render chat/code with dangerouslySetInnerHTML.");
assert(page.includes("Canonical account-backed paths"), "Commune canonical table path status copy missing.");
assert(page.includes("Report comment"), "Commune comment report action missing.");
assert(page.includes("commune-reply-thread"), "Commune reply thread UI missing.");
assert(page.includes("Reply to this comment"), "Commune reply composer missing.");
assert(page.includes("parentCommentId"), "Commune replies should submit parent_comment_id.");
assert(page.includes("function ReactionBar"), "Commune reaction/signal UI component missing.");
assert(page.includes("Helpful") && page.includes("Needs caution") && page.includes("Saving..."), "Commune helpful/caution signal buttons missing.");
assert(page.includes("Community signal, not verification."), "Commune signal honesty copy missing.");
assert(page.includes("Ratings do not replace reports or moderation."), "Commune ratings-vs-reports copy missing.");
assert(page.includes("commentStatus") && page.includes("Submitting comment..."), "Commune comment submit local status/loading state missing.");
assert(page.includes("commentSubmitting") && page.includes("disabled={commentSubmitting}"), "Commune comment submit should disable while submitting.");
assert(page.includes("setComment(\"\")") && page.includes("if (result.ok)"), "Commune comment text should only clear after successful submit.");
assert(page.includes("ensureCommuneThreadForPost(post)"), "Commune post detail should repair or clearly fail missing discussion threads.");
assert(page.includes("This published post is missing its discussion thread."), "Missing thread warning should be visible near the comment form.");
assert(page.includes("replyStatuses") && page.includes("Submitting reply..."), "Commune replies should have local feedback/loading state.");
assert(page.includes("function AdminContentControls"), "Commune admin content controls missing.");
assert(page.includes("Flag for removal"), "Commune admin flag-for-removal action missing.");
assert(page.includes("Hide from public"), "Commune admin hide action missing.");
assert(page.includes("Yes, delete/remove"), "Commune destructive delete confirmation missing.");
assert(page.includes("No, keep it"), "Commune destructive delete cancel action missing.");
assert(accountApi.includes("hasThreadParticipationApproval"), "Commune first-comment participation approval check missing.");
assert(accountApi.includes("SubmitCommentStatus"), "Commune comment submit should return typed status values.");
assert(accountApi.includes("ensureCommuneThreadForPost"), "Commune thread ensure/repair helper missing.");
assert(accountApi.includes("directPublish = approvedParticipant"), "Approved participants/admins should use the direct-publish comment path.");
assert(accountApi.includes('status: directPublish ? "published" : "pending_review"'), "Direct-published comments should insert as published instead of pending-then-update.");
assert(accountApi.includes("createReviewHistoryItem"), "Direct-published comments should create History/All review records.");
assert(accountApi.includes("approved_participant_comment_direct_published"), "Approved participant comments should be recorded in history.");
assert(accountApi.includes("approved_post_author"), "Approved post authors should get thread participant approval repair.");
assert(accountApi.includes("commune_thread_participant_approvals"), "Commune participant approval table usage missing.");
assert(accountApi.includes("First contribution to this post/thread submitted for moderation"), "Commune first-comment moderation copy missing.");
assert(accountApi.includes("if (!review.ok)"), "Commune first-comment review item creation result must be checked.");
assert(accountApi.includes("could not enter Admin review yet"), "Commune review routing failure should be visible.");
assert(accountApi.includes("2026_06_22_commune_comments_schema_drift_repair.sql"), "Commune comment schema drift errors should name the repair migration.");
assert(accountApi.includes("2026_06_22_commune_comment_notification_dependency_repair.sql"), "Commune published-comment notification dependency errors should name the repair migration.");
assert(accountApi.includes("adminDirectPublish = account.isAdmin"), "Admin Commune posts should bypass self-review and publish directly.");
assert(accountApi.includes("Official Updates are restricted to authorized administrators"), "Official Update backend/client path should require administrator authority, not broad moderator self-assignment.");
assert(accountApi.includes("submitOfficialUpdate") && accountApi.includes('post_type: "official_update"') && accountApi.includes("createOfficialUpdateEvent"), "Official Update should create a published Commune post plus structured audit-aware metadata.");
assert(accountApi.includes("updateOfficialUpdateMetadata") && accountApi.includes("commentsEnabled") && accountApi.includes("comments disabled by administrator"), "Official Update metadata helper should support lifecycle and comment lock updates.");
assert(accountApi.includes("createOfficialCodeSnippet") && accountApi.includes("updateOfficialCodeSnippet") && accountApi.includes("Official code snippet updated."), "Official Update official code helpers should be admin-only and correction-aware.");
assert(accountApi.includes("loadOfficialUpdateForPost") && accountApi.includes("loadOfficialCodeSnippetsForPosts"), "Official Update post detail should load structured metadata and read-only official code snippets.");
assert(page.includes("OfficialUpdateDetail") && page.includes("Brand-authoritative public record") && page.includes("Structured official metadata"), "Official Update public post detail should render structured official metadata.");
assert(page.includes("OfficialCodeSnippets") && page.includes("Copy official code") && page.includes("No Coding Workbench, no sandbox run, no proposal flow"), "Official Update code snippets should render read-only with no workbench/sandbox/proposals.");
assert(page.includes("OfficialUpdateAdminPanel") && page.includes("Mark corrected") && page.includes("Retract") && page.includes("Archive") && page.includes("Lock comments"), "Official Update admin panel should expose correction/retraction/archive/comment-lock controls.");
assert(!page.includes("Run official code in sandbox") && !page.includes("Propose official edit"), "Official Update must not expose public sandbox or proposal controls for official code.");
assert(officialUpdateMigration.includes("commune_official_updates") && officialUpdateMigration.includes("commune_official_update_code_snippets") && officialUpdateMigration.includes("commune_official_update_events"), "Official Update structured migration missing metadata/code/events tables.");
assert(officialUpdateMigration.includes("admins manage official update metadata") && officialUpdateMigration.includes("public.current_user_is_admin()") && officialUpdateMigration.includes("post_type = 'official_update'"), "Official Update migration should enforce admin-only metadata writes and public reads through linked official posts.");
assert(officialUpdateMigration.includes("users create own commune comments with thread approval") && officialUpdateMigration.includes("comments_enabled = false"), "Official Update migration should enforce comment lock through Commune comment RLS.");
assert(officialUpdateMigration.includes("read-only official code") && officialUpdateMigration.includes("No public workbench, sandbox run, proposal flow"), "Official Update migration comments should preserve read-only official code boundary.");
assert(officialUpdatePolicyDoc.includes("Only authorized administrators") && officialUpdatePolicyDoc.includes("Official code examples are public text only"), "Official Update policy doc missing admin-only/read-only code doctrine.");
assert(officialUpdateBoundaryDoc.includes("must not perform") && officialUpdateBoundaryDoc.includes("Public code workbench editing") && officialUpdateBoundaryDoc.includes("Sandbox execution from public Official Update code"), "Official Update security boundary doc missing no-workbench/no-sandbox prohibitions.");
assert(officialUpdateContractDoc.includes("submitOfficialUpdate") && officialUpdateContractDoc.includes("commune_official_updates") && officialUpdateContractDoc.includes("Signal Console"), "Official Update API contract doc missing helper/table/signal contract.");
assert(troubleshootingWorkflowMigration.includes("commune_troubleshooting_posts") && troubleshootingWorkflowMigration.includes("issue_type") && troubleshootingWorkflowMigration.includes("accepted_proposal_id"), "Troubleshooting Grove structured workflow migration missing sidecar table or accepted fix fields.");
assert(troubleshootingWorkflowMigration.includes("public can read published troubleshooting metadata") && troubleshootingWorkflowMigration.includes("authors update troubleshooting status and resolution") && troubleshootingWorkflowMigration.includes("reviewers manage troubleshooting metadata"), "Troubleshooting Grove migration should enforce public/author/reviewer RLS boundaries.");
assert(troubleshootingWorkflowMigration.includes("Troubleshooting Grove proposed fix") && troubleshootingWorkflowMigration.includes("/commune/troubleshooting-grove/review") && troubleshootingWorkflowMigration.includes("v_review_path || '?proposal='"), "Troubleshooting Grove migration should make shared proposal notifications room-aware.");
assert(troubleshootingWorkflowMigration.includes("troubleshooting_status = 'resolved'") && troubleshootingWorkflowMigration.includes("accepted_resolution_kind = 'proposal'"), "Troubleshooting Grove accepted fixes should update structured resolution/status fields.");
assert(troubleshootingPolicyDoc.includes("bug reports") && troubleshootingPolicyDoc.includes("accepted fix/workaround summary") && troubleshootingPolicyDoc.includes("Original authors control accepted fixes"), "Troubleshooting Grove policy doc missing support identity or author-control doctrine.");
assert(troubleshootingBoundaryDoc.includes("no browser/frontend execution") && troubleshootingBoundaryDoc.includes("no Supabase/Postgres execution") && troubleshootingBoundaryDoc.includes("no Local Elysia execution"), "Troubleshooting Grove security boundary doc missing execution prohibitions.");
assert(troubleshootingBoundaryDoc.includes("sandbox success is evidence only") || troubleshootingBoundaryDoc.includes("Sandbox success is evidence only"), "Troubleshooting Grove security boundary doc should preserve sandbox-is-not-trust doctrine.");
assert(troubleshootingContractDoc.includes("commune_troubleshooting_posts") && troubleshootingContractDoc.includes("commune_code_revision_proposals") && troubleshootingContractDoc.includes("Signal Console"), "Troubleshooting Grove API contract doc missing structured row/proposal/signal contract.");
assert(accountApi.includes("export async function submitResearchNotesPost") && accountApi.includes("commune_research_notes") && accountApi.includes('post_type: "research_note"'), "Research Notes API should create a normal Commune post plus structured sidecar metadata.");
assert(accountApi.includes("loadResearchNotesForPosts") && accountApi.includes("updateResearchNotesReviewStatus") && accountNotificationProducerMigration.includes("commune.research_note.status_changed"), "Research Notes API should load sidecar metadata while the authoritative source transition produces review-status events.");
assert(accountApi.includes("no_sensitive_locations") && accountApi.includes("living_library_link_metadata_only"), "Research Notes safety acknowledgements should preserve sensitive-location and Living Library metadata boundaries.");
assert(page.includes("ResearchNotesDetail") && page.includes("Evidence-aware fields") && page.includes("Research Notes boundary"), "Research Notes public post detail should render structured evidence-aware metadata.");
const researchDetailSource = page.slice(page.indexOf("function ResearchNotesDetail"), page.indexOf("function RepositoryShowcaseDetail"));
const researchCompactFieldsSource = researchDetailSource.slice(researchDetailSource.indexOf("const fields: RoomNativeField[]"), researchDetailSource.indexOf("].map"));
assert(!researchCompactFieldsSource.includes('"Context / discussion"') && researchCompactFieldsSource.includes('"Uncertainty"') && researchCompactFieldsSource.includes('"Citation notes"'), "Context / discussion must stay outside the compact Research Notes metadata grid while short evidence fields remain.");
assert(page.includes("normalizeResearchDiscussionForComparison") && page.includes('.replace(/\\r\\n?/g, "\\n").replace(/\\s+/g, " ").trim()'), "Research Notes duplicate comparison should conservatively normalize line endings and whitespace.");
assert(researchDetailSource.includes("isRepeatedResearchDiscussion(contextDiscussion, post.body, bodyMarkdownForPost(post)) ? \"\" : contextDiscussion"), "Research Notes should suppress context only when it exactly repeats stored or displayed body text after normalization.");
assert(researchDetailSource.includes('className="commune-research-discussion"') && researchDetailSource.includes('<CommunePostBody body={distinctContextDiscussion} />'), "Distinct Research Notes context should render once through the safe Markdown renderer in its own full-width section.");
const researchDiscussionCss = styles.match(/\.commune-research-discussion\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert(researchDiscussionCss.includes("grid-template-columns: minmax(0, 1fr)") && researchDiscussionCss.includes("width: 100%") && !/(?:^|\s)(?:height|max-height|overflow)\s*:/.test(researchDiscussionCss), "Long distinct Research Notes context should use natural-height full-width vertical layout without truncation or internal scrolling.");
assert(styles.includes(".commune-research-native-details .commune-room-native-grid") && styles.includes("align-items: start") && styles.includes(".commune-research-native-details .commune-room-native-field") && styles.includes("align-self: start"), "Compact Research Notes cards should not stretch to inherit a neighboring card's height.");
assert(page.includes("else nodes.push(<strong") && page.includes("match[3]"), "Safe Commune Markdown should render bold labels without showing literal double asterisks.");
assert(page.includes("ResearchNotesReviewControls") && page.includes("needs_citation") && page.includes("overclaiming_evidence"), "Research Notes detail should expose reviewer-controlled citation/source/overclaiming states.");
assert(page.includes("researchSearchValues") && page.includes("researchByPostId") && page.includes("evidence_strength"), "Research Notes feed/search should include structured metadata values.");
assert(researchNotesWorkflowMigration.includes("commune_research_notes") && researchNotesWorkflowMigration.includes("research_question") && researchNotesWorkflowMigration.includes("living_library_source_link"), "Research Notes structured workflow migration missing sidecar table or source-link fields.");
assert(researchNotesWorkflowMigration.includes("public reads published research notes metadata") && researchNotesWorkflowMigration.includes("authors maintain own unpublished research notes metadata") && researchNotesWorkflowMigration.includes("reviewers manage research notes metadata"), "Research Notes migration should enforce public/author/reviewer RLS boundaries.");
assert(researchNotesWorkflowMigration.includes("needs_citation") && researchNotesWorkflowMigration.includes("needs_clarification") && researchNotesWorkflowMigration.includes("source_issue") && researchNotesWorkflowMigration.includes("overclaiming_evidence"), "Research Notes migration should define research-specific review states.");
assert(researchNotesWorkflowMigration.includes("'Research Notes'") && researchNotesWorkflowMigration.includes("'research-notes'") && researchNotesWorkflowMigration.includes("'research_note'"), "Research Notes migration should seed plural public room name while preserving internal research_note identity.");
assert(researchNotesPolicyDoc.includes("Research Notes asks") && researchNotesPolicyDoc.includes("evidence") && researchNotesPolicyDoc.includes("interpretation") && researchNotesPolicyDoc.includes("uncertainty"), "Research Notes policy doc missing evidence/interpretation/uncertainty doctrine.");
assert(researchNotesPolicyDoc.includes("Living Library source link is metadata") && researchNotesPolicyDoc.includes("not an Official Update"), "Research Notes policy doc missing Living Library/Official Update boundaries.");
assert(researchNotesBoundaryDoc.includes("sensitive ecological location data") && researchNotesBoundaryDoc.includes("private research participant data") && researchNotesBoundaryDoc.includes("hidden reviewer notes"), "Research Notes security boundary doc missing private/sensitive data prohibitions.");
assert(researchNotesContractDoc.includes("submitResearchNotesPost") && researchNotesContractDoc.includes("commune_research_notes") && researchNotesContractDoc.includes("Signal Console"), "Research Notes API contract doc missing helper/table/signal contract.");
assert(accountApi.includes('post_type: "repository_showcase"'), "Repository Showcase should create/link a normal Commune post.");
assert(accountApi.includes("Repository showcase submitted as a normal Commune post for moderation"), "Repository Showcase should enter the normal Commune moderation flow.");
assert(accountApi.includes("repository_metadata_only"), "Repository Showcase post safety acknowledgements should preserve metadata-only boundaries.");
assert(accountApi.includes("publicRepositoryUrlOrNull") && accountApi.includes("Repository Showcase posts must use a public HTTP(S) repository URL") && accountApi.includes("Localhost/private repository URLs are not accepted"), "Repository Showcase normal submissions should require public HTTP(S) repository URLs and reject localhost/private URLs.");
assert(accountApi.includes("adminGuidancePost?: boolean") && accountApi.includes("Repository Showcase guidance/template posts are admin-only") && accountApi.includes("Normal users must submit a public repository URL"), "Repository Showcase admin guidance mode should be explicit and admin-only.");
assert(accountApi.includes("Admin guidance posts cannot request selected-artifact sandbox review") && accountApi.includes("repository_sidecar_created: false") && accountApi.includes("No repository sidecar was created"), "Repository Showcase guidance posts should skip repository sidecar storage and selected-artifact sandbox review.");
assert(app.includes('path="commune/repository-showcase/sandbox-request"'), "Repository Showcase selected-artifact sandbox request route missing.");
assert(page.includes("Import public GitHub metadata") && page.includes("Local showcase manifest import/export") && page.includes("Preview export JSON in import box"), "Repository Showcase should support public GitHub metadata import and local manifest import/export UI.");
for (const composerFeature of ["Showcase title", "Repo URL", "Provider", "Branch", "Commit", "License", "Manifest status", "Elysia compatibility", "Short description", "README preview", "Submit showcase for review", "Save showcase draft locally", "Export Markdown", "Export JSON", "Copy showcase Markdown", "Developer Forge / Marketplace boundary"]) {
  assert(page.includes(composerFeature), `Repository Showcase /new composer feature missing: ${composerFeature}`);
}
assert(page.includes("RepositoryShowcaseDetail") && page.includes("Repository Showcase detail") && page.includes("Repository trust boundary"), "Repository Showcase public post detail should render structured metadata.");
assert(page.includes("Admin room guidance / template post") && page.includes("Publish as Repository Showcase guidance, not a repository listing") && page.includes("Repo URL optional for admin guidance"), "Repository Showcase composer should expose an admin-only guidance/template toggle near the repository URL.");
assert(page.includes("Repository Showcase guidance boundary") && page.includes("This is admin-authored Repository Showcase guidance") && page.includes("No repository metadata sidecar is attached to this guidance post"), "Repository Showcase guidance posts should render with clear guidance labeling instead of broken repository metadata.");
assert(page.includes("RepositoryShowcaseSandboxRequestPanel") && page.includes("Review a selected artifact, not the whole repository") && page.includes('sourceType="repository_showcase_artifact"'), "Repository Showcase selected-artifact sandbox review route/panel missing.");
assert(page.includes("Developer Forge and Marketplace approval remain separate") && page.includes("The site did not clone, build, install, or run"), "Repository Showcase UI must preserve metadata-only and Marketplace boundary copy.");
for (const column of ["provider", "default_branch", "commit_sha", "manifest_status", "elysia_compatibility", "readme_preview", "file_tree_preview", "risk_flags", "sandbox_review_request_id", "imported_metadata", "redaction_notes"]) {
  assert(accountApi.includes(column), "Repository Showcase structured submit/load field missing: " + column);
}
assert(accountApi.includes('ownerRow.post_type === "repository_showcase"') && accountApi.includes('(item.kind === "repo" || item.kind === "iteration") && postId') && accountApi.includes('item.kind === "repo" ? "repository_showcase" : "elysia_iteration_showcase"'), "Repository Showcase and Elysia Iteration Showcase moderation should keep their existing linked post/sidecar behavior.");
assert(repositoryMetadataMigration.includes("public reads published repository showcase metadata") && repositoryMetadataMigration.includes("readme_preview") && repositoryMetadataMigration.includes("sandbox_review_request_id"), "Repository Showcase structured metadata migration missing public read policy or structured columns.");
assert(repositoryMetadataMigration.includes("grant select on table public.commune_repository_showcases to anon") && repositoryMetadataMigration.includes("Selected-artifact sandbox review status only"), "Repository Showcase migration should expose only published metadata and preserve selected-artifact boundary.");
assert(repositoryPolicyDoc.includes("Public GitHub import is metadata assistance only") && repositoryPolicyDoc.includes("Local showcase manifest import") && repositoryPolicyDoc.includes("selected-artifact only"), "Repository Showcase policy doc missing import/sandbox boundary.");
assert(repositoryPolicyDoc.includes("Administrators may also publish explicit Repository Showcase guidance/template posts") && repositoryContractDoc.includes("Administrators may publish explicit Repository Showcase guidance/template posts without a repository URL") && repositoryBoundaryDoc.includes("Admin-authored Repository Showcase guidance/template posts are allowed without a repository URL"), "Repository Showcase docs should describe the admin guidance exception without weakening normal listings.");
assert(repositoryBoundaryDoc.includes("no whole-repository clone") && repositoryBoundaryDoc.includes("no shell execution from Repository Showcase"), "Repository Showcase security boundary doc missing clone/shell prohibitions.");
assert(repositoryContractDoc.includes("commune_repository_showcases metadata row") && repositoryContractDoc.includes("Signal Console may show direct commune_repository_showcases activity"), "Repository Showcase API contract doc missing structured row/signal contract.");
assert(app.includes('path="commune/elysia-iteration-showcase/sandbox-request"'), "Elysia Iteration Showcase selected-artifact sandbox request route missing.");
assert(page.includes("Import public GitHub metadata") && page.includes("Local iteration manifest import") && page.includes("Preview export JSON in import box"), "Elysia Iteration Showcase should support public GitHub metadata import and local manifest import/export UI.");
assert(page.includes("ElysiaIterationShowcaseDetail") && page.includes("Elysia Iteration Showcase detail") && page.includes("Progress showcase boundary"), "Elysia Iteration Showcase public post detail should render structured metadata.");
assert(page.includes("ElysiaIterationSandboxRequestPanel") && page.includes("Review one selected artifact from a progress/demo post") && page.includes('sourceType="iteration_showcase_artifact"'), "Elysia Iteration Showcase selected-artifact sandbox review route/panel missing.");
assert(page.includes("Official Update / Forge / Marketplace boundary") && page.includes("Request Elysia Iteration Showcase selected-artifact sandbox review"), "Elysia Iteration Showcase UI must preserve official/update and selected-artifact sandbox copy.");
for (const column of ["iteration_type", "version_build_label", "what_changed", "why_it_matters", "known_limitations", "next_step", "related_repo_url", "commit_sha", "release_tag", "pull_request_url", "testing_status", "compatibility_note", "risk_flags", "sandbox_review_request_id", "imported_metadata", "redaction_notes"]) {
  assert(accountApi.includes(column), "Elysia Iteration Showcase structured submit/load field missing: " + column);
}
assert(accountApi.includes('post_type: "elysia_iteration_showcase"') && accountApi.includes("submitIterationShowcase"), "Elysia Iteration Showcase should create/link a normal Commune post.");
assert(accountApi.includes("requestIterationShowcaseSandboxReview") && accountApi.includes("commune_iteration_showcases"), "Elysia Iteration Showcase selected-artifact sandbox helper missing.");
assert(accountApi.includes('ownerRow.post_type === "elysia_iteration_showcase"') && accountApi.includes('(item.kind === "repo" || item.kind === "iteration") && postId') && accountApi.includes('item.kind === "repo" ? "repository_showcase" : "elysia_iteration_showcase"'), "Elysia Iteration Showcase and Repository Showcase moderation should keep linked post/metadata state consistent.");
assert(iterationMetadataMigration.includes("public reads published iteration showcase metadata") && iterationMetadataMigration.includes("commune_iteration_showcases") && iterationMetadataMigration.includes("sandbox_review_request_id"), "Elysia Iteration Showcase structured metadata migration missing public read policy or structured columns.");
assert(iterationMetadataMigration.includes("grant select on table public.commune_iteration_showcases to anon") && iterationMetadataMigration.includes("Selected-artifact sandbox review status only"), "Elysia Iteration Showcase migration should expose only published metadata and preserve selected-artifact boundary.");
assert(iterationPolicyDoc.includes("public GitHub import") && iterationPolicyDoc.includes("structured metadata") && iterationPolicyDoc.includes("selected-artifact only"), "Elysia Iteration Showcase policy doc missing import/sandbox boundary.");
assert(iterationBoundaryDoc.includes("clone repositories") && iterationBoundaryDoc.includes("run shell commands") && iterationBoundaryDoc.includes("Successful sandbox diagnostics are evidence only"), "Elysia Iteration Showcase security boundary doc missing clone/shell/evidence prohibitions.");
assert(iterationContractDoc.includes("commune_iteration_showcases") && iterationContractDoc.includes("Signal Console also reads direct iteration rows"), "Elysia Iteration Showcase API contract doc missing structured row/signal contract.");
assert(accountApi.includes("review_item_created: false"), "Admin direct Commune publish should record that no self-review item was created.");
assert(accountApi.includes("admin_post_published") && accountApi.includes("admin_comment_published"), "Admin direct Commune actions should remain auditable.");
assert(accountApi.includes("admin_post_direct_published"), "Admin direct Commune room posts should create History/All records.");
assert(accountApi.includes("This room post is blocked by the current database policy"), "Room post RLS failures should not use comment/reply policy copy.");
assert(accountApi.includes("This attachment upload is blocked by the current storage policy"), "Attachment upload RLS failures should mention storage/media policy.");
assert(!accountApi.includes('friendlyError(postError.message, "Community posting backend is not active yet.")'), "Room post insert failures should use specific room-post policy copy.");
assert(accountApi.includes("CommuneMediaAttachment"), "Commune post media attachment type missing.");
assert(accountApi.includes("loadPublishedMediaForPosts"), "Commune post detail loader should fetch published post attachments.");
assert(accountApi.includes('.eq("visibility_state", "published")'), "Commune media loader should only fetch published attachments for public display.");
assert(accountApi.includes("createSignedUrl"), "Commune media loader should resolve signed storage URLs instead of exposing raw storage paths.");
assert(accountApi.includes("publishPostAttachments(postId)"), "Admin direct-published room posts should publish linked attachments.");
assert(reviewClient.includes("publishCommunePostMedia") && reviewClient.includes('visibility_state: "published"'), "Admin review approval should publish linked Commune post media.");
assert(page.includes("commune-media-section") && page.includes("Attached media"), "Commune post detail should render attached media inside the post flow.");
assert(page.includes("Attached to this post by {isOfficialUpdate ? \"Elysia Ecobotics Official\" : authorLink(post.author_username)}"), "Commune post media should attribute attachments to the public post author handle or official brand account.");
const postTagIndex = page.indexOf("<TagChips tags={post.tags}");
const postBodyIndex = page.indexOf("<CommunePostBody body={bodyMarkdown}");
const postMediaIndex = page.indexOf("commune-media-section", postBodyIndex);
const postReactionIndex = page.indexOf("<ReactionBar targetType=\"post\"", postBodyIndex);
const postAdminIndex = page.indexOf("<AdminContentControls targetType=\"post\"", postBodyIndex);
assert(postBodyIndex > -1 && postMediaIndex > postBodyIndex && postMediaIndex < postTagIndex && postTagIndex < postReactionIndex && postReactionIndex < postAdminIndex, "Commune post media should render after body and before tags/reactions/admin moderation.");
assert(page.includes("commune-media-lightbox") && page.includes("Attachment unavailable or still under review."), "Commune post media display should include read-only preview and unavailable copy.");
assert(styles.includes(".commune-media-section") && styles.includes("object-fit: contain"), "Commune media display styling should keep images contained, not cropped.");
assert(page.includes("commune-code-section") && page.includes("Code attached to this post"), "Coding Cornucopia snippets should render as attached post content.");
assert(page.includes("Code attached for troubleshooting") && page.includes("Reproduction snippet"), "Troubleshooting Grove snippets should render as attached reproduction code in the post flow.");
assert(page.includes('postType={post.post_type}'), "Attached code snippets should receive post type context for room-native labels.");
assert(page.includes("Coding Cornucopia snippet") && page.includes("attached by {authorLink(authorUsername)}"), "Coding Cornucopia snippets should carry post-author attachment attribution.");
assert(page.includes('parentIsPublished ? "published" : "attached"'), "Coding Cornucopia snippets should use truthful published/attached snapshot language.");
assert(page.includes("Propose edit") && page.includes("View proposals"), "Coding Cornucopia post snippets should link into author-controlled proposal workflows.");
assert(page.includes("Propose fix") && page.includes("View proposed fixes") && page.includes("/commune/troubleshooting-grove/review"), "Troubleshooting Grove snippets should link into proposed-fix workflows.");
assert(page.includes("function CodeRevisionProposalWorkspace"), "Coding Cornucopia Workbench should include the proposal workspace.");
assert(page.includes("Propose changes without overwriting") && page.includes('? "published" : "attached"'), "Proposal workspace should make the truthful no-overwrite boundary clear.");
assert(page.includes("Propose fixes without overwriting the") && page.includes('? "public" : "attached"'), "Troubleshooting Grove workbench should make the truthful no-overwrite proposed-fix boundary clear.");
assert(page.includes("Submit proposed revision"), "Proposal workspace should let signed-in users submit proposed revisions.");
assert(page.includes("Submit proposed fix"), "Troubleshooting Grove workbench should let signed-in users submit proposed fixes.");
assert(page.indexOf("Run proposed revision in sandbox") < page.indexOf("Submit proposed revision"), "Draft sandbox run should appear before submit in the proposed revision panel.");
assert(page.includes("Accept revision") && page.includes("Reject revision") && page.includes("Ask for changes"), "Original poster approval controls should exist for code revision proposals.");
assert(page.includes("Accept fix") && page.includes("Reject fix"), "Troubleshooting Grove workbench should expose author accept/reject controls for proposed fixes.");
assert(page.includes("Hide unsafe proposal"), "Moderator safety controls should remain distinct from author approval.");
assert(page.includes("Rejected proposals preserve the original") && page.includes('? "published" : "attached"'), "Rejected proposal copy should promise stable published/attached code.");
assert(page.includes("Sandbox success is evidence, not trust"), "Proposal workspace should preserve sandbox-is-not-trust doctrine.");
assert(page.includes("proposalContextActive") && page.includes("General documents are not shown on proposal routes"), "Proposal routes should hide or clearly separate the lower general document workbench.");
assert(styles.includes(".commune-proposal-route-note"), "Proposal route note styling missing.");
assert(codeReviewApi.includes("submitCodeRevisionProposal") && codeReviewApi.includes("decideCodeRevisionProposal") && codeReviewApi.includes("withdrawCodeRevisionProposal"), "Code review API should expose proposal submit/decide/withdraw helpers.");
assert(codeReviewApi.includes("The attached code stays unchanged until the original post author accepts it"), "Proposal submit copy should keep attached code stable until author acceptance without assuming the parent is public.");
assert(accountApi.includes("accepted_version_number"), "Commune code snippet type should preserve accepted revision version metadata.");
assert(codeProposalMigration.includes("commune_code_revision_proposals"), "Author-controlled code revision proposal migration missing.");
assert(codeProposalMigration.includes("submit_commune_code_revision_proposal"), "Proposal submission RPC missing.");
assert(codeProposalMigration.includes("decide_commune_code_revision_proposal"), "Author decision RPC missing.");
assert(codeProposalMigration.includes("Only the original post author can accept, reject, or request changes"), "Migration should enforce original-author approval for code replacement.");
assert(codeProposalMigration.includes("proposal_status in ('draft','submitted','needs_changes','accepted','rejected','withdrawn','hidden_by_moderation')"), "Proposal migration should define full revision status lifecycle.");
assert(codeProposalMigration.includes("accepted_revision_id") && codeProposalMigration.includes("accepted_version_number"), "Accepted revisions should update the public snippet version metadata.");
assert(codeProposalMigration.includes("commune_code_revision_proposed"), "Proposal submission should create a private signal for the original poster.");
assert(codeProposalMigration.includes("public attached code remains unchanged") || codeProposalMigration.includes("public attached code now points"), "Proposal decisions should notify without implying sandbox trust.");
const postCodeIndex = page.indexOf("<AttachedCodeSnippets", postBodyIndex);
assert(postCodeIndex > postMediaIndex && postCodeIndex < postTagIndex && postCodeIndex < postReactionIndex && postCodeIndex < postAdminIndex, "Coding Cornucopia snippets should render after media/body and before tags/reactions/admin moderation.");
assert(!page.includes("Inert public code display"), "Coding Cornucopia snippets should not render in a detached lower post-detail section.");
assert(styles.includes(".commune-code-section") && styles.includes(".commune-code-list"), "Coding Cornucopia attached snippet styling missing.");
assert(accountApi.includes("loadCommuneReactionSummary"), "Commune reaction-count loader missing.");
assert(accountApi.includes("setCommuneReaction"), "Commune reaction setter missing.");
assert(accountApi.includes("clearCommuneReaction"), "Commune reaction removal helper missing.");
assert(accountApi.includes("moderateCommuneContentTarget"), "Commune direct admin content moderation helper missing.");
assert(accountApi.includes('currentSelect = input.targetType === "post" ? "id,status,post_type,visibility,visibility_state,moderation_status"'), "Commune post moderation should not select comment-only post_id/thread_id columns from commune_posts.");
assert(accountApi.includes('update.visibility_state = input.action === "flag" ? "flagged" : input.action === "hide" ? "hidden" : "removed"'), "Commune post moderation should update post visibility_state for admin recovery views.");
assert(accountApi.includes("update.hidden_by = account.userId"), "Commune post/comment moderation should record the admin actor when hiding/removing content.");
assert(accountApi.includes("[\"published\", \"submitted\", \"flagged\"]"), "Commune post moderation should remove linked media from public display when the post is hidden/removed.");
assert(reviewClient.includes("await publishCommunePostMedia(item.source_id);") && reviewClient.includes("restore_to_public"), "Restoring a Commune post should restore linked published media visibility.");
assert(accountApi.includes("flag_for_removal"), "Commune admin flag action should write moderation history.");
assert(accountApi.includes("hide_from_public"), "Commune admin hide action should write moderation history.");
assert(accountApi.includes("soft_delete_from_public"), "Commune admin delete/remove action should write moderation history.");
assert(accountApi.includes("hard_delete: false"), "Commune frontend delete/remove should be honest about soft-removal evidence retention.");
assert(accountApi.includes('rpc("soft_delete_commune_post"') && accountApi.includes("Commune soft-delete cleanup is not available yet. Apply the latest Commune cleanup migration before deleting posts."), "Commune post delete should route through the authoritative soft-delete cleanup RPC and expose a migration-drift error.");
assert(accountApi.includes('input.targetType === "post" && input.action === "delete"') && accountApi.includes('target_post_id: input.targetId'), "Community Voting Room parent posts should use the same post delete cleanup RPC as other Commune posts.");
assert(communityVoteSoftDeleteRepairMigration.includes("soft_delete_commune_post(target_post_id uuid, moderation_note text default null)") && accountApi.includes("target_post_id: input.targetId") && accountApi.includes("moderation_note: input.reason || null") && !accountApi.includes("p_target_post_id"), "Commune post delete RPC arguments should exactly match the repaired SQL signature without overload fallbacks.");
assert(accountApi.includes('error.code === "42703"') && accountApi.includes("Database cleanup failed because the deployed cleanup function references an unavailable column. Apply the latest cleanup migration.") && page.includes("setStatus(visibleMessage)") && page.includes('<p className="message">{status}</p>'), "Commune admin delete errors should surface a safe actionable 42703 message in the Admin Moderation panel.");
assert(communityVoteSoftDeleteRepairMigration.includes("create or replace function public.soft_delete_commune_post") && communityVoteSoftDeleteRepairMigration.includes("security definer") && communityVoteSoftDeleteRepairMigration.includes("set search_path = public, auth, pg_temp"), "The additive Commune soft-delete repair should define a safe authoritative RPC.");
const canonicalRepositoryColumns = supabaseSchema.match(/create table if not exists public\.commune_repository_showcases \(([\s\S]*?)\n\);/)?.[1] ?? "";
const brokenRepositoryCleanup = softDeleteCleanupMigration.match(/update public\.commune_repository_showcases([\s\S]*?)get diagnostics v_repository_rows/)?.[1] ?? "";
const repairedRepositoryCleanup = communityVoteSoftDeleteRepairMigration.match(/update public\.commune_repository_showcases([\s\S]*?)get diagnostics v_repository_rows/)?.[1] ?? "";
assert(!canonicalRepositoryColumns.includes("sandbox_review_status") && brokenRepositoryCleanup.includes("sandbox_review_status"), "The 42703 regression fixture should prove the old RPC referenced a non-canonical commune_repository_showcases column.");
assert(repairedRepositoryCleanup.includes("status = 'rejected'") && repairedRepositoryCleanup.includes("updated_at = v_now") && !repairedRepositoryCleanup.includes("sandbox_review_status"), "The repaired repository-sidecar branch should use only canonical columns.");
for (const dependency of ["user_saved_commune_posts", "commune_saved_posts", "user_notifications", "user_followed_commune_threads", "commune_content_reactions", "commune_code_revision_proposals"]) {
  assert(communityVoteSoftDeleteRepairMigration.includes(dependency), `Commune soft-delete repair migration missing user-facing dependent cleanup for ${dependency}.`);
}
for (const sidecar of ["commune_troubleshooting_posts", "commune_research_notes", "commune_job_posts", "commune_repository_showcases", "commune_iteration_showcases", "commune_official_updates", "commune_vote_posts"]) {
  assert(communityVoteSoftDeleteRepairMigration.includes(sidecar) && commonsApi.includes(sidecar), `Commune soft-delete repair and Signal Console filtering should cover sidecar table: ${sidecar}.`);
}
assert(communityVoteSoftDeleteRepairMigration.includes("if v_post_type = 'community_vote'") && communityVoteSoftDeleteRepairMigration.includes("update public.commune_vote_posts") && communityVoteSoftDeleteRepairMigration.includes("vote_rows_archived"), "Community Voting delete should archive its sidecar through a post-type-scoped cleanup branch.");
assert(communityVoteSoftDeleteRepairMigration.includes("audit_preserved") && communityVoteSoftDeleteRepairMigration.includes("commune_reports") && communityVoteSoftDeleteRepairMigration.includes("commune_moderation_events") && communityVoteSoftDeleteRepairMigration.includes("commune_vote_options") && communityVoteSoftDeleteRepairMigration.includes("commune_vote_ballots") && communityVoteSoftDeleteRepairMigration.includes("commune_vote_events"), "Commune soft-delete cleanup should preserve audit/moderation/governance history explicitly.");
assert(accountApi.includes("isActivePublicCommunePost") && accountApi.includes("activePosts") && accountApi.includes("hidden_at,removed_at,archived_at") && accountApi.includes("activeParentPostIds.has(row.post_id)"), "Commune public loaders should filter deleted Community Voting Room parents before loading/rendering vote sidecars.");
assert(page.includes("locallyDeletedPostId === postId ? null : state.posts[0]") && page.includes("onDeleted={handlePostDeleted}") && page.includes('navigate("/commune", { replace: true })'), "Successful Admin Moderation delete should gate CommunityVoteDetail immediately and navigate away from stale detail state.");
assert(accountApi.includes("updateCommunityVoteLifecycle") && accountApi.includes('archive: "archived"') && accountApi.includes('rpc("soft_delete_commune_post"'), "Community Voting Room lifecycle archive must stay distinct from Admin Moderation delete cleanup.");
assert(communityVoteDeleteFilterMigration.includes("public reads published public vote metadata") && communityVoteDeleteFilterMigration.includes("commune_vote_ballots") && communityVoteDeleteFilterMigration.includes("commune_vote_events") && communityVoteDeleteFilterMigration.includes("removed_at is null"), "Community Voting Room delete hardening migration should parent-filter vote sidecars, ballots, events, and results.");
assert(commonsApi.includes("isActivePublicCommunePost") && commonsApi.includes("loadActivePublicCommunePostMap") && commonsApi.includes("extractCommunePostIdFromActionUrl") && commonsApi.includes("filterNotificationsByActiveCommunePost"), "Commons Circle loaders should filter Commune ghost references through active public parent posts.");
assert(commonsApi.includes("visibleSavedCommuneRows") && commonsApi.includes("visibleNotificationRows") && commonsApi.includes("filterFollowedThreadsByActiveCommunePost"), "Homebase/Saved Shelves should filter saved posts, notifications, and followed threads tied to deleted Commune posts.");
assert(commonsApi.includes("visibleMyCommunityVoteRows") && commonsApi.includes("visibleReviewCommunityVoteRows") && commonsApi.includes("officialPostById") && commonsApi.includes("decodePublicCommuneComments"), "Signal Console and bounded public-profile Commune contribution surfaces should filter sidecars/comments through active parent posts.");
assert(accountApi.includes('rpc(\n    "resolve_public_commune_attributions"') || attributionApi.includes('"resolve_public_commune_attributions"'), "Commune public authored content must hydrate through the canonical attribution RPC.");
assert(!accountApi.includes('select("id,user_id,author_username,post_type') && !accountApi.includes('select("id,thread_id,post_id,parent_comment_id,user_id,author_username'), "Public post/comment reads must not consume snapshot handles or account UUIDs.");
for (const selectName of [
  "repositoryShowcaseSelect",
  "repositoryShowcaseFallbackSelect",
  "troubleshootingSelect",
  "jobPostSelect",
  "researchNotesSelect",
  "iterationShowcaseSelect",
  "iterationShowcaseFallbackSelect",
  "officialUpdateSelect",
  "officialCodeSelect",
  "communityVotePostSelect",
  "communityVoteEventSelect"
]) {
  const publicSelect = accountApi.match(new RegExp(`const ${selectName} = "([^"]+)"`))?.[1] ?? "";
  assert(publicSelect, `Missing public structured Commune select: ${selectName}.`);
  for (const forbiddenField of [
    "user_id",
    "author_user_id",
    "accepted_by",
    "reviewed_by",
    "admin_user_id",
    "edited_by",
    "created_by",
    "actor_user_id",
    "private_application_note"
  ]) {
    assert(!publicSelect.split(",").includes(forbiddenField), `${selectName} exposes private attribution field ${forbiddenField}.`);
  }
}
assert(accountApi.includes('.select("id,post_id,language,file_name,code_text,secret_scan_status,sandbox_warning_acknowledged,accepted_revision_id,accepted_version_number,accepted_revision_summary,accepted_at,created_at,updated_at")'), "Public code snippets must use an explicit projection without author/proposer account UUIDs.");
assert(realtimeApi.includes("loadPublicCommuneAttributions") && realtimeApi.includes('.select("id,room_id,room_slug,body,body_plain,visibility_state,report_count,created_at,edited_at,flagged_at,hidden_at,removed_at")'), "Realtime public history must hydrate current canonical attribution without selecting account UUID or snapshot handle.");
for (const marker of [
  "private.community_safe_online_public_profile_cards",
  "public.resolve_public_commune_attributions",
  "commune_attribution_request_too_large",
  "post.revoked_at is null",
  "comment.archived_at is null",
  "room.visibility_state = 'published'",
]) assert(canonicalAttributionMigration.includes(marker), `Canonical Commune attribution migration omits ${marker}.`);
assert(/revoke all privileges on function[\s\S]*resolve_public_commune_attributions\(uuid\[\], uuid\[\], uuid\[\]\)[\s\S]*from public, anon, authenticated, service_role/i.test(canonicalAttributionMigration), "Canonical attribution RPC must remove implicit function execution before narrow grants.");
assert(!/update\s+public\.(commune_posts|commune_comments|commune_realtime_messages)/i.test(canonicalAttributionMigration), "Canonical attribution migration must not rewrite historical authored rows.");
assert(reviewClient.includes('"moderated"') && reviewClient.includes("moderatedContentStates"), "Admin review should include a moderated recovery filter for hidden/removed Commune content.");
assert(reviewClient.includes("enrichCommuneReviewItems"), "Admin review should enrich Commune review items with source moderation state.");
assert(reviewClient.includes("restoreCommuneReviewSubject") && reviewClient.includes("restore_to_public"), "Admin review should support restoring hidden/flagged Commune content.");
assert(reviewClient.includes("review_status_preserved: true"), "Commune restore should preserve approved/rejected review history instead of overwriting it.");
assert(reviewClient.includes("recoverRejectedCommuneReviewSubject") && reviewClient.includes("commune_rejection_reopened"), "Admin review should support reopening rejected Commune content for reconsideration.");
assert(reviewClient.includes("commune_rejected_approved_and_restored") && reviewClient.includes("original_rejection_preserved: true"), "Admin review should support approving/restoring rejected Commune content while preserving rejection history.");
assert(adminPage.includes("Moderated content recovery"), "Admin review moderated recovery view missing.");
assert(adminPage.includes("Review status and moderation state are separate"), "Admin review should explain moderation state separately from review status.");
assert(adminPage.includes("Restore to public") && adminPage.includes("Keep hidden"), "Admin review restore/keep-hidden controls missing.");
assert(adminPage.includes("Rejected recovery is a review reconsideration workflow"), "Admin review rejected recovery copy missing.");
assert(adminPage.includes("Reopen review") && adminPage.includes("Approve and restore") && adminPage.includes("Keep rejected"), "Admin review rejected recovery controls missing.");
assert(page.includes("Admin comments publish directly and remain auditable."), "Admin post detail comment bypass copy missing.");
assert(participantApprovalMigration.includes("commune_thread_participant_approvals"), "Commune participant approval migration missing.");
assert(participantApprovalMigration.includes("thread_id, user_id"), "Commune participant approval should be per thread and user.");
assert(commentDirectPublishMigration.includes("users create own commune comments with thread approval"), "Commune direct-publish comment RLS policy missing.");
assert(commentDirectPublishMigration.includes("post authors create own thread participation approvals"), "Approved post author participation repair policy missing.");
assert(commentDirectPublishMigration.includes("submitters create own direct commune history events"), "Direct-published comments should be allowed to create history events.");
assert(commentDirectPublishMigration.includes("on conflict (thread_id, user_id) do nothing"), "Approved post author participation backfill should avoid duplicate approvals.");
assert(commentDirectPublishMigration.includes("status = 'published'"), "Direct-publish policy should explicitly cover published comments.");
for (const column of ["author_username", "published_at", "updated_at", "hidden_at", "hidden_by", "moderation_reason"]) {
  assert(commentSchemaRepairMigration.includes(`add column if not exists ${column}`), `Commune comments schema repair should add missing column: ${column}`);
}
for (const payloadColumn of ["thread_id", "post_id", "parent_comment_id", "user_id", "author_username", "body", "status", "published_at"]) {
  assert(accountApi.includes(payloadColumn) && communeCommentSchemaCoverage.includes(payloadColumn), `Commune comment insert payload column should be represented in schema/migration coverage: ${payloadColumn}`);
}
for (const indexName of ["commune_comments_post_idx", "commune_comments_thread_status_idx", "commune_comments_parent_idx", "commune_comments_user_status_idx", "commune_comments_published_idx"]) {
  assert(commentSchemaRepairMigration.includes(indexName), `Commune comments schema repair index missing: ${indexName}`);
}
for (const dependency of ["user_notifications", "user_followed_commune_threads", "muted", "notify_commune_published_comment", "commune_notify_published_comment"]) {
  assert(commentNotificationRepairMigration.includes(dependency), `Commune comment notification dependency repair missing: ${dependency}`);
}
assert(commentNotificationRepairMigration.includes("exception when others"), "Published-comment notification trigger should be fail-safe.");
assert(commentNotificationRepairMigration.includes("raise notice 'Commune published-comment notification skipped"), "Notification trigger should skip accessory notification failures without rolling back comments.");
assert(commentNotificationRepairMigration.includes("Comments/replies are core Commune participation. Notifications are accessory."), "Migration should document that notifications cannot break core comments.");
assert(commentNotificationRepairMigration.includes("revoke all on table public.user_notifications from anon"), "Notification repair should keep notifications private from anonymous users.");
assert(roomPostMediaPolicyRepairMigration.includes("admins create direct published commune posts"), "Room post policy repair should allow admin direct-published posts.");
assert(roomPostMediaPolicyRepairMigration.includes("public.current_user_is_admin()"), "Room post direct-publish repair should be admin-scoped.");
assert(roomPostMediaPolicyRepairMigration.includes("status = 'published'") && roomPostMediaPolicyRepairMigration.includes("visibility = 'public'"), "Admin direct-publish repair should target published public posts only.");
assert(roomPostMediaPolicyRepairMigration.includes("'commune-media'"), "Media policy repair should target the explicit Commune media bucket.");
assert(roomPostMediaPolicyRepairMigration.includes("allowed_mime_types"), "Media policy repair should make allowed MIME types explicit.");
assert(roomPostMediaPolicyRepairMigration.includes("users upload own commune media files"), "Media policy repair should keep uploads scoped to the user's own folder.");
assert(roomPostMediaPolicyRepairMigration.includes("bucket_id = 'commune-media'") && roomPostMediaPolicyRepairMigration.includes("storage.foldername(name)"), "Media storage policy should constrain bucket and path ownership.");
assert(!roomPostMediaPolicyRepairMigration.includes("video/mp4"), "Media Garden video support should stay disabled until explicitly implemented.");
assert(publishedMediaDisplayPolicyMigration.includes("public reads published commune media files"), "Published Commune media storage read policy migration missing.");
assert(publishedMediaDisplayPolicyMigration.includes("media.visibility_state = 'published'"), "Published Commune media storage policy should require published media metadata.");
assert(publishedMediaDisplayPolicyMigration.includes("post.status = 'published'") && publishedMediaDisplayPolicyMigration.includes("post.visibility = 'public'"), "Published Commune media storage policy should require a public published post.");
assert(publishedMediaDisplayPolicyMigration.includes("update public.commune_media media") && publishedMediaDisplayPolicyMigration.includes("media.visibility_state in ('submitted', 'flagged')"), "Published media migration should backfill safe existing attachments on public published posts.");
assert(reactionMigration.includes("commune_content_reactions"), "Commune content reaction migration missing.");
assert(reactionMigration.includes("unique (user_id, target_type, target_id)"), "Commune reactions should enforce one vote per user per item.");
assert(reactionMigration.includes("reaction in ('helpful', 'caution')"), "Commune reaction labels should be helpful/caution.");
assert(reactionMigration.includes("commune_content_reaction_counts"), "Commune public aggregate reaction-count view missing.");
assert(reactionMigration.includes("grant select on public.commune_content_reaction_counts to anon, authenticated"), "Anonymous users should be able to read aggregate reaction counts.");
assert(reactionMigration.includes("users update own commune reactions") && reactionMigration.includes("users delete own commune reactions"), "Users should be able to change/remove their own Commune reactions.");
assert(reactionSecurityRepair.includes("security_invoker = true") && reactionSecurityRepair.includes("security_barrier = true"), "Commune reaction counts must no longer execute with view-owner privileges.");
assert(reactionSecurityRepair.includes("commune_content_reaction_totals") && reactionSecurityRepair.includes("enable row level security"), "Commune reaction counts need a userless RLS-protected aggregate relation.");
assert(reactionSecurityRepair.includes("public.commune_posts as post") && reactionSecurityRepair.includes("public.commune_comments as comment"), "Reaction-count visibility must delegate to parent post/comment RLS.");
assert(reactionSecurityRepair.includes("sync_commune_content_reaction_totals") && reactionSecurityRepair.includes("set search_path = ''"), "Reaction aggregate maintenance needs a locked trigger helper.");
assert(/revoke all privileges on function public\.sync_commune_content_reaction_totals\(\)[\s\S]*from public, anon, authenticated, service_role/.test(reactionSecurityRepair), "Reaction aggregate trigger helper must not be exposed through the Data API.");
assert(accountApi.includes('.from("commune_content_reactions").upsert') && accountApi.includes('.from("commune_content_reactions").delete()'), "Reaction security repair must preserve the existing reaction mutation API.");
assert(styles.includes(".commune-post-card") && styles.includes("linear-gradient(180deg, rgba(13, 23, 31"), "Commune public post cards should use dark styling.");
assert(styles.includes(".commune-signal-bar"), "Commune signal bar styling missing.");
assert(styles.includes(".commune-admin-controls"), "Commune admin control styling missing.");
assert(!styles.includes(".commune-post-card,\n.commune-preview-card {\n  padding: 1rem;\n  border: 1px solid rgba(28, 68, 68, .12);\n  border-radius: 14px;\n  background: rgba(255,255,255,.78);"), "Commune post cards should not use the old bright white styling.");
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
assert(languagePolicies.includes("CodingLanguagePolicy") && languagePolicies.includes("active_sandbox") && languagePolicies.includes("disabled"), "Coding Cornucopia language policy module missing active/static/future/disabled states.");
assert(languagePolicies.includes("shell") && languagePolicies.includes("Disabled by default"), "Shell must remain disabled by default.");
assert(diagnosticTypes.includes("runStaticCodingDiagnostics") && diagnosticTypes.includes("secret_scan_warning") && diagnosticTypes.includes("sandbox_internal_failure"), "Coding Cornucopia structured diagnostics missing.");
assert(sandboxClient.includes('fetcher("/api/sandbox/run"') && sandboxClient.includes("sandbox_unavailable") && sandboxClient.includes("policy_blocked"), "Coding Cornucopia authenticated same-origin sandbox client must fail closed.");
assert(languagePolicies.includes("getSandboxExecutionLanguageCompatibility") && languagePolicies.includes("sandboxExecutionMode"), "Sandbox execution eligibility must use one explicit language contract rather than infer remote execution from static diagnostics.");
assert(!sandboxClient.includes('policy.status !== "active_sandbox" && policy.status !== "static_diagnostics"'), "Sandbox client must not treat every static-diagnostics language as remotely executable.");
assert(sandboxClient.includes("getSandboxExecutionLanguageCompatibility") && sandboxClient.includes("sandbox_language_unsupported"), "Sandbox client must reject unsupported languages locally with a truthful result.");
assert(!accountApi.includes("recordCodingSandboxRunResult") && !accountApi.includes("record_commune_sandbox_run_result"), "Browser-side result fabrication path must remain retired.");
assert(sandboxProxyRun.includes("reserveRun") && sandboxProxyRun.includes("finalizeRun") && governedSandboxMigration.includes("revoke execute on function public.record_commune_sandbox_run_result"), "Governed proxy reservation/finalization and old RPC revocation are missing.");
assert(sandboxRunner.includes("createAndRunSnapshotRun") && sandboxRunner.includes("runContainerJob") && sandboxRunner.includes("validateSnapshotRunPayload"), "Sandbox runner snapshot execution path missing.");
assert(sandboxServer.includes("/v1/runs") && sandboxServer.includes("publicConfigReady(config)"), "Sandbox runner service endpoint must require both explicit execution gates.");
assert(codingRunsMigration.includes("commune_sandbox_runs") && codingRunsMigration.includes("commune_code_diagnostics"), "Coding Cornucopia run/diagnostic migration missing.");
assert(codingRunsMigration.includes("commune_language_policies") && codingRunsMigration.includes("commune_sandbox_policies"), "Coding Cornucopia policy tables missing.");
assert(runResultRecordingMigration.includes("record_commune_sandbox_run_result") && runResultRecordingMigration.includes("commune_code_diagnostics"), "Coding Cornucopia run result recording migration missing.");
assert(runResultRecordingMigration.includes("~ '^[0-9]+$'"), "Sandbox result recording should guard diagnostic line/column casts.");
assert(sandboxBoundaryDoc.includes("same-origin /api/sandbox/* Pages Functions") && sandboxBoundaryDoc.includes("Execution is evidence only"), "Coding Cornucopia sandbox boundary doc missing governed architecture/trust separation.");
assert(sandboxThreatDoc.includes("Layered controls") && sandboxThreatDoc.includes("Residual risk and operating controls") && sandboxThreatDoc.includes("Shell"), "Coding Cornucopia threat model missing layered controls and residual risks.");
assert(sandboxContractDoc.includes("POST /api/sandbox/run") && sandboxContractDoc.includes("Supabase access token") && !sandboxContractDoc.includes("VITE_CODING_SANDBOX_ENDPOINT"), "Coding Cornucopia governed same-origin API contract missing.");

console.log("Commune smoke test ok.");

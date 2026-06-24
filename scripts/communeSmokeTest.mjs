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
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const migration = await read("supabase/migrations/2026_06_12_commune_full_system.sql");
const realtimeMigration = await read("supabase/migrations/2026_06_14_commune_realtime_chat_moderation.sql");
const realtimeApi = await read("src/pages/The-Elysia-Commune/communeRealtimeApi.ts");
const codeReviewMigration = await read("supabase/migrations/2026_06_14_commune_collaborative_code_review.sql");
const codeReviewApi = await read("src/pages/The-Elysia-Commune/communeCodeReviewApi.ts");
const sandboxHandoffMigration = await read("supabase/migrations/2026_06_14_sandbox_request_local_handoff.sql");
const sandboxHandoffApi = await read("src/pages/The-Elysia-Commune/communeSandboxHandoffApi.ts");
const sandboxValidator = await read("src/shared/sandbox/sandboxRequestValidator.ts");
const sandboxBuilder = await read("src/shared/sandbox/sandboxHandoffBuilder.ts");
const participantApprovalMigration = await read("supabase/migrations/2026_06_21_commune_thread_participant_approvals.sql");
const reactionMigration = await read("supabase/migrations/2026_06_21_commune_content_reactions.sql");
const commentDirectPublishMigration = await read("supabase/migrations/2026_06_21_commune_comment_direct_publish_policy.sql");
const commentSchemaRepairMigration = await read("supabase/migrations/2026_06_22_commune_comments_schema_drift_repair.sql");
const commentNotificationRepairMigration = await read("supabase/migrations/2026_06_22_commune_comment_notification_dependency_repair.sql");
const roomPostMediaPolicyRepairMigration = await read("supabase/migrations/2026_06_23_commune_room_post_admin_and_media_policy_repair.sql");
const publishedMediaDisplayPolicyMigration = await read("supabase/migrations/2026_06_24_commune_published_media_display_policy.sql");
const communeCommentSchemaCoverage = `${migration}\n${commentDirectPublishMigration}\n${commentSchemaRepairMigration}\n${commentNotificationRepairMigration}`;
const styles = await read("src/styles.css");

for (const route of ["/commune", "commune/new", "commune/:roomSlug", "commune/:roomSlug/new", "commune/repository-showcase", "commune/repository-showcase/new", "commune/troubleshooting", "commune/sandbox-review", "commune/code-sharing/review", "commune/code-sharing/sandbox-request", "commune/realtime", "commune/moderation"]) {
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
assert(page.includes("focusComposer={isRoomNew}"), "Room-specific /new routes should focus the selected room composer instead of reopening the lobby picker.");
assert(page.includes("roomId={selectedRoom?.id}"), "Room composer should receive the selected backend room id.");
assert(page.includes("defaultRoomId={roomId}"), "Room page should pass the backend room id into the post composer.");
assert(page.includes("isAdmin={state.isAdmin}"), "Room composer should receive admin state for direct-publish labeling.");
assert(page.includes('isAdmin ? "Publish as admin" : "Submit for moderation"'), "Room composer should show admin direct-publish copy while keeping member moderation copy.");
assert(page.includes("Admins can publish room posts directly. Attachments still follow Commune media safety rules."), "Room composer should explain admin direct-publish without bypassing media safety.");
assert(page.includes("Video uploads are not enabled for this room yet."), "Room composer should clearly reject unsupported video uploads instead of implying video support.");
for (const roomNativeField of ["Issue type", "Affected area", "Expected behavior", "Actual behavior", "Known workaround", "Introduction type", "Collaboration interest", "Role interest", "Project circle/topic", "Paid / volunteer status", "Compensation clarity", "Location / remote / hybrid", "Contact path", "Research question / topic", "Citation notes", "Evidence summary", "Interpretation", "Uncertainty", "Iteration type", "Version / build label", "What changed", "Known limitations", "Official notice type", "Audit-safe note"]) {
  assert(page.includes(roomNativeField), `Missing room-native composer field/copy: ${roomNativeField}`);
}
assert(page.includes("function splitPostSections"), "Post detail should parse room-native structured body sections.");
assert(page.includes("commune-room-native-details"), "Post detail should render room-native sections instead of flattening all fields into the body.");
assert(styles.includes(".commune-room-native-details"), "Room-native post detail styling missing.");
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
assert(page.includes("function RoomCards()"), "Commune lobby room cards should render the complete room list.");
assert(page.includes("postTypes.map((type)"), "Commune lobby room cards should include every post type doorway.");
assert(page.includes("Enter room"), "Commune room entry copy missing.");
assert(page.includes("Shared code is not trusted and is not executed by the website or Elysia by default."), "Code Sharing caution copy missing.");
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
assert(accountApi.includes('post_type: "repository_showcase"'), "Repository Showcase should create/link a normal Commune post.");
assert(accountApi.includes("Repository showcase submitted as a normal Commune post for moderation"), "Repository Showcase should enter the normal Commune moderation flow.");
assert(accountApi.includes("repository_metadata_only"), "Repository Showcase post safety acknowledgements should preserve metadata-only boundaries.");
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
assert(page.includes("Attached to this post by {authorLink(post.author_username)}"), "Commune post media should attribute attachments to the public post author handle.");
const postTagIndex = page.indexOf("<TagChips tags={post.tags}");
const postMediaIndex = page.indexOf("commune-media-section", postTagIndex);
const postReactionIndex = page.indexOf("<ReactionBar targetType=\"post\"", postTagIndex);
const postAdminIndex = page.indexOf("<AdminContentControls targetType=\"post\"", postTagIndex);
assert(postTagIndex > -1 && postMediaIndex > postTagIndex && postMediaIndex < postReactionIndex && postMediaIndex < postAdminIndex, "Commune post media should render after post body/tags and before reactions/admin moderation.");
assert(page.includes("commune-media-lightbox") && page.includes("Attachment unavailable or still under review."), "Commune post media display should include read-only preview and unavailable copy.");
assert(styles.includes(".commune-media-section") && styles.includes("object-fit: contain"), "Commune media display styling should keep images contained, not cropped.");
assert(accountApi.includes("loadCommuneReactionSummary"), "Commune reaction-count loader missing.");
assert(accountApi.includes("setCommuneReaction"), "Commune reaction setter missing.");
assert(accountApi.includes("clearCommuneReaction"), "Commune reaction removal helper missing.");
assert(accountApi.includes("moderateCommuneContentTarget"), "Commune direct admin content moderation helper missing.");
assert(accountApi.includes('currentSelect = input.targetType === "post" ? "id,status,visibility,visibility_state,moderation_status"'), "Commune post moderation should not select comment-only post_id/thread_id columns from commune_posts.");
assert(accountApi.includes('update.visibility_state = input.action === "flag" ? "flagged" : input.action === "hide" ? "hidden" : "removed"'), "Commune post moderation should update post visibility_state for admin recovery views.");
assert(accountApi.includes("update.hidden_by = account.userId"), "Commune post/comment moderation should record the admin actor when hiding/removing content.");
assert(accountApi.includes("[\"published\", \"submitted\", \"flagged\"]"), "Commune post moderation should remove linked media from public display when the post is hidden/removed.");
assert(reviewClient.includes("await publishCommunePostMedia(item.source_id);") && reviewClient.includes("restore_to_public"), "Restoring a Commune post should restore linked published media visibility.");
assert(accountApi.includes("flag_for_removal"), "Commune admin flag action should write moderation history.");
assert(accountApi.includes("hide_from_public"), "Commune admin hide action should write moderation history.");
assert(accountApi.includes("soft_delete_from_public"), "Commune admin delete/remove action should write moderation history.");
assert(accountApi.includes("hard_delete: false"), "Commune frontend delete/remove should be honest about soft-removal evidence retention.");
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

console.log("Commune smoke test ok.");

import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/pages/The-Elysia-Commune/index.tsx", "utf8");
const api = fs.readFileSync("src/pages/The-Elysia-Commune/communeAccountApi.ts", "utf8");
const codeApi = fs.readFileSync("src/pages/The-Elysia-Commune/communeCodeReviewApi.ts", "utf8");
const draftState = fs.readFileSync("src/pages/The-Elysia-Commune/codeRevisionDraftState.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260810030000_circle_private_commune_posts.sql", "utf8");
const fixture = fs.readFileSync("scripts/fixtures/communeCirclePrivateBehavior.sql", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

const roomTypes = [
  "media_garden", "troubleshooting", "code_sharing", "repository_showcase",
  "community_network", "job_post", "research_note", "elysia_iteration_showcase",
  "community_vote", "official_update",
];
for (const roomType of roomTypes) {
  assert.ok(page.includes(`"${roomType}"`) || api.includes(`"${roomType}"`), `Private composer contract omits ${roomType}`);
  assert.ok(fixture.includes(`'${roomType}'`), `Disposable private-post fixture omits ${roomType}`);
}

assert.ok(page.includes("function CommuneAudienceSelector"), "Shared audience selector is missing.");
assert.equal((page.match(/<CommuneAudienceSelector /g) ?? []).length, 3, "Shared, Vote, and Repository composers must each use the canonical audience selector exactly once.");
for (const marker of [
  "<strong>Public</strong>", "Private to selected Circle members", "Choose who can discover and open this room-native post",
  "Pending invitations cannot receive private posts", "You are included automatically",
  "account-backed cloud access control—not local or end-to-end encrypted storage",
  "Open Your Circle", "You do not have accepted Circle members available yet",
]) assert.ok(page.includes(marker), `Audience UX is missing: ${marker}`);
assert.ok(page.includes('type="radio"') && page.includes('type="checkbox"'), "Audience selection and privacy acknowledgement must remain native keyboard-accessible controls.");
assert.ok(page.includes("commune-circle-search") && page.includes("Find a Circle member") && page.includes("Search accepted members"), "Large Circle recipient lists need a labeled search control.");

for (const marker of [
  "CommunePostAudience", "circleRelationshipIds", "circlePrivacyAcknowledged",
  "circlePostFields", "circleThreadFields", "validateCircleRecipients",
  "finalizeCirclePostAccess", "add_commune_post_circle_participants",
  "remove_commune_post_circle_participant", "commune_post_circle_participant_cards",
]) assert.ok(api.includes(marker), `Shared private-post API contract omits ${marker}`);
assert.ok((api.match(/finalizeCirclePostAccess\(/g) ?? []).length >= 9, "Every room-specific creation path must finalize its explicit Circle ACL.");
assert.ok(api.includes('.eq("audience", "public")') && api.includes('.eq("audience", "circle")'), "Public discovery and authorized private discovery must be separate explicit queries.");
assert.ok(
  api.includes("const directPublish = privateCircle || approvedParticipant")
    && api.includes("if (!directPublish) {")
    && api.includes("private Circle thread"),
  "Private comments must publish directly inside the ACL while only non-direct comments enter review queues.",
);
assert.ok(api.includes(".download(row.storage_path)") && api.includes("URL.createObjectURL(blob)"), "Private attachment display must use authenticated storage fetches and ephemeral object URLs.");
assert.ok(!api.includes("createSignedUrl"), "Private attachment loading must not mint reusable signed URLs in the shared loader.");

assert.ok(page.includes("CirclePostParticipantPanel"), "Private post owners need a post-lifecycle participant panel.");
assert.ok(page.includes("Adding someone grants access to the existing post, comments, attachments, and room-native history"), "Adding a participant later must warn about historical access.");
assert.ok(page.includes("Removing someone from Your Circle prevents new sharing but does not rewrite this post automatically") && page.includes("The post owner can revoke this post access below"), "Participant removal semantics must be explicit.");
assert.ok(page.includes('post.audience === "circle" ? ["Private"'), "Private cards need an unmistakable badge.");
assert.ok(page.includes('isCirclePrivate ? ["Private", "Circle only"]'), "Private detail badges must describe the Circle audience without exposing the private_draft storage compatibility value.");
assert.ok(page.includes("Only the author and explicitly selected Circle participants"), "Private detail pages must state their access boundary.");
assert.ok(page.includes("does not give reviewers or administrators routine access"), "Private reporting copy must not imply blanket staff access.");
assert.ok(page.includes("state.isModerator && post?.audience !== \"circle\"") && page.includes("const privateRoomModerator = state.isModerator && !isCirclePrivate"), "Private posts must suppress ordinary ambient moderation controls.");

assert.ok(page.includes("postAudience: audience.postAudience") && page.includes("circleRelationshipIds"), "Local drafts must preserve audience and selected Circle relationships.");
assert.ok(page.includes("Visibility: ${draft.postAudience === \"circle\""), "Markdown export must identify private versus public audience.");
assert.ok(draftState.includes('"published" | "circle" | "attached"'), "Code revision draft state must distinguish public, private Circle, and unavailable parents.");
assert.ok(codeApi.includes("submit_circle_code_revision_proposal_v2"), "Circle code proposals must use their ACL-aware RPC.");

for (const marker of [
  "audience in ('public', 'circle')", "circle_privacy_acknowledged",
  "commune_post_circle_participants", "commune_circle_post_member",
  "commune_post_boundary_allows", "commune_post_is_circle", "commune_circle_post_owner",
  "Circle-private Commune post boundary", "Circle-private Commune comment boundary",
  "Circle-private troubleshooting boundary", "Circle-private repository metadata boundary",
  "Circle-private research metadata boundary", "Circle-private Job Post boundary",
  "Circle-private iteration metadata boundary", "Circle-private Official Update metadata boundary",
  "Circle-private vote metadata boundary", "Circle-private Commune media boundary",
  "Circle-private Commune storage boundary", "Circle-private Commune code snippet boundary",
  "Circle-private unified report insert boundary", "Circle-private legacy report insert boundary",
  "Circle-private saved post insert boundary", "Circle members save private Commune posts",
  "Circle-private followed thread insert boundary", "Circle-private linked code document boundary",
  "Circle-private code proposal boundary", "Circle-private sandbox handoff boundary",
  "submit_circle_code_revision_proposal_v2", "circle_code_proposal_transition_forbidden",
  "commune_vote_result_summary",
]) assert.ok(migration.includes(marker), `RLS migration omits ${marker}`);

const memberFunction = migration.match(/create or replace function private\.commune_circle_post_member\([\s\S]*?\n\$\$;/i)?.[0] ?? "";
assert.ok(memberFunction, "Canonical private-post membership helper is missing.");
assert.ok(!/current_user_is_admin|current_user_can_review|moderator|reviewer|service_role/i.test(memberFunction), "Administrator or reviewer status must not become private-post membership.");
assert.ok(!/organization_project|author_username|poster_type[\s\S]{0,120}(?:authorize|access)/i.test(migration), "Private authorization must not trust display strings or client-declared poster identity.");
assert.match(migration, /post_type not in \('official_update', 'community_vote'\)[\s\S]*current_user_is_admin/, "Official Updates and Community Voting must remain admin-only creation rooms.");
assert.ok(migration.includes("Existing explicit private-post access is unchanged") || fs.readFileSync("supabase/migrations/20260810020000_mutual_commons_circle.sql", "utf8").includes("Existing explicit private-post access is unchanged"), "Circle removal must not silently rewrite established post ACLs.");

for (const marker of [
  "commune-audience-selector", "commune-audience-options", "commune-circle-participant-picker",
  "commune-circle-member-options", "commune-private-participants", "commune-private-participant-list",
]) assert.ok(styles.includes(`.${marker}`), `Responsive private-post styling omits .${marker}`);
assert.ok(styles.includes("min-width: 0") && styles.includes("overflow-wrap: anywhere"), "Private recipient controls need bounded responsive wrapping.");

for (const marker of [
  "expected ten room-native private posts", "selected participant could not read every specialized sidecar",
  "relationship removal silently rewrote established post ACLs", "unrelated member discovered private posts",
  "nonparticipant administrator read private posts", "nonparticipant reviewer read private posts",
  "anonymous reader discovered private posts", "private aggregate vote result unavailable",
  "administrator role bypassed private sandbox source ACL", "private post notification leaked to a nonparticipant",
  "unrelated member reported a guessed private post", "anonymous reader reported a guessed private post",
  "administrator could not see narrow private-content report metadata",
  "explicit participant removal did not revoke exactly one post", "public post compatibility regressed",
]) assert.ok(fixture.includes(marker), `Hostile database fixture omits ${marker}`);

console.log("Circle/private Commune contracts passed across all ten rooms.");

import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260810020000_mutual_commons_circle.sql", "utf8");
const accessMigration = fs.readFileSync("supabase/migrations/20260810040000_circle_access_review.sql", "utf8");
const api = fs.readFileSync("src/pages/The-Commons-Circle/circleApi.ts", "utf8");
const profile = fs.readFileSync("src/pages/Public-Commons-Profile/index.tsx", "utf8");
const action = fs.readFileSync("src/pages/The-Commons-Circle/CircleProfileAction.tsx", "utf8");
const page = fs.readFileSync("src/pages/The-Commons-Circle/CirclePage.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const signals = fs.readFileSync("src/pages/The-Commons-Circle/SignalConsolePage.tsx", "utf8");

for (const marker of [
  "constraint commons_circle_pair_order_check",
  "constraint commons_circle_pair_unique",
  "status in ('pending', 'accepted', 'declined', 'removed')",
  "circle participants read their relationships",
  "auth.uid() in (user_low_id, user_high_id)",
  "commons_circle_invitation_response_forbidden",
  "commons_circle_remove_forbidden",
  "pg_advisory_xact_lock",
  "community_safe_online_public_profile_cards",
  "private.community_account_is_recoverable",
]) assert.ok(migration.includes(marker), `Circle migration is missing ${marker}`);

assert.ok(!/current_user_is_admin|has_role\s*\(/i.test(migration), "Circle membership must not grant administrators ambient access.");
assert.ok(!/grant\s+(?:insert|update|delete|all).*commons_circle_relationships.*authenticated/i.test(migration), "Circle table mutations must remain RPC-only.");
assert.match(migration, /status = 'pending' and v_relationship\.requested_by = v_target[\s\S]*status = 'accepted'/, "Crossed invitations must atomically record mutual consent.");
assert.match(migration, /v_relationship\.requested_by = v_actor[\s\S]*return pg_catalog\.jsonb_build_object\('state', 'sent'/, "Duplicate outbound invitations must be idempotent.");

for (const rpc of ["current_user_circle", "commons_circle_state_for_handle", "invite_to_commons_circle", "respond_to_commons_circle_invitation", "remove_from_commons_circle"]) {
  assert.ok(api.includes(`\"${rpc}\"`) || migration.includes(`public.${rpc}`), `Circle contract omits ${rpc}`);
}

assert.ok(profile.includes("<CircleProfileAction handle={profile.username}"), "Public profile must place the Circle action beside Message.");
for (const label of ["Invite to Circle", "Circle invitation sent", "Accept invitation", "Decline", "In Your Circle", "Remove from Circle"]) {
  assert.ok(action.includes(label) || page.includes(label), `Circle UI is missing ${label}`);
}
assert.ok(page.includes("mutual Circle") && page.includes("not a follower count"), "Your Circle page must explain mutual consent and non-authority.");
assert.match(api, /supabase\.auth\.getSession\(\)[\s\S]*!sessionData\.session\?\.user[\s\S]*Sign in to use Your Circle\.[\s\S]*supabase\.rpc\("current_user_circle"\)/, "Signed-out Circle loading must stop before the authenticated RPC instead of generating a production 401.");
assert.ok(app.includes('path="commons-circle/signals/circle"'), "Your Circle route is missing.");
assert.ok(signals.includes('to="/commons-circle/signals/circle"'), "Signals must expose Your Circle near communication tools.");
assert.ok(migration.includes("Existing explicit private-post access is unchanged"), "Circle removal must explicitly preserve existing post ACLs.");

for (const marker of [
  "current_user_circle_access_review", "remainingOwnedPrivatePostCount",
  "post.user_id = v_actor", "relationship.status <> 'accepted'",
  "access.removed_at is null", "Existing explicit private-post access is unchanged",
]) assert.ok(accessMigration.includes(marker), `Owner-controlled access review is missing ${marker}`);
assert.ok(!/current_user_is_admin|current_user_can_review|has_role\s*\(/i.test(accessMigration), "Access review must not grant administrators or reviewers ambient access.");
assert.match(accessMigration, /'circleAccepted', case when v_owner = v_actor[\s\S]*else null end/, "Only the private-post owner may receive the former-Circle relationship marker.");
assert.ok(api.includes('supabase.rpc("current_user_circle_access_review")'), "Your Circle API must load the owner-scoped access review.");
assert.ok(api.includes('supabase.rpc(name, parameters)') && api.includes('"remove_commune_post_circle_participant"'), "Access review must reuse the canonical owner-only participant removal RPC.");
assert.ok(page.includes('id="access-review"') && page.includes("Review durable private-post access"), "Your Circle page must conditionally host Access Review.");
assert.ok(page.includes("Existing private-post access stays intact until you explicitly remove it"), "Access Review must explain durable ACL semantics.");
assert.ok(signals.includes('/commons-circle/signals/circle#access-review') && signals.includes("former Circle"), "Signals must summarize and route to Access Review without embedding ACL details.");

console.log("Mutual Commons Circle contracts passed.");

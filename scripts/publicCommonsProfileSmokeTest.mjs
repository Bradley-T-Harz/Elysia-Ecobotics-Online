import assert from "node:assert/strict";
import fs from "node:fs/promises";

const initialMigration = await fs.readFile(
  new URL(
    "../supabase/migrations/20260722010000_public_commons_profile_legacy_compatibility.sql",
    import.meta.url,
  ),
  "utf8",
);
const correctionMigration = await fs.readFile(
  new URL(
    "../supabase/migrations/20260723010000_public_commons_profile_cutover_marker_correction.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration = `${initialMigration}\n${correctionMigration}`;
const api = await fs.readFile(
  new URL("../src/pages/The-Commons-Circle/commonsCircleApi.ts", import.meta.url),
  "utf8",
);
const database = await fs.readFile(
  new URL("../services/identity-worker/_shared/database.ts", import.meta.url),
  "utf8",
);

for (const preservationBoundary of [
  "commons_onboarding_completed_at",
  "private.profile_publication_events",
  "private.community_account_is_recoverable",
  "commons_profile_publication",
  "all_public_communities",
]) {
  assert.ok(
    migration.includes(preservationBoundary),
    `Online legacy compatibility must retain ${preservationBoundary}.`,
  );
}
assert.match(
  correctionMigration,
  /profile\.commons_onboarding_completed_at is not null/,
  "legacy Commons onboarding must remain the explicit Online publication choice.",
);
assert.doesNotMatch(
  correctionMigration,
  /2026-07-18 01:00:00|commons_onboarding_completed_at\s*</,
  "migration ordering timestamps must not be treated as hosted cutover time.",
);
assert.match(
  migration,
  /participation\.participation_state not in \(\s*'restricted', 'suspended', 'blocked',\s*'deletion_pending', 'deactivated'/s,
  "restricted and lifecycle-limited accounts must remain unavailable.",
);
assert.match(
  migration,
  /revoke all privileges\s+on function private\.community_legacy_online_profile_is_public\(uuid\)\s+from public, anon, authenticated, service_role;/s,
  "the internal legacy predicate must not be browser-callable.",
);
assert.match(
  migration,
  /grant execute\s+on function public\.get_public_commons_profile_presentation\(text\)\s+to anon, authenticated, service_role;/s,
  "the safe presentation RPC must remain anonymously readable.",
);
for (const mediaFunction of [
  "get_online_public_profile_avatar_asset",
  "get_online_public_profile_banner_asset",
]) {
  assert.match(
    migration,
    new RegExp(
      `revoke all privileges\\s+on function public\\.${mediaFunction}\\(uuid\\)\\s+from public, anon, authenticated, service_role;[\\s\\S]*?grant execute\\s+on function public\\.${mediaFunction}\\(uuid\\)\\s+to service_role;`,
    ),
    `${mediaFunction} must remain service-only.`,
  );
  assert.ok(
    database.includes(`"${mediaFunction}"`),
    `Identity Worker must use ${mediaFunction}.`,
  );
}
assert.doesNotMatch(
  migration,
  /update\s+public\.profiles|update\s+public\.profile_public_cards|insert\s+into\s+private\.profile_publication_events/i,
  "the compatibility migration must not rewrite profile data or fabricate publication events.",
);
assert.doesNotMatch(
  migration,
  /create or replace view private\.community_safe_public_profile_cards/i,
  "the shared cross-site public-card projection must remain unchanged.",
);
assert.doesNotMatch(
  migration,
  /create or replace function private\.community_profile_is_public/i,
  "the shared cross-site publication predicate must remain unchanged.",
);
assert.match(
  api,
  /exactRecordKeys\(root,[\s\S]*?"publicLinks"[\s\S]*?"publicCommuneComments"/,
  "the browser must decode one exact safe public presentation.",
);
assert.doesNotMatch(
  api.slice(api.indexOf("export async function loadPublicCommonsProfile")),
  /from\("(?:profiles|profile_public_cards|profile_visibility_settings|profile_customization|profile_media|visible_user_badges|user_source_collections|commune_posts|commune_comments)"\)/,
  "the browser must not reconstruct a public profile through direct account-keyed tables.",
);

console.log("Public Commons Profile source and migration boundaries passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("src/App.tsx");
assert.match(app, /<ParticipationProvider>/, "App must load bounded participation state beneath AuthProvider");
assert.match(app, /path="account\/export"/, "data-export route must exist");
assert.match(app, /path="account\/delete"/, "account-deletion route must exist");

const types = read("src/shared/participation/participationTypes.ts");
for (const state of ["read_only", "adult_eligible", "teen_pending", "teen_eligible", "under13_pending", "under13_eligible", "restricted", "suspended", "blocked", "deletion_pending", "deactivated"]) {
  assert.ok(types.includes(`"${state}"`), `participation types must include ${state}`);
}
for (const permission of ["canJoinArtisan", "canPostArtisan", "canCommentArtisan", "canUploadImage", "canSubmitChallenge"]) {
  assert.ok(types.includes(permission), `bounded access must include ${permission}`);
}
for (const bootstrapContract of ["accountActivation", "guardianSummary", "legalManifest", "notificationPreferences", "featureFlags"]) {
  assert.ok(types.includes(bootstrapContract), `identity bootstrap types must include ${bootstrapContract}`);
}

const client = read("src/shared/participation/participationClient.ts");
for (const endpoint of ["/bootstrap", "/profile/publication", "/legal/accept", "/account/deactivate", "/account/reactivate", "/lifecycle/request", "/lifecycle/requests", "/account/exports/"]) {
  assert.ok(client.includes(endpoint), `identity client must use ${endpoint}`);
}
assert.match(client, /authorization: `Bearer \$\{accessToken\}`/, "identity calls must use the current bearer session");
assert.match(client, /credentials: "omit"/, "identity calls must not add a second cookie-backed session");
assert.match(client, /cache: "no-store"/, "identity responses must not be cached");
assert.doesNotMatch(client, /localStorage|sessionStorage|postMessage/, "identity tokens must not be copied through browser storage or postMessage");
assert.doesNotMatch(client, /service[_-]?role/i, "browser identity code must never reference a service-role credential");
assert.match(client, /PUBLIC_AVATAR_PATH/, "public avatar URLs must be constrained to the same-origin derivative route");
assert.match(client, /CANONICAL_PROFILE_URL/, "canonical profile links must be constrained to the Online public-profile origin");
assert.match(client, /guardianSummarySchema/, "guardian summaries must be validated at the identity boundary");
assert.match(client, /legalManifestSchema/, "the exact legal manifest must be validated at the identity boundary");

const guard = read("src/shared/auth/RequireParticipation.tsx");
assert.match(guard, /fail-closed UX guard only/, "route guard must document that server authorization remains authoritative");
assert.match(guard, /Workers, RPCs, and RLS/, "route guard must not claim frontend authorization authority");
assert.match(guard, /profileComplete/, "participation UX must account for canonical profile completion");

const publicationPanel = read("src/shared/participation/PublicProfilePublicationPanel.tsx");
assert.match(publicationPanel, /updatePublicProfilePublication/, "Commons account UI must use the controlled profile-publication endpoint");
assert.match(publicationPanel, /handle, display name, avatar, short public bio, and canonical profile URL/i, "profile publication UI must explain the bounded identity contract");
assert.match(publicationPanel, /cannot override an account restriction/i, "profile publication UI must not imply a frontend authorization bypass");
const commonsPage = read("src/pages/The-Commons-Circle/index.tsx");
const privacySettingsPage = read("src/pages/The-Commons-Circle/AccountPrivacySettingsPage.tsx");
assert.match(privacySettingsPage, /<PublicProfilePublicationPanel\s*\/>/, "Privacy & Public Profile must expose the explicit public-card publication control");
assert.doesNotMatch(commonsPage, /<PublicProfilePublicationPanel\s*\/>/, "Commons Circle root must not duplicate the relocated publication control");
assert.match(commonsPage, /to="\/commons-circle\/settings">Account &amp; Profile Settings/, "Commons Circle private homebase must expose Account & Profile Settings");
assert.match(app, /location\.hash === "#privacy-lanterns"[\s\S]*?\/commons-circle\/settings\/privacy/, "the legacy Privacy Lantern deep link must redirect to its canonical settings destination");

const lifecycleForm = read("src/shared/participation/AccountLifecycleRequestForm.tsx");
assert.match(lifecycleForm, /identity_lifecycle_request/, "lifecycle requests must bind Turnstile to the expected action");
assert.match(lifecycleForm, /createIdentityClientRequestId/, "lifecycle requests must carry an idempotency identifier");
assert.match(lifecycleForm, /cooling period/i, "deletion UI must explain the governed cooling-period workflow");
assert.match(lifecycleForm, /private local Elysia memory/i, "lifecycle UI must preserve the private-Elysia boundary");
assert.match(lifecycleForm, /AccountLifecycleHistoryPanel/, "canonical account UI must expose lifecycle status, cancellation, and export retrieval");
const lifecycleHistory = read("src/shared/participation/AccountLifecycleHistoryPanel.tsx");
assert.match(lifecycleHistory, /cancelCommunityDeletionRequest/, "owner UI must support cooling-window deletion cancellation");
assert.match(lifecycleHistory, /downloadCommunityLifecycleExport/, "owner UI must support private export retrieval");
assert.match(client, /crypto\.subtle\.digest\("SHA-256"/, "private exports must be integrity checked against their bytes in-browser");
assert.match(client, /artifact\.downloadPath !== expectedPath/, "private export downloads must remain on the exact owner endpoint");

const turnstile = read("src/shared/participation/TurnstileWidget.tsx");
assert.match(turnstile, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/, "Turnstile must use the official explicit-render script");
assert.match(turnstile, /VITE_TURNSTILE_SITE_KEY/, "Turnstile must use a public site key only");
assert.match(turnstile, /onTokenChange\(null\)/, "expired or failed Turnstile state must invalidate the token");

const commonsApi = read("src/pages/The-Commons-Circle/commonsCircleApi.ts");
assert.match(commonsApi, /rpc\("resolve_online_public_profile_handle"/, "retired Online handles must use the bounded Online canonical-resolution RPC");
assert.match(commonsApi, /canonicalProfileUrl !== `https:\/\/elysiaecobotics\.com\/commons-circle\/@\$\{currentHandle\}`/, "handle resolution must reject noncanonical redirect destinations");
const publicLoaderStart = commonsApi.indexOf("export async function loadPublicCommonsProfile");
assert.ok(publicLoaderStart >= 0, "public Commons profile loader must exist");
const publicLoader = commonsApi.slice(publicLoaderStart);
assert.match(publicLoader, /rpc\("get_public_commons_profile_presentation"/, "public profile identity and presentation must come from the bounded presentation RPC");
assert.doesNotMatch(publicLoader, /from\("profiles"\)/, "public profile loading must not read the canonical private profile row");
assert.doesNotMatch(publicLoader, /from\("profile_(?:visibility_settings|customization|media)"\)/, "public profile loading must not bypass the bounded presentation contract");
assert.doesNotMatch(publicLoader, /\.eq\("user_id"/, "public profile loading must not issue account-UUID-keyed follow-up queries");
assert.doesNotMatch(publicLoader, /auth\.getUser\(\)/, "the bounded public presentation must compute owner state without exposing an account UUID");
assert.doesNotMatch(publicLoader, /profile\.userId|profileRow\.id/, "the browser public-profile contract must not contain an account UUID");
for (const decoderBoundary of [
  "exactRecordKeys", "decodeFeaturedPublicLinks", "decodePublicBadgeAwards",
  "decodePublicCollections", "decodePublicCommunePosts",
  "decodePublicCommuneComments",
]) assert.ok(commonsApi.includes(decoderBoundary), `public presentation decoder must enforce ${decoderBoundary}`);

const publicProfilePage = read("src/pages/Public-Commons-Profile/index.tsx");
assert.match(publicProfilePage, /\[a-z0-9\._-\]\{1,79\}/i, "public route parser must accept the canonical handle contract");
assert.match(publicProfilePage, /<Navigate replace to=\{canonicalRedirectPath\}/, "retired handles must redirect without creating a second profile URL");
assert.match(publicProfilePage, /artisanProfileReportUrl\(profile\.username\)/, "public profiles must offer the handle-only Artisan safety-report path");

for (const path of [
  "src/pages/Account/AccountDataExportPage.tsx",
  "src/pages/Account/AccountDeletionPage.tsx",
]) {
  const page = read(path);
  assert.match(page, /PageMetadata/, `${path} must set route metadata`);
  assert.match(page, /private local Elysia/i, `${path} must state the private-Elysia boundary`);
}

console.log("Online shared identity UI smoke test passed.");

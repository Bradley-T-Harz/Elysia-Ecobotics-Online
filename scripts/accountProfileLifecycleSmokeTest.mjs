import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (path) => fs.readFile(path, "utf8");
const [
  app, homebase, settings, privacy, notifications, signalConsole,
  password, deactivation, reactivation, deletion, lifecycleForm,
  participationClient, boundary, worker, database, migration, styles,
] = await Promise.all([
  read("src/App.tsx"),
  read("src/pages/The-Commons-Circle/index.tsx"),
  read("src/pages/The-Commons-Circle/AccountSettingsPage.tsx"),
  read("src/pages/The-Commons-Circle/AccountPrivacySettingsPage.tsx"),
  read("src/pages/The-Commons-Circle/AccountNotificationPreferencesPage.tsx"),
  read("src/pages/The-Commons-Circle/SignalConsolePage.tsx"),
  read("src/pages/Account/AccountChangePasswordPage.tsx"),
  read("src/pages/Account/AccountDeactivationPage.tsx"),
  read("src/pages/Account/AccountReactivationPage.tsx"),
  read("src/pages/Account/AccountDeletionPage.tsx"),
  read("src/shared/participation/AccountLifecycleRequestForm.tsx"),
  read("src/shared/participation/participationClient.ts"),
  read("src/shared/auth/AccountActivationBoundary.tsx"),
  read("services/identity-worker/worker.ts"),
  read("services/identity-worker/_shared/database.ts"),
  read("supabase/migrations/20260829010000_self_service_account_activation.sql"),
  read("src/styles.css"),
]);

for (const route of [
  "commons-circle/settings", "commons-circle/settings/privacy",
  "commons-circle/settings/notifications", "commons-circle/settings/appearance",
  "account/change-password", "account/deactivate", "account/reactivate",
]) assert.match(app, new RegExp(`path="${route.replaceAll("/", "\\/")}"`), `App omits ${route}.`);
assert.match(app, /location\.hash === "#privacy-lanterns"[\s\S]*?\/commons-circle\/settings\/privacy/);

for (const heading of [
  "Profile & Appearance", "Privacy & Public Profile", "Notifications & Communication",
  "Account & Security", "Data & Lifecycle", "Support & Billing",
]) assert.match(settings, new RegExp(heading), `Settings omits ${heading}.`);
for (const control of ["Change Password", "Temporarily Deactivate Account", "Permanently Delete Account"]) {
  assert.match(settings, new RegExp(control));
}
assert.match(settings, /account-security-control/);
assert.match(homebase, /Private Account Homebase/);
assert.match(homebase, /to="\/commons-circle\/settings">Account &amp; Profile Settings/);
assert.doesNotMatch(homebase, /PublicProfilePublicationPanel|AccountEventPreferencesPanel|Privacy Lanterns|Customization Studio/);

assert.match(privacy, /<PublicProfilePublicationPanel/);
assert.match(privacy, /Object\.entries\(visibility\)/);
assert.match(privacy, /saveVisibilitySettings\(visibility\)/);
assert.match(notifications, /<AccountEventPreferencesPanel/);
assert.match(notifications, /saveNotificationPreferences\(legacy\)/);
assert.match(notifications, /\/commons-circle\/signals\/inbox\/settings/);
assert.match(signalConsole, /to="\/commons-circle\/settings\/notifications">Notification Preferences/);
assert.match(signalConsole, /to="\/commons-circle\/settings">Open Account &amp; Profile Settings/);

assert.match(password, /supabase\.auth\.updateUser\(\{ password \}\)/);
assert.match(password, /signOut\(\{ scope: "others" \}\)/);
assert.doesNotMatch(password, /userId|targetUser|searchParams|URLSearchParams/);
assert.match(deactivation, /confirmation !== "DEACTIVATE"/);
assert.match(deactivation, /signOut\(\{ scope: "global" \}\)/);
assert.match(reactivation, /confirmation !== "REACTIVATE"/);
assert.match(reactivation, /bootstrap\.communityAccess\.participationState/);
assert.match(boundary, /bootstrap\?\.accountActivation\?\.state === "temporarily_deactivated"/);
assert.match(boundary, /to="\/account\/reactivate"/);
assert.doesNotMatch(boundary, /reactivateCurrentAccount/);

assert.match(deletion, /Permanently Delete Account/);
assert.match(deletion, /<AccountLifecycleRequestForm action="deletion"/);
assert.match(lifecycleForm, /confirmationPhrase !== "DELETE"/);
assert.match(lifecycleForm, /requestCommunityLifecycleAction/);

const deactivateHandler = worker.slice(worker.indexOf("const accountDeactivate"), worker.indexOf("const accountReactivate"));
const reactivateHandler = worker.slice(worker.indexOf("const accountReactivate"), worker.indexOf("const lifecycleRequests"));
for (const [name, handler, confirmation] of [
  ["deactivation", deactivateHandler, "DEACTIVATE"],
  ["reactivation", reactivateHandler, "REACTIVATE"],
]) {
  assert.match(handler, /exactKeys\(body, \["clientRequestId", "confirmation", "turnstileToken"\]\)/, `${name} accepts an unexpected field.`);
  assert.match(handler, new RegExp(`!== "${confirmation}"`));
  assert.match(handler, /actorUserId: auth\.userId/);
  assert.match(handler, /requireRateLimit\(env, auth\.userId, "lifecycle"\)/);
  assert.match(handler, /action: "identity_lifecycle_request"/);
  assert.doesNotMatch(handler, /targetUserId|affectedAccountId|body\.(?:userId|accountId)/);
}
assert.match(database, /"community_self_deactivate_actor"/);
assert.match(database, /"community_self_reactivate_actor"/);
assert.match(participationClient, /body: input/);

for (const marker of [
  "private.account_activation_state", "temporarily_deactivated",
  "private.community_account_is_active", "private.community_legacy_online_profile_is_public",
  "self_deactivation_requested", "self_deactivation_completed", "self_reactivation_completed",
]) assert.ok(migration.includes(marker), `Migration omits ${marker}.`);
const deactivateRpc = migration.slice(
  migration.indexOf("create or replace function public.community_self_deactivate_actor"),
  migration.indexOf("create or replace function public.community_self_reactivate_actor"),
);
const reactivateRpc = migration.slice(
  migration.indexOf("create or replace function public.community_self_reactivate_actor"),
  migration.indexOf("create or replace function public.current_user_artisan_bootstrap"),
);
for (const rpc of [deactivateRpc, reactivateRpc]) {
  assert.doesNotMatch(rpc, /update private\.account_participation|update public\.profiles|update public\.profile_public_cards/);
  assert.match(rpc, /p_actor_user_id/);
  assert.doesNotMatch(rpc, /p_target_user_id|p_account_id/);
}
assert.match(migration, /grant execute on function public\.community_self_deactivate_actor\(uuid, uuid\) to service_role/);
assert.match(migration, /grant execute on function public\.community_self_reactivate_actor\(uuid, uuid\) to service_role/);
assert.match(migration, /revoke all on private\.account_activation_state from public, anon, authenticated, service_role/);
assert.match(styles, /\.account-security-control[\s\S]*?background: linear-gradient\(180deg, #ffb35f, #f27a18\)/);
assert.match(styles, /\.account-settings-links \.button-link,[\s\S]*?min-height: 44px/);

console.log("Account, profile settings, and lifecycle smoke checks ok.");

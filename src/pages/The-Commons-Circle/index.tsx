import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { COMMONS_BACKGROUND_STYLES, getCommonsBackgroundStyleOption, normalizeCommonsBackgroundStyle } from "../../shared/commonsBackgroundStyles";
import CommonsBackgroundAtmosphere from "../../shared/components/CommonsBackgroundAtmosphere";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import type { AppRole } from "../../shared/review/reviewClient";
import { CommonsCircleAdminEntryCard, userCanOpenCommonsAdminConsole } from "./CommonsCircleAdminConsolePage";
import {
  commonsStorageKeys,
  defaultCustomization,
  defaultNotificationPreferences,
  defaultVisibility,
  freeMemberFallbackBadge,
  loadCommonsHomebase,
  markAllNotificationsRead,
  markNotificationRead,
  readLocalStorage,
  removeProfileMedia,
  saveCustomization,
  saveNotificationPreferences,
  saveVisibilitySettings,
  syncLocalLivingLibraryToAccount,
  updateBadgeVisibility,
  uploadProfileMedia,
  writeLocalStorage
} from "./commonsCircleApi";
import type { CommonsHomebaseData, NotificationPreferences, ProfileCustomization, UserBadge, VisibilitySettings } from "./commonsCircleApi";

type OnboardingState = { skippedStewardship?: boolean; welcomed?: boolean; completed?: boolean; completedAt?: string; membershipTier?: "Free Member" };
type StewardshipDraft = { status?: "draft_local" | "pending_admin_review_local" };

const membershipTiers = [
  { name: "Free Member", purpose: "Default account tier for participation in the public website commons. No donation is required.", awarded: "Default tier after account/profile creation.", status: "Default tier", note: "No private Elysia access." },
  { name: "Contributor Member", purpose: "Recognition for constructive publishing, helpful community work, source suggestions, troubleshooting support, documentation, add-ons, research notes, or other contributions.", awarded: "Awarded by administrator review.", status: "Admin-awarded later", note: "Does not grant hidden authority." },
  { name: "Steward Member", purpose: "Recognition for verified stewardship support, such as direct support for independent nonprofits or other meaningful public-benefit stewardship.", awarded: "Recognition is reviewed before being awarded.", status: "Stewardship verification", note: "Not payment to Elysia." },
  { name: "Guardian / Reviewer", purpose: "A trust role for moderation, review, safety, source review, marketplace review, or Commune review.", awarded: "Manually assigned by an administrator. Never self-assigned.", status: "Trust role", note: "No self-assignment." },
  { name: "Founding Steward", purpose: "Early project recognition for meaningful early support of Elysia Ecobotics and the commons around her.", awarded: "Manually assigned by an administrator.", status: "Early recognition", note: "Not pay-to-win power." }
];

const themeModes = ["deep_grove", "starlit_archive", "solar_meadow", "moonlit_reef", "aether_blue", "high_contrast"];
const decalOptions = ["none", "leaf_glyph", "water_ripple", "star_map", "mushroom_badge", "circuit_vine", "pollinator", "wetland_reed", "moon_crest", "robotic_seed"];
function BadgeRow({ labels }: { labels: string[] }) {
  return <div className="commons-badge-row">{labels.filter(Boolean).map((label) => <span key={label}>{label}</span>)}</div>;
}

function BadgeIcon({ badge }: { badge: UserBadge }) {
  const [failed, setFailed] = useState(false);
  return <div className="medallion-icon-frame">{badge.icon_path && !failed ? <img className="medallion-icon" src={badge.icon_path} alt={`${badge.name} badge icon`} onError={() => setFailed(true)} /> : <span className="medallion-glyph">✦</span>}</div>;
}

function badgeLabels(badge: UserBadge) {
  return [badge.rarity, ...(badge.tags ?? [badge.category || badge.badge_type]), badge.authority || badge.authority_linked ? "authority-linked recognition" : "recognition", badge.award_source || badge.award_mode || "review-awarded", "earned"];
}

function EmptyState({ children }: { children: string }) {
  return <p className="commons-empty-state">{children}</p>;
}

function MiniFact({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function privacyLabel(key: string) {
  return key.replace(/^show_/, "show ").replace(/_/g, " ");
}

function classToken(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9_-]/gi, "_");
}

function customizationClass(settings: ProfileCustomization) {
  return `commons-theme-${classToken(settings.theme_mode, "starlit_archive")} commons-background-${classToken(normalizeCommonsBackgroundStyle(settings.background_style), "soft_cyber_garden")} commons-layout-${classToken(settings.profile_layout, "classic_homebase")}`;
}

function formatDecalLabel(value: string) {
  return value.replace(/_/g, " ");
}

function visibleDecals(settings: ProfileCustomization) {
  const decals = settings.selected_decals?.length ? settings.selected_decals : settings.decal_set && settings.decal_set !== "none" ? [settings.decal_set] : [];
  return decals.filter(Boolean);
}

function styleSignature(settings: ProfileCustomization) {
  return JSON.stringify({
    theme_mode: settings.theme_mode || defaultCustomization.theme_mode,
    accent_color: settings.accent_color || defaultCustomization.accent_color,
    background_style: normalizeCommonsBackgroundStyle(settings.background_style),
    decal_set: settings.decal_set || defaultCustomization.decal_set,
    selected_decals: [...(settings.selected_decals ?? [])].sort(),
    profile_layout: settings.profile_layout || defaultCustomization.profile_layout
  });
}

function DecalStrip({ settings }: { settings: ProfileCustomization }) {
  const decals = visibleDecals(settings);
  if (!decals.length) return null;
  return <div className="commons-decal-strip" aria-label="Selected profile decals">{decals.map((decal) => <span className="commons-decal-chip" key={decal}>{formatDecalLabel(decal)}</span>)}</div>;
}


function isBackendDiagnostic(message: string) {
  return /not configured yet|temporarily unavailable|Could not find|schema cache|permission denied|row-level security|violates row-level security|Account-backed data|Account storage/i.test(message);
}

function logDiagnostics(scope: string, warnings: string[]) {
  if (import.meta.env.DEV && warnings.length) console.warn(`[Commons Circle ${scope}]`, warnings);
}

function polishedActionMessages(scope: string, warnings: string[], fallback: string) {
  if (!warnings.length) return [];
  logDiagnostics(scope, warnings);
  return warnings.some(isBackendDiagnostic) ? [fallback] : warnings;
}

export default function CommonsCirclePage() {
  const [homebase, setHomebase] = useState<CommonsHomebaseData | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [visibilityDraft, setVisibilityDraft] = useState<VisibilitySettings>(defaultVisibility);
  const [customizationDraft, setCustomizationDraft] = useState<ProfileCustomization>(defaultCustomization);
  const [savedCustomization, setSavedCustomization] = useState<ProfileCustomization>(defaultCustomization);
  const [notificationDraft, setNotificationDraft] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [syncChoice, setSyncChoice] = useState(() => readLocalStorage<{ choice?: string }>(commonsStorageKeys.syncChoice, {}));
  const [onboardingDone, setOnboardingDone] = useState<OnboardingState>(() => readLocalStorage(commonsStorageKeys.onboarding, { skippedStewardship: false, welcomed: false }));
  const [verificationDrafts, setVerificationDrafts] = useState<StewardshipDraft[]>(() => readLocalStorage(commonsStorageKeys.stewardshipDrafts, []));
  const [contributionRequests, setContributionRequests] = useState<unknown[]>(() => readLocalStorage(commonsStorageKeys.contributionRequests, []));
  const [roleState, setRoleState] = useState<{ roles: AppRole[]; isAdmin: boolean; signedIn: boolean; warnings: string[] }>({ roles: [], isAdmin: false, signedIn: false, warnings: [] });

  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  const refreshLocalCounts = useCallback(() => {
    setOnboardingDone(readLocalStorage(commonsStorageKeys.onboarding, { skippedStewardship: false, welcomed: false }));
    setVerificationDrafts(readLocalStorage(commonsStorageKeys.stewardshipDrafts, []));
    setContributionRequests(readLocalStorage(commonsStorageKeys.contributionRequests, []));
    setSyncChoice(readLocalStorage(commonsStorageKeys.syncChoice, {}));
  }, []);

  const refreshHomebase = useCallback(async (options?: { preserveCustomization?: ProfileCustomization }) => {
    refreshLocalCounts();
    const [result, roles] = await Promise.all([loadCommonsHomebase(), loadCurrentRoleState()]);
    const localCustomization = readLocalStorage<ProfileCustomization | null>("commonsCircle.customizationDemo.v1", null);
    const customizationWarnings = result.warnings.some((warning) => /Profile customization|profile_customization/i.test(warning));
    setHomebase(result);
    setRoleState({ roles: roles.roles, isAdmin: roles.isAdmin, signedIn: roles.signedIn, warnings: roles.warnings });
    setVisibilityDraft(result.visibility);
    setSavedCustomization(result.customization);
    setCustomizationDraft(options?.preserveCustomization ?? (customizationWarnings && localCustomization ? { ...result.customization, ...localCustomization } : result.customization));
    setNotificationDraft(result.notificationPreferences);
    logDiagnostics("homebase", result.warnings);
    logDiagnostics("role-state", roles.warnings);
  }, [refreshLocalCounts]);

  useEffect(() => { void refreshHomebase(); }, [refreshHomebase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("commons-circle-onboarding") : null;
    const onComplete = () => {
      void refreshHomebase();
      pushMessage("Commons Circle setup updated. Website Account, Commons Profile, and account shelves were refreshed.");
    };
    channel?.addEventListener("message", (event) => { if (event.data?.type === "commons-circle-onboarding-complete") onComplete(); });
    const onStorage = (event: StorageEvent) => {
      const refreshKeys: string[] = [commonsStorageKeys.onboarding, commonsStorageKeys.stewardshipDrafts, commonsStorageKeys.contributionRequests];
      if (event.key && refreshKeys.includes(event.key)) onComplete();
    };
    window.addEventListener("storage", onStorage);
    return () => { channel?.close(); window.removeEventListener("storage", onStorage); };
  }, [pushMessage, refreshHomebase]);

  const profile = homebase?.profile ?? null;
  const profileSetupComplete = Boolean(profile?.commons_onboarding_completed_at || onboardingDone.completed);
  const publicProfilePath = profile?.username ? `/commons-circle/@${encodeURIComponent(profile.username)}` : "/commons-circle/setup/profile";
  const pendingRecognitionCount = verificationDrafts.filter((draft) => draft.status === "pending_admin_review_local").length;
  const localLivingCount = homebase?.localLiving.savedSourceIds.length ?? 0;
  const shouldPromptSync = Boolean(homebase?.signedIn && localLivingCount > 0 && syncChoice.choice !== "synced" && syncChoice.choice !== "keep_local");
  const unreadCount = homebase?.notifications.filter((notice) => !notice.read_at).length ?? 0;
  const codeProposalSignalCount = homebase?.notifications.filter((notice) => /code_revision|proposal/i.test(`${notice.notification_type ?? ""} ${notice.source_type ?? ""}`)).length ?? 0;
  const troubleshootingSignalCount = homebase?.notifications.filter((notice) => /troubleshooting|fix_proposed|resolution/i.test(`${notice.notification_type ?? ""} ${notice.source_type ?? ""}`)).length ?? 0;
  const homeStyle = { "--commons-accent": savedCustomization.accent_color || "#8ee8dc" } as CSSProperties;
  const homebaseClasses = `page-stack commons-circle-page commons-homebase ${customizationClass(savedCustomization)}`;
  const previewClasses = `commons-customization-preview commons-homebase ${customizationClass(customizationDraft)}`;
  const hasUnsavedCustomization = styleSignature(customizationDraft) !== styleSignature(savedCustomization);
  const earnedBadges = useMemo(() => {
    const earned = homebase?.userBadges.filter((badge) => badge.earned && !badge.revoked_at) ?? [];
    const hasFreeMember = earned.some((badge) => badge.badge_key === "free_member");
    return profile && profileSetupComplete && !hasFreeMember ? [freeMemberFallbackBadge(profile.commons_onboarding_completed_at ?? onboardingDone.completedAt), ...earned] : earned;
  }, [homebase?.userBadges, onboardingDone.completedAt, profile, profileSetupComplete]);
  const adminEntryAllowed = userCanOpenCommonsAdminConsole(homebase, roleState);

  async function saveVisibility() {
    if (!homebase?.signedIn) {
      writeLocalStorage("commonsCircle.publicVisibilityDemo.v1", visibilityDraft);
      pushMessage("Visibility settings saved locally. Sign in to save account-backed public profile visibility.");
      return;
    }
    const warnings = await saveVisibilitySettings(visibilityDraft);
    const visibleMessages = polishedActionMessages("visibility", warnings, "Public profile visibility saving is not active yet. Your current choices remain available in this browser for now.");
    visibleMessages.forEach(pushMessage);
    if (!visibleMessages.length) pushMessage("Public profile visibility saved to your Website Account.");
    await refreshHomebase();
  }

  function updateCustomizationDraft(patch: Partial<ProfileCustomization>) {
    const normalizedPatch = patch.background_style === undefined ? patch : { ...patch, background_style: normalizeCommonsBackgroundStyle(patch.background_style) };
    setCustomizationDraft((current) => ({ ...current, ...normalizedPatch }));
  }

  function toggleSelectedDecal(decal: string) {
    setCustomizationDraft((current) => {
      const selected = current.selected_decals ?? [];
      return { ...current, selected_decals: selected.includes(decal) ? selected.filter((item) => item !== decal) : [...selected, decal] };
    });
  }

  function revertCustomizationPreview() {
    setCustomizationDraft(savedCustomization);
    pushMessage("Customization preview reverted to the saved public profile style.");
  }

  async function saveProfileRoom() {
    const savedDraft = { ...customizationDraft, background_style: normalizeCommonsBackgroundStyle(customizationDraft.background_style) };
    if (!homebase?.signedIn) {
      writeLocalStorage("commonsCircle.customizationDemo.v1", savedDraft);
      setSavedCustomization(savedDraft);
      pushMessage("Customization saved locally in this browser. Sign in to publish these style choices to your public profile.");
      return;
    }
    const warnings = await saveCustomization(savedDraft);
    const visibleMessages = polishedActionMessages("customization", warnings, "Saved locally in this browser. Account sync is unavailable until the profile customization table/policies are active.");
    if (visibleMessages.length) {
      writeLocalStorage("commonsCircle.customizationDemo.v1", savedDraft);
      visibleMessages.forEach(pushMessage);
      setCustomizationDraft(savedDraft);
      return;
    }
    setSavedCustomization(savedDraft);
    pushMessage("Customization saved. Your public profile will use these style choices.");
    await refreshHomebase({ preserveCustomization: savedDraft });
  }

  async function saveNoticePrefs() {
    const warnings = await saveNotificationPreferences(notificationDraft);
    const visibleMessages = polishedActionMessages("notifications", warnings, "Notification preferences are not active yet. Signals will appear here when this section is ready.");
    visibleMessages.forEach(pushMessage);
    if (!visibleMessages.length) pushMessage("Notification preferences saved.");
    await refreshHomebase();
  }

  async function syncLivingLibrary() {
    const result = await syncLocalLivingLibraryToAccount();
    const visibleMessages = polishedActionMessages("living-library-sync", result.warnings, "Living Library account sync is not active yet. Your browser-local saves are still safe in this browser.");
    visibleMessages.forEach(pushMessage);
    pushMessage(visibleMessages.length ? `Living Library sync prepared ${result.synced} item changes before account storage stopped.` : `Synced ${result.synced} Living Library saved item changes to your Website Account.`);
    await refreshHomebase();
  }

  async function handleProfileMedia(file: File | null, mediaType: "avatar" | "banner") {
    if (!file) return;
    const result = await uploadProfileMedia(file, mediaType);
    polishedActionMessages("profile-media", result.warnings, "Public profile media upload is not active yet. No file was published.").forEach(pushMessage);
    if (result.publicUrl) {
      const nextDraft = { ...customizationDraft, [mediaType === "avatar" ? "avatar_url" : "banner_url"]: result.publicUrl };
      setCustomizationDraft(nextDraft);
      setSavedCustomization((current) => ({ ...current, [mediaType === "avatar" ? "avatar_url" : "banner_url"]: result.publicUrl }));
      pushMessage(`${mediaType === "avatar" ? "Avatar" : "Banner"} uploaded as public profile media. Private files still never use this bucket.`);
      await refreshHomebase({ preserveCustomization: nextDraft });
    }
  }

  async function handleRemoveProfileMedia(mediaType: "avatar" | "banner") {
    const warnings = await removeProfileMedia(mediaType);
    polishedActionMessages("profile-media-remove", warnings, "Public profile media removal is not active yet.").forEach(pushMessage);
    if (!warnings.length) {
      const nextDraft = { ...customizationDraft, [mediaType === "avatar" ? "avatar_url" : "banner_url"]: null };
      setCustomizationDraft(nextDraft);
      setSavedCustomization((current) => ({ ...current, [mediaType === "avatar" ? "avatar_url" : "banner_url"]: null }));
      pushMessage(`${mediaType === "avatar" ? "Avatar" : "Banner"} removed from public profile display. Initials fallback remains available.`);
      await refreshHomebase({ preserveCustomization: nextDraft });
    }
  }

  return (
    <div className={homebaseClasses} style={homeStyle}>
      <PageHero eyebrow="Membership" title="The Commons Circle" brandMark="standard">
        <p>Membership is not a gate around Elysia. It is a way to help sustain the public commons around her.</p>
        <p>A Commons account helps you participate in the public ecosystem around Elysia: Marketplace, Developer Forge, Living Library, Commune, saved items, stewardship recognition, and public contributions. It does not unlock private local Elysia memory and does not sync private local files, logs, passwords, or credentials by default.</p>
      </PageHero>

      {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}

      <section className="commons-doctrine-grid">
        <WarningCallout title="No private local sync"><p>This is an Elysia Ecobotics Online account hub, not a local Elysia account. Private local Elysia memory, vaults, files, logs, passwords, credentials, and machine data do not sync by default.</p></WarningCallout>
        <WarningCallout title="Donation boundary"><p>A donation is never paid to Elysia Ecobotics through this page. Members may support independent stewardship organizations directly, then optionally request recognition with redacted proof.</p></WarningCallout>
        <WarningCallout title="Administrator authority"><p>Membership recognition does not buy authority over Elysia. Guardian, reviewer, moderator, administrator, and trust roles are assigned by authorized administrators.</p></WarningCallout>
      </section>

      <section className="two-column commons-account-panels">
        <div className="commons-account-start">
          {!homebase?.signedIn && <div className="boundary-note"><strong>Start here:</strong> create or sign in to your Website Account first. This is the actual authentication account for Elysia Ecobotics Online.</div>}
          {homebase?.signedIn && <div className="boundary-note"><strong>Website Account active.</strong> This public Elysia Ecobotics Online account remains separate from the private local Elysia core. Do not use or reuse a local Elysia password here.</div>}
          <AuthPanel
            onMessage={pushMessage}
            onAuthChanged={refreshHomebase}
            copy={{
              eyebrow: "Website Account",
              title: homebase?.signedIn ? "Website Account" : "Create or Sign In to Website Account",
              description: "This is your public Elysia Ecobotics Online account. It is separate from the private local Elysia core. Do not use your local Elysia password here.",
              signedOutText: "No active website session.",
              confirmationPath: "/commons-circle",
              confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to the site; the session should appear after Supabase completes the redirect."
            }}
          />
        </div>
        <section className="section-card commons-profile-setup-card">
          <p className="eyebrow">Commons Profile</p>
          <h2>{profile ? profileSetupComplete ? "Commons Profile setup complete" : "Finish Commons Profile setup" : "Create Commons Profile"}</h2>
          <p>Your Commons Profile is the public profile connected to your signed-in Website Account. It is not a second account and not a second login.</p>
          {!profile && <p className="boundary-note">Create or sign in to a Website Account first, then start the Commons Profile setup wizard. The first profile screen is a draft; the profile is not finalized until the final confirmation step.</p>}
          {profile && !profileSetupComplete && <p className="boundary-note">Finish Commons Profile setup to complete the missing stewardship and Work With steps without creating a duplicate profile.</p>}
          {profile && <dl className="mini-facts"><MiniFact label="Username" value={profile.username} /><MiniFact label="Display name" value={profile.display_name || "Not set"} /><MiniFact label="Developer" value={profile.is_developer ? "Requested / visible" : "Pending / No"} /><MiniFact label="Admin" value={profile.is_admin ? "Yes" : "No"} /></dl>}
          <div className="button-row"><a className="button-link button-link--primary" href="/commons-circle/setup/profile">{profile ? profileSetupComplete ? "Review setup / update profile" : "Finish Commons Profile setup" : "Start Commons Profile setup"}</a></div>
          <p className="boundary-note">Admin, moderator, reviewer, developer trust, and other authority roles cannot be self-assigned in this UI. Local Elysia linking must be explicit, narrow, revocable, and controlled by local Elysia.</p>
        </section>
      </section>

      <section className="section-card commons-homebase-hero">
        <div className="commons-profile-mantle" style={savedCustomization.banner_url ? { backgroundImage: `linear-gradient(135deg, rgba(10, 20, 22, .35), rgba(18, 44, 48, .4)), url(${savedCustomization.banner_url})` } : undefined}>
          <CommonsAvatarViewer src={savedCustomization.avatar_url} alt="Commons profile avatar" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full Commons profile picture" />
          <div>
            <p className="eyebrow">Private Account Homebase</p>
            <h2>{profile?.display_name || profile?.username || "Website member"}</h2>
            <p>{profile?.username ? `@${profile.username}` : "Sign in and create a Commons Profile to claim your public handle."}</p>
          </div>
        </div>
        <dl className="mini-facts">
          <MiniFact label="Tier" value="Free Member" />
          <MiniFact label="Setup" value={profileSetupComplete ? "Complete" : "Needs setup"} />
          <MiniFact label="Unread signals" value={unreadCount} />
          <MiniFact label="Saved shelves" value={(homebase?.savedAddons.length ?? 0) + (homebase?.savedLivingSources.length ?? 0) + (homebase?.sourceCollections.length ?? 0)} />
        </dl>
        <DecalStrip settings={savedCustomization} />
        <div className="button-row">
          {profile?.username ? <Link className="button-link button-link--primary" to={publicProfilePath}>View public profile</Link> : <span className="button-link button-link--disabled" aria-disabled="true">Add a username to view public profile</span>}
          <a className="button-link" href="/commons-circle/setup/profile">Edit profile setup</a>
          <a className="button-link" href="#customization-studio">Customize circle</a>
          <a className="button-link" href="#privacy-lanterns">Privacy settings</a>
          {adminEntryAllowed && <a className="button-link" href="/commons-circle/admin-console">Admin Console</a>}
        </div>
      </section>

      {adminEntryAllowed && <CommonsCircleAdminEntryCard />}

      {shouldPromptSync && <section className="section-card commons-sync-card">
        <p className="eyebrow">Explicit sync available</p>
        <h2>You have browser-local Living Library saves.</h2>
        <p>Sync them to your Website Account only if you choose. Elysia Ecobotics Online will not upload browser-local saved items silently.</p>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => void syncLivingLibrary()}>Sync now</button><button type="button" onClick={() => { writeLocalStorage(commonsStorageKeys.syncChoice, { choice: "keep_local", decidedAt: new Date().toISOString() }); setSyncChoice({ choice: "keep_local" }); }}>Keep local only</button><button type="button" onClick={() => { writeLocalStorage(commonsStorageKeys.syncChoice, { choice: "not_now", decidedAt: new Date().toISOString() }); setSyncChoice({ choice: "not_now" }); }}>Not now</button></div>
      </section>}

      <section className="commons-homebase-grid">
        <article className="section-card commons-signal-feed">
          <p className="eyebrow">Signal Feed</p>
          <h2>Notifications and review signals</h2>
          <dl className="mini-facts"><MiniFact label="Unread" value={unreadCount} /><MiniFact label="Code proposals" value={codeProposalSignalCount} /><MiniFact label="Troubleshooting" value={troubleshootingSignalCount} /></dl>
          <p className="boundary-note">This is a preview. The full private Signal Console handles Coding Cornucopia proposal decisions, Troubleshooting Grove proposed fixes/status updates, Research Notes citation/source activity, accepted/rejected outcomes, sandbox signals, and review notices.</p>
          <Link className="button-link button-link--primary" to="/commons-circle/signals">Open Signal Console</Link>
          {!homebase?.notifications.length && <EmptyState>No notifications yet. Review status, followed threads, and marketplace updates will appear here when account-backed events exist.</EmptyState>}
          {homebase?.notifications.map((notice) => <div className="commons-preview-card" key={notice.id}><strong>{notice.title}</strong><p>{notice.body || notice.notification_type || "Account signal"}</p><span>{notice.read_at ? "read" : "unread"}</span><div className="button-row"><button type="button" onClick={async () => { polishedActionMessages("notification-read", await markNotificationRead(notice.id), "Notification actions are not active yet.").forEach(pushMessage); await refreshHomebase(); }}>Mark read</button>{notice.action_url && <a className="button-link" href={notice.action_url}>Open</a>}</div></div>)}
          {homebase?.notifications.length ? <button type="button" onClick={async () => { polishedActionMessages("notifications-read-all", await markAllNotificationsRead(), "Notification actions are not active yet.").forEach(pushMessage); await refreshHomebase(); }}>Mark all read</button> : null}
        </article>

        <article className="section-card">
          <p className="eyebrow">Requests and review status</p>
          <h2>Private request status</h2>
          <dl className="mini-facts"><MiniFact label="Stewardship local pending" value={pendingRecognitionCount} /><MiniFact label="Contribution help drafts" value={contributionRequests.length} /><MiniFact label="Work With / review queues" value="private; account-backed when submitted" /></dl>
          <p className="boundary-note">Work With requests, resumes/CVs, stewardship receipts/proofs, admin review data, and private drafts are never shown on the public profile.</p>
        </article>
      </section>

      <section className="section-card commons-shelves">
        <p className="eyebrow">Saved Shelves</p>
        <h2>Your private saved archive room</h2>
        <p>Your saved add-ons, sources, citations, collections, Commune posts, and followed threads live together in your Saved Shelves.</p>
        <dl className="mini-facts">
          <MiniFact label="Add-ons" value={homebase?.savedAddons.length ?? 0} />
          <MiniFact label="Sources" value={(homebase?.savedLivingSources.length ?? 0) + (homebase?.localLiving.savedSources.length ?? 0)} />
          <MiniFact label="Citations" value={(homebase?.savedCitations.length ?? 0) + (homebase?.localLiving.savedCitations.length ?? 0)} />
          <MiniFact label="Collections" value={(homebase?.sourceCollections.length ?? 0) + (homebase?.localLiving.collections.length ?? 0)} />
          <MiniFact label="Commune" value={(homebase?.communePosts.length ?? 0) + (homebase?.localCommuneDrafts.length ?? 0)} />
          <MiniFact label="Threads" value={(homebase?.followedThreads.length ?? 0) + (homebase?.localFollowedThreads.length ?? 0)} />
        </dl>
        <div className="button-row"><a className="button-link button-link--primary" href="/commons-circle/saved-shelves">Open Saved Shelves</a><span className="commons-empty-state">Private by default. Public profile visibility is controlled separately.</span></div>
      </section>

      <section className="section-card commons-membership-status">
        <p className="eyebrow">Membership Status</p>
        <h2>Free Member by default</h2>
        <dl className="mini-facts"><MiniFact label="Current tier" value="Free Member" /><MiniFact label="Setup complete" value={profileSetupComplete ? "Yes" : "Not yet"} /><MiniFact label="Pending recognition drafts" value={pendingRecognitionCount} /><MiniFact label="Contribution help drafts" value={contributionRequests.length} /><MiniFact label="Developer" value={profile?.is_developer ? "Requested / visible" : "Pending / No"} /><MiniFact label="Admin" value={profile?.is_admin ? "Yes" : "No"} /></dl>
        <p className="boundary-note">Membership tiers and badges are ultimately assigned by authorized administrators. Donation proof may support Steward recognition, but it does not create administrator, moderator, reviewer, developer, paid role, or guardian authority.</p>
      </section>

      <section className="section-card commons-medallion-wall">
        <p className="eyebrow">Medallion Wall</p>
        <h2>Badges are recognition, not authority</h2>
        <div className="commons-medallion-grid">{earnedBadges.map((badge) => <article className={`earned${badge.authority || badge.authority_linked ? " authority-linked" : ""}`} key={badge.badge_key}><BadgeIcon badge={badge} /><h3>{badge.name}</h3><p>{badge.description}</p>{badge.rule_summary && <p className="commons-medallion-note">{badge.rule_summary}</p>}{badge.note && <p className="commons-medallion-note">{badge.note}</p>}<BadgeRow labels={badgeLabels(badge)} />{badge.award_source === "local_fallback" ? <p className="commons-medallion-note">Free Member is shown because your Commons Profile is complete. Live badge storage will record it after the Free Member migration/RPC is active.</p> : <label className="checkbox-line"><span>Visibility</span><select value={badge.visibility || "public"} onChange={async (event) => { polishedActionMessages("badge-visibility", await updateBadgeVisibility(badge.badge_key, event.target.value as "public" | "private"), "Badge visibility controls are not active yet.").forEach(pushMessage); await refreshHomebase(); }}><option value="public">public</option><option value="private">private</option></select></label>}</article>)}</div>{!earnedBadges.length && <EmptyState>No badges awarded yet. Free Member appears after your Commons Profile is completed. Badges are recognition, not authority.</EmptyState>}
      </section>

      <section className="commons-tier-grid">{membershipTiers.map((tier) => <article className="section-card commons-tier-card" key={tier.name}><p className="eyebrow">{tier.status}</p><h3>{tier.name}</h3><p>{tier.purpose}</p><p><strong>How awarded:</strong> {tier.awarded}</p><p className="boundary-note">{tier.note}</p></article>)}</section>

      <section className="section-card commons-studio" id="customization-studio">
        <p className="eyebrow">Customization Studio</p>
        <h2>Shape your public profile room</h2>
        <p>Avatar and banner media update immediately when selected. Theme, accent, background, decorative marker, and layout choices preview here first and publish to your public profile when you press Save customization. Do not upload receipts, resumes, private screenshots, credentials, or local Elysia material here.</p>
        <p className={hasUnsavedCustomization ? "boundary-note commons-unsaved-preview" : "commons-empty-state"}>
          {hasUnsavedCustomization ? "Unsaved preview. Press Save customization to publish these style choices to your public profile." : "Saved customization is live on your public profile. New style changes will preview here before saving."}
        </p>
        <div className="commons-studio-grid">
          <div className="commons-studio-controls">
            <label><span>Theme mode</span><select value={customizationDraft.theme_mode} onChange={(event) => updateCustomizationDraft({ theme_mode: event.target.value })}>{themeModes.map((theme) => <option key={theme} value={theme}>{theme}</option>)}</select></label>
            <label><span>Accent color</span><input type="color" value={customizationDraft.accent_color} onChange={(event) => updateCustomizationDraft({ accent_color: event.target.value })} /></label>
            <label><span>Background style</span><select value={normalizeCommonsBackgroundStyle(customizationDraft.background_style)} onChange={(event) => updateCustomizationDraft({ background_style: event.target.value })}>{COMMONS_BACKGROUND_STYLES.map((style) => <option key={style.key} value={style.key}>{style.label}</option>)}</select></label>
            <label><span>Decorative marker set</span><select value={customizationDraft.decal_set} onChange={(event) => updateCustomizationDraft({ decal_set: event.target.value })}>{decalOptions.map((decal) => <option key={decal} value={decal}>{decal}</option>)}</select></label>
            <label><span>Profile layout</span><select value={customizationDraft.profile_layout} onChange={(event) => updateCustomizationDraft({ profile_layout: event.target.value })}><option value="classic_homebase">classic_homebase</option><option value="compact_archive">compact_archive</option><option value="garden_shelves">garden_shelves</option></select></label>
          </div>
          <fieldset className="commons-decal-picker"><legend>Selected decorative markers</legend>{decalOptions.filter((decal) => decal !== "none").map((decal) => <label className="checkbox-line" key={decal}><input type="checkbox" checked={(customizationDraft.selected_decals ?? []).includes(decal)} onChange={() => toggleSelectedDecal(decal)} /><span>{formatDecalLabel(decal)}</span></label>)}</fieldset>
          <div className="commons-media-upload-row">
            <label><span>Avatar upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleProfileMedia(event.target.files?.[0] ?? null, "avatar")} /></label>
            <label><span>Banner upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleProfileMedia(event.target.files?.[0] ?? null, "banner")} /></label>
            <button type="button" onClick={() => void handleRemoveProfileMedia("avatar")} disabled={!savedCustomization.avatar_url && !customizationDraft.avatar_url}>Remove profile picture</button>
            <button type="button" onClick={() => void handleRemoveProfileMedia("banner")} disabled={!savedCustomization.banner_url && !customizationDraft.banner_url}>Remove banner</button>
          </div>
        </div>
        <CommonsBackgroundAtmosphere backgroundStyle={customizationDraft.background_style} accentColor={customizationDraft.accent_color} variant="preview" className={previewClasses}>
          <div className="commons-profile-mantle" style={customizationDraft.banner_url ? { backgroundImage: `linear-gradient(135deg, rgba(10, 20, 22, .35), rgba(18, 44, 48, .4)), url(${customizationDraft.banner_url})` } : undefined}>
            <CommonsAvatarViewer src={customizationDraft.avatar_url} alt="Draft Commons profile avatar preview" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full draft Commons profile picture" />
            <div>
              <p className="eyebrow">Public profile room preview</p>
              <h3>{profile?.display_name || profile?.username || "Website member"}</h3>
              <p>{profile?.username ? `@${profile.username}` : "Draft Commons Profile"}</p>
              <div className="commons-customization-badges" aria-label="Draft public profile presentation settings"><span>{formatDecalLabel(customizationDraft.theme_mode || "starlit_archive")}</span><span>{getCommonsBackgroundStyleOption(customizationDraft.background_style).label}</span><span>{formatDecalLabel(customizationDraft.profile_layout || "classic_homebase")}</span></div>
            </div>
          </div>
          <DecalStrip settings={customizationDraft} />
          <p className="commons-empty-state">This preview is local until Save customization publishes these style choices to your public profile.</p>
        </CommonsBackgroundAtmosphere>
        <p className="commons-empty-state">Decorative markers are public visual labels, not badges, rank, authority, or role claims.</p>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => void saveProfileRoom()} disabled={!hasUnsavedCustomization}>Save customization</button>{hasUnsavedCustomization && <button type="button" onClick={revertCustomizationPreview}>Revert preview</button>}<span className="commons-empty-state">{hasUnsavedCustomization ? "Unsaved preview active" : "No unsaved style changes"}</span></div>
      </section>

      <section className="section-card commons-privacy" id="privacy-lanterns">
        <p className="eyebrow">Privacy Lanterns</p>
        <h2>Public profile visibility</h2>
        <p className="boundary-note">Email, resumes/CVs, stewardship receipts/proofs, private review requests, private drafts, notifications, admin queues, and local Elysia connection data are never public profile fields.</p>
        <div className="commons-privacy-grid">{Object.entries(visibilityDraft).map(([key, value]) => <label className="checkbox-line" key={key}><input type="checkbox" checked={value} onChange={(event) => setVisibilityDraft({ ...visibilityDraft, [key]: event.target.checked })} /><span>{privacyLabel(key)}</span></label>)}</div>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => void saveVisibility()}>Save visibility</button></div>
      </section>

      <section className="section-card commons-settings-grid">
        <article>
          <p className="eyebrow">Notification Preferences</p>
          <h2>Signal lantern settings</h2>
          {Object.entries(notificationDraft).map(([key, value]) => <label className="checkbox-line" key={key}><input type="checkbox" checked={value} onChange={(event) => setNotificationDraft({ ...notificationDraft, [key]: event.target.checked })} /><span>{key.replace(/_/g, " ")}</span></label>)}
          <button type="button" onClick={() => void saveNoticePrefs()}>Save notification preferences</button>
        </article>
        <article>
          <p className="eyebrow">Connected local Elysia</p>
          <h2>Not connected</h2>
          <p>Future local Elysia linking must be explicit, narrow, revocable, and controlled by local Elysia. Private memory, files, logs, local passwords, vaults, credentials, and machine data do not sync by default.</p>
        </article>
      </section>

      {adminEntryAllowed && <section className="section-card commons-settings-grid">
        <article><p className="eyebrow">Admin-only backend status</p><h2>Live account systems</h2><BadgeRow labels={["profiles", "user_roles", "review_items", "content_reports", "admin_audit_log", "saved_shelves", "badge_credits"]} /><p>These systems are surfaced as private admin/reviewer tools where migrations and RLS are active. Missing tables show clean admin-only setup messages inside the relevant queue.</p></article>
        <article><p className="eyebrow">Visibility states</p><h2>Moderation lifecycle</h2><BadgeRow labels={["draft", "submitted", "published", "flagged", "hidden", "removed", "archived", "revoked"]} /><p>Public content should only be visible when intentionally published. Private reports, notes, drafts, hidden/removed content, resumes/CVs, receipts, and audit logs stay RLS-gated.</p></article>
      </section>}
    </div>
  );
}

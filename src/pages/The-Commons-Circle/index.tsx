import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { COMMONS_BACKGROUND_STYLES, getCommonsBackgroundStyleOption, normalizeCommonsBackgroundStyle } from "../../shared/commonsBackgroundStyles";
import {
  COMMONS_DECORATIVE_MARKER_SET_OPTIONS,
  normalizeCommonsDecorativeMarkerSet,
  resolveCommonsDecorativeMarkers,
} from "../../shared/commonsDecorativeMarkers";
import { COMMONS_PROFILE_LAYOUTS, getCommonsProfileLayoutOption, normalizeCommonsProfileLayout } from "../../shared/commonsProfileLayouts";
import { COMMONS_THEME_MODES, getCommonsThemeModeOption, normalizeCommonsThemeMode } from "../../shared/commonsThemeModes";
import { commonsCustomizationStyle, customizationClass, customizationSkinClass } from "../../shared/commonsCustomizationStyles";
import CommonsBackgroundAtmosphere from "../../shared/components/CommonsBackgroundAtmosphere";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import CommonsProfileLayoutFrame from "../../shared/components/CommonsProfileLayoutFrame";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { safeInternalActionPath } from "../../shared/navigation/safeInternalActionPath";
import PublicProfilePublicationPanel from "../../shared/participation/PublicProfilePublicationPanel";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import type { AppRole } from "../../shared/review/reviewClient";
import { CommonsCircleAdminEntryCard, userCanOpenCommonsAdminConsole } from "./CommonsCircleAdminConsolePage";
import {
  DEFAULT_COMMONS_BANNER_POSITION_X,
  DEFAULT_COMMONS_BANNER_POSITION_Y,
  DEFAULT_COMMONS_BANNER_ZOOM,
  COMMONS_BANNER_POSITION_MAX,
  COMMONS_BANNER_POSITION_MIN,
  COMMONS_BANNER_ZOOM_MAX,
  COMMONS_BANNER_ZOOM_MIN,
  commonsStorageKeys,
  defaultCustomization,
  defaultNotificationPreferences,
  defaultVisibility,
  freeMemberFallbackBadge,
  loadCommonsHomebase,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeCommonsBannerPosition,
  normalizeCommonsBannerZoom,
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

type StewardshipDraft = { status?: "draft_local" | "pending_admin_review_local" };

const membershipTiers = [
  { name: "Free Member", purpose: "Default free recognition for participation in the public website commons. No donation is required.", awarded: "Granted for new members after Commons onboarding is completed; existing legitimate awards are preserved.", status: "Free recognition", note: "No payment, authority, or private Elysia access." },
  { name: "Contributor Member", purpose: "Recognition for constructive publishing, helpful community work, source suggestions, troubleshooting support, documentation, add-ons, research notes, or other contributions.", awarded: "Awarded by administrator review.", status: "Admin-awarded later", note: "Does not grant hidden authority." },
  { name: "Steward Member", purpose: "Recognition for verified stewardship support, such as direct support for independent nonprofits or other meaningful public-benefit stewardship.", awarded: "Recognition is reviewed before being awarded.", status: "Stewardship verification", note: "Not payment to Elysia." },
  { name: "Guardian / Reviewer", purpose: "A trust role for moderation, review, safety, source review, marketplace review, or Commune review.", awarded: "Manually assigned by an administrator. Never self-assigned.", status: "Trust role", note: "No self-assignment." },
  { name: "Founding Steward", purpose: "Early project recognition for meaningful early support of Elysia Ecobotics and the commons around her.", awarded: "Manually assigned by an administrator.", status: "Early recognition", note: "Not pay-to-win power." }
];

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

function visibleDecals(settings: ProfileCustomization) {
  return resolveCommonsDecorativeMarkers(settings);
}

function styleSignature(settings: ProfileCustomization) {
  return JSON.stringify({
    theme_mode: normalizeCommonsThemeMode(settings.theme_mode),
    accent_color: settings.accent_color || defaultCustomization.accent_color,
    background_style: normalizeCommonsBackgroundStyle(settings.background_style),
    decal_set: normalizeCommonsDecorativeMarkerSet(settings.decal_set),
    selected_decals: [],
    profile_layout: normalizeCommonsProfileLayout(settings.profile_layout),
    banner_zoom: normalizeCommonsBannerZoom(settings.banner_zoom),
    banner_position_x: normalizeCommonsBannerPosition(settings.banner_position_x),
    banner_position_y: normalizeCommonsBannerPosition(settings.banner_position_y)
  });
}

function formatBannerZoom(value: number) {
  return `${Math.round(normalizeCommonsBannerZoom(value) * 100)}%`;
}

function formatBannerPosition(value: number) {
  return `${Math.round(normalizeCommonsBannerPosition(value))}%`;
}

function DecalStrip({ settings }: { settings: ProfileCustomization }) {
  const decals = visibleDecals(settings);
  if (!decals.length) return null;
  return <div className="commons-decal-strip" aria-label="Selected profile decals">{decals.map((decal) => <span className="commons-decal-chip" key={decal.key}>{decal.label}</span>)}</div>;
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
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [notificationDraft, setNotificationDraft] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [syncChoice, setSyncChoice] = useState(() => readLocalStorage<{ choice?: string }>(commonsStorageKeys.syncChoice, {}));
  const [verificationDrafts, setVerificationDrafts] = useState<StewardshipDraft[]>(() => readLocalStorage(commonsStorageKeys.stewardshipDrafts, []));
  const [contributionRequests, setContributionRequests] = useState<unknown[]>(() => readLocalStorage(commonsStorageKeys.contributionRequests, []));
  const [roleState, setRoleState] = useState<{ roles: AppRole[]; isAdmin: boolean; signedIn: boolean; warnings: string[] }>({ roles: [], isAdmin: false, signedIn: false, warnings: [] });
  const localMediaPreviewUrls = useRef<Record<"avatar" | "banner", string | null>>({ avatar: null, banner: null });

  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  const refreshLocalCounts = useCallback(() => {
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
    return () => {
      Object.values(localMediaPreviewUrls.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

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
  const profileSetupComplete = Boolean(profile?.commons_onboarding_completed_at);
  const publicProfilePath = profile?.username ? `/commons-circle/@${encodeURIComponent(profile.username)}` : "/commons-circle/setup/profile";
  const pendingRecognitionCount = verificationDrafts.filter((draft) => draft.status === "pending_admin_review_local").length;
  const localLivingCount = homebase?.localLiving.savedSourceIds.length ?? 0;
  const shouldPromptSync = Boolean(homebase?.signedIn && localLivingCount > 0 && syncChoice.choice !== "synced" && syncChoice.choice !== "keep_local");
  const unreadCount = homebase?.notifications.filter((notice) => !notice.read_at).length ?? 0;
  const codeProposalSignalCount = homebase?.notifications.filter((notice) => /code_revision|proposal/i.test(`${notice.notification_type ?? ""} ${notice.source_type ?? ""}`)).length ?? 0;
  const troubleshootingSignalCount = homebase?.notifications.filter((notice) => /troubleshooting|fix_proposed|resolution/i.test(`${notice.notification_type ?? ""} ${notice.source_type ?? ""}`)).length ?? 0;
  const homeStyle = commonsCustomizationStyle(savedCustomization);
  const previewStyle = commonsCustomizationStyle(customizationDraft);
  const homebaseClasses = `page-stack commons-circle-page commons-homebase ${customizationSkinClass(savedCustomization)}`;
  const previewClasses = `commons-customization-preview commons-homebase ${customizationClass(customizationDraft)}`;
  const previewProfileLayout = normalizeCommonsProfileLayout(customizationDraft.profile_layout);
  const isClassicHomebasePreview = previewProfileLayout === "classic_homebase";
  const previewMastheadClassName = [
    "commons-profile-summary-card commons-profile-summary-card--preview commons-profile-mantle commons-circle-customization-preview-mantle commons-profile-masthead commons-profile-masthead__banner",
    isClassicHomebasePreview ? "commons-profile-masthead--classic-homebase" : "",
    customizationDraft.banner_url ? "has-public-banner" : ""
  ].filter(Boolean).join(" ");
  const hasUnsavedCustomization = styleSignature(customizationDraft) !== styleSignature(savedCustomization);
  const earnedBadges = useMemo(() => {
    const earned = homebase?.userBadges.filter((badge) => badge.earned && !badge.revoked_at) ?? [];
    const hasFreeMember = earned.some((badge) => badge.badge_key === "free_member");
    return profile?.commons_onboarding_completed_at && !hasFreeMember ? [freeMemberFallbackBadge(profile.commons_onboarding_completed_at), ...earned] : earned;
  }, [homebase?.userBadges, profile?.commons_onboarding_completed_at]);
  const freeMemberRecognized = earnedBadges.some((badge) => badge.badge_key === "free_member");
  const membershipTierLabel = freeMemberRecognized ? "Free Member" : profile ? "Pending — finish Commons Profile setup" : "Pending — create Commons Profile";
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
    const normalizedPatch = {
      ...patch,
      ...(patch.theme_mode === undefined ? {} : { theme_mode: normalizeCommonsThemeMode(patch.theme_mode) }),
      ...(patch.background_style === undefined ? {} : { background_style: normalizeCommonsBackgroundStyle(patch.background_style) }),
      ...(patch.decal_set === undefined ? {} : { decal_set: normalizeCommonsDecorativeMarkerSet(patch.decal_set), selected_decals: [] }),
      ...(patch.profile_layout === undefined ? {} : { profile_layout: normalizeCommonsProfileLayout(patch.profile_layout) }),
      ...(patch.banner_zoom === undefined ? {} : { banner_zoom: normalizeCommonsBannerZoom(patch.banner_zoom) }),
      ...(patch.banner_position_x === undefined ? {} : { banner_position_x: normalizeCommonsBannerPosition(patch.banner_position_x) }),
      ...(patch.banner_position_y === undefined ? {} : { banner_position_y: normalizeCommonsBannerPosition(patch.banner_position_y) }),
    };
    setCustomizationDraft((current) => ({ ...current, ...normalizedPatch }));
  }

  function revertCustomizationPreview() {
    setCustomizationDraft(savedCustomization);
    pushMessage("Customization preview reverted to the saved public profile style.");
  }

  async function saveProfileRoom() {
    const savedDraft = {
      ...customizationDraft,
      theme_mode: normalizeCommonsThemeMode(customizationDraft.theme_mode),
      background_style: normalizeCommonsBackgroundStyle(customizationDraft.background_style),
      decal_set: normalizeCommonsDecorativeMarkerSet(customizationDraft.decal_set),
      selected_decals: [],
      profile_layout: normalizeCommonsProfileLayout(customizationDraft.profile_layout),
      banner_zoom: normalizeCommonsBannerZoom(customizationDraft.banner_zoom),
      banner_position_x: normalizeCommonsBannerPosition(customizationDraft.banner_position_x),
      banner_position_y: normalizeCommonsBannerPosition(customizationDraft.banner_position_y),
    };
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

  function revokeLocalPreview(mediaType: "avatar" | "banner") {
    const localPreviewUrl = localMediaPreviewUrls.current[mediaType];
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    localMediaPreviewUrls.current[mediaType] = null;
  }

  async function handleProfileMedia(file: File | null, mediaType: "avatar" | "banner") {
    if (!file) return;
    const label = mediaType === "avatar" ? "Avatar" : "Banner";
    const urlKey = mediaType === "avatar" ? "avatar_url" : "banner_url";
    const idKey = mediaType === "avatar" ? "avatar_media_id" : "banner_media_id";

    revokeLocalPreview(mediaType);
    const localPreviewUrl = URL.createObjectURL(file);
    localMediaPreviewUrls.current[mediaType] = localPreviewUrl;
    setMediaStatus(`${label} selected. Uploading ${mediaType}...`);
    setCustomizationDraft((current) => ({ ...current, [urlKey]: localPreviewUrl, [idKey]: null }));

    const result = await uploadProfileMedia(file, mediaType);
    const visibleMessages = polishedActionMessages("profile-media", result.warnings, `${label} upload is not active yet. The selected image is only previewing in this browser.`);

    if (result.publicUrl && result.mediaId) {
      revokeLocalPreview(mediaType);
      const mediaPatch = { [urlKey]: result.publicUrl, [idKey]: result.mediaId ?? null };
      const nextDraft = { ...customizationDraft, ...mediaPatch };
      setCustomizationDraft((current) => ({ ...current, ...mediaPatch }));
      setSavedCustomization((current) => ({ ...current, ...mediaPatch }));
      setMediaStatus(visibleMessages.length ? `${label} updated, but account sync reported: ${visibleMessages[0]}` : `${label} updated.`);
      visibleMessages.forEach(pushMessage);
      pushMessage(`${label} uploaded to private profile storage. Public views receive only the governed transformed profile image.`);
      await refreshHomebase({ preserveCustomization: nextDraft });
      return;
    }

    setMediaStatus(visibleMessages[0] ?? `${label} upload did not finish. The selected image is only previewing in this browser.`);
    visibleMessages.forEach(pushMessage);
  }

  async function handleRemoveProfileMedia(mediaType: "avatar" | "banner") {
    const label = mediaType === "avatar" ? "Avatar" : "Banner";
    const urlKey = mediaType === "avatar" ? "avatar_url" : "banner_url";
    const idKey = mediaType === "avatar" ? "avatar_media_id" : "banner_media_id";
    setMediaStatus(`Removing ${mediaType}...`);
    const warnings = await removeProfileMedia(mediaType);
    const visibleMessages = polishedActionMessages("profile-media-remove", warnings, `${label} removal is not active yet.`);
    visibleMessages.forEach(pushMessage);

    if (!warnings.length) {
      revokeLocalPreview(mediaType);
      const mediaPatch = { [urlKey]: null, [idKey]: null };
      const nextDraft = { ...customizationDraft, ...mediaPatch };
      setCustomizationDraft((current) => ({ ...current, ...mediaPatch }));
      setSavedCustomization((current) => ({ ...current, ...mediaPatch }));
      setMediaStatus(`${label} removed.`);
      pushMessage(`${label} removed from public profile display. Initials and background fallback remain available.`);
      await refreshHomebase({ preserveCustomization: nextDraft });
      return;
    }

    setMediaStatus(`${label} removal failed: ${visibleMessages[0] ?? "Account storage is unavailable."}`);
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

      <section className="section-card commons-homebase-hero commons-private-homebase">
        <div className={`commons-profile-mantle commons-circle-private-homebase-mantle commons-private-homebase__mantle${savedCustomization.banner_url ? " has-public-banner" : ""}`}>
          {savedCustomization.banner_url && <img className="commons-public-banner commons-profile-banner-layer commons-circle-private-banner-image commons-private-homebase__banner-image" src={savedCustomization.banner_url} alt="" aria-hidden="true" loading="lazy" />}
          <CommonsAvatarViewer className="commons-private-homebase__avatar" src={savedCustomization.avatar_url} alt="Commons profile avatar" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full Commons profile picture" />
          <div className="commons-private-homebase__identity">
            <p className="eyebrow">Private Account Homebase</p>
            <h2>{profile?.display_name || profile?.username || "Website member"}</h2>
            <p>{profile?.username ? `@${profile.username}` : "Sign in and create a Commons Profile to claim your public handle."}</p>
          </div>
        </div>
        <dl className="mini-facts">
          <MiniFact label="Tier" value={membershipTierLabel} />
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
          <Link className="button-link" to="/commons-circle/support-billing">Support &amp; Billing</Link>
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
          {homebase?.notifications.map((notice) => { const actionPath = safeInternalActionPath(notice.action_url); return <div className="commons-preview-card" key={notice.id}><strong>{notice.title}</strong><p>{notice.body || notice.notification_type || "Account signal"}</p><span>{notice.read_at ? "read" : "unread"}</span><div className="button-row"><button type="button" onClick={async () => { polishedActionMessages("notification-read", await markNotificationRead(notice.id), "Notification actions are not active yet.").forEach(pushMessage); await refreshHomebase(); }}>Mark read</button>{actionPath && <Link className="button-link" to={actionPath}>Open</Link>}</div></div>; })}
          {homebase?.notifications.length ? <button type="button" onClick={async () => { polishedActionMessages("notifications-read-all", await markAllNotificationsRead(), "Notification actions are not active yet.").forEach(pushMessage); await refreshHomebase(); }}>Mark all read</button> : null}
        </article>

        <article className="section-card">
          <p className="eyebrow">Requests and review status</p>
          <h2>Private request status</h2>
          <dl className="mini-facts"><MiniFact label="Stewardship local pending" value={pendingRecognitionCount} /><MiniFact label="Contribution help drafts" value={contributionRequests.length} /><MiniFact label="Work With / review queues" value="private; account-backed when submitted" /></dl>
          <p className="boundary-note">Work With requests, resumes/CVs, stewardship receipts/proofs, admin review data, and private drafts are never shown on the public profile.</p>
        </article>
        <article className="section-card">
          <p className="eyebrow">Support &amp; Billing</p>
          <h2>Private economic account room</h2>
          <p>View account-linked support and recurring-support management, with clearly labeled availability and dedicated private paths for receipt, service-credit, Marketplace, Job Post, and seller records. Missing projections are never presented as proof that no record exists.</p>
          <p className="boundary-note">Free Member remains free. Payment does not change badges, roles, review authority, moderation state, or public rank.</p>
          <Link className="button-link button-link--primary" to="/commons-circle/support-billing">Open Support &amp; Billing</Link>
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
        <h2>{freeMemberRecognized ? "Free Member recognition" : "Free Member pending"}</h2>
        <dl className="mini-facts"><MiniFact label="Current tier" value={membershipTierLabel} /><MiniFact label="Setup complete" value={profileSetupComplete ? "Yes" : "Not yet"} /><MiniFact label="Pending recognition drafts" value={pendingRecognitionCount} /><MiniFact label="Contribution help drafts" value={contributionRequests.length} /><MiniFact label="Developer" value={profile?.is_developer ? "Requested / visible" : "Pending / No"} /><MiniFact label="Admin" value={profile?.is_admin ? "Yes" : "No"} /></dl>
        {!freeMemberRecognized && <p className="boundary-note">Complete Commons Profile setup before Free Member recognition is granted. A browser-local onboarding flag or a minimal Marketplace profile is not sufficient.</p>}
        <p className="boundary-note">Free Member recognition follows canonical completed Commons onboarding, while existing legitimate awards remain preserved. Other membership tiers and badges are assigned through their own authorized rules. Donation proof may support Steward recognition, but it does not create administrator, moderator, reviewer, developer, paid role, or guardian authority.</p>
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
            <label><span>Theme mode</span><select value={normalizeCommonsThemeMode(customizationDraft.theme_mode)} onChange={(event) => updateCustomizationDraft({ theme_mode: normalizeCommonsThemeMode(event.target.value) })}>{COMMONS_THEME_MODES.map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</select></label>
            <label><span>Accent color</span><input type="color" value={customizationDraft.accent_color} onChange={(event) => updateCustomizationDraft({ accent_color: event.target.value })} /></label>
            <label><span>Background style</span><select value={normalizeCommonsBackgroundStyle(customizationDraft.background_style)} onChange={(event) => updateCustomizationDraft({ background_style: event.target.value })}>{COMMONS_BACKGROUND_STYLES.map((style) => <option key={style.key} value={style.key}>{style.label}</option>)}</select></label>
            <label><span>Decorative marker set</span><select value={normalizeCommonsDecorativeMarkerSet(customizationDraft.decal_set)} onChange={(event) => updateCustomizationDraft({ decal_set: normalizeCommonsDecorativeMarkerSet(event.target.value) })}>{COMMONS_DECORATIVE_MARKER_SET_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <label><span>Profile layout</span><select value={normalizeCommonsProfileLayout(customizationDraft.profile_layout)} onChange={(event) => updateCustomizationDraft({ profile_layout: normalizeCommonsProfileLayout(event.target.value) })}>{COMMONS_PROFILE_LAYOUTS.map((layout) => <option key={layout.key} value={layout.key}>{layout.label}</option>)}</select></label>
          </div>
          <div className="commons-media-upload-row">
            <label><span>Avatar upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleProfileMedia(event.target.files?.[0] ?? null, "avatar"); event.currentTarget.value = ""; }} /></label>
            <label><span>Banner upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleProfileMedia(event.target.files?.[0] ?? null, "banner"); event.currentTarget.value = ""; }} /></label>
            <button type="button" onClick={() => void handleRemoveProfileMedia("avatar")} disabled={!savedCustomization.avatar_url && !customizationDraft.avatar_url}>Remove profile picture</button>
            <button type="button" onClick={() => void handleRemoveProfileMedia("banner")} disabled={!savedCustomization.banner_url && !customizationDraft.banner_url}>Remove banner</button>
          </div>
          {mediaStatus && <p className="commons-media-status" aria-live="polite">{mediaStatus}</p>}
          <fieldset className="commons-banner-framing-controls">
            <legend>Banner framing</legend>
            <label className="commons-banner-framing-row">
              <span>Banner zoom</span>
              <input type="range" min={COMMONS_BANNER_ZOOM_MIN} max={COMMONS_BANNER_ZOOM_MAX} step="0.01" value={normalizeCommonsBannerZoom(customizationDraft.banner_zoom)} onChange={(event) => updateCustomizationDraft({ banner_zoom: Number(event.target.value) })} />
              <strong className="commons-banner-framing-value">{formatBannerZoom(customizationDraft.banner_zoom)}</strong>
            </label>
            <label className="commons-banner-framing-row">
              <span>Horizontal position</span>
              <input type="range" min={COMMONS_BANNER_POSITION_MIN} max={COMMONS_BANNER_POSITION_MAX} step="1" value={normalizeCommonsBannerPosition(customizationDraft.banner_position_x)} onChange={(event) => updateCustomizationDraft({ banner_position_x: Number(event.target.value) })} />
              <strong className="commons-banner-framing-value">{formatBannerPosition(customizationDraft.banner_position_x)}</strong>
            </label>
            <label className="commons-banner-framing-row">
              <span>Vertical position</span>
              <input type="range" min={COMMONS_BANNER_POSITION_MIN} max={COMMONS_BANNER_POSITION_MAX} step="1" value={normalizeCommonsBannerPosition(customizationDraft.banner_position_y)} onChange={(event) => updateCustomizationDraft({ banner_position_y: Number(event.target.value) })} />
              <strong className="commons-banner-framing-value">{formatBannerPosition(customizationDraft.banner_position_y)}</strong>
            </label>
            <button className="commons-banner-framing-reset" type="button" onClick={() => updateCustomizationDraft({ banner_zoom: DEFAULT_COMMONS_BANNER_ZOOM, banner_position_x: DEFAULT_COMMONS_BANNER_POSITION_X, banner_position_y: DEFAULT_COMMONS_BANNER_POSITION_Y })}>Reset banner framing</button>
          </fieldset>
        </div>
        <CommonsBackgroundAtmosphere backgroundStyle={customizationDraft.background_style} accentColor={customizationDraft.accent_color} variant="preview" className={previewClasses} style={previewStyle}>
          <CommonsProfileLayoutFrame profileLayout={customizationDraft.profile_layout} variant="preview" className="commons-profile-preview-layout-frame">
            <section className="commons-profile-slot commons-profile-slot--summary">
              <div className={previewMastheadClassName} style={previewStyle}>
                {customizationDraft.banner_url && <img className="commons-public-banner commons-profile-banner-layer commons-profile-masthead__banner-image commons-circle-customization-preview-banner-image" src={customizationDraft.banner_url} alt="" aria-hidden="true" loading="lazy" />}
                <div className="commons-profile-masthead__banner-scrim" aria-hidden="true" />
                <div className="commons-profile-summary-card__avatar commons-profile-masthead__avatar">
                  <CommonsAvatarViewer className={isClassicHomebasePreview ? "commons-avatar--masthead" : ""} src={customizationDraft.avatar_url} alt="Draft Commons profile avatar preview" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full draft Commons profile picture" imageClassName="commons-profile-masthead__avatar-image" />
                </div>
                <div className="commons-profile-summary-card__body commons-profile-masthead__identity commons-profile-masthead__body">
                  <p className="commons-profile-summary-card__handle commons-profile-masthead__handle">@{profile?.username || "draft-profile"}</p>
                  <h3 className="commons-profile-summary-card__name commons-profile-masthead__name">{profile?.display_name || profile?.username || "Website member"}</h3>
                  <p>{getCommonsProfileLayoutOption(customizationDraft.profile_layout).previewNote}</p>
                  <div className="commons-customization-badges commons-profile-summary-card__chips commons-profile-masthead__chips" aria-label="Draft public profile presentation settings"><span>{getCommonsThemeModeOption(customizationDraft.theme_mode).label}</span><span>{getCommonsBackgroundStyleOption(customizationDraft.background_style).label}</span><span>{getCommonsProfileLayoutOption(customizationDraft.profile_layout).label}</span></div>
                </div>
              </div>
            </section>
            <section className="commons-profile-slot commons-profile-slot--identity">
              <article className="commons-public-section-card commons-public-identity-card">
                <p className="commons-public-section-card__eyebrow">Identity</p>
                <h4>Public identity</h4>
                <p>Bio, interests, and public links stay gated by your visibility settings.</p>
              </article>
            </section>
            <section className="commons-profile-slot commons-profile-slot--recognition">
              <article className="commons-public-section-card commons-public-recognition-card">
                <p className="commons-public-section-card__eyebrow">Recognition</p>
                <h4>Recognition, not authority</h4>
                <p>Badges and medallions remain public recognition only.</p>
              </article>
            </section>
            <section className="commons-profile-slot commons-profile-slot--badges">
              <article className="commons-public-section-card commons-public-badges-card">
                <p className="commons-public-section-card__eyebrow">Badges</p>
                <div className="commons-public-badge-list"><span>{freeMemberRecognized ? "Free Member" : "Membership pending"}</span><span>Recognition</span><span>Public</span></div>
              </article>
            </section>
            <section className="commons-profile-slot commons-profile-slot--collections">
              <article className="commons-public-section-card commons-public-collections-card">
                <p className="commons-public-section-card__eyebrow">Collections</p>
                <p>Saved public collections arrange differently by layout.</p>
              </article>
            </section>
            <section className="commons-profile-slot commons-profile-slot--contributions">
              <article className="commons-public-section-card commons-public-contributions-card">
                <p className="commons-public-section-card__eyebrow">Contributions</p>
                <p>Published posts and comments keep their public source links.</p>
              </article>
            </section>
          </CommonsProfileLayoutFrame>
          <DecalStrip settings={customizationDraft} />
          <p className="commons-empty-state">This preview is local until Save customization publishes these style choices to your public profile.</p>
        </CommonsBackgroundAtmosphere>
        <p className="commons-empty-state">Decorative markers are public visual labels, not badges, rank, authority, or role claims.</p>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => void saveProfileRoom()} disabled={!hasUnsavedCustomization}>Save customization</button>{hasUnsavedCustomization && <button type="button" onClick={revertCustomizationPreview}>Revert preview</button>}<span className="commons-empty-state">{hasUnsavedCustomization ? "Unsaved preview active" : "No unsaved style changes"}</span></div>
      </section>

      <PublicProfilePublicationPanel />

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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { resolveCommonsDecorativeMarkers } from "../../shared/commonsDecorativeMarkers";
import { commonsCustomizationStyle, customizationSkinClass } from "../../shared/commonsCustomizationStyles";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadAccountSavedShelvesCounts, type AccountSavedShelvesCounts } from "./accountCommunicationsApi";
import {
  commonsStorageKeys,
  defaultCustomization,
  loadCommonsHomebase,
  readLocalStorage,
  renewOwnerProfileMediaPreview,
  syncLocalLivingLibraryToAccount,
  updateBadgeVisibility,
  writeLocalStorage
} from "./commonsCircleApi";
import type { CommonsHomebaseData, ProfileCustomization, UserBadge } from "./commonsCircleApi";

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

function visibleDecals(settings: ProfileCustomization) {
  return resolveCommonsDecorativeMarkers(settings);
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
  const [savedShelvesCounts, setSavedShelvesCounts] = useState<AccountSavedShelvesCounts | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [savedCustomization, setSavedCustomization] = useState<ProfileCustomization>(defaultCustomization);
  const [syncChoice, setSyncChoice] = useState(() => readLocalStorage<{ choice?: string }>(commonsStorageKeys.syncChoice, {}));

  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  const refreshHomebase = useCallback(async () => {
    const result = await loadCommonsHomebase();
    setHomebase(result);
    setSavedCustomization(result.customization);
    logDiagnostics("homebase", result.warnings);
  }, []);

  const refreshSavedShelves = useCallback(async () => {
    const counts = await loadAccountSavedShelvesCounts();
    setSavedShelvesCounts(counts);
    logDiagnostics("saved-shelves-counts", counts.warnings);
  }, []);

  const refreshSignedInHomebase = useCallback(async () => {
    void refreshSavedShelves();
    await refreshHomebase();
  }, [refreshHomebase, refreshSavedShelves]);

  const renewOwnerAvatar = useCallback(async (failedSrc: string) => {
    const renewed = await renewOwnerProfileMediaPreview("avatar");
    logDiagnostics("avatar-renewal", renewed.warnings);
    if (!renewed.publicUrl || renewed.publicUrl === failedSrc) {
      pushMessage("Avatar preview is unavailable. The safe profile fallback remains visible.");
      return;
    }
    setSavedCustomization((current) => current.avatar_url === failedSrc ? { ...current, avatar_url: renewed.publicUrl, avatar_media_id: renewed.mediaId } : current);
    pushMessage("Avatar preview connection renewed.");
  }, [pushMessage]);

  useEffect(() => { void refreshHomebase(); }, [refreshHomebase]);
  useEffect(() => { void refreshSavedShelves(); }, [refreshSavedShelves]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("commons-circle-onboarding") : null;
    const onComplete = () => {
      void refreshHomebase();
      void refreshSavedShelves();
      pushMessage("Commons Circle setup updated. Website Account, Commons Profile, and account shelves were refreshed.");
    };
    channel?.addEventListener("message", (event) => { if (event.data?.type === "commons-circle-onboarding-complete") onComplete(); });
    const onStorage = (event: StorageEvent) => {
      const refreshKeys: string[] = [commonsStorageKeys.onboarding];
      if (event.key && refreshKeys.includes(event.key)) onComplete();
    };
    window.addEventListener("storage", onStorage);
    return () => { channel?.close(); window.removeEventListener("storage", onStorage); };
  }, [pushMessage, refreshHomebase, refreshSavedShelves]);

  const profile = homebase?.profile ?? null;
  const profileSetupComplete = Boolean(profile?.commons_onboarding_completed_at);
  const publicProfilePath = profile?.username ? `/commons-circle/@${encodeURIComponent(profile.username)}` : "/commons-circle/setup/profile";
  const localLivingCount = homebase?.localLiving.savedSourceIds.length ?? 0;
  const shouldPromptSync = Boolean(homebase?.signedIn && localLivingCount > 0 && syncChoice.choice !== "synced" && syncChoice.choice !== "keep_local");
  const homeStyle = commonsCustomizationStyle(savedCustomization);
  const homebaseClasses = `page-stack commons-circle-page commons-homebase ${customizationSkinClass(savedCustomization)}`;
  const earnedBadges = useMemo(() => {
    return homebase?.userBadges.filter((badge) => badge.earned && !badge.revoked_at) ?? [];
  }, [homebase?.userBadges]);
  const freeMemberRecognized = earnedBadges.some((badge) => badge.badge_key === "free_member");
  const membershipTierLabel = freeMemberRecognized
    ? "Free Member"
    : profile?.commons_onboarding_completed_at
      ? "Awaiting authoritative badge record"
      : profile
        ? "Pending — finish Commons Profile setup"
        : "Pending — create Commons Profile";

  async function syncLivingLibrary() {
    const result = await syncLocalLivingLibraryToAccount();
    const visibleMessages = polishedActionMessages("living-library-sync", result.warnings, "Living Library account sync could not complete. Your browser-local saves remain in this browser.");
    visibleMessages.forEach(pushMessage);
    pushMessage(visibleMessages.length ? `Living Library sync prepared ${result.synced} item changes before account storage stopped.` : `Synced ${result.synced} Living Library saved item changes to your Website Account.`);
    await Promise.all([refreshHomebase(), refreshSavedShelves()]);
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
            onAuthChanged={refreshSignedInHomebase}
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
          <CommonsAvatarViewer className="commons-private-homebase__avatar" src={savedCustomization.avatar_url} imageIdentity={savedCustomization.avatar_media_id} onImageError={renewOwnerAvatar} alt="Commons profile avatar" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full Commons profile picture" />
          <div className="commons-private-homebase__identity">
            <p className="eyebrow">Private Account Homebase</p>
            <h2>{profile?.display_name || profile?.username || "Website member"}</h2>
            <p>{profile?.username ? `@${profile.username}` : "Sign in and create a Commons Profile to claim your public handle."}</p>
          </div>
        </div>
        <dl className="mini-facts">
          <MiniFact label="Tier" value={membershipTierLabel} />
          <MiniFact label="Setup" value={profileSetupComplete ? "Complete" : "Needs setup"} />
        </dl>
        <DecalStrip settings={savedCustomization} />
        <div className="button-row">
          {profile?.username ? <Link className="button-link button-link--primary" to={publicProfilePath}>View public profile</Link> : <span className="button-link button-link--disabled" aria-disabled="true">Add a username to view public profile</span>}
          <Link className="button-link commons-settings-entry" to="/commons-circle/settings">Account &amp; Profile Settings</Link>
        </div>
      </section>

      {shouldPromptSync && <section className="section-card commons-sync-card">
        <p className="eyebrow">Explicit sync available</p>
        <h2>You have browser-local Living Library saves.</h2>
        <p>Sync them to your Website Account only if you choose. Elysia Ecobotics Online will not upload browser-local saved items silently.</p>
        <div className="button-row"><button className="button-primary" type="button" onClick={() => void syncLivingLibrary()}>Sync now</button><button type="button" onClick={() => { writeLocalStorage(commonsStorageKeys.syncChoice, { choice: "keep_local", decidedAt: new Date().toISOString() }); setSyncChoice({ choice: "keep_local" }); }}>Keep local only</button><button type="button" onClick={() => { writeLocalStorage(commonsStorageKeys.syncChoice, { choice: "not_now", decidedAt: new Date().toISOString() }); setSyncChoice({ choice: "not_now" }); }}>Not now</button></div>
      </section>}

      <section className="commons-homebase-grid">
        <article className="section-card commons-account-room-card">
          <p className="eyebrow">Saved Shelves</p>
          <h2>Your private saved archive</h2>
          <dl className="mini-facts"><MiniFact label="Account-saved items" value={savedShelvesCounts?.savedItems ?? 0} /><MiniFact label="Followed threads" value={savedShelvesCounts?.followedThreads ?? 0} /></dl>
          <p>Saved references remain private by default and separate from requests, messages, and notifications.</p>
          <Link className="button-link button-link--primary" to="/commons-circle/saved-shelves">Open Saved Shelves</Link>
        </article>

        <article className="section-card commons-signal-feed commons-account-room-card">
          <p className="eyebrow">Communications &amp; activity</p>
          <h2>Signals</h2>
          <p>Signals contains private messages, notifications, requests, reviews, domain activity, and authorized staff tools.</p>
          <Link className="button-link" to="/commons-circle/signals">Open Signals</Link>
        </article>

        <article className="section-card">
          <p className="eyebrow">Support &amp; Billing</p>
          <h2>Private economic account room</h2>
          <p>View account-linked support and recurring-support management, with clearly labeled availability and dedicated private paths for receipt, service-credit, Marketplace, Job Post, and seller records. Missing projections are never presented as proof that no record exists.</p>
          <p className="boundary-note">Free Member remains free. Payment does not change badges, roles, review authority, moderation state, or public rank.</p>
          <Link className="button-link button-link--primary" to="/commons-circle/support-billing">Open Support &amp; Billing</Link>
        </article>
      </section>

      <section className="section-card commons-membership-status">
        <p className="eyebrow">Membership Status</p>
        <h2>{freeMemberRecognized ? "Free Member recognition" : "Free Member pending"}</h2>
        <dl className="mini-facts"><MiniFact label="Current tier" value={membershipTierLabel} /><MiniFact label="Setup complete" value={profileSetupComplete ? "Yes" : "Not yet"} /><MiniFact label="Developer" value={profile?.is_developer ? "Requested / visible" : "Pending / No"} /><MiniFact label="Admin" value={profile?.is_admin ? "Yes" : "No"} /></dl>
        {!freeMemberRecognized && <p className="boundary-note">Complete Commons Profile setup before Free Member recognition is granted. A browser-local onboarding flag or a minimal Marketplace profile is not sufficient.</p>}
        <p className="boundary-note">Free Member recognition follows canonical completed Commons onboarding, while existing legitimate awards remain preserved. Other membership tiers and badges are assigned through their own authorized rules. Donation proof may support Steward recognition, but it does not create administrator, moderator, reviewer, developer, paid role, or guardian authority.</p>
      </section>

      <section className="section-card commons-medallion-wall">
        <p className="eyebrow">Medallion Wall</p>
        <h2>Badges are recognition, not authority</h2>
        <div className="commons-medallion-grid">{earnedBadges.map((badge) => <article className={`earned${badge.authority || badge.authority_linked ? " authority-linked" : ""}`} key={badge.badge_key}><BadgeIcon badge={badge} /><h3>{badge.name}</h3><p>{badge.description}</p>{badge.rule_summary && <p className="commons-medallion-note">{badge.rule_summary}</p>}{badge.note && <p className="commons-medallion-note">{badge.note}</p>}<BadgeRow labels={badgeLabels(badge)} /><label className="checkbox-line"><span>Visibility</span><select value={badge.visibility || "public"} onChange={async (event) => { polishedActionMessages("badge-visibility", await updateBadgeVisibility(badge.badge_key, event.target.value as "public" | "private"), "Badge visibility could not be changed. No visibility claim was updated.").forEach(pushMessage); await refreshHomebase(); }}><option value="public">public</option><option value="private">private</option></select></label></article>)}</div>{!earnedBadges.length && <EmptyState>No badges are recorded in the authoritative badge ledger. Badges are recognition, not authority.</EmptyState>}
      </section>

      <section className="commons-tier-grid">{membershipTiers.map((tier) => <article className="section-card commons-tier-card" key={tier.name}><p className="eyebrow">{tier.status}</p><h3>{tier.name}</h3><p>{tier.purpose}</p><p><strong>How awarded:</strong> {tier.awarded}</p><p className="boundary-note">{tier.note}</p></article>)}</section>


    </div>
  );
}

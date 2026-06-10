import { useCallback, useEffect, useState } from "react";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { loadCurrentProfile, loadAdminReviewQueue } from "../The-Elysia-Marketplace/lib/marketplaceApi";
import { hasSupabaseConfig } from "../The-Elysia-Marketplace/lib/supabase";
import type { MarketplaceProfile } from "../The-Elysia-Marketplace/types";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";

type PrivacySettings = {
  showDisplayName: boolean;
  showWebsite: boolean;
  showGithub: boolean;
  showBadges: boolean;
  showContributionHistory: boolean;
  allowPublicContact: boolean;
  emailUpdatesLater: boolean;
};

type OnboardingState = {
  skippedStewardship?: boolean;
  welcomed?: boolean;
  completed?: boolean;
  completedAt?: string;
  membershipTier?: "Free Member";
};

type StewardshipDraft = { status?: "draft_local" | "pending_admin_review_local" };
type ProfileWithSetup = MarketplaceProfile & {
  commons_onboarding_completed_at?: string | null;
  stewardship_onboarding_skipped_at?: string | null;
  work_with_onboarding_skipped_at?: string | null;
};

const storageKeys = {
  onboarding: "commonsCircle.onboarding.v1",
  stewardshipDrafts: "commonsCircle.stewardshipVerificationDrafts.v1",
  privacySettings: "commonsCircle.privacySettings.v1",
  membershipLocalState: "commonsCircle.membershipLocalState.v1",
  contributionRequests: "commonsCircle.contributionInterestRequests.v1"
} as const;

const membershipTiers = [
  { name: "Free Member", purpose: "Default account tier for participation in the public website commons. No donation is required.", awarded: "Default tier after account/profile creation.", status: "Default tier", note: "No private Elysia access." },
  { name: "Contributor Member", purpose: "Recognition for constructive publishing, helpful community work, source suggestions, troubleshooting support, documentation, add-ons, research notes, or other contributions.", awarded: "Awarded by administrator review.", status: "Admin-awarded later", note: "Does not grant hidden authority." },
  { name: "Steward Member", purpose: "Recognition for verified stewardship support, such as direct support for independent nonprofits or other meaningful public-benefit stewardship.", awarded: "Recognition is reviewed before being awarded.", status: "Stewardship verification", note: "Not payment to Elysia." },
  { name: "Guardian / Reviewer", purpose: "A trust role for moderation, review, safety, source review, marketplace review, or Commune review.", awarded: "Manually assigned by an administrator. Never self-assigned.", status: "Trust role", note: "No self-assignment." },
  { name: "Founding Steward", purpose: "Early project recognition for meaningful early support of Elysia Ecobotics and the commons around her.", awarded: "Manually assigned by an administrator.", status: "Early recognition", note: "Not pay-to-win power." }
];

const badgeExamples = [
  "Free Member", "Stewardship Supporter", "Water Steward", "Forest Steward", "Reef Steward", "Health Steward", "Knowledge Commons Supporter", "Contributor", "Source Curator", "Troubleshooting Helper", "Developer Contributor", "Founding Steward", "Guardian / Reviewer"
];

const futureTables = [
  "profiles", "membership_records", "membership_badges", "user_badges", "contribution_records", "donation_verifications", "stewardship_organizations", "user_saved_addons", "user_saved_library_sources", "user_saved_posts", "account_links"
];

const futureSupportTables = [
  "account_privacy_settings", "account_notification_settings", "developer_profiles", "moderator_roles", "admin_review_events", "donation_verification_files"
];

const defaultPrivacySettings: PrivacySettings = {
  showDisplayName: true,
  showWebsite: false,
  showGithub: false,
  showBadges: true,
  showContributionHistory: false,
  allowPublicContact: false,
  emailUpdatesLater: false
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function BadgeRow({ labels }: { labels: string[] }) {
  return <div className="commons-badge-row">{labels.map((label) => <span key={label}>{label}</span>)}</div>;
}

function countStorageArray(key: string) {
  return readStorage<unknown[]>(key, []).length;
}

export default function CommonsCirclePage() {
  const [profile, setProfile] = useState<ProfileWithSetup | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => readStorage(storageKeys.privacySettings, defaultPrivacySettings));
  const [onboardingDone, setOnboardingDone] = useState<OnboardingState>(() => readStorage(storageKeys.onboarding, { skippedStewardship: false, welcomed: false }));
  const [verificationDrafts, setVerificationDrafts] = useState<StewardshipDraft[]>(() => readStorage(storageKeys.stewardshipDrafts, []));
  const [contributionRequests, setContributionRequests] = useState<unknown[]>(() => readStorage(storageKeys.contributionRequests, []));

  const pushMessage = useCallback((message: string) => { if (message.trim()) setMessages((current) => [message, ...current].slice(0, 5)); }, []);
  const refreshProfile = useCallback(async () => { const result = await loadCurrentProfile(); setProfile(result.data as ProfileWithSetup | null); result.warnings.forEach(pushMessage); }, [pushMessage]);
  const refreshReviewQueue = useCallback(async () => { const result = await loadAdminReviewQueue(); result.warnings.forEach(pushMessage); }, [pushMessage]);
  const refreshLocalCounts = useCallback(() => {
    setOnboardingDone(readStorage(storageKeys.onboarding, { skippedStewardship: false, welcomed: false }));
    setVerificationDrafts(readStorage(storageKeys.stewardshipDrafts, []));
    setContributionRequests(readStorage(storageKeys.contributionRequests, []));
  }, []);
  const refreshAccountSurfaces = useCallback(async () => { refreshLocalCounts(); await refreshProfile(); await refreshReviewQueue(); }, [refreshLocalCounts, refreshProfile, refreshReviewQueue]);
  useEffect(() => { void refreshAccountSurfaces(); }, [refreshAccountSurfaces]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("commons-circle-onboarding") : null;
    const onComplete = () => {
      refreshLocalCounts();
      void refreshAccountSurfaces();
      pushMessage("Commons Circle setup updated. Website Account, Commons Profile, and local membership counts were refreshed.");
    };
    channel?.addEventListener("message", (event) => { if (event.data?.type === "commons-circle-onboarding-complete") onComplete(); });
    const onStorage = (event: StorageEvent) => { if (event.key === storageKeys.onboarding || event.key === storageKeys.stewardshipDrafts || event.key === storageKeys.contributionRequests) onComplete(); };
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [pushMessage, refreshAccountSurfaces, refreshLocalCounts]);

  const savedLibrarySources = countStorageArray("elysiaLivingLibrary.savedSources.v1");
  const savedCommuneDrafts = countStorageArray("commune.postDrafts.v1") + countStorageArray("commune.postRequests.v1");
  const savedSourceCollections = readStorage<unknown[]>("elysiaLivingLibrary.collections.v1", []).length;
  const followedThreads = countStorageArray("commune.followedThreads.v1");
  const pendingRecognitionCount = verificationDrafts.filter((draft) => draft.status === "pending_admin_review_local").length;
  const profileSetupComplete = Boolean(profile?.commons_onboarding_completed_at || onboardingDone.completed);
  const setupPath = profile ? "/commons-circle/setup/profile" : "/commons-circle/setup/profile";

  function savePrivacySettings(next: PrivacySettings) {
    setPrivacySettings(next);
    writeStorage(storageKeys.privacySettings, next);
    pushMessage("Privacy settings saved locally as placeholders until account-backed settings are built.");
  }

  return (
    <div className="page-stack commons-circle-page">
      <PageHero eyebrow="Membership" title="The Commons Circle">
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
          <div className="boundary-note">
            <strong>Start here:</strong> create or sign in to your Website Account first. This is the actual authentication account for Elysia Ecobotics Online.
          </div>
          <AuthPanel
            onMessage={pushMessage}
            onAuthChanged={refreshAccountSurfaces}
            copy={{
              eyebrow: "Website Account",
              title: "Create or Sign In to Website Account",
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
          {profile && profileSetupComplete && <dl className="mini-facts"><div><dt>Username</dt><dd>{profile.username}</dd></div><div><dt>Display name</dt><dd>{profile.display_name || "Not set"}</dd></div><div><dt>Developer</dt><dd>{profile.is_developer ? "Requested / visible" : "Pending / No"}</dd></div><div><dt>Admin</dt><dd>{profile.is_admin ? "Yes" : "No"}</dd></div></dl>}
          <div className="button-row"><a className="button-link button-link--primary" href={setupPath}>{profile ? profileSetupComplete ? "Review setup / update profile" : "Finish Commons Profile setup" : "Start Commons Profile setup"}</a></div>
          <p className="boundary-note">Admin, moderator, reviewer, developer trust, and other authority roles cannot be self-assigned in this UI. Local Elysia linking must be explicit, narrow, revocable, and controlled by local Elysia.</p>
        </section>
      </section>

      <section className="section-card commons-stepper">
        <p className="eyebrow">Setup sequence</p>
        <h2>Website Account → profile draft → optional requests → final creation</h2>
        <ol>
          <li>Create or sign in to Website Account.</li>
          <li>Draft Commons Profile fields. This does not finalize the profile.</li>
          <li>Choose optional stewardship support or skip it.</li>
          <li>Prepare an optional Work With Elysia Ecobotics request or skip it.</li>
          <li>Review the final confirmation and click Create Commons Profile.</li>
        </ol>
        <p className="boundary-note">Donations are optional, direct-to-organization, and never required for membership. Helping Elysia Ecobotics is optional and subject to administrator review.</p>
      </section>

      <section className="commons-tier-grid">
        {membershipTiers.map((tier) => <article className="section-card commons-tier-card" key={tier.name}><p className="eyebrow">{tier.status}</p><h3>{tier.name}</h3><p>{tier.purpose}</p><p><strong>How awarded:</strong> {tier.awarded}</p><p className="boundary-note">{tier.note}</p></article>)}
      </section>

      <section className="section-card commons-membership-status">
        <p className="eyebrow">Membership Status</p>
        <h2>Free Member by default</h2>
        <dl className="mini-facts">
          <div><dt>Current tier</dt><dd>Free Member</dd></div>
          <div><dt>Setup complete</dt><dd>{profileSetupComplete ? "Yes" : "Not yet"}</dd></div>
          <div><dt>Pending recognition drafts</dt><dd>{pendingRecognitionCount}</dd></div>
          <div><dt>Contribution help drafts</dt><dd>{contributionRequests.length}</dd></div>
          <div><dt>Developer</dt><dd>{profile?.is_developer ? "Requested / visible" : "Pending / No"}</dd></div>
          <div><dt>Admin</dt><dd>{profile?.is_admin ? "Yes" : "No"}</dd></div>
          <div><dt>Saved add-ons</dt><dd>{profile?.saved_addon_ids.length ?? 0}</dd></div>
          <div><dt>Saved library sources</dt><dd>{savedLibrarySources}</dd></div>
          <div><dt>Saved posts/drafts</dt><dd>{savedCommuneDrafts}</dd></div>
        </dl>
        <p className="boundary-note">Membership tiers and badges are ultimately assigned by authorized administrators. Donation proof may support Steward recognition, but it does not create administrator, moderator, reviewer, or developer authority.</p>
        <BadgeRow labels={badgeExamples.map((badge) => badge === "Free Member" ? `${badge}: earned/local` : `${badge}: planned`)} />
      </section>

      <section className="section-card">
        <p className="eyebrow">Saved across the site</p>
        <h2>One public account hub, multiple modules</h2>
        <div className="commons-module-grid">
          <article><h3>Saved add-ons</h3><p>{profile?.saved_addon_ids.length ?? 0} through the Marketplace module when signed in.</p></article>
          <article><h3>Saved Living Library sources</h3><p>{savedLibrarySources} browser-local now; account sync later.</p></article>
          <article><h3>Saved Commune posts</h3><p>{savedCommuneDrafts} local drafts/requests in this browser.</p></article>
          <article><h3>Saved source collections</h3><p>{savedSourceCollections} browser-local collections.</p></article>
          <article><h3>Followed Commune threads</h3><p>{followedThreads} local placeholder follows.</p></article>
          <article><h3>Developer dashboard</h3><p><a href="/developer-forge">Developer Forge</a> · <a href="/marketplace/submit">Submit add-on</a> · <a href="/marketplace/trust">Marketplace trust</a></p></article>
        </div>
      </section>

      <section className="section-card commons-settings-grid">
        <article>
          <p className="eyebrow">Privacy settings</p>
          <h2>Local placeholders</h2>
          <p>Privacy settings are local placeholders until account-backed settings are built.</p>
          {Object.entries(privacySettings).map(([key, value]) => <label className="checkbox-line" key={key}><input type="checkbox" checked={value} onChange={(event) => savePrivacySettings({ ...privacySettings, [key]: event.target.checked })} /><span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span></label>)}
        </article>
        <article>
          <p className="eyebrow">Connected local Elysia</p>
          <h2>Not connected</h2>
          <p>Future local Elysia linking must be explicit, narrow, revocable, and controlled by local Elysia. Private memory, files, logs, local passwords, vaults, and credentials do not sync by default.</p>
        </article>
      </section>

      <section className="section-card commons-settings-grid">
        <article>
          <p className="eyebrow">Future backend roadmap</p>
          <h2>Planned schema areas</h2>
          <BadgeRow labels={futureTables} />
          <p>These are planned/future backend tables or schema areas. They are not all live until Supabase schema, RLS, storage policies, admin roles, and review tools are built.</p>
        </article>
        <article>
          <p className="eyebrow">Later support tables</p>
          <h2>Possible account support</h2>
          <BadgeRow labels={futureSupportTables} />
        </article>
      </section>
    </div>
  );
}

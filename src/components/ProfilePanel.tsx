import { useEffect, useState } from "react";
import { upsertMarketplaceProfile } from "../lib/marketplaceApi";
import type { MarketplaceProfile, MarketplaceProfileDraft } from "../types";

type ProfilePanelProps = {
  profile: MarketplaceProfile | null;
  supabaseConfigured: boolean;
  onMessage: (message: string) => void;
  onProfileSaved: () => Promise<void>;
};

function draftFromProfile(profile: MarketplaceProfile | null): MarketplaceProfileDraft {
  return {
    username: profile?.username ?? "",
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    website_url: profile?.website_url ?? "",
    github_url: profile?.github_url ?? "",
    organization: profile?.organization ?? "",
    is_developer: Boolean(profile?.is_developer)
  };
}

export default function ProfilePanel({ profile, supabaseConfigured, onMessage, onProfileSaved }: ProfilePanelProps) {
  const [draft, setDraft] = useState<MarketplaceProfileDraft>(() => draftFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDraft(draftFromProfile(profile));
  }, [profile]);

  function update<K extends keyof MarketplaceProfileDraft>(key: K, value: MarketplaceProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    setBusy(true);
    const result = await upsertMarketplaceProfile(draft);
    setBusy(false);
    const message = result.warnings.join(" ") || result.statusMessage || "Marketplace profile saved.";
    setStatus(message);
    onMessage(message);
    if (result.data) await onProfileSaved();
  }

  const title = profile?.display_name || (supabaseConfigured ? "Create Marketplace Profile" : "Demo Profile");

  return (
    <section className="account-card">
      <p className="eyebrow">Marketplace Profile</p>
      <h2>{title}</h2>
      {!profile && supabaseConfigured && <p className="inline-status">No Marketplace profile row exists yet for this signed-in user. Create one here.</p>}
      <p>{profile?.bio || "Create a Marketplace profile to save add-ons and developer submissions. This never changes the local Elysia account."}</p>
      {status && <p className="inline-status">{status}</p>}
      <div className="profile-form-grid">
        <label><span>Username</span><input value={draft.username} onChange={(event) => update("username", event.target.value)} placeholder="market-builder" /></label>
        <label><span>Display name</span><input value={draft.display_name} onChange={(event) => update("display_name", event.target.value)} placeholder="Marketplace Builder" /></label>
        <label className="wide-field"><span>Bio</span><textarea value={draft.bio} onChange={(event) => update("bio", event.target.value)} placeholder="Short public Marketplace bio" rows={4} /></label>
        <label><span>Website</span><input value={draft.website_url ?? ""} onChange={(event) => update("website_url", event.target.value)} placeholder="https://example.com" /></label>
        <label><span>GitHub</span><input value={draft.github_url ?? ""} onChange={(event) => update("github_url", event.target.value)} placeholder="https://github.com/name" /></label>
        <label className="checkbox-line"><input type="checkbox" checked={draft.is_developer} onChange={(event) => update("is_developer", event.target.checked)} /> Request developer profile flag</label>
      </div>
      <div className="button-row">
        <button type="button" onClick={saveProfile} disabled={busy || !supabaseConfigured}>{busy ? "Saving..." : profile ? "Update Marketplace Profile" : "Create Marketplace Profile"}</button>
      </div>
      <dl className="mini-facts">
        <div><dt>Username</dt><dd>{profile?.username ?? "Not created"}</dd></div>
        <div><dt>Developer</dt><dd>{profile?.is_developer ? "Yes" : "Pending / No"}</dd></div>
        <div><dt>Admin</dt><dd>{profile?.is_admin ? "Yes" : "No"}</dd></div>
        <div><dt>Saved add-ons</dt><dd>{profile?.saved_addon_ids.length ?? 0}</dd></div>
      </dl>
      <p className="boundary-note">Admin status cannot be self-assigned in this UI. Local Elysia account linking is planned; Marketplace profile data does not overwrite local Elysia profile data, and passwords are never shared.</p>
    </section>
  );
}

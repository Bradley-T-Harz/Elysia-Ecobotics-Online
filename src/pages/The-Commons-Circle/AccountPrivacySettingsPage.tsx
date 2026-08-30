import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import RequireMember from "../../shared/auth/RequireMember";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import PublicProfilePublicationPanel from "../../shared/participation/PublicProfilePublicationPanel";
import { defaultVisibility, loadCommonsHomebase, saveVisibilitySettings, type VisibilitySettings } from "./commonsCircleApi";

function privacyLabel(key: string) {
  return key.replace(/^show_/, "show ").replace(/_/g, " ");
}

export default function AccountPrivacySettingsPage() {
  const [visibility, setVisibility] = useState<VisibilitySettings>(defaultVisibility);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  useEffect(() => {
    void loadCommonsHomebase().then((result) => {
      setVisibility(result.visibility);
      result.warnings.forEach((warning) => {
        if (/visib|profile/i.test(warning)) pushMessage(warning);
      });
    });
  }, [pushMessage]);

  async function saveVisibility() {
    setBusy(true);
    const warnings = await saveVisibilitySettings(visibility);
    warnings.forEach(pushMessage);
    if (!warnings.length) pushMessage("Privacy Lantern visibility saved to your Website Account.");
    setBusy(false);
  }

  return <div className="page-stack commons-circle-page" id="privacy-lanterns">
    <PageMetadata title="Privacy & Public Profile | Elysia Ecobotics Online" description="Privacy Lanterns and public Commons Profile publication settings." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle/settings/privacy`} />
    <PageHero eyebrow="Account & Profile Settings" title="Privacy & Public Profile" brandMark="standard"><p>Control the canonical public-profile publication switch and every existing Privacy Lantern from one private account surface.</p></PageHero>
    <RequireMember label="Privacy & Public Profile settings belong to the signed-in Website Account.">
      <div className="page-stack">
        {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}
        <section className="commons-doctrine-grid"><WarningCallout title="Private means private"><p>Email, resumes, receipts, private requests, drafts, notifications, admin queues, and local Elysia connection data are never public profile fields.</p></WarningCallout><WarningCallout title="One canonical projection"><p>The publication control and Privacy Lanterns continue using their existing authoritative profile and visibility state; no duplicate public-profile system was created.</p></WarningCallout></section>
        <PublicProfilePublicationPanel />
        <section className="section-card commons-privacy">
          <p className="eyebrow">Privacy Lanterns</p><h2>Public profile visibility</h2>
          <p className="boundary-note">Turning off an item removes it from the public profile projection without deleting the private account record.</p>
          <div className="commons-privacy-grid">{Object.entries(visibility).map(([key, value]) => <label className="checkbox-line" key={key}><input type="checkbox" checked={value} onChange={(event) => setVisibility({ ...visibility, [key]: event.target.checked })} /><span>{privacyLabel(key)}</span></label>)}</div>
          <div className="button-row"><button className="button-primary" type="button" disabled={busy} onClick={() => void saveVisibility()}>{busy ? "Saving…" : "Save visibility"}</button><Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div>
        </section>
      </div>
    </RequireMember>
  </div>;
}

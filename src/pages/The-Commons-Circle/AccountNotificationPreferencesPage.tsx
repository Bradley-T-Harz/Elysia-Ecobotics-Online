import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import RequireMember from "../../shared/auth/RequireMember";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import AccountEventPreferencesPanel from "./AccountEventPreferencesPanel";
import {
  defaultNotificationPreferences,
  loadCommonsHomebase,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "./commonsCircleApi";

export default function AccountNotificationPreferencesPage() {
  const [legacy, setLegacy] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  useEffect(() => {
    void loadCommonsHomebase().then((result) => {
      setLegacy(result.notificationPreferences);
      result.warnings.forEach((warning) => {
        if (/notification/i.test(warning)) pushMessage(warning);
      });
    });
  }, [pushMessage]);

  async function saveLegacy() {
    setBusy(true);
    const warnings = await saveNotificationPreferences(legacy);
    warnings.forEach(pushMessage);
    if (!warnings.length) pushMessage("Commons activity notification preferences saved.");
    setBusy(false);
  }

  return <div className="page-stack commons-circle-page">
    <PageMetadata title="Notification Preferences | Elysia Ecobotics Online" description="Account event and legacy signal notification preferences for the signed-in Website Account." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle/settings/notifications`} />
    <PageHero eyebrow="Account & Profile Settings" title="Notification Preferences" brandMark="standard"><p>Manage optional account-event delivery and preserved legacy signal choices in one dedicated account destination. Private-message consent and Inbox settings remain semantically separate.</p></PageHero>
    <RequireMember label="Notification Preferences belong to the signed-in Website Account.">
      <div className="page-stack">
        {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}
        <section className="commons-doctrine-grid">
          <WarningCallout title="Mandatory notices remain"><p>Account, security, legal, guardian, and moderation notices remain available even when an optional category is disabled.</p></WarningCallout>
          <WarningCallout title="Messaging is separate"><p>Who may send private messages and how Inbox requests work are controlled in <Link to="/commons-circle/signals/inbox/settings">Messaging Settings</Link>, not here.</p></WarningCallout>
        </section>
        <AccountEventPreferencesPanel onMessage={pushMessage} />
        <section className="section-card commons-settings-grid">
          <article>
            <p className="eyebrow">Preserved account choices</p><h2>Commons activity notifications</h2>
            {Object.entries(legacy).map(([key, value]) => <label className="checkbox-line" key={key}><input type="checkbox" checked={value} onChange={(event) => setLegacy({ ...legacy, [key]: event.target.checked })} /><span>{key.replace(/_/g, " ")}</span></label>)}
            <button type="button" disabled={busy} onClick={() => void saveLegacy()}>{busy ? "Saving…" : "Save Commons activity notifications"}</button>
            <p className="boundary-note">These existing choices remain operational during notification taxonomy reconciliation.</p>
          </article>
          <article><p className="eyebrow">Destinations</p><h2>Notifications and communication</h2><div className="button-row"><Link className="button-link" to="/commons-circle/signals/notifications">Open Notifications</Link><Link className="button-link" to="/commons-circle/signals">Back to Signals</Link><Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div></article>
        </section>
      </div>
    </RequireMember>
  </div>;
}

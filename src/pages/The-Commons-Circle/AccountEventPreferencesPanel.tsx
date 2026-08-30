import { useCallback, useEffect, useState } from "react";
import {
  loadAccountEventPreferences,
  updateAccountEventPreference,
  type AccountEventPreference,
} from "./accountCommunicationsApi";

const mandatoryCategories = new Set(["account_security", "moderation"]);
const categoryLabels: Record<string, string> = {
  account_security: "Account & security",
  announcements: "Announcements",
  community_mentions: "Community mentions",
  community_replies: "Community replies",
  followed_threads: "Followed threads",
  marketplace: "Marketplace & economic",
  moderation: "Moderation",
  private_messages: "Private messages",
  sandbox: "Sandbox",
  work_reviews: "Work & reviews",
};

function categoryLabel(category: string) {
  return categoryLabels[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccountEventPreferencesPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const [preferences, setPreferences] = useState<AccountEventPreference[]>([]);
  const [taxonomyVersion, setTaxonomyVersion] = useState(0);
  const [workingPreference, setWorkingPreference] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadAccountEventPreferences();
    if (next.warning) onMessage(next.warning);
    if (next.result) {
      setPreferences(next.result.preferences);
      setTaxonomyVersion(next.result.taxonomyVersion);
    }
  }, [onMessage]);

  useEffect(() => { void refresh(); }, [refresh]);

  function patchPreference(category: string, patch: Partial<AccountEventPreference>) {
    setPreferences((current) => current.map((preference) => preference.category === category ? { ...preference, ...patch } : preference));
  }

  async function savePreference(preference: AccountEventPreference) {
    setWorkingPreference(preference.category);
    const outcome = await updateAccountEventPreference(preference);
    onMessage(outcome.warning ?? `${categoryLabel(preference.category)} preferences saved.`);
    if (outcome.preference) patchPreference(preference.category, outcome.preference);
    else await refresh();
    setWorkingPreference(null);
  }

  return <section className="section-card account-notification-preferences">
    <div className="section-heading"><p className="eyebrow">Delivery preferences · taxonomy v{taxonomyVersion || 1}</p><h2>Choose optional in-app and email delivery</h2><p>Read state, archive state, source authorization, and private-message consent are separate controls. Quiet hours delay optional email in UTC; they do not hide in-app events.</p></div>
    <div className="account-notification-preference-list">
      {preferences.map((preference) => <article key={preference.category}>
        <div><h3>{categoryLabel(preference.category)}</h3>{mandatoryCategories.has(preference.category) && <p className="boundary-note">Mandatory events in this category remain visible and may still be delivered.</p>}</div>
        <label className="checkbox-line"><input type="checkbox" checked={preference.inAppEnabled} onChange={(event) => patchPreference(preference.category, { inAppEnabled: event.target.checked })} /><span>Optional in-app events</span></label>
        <label className="checkbox-line"><input type="checkbox" checked={preference.emailEnabled} onChange={(event) => patchPreference(preference.category, { emailEnabled: event.target.checked })} /><span>Optional email delivery</span></label>
        <div className="account-notification-quiet-hours">
          <label><span>Quiet hours start (UTC)</span><input type="time" value={preference.quietHoursStart?.slice(0, 5) ?? ""} onChange={(event) => patchPreference(preference.category, { quietHoursStart: event.target.value || null, quietHoursEnd: event.target.value ? preference.quietHoursEnd ?? "08:00" : null })} /></label>
          <label><span>Quiet hours end (UTC)</span><input type="time" value={preference.quietHoursEnd?.slice(0, 5) ?? ""} onChange={(event) => patchPreference(preference.category, { quietHoursEnd: event.target.value || null, quietHoursStart: event.target.value ? preference.quietHoursStart ?? "22:00" : null })} /></label>
        </div>
        <button type="button" disabled={workingPreference === preference.category} onClick={() => void savePreference(preference)}>{workingPreference === preference.category ? "Saving…" : "Save preference"}</button>
      </article>)}
    </div>
    {!preferences.length && <p className="commons-empty-state">Notification preferences are unavailable until the account-event migration is active. No source workflow or mandatory notice was changed.</p>}
  </section>;
}

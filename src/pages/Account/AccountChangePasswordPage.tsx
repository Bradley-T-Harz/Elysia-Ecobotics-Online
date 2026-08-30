import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import RequireMember from "../../shared/auth/RequireMember";
import { useAuth } from "../../shared/auth/useAuth";
import { hasSupabaseConfig, supabase } from "../The-Elysia-Marketplace/lib/supabase";

export default function AccountChangePasswordPage() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!supabase || !hasSupabaseConfig || !session) {
      setError("Sign in to the current Website Account before changing its password.");
    } else if (password.length < 6) {
      setError("Use at least 6 characters. Twelve or more unique characters from a password manager are strongly recommended.");
    } else if (password !== confirmation) {
      setError("The new passwords do not match.");
    } else {
      setBusy(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const weak = /password|characters|weak/i.test(updateError.message);
        setError(weak
          ? "Supabase rejected that password under the current Auth policy. Use a longer, unique password and try again."
          : "The current authenticated identity could not update its password. No password was changed.");
      } else {
        const { error: revocationError } = await supabase.auth.signOut({ scope: "others" });
        setPassword("");
        setConfirmation("");
        setMessage(revocationError
          ? "Password changed. Supabase did not confirm revocation of other sessions; contact security@elysiaecobotics.com if account access may be compromised."
          : "Password changed for this Website Account. Supabase accepted revocation of other sessions; short-lived access tokens may remain valid until expiry.");
      }
      setBusy(false);
      if (updateError) requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  return <div className="page-stack account-recovery-page">
    <PageMetadata
      title="Change Password | Elysia Ecobotics Online"
      description="Change the signed-in user's shared Elysia Website Account password."
      canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/change-password`}
    />
    <PageHero eyebrow="Account & Security" title="Change Password" brandMark="standard">
      <p>Change only the password for the currently authenticated shared Website Account. This page cannot target another user and never handles private local Elysia credentials.</p>
    </PageHero>
    <RequireMember label="Password changes require the current authenticated Website Account.">
      <section className="two-column account-recovery-layout">
        <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
          <p className="eyebrow">Signed-in security</p>
          <h2>Choose a new Website Account password</h2>
          <p>At least 6 characters are accepted for compatibility with the canonical Auth policy. A long, unique password is strongly recommended.</p>
          <label htmlFor="change-account-password"><span>New password</span><input id="change-account-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label htmlFor="confirm-account-password"><span>Confirm new password</span><input id="confirm-account-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          {message && <div className="validation validation--ok" role="status">{message}</div>}
          <div className="button-row"><button className="button-primary" disabled={busy || password.length < 6 || !confirmation} type="submit">{busy ? "Changing securely…" : "Change Password"}</button><Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div>
        </form>
        <div className="page-stack">
          <WarningCallout title="One shared identity"><p>The password belongs to the canonical Online identity used by the Elysia public ecosystem, including Artisan. Artisan does not maintain a second password.</p></WarningCallout>
          <WarningCallout title="No governance changes"><p>A password change does not alter eligibility, restrictions, moderation, guardian relationships, legal requirements, roles, purchases, or account activation.</p></WarningCallout>
        </div>
      </section>
    </RequireMember>
  </div>;
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { useAuth } from "../../shared/auth/useAuth";
import { hasSupabaseConfig, supabase } from "../The-Elysia-Marketplace/lib/supabase";

export default function AccountRecoveryPage() {
  const { session, loading, recoveryMode } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState("");
  const [sessionRevocationWarning, setSessionRevocationWarning] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) setSettled(true);
  }, [loading]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase || !hasSupabaseConfig || !session || !recoveryMode) {
      setError("The recovery link is missing, expired, or already used. Request a new recovery email.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for the new Website Account password. Twelve or more unique characters are strongly recommended.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (password !== confirmPassword) {
      setError("The new passwords do not match.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      const weak = /password|characters|weak/i.test(updateError.message);
      setError(weak ? "Supabase rejected that password under the current Auth policy. Use a longer, unique password and try again." : "The recovery session could not update the password. The link may have expired; request a new one.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const { error: revocationError } = await supabase.auth.signOut({ scope: "others" });
    setSessionRevocationWarning(revocationError
      ? "The password changed, but Supabase did not confirm revocation of other sessions. Contact security@elysiaecobotics.com if unauthorized access is possible."
      : "Supabase accepted the request to revoke other sessions. Existing short-lived access tokens may remain valid until they expire.");
    setPassword("");
    setConfirmPassword("");
    setComplete(true);
  }

  const unavailable = settled && (!session || !recoveryMode) && !complete;
  return <div className="page-stack account-recovery-page">
    <PageHero eyebrow="Website Account" title={complete ? "Account access restored" : "Choose a new password"} brandMark="standard"><p>This recovery page changes only the public Elysia Ecobotics Online Website Account password. It does not receive or alter private local Elysia credentials.</p></PageHero>
    <section className="two-column account-recovery-layout">
      <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
        <p className="eyebrow">Password recovery</p>
        {loading && <p className="inline-status" role="status">Validating the recovery session...</p>}
        {unavailable && <>
          <h2>Recovery link unavailable</h2>
          <div className="validation validation--bad" role="alert">The recovery link is missing, expired, or already used. No password was changed.</div>
          <div className="button-row"><Link className="button-link button-link--primary" to="/account/forgot-password">Request a new recovery link</Link><Link className="button-link" to="/commons-circle">Return to sign in</Link></div>
        </>}
        {session && recoveryMode && !complete && <>
          <h2>Set a new Website Account password</h2>
          <p>At least 6 characters are accepted for compatibility with the current Website Account policy. Twelve or more unique characters from a password manager are strongly recommended.</p>
          <label htmlFor="new-password"><span>New password</span><input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required autoFocus /></label>
          <label htmlFor="confirm-new-password"><span>Confirm new password</span><input id="confirm-new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>
          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          <div className="button-row"><button className="button-primary" type="submit" disabled={busy || password.length < 6 || !confirmPassword}>{busy ? "Updating securely..." : "Update password"}</button><Link className="button-link" to="/account/forgot-password">Request another link</Link></div>
        </>}
        {complete && <>
          <h2>Password updated</h2>
          <p className="inline-status" role="status">The Website Account password was updated. Your Commons profile, Free Member recognition, content, roles, purchases, and private economic records were not recreated or moved.</p>
          {sessionRevocationWarning && <p className="boundary-note" role="status">{sessionRevocationWarning}</p>}
          <div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle">Open Commons Circle</Link><Link className="button-link" to="/commons-circle/support-billing">Open Support &amp; Billing</Link></div>
        </>}
      </form>
      <div className="page-stack">
        <WarningCallout title="Recovery is identity continuity"><p>Paid history and entitlements stay connected to the original Supabase Auth identity. Recovery must never bootstrap a replacement profile from an email match.</p></WarningCallout>
        <WarningCallout title="No authority changes"><p>Changing a password does not change governance roles, moderation status, badges, developer approval, publisher identity, or sandbox safety limits.</p></WarningCallout>
        <WarningCallout title="Session concern"><p>After recovery, review account activity and contact <a href="mailto:security@elysiaecobotics.com">security@elysiaecobotics.com</a> if you suspect unauthorized access.</p></WarningCallout>
      </div>
    </section>
  </div>;
}

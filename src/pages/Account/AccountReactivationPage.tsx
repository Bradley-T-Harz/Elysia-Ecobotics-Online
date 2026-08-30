import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import RequireMember from "../../shared/auth/RequireMember";
import { useAuth } from "../../shared/auth/useAuth";
import { useParticipation } from "../../shared/participation/useParticipation";
import TurnstileWidget from "../../shared/participation/TurnstileWidget";
import { createIdentityClientRequestId, friendlyIdentityError, reactivateCurrentAccount } from "../../shared/participation/participationClient";
import { supabase } from "../The-Elysia-Marketplace/lib/supabase";

export default function AccountReactivationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, email, session } = useAuth();
  const { bootstrap, refresh, state } = useParticipation();
  const [confirmation, setConfirmation] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const handleTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);
  const deactivated = bootstrap?.accountActivation?.state === "temporarily_deactivated";
  const justDeactivated = Boolean((location.state as { deactivated?: boolean } | null)?.deactivated);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!accessToken || !deactivated) {
      setError("Sign in to a temporarily deactivated Website Account before reactivating it.");
    } else if (confirmation !== "REACTIVATE") {
      setError("Type REACTIVATE exactly to restore access.");
    } else if (!turnstileToken) {
      setError("Complete the human-verification check before reactivating the account.");
    } else {
      setBusy(true);
      try {
        await reactivateCurrentAccount(accessToken, {
          clientRequestId: createIdentityClientRequestId(),
          confirmation: "REACTIVATE",
          turnstileToken,
        });
        refresh();
        navigate("/commons-circle/settings", { replace: true });
        return;
      } catch (reason) {
        setError(friendlyIdentityError(reason));
      } finally {
        setBusy(false);
        setTurnstileToken(null);
        setResetKey((current) => current + 1);
      }
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function signOut() {
    await supabase?.auth.signOut({ scope: "local" });
  }

  return <div className="page-stack account-recovery-page">
    <PageMetadata title="Reactivate Account | Elysia Ecobotics Online" description="Explicitly reactivate the current voluntarily paused shared Elysia Website Account." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/reactivate`} />
    <PageHero eyebrow="Restricted lifecycle access" title="Reactivate Account" brandMark="standard"><p>A temporarily deactivated user can authenticate here without regaining ordinary community access. Reactivation is always explicit and removes only the voluntary pause.</p></PageHero>
    {justDeactivated && !session && <div className="validation validation--ok" role="status">Your account is temporarily deactivated and the ordinary application session ended. Sign in again through Commons Circle; you will return to this restricted lifecycle surface.</div>}
    <RequireMember label="Reactivation requires a fresh sign-in to the temporarily deactivated Website Account.">
      <section className="two-column account-recovery-layout">
        <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
          <p className="eyebrow">Current account only</p>
          {state === "loading" && <p className="inline-status">Checking account activation…</p>}
          {state === "ready" && !deactivated && <><h2>This account is active</h2><p>No voluntary deactivation is present for {email ?? "this authenticated identity"}.</p><div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div></>}
          {deactivated && <>
            <h2>Restore ordinary account access</h2>
            <p>Your underlying participation state remains <strong>{bootstrap.communityAccess.participationState.replace(/_/g, " ")}</strong>. Reactivation does not promote, loosen, or replace it.</p>
            <label htmlFor="reactivate-confirmation"><span>Type REACTIVATE</span><input id="reactivate-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} /></label>
            <TurnstileWidget action="identity_lifecycle_request" onTokenChange={handleTurnstileToken} resetKey={resetKey} />
            {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
            <div className="button-row"><button className="button-primary" type="submit" disabled={busy || confirmation !== "REACTIVATE" || !turnstileToken}>{busy ? "Reactivating securely…" : "Reactivate Account"}</button></div>
          </>}
          {session && <div className="account-lifecycle-links"><Link to="/account/export">Export account data</Link><Link to="/account/delete">Permanently delete account</Link><Link to="/support">Support</Link><button className="text-button" type="button" onClick={() => void signOut()}>Sign out</button></div>}
        </form>
        <div className="page-stack">
          <WarningCallout title="Restrictions remain authoritative"><p>Reactivation cannot override a suspension, block, deletion request, guardian rule, legal requirement, moderation state, or economic closure requirement.</p></WarningCallout>
          <WarningCallout title="Privacy choices are preserved"><p>Reactivation does not guess a former state and does not silently enable a public profile. Your stored publication choice and profile configuration remain unchanged.</p></WarningCallout>
        </div>
      </section>
    </RequireMember>
  </div>;
}

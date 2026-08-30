import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import RequireMember from "../../shared/auth/RequireMember";
import { useAuth } from "../../shared/auth/useAuth";
import { hasSupabaseConfig, supabase } from "../The-Elysia-Marketplace/lib/supabase";
import TurnstileWidget from "../../shared/participation/TurnstileWidget";
import { createIdentityClientRequestId, deactivateCurrentAccount, friendlyIdentityError } from "../../shared/participation/participationClient";

export default function AccountDeactivationPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const handleTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!accessToken) {
      setError("Sign in to the Website Account you want to pause.");
    } else if (confirmation !== "DEACTIVATE") {
      setError("Type DEACTIVATE exactly to confirm this voluntary pause.");
    } else if (!turnstileToken) {
      setError("Complete the human-verification check before pausing the account.");
    } else {
      setBusy(true);
      try {
        await deactivateCurrentAccount(accessToken, {
          clientRequestId: createIdentityClientRequestId(),
          confirmation: "DEACTIVATE",
          turnstileToken,
        });
        if (supabase && hasSupabaseConfig) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
          if (signOutError) await supabase.auth.signOut({ scope: "local" });
        }
        navigate("/account/reactivate", { replace: true, state: { deactivated: true } });
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

  return <div className="page-stack account-recovery-page">
    <PageMetadata title="Temporarily Deactivate Account | Elysia Ecobotics Online" description="Voluntarily pause the current shared Elysia Website Account without changing its participation state." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/account/deactivate`} />
    <PageHero eyebrow="Account & Security" title="Temporarily Deactivate Account" brandMark="standard"><p>Pause your own shared Website Account without deleting its identity, profile configuration, contributions, purchases, messages, Saved Shelves, or underlying governance state.</p></PageHero>
    <RequireMember label="Temporary deactivation requires the Website Account being paused.">
      <section className="two-column account-recovery-layout">
        <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
          <p className="eyebrow">Reversible account pause</p>
          <h2>Confirm temporary deactivation</h2>
          <p>While paused, your public profile is hidden and ordinary posting, messaging, uploads, sandbox work, and Artisan participation remain unavailable. You can sign in again only to use the restricted lifecycle controls and reactivate explicitly.</p>
          <label htmlFor="deactivate-confirmation"><span>Type DEACTIVATE</span><input id="deactivate-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} /></label>
          <TurnstileWidget action="identity_lifecycle_request" onTokenChange={handleTurnstileToken} resetKey={resetKey} />
          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          <div className="button-row"><button className="account-security-control" type="submit" disabled={busy || confirmation !== "DEACTIVATE" || !turnstileToken}>{busy ? "Pausing securely…" : "Temporarily Deactivate Account"}</button><Link className="button-link" to="/commons-circle/settings">Keep account active</Link></div>
        </form>
        <div className="page-stack">
          <WarningCallout title="Your governance state stays intact"><p>Adult eligibility remains adult eligibility; restrictions, youth and guardian states, suspensions, blocks, legal conditions, and moderation remain exactly as they are underneath the pause.</p></WarningCallout>
          <WarningCallout title="Not permanent deletion"><p>This action does not run storage cleanup, delete Auth, clear your public-profile preference or biography, cancel legal retention, or bypass the governed deletion lifecycle.</p></WarningCallout>
          <WarningCallout title="Sessions end after success"><p>On successful deactivation, the application requests global sign-out. You must authenticate again before reactivation.</p></WarningCallout>
        </div>
      </section>
    </RequireMember>
  </div>;
}

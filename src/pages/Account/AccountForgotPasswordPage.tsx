import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AuthTurnstile,
  type AuthTurnstileHandle
} from "../../shared/auth/AuthTurnstile";
import {
  authCaptchaConfig,
  onlineAuthHostPolicy
} from "../../shared/auth/authCaptcha";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { hasSupabaseConfig, supabase } from "../The-Elysia-Marketplace/lib/supabase";

export default function AccountForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [authCaptchaResetKey, setAuthCaptchaResetKey] = useState(0);
  const authCaptchaTokenRef = useRef<string | null>(null);
  const authTurnstileRef = useRef<AuthTurnstileHandle | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const authHostPolicy = onlineAuthHostPolicy();

  function setAuthCaptchaToken(token: string | null) {
    authCaptchaTokenRef.current = token;
  }

  function resetAuthChallenge() {
    authCaptchaTokenRef.current = null;
    if (authCaptchaConfig.mode !== "off") {
      setAuthCaptchaResetKey((value) => value + 1);
    }
  }

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase || !hasSupabaseConfig) {
      showError("Account recovery is unavailable because website authentication is not configured. No recovery email was sent.");
      return;
    }
    if (!email.trim()) {
      showError("Enter the email address used for your Website Account.");
      return;
    }
    if (authCaptchaConfig.mode === "required" && !authCaptchaTokenRef.current) {
      showError("Complete the account safety verification before requesting a recovery link.");
      requestAnimationFrame(() => authTurnstileRef.current?.focus());
      return;
    }
    const captchaToken = authCaptchaTokenRef.current ?? undefined;
    authCaptchaTokenRef.current = null;
    setBusy(true);
    const redirectTo = `${window.location.origin}/account/recovery`;
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
        ...(captchaToken ? { captchaToken } : {})
      });
      if (recoveryError) {
        const errorDetails = `${recoveryError.code ?? ""} ${recoveryError.message}`;
        if (/captcha/i.test(errorDetails)) {
          showError("The account safety verification was not accepted. Complete a fresh verification and try again.");
        } else if (recoveryError.status === 429 || /rate|too many|seconds/i.test(errorDetails)) {
          showError("Too many recovery requests were made. Wait before trying again.");
        } else if (/failed to fetch|fetch failed|network|load failed/i.test(errorDetails)) {
          showError("The recovery request could not reach authentication. Check your connection and try again.");
        } else {
          showError("The recovery request could not be sent safely. Check the address and try again later.");
        }
        return;
      }
      setComplete(true);
    } catch {
      showError("The recovery request could not reach authentication. Check your connection and try again.");
    } finally {
      setBusy(false);
      resetAuthChallenge();
    }
  }

  if (!authHostPolicy.allowed) {
    return <div className="page-stack account-recovery-page">
      <PageHero eyebrow="Website Account" title="Use the canonical recovery page" brandMark="standard">
        <p>Recovery requests are not available from this deployment hostname.</p>
      </PageHero>
      <section className="section-card">
        <a className="button-link" href={authHostPolicy.canonicalUrl}>
          Continue securely on elysiaecobotics.com
        </a>
      </section>
    </div>;
  }

  return <div className="page-stack account-recovery-page">
    <PageHero eyebrow="Website Account" title="Recover account access" brandMark="standard"><p>Request a time-limited Supabase recovery link for the public Elysia Ecobotics Online Website Account. This does not access or change private local Elysia credentials.</p></PageHero>
    <section className="two-column account-recovery-layout">
      <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
        <p className="eyebrow">Forgot password</p>
        <h2>{complete ? "Check your email" : "Send a recovery link"}</h2>
        {complete ? <>
          <p className="inline-status" role="status">If an account can receive recovery mail at that address, Supabase will send a time-limited link. For privacy, this page does not confirm whether an account exists.</p>
          <p>Open the newest recovery message on the same browser when possible. Older links may expire after a newer request.</p>
          <div className="button-row"><button type="button" onClick={() => { setComplete(false); setEmail(""); }}>Request another link</button><Link className="button-link" to="/commons-circle">Return to sign in</Link></div>
        </> : <>
          <label htmlFor="recovery-email"><span>Website Account email</span><input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required /></label>
          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          <AuthTurnstile
            ref={authTurnstileRef}
            action="online_recovery"
            onTokenChange={setAuthCaptchaToken}
            resetKey={authCaptchaResetKey}
          />
          {authCaptchaConfig.mode === "preflight" && <p className="boundary-note">This verification is in client-readiness preflight. Server enforcement is not active yet.</p>}
          <div className="button-row"><button className="button-primary" type="submit" disabled={busy || !email.trim()}>{busy ? "Sending securely..." : "Send recovery link"}</button><Link className="button-link" to="/commons-circle">Back to Website Account</Link></div>
        </>}
      </form>
      <div className="page-stack">
        <WarningCallout title="Local credentials stay local"><p>Never enter a private local Elysia password here. Website Account recovery affects only Supabase authentication for this public website.</p></WarningCallout>
        <WarningCallout title="Paid value remains private"><p>Recovery restores access to the same Auth identity used for private billing history and entitlements. It does not create a new profile, badge, role, or customer record.</p></WarningCallout>
        <WarningCallout title="Unexpected message?"><p>Do not open recovery links you did not request. Visit this website directly and contact <a href="mailto:security@elysiaecobotics.com">security@elysiaecobotics.com</a> if a message appears suspicious.</p></WarningCallout>
      </div>
    </section>
  </div>;
}

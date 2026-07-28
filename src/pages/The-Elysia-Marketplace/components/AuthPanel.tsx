import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../lib/supabase";
import { requestWebsiteAccountSignup } from "./authSignup";
import {
  AUTH_SIGNUP_DIAGNOSTIC_CONTRACT,
  authSignupRouteForPath,
  authSignupDiagnosticSummary,
  beginAuthSignupDiagnostic,
  finishAuthSignupDiagnostic,
  getAuthSignupDiagnostic,
  restoredAuthSignupMessage,
  safeAuthDiagnosticCode,
  subscribeToAuthSignupDiagnostic,
  currentAuthSignupBrowserFamily,
  updateAuthSignupDiagnostic,
  type AuthSignupDiagnostic,
  type AuthSignupMessageCategory,
  type AuthSignupPasswordClearReason
} from "./authSignupDiagnostics";

type AuthPanelCopy = {
  eyebrow?: string;
  title?: string;
  description?: string;
  signedOutText?: string;
  confirmationPath?: string;
  confirmationCopy?: string;
};

type AuthPanelProps = {
  onMessage: (message: string) => void;
  onAuthChanged: () => Promise<void>;
  copy?: AuthPanelCopy;
};

export default function AuthPanel({ onMessage, onAuthChanged, copy }: AuthPanelProps) {
  const [signupDiagnostic, setSignupDiagnostic] = useState<AuthSignupDiagnostic | null>(() => getAuthSignupDiagnostic());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [localStatus, setLocalStatus] = useState(() => restoredAuthSignupMessage(signupDiagnostic));
  const [authMode, setAuthMode] = useState<"sign_in" | "sign_up">("sign_in");
  const signupPendingRef = useRef(false);
  const signupAttemptIdRef = useRef<string | null>(null);
  const currentSignupRoute = authSignupRouteForPath(window.location.pathname);
  const currentBrowserFamily = signupDiagnostic?.browserFamily ?? currentAuthSignupBrowserFamily();

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setLocalStatus("The Website Account session could not be loaded safely. Refresh the page or sign in again.");
        return;
      }
      setSession(data.session);
      if (data.session?.user.email) {
        setLocalStatus(`Signed in as ${data.session.user.email}.`);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_IN" && nextSession?.user.email) {
        emit(`Signed in as ${nextSession.user.email}.`);
      }
      if (event === "SIGNED_OUT") {
        setLocalStatus("Signed out.");
      }
      if (event === "PASSWORD_RECOVERY") {
        setLocalStatus("Password recovery session detected. This marketplace does not collect local Elysia credentials.");
      }
      void onAuthChanged();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [onAuthChanged]);

  useEffect(() => subscribeToAuthSignupDiagnostic(setSignupDiagnostic), []);

  function emit(
    message: string,
    messageCategory?: AuthSignupMessageCategory,
    attemptId?: string
  ) {
    setLocalStatus(message);
    onMessage(message);
    if (messageCategory && attemptId) {
      updateAuthSignupDiagnostic(attemptId, { renderedMessageCategory: messageCategory });
    }
  }

  function clearPassword(reason: AuthSignupPasswordClearReason, attemptId?: string) {
    setPassword("");
    if (attemptId) updateAuthSignupDiagnostic(attemptId, { passwordClearReason: reason });
  }

  function restoreSubmittedPassword(submittedPassword: string, attemptId: string) {
    setPassword(submittedPassword);
    updateAuthSignupDiagnostic(attemptId, { passwordRestored: true });
  }

  function changePassword(nextPassword: string) {
    setPassword(nextPassword);
    if (!nextPassword && signupAttemptIdRef.current) {
      updateAuthSignupDiagnostic(signupAttemptIdRef.current, {
        passwordClearReason: "input_event_during_pending"
      });
    }
  }

  function safeAuthError(action: "sign-up" | "sign-in" | "sign-out", message: string, code = "", providerStatus?: number) {
    if (providerStatus === 429 || /rate|too many|seconds/i.test(`${code} ${message}`)) return "Too many authentication requests were made. Wait before trying again.";
    if (/failed to fetch|fetch failed|network|load failed/i.test(`${code} ${message}`)) return `The Website Account ${action} request could not reach authentication. Your password was not cleared; check your connection and try again.`;
    if (/captcha/i.test(`${code} ${message}`)) return "The Website Account safety check could not be completed. Refresh the page and try again.";
    if (/email_address_not_authorized|email address.*authorized|email.*provider|smtp/i.test(`${code} ${message}`)) return "Website Account confirmation email delivery is temporarily unavailable. Please try again later.";
    if (/already registered|already exists/i.test(message)) return "A Website Account may already use that email. Sign in or recover the password instead.";
    if (/invalid login|invalid credentials/i.test(message)) return "The email or password was not accepted. Confirm the email if required, or use password recovery.";
    if (/email.*confirm|not confirmed/i.test(message)) return "Confirm the Website Account email before signing in.";
    if (/password|characters|weak/i.test(message)) return "The password does not meet the current Website Account requirements. Use a longer, unique password.";
    if (action === "sign-out") return "The Website Account could not be signed out safely. Refresh the page and try again.";
    return `The Website Account ${action} request could not be completed safely. Please try again later.`;
  }

  async function signUp(submission: {
    submitEventReceived: boolean;
    preventDefaultCalled: boolean;
  }) {
    if (signupPendingRef.current) return;
    const submittedEmail = email.trim();
    const submittedPassword = password;
    const emailRedirectTo = `${window.location.origin}${copy?.confirmationPath ?? "/account"}`;
    const attempt = beginAuthSignupDiagnostic(submission);
    signupAttemptIdRef.current = attempt.attemptId;
    signupPendingRef.current = true;
    setBusy(true);
    emit("Submitting the Website Account request…", "pending", attempt.attemptId);
    try {
      const validationPassed = Boolean(submittedEmail && submittedPassword.length >= 6);
      updateAuthSignupDiagnostic(attempt.attemptId, {
        validationPassed,
        signupCalled: validationPassed && hasSupabaseConfig
      });
      const result = await requestWebsiteAccountSignup({
        client: hasSupabaseConfig ? supabase : null,
        email: submittedEmail,
        password: submittedPassword,
        emailRedirectTo
      });
      const networkError = result.status === "provider_error"
        && /failed to fetch|fetch failed|network|load failed/i.test(`${result.code ?? ""} ${result.message}`);
      const providerStatus = result.status === "provider_error"
        && typeof result.providerStatus === "number"
        && result.providerStatus >= 100
        && result.providerStatus <= 599
          ? result.providerStatus
          : undefined;
      updateAuthSignupDiagnostic(attempt.attemptId, {
        resultCategory: networkError ? "network_error" : result.status,
        safeCode: result.status === "provider_error" ? safeAuthDiagnosticCode(result.code) : undefined,
        httpStatus: result.status === "provider_error" ? providerStatus : getAuthSignupDiagnostic()?.httpStatus
      });
      if (result.status === "invalid_input") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit("Enter a valid email and a password of at least 6 characters before creating a Website Account.", "invalid_input", attempt.attemptId);
        return;
      }
      if (result.status === "configuration_unavailable") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit("Website Account creation is temporarily unavailable because authentication is not configured. Your password was not cleared.", "configuration_unavailable", attempt.attemptId);
        return;
      }
      if (result.status === "provider_error") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit(
          safeAuthError("sign-up", result.message, result.code, result.providerStatus),
          networkError ? "network_error" : "provider_error",
          attempt.attemptId
        );
        return;
      }
      if (result.status === "unexpected_error") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit("The Website Account sign-up request could not start safely. Your password was not cleared; please try again.", "unexpected_error", attempt.attemptId);
        return;
      }
      if (result.status === "unexpected_response") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit("The Website Account sign-up response could not be verified safely. Your password was not cleared; please try again later.", "unexpected_response", attempt.attemptId);
        return;
      }
      if (result.status === "confirmation_required") {
        clearPassword("confirmed_new_user", attempt.attemptId);
        emit("Account created. Check your email to confirm it before signing in.", "confirmation_required", attempt.attemptId);
        return;
      }
      if (result.status === "confirmation_or_existing") {
        restoreSubmittedPassword(submittedPassword, attempt.attemptId);
        emit("If this address can create a new account, check its inbox. Otherwise, sign in or recover the account.", "confirmation_or_existing", attempt.attemptId);
        return;
      }
      setSession(result.session);
      clearPassword("immediate_session", attempt.attemptId);
      emit(`Signed in as ${result.session.user.email ?? submittedEmail}.`, "signed_in", attempt.attemptId);
      await onAuthChanged();
    } catch {
      restoreSubmittedPassword(submittedPassword, attempt.attemptId);
      updateAuthSignupDiagnostic(attempt.attemptId, { resultCategory: "unexpected_error" });
      emit("The Website Account sign-up request could not finish safely. Your password was not cleared; please try again.", "unexpected_error", attempt.attemptId);
    } finally {
      signupPendingRef.current = false;
      signupAttemptIdRef.current = null;
      setBusy(false);
      finishAuthSignupDiagnostic(attempt.attemptId);
    }
  }

  async function signIn(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!supabase) { emit("Demo mode: sign-in form is visible, but no remote session is created."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { emit(safeAuthError("sign-in", error.message)); return; }
    const signedInEmail = data.session?.user.email ?? email;
    emit(`Signed in as ${signedInEmail}.`);
    setPassword("");
    await onAuthChanged();
  }

  async function signOut() {
    if (!supabase) { emit("Demo mode: no Supabase session to sign out."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { emit(safeAuthError("sign-out", error.message)); return; }
    emit("Signed out.");
    setSession(null);
    await onAuthChanged();
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMode === "sign_up") {
      await signUp({
        submitEventReceived: true,
        preventDefaultCalled: event.defaultPrevented
      });
    } else {
      await signIn();
    }
  }

  return (
    <section
      className="account-card"
      id="account"
      data-auth-signup-version={AUTH_SIGNUP_DIAGNOSTIC_CONTRACT}
      data-auth-signup-contract={AUTH_SIGNUP_DIAGNOSTIC_CONTRACT}
      data-auth-signup-attempt={signupDiagnostic?.attemptId ?? "none"}
      data-auth-signup-route={currentSignupRoute}
      data-auth-signup-browser={currentBrowserFamily}
      data-auth-signup-mode={session ? "signed_in" : authMode}
      data-auth-signup-handler-started={String(signupDiagnostic?.handlerStarted ?? false)}
      data-auth-signup-submit-received={String(signupDiagnostic?.submitEventReceived ?? false)}
      data-auth-signup-prevent-default={String(signupDiagnostic?.preventDefaultCalled ?? false)}
      data-auth-signup-validation-passed={String(signupDiagnostic?.validationPassed ?? false)}
      data-auth-signup-called={String(signupDiagnostic?.signupCalled ?? false)}
      data-auth-signup-sdk-called={String(signupDiagnostic?.signupCalled ?? false)}
      data-auth-signup-request-started={String(signupDiagnostic?.requestStarted ?? false)}
      data-auth-signup-request-completed={String(signupDiagnostic?.requestCompleted ?? false)}
      data-auth-signup-pagehide={String(signupDiagnostic?.pagehideFired ?? false)}
      data-auth-signup-beforeunload={String(signupDiagnostic?.beforeunloadFired ?? false)}
      data-auth-signup-navigation={String(signupDiagnostic?.navigationDetected ?? false)}
      data-auth-signup-http-status={signupDiagnostic?.httpStatus ?? ""}
      data-auth-signup-safe-code={signupDiagnostic?.safeCode ?? ""}
      data-auth-signup-result={signupDiagnostic?.resultCategory ?? "not_started"}
      data-auth-signup-pending={signupDiagnostic?.pendingState ?? "idle"}
      data-auth-signup-password-clear={signupDiagnostic?.passwordClearReason ?? "none"}
      data-auth-signup-password-restored={String(signupDiagnostic?.passwordRestored ?? false)}
      data-auth-signup-message={signupDiagnostic?.renderedMessageCategory ?? "none"}
    >
      <p className="eyebrow">{copy?.eyebrow ?? "Marketplace Account"}</p>
      <h2>{copy?.title ?? "Auth"}</h2>
      {!hasSupabaseConfig && <p className="demo-banner">{supabaseNotConfiguredMessage}</p>}
      <p>{copy?.description ?? "This creates a Marketplace account, not a local Elysia account. Do not enter your local Elysia password here."}</p>
      <div className="status-strip">
        <strong>{session ? "Signed in" : "Signed out"}</strong>
        <span>{session?.user.email ?? (hasSupabaseConfig ? (copy?.signedOutText ?? "No active Marketplace session.") : "Remote auth disabled until env vars are configured.")}</span>
      </div>
      {localStatus && <p className="inline-status">{localStatus}</p>}
      {signupDiagnostic && <p
        className="boundary-note"
        data-auth-signup-summary={signupDiagnostic.resultCategory}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >{authSignupDiagnosticSummary(signupDiagnostic)}</p>}
      {!session ? <form className="auth-form" onSubmit={submitAuth} noValidate>
        <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="builder@example.com" autoComplete="email" inputMode="email" disabled={busy} required /></label>
        <label><span>{authMode === "sign_up" ? "Create password" : "Password"}</span><input value={password} onChange={(event) => changePassword(event.target.value)} type="password" autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={authMode === "sign_up" ? 6 : undefined} disabled={busy} required />{authMode === "sign_up" && <small>At least 6 characters are accepted for compatibility; 12 or more unique characters are strongly recommended.</small>}</label>
        <div className="button-row">
          <button type="submit" disabled={busy || !email.trim() || !password || (authMode === "sign_up" && password.length < 6)}>{busy ? "Working..." : authMode === "sign_up" ? "Create Website Account" : "Sign in"}</button>
          <button type="button" disabled={busy} onClick={() => {
            setAuthMode((current) => current === "sign_in" ? "sign_up" : "sign_in");
            clearPassword("mode_change", signupDiagnostic?.attemptId);
            setLocalStatus("");
          }}>{authMode === "sign_up" ? "Use existing account" : "Create an account instead"}</button>
          {authMode === "sign_in" && <Link className="button-link" to="/account/forgot-password">Forgot password?</Link>}
        </div>
      </form> : <div className="button-row"><button type="button" disabled={busy} onClick={signOut}>{busy ? "Working..." : "Sign out"}</button></div>}
      <p className="boundary-note">{copy?.confirmationCopy ?? "If Supabase email confirmation is enabled, open the confirmation link to return to /account; the session should appear after Supabase completes the redirect."}</p>
    </section>
  );
}

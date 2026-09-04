import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import {
  AuthTurnstile,
  type AuthTurnstileHandle
} from "../../../shared/auth/AuthTurnstile";
import {
  authCaptchaConfig,
  onlineAuthHostPolicy
} from "../../../shared/auth/authCaptcha";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../lib/supabase";
import { requestWebsiteAccountSignup } from "./authSignup";
import {
  AUTH_SIGNUP_DIAGNOSTIC_CONTRACT,
  authSignupRouteForPath,
  authSignupDiagnosticSummary,
  beginAuthSignupDiagnostic,
  finishAuthSignupDiagnostic,
  getAuthSignupDiagnostic,
  safeAuthDiagnosticCode,
  subscribeToAuthSignupDiagnostic,
  currentAuthSignupBrowserFamily,
  updateAuthSignupDiagnostic,
  type AuthSignupDiagnostic,
  type AuthSignupMessageCategory,
  type AuthSignupPasswordClearReason
} from "./authSignupDiagnostics";

type AuthMode = "sign_in" | "sign_up";

type AuthFormInteractionDiagnostic = {
  modeSwitchReceived: boolean;
  modeSwitchPasswordClearReason: "none";
  domEmailPresent: boolean;
  domPasswordPresent: boolean;
  reactEmailPresent: boolean;
  reactPasswordPresent: boolean;
  formValid: boolean;
  emailValid: boolean;
  passwordValid: boolean;
  invalidEventFired: boolean;
  pointerReceived: boolean;
  clickReceived: boolean;
  buttonDisabled: boolean;
  disabledReason: "none" | "pending";
  submitReceived: boolean;
  formDataEmailPresent: boolean;
  formDataPasswordPresent: boolean;
};

function initialAuthFormInteraction(): AuthFormInteractionDiagnostic {
  return {
    modeSwitchReceived: false,
    modeSwitchPasswordClearReason: "none",
    domEmailPresent: false,
    domPasswordPresent: false,
    reactEmailPresent: false,
    reactPasswordPresent: false,
    formValid: false,
    emailValid: false,
    passwordValid: false,
    invalidEventFired: false,
    pointerReceived: false,
    clickReceived: false,
    buttonDisabled: false,
    disabledReason: "none",
    submitReceived: false,
    formDataEmailPresent: false,
    formDataPasswordPresent: false
  };
}

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
  const [reactEmailPresent, setReactEmailPresent] = useState(false);
  const [reactPasswordPresent, setReactPasswordPresent] = useState(false);
  const [formInteraction, setFormInteraction] = useState<AuthFormInteractionDiagnostic>(initialAuthFormInteraction);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [localStatus, setLocalStatus] = useState("");
  const [visibleSignupAttemptId, setVisibleSignupAttemptId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [authCaptchaReady, setAuthCaptchaReady] = useState(false);
  const [authCaptchaResetKey, setAuthCaptchaResetKey] = useState(0);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const authCaptchaTokenRef = useRef<string | null>(null);
  const authTurnstileRef = useRef<AuthTurnstileHandle | null>(null);
  const signupPendingRef = useRef(false);
  const signupAttemptIdRef = useRef<string | null>(null);
  const onAuthChangedRef = useRef(onAuthChanged);
  const onMessageRef = useRef(onMessage);
  const authenticatedUserIdRef = useRef<string | null>(null);
  const authHostPolicy = onlineAuthHostPolicy();
  const currentSignupRoute = authSignupRouteForPath(window.location.pathname);
  const currentBrowserFamily = signupDiagnostic?.browserFamily ?? currentAuthSignupBrowserFamily();
  const visibleSignupDiagnostic = signupDiagnostic?.attemptId === visibleSignupAttemptId
    ? signupDiagnostic
    : null;

  useEffect(() => {
    onAuthChangedRef.current = onAuthChanged;
    onMessageRef.current = onMessage;
  }, [onAuthChanged, onMessage]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setLocalStatus("The Website Account session could not be loaded safely. Refresh the page or sign in again.");
        return;
      }
      authenticatedUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      if (data.session?.user.email) {
        setLocalStatus(`Signed in as ${data.session.user.email}.`);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const previousUserId = authenticatedUserIdRef.current;
      const nextUserId = nextSession?.user.id ?? null;
      const accountChanged = previousUserId !== nextUserId;
      authenticatedUserIdRef.current = nextUserId;
      setSession(nextSession);
      if (event === "SIGNED_IN" && nextSession?.user.email) {
        const message = `Signed in as ${nextSession.user.email}.`;
        setLocalStatus(message);
        onMessageRef.current(message);
      }
      if (event === "SIGNED_OUT") {
        setLocalStatus("Signed out.");
      }
      if (event === "PASSWORD_RECOVERY") {
        setLocalStatus("Password recovery session detected. This marketplace does not collect local Elysia credentials.");
      }
      const shouldRefreshDomain = (
        (event === "SIGNED_IN" && accountChanged)
        || (event === "SIGNED_OUT" && previousUserId !== null)
        || (event === "PASSWORD_RECOVERY" && accountChanged)
        || event === "USER_UPDATED"
      );
      if (shouldRefreshDomain) void onAuthChangedRef.current();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
    if (passwordInputRef.current) passwordInputRef.current.value = "";
    setReactPasswordPresent(false);
    if (attemptId) updateAuthSignupDiagnostic(attemptId, { passwordClearReason: reason });
  }

  function restoreSubmittedPassword(submittedPassword: string, attemptId: string) {
    if (passwordInputRef.current) passwordInputRef.current.value = submittedPassword;
    setReactPasswordPresent(Boolean(submittedPassword));
    updateAuthSignupDiagnostic(attemptId, { passwordRestored: true });
  }

  function changePassword(nextPassword: string) {
    setReactPasswordPresent(Boolean(nextPassword));
    if (!nextPassword && signupAttemptIdRef.current) {
      updateAuthSignupDiagnostic(signupAttemptIdRef.current, {
        passwordClearReason: "input_event_during_pending"
      });
    }
  }

  function setAuthCaptchaToken(token: string | null) {
    authCaptchaTokenRef.current = token;
    setAuthCaptchaReady(Boolean(token));
  }

  function resetAuthChallenge() {
    authCaptchaTokenRef.current = null;
    setAuthCaptchaReady(false);
    if (authCaptchaConfig.mode !== "off") {
      setAuthCaptchaResetKey((value) => value + 1);
    }
  }

  function consumeAuthCaptchaToken(): string | undefined {
    const token = authCaptchaTokenRef.current ?? undefined;
    authCaptchaTokenRef.current = null;
    setAuthCaptchaReady(false);
    return token;
  }

  function requireAuthCaptchaToken(): boolean {
    if (authCaptchaConfig.mode !== "required" || authCaptchaTokenRef.current) return true;
    setLocalStatus("Complete the account safety verification before continuing. Your password was not cleared.");
    requestAnimationFrame(() => authTurnstileRef.current?.focus());
    return false;
  }

  function readAuthFormSnapshot(mode = authMode) {
    const emailInput = emailInputRef.current;
    const passwordInput = passwordInputRef.current;
    const domEmailPresent = Boolean(emailInput?.value.trim());
    const domPasswordPresent = Boolean(passwordInput?.value);
    const emailValid = Boolean(emailInput?.validity.valid && domEmailPresent);
    const passwordValid = Boolean(
      passwordInput?.validity.valid
      && domPasswordPresent
      && (mode !== "sign_up" || passwordInput.value.length >= 6)
    );
    return {
      domEmailPresent,
      domPasswordPresent,
      reactEmailPresent,
      reactPasswordPresent,
      emailValid,
      passwordValid,
      formValid: emailValid && passwordValid,
      buttonDisabled: busy,
      disabledReason: busy ? "pending" as const : "none" as const
    };
  }

  function recordAuthFormInteraction(
    update: Partial<AuthFormInteractionDiagnostic>,
    mode = authMode
  ) {
    const snapshot = readAuthFormSnapshot(mode);
    setFormInteraction((current) => ({ ...current, ...snapshot, ...update }));
  }

  function selectAuthMode(nextMode: AuthMode) {
    if (busy || nextMode === authMode) return;
    resetAuthChallenge();
    setAuthMode(nextMode);
    setLocalStatus("");
    recordAuthFormInteraction({
      modeSwitchReceived: true,
      modeSwitchPasswordClearReason: "none",
      invalidEventFired: false,
      pointerReceived: false,
      clickReceived: false,
      submitReceived: false,
      formDataEmailPresent: false,
      formDataPasswordPresent: false
    }, nextMode);
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

  async function signUp(input: {
    email: string;
    password: string;
    submitEventReceived: boolean;
    preventDefaultCalled: boolean;
    captchaToken?: string;
  }) {
    if (signupPendingRef.current) return;
    const submittedEmail = input.email.trim();
    const submittedPassword = input.password;
    const emailRedirectTo = `${window.location.origin}${copy?.confirmationPath ?? "/account"}`;
    const attempt = beginAuthSignupDiagnostic({
      submitEventReceived: input.submitEventReceived,
      preventDefaultCalled: input.preventDefaultCalled
    });
    signupAttemptIdRef.current = attempt.attemptId;
    setVisibleSignupAttemptId(attempt.attemptId);
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
        emailRedirectTo,
        captchaToken: input.captchaToken
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
    } catch {
      restoreSubmittedPassword(submittedPassword, attempt.attemptId);
      updateAuthSignupDiagnostic(attempt.attemptId, { resultCategory: "unexpected_error" });
      emit("The Website Account sign-up request could not finish safely. Your password was not cleared; please try again.", "unexpected_error", attempt.attemptId);
    } finally {
      signupPendingRef.current = false;
      signupAttemptIdRef.current = null;
      setBusy(false);
      finishAuthSignupDiagnostic(attempt.attemptId);
      resetAuthChallenge();
    }
  }

  async function signIn(submittedEmail: string, submittedPassword: string, captchaToken?: string) {
    if (!supabase) {
      emit("Demo mode: sign-in form is visible, but no remote session is created.");
      resetAuthChallenge();
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: submittedEmail.trim(),
        password: submittedPassword,
        ...(captchaToken ? { options: { captchaToken } } : {})
      });
      if (error) {
        emit(safeAuthError("sign-in", error.message, error.code, error.status));
        return;
      }
      const signedInEmail = data.session?.user.email ?? submittedEmail.trim();
      emit(`Signed in as ${signedInEmail}.`);
      if (passwordInputRef.current) passwordInputRef.current.value = "";
      setReactPasswordPresent(false);
    } catch {
      emit("The Website Account sign-in request could not reach authentication. Your password was not cleared; check your connection and try again.");
    } finally {
      setBusy(false);
      resetAuthChallenge();
    }
  }

  async function signOut() {
    if (!supabase) { emit("Demo mode: no Supabase session to sign out."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { emit(safeAuthError("sign-out", error.message)); return; }
    emit("Signed out.");
    setSession(null);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const formData = new FormData(submittedForm);
    const emailEntry = formData.get("email");
    const passwordEntry = formData.get("password");
    const submittedEmail = typeof emailEntry === "string" ? emailEntry.trim() : "";
    const submittedPassword = typeof passwordEntry === "string" ? passwordEntry : "";
    recordAuthFormInteraction({
      submitReceived: true,
      formDataEmailPresent: Boolean(submittedEmail),
      formDataPasswordPresent: Boolean(submittedPassword)
    });
    if (!requireAuthCaptchaToken()) return;
    const captchaToken = consumeAuthCaptchaToken();
    if (authMode === "sign_up") {
      await signUp({
        email: submittedEmail,
        password: submittedPassword,
        submitEventReceived: true,
        preventDefaultCalled: event.defaultPrevented,
        captchaToken
      });
    } else {
      await signIn(submittedEmail, submittedPassword, captchaToken);
    }
  }

  if (!authHostPolicy.allowed) {
    return (
      <section className="account-card" id="account">
        <p className="eyebrow">{copy?.eyebrow ?? "Website Account"}</p>
        <h2>Use the canonical Website Account page</h2>
        <p>Account requests are not available from this deployment hostname.</p>
        <p>
          <a className="button-link" href={authHostPolicy.canonicalUrl}>
            Continue securely on elysiaecobotics.com
          </a>
        </p>
      </section>
    );
  }

  return (
    <section
      className="account-card"
      id="account"
      data-remote-auth-configured={String(hasSupabaseConfig)}
      data-auth-signup-version={AUTH_SIGNUP_DIAGNOSTIC_CONTRACT}
      data-auth-signup-contract={AUTH_SIGNUP_DIAGNOSTIC_CONTRACT}
      data-auth-signup-attempt={signupDiagnostic?.attemptId ?? "none"}
      data-auth-signup-route={currentSignupRoute}
      data-auth-signup-browser={currentBrowserFamily}
      data-auth-signup-mode={session ? "signed_in" : authMode}
      data-auth-signup-mode-switch-received={String(formInteraction.modeSwitchReceived)}
      data-auth-signup-mode-switch-password-clear={formInteraction.modeSwitchPasswordClearReason}
      data-auth-signup-dom-email-present={String(formInteraction.domEmailPresent)}
      data-auth-signup-dom-password-present={String(formInteraction.domPasswordPresent)}
      data-auth-signup-react-email-present={String(reactEmailPresent)}
      data-auth-signup-react-password-present={String(reactPasswordPresent)}
      data-auth-signup-form-valid={String(formInteraction.formValid)}
      data-auth-signup-email-valid={String(formInteraction.emailValid)}
      data-auth-signup-password-valid={String(formInteraction.passwordValid)}
      data-auth-signup-invalid-event={String(formInteraction.invalidEventFired)}
      data-auth-signup-pointer-received={String(formInteraction.pointerReceived)}
      data-auth-signup-click-received={String(formInteraction.clickReceived)}
      data-auth-signup-button-disabled={String(busy)}
      data-auth-signup-disabled-reason={busy ? "pending" : formInteraction.disabledReason}
      data-auth-signup-form-submit-received={String(formInteraction.submitReceived)}
      data-auth-signup-formdata-email-present={String(formInteraction.formDataEmailPresent)}
      data-auth-signup-formdata-password-present={String(formInteraction.formDataPasswordPresent)}
      data-auth-signup-handler-started={String(signupDiagnostic?.handlerStarted ?? false)}
      data-auth-signup-submit-received={String(signupDiagnostic?.submitEventReceived ?? formInteraction.submitReceived)}
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
      {visibleSignupDiagnostic && <p
        className="boundary-note"
        data-auth-signup-summary={visibleSignupDiagnostic.resultCategory}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >{authSignupDiagnosticSummary(visibleSignupDiagnostic)}</p>}
      {!session ? <>
        <div className="auth-mode-picker">
          <p className="auth-mode-picker__label" id="website-account-mode-label">Account mode</p>
          <div className="auth-mode-selector" role="group" aria-labelledby="website-account-mode-label">
            <button
              id="website-account-sign-in-mode"
              type="button"
              className={`auth-mode-selector__option${authMode === "sign_in" ? " auth-mode-selector__option--active" : ""}`}
              aria-label="Use sign-in mode"
              aria-pressed={authMode === "sign_in"}
              disabled={busy}
              onClick={() => selectAuthMode("sign_in")}
            >Sign in</button>
            <button
              id="website-account-create-mode"
              type="button"
              className={`auth-mode-selector__option${authMode === "sign_up" ? " auth-mode-selector__option--active" : ""}`}
              aria-label="Use create-account mode"
              aria-pressed={authMode === "sign_up"}
              disabled={busy}
              onClick={() => selectAuthMode("sign_up")}
            >Create Account</button>
          </div>
        </div>
        <form
          id="website-account-auth-form"
          name="website-account-auth"
          className="auth-form"
          onSubmit={submitAuth}
          onInvalidCapture={() => {
            recordAuthFormInteraction({ invalidEventFired: true });
            setLocalStatus("Enter a valid email and password before continuing.");
          }}
        >
        <label htmlFor="website-account-email"><span>Email</span><input
          ref={emailInputRef}
          id="website-account-email"
          name="email"
          type="email"
          placeholder="builder@example.com"
          autoComplete="email"
          inputMode="email"
          disabled={busy}
          required
          onChange={(event) => setReactEmailPresent(Boolean(event.currentTarget.value.trim()))}
        /></label>
        <label htmlFor={authMode === "sign_up" ? "website-account-new-password" : "website-account-password"}><span>{authMode === "sign_up" ? "Create password" : "Password"}</span><input
          ref={passwordInputRef}
          id={authMode === "sign_up" ? "website-account-new-password" : "website-account-password"}
          name="password"
          type="password"
          autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
          minLength={authMode === "sign_up" ? 6 : undefined}
          disabled={busy}
          required
          onChange={(event) => changePassword(event.currentTarget.value)}
        />{authMode === "sign_up" && <small>At least 6 characters are accepted for compatibility; 12 or more unique characters are strongly recommended.</small>}</label>
        <AuthTurnstile
          ref={authTurnstileRef}
          action={authMode === "sign_up" ? "online_signup" : "online_signin"}
          onTokenChange={setAuthCaptchaToken}
          resetKey={authCaptchaResetKey}
        />
        {authCaptchaConfig.mode === "preflight" && (
          <p className="boundary-note">
            This verification is in client-readiness preflight. Server enforcement is not active yet.
          </p>
        )}
        <div className="button-row">
          <button
            id="website-account-submit"
            className="button-primary auth-submit-action"
            type="submit"
            disabled={busy}
            onPointerDown={() => recordAuthFormInteraction({ pointerReceived: true })}
            onClick={() => recordAuthFormInteraction({ clickReceived: true })}
          >{busy
            ? "Working..."
            : authMode === "sign_up"
              ? "Create Website Account"
              : "Sign in"}</button>
          {authMode === "sign_in" && <Link className="button-link" to="/account/forgot-password">Forgot password?</Link>}
        </div>
        {authCaptchaConfig.mode !== "off" && (
          <span className="visually-hidden" aria-live="polite">
            {authCaptchaReady ? "Account safety verification ready." : "Account safety verification not ready."}
          </span>
        )}
      </form>
      </> : <div className="button-row"><button type="button" disabled={busy} onClick={signOut}>{busy ? "Working..." : "Sign out"}</button></div>}
      <p className="boundary-note">{copy?.confirmationCopy ?? "If Supabase email confirmation is enabled, open the confirmation link to return to /account; the session should appear after Supabase completes the redirect."}</p>
    </section>
  );
}

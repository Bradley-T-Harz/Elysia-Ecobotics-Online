import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../lib/supabase";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [localStatus, setLocalStatus] = useState("");
  const [authMode, setAuthMode] = useState<"sign_in" | "sign_up">("sign_in");

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

  function emit(message: string) {
    setLocalStatus(message);
    onMessage(message);
  }

  function safeAuthError(action: "sign-up" | "sign-in" | "sign-out", message: string) {
    if (/rate|too many|seconds/i.test(message)) return "Too many authentication requests were made. Wait before trying again.";
    if (/already registered|already exists/i.test(message)) return "A Website Account may already use that email. Sign in or recover the password instead.";
    if (/invalid login|invalid credentials/i.test(message)) return "The email or password was not accepted. Confirm the email if required, or use password recovery.";
    if (/email.*confirm|not confirmed/i.test(message)) return "Confirm the Website Account email before signing in.";
    if (/password|characters|weak/i.test(message)) return "The password does not meet the current Website Account requirements. Use a longer, unique password.";
    if (action === "sign-out") return "The Website Account could not be signed out safely. Refresh the page and try again.";
    return `The Website Account ${action} request could not be completed safely. Please try again later.`;
  }

  async function signUp() {
    if (!supabase) { emit("Demo mode: signup form is visible, but no remote account is created."); return; }
    setBusy(true);
    const emailRedirectTo = `${window.location.origin}${copy?.confirmationPath ?? "/account"}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo }
    });
    setBusy(false);
    if (error) { emit(safeAuthError("sign-up", error.message)); return; }
    if (data.session?.user.email) {
      setSession(data.session);
      emit(`Signed in as ${data.session.user.email}.`);
      await onAuthChanged();
    } else {
      emit("Sign-up request sent. Check your email if confirmation is required.");
    }
    setPassword("");
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
    if (authMode === "sign_up") await signUp(); else await signIn();
  }

  return (
    <section className="account-card" id="account">
      <p className="eyebrow">{copy?.eyebrow ?? "Marketplace Account"}</p>
      <h2>{copy?.title ?? "Auth"}</h2>
      {!hasSupabaseConfig && <p className="demo-banner">{supabaseNotConfiguredMessage}</p>}
      <p>{copy?.description ?? "This creates a Marketplace account, not a local Elysia account. Do not enter your local Elysia password here."}</p>
      <div className="status-strip">
        <strong>{session ? "Signed in" : "Signed out"}</strong>
        <span>{session?.user.email ?? (hasSupabaseConfig ? (copy?.signedOutText ?? "No active Marketplace session.") : "Remote auth disabled until env vars are configured.")}</span>
      </div>
      {localStatus && <p className="inline-status">{localStatus}</p>}
      {!session ? <form className="auth-form" onSubmit={submitAuth} noValidate>
        <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="builder@example.com" autoComplete="email" inputMode="email" required /></label>
        <label><span>{authMode === "sign_up" ? "Create password" : "Password"}</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={authMode === "sign_up" ? 6 : undefined} required />{authMode === "sign_up" && <small>At least 6 characters are accepted for compatibility; 12 or more unique characters are strongly recommended.</small>}</label>
        <div className="button-row">
          <button type="submit" disabled={busy || !email.trim() || !password || (authMode === "sign_up" && password.length < 6)}>{busy ? "Working..." : authMode === "sign_up" ? "Create Website Account" : "Sign in"}</button>
          <button type="button" disabled={busy} onClick={() => { setAuthMode((current) => current === "sign_in" ? "sign_up" : "sign_in"); setPassword(""); setLocalStatus(""); }}>{authMode === "sign_up" ? "Use existing account" : "Create an account instead"}</button>
          {authMode === "sign_in" && <Link className="button-link" to="/account/forgot-password">Forgot password?</Link>}
        </div>
      </form> : <div className="button-row"><button type="button" disabled={busy} onClick={signOut}>{busy ? "Working..." : "Sign out"}</button></div>}
      <p className="boundary-note">{copy?.confirmationCopy ?? "If Supabase email confirmation is enabled, open the confirmation link to return to /account; the session should appear after Supabase completes the redirect."}</p>
    </section>
  );
}

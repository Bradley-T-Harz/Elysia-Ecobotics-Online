import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setLocalStatus(error.message);
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
    if (error) { emit(error.message); return; }
    if (data.session?.user.email) {
      setSession(data.session);
      emit(`Signed in as ${data.session.user.email}.`);
      await onAuthChanged();
    } else {
      emit("Sign-up request sent. Check your email if confirmation is required.");
    }
    setPassword("");
  }

  async function signIn() {
    if (!supabase) { emit("Demo mode: sign-in form is visible, but no remote session is created."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { emit(`${error.message}. If email confirmation is required, confirm the email before signing in.`); return; }
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
    if (error) { emit(error.message); return; }
    emit("Signed out.");
    setSession(null);
    await onAuthChanged();
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
      {!session && <>
        <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="builder@example.com" autoComplete="email" /></label>
        <label><span>Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
      </>}
      <div className="button-row">
        {!session && <button type="button" disabled={busy} onClick={signUp}>{busy ? "Working..." : "Sign up"}</button>}
        {!session && <button type="button" disabled={busy} onClick={signIn}>{busy ? "Working..." : "Sign in"}</button>}
        <button type="button" disabled={busy || !session} onClick={signOut}>{busy ? "Working..." : "Sign out"}</button>
      </div>
      <p className="boundary-note">{copy?.confirmationCopy ?? "If Supabase email confirmation is enabled, open the confirmation link to return to /account; the session should appear after Supabase completes the redirect."}</p>
    </section>
  );
}

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import RequireMember from "../auth/RequireMember";
import { useAuth } from "../auth/useAuth";
import {
  createIdentityClientRequestId,
  friendlyIdentityError,
  requestCommunityLifecycleAction,
} from "./participationClient";
import AccountLifecycleHistoryPanel from "./AccountLifecycleHistoryPanel";
import { communityLifecycleNotice } from "./lifecycleNotices";
import type { LifecycleAction, LifecycleRequestResult } from "./participationTypes";
import TurnstileWidget from "./TurnstileWidget";
import { useParticipation } from "./useParticipation";

const actionCopy = Object.freeze({
  export: {
    heading: "Request a community data export",
    description: "Submit a governed request for a portable copy of account-linked public-community data. The response is prepared outside the browser after identity and retention checks.",
    button: "Request data export",
  },
  deletion: {
    heading: "Permanent Account Deletion",
    description: "You are directing Elysia Ecobotics to permanently delete this Website Account. A cooling period begins first, and you may cancel during that period. After it expires, the system automatically completes deletion unless a specific legal, security, economic, or technical hold prevents finalization.",
    button: "Start Permanent Deletion",
  },
});

export default function AccountLifecycleRequestForm({ action }: { action: LifecycleAction }) {
  const { accessToken } = useAuth();
  const { refresh } = useParticipation();
  const [userNote, setUserNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LifecycleRequestResult | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const copy = actionCopy[action];
  const notice = communityLifecycleNotice[action];
  const handleTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!accessToken) {
      setError("Sign in to the existing Website Account before submitting this request.");
    } else if (action === "deletion" && !confirmed) {
      setError("Confirm that you understand this begins the governed permanent-deletion lifecycle.");
    } else if (action === "deletion" && confirmationPhrase !== "DELETE") {
      setError("Type DELETE exactly to confirm the permanent account-deletion request.");
    } else if (!turnstileToken) {
      setError("Complete the human-verification check before submitting this account request.");
    } else if (userNote.length > 2_000) {
      setError("The optional note must be 2,000 characters or fewer.");
    } else {
      setBusy(true);
      try {
        const nextResult = await requestCommunityLifecycleAction(accessToken, {
          clientRequestId: createIdentityClientRequestId(),
          action,
          noticeVersion: notice.version,
          userNote: userNote.trim() || null,
          turnstileToken,
        });
        setResult(nextResult);
        setHistoryVersion((current) => current + 1);
        setUserNote("");
        setConfirmed(false);
        setConfirmationPhrase("");
        refresh();
      } catch (reason) {
        setError(friendlyIdentityError(reason));
        requestAnimationFrame(() => errorRef.current?.focus());
      } finally {
        setBusy(false);
        setTurnstileToken(null);
        setTurnstileResetKey((current) => current + 1);
      }
      return;
    }
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  return (
    <RequireMember label="Account lifecycle requests require the existing Website Account.">
      <div className="account-lifecycle-stack">
        <form className="section-card account-recovery-card" onSubmit={submit} noValidate>
        <p className="eyebrow">Shared Website Account</p>
        <h2>{copy.heading}</h2>
        <p>{copy.description}</p>
        <p className="boundary-note">This request covers the shared public Website Account and connected public-community systems. It does not access, export, or delete private local Elysia memory, conversations, files, logs, credentials, prompts, runtime state, or machine data.</p>

        <label htmlFor={`${action}-lifecycle-note`}>
          <span>{action === "deletion" ? "Optional note about your deletion request" : "Optional context for the account team"}</span>
          <textarea
            id={`${action}-lifecycle-note`}
            value={userNote}
            onChange={(event) => setUserNote(event.target.value)}
            maxLength={2_000}
            rows={5}
            disabled={busy || Boolean(result)}
          />
          <small>{userNote.length}/2,000 characters. Do not include passwords, identity documents, or private local Elysia data.</small>
        </label>

        {action === "deletion" && (
          <>
            <label className="checkbox-row" htmlFor="confirm-account-deletion-request">
              <input
                id="confirm-account-deletion-request"
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy || Boolean(result)}
              />
              <span>I understand I am directing permanent account deletion. A cooling period comes first, and documented legal, security, economic, or technical exceptions may pause finalization; this is not an instant browser-side erase.</span>
            </label>
            <label htmlFor="account-deletion-confirmation-phrase"><span>Type DELETE to continue</span><input id="account-deletion-confirmation-phrase" value={confirmationPhrase} onChange={(event) => setConfirmationPhrase(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy || Boolean(result)} /></label>
          </>
        )}

        {!result && <TurnstileWidget action="identity_lifecycle_request" onTokenChange={handleTurnstileToken} resetKey={turnstileResetKey} />}
        {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
        {result && (
          <div className="validation validation--ok" role="status">
            <strong>Request received.</strong> Reference: <code>{result.requestId}</code>. Status: {result.status}.
            {result.coolingPeriodEndsAt && <> The cooling period currently ends <time dateTime={result.coolingPeriodEndsAt}>{new Date(result.coolingPeriodEndsAt).toLocaleString()}</time>.</>}
          </div>
        )}
        <div className="button-row">
          {!result && <button className="button-primary" type="submit" disabled={busy || !turnstileToken || (action === "deletion" && (!confirmed || confirmationPhrase !== "DELETE"))}>{busy ? "Submitting securely…" : copy.button}</button>}
          <Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link>
          {action === "export" ? <Link className="button-link" to="/account/delete">Account deletion</Link> : <Link className="button-link" to="/account/export">Data export</Link>}
        </div>
        <p className="inline-status">Notice version: {notice.version}</p>
        </form>
        {accessToken && <AccountLifecycleHistoryPanel accessToken={accessToken} refreshKey={historyVersion} />}
      </div>
    </RequireMember>
  );
}

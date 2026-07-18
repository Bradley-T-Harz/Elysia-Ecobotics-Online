import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  createIdentityClientRequestId,
  friendlyIdentityError,
  updatePublicProfilePublication,
} from "./participationClient";
import { useParticipation } from "./useParticipation";

export default function PublicProfilePublicationPanel() {
  const { accessToken, session } = useAuth();
  const { state, bootstrap, error: participationError, refresh } = useParticipation();
  const [enabled, setEnabled] = useState(false);
  const [shortPublicBio, setShortPublicBio] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dirty || state !== "ready" || !bootstrap) return;
    setEnabled(bootstrap.profileCard?.publicProfileEnabled ?? bootstrap.communityAccess.publicProfileEnabled);
    setShortPublicBio(bootstrap.profileCard?.shortPublicBio ?? "");
  }, [bootstrap, dirty, state]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!accessToken || !session) {
      setError("Sign in to the canonical Website Account before changing public profile publication.");
    } else if (!bootstrap?.communityAccess.profileComplete || !bootstrap.profileCard) {
      setError("Complete the canonical Commons Profile before changing public publication.");
    } else if (shortPublicBio.length > 280) {
      setError("The public-card biography must be 280 characters or fewer.");
    } else {
      setBusy(true);
      try {
        const result = await updatePublicProfilePublication(accessToken, {
          clientRequestId: createIdentityClientRequestId(),
          enabled,
          shortPublicBio: shortPublicBio.trim() || null,
        });
        setEnabled(result.publicProfileEnabled);
        setShortPublicBio(result.shortPublicBio ?? "");
        setDirty(false);
        setMessage(result.publicProfileEnabled
          ? "The bounded Public Commons Profile card is published. Only its allowlisted identity fields are shared with the Artisan Collective."
          : "The bounded Public Commons Profile card is unpublished. Cross-site public identity lookup is now disabled.");
        refresh();
      } catch (reason) {
        setError(friendlyIdentityError(reason));
        requestAnimationFrame(() => errorRef.current?.focus());
      } finally {
        setBusy(false);
      }
      return;
    }
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  if (!session) return null;
  if (state === "loading") return <section className="section-card"><p className="inline-status" aria-live="polite">Loading the bounded public profile contract…</p></section>;
  if (state === "unconfigured") return <section className="section-card"><p className="validation validation--bad">Shared profile publication is not configured in this environment. Existing profile data was not changed.</p></section>;
  if (state === "error" || !bootstrap) {
    return <section className="section-card"><p className="validation validation--bad">{participationError ?? "Shared profile state could not be verified, so publication controls remain unavailable."}</p><button type="button" onClick={refresh}>Check profile state again</button></section>;
  }

  return (
    <section className="section-card commons-privacy" id="public-profile-publication">
      <p className="eyebrow">Public identity contract</p>
      <h2>Publish the bounded Public Commons Profile card</h2>
      <p>This master publication control governs the small identity card other public Elysia sites may use: handle, display name, avatar, short public bio, and canonical profile URL. Email, account recovery, roles, age state, guardian records, restrictions, moderation notes, private links, billing, and local Elysia data are excluded by the database contract.</p>
      {!bootstrap.communityAccess.profileComplete || !bootstrap.profileCard ? (
        <p className="member-gate">Complete the canonical Commons Profile before publishing a public identity card. <Link to="/commons-circle/setup/profile">Finish Commons Profile setup</Link>.</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label className="checkbox-row" htmlFor="public-profile-card-enabled">
            <input
              id="public-profile-card-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => { setEnabled(event.target.checked); setDirty(true); }}
              disabled={busy}
            />
            <span>Publish my bounded Public Commons Profile card</span>
          </label>
          <label htmlFor="public-profile-short-bio">
            <span>Short public biography shared through the card</span>
            <textarea
              id="public-profile-short-bio"
              value={shortPublicBio}
              onChange={(event) => { setShortPublicBio(event.target.value); setDirty(true); }}
              maxLength={280}
              rows={4}
              disabled={busy}
            />
            <small>{shortPublicBio.length}/280 characters.</small>
          </label>
          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          {message && <div className="validation validation--ok" role="status">{message}</div>}
          <div className="button-row">
            <button className="button-primary" type="submit" disabled={busy || !dirty}>{busy ? "Saving safely…" : "Save public-card publication"}</button>
            {bootstrap.profileCard.canonicalProfileUrl && enabled && <a className="button-link" href={bootstrap.profileCard.canonicalProfileUrl}>View canonical public profile</a>}
            <Link className="button-link" to="/account/export">Request data export</Link>
            <Link className="button-link" to="/account/delete">Account deletion</Link>
          </div>
        </form>
      )}
      <p className="boundary-note">Age, guardian, restriction, and participation rules remain server-enforced. This checkbox cannot override an account restriction or make private profile fields public.</p>
    </section>
  );
}

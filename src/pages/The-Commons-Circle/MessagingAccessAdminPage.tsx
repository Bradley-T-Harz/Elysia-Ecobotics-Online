import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../shared/auth/useAuth";
import PageHero from "../../shared/components/PageHero";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import {
  createIdentityClientRequestId,
  friendlyIdentityError,
  loadAccountMessagingAdminStatus,
  updateAccountMessagingBetaEnrollment,
  updateAccountMessagingLaunchMode,
} from "../../shared/participation/participationClient";
import type { AccountMessagingAdminStatus } from "../../shared/participation/participationTypes";
import { loadCommonsHomebase } from "./commonsCircleApi";

function normalizeHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{1,79}$/.test(handle) ? handle : "";
}

export default function MessagingAccessAdminPage() {
  const location = useLocation();
  const { userId, accessToken, loading: authLoading } = useAuth();
  const [authorizationLoaded, setAuthorizationLoaded] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<AccountMessagingAdminStatus | null>(null);
  const [handle, setHandle] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [category, setCategory] = useState("production_acceptance");
  const [confirmation, setConfirmation] = useState("");
  const [privateReason, setPrivateReason] = useState("");
  const [launchMode, setLaunchMode] = useState<"disabled" | "controlled_beta">("controlled_beta");
  const [launchConfirmation, setLaunchConfirmation] = useState("");
  const [launchReason, setLaunchReason] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enrollmentRequestId = useRef(createIdentityClientRequestId());
  const launchRequestId = useRef(createIdentityClientRequestId());

  const refreshAuthorization = useCallback(async () => {
    if (!userId) {
      setAuthorized(false);
      setAuthorizationLoaded(true);
      return;
    }
    const [homebase, roles] = await Promise.all([loadCommonsHomebase(), loadCurrentRoleState()]);
    setAuthorized(Boolean(homebase.profile?.is_admin && (roles.isAdmin || roles.roles.includes("administrator"))));
    setAuthorizationLoaded(true);
  }, [userId]);

  useEffect(() => { void refreshAuthorization(); }, [refreshAuthorization]);

  const loadStatus = useCallback(async (targetHandle: string | null = null) => {
    if (!accessToken) return;
    setWorking(true);
    setMessage(null);
    try {
      const next = await loadAccountMessagingAdminStatus(accessToken, targetHandle);
      setStatus(next);
      setLaunchMode(next.launchMode === "disabled" ? "disabled" : "controlled_beta");
      if (targetHandle && !next.target) setMessage("No account with that exact Commons handle is available to this governed admin tool.");
    } catch (error) {
      setStatus(null);
      setMessage(friendlyIdentityError(error));
    } finally {
      setWorking(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authorized && accessToken) void loadStatus();
  }, [accessToken, authorized, loadStatus]);

  function changeEnrollmentOperation(update: () => void) {
    enrollmentRequestId.current = createIdentityClientRequestId();
    setConfirmation("");
    setMessage(null);
    update();
  }

  async function findTarget() {
    const normalized = normalizeHandle(handle);
    if (!normalized) {
      setMessage("Enter one exact public Commons handle.");
      return;
    }
    await loadStatus(`@${normalized}`);
  }

  async function submitEnrollment() {
    if (!accessToken || !status?.target) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await updateAccountMessagingBetaEnrollment(accessToken, {
        clientRequestId: enrollmentRequestId.current,
        targetHandle: `@${status.target.handle}`,
        enabled,
        category,
        confirmation,
        privateReason,
      });
      setMessage(result.betaEnrolled ? "Controlled messaging access enabled." : "Controlled messaging access revoked.");
      enrollmentRequestId.current = createIdentityClientRequestId();
      setConfirmation("");
      setPrivateReason("");
      await loadStatus(`@${result.handle}`);
    } catch (error) {
      setMessage(friendlyIdentityError(error));
    } finally {
      setWorking(false);
    }
  }

  async function submitLaunchMode() {
    if (!accessToken) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await updateAccountMessagingLaunchMode(accessToken, {
        clientRequestId: launchRequestId.current,
        launchMode,
        confirmation: launchConfirmation,
        privateReason: launchReason,
      });
      setMessage(result.launchMode === "disabled" ? "New messaging initiation disabled." : "Controlled messaging beta enabled.");
      launchRequestId.current = createIdentityClientRequestId();
      setLaunchConfirmation("");
      setLaunchReason("");
      await loadStatus(status?.target ? `@${status.target.handle}` : null);
    } catch (error) {
      setMessage(friendlyIdentityError(error));
    } finally {
      setWorking(false);
    }
  }

  const expectedConfirmation = status?.target
    ? `${enabled ? "ENABLE" : "REVOKE"} @${status.target.handle}`
    : "";

  return <div className="page-stack commons-circle-page commons-account-communications-page">
    <PageHero eyebrow="Administrator access management" title="Messaging access">
      <p>Manage the messaging-only controlled beta without enabling Artisan participation or bypassing blocks, restrictions, cooldowns, rate limits, moderation, or participant RLS.</p>
    </PageHero>

    <section className="section-card signal-detail-navigation">
      <div className="button-row"><Link className="button-link" to="/commons-circle/admin-console">Back to Admin Console</Link></div>
    </section>

    <section className="section-card">
      <AuthPanel
        onMessage={setMessage}
        onAuthChanged={refreshAuthorization}
        copy={{
          eyebrow: "Website Account",
          title: userId ? "Administrator account active" : "Sign in to manage messaging access",
          description: "Both the protected administrator role and the administrator profile flag are required by the server.",
          signedOutText: "No active website session.",
          confirmationPath: `${location.pathname}${location.search}`,
          confirmationCopy: "Return to this dedicated access-management page after confirmation.",
        }}
      />
    </section>

    {!authLoading && authorizationLoaded && userId && !authorized && <section className="section-card">
      <p className="eyebrow">Administrator authority required</p>
      <h2>Messaging access management is private.</h2>
      <p>The server requires both active administrator role authority and the protected administrator profile flag. Badges and public profile presentation never grant this access.</p>
    </section>}

    {authorized && <>
      <section className="section-card">
        <div className="section-heading"><p className="eyebrow">Launch control</p><h2>{status?.launchMode === "controlled_beta" ? "Controlled beta" : status?.launchMode === "disabled" ? "Disabled" : "Checking status"}</h2></div>
        <p>General availability is intentionally unavailable until the adult and participation providers are operational and separately reviewed.</p>
        <form onSubmit={(event) => { event.preventDefault(); void submitLaunchMode(); }}>
          <label><span>New-initiation mode</span><select value={launchMode} onChange={(event) => { launchRequestId.current = createIdentityClientRequestId(); setLaunchMode(event.target.value as "disabled" | "controlled_beta"); setLaunchConfirmation(""); }}><option value="controlled_beta">Controlled beta</option><option value="disabled">Disabled</option></select></label>
          <label><span>Confirmation</span><input value={launchConfirmation} onChange={(event) => setLaunchConfirmation(event.target.value)} placeholder={`SET ${launchMode}`} required /></label>
          <label><span>Private operational reason</span><textarea value={launchReason} onChange={(event) => setLaunchReason(event.target.value)} minLength={12} maxLength={1000} rows={3} required /></label>
          <button type="submit" disabled={working || launchConfirmation !== `SET ${launchMode}` || launchReason.trim().length < 12}>Apply launch mode</button>
        </form>
      </section>

      <section className="section-card">
        <div className="section-heading"><p className="eyebrow">Exact-handle lookup</p><h2>Controlled account enrollment</h2></div>
        <form onSubmit={(event) => { event.preventDefault(); void findTarget(); }}>
          <label><span>Published Commons handle</span><input value={handle} onChange={(event) => changeEnrollmentOperation(() => { setHandle(event.target.value); setStatus((current) => current ? { ...current, target: null } : current); })} placeholder="@public-handle" required /></label>
          <button type="submit" disabled={working || !normalizeHandle(handle)}>Check exact handle</button>
        </form>

        {status?.target && <div className="account-messaging-recipient-card">
          <p><strong>{status.target.displayName || `@${status.target.handle}`}</strong> · @{status.target.handle}</p>
          <p>{status.target.published ? "Published public profile" : "Profile is not currently published"} · {status.target.betaEnrolled ? "Beta enrolled" : "Not enrolled"}</p>
          <p className="boundary-note">Status: {status.target.status.replace(/_/g, " ")}. Private restriction, age, lifecycle, and moderation reasons are never displayed here.</p>
        </div>}

        {status?.target && <form onSubmit={(event) => { event.preventDefault(); void submitEnrollment(); }}>
          <label><span>Action</span><select value={enabled ? "enable" : "revoke"} onChange={(event) => changeEnrollmentOperation(() => { const next = event.target.value === "enable"; setEnabled(next); setCategory(next ? "production_acceptance" : "operator_revoked"); })}><option value="enable">Enable controlled beta access</option><option value="revoke">Revoke controlled beta access</option></select></label>
          <label><span>Category</span><select value={category} onChange={(event) => changeEnrollmentOperation(() => setCategory(event.target.value))}>{enabled ? <><option value="production_acceptance">Production acceptance</option><option value="operator_controlled_adult_test">Operator-controlled adult test</option><option value="staff_operations">Staff operations</option></> : <><option value="operator_revoked">Operator revoked</option><option value="safety_review">Safety review</option><option value="acceptance_complete">Acceptance complete</option></>}</select></label>
          <label><span>Confirmation</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={expectedConfirmation} required /></label>
          <label><span>Private operational reason</span><textarea value={privateReason} onChange={(event) => setPrivateReason(event.target.value)} minLength={12} maxLength={1000} rows={3} required /></label>
          <button type="submit" disabled={working || confirmation !== expectedConfirmation || privateReason.trim().length < 12 || (enabled && !status.target.published)}>Apply enrollment</button>
        </form>}
      </section>
    </>}

    {message && <p className="message" role="status">{message}</p>}
  </div>;
}

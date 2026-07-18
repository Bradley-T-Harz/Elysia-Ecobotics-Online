import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { participationAllows, participationStateMessage } from "../participation/participationPermissions";
import type { ParticipationAction } from "../participation/participationTypes";
import { useParticipation } from "../participation/useParticipation";
import { useAuth } from "./useAuth";

type RequireParticipationProps = Readonly<{
  action: ParticipationAction;
  children: ReactNode;
  label?: string;
}>;

/**
 * This is a fail-closed UX guard only. Workers, RPCs, and RLS remain the
 * authoritative permission boundary for every protected mutation.
 */
export default function RequireParticipation({ action, children, label }: RequireParticipationProps) {
  const { session, loading: authLoading } = useAuth();
  const { state, bootstrap, error, refresh } = useParticipation();

  if (authLoading || state === "loading") {
    return <p className="inline-status" aria-live="polite">Checking current community participation…</p>;
  }
  if (!session || state === "signed_out") {
    return <p className="member-gate">{label ?? "This action needs an existing Commons account."} <Link to="/commons-circle">Sign in through Commons Circle</Link>.</p>;
  }
  if (state === "unconfigured") {
    return <p className="member-gate">Shared participation services are not configured in this environment. This action remains unavailable.</p>;
  }
  if (state === "error" || !bootstrap) {
    return (
      <div className="member-gate" role="status">
        <p>{error ?? "Current participation could not be verified, so this action remains unavailable."}</p>
        <button type="button" onClick={refresh}>Check participation again</button>
      </div>
    );
  }
  if (!bootstrap.communityAccess.profileComplete) {
    return <p className="member-gate">Finish the canonical Commons Profile before using this community action. <Link to="/commons-circle/setup/profile">Complete Commons Profile setup</Link>.</p>;
  }
  if (!participationAllows(bootstrap.communityAccess, action)) {
    return (
      <div className="member-gate" role="status">
        <p>{participationStateMessage(bootstrap.communityAccess)}</p>
        <p>Public browsing and account lifecycle controls remain available.</p>
      </div>
    );
  }
  return <>{children}</>;
}

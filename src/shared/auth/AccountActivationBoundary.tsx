import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useParticipation } from "../participation/useParticipation";

const LIFECYCLE_PATHS = [
  "/account/reactivate",
  "/account/change-password",
  "/account/export",
  "/account/delete",
  "/account/forgot-password",
  "/account/recovery",
  "/support",
  "/legal",
] as const;

function isLifecyclePath(pathname: string): boolean {
  return LIFECYCLE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Fail-closed navigation for a voluntarily paused shared account. This is a
 * usability boundary only; RPCs, RLS, and the Identity Worker remain final.
 */
export default function AccountActivationBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session } = useAuth();
  const { bootstrap, state } = useParticipation();
  if (
    session
    && state === "ready"
    && bootstrap?.accountActivation?.state === "temporarily_deactivated"
    && !isLifecyclePath(location.pathname)
  ) {
    return <Navigate
      replace
      to="/account/reactivate"
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />;
  }
  return <>{children}</>;
}

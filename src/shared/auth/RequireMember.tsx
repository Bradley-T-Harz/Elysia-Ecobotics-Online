import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireMember({ children, label = "This action needs a free Commons Circle account." }: { children: ReactNode; label?: string }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="inline-status">Checking member session...</p>;
  if (!session) {
    return <p className="member-gate">{label} <Link to="/commons-circle">Sign in through The Commons Circle</Link>.</p>;
  }
  return <>{children}</>;
}

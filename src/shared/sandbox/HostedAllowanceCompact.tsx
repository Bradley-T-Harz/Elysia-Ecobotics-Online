import { Link } from "react-router-dom";
import type { SandboxCreditSummary } from "./hostedAllowanceClient";

export const HOSTED_ALLOWANCE_SETTINGS_PATH = "/commons-circle/settings/hosted-execution";

export default function HostedAllowanceCompact({ summary, loading }: {
  summary: SandboxCreditSummary | null;
  loading: boolean;
}) {
  const live = summary?.mode === "live" && summary.displayEnabled && summary.enforcementEnabled;
  const percentage = live ? summary.remainingPercent : null;
  const administrative = live && summary.administrativeOperationalAccess;
  const state = !administrative && percentage === 0 ? "exhausted" : !administrative && percentage !== null && percentage <= 10 ? "low" : "normal";
  const label = !summary && loading
    ? "Hosted allowance: checking…"
    : !live
      ? summary?.testMode ? "Hosted allowance: production policy pending" : "Hosted allowance: details unavailable"
    : administrative
      ? "Admin operational allowance · non-depleting"
      : percentage === 0 ? "Hosted allowance exhausted" : `Hosted allowance: ${percentage}% remaining`;

  return <aside className={`hosted-allowance-compact hosted-allowance-compact--${state}`} aria-live="polite" aria-busy={loading}>
    <span>{label}</span>
    <Link to={HOSTED_ALLOWANCE_SETTINGS_PATH}>View allowance</Link>
  </aside>;
}

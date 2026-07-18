import { useEffect, useState } from "react";
import {
  cancelCommunityDeletionRequest,
  downloadCommunityLifecycleExport,
  friendlyIdentityError,
  loadCommunityLifecycleRequest,
  loadCommunityLifecycleRequests,
} from "./participationClient";
import type { LifecycleRequestDetail, LifecycleRequestSummary } from "./participationTypes";

export default function AccountLifecycleHistoryPanel({ accessToken, refreshKey }: {
  accessToken: string;
  refreshKey: number;
}) {
  const [items, setItems] = useState<LifecycleRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const response = await loadCommunityLifecycleRequests(accessToken, signal);
      setItems(response.items);
    } catch (reason) {
      if (!signal?.aborted) setError(friendlyIdentityError(reason));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [accessToken, refreshKey]);

  return (
    <section className="section-card account-recovery-card" aria-labelledby="account-lifecycle-history-heading">
      <p className="eyebrow">Owner-only lifecycle ledger</p>
      <h2 id="account-lifecycle-history-heading">Your account request history</h2>
      <p>Check governed request status, cancel an eligible deletion during its cooling window, or retrieve a completed private export after an in-browser SHA-256 integrity check.</p>
      {error && <div className="validation validation--bad" role="alert">{error}</div>}
      {loading && <p role="status">Loading your lifecycle requests…</p>}
      {!loading && !error && items.length === 0 && <p>No lifecycle requests are recorded for this account.</p>}
      <ul className="account-lifecycle-list">
        {items.map((item) => (
          <AccountLifecycleHistoryItem
            accessToken={accessToken}
            item={item}
            key={item.requestId}
            onChanged={() => load()}
          />
        ))}
      </ul>
    </section>
  );
}

function AccountLifecycleHistoryItem({ accessToken, item, onChanged }: {
  accessToken: string;
  item: LifecycleRequestSummary;
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<LifecycleRequestDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function open() {
    setBusy(true);
    setError("");
    try {
      setDetail(await loadCommunityLifecycleRequest(accessToken, item.requestId));
    } catch (reason) {
      setError(friendlyIdentityError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await cancelCommunityDeletionRequest(accessToken, item.requestId);
      setSuccess("The deletion request was canceled during its permitted cooling window.");
      await onChanged();
      setDetail(await loadCommunityLifecycleRequest(accessToken, item.requestId));
    } catch (reason) {
      setError(friendlyIdentityError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function retrieve() {
    if (!detail?.export) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const file = await downloadCommunityLifecycleExport(accessToken, detail.export);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSuccess(`The private export passed an in-browser SHA-256 check (${file.sha256}).`);
    } catch (reason) {
      setError(friendlyIdentityError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <article className="boundary-note">
        <h3>{item.action.replace(/_/g, " ")} · {item.status.replace(/_/g, " ")}</h3>
        <p>Submitted <time dateTime={item.submittedAt}>{new Date(item.submittedAt).toLocaleString()}</time>.</p>
        {item.coolingPeriodEndsAt && <p>Cooling period ends <time dateTime={item.coolingPeriodEndsAt}>{new Date(item.coolingPeriodEndsAt).toLocaleString()}</time>.</p>}
        {item.legalHoldPresent && <p className="validation validation--bad">A legal hold affects this workflow. This page cannot override it.</p>}
        {error && <div className="validation validation--bad" role="alert">{error}</div>}
        {success && <div className="validation validation--ok" role="status">{success}</div>}
        {!detail ? (
          <button type="button" disabled={busy} onClick={() => void open()}>{busy ? "Loading secure status…" : "View secure status"}</button>
        ) : (
          <div>
            <dl className="mini-facts">
              <div><dt>Notice version</dt><dd>{detail.noticeVersion}</dd></div>
              <div><dt>Updated</dt><dd><time dateTime={detail.updatedAt}>{new Date(detail.updatedAt).toLocaleString()}</time></dd></div>
              <div><dt>Completed</dt><dd>{detail.completedAt ? <time dateTime={detail.completedAt}>{new Date(detail.completedAt).toLocaleString()}</time> : "Not completed"}</dd></div>
              <div><dt>Reference</dt><dd><code>{detail.requestId}</code></dd></div>
            </dl>
            <div className="button-row">
              {detail.canCancel && <button type="button" disabled={busy} onClick={() => void cancel()}>Cancel deletion during cooling period</button>}
              {detail.export?.downloadPath && detail.export.artifactStatus === "available" && (
                <button className="button-primary" type="button" disabled={busy} onClick={() => void retrieve()}>Retrieve and verify private export</button>
              )}
            </div>
            {detail.export && (
              <p>Private export: {detail.export.artifactStatus}; {detail.export.byteSize.toLocaleString()} bytes; expires <time dateTime={detail.export.expiresAt}>{new Date(detail.export.expiresAt).toLocaleString()}</time>. SHA-256 <code>{detail.export.artifactSha256}</code>.</p>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

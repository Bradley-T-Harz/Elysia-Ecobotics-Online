import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import { useAuth } from "../auth/useAuth";

type Item = { requestId: string; organization: string; status: string; owner: boolean; revision: number; finalReviewAt: string | null; appealOpen: boolean; appealClosedAt: string | null; holdActive: boolean; holdReviewOverdue: boolean; deleteAfter: string | null; deletionState: string; deletedAt: string | null; proofAttached: boolean };
function Row({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [reviewAt, setReviewAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function command(action: string) {
    if (!supabase || busy) return;
    setBusy(true);setMessage("");
    try {
      const result = await supabase.rpc("stewardship_retention_command", { p_request_id: item.requestId, p_revision: item.revision, p_action: action, p_note: note, p_hold_review_at: reviewAt ? new Date(reviewAt).toISOString() : null });
      if (result.error) setMessage("Action not saved. Reload to check the current request, retention state and your authority.");
      else onChanged();
    } finally { setBusy(false); }
  }
  return <article className="economic-summary-card"><h3>{item.organization || "Independent stewardship request"}</h3><p>Review: {item.status.replace(/_/g, " ")}. Proof: {item.deletedAt ? "Deleted under the retention policy" : item.proofAttached ? "Private evidence attached" : "No linked proof file"}.</p>
    {item.appealOpen && <p>Appeal open; proof deletion is paused.</p>}{item.holdActive && <p>Proof is retained under a reviewable hold.</p>}{item.holdReviewOverdue && <p role="status">This hold needs an authorized review now.</p>}
    {item.deleteAfter && !item.deletedAt && <p>Proof deletion due: {new Date(item.deleteAfter).toLocaleString()}.</p>}
    {item.deletionState === "deleting" && <p>Proof deletion has started. It cannot be paused here.</p>}
    {item.deletionState === "retained" && ((!item.owner) || (item.finalReviewAt && !item.appealOpen)) && <details><summary>{item.owner ? "Appeal this review" : "Appeal and retention controls"}</summary>
      <label><span>Short explanation</span><textarea value={note} maxLength={1000} rows={3} onChange={event => setNote(event.target.value)} /></label>
      {!item.owner && <label><span>Next hold review (required for a hold)</span><input type="datetime-local" value={reviewAt} onChange={event => setReviewAt(event.target.value)} /></label>}
      <div className="button-row">{item.owner ? <button type="button" disabled={busy || !note.trim()} onClick={() => void command("appeal")}>Request appeal and pause deletion</button> : <>
        {item.appealOpen && <button type="button" disabled={busy || !note.trim()} onClick={() => void command("close_appeal")}>Close appeal with explanation; retain existing decision</button>}
        <button type="button" disabled={busy || !note.trim() || !reviewAt} onClick={() => void command("hold_legal")}>Record necessary legal hold</button>
        <button type="button" disabled={busy || !note.trim() || !reviewAt} onClick={() => void command("hold_fraud_abuse")}>Record necessary fraud/abuse hold</button>
        {item.holdActive && <button type="button" disabled={busy || !note.trim()} onClick={() => void command("release_hold")}>Release hold</button>}
      </>}</div><p>Appeal explanations are visible to the applicant. Hold reasons stay private to scoped review. Holds require a legitimate reason and periodic review.</p>
    </details>}{message && <p role="status">{message}</p>}
  </article>;
}
export default function StewardshipRetentionPanel({ requestId }: { requestId?: string }) {
  const { userId, accessToken } = useAuth();
  const [snapshot, setSnapshot] = useState<{token: string; requestKey: string | undefined; items: Item[]} | null>(null);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let current = true;
    if (!supabase || !accessToken || !userId) return;
    void supabase.rpc("stewardship_retention_workspace", { p_request_id: requestId ?? null }).then(({ data, error }) => {
      if (!current) return;
      if (error) { setSnapshot(null); setError("Stewardship status could not be loaded. Reload to retry."); }
      else { setSnapshot({token: accessToken, requestKey: requestId, items: data?.items ?? []}); setError(""); }
    });
    return () => { current = false; };
  }, [accessToken, userId, requestId, generation]);
  if (!userId) return null;
  const items = snapshot?.token === accessToken && snapshot.requestKey === requestId ? snapshot.items : [];
  return <section className="section-card" id="stewardship-proof"><h2>{requestId ? "Stewardship proof retention" : "My stewardship requests & proof"}</h2>
    <p>Raw proof is deleted 30 days after final review, or 30 days after an appeal closes. Necessary legal or fraud/abuse holds pause deletion. Minimal review and deletion metadata remains. Independent donations never pass through EcoSyneva.</p>
    {!requestId && <Link className="button-link" to="/commons-circle/setup/stewardship">Start a stewardship recognition request</Link>}
    <button type="button" onClick={() => setGeneration(n => n + 1)}>Reload stewardship status</button>{error && <p role="status">{error}</p>}
    {!items.length && !error && <p>No request is available in this view.</p>}{items.map(item => <Row key={`${accessToken}:${item.requestId}:${item.revision}`} item={item} onChanged={() => setGeneration(n => n + 1)} />)}
  </section>;
}

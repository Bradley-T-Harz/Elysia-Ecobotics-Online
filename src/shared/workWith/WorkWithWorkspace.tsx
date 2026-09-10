import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import { useAuth } from "../auth/useAuth";
import { attachWorkWithFile, workWithRequestPath } from "./workWithClient";

type Application = {
  id: string; user_id: string; status: string; revision: number; attachment_state: string;
  request_type: string; created_at: string; updated_at: string; areas_of_interest: string[];
  name: string | null; preferred_contact: string | null; commons_username: string | null;
  availability: string | null; message: string | null; skills_experience: string | null;
  github_url: string | null; gitlab_codeberg_url: string | null; portfolio_url: string | null; linkedin_url: string | null;
};
type FileRow = { id: string; original_filename: string; storage_path: string; size_bytes: number };
type EventRow = { id: string; event_type: string; to_status: string | null; note: string | null; created_at: string };
const active = ["pending_review", "in_review", "needs_information"];
const readable = (value: string) => value.replace(/_/g, " ");

/** Source records and RLS are authoritative. The parent staff gate is presentation only. */
export default function WorkWithWorkspace({ requestId, onChanged }: { requestId?: string; onChanged?: (message: string) => void }) {
  const { userId, accessToken } = useAuth();
  const [search] = useSearchParams();
  const requestedId = requestId ?? search.get("request");
  const [snapshot, setSnapshot] = useState<{ token: string; requestKey: string | null; rows: Application[]; files: FileRow[]; events: EventRow[] } | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let current = true;
    setNote(""); setMessage("");
    if (!supabase || !userId || !accessToken) return;
    const client = supabase;
    void (async () => {
      let query = client.from("work_with_requests").select("*").order("created_at", { ascending: false }).limit(100);
      query = requestedId ? query.eq("id", requestedId) : query.eq("user_id", userId);
      const result = await query;
      if (result.error) throw new Error("Private applications could not be loaded. Reload to retry.");
      const rows = (result.data ?? []) as Application[];
      let files: FileRow[] = [], events: EventRow[] = [];
      if (requestedId && rows.length) {
        const [fileResult, review] = await Promise.all([
          client.from("work_with_request_files").select("id,original_filename,storage_path,size_bytes").eq("request_id", requestedId).is("deleted_at", null),
          client.from("review_items").select("id").eq("source_table", "work_with_requests").eq("source_id", requestedId).maybeSingle()
        ]);
        if (fileResult.error || review.error) throw new Error("Private application evidence could not be loaded. Reload before acting.");
        files = (fileResult.data ?? []) as FileRow[];
        if (review.data) {
          const history = await client.from("review_events").select("id,event_type,to_status,note,created_at").eq("review_item_id", review.data.id).order("created_at", { ascending: true });
          if (history.error) throw new Error("Review history could not be loaded. Reload before acting.");
          events = (history.data ?? []) as EventRow[];
        }
      }
      if (current) setSnapshot({ token: accessToken, requestKey: requestedId, rows, files, events });
    })().catch(error => { if (current) { setSnapshot(null); setMessage(error.message); } });
    return () => { current = false; };
  }, [userId, accessToken, requestedId, generation]);
  const data = snapshot?.token === accessToken && snapshot.requestKey === requestedId ? snapshot : null;
  const selected = requestedId ? data?.rows[0] : null;
  const refresh = useCallback(() => setGeneration(value => value + 1), []);
  async function action(actionName: string) {
    if (!supabase || !selected) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("work_with_request_command", { p_request_id: selected.id, p_revision: selected.revision, p_action: actionName, p_note: note });
      if (result.error) { setMessage("Action not completed. Reload to check the current status and your review authority."); return; }
      refresh(); onChanged?.("Work With action saved with an audit event.");
    } finally { setBusy(false); }
  }
  async function openFile(file: FileRow) {
    if (!supabase) return;
    const result = await supabase.storage.from("work-with-attachments").createSignedUrl(file.storage_path, 60, { download: file.original_filename });
    if (result.error || !result.data?.signedUrl) { setMessage("Private attachment access is unavailable."); return; }
    const link = document.createElement("a");
    link.href = result.data.signedUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.referrerPolicy = "no-referrer"; link.click();
  }
  if (!userId) return <section className="section-card"><h2>My Work With requests</h2><p>Sign in to see your private applications.</p></section>;
  return <section className="section-card" aria-label="Work With application workspace">
    <h2>{requestId ? "Private application" : "My Work With requests"}</h2>
    <p>Application and CV access requires applicant ownership or separately assigned Work With review authority. Review never grants employment, payment or account authority.</p>
    {!requestId && <div className="button-row"><Link className="button-link" to="/work-with-elysia-ecobotics">Start an application</Link>{requestedId && <Link className="button-link" to="/commons-circle/signals/work-with">All my applications</Link>}</div>}
    {message && <p role="status">{message}</p>}<button type="button" onClick={refresh} disabled={busy}>Reload applications</button>
    {!data ? <p>{message ? "Use Reload applications to try again." : "Loading private applications…"}</p> : !data.rows.length ? <p>No application is available to this account.</p> : !selected ? <><p>Your latest 100 applications. Older records remain available through Requests &amp; Reviews.</p><Link to="/commons-circle/signals/requests-reviews?domain=work_with">All request history</Link>{data.rows.map(row => <article className="review-list-item" key={row.id}><h3>{row.request_type || "Work With application"}</h3><p>{readable(row.status)} · {new Date(row.created_at).toLocaleDateString()}</p><Link to={workWithRequestPath(row.id)}>View application and follow-up</Link></article>)}</> : <>
      <h3>{selected.request_type || "Work With application"}</h3><p><strong>Status: {readable(selected.status)}</strong> · Attachment: {readable(selected.attachment_state)}</p>
      <dl className="mini-facts">{([['Name',selected.name],['Preferred contact',selected.preferred_contact],['Commons username',selected.commons_username],['Availability',selected.availability],['Areas of interest',selected.areas_of_interest.join(', ')],['Application',selected.message],['Skills / experience',selected.skills_experience],['GitHub',selected.github_url],['GitLab / Codeberg',selected.gitlab_codeberg_url],['Portfolio',selected.portfolio_url],['LinkedIn',selected.linkedin_url]] as const).map(([label,value]) => <div key={label} style={label === "Application" || label === "Skills / experience" ? { gridColumn: "1 / -1" } : undefined}><dt>{label}</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value || "Not provided"}</dd></div>)}</dl>
      <h3>Private CV / supporting documents</h3><p>Authorized downloads expire after 60 seconds. These files never become public profile material.</p>
      {data.files.map(file => <p key={file.id}><button type="button" onClick={() => void openFile(file)}>Download {file.original_filename}</button></p>)}
      {!data.files.length && <p>No linked attachment.</p>}
      {selected.user_id === userId && ['pending_review','needs_information'].includes(selected.status) && <label><span>Add or retry a private CV upload (10 MB maximum)</span><input type="file" accept=".pdf,.doc,.docx,.odt,.txt,.md" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); void attachWorkWithFile(userId,selected.id,file).then(refresh).catch(error => setMessage(error.message)).finally(() => setBusy(false)); event.target.value = ''; }} /></label>}
      {active.includes(selected.status) && <><label><span>{selected.user_id === userId ? "Follow-up response" : "Explanation visible to the applicant"}</span><textarea rows={4} maxLength={6000} value={note} onChange={event => setNote(event.target.value)} /></label><div className="button-row">
        {selected.user_id === userId ? <>{selected.status === 'needs_information' && <button type="button" disabled={busy || !note.trim()} onClick={() => void action('respond')}>Send requested information</button>}{selected.attachment_state === 'pending' && <button type="button" disabled={busy} onClick={() => void action('continue_without_attachment')}>Continue without a CV</button>}<button type="button" disabled={busy} onClick={() => void action('withdraw')}>Withdraw application</button></> : <>{[['begin_review','Begin review'],['request_information','Request information'],['approve','Approve'],['decline','Decline'],['close','Close']].map(([value,label]) => <button type="button" key={value} disabled={busy || (['request_information','decline','close'].includes(value) && !note.trim()) || (value==='approve' && selected.attachment_state==='pending')} onClick={() => void action(value)}>{label}</button>)}</>}
      </div></>}
      <h3>Review and follow-up history</h3>{data.events.map(event => <article key={event.id}><p><strong>{readable(event.event_type)}</strong> · {new Date(event.created_at).toLocaleString()}{event.to_status && ` · ${readable(event.to_status)}`}</p>{event.note && <p style={{ whiteSpace: 'pre-wrap' }}>{event.note}</p>}</article>)}
    </>}
  </section>;
}

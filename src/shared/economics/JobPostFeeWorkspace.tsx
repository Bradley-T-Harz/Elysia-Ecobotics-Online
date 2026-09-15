import JobPostFeeReduction from "./JobPostFeeReduction";
import "./preparation.css";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { commandJobFeeRequest, JobFeeError, loadJobFeeWorkspace } from "./jobPostFeeClient";
import { jobFeeCategories, jobFeeStatus, jobPostFeesPath, type JobFeeCommand, type JobFeeItem, type JobFeeWorkspace } from "./jobPostFeeContracts";

type Input = JobFeeCommand extends infer C ? C extends JobFeeCommand ? Omit<C, "commandId"> : never : never;
const words = (value: string) => value.replace(/_/g, " ");
const errorText = (error: unknown) => error instanceof JobFeeError ? error.message : "The request could not be confirmed. Refresh its status before trying again.";

export function JobPostFeeNotice({ draft = false }: { draft?: boolean }) {
  return <div className="economic-summary-card">
    {draft && <h3>Posting fee &amp; community access</h3>}
    {draft && <><strong>{jobFeeStatus().label}</strong><p>Fee eligibility will be shown from the assessment of your saved opportunity.</p></>}
    <p>Checkout availability and any amount due are shown on your approved opportunity’s payment panel.</p>
    <p>Qualifying community opportunities can be free. Commercial for-profit posts: $10 after content approval, immediately before publication once billing opens.</p>
    <details><summary>Fee waivers, assistance &amp; publication boundaries</summary>
      <p>Free paths include qualifying volunteer, public-interest, educational/research and other community opportunities. No payment details are requested here.</p>
      <p>Rejected posts and applicants are never charged. For-profit public-interest posts may request a waiver or reduction; a public-benefit claim alone does not make a post free.</p>
      <p className="boundary-note">Content, safety and publication review remain separate. A payment, waiver, reduction, subsidy or assistance decision never buys or implies publication, ranking, endorsement, moderation preference, trust or authority. Only EcoSyneva’s own posting fee is eligible; nobody else’s compensation can be waived.</p>
      <p>After saving your opportunity, you can request a fee waiver or assistance privately. You can return through <Link to={jobPostFeesPath}>My Job Post fees &amp; requests</Link>. Keep personal circumstances out of your public post and local drafts.</p>
    </details>
  </div>;
}

function RequestForm({ item, operator, busy, run }: { item: JobFeeItem; operator: boolean; busy: boolean; run: (input: Input) => Promise<void> }) {
  const [category, setCategory] = useState<NonNullable<NonNullable<JobFeeItem["request"]>["category"]> | "">(item.request?.category ?? "");
  const [explanation, setExplanation] = useState(item.request?.explanation ?? "");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<"reviewing" | "needs_information" | "answered">("reviewing");
  const base = { jobPostId: item.jobPostId, expectedRevision: item.request?.revision ?? 0 };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    await run(operator ? { ...base, action: "review", status, response } : { ...base, action: "submit", category: category || null, explanation });
  }
  if (operator && (!item.request || item.request.status === "withdrawn")) return null;
  return <details className="economic-summary-card">
    <summary>{operator ? "Respond to this private request" : item.request && item.request.status !== "withdrawn" ? "Update waiver or assistance request" : "Request a fee waiver or assistance"}</summary>
    <form className="auth-form preparation-form job-fee-request-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend className="sr-only">{operator ? "Request handling only" : "Private request to Economic Operations"}</legend>
        {operator ? <>
          <label><span>Request handling status</span><select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="reviewing">Reviewing</option><option value="needs_information">Needs information</option><option value="answered">Answered</option></select></label>
          <label><span>Reply visible to the poster</span><textarea value={response} onChange={event => setResponse(event.target.value)} maxLength={500} rows={3} required /></label>
          <p>Answered means a reply was provided. It does not grant, decline or change a fee waiver. Record actual eligibility and assistance through the existing governed assessment and grant tools.</p>
        </> : <>
          <label><span>Reason category (optional)</span><select value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="">Prefer not to categorize</option>{jobFeeCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Short explanation</span><textarea value={explanation} onChange={event => setExplanation(event.target.value)} maxLength={500} rows={3} required aria-describedby={`job-fee-privacy-${item.jobPostId}`} /></label>
          <p id={`job-fee-privacy-${item.jobPostId}`}>Up to 500 characters; no exact income or proof required. Do not send payment details, identity documents, medical details or other sensitive records. Your Job Post title and request are private to you and authorized economic operators, separate from the public post and content review.</p>
          <p>Requesting help does not guarantee a waiver or assistance. The adopted standard commercial fee is $10; no response deadline is promised. Fee reductions and waivers concern only EcoSyneva’s fee, while subsidies that spend cash or compute need a separate bounded budget.</p>
        </>}
        <button type="submit" disabled={!(operator ? response : explanation).trim()}>{busy ? "Saving…" : operator ? "Record private reply" : "Send private request"}</button>
      </fieldset>
    </form>
  </details>;
}

function Workspace({ token, operator, jobPostId }: { token: string; operator: boolean; jobPostId: string | null }) {
  const [state, setState] = useState<JobFeeWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const inFlight = useRef(false);
  const pending = useRef<{ fingerprint: string; commandId: string } | null>(null);
  const refresh = useCallback(async (before: string | null = null) => {
    const next = await loadJobFeeWorkspace(token, operator, jobPostId, before);
    if (active.current) setState(current => before && current ? { ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(old => old.jobPostId === item.jobPostId))] } : next);
  }, [token, operator, jobPostId]);
  useEffect(() => {
    active.current = true;
    setBusy(true);
    void refresh().catch(cause => { if (active.current) setError(errorText(cause)); }).finally(() => { if (active.current) setBusy(false); });
    return () => { active.current = false; };
  }, [refresh]);
  async function reload(before: string | null = null) {
    if (inFlight.current || busy) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await refresh(before); }
    catch (cause) { if (active.current) { setState(null); setError(errorText(cause)); } }
    finally { if (active.current) { setBusy(false); inFlight.current = false; } }
  }
  async function run(input: Input) {
    if (inFlight.current || busy) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    const fingerprint = JSON.stringify(input);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, commandId: crypto.randomUUID() };
    try {
      await commandJobFeeRequest(token, { ...input, commandId: pending.current.commandId });
      if (!active.current) return;
      pending.current = null;
      setMessage("Private request handling recorded. No fee, payment or publication decision was made.");
      await refresh();
    } catch (cause) {
      if (active.current) {
        setError(errorText(cause));
        if (cause instanceof JobFeeError && ["conflict", "forbidden"].includes(cause.code)) setState(null);
      }
    } finally { if (active.current) { setBusy(false); inFlight.current = false; } }
  }
  return <section id="posting-fees" className="section-card preparation-workspace" aria-labelledby="posting-fees-title">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">{operator ? "Economic Operations · private requests" : "Your Job Posts · private economic status"}</p><h2 id="posting-fees-title">{operator ? "Job Post waiver & assistance requests" : "Posting fee & community access"}</h2></div><button type="button" disabled={busy} onClick={() => void reload()}>Refresh fee status</button></div>
    <JobPostFeeNotice />
    {!operator && <div className="button-row"><Link className="button-link" to="/commune/rooms/job-post/new">Create a Job Post</Link>{jobPostId && <Link className="button-link" to={jobPostFeesPath}>My Job Post fees &amp; requests</Link>}</div>}
    {busy && <p role="status">Checking private request records…</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {state && !state.items.length && <p>{operator ? "No participant requests are in this queue." : "No saved Job Posts were found in this account. Save an opportunity before requesting help with its fee."}</p>}
    {state?.items.map(item => {
      const fee = jobFeeStatus(item);
      return <article className="economic-summary-card" key={item.jobPostId}>
        <h3>{item.title}</h3><p><strong>{fee.label}</strong></p><p>{fee.detail}</p>
        <dl className="mini-facts"><div><dt>Economic condition</dt><dd>{words(item.conditionStatus)}</dd></div><div><dt>Content / publication status (separate)</dt><dd>{words(item.contentStatus)}</dd></div><div><dt>Waiver / assistance request</dt><dd>{item.request ? words(item.request.status) : "Not requested"}</dd></div></dl>
        {item.request && <details className="economic-summary-card"><summary>Private request details</summary><p>{jobFeeCategories.find(([key]) => key === item.request?.category)?.[1] ?? "No category supplied"}</p><p>{item.request.explanation}</p><p>Updated {new Date(item.request.updatedAt).toLocaleString()}</p>{item.request.response && <><h4>Latest operator reply</h4><p>{item.request.response}</p><p className="boundary-note">A reply is separate from the authoritative economic condition shown above.</p></>}</details>}
        <div className="button-row">{!operator && <Link className="button-link" to={`/commune/posts/${item.postId}`}>Open my opportunity</Link>}{operator && <>{state.canAssess && <Link className="button-link" to={`/admin/economic-operations?jobPostId=${item.jobPostId}#job-post-economic-assessment-title`}>Open governed fee assessment</Link>}{state.canReview && item.authorUserId && <Link className="button-link" to={`/admin/economic-operations?jobPostId=${item.jobPostId}&beneficiaryUserId=${item.authorUserId}#economic-assistance-management-title`}>Open governed assistance tools</Link>}</>}</div>
        {operator && state.canAssess && state.canReview && item.classification === "commercial" && item.conditionStatus === "payment_required" && <JobPostFeeReduction jobPostId={item.jobPostId} token={token} refresh={refresh} />}
        {(!operator || state.canReview) && <RequestForm key={`${item.jobPostId}:${item.request?.revision ?? 0}`} item={item} operator={operator} busy={busy} run={run} />}
        {!operator && item.request && item.request.status !== "withdrawn" && <button type="button" disabled={busy} onClick={() => void run({ action: "withdraw", jobPostId: item.jobPostId, expectedRevision: item.request!.revision })}>Withdraw this request</button>}
      </article>;
    })}
    {state?.hasMore && <button type="button" disabled={busy} onClick={() => void reload(state.cursor)}>Load more Job Posts</button>}
  </section>;
}

export default function JobPostFeeWorkspace({ operator = false, jobPostId = null }: { operator?: boolean; jobPostId?: string | null }) {
  const { accessToken, userId, loading } = useAuth();
  if (loading) return <p role="status">Checking account access…</p>;
  if (!accessToken || !userId) return <section id="posting-fees" className="section-card"><h2>Posting fee &amp; community access</h2><JobPostFeeNotice /><p>Sign in to view your private Job Post fee status or request a waiver or assistance.</p></section>;
  // Remount on any session/record/audience change: private drafts, responses and
  // delayed results from one account can never become another account's state.
  return <Workspace key={`${accessToken}:${operator}:${jobPostId}`} token={accessToken} operator={operator} jobPostId={jobPostId} />;
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { createReviewItem } from "../../shared/review/reviewClient";

type RequestStatus = "draft_local" | "pending_admin_review_local" | "pending_review";

type WorkRequest = {
  id: string;
  name: string;
  contact: string;
  commonsUsername: string;
  requestType: string;
  areasOfInterest: string[];
  message: string;
  skills: string;
  github: string;
  gitlabCodeberg: string;
  portfolio: string;
  linkedin: string;
  availability: string;
  understandsVolunteer: boolean;
  understandsPublicPrivacy: boolean;
  understandsReview: boolean;
  status: RequestStatus;
  createdAt: string;
};

const storageKey = "workWithElysia.requests.v1";

const requestTypes = [
  "Volunteer", "Contributor", "Collaborator", "Future paid role interest", "Research help", "Documentation help", "Developer / add-on help", "Living Library curation", "Marketplace review interest", "Security review interest", "UI/UX/design help", "Ecological data / GIS / remote sensing help", "Product testing", "Community/moderation help", "Other"
];

const areaOptions = [
  "Elysia core architecture", "Website/public commons", "Developer Forge", "Marketplace/add-ons", "Living Library", "Commune/community", "Documentation/tutorials", "Security/trust/review", "Environmental/ecological systems", "Products/hardware ideas", "Accessibility/testing"
];

const roles = [
  { title: "Volunteer help", text: "Available and requestable for people who want to help carefully while the project is early.", status: "Requestable" },
  { title: "Contributor help", text: "Available and requestable for documentation, testing, source curation, add-ons, research notes, and other constructive work.", status: "Requestable" },
  { title: "Collaboration", text: "Open to thoughtful proposals, especially where expectations, time, boundaries, and ownership are clear.", status: "Requestable" },
  { title: "Paid employment", text: "Not currently promised. Paid roles will only be listed when they actually exist.", status: "Not promised" },
  { title: "Reviewer / moderator roles", text: "Trust roles are administrator-assigned only and cannot be self-assigned through this form.", status: "Admin-assigned" },
  { title: "Membership recognition", text: "Membership tier increases are administrator-awarded after constructive contribution or verified stewardship support.", status: "Review later" }
];

const initialForm = {
  name: "",
  contact: "",
  commonsUsername: "",
  requestType: requestTypes[0],
  areasOfInterest: [] as string[],
  message: "",
  skills: "",
  github: "",
  gitlabCodeberg: "",
  portfolio: "",
  linkedin: "",
  availability: "not sure yet",
  understandsVolunteer: false,
  understandsPublicPrivacy: false,
  understandsReview: false
};

const resumeBucketName = "work-with-attachments";
const maxResumeSizeBytes = 10 * 1024 * 1024;
const acceptedResumeExtensions = new Set(["pdf", "doc", "docx", "odt", "txt", "md"]);
const acceptedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream"
]);

type ResumeValidation = { ok: true } | { ok: false; message: string };

function extensionForFile(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateResumeFile(file: File | null): ResumeValidation {
  if (!file) return { ok: true };
  const extension = extensionForFile(file);
  if (!acceptedResumeExtensions.has(extension)) {
    return { ok: false, message: "Resume/CV must be a PDF, DOC, DOCX, ODT, TXT, or Markdown file." };
  }
  if (file.size > maxResumeSizeBytes) {
    return { ok: false, message: "Resume/CV must be 10 MB or smaller." };
  }
  if (file.type && !acceptedResumeMimeTypes.has(file.type)) {
    return { ok: false, message: `Resume/CV MIME type is not accepted: ${file.type}` };
  }
  return { ok: true };
}

function sanitizeFilename(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 120) || "resume-cv";
}

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readRequests(): WorkRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) as WorkRequest[] : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: WorkRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(requests));
}

function formatMarkdown(request: Omit<WorkRequest, "id" | "createdAt" | "status">, status: RequestStatus) {
  return [
    `# Elysia Ecobotics help request`,
    "",
    `Status: ${status}`,
    `Name/display name: ${request.name || "Not provided"}`,
    `Contact: ${request.contact || "Not provided"}`,
    `Commons username: ${request.commonsUsername || "Not provided"}`,
    `Request type: ${request.requestType}`,
    `Areas of interest: ${request.areasOfInterest.length ? request.areasOfInterest.join(", ") : "Not provided"}`,
    `Availability: ${request.availability}`,
    "",
    "## Why I want to help",
    request.message || "Not provided",
    "",
    "## Skills / experience",
    request.skills || "Not provided",
    "",
    "## Links",
    `GitHub: ${request.github || "Not provided"}`,
    `GitLab / Codeberg: ${request.gitlabCodeberg || "Not provided"}`,
    `Portfolio / website: ${request.portfolio || "Not provided"}`,
    `LinkedIn: ${request.linkedin || "Not provided"}`,
    "",
    "## Confirmations",
    `Volunteer/collaborator understanding: ${request.understandsVolunteer ? "yes" : "no"}`,
    `Public/privacy boundary understood: ${request.understandsPublicPrivacy ? "yes" : "no"}`,
    `Administrator review understood: ${request.understandsReview ? "yes" : "no"}`
  ].join("\n");
}

export default function WorkWithPage() {
  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState<WorkRequest[]>(() => readRequests());
  const [message, setMessage] = useState("");
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const currentMarkdown = useMemo(() => formatMarkdown(form, "draft_local"), [form]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => { if (mounted) setSignedInUserId(data.user?.id ?? null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSignedInUserId(session?.user.id ?? null); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  function toggleArea(area: string) {
    setForm((current) => ({ ...current, areasOfInterest: current.areasOfInterest.includes(area) ? current.areasOfInterest.filter((item) => item !== area) : [...current.areasOfInterest, area] }));
  }

  function saveRequest(status: RequestStatus) {
    const request: WorkRequest = { id: `${status}-${Date.now()}`, ...form, status, createdAt: new Date().toISOString() };
    const next = [request, ...requests];
    setRequests(next);
    writeRequests(next);
    setMessage(status === "pending_admin_review_local"
      ? "Request saved locally as a pending administrator-review draft. Sign in to a Website Account to save it for administrator review."
      : "Request draft saved locally in this browser.");
  }

  async function submitForAdministratorReview() {
    if (!hasSupabaseConfig || !supabase) {
      saveRequest("pending_admin_review_local");
      setMessage(`${supabaseNotConfiguredMessage} Request saved locally as a pending administrator-review draft.`);
      return;
    }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      saveRequest("pending_admin_review_local");
      setMessage("Sign in to a Website Account before uploading a resume or CV or saving a request for administrator review. A local pending-review draft was saved in this browser.");
      return;
    }

    const validation = validateResumeFile(resumeFile);
    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    const requestId = newRequestId();
    setUploadBusy(true);
    const acknowledgements = {
      volunteer_understanding: form.understandsVolunteer,
      public_privacy_boundary: form.understandsPublicPrivacy,
      administrator_review_required: form.understandsReview,
      resume_cv_private_admin_review: Boolean(resumeFile)
    };

    const { error: requestError } = await supabase.from("work_with_requests").insert({
      id: requestId,
      user_id: auth.user.id,
      name: form.name.trim() || null,
      preferred_contact: form.contact.trim() || null,
      commons_username: form.commonsUsername.trim() || null,
      request_type: form.requestType,
      availability: form.availability,
      areas_of_interest: form.areasOfInterest,
      message: form.message.trim() || null,
      skills_experience: form.skills.trim() || null,
      github_url: form.github.trim() || null,
      gitlab_codeberg_url: form.gitlabCodeberg.trim() || null,
      portfolio_url: form.portfolio.trim() || null,
      linkedin_url: form.linkedin.trim() || null,
      acknowledgements,
      source_context: "standalone",
      status: "pending_review"
    });

    if (requestError) {
      setUploadBusy(false);
      setMessage(`Could not save request for administrator review: ${requestError.message}`);
      return;
    }

    if (resumeFile) {
      const safeName = sanitizeFilename(resumeFile.name);
      const storagePath = `${auth.user.id}/${requestId}/${Date.now()}-${safeName}`;
      const uploadResult = await supabase.storage.from(resumeBucketName).upload(storagePath, resumeFile, {
        cacheControl: "3600",
        contentType: resumeFile.type || undefined,
        upsert: false
      });
      if (uploadResult.error) {
        setUploadBusy(false);
        setMessage(`Request row was created, but the private resume/CV upload failed: ${uploadResult.error.message}. The file was not saved.`);
        return;
      }

      const { error: fileError } = await supabase.from("work_with_request_files").insert({
        request_id: requestId,
        user_id: auth.user.id,
        bucket: resumeBucketName,
        storage_path: storagePath,
        original_filename: resumeFile.name,
        mime_type: resumeFile.type || null,
        size_bytes: resumeFile.size,
        file_role: "resume_cv"
      });
      if (fileError) {
        setUploadBusy(false);
        setMessage(`Private resume/CV uploaded, but file metadata could not be saved: ${fileError.message}. Do not assume the attachment is reviewable yet.`);
        return;
      }
    }

    const reviewResult = await createReviewItem({
      domain: "work_with",
      sourceTable: "work_with_requests",
      sourceId: requestId,
      submittedBy: auth.user.id,
      title: `${form.requestType} request from ${form.name.trim() || form.commonsUsername.trim() || "Website member"}`,
      summary: form.message.trim().slice(0, 280)
    });

    setUploadBusy(false);
    setMessage(reviewResult.ok
      ? "Request saved for administrator review."
      : `Request saved, but review queue routing needs attention: ${reviewResult.warning}`);
    setResumeFile(null);
  }

  function exportMarkdown() {
    const blob = new Blob([currentMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "elysia-ecobotics-help-request.md";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Markdown export prepared locally.");
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      setMessage("Request copied as Markdown.");
    } catch {
      setMessage("Copy was blocked by the browser. You can use the Markdown export instead.");
    }
  }

  return (
    <div className="page-stack work-with-page">
      <PageHero eyebrow="Contribute" title="Work With Elysia Ecobotics">
        <p>Elysia Ecobotics is still early. Current roles are volunteer, contributor, or collaborator roles unless a role is explicitly marked paid.</p>
        <p>Most opportunities are currently volunteer, contributor, or collaborator roles. Paid roles will only be listed when they actually exist.</p>
      </PageHero>

      {message && <section className="message" aria-live="polite">{message}</section>}

      <section className="section-card">
        <h2>How to think about this page</h2>
        <p>This is a doorway for people who want to help with software, documentation, design, research, security review, ecological knowledge, testing, and community care. It is not a promise of employment.</p>
        <p className="boundary-note">This request does not guarantee a role, paid work, membership tier, or reviewer authority. Requests will require administrator review.</p>
      </section>

      <section className="section-card work-job-post-bridge">
        <p className="eyebrow">Public opportunities</p>
        <h2>Job Posts are the public board; Work With is the private intake path.</h2>
        <p>Browse public, admin-approved Job Posts in the Commune for open opportunities and public questions. Use this Work With page for private applications, resumes/CVs, and administrator-review requests.</p>
        <p className="boundary-note">Do not post resumes, CVs, SSNs, identity documents, bank details, private addresses, private phone numbers, contracts, or private application packets in public Job Post comments.</p>
        <div className="button-row"><Link className="button-link" to="/commune/rooms/job-post">Browse public Job Posts</Link><Link className="button-link" to="/commune/job-post/new">Submit public Job Post for admin approval</Link></div>
      </section>

      <section className="feature-grid feature-grid--three">
        {roles.map((role) => <FeatureCard key={role.title} title={role.title}><p>{role.text}</p><span className="trust-badge">{role.status}</span></FeatureCard>)}
      </section>

      <section className="section-card work-request-card">
        <p className="eyebrow">Request to help Elysia Ecobotics</p>
        <h2>Volunteer / collaboration request</h2>
        <WarningCallout title="Privacy and safety"><p>Do not include API keys, tokens, passwords, private local file paths, private Elysia logs, .env files, customer/user data, financial information, or confidential employer/client material.</p></WarningCallout>
        <div className="work-request-grid">
          <label><span>Name or display name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span>Email or preferred contact</span><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
          <label><span>Commons username, optional</span><input value={form.commonsUsername} onChange={(event) => setForm({ ...form, commonsUsername: event.target.value })} /></label>
          <label><span>Request type</span><select value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Availability</span><select value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}>{["occasional", "weekly", "project-based", "not sure yet"].map((option) => <option key={option}>{option}</option>)}</select></label>
          <fieldset className="work-area-fieldset wide-field">
            <legend>Area of interest</legend>
            <div className="work-checkbox-grid">{areaOptions.map((area) => <label className="checkbox-line" key={area}><input type="checkbox" checked={form.areasOfInterest.includes(area)} onChange={() => toggleArea(area)} /><span>{area}</span></label>)}</div>
          </fieldset>
          <label className="wide-field"><span>Short message / why you want to help</span><textarea rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
          <label className="wide-field"><span>Skills / experience</span><textarea rows={4} value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label>
          <label><span>GitHub</span><input value={form.github} onChange={(event) => setForm({ ...form, github: event.target.value })} /></label>
          <label><span>GitLab / Codeberg</span><input value={form.gitlabCodeberg} onChange={(event) => setForm({ ...form, gitlabCodeberg: event.target.value })} /></label>
          <label><span>Portfolio / website</span><input value={form.portfolio} onChange={(event) => setForm({ ...form, portfolio: event.target.value })} /></label>
          <label><span>LinkedIn, optional</span><input value={form.linkedin} onChange={(event) => setForm({ ...form, linkedin: event.target.value })} /></label>
          <label className="wide-field resume-upload-field"><span>Resume or CV, optional</span><input type="file" accept=".pdf,.doc,.docx,.odt,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/markdown,text/x-markdown" onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            const validation = validateResumeFile(nextFile);
            if (!validation.ok) {
              setResumeFile(null);
              event.currentTarget.value = "";
              setMessage(validation.message);
              return;
            }
            setResumeFile(nextFile);
            if (nextFile) setMessage(`Selected private resume/CV attachment: ${nextFile.name}. It will upload only when you save for administrator review while signed in.`);
          }} /></label>
          <div className="wide-field boundary-note resume-upload-note">
            <strong>Resume or CV, optional.</strong> Upload a PDF, DOC, DOCX, ODT, TXT, or Markdown resume/CV for administrator review. This file is private, not public, and is only for reviewing your Work With request. {signedInUserId ? "You are signed in; upload will occur only when you save for administrator review." : "Sign in to a Website Account before uploading a resume or CV."}
            <br />Resume/CV uploads are private administrator-review materials. Do not upload identity documents, financial records, medical records, passwords, API keys, .env files, private local Elysia data, or unredacted third-party personal data.
            {resumeFile && <span className="inline-status">Selected file: {resumeFile.name} ({Math.ceil(resumeFile.size / 1024)} KB)</span>}
          </div>
        </div>
        <div className="work-confirm-grid">
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsVolunteer} onChange={(event) => setForm({ ...form, understandsVolunteer: event.target.checked })} /><span>I understand current opportunities are generally volunteer, contributor, or collaborator roles unless explicitly marked paid.</span></label>
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsPublicPrivacy} onChange={(event) => setForm({ ...form, understandsPublicPrivacy: event.target.checked })} /><span>I understand this is a public website request and I should not include secrets, private Elysia memory, credentials, .env files, private logs, or sensitive personal/customer data.</span></label>
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsReview} onChange={(event) => setForm({ ...form, understandsReview: event.target.checked })} /><span>I understand this request requires administrator review and does not automatically grant a role, badge, membership tier, moderator authority, reviewer authority, or paid position.</span></label>
        </div>
        <div className="button-row"><button type="button" onClick={() => saveRequest("draft_local")}>Save request draft locally</button><button type="button" className="button-primary" onClick={() => void submitForAdministratorReview()} disabled={uploadBusy}>{uploadBusy ? "Saving for review..." : "Save as pending administrator-review request"}</button><button type="button" onClick={exportMarkdown}>Export request as Markdown</button><button type="button" onClick={() => void copyRequest()}>Copy request</button></div>
        <p className="boundary-note">If Supabase is configured and you are signed in, pending administrator-review requests are saved to the private review table. Otherwise requests are saved locally in this browser only. Later, this form will connect to an administrator review queue. The administrator will decide which requests become volunteer tasks, collaboration threads, contributor recognition, reviewer roles, or future paid opportunities.</p>
      </section>

      <section className="two-column work-review-panels">
        <article className="section-card">
          <p className="eyebrow">Commons Circle connection</p>
          <h2>Recognition is reviewed separately</h2>
          <p>Commons Circle membership and contribution recognition are handled through administrator review. Creating a request here does not automatically raise your tier.</p>
          <Link className="button-link" to="/commons-circle">Open Commons Circle</Link>
        </article>
        <article className="section-card">
          <p className="eyebrow">Local drafts</p>
          <h2>{requests.length} saved in this browser</h2>
          <p>Saved requests use localStorage key <code>{storageKey}</code>. They are not emailed, uploaded, or routed to an administrator yet.</p>
        </article>
      </section>
    </div>
  );
}

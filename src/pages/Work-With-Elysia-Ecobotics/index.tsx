import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";

type RequestStatus = "draft_local" | "pending_admin_review_local";

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
  const currentMarkdown = useMemo(() => formatMarkdown(form, "draft_local"), [form]);

  function toggleArea(area: string) {
    setForm((current) => ({ ...current, areasOfInterest: current.areasOfInterest.includes(area) ? current.areasOfInterest.filter((item) => item !== area) : [...current.areasOfInterest, area] }));
  }

  function saveRequest(status: RequestStatus) {
    const request: WorkRequest = { id: `${status}-${Date.now()}`, ...form, status, createdAt: new Date().toISOString() };
    const next = [request, ...requests];
    setRequests(next);
    writeRequests(next);
    setMessage(status === "pending_admin_review_local"
      ? "Request saved locally as a pending administrator-review draft. A live administrator review queue will be connected later."
      : "Request draft saved locally in this browser.");
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
        </div>
        <div className="work-confirm-grid">
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsVolunteer} onChange={(event) => setForm({ ...form, understandsVolunteer: event.target.checked })} /><span>I understand current opportunities are generally volunteer, contributor, or collaborator roles unless explicitly marked paid.</span></label>
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsPublicPrivacy} onChange={(event) => setForm({ ...form, understandsPublicPrivacy: event.target.checked })} /><span>I understand this is a public website request and I should not include secrets, private Elysia memory, credentials, .env files, private logs, or sensitive personal/customer data.</span></label>
          <label className="checkbox-line"><input type="checkbox" checked={form.understandsReview} onChange={(event) => setForm({ ...form, understandsReview: event.target.checked })} /><span>I understand this request requires administrator review and does not automatically grant a role, badge, membership tier, moderator authority, reviewer authority, or paid position.</span></label>
        </div>
        <div className="button-row"><button type="button" onClick={() => saveRequest("draft_local")}>Save request draft locally</button><button type="button" className="button-primary" onClick={() => saveRequest("pending_admin_review_local")}>Save as pending administrator-review request</button><button type="button" onClick={exportMarkdown}>Export request as Markdown</button><button type="button" onClick={() => void copyRequest()}>Copy request</button></div>
        <p className="boundary-note">If no live backend review table exists, requests are saved locally in this browser only. Later, this form will connect to an administrator review queue. The administrator will decide which requests become volunteer tasks, collaboration threads, contributor recognition, reviewer roles, or future paid opportunities.</p>
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

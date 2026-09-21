import { useMemo, useState } from "react";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { commonsStewardshipOrganizations, type CommonsStewardshipOrganization } from "./commonsStewardshipOrganizations";

type OnboardingStep = "stewardship" | "recognition" | "contribution" | "account" | "finish";
type VerificationStatus = "draft_local" | "pending_admin_review_local";
type ContributionStatus = "draft_local" | "pending_admin_review_local";

type StewardshipVerificationDraft = {
  id: string;
  organizationId: string;
  organizationName: string;
  donationDate: string;
  amountRange: string;
  receiptReferenceOrHash: string;
  memberNote: string;
  redactionConfirmed: boolean;
  proofFileName?: string;
  proofFileType?: string;
  proofFileSize?: number;
  proofFileHash?: string;
  status: VerificationStatus;
  createdAt: string;
};

type ContributionInterestRequest = {
  id: string;
  interestType: string;
  shortProposal: string;
  relevantSkills: string;
  links: string;
  availability: string;
  preferredArea: string;
  adminNotes: string;
  ethicsAgreement: boolean;
  status: ContributionStatus;
  createdAt: string;
};

const storageKeys = {
  onboarding: "commonsCircle.onboarding.v1",
  stewardshipDrafts: "commonsCircle.stewardshipVerificationDrafts.v1",
  contributionRequests: "commonsCircle.contributionInterestRequests.v1"
} as const;

const commonsCircleReviewConfig = {
  administratorAccountEmail: null,
  liveStewardshipReviewEnabled: false,
  liveContributionReviewEnabled: false,
  backendReviewQueueEnabled: false,
  phoneAlertsEnabled: false
} as const;

const amountRanges = ["Under $10", "$10–$24", "$25–$49", "$50–$99", "$100–$249", "$250+", "Prefer not to say"];
const contributionInterestOptions = [
  "Documentation", "Troubleshooting support", "Source curation / Living Library", "Research notes", "Commune moderation interest", "Marketplace/add-on review interest", "Add-on development", "Developer Forge support", "Accessibility/testing", "Design/media support", "Environmental/ecological data work", "Other"
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function hashFile(file: File): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function groupOrganizations() {
  return commonsStewardshipOrganizations.reduce<Record<string, CommonsStewardshipOrganization[]>>((groups, org) => {
    groups[org.category] = [...(groups[org.category] ?? []), org];
    return groups;
  }, {});
}

function notifyOriginalTab() {
  if (typeof window === "undefined") return;
  const payload = { type: "commons-circle-onboarding-complete", completedAt: new Date().toISOString() };
  try {
    const channel = new BroadcastChannel("commons-circle-onboarding");
    channel.postMessage(payload);
    channel.close();
  } catch {
    window.localStorage.setItem(storageKeys.onboarding, JSON.stringify({ completed: true, welcomed: true, membershipTier: "Free Member", completedAt: payload.completedAt }));
  }
}

export default function CommonsCircleOnboardingPage() {
  const groupedOrganizations = useMemo(groupOrganizations, []);
  const [step, setStep] = useState<OnboardingStep>("stewardship");
  const [selectedOrgId, setSelectedOrgId] = useState(commonsStewardshipOrganizations[0]?.id ?? "");
  const [messages, setMessages] = useState<string[]>([]);
  const [closeAttempted, setCloseAttempted] = useState(false);
  const [verificationForm, setVerificationForm] = useState({ donationDate: "", amountRange: "Prefer not to say", receiptReferenceOrHash: "", memberNote: "", redactionConfirmed: false });
  const [proofMeta, setProofMeta] = useState<{ name?: string; type?: string; size?: number; hash?: string }>({});
  const [hashStatus, setHashStatus] = useState("");
  const [contributionForm, setContributionForm] = useState({ interestType: contributionInterestOptions[0], shortProposal: "", relevantSkills: "", links: "", availability: "", preferredArea: "", adminNotes: "", ethicsAgreement: false });

  const selectedOrg = commonsStewardshipOrganizations.find((org) => org.id === selectedOrgId) ?? commonsStewardshipOrganizations[0];
  const pushMessage = (message: string) => setMessages((current) => [message, ...current].slice(0, 5));

  function skipStewardship() {
    writeStorage(storageKeys.onboarding, { donationSkipped: true, welcomed: true, membershipTier: "Free Member", updatedAt: new Date().toISOString() });
    pushMessage("Stewardship was skipped for this browser onboarding draft. Free Member recognition is granted only after the signed-in Commons Profile setup records canonical onboarding completion; a local browser flag is not eligibility.");
    setStep("contribution");
  }

  async function onProofSelected(file: File | null) {
    if (!file) { setProofMeta({}); return; }
    setHashStatus("Computing local SHA-256 hash. The file is not uploaded or stored.");
    const hash = await hashFile(file);
    setProofMeta({ name: file.name, type: file.type, size: file.size, hash });
    setHashStatus(hash ? "Proof metadata and local hash are ready. Raw file bytes were not stored or uploaded." : "Proof metadata is ready. This browser could not compute a SHA-256 hash, and raw file bytes were not stored or uploaded.");
  }

  function saveVerification(status: VerificationStatus) {
    if (!selectedOrg) return;
    const draft: StewardshipVerificationDraft = {
      id: `${status}-${Date.now()}`,
      organizationId: selectedOrg.id,
      organizationName: selectedOrg.name,
      donationDate: verificationForm.donationDate,
      amountRange: verificationForm.amountRange,
      receiptReferenceOrHash: verificationForm.receiptReferenceOrHash,
      memberNote: verificationForm.memberNote,
      redactionConfirmed: verificationForm.redactionConfirmed,
      proofFileName: proofMeta.name,
      proofFileType: proofMeta.type,
      proofFileSize: proofMeta.size,
      proofFileHash: proofMeta.hash,
      status,
      createdAt: new Date().toISOString()
    };
    const next = [draft, ...readStorage<StewardshipVerificationDraft[]>(storageKeys.stewardshipDrafts, [])];
    writeStorage(storageKeys.stewardshipDrafts, next);
    writeStorage(storageKeys.onboarding, { welcomed: true, membershipTier: "Free Member", lastStewardshipStatus: status, updatedAt: new Date().toISOString() });
    pushMessage(status === "pending_admin_review_local"
      ? "Recognition request saved locally as a pending administrator-review draft. A future backend may route it to a configured review queue after schema, RLS, and administrator tools are built."
      : "Stewardship verification draft saved locally. Administrator review is not connected yet.");
    setStep("contribution");
  }

  function saveContribution(status: ContributionStatus) {
    const request: ContributionInterestRequest = { id: `${status}-${Date.now()}`, ...contributionForm, status, createdAt: new Date().toISOString() };
    const next = [request, ...readStorage<ContributionInterestRequest[]>(storageKeys.contributionRequests, [])];
    writeStorage(storageKeys.contributionRequests, next);
    pushMessage(status === "pending_admin_review_local"
      ? "Help request saved locally as a pending administrator-review draft. Administrator routing is not connected yet."
      : "Help request saved locally. Administrator routing is not connected yet.");
    setStep("account");
  }

  function finishOnboarding() {
    const completedAt = new Date().toISOString();
    writeStorage(storageKeys.onboarding, { completed: true, welcomed: true, membershipTier: "Free Member", completedAt });
    notifyOriginalTab();
    setStep("finish");
    setCloseAttempted(true);
    setTimeout(() => {
      try { window.close(); } catch { /* User-opened tabs may not be closable by script. */ }
    }, 200);
  }

  return (
    <div className="page-stack commons-circle-page commons-onboarding-page">
      <PageHero eyebrow="Commons Circle" title="Membership onboarding">
        <p>This private browser flow helps you choose whether to skip, draft stewardship recognition, or draft a contribution request. It is not a payment page and it does not connect to private local Elysia.</p>
      </PageHero>

      {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}

      <section className="section-card commons-onboarding-progress" aria-label="Onboarding progress">
        {["stewardship", "recognition", "contribution", "account", "finish"].map((name, index) => <button key={name} type="button" className={step === name ? "button-primary" : ""} onClick={() => setStep(name as OnboardingStep)}>{index + 1}. {name}</button>)}
      </section>

      {step === "stewardship" && <section className="section-card commons-onboarding-panel">
        <p className="eyebrow">Stewardship Recognition</p>
        <h2>Choose a stewardship organization to support</h2>
        <p className="boundary-note">These are independent organizations we encourage members to consider. Listing does not imply partnership, sponsorship, endorsement, or payment processing by Elysia Ecobotics. If a member chooses to donate, the payment is made directly through the independent organization's own website or official channel.</p>
        <p>Visit official organization sites directly. This page does not process or receive those funds, track outbound giving, or imply that EcoSyneva receives money.</p>
        {Object.entries(groupedOrganizations).map(([category, orgs]) => <section className="commons-org-category" key={category}>
          <div className="section-heading section-heading--inline"><h3>{category}</h3><span className="trust-badge">{orgs.length} organizations</span></div>
          <div className="commons-org-grid">
            {orgs.map((org) => <article className={org.id === selectedOrgId ? "commons-org-card commons-org-card--selected" : "commons-org-card"} key={org.id}>
              <p className="eyebrow">{org.status}</p>
              <h3>{org.name}</h3>
              <p>{org.shortDescription}</p>
              <p><strong>Why listed:</strong> {org.whyListed}</p>
              <p><strong>Caution:</strong> {org.cautionNote}</p>
              <p>This listing is informational and does not imply affiliation, sponsorship, or partnership.</p>
              <div className="button-row">
                <a className="button-link" href={org.officialUrl} target="_blank" rel="noreferrer">Visit organization site</a>
                <button type="button" onClick={() => { setSelectedOrgId(org.id); setStep("recognition"); }}>I gave directly / prepare recognition request</button>
                <button type="button" onClick={skipStewardship}>Skip for now</button>
              </div>
            </article>)}
          </div>
        </section>)}
      </section>}

      {step === "recognition" && <section className="section-card commons-verification-card commons-onboarding-panel">
        <p className="eyebrow">Request stewardship recognition</p>
        <h2>{selectedOrg ? `Recognition draft for ${selectedOrg.name}` : "Recognition draft"}</h2>
        <WarningCallout title="Redact first"><p>Please redact personal and financial details before uploading proof. Do not upload card numbers, bank details, billing address, full transaction IDs, tax documents, or unredacted receipts. Raw proof files are not uploaded or stored here.</p></WarningCallout>
        <div className="commons-form-grid">
          <label><span>Organization</span><select value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)}>{commonsStewardshipOrganizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}</select></label>
          <label><span>Independent gift date</span><input type="date" value={verificationForm.donationDate} onChange={(event) => setVerificationForm({ ...verificationForm, donationDate: event.target.value })} /></label>
          <label><span>Amount range</span><select value={verificationForm.amountRange} onChange={(event) => setVerificationForm({ ...verificationForm, amountRange: event.target.value })}>{amountRanges.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Receipt reference/hash, optional</span><input value={verificationForm.receiptReferenceOrHash} onChange={(event) => setVerificationForm({ ...verificationForm, receiptReferenceOrHash: event.target.value })} /></label>
          <label className="wide-field"><span>Optional member note</span><textarea value={verificationForm.memberNote} onChange={(event) => setVerificationForm({ ...verificationForm, memberNote: event.target.value })} rows={4} /></label>
          <label><span>Redacted proof file, local metadata only</span><input type="file" onChange={(event) => void onProofSelected(event.target.files?.[0] ?? null)} /></label>
          <label className="checkbox-line"><input type="checkbox" checked={verificationForm.redactionConfirmed} onChange={(event) => setVerificationForm({ ...verificationForm, redactionConfirmed: event.target.checked })} /><span>I confirm I redacted personal and financial details and did not include card numbers, bank details, passwords, or private account data.</span></label>
        </div>
        {hashStatus && <p className="inline-status">{hashStatus}</p>}
        {proofMeta.name && <p>Selected proof metadata: {proofMeta.name}, {proofMeta.type || "unknown type"}, {proofMeta.size} bytes. {proofMeta.hash ? `SHA-256: ${proofMeta.hash}` : "Hash not computed."}</p>}
        <div className="button-row"><button type="button" onClick={() => saveVerification("draft_local")}>Save verification draft locally</button><button type="button" className="button-primary" onClick={() => saveVerification("pending_admin_review_local")}>Save as pending recognition request</button><button type="button" onClick={skipStewardship}>Skip for now</button></div>
        <p>Thank you for supporting an independent stewardship organization. Your recognition request is saved locally for now. Once administrator review is connected, verified stewardship support may be recognized with a Steward badge or membership recognition.</p>
      </section>}

      {step === "contribution" && <section className="section-card commons-onboarding-panel">
        <p className="eyebrow">Contribution / Help Request</p>
        <h2>Help Elysia Ecobotics</h2>
        <p>Contributor, Steward, Guardian / Reviewer, and Founding Steward recognition are assigned by authorized administrators. Constructive help, ethical publishing, troubleshooting, documentation, research, source curation, add-on work, and community support may be reviewed later for recognition.</p>
        <p>Look back at the <a href="/work-with-elysia-ecobotics">Work With Elysia Ecobotics</a> page to see current opportunities, needs, and roles.</p>
        <div className="commons-form-grid">
          <label><span>Contribution interest type</span><select value={contributionForm.interestType} onChange={(event) => setContributionForm({ ...contributionForm, interestType: event.target.value })}>{contributionInterestOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="wide-field"><span>Short proposal</span><textarea rows={4} value={contributionForm.shortProposal} onChange={(event) => setContributionForm({ ...contributionForm, shortProposal: event.target.value })} /></label>
          <label><span>Relevant skills</span><input value={contributionForm.relevantSkills} onChange={(event) => setContributionForm({ ...contributionForm, relevantSkills: event.target.value })} /></label>
          <label><span>Links / portfolio / GitHub / Codeberg, optional</span><input value={contributionForm.links} onChange={(event) => setContributionForm({ ...contributionForm, links: event.target.value })} /></label>
          <label><span>Availability</span><input value={contributionForm.availability} onChange={(event) => setContributionForm({ ...contributionForm, availability: event.target.value })} /></label>
          <label><span>Preferred area</span><input value={contributionForm.preferredArea} onChange={(event) => setContributionForm({ ...contributionForm, preferredArea: event.target.value })} /></label>
          <label className="wide-field"><span>Notes for administrator</span><textarea rows={3} value={contributionForm.adminNotes} onChange={(event) => setContributionForm({ ...contributionForm, adminNotes: event.target.value })} /></label>
          <label className="checkbox-line"><input type="checkbox" checked={contributionForm.ethicsAgreement} onChange={(event) => setContributionForm({ ...contributionForm, ethicsAgreement: event.target.checked })} /><span>I understand this request does not grant a tier or role until an administrator reviews and approves it.</span></label>
        </div>
        <div className="button-row"><button type="button" onClick={() => saveContribution("draft_local")}>Save help request locally</button><button type="button" className="button-primary" onClick={() => saveContribution("pending_admin_review_local")}>Save as pending administrator review request</button><button type="button" onClick={() => setStep("account")}>Skip for now</button><button type="button" onClick={() => setStep("account")}>Continue</button></div>
      </section>}

      {step === "account" && <section className="two-column commons-account-panels">
        <article className="section-card">
          <p className="eyebrow">Review configuration</p>
          <h2>Local mode now</h2>
          <p>Moderator and administrator routing is not live yet. Stewardship and contribution requests are browser-local drafts until Supabase tables, RLS, review queues, and administrator tools are intentionally built.</p>
          <dl className="mini-facts">
            <div><dt>Stewardship review</dt><dd>{commonsCircleReviewConfig.liveStewardshipReviewEnabled ? "Live" : "Local draft only"}</dd></div>
            <div><dt>Contribution review</dt><dd>{commonsCircleReviewConfig.liveContributionReviewEnabled ? "Live" : "Local draft only"}</dd></div>
            <div><dt>Backend queue</dt><dd>{commonsCircleReviewConfig.backendReviewQueueEnabled ? "Enabled" : "Not connected"}</dd></div>
            <div><dt>Phone alerts</dt><dd>{commonsCircleReviewConfig.phoneAlertsEnabled ? "Enabled" : "Not enabled"}</dd></div>
          </dl>
        </article>
        <AuthPanel
          onMessage={pushMessage}
          onAuthChanged={async () => undefined}
          copy={{
            eyebrow: "Website Account",
            title: "Website Account",
            description: "Sign in to your Elysia Ecobotics Online account. This is for the public website, not the private local Elysia core. Do not enter your local Elysia password here.",
            signedOutText: "No active website session.",
            confirmationPath: "/commons-circle/onboarding",
            confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to the site; the session should appear after Supabase completes the redirect."
          }}
        />
        <div className="button-row wide-field"><button type="button" className="button-primary" onClick={finishOnboarding}>Finish onboarding</button><a className="button-link" href="/commons-circle">Return to Commons Circle</a></div>
      </section>}

      {step === "finish" && <section className="section-card commons-onboarding-panel">
        <p className="eyebrow">Complete</p>
        <h2>Browser onboarding choices are complete</h2>
        <p>Your browser-local choices are complete and the original Commons Circle tab should refresh. These local choices do not grant Free Member recognition to this or any other account. Complete the signed-in Commons Profile setup so canonical onboarding completion is recorded for the correct Website Account.</p>
        {closeAttempted && <p className="boundary-note">Your browser may not allow this tab to close automatically. You can close this tab and return to the Commons Circle tab.</p>}
        <div className="button-row"><a className="button-link button-link--primary" href="/commons-circle">Return to Commons Circle</a><button type="button" onClick={() => { notifyOriginalTab(); window.close(); }}>Try closing this tab</button></div>
      </section>}
    </div>
  );
}

import { useMemo, useState } from "react";
import { manifestToSubmissionPayload, normalizeAddonId, validateAddonManifest } from "../lib/addonManifest";
import { submitAddonDraft } from "../lib/marketplaceApi";
import { hasSupabaseConfig } from "../lib/supabase";
import type { AddonCategory } from "../types";

type DeveloperSubmissionFormProps = {
  onMessage: (message: string) => void;
};

const starterManifest = {
  schema_version: "0.1",
  id: "my-addon",
  name: "My Add-on",
  publisher: "Developer",
  version: "0.1.0",
  category: "Developer Tools",
  summary: "Short add-on summary.",
  description: "Longer add-on description.",
  trust_tier: "unreviewed",
  local_only: true,
  network_access: false,
  dependencies: [],
  actions: [{ action_key: "manual_review", action_label: "Manual review", action_kind: "manual_instruction", allowed: true, risk_level: "unknown", requires_local_operator_password: true, notes: ["Local Elysia must approve before execution."] }],
  security: { operator_only: true, model_accessible: false, chat_accessible: false, memory_promotion_allowed: false, outward_sharing_allowed: false, local_file_access: "none" },
  tags: ["submission"]
};

export default function DeveloperSubmissionForm({ onMessage }: DeveloperSubmissionFormProps) {
  const [addonName, setAddonName] = useState("My Add-on");
  const [publisherName, setPublisherName] = useState("Developer");
  const [category, setCategory] = useState<AddonCategory>("Developer Tools");
  const [manifestText, setManifestText] = useState(JSON.stringify(starterManifest, null, 2));
  const [submitStatus, setSubmitStatus] = useState("Validate locally first. Remote review submission requires Supabase configuration and a signed-in Marketplace account.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validation = useMemo(() => {
    try { return validateAddonManifest(JSON.parse(manifestText)); }
    catch (error) { return { ok: false, errors: [error instanceof Error ? error.message : "Invalid JSON"] }; }
  }, [manifestText]);

  async function submitDraft() {
    if (!validation.ok || !validation.manifest) {
      const message = "Manifest must validate before submission.";
      setSubmitStatus(message);
      onMessage(message);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(hasSupabaseConfig ? "Submitting to Supabase Marketplace review..." : "Supabase is not configured, so this will validate locally only.");
    try {
      const result = await submitAddonDraft(manifestToSubmissionPayload(validation.manifest));
      const message = result.warnings.join(" ") || result.statusMessage || (result.data.submitted ? "Submitted for review." : "Draft validated locally only.");
      setSubmitStatus(message);
      onMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="submission-card" id="submit">
      <p className="eyebrow">Developer Submission</p>
      <h2>Submit an add-on for review</h2>
      <p>Community submissions are never auto-approved. Review must inspect permissions, dependencies, network behavior, and rollback story.</p>
      <p className="boundary-note">{hasSupabaseConfig ? "Supabase is configured. A signed-in Marketplace account is required before Submit for review can create a remote review item." : "Supabase is not configured here. Manifest validation works locally, but Submit for review will not save a remote review item."}</p>
      <div className="form-grid">
        <label><span>Add-on name</span><input value={addonName} onChange={(event) => setAddonName(event.target.value)} /></label>
        <label><span>Slug / ID</span><input value={normalizeAddonId(addonName)} readOnly /></label>
        <label><span>Publisher name</span><input value={publisherName} onChange={(event) => setPublisherName(event.target.value)} /></label>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as AddonCategory)}><option>Developer Tools</option><option>Files</option><option>Research / Web</option><option>Data / Science</option><option>GIS</option><option>Security</option></select></label>
      </div>
      <label><span>Manifest JSON</span><textarea value={manifestText} onChange={(event) => setManifestText(event.target.value)} rows={14} /></label>
      <div className={validation.ok ? "validation validation--ok" : "validation validation--bad"}>{validation.ok ? "Manifest validates locally." : validation.errors.join(" | ")}</div>
      <p className="validation">{submitStatus}</p>
      <div className="button-row"><button type="button" onClick={() => { const message = validation.ok ? "Manifest validates locally." : validation.errors.join(" | "); setSubmitStatus(message); onMessage(message); }}>Validate manifest</button><button type="button" className="button-primary" onClick={submitDraft} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit for review"}</button></div>
    </section>
  );
}

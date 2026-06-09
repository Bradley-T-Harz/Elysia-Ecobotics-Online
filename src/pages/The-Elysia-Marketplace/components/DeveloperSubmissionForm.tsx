import { useMemo, useState } from "react";
import { manifestToSubmissionPayload, normalizeAddonId, validateAddonManifest } from "../lib/addonManifest";
import { submitAddonDraft } from "../lib/marketplaceApi";
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

  const validation = useMemo(() => {
    try { return validateAddonManifest(JSON.parse(manifestText)); }
    catch (error) { return { ok: false, errors: [error instanceof Error ? error.message : "Invalid JSON"] }; }
  }, [manifestText]);

  async function submitDraft() {
    if (!validation.ok || !validation.manifest) {
      onMessage("Manifest must validate before submission.");
      return;
    }
    const result = await submitAddonDraft(manifestToSubmissionPayload(validation.manifest));
    onMessage(result.warnings.join(" ") || (result.data.submitted ? "Submitted for review." : "Draft validated."));
  }

  return (
    <section className="submission-card" id="submit">
      <p className="eyebrow">Developer Submission</p>
      <h2>Submit an add-on for review</h2>
      <p>Community submissions are never auto-approved. Review must inspect permissions, dependencies, network behavior, and rollback story.</p>
      <div className="form-grid">
        <label><span>Add-on name</span><input value={addonName} onChange={(event) => setAddonName(event.target.value)} /></label>
        <label><span>Slug / ID</span><input value={normalizeAddonId(addonName)} readOnly /></label>
        <label><span>Publisher name</span><input value={publisherName} onChange={(event) => setPublisherName(event.target.value)} /></label>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as AddonCategory)}><option>Developer Tools</option><option>Files</option><option>Research / Web</option><option>Data / Science</option><option>GIS</option><option>Security</option></select></label>
      </div>
      <label><span>Manifest JSON</span><textarea value={manifestText} onChange={(event) => setManifestText(event.target.value)} rows={14} /></label>
      <div className={validation.ok ? "validation validation--ok" : "validation validation--bad"}>{validation.ok ? "Manifest validates locally." : validation.errors.join(" | ")}</div>
      <div className="button-row"><button type="button" onClick={() => onMessage(validation.ok ? "Manifest validates locally." : validation.errors.join(" | "))}>Validate manifest</button><button type="button" className="button-primary" onClick={submitDraft}>Submit for review</button></div>
    </section>
  );
}

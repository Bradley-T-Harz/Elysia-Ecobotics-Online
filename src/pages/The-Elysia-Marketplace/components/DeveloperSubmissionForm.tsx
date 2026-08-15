import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddonIntakePanel from "../../../shared/addons/AddonIntakePanel";
import type { AddonIntakeResult } from "../../../shared/addons/browserAddonIntake";
import { useAuth } from "../../../shared/auth/useAuth";
import {
  createDraftFromManifest,
  loadForgeState,
  saveDraftPermissions,
  submitDraftForReview,
  uploadPackageMetadata,
  validateAndSaveDraft
} from "../../The-Developer-Forge/developerForgeApi";
import type { ForgeState } from "../../The-Developer-Forge/developerForgeApi";
import {
  defaultManifestForTemplate,
  defaultPermissionCatalog,
  validateManifest,
  validationStatus
} from "../../The-Developer-Forge/developerForgeValidator";
import type { ForgeManifest } from "../../The-Developer-Forge/developerForgeValidator";
import { hasSupabaseConfig } from "../lib/supabase";

type DeveloperSubmissionFormProps = {
  onMessage: (message: string) => void;
};

const starterManifest: ForgeManifest = {
  ...defaultManifestForTemplate("developer.my-addon", "My Add-on"),
  author: { name: "Developer", url: "https://example.com" }
};

export default function DeveloperSubmissionForm({ onMessage }: DeveloperSubmissionFormProps) {
  const auth = useAuth();
  const [forgeState, setForgeState] = useState<ForgeState | null>(null);
  const [manifestText, setManifestText] = useState(JSON.stringify(starterManifest, null, 2));
  const [intake, setIntake] = useState<AddonIntakeResult | null>(null);
  const [permissionReasons, setPermissionReasons] = useState<Record<string, string>>({ public_docs_read: "Read public Elysia documentation metadata only." });
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [uploadAccepted, setUploadAccepted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("Choose a source path or validate the manifest. Nothing is uploaded until you explicitly submit for review.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadForgeState().then(setForgeState);
  }, [auth.userId]);

  const validation = useMemo(() => validateManifest(manifestText, forgeState?.permissionCatalog.length ? forgeState.permissionCatalog : defaultPermissionCatalog), [manifestText, forgeState?.permissionCatalog]);
  const blocking = validation.results.some((result) => result.severity === "blocked" || result.severity === "error");
  const permissions = validation.manifest?.permissions ?? [];
  const reasonsComplete = permissions.every((permission) => Boolean(permissionReasons[permission]?.trim()));
  const catalog = forgeState?.permissionCatalog.length ? forgeState.permissionCatalog : defaultPermissionCatalog;
  const hasElevatedPermission = permissions.some((permission) => catalog.find((item) => item.permission_key === permission)?.risk_level !== "low");
  const canSubmit = hasSupabaseConfig && Boolean(auth.userId) && Boolean(forgeState?.profile) && !blocking && !intake?.errors.length && uploadAccepted && reasonsComplete && (!hasElevatedPermission || riskAccepted) && !isSubmitting;

  function updateManifest(patch: Partial<ForgeManifest>) {
    if (!validation.manifest) return;
    setManifestText(JSON.stringify({ ...validation.manifest, ...patch }, null, 2));
  }

  function acceptIntake(result: AddonIntakeResult) {
    setIntake(result);
    setUploadAccepted(false);
    if (result.manifestText) setManifestText(result.manifestText);
  }

  async function submitDraft() {
    if (!canSubmit || !validation.manifest || !forgeState?.profile) {
      const message = !auth.userId
        ? "Sign in before creating a remote Marketplace review submission."
        : !forgeState?.profile
          ? "Create a Developer Forge profile before remote submission."
          : "Complete validation, permission reasons, risk acknowledgement, and the upload disclosure before submitting.";
      setSubmitStatus(message);
      onMessage(message);
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus("Creating a private Developer Forge draft and pending-review snapshot...");
    try {
      const created = await createDraftFromManifest(validation.manifest, forgeState.profile.id ?? null);
      if (!created.draft || created.draft.id.startsWith("local-")) {
        const message = created.warnings.join(" ") || "Account-backed draft creation did not complete.";
        setSubmitStatus(message);
        onMessage(message);
        return;
      }
      const warnings = [...created.warnings];
      if (intake?.packageFile && /\.(elysia-addon|zip)$/i.test(intake.packageFile.name)) {
        const upload = await uploadPackageMetadata(created.draft, intake.packageFile);
        warnings.push(...upload.warnings);
        if (upload.scan.some((item) => item.severity === "blocked" || item.severity === "error")) {
          const message = [...warnings, "Blocking package findings prevented review submission."].join(" ");
          setSubmitStatus(message);
          onMessage(message);
          return;
        }
      }
      const validationSave = await validateAndSaveDraft(created.draft, catalog);
      warnings.push(...validationSave.warnings);
      const permissionWarnings = await saveDraftPermissions(created.draft.id, permissions.map((permission_key) => ({
        permission_key,
        reason: permissionReasons[permission_key].trim(),
        risk_acknowledged: catalog.find((item) => item.permission_key === permission_key)?.risk_level === "low" ? false : riskAccepted
      })));
      warnings.push(...permissionWarnings);
      const submitMessages = await submitDraftForReview(created.draft, true, catalog);
      const message = [...warnings, ...submitMessages].filter(Boolean).join(" ") || "Submitted to the private pending-review queue. It is not public or installable.";
      setSubmitStatus(message);
      onMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return <section className="submission-card" id="submit">
    <p className="eyebrow">Developer Submission</p>
    <h2>Submit a complete add-on source for review</h2>
    <p>Start with an inert .elysia-addon, ZIP source bundle, local folder/repository, manifest.json, or Git repository URL metadata. Static review never executes uploaded code.</p>
    <p className="boundary-note">{hasSupabaseConfig ? auth.userId ? forgeState?.profile ? "Signed-in Developer Forge profile found. A valid submission creates only a private pending-review record." : "Signed in, but a Developer Forge profile is required before remote submission." : "Sign in to create a remote review submission." : "Remote review storage is not configured. Local intake and validation still work, but no submission will be created."}</p>
    <AddonIntakePanel result={intake} onResult={acceptIntake} onMessage={(message) => { setSubmitStatus(message); onMessage(message); }} />
    <div className="form-grid">
      <label><span>Add-on name</span><input value={validation.manifest?.name ?? ""} onChange={(event) => updateManifest({ name: event.target.value })} /></label>
      <label><span>Add-on ID</span><input value={validation.manifest?.addon_id ?? ""} onChange={(event) => updateManifest({ addon_id: event.target.value })} /></label>
      <label><span>Publisher name</span><input value={validation.manifest?.author?.name ?? ""} onChange={(event) => updateManifest({ author: { ...validation.manifest?.author, name: event.target.value } })} /></label>
      <label><span>Git repository URL (metadata only)</span><input value={typeof validation.manifest?.source_url === "string" ? validation.manifest.source_url : ""} onChange={(event) => updateManifest({ source_url: event.target.value })} placeholder="https://example.com/repository" /></label>
    </div>
    <p className="boundary-note">A Git repository URL is recorded as review metadata only. This page does not clone, fetch, authenticate to, or inspect a remote repository.</p>
    <label><span>manifest.json</span><textarea value={manifestText} onChange={(event) => setManifestText(event.target.value)} rows={16} /></label>
    <div className={!blocking ? "validation validation--ok" : "validation validation--bad"}>{!blocking ? `Manifest validation: ${validationStatus(validation.results)}.` : validation.results.filter((result) => result.severity === "blocked" || result.severity === "error").map((result) => result.message).join(" | ")}</div>
    {permissions.length > 0 && <section className="submission-permissions"><h3>Permission reasons</h3><p>Requested permissions are declarations, not grants. Admin review and Local Elysia may still deny them.</p>{permissions.map((permission) => <label key={permission}><span>{permission}</span><input value={permissionReasons[permission] ?? ""} onChange={(event) => setPermissionReasons((current) => ({ ...current, [permission]: event.target.value }))} placeholder="Why is this exact permission needed?" /></label>)}</section>}
    {hasElevatedPermission && <label className="checkbox-line"><input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /><span>I acknowledge that these permissions require additional reviewer and local user scrutiny.</span></label>}
    <label className="checkbox-line"><input type="checkbox" checked={uploadAccepted} onChange={(event) => setUploadAccepted(event.target.checked)} /><span>The manifest and any selected package files will leave my computer and transfer to Elysia Ecobotics / EcoSyneva Commons review infrastructure. I reviewed the selection and removed secrets and private material. Admin review reduces risk but does not guarantee safety.</span></label>
    <p className="validation" aria-live="polite">{submitStatus}</p>
    <div className="button-row"><button type="button" onClick={() => { const message = blocking ? validation.results.map((item) => item.message).join(" | ") : `Manifest validates with ${validationStatus(validation.results)} status.`; setSubmitStatus(message); onMessage(message); }}>Validate manifest</button><Link className="button-link" to="/developer-forge/drafts">Open full Developer Forge</Link><button type="button" className="button-primary" onClick={() => void submitDraft()} disabled={!canSubmit}>{isSubmitting ? "Submitting..." : "Submit private pending review"}</button></div>
    <p className="boundary-note">Submitted does not mean approved. Approved does not mean published. Published does not mean installed, enabled, unrestricted, or guaranteed safe.</p>
  </section>;
}

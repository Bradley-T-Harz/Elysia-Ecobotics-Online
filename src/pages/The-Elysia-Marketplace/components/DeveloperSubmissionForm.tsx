import SyncCodevSlot from "../../../shared/codev/SyncCodevSlot";
import { useBrowserWorkspace } from "../../../shared/codev/useBrowserWorkspace";
import { browserWorkspaceId } from "../../../shared/codev/workspaceRecovery";
import { intakeFormMetadata, intakeWorkspaceFiles, workspaceManifest } from "../../../shared/codev/workspaceAdapters";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AddonIntakePanel from "../../../shared/addons/AddonIntakePanel";
import { reassessAddonWorkspace, type AddonIntakeResult } from "../../../shared/addons/browserAddonIntake";
import { useAuth } from "../../../shared/auth/useAuth";
import {
  createDraftFromManifest,
  loadForgeState,
  saveDraftPermissions,
  submitDraftForReview,
  uploadPackageMetadata,
  validateAndSaveDraft
} from "../../The-Developer-Forge/developerForgeApi";
import type { ForgeState, WorkspacePackageProof } from "../../The-Developer-Forge/developerForgeApi";
import {
  defaultManifestForTemplate,
  defaultPermissionCatalog,
  manifestPermissionKeys,
  validateManifest,
  validationStatus
} from "../../The-Developer-Forge/developerForgeValidator";
import type { ForgeManifest } from "../../The-Developer-Forge/developerForgeValidator";
import { hasSupabaseConfig } from "../lib/supabase";
import { evaluateMarketplaceSubmissionReadiness, marketplaceSubmissionBlockerMessage } from "../lib/submissionReadiness";
import OwnershipAttribution, { ownershipIsReady } from "../../../shared/addons/OwnershipAttribution";
import { emptyOwnership, type OwnershipSelection } from "../../../shared/addons/publisherOwnership";

type DeveloperSubmissionFormProps = {
  onMessage: (message: string) => void;
};

const starterManifest: ForgeManifest = {
  ...defaultManifestForTemplate("developer.my-addon", "My Add-on"),
  author: { name: "Developer", url: "https://example.com" }
};

export default function DeveloperSubmissionForm(props: DeveloperSubmissionFormProps) {
  const auth = useAuth();
  if (auth.loading) return null;
  return <AccountSubmissionForm key={auth.userId ?? "anonymous"} {...props} />;
}
function AccountSubmissionForm({ onMessage }: DeveloperSubmissionFormProps) {
  const auth = useAuth();
  const [forgeState, setForgeState] = useState<ForgeState | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const { controller, workspace, ready, recoveryError } = useBrowserWorkspace({ accountId: auth.userId, browserId: browserWorkspaceId(), surface: "marketplace", draftId: null }, "Marketplace submission",
    [{ path: "manifest.json", text: JSON.stringify(starterManifest, null, 2), provenance: "editor" }]);
  const manifestText = workspaceManifest(workspace.files);
  function setManifestText(value: string) { try { if (workspace.files.some(file => file.path === "manifest.json")) controller.updateText("manifest.json", value); else controller.importFiles([{ path: "manifest.json", text: value, provenance: "editor" }]); } catch (error) { report(String(error)); } }
  const [intakeSource, setIntake] = useState<AddonIntakeResult | null>(null);
  const intake = useMemo(() => (intakeSource || workspace.metadata.intake || workspace.files.length > 1) ? reassessAddonWorkspace((intakeSource ?? workspace.metadata.intake ?? null) as Partial<AddonIntakeResult> | null, workspace.files) : null, [intakeSource, workspace.files, workspace.metadata.intake]);
  const permissionReasons = (workspace.metadata.permissionReasons ?? { public_docs_read: "Read public Elysia documentation metadata only." }) as Record<string, string>;
  function setPermissionReasons(next: (current: Record<string, string>) => Record<string, string>) { controller.updateMetadata({ ...workspace.metadata, permissionReasons: next(permissionReasons) }); }
  const [riskRevision, setRiskRevision] = useState<number | null>(null);
  const riskAccepted = riskRevision === workspace.revision;
  const setRiskAccepted = (value: boolean) => setRiskRevision(value ? workspace.revision : null);
  const [uploadRevision, setUploadRevision] = useState<number | null>(null);
  const uploadAccepted = uploadRevision === workspace.revision;
  const setUploadAccepted = (value: boolean) => setUploadRevision(value ? workspace.revision : null);
  const [submitStatus, setSubmitStatus] = useState("Choose a source path or validate the manifest. Nothing is uploaded until you explicitly submit for review.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ownership = (workspace.metadata.ownership ?? emptyOwnership) as OwnershipSelection;
  function setOwnership(value: OwnershipSelection) { controller.updateMetadata({ ...workspace.metadata, ownership: value }); }
  function report(message: string) { if (alive.current) { setSubmitStatus(message); onMessage(message); } }
  function assertCurrent(revision: number) { if (!alive.current) throw new Error("The website account or page changed. No further submission step was taken."); controller.model.assertRevision(revision); }
  useEffect(() => { if (recoveryError) report(recoveryError); }, [recoveryError]);

  useEffect(() => {
    let current = true;

    void loadForgeState().then(next => { if (current && next.userId === auth.userId) setForgeState(next); });
    return () => { current = false; };
  }, [auth.userId, auth.accessToken]);

  const validation = useMemo(() => validateManifest(manifestText, forgeState?.permissionCatalog.length ? forgeState.permissionCatalog : defaultPermissionCatalog), [manifestText, forgeState?.permissionCatalog]);
  const blocking = validation.results.some((result) => result.severity === "blocked" || result.severity === "error");
  const permissions = manifestPermissionKeys(validation.manifest);
  const reasonsComplete = permissions.every((permission) => Boolean(permissionReasons[permission]?.trim()));
  const catalog = forgeState?.permissionCatalog.length ? forgeState.permissionCatalog : defaultPermissionCatalog;
  const hasElevatedPermission = permissions.some((permission) => catalog.find((item) => item.permission_key === permission)?.risk_level !== "low");
  const readiness = evaluateMarketplaceSubmissionReadiness({
    supabaseConfigured: hasSupabaseConfig,
    signedIn: Boolean(auth.userId),
    developerProfileAvailable: Boolean(forgeState?.profile),
    manifestBlocked: blocking,
    intakeBlocked: Boolean(intake?.errors.length),
    uploadDisclosureAccepted: uploadAccepted,
    permissionReasonsComplete: reasonsComplete,
    elevatedPermissionRequested: hasElevatedPermission,
    elevatedRiskAccepted: riskAccepted,
    submitting: isSubmitting
  });
  const canSubmit = ready && readiness.ready && ownershipIsReady(ownership);
  const codevPolicy = useRef({ ready, isSubmitting, validation, intake }); codevPolicy.current = { ready, isSubmitting, validation, intake };
  const codevBinding = useMemo(() => ({ controller,
    sourceDescription: () => "Browser-selected " + (codevPolicy.current.intake?.sourceKind ?? "manifest"),
    diagnostics: () => codevPolicy.current.validation.results.map(result => `${result.severity}: ${result.message}`).concat((codevPolicy.current.intake?.errors ?? []).map(issue => issue.message)),
    canEdit: () => alive.current && codevPolicy.current.ready && !codevPolicy.current.isSubmitting,
    beforeRefresh: async () => {
      if (!alive.current || !codevPolicy.current.ready || codevPolicy.current.isSubmitting) throw new Error("Wait for the current submission operation before refreshing.");
      const revision = await controller.persist();
      if (!alive.current || codevPolicy.current.isSubmitting) throw new Error("The page changed during recovery. Your source remains open.");
      controller.model.assertRevision(revision);
    },
    onChanged: (message: string) => { if (alive.current) onMessage(message); }
  }), [controller, onMessage]);

  function updateManifest(patch: Partial<ForgeManifest>) {
    if (!validation.manifest) return;
    setManifestText(JSON.stringify({ ...validation.manifest, ...patch }, null, 2));
  }

  function acceptIntake(result: AddonIntakeResult) {
    if (!ready || isSubmitting) return;
    try { controller.importFiles(intakeWorkspaceFiles(result), result.sourceKind !== "manifest"); controller.updateMetadata({ ...controller.model.getSnapshot().metadata, intake: intakeFormMetadata(result) }); setIntake(result); setUploadAccepted(false); }
    catch (error) { report(String(error)); }
  }

  async function submitDraft() {
    if (!canSubmit || !validation.manifest || !forgeState?.profile || !ready || uploadRevision !== controller.model.getSnapshot().revision || (hasElevatedPermission && riskRevision !== controller.model.getSnapshot().revision)) {
      const message = !ownershipIsReady(ownership) ? "Enter Creator / Organization and select an authorized Publisher account." : marketplaceSubmissionBlockerMessage(readiness.blockers[0]);
      report(message); return;
    }
    setIsSubmitting(true);
    setSubmitStatus("Creating a private Developer Forge draft and pending-review snapshot...");
    try {
      const prepared = intake && workspace.files.length > 1 ? await controller.model.preparePackage(validation.manifest.addon_id ?? "addon") : null;
      const captured = prepared?.snapshot ?? await controller.model.capture(); assertCurrent(captured.revision);
      const current = validateManifest(workspaceManifest(controller.model.getSnapshot().files), catalog);
      if (!current.manifest || current.results.some(item => ["error", "blocked"].includes(item.severity))) throw new Error("Fix the current manifest before private submission.");
      const created = await createDraftFromManifest(current.manifest, forgeState.profile.id ?? null, ownership, undefined, auth.userId);
      assertCurrent(captured.revision);
      if (!created.draft || created.draft.id.startsWith("local-")) throw new Error(created.warnings.join(" ") || "Account-backed draft creation did not complete.");
      const warnings = [...created.warnings];
      let proof: WorkspacePackageProof | undefined;
      if (prepared) {
        proof = { snapshot: prepared.snapshot, packageHash: prepared.packageHash };
        const upload = await uploadPackageMetadata(created.draft, prepared.file, proof); assertCurrent(captured.revision);
        if (!upload.packageRow?.storage_path || upload.warnings.length || upload.scan.some(item => ["blocked", "error"].includes(item.severity))) {
          throw new Error([...upload.warnings, "Package transfer was not fully confirmed. The private draft remains available; review submission was not attempted."].join(" "));
        }
        proof.packageId = upload.packageRow.id;
      }
      const validationSave = await validateAndSaveDraft(created.draft, catalog); assertCurrent(captured.revision);
      if (validationSave.warnings.length) throw new Error(validationSave.warnings.join(" "));
      const permissionWarnings = await saveDraftPermissions(created.draft.id, permissions.map(permission_key => ({ permission_key,
        reason: permissionReasons[permission_key].trim(), risk_acknowledged: catalog.find(item => item.permission_key === permission_key)?.risk_level === "low" ? false : riskAccepted
      })), auth.userId ?? undefined); assertCurrent(captured.revision);
      if (permissionWarnings.length) throw new Error(permissionWarnings.join(" "));
      const submitMessages = await submitDraftForReview(created.draft, true, catalog, proof);
      report([...warnings, ...submitMessages].filter(Boolean).join(" "));
    } catch (error) { report(error instanceof Error ? error.message : "Submission could not be confirmed. Review the private draft before retrying."); }
    finally { if (alive.current) { setIsSubmitting(false); setUploadRevision(null); setRiskRevision(null); } }
  }

  return <section className="submission-card" id="submit">
    <SyncCodevSlot surface="marketplace" binding={codevBinding}/>
    <p className="eyebrow">Developer Submission</p>
    <h2>Submit a complete add-on source for review</h2>
    <p>Choose a complete local package, ZIP source bundle, folder/repository, or manifest below. You may also paste manifest JSON or attach a Git URL as metadata. Static review never executes uploaded code.</p>
    <p className="boundary-note">{hasSupabaseConfig ? auth.userId ? forgeState?.profile ? "Signed-in Developer Forge profile found. A valid submission creates only a private pending-review record." : "Signed in, but a Developer Forge profile is required before remote submission." : "Sign in to create a remote review submission." : "Remote review storage is not configured. Local intake and validation still work, but no submission will be created."}</p>
    <AddonIntakePanel disabled={!ready || isSubmitting} result={intake} onResult={acceptIntake} onMessage={(message) => { setSubmitStatus(message); onMessage(message); }} />
    <OwnershipAttribution key={auth.userId ?? "local"} value={ownership} onChange={setOwnership} disabled={!ready || isSubmitting} />
    <div className="form-grid">
      <label><span>Add-on name</span><input disabled={!ready || isSubmitting} value={validation.manifest?.name ?? ""} onChange={(event) => updateManifest({ name: event.target.value })} /></label>
      <label><span>Add-on ID</span><input disabled={!ready || isSubmitting} value={validation.manifest?.addon_id ?? ""} onChange={(event) => updateManifest({ addon_id: event.target.value })} /></label>
      <label><span>Manifest author / publisher name (declared)</span><input disabled={!ready || isSubmitting} value={validation.manifest?.publisher?.name ?? validation.manifest?.author?.name ?? ""} onChange={(event) => validation.manifest?.schema_version === "1.1" ? updateManifest({ publisher: { ...validation.manifest?.publisher, name: event.target.value } }) : updateManifest({ author: { ...validation.manifest?.author, name: event.target.value } })} /></label>
    </div>
    <section className="submission-source-metadata" aria-labelledby="git-metadata-heading">
      <div><p className="eyebrow">Optional source reference</p><h3 id="git-metadata-heading">Add Git repository URL as review metadata</h3><p>This records a reference only. The website does not clone, fetch, authenticate to, or inspect the repository.</p></div>
      <label><span>Git repository URL (metadata only)</span><input disabled={!ready || isSubmitting} value={typeof validation.manifest?.source_url === "string" ? validation.manifest.source_url : ""} onChange={(event) => updateManifest({ source_url: event.target.value })} placeholder="https://example.com/repository" /></label>
    </section>
    <label className="submission-manifest-editor"><span>Paste or edit manifest JSON</span><small>Use this for manifest-only review or to edit the manifest loaded from a package, ZIP, or folder.</small><textarea disabled={!ready || isSubmitting} aria-label="Paste or edit manifest JSON" value={manifestText} onChange={(event) => setManifestText(event.target.value)} rows={16} /></label>
    <div className={!blocking ? "validation validation--ok" : "validation validation--bad"}>{!blocking ? `Manifest validation: ${validationStatus(validation.results)}.` : validation.results.filter((result) => result.severity === "blocked" || result.severity === "error").map((result) => result.message).join(" | ")}</div>
    {permissions.length > 0 && <section className="submission-permissions"><h3>Permission reasons</h3><p>Requested permissions are declarations, not grants. Admin review and Local Elysia may still deny them.</p>{permissions.map((permission) => <label key={permission}><span>{permission}</span><input disabled={!ready || isSubmitting} value={permissionReasons[permission] ?? ""} onChange={(event) => setPermissionReasons((current) => ({ ...current, [permission]: event.target.value }))} placeholder="Why is this exact permission needed?" /></label>)}</section>}
    {hasElevatedPermission && <label className="checkbox-line"><input disabled={!ready || isSubmitting} type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /><span>I acknowledge that these permissions require additional reviewer and local user scrutiny.</span></label>}
    <label className="checkbox-line"><input disabled={!ready || isSubmitting} type="checkbox" checked={uploadAccepted} onChange={(event) => setUploadAccepted(event.target.checked)} /><span>The manifest and any selected package files will leave my computer and transfer to Elysia Ecobotics / EcoSyneva Commons review infrastructure. I reviewed the selection and removed secrets and private material. Admin review reduces risk but does not guarantee safety.</span></label>
    <p className="validation" aria-live="polite">{submitStatus}</p>
    <div className="button-row"><button type="button" onClick={() => { const message = blocking ? validation.results.map((item) => item.message).join(" | ") : `Manifest validates with ${validationStatus(validation.results)} status.`; setSubmitStatus(message); onMessage(message); }}>Validate manifest</button><Link className="button-link" to="/developer-forge/drafts">Open full Developer Forge</Link><button type="button" className="button-primary" onClick={() => void submitDraft()} disabled={!canSubmit}>{isSubmitting ? "Submitting..." : "Submit private pending review"}</button></div>
    <p className="boundary-note">Submitted does not mean approved. Approved does not mean published. Published does not mean installed, enabled, unrestricted, or guaranteed safe.</p>
  </section>;
}

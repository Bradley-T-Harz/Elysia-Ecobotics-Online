import type { AddonIntakeResult } from "../addons/browserAddonIntake";
import type { BrowserFileInput, BrowserFileView } from "./workspace";
import type { AddonDraft } from "../../pages/The-Developer-Forge/developerForgeApi";
import { manifestLicenseSpdx, manifestPermissionKeys, type ForgeManifest } from "../../pages/The-Developer-Forge/developerForgeValidator";

export function intakeWorkspaceFiles(result: AddonIntakeResult): BrowserFileInput[] {
  return result.files.map(file => ({ path: file.path, bytes: file.bytes, text: file.text, sizeBytes: file.size, provenance: "intake", availability: file.text === undefined ? "binary" : "text" }));
}
const recoveredDraftFields = ["addon_slug", "addon_name", "short_summary", "long_description", "version", "license", "homepage_url", "source_url", "support_url", "category", "tags", "creator_attribution", "publisher_id", "browser_base_metadata_hash", "updated_at"] as const;
export function draftFormMetadata(draft: AddonDraft): Record<string, unknown> {
  return Object.fromEntries(recoveredDraftFields.map(key => [key, draft[key] ?? null]));
}
export function draftWithCurrentManifest(draft: AddonDraft, manifest: ForgeManifest): AddonDraft {
  return { ...draft, manifest_json: manifest, addon_name: manifest.name ?? draft.addon_name, short_summary: manifest.description ?? draft.short_summary,
    version: manifest.version ?? draft.version, license: manifestLicenseSpdx(manifest) || draft.license,
    permission_summary: manifestPermissionKeys(manifest).join(", ") };
}
export function workspaceManifest(files: readonly BrowserFileView[]): string {
  return files.find(file => file.path === "manifest.json")?.text ?? "";
}

/** Recovery carries selection diagnostics, never upload consent or original archive objects. */
export function intakeFormMetadata(result: AddonIntakeResult): Partial<AddonIntakeResult> {
  const repairable = new Set(["missing_manifest", "invalid_manifest_json", "manifest_not_readable", "undeclared_network_behavior", "secret_api_key", "secret_private_key", "private_absolute_path", "excluded_content_requires_repack"]);
  const retained = result.errors.filter(issue => !repairable.has(issue.code));
  return { sourceKind: result.sourceKind, label: result.label.slice(0, 160), selectedFileCount: result.selectedFileCount, selectedTotalBytes: result.selectedTotalBytes,
    deferredFileCount: result.deferredFileCount, deferredTotalBytes: result.deferredTotalBytes,
    errors: retained.length ? [{ code: "recovered_intake_incomplete", message: "The original selection had blocked or incomplete entries. Select a corrected package before transfer." }] : [] };
}

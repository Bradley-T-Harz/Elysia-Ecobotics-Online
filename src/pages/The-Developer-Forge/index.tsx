
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  archiveDraft,
  createDraftFromManifest,
  duplicateDraft,
  isDraftLockedForEditing,
  loadForgeState,
  saveDeveloperProfile,
  saveDraftPermissions,
  submitDraftForReview,
  updateDraft,
  uploadPackageMetadata,
  validateAndSaveDraft
} from "./developerForgeApi";
import type { AddonDraft, DeveloperProfile, DraftPermission, ForgeState } from "./developerForgeApi";
import { blockedPermissionKeys, checkCompatibility, defaultPermissionCatalog, defaultManifestForTemplate, manifestPermissionKeys, staticSafetyScan, validateManifest, validationStatus } from "./developerForgeValidator";
import type { ForgeManifest, ForgeValidationResult, PermissionDefinition } from "./developerForgeValidator";
import { buildManifestPackage, buildTemplatePackage, forgeTemplates, templateStarterText } from "./developerForgeTemplates";
import type { ForgeTemplate } from "./developerForgeTemplates";
import {
  draftWorkspaceFiles,
  ForgeCommandPalette,
  ForgeWorkbenchSurface,
  formatForgeJson,
  formatForgeMarkdown
} from "./ForgeWorkbench";
import type { ForgeCommandAction, ForgeWorkspaceFile } from "./ForgeWorkbench";
import AddonIntakePanel from "../../shared/addons/AddonIntakePanel";
import type { AddonIntakeFile, AddonIntakeResult } from "../../shared/addons/browserAddonIntake";

const docSections = {
  overview: {
    title: "Developer Forge Docs",
    body: ["Developer Forge prepares add-ons for review. It does not install, enable, execute, or control local Elysia.", "Use these docs to understand manifests, permissions, package format, review, compatibility, revocation, and local install authority."]
  },
  manifest: {
    title: "Manifest Reference",
    body: ["A manifest is a declaration, not a permission grant. It tells Marketplace reviewers and local Elysia what the add-on claims to do.", "Required fields include schema_version, addon_id, name, version, description, author, license, permissions, compatibility, runtime, and security.", "Use lowercase addon_id values such as developer.example-addon. Avoid secrets, local paths, authority claims, localhost-only URLs, and undeclared permissions."]
  },
  workbench: {
    title: "Workbench Guide",
    body: ["The Forge workbench is an inert add-on studio for virtual draft files, manifest editing, Markdown preview, formatting, static scan review, Marketplace preview, and immutable snapshot submission.", "Monaco syntax highlighting, Ajv validation, semver checks, sanitized Markdown preview, Prettier formatting, and command-palette actions are editing aids only. They do not run package code, install dependencies, open a raw shell, or control local Elysia."]
  },
  permissions: {
    title: "Permissions Guide",
    body: ["Developers choose from a controlled permission catalog. Users and local Elysia can still deny permissions during local install review.", "Low-risk permissions cover public metadata and bundled assets. Medium and high-risk permissions require clear reasons and reviewer attention.", "Blocked permissions include vault access, credential access, private memory access, silent shell execution, read all files, write arbitrary files, silent network access, and silent install."]
  },
  security: {
    title: "Security Boundary",
    body: ["The public website never runs uploaded add-on code, package scripts, build hooks, dependency hooks, or shell commands.", "Do not upload secrets, credentials, private local Elysia memory, vault data, local logs, private repositories, or private customer data.", "Static scan catches obvious risks only. Local Elysia remains the final installer and permission authority."]
  },
  templates: {
    title: "Template Guide",
    body: ["Templates create safe starter manifests and copyable starter files. They do not create local folders or execute anything.", "Start with metadata-only or static templates before requesting high-risk local worker permissions."]
  },
  compatibility: {
    title: "Compatibility Guide",
    body: ["Developer Forge checks manifest schema, add-on API version, runtime kind, permissions, network declarations, and file access declarations.", "Website compatibility is advisory. Local Elysia validates again before any local install or enable action."]
  }
};

function pathParts(pathname: string) {
  return pathname.replace(/^\/developer-forge\/?/, "").split("/").filter(Boolean);
}

function emptyProfile(): DeveloperProfile {
  return { developer_slug: "", display_name: "", bio: "", website_url: "", github_url: "", support_url: "", contact_email: "", status: "requested" };
}

function statusClass(value?: string | null) {
  return `forge-status forge-status--${(value || "unknown").replace(/[^a-z0-9_-]/gi, "_")}`;
}

function MessageStack({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>;
}

function ForgeNav({ current }: { current: string }) {
  const items = [
    ["/developer-forge", "Forge"], ["/developer-forge/dashboard", "Dashboard"], ["/developer-forge/profile", "Profile"], ["/developer-forge/drafts", "Drafts"], ["/developer-forge/drafts/new", "New Draft"], ["/developer-forge/submissions", "Submissions"], ["/developer-forge/docs", "Docs"]
  ];
  return <nav className="forge-nav" aria-label="Developer Forge sections">{items.map(([href, label]) => <Link className={current === href ? "active" : ""} to={href} key={href}>{label}</Link>)}</nav>;
}

function ResultList({ results }: { results: ForgeValidationResult[] }) {
  if (!results.length) return <p className="forge-empty">No validation results yet. Run validation to check the manifest and static metadata.</p>;
  const grouped = new Map<string, { severity: ForgeValidationResult["severity"]; code: string; message: string; fix?: string; count: number; examples: string[] }>();
  for (const result of results) {
    const key = `${result.severity}:${result.code}`;
    const current = grouped.get(key) ?? { severity: result.severity, code: result.code, message: result.message, fix: result.fix_suggestion, count: 0, examples: [] };
    current.count += 1;
    if (result.field_path && current.examples.length < 10 && !current.examples.includes(result.field_path)) current.examples.push(result.field_path);
    grouped.set(key, current);
  }
  const groups = [...grouped.values()];
  const visibleGroups = groups.slice(0, 40);
  const blockingCount = groups.filter((group) => group.severity === "blocked" || group.severity === "error").length;
  const reviewCount = groups.filter((group) => group.severity === "needs_reviewer").length;
  const warningCount = groups.filter((group) => group.severity === "warning").length;
  return <div className="forge-validation-summary" aria-label="Validation and static scan summary"><p><strong>Grouped findings:</strong> {blockingCount} blocking · {reviewCount} needs-review · {warningCount} warning group{warningCount === 1 ? "" : "s"}.</p><div className="forge-result-list forge-result-list--bounded">{visibleGroups.map((group) => <details className={`forge-result forge-result--${group.severity}`} key={`${group.severity}-${group.code}`}>
    <summary><strong>{group.severity.toUpperCase()} · {group.code}</strong><span>{group.count}</span></summary>
    <p>{group.message}</p>
    {group.examples.length > 0 && <ul>{group.examples.map((example) => <li key={example}><code>{example}</code></li>)}</ul>}
    {group.count > group.examples.length && <p>Showing {group.examples.length} of {group.count} examples.</p>}
    {group.fix && <p>{group.fix}</p>}
  </details>)}{groups.length > visibleGroups.length && <p>Showing the first {visibleGroups.length} of {groups.length} issue groups. Export or narrow the intake to inspect deeper.</p>}</div></div>;
}

function PermissionPill({ permission }: { permission: PermissionDefinition }) {
  return <span className={`forge-permission-pill forge-risk-${permission.risk_level}`}>{permission.permission_key} · {permission.risk_level}</span>;
}

function intakeLanguage(file: AddonIntakeFile): ForgeWorkspaceFile["language"] {
  if (/\.json$/i.test(file.path)) return "json";
  if (/\.md$/i.test(file.path)) return "markdown";
  if (/\.tsx?$/i.test(file.path)) return "typescript";
  if (/\.(jsx?|mjs|cjs)$/i.test(file.path)) return "javascript";
  if (/\.css$/i.test(file.path)) return "css";
  if (/\.html?$/i.test(file.path)) return "html";
  if (/\.py$/i.test(file.path)) return "python";
  if (/\.rs$/i.test(file.path)) return "rust";
  if (/\.ya?ml$/i.test(file.path)) return "yaml";
  if (/\.toml$/i.test(file.path)) return "toml";
  return "text";
}

function workspaceFilesFromIntake(result: AddonIntakeResult): ForgeWorkspaceFile[] {
  return result.files.map((file) => ({
    path: file.path,
    label: file.path,
    language: intakeLanguage(file),
    value: file.text ?? `[Binary or oversized file: ${file.path}; ${file.size} bytes. Static metadata only.]`,
    locked: file.text === undefined,
    imported: true
  }));
}

function DeveloperProfilePanel({ state, onSaved }: { state: ForgeState | null; onSaved: (messages: string[]) => void }) {
  const [form, setForm] = useState<DeveloperProfile>(state?.profile ?? emptyProfile());
  useEffect(() => { setForm(state?.profile ?? emptyProfile()); }, [state?.profile]);
  async function save(status: "draft" | "requested") {
    const result = await saveDeveloperProfile({ ...form, status });
    if (result.profile) setForm(result.profile);
    onSaved(result.warnings.length ? result.warnings : [status === "requested" ? "Developer profile saved and marked requested for review." : "Developer profile draft saved."]);
  }
  return <section className="section-card forge-profile-panel"><p className="eyebrow">Developer Profile</p><h2>Create or update developer identity</h2><p className="boundary-note">A developer profile lets you submit add-ons for review. It does not grant publish authority, reviewer authority, trusted status, or local Elysia access.</p><div className="forge-form-grid"><label><span>Developer display name</span><input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></label><label><span>Developer slug</span><input value={form.developer_slug} onChange={(event) => setForm({ ...form, developer_slug: event.target.value })} /></label><label><span>Website URL</span><input value={form.website_url || ""} onChange={(event) => setForm({ ...form, website_url: event.target.value })} /></label><label><span>GitHub URL</span><input value={form.github_url || ""} onChange={(event) => setForm({ ...form, github_url: event.target.value })} /></label><label><span>Support URL</span><input value={form.support_url || ""} onChange={(event) => setForm({ ...form, support_url: event.target.value })} /></label><label><span>Contact email, private</span><input value={form.contact_email || ""} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} /></label><label className="wide-field"><span>Short public bio</span><textarea rows={4} value={form.bio || ""} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label></div><div className="button-row"><button type="button" onClick={() => void save("draft")}>Save profile draft</button><button className="button-primary" type="button" onClick={() => void save("requested")}>Request developer profile review</button></div><p><span className={statusClass(form.status)}>{form.status || "draft"}</span></p></section>;
}

function DraftCard({ draft, active, onDuplicate, onArchive }: { draft: AddonDraft; active?: boolean; onDuplicate: () => void; onArchive: () => void }) {
  return <article className={`forge-draft-card${active ? " active" : ""}`}><div><h3>{draft.addon_name || "Untitled draft"}</h3><p>{draft.short_summary || "No summary yet."}</p></div><div className="forge-draft-meta"><span>{draft.version || "0.1.0"}</span><span>{draft.validation_status || "not_validated"}</span><span>{draft.review_status || "not_submitted"}</span></div><div className="button-row"><Link className="button-link button-link--primary" to={`/developer-forge/drafts/${draft.id}`}>Open workspace</Link><button type="button" onClick={onDuplicate}>Duplicate</button><button type="button" onClick={onArchive}>Archive</button></div></article>;
}

function DraftList({ state, selectedId, onChanged }: { state: ForgeState | null; selectedId?: string; onChanged: (messages: string[]) => void }) {
  async function duplicate(draft: AddonDraft) {
    const result = await duplicateDraft(draft);
    onChanged(result.warnings.length ? result.warnings : [result.draft ? "Draft duplicated." : "Draft duplication did not complete."]);
  }
  async function archive(id: string) {
    onChanged(await archiveDraft(id));
  }
  return <section className="section-card"><p className="eyebrow">Drafts</p><h2>{state?.drafts.length ?? 0} add-on draft{state?.drafts.length === 1 ? "" : "s"}</h2>{!state?.drafts.length && <p className="forge-empty">No add-on drafts yet. Start from a safe template or create a blank manifest.</p>}<div className="forge-draft-grid">{state?.drafts.map((draft) => <DraftCard key={draft.id} draft={draft} active={draft.id === selectedId} onDuplicate={() => void duplicate(draft)} onArchive={() => void archive(draft.id)} />)}</div></section>;
}

function TemplateGallery({ profileId, onCreated }: { profileId?: string | null; onCreated: (messages: string[]) => void }) {
  async function create(manifest: ForgeManifest) {
    const result = await createDraftFromManifest(manifest, profileId);
    onCreated(result.warnings.length ? result.warnings : [result.draft ? "Draft created from template." : "Draft was not created."]);
  }
  async function copyStarterFiles(item: ForgeTemplate) {
    await navigator.clipboard?.writeText(templateStarterText(item));
    onCreated([`${item.name} starter files copied. This is inert text only; nothing was executed.`]);
  }
  async function exportStarterPackage(item: ForgeTemplate) {
    const blob = await buildTemplatePackage(item);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.id}.elysia-addon`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onCreated([`${item.name} inert .elysia-addon starter exported. Local Elysia must validate before any install.`]);
  }
  return <section className="section-card forge-templates" id="forge-templates"><p className="eyebrow">Templates</p><h2>Safe starter add-ons</h2><p>Templates generate manifests and copyable starter files. They do not create local folders or run code.</p><div className="feature-grid feature-grid--three">{forgeTemplates.map((item) => <article className="feature-card" key={item.id}><p className="eyebrow">{item.risk} risk</p><h3>{item.name}</h3><p>{item.summary}</p><div className="commons-badge-row">{item.fileList.slice(0, 4).map((file) => <span key={file}>{file}</span>)}</div><div className="button-row"><button type="button" onClick={() => void create(item.manifest)}>Create draft</button><button type="button" onClick={() => void copyStarterFiles(item)}>Copy starter files</button><button type="button" onClick={() => void exportStarterPackage(item)}>Export .elysia-addon</button></div></article>)}</div></section>;
}

function ForgeIntakeMap({ draftId }: { draftId?: string }) {
  const workspace = draftId ? `/developer-forge/drafts/${draftId}` : "/developer-forge/drafts/new";
  const workspaceAction = draftId ? "Open existing workspace" : "Create or open a draft first";
  const paths = [
    { title: "Create from template", detail: "Start with an inert manifest, docs, license, permissions, and placeholder source tree.", boundary: "Local draft", to: "/developer-forge/drafts/new#forge-templates", action: "Choose a template" },
    { title: "Import .elysia-addon", detail: "Inspect a complete Elysia package and open its selected files in the workbench.", boundary: "Browser memory", to: `${workspace}#forge-package`, action: workspaceAction },
    { title: "Import ZIP / source bundle", detail: "Inspect source, tests, schemas, docs, assets, and dependency declarations.", boundary: "Browser memory", to: `${workspace}#forge-package`, action: workspaceAction },
    { title: "Import folder / repository", detail: "Choose a local directory explicitly; .git metadata and unselected files stay outside intake.", boundary: "Browser memory", to: `${workspace}#forge-package`, action: workspaceAction },
    { title: "Import manifest.json", detail: "Load or edit the package contract without pretending the manifest is the whole add-on.", boundary: "Local editing", to: `${workspace}#forge-package`, action: workspaceAction },
    { title: "Use Git URL metadata", detail: "Record a review reference only. Developer Forge does not fetch, clone, or authenticate.", boundary: "Metadata only", to: `${workspace}#forge-overview`, action: workspaceAction },
    { title: "Export inert .elysia-addon", detail: "Package the current draft locally. Export does not install, execute, approve, or publish it.", boundary: "Local download", to: `${workspace}#forge-package`, action: workspaceAction },
    { title: "Prepare Marketplace review", detail: "Review validation, permissions, and transfer disclosure before creating a private snapshot.", boundary: "Explicit remote step", to: `${workspace}#forge-submit`, action: workspaceAction }
  ];
  return <section className="section-card forge-intake-map" aria-labelledby="forge-intake-map-heading">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Choose your build path</p><h2 id="forge-intake-map-heading">Create, import, package, or prepare review</h2></div><p>Every path is explicit. Local selection is separate from remote Marketplace submission.</p></div>
    <p className="addon-package-reality">An add-on may contain source code, schemas, documentation, assets, tests, configuration, and dependency metadata. <code>manifest.json</code> declares identity, permissions, compatibility, and boundaries; it is not the whole add-on.</p>
    <div className="forge-intake-map__grid">{paths.map((item) => <article className="forge-intake-map__card" key={item.title}><span className="forge-status">{item.boundary}</span><h3>{item.title}</h3><p>{item.detail}</p><Link to={item.to}>{item.action}</Link></article>)}</div>
    <p className="boundary-note">Imported files remain local to browser memory until an explicit private-transfer acknowledgement. The website never executes package code. Local Elysia performs final validation before install or enablement.</p>
  </section>;
}

function DraftWorkspace({ draft, catalog, onChanged }: { draft: AddonDraft; catalog: PermissionDefinition[]; onChanged: (messages: string[]) => void }) {
  const [working, setWorking] = useState<AddonDraft>(draft);
  const [manifestText, setManifestText] = useState(() => JSON.stringify(draft.manifest_json, null, 2));
  const [results, setResults] = useState<ForgeValidationResult[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [packageMessage, setPackageMessage] = useState("");
  const [intake, setIntake] = useState<AddonIntakeResult | null>(null);
  const [transferAccepted, setTransferAccepted] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState("manifest.json");
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<ForgeWorkspaceFile[]>(() => draftWorkspaceFiles(draft, JSON.stringify(draft.manifest_json, null, 2)));
  useEffect(() => {
    const nextManifestText = JSON.stringify(draft.manifest_json, null, 2);
    setWorking(draft);
    setManifestText(nextManifestText);
    setWorkspaceFiles(draftWorkspaceFiles(draft, nextManifestText));
    setActiveFilePath("manifest.json");
    setResults([]);
    setIntake(null);
    setTransferAccepted(false);
  }, [draft.id]);
  useLayoutEffect(() => {
    if (!pendingNavigationTarget) return;
    const target = document.getElementById(pendingNavigationTarget);
    if (!target) return;
    const heading = target.matches("h1, h2, h3, h4, h5, h6")
      ? target as HTMLElement
      : target.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6") ?? target;
    if (!heading.matches("[tabindex]")) {
      heading.tabIndex = -1;
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    heading.focus({ preventScroll: true });
    setPendingNavigationTarget(null);
  }, [activeFilePath, pendingNavigationTarget]);
  const parsed = useMemo(() => validateManifest(manifestText, catalog), [manifestText, catalog]);
  const compatibility = useMemo(() => checkCompatibility(parsed.manifest), [parsed.manifest]);
  const selectedPermissions = new Set(manifestPermissionKeys(parsed.manifest));
  if (parsed.manifest?.schema_version === "1.1") parsed.manifest.permissions = [...selectedPermissions];
  const readOnly = isDraftLockedForEditing(working);

  function syncWorkspaceFile(path: string, value: string) {
    setWorkspaceFiles((current) => current.map((file) => file.path === path ? { ...file, value } : file));
  }

  function updateManifestFromDraft(next: Partial<AddonDraft>) {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it for a revision before editing."]);
    const merged = { ...working, ...next };
    const manifest = { ...merged.manifest_json, name: merged.addon_name, description: merged.short_summary, version: merged.version, license: merged.license };
    merged.manifest_json = manifest;
    setWorking(merged);
    const nextText = JSON.stringify(manifest, null, 2);
    setManifestText(nextText);
    syncWorkspaceFile("manifest.json", nextText);
  }
  function togglePermission(key: string) {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it for a revision before editing permissions."]);
    const current = parsed.manifest ?? working.manifest_json;
    const permissions = new Set(manifestPermissionKeys(current));
    permissions.has(key) ? permissions.delete(key) : permissions.add(key);
    const nextManifest = { ...current, permissions: [...permissions] };
    setWorking({ ...working, manifest_json: nextManifest, permission_summary: [...permissions].join(", ") });
    const nextText = JSON.stringify(nextManifest, null, 2);
    setManifestText(nextText);
    syncWorkspaceFile("manifest.json", nextText);
  }
  function updateWorkspaceFile(path: string, value: string) {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it for a revision before editing files."]);
    syncWorkspaceFile(path, value);
    if (path === "manifest.json") setManifestText(value);
    if (path === "README.md") setWorking((current) => ({ ...current, long_description: value }));
    if (path === "LICENSE") setWorking((current) => ({ ...current, license: value.split(/\r?\n/)[0]?.slice(0, 80) || current.license }));
  }
  async function save() {
    if (!parsed.manifest) return onChanged(["Fix JSON before saving this manifest."]);
    const next = { ...working, manifest_json: parsed.manifest };
    setWorking(next);
    const warnings = await updateDraft(next);
    onChanged(warnings.length ? warnings : ["Draft saved."]);
  }
  async function validate() {
    const combined = [...parsed.results, ...staticSafetyScan({ manifestText }).filter((item) => item.code !== "static_scan_initial_pass")];
    setResults(combined);
    const warnings = await validateAndSaveDraft({ ...working, manifest_json: parsed.manifest ?? working.manifest_json }, catalog);
    onChanged(warnings.warnings.length ? warnings.warnings : [`Validation complete: ${validationStatus(combined)}.`]);
  }
  async function formatManifest() {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it for a revision before formatting."]);
    try {
      const formatted = await formatForgeJson(manifestText);
      setManifestText(formatted);
      syncWorkspaceFile("manifest.json", formatted);
      onChanged(["Manifest formatted."]);
    } catch {
      onChanged(["Manifest formatting failed. Fix JSON syntax first."]);
    }
  }
  async function formatActiveFile() {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it for a revision before formatting."]);
    const active = workspaceFiles.find((file) => file.path === activeFilePath);
    if (!active) return;
    try {
      const formatted = active.language === "json" ? await formatForgeJson(active.value) : active.language === "markdown" ? await formatForgeMarkdown(active.value) : active.value;
      updateWorkspaceFile(active.path, formatted);
      onChanged([`${active.label} formatted.`]);
    } catch {
      onChanged([`${active.label} could not be formatted. Check syntax first.`]);
    }
  }
  async function copyActiveFile() {
    const active = workspaceFiles.find((file) => file.path === activeFilePath);
    if (!active) return;
    await navigator.clipboard?.writeText(active.value);
    onChanged([`${active.label} copied.`]);
  }
  function acceptIntake(result: AddonIntakeResult) {
    if (readOnly) return onChanged(["This submitted draft is locked. Duplicate it before importing source files."]);
    setIntake(result);
    setTransferAccepted(false);
    const imported = workspaceFilesFromIntake(result);
    setWorkspaceFiles((current) => {
      const importedPaths = new Set(imported.map((file) => file.path));
      return [...imported, ...current.filter((file) => !importedPaths.has(file.path))];
    });
    if (result.manifestText) {
      setManifestText(result.manifestText);
      setActiveFilePath(result.files.find((file) => file.kind === "manifest")?.path ?? "manifest.json");
    }
    const intakeResults: ForgeValidationResult[] = [
      ...result.errors.map((item) => ({ severity: item.code === "missing_manifest" ? "needs_reviewer" as const : "blocked" as const, code: `intake_${item.code}`, message: item.message, field_path: item.path })),
      ...result.warnings.map((item) => ({ severity: "warning" as const, code: `intake_${item.code}`, message: item.message, field_path: item.path }))
    ];
    setResults(intakeResults);
    setPackageMessage(`${result.selectedFileCount} files selected locally; ${result.fileCount} included in the bounded scan and ${result.excludedFileCount} generated/vendor files excluded by default. No remote transfer occurred.`);
  }
  async function transferPackage() {
    const file = intake?.packageFile;
    if (!file) return onChanged(["Select a package, ZIP, manifest, or folder before private transfer."]);
    if (intake.errors.length) return onChanged(["Fix blocking intake findings before private transfer."]);
    if (!transferAccepted) return onChanged(["Confirm the remote upload disclosure before transferring selected files."]);
    const result = await uploadPackageMetadata(working, file);
    setResults((current) => [...result.scan, ...current]);
    setPackageMessage(result.packageRow?.sha256 ? `SHA-256 ${result.packageRow.sha256}` : "Package scan completed locally.");
    onChanged(result.warnings.length ? result.warnings : ["Selected files transferred to private review storage. No public URL or public listing was created."]);
  }
  async function exportCurrentDraftPackage() {
    let manifest = parsed.manifest ?? working.manifest_json;
    try { manifest = JSON.parse(manifestText) as ForgeManifest; } catch { /* validation already reports malformed JSON */ }
    const readme = workspaceFiles.find((file) => file.path === "README.md")?.value ?? `# ${working.addon_name}\n\n${working.long_description || working.short_summary}\n\nThis is an inert Developer Forge export. The public website did not execute, install, build, or approve this add-on.`;
    const blob = await buildManifestPackage({ id: working.addon_slug || "developer-forge-draft", name: working.addon_name || "Developer Forge Draft", manifest, readme, license: working.license, changelog: "# Changelog\n\n## Draft\n- Exported from Developer Forge as inert package materials." });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${working.addon_slug || "developer-forge-draft"}.elysia-addon`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onChanged(["Inert .elysia-addon archive exported. Local Elysia must validate before any install."]);
  }
  async function submit() {
    onChanged(await submitDraftForReview({ ...working, manifest_json: parsed.manifest ?? working.manifest_json }, termsAccepted, catalog));
  }
  async function createRevisionCopy() {
    const result = await duplicateDraft(working);
    onChanged(result.warnings.length ? result.warnings : [result.draft ? "Revision draft created as an editable duplicate. Submit it when changes are ready." : "Revision draft was not created."]);
  }

  const timeline = [
    ["Draft created", working.created_at ? "complete" : "pending"],
    ["Manifest validated", working.validation_status || "not_validated"],
    ["Permissions completed", selectedPermissions.size ? "declared" : "not_declared"],
    ["Package prepared", working.package_status || "metadata_not_prepared"],
    ["Submitted", working.submission_status || "draft"],
    ["Review", working.review_status || "not_submitted"],
    ["Publication", working.review_status === "published" ? "published" : "not published"],
    ["Revocation", working.review_status === "revoked" ? "revoked" : "not applicable"]
  ];
  function openWorkspaceTarget(targetId: string, filePath?: string) {
    if (filePath) setActiveFilePath(filePath);
    setPendingNavigationTarget(targetId);
  }
  const commands: ForgeCommandAction[] = [
    { id: "open-overview", group: "Navigate", label: "Open overview", run: () => openWorkspaceTarget("forge-overview") },
    { id: "open-manifest", group: "Navigate", label: "Open manifest", run: () => openWorkspaceTarget("forge-manifest", "manifest.json") },
    { id: "open-readme", group: "Navigate", label: "Open README preview", run: () => openWorkspaceTarget("forge-readme-preview", "README.md") },
    { id: "validate-manifest", group: "Validate", label: "Validate manifest", run: () => void validate() },
    { id: "format-manifest", group: "Edit", label: "Format manifest JSON", disabled: readOnly, run: () => void formatManifest() },
    { id: "format-active", group: "Edit", label: "Format active file", disabled: readOnly, run: () => void formatActiveFile() },
    { id: "copy-active", group: "Edit", label: "Copy active file", run: () => void copyActiveFile() },
    { id: "static-scan", group: "Validate", label: "Run static scan", run: () => void validate() },
    { id: "export-package", group: "Package", label: "Export inert .elysia-addon", run: () => void exportCurrentDraftPackage() },
    { id: "submit-review", group: "Review", label: "Submit immutable snapshot for review", disabled: readOnly, run: () => void submit() },
    { id: "revision-draft", group: "Review", label: "Duplicate draft for revision", run: () => void createRevisionCopy() }
  ];
  return <section className="section-card forge-workspace"><div className="forge-workspace-top"><div><p className="eyebrow">Draft workspace</p><h2>{working.addon_name || "Untitled add-on"}</h2><p>The Forge validates and prepares this add-on. Marketplace reviewers decide publication. Local Elysia decides installation.</p></div><div className="forge-workspace-actions"><span className={statusClass(working.review_status)}>{working.review_status || "not_submitted"}</span><ForgeCommandPalette commands={commands} /></div></div>{readOnly && <p className="boundary-note">This submitted draft is locked to protect the review snapshot. Use Duplicate draft for revision before changing files, permissions, packages, or validation data.</p>}<div className="forge-workspace-grid"><aside className="forge-left-rail"><a href="#forge-workbench">Workbench</a><a href="#forge-overview">Overview</a><a href="#forge-manifest">Manifest</a><a href="#forge-permissions">Permissions</a><a href="#forge-package">Package</a><a href="#forge-validation">Validation</a><a href="#forge-preview">Preview</a><a href="#forge-submit">Submit</a><a href="#forge-review-status">Review Status</a></aside><div className="forge-main-panel"><section id="forge-workbench" className="forge-editor-panel"><h3>Forge workbench</h3><p className="boundary-note">Create virtual files or explicitly import a local folder/repository, ZIP source bundle, manifest, or .elysia-addon. Imported files stay in browser memory until you separately approve private transfer. This is not a terminal and does not execute package code.</p><ForgeWorkbenchSurface files={workspaceFiles} activePath={activeFilePath} diagnostics={results.length ? results : parsed.results} repositoryStats={intake ? { selectedFileCount: intake.selectedFileCount, includedFileCount: intake.fileCount, excludedFileCount: intake.excludedFileCount } : undefined} readOnly={readOnly} onSelect={setActiveFilePath} onChange={updateWorkspaceFile} /></section><section id="forge-overview" className="forge-editor-panel"><h3>Overview</h3><div className="forge-form-grid"><label><span>Name</span><input disabled={readOnly} value={working.addon_name} onChange={(event) => updateManifestFromDraft({ addon_name: event.target.value })} /></label><label><span>Slug</span><input disabled={readOnly} value={working.addon_slug} onChange={(event) => setWorking({ ...working, addon_slug: event.target.value })} /></label><label><span>Version</span><input disabled={readOnly} value={working.version} onChange={(event) => updateManifestFromDraft({ version: event.target.value })} /></label><label><span>License</span><input disabled={readOnly} value={working.license} onChange={(event) => updateManifestFromDraft({ license: event.target.value })} /></label><label><span>Category</span><input disabled={readOnly} value={working.category || ""} onChange={(event) => setWorking({ ...working, category: event.target.value })} /></label><label><span>Tags</span><input disabled={readOnly} value={(working.tags ?? []).join(", ")} onChange={(event) => setWorking({ ...working, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label><label className="wide-field"><span>Summary</span><textarea disabled={readOnly} rows={3} value={working.short_summary} onChange={(event) => updateManifestFromDraft({ short_summary: event.target.value })} /></label><label><span>Homepage URL</span><input disabled={readOnly} value={working.homepage_url || ""} onChange={(event) => setWorking({ ...working, homepage_url: event.target.value })} /></label><label><span>Git repository URL (metadata only)</span><input disabled={readOnly} value={working.source_url || ""} onChange={(event) => setWorking({ ...working, source_url: event.target.value })} /></label><label><span>Support URL</span><input disabled={readOnly} value={working.support_url || ""} onChange={(event) => setWorking({ ...working, support_url: event.target.value })} /></label></div><p className="boundary-note">A Git URL is review metadata only. Developer Forge does not fetch, clone, or inspect the remote repository.</p><div className="button-row"><button className="button-primary" type="button" disabled={readOnly} onClick={() => void save()}>Save draft</button><button type="button" onClick={() => void createRevisionCopy()}>Duplicate draft for revision</button></div></section><section id="forge-manifest" className="forge-editor-panel"><h3>Manifest editor</h3><p className="boundary-note">The active manifest editor lives in the Forge workbench above. Monaco provides syntax highlighting when available; the text fallback remains inert.</p><div className="button-row"><button type="button" onClick={() => { navigator.clipboard?.writeText(manifestText); onChanged(["Manifest copied."]); }}>Copy manifest</button><button type="button" disabled={readOnly} onClick={() => void formatManifest()}>Format manifest</button><button type="button" onClick={() => void validate()}>Validate manifest</button></div></section><section id="forge-permissions" className="forge-editor-panel"><h3>Permission designer</h3><p className="boundary-note">Permissions are declarations, not grants. Local Elysia can deny them during install review.</p><div className="forge-permission-grid">{catalog.map((permission) => <article className={`forge-permission-card forge-risk-${permission.risk_level}`} key={permission.permission_key}><div><PermissionPill permission={permission} /><h4>{permission.title}</h4><p>{permission.description}</p>{permission.allowed_scope_format && <p>Scope: {permission.allowed_scope_format}</p>}</div>{permission.risk_level === "blocked" ? <strong>Blocked</strong> : <label className="checkbox-line"><input type="checkbox" disabled={readOnly} checked={selectedPermissions.has(permission.permission_key)} onChange={() => togglePermission(permission.permission_key)} /><span>Select</span></label>}</article>)}</div><button type="button" disabled={readOnly} onClick={() => void saveDraftPermissions(working.id, [...selectedPermissions].map((permission_key) => ({ permission_key, reason: `${permission_key} selected with Developer Forge permission designer; local Elysia can still deny it.`, risk_acknowledged: catalog.find((permission) => permission.permission_key === permission_key)?.risk_level !== "low" })) as DraftPermission[]).then(onChanged)}>Save permissions</button></section><section id="forge-package" className="forge-editor-panel"><h3>Package and repository intake</h3><p className="boundary-note">Import is local/in-browser. Private transfer is a separate action. Neither action executes code, builds dependencies, fetches a Git URL, or creates a public package URL.</p><AddonIntakePanel disabled={readOnly} result={intake} onResult={acceptIntake} onMessage={(message) => onChanged([message])} />{intake?.packageFile && <><label className="checkbox-line"><input type="checkbox" disabled={readOnly || Boolean(intake.errors.length)} checked={transferAccepted} onChange={(event) => setTransferAccepted(event.target.checked)} /><span>The files I selected will leave my computer and transfer to Elysia Ecobotics / EcoSyneva Commons private review infrastructure. I reviewed the selection and removed secrets or private material.</span></label><div className="button-row"><button type="button" disabled={readOnly || !transferAccepted || Boolean(intake.errors.length)} onClick={() => void transferPackage()}>Transfer selected package privately</button><button type="button" onClick={() => void exportCurrentDraftPackage()}>Export current inert .elysia-addon</button></div></>}{!intake?.packageFile && <div className="button-row"><button type="button" onClick={() => void exportCurrentDraftPackage()}>Export current inert .elysia-addon</button></div>}{packageMessage && <p className="message">{packageMessage}</p>}</section><section id="forge-validation" className="forge-editor-panel forge-validation-panel"><h3>Validation and static scan</h3><ResultList results={results.length ? results : parsed.results} /><div className="mini-facts"><div><dt>Compatibility</dt><dd>{compatibility.status}</dd></div><div><dt>Warnings</dt><dd>{compatibility.warnings.length}</dd></div><div><dt>Errors</dt><dd>{compatibility.errors.length}</dd></div></div><p className="boundary-note">Compatibility is advisory. Static scan is evidence, not proof. Local Elysia remains final authority before local install or enablement.</p></section><section id="forge-preview" className="forge-editor-panel"><h3>Marketplace preview</h3><article className="addon-card"><div className="addon-card__topline"><strong>{working.addon_name}</strong><span>{working.version}</span></div><p>{working.short_summary}</p><div className="mini-facts"><div><dt>Category</dt><dd>{working.category || parsed.manifest?.runtime?.kind || "uncategorized"}</dd></div><div><dt>License</dt><dd>{working.license || parsed.manifest?.license || "missing"}</dd></div><div><dt>Compatibility</dt><dd>{compatibility.status}</dd></div><div><dt>Review</dt><dd>{working.review_status || "not submitted"}</dd></div></div><div className="commons-badge-row">{[...(parsed.manifest?.permissions ?? [])].map((permission) => <span key={permission}>{permission}</span>)}</div><p className="boundary-note">Preview only. Approved Marketplace publication requires reviewer action. Admin review reduces risk but does not guarantee safety. Local Elysia can still deny installation and permissions.</p></article></section><section id="forge-submit" className="forge-editor-panel"><h3>Submit for Marketplace review</h3><ul><li>Manifest must have no blocking errors.</li><li>Submission creates an immutable pending-review snapshot; it never public-lists automatically.</li><li>Permissions need reasons and review visibility.</li><li>Packages stay private unless approved and published later.</li><li>Developer profiles do not grant automatic publication authority.</li><li>Local-worker and connector drafts need package metadata/static scan before submission.</li></ul><label className="checkbox-line"><input type="checkbox" disabled={readOnly} checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I understand selected package files leave my computer when privately transferred, Marketplace review is required, admin review does not guarantee safety, and the website will not install this add-on.</span></label><button className="button-primary" type="button" disabled={readOnly || !termsAccepted} onClick={() => void submit()}>Submit immutable snapshot for review</button></section><section id="forge-review-status" className="forge-editor-panel"><h3>Review Status</h3><div className="forge-result-list">{timeline.map(([label, value]) => <article className="forge-result forge-result--info" key={label}><strong>{label}</strong><p>{value}</p></article>)}</div><p className="boundary-note">Published and revoked states are reviewer/Marketplace outcomes. Developers cannot approve, publish, revoke, or trust-label their own submissions.</p></section></div></div></section>;
}

function DocsPage({ slug }: { slug: string }) {
  const doc = docSections[slug as keyof typeof docSections] ?? docSections.overview;
  return <section className="section-card forge-docs"><p className="eyebrow">Developer Forge docs</p><h2>{doc.title}</h2>{doc.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="forge-doc-links"><Link to="/developer-forge/docs/workbench">Workbench</Link><Link to="/developer-forge/docs/manifest">Manifest</Link><Link to="/developer-forge/docs/permissions">Permissions</Link><Link to="/developer-forge/docs/security">Security</Link><Link to="/developer-forge/docs/templates">Templates</Link><Link to="/developer-forge/docs/compatibility">Compatibility</Link></div></section>;
}

export default function DeveloperForgePage() {
  const location = useLocation();
  const parts = pathParts(location.pathname);
  const [state, setState] = useState<ForgeState | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [blankName, setBlankName] = useState("Example Add-on");
  const route = location.pathname;
  const draftId = parts[0] === "drafts" && parts[1] && parts[1] !== "new" ? parts[1] : undefined;
  const selectedDraft = draftId ? state?.drafts.find((draft) => draft.id === draftId) : state?.drafts[0];
  const docSlug = parts[0] === "docs" ? parts[1] || "overview" : "overview";

  const refresh = async () => {
    const next = await loadForgeState();
    setState(next);
    if (import.meta.env.DEV && next.warnings.length) console.warn("[Developer Forge]", next.warnings);
  };
  useEffect(() => { void refresh(); }, []);
  const onChanged = (nextMessages: string[]) => { setMessages((current) => [...nextMessages, ...current].filter(Boolean).slice(0, 8)); void refresh(); };

  async function createBlank() {
    const manifest = defaultManifestForTemplate(`developer.${blankName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, blankName);
    const result = await createDraftFromManifest(manifest, state?.profile?.id ?? null);
    onChanged(result.warnings.length ? result.warnings : [result.draft ? "Blank draft created." : "Blank draft was not created."]);
  }

  const workflowDraftId = parts[0] === "drafts" && parts[1] === "new" ? undefined : selectedDraft?.id;
  return <div className="page-stack developer-forge-page"><PageHero eyebrow="Builder workshop" title="The Developer Forge" brandMark="standard"><p>A safe add-on development portal for manifests, permission design, package preparation, static checks, Marketplace submission, and review tracking.</p><p>Developer Forge prepares add-ons. Marketplace reviews and publishes. Local Elysia remains the final installer and permission authority.</p></PageHero><ForgeNav current={route} /><MessageStack messages={messages} /><section className="commons-doctrine-grid"><WarningCallout title="No code execution"><p>The website never runs uploaded add-on code, package scripts, dependency hooks, or shell commands.</p></WarningCallout><WarningCallout title="No silent install"><p>Forge can prepare a submission. It cannot install, enable, disable, or control local Elysia.</p></WarningCallout><WarningCallout title="Private data boundary"><p>Do not upload credentials, vault data, private local Elysia memory, local logs, private repositories, or secrets.</p></WarningCallout></section>{(!parts[0] || parts[0] === "dashboard" || parts[0] === "drafts") && <ForgeIntakeMap draftId={workflowDraftId} />}{parts[0] === "profile" && <DeveloperProfilePanel state={state} onSaved={onChanged} />}{parts[0] === "docs" && <DocsPage slug={docSlug} />}{parts[0] === "submissions" && <section className="section-card"><p className="eyebrow">Review status</p><h2>Submission timeline</h2>{state?.submissions.length ? state.submissions.map((submission) => <article className="forge-draft-card" key={submission.id}><h3>{submission.status}</h3><p>{submission.review_summary || submission.reviewer_feedback || "Submitted for Marketplace review."}</p><span>{submission.submitted_at}</span></article>) : <p className="forge-empty">No submissions yet. Submitted add-ons and reviewer feedback will appear here.</p>}</section>}{(!parts[0] || parts[0] === "dashboard") && <><section className="feature-grid feature-grid--three"><article className="feature-card"><p className="eyebrow">Profile</p><h3>{state?.profile?.display_name || "No developer profile yet"}</h3><p>Status: <span className={statusClass(state?.profile?.status)}>{state?.profile?.status || "not created"}</span></p><Link to="/developer-forge/profile">Open profile</Link></article><article className="feature-card"><p className="eyebrow">Drafts</p><h3>{state?.drafts.length ?? 0} draft{state?.drafts.length === 1 ? "" : "s"}</h3><p>Build manifests, permissions, scans, and submissions.</p><Link to="/developer-forge/drafts">Open drafts</Link></article><article className="feature-card"><p className="eyebrow">Docs</p><h3>Security-first add-ons</h3><p>Read manifest, permission, package, and review rules.</p><Link to="/developer-forge/docs/security">Security docs</Link></article></section><DraftList state={state} selectedId={selectedDraft?.id} onChanged={onChanged} /></>}{parts[0] === "drafts" && parts[1] === "new" && <><section className="section-card"><p className="eyebrow">New draft</p><h2>Create a blank draft</h2><label><span>Add-on name</span><input value={blankName} onChange={(event) => setBlankName(event.target.value)} /></label><button className="button-primary" type="button" onClick={() => void createBlank()}>Create blank manifest draft</button></section><TemplateGallery profileId={state?.profile?.id} onCreated={onChanged} /></>}{parts[0] === "drafts" && parts[1] !== "new" && <><DraftList state={state} selectedId={draftId} onChanged={onChanged} />{selectedDraft ? <DraftWorkspace draft={selectedDraft} catalog={state?.permissionCatalog.length ? state.permissionCatalog : defaultPermissionCatalog} onChanged={onChanged} /> : <TemplateGallery profileId={state?.profile?.id} onCreated={onChanged} />}</>}{parts[0] === "drafts" && !parts[1] && <TemplateGallery profileId={state?.profile?.id} onCreated={onChanged} />}</div>;
}

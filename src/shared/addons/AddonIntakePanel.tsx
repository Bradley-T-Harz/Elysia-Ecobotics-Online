import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import {
  addonIntakeLimits,
  inspectAddonArchive,
  inspectAddonFiles,
  formatAddonIntakeBytes,
  type AddonIntakeIssueGroup,
  type AddonIntakeResult
} from "./browserAddonIntake";

type AddonIntakePanelProps = {
  disabled?: boolean;
  result: AddonIntakeResult | null;
  onResult: (result: AddonIntakeResult) => void;
  onMessage?: (message: string) => void;
};

const folderPickerProps = { webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>;

const transitionLabels: Record<AddonIntakeResult["transitionState"], string> = {
  selected_locally: "selected locally",
  needs_manifest: "needs manifest",
  needs_review: "needs review",
  blocked_from_transfer: "blocked from transfer"
};

function IssueGroups({ groups }: { groups: AddonIntakeIssueGroup[] }) {
  if (!groups.length) return <p className="validation validation--ok">No static intake findings so far. Static inspection is evidence, not proof.</p>;
  const needsManifest = groups.filter((group) => group.code === "missing_manifest");
  const blocked = groups.filter((group) => group.severity === "blocked" && group.code !== "missing_manifest");
  const warnings = groups.filter((group) => group.severity === "warning");
  return <div className="addon-intake-issue-summary" aria-label="Grouped validation and static scan findings">
    <p><strong>Grouped findings:</strong> {needsManifest.length} needs-manifest group{needsManifest.length === 1 ? "" : "s"} · {blocked.length} transfer-blocking group{blocked.length === 1 ? "" : "s"} · {warnings.length} warning group{warnings.length === 1 ? "" : "s"}. Open a group to inspect bounded examples.</p>
    <div className="addon-intake-issue-groups">
      {groups.map((group) => {
        const displayState = group.code === "missing_manifest" ? "needs_manifest" : group.severity;
        const displayLabel = displayState === "needs_manifest" ? "Needs manifest" : displayState === "blocked" ? "Blocked from transfer" : "Warning";
        return <details className={`addon-intake-issue-group addon-intake-issue-group--${displayState}`} key={`${group.severity}-${group.code}`}>
        <summary><span>{displayLabel} · <code>{group.code}</code></span><strong>{group.count}</strong></summary>
        <p>{group.message}</p>
        {group.examples.length > 0 && <ul>{group.examples.map((example) => <li key={example}><code>{example}</code></li>)}</ul>}
        {group.count > group.examples.length && <p>Showing {group.examples.length} of {group.count} examples.</p>}
      </details>})}
    </div>
  </div>;
}

export default function AddonIntakePanel({ disabled, result, onResult, onMessage }: AddonIntakePanelProps) {
  const [fileQuery, setFileQuery] = useState("");
  useEffect(() => setFileQuery(""), [result]);

  async function inspectArchive(file: File | null, sourceLabel: string) {
    if (!file) return;
    try {
      const next = /\.(zip|elysia-addon)$/i.test(file.name)
        ? await inspectAddonArchive(file)
        : await inspectAddonFiles([file], "manifest");
      onResult(next);
      onMessage?.(`${sourceLabel}: ${next.selectedFileCount} file${next.selectedFileCount === 1 ? "" : "s"} selected locally; ${next.fileCount} included in the bounded scan. No upload or execution occurred.`);
    } catch {
      onMessage?.("The selected package could not be inspected. Nothing was uploaded or executed.");
    }
  }

  async function inspectFolder(files: FileList | null) {
    if (!files?.length) return;
    try {
      const next = await inspectAddonFiles(files, "folder");
      onResult(next);
      onMessage?.(`${next.selectedFileCount} repository/folder files selected locally; ${next.fileCount} included and ${next.excludedFileCount} generated/vendor files excluded by default. No upload or execution occurred.`);
    } catch {
      onMessage?.("The selected folder could not be inspected. Nothing was uploaded or executed.");
    }
  }

  const visibleFiles = useMemo(() => {
    if (!result) return [];
    const query = fileQuery.trim().toLowerCase();
    const matches = query ? result.files.filter((file) => file.path.toLowerCase().includes(query)) : result.files;
    return matches.slice(0, addonIntakeLimits.maxRenderedFiles);
  }, [fileQuery, result]);
  const matchingFileCount = useMemo(() => {
    if (!result) return 0;
    const query = fileQuery.trim().toLowerCase();
    return query ? result.files.filter((file) => file.path.toLowerCase().includes(query)).length : result.files.length;
  }, [fileQuery, result]);
  const dependencySummary = useMemo(() => {
    const summary = new Map<string, number>();
    for (const path of result?.dependencyFiles ?? []) {
      const name = path.split("/").pop() ?? path;
      summary.set(name, (summary.get(name) ?? 0) + 1);
    }
    return [...summary.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [result]);

  function exportSummary() {
    if (!result) return;
    const report = {
      source: result.sourceKind,
      transition_state: result.transitionState,
      selected: { files: result.selectedFileCount, bytes: result.selectedTotalBytes },
      included_scan: { files: result.fileCount, bytes: result.totalBytes },
      excluded_generated_vendor: result.excludedDirectoryGroups,
      deferred_by_browser_limits: { files: result.deferredFileCount, bytes: result.deferredTotalBytes },
      manifest: { root_count: result.manifestCount, candidates: result.manifestCandidates, node_project_detected: result.nodeProjectDetected },
      findings: result.issueGroups
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "elysia-addon-intake-summary.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <div className="addon-intake-panel">
    <div className="addon-intake-heading">
      <div><p className="eyebrow">Local source intake</p><h3>Choose the source you already have</h3></div>
      <span className="forge-status">Browser memory first</span>
    </div>
    <p className="addon-package-reality">An add-on package may include source files, schemas, docs, assets, tests, manifests, and configuration. <code>manifest.json</code> describes identity, permissions, compatibility, and review boundaries; it is not the entire add-on.</p>
    <div className="addon-intake-options">
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Packaged add-on</span><strong>Import .elysia-addon</strong><span>Inspect an inert Elysia package without installing or executing it.</span><input aria-label="Import .elysia-addon" disabled={disabled} type="file" accept=".elysia-addon,application/vnd.elysia-addon+zip,application/octet-stream" onChange={(event) => void inspectArchive(event.target.files?.[0] ?? null, ".elysia-addon selected")} /></label>
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Source archive</span><strong>Import ZIP / source bundle</strong><span>Inspect a ZIP tree, manifest, source, docs, assets, and dependency files.</span><input aria-label="Import ZIP or source bundle" disabled={disabled} type="file" accept=".zip,application/zip" onChange={(event) => void inspectArchive(event.target.files?.[0] ?? null, "ZIP source selected")} /></label>
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Local workspace</span><strong>Import folder / repository</strong><span>Use the browser folder picker; generated/vendor directories are summarized and excluded by default.</span><input aria-label="Import folder or repository" disabled={disabled} type="file" multiple {...folderPickerProps} onChange={(event) => void inspectFolder(event.target.files)} /></label>
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Manifest only</span><strong>Import manifest.json</strong><span>Load one manifest for editing or review; it does not represent the package by itself.</span><input aria-label="Import manifest.json" disabled={disabled} type="file" accept=".json,application/json" onChange={(event) => void inspectArchive(event.target.files?.[0] ?? null, "manifest.json selected")} /></label>
    </div>
    <div className="addon-intake-boundaries" aria-label="Source intake boundaries">
      <span><strong>Selection:</strong> local browser memory</span>
      <span><strong>Remote transfer:</strong> separate confirmation</span>
      <span><strong>Code execution:</strong> never during intake</span>
      <span><strong>Admin review:</strong> required before publication</span>
    </div>
    <p className="boundary-note">Choosing files does not upload them, clone a repository, execute code, run scripts, install dependencies, or create a public listing.</p>
    {result && <section className={`addon-intake-summary addon-intake-summary--${result.transitionState}`} aria-live="polite">
      <div className="addon-intake-summary__heading">
        <div><p className="eyebrow">Local intake result</p><h4>{result.label}</h4></div>
        <span className={`forge-status forge-status--${result.transitionState}`}>{transitionLabels[result.transitionState]}</span>
      </div>
      <div className="mini-facts">
        <div><dt>Selected files</dt><dd>{result.selectedFileCount}</dd></div>
        <div><dt>Selected size</dt><dd>{formatAddonIntakeBytes(result.selectedTotalBytes)}</dd></div>
        <div><dt>Included in scan</dt><dd>{result.fileCount}</dd></div>
        <div><dt>Included size</dt><dd>{formatAddonIntakeBytes(result.totalBytes)}</dd></div>
        <div><dt>Excluded by default</dt><dd>{result.excludedFileCount}</dd></div>
        <div><dt>Deferred by limits</dt><dd>{result.deferredFileCount}</dd></div>
        <div><dt>Manifest</dt><dd>{result.manifestCount === 1 ? "present" : "needs manifest"}</dd></div>
        <div><dt>Local Elysia contract</dt><dd>{result.localElysiaContract.status.replace(/_/g, " ")}</dd></div>
        <div><dt>License</dt><dd>{result.licensePresent ? "present" : "not found"}</dd></div>
        <div><dt>Boundary</dt><dd>local · not uploaded</dd></div>
      </div>
      {result.manifestCount === 0 && <div className="addon-intake-guidance"><strong>Repo imported locally · Elysia add-on manifest missing.</strong><span>Select the add-on package root or add <code>manifest.json</code>.{result.nodeProjectDetected ? " Node project detected; Elysia add-on manifest is still required." : ""}</span></div>}
      <p className="boundary-note">{result.localElysiaContract.summary}</p>
      {result.excludedDirectoryGroups.length > 0 && <details className="addon-intake-bounded-details"><summary>Generated/vendor exclusions ({result.excludedFileCount} files)</summary><p>Excluded-by-default files remain visible as counts, but are not scanned, displayed individually, packaged, or uploaded.</p><ul>{result.excludedDirectoryGroups.map((group) => <li key={group.directory}><code>{group.directory}/</code><span>{group.fileCount} files · {formatAddonIntakeBytes(group.totalBytes)}</span></li>)}</ul></details>}
      {result.deferredFileCount > 0 && <p className="validation validation--bad">Local selection succeeded, but {result.deferredFileCount} included files exceeded bounded browser scan limits. Choose a narrower add-on root before remote transfer.</p>}
      <details className="addon-intake-bounded-details"><summary>Dependency inventory ({result.dependencyFiles.length} declared files)</summary>{dependencySummary.length ? <ul>{dependencySummary.map(([name, count]) => <li key={name}><code>{name}</code><span>{count}</span></li>)}</ul> : <p>No root/source dependency manifests detected.</p>}</details>
      <IssueGroups groups={result.issueGroups} />
      <details className="addon-intake-file-tree"><summary>Included file tree ({result.fileCount})</summary>
        <label className="addon-intake-file-search"><span>Filter included files</span><input type="search" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} placeholder="src/, README, schema..." /></label>
        <ul className="addon-intake-file-list">{visibleFiles.map((file) => <li key={file.path}><code>{file.path}</code><span>{file.kind} · {formatAddonIntakeBytes(file.size)}</span></li>)}</ul>
        {matchingFileCount > visibleFiles.length && <p>Showing the first {visibleFiles.length} of {matchingFileCount} matching files. Refine the filter to inspect deeper without rendering the whole repository.</p>}
      </details>
      <div className="button-row"><button type="button" onClick={exportSummary}>Export bounded scan summary</button></div>
    </section>}
  </div>;
}

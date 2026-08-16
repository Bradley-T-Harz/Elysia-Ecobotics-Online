import type { InputHTMLAttributes } from "react";
import { inspectAddonArchive, inspectAddonFiles, formatAddonIntakeBytes, type AddonIntakeResult } from "./browserAddonIntake";

type AddonIntakePanelProps = {
  disabled?: boolean;
  result: AddonIntakeResult | null;
  onResult: (result: AddonIntakeResult) => void;
  onMessage?: (message: string) => void;
};

const folderPickerProps = { webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>;

export default function AddonIntakePanel({ disabled, result, onResult, onMessage }: AddonIntakePanelProps) {
  async function inspectArchive(file: File | null, sourceLabel: string) {
    if (!file) return;
    try {
      const next = /\.(zip|elysia-addon)$/i.test(file.name)
        ? await inspectAddonArchive(file)
        : await inspectAddonFiles([file], "manifest");
      onResult(next);
      onMessage?.(`${sourceLabel}: ${next.fileCount} file${next.fileCount === 1 ? "" : "s"} inspected locally. No upload or execution occurred.`);
    } catch {
      onMessage?.("The selected package could not be inspected. Nothing was uploaded or executed.");
    }
  }

  async function inspectFolder(files: FileList | null) {
    if (!files?.length) return;
    try {
      const next = await inspectAddonFiles(files, "folder");
      onResult(next);
      onMessage?.(`${next.fileCount} repository/folder files inspected in browser memory. No upload or execution occurred.`);
    } catch {
      onMessage?.("The selected folder could not be inspected. Nothing was uploaded or executed.");
    }
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
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Local workspace</span><strong>Import folder / repository</strong><span>Use the browser folder picker; unselected files and .git metadata stay outside intake.</span><input aria-label="Import folder or repository" disabled={disabled} type="file" multiple {...folderPickerProps} onChange={(event) => void inspectFolder(event.target.files)} /></label>
      <label className="addon-intake-option"><span className="addon-intake-option__kind">Manifest only</span><strong>Import manifest.json</strong><span>Load one manifest for editing or review; it does not represent the package by itself.</span><input aria-label="Import manifest.json" disabled={disabled} type="file" accept=".json,application/json" onChange={(event) => void inspectArchive(event.target.files?.[0] ?? null, "manifest.json selected")} /></label>
    </div>
    <div className="addon-intake-boundaries" aria-label="Source intake boundaries">
      <span><strong>Selection:</strong> local browser memory</span>
      <span><strong>Remote transfer:</strong> separate confirmation</span>
      <span><strong>Code execution:</strong> never during intake</span>
      <span><strong>Admin review:</strong> required before publication</span>
    </div>
    <p className="boundary-note">Choosing files does not upload them, clone a repository, execute code, run scripts, install dependencies, or create a public listing.</p>
    {result && <section className={`addon-intake-summary ${result.errors.length ? "addon-intake-summary--blocked" : ""}`} aria-live="polite">
      <div className="mini-facts">
        <div><dt>Source</dt><dd>{result.sourceKind}</dd></div>
        <div><dt>Files</dt><dd>{result.fileCount}</dd></div>
        <div><dt>Total size</dt><dd>{formatAddonIntakeBytes(result.totalBytes)}</dd></div>
        <div><dt>Manifest</dt><dd>{result.manifestCount === 1 ? "present" : result.manifestCount ? "duplicate" : "missing"}</dd></div>
        <div><dt>Local Elysia contract</dt><dd>{result.localElysiaContract.status.replace(/_/g, " ")}</dd></div>
        <div><dt>License</dt><dd>{result.licensePresent ? "present" : "not found"}</dd></div>
        <div><dt>Static result</dt><dd>{result.errors.length ? "blocked" : result.warnings.length ? "warnings" : "clear so far"}</dd></div>
        <div><dt>Boundary</dt><dd>local · not uploaded</dd></div>
      </div>
      <p>{result.label}</p>
      <p className="boundary-note">{result.localElysiaContract.summary}</p>
      <p>Dependencies: {result.dependencyFiles.length ? result.dependencyFiles.join(", ") : "none detected"}. Scripts: {result.scriptFiles.length}. Binary/other files: {result.binaryFiles.length}.</p>
      {result.errors.slice(0, 5).map((item, index) => <p className="validation validation--bad" key={`${item.code}-${index}`}>{item.code}: {item.message}{item.path ? ` (${item.path})` : ""}</p>)}
      {result.warnings.slice(0, 5).map((item, index) => <p className="validation" key={`${item.code}-${index}`}>{item.code}: {item.message}{item.path ? ` (${item.path})` : ""}</p>)}
      <details><summary>Selected file tree ({result.fileCount})</summary><ul className="addon-intake-file-list">{result.files.slice(0, 200).map((file) => <li key={file.path}><code>{file.path}</code><span>{file.kind} · {formatAddonIntakeBytes(file.size)}</span></li>)}</ul>{result.files.length > 200 && <p>Showing the first 200 files.</p>}</details>
    </section>}
  </div>;
}

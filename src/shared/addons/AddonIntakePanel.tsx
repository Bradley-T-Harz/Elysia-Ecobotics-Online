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
  async function inspectArchive(file: File | null) {
    if (!file) return;
    try {
      const next = /\.(zip|elysia-addon)$/i.test(file.name)
        ? await inspectAddonArchive(file)
        : await inspectAddonFiles([file], "manifest");
      onResult(next);
      onMessage?.(`${next.fileCount} file${next.fileCount === 1 ? "" : "s"} inspected locally. No upload or execution occurred.`);
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
    <div className="addon-intake-options">
      <label className="addon-intake-option"><strong>Package or source bundle</strong><span>.elysia-addon, .zip, or manifest.json</span><input disabled={disabled} type="file" accept=".elysia-addon,.zip,.json,application/zip,application/json,application/octet-stream" onChange={(event) => void inspectArchive(event.target.files?.[0] ?? null)} /></label>
      <label className="addon-intake-option"><strong>Folder or repository</strong><span>Browser folder picker; .git metadata is excluded</span><input disabled={disabled} type="file" multiple {...folderPickerProps} onChange={(event) => void inspectFolder(event.target.files)} /></label>
    </div>
    <p className="boundary-note">Selection and static inspection happen in this browser first. Choosing files does not upload them, clone a repository, execute code, run scripts, or install dependencies.</p>
    {result && <section className={`addon-intake-summary ${result.errors.length ? "addon-intake-summary--blocked" : ""}`} aria-live="polite">
      <div className="mini-facts">
        <div><dt>Source</dt><dd>{result.sourceKind}</dd></div>
        <div><dt>Files</dt><dd>{result.fileCount}</dd></div>
        <div><dt>Total size</dt><dd>{formatAddonIntakeBytes(result.totalBytes)}</dd></div>
        <div><dt>Manifest</dt><dd>{result.manifestCount === 1 ? "present" : result.manifestCount ? "duplicate" : "missing"}</dd></div>
        <div><dt>License</dt><dd>{result.licensePresent ? "present" : "not found"}</dd></div>
        <div><dt>Static result</dt><dd>{result.errors.length ? "blocked" : result.warnings.length ? "warnings" : "clear so far"}</dd></div>
      </div>
      <p>{result.label}</p>
      <p>Dependencies: {result.dependencyFiles.length ? result.dependencyFiles.join(", ") : "none detected"}. Scripts: {result.scriptFiles.length}. Binary/other files: {result.binaryFiles.length}.</p>
      {result.errors.slice(0, 5).map((item, index) => <p className="validation validation--bad" key={`${item.code}-${index}`}>{item.code}: {item.message}{item.path ? ` (${item.path})` : ""}</p>)}
      {result.warnings.slice(0, 5).map((item, index) => <p className="validation" key={`${item.code}-${index}`}>{item.code}: {item.message}{item.path ? ` (${item.path})` : ""}</p>)}
      <details><summary>Selected file tree ({result.fileCount})</summary><ul className="addon-intake-file-list">{result.files.slice(0, 200).map((file) => <li key={file.path}><code>{file.path}</code><span>{file.kind} · {formatAddonIntakeBytes(file.size)}</span></li>)}</ul>{result.files.length > 200 && <p>Showing the first 200 files.</p>}</details>
    </section>}
  </div>;
}

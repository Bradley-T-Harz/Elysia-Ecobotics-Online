import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Command } from "cmdk";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";
import parserMarkdown from "prettier/plugins/markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { AddonDraft } from "./developerForgeApi";
import type { ForgeValidationResult } from "./developerForgeValidator";
import RepositoryTreeExplorer from "../../shared/addons/RepositoryTreeExplorer";
import "../../shared/editor/localMonaco";

export type ForgeWorkspaceFile = {
  path: string;
  label: string;
  language: "json" | "markdown" | "typescript" | "javascript" | "css" | "html" | "python" | "rust" | "yaml" | "toml" | "text";
  value: string;
  locked?: boolean;
  imported?: boolean;
};

export type ForgeCommandAction = {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
};

export function draftWorkspaceFiles(draft: AddonDraft, manifestText: string): ForgeWorkspaceFile[] {
  const readme = `# ${draft.addon_name || "Untitled add-on"}\n\n${draft.long_description || draft.short_summary || "Describe what this add-on does, what it does not do, and what users should expect."}\n\n## Safety boundary\n\nThis Forge workspace is inert. The public website does not run, install, enable, or approve this add-on. Marketplace review and local Elysia permission review remain separate.`;
  return [
    { path: "manifest.json", label: "manifest.json", language: "json", value: manifestText },
    { path: "README.md", label: "README.md", language: "markdown", value: readme },
    { path: "LICENSE", label: "LICENSE", language: "text", value: draft.license || "License not declared yet." },
    { path: "docs/review-boundary.md", label: "docs/review-boundary.md", language: "markdown", value: "Static scan is evidence, not proof. Checksums are integrity evidence, not signing. Local Elysia remains the final installer, verifier, runtime, and permission authority." }
  ];
}

export async function formatForgeJson(value: string) {
  return prettier.format(value, { parser: "json", plugins: [parserBabel, parserEstree] });
}

export async function formatForgeMarkdown(value: string) {
  return prettier.format(value, { parser: "markdown", plugins: [parserMarkdown] });
}

function languageForMonaco(language: ForgeWorkspaceFile["language"]) {
  if (language === "json") return "json";
  if (language === "markdown") return "markdown";
  if (language === "typescript") return "typescript";
  if (language === "javascript") return "javascript";
  if (language === "css") return "css";
  if (language === "html") return "html";
  if (language === "python") return "python";
  if (language === "rust") return "rust";
  if (language === "yaml") return "yaml";
  if (language === "toml") return "toml";
  return "plaintext";
}

function ForgeEditorFallback({ file, readOnly, onChange }: { file: ForgeWorkspaceFile; readOnly?: boolean; onChange: (value: string) => void }) {
  return <textarea className="forge-json-editor forge-monaco-fallback" spellCheck={false} readOnly={readOnly || file.locked} value={file.value} onChange={(event) => onChange(event.target.value)} />;
}

export function ForgeWorkspaceEditor({ file, readOnly, onChange }: { file: ForgeWorkspaceFile; readOnly?: boolean; onChange: (value: string) => void }) {
  return <div className="forge-monaco-shell">
    <Editor
      height="380px"
      language={languageForMonaco(file.language)}
      theme="vs-dark"
      value={file.value}
      loading={<ForgeEditorFallback file={file} readOnly={readOnly} onChange={onChange} />}
      options={{
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false },
        readOnly: readOnly || file.locked,
        scrollBeyondLastLine: false,
        wordWrap: "on"
      }}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor, monaco) => {
        monaco.editor.setTheme("vs-dark");
        editor.updateOptions({ renderWhitespace: "selection" });
      }}
      onValidate={() => undefined}
    />
  </div>;
}

export function ForgeMarkdownPreview({ markdown }: { markdown: string }) {
  return <article className="forge-markdown-preview">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {markdown}
    </ReactMarkdown>
  </article>;
}

export function ForgeCommandPalette({ commands }: { commands: ForgeCommandAction[] }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => [...new Set(commands.map((command) => command.group))], [commands]);
  return <div className="forge-command-palette">
    <button type="button" onClick={() => setOpen(true)}>Command palette</button>
    {open && <div className="forge-command-overlay" role="dialog" aria-modal="true" aria-label="Developer Forge command palette">
      <Command className="forge-command-root">
        <div className="forge-command-header"><strong>Developer Forge commands</strong><button type="button" onClick={() => setOpen(false)}>Close</button></div>
        <Command.Input autoFocus placeholder="Type a Forge action..." />
        <Command.List>
          <Command.Empty>No safe Forge action found.</Command.Empty>
          {groups.map((group) => <Command.Group heading={group} key={group}>
            {commands.filter((command) => command.group === group).map((command) => <Command.Item
              key={command.id}
              disabled={command.disabled}
              value={`${command.group} ${command.label}`}
              onSelect={() => {
                if (command.disabled) return;
                command.run();
                setOpen(false);
              }}
            >
              <span>{command.label}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </Command.Item>)}
          </Command.Group>)}
        </Command.List>
      </Command>
    </div>}
  </div>;
}

export function ForgeWorkbenchSurface({
  files,
  activePath,
  diagnostics,
  repositoryStats,
  readOnly,
  onSelect,
  onChange
}: {
  files: ForgeWorkspaceFile[];
  activePath: string;
  diagnostics: ForgeValidationResult[];
  repositoryStats?: { selectedFileCount: number; includedFileCount: number; excludedFileCount: number };
  readOnly?: boolean;
  onSelect: (path: string) => void;
  onChange: (path: string, value: string) => void;
}) {
  const active = files.find((file) => file.path === activePath) ?? files[0];
  const diagnosticGroups = useMemo(() => {
    const groups = new Map<string, { severity: ForgeValidationResult["severity"]; code: string; count: number }>();
    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.severity}:${diagnostic.code}`;
      const group = groups.get(key) ?? { severity: diagnostic.severity, code: diagnostic.code, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    return [...groups.values()].slice(0, 8);
  }, [diagnostics]);
  const visibleTabs = [active, ...files.filter((file) => file.path !== active?.path)].filter(Boolean).slice(0, 6) as ForgeWorkspaceFile[];
  return <div className="forge-workbench-surface">
    <aside className="forge-file-tree" aria-label="Add-on workspace files">
      <div className="forge-file-tree__heading"><strong>Repository explorer</strong><span>{repositoryStats ? `${repositoryStats.includedFileCount} scanned · ${repositoryStats.excludedFileCount} excluded` : `${files.length} workspace files`}</span></div>
      {repositoryStats && <p className="forge-file-tree__selection">{repositoryStats.selectedFileCount} selected locally · generated/vendor directories excluded by default</p>}
      <RepositoryTreeExplorer
        ariaLabel="Add-on workspace repository tree"
        activePath={active.path}
        entries={files.map((file) => ({ path: file.path, meta: file.locked ? "locked" : undefined }))}
        onSelect={onSelect}
      />
      <p className="boundary-note">Virtual and explicitly imported files only. Local imports stay in browser memory until a separate private-transfer action. The website never runs package code or controls local Elysia.</p>
    </aside>
    <div className="forge-editor-stack">
      <div className="forge-editor-tabs" aria-label="Bounded workspace file tabs">{visibleTabs.map((file) => <button type="button" className={file.path === active.path ? "active" : ""} title={file.path} key={file.path} onClick={() => onSelect(file.path)}>{file.path.split("/").pop()}</button>)}{files.length > visibleTabs.length && <span>{files.length - visibleTabs.length} more in repository explorer</span>}</div>
      <ForgeWorkspaceEditor file={active} readOnly={readOnly} onChange={(value) => onChange(active.path, value)} />
      {active.language === "markdown" && <section id={active.path === "README.md" ? "forge-readme-preview" : undefined} className="forge-markdown-preview-region" aria-labelledby={active.path === "README.md" ? "forge-readme-preview-heading" : undefined}>
        <h3 id={active.path === "README.md" ? "forge-readme-preview-heading" : undefined}>{active.label} preview</h3>
        <ForgeMarkdownPreview markdown={active.value} />
      </section>}
      {diagnosticGroups.length > 0 && <div className="forge-diagnostics-strip" aria-label="Grouped workbench diagnostics">
        {diagnosticGroups.map((diagnostic) => <span key={`${diagnostic.severity}-${diagnostic.code}`} className={`forge-result--${diagnostic.severity}`}>{diagnostic.severity}: {diagnostic.code} · {diagnostic.count}</span>)}
      </div>}
    </div>
  </div>;
}

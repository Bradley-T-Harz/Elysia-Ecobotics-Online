import Editor from "@monaco-editor/react";
import "../../shared/editor/localMonaco";
import type { ForgeWorkspaceFile } from "./ForgeWorkbench";

export type ForgeMonacoEditorProps = {
  file: ForgeWorkspaceFile;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

function languageForMonaco(language: ForgeWorkspaceFile["language"]) {
  if (language === "text") return "plaintext";
  return language;
}

export default function ForgeMonacoEditor({ file, readOnly, onChange }: ForgeMonacoEditorProps) {
  return <Editor
    height="380px"
    language={languageForMonaco(file.language)}
    theme="vs-dark"
    value={file.value}
    loading={<textarea className="forge-json-editor forge-monaco-fallback" spellCheck={false} readOnly={readOnly || file.locked} value={file.value} onChange={(event) => onChange(event.target.value)} />}
    options={{
      automaticLayout: true,
      fontSize: 14,
      minimap: { enabled: false },
      readOnly: readOnly || file.locked,
      scrollBeyondLastLine: false,
      wordWrap: "on",
    }}
    onChange={(value) => onChange(value ?? "")}
    onMount={(editor, monaco) => {
      monaco.editor.setTheme("vs-dark");
      editor.updateOptions({ renderWhitespace: "selection" });
    }}
    onValidate={() => undefined}
  />;
}

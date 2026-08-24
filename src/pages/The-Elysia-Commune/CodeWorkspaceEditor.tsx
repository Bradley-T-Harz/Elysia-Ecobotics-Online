import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { normalizeCodingLanguage } from "./codeLanguagePolicies";

export type CodeWorkspaceEditorProps = {
  value: string;
  language?: string | null;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
};

const codeEditorBaseTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(2, 8, 14, 0.9)",
    color: "#e7f7f6",
    border: "1px solid rgba(142, 232, 220, 0.26)",
    borderRadius: "14px",
    overflow: "hidden",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    color: "rgba(232, 248, 247, 0.52)",
    borderRight: "1px solid rgba(142, 232, 220, 0.16)",
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.9rem",
  },
});

async function loadLanguageExtensions(language: string): Promise<Extension[]> {
  switch (language) {
    case "javascript":
    case "typescript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return [javascript({ jsx: true, typescript: language === "typescript" })];
    }
    case "python": {
      const { python } = await import("@codemirror/lang-python");
      return [python()];
    }
    case "json": {
      const { json } = await import("@codemirror/lang-json");
      return [json()];
    }
    case "markdown": {
      const { markdown } = await import("@codemirror/lang-markdown");
      return [markdown()];
    }
    case "html": {
      const { html } = await import("@codemirror/lang-html");
      return [html()];
    }
    case "css": {
      const { css } = await import("@codemirror/lang-css");
      return [css()];
    }
    case "yaml": {
      const { yaml } = await import("@codemirror/lang-yaml");
      return [yaml()];
    }
    case "java": {
      const { java } = await import("@codemirror/lang-java");
      return [java()];
    }
    case "cpp": {
      const { cpp } = await import("@codemirror/lang-cpp");
      return [cpp()];
    }
    case "rust": {
      const { rust } = await import("@codemirror/lang-rust");
      return [rust()];
    }
    case "go": {
      const { go } = await import("@codemirror/lang-go");
      return [go()];
    }
    default:
      return [];
  }
}

export default function CodeWorkspaceEditor({
  value,
  language,
  onChange,
  readOnly = false,
  minHeight = "320px",
}: CodeWorkspaceEditorProps) {
  const normalizedLanguage = normalizeCodingLanguage(language);
  const [languageExtensions, setLanguageExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    let active = true;
    setLanguageExtensions([]);
    void loadLanguageExtensions(normalizedLanguage).then((extensions) => {
      if (active) setLanguageExtensions(extensions);
    });
    return () => {
      active = false;
    };
  }, [normalizedLanguage]);

  const extensions = useMemo(
    () => [codeEditorBaseTheme, ...languageExtensions, EditorView.lineWrapping],
    [languageExtensions],
  );

  return <div className="coding-cornucopia-editor">
    <CodeMirror
      value={value}
      height={minHeight}
      theme="dark"
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, autocompletion: !readOnly, searchKeymap: true }}
      extensions={extensions}
      editable={!readOnly}
      readOnly={readOnly}
      onChange={(next) => onChange?.(next)}
    />
  </div>;
}

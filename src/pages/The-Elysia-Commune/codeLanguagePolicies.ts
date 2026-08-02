export type CodingLanguageStatus = "active_sandbox" | "static_diagnostics" | "future" | "disabled";

export type CodingLanguagePolicy = {
  id: string;
  label: string;
  extensions: string[];
  status: CodingLanguageStatus;
  sandboxRuntime?: "node" | "python" | "static";
  summary: string;
  risk: string;
};

export const codingLanguagePolicies: CodingLanguagePolicy[] = [
  {
    id: "javascript",
    label: "JavaScript",
    extensions: [".js", ".mjs", ".cjs"],
    status: "active_sandbox",
    sandboxRuntime: "node",
    summary: "Runs only through the configured container sandbox with network disabled.",
    risk: "Dependency installs, child processes, and network access remain blocked by policy."
  },
  {
    id: "typescript",
    label: "TypeScript",
    extensions: [".ts", ".tsx"],
    status: "active_sandbox",
    sandboxRuntime: "node",
    summary: "Runs through the sandbox using the Node TypeScript strip-types runtime where available.",
    risk: "Full project builds and npm installs are not enabled from public snippets."
  },
  {
    id: "python",
    label: "Python",
    extensions: [".py"],
    status: "active_sandbox",
    sandboxRuntime: "python",
    summary: "Runs only through the configured container sandbox with network disabled.",
    risk: "pip installs, local file access, and private environment access remain blocked by policy."
  },
  {
    id: "json",
    label: "JSON",
    extensions: [".json"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Validated statically; no execution is needed.",
    risk: "Schema validation is future and must not imply trust."
  },
  {
    id: "yaml",
    label: "YAML",
    extensions: [".yaml", ".yml"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Parsed statically for syntax diagnostics.",
    risk: "YAML content is not applied to any system."
  },
  {
    id: "markdown",
    label: "Markdown",
    extensions: [".md", ".markdown"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Checked statically for public-safety and formatting signals.",
    risk: "Links and code fences are public text, not approval."
  },
  {
    id: "html",
    label: "HTML",
    extensions: [".html", ".htm"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Checked statically; no browser execution or live preview is performed.",
    risk: "Script/event-handler content is flagged and never run by the Commune page."
  },
  {
    id: "css",
    label: "CSS",
    extensions: [".css"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Checked statically for simple syntax and unsafe reference signals.",
    risk: "CSS is displayed as text and not injected into the page."
  },
  {
    id: "go",
    label: "Go",
    extensions: [".go"],
    status: "future",
    summary: "Planned after the sandbox image/toolchain policy is reviewed.",
    risk: "Module downloads and builds need stricter dependency policy."
  },
  {
    id: "rust",
    label: "Rust",
    extensions: [".rs"],
    status: "future",
    summary: "Planned after toolchain and dependency build policy is reviewed.",
    risk: "Cargo builds can be heavy and dependency-driven."
  },
  {
    id: "java",
    label: "Java",
    extensions: [".java"],
    status: "future",
    summary: "Planned after JVM runtime limits and classpath policy are reviewed.",
    risk: "Build/test tooling requires separate limits."
  },
  {
    id: "cpp",
    label: "C / C++",
    extensions: [".c", ".cc", ".cpp", ".h", ".hpp"],
    status: "future",
    summary: "Future only; native compilation needs a hardened policy pass.",
    risk: "Native code has higher memory-safety and resource-containment risk."
  },
  {
    id: "shell",
    label: "Shell",
    extensions: [".sh", ".bash"],
    status: "disabled",
    summary: "Disabled by default.",
    risk: "Shell is too powerful for public execution without a separate reviewer-only policy."
  },
  {
    id: "text",
    label: "Plain text",
    extensions: [".txt"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    summary: "Displayed and scanned as inert text.",
    risk: "Text can still contain secrets or unsafe instructions."
  }
];

const aliases: Record<string, string> = {
  js: "javascript",
  node: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  md: "markdown",
  yml: "yaml",
  htm: "html",
  c: "cpp",
  cc: "cpp",
  cxx: "cpp",
  bash: "shell",
  sh: "shell",
  plaintext: "text"
};

export function normalizeCodingLanguage(language?: string | null) {
  const normalized = String(language ?? "text").trim().toLowerCase().replace(/^\./, "");
  return aliases[normalized] ?? normalized;
}

export function getCodingLanguagePolicy(language?: string | null) {
  const normalized = normalizeCodingLanguage(language);
  return codingLanguagePolicies.find((policy) => policy.id === normalized) ?? codingLanguagePolicies.find((policy) => policy.id === "text")!;
}

export function codingLanguageOptions() {
  return codingLanguagePolicies.map((policy) => ({ value: policy.id, label: policy.label }));
}

export function codingLanguageStatusLabel(status: CodingLanguageStatus) {
  if (status === "active_sandbox") return "Sandbox language supported";
  if (status === "static_diagnostics") return "Static diagnostics only";
  if (status === "future") return "Future sandbox support";
  return "Disabled";
}

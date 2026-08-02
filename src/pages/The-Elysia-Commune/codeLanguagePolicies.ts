export type CodingLanguageStatus = "active_sandbox" | "static_diagnostics" | "future" | "disabled";
export type SandboxExecutionMode = "container" | "static";

export type CodingLanguagePolicy = {
  id: string;
  label: string;
  extensions: string[];
  status: CodingLanguageStatus;
  sandboxRuntime?: "node" | "python" | "static";
  sandboxExecutionMode?: SandboxExecutionMode;
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
    sandboxExecutionMode: "container",
    summary: "Runs only through the configured container sandbox with network disabled.",
    risk: "Dependency installs, child processes, and network access remain blocked by policy."
  },
  {
    id: "typescript",
    label: "TypeScript",
    extensions: [".ts", ".tsx"],
    status: "active_sandbox",
    sandboxRuntime: "node",
    sandboxExecutionMode: "container",
    summary: "Runs through the sandbox using the Node TypeScript strip-types runtime where available.",
    risk: "Full project builds and npm installs are not enabled from public snippets."
  },
  {
    id: "python",
    label: "Python",
    extensions: [".py"],
    status: "active_sandbox",
    sandboxRuntime: "python",
    sandboxExecutionMode: "container",
    summary: "Runs only through the configured container sandbox with network disabled.",
    risk: "pip installs, local file access, and private environment access remain blocked by policy."
  },
  {
    id: "json",
    label: "JSON",
    extensions: [".json"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    sandboxExecutionMode: "static",
    summary: "Validated statically; no execution is needed.",
    risk: "Schema validation is future and must not imply trust."
  },
  {
    id: "yaml",
    label: "YAML",
    extensions: [".yaml", ".yml"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    sandboxExecutionMode: "static",
    summary: "Parsed statically for syntax diagnostics.",
    risk: "YAML content is not applied to any system."
  },
  {
    id: "markdown",
    label: "Markdown",
    extensions: [".md", ".markdown"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    sandboxExecutionMode: "static",
    summary: "Checked statically for public-safety and formatting signals.",
    risk: "Links and code fences are public text, not approval."
  },
  {
    id: "html",
    label: "HTML",
    extensions: [".html", ".htm"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    sandboxExecutionMode: "static",
    summary: "Checked statically; no browser execution or live preview is performed.",
    risk: "Script/event-handler content is flagged and never run by the Commune page."
  },
  {
    id: "css",
    label: "CSS",
    extensions: [".css"],
    status: "static_diagnostics",
    sandboxRuntime: "static",
    sandboxExecutionMode: "static",
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

export type SandboxExecutionLanguageCompatibility = {
  normalizedLanguage: string;
  policy: CodingLanguagePolicy;
  knownLanguage: boolean;
  executable: boolean;
  requestLanguage: string | null;
  mode: SandboxExecutionMode | null;
  message: string | null;
};

export function getSandboxExecutionLanguageCompatibility(language?: string | null): SandboxExecutionLanguageCompatibility {
  const normalizedLanguage = normalizeCodingLanguage(language);
  const matchedPolicy = codingLanguagePolicies.find((policy) => policy.id === normalizedLanguage);
  const policy = matchedPolicy ?? codingLanguagePolicies.find((item) => item.id === "text")!;
  const mode = matchedPolicy?.sandboxExecutionMode ?? null;

  if (mode) {
    return {
      normalizedLanguage,
      policy,
      knownLanguage: true,
      executable: true,
      requestLanguage: policy.id,
      mode,
      message: null
    };
  }

  const message = matchedPolicy?.id === "text"
    ? "Sandbox execution is unavailable for Plain text. The text may still be reviewed and scanned safely, but it is not an executable language."
    : matchedPolicy
      ? `Sandbox execution is unavailable for ${matchedPolicy.label}. The content may still be reviewed and scanned safely, but it is not an executable language.`
      : "Sandbox execution is unavailable because this snapshot uses an unsupported language. The content may still be reviewed and scanned safely, but it is not executable.";

  return {
    normalizedLanguage,
    policy,
    knownLanguage: Boolean(matchedPolicy),
    executable: false,
    requestLanguage: null,
    mode: null,
    message
  };
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

export const maxCodeBytes = 65_536;
export const maxOutputBytes = 65_536;
export const hardOutputBytes = 98_304;
export const maxOutputLines = 2_000;

export const supportedRuntimes = Object.freeze({
  python: Object.freeze({
    imageKey: "python",
    fileName: "main.py",
    allowedCommand: Object.freeze(["python", "-I", "-B", "main.py"]),
    aliases: Object.freeze(["python", "py"])
  }),
  javascript: Object.freeze({
    imageKey: "node",
    fileName: "main.js",
    allowedCommand: Object.freeze(["node", "--disable-proto=delete", "main.js"]),
    aliases: Object.freeze(["javascript", "js", "node"])
  }),
  typescript: Object.freeze({
    imageKey: "node",
    fileName: "main.ts",
    allowedCommand: Object.freeze(["node", "--disable-proto=delete", "--experimental-strip-types", "main.ts"]),
    aliases: Object.freeze(["typescript", "ts"])
  })
});

export const staticDiagnosticLanguages = Object.freeze(["json", "yaml", "markdown", "html", "css", "text"]);
export const futureLanguages = Object.freeze(["go", "rust", "java", "c", "cpp", "c++"]);
export const disabledLanguages = Object.freeze(["shell", "bash", "sh"]);

export const defaultLimits = Object.freeze({
  cpus: "0.5",
  memory: "256m",
  memorySwap: "256m",
  timeoutSeconds: 5,
  pidsLimit: "32",
  tmpfsSize: "16m",
  fileDescriptors: "64"
});

export const dangerousCommandPatterns = Object.freeze([
  { code: "curl_bash", pattern: /curl\b[^\n|]*\|\s*(sh|bash)/i },
  { code: "wget_bash", pattern: /wget\b[^\n|]*\|\s*(sh|bash)/i },
  { code: "rm_rf", pattern: /rm\s+-rf/i },
  { code: "sudo", pattern: /(^|\s)sudo(\s|$)/i },
  { code: "chmod_exec", pattern: /chmod\s+\+x/i },
  { code: "npm_install", pattern: /npm\s+(install|i)\b/i },
  { code: "pip_install", pattern: /pip\s+install/i },
  { code: "postinstall", pattern: /postinstall/i },
  { code: "preinstall", pattern: /preinstall/i },
  { code: "eval", pattern: /\beval\s*\(/i },
  { code: "new_function", pattern: /new\s+Function\b/i },
  { code: "child_process", pattern: /child_process/i },
  { code: "exec", pattern: /\bexec(File|Sync)?\s*\(/i },
  { code: "spawn", pattern: /\bspawn(Sync)?\s*\(/i },
  { code: "subprocess", pattern: /\b(subprocess|os\.system|pty|popen)\b/i },
  { code: "socket", pattern: /\b(socket|urllib|requests|fetch|XMLHttpRequest)\b/i },
  { code: "git_clone", pattern: /git\s+clone/i },
  { code: "container_engine", pattern: /(^|\s)(docker|podman)(\s|$)/i },
  { code: "remote_shell", pattern: /(^|\s)(ssh|scp|nc|netcat)(\s|$)/i }
]);

export const secretPatterns = Object.freeze([
  { code: "env_file", pattern: /(^|[\s/\\])\.env([\s/\\.]|$)/i },
  { code: "api_key", pattern: /API[_-]?KEY\s*[:=]/i },
  { code: "secret", pattern: /SECRET\s*[:=]/i },
  { code: "token", pattern: /TOKEN\s*[:=]/i },
  { code: "password", pattern: /PASSWORD\s*[:=]/i },
  { code: "private_key", pattern: /BEGIN [A-Z ]*PRIVATE KEY/i },
  { code: "secret_token", pattern: /sk-[A-Za-z0-9_-]{12,}/ },
  { code: "github_token", pattern: /(ghp_|github_pat_)[A-Za-z0-9_]+/i },
  { code: "aws_key", pattern: /AWS_ACCESS_KEY_ID\s*[:=]/i },
  { code: "service_role", pattern: /(SUPABASE_SERVICE_ROLE|service_role)/i },
  { code: "home_path", pattern: /(^|\s)\/(home|root|opt)\//i },
  { code: "windows_path", pattern: /[A-Z]:\\/i },
  { code: "ssh_key", pattern: /\.ssh|id_rsa/i },
  { code: "vault", pattern: /\b(vault|credentials?)\b/i },
  { code: "process_env", pattern: /process\.env|os\.environ|getenv\s*\(/i }
]);

export function runtimeForLanguage(language) {
  const normalized = normalizeLanguage(language);
  return Object.values(supportedRuntimes).find((runtime) => runtime.aliases.includes(normalized)) || null;
}

export function normalizeLanguage(language) {
  const normalized = String(language || "text").trim().toLowerCase().replace(/^\./, "");
  if (["js", "mjs", "cjs", "node"].includes(normalized)) return "javascript";
  if (normalized === "ts") return "typescript";
  if (normalized === "tsx") return "unsupported_tsx";
  if (normalized === "py") return "python";
  if (normalized === "md") return "markdown";
  if (normalized === "yml") return "yaml";
  if (normalized === "htm") return "html";
  if (["cxx", "cc"].includes(normalized)) return "cpp";
  if (["bash", "sh"].includes(normalized)) return "shell";
  return normalized;
}

export function languagePolicyStatus(language) {
  const normalized = normalizeLanguage(language);
  if (runtimeForLanguage(normalized)) return "active_sandbox";
  if (staticDiagnosticLanguages.includes(normalized)) return "static_diagnostics";
  if (futureLanguages.includes(normalized)) return "future";
  if (disabledLanguages.includes(normalized)) return "disabled";
  return "unsupported";
}

export function redactSecrets(text) {
  let output = String(text ?? "");
  output = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  output = output.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  output = output.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_SECRET]");
  output = output.replace(/(ghp_|github_pat_)[A-Za-z0-9_]+/gi, "[REDACTED_TOKEN]");
  output = output.replace(/BEGIN [A-Z ]*PRIVATE KEY[\s\S]*?END [A-Z ]*PRIVATE KEY/gi, "[REDACTED_PRIVATE_KEY]");
  output = output.replace(/(API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
  output = output.replace(/\/(workspace|tmp)(\/[^\s:'\"]*)?/g, "[SANDBOX_PATH]");
  return output;
}

export function decodeUtf8Prefix(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let end = bytes.byteLength;
  while (end > 0) {
    try {
      return decoder.decode(bytes.subarray(0, end));
    } catch {
      end -= 1;
    }
  }
  return "";
}

export function sanitizeOutput(text, maximum = maxOutputBytes) {
  const clean = redactSecrets(text).replace(/\r\n?/g, "\n");
  const lineBounded = clean.split("\n").slice(0, maxOutputLines).join("\n");
  const bytes = Buffer.from(lineBounded, "utf8");
  if (bytes.byteLength <= maximum) return lineBounded;
  return decodeUtf8Prefix(bytes.subarray(0, Math.max(0, maximum)));
}

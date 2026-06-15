export const runnerRoot = new URL("./", import.meta.url);
export const runtimeRoot = new URL("./runtime/", runnerRoot);
export const jobsRoot = new URL("./runtime/jobs/", runnerRoot);
export const auditRoot = new URL("./runtime/audit/", runnerRoot);
export const maxOutputBytes = 128 * 1024;

export const supportedRuntimes = {
  python: {
    image: "python:3.12-alpine",
    fileName: "main.py",
    allowedCommand: ["python", "main.py"],
    aliases: ["python", "py"]
  },
  javascript: {
    image: "node:22-alpine",
    fileName: "main.js",
    allowedCommand: ["node", "main.js"],
    aliases: ["javascript", "js", "node"]
  }
};

export const defaultLimits = {
  cpus: "0.5",
  memory: "256m",
  timeoutSeconds: 10,
  pidsLimit: "64"
};

export const dangerousCommandPatterns = [
  { code: "curl_bash", pattern: /curl\b[^\n|]*\|\s*(sh|bash)/i },
  { code: "wget_bash", pattern: /wget\b[^\n|]*\|\s*(sh|bash)/i },
  { code: "rm_rf", pattern: /rm\s+-rf/i },
  { code: "sudo", pattern: /(^|\s)sudo(\s|$)/i },
  { code: "chmod_exec", pattern: /chmod\s+\+x/i },
  { code: "npm_install", pattern: /npm\s+install/i },
  { code: "pip_install", pattern: /pip\s+install/i },
  { code: "postinstall", pattern: /postinstall/i },
  { code: "preinstall", pattern: /preinstall/i },
  { code: "eval", pattern: /eval\s*\(/i },
  { code: "new_function", pattern: /new\s+Function\b/i },
  { code: "child_process", pattern: /child_process/i },
  { code: "exec", pattern: /\bexec\s*\(/i },
  { code: "spawn", pattern: /\bspawn\s*\(/i },
  { code: "git_clone", pattern: /git\s+clone/i },
  { code: "docker", pattern: /(^|\s)docker(\s|$)/i },
  { code: "podman", pattern: /(^|\s)podman(\s|$)/i },
  { code: "ssh", pattern: /(^|\s)(ssh|scp|nc|netcat)(\s|$)/i }
];

export const secretPatterns = [
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
  { code: "home_path", pattern: /(^|\s)\/home\//i },
  { code: "windows_path", pattern: /[A-Z]:\\/i },
  { code: "ssh_key", pattern: /\.ssh|id_rsa/i },
  { code: "vault", pattern: /\b(vault|credentials?)\b/i }
];

export function runtimeForLanguage(language) {
  const normalized = String(language || "").trim().toLowerCase();
  return Object.values(supportedRuntimes).find((runtime) => runtime.aliases.includes(normalized)) || null;
}

export function redactSecrets(text) {
  let output = String(text ?? "");
  output = output.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_SECRET]");
  output = output.replace(/(ghp_|github_pat_)[A-Za-z0-9_]+/gi, "[REDACTED_TOKEN]");
  output = output.replace(/BEGIN [A-Z ]*PRIVATE KEY[\s\S]*?END [A-Z ]*PRIVATE KEY/gi, "[REDACTED_PRIVATE_KEY]");
  output = output.replace(/(API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
  return output;
}

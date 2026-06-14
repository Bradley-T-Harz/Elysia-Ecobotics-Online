import fs from "node:fs/promises";
import path from "node:path";

const roots = ["src", "supabase", "public", "docs"];
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".md", ".json", ".txt"]);

const checks = [
  { name: "service role key strings", pattern: /SERVICE_ROLE|SUPABASE_SERVICE|SUPABASE_SERVICE_ROLE|service_role/ },
  { name: "private key material", pattern: /BEGIN [A-Z ]*PRIVATE KEY/ },
  { name: "obvious OpenAI key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
  { name: "runtime eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /new Function\s*\(/ },
  { name: "Node child process", pattern: /\bchild_process\b/ },
  { name: "process exec", pattern: /\bexec\s*\(/ },
  { name: "process spawn", pattern: /\bspawn\s*\(/ },
  { name: "package hook execution", pattern: /\b(postinstall|preinstall)\b/ }
];

function allowHit(file, line, checkName) {
  const normalized = file.replaceAll(path.sep, "/");
  if (normalized.endsWith("scripts/securitySmokeTest.mjs")) return true;
  if (normalized.endsWith("src/pages/The-Elysia-Commune/communeSafety.ts") && /pattern|blocked|scanner|scan|blocks/i.test(line)) return true;
  if (normalized.endsWith("src/pages/The-Developer-Forge/developerForgeValidator.ts") && /pattern|blocked|scanner|scan|Static scan|secret-looking|dangerousShellPattern/i.test(line)) return true;
  if (normalized.includes("docs/commune/secret-upload-warning-policy.md") && /flag|scanner|warning|policy|`/.test(line)) return true;
  if (checkName === "package hook execution" && /blocked|scan|scanner|policy|documentation|does not execute|will not execute/i.test(line)) return true;
  if (["runtime eval", "Function constructor", "process exec", "process spawn", "Node child process"].includes(checkName) && /pattern|grep|scan|scanner|does not execute|will not execute/i.test(line)) return true;
  if (normalized.includes("Legal/legalPolicyPages.ts") && /policy|prohibited|do not|vulnerability|security/i.test(line)) return true;
  return false;
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (includeExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const failures = [];
for (const root of roots) {
  try {
    for (const file of await listFiles(root)) {
      const text = await fs.readFile(file, "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        for (const check of checks) {
          if (check.pattern.test(line) && !allowHit(file, line, check.name)) failures.push(`${file}:${index + 1}: ${check.name}: ${line.trim()}`);
        }
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (failures.length) {
  console.error(`Security smoke test failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("Security smoke test ok.");

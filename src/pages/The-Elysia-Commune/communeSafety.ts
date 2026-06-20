export const communeReportReasons = [
  "spam",
  "harassment",
  "unsafe_code",
  "secret_or_private_data",
  "misinformation",
  "copyright_or_license",
  "malware_or_suspicious",
  "privacy_violation",
  "other"
] as const;

export const communeFallbackCategories = [
  { slug: "general", title: "General", description: "Public community discussion and updates." },
  { slug: "troubleshooting", title: "Troubleshooting", description: "Redacted help requests and solved notes." },
  { slug: "repositories", title: "Repositories", description: "Repository showcases and metadata-only project notes." },
  { slug: "living-library", title: "Living Library", description: "Source, citation, and public knowledge discussions." },
  { slug: "developer-forge", title: "Developer Forge", description: "Add-on development questions and review preparation." },
  { slug: "marketplace-addons", title: "Marketplace Add-ons", description: "Add-on ideas, trust labels, and local-install boundaries." },
  { slug: "field-notes", title: "Field Notes", description: "Ecological observations safe for public sharing." },
  { slug: "announcements", title: "Announcements", description: "Official or reviewed public updates." },
  { slug: "questions", title: "Questions", description: "General questions for the public commons." },
  { slug: "safety-and-boundaries", title: "Safety and Boundaries", description: "Privacy, moderation, and consent discussions." }
] as const;

export const allowedCommuneImageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
export const allowedCommuneTextExtensions = new Set(["txt", "md", "json", "csv"]);
export const blockedCommuneUploadExtensions = new Set(["env", "pem", "key", "p12", "pfx", "crt", "cer", "exe", "dll", "dylib", "so", "sh", "bash", "zsh", "bat", "cmd", "ps1", "zip", "tar", "gz", "tgz", "7z", "rar"]);

export const MAX_COMMUNE_TAGS = 12;
export const MAX_COMMUNE_TAG_LENGTH = 32;

export type CommuneSecretScanResult = {
  blocked: boolean;
  warnings: string[];
};

export type CommuneMediaValidationResult = {
  ok: boolean;
  mediaKind: "image" | "code_text" | "document" | "archive" | "other";
  message: string;
};

const secretPatterns: { label: string; pattern: RegExp; blocks: boolean }[] = [
  { label: ".env content or filename", pattern: /(^|[\/\\\s])\.env(\b|$)/i, blocks: true },
  { label: "service-role secret", pattern: /SUPABASE_SERVICE_ROLE|service_role/i, blocks: true },
  { label: "private key material", pattern: /BEGIN [A-Z ]*PRIVATE KEY/i, blocks: true },
  { label: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{12,}/i, blocks: true },
  { label: "API key wording", pattern: /\b(API_KEY|SECRET|TOKEN|PASSWORD|AWS_ACCESS_KEY_ID)\b/i, blocks: true },
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/i, blocks: true },
  { label: "absolute local path", pattern: /(^|[\s"'=:])(\/home\/|C:\\|[A-Z]:\\|~\/)/i, blocks: false },
  { label: "vault or credentials wording", pattern: /\b(vault|credentials?)\b/i, blocks: false }
];

export function scanCommuneTextForSecrets(text: string): CommuneSecretScanResult {
  const warnings = secretPatterns.filter((item) => item.pattern.test(text)).map((item) => item.label);
  return { blocked: secretPatterns.some((item) => item.blocks && item.pattern.test(text)), warnings };
}

export function validateCommuneMediaFile(file: Pick<File, "name" | "size" | "type">): CommuneMediaValidationResult {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const nameScan = scanCommuneTextForSecrets(file.name);
  if (nameScan.blocked) return { ok: false, mediaKind: "other", message: "Unsafe filename blocked. Do not upload .env, credentials, tokens, private keys, or secret-bearing files." };
  if (blockedCommuneUploadExtensions.has(ext)) return { ok: false, mediaKind: ext === "zip" || ext === "tar" || ext === "gz" || ext === "tgz" || ext === "7z" || ext === "rar" ? "archive" : "other", message: "This file type is blocked for public community upload. Use text snippets or metadata-only review requests instead." };
  if (allowedCommuneImageExtensions.has(ext)) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, mediaKind: "image", message: "Images must be 5 MB or smaller." };
    return { ok: true, mediaKind: "image", message: "Image file accepted for private moderation intake. It is not public by default." };
  }
  if (allowedCommuneTextExtensions.has(ext)) {
    if (file.size > 100 * 1024) return { ok: false, mediaKind: "code_text", message: "Text/code snippets must be 100 KB or smaller." };
    return { ok: true, mediaKind: "code_text", message: "Text/code file accepted for inert display or moderation review." };
  }
  if (ext === "pdf") {
    if (file.size > 5 * 1024 * 1024) return { ok: false, mediaKind: "document", message: "PDF documents must be 5 MB or smaller." };
    return { ok: true, mediaKind: "document", message: "PDF metadata is allowed for moderation review, not public display by default." };
  }
  return { ok: false, mediaKind: "other", message: "Unsupported Commune upload type." };
}

export function inertCodeSnippetLabel(language: string) {
  return language.trim() || "plain text";
}

export function normalizeCommuneTag(value: string) {
  const normalized = value
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_COMMUNE_TAG_LENGTH);
  return normalized || null;
}

export function parseCommuneTags(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : [value ?? ""];
  const parsed = values.flatMap((item) => {
    if (!item.trim()) return [];
    if (/[,;\n]/.test(item)) return item.split(/[,;\n]+/);
    return item.split(/\s+/);
  });
  const tags = parsed
    .map(normalizeCommuneTag)
    .filter((tag): tag is string => Boolean(tag));
  return Array.from(new Set(tags)).slice(0, MAX_COMMUNE_TAGS);
}

export function formatCommuneTag(tag: string) {
  const normalized = normalizeCommuneTag(tag);
  return normalized ? `#${normalized}` : "";
}

export function formatCommuneTags(tags: string[] | string | null | undefined) {
  return parseCommuneTags(tags).map(formatCommuneTag).filter(Boolean);
}

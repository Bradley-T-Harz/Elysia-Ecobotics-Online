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
  hardSecretHit: boolean;
  warningOnlyHit: boolean;
  safetyInstructionHit: boolean;
  reasons: string[];
  warnings: string[];
};

export type CommuneMediaValidationResult = {
  ok: boolean;
  mediaKind: "image" | "code_text" | "document" | "archive" | "other";
  message: string;
};

const hardSecretPatterns: { label: string; pattern: RegExp }[] = [
  { label: "sensitive key/value assignment", pattern: /^\s*["']?(?:[A-Z][A-Z0-9_]*_)?(?:OPENAI_API_KEY|CLOUDFLARE_API_TOKEN|API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|DATABASE[_-]?URL|AWS_ACCESS_KEY_ID)(?:_[A-Z0-9]+)?["']?\s*[:=]\s*["']?[^\r\n]*/im },
  { label: "service-role secret assignment", pattern: /^\s*["']?SUPABASE[_-]?SERVICE[_-]?ROLE(?:[_-]?KEY)?["']?\s*[:=]\s*["']?[^\r\n]*/im },
  { label: "private key material", pattern: /BEGIN [A-Z ]*PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY/i },
  { label: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{12,}/i },
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/i },
  { label: "authorization bearer token", pattern: /^\s*Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}/im }
];

const secretReferencePatterns: { label: string; pattern: RegExp }[] = [
  { label: ".env file reference", pattern: /(^|[\/\\\s`"'])\.env(\b|$)/i },
  { label: "API key reference", pattern: /\b(?:API\s+keys?|API[_-]?KEYS?)\b/i },
  { label: "service-role key reference", pattern: /\bservice[-_\s]?role\s+keys?\b|SUPABASE_SERVICE_ROLE(?:_KEY)?\b|service_role\b/i },
  { label: "token reference", pattern: /\b(?:access\s+tokens?|auth(?:entication)?\s+tokens?|tokens?)\b/i },
  { label: "password reference", pattern: /\bpasswords?\b/i },
  { label: "secret reference", pattern: /\bsecrets?\b/i },
  { label: "private log reference", pattern: /\bprivate\s+(?:machine\s+|local\s+)?logs?\b/i },
  { label: "vault reference", pattern: /\bvault(?:\s+(?:data|material|content|files?))?\b/i },
  { label: "credentials reference", pattern: /\bcredentials?\b/i },
  { label: "absolute local path", pattern: /(^|[\s"'=:])(\/home\/|C:\\|[A-Z]:\\|~\/)/i }
];

const secretSafetyInstructionPatterns = [
  /\b(?:do not|don't|never|should not|please do not|avoid)\s+(?:\w+\s+){0,6}(?:upload(?:ed)?|share(?:d)?|post(?:ed|ing)?|paste|include|expose|publish|send)\b/i,
  /\busers?\s+should\s+not\b/i,
  /\bredact(?:ed|ing|ion)?\b/i,
  /\bremove\b.{0,80}\bbefore\s+post(?:ing)?\b/i,
  /\bprivate\s+files?\s+should\s+not\s+be\s+posted\b/i,
  /\bAPI\s+keys?\s+should\s+not\s+be\s+shared\b/i
];

function matchedSecretLabels(patterns: { label: string; pattern: RegExp }[], text: string) {
  return patterns.filter((item) => item.pattern.test(text)).map((item) => item.label);
}

function uniqueSecretLabels(labels: string[]) {
  return Array.from(new Set(labels));
}

export function hasHardSecretMaterial(text: string) {
  return hardSecretPatterns.some((item) => item.pattern.test(text));
}

export function containsSecretSafetyInstruction(text: string) {
  return secretSafetyInstructionPatterns.some((pattern) => pattern.test(text));
}

export function classifyCommuneSecretRisk(text: string): CommuneSecretScanResult {
  const hardReasons = matchedSecretLabels(hardSecretPatterns, text);
  const warningReasons = matchedSecretLabels(secretReferencePatterns, text);
  const reasons = uniqueSecretLabels([...hardReasons, ...warningReasons]);
  const hardSecretHit = hardReasons.length > 0;
  const warningOnlyHit = !hardSecretHit && warningReasons.length > 0;
  return {
    blocked: hardSecretHit,
    hardSecretHit,
    warningOnlyHit,
    safetyInstructionHit: containsSecretSafetyInstruction(text),
    reasons,
    warnings: reasons
  };
}

export function isWarningOnlySecretReference(text: string) {
  const risk = classifyCommuneSecretRisk(text);
  return risk.warningOnlyHit && risk.safetyInstructionHit;
}

export function scanCommuneTextForSecrets(text: string): CommuneSecretScanResult {
  return classifyCommuneSecretRisk(text);
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

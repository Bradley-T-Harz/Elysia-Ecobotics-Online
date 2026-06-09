import type { ActionKind, AddonManifest } from "../types";

const allowedActionKinds: ActionKind[] = [
  "python_package_install",
  "python_package_uninstall",
  "docker_compose_setup",
  "docker_compose_start",
  "docker_compose_stop",
  "docker_compose_restart",
  "config_toggle",
  "open_external_manager",
  "manual_instruction",
  "setup_script"
];

const forbiddenExactKeys = new Set([
  "secret",
  "secrets",
  "token",
  "tokens",
  "password",
  "password_value",
  "local_elysia_password",
  "private_key",
  "private_keys",
  "shell",
  "shell_command",
  "command",
  "commands",
  "bash",
  "sudo"
]);

const allowedSecurityKeys = new Set([
  "operator_only",
  "model_accessible",
  "chat_accessible",
  "memory_promotion_allowed",
  "outward_sharing_allowed",
  "local_file_access",
  "outward_sharing_risk"
]);

export function normalizeAddonId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    const normalized = key.toLowerCase();
    return forbiddenExactKeys.has(normalized) || hasForbiddenKey(child);
  });
}

export function validateAddonManifest(value: unknown): {
  ok: boolean;
  errors: string[];
  manifest?: AddonManifest;
} {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Manifest must be a JSON object."] };
  }

  const manifest = value as Partial<AddonManifest>;
  const required: (keyof AddonManifest)[] = [
    "schema_version", "id", "name", "publisher", "version", "category", "summary", "description",
    "trust_tier", "local_only", "network_access", "dependencies", "actions", "security", "tags"
  ];
  required.forEach((key) => {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      errors.push(`Missing required field: ${String(key)}`);
    }
  });

  if (typeof manifest.id === "string" && manifest.id !== normalizeAddonId(manifest.id)) {
    errors.push("id must be a lowercase slug using letters, numbers, and hyphens.");
  }

  if (!Array.isArray(manifest.dependencies)) {
    errors.push("dependencies must be an array.");
  }

  if (!Array.isArray(manifest.tags)) {
    errors.push("tags must be an array.");
  }

  if (!Array.isArray(manifest.actions)) {
    errors.push("actions must be an array.");
  } else {
    manifest.actions.forEach((action, index) => {
      if (!allowedActionKinds.includes(action.action_kind)) {
        errors.push(`actions[${index}].action_kind is not allowed.`);
      }
      if (action.allowed && !action.requires_local_operator_password) {
        errors.push(`actions[${index}] must require local operator password before future local execution.`);
      }
      if (!Array.isArray(action.notes)) {
        errors.push(`actions[${index}].notes must be an array.`);
      }
    });
  }

  if (!manifest.security) {
    errors.push("security block is required.");
  } else {
    const security = manifest.security;
    if (security.model_accessible !== false) errors.push("security.model_accessible must be false for marketplace plans.");
    if (security.chat_accessible !== false) errors.push("security.chat_accessible must be false for marketplace plans.");
    if (security.memory_promotion_allowed !== false) errors.push("security.memory_promotion_allowed must be false.");
    if (security.outward_sharing_allowed !== false) errors.push("security.outward_sharing_allowed must be false unless a later reviewed policy changes it.");
    Object.keys(security).forEach((key) => {
      if (!allowedSecurityKeys.has(key)) errors.push(`security.${key} is not part of the MVP manifest contract.`);
    });
  }

  if (hasForbiddenKey(value)) {
    errors.push("Manifest contains forbidden secret/token/password/shell-style fields.");
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], manifest: manifest as AddonManifest };
}

export function manifestToSubmissionPayload(manifest: AddonManifest): unknown {
  return {
    slug: manifest.id,
    name: manifest.name,
    category: manifest.category,
    summary: manifest.summary,
    version: manifest.version,
    manifest
  };
}

export const localElysiaManifestName = "manifest.json";
export const localElysiaCanonicalSchema = "1.1";
export const localElysiaLegacySchema = "1.0";

export type LocalElysiaManifestAssessment = {
  schemaVersion: string;
  status: "canonical_candidate" | "legacy_revalidation_required" | "incompatible" | "unreadable";
  summary: string;
  issues: string[];
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function populatedRecord(value: unknown) {
  const parsed = record(value);
  return parsed && Object.keys(parsed).length ? parsed : null;
}

export function assessLocalElysiaManifest(value: unknown): LocalElysiaManifestAssessment {
  const manifest = record(value);
  if (!manifest) return { schemaVersion: "unknown", status: "unreadable", summary: "manifest.json must contain a JSON object.", issues: ["manifest_not_object"] };
  const schemaVersion = typeof manifest.schema_version === "string" ? manifest.schema_version : "missing";
  if (schemaVersion === localElysiaLegacySchema) {
    return {
      schemaVersion,
      status: "legacy_revalidation_required",
      summary: "Legacy website schema 1.0 can be reviewed, but Local Elysia applies deny-by-default compatibility values and performs final validation before install or enablement.",
      issues: []
    };
  }
  if (schemaVersion !== localElysiaCanonicalSchema) {
    return { schemaVersion, status: "incompatible", summary: `Local Elysia does not declare schema ${schemaVersion} as its canonical v1 package contract.`, issues: ["unsupported_schema_version"] };
  }

  const issues: string[] = [];
  for (const field of ["addon_id", "name", "version"] as const) if (typeof manifest[field] !== "string" || !manifest[field].trim()) issues.push(`missing_${field}`);
  const publisher = record(manifest.publisher);
  if (!publisher || typeof publisher.name !== "string" || !publisher.name.trim()) issues.push("missing_publisher_name");
  const compatibility = record(manifest.compatibility);
  if (!compatibility || typeof compatibility.min_elysia_version !== "string" || typeof compatibility.addon_api_version !== "string") issues.push("invalid_compatibility");
  if (!Array.isArray(manifest.required_profiles) || manifest.required_profiles.some((item) => typeof item !== "string")) issues.push("invalid_required_profiles");
  if (!populatedRecord(manifest.entrypoints)) issues.push("invalid_entrypoints");
  const bridge = record(manifest.bridge);
  if (!bridge || typeof bridge.protocol !== "string" || typeof bridge.contract_version !== "string") issues.push("invalid_bridge");
  if (bridge?.execution_enabled === true) issues.push("manifest_self_enables_execution");
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some((item) => !record(item) || typeof record(item)?.key !== "string" || typeof record(item)?.reason !== "string")) issues.push("invalid_permissions");
  for (const [field, allowed] of [
    ["network_policy", new Set(["deny", "deny_by_default", "disabled"])],
    ["filesystem_policy", new Set(["deny", "project_scoped"])],
    ["memory_policy", new Set(["deny"])],
    ["model_provider_policy", new Set(["deny"])],
    ["tool_worker_policy", new Set(["deny"])],
  ] as const) {
    const policy = record(manifest[field]);
    if (!policy || typeof policy.default !== "string" || !allowed.has(policy.default)) issues.push(`invalid_${field}`);
  }
  for (const field of ["execution", "sandbox", "license", "provenance", "signing", "checksums"] as const) if (!record(manifest[field])) issues.push(`invalid_${field}`);
  for (const field of ["external_services", "dependencies", "binaries"] as const) if (!Array.isArray(manifest[field])) issues.push(`invalid_${field}`);

  return issues.length
    ? { schemaVersion, status: "incompatible", summary: "Schema 1.1 was declared, but required Local Elysia contract fields are missing or unsafe.", issues }
    : { schemaVersion, status: "canonical_candidate", summary: "Canonical Local Elysia schema 1.1 shape detected. Marketplace review is not install approval; Local Elysia still performs final validation before install or enablement.", issues: [] };
}

export function assessLocalElysiaManifestText(text: string): LocalElysiaManifestAssessment {
  try { return assessLocalElysiaManifest(JSON.parse(text)); }
  catch { return { schemaVersion: "unreadable", status: "unreadable", summary: "manifest.json is not valid JSON.", issues: ["invalid_manifest_json"] }; }
}

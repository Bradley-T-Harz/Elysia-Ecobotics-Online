import type { AddonManifest, RiskLevel, TrustTier } from "../types";

export function trustTierLabel(tier: TrustTier): string {
  const labels: Record<TrustTier, string> = {
    official: "Official",
    reviewed: "Reviewed",
    community: "Community",
    unreviewed: "Unreviewed",
    deprecated: "Deprecated",
    blocked: "Blocked"
  };
  return labels[tier];
}

export function trustTierDescription(tier: TrustTier): string {
  const descriptions: Record<TrustTier, string> = {
    official: "Maintained or curated by EcoSyneva Commons.",
    reviewed: "Reviewed against current marketplace policy.",
    community: "Community entry with visible risk labels.",
    unreviewed: "Not yet reviewed. Treat as planning material only.",
    deprecated: "No longer recommended for new installs.",
    blocked: "Blocked by review or safety policy."
  };
  return descriptions[tier];
}

export function riskLevelLabel(risk: RiskLevel): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

export function toneForTrustTier(tier: TrustTier): "official" | "safe" | "warning" | "danger" | "neutral" {
  if (tier === "official") return "official";
  if (tier === "reviewed" || tier === "community") return "safe";
  if (tier === "blocked") return "danger";
  if (tier === "deprecated" || tier === "unreviewed") return "warning";
  return "neutral";
}

export function toneForRisk(risk: RiskLevel): "official" | "safe" | "warning" | "danger" | "neutral" {
  if (risk === "low") return "safe";
  if (risk === "moderate" || risk === "unknown") return "warning";
  return "danger";
}

export function permissionLabels(manifest: AddonManifest): string[] {
  const labels = [manifest.local_only ? "Local-only plan" : "Network boundary"];
  if (manifest.network_access) labels.push("Network access declared");
  if (manifest.dependencies.some((dependency) => dependency.ecosystem === "python")) {
    labels.push("Uses Python package manager later");
  }
  if (manifest.dependencies.some((dependency) => dependency.ecosystem === "service" || dependency.source === "docker")) {
    labels.push("Uses local service / Docker later");
  }
  if (manifest.security.local_file_access !== "none") labels.push("Local file access declared");
  if (manifest.actions.some((action) => action.requires_local_operator_password)) {
    labels.push("Requires local Elysia operator password later");
  }
  labels.push("Website does not install locally");
  return labels;
}

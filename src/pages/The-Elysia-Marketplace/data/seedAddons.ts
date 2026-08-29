import type { AddonManifest } from "../types";

/**
 * Static catalog content is intentionally limited to truthful official releases.
 * Core/profile dependencies are not Marketplace add-ons and must not reappear here.
 */
export const codevOfficialRelease: AddonManifest = {
  schema_version: "1.0",
  id: "elysia-codev",
  name: "Codev",
  publisher: "EcoSyneva Commons LLC / Elysia Ecobotics",
  version: "1.0.0",
  category: "Developer Tools",
  summary: "Official v1.0 VS Code extension for Elysia's governed local developer workflows.",
  description: "Codev is the official Developer-profile VS Code companion for approved repository context, patch proposals, exact approved mutations, and bounded command/test checks. The Website provides the exact release download; Local Elysia and VS Code retain installation, workspace-trust, repository-approval, and execution authority.",
  trust_tier: "official",
  local_only: true,
  network_access: false,
  dependencies: [],
  actions: [
    {
      action_key: "developer_profile_review",
      action_label: "Review Developer profile requirements",
      action_kind: "manual_instruction",
      allowed: true,
      risk_level: "high",
      requires_local_operator_password: true,
      network_access: false,
      notes: [
        "Requires the Elysia Developer profile and a compatible local Codev extension.",
        "Repository access is explicit and bounded to an approved root.",
        "Patch mutation and command checks require exact approval and receipts.",
        "No hidden shell, silent push, silent publish, or cloud upload authority."
      ]
    }
  ],
  security: {
    operator_only: true,
    model_accessible: false,
    chat_accessible: false,
    memory_promotion_allowed: false,
    outward_sharing_allowed: false,
    local_file_access: "project_scope",
    outward_sharing_risk: "No cloud upload is declared. Repository context remains subject to explicit local approval."
  },
  tags: ["official-release", "developer-profile", "vscode", "codev", "v1.0"],
  homepage_url: "https://elysiaecobotics.com/marketplace/browse",
  source_url: "https://github.com/Bradley-T-Harz/elysia-codev",
  license: "Apache-2.0",
  status: "available",
  signature_status: "release_manifest_signed",
  package_sha256: "5cbb9298e0d9f56797b95854e4cf07db84fe2d7fc00deb7bc3364d503451f6ff",
  package_url: "https://github.com/Bradley-T-Harz/elysia-codev/releases/download/v1.0.0/elysia-codev-1.0.0.vsix",
  listing_stage: "official_release"
};

export const seedAddons: AddonManifest[] = [codevOfficialRelease];

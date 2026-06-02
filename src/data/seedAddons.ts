import type { AddonCategory, AddonManifest, TrustTier } from "../types";

function addon(input: {
  id: string;
  name: string;
  category: AddonCategory;
  summary: string;
  description: string;
  trust_tier: TrustTier;
  local_only: boolean;
  network_access: boolean;
  tags: string[];
  dependency?: { ecosystem: string; package_name: string; source?: string; version_constraint?: string };
  action_kind?: AddonManifest["actions"][number]["action_kind"];
  risk?: AddonManifest["actions"][number]["risk_level"];
  status?: AddonManifest["status"];
}): AddonManifest {
  const dependency = input.dependency;
  const actionKind = input.action_kind ?? "manual_instruction";
  return {
    schema_version: "0.1",
    id: input.id,
    name: input.name,
    publisher: input.trust_tier === "official" ? "EcoSyneva Commons" : "Community ecosystem",
    version: "0.1.0",
    category: input.category,
    summary: input.summary,
    description: input.description,
    trust_tier: input.trust_tier,
    local_only: input.local_only,
    network_access: input.network_access,
    dependencies: dependency
      ? [{ ...dependency, required: true }]
      : [],
    actions: [
      {
        action_key: "prepare_install",
        action_label: "Prepare install plan",
        action_kind: actionKind,
        allowed: true,
        risk_level: input.risk ?? (input.network_access ? "moderate" : "low"),
        requires_local_operator_password: true,
        network_access: input.network_access,
        notes: [
          "Marketplace only prepares this action.",
          "Local Elysia must validate and approve before any local change.",
          "No install occurs from the website."
        ]
      },
      {
        action_key: "manual_review",
        action_label: "Manual security review",
        action_kind: "manual_instruction",
        allowed: true,
        risk_level: input.trust_tier === "unreviewed" ? "high" : "moderate",
        requires_local_operator_password: true,
        network_access: false,
        notes: ["Review manifest, permissions, dependency source, and rollback story before use."]
      }
    ],
    security: {
      operator_only: true,
      model_accessible: false,
      chat_accessible: false,
      memory_promotion_allowed: false,
      outward_sharing_allowed: false,
      local_file_access: "none",
      outward_sharing_risk: input.network_access
        ? "This add-on may cross the public network boundary after local approval."
        : "No outward sharing is declared by the manifest."
    },
    tags: input.tags,
    homepage_url: "https://elysia-marketplace.example/addons/" + input.id,
    source_url: "https://example.com/" + input.id,
    license: "Review required",
    status: input.status ?? "available"
  };
}

export const seedAddons: AddonManifest[] = [
  addon({ id: "advanced-pdf-parser", name: "Advanced PDF Parser", category: "Files", summary: "Optional richer local PDF text extraction.", description: "Prepares a local pdfplumber dependency plan for Elysia file ingestion. It is not a browser upload and does not read local files from the website.", trust_tier: "official", local_only: true, network_access: false, tags: ["pdf", "files", "parser", "local"], dependency: { ecosystem: "python", package_name: "pdfplumber", source: "pypi", version_constraint: ">=0.11" }, action_kind: "python_package_install", risk: "moderate" }),
  addon({ id: "docx-parser", name: "DOCX Parser", category: "Files", summary: "Optional local DOCX text extraction support.", description: "Prepares a python-docx dependency plan for local Elysia. Website users only save the plan.", trust_tier: "official", local_only: true, network_access: false, tags: ["docx", "files", "parser"], dependency: { ecosystem: "python", package_name: "python-docx", source: "pypi" }, action_kind: "python_package_install", risk: "moderate" }),
  addon({ id: "spreadsheet-reader", name: "Spreadsheet Reader", category: "Files", summary: "Optional local XLSX/CSV helper path.", description: "Prepares openpyxl support for local spreadsheet summaries and artifact proof.", trust_tier: "official", local_only: true, network_access: false, tags: ["xlsx", "csv", "data"], dependency: { ecosystem: "python", package_name: "openpyxl", source: "pypi" }, action_kind: "python_package_install" }),
  addon({ id: "ocr-parser-planned", name: "OCR Parser", category: "Files", summary: "Planned OCR path for scanned documents.", description: "Marked as security review needed because OCR engines can be large and format-sensitive.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["ocr", "planned", "files"], status: "security_hold", risk: "high" }),
  addon({ id: "searxng-research", name: "SearXNG Research", category: "Research / Web", summary: "Bounded public web research through local SearXNG.", description: "Prepares the local SearXNG research lane. Query terms may leave local control once local Elysia approves research use.", trust_tier: "official", local_only: false, network_access: true, tags: ["research", "searxng", "public-web"], dependency: { ecosystem: "service", package_name: "SearXNG_Local", source: "docker" }, action_kind: "docker_compose_setup", risk: "moderate" }),
  addon({ id: "fetch-worker", name: "Fetch Worker", category: "Research / Web", summary: "Request-specific URL fetch contract.", description: "Future bounded fetch add-on. No crawling, browser automation, login scraping, or private IP fetches.", trust_tier: "reviewed", local_only: false, network_access: true, tags: ["fetch", "evidence", "boundary"], action_kind: "manual_instruction", risk: "high" }),
  addon({ id: "evidence-verifier", name: "Evidence Verifier", category: "Research / Web", summary: "Evidence packet verification and confidence notes.", description: "Structures source snippets as evidence candidates, not proof. Local Elysia remains responsible for verification.", trust_tier: "official", local_only: true, network_access: false, tags: ["evidence", "truth", "research"] }),
  addon({ id: "contradiction-scan", name: "Contradiction Scan", category: "Research / Web", summary: "Flags contradictory evidence packet claims.", description: "Local analysis helper for bounded research outputs.", trust_tier: "official", local_only: true, network_access: false, tags: ["evidence", "contradictions"] }),
  addon({ id: "ollama-local-models", name: "Ollama Local Models", category: "Models", summary: "Local model role wrappers and routing posture.", description: "Catalog entry for local Ollama model support. Does not download models from the marketplace.", trust_tier: "official", local_only: true, network_access: false, tags: ["ollama", "models", "local"] }),
  addon({ id: "model-role-router", name: "Model Role Router", category: "Models", summary: "Routing posture for model roles.", description: "Documents role routing and fallback truth. Modes do not grant authority.", trust_tier: "official", local_only: true, network_access: false, tags: ["routing", "roles"] }),
  addon({ id: "external-model-comparison", name: "External Model Comparison", category: "Models", summary: "Privacy-warning comparison notes for future external model checks.", description: "Future optional cloud comparison. Requires explicit approval and must avoid identity-bearing private context.", trust_tier: "unreviewed", local_only: false, network_access: true, tags: ["cloud", "comparison", "privacy"], risk: "high", status: "security_hold" }),
  addon({ id: "rstudio-integration", name: "RStudio Integration", category: "Data / Science", summary: "Presence and workflow guidance for RStudio.", description: "Prepares local operator guidance for RStudio without launching or installing it from the website.", trust_tier: "community", local_only: true, network_access: false, tags: ["r", "rstudio", "science"], action_kind: "open_external_manager" }),
  addon({ id: "jupyter-bridge", name: "Jupyter Bridge", category: "Data / Science", summary: "Planned governed notebook bridge.", description: "Future local notebook bridge. Not a live remote execution grant.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["jupyter", "notebook"], status: "pending_review", risk: "high" }),
  addon({ id: "qgis-integration", name: "QGIS Integration", category: "GIS", summary: "Local GIS workflow awareness.", description: "Catalogs QGIS as a local external manager. No GIS install or local project scan happens on the website.", trust_tier: "community", local_only: true, network_access: false, tags: ["gis", "qgis", "maps"], action_kind: "open_external_manager" }),
  addon({ id: "gdal-geo-stack", name: "GDAL Geo Stack", category: "GIS", summary: "Geospatial dependency family planning.", description: "High-surface dependency stack for later local operator review.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["gdal", "geospatial"], risk: "high", status: "security_hold" }),
  addon({ id: "postgis", name: "PostGIS", category: "GIS", summary: "Spatial database integration planning.", description: "Future database-backed GIS workflows. No database credentials are collected here.", trust_tier: "unreviewed", local_only: false, network_access: true, tags: ["postgis", "database"], risk: "high" }),
  addon({ id: "syft-sbom-scanner", name: "Syft SBOM Scanner", category: "Security", summary: "Local SBOM scanner presence and install plan.", description: "Prepares a future local software bill of materials workflow. Inventory never uploads by default.", trust_tier: "community", local_only: true, network_access: false, tags: ["sbom", "security", "inventory"], risk: "moderate" }),
  addon({ id: "grype-vulnerability-scanner", name: "Grype Vulnerability Scanner", category: "Security", summary: "Local vulnerability scan planning.", description: "May require vulnerability DB updates. Local Elysia must surface outward network truth before use.", trust_tier: "community", local_only: false, network_access: true, tags: ["security", "vulnerabilities"], risk: "high" }),
  addon({ id: "searxng-local-service", name: "SearXNG Local Service", category: "Services", summary: "Local service posture for SearXNG.", description: "Documents the local service dependency without controlling Docker from the website.", trust_tier: "official", local_only: false, network_access: true, tags: ["service", "docker", "research"], action_kind: "docker_compose_setup" }),
  addon({ id: "docker-compose-service-manager", name: "Docker Compose Service Manager", category: "Services", summary: "Future governed service manager lane.", description: "High-risk service controls remain local, password-gated, and not website-executed.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["docker", "services"], risk: "high", status: "security_hold" }),
  addon({ id: "local-artifact-registry", name: "Local Artifact Registry", category: "Services", summary: "Visible local artifact plane companion.", description: "Catalog entry for local artifact browsing and metadata, not remote artifact upload.", trust_tier: "official", local_only: true, network_access: false, tags: ["artifacts", "local"] }),
  addon({ id: "vscode-integration", name: "VS Code Integration", category: "Developer Tools", summary: "Operator workflow guidance for VS Code.", description: "External manager presence and future handoff plan. Does not mutate files from the website.", trust_tier: "reviewed", local_only: true, network_access: false, tags: ["developer", "editor", "vscode"], action_kind: "open_external_manager" }),
  addon({ id: "codex-workflow-helper", name: "Codex Workflow Helper", category: "Developer Tools", summary: "Prompt/report helper for governed implementation flows.", description: "Human workflow helper only. It is not an autonomous coding agent.", trust_tier: "community", local_only: true, network_access: false, tags: ["codex", "workflow"] }),
  addon({ id: "aider-worker", name: "Aider Worker", category: "Developer Tools", summary: "Dry-run/proposal worker catalog entry.", description: "Aider integration remains governed and must not mutate without explicit local approval.", trust_tier: "official", local_only: true, network_access: false, tags: ["coder", "aider", "dry-run"], risk: "moderate" }),
  addon({ id: "patch-worker", name: "Patch Worker", category: "Developer Tools", summary: "Approved local patch application plan.", description: "Patch application belongs to local Elysia only, behind exact approval, diff preview, path guard, and rollback notes.", trust_tier: "official", local_only: true, network_access: false, tags: ["patch", "approval", "local"], risk: "high" }),
  addon({ id: "command-worker", name: "Command Worker", category: "Developer Tools", summary: "Approved focused command execution plan.", description: "Only exact local allowlisted commands may run later inside local Elysia. The website never executes commands.", trust_tier: "official", local_only: true, network_access: false, tags: ["tests", "commands", "approval"], risk: "high" }),
  addon({ id: "opendronemap", name: "OpenDroneMap", category: "Robotics / Field", summary: "Photogrammetry workflow planning.", description: "Future local field-data workflow. No drone control or file upload happens here.", trust_tier: "community", local_only: true, network_access: false, tags: ["drone", "photogrammetry"], risk: "high" }),
  addon({ id: "ros-bridge", name: "ROS Bridge", category: "Robotics / Field", summary: "Future robotics bridge contract.", description: "Robotics control authority is not live. This entry is review-first.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["ros", "robotics"], status: "security_hold", risk: "critical" }),
  addon({ id: "audiomoth-field-tools", name: "AudioMoth Field Tools", category: "Robotics / Field", summary: "Ecoacoustic field data helpers.", description: "Future local audio metadata and file workflow helpers. No audio is uploaded by this website.", trust_tier: "community", local_only: true, network_access: false, tags: ["audio", "ecology", "field"], risk: "moderate" }),
  addon({ id: "trail-camera-data-tools", name: "Trail Camera Data Tools", category: "Robotics / Field", summary: "Local wildlife image sorting workflow planning.", description: "Future local-only image workflow. Vision/camera powers are not granted here.", trust_tier: "unreviewed", local_only: true, network_access: false, tags: ["camera", "field", "ecology"], risk: "high" })
];

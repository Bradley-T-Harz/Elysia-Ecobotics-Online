
import { defaultManifestForTemplate } from "./developerForgeValidator";
import type { ForgeManifest } from "./developerForgeValidator";

export type ForgeTemplate = {
  id: string;
  name: string;
  summary: string;
  risk: "low" | "medium" | "high";
  manifest: ForgeManifest;
  readme: string;
  license: string;
  changelog: string;
  fileList: string[];
};

function template(id: string, name: string, summary: string, overrides: Partial<ForgeManifest>, fileList: string[], risk: "low" | "medium" | "high" = "low"): ForgeTemplate {
  const manifest = { ...defaultManifestForTemplate(`developer.${id}`, name), ...overrides };
  return {
    id,
    name,
    summary,
    risk,
    manifest,
    readme: `# ${name}\n\n${summary}\n\nThis starter is metadata only. The public website does not execute add-on code or install it into local Elysia.`,
    license: "MIT placeholder. Replace with the license you actually intend to use.",
    changelog: `# Changelog\n\n## 0.1.0\n- Initial Developer Forge draft.`,
    fileList
  };
}

export const forgeTemplates: ForgeTemplate[] = [
  template("theme-pack", "Theme Pack", "A visual theme/assets pack with no runtime execution.", { runtime: { kind: "theme", requires_network: false, requires_filesystem: false }, permissions: ["theme_assets_read"] }, ["manifest.json", "README.md", "LICENSE", "CHANGELOG.md", "assets/theme.css", "assets/icon.png"]),
  template("living-library-source-pack", "Living Library Source Pack", "A curated metadata pack for public source cards.", { runtime: { kind: "static", requires_network: false, requires_filesystem: false }, permissions: ["living_library_metadata_read"] }, ["manifest.json", "README.md", "sources.json"]),
  template("documentation-helper", "Documentation Helper", "A docs/help pack that points users to public learning material.", { permissions: ["public_docs_read"] }, ["manifest.json", "README.md", "docs/guide.md"]),
  template("static-skill-manifest", "Static Skill Manifest", "A static skill manifest with explicit permissions and no code execution.", { runtime: { kind: "skill_pack", requires_network: false, requires_filesystem: false }, permissions: ["public_docs_read"] }, ["manifest.json", "README.md", "skills/example.md"]),
  template("marketplace-metadata-addon", "Marketplace Metadata Add-on", "A metadata-only add-on that augments public Marketplace information.", { permissions: ["marketplace_metadata_read"] }, ["manifest.json", "README.md", "metadata/listing.json"]),
  template("local-worker-skeleton", "Local Worker Skeleton", "A high-risk local worker placeholder requiring sandbox review before use.", { runtime: { kind: "local_worker", requires_network: false, requires_filesystem: false }, permissions: ["sandboxed_worker"], security: { sandbox_required: true, network_domains: [], file_access: [] } }, ["manifest.json", "README.md", "src/worker-placeholder.ts"], "high"),
  template("connector-stub", "Connector Stub", "A connector draft with no credentials included and network domains declared later.", { runtime: { kind: "connector", requires_network: true, requires_filesystem: false }, permissions: ["network_declared_domains"], security: { sandbox_required: true, network_domains: ["https://api.example.com"], file_access: [] } }, ["manifest.json", "README.md", "connector/README.md"], "medium")
];

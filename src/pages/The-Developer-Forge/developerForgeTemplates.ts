
import JSZip from "jszip";
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

export type ForgeTemplateFile = { path: string; contents: string };

const packageEntryDate = new Date("1980-01-01T00:00:00.000Z");

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

async function sha256Text(text: string) {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function placeholderFor(path: string, templateItem: ForgeTemplate) {
  if (path === "manifest.json") return JSON.stringify(templateItem.manifest, null, 2);
  if (path === "README.md") return templateItem.readme;
  if (path === "LICENSE") return templateItem.license;
  if (path === "CHANGELOG.md") return templateItem.changelog;
  if (path.endsWith(".json")) return JSON.stringify({ note: "Starter metadata only. Fill this file deliberately; do not include secrets or private local data." }, null, 2);
  if (path.endsWith(".css")) return "/* Theme starter. Bundle public assets only; no private local Elysia data. */\n";
  if (path.endsWith(".ts")) return "// Placeholder only. The public website does not execute this code.\n// Local Elysia must validate, sandbox, and approve any future runtime behavior.\n";
  if (path.endsWith(".md")) return `# ${templateItem.name}\n\nStarter file for ${path}. Do not include credentials, vault data, private memory, logs, or secrets.\n`;
  return "Starter placeholder. Replace intentionally; do not include secrets or private local Elysia data.\n";
}

export function buildTemplateFiles(templateItem: ForgeTemplate): ForgeTemplateFile[] {
  const starterPaths = Array.from(new Set(["manifest.json", "README.md", "LICENSE", "CHANGELOG.md", "PERMISSIONS.md", ...templateItem.fileList]));
  return starterPaths.map((path) => ({
    path,
    contents: path === "PERMISSIONS.md"
      ? [`# Permission explanation`, "", "Permissions are declarations, not grants.", "", ...(templateItem.manifest.permissions ?? []).map((permission) => `- ${permission}: explain why this is needed, what scope is expected, and why local Elysia can deny it.`), "", "Blocked permissions must not be requested."].join("\n")
      : placeholderFor(path, templateItem)
  }));
}

export async function buildTemplatePackage(templateItem: ForgeTemplate): Promise<Blob> {
  const zip = new JSZip();
  const files = buildTemplateFiles(templateItem);
  const checksums: Record<string, string> = {};
  for (const file of files) {
    zip.file(file.path, file.contents, { date: packageEntryDate });
    checksums[file.path] = await sha256Text(file.contents);
  }
  zip.file("checksums.json", JSON.stringify({ algorithm: "sha256", generated_by: "Developer Forge inert browser export", warning: "This archive is not reviewed, installed, or executed by the website. Local Elysia remains final authority.", files: checksums }, null, 2), { date: packageEntryDate });
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.elysia-addon+zip",
    platform: "UNIX",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
}

export async function buildManifestPackage(input: { id: string; name: string; manifest: ForgeManifest; readme?: string; license?: string; changelog?: string }): Promise<Blob> {
  const templateLike: ForgeTemplate = {
    id: input.id,
    name: input.name,
    summary: input.manifest.description ?? "Developer Forge draft package.",
    risk: "medium",
    manifest: input.manifest,
    readme: input.readme ?? `# ${input.name}\n\nInert Developer Forge package export. The website did not execute, install, build, or verify this add-on as safe.`,
    license: input.license ?? input.manifest.license ?? "License placeholder. Replace before submission.",
    changelog: input.changelog ?? "# Changelog\n\n## 0.1.0\n- Inert Developer Forge draft export.",
    fileList: ["manifest.json", "README.md", "LICENSE", "CHANGELOG.md", "PERMISSIONS.md"]
  };
  return buildTemplatePackage(templateLike);
}

export function templateStarterText(templateItem: ForgeTemplate) {
  return buildTemplateFiles(templateItem).map((file) => `--- ${file.path} ---\n${file.contents}`).join("\n\n");
}

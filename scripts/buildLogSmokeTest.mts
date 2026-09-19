import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildLogAreas,
  buildLogEntryTypes,
} from "../src/pages/The-Elysia-Build-Log/buildLogTypes.ts";
import {
  buildLogEntries,
  buildLogEntryForSlug,
} from "../src/pages/The-Elysia-Build-Log/buildLogEntries.ts";

const root = path.resolve(import.meta.dirname, "..");
const expectedFirstSlug = "building-elysia-in-public-without-building-a-surveillance-goblin";

assert(buildLogEntries.length >= 1, "Build Log must publish at least one entry.");

const slugs = buildLogEntries.map((entry) => entry.slug);
assert.equal(new Set(slugs).size, slugs.length, "Build Log slugs must be unique.");

for (const entry of buildLogEntries) {
  assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${entry.slug}: slug must be lowercase and URL-safe.`);
  assert(entry.title.trim().length >= 8, `${entry.slug}: title is too short.`);
  assert(entry.summary.trim().length >= 40, `${entry.slug}: summary is too short.`);
  assert.match(entry.publishedAt, /^\d{4}-\d{2}-\d{2}$/, `${entry.slug}: publishedAt must be YYYY-MM-DD.`);
  assert(!Number.isNaN(Date.parse(`${entry.publishedAt}T00:00:00Z`)), `${entry.slug}: publishedAt is invalid.`);
  assert(buildLogEntryTypes.includes(entry.type), `${entry.slug}: unknown editorial type ${entry.type}.`);
  assert(entry.areas.length >= 1, `${entry.slug}: at least one subject area is required.`);
  assert(entry.areas.every((area) => buildLogAreas.includes(area)), `${entry.slug}: unknown subject area.`);
  assert(entry.sections.length >= 1, `${entry.slug}: at least one article section is required.`);

  const sectionIds = entry.sections.map((section) => section.id);
  assert.equal(new Set(sectionIds).size, sectionIds.length, `${entry.slug}: section IDs must be unique.`);

  for (const section of entry.sections) {
    assert.match(section.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${entry.slug}: invalid section ID ${section.id}.`);
    assert(section.heading.trim().length >= 3, `${entry.slug}: section heading is too short.`);
    assert(
      Boolean(section.paragraphs?.length || section.bullets?.length),
      `${entry.slug}: section ${section.id} has no content.`,
    );
  }

  if (entry.type === "retrospective") {
    assert(entry.milestonePeriod?.trim(), `${entry.slug}: retrospective entries must state their historical milestone period.`);
  }
}

const firstEntry = buildLogEntryForSlug(expectedFirstSlug);
assert(firstEntry, "The initial Build Log entry is missing from the public registry.");
assert(
  firstEntry.relatedLinks?.some((link) => link.href === "/artisan-collective"),
  "The initial entry should preserve the canonical Online doorway to the separate Artisan Collective.",
);

const contract = JSON.parse(
  await fs.readFile(path.join(root, "docs/navigation/route-preservation-contract.json"), "utf8"),
);

function routeCanResolve(pathname: string) {
  return contract.routes.some((route: { resolvedPattern?: string | null }) => {
    const pattern = route.resolvedPattern;
    if (!pattern || pattern === "*") return false;
    if (pattern === pathname) return true;
    if (!pattern.includes(":")) return false;

    const patternParts = pattern.split("/");
    const pathParts = pathname.split("/");
    return patternParts.length === pathParts.length
      && patternParts.every((part: string, index: number) => (
        part.startsWith(":") ? Boolean(pathParts[index]) : part === pathParts[index]
      ));
  });
}

for (const entry of buildLogEntries) {
  for (const link of entry.relatedLinks ?? []) {
    if (link.external || !link.href.startsWith("/")) continue;
    const pathname = link.href.split(/[?#]/, 1)[0];
    assert(routeCanResolve(pathname), `${entry.slug}: related internal route does not resolve: ${pathname}`);
  }
}

const [
  app,
  story,
  redirects,
  sitemap,
  publicNavigation,
] = await Promise.all([
  fs.readFile(path.join(root, "src/App.tsx"), "utf8"),
  fs.readFile(path.join(root, "src/pages/The-Story-of-Elysia/index.tsx"), "utf8"),
  fs.readFile(path.join(root, "public/_redirects"), "utf8"),
  fs.readFile(path.join(root, "public/sitemap.xml"), "utf8"),
  fs.readFile(path.join(root, "src/shared/navigation/publicNavigation.ts"), "utf8"),
]);

assert(app.includes('path="build-log" element={<BuildLogPage />}'), "Build Log index route is not wired.");
assert(app.includes('path="build-log/:slug" element={<BuildLogEntryPage />}'), "Build Log detail route is not wired.");
assert(story.includes('to="/build-log"'), "Story does not contain the Build Log bridge.");
assert(redirects.includes("/build-log / 200"), "Cloudflare direct-load rewrite for /build-log is missing.");
assert(redirects.includes("/build-log/:slug / 200"), "Cloudflare detail-route rewrite is missing.");
assert.equal(
  (sitemap.match(/https:\/\/elysiaecobotics\.com\/build-log<\/loc>/g) ?? []).length,
  1,
  "Sitemap must contain exactly one canonical Build Log index URL.",
);
assert(
  !publicNavigation.includes('to: "/build-log"'),
  "Build Log must not silently alter the five-territory global navigation in this first pass.",
);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(candidate);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [candidate] : [];
  }));
  return nested.flat();
}

const buildLogSourceFiles = await sourceFiles(
  path.join(root, "src/pages/The-Elysia-Build-Log"),
);
const sourceText = (
  await Promise.all(buildLogSourceFiles.map((file) => fs.readFile(file, "utf8")))
).join("\n");

const forbiddenPatterns: Array<[RegExp, string]> = [
  [/\/home\/[A-Za-z0-9._-]+\//, "absolute local home path"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk_(?:live|test)_[A-Za-z0-9]/, "Stripe secret-key shaped value"],
  [/\bsb_(?:secret|service_role)_[A-Za-z0-9]/, "Supabase secret shaped value"],
  [/\b(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY)\s*[:=]/, "secret environment assignment"],
];

for (const [pattern, label] of forbiddenPatterns) {
  assert(!pattern.test(sourceText), `Build Log public source contains forbidden ${label}.`);
}

for (const forbiddenRuntimeCoupling of [
  "@supabase/supabase-js",
  "localStorage.",
  "sessionStorage.",
  "fetch(",
]) {
  assert(
    !sourceText.includes(forbiddenRuntimeCoupling),
    `Build Log must remain static/publication-only; found ${forbiddenRuntimeCoupling}.`,
  );
}

console.log(
  `Build Log contract ok (${buildLogEntries.length} published entr${buildLogEntries.length === 1 ? "y" : "ies"}).`,
);

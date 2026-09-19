import {
  buildingElysiaInPublicEntry,
} from "./entries/building-elysia-in-public-without-building-a-surveillance-goblin.ts";
import type {
  BuildLogArea,
  BuildLogEntry,
  BuildLogEntryType,
} from "./buildLogTypes.ts";

export const buildLogTypeLabels: Record<BuildLogEntryType, string> = {
  release: "Release",
  development: "Development",
  architecture: "Architecture",
  research: "Research",
  retrospective: "Retrospective",
  "field-notes": "Field Notes",
  community: "Community",
};

export const buildLogAreaLabels: Record<BuildLogArea, string> = {
  "elysia-core": "Elysia Core",
  "elysia-ecobotics-online": "Elysia Ecobotics Online",
  "privacy-governance": "Privacy & Governance",
  "developers-addons": "Developers & Add-ons",
  "community-commons": "Community & Commons",
  "research-ecology": "Research & Ecology",
  "artisan-creative": "Artisan & Creative",
  "ecobotics-robotics": "Ecobotics & Robotics",
};

const registeredEntries: BuildLogEntry[] = [
  buildingElysiaInPublicEntry,
];

export const buildLogEntries = [...registeredEntries].sort((left, right) => {
  const dateOrder = right.publishedAt.localeCompare(left.publishedAt);
  return dateOrder || left.title.localeCompare(right.title);
});

const entriesBySlug = new Map(
  buildLogEntries.map((entry) => [entry.slug, entry] as const),
);

export function buildLogEntryForSlug(slug: string | null | undefined) {
  if (!slug) return undefined;
  return entriesBySlug.get(slug);
}

export function formatBuildLogDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

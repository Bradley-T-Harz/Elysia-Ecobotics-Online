export const buildLogEntryTypes = [
  "release",
  "development",
  "architecture",
  "research",
  "retrospective",
  "field-notes",
  "community",
] as const;

export type BuildLogEntryType = (typeof buildLogEntryTypes)[number];

export const buildLogAreas = [
  "elysia-core",
  "elysia-ecobotics-online",
  "privacy-governance",
  "developers-addons",
  "community-commons",
  "research-ecology",
  "artisan-creative",
  "ecobotics-robotics",
] as const;

export type BuildLogArea = (typeof buildLogAreas)[number];

export type BuildLogLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type BuildLogSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type BuildLogEntry = {
  slug: string;
  title: string;
  publishedAt: string;
  updatedAt?: string;
  milestonePeriod?: string;
  type: BuildLogEntryType;
  areas: BuildLogArea[];
  summary: string;
  sections: BuildLogSection[];
  relatedLinks?: BuildLogLink[];
  discussionUrl?: string;
  officialUpdateUrl?: string;
  iterationShowcaseUrl?: string;
  correctionNote?: string;
  supersededBy?: string;
};

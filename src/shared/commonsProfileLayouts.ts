export const COMMONS_PROFILE_LAYOUT_KEYS = [
  "classic_homebase",
  "compact_archive",
  "garden_shelves",
  "field_notebook_layout",
  "constellation_map",
  "stewardship_board",
] as const;

export type CommonsProfileLayoutKey = (typeof COMMONS_PROFILE_LAYOUT_KEYS)[number];

export type CommonsProfileLayoutOption = {
  key: CommonsProfileLayoutKey;
  label: string;
  description: string;
  className: string;
  previewNote: string;
};

export const DEFAULT_COMMONS_PROFILE_LAYOUT: CommonsProfileLayoutKey = "classic_homebase";

export const COMMONS_PROFILE_LAYOUTS: CommonsProfileLayoutOption[] = [
  {
    key: "classic_homebase",
    label: "Classic Homebase",
    description:
      "A balanced default public profile room with familiar avatar, name, identity, recognition, badges, collections, and contributions.",
    className: "commons-profile-layout--classic-homebase",
    previewNote: "Balanced home room.",
  },
  {
    key: "compact_archive",
    label: "Compact Archive",
    description:
      "A tighter archive-record layout with smaller identity treatment, dense public facts, compact badges, and indexed contributions.",
    className: "commons-profile-layout--compact-archive",
    previewNote: "Compact public record.",
  },
  {
    key: "garden_shelves",
    label: "Garden Shelves",
    description:
      "An expressive shelf layout with organic card rhythm, public identity shelves, badge shelves, and creative contribution cards.",
    className: "commons-profile-layout--garden-shelves",
    previewNote: "Expressive public shelves.",
  },
  {
    key: "field_notebook_layout",
    label: "Field Notebook",
    description:
      "A field-record layout with observation cards, ruled sections, source-log structure, and research-note rhythm.",
    className: "commons-profile-layout--field-notebook",
    previewNote: "Observation record.",
  },
  {
    key: "constellation_map",
    label: "Constellation Map",
    description:
      "A spatial profile map with a central identity node, orbiting cards, clustered recognition, and contribution constellations.",
    className: "commons-profile-layout--constellation-map",
    previewNote: "Central node and orbiting cards.",
  },
  {
    key: "stewardship_board",
    label: "Stewardship Board",
    description:
      "A public-service board layout that emphasizes stewardship, public links, recognition, resources, and contribution history.",
    className: "commons-profile-layout--stewardship-board",
    previewNote: "Public-service board.",
  },
];

export function isCommonsProfileLayoutKey(value: unknown): value is CommonsProfileLayoutKey {
  return (
    typeof value === "string" &&
    COMMONS_PROFILE_LAYOUT_KEYS.includes(value as CommonsProfileLayoutKey)
  );
}

export function normalizeCommonsProfileLayout(value: unknown): CommonsProfileLayoutKey {
  if (isCommonsProfileLayoutKey(value)) {
    return value;
  }

  return DEFAULT_COMMONS_PROFILE_LAYOUT;
}

export function getCommonsProfileLayoutOption(value: unknown): CommonsProfileLayoutOption {
  const key = normalizeCommonsProfileLayout(value);

  return (
    COMMONS_PROFILE_LAYOUTS.find((layout) => layout.key === key) ??
    COMMONS_PROFILE_LAYOUTS[0]!
  );
}

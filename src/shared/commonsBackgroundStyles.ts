export const COMMONS_BACKGROUND_STYLE_KEYS = [
  "soft_cyber_garden",
  "starfield_mantle",
  "living_archive",
  "clear_lantern",
  "mycelium_glow",
  "watershed_mist",
  "aurora_canopy",
  "solar_restoration",
  "obsidian_laboratory",
  "field_notebook",
] as const;

export type CommonsBackgroundStyleKey =
  (typeof COMMONS_BACKGROUND_STYLE_KEYS)[number];

export type CommonsBackgroundStyleOption = {
  key: CommonsBackgroundStyleKey;
  label: string;
  description: string;
  className: string;
  previewNote: string;
};

export const DEFAULT_COMMONS_BACKGROUND_STYLE: CommonsBackgroundStyleKey =
  "soft_cyber_garden";

export const COMMONS_BACKGROUND_STYLES: CommonsBackgroundStyleOption[] = [
  {
    key: "soft_cyber_garden",
    label: "Soft Cyber Garden",
    description:
      "A gentle cyber-botanical room with soft green/teal glow, faint vine circuitry, and calm tech-nature ambience.",
    className: "commons-background--soft-cyber-garden",
    previewNote: "Soft green/teal botanical-tech glow.",
  },
  {
    key: "starfield_mantle",
    label: "Starfield Mantle",
    description:
      "A contemplative night-sky atmosphere with tiny stars, constellation traces, and quiet archive depth.",
    className: "commons-background--starfield-mantle",
    previewNote: "Deep cosmic mantle with faint stars.",
  },
  {
    key: "living_archive",
    label: "Living Archive",
    description:
      "A scholarly preserved-memory room with warm archive shadows, page-line texture, and organic quiet.",
    className: "commons-background--living-archive",
    previewNote: "Warm library/archive atmosphere.",
  },
  {
    key: "clear_lantern",
    label: "Clear Lantern",
    description:
      "A clean luminous room with lantern-like clarity, strong readability, and minimal texture.",
    className: "commons-background--clear-lantern",
    previewNote: "Clear, readable lantern glow.",
  },
  {
    key: "mycelium_glow",
    label: "Mycelium Glow",
    description:
      "A dark soil-and-fungus atmosphere with faint mycelial threads, glowing nodes, and hidden connection.",
    className: "commons-background--mycelium-glow",
    previewNote: "Earthy hidden-network glow.",
  },
  {
    key: "watershed_mist",
    label: "Watershed Mist",
    description:
      "A blue/teal wetland atmosphere with mist layers, ripple lines, and quiet watershed calm.",
    className: "commons-background--watershed-mist",
    previewNote: "Mist, water, and ripple layers.",
  },
  {
    key: "aurora_canopy",
    label: "Aurora Canopy",
    description:
      "A night-forest canopy atmosphere with subtle aurora ribbons, dark leaves, and ecological wonder.",
    className: "commons-background--aurora-canopy",
    previewNote: "Aurora ribbons through forest canopy.",
  },
  {
    key: "solar_restoration",
    label: "Solar Restoration",
    description:
      "A warm restoration-field room with soft daylight, meadow texture, pollen glow, and hopeful openness.",
    className: "commons-background--solar-restoration",
    previewNote: "Warm meadow restoration light.",
  },
  {
    key: "obsidian_laboratory",
    label: "Obsidian Laboratory",
    description:
      "A dark technical room with glassy obsidian gradients, subtle robotics grid, and precise lab energy.",
    className: "commons-background--obsidian-laboratory",
    previewNote: "Dark robotics lab precision.",
  },
  {
    key: "field_notebook",
    label: "Field Notebook",
    description:
      "A research-naturalist room with pale grid lines, contour-map hints, and quiet field-note texture.",
    className: "commons-background--field-notebook",
    previewNote: "Field notes, contours, and map-paper texture.",
  },
];

export function isCommonsBackgroundStyleKey(
  value: unknown,
): value is CommonsBackgroundStyleKey {
  return (
    typeof value === "string" &&
    COMMONS_BACKGROUND_STYLE_KEYS.includes(value as CommonsBackgroundStyleKey)
  );
}

export function normalizeCommonsBackgroundStyle(
  value: unknown,
): CommonsBackgroundStyleKey {
  return isCommonsBackgroundStyleKey(value)
    ? value
    : DEFAULT_COMMONS_BACKGROUND_STYLE;
}

export function getCommonsBackgroundStyleOption(
  value: unknown,
): CommonsBackgroundStyleOption {
  const key = normalizeCommonsBackgroundStyle(value);
  return (
    COMMONS_BACKGROUND_STYLES.find((style) => style.key === key) ??
    COMMONS_BACKGROUND_STYLES[0]
  );
}

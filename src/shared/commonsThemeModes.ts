export const COMMONS_THEME_MODE_KEYS = [
  "deep_grove",
  "starlit_archive",
  "solar_meadow",
  "moonlit_reef",
  "aether_blue",
  "high_contrast",
] as const;

export type CommonsThemeModeKey = (typeof COMMONS_THEME_MODE_KEYS)[number];

export type CommonsThemeModeOption = {
  key: CommonsThemeModeKey;
  label: string;
  description: string;
  className: string;
};

export const DEFAULT_COMMONS_THEME_MODE: CommonsThemeModeKey = "deep_grove";

export const COMMONS_THEME_MODES: CommonsThemeModeOption[] = [
  {
    key: "deep_grove",
    label: "Deep Grove",
    description: "Grounded green-black profile surfaces with mossy public-room warmth.",
    className: "commons-theme-deep_grove",
  },
  {
    key: "starlit_archive",
    label: "Starlit Archive",
    description: "Cool indigo archive surfaces with silver-blue public-room accents.",
    className: "commons-theme-starlit_archive",
  },
  {
    key: "solar_meadow",
    label: "Solar Meadow",
    description: "Warm olive and amber surfaces with a gentle restoration-light tone.",
    className: "commons-theme-solar_meadow",
  },
  {
    key: "moonlit_reef",
    label: "Moonlit Reef",
    description: "Quiet blue-aqua surfaces with a soft moonlit-water mood.",
    className: "commons-theme-moonlit_reef",
  },
  {
    key: "aether_blue",
    label: "Aether Blue",
    description: "Clear blue public-room surfaces with calm high-tech polish.",
    className: "commons-theme-aether_blue",
  },
  {
    key: "high_contrast",
    label: "High Contrast",
    description: "Minimal dark surfaces with stronger borders and readable contrast.",
    className: "commons-theme-high_contrast",
  },
];

export function isCommonsThemeModeKey(value: unknown): value is CommonsThemeModeKey {
  return (
    typeof value === "string" &&
    COMMONS_THEME_MODE_KEYS.includes(value as CommonsThemeModeKey)
  );
}

export function normalizeCommonsThemeMode(value: unknown): CommonsThemeModeKey {
  return isCommonsThemeModeKey(value) ? value : DEFAULT_COMMONS_THEME_MODE;
}

export function getCommonsThemeModeOption(value: unknown): CommonsThemeModeOption {
  const key = normalizeCommonsThemeMode(value);
  return COMMONS_THEME_MODES.find((theme) => theme.key === key) ?? COMMONS_THEME_MODES[0];
}

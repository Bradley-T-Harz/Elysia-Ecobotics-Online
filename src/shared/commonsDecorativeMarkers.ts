import circuitVineUrl from "../assets/commons/decorative-markers/circuit_vine.png";
import leafGlyphUrl from "../assets/commons/decorative-markers/leaf_glyph.png";
import moonCrestUrl from "../assets/commons/decorative-markers/moon_crest.png";
import mushroomBadgeUrl from "../assets/commons/decorative-markers/mushroom_badge.png";
import pollinatorUrl from "../assets/commons/decorative-markers/pollinator.png";
import roboticSeedUrl from "../assets/commons/decorative-markers/robotic_seed.png";
import starMapUrl from "../assets/commons/decorative-markers/star_map.png";
import waterRippleUrl from "../assets/commons/decorative-markers/water_ripple.png";
import wetlandReedUrl from "../assets/commons/decorative-markers/wetland_reed.png";

export const COMMONS_DECORATIVE_MARKERS = [
  { key: "leaf_glyph", label: "Leaf Glyph", imageUrl: leafGlyphUrl, className: "commons-public-decorative-marker--leaf-glyph" },
  { key: "water_ripple", label: "Water Ripple", imageUrl: waterRippleUrl, className: "commons-public-decorative-marker--water-ripple" },
  { key: "star_map", label: "Star Map", imageUrl: starMapUrl, className: "commons-public-decorative-marker--star-map" },
  { key: "mushroom_badge", label: "Mushroom Button", imageUrl: mushroomBadgeUrl, className: "commons-public-decorative-marker--mushroom-badge" },
  { key: "circuit_vine", label: "Circuit Vine", imageUrl: circuitVineUrl, className: "commons-public-decorative-marker--circuit-vine" },
  { key: "pollinator", label: "Pollinator", imageUrl: pollinatorUrl, className: "commons-public-decorative-marker--pollinator" },
  { key: "wetland_reed", label: "Wetland Reed", imageUrl: wetlandReedUrl, className: "commons-public-decorative-marker--wetland-reed" },
  { key: "moon_crest", label: "Moon Crest", imageUrl: moonCrestUrl, className: "commons-public-decorative-marker--moon-crest" },
  { key: "robotic_seed", label: "Robotic Seed", imageUrl: roboticSeedUrl, className: "commons-public-decorative-marker--robotic-seed" },
] as const;

export type CommonsDecorativeMarkerOption = typeof COMMONS_DECORATIVE_MARKERS[number];
export type CommonsDecorativeMarkerKey = CommonsDecorativeMarkerOption["key"];
export type CommonsDecorativeMarkerSetKey = CommonsDecorativeMarkerKey | "none";

export const COMMONS_DECORATIVE_MARKER_KEYS = COMMONS_DECORATIVE_MARKERS.map((marker) => marker.key) as CommonsDecorativeMarkerKey[];

export const COMMONS_DECORATIVE_MARKER_SET_OPTIONS = [
  { key: "none", label: "None" },
  ...COMMONS_DECORATIVE_MARKERS.map((marker) => ({ key: marker.key, label: marker.label })),
] as const;

const COMMONS_DECORATIVE_MARKER_BY_KEY = new Map<string, CommonsDecorativeMarkerOption>(
  COMMONS_DECORATIVE_MARKERS.map((marker) => [marker.key, marker])
);

function labelFromKey(value: string) {
  return value.split("_").filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}

export function getCommonsDecorativeMarkerOption(key: unknown) {
  return typeof key === "string" ? COMMONS_DECORATIVE_MARKER_BY_KEY.get(key) ?? null : null;
}

export function formatCommonsDecorativeMarkerLabel(key: unknown) {
  if (key === "none") return "None";
  const option = getCommonsDecorativeMarkerOption(key);
  return option?.label ?? (typeof key === "string" ? labelFromKey(key) : "None");
}

export function normalizeCommonsDecorativeMarkerSet(value: unknown): CommonsDecorativeMarkerSetKey {
  return typeof value === "string" && COMMONS_DECORATIVE_MARKER_BY_KEY.has(value) ? value as CommonsDecorativeMarkerKey : "none";
}

export function normalizeCommonsSelectedDecorativeMarkers(values: unknown): CommonsDecorativeMarkerKey[] {
  if (!Array.isArray(values)) return [];
  const selected = new Set(values.filter((value): value is string => typeof value === "string"));
  return COMMONS_DECORATIVE_MARKERS.filter((marker) => selected.has(marker.key)).map((marker) => marker.key);
}

export function resolveCommonsDecorativeMarkers(settings: { decal_set?: unknown; selected_decals?: unknown }) {
  const fallback = normalizeCommonsDecorativeMarkerSet(settings.decal_set);
  if (fallback === "none") return [];
  const marker = getCommonsDecorativeMarkerOption(fallback);
  return marker ? [marker] : [];
}
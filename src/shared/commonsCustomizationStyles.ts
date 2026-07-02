import type { CSSProperties } from "react";
import { DEFAULT_COMMONS_BACKGROUND_STYLE, normalizeCommonsBackgroundStyle } from "./commonsBackgroundStyles";
import { DEFAULT_COMMONS_PROFILE_LAYOUT, normalizeCommonsProfileLayout } from "./commonsProfileLayouts";
import { normalizeCommonsThemeMode } from "./commonsThemeModes";
import type { CommonsThemeModeKey } from "./commonsThemeModes";

export type CommonsCustomizationStyleInput = {
  banner_zoom?: number | null;
  banner_position_x?: number | null;
  banner_position_y?: number | null;
  theme_mode?: string | null;
  accent_color?: string | null;
  background_style?: string | null;
  profile_layout?: string | null;
};

const DEFAULT_COMMONS_BANNER_ZOOM = 1;
const DEFAULT_COMMONS_BANNER_POSITION = 50;
const COMMONS_BANNER_ZOOM_MIN = 0.5;
const COMMONS_BANNER_ZOOM_MAX = 2;
const COMMONS_BANNER_POSITION_MIN = 0;
const COMMONS_BANNER_POSITION_MAX = 100;
const DEFAULT_COMMONS_ACCENT = "#8ee8dc";

type CommonsThemeTokens = {
  panel: string;
  panelStrong: string;
  panelRaised: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
  text: string;
  muted: string;
  eyebrow: string;
  chipBg: string;
  chipText: string;
  panelBorder: string;
  noticeBg: string;
  noticeBorder: string;
  buttonBg: string;
  avatarBg: string;
  shadow: string;
  glow: string;
};

const COMMONS_THEME_TOKENS: Record<CommonsThemeModeKey, CommonsThemeTokens> = {
  deep_grove: {
    panel: "rgba(5, 22, 16, 0.78)",
    panelStrong: "rgba(4, 18, 13, 0.94)",
    panelRaised: "rgba(11, 39, 28, 0.84)",
    surface: "linear-gradient(135deg, rgba(5, 22, 16, 0.76), rgba(8, 38, 28, 0.5))",
    surfaceStrong: "linear-gradient(135deg, rgba(4, 18, 13, 0.86), rgba(12, 48, 34, 0.62))",
    surfaceSoft: "linear-gradient(135deg, rgba(4, 18, 13, 0.48), rgba(11, 39, 28, 0.32))",
    text: "#f1fff7",
    muted: "rgba(221, 246, 229, 0.8)",
    eyebrow: "#bfe7bf",
    chipBg: "rgba(36, 91, 61, 0.44)",
    chipText: "rgba(245, 255, 248, 0.94)",
    panelBorder: "rgba(151, 220, 157, 0.3)",
    noticeBg: "linear-gradient(135deg, rgba(25, 42, 21, 0.62), rgba(6, 19, 13, 0.5))",
    noticeBorder: "rgba(151, 220, 157, 0.3)",
    buttonBg: "linear-gradient(135deg, rgba(20, 64, 43, 0.74), rgba(6, 22, 16, 0.72))",
    avatarBg: "radial-gradient(circle at 38% 28%, rgba(114, 226, 152, 0.34), transparent 58%), rgba(4, 20, 13, 0.84)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.26), 0 0 42px rgba(58, 164, 101, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    glow: "0 0 42px rgba(58, 164, 101, 0.1)",
  },
  starlit_archive: {
    panel: "rgba(7, 12, 25, 0.78)",
    panelStrong: "rgba(5, 10, 22, 0.94)",
    panelRaised: "rgba(14, 24, 43, 0.84)",
    surface: "linear-gradient(135deg, rgba(7, 12, 25, 0.76), rgba(15, 26, 47, 0.5))",
    surfaceStrong: "linear-gradient(135deg, rgba(5, 10, 22, 0.86), rgba(17, 29, 55, 0.62))",
    surfaceSoft: "linear-gradient(135deg, rgba(7, 12, 25, 0.48), rgba(14, 24, 43, 0.32))",
    text: "#f4f7ff",
    muted: "rgba(222, 231, 249, 0.8)",
    eyebrow: "#d6dff6",
    chipBg: "rgba(66, 83, 132, 0.42)",
    chipText: "rgba(245, 248, 255, 0.94)",
    panelBorder: "rgba(167, 184, 231, 0.28)",
    noticeBg: "linear-gradient(135deg, rgba(31, 34, 57, 0.62), rgba(7, 12, 25, 0.5))",
    noticeBorder: "rgba(167, 184, 231, 0.28)",
    buttonBg: "linear-gradient(135deg, rgba(33, 45, 86, 0.72), rgba(8, 14, 28, 0.72))",
    avatarBg: "radial-gradient(circle at 42% 26%, rgba(164, 181, 244, 0.32), transparent 58%), rgba(5, 10, 22, 0.84)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.28), 0 0 42px rgba(120, 146, 229, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    glow: "0 0 42px rgba(120, 146, 229, 0.1)",
  },
  solar_meadow: {
    panel: "rgba(29, 22, 8, 0.78)",
    panelStrong: "rgba(25, 18, 6, 0.94)",
    panelRaised: "rgba(57, 44, 16, 0.82)",
    surface: "linear-gradient(135deg, rgba(29, 22, 8, 0.74), rgba(54, 43, 14, 0.48))",
    surfaceStrong: "linear-gradient(135deg, rgba(25, 18, 6, 0.86), rgba(65, 50, 13, 0.6))",
    surfaceSoft: "linear-gradient(135deg, rgba(27, 20, 8, 0.46), rgba(57, 44, 16, 0.3))",
    text: "#fff8df",
    muted: "rgba(250, 237, 201, 0.82)",
    eyebrow: "#f2cf75",
    chipBg: "rgba(123, 91, 30, 0.42)",
    chipText: "rgba(255, 248, 226, 0.95)",
    panelBorder: "rgba(245, 205, 102, 0.34)",
    noticeBg: "linear-gradient(135deg, rgba(74, 51, 13, 0.56), rgba(23, 19, 7, 0.5))",
    noticeBorder: "rgba(245, 205, 102, 0.34)",
    buttonBg: "linear-gradient(135deg, rgba(92, 68, 24, 0.7), rgba(23, 19, 7, 0.72))",
    avatarBg: "radial-gradient(circle at 42% 28%, rgba(245, 205, 102, 0.34), transparent 58%), rgba(24, 19, 7, 0.84)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.26), 0 0 44px rgba(245, 194, 82, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    glow: "0 0 42px rgba(245, 194, 82, 0.1)",
  },
  moonlit_reef: {
    panel: "rgba(5, 16, 28, 0.78)",
    panelStrong: "rgba(4, 14, 26, 0.94)",
    panelRaised: "rgba(11, 39, 58, 0.84)",
    surface: "linear-gradient(135deg, rgba(5, 16, 28, 0.76), rgba(9, 38, 56, 0.5))",
    surfaceStrong: "linear-gradient(135deg, rgba(4, 14, 26, 0.86), rgba(12, 47, 68, 0.62))",
    surfaceSoft: "linear-gradient(135deg, rgba(5, 16, 28, 0.48), rgba(11, 39, 58, 0.32))",
    text: "#f1fbff",
    muted: "rgba(221, 238, 255, 0.8)",
    eyebrow: "#aeeaf3",
    chipBg: "rgba(35, 91, 115, 0.42)",
    chipText: "rgba(241, 251, 255, 0.95)",
    panelBorder: "rgba(141, 238, 220, 0.3)",
    noticeBg: "linear-gradient(135deg, rgba(14, 48, 62, 0.58), rgba(5, 16, 28, 0.5))",
    noticeBorder: "rgba(141, 238, 220, 0.3)",
    buttonBg: "linear-gradient(135deg, rgba(22, 68, 91, 0.72), rgba(5, 16, 28, 0.72))",
    avatarBg: "radial-gradient(circle at 42% 28%, rgba(120, 192, 255, 0.34), transparent 58%), rgba(5, 15, 26, 0.84)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.27), 0 0 42px rgba(90, 189, 220, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    glow: "0 0 42px rgba(90, 189, 220, 0.1)",
  },
  aether_blue: {
    panel: "rgba(6, 14, 33, 0.78)",
    panelStrong: "rgba(5, 12, 29, 0.94)",
    panelRaised: "rgba(17, 33, 68, 0.84)",
    surface: "linear-gradient(135deg, rgba(6, 14, 33, 0.76), rgba(18, 35, 75, 0.5))",
    surfaceStrong: "linear-gradient(135deg, rgba(5, 12, 29, 0.86), rgba(22, 43, 91, 0.62))",
    surfaceSoft: "linear-gradient(135deg, rgba(6, 14, 33, 0.48), rgba(17, 33, 68, 0.32))",
    text: "#f4f7ff",
    muted: "rgba(225, 232, 255, 0.82)",
    eyebrow: "#bacaff",
    chipBg: "rgba(58, 80, 151, 0.42)",
    chipText: "rgba(246, 248, 255, 0.95)",
    panelBorder: "rgba(139, 174, 255, 0.3)",
    noticeBg: "linear-gradient(135deg, rgba(26, 44, 93, 0.58), rgba(6, 14, 33, 0.5))",
    noticeBorder: "rgba(139, 174, 255, 0.3)",
    buttonBg: "linear-gradient(135deg, rgba(35, 61, 127, 0.72), rgba(6, 14, 33, 0.72))",
    avatarBg: "radial-gradient(circle at 42% 28%, rgba(139, 174, 255, 0.34), transparent 58%), rgba(6, 14, 33, 0.84)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.27), 0 0 42px rgba(119, 159, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    glow: "0 0 42px rgba(119, 159, 255, 0.1)",
  },
  high_contrast: {
    panel: "rgba(0, 0, 0, 0.82)",
    panelStrong: "rgba(0, 0, 0, 0.96)",
    panelRaised: "rgba(10, 10, 10, 0.9)",
    surface: "linear-gradient(135deg, rgba(0, 0, 0, 0.86), rgba(7, 9, 11, 0.66))",
    surfaceStrong: "linear-gradient(135deg, rgba(0, 0, 0, 0.94), rgba(9, 11, 13, 0.8))",
    surfaceSoft: "linear-gradient(135deg, rgba(0, 0, 0, 0.62), rgba(7, 9, 11, 0.44))",
    text: "#ffffff",
    muted: "rgba(255, 255, 255, 0.88)",
    eyebrow: "#ffffff",
    chipBg: "rgba(255, 255, 255, 0.12)",
    chipText: "#ffffff",
    panelBorder: "color-mix(in srgb, var(--commons-accent) 58%, white)",
    noticeBg: "linear-gradient(135deg, rgba(0, 0, 0, 0.72), rgba(12, 12, 12, 0.62))",
    noticeBorder: "color-mix(in srgb, var(--commons-accent) 62%, white)",
    buttonBg: "linear-gradient(135deg, rgba(0, 0, 0, 0.86), rgba(17, 17, 17, 0.78))",
    avatarBg: "radial-gradient(circle at 42% 28%, rgba(255, 255, 255, 0.22), transparent 58%), rgba(0, 0, 0, 0.88)",
    shadow: "0 24px 68px rgba(0, 0, 0, 0.34), inset 0 0 0 1px color-mix(in srgb, var(--commons-accent) 34%, transparent)",
    glow: "0 0 42px color-mix(in srgb, var(--commons-accent) 14%, transparent)",
  },
};

function classToken(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9_-]/gi, "_");
}

function clampStyleNumber(value: unknown, min: number, max: number, fallback: number) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function normalizeStyleBannerZoom(value: unknown) {
  return clampStyleNumber(value, COMMONS_BANNER_ZOOM_MIN, COMMONS_BANNER_ZOOM_MAX, DEFAULT_COMMONS_BANNER_ZOOM);
}

function normalizeStyleBannerPosition(value: unknown) {
  return clampStyleNumber(value, COMMONS_BANNER_POSITION_MIN, COMMONS_BANNER_POSITION_MAX, DEFAULT_COMMONS_BANNER_POSITION);
}

export function safeCommonsAccentColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value as string : DEFAULT_COMMONS_ACCENT;
}

export function customizationSkinClass(settings: CommonsCustomizationStyleInput) {
  return `commons-theme-${classToken(normalizeCommonsThemeMode(settings.theme_mode), "deep_grove")} commons-background-${classToken(normalizeCommonsBackgroundStyle(settings.background_style), DEFAULT_COMMONS_BACKGROUND_STYLE)}`;
}

export function customizationLayoutClass(settings: CommonsCustomizationStyleInput) {
  return `commons-layout-${classToken(normalizeCommonsProfileLayout(settings.profile_layout), DEFAULT_COMMONS_PROFILE_LAYOUT)}`;
}

export function customizationClass(settings: CommonsCustomizationStyleInput) {
  return `${customizationSkinClass(settings)} ${customizationLayoutClass(settings)}`;
}

export function commonsCustomizationStyle(settings: CommonsCustomizationStyleInput): CSSProperties {
  const accent = safeCommonsAccentColor(settings.accent_color);
  const theme = COMMONS_THEME_TOKENS[normalizeCommonsThemeMode(settings.theme_mode)] ?? COMMONS_THEME_TOKENS.deep_grove;

  return {
    "--commons-banner-zoom": String(normalizeStyleBannerZoom(settings.banner_zoom)),
    "--commons-banner-position-x": `${normalizeStyleBannerPosition(settings.banner_position_x)}%`,
    "--commons-banner-position-y": `${normalizeStyleBannerPosition(settings.banner_position_y)}%`,
    "--commons-accent": accent,
    "--commons-accent-soft": `color-mix(in srgb, ${accent} 16%, transparent)`,
    "--commons-accent-border": `color-mix(in srgb, ${accent} 34%, rgba(216, 226, 232, .18))`,
    "--commons-accent-glow": `0 0 34px color-mix(in srgb, ${accent} 18%, transparent)`,
    "--commons-accent-focus": `color-mix(in srgb, ${accent} 82%, white)`,
    "--commons-theme-surface": theme.surface,
    "--commons-theme-surface-strong": theme.surfaceStrong,
    "--commons-theme-surface-soft": theme.surfaceSoft,
    "--commons-theme-text": theme.text,
    "--commons-theme-muted": theme.muted,
    "--commons-theme-eyebrow": theme.eyebrow,
    "--commons-theme-chip-bg": theme.chipBg,
    "--commons-theme-chip-text": theme.chipText,
    "--commons-theme-panel-border": theme.panelBorder,
    "--commons-theme-notice-bg": theme.noticeBg,
    "--commons-theme-notice-border": theme.noticeBorder,
    "--commons-theme-button-bg": theme.buttonBg,
    "--commons-theme-avatar-bg": theme.avatarBg,
    "--commons-theme-shadow": theme.shadow,
    "--commons-theme-glow": theme.glow,
    "--commons-panel": theme.panel,
    "--commons-panel-strong": theme.panelStrong,
    "--commons-panel-raised": theme.panelRaised,
    "--commons-line": theme.panelBorder,
    "--commons-text": theme.text,
    "--commons-muted": theme.muted,
  } as CSSProperties;
}

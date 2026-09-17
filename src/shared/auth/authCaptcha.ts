import { sandboxOrigin } from "../../config/sandboxEnvironment";
export type AuthCaptchaMode = "off" | "preflight" | "required";

const ONLINE_AUTH_ORIGIN = "https://elysiaecobotics.com";
const ONLINE_AUTH_HOSTS = new Set(["elysiaecobotics.com", "www.elysiaecobotics.com"]);

function authCaptchaMode(value: string | undefined): AuthCaptchaMode {
  return value === "preflight" || value === "required" ? value : "off";
}

function publicSiteKey(value: string | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return candidate.length >= 10 && candidate.length <= 256 && !/\s/.test(candidate)
    ? candidate
    : null;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function safeRelativeAuthPath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) {
    return "/commons-circle";
  }
  return pathname;
}

export const authCaptchaConfig = Object.freeze({
  mode: authCaptchaMode(import.meta.env.VITE_AUTH_CAPTCHA_MODE),
  siteKey: publicSiteKey(import.meta.env.VITE_AUTH_TURNSTILE_SITE_KEY),
});

export function onlineAuthHostPolicy(location: Pick<Location, "hostname" | "pathname"> = window.location) {
  const hostname = location.hostname.toLowerCase();
  const allowed = (sandboxOrigin ? hostname === new URL(sandboxOrigin).hostname : ONLINE_AUTH_HOSTS.has(hostname)) || isLoopbackHostname(hostname);
  return {
    allowed,
    canonicalUrl: `${sandboxOrigin ?? ONLINE_AUTH_ORIGIN}${safeRelativeAuthPath(location.pathname)}`,
  };
}

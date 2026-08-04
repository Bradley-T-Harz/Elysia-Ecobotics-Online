const configuredArtisanCollectiveUrl = import.meta.env.VITE_ARTISAN_COLLECTIVE_URL?.trim();

export const ELYSIA_ECOBOTICS_ONLINE_URL = "https://elysiaecobotics.com";
export const ECOSYNEVA_COMMONS_LLC_URL = "https://ecosyneva-commons-llc.pages.dev/";
export const COMMONS_CIRCLE_URL = `${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle`;
export const ARTISAN_COLLECTIVE_PORTAL_URL = `${ELYSIA_ECOBOTICS_ONLINE_URL}/artisan-collective`;
export const ARTISAN_COLLECTIVE_PAGES_URL = "https://elysiaartisancollective.pages.dev";
export const ARTISAN_COLLECTIVE_CUSTOM_DOMAIN_URL = "https://artisans.elysiaecobotics.com";

export const APPROVED_ARTISAN_COLLECTIVE_URLS = [
  ARTISAN_COLLECTIVE_PAGES_URL,
  ARTISAN_COLLECTIVE_CUSTOM_DOMAIN_URL
] as const;

export const ARTISAN_COLLECTIVE_URL = APPROVED_ARTISAN_COLLECTIVE_URLS.find(
  (url) => url === configuredArtisanCollectiveUrl
) ?? ARTISAN_COLLECTIVE_PAGES_URL;

export function artisanProfileReportUrl(handle: string) {
  const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(normalizedHandle)) {
    throw new Error("A canonical Commons handle is required for a profile report URL.");
  }
  return `${ARTISAN_COLLECTIVE_URL}/report/profile/${encodeURIComponent(`@${normalizedHandle}`)}`;
}

const CANONICAL_ORIGIN = "https://elysiaecobotics.com";

export function canonicalLocation(requestUrl) {
  const incoming = new URL(requestUrl);
  const destination = new URL(CANONICAL_ORIGIN);
  destination.pathname = incoming.pathname;
  destination.search = incoming.search;
  return destination.href;
}

export function onRequest({ request }) {
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "no-store",
      Location: canonicalLocation(request.url),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

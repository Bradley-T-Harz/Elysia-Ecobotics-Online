interface IdentityProxyEnv {
  IDENTITY_SERVICE?: Fetcher;
}

const RESPONSE_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
});

const FORWARDED_HEADERS = new Set([
  "accept", "authorization", "cf-connecting-ip", "content-length", "content-type", "origin",
  "user-agent", "x-request-id", "x-provider-signature", "x-provider-timestamp", "x-provider-event-id",
  "svix-id", "svix-signature", "svix-timestamp"
]);

const RETURNED_HEADERS = new Set([
  "cache-control", "content-disposition", "content-length", "content-security-policy", "content-type",
  "cross-origin-resource-policy", "etag", "permissions-policy", "referrer-policy", "retry-after",
  "x-content-sha256", "x-content-type-options", "x-frame-options", "x-request-id"
]);
const MAXIMUM_IDENTITY_PROXY_BODY_BYTES = 65_536;

function unavailable(): Response {
  return new Response(JSON.stringify({ ok: false, error: "identity_service_unavailable" }), {
    status: 503,
    headers: { ...RESPONSE_HEADERS, "content-type": "application/json; charset=utf-8" }
  });
}

export async function handleIdentityProxy(request: Request, env: IdentityProxyEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...RESPONSE_HEADERS, "content-type": "application/json; charset=utf-8" }
    });
  }
  const url = new URL(request.url);
  if (
    url.pathname.length > 240 || url.search.length > 2_048
    || !/^\/api\/identity\/v1\/[a-z0-9/-]+$/.test(url.pathname)
    || url.pathname.includes("//") || url.pathname.endsWith("/")
  ) {
    return new Response(JSON.stringify({ ok: false, error: "identity_route_not_found" }), {
      status: 404,
      headers: { ...RESPONSE_HEADERS, "content-type": "application/json; charset=utf-8" }
    });
  }
  if (!env.IDENTITY_SERVICE) return unavailable();
  let body: ArrayBuffer | null = null;
  if (request.method === "POST") {
    const declaredLength = request.headers.get("content-length");
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAXIMUM_IDENTITY_PROXY_BODY_BYTES)) {
      return new Response(JSON.stringify({ ok: false, error: "request_too_large" }), {
        status: 413,
        headers: { ...RESPONSE_HEADERS, "content-type": "application/json; charset=utf-8" }
      });
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAXIMUM_IDENTITY_PROXY_BODY_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "request_too_large" }), {
        status: 413,
        headers: { ...RESPONSE_HEADERS, "content-type": "application/json; charset=utf-8" }
      });
    }
  }
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (FORWARDED_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  });
  headers.delete("cookie");
  try {
    const upstreamUrl = new URL(request.url);
    upstreamUrl.protocol = "https:";
    upstreamUrl.host = "identity-service.internal";
    const upstream = await env.IDENTITY_SERVICE.fetch(new Request(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual"
    }));
    if (upstream.status >= 300 && upstream.status < 400) return unavailable();
    const returned = new Headers();
    upstream.headers.forEach((value, name) => {
      if (RETURNED_HEADERS.has(name.toLowerCase())) returned.set(name, value);
    });
    const response = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: returned
    });
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) response.headers.set(name, value);
    return response;
  } catch {
    return unavailable();
  }
}

export const onRequest: PagesFunction<IdentityProxyEnv> = (context) => handleIdentityProxy(context.request, context.env);

export interface PublicProfileImageProxyEnv {
  IDENTITY_SERVICE?: Fetcher;
}

export type PublicProfileImageKind = "avatar" | "banner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETURNED_HEADERS = new Set([
  "cache-control",
  "content-disposition",
  "content-length",
  "content-security-policy",
  "content-type",
  "cross-origin-resource-policy",
  "etag",
  "referrer-policy",
  "x-content-type-options",
  "x-request-id"
]);

function failure(status: number, code: string): Response {
  return Response.json({ ok: false, error: code }, {
    status,
    headers: {
      "cache-control": "no-store",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function handlePublicProfileImageProxy(
  request: Request,
  env: PublicProfileImageProxyEnv,
  mediaId: string,
  kind: PublicProfileImageKind
): Promise<Response> {
  const missingCode = kind === "avatar" ? "profile_avatar_not_found" : "profile_banner_not_found";
  if (request.method !== "GET") return failure(405, "method_not_allowed");
  if (!UUID.test(mediaId)) return failure(404, missingCode);
  if (!env.IDENTITY_SERVICE) return failure(503, "identity_service_unavailable");

  const url = new URL(request.url);
  url.pathname = `/v1/public-profile-${kind === "avatar" ? "avatars" : "banners"}/${mediaId.toLowerCase()}`;
  url.search = "";
  let upstream: Response;
  try {
    upstream = await env.IDENTITY_SERVICE.fetch(new Request(url, {
      method: "GET",
      headers: {
        accept: "image/webp,image/png,image/jpeg",
        "x-request-id": request.headers.get("x-request-id") ?? crypto.randomUUID()
      },
      redirect: "error"
    }));
  } catch {
    return failure(502, "identity_service_unavailable");
  }

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (RETURNED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}


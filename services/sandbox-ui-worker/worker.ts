import { handleIdentityProxy } from "../../functions/api/identity/[[path]].ts";
import { sandboxAccessAllowed, sandboxAccessDenied, isSandboxWebhook } from "./access.ts";

export function sandboxResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("content-security-policy", "default-src 'self'; base-uri 'self'; connect-src 'self' https://kdtqyxlrkpmlpupzgmwv.supabase.co wss://kdtqyxlrkpmlpupzgmwv.supabase.co https://challenges.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com; form-action 'self'; frame-ancestors 'none'; frame-src https://challenges.cloudflare.com; img-src 'self' data: blob: https://kdtqyxlrkpmlpupzgmwv.supabase.co; media-src 'self' blob: https://kdtqyxlrkpmlpupzgmwv.supabase.co; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; worker-src 'self' blob:; upgrade-insecure-requests");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleSandboxUi(request: Request, env: SandboxUiBindings): Promise<Response> {
  const url = new URL(request.url);
  if (url.origin !== env.SANDBOX_UI_ORIGIN || env.SUPABASE_URL !== "https://kdtqyxlrkpmlpupzgmwv.supabase.co") {
    return sandboxAccessDenied();
  }
  // Only exact POST webhook is exempt. The existing backend still verifies
  // HMAC against the unmodified body, and all fulfillment gates remain OFF.
  if (!isSandboxWebhook(request) && !(await sandboxAccessAllowed(request, env))) return sandboxAccessDenied();
  if (url.pathname.startsWith("/api/billing/")) {
    return sandboxResponse(await env.BILLING_SERVICE.fetch(request));
  }
  if (url.pathname.startsWith("/api/identity/")) {
    return sandboxResponse(await handleIdentityProxy(request, env));
  }
  if (url.pathname.startsWith("/api/")) return sandboxResponse(Response.json({ ok: false, error: "sandbox_route_unavailable" }, { status: 503 }));
  if (request.method !== "GET" && request.method !== "HEAD") return sandboxResponse(new Response(null, { status: 405 }));
  return sandboxResponse(await env.ASSETS.fetch(request));
}

export default {
  async fetch(request, env) {
    try { return await handleSandboxUi(request, env); }
    catch { return sandboxResponse(new Response("Sandbox temporarily unavailable.", { status: 503 })); }
  }
} satisfies ExportedHandler<SandboxUiBindings>;

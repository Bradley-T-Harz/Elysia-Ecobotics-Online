import { verifyCloudflareAccessAssertion } from "../sandbox-runner/accessValidator.mjs";

export type SandboxAccessSettings = {
  SANDBOX_ACCESS_TEAM_DOMAIN?: string;
  SANDBOX_ACCESS_AUDIENCE?: string;
};

/** Always fail closed, including before Access has been provisioned. */
export async function sandboxAccessAllowed(request: Request, env: SandboxAccessSettings): Promise<boolean> {
  const team = env.SANDBOX_ACCESS_TEAM_DOMAIN ?? "";
  const audience = env.SANDBOX_ACCESS_AUDIENCE ?? "";
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !/^[a-f0-9]{64}$/.test(audience)) return false;
  return verifyCloudflareAccessAssertion(request.headers.get("cf-access-jwt-assertion"), {
    accessRequired: true, accessTeamDomain: team, accessAudience: audience
  });
}

export function sandboxAccessDenied(): Response {
  return new Response("Sandbox authentication is required. Access setup may still be pending.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" }
  });
}

export function isSandboxWebhook(request: Request): boolean {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === "/api/billing/webhook" && !url.search;
}

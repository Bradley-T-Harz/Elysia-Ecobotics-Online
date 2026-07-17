import { authenticateRequest } from "./_shared/auth.ts";
import { parseSandboxCreditSummary, type PublicSandboxCreditSummary } from "./_shared/credits.ts";
import { assertSandboxReadConfigured, jsonResponse, safeErrorResponse } from "./_shared/http.ts";
import type { AuthenticatedRequest, Env } from "./_shared/types.ts";

export type CreditSummaryDependencies = {
  authenticate(request: Request, env: Env): Promise<AuthenticatedRequest>;
  load(auth: AuthenticatedRequest): Promise<unknown>;
};

const defaultDependencies: CreditSummaryDependencies = {
  authenticate: authenticateRequest,
  async load(auth) {
    const { data, error } = await auth.supabase.rpc("current_user_sandbox_credit_summary");
    if (error) return null;
    return data;
  }
};

export async function handleSandboxCreditSummary(
  request: Request,
  env: Env,
  dependencies: CreditSummaryDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertSandboxReadConfigured(request, env);
    if (request.method !== "GET") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    const auth = await dependencies.authenticate(request, env);
    const summary: PublicSandboxCreditSummary = parseSandboxCreditSummary(await dependencies.load(auth));
    return jsonResponse({ ok: true, summary });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export const onRequest: PagesFunction<Env> = (context) => handleSandboxCreditSummary(context.request, context.env);

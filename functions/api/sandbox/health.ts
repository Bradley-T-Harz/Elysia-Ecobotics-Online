import { authenticateRequest } from "./_shared/auth.ts";
import { assertProductionEnabled, jsonResponse, safeErrorResponse } from "./_shared/http.ts";
import { requestRunnerHealth } from "./_shared/runner.ts";
import type { AuthenticatedRequest, Env } from "./_shared/types.ts";

export type HealthDependencies = {
  authenticate(request: Request, env: Env): Promise<AuthenticatedRequest>;
  health(env: Env): Promise<boolean>;
};

const defaultDependencies: HealthDependencies = {
  authenticate: authenticateRequest,
  health: requestRunnerHealth
};

export async function handleSandboxHealth(
  request: Request,
  env: Env,
  dependencies: HealthDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertProductionEnabled(request, env);
    if (request.method !== "GET") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    await dependencies.authenticate(request, env);
    const healthy = await dependencies.health(env);
    return healthy
      ? jsonResponse({ ok: true, status: "available" })
      : jsonResponse({ ok: false, error: "runner_unavailable", status: "unavailable" }, 503);
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export const onRequest: PagesFunction<Env> = (context) => handleSandboxHealth(context.request, context.env);

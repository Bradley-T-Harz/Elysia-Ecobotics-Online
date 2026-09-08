import { authenticateRequired, createEconomicServerClient } from "../../billing/_shared/auth.ts";
import { BillingHttpError, jsonResponse, parseBoundedJsonRequest, requireGet, requireJsonPost, requireSameOriginMutation } from "../../billing/_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../../billing/_shared/types.ts";
import { preparationCommandSchema, preparationMutationResultSchema, preparationOverviewSchema, type PreparationAudience, type PreparationCommand } from "../../../../src/shared/economics/preProviderContracts.ts";

export interface PreparationEnv extends Pick<BillingEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY"> {
  ECONOMIC_PREPARATION_ENABLED?: string;
  ECONOMIC_PREPARATION_MODE?: string;
  ECONOMIC_PREPARATION_PUBLIC_ORIGIN?: string;
  ECONOMIC_PREPARATION_ACCESS_CONFIRMED?: string;
  ECONOMIC_PREPARATION_RATE_LIMIT_CONFIRMED?: string;
}
export function assertPreparationEnabled(env: PreparationEnv) {
  if (env.ECONOMIC_PREPARATION_ENABLED !== "true" || env.ECONOMIC_PREPARATION_MODE !== "pre_provider"
    || env.ECONOMIC_PREPARATION_ACCESS_CONFIRMED !== "true" || env.ECONOMIC_PREPARATION_RATE_LIMIT_CONFIRMED !== "true") {
    throw new BillingHttpError(503, "preparation_disabled");
  }
}
const safeDatabaseCodes = new Set(["40001", "23505", "42501", "P0002", "55000", "22023", "23514", "22P02"]);
function databaseFailure(code?: string): never {
  const status = code === "40001" || code === "23505" ? 409 : code === "42501" ? 403 : code === "P0002" ? 404 : code === "55000" ? 409 : safeDatabaseCodes.has(code ?? "") ? 400 : 503;
  throw new BillingHttpError(status, status === 409 ? "preparation_conflict_reload_required" : status === 403 ? "preparation_not_authorized" : status === 400 ? "preparation_input_invalid" : "preparation_unavailable");
}
export type PreparationDependencies = {
  authenticate(request: Request, env: PreparationEnv): Promise<AuthenticatedBillingRequest>;
  load(env: PreparationEnv, actor: string, audience: PreparationAudience): Promise<unknown>;
  command(env: PreparationEnv, actor: string, command: PreparationCommand): Promise<unknown>;
};
const dependencies: PreparationDependencies = {
  authenticate: authenticateRequired,
  async load(env, actor, audience) {
    const { data, error } = await createEconomicServerClient(env).rpc("get_economic_preparation", { p_actor_user_id: actor, p_audience: audience });
    if (error) databaseFailure(error.code);
    return data;
  },
  async command(env, actor, command) {
    const { data, error } = await createEconomicServerClient(env).rpc("command_economic_preparation", { p_actor_user_id: actor, p_command: command });
    if (error) databaseFailure(error.code);
    return data;
  }
};
function errorResponse(error: unknown) {
  if (error instanceof BillingHttpError) return jsonResponse({ ok: false, error: error.code }, error.status);
  // Never return SQL, user input, upstream payloads or raw exception text.
  return jsonResponse({ ok: false, error: "preparation_unavailable" }, 503);
}
function boundedResponse(data: unknown) {
  if (new TextEncoder().encode(JSON.stringify(data)).length > 131_072) throw new BillingHttpError(503, "preparation_response_too_large");
  return jsonResponse(data);
}
export async function handlePreparationState(request: Request, env: PreparationEnv, deps = dependencies): Promise<Response> {
  try {
    assertPreparationEnabled(env); requireGet(request);
    const url = new URL(request.url);
    const audience = url.searchParams.get("audience");
    if ((audience !== "seller" && audience !== "operator" && audience !== "account") || [...url.searchParams].length !== 1) throw new BillingHttpError(400, "preparation_audience_invalid");
    const auth = await deps.authenticate(request, env);
    const state = preparationOverviewSchema.parse(await deps.load(env, auth.userId, audience));
    return boundedResponse({ ok: true, state });
  } catch (error) { return errorResponse(error); }
}
export async function handlePreparationCommand(request: Request, env: PreparationEnv, deps = dependencies): Promise<Response> {
  try {
    assertPreparationEnabled(env);
    requireSameOriginMutation(request, { BILLING_PUBLIC_ORIGIN: env.ECONOMIC_PREPARATION_PUBLIC_ORIGIN });
    requireJsonPost(request);
    const auth = await deps.authenticate(request, env);
    const parsed = preparationCommandSchema.safeParse(await parseBoundedJsonRequest(request, 16_384));
    if (!parsed.success) throw new BillingHttpError(400, "preparation_input_invalid");
    const result = preparationMutationResultSchema.parse(await deps.command(env, auth.userId, parsed.data));
    if (result.requestId !== parsed.data.requestId) throw new BillingHttpError(503, "preparation_response_invalid");
    return boundedResponse({ ok: true, result });
  } catch (error) { return errorResponse(error); }
}

import { authenticateRequired } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { assertEconomicResponseSize, loadCurrentEconomicAuditEvents, type EconomicAuditQuery } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import { isUuid } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type OperatorAuditDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest, query: EconomicAuditQuery): ReturnType<typeof loadCurrentEconomicAuditEvents>;
};
const defaultDependencies: OperatorAuditDependencies = {
  authenticate: authenticateRequired,
  load: (auth, query) => loadCurrentEconomicAuditEvents(auth.supabase, query)
};

export function parseEconomicAuditQuery(request: Request): EconomicAuditQuery {
  const params = new URL(request.url).searchParams;
  const allowed = new Set(["afterCreatedAt", "afterId", "limit"]);
  const entries = [...params.entries()];
  if (entries.some(([key]) => !allowed.has(key)) || new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new BillingHttpError(400, "economic_audit_query_invalid");
  }
  const afterCreatedAt = params.get("afterCreatedAt");
  const afterId = params.get("afterId");
  if ((afterCreatedAt === null) !== (afterId === null)) throw new BillingHttpError(400, "economic_audit_cursor_invalid");
  let normalizedCreatedAt: string | null = null;
  let normalizedId: string | null = null;
  if (afterCreatedAt !== null && afterId !== null) {
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(afterCreatedAt)
      || !Number.isFinite(Date.parse(afterCreatedAt)) || !isUuid(afterId)
    ) throw new BillingHttpError(400, "economic_audit_cursor_invalid");
    normalizedCreatedAt = new Date(Date.parse(afterCreatedAt)).toISOString();
    normalizedId = afterId.toLowerCase();
  }
  const limitText = params.get("limit") ?? "50";
  if (!/^\d{1,3}$/.test(limitText)) throw new BillingHttpError(400, "economic_audit_limit_invalid");
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BillingHttpError(400, "economic_audit_limit_invalid");
  return { afterCreatedAt: normalizedCreatedAt, afterId: normalizedId, limit };
}

export async function handleOperatorAudit(request: Request, env: BillingEnv, dependencies: OperatorAuditDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    requireGet(request);
    const query = parseEconomicAuditQuery(request);
    const auth = await dependencies.authenticate(request, env);
    const audit = await dependencies.load(auth, query);
    const response = { ok: true, audit };
    assertEconomicResponseSize(response);
    return jsonResponse(response);
  } catch (error) { return safeBillingErrorResponse(error); }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAudit(context.request, context.env);

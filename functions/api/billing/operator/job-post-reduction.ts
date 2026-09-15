import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { BillingHttpError, jsonResponse, parseBoundedJsonRequest, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { isUuid } from "../_shared/schema.ts";
import type { BillingEnv } from "../_shared/types.ts";

export const onRequest: PagesFunction<BillingEnv> = async ({ request, env }) => {
  try {
    assertBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await authenticateRequired(request, env);
    const input = await parseBoundedJsonRequest(request, 4096) as Record<string, unknown>;
    if (!input || Object.keys(input).sort().join(",") !== "amountDueMinor,clientRequestId,jobPostId,reason"
      || typeof input.jobPostId !== "string" || !isUuid(input.jobPostId)
      || typeof input.clientRequestId !== "string" || !isUuid(input.clientRequestId)
      || typeof input.amountDueMinor !== "number" || !Number.isSafeInteger(input.amountDueMinor) || input.amountDueMinor < 50 || input.amountDueMinor > 999
      || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000) {
      throw new BillingHttpError(400, "job_post_reduction_invalid");
    }
    const { data, error } = await createEconomicServerClient(env).rpc("operator_reduce_job_post_fee", {
      p_actor_user_id: auth.userId, p_job_post_id: input.jobPostId, p_client_request_id: input.clientRequestId,
      p_amount_due_minor: input.amountDueMinor, p_reason: input.reason
    });
    if (error) throw new BillingHttpError(409, "job_post_reduction_unavailable");
    return jsonResponse({ ok: true, result: data });
  } catch (error) { return safeBillingErrorResponse(error); }
};

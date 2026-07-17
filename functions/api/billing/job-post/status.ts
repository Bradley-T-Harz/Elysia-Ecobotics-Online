import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { loadCurrentUserJobPostEconomicStatus } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import { isUuid } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type JobPostStatusDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest, jobPostId: string): ReturnType<typeof loadCurrentUserJobPostEconomicStatus>;
};

const defaultDependencies: JobPostStatusDependencies = {
  authenticate: authenticateRequired,
  load: (auth, jobPostId) => loadCurrentUserJobPostEconomicStatus(auth.supabase, jobPostId)
};

function jobPostIdFromRequest(request: Request): string {
  const url = new URL(request.url);
  const values = url.searchParams.getAll("jobPostId");
  const keys = [...url.searchParams.keys()];
  if (values.length !== 1 || keys.length !== 1 || keys[0] !== "jobPostId" || !isUuid(values[0])) {
    throw new BillingHttpError(400, "job_post_id_invalid");
  }
  return values[0];
}

export async function handleJobPostStatus(
  request: Request,
  env: BillingEnv,
  dependencies: JobPostStatusDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_JOB_POST_FEES_ENABLED", "job_post_fees_disabled");
    requireGet(request);
    const jobPostId = jobPostIdFromRequest(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, status: await dependencies.load(auth, jobPostId) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleJobPostStatus(context.request, context.env);

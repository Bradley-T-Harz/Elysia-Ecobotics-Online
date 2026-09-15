import { createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { loadPublicSponsorshipRecognition } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { BillingEnv } from "../_shared/types.ts";

export type SponsorshipRecognitionDependencies = {
  load(env: BillingEnv): ReturnType<typeof loadPublicSponsorshipRecognition>;
};

const defaultDependencies: SponsorshipRecognitionDependencies = {
  load: (env) => loadPublicSponsorshipRecognition(createEconomicServerClient(env))
};

export async function handleSponsorshipRecognition(
  request: Request,
  env: BillingEnv,
  dependencies: SponsorshipRecognitionDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    if (env.BILLING_SPONSORSHIP_RECOGNITION_ENABLED !== "true") {
      return jsonResponse({
        ok: true,
        recognition: { enabled: false, recognitions: [], paymentGrantsAuthority: false }
      });
    }
    assertBillingMode(env);
    return jsonResponse({ ok: true, recognition: await dependencies.load(env) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSponsorshipRecognition(context.request, context.env);

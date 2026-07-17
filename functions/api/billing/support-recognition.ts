import { createEconomicServerClient } from "./_shared/auth.ts";
import { assertTestOnlyBillingMode } from "./_shared/config.ts";
import { loadPublicSupportRecognition } from "./_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import type { BillingEnv } from "./_shared/types.ts";

export type PublicSupportRecognitionDependencies = {
  load(env: BillingEnv): ReturnType<typeof loadPublicSupportRecognition>;
};

const defaultDependencies: PublicSupportRecognitionDependencies = {
  load: (env) => loadPublicSupportRecognition(createEconomicServerClient(env))
};

const disabledRecognition = {
  enabled: false,
  supporters: [],
  ranked: false,
  amountsPublic: false,
  paymentGrantsAuthority: false
} as const;

export async function handlePublicSupportRecognition(
  request: Request,
  env: BillingEnv,
  dependencies: PublicSupportRecognitionDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    if (env.BILLING_SUPPORT_RECOGNITION_ENABLED !== "true") {
      return jsonResponse({ ok: true, recognition: disabledRecognition });
    }
    assertTestOnlyBillingMode(env);
    return jsonResponse({ ok: true, recognition: await dependencies.load(env) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handlePublicSupportRecognition(context.request, context.env);

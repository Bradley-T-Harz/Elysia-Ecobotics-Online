import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { setCurrentUserSupportRecognition } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { supportRecognitionPreferenceRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, SupportRecognitionPreferenceRequest } from "../_shared/types.ts";

export type SupportRecognitionPreferenceDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(auth: AuthenticatedBillingRequest, input: SupportRecognitionPreferenceRequest): ReturnType<typeof setCurrentUserSupportRecognition>;
};

const defaultDependencies: SupportRecognitionPreferenceDependencies = {
  authenticate: authenticateRequired,
  mutate: (auth, input) => setCurrentUserSupportRecognition(auth.supabase, input)
};

export async function handleSupportRecognitionPreference(
  request: Request,
  env: BillingEnv,
  dependencies: SupportRecognitionPreferenceDependencies = defaultDependencies
): Promise<Response> {
  try {
    // Opt-out remains available even when checkout and public display are off.
    assertBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await supportRecognitionPreferenceRequest(request);
    return jsonResponse({ ok: true, recognition: await dependencies.mutate(auth, input) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSupportRecognitionPreference(context.request, context.env);

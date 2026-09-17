import { createEconomicPublicClient, economicPublicClientConfigured, economicServerClientConfigured } from "./_shared/auth.ts";
import { billingCapabilities } from "./_shared/config.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import type { BillingEnv } from "./_shared/types.ts";

export function runtimeReadiness(env: BillingEnv) {
  const runtime = billingCapabilities(env);
  return {
      mode: env.BILLING_MODE === "live" ? "live" : env.BILLING_MODE === "test" ? "test" : "disabled",
      credentialPresent: Boolean(env.BILLING_MODE === "live" ? env.STRIPE_SECRET_KEY_LIVE : env.BILLING_MODE === "test" ? env.STRIPE_SECRET_KEY_TEST : false),
      webhookSecretPresent: Boolean(env.BILLING_MODE === "live" ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.BILLING_MODE === "test" ? env.STRIPE_WEBHOOK_SECRET_TEST : false),
      testCredentialPresent: Boolean(env.STRIPE_SECRET_KEY_TEST),
      testWebhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET_TEST),
      liveCredentialPresent: Boolean(env.STRIPE_SECRET_KEY_LIVE),
      liveWebhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET_LIVE),
      economicPublicConfigured: economicPublicClientConfigured(env),
      economicServerConfigured: economicServerClientConfigured(env),
      providerConfigured: runtime.providerConfigured,
      oneTimeSupport: runtime.oneTimeSupport, recurringSupport: runtime.recurringSupport,
      organizationServiceCheckout: runtime.organizationServiceCheckout, sponsorshipCheckout: runtime.sponsorshipCheckout,
      jobPostCheckout: runtime.enabled && env.BILLING_JOB_POST_FEES_ENABLED === "true",
      thirdPartyMoney: false
  };
}

export const onRequest: PagesFunction<BillingEnv> = async ({ request, env }) => {
  try {
    requireGet(request);
    // Presence-only diagnostics remain available before database binding.
    let provider: unknown = null;
    try {
      const { data, error } = await createEconomicPublicClient(env).rpc("current_first_party_provider_readiness").abortSignal(AbortSignal.timeout(10_000));
      if (!error) provider = data;
    } catch { /* Unavailable database must not imply readiness. */ }
    return jsonResponse({ ok: provider !== null, provider, runtime: runtimeReadiness(env) });
  } catch (error) { return safeBillingErrorResponse(error); }
};

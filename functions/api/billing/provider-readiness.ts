import { createEconomicPublicClient } from "./_shared/auth.ts";
import { billingCapabilities } from "./_shared/config.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import type { BillingEnv } from "./_shared/types.ts";

export const onRequest: PagesFunction<BillingEnv> = async ({ request, env }) => {
  try {
    requireGet(request);
    const runtime = billingCapabilities(env);
    const { data, error } = await createEconomicPublicClient(env).rpc("current_first_party_provider_readiness");
    return jsonResponse({ ok: !error, provider: data ?? null, runtime: {
      mode: env.BILLING_MODE === "live" ? "live" : env.BILLING_MODE === "test" ? "test" : "disabled",
      credentialPresent: Boolean(env.BILLING_MODE === "live" ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST),
      webhookSecretPresent: Boolean(env.BILLING_MODE === "live" ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST),
      providerConfigured: runtime.providerConfigured,
      oneTimeSupport: runtime.oneTimeSupport, recurringSupport: runtime.recurringSupport,
      organizationServiceCheckout: runtime.organizationServiceCheckout, sponsorshipCheckout: runtime.sponsorshipCheckout,
      jobPostCheckout: runtime.enabled && env.BILLING_JOB_POST_FEES_ENABLED === "true",
      thirdPartyMoney: false
    } });
  } catch (error) { return safeBillingErrorResponse(error); }
};

import { createEconomicPublicClient } from "./_shared/auth.ts";
import { billingCapabilities } from "./_shared/config.ts";
import { loadEconomicPublicCapabilities, type EconomicPublicCapabilities } from "./_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import type { BillingEnv } from "./_shared/types.ts";

export type BillingCapabilitiesDependencies = {
  load(env: BillingEnv): Promise<EconomicPublicCapabilities | null>;
};

const defaultDependencies: BillingCapabilitiesDependencies = {
  load: (env) => loadEconomicPublicCapabilities(createEconomicPublicClient(env))
};

export async function handleBillingCapabilities(
  request: Request,
  env: BillingEnv,
  dependencies: BillingCapabilitiesDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    const state = billingCapabilities(env);
    const database = state.configured
      ? await dependencies.load(env).catch(() => null)
      : null;
    const available = state.enabled && state.configured && state.providerConfigured && database !== null && (database.providerMode ?? "test") === env.BILLING_MODE;
    const accountManagementAvailable = state.configured && database !== null && (database.providerMode ?? "test") === env.BILLING_MODE;
    const checkoutAvailable = available
      && state.redirectConfigured
      && state.webhookFulfillment
      && state.notificationRetry
      && database?.economicWebhooksEnabled === true;
    return jsonResponse({
      ok: true,
      mode: accountManagementAvailable ? env.BILLING_MODE : "disabled",
      livePayments: checkoutAvailable && env.BILLING_MODE === "live",
      processor: "stripe",
      features: {
        jobPostCheckout: checkoutAvailable && env.BILLING_JOB_POST_FEES_ENABLED === "true" && database?.jobPostCheckoutEnabled === true,
        oneTimeSupport: checkoutAvailable && state.oneTimeSupport && database?.supportCheckoutEnabled === true,
        recurringSupport: checkoutAvailable
          && state.recurringSupport
          && state.customerPortal
          && database?.recurringSupportEnabled === true
          && database?.customerPortalEnabled === true,
        customerPortal: accountManagementAvailable && state.providerConfigured && state.redirectConfigured && state.customerPortal && database?.customerPortalEnabled === true,
        accountLifecycle: accountManagementAvailable && state.serverConfigured && state.accountLifecycle,
        sellerOnboarding: available && state.redirectConfigured && state.sellerOnboarding && database?.marketplaceSellerOnboardingEnabled === true,
        organizationServiceCheckout: checkoutAvailable
          && state.organizationServiceCheckout
          && database?.organizationServiceCheckoutEnabled === true,
        sponsorshipCheckout: checkoutAvailable
          && state.sponsorshipCheckout
          && database?.sponsorshipCheckoutEnabled === true
      },
      legalDocumentVersions: accountManagementAvailable ? database?.legalDocumentVersions ?? null : null,
      legalConsentBundles: accountManagementAvailable ? database?.legalConsentBundles ?? null : null
    });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleBillingCapabilities(context.request, context.env);

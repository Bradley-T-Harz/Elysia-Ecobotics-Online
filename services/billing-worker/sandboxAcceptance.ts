import { WorkerEntrypoint } from "cloudflare:workers";
import type { BillingEnv } from "../../functions/api/billing/_shared/types.ts";
import { readBoundedResponseJson, fetchWithTimeout } from "../../functions/api/billing/_shared/http.ts";
import { STRIPE_FIRST_PARTY_API_VERSION, STRIPE_FIRST_PARTY_WEBHOOK_URLS, STRIPE_ECONOMIC_MUTATION_EVENT_TYPES } from "../../functions/api/billing/_shared/stripeContract.ts";
import { desiredPaymentMethods, assertPaymentMethodPolicy } from "../../functions/api/billing/_shared/stripePaymentMethods.ts";
import refs from "../../docs/stripe-sandbox-acceptance-2026-09-17/provider-references.json";
import { createEconomicServerClient, createEconomicPublicClient } from "../../functions/api/billing/_shared/auth.ts";
import { handleOneTimeCheckout } from "../../functions/api/billing/checkout.ts";

const origin = "https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev";

export function assertAcceptanceSandbox(env: BillingEnv): void {
  if (env.SUPABASE_URL !== "https://kdtqyxlrkpmlpupzgmwv.supabase.co"
    || env.STRIPE_ACCOUNT_ID !== refs.account || env.BILLING_PUBLIC_ORIGIN !== origin
    || !["disabled", "test"].includes(env.BILLING_MODE ?? "")
    || env.STRIPE_API_VERSION !== STRIPE_FIRST_PARTY_API_VERSION
    || env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_WEBHOOK_SECRET_LIVE
    || !/^rk_test_/.test(env.STRIPE_SECRET_KEY_TEST ?? "")
    || [env.STRIPE_LIVE_ENABLED, env.STRIPE_CONNECT_ENABLED, env.BILLING_SELLER_ONBOARDING_ENABLED,
      env.BILLING_MARKETPLACE_COMMERCE_ENABLED, env.BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED,
      env.BILLING_SANDBOX_PURCHASES_ENABLED].some(value => value === "true")) {
    throw new Error("sandbox_acceptance_scope_invalid");
  }
}

// No HTTP route exposes this entrypoint. Only an authenticated Cloudflare
// service binding can call it. Never return provider bodies or exception text.
export class SandboxAcceptance extends WorkerEntrypoint<BillingEnv> {
  async startGuestCheckout() {
    try {
      assertAcceptanceSandbox(this.env);
      if (this.env.BILLING_MODE !== "test" || this.env.BILLING_ENABLED !== "true") return { result: "acceptance_disabled" };
      const response = await handleOneTimeCheckout(new Request(`${origin}/api/billing/checkout`, {
        method: "POST", headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ clientRequestId: crypto.randomUUID(), amountMinor: 500, currency: "usd", sourceRoute: "/support", consentVersion: "2026-09-15-first-party" })
      }), this.env);
      const data = await response.json() as { ok?: boolean; checkoutUrl?: string; orderReference?: string; error?: unknown };
      // Capability URL is consumed in-memory by the local browser driver only.
      // Never log, persist, or place it in acceptance evidence.
      return response.ok && data.ok ? { result: "checkout_created", checkoutUrl: data.checkoutUrl } : { result: "checkout_failed", status: response.status, code: typeof data.error === "string" && /^[a-z_]{1,80}$/.test(data.error) ? data.error : "checkout_rejected" };
    } catch { return { result: "checkout_failed" }; }
  }

  async recordCatalog() {
    try {
      assertAcceptanceSandbox(this.env);
      const checks = await this.inspect();
      if (refs.rows.some(row => checks[row.priceCode ?? row.productKey] !== "passed")) return { result: "provider_verification_required" };
      const client = createEconomicServerClient({ ...this.env, BILLING_MODE: "test" });
      let recorded = 0;
      for (const row of refs.rows) {
        const { error } = await client.rpc("record_economic_test_catalog_reference", {
          p_product_key: row.productKey, p_price_code: row.priceCode, p_provider: "stripe",
          p_provider_product_id: row.providerProductReference, p_provider_price_id: row.providerPriceReference
        });
        if (error) return { result: "catalog_record_failed", recorded };
        recorded++;
      }
      return { result: "catalog_recorded", recorded };
    } catch { return { result: "catalog_record_failed" }; }
  }

  async readiness() {
    try {
      assertAcceptanceSandbox(this.env);
      const { data, error } = await createEconomicPublicClient(this.env).rpc("current_first_party_provider_readiness");
      // This canonical public RPC contains configuration readiness only.
      if (error) return { result: "database_readiness_unavailable" };
      return { result: "readiness_loaded", readiness: data };
    } catch { return { result: "database_readiness_unavailable" }; }
  }

  async inspect() {
    try { assertAcceptanceSandbox(this.env); } catch { return { scope: "invalid" }; }
    const results: Record<string, string | number | boolean> = {};
    const get = async (path: string): Promise<any> => {
      const response = await fetchWithTimeout(`https://api.stripe.com${path}`, {
        headers: { authorization: `Bearer ${this.env.STRIPE_SECRET_KEY_TEST}`, "stripe-version": STRIPE_FIRST_PARTY_API_VERSION },
        redirect: "error"
      }, 15000).catch(() => { throw new Error("fetch_unavailable"); });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const value = await readBoundedResponseJson(response).catch(() => { throw new Error("response_invalid"); });
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_response");
      if ("livemode" in value && value.livemode !== false) throw new Error("mode_mismatch");
      return value;
    };
    const check = async (name: string, action: () => Promise<boolean>) => {
      try { results[name] = await action() ? "passed" : "mismatch"; }
      catch (error) {
        // Whitelist locally generated status codes only; never exception messages.
        const message = error instanceof Error ? error.message : "";
        results[name] = /^(http_[1-5][0-9]{2}|fetch_unavailable|response_invalid|mode_mismatch)$/.test(message) ? message : "check_failed";
      }
    };
    await check("account", async () => (await get("/v1/account")).id === refs.account);
    // Do not inspect objects belonging to an unverified account.
    if (results.account !== "passed") return results;
    await check("payment_method_configuration", async () => {
      const baseline = await get(`/v1/payment_method_configurations/${refs.paymentMethodDefaultConfigurationId}`);
      const managed = await get(`/v1/payment_method_configurations/${refs.paymentMethodConfigurationId}`);
      assertPaymentMethodPolicy(managed, "test", desiredPaymentMethods(baseline, "test"));
      return managed.id === refs.paymentMethodConfigurationId && baseline.id === refs.paymentMethodDefaultConfigurationId;
    });
    for (const row of refs.rows.filter((row, index, rows) => rows.findIndex(other => other.productKey === row.productKey) === index)) {
      await check(row.productKey, async () => {
        const value = await get(`/v1/products/${row.providerProductReference}`);
        return value.id === row.providerProductReference && value.active === true && value.livemode === false
          && value.metadata?.economic_product_key === row.productKey && value.metadata?.economic_environment === "test";
      });
    }
    const amounts = [100, 500, 1200, 2500, 5000];
    for (const [index, row] of refs.rows.filter(row => row.priceCode).entries()) {
      await check(row.priceCode!, async () => {
        const value = await get(`/v1/prices/${row.providerPriceReference}`);
        return value.id === row.providerPriceReference && value.active === true && value.livemode === false
          && value.product === row.providerProductReference && value.currency === "usd" && value.unit_amount === amounts[index]
          && value.recurring?.interval === "month" && value.recurring?.interval_count === 1;
      });
    }
    await check("customer_portal", async () => {
      const value = await get(`/v1/billing_portal/configurations/${refs.portalConfigurationId}`);
      return value.id === refs.portalConfigurationId && value.active === true && value.livemode === false
        && value.features?.subscription_cancel?.enabled === true && value.features.subscription_cancel.mode === "at_period_end"
        && value.features.subscription_cancel.proration_behavior === "none" && value.features.subscription_update?.enabled === false
        && value.features.invoice_history?.enabled === true && value.features.payment_method_update?.enabled === true
        && value.default_return_url === `${origin}/commons-circle/support-billing`
        && value.business_profile?.privacy_policy_url === "https://elysiaecobotics.com/legal/privacy-policy"
        && value.business_profile?.terms_of_service_url === "https://elysiaecobotics.com/legal/support-and-billing-terms";
    });
    await check("webhook_endpoint_contract", async () => {
      const endpoints: any[] = [];
      let cursor = "";
      for (let page = 0; page < 10; page++) {
        const result = await get(`/v1/webhook_endpoints?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`);
        if (!Array.isArray(result.data)) return false;
        endpoints.push(...result.data.filter((item: any) => item.url === STRIPE_FIRST_PARTY_WEBHOOK_URLS.test));
        if (!result.has_more) break;
        if (page === 9 || !result.data.at(-1)?.id) return false;
        cursor = result.data.at(-1).id;
      }
      const endpoint = endpoints[0];
      return endpoints.length === 1 && endpoint.status === "enabled" && endpoint.livemode === false
        && endpoint.api_version === STRIPE_FIRST_PARTY_API_VERSION
        && JSON.stringify([...(endpoint.enabled_events ?? [])].sort()) === JSON.stringify([...STRIPE_ECONOMIC_MUTATION_EVENT_TYPES].sort());
    });
    return results;
  }
}

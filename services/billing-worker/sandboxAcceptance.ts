import { WorkerEntrypoint } from "cloudflare:workers";
import type { BillingEnv } from "../../functions/api/billing/_shared/types.ts";
import { readBoundedResponseJson, fetchWithTimeout } from "../../functions/api/billing/_shared/http.ts";
import { STRIPE_FIRST_PARTY_API_VERSION, STRIPE_FIRST_PARTY_WEBHOOK_URLS, STRIPE_ECONOMIC_MUTATION_EVENT_TYPES } from "../../functions/api/billing/_shared/stripeContract.ts";
import { desiredPaymentMethods, assertPaymentMethodPolicy } from "../../functions/api/billing/_shared/stripePaymentMethods.ts";
import refs from "../../docs/stripe-sandbox-acceptance-2026-09-17/provider-references.json";
import { createEconomicServerClient, createEconomicPublicClient, authenticateRequired } from "../../functions/api/billing/_shared/auth.ts";
import { prepareJobPostCheckout, attachCheckoutBillingCustomer, attachCheckoutSession, failCheckout } from "../../functions/api/billing/_shared/database.ts";
import { StripeProvider } from "../../functions/api/billing/_shared/stripe.ts";
import { handleOneTimeCheckout } from "../../functions/api/billing/checkout.ts";
import { handleRecurringCheckout } from "../../functions/api/billing/recurring-checkout.ts";
import { handleCustomerPortal } from "../../functions/api/billing/portal.ts";
import { handleBillingScheduled } from "./worker.ts";
import { handleOperatorTestRefundExecution } from "../../functions/api/billing/operator/refund-execution.ts";
import { handleJobPostCheckout } from "../../functions/api/billing/job-post/checkout.ts";

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
  async expireCheckout(sessionId: string) {
    try {
      assertAcceptanceSandbox(this.env);
      if (this.env.BILLING_MODE !== "test" || !/^cs_test_[A-Za-z0-9]{10,200}$/.test(sessionId)) return { result: "cleanup_scope_invalid" };
      const headers = { authorization: `Bearer ${this.env.STRIPE_SECRET_KEY_TEST}`, "stripe-version": STRIPE_FIRST_PARTY_API_VERSION };
      const url = `https://api.stripe.com/v1/checkout/sessions/${sessionId}`;
      const response = await fetchWithTimeout(url, { headers, redirect: "error" }, 15000);
      if (!response.ok) return { result: "cleanup_read_failed", status: response.status };
      const session = await readBoundedResponseJson(response) as { livemode?: boolean; status?: string; payment_status?: string; metadata?: Record<string, string> };
      if (session.livemode !== false || session.metadata?.economic_environment !== "test"
        || session.metadata?.economic_lane !== "support_one_time") return { result: "cleanup_scope_invalid" };
      if (session.status !== "open") return { result: "already_closed" };
      if (session.payment_status !== "unpaid") return { result: "cleanup_payment_in_progress" };
      const expired = await fetchWithTimeout(`${url}/expire`, { method: "POST", headers: { ...headers, "idempotency-key": `sandbox-expire:${sessionId}`, "content-type": "application/x-www-form-urlencoded" }, body: "", redirect: "error" }, 15000);
      return { result: expired.ok ? "expired" : "cleanup_failed", status: expired.status };
    } catch { return { result: "cleanup_failed" }; }
  }

  async negativeChecks() {
    try {
      assertAcceptanceSandbox(this.env);
      if (this.env.BILLING_MODE !== "test" || this.env.BILLING_ENABLED !== "true") return { result: "acceptance_disabled" };
      const body = { clientRequestId: crypto.randomUUID(), amountMinor: 500, currency: "usd", sourceRoute: "/support", consentVersion: "2026-09-15-first-party" };
      const request = (patch: object = {}, requestOrigin = origin) => new Request(`${origin}/api/billing/checkout`, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify({ ...body, ...patch }) });
      const statuses = {
        injectedPrice: (await handleOneTimeCheckout(request({ price: 1 }), this.env)).status,
        fractionalAmount: (await handleOneTimeCheckout(request({ amountMinor: 100.5 }), this.env)).status,
        foreignCurrency: (await handleOneTimeCheckout(request({ currency: "eur" }), this.env)).status,
        wrongOrigin: (await handleOneTimeCheckout(request({}, "https://example.invalid"), this.env)).status,
        laneKill: (await handleOneTimeCheckout(request(), { ...this.env, BILLING_SUPPORT_CHECKOUT_ENABLED: "false" })).status,
        globalKill: (await handleOneTimeCheckout(request(), { ...this.env, BILLING_ENABLED: "false" })).status
      };
      const key = "sandbox-acceptance-20260917-rate-probe";
      const limits = [];
      for (let attempt = 0; attempt < 120; attempt++) limits.push(await this.env.BILLING_MUTATION_RATE_LIMITER!.limit({ key }));
      return { result: "negative_checks", statuses, rateLimit: { accepted: limits.filter(result => result.success).length, rejected: limits.filter(result => !result.success).length } };
    } catch { return { result: "negative_checks_failed" }; }
  }

  async reconcile() {
    try {
      assertAcceptanceSandbox(this.env);
      return await handleBillingScheduled(this.env);
    } catch { return { result: "sandbox_reconciliation_failed" }; }
  }

  async accountFlow(flow: "recurring" | "portal" | "refund" | "job", refundId?: string) {
    try {
      assertAcceptanceSandbox(this.env);
      if (this.env.BILLING_MODE !== "test" || this.env.BILLING_ENABLED !== "true"
        || !["recurring", "portal", "refund", "job"].includes(flow)) return { result: "acceptance_disabled" };
      if (flow === "refund" && !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(refundId ?? "")) return { result: "refund_fixture_invalid" };
      const admin = createEconomicServerClient(this.env);
      const id = "f6170000-0000-4000-8000-000000000010";
      const email = "stripe-recurring-acceptance@example.invalid";
      const password = `Aa1!${crypto.randomUUID()}`;
      const existing = await admin.auth.admin.getUserById(id);
      if (existing.data.user && (existing.data.user.email !== email || existing.data.user.app_metadata?.sandbox_acceptance !== "20260917")) return { result: "fixture_scope_invalid" };
      const setup = existing.data.user
        ? await admin.auth.admin.updateUserById(id, { password })
        : await admin.auth.admin.createUser({ id, email, password, email_confirm: true, app_metadata: { sandbox_acceptance: "20260917" } });
      if (setup.error) return { result: "fixture_setup_failed", status: setup.error.status, code: ["email_address_invalid", "unexpected_failure", "email_exists", "user_already_exists", "bad_jwt", "not_admin", "validation_failed", "weak_password", "email_address_not_authorized", "bad_json"].includes(setup.error.code ?? "") ? setup.error.code : "auth_rejected" };
      const signedIn = await createEconomicPublicClient(this.env).auth.signInWithPassword({ email, password });
      if (signedIn.error || !signedIn.data.session) return { result: "fixture_login_failed" };
      if (flow === "job") {
        let providerFailure: { status: number; type: string; parameter: string } | undefined;
        const providerFetch: typeof fetch = async (input, init) => {
          const response = await fetch(input, init);
          if (!response.ok) {
            const body = await readBoundedResponseJson(response.clone()).catch(() => null) as { error?: { type?: string; param?: string } } | null;
            const type = body?.error?.type ?? "";
            const parameter = body?.error?.param ?? "";
            providerFailure = { status: response.status, type: ["idempotency_error", "invalid_request_error", "authentication_error", "permission_error"].includes(type) ? type : "provider_rejected", parameter: ["expires_at", "customer", "adaptive_pricing[enabled]", "line_items"].includes(parameter) ? parameter : "unspecified" };
          }
          return response;
        };
        const response = await handleJobPostCheckout(new Request(`${origin}/api/billing/job-post/checkout`, {
          method: "POST", headers: { origin, "content-type": "application/json", authorization: `Bearer ${signedIn.data.session.access_token}` },
          body: JSON.stringify({ jobPostId: "f6170000-0000-4000-8000-000000000031", clientRequestId: "f6170000-0000-4000-8000-000000000032", sourceRoute: "/commune/rooms/job-post", consentVersion: "2026-09-15-first-party" })
        }), this.env, {
          authenticate: authenticateRequired, provider: env => new StripeProvider(env, providerFetch),
          prepare: (env, actor, input) => prepareJobPostCheckout(createEconomicServerClient(env), actor, input),
          attachCustomer: (env, order, customer) => attachCheckoutBillingCustomer(createEconomicServerClient(env), order, customer),
          attach: (env, order, session, customer) => attachCheckoutSession(createEconomicServerClient(env), order, session, customer),
          fail: (env, order, code) => failCheckout(createEconomicServerClient(env), order, code)
        });
        const data = await response.json() as { ok?: boolean; checkoutUrl?: string; error?: unknown };
        return response.ok && data.ok ? { result: "checkout_created", checkoutUrl: data.checkoutUrl }
          : { result: "job_checkout_failed", status: response.status, code: typeof data.error === "string" && /^[a-z_]{1,80}$/.test(data.error) ? data.error : "job_checkout_rejected", providerFailure };
      }
      const request = new Request(`${origin}/api/billing/${flow === "recurring" ? "recurring-checkout" : "portal"}`, {
        method: "POST", headers: { origin, "content-type": "application/json", authorization: `Bearer ${signedIn.data.session.access_token}` },
        body: JSON.stringify(flow === "recurring" ? { clientRequestId: crypto.randomUUID(), priceCode: "support_monthly_commons_usd", sourceRoute: "/support", consentVersion: "2026-09-15-first-party" } : flow === "refund" ? { refundRequestId: refundId, approvalClientRequestId: "f6170000-0000-4000-8000-000000000011", providerAttachClientRequestId: "f6170000-0000-4000-8000-000000000012", confirmation: "AUTHORIZE TEST REFUND", reason: "Synthetic 20260917 sandbox acceptance refund" } : { clientRequestId: crypto.randomUUID() })
      });
      const response = await (flow === "recurring" ? handleRecurringCheckout : flow === "refund" ? handleOperatorTestRefundExecution : handleCustomerPortal)(request, this.env);
      const data = await response.json() as { ok?: boolean; checkoutUrl?: string; portalUrl?: string; error?: unknown; refund?: { providerStatus?: string; status?: string; idempotentReplay?: boolean } };
      if (flow === "refund" && response.ok && data.ok) return { result: "refund_executed", providerStatus: data.refund?.providerStatus, status: data.refund?.status, idempotentReplay: data.refund?.idempotentReplay };
      return response.ok && data.ok ? { result: flow === "recurring" ? "checkout_created" : "portal_created", checkoutUrl: data.checkoutUrl, portalUrl: data.portalUrl }
        : { result: "account_flow_failed", status: response.status, code: typeof data.error === "string" && /^[a-z_]{1,80}$/.test(data.error) ? data.error : "account_flow_rejected" };
    } catch { return { result: "account_flow_failed" }; }
  }

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
      const preferences = desiredPaymentMethods(baseline, "test");
      assertPaymentMethodPolicy(managed, "test", preferences);
      results.enabled_payment_methods = Object.entries(preferences).filter(([, enabled]) => enabled === "on").map(([method]) => method).sort().join(",");
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

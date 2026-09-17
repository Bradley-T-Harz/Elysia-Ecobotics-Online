import { STRIPE_ECONOMIC_MUTATION_EVENT_TYPES } from "./stripeContract.ts";
import { assertPaymentMethodPolicy } from "./stripePaymentMethods.ts";
import { stripeConfig, stripeTestConfig } from "./config.ts";
import { BillingHttpError, fetchWithTimeout, readBoundedResponseJson } from "./http.ts";
import { isUuid } from "./schema.ts";
import type {
  BillingEnv,
  BillingProvider,
  NormalizedProviderEvent,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderCustomerInput,
  ProviderCustomerResult,
  ProviderMarketplaceCatalogInput,
  ProviderMarketplaceCatalogResult,
  ProviderPortalInput,
  ProviderPortalResult,
  ProviderRefundInput,
  ProviderRefundResult,
  ProviderSellerOnboardingInput,
  ProviderSellerOnboardingResult,
  ProviderSellerStatus
} from "./types.ts";

type Row = Record<string, unknown>;

const STRIPE_API_ORIGIN = "https://api.stripe.com";

function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BillingHttpError(502, "payment_provider_invalid");
  return value as Row;
}

function valueString(value: unknown, maximum = 255): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function providerReference(value: unknown, prefix: string): string | null {
  const text = valueString(value);
  return text && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`).test(text) ? text : null;
}

function boundedInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000 ? value : null;
}

function statusText(value: unknown): string | null {
  const text = valueString(value, 80);
  return text && /^[a-z0-9_]+$/.test(text) ? text : null;
}

const STRIPE_DISPUTE_STATUSES = new Set([
  "warning_needs_response", "warning_under_review", "warning_closed",
  "needs_response", "under_review", "won", "lost", "prevented"
]);

export { STRIPE_ECONOMIC_MUTATION_EVENT_TYPES } from "./stripeContract.ts";

const STRIPE_ECONOMIC_MUTATION_EVENT_TYPE_SET = new Set<string>(STRIPE_ECONOMIC_MUTATION_EVENT_TYPES);

function disputeStatusText(value: unknown): string | null {
  const status = statusText(value);
  return status && STRIPE_DISPUTE_STATUSES.has(status) ? status : null;
}

function requirementText(value: unknown): string | null {
  const text = valueString(value, 160);
  return text && /^[a-z0-9_.]+$/.test(text) ? text : null;
}

function optionalRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function absoluteUrl(value: unknown, hostname: string): string {
  const text = valueString(value, 4_096);
  if (!text) throw new BillingHttpError(502, "payment_provider_invalid");
  let url: URL;
  try { url = new URL(text); }
  catch { throw new BillingHttpError(502, "payment_provider_invalid"); }
  if (url.protocol !== "https:" || url.hostname !== hostname || url.port || url.username || url.password) {
    throw new BillingHttpError(502, "payment_provider_invalid");
  }
  return url.toString();
}

function stripeForm(fields: Record<string, string | null | undefined>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== null && value !== undefined) form.set(key, value);
  return form;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return output;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string, tolerance: number, nowSeconds: number): Promise<void> {
  if (signatureHeader.length > 4_096 || /[\r\n]/.test(signatureHeader)) throw new BillingHttpError(400, "webhook_signature_invalid");
  const pieces = signatureHeader.split(",").map((piece) => piece.trim());
  const timestamps = pieces.filter((piece) => piece.startsWith("t=")).map((piece) => piece.slice(2));
  const signatures = pieces.filter((piece) => piece.startsWith("v1=")).map((piece) => piece.slice(3));
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0]) || signatures.length === 0 || signatures.length > 8) {
    throw new BillingHttpError(400, "webhook_signature_invalid");
  }
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > tolerance) {
    throw new BillingHttpError(400, "webhook_signature_invalid");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const valid = signatures.some((candidate) => {
    const bytes = hexBytes(candidate);
    return bytes ? constantTimeEqual(expected, bytes) : false;
  });
  if (!valid) throw new BillingHttpError(400, "webhook_signature_invalid");
}

function nestedReference(object: Row, key: string, prefix: string): string | null {
  const value = object[key];
  if (typeof value === "string") return providerReference(value, prefix);
  if (value && typeof value === "object" && !Array.isArray(value)) return providerReference((value as Row).id, prefix);
  return null;
}

function unixTime(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 946_684_800 || value > 4_102_444_800) return null;
  return new Date(value * 1_000).toISOString();
}

function metadataOrderId(...values: unknown[]): string | null {
  for (const value of values) {
    const metadata = optionalRow(value);
    const candidate = metadata ? valueString(metadata.economic_order_id, 64) : null;
    if (candidate && isUuid(candidate)) return candidate;
  }
  return null;
}

function normalizedStripeEvent(event: Row, payloadSha256: string, expectedApiVersion: string, live: boolean): NormalizedProviderEvent {
  const providerEventId = providerReference(event.id, "evt");
  const eventType = valueString(event.type, 160);
  const createdAt = unixTime(event.created);
  // This endpoint processes only the platform account's economic events.
  // Stripe includes a top-level `account` on Connect-context events; no
  // accepted event type here needs that context, so fail closed before any
  // order metadata or provider reference reaches the database processor.
  if (
    !providerEventId
    || !eventType
    || !/^[a-z0-9_.]+$/.test(eventType)
    || !createdAt
    || event.livemode !== live
    || (event.account !== undefined && event.account !== null)
  ) {
    throw new BillingHttpError(400, "webhook_event_invalid");
  }
  if (valueString(event.api_version, 40) !== expectedApiVersion) {
    throw new BillingHttpError(400, "webhook_api_version_mismatch");
  }
  const data = row(event.data);
  const object = row(data.object);
  const objectType = valueString(object.object, 80);
  const parent = optionalRow(object.parent);
  const parentSubscription = optionalRow(parent?.subscription_details);
  const legacySubscription = optionalRow(object.subscription_details);
  const validOrderId = metadataOrderId(
    object.metadata,
    parentSubscription?.metadata,
    legacySubscription?.metadata
  );

  let paymentReference = nestedReference(object, "payment_intent", "pi");
  let subscriptionReference = nestedReference(object, "subscription", "sub");
  let invoiceReference = nestedReference(object, "invoice", "in");
  let refundReference: string | null = null;
  let disputeReference: string | null = null;
  let sellerAccountReference: string | null = null;
  const objectId = valueString(object.id);
  if (objectType === "payment_intent") paymentReference = providerReference(objectId, "pi");
  if (objectType === "subscription") subscriptionReference = providerReference(objectId, "sub");
  if (objectType === "invoice") invoiceReference = providerReference(objectId, "in");
  if (objectType === "refund") refundReference = providerReference(objectId, "re");
  if (objectType === "dispute") {
    disputeReference = providerReference(objectId, "du") ?? providerReference(objectId, "dp");
  }
  if (objectType === "account") sellerAccountReference = providerReference(objectId, "acct");
  if (!subscriptionReference && parentSubscription) {
    subscriptionReference = nestedReference(parentSubscription, "subscription", "sub");
  }
  if (!subscriptionReference && legacySubscription) {
    subscriptionReference = nestedReference(legacySubscription, "subscription", "sub");
  }

  const currency = valueString(object.currency, 3)?.toLowerCase() ?? null;
  const amountMinor = objectType === "checkout.session"
    ? boundedInteger(object.amount_total)
    : objectType === "invoice" && eventType === "invoice.payment_failed"
      ? boundedInteger(object.amount_due) ?? boundedInteger(object.amount_remaining)
      : objectType === "invoice"
        ? boundedInteger(object.amount_paid) ?? boundedInteger(object.amount_due)
        : boundedInteger(object.amount);
  const normalized: NormalizedProviderEvent = {
    provider: "stripe",
    providerEventId,
    eventType,
    mutationEligible: STRIPE_ECONOMIC_MUTATION_EVENT_TYPE_SET.has(eventType),
    eventCreatedAt: createdAt,
    livemode: live,
    objectType,
    providerObjectReference: objectId && /^[a-z]+_[A-Za-z0-9_]+$/.test(objectId) ? objectId : null,
    orderId: validOrderId,
    providerCustomerId: nestedReference(object, "customer", "cus"),
    providerPaymentId: paymentReference,
    providerSubscriptionId: subscriptionReference,
    providerInvoiceId: invoiceReference,
    providerRefundId: refundReference,
    providerDisputeId: disputeReference,
    providerSellerAccountId: sellerAccountReference,
    amountMinor,
    currency: currency && /^[a-z]{3}$/.test(currency) ? currency : null,
    // Generic provider status is intentionally not mapped. The database acts on
    // event families and the scoped payment/subscription/refund/dispute fields;
    // treating an arbitrary object's `succeeded` as a payment would be unsafe.
    status: null,
    paymentStatus: objectType === "checkout.session" ? statusText(object.payment_status) : null,
    subscriptionStatus: eventType === "customer.subscription.deleted" && subscriptionReference
      ? "ended"
      : objectType === "subscription" && object.cancel_at_period_end === true
          && ["active", "trialing"].includes(statusText(object.status) ?? "")
        ? "canceling"
        : objectType === "subscription"
      ? statusText(object.status)
      : eventType === "invoice.payment_failed" && subscriptionReference
        ? "past_due"
        : eventType === "invoice.paid" && subscriptionReference
          ? "active"
          : (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded")
              && subscriptionReference
              && statusText(object.payment_status) === "paid"
            ? "active"
          : null,
    currentPeriodStart: unixTime(object.current_period_start),
    currentPeriodEnd: unixTime(object.current_period_end),
    cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null,
    refundAmountMinor: objectType === "refund" ? boundedInteger(object.amount) : null,
    refundStatus: objectType === "refund" ? statusText(object.status) : null,
    disputeStatus: objectType === "dispute" ? disputeStatusText(object.status) : null,
    disputeReason: objectType === "dispute" ? statusText(object.reason) : null,
    payloadSha256
  };
  assertSupportedEconomicEventShape(normalized);
  return normalized;
}

function assertSupportedEconomicEventShape(event: NormalizedProviderEvent): void {
  if (!event.mutationEligible) return;
  const invalid = (): never => { throw new BillingHttpError(400, "webhook_event_shape_invalid"); };
  const hasMoney = event.amountMinor !== null && event.currency !== null;
  if (event.eventType.startsWith("checkout.session.")) {
    if (event.objectType !== "checkout.session" || !event.providerObjectReference?.startsWith("cs_")) invalid();
    if (event.eventType !== "checkout.session.expired" && (!hasMoney || !event.orderId)) invalid();
    if (
      ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.eventType)
      && !["paid", "no_payment_required", ...(event.eventType === "checkout.session.completed" ? ["unpaid"] : [])].includes(event.paymentStatus ?? "")
    ) invalid();
    return;
  }
  if (event.eventType.startsWith("payment_intent.")) {
    // Subscription-created PaymentIntents do not inherit subscription metadata.
    // Persist verified events so the economic processor can resolve the exact
    // payment reference after invoice delivery; never infer ownership by customer.
    if (event.objectType !== "payment_intent" || !event.providerPaymentId || !hasMoney) invalid();
    return;
  }
  if (event.eventType.startsWith("invoice.")) {
    if (event.objectType !== "invoice" || !event.providerInvoiceId || !event.providerSubscriptionId || !hasMoney) invalid();
    if (event.eventType === "invoice.paid" && !event.providerPaymentId) invalid();
    return;
  }
  if (event.eventType.startsWith("customer.subscription.")) {
    if (event.objectType !== "subscription" || !event.providerSubscriptionId || !event.subscriptionStatus) invalid();
    return;
  }
  if (event.eventType.startsWith("refund.")) {
    if (
      event.objectType !== "refund"
      || !event.providerRefundId
      || !event.providerPaymentId
      || !hasMoney
      || !["pending", "succeeded", "failed", "canceled"].includes(event.refundStatus ?? "")
    ) invalid();
    return;
  }
  if (event.eventType.startsWith("charge.dispute.")) {
    if (event.objectType !== "dispute" || !event.providerDisputeId || !event.providerPaymentId || !hasMoney || !event.disputeStatus) invalid();
    return;
  }
  invalid();
}

export class StripeProvider implements BillingProvider {
  readonly #env: BillingEnv;
  readonly #fetcher: typeof fetch;
  readonly #now: () => number;
  #accountVerification: Promise<void> | undefined;

  constructor(env: BillingEnv, fetcher: typeof fetch = fetch, now: () => number = Date.now) {
    this.#env = env;
    this.#fetcher = fetcher;
    this.#now = now;
  }

  async #request(path: string, method: "GET" | "POST", fields?: URLSearchParams, idempotencyKey?: string): Promise<Row> {
    const config = stripeConfig(this.#env);
    if (path !== "/v1/account" && this.#env.STRIPE_ACCOUNT_ID) {
      this.#accountVerification ??= this.#request("/v1/account", "GET").then(account => {
        if (account.id !== this.#env.STRIPE_ACCOUNT_ID) throw new BillingHttpError(503, "stripe_account_mismatch");
      });
      await this.#accountVerification;
    }
    const headers = new Headers({ authorization: `Bearer ${config.secretKey}` });
    if (config.apiVersion) headers.set("stripe-version", config.apiVersion);
    if (method === "POST") {
      if (!idempotencyKey) throw new BillingHttpError(503, "provider_idempotency_required");
      headers.set("content-type", "application/x-www-form-urlencoded");
    }
    if (idempotencyKey) {
      if (!/^[A-Za-z0-9:_-]{16,255}$/.test(idempotencyKey)) throw new BillingHttpError(503, "billing_database_invalid");
      headers.set("idempotency-key", idempotencyKey);
    }
    const response = await fetchWithTimeout(new URL(path, STRIPE_API_ORIGIN), {
      method,
      headers,
      body: method === "POST" ? fields?.toString() ?? "" : undefined,
      redirect: "error"
    }, 12_000, this.#fetcher);
    if (!response.ok) {
      if (response.status === 429) throw new BillingHttpError(503, "payment_provider_busy", 5);
      throw new BillingHttpError(502, "payment_provider_unavailable");
    }
    const result = row(await readBoundedResponseJson(response));
    if (typeof result.livemode === "boolean" && result.livemode !== (config.mode === "live")) {
      throw new BillingHttpError(502, "provider_environment_mismatch");
    }
    return result;
  }

  async ensureCustomer(input: ProviderCustomerInput): Promise<ProviderCustomerResult> {
    if (!/^billing-customer:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    const result = await this.#request("/v1/customers", "POST", stripeForm({
      "metadata[economic_test_mode]": String(this.#env.BILLING_MODE === "test"),
      "metadata[account_linkage]": "server_managed"
    }), input.idempotencyKey);
    const providerCustomerReference = providerReference(result.id, "cus");
    if (!providerCustomerReference) throw new BillingHttpError(502, "payment_provider_invalid");
    return { providerCustomerReference };
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (!["support_one_time", "support_recurring", "job_post_fee", "organization_service", "sponsorship"].includes(input.flow)) {
      throw new BillingHttpError(503, "third_party_money_hard_off");
    }
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 100_000_000 || input.currency !== "usd") {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    if (input.accountLinked && !input.providerCustomerReference) {
      throw new BillingHttpError(503, "billing_customer_required");
    }
    const configurationId = this.#env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID;
    if (!/^pmc_[A-Za-z0-9]+$/.test(configurationId ?? "")) throw new BillingHttpError(503, "payment_method_configuration_required");
    const configuration = await this.#request(`/v1/payment_method_configurations/${configurationId}`, "GET");
    try {
      if (configuration.id !== configurationId) throw new Error("configuration_mismatch");
      assertPaymentMethodPolicy(configuration, this.#env.BILLING_MODE ?? "");
    } catch { throw new BillingHttpError(503, "payment_method_configuration_unsafe"); }
    if (this.#env.STRIPE_ACCOUNT_ID && (input.flow === "support_recurring" || !input.providerProductReference) && input.providerPriceReference) {
      const price = await this.#request(`/v1/prices/${encodeURIComponent(input.providerPriceReference)}`, "GET");
      const recurring = optionalRow(price.recurring);
      if (price.livemode !== (this.#env.BILLING_MODE === "live") || price.active !== true
        || price.unit_amount !== input.amountMinor || price.currency !== input.currency
        || (input.flow === "support_recurring" ? recurring?.interval !== "month" || recurring.interval_count !== 1 : recurring !== null)) {
        throw new BillingHttpError(503, "provider_catalog_amount_mismatch");
      }
    }
    if (this.#env.STRIPE_ACCOUNT_ID && (!input.checkoutExpiresAt || !Number.isFinite(Date.parse(input.checkoutExpiresAt)))) throw new BillingHttpError(503, "checkout_expiry_required");
    const fields: Record<string, string | null | undefined> = {
      mode: input.flow === "support_recurring" ? "subscription" : "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orderId,
      "metadata[economic_order_id]": input.orderId,
      "metadata[economic_lane]": input.flow,
      "metadata[economic_environment]": this.#env.BILLING_MODE,
      "line_items[0][quantity]": "1",
      payment_method_configuration: configurationId,
      "billing_address_collection": "auto",
      "phone_number_collection[enabled]": "false",
      "allow_promotion_codes": "false",
      "automatic_tax[enabled]": "false",
      // Bound abandoned-session recovery. The database keeps a five-minute
      // clock-skew margin and verified provider events remain payment truth.
      expires_at: String(input.checkoutExpiresAt ? Math.floor(Date.parse(input.checkoutExpiresAt) / 1_000) - 5 * 60 : Math.floor(this.#now() / 1_000) + 30 * 60),
      customer: input.providerCustomerReference
    };
    if (input.flow !== "support_recurring" && input.providerProductReference) {
      if (!input.providerProductReference || !/^prod_[A-Za-z0-9]+$/.test(input.providerProductReference)) {
        throw new BillingHttpError(503, "billing_catalog_unavailable");
      }
      fields["line_items[0][price_data][currency]"] = input.currency;
      fields["line_items[0][price_data][unit_amount]"] = String(input.amountMinor);
      fields["line_items[0][price_data][product]"] = input.providerProductReference;
      fields["payment_intent_data[metadata][economic_order_id]"] = input.orderId;
    } else if (input.flow === "support_recurring") {
      if (!input.providerPriceReference || !/^price_[A-Za-z0-9]+$/.test(input.providerPriceReference)) {
        throw new BillingHttpError(503, "billing_catalog_unavailable");
      }
      fields["line_items[0][price]"] = input.providerPriceReference;
      fields["subscription_data[metadata][economic_order_id]"] = input.orderId;
    } else {
      if (!input.providerPriceReference || !/^price_[A-Za-z0-9]+$/.test(input.providerPriceReference)) {
        throw new BillingHttpError(503, "billing_catalog_unavailable");
      }
      fields["line_items[0][price]"] = input.providerPriceReference;
      fields["payment_intent_data[metadata][economic_order_id]"] = input.orderId;
    }
    const result = await this.#request("/v1/checkout/sessions", "POST", stripeForm(fields), input.idempotencyKey);
    const providerSessionId = providerReference(result.id, "cs");
    if (!providerSessionId || !providerSessionId.startsWith(this.#env.BILLING_MODE === "live" ? "cs_live_" : "cs_test_")) throw new BillingHttpError(502, "payment_provider_invalid");
    return {
      providerSessionId,
      providerCustomerReference: providerReference(result.customer, "cus"),
      checkoutUrl: absoluteUrl(result.url, "checkout.stripe.com")
    };
  }

  async createCustomerPortalSession(input: ProviderPortalInput): Promise<ProviderPortalResult> {
    if (!/^cus_[A-Za-z0-9]+$/.test(input.providerCustomerReference)) throw new BillingHttpError(503, "billing_database_invalid");
    const result = await this.#request("/v1/billing_portal/sessions", "POST", stripeForm({
      customer: input.providerCustomerReference,
      configuration: this.#env.STRIPE_PORTAL_CONFIGURATION_ID,
      return_url: input.returnUrl
    }), input.idempotencyKey);
    const providerSessionId = providerReference(result.id, "bps");
    if (!providerSessionId) throw new BillingHttpError(502, "payment_provider_invalid");
    return { providerSessionId, portalUrl: absoluteUrl(result.url, "billing.stripe.com") };
  }

  async createRefund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (!/^pi_[A-Za-z0-9_]{3,250}$/.test(input.providerPaymentReference)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    if (!isUuid(input.orderId) || !Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 1_000_000_000 || input.currency !== "usd") {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    if (this.#env.STRIPE_ACCOUNT_ID) {
      const payment = await this.#request(`/v1/payment_intents/${encodeURIComponent(input.providerPaymentReference)}`, "GET");
      if (payment.livemode !== (this.#env.BILLING_MODE === "live") || payment.currency !== input.currency
        || payment.status !== "succeeded" || (boundedInteger(payment.amount_received) ?? -1) < input.amountMinor
        || (optionalRow(payment.metadata)?.economic_order_id != null && optionalRow(payment.metadata)?.economic_order_id !== input.orderId)) {
        throw new BillingHttpError(503, "provider_refund_payment_mismatch");
      }
    }
    const result = await this.#request("/v1/refunds", "POST", stripeForm({
      payment_intent: input.providerPaymentReference,
      amount: String(input.amountMinor),
      "metadata[economic_order_id]": input.orderId
    }), input.idempotencyKey);
    const providerRefundReference = providerReference(result.id, "re");
    const status = statusText(result.status);
    const amountMinor = boundedInteger(result.amount);
    const currency = valueString(result.currency, 3)?.toLowerCase();
    const providerEventCreatedAt = unixTime(result.created);
    if (
      !providerRefundReference
      || !status
      || !["pending", "succeeded", "failed", "canceled"].includes(status)
      || amountMinor !== input.amountMinor
      || currency !== input.currency
      || !providerEventCreatedAt
    ) throw new BillingHttpError(502, "payment_provider_invalid");
    return {
      providerRefundReference,
      status: status as ProviderRefundResult["status"],
      providerEventCreatedAt,
      providerResponseSha256: await sha256Hex(JSON.stringify(result))
    };
  }

  async verifyAndNormalizeWebhook(rawBody: string, signature: string): Promise<NormalizedProviderEvent> {
    const config = stripeConfig(this.#env);
    await verifyStripeSignature(rawBody, signature, config.webhookSecret, config.webhookToleranceSeconds, Math.floor(this.#now() / 1_000));
    let parsed: unknown;
    try { parsed = JSON.parse(rawBody) as unknown; }
    catch { throw new BillingHttpError(400, "webhook_event_invalid"); }
    const event = normalizedStripeEvent(row(parsed), await sha256Hex(rawBody), config.webhookApiVersion, config.mode === "live");
    return event;
  }

  async enrichVerifiedEvent(event: NormalizedProviderEvent): Promise<NormalizedProviderEvent> {
    if (this.#env.STRIPE_ACCOUNT_ID && event.providerPaymentId
      && ["payment_intent.succeeded", "invoice.paid", "checkout.session.async_payment_succeeded", "checkout.session.completed"].includes(event.eventType)
      && (event.objectType !== "checkout.session" || event.paymentStatus === "paid")) {
      const payment = await this.#request(`/v1/payment_intents/${encodeURIComponent(event.providerPaymentId)}?expand[]=latest_charge.balance_transaction`, "GET");
      const paymentOrder = optionalRow(payment.metadata)?.economic_order_id;
      const subscriptionPayment = Boolean(event.providerSubscriptionId)
        && ["invoice", "checkout.session"].includes(event.objectType ?? "");
      if (payment.livemode !== event.livemode || payment.status !== "succeeded"
        || payment.currency !== event.currency || payment.amount_received !== event.amountMinor
        || (event.orderId && paymentOrder != null && paymentOrder !== event.orderId)
        || (event.orderId && paymentOrder == null && !subscriptionPayment)) {
        throw new BillingHttpError(400, "provider_payment_evidence_mismatch");
      }
      const charge = optionalRow(payment.latest_charge);
      const settlement = optionalRow(charge?.balance_transaction);
      event.providerReceiptUrl = charge?.receipt_url ? absoluteUrl(charge.receipt_url, "pay.stripe.com") : null;
      if (settlement) {
        const fee = boundedInteger(settlement.fee), net = boundedInteger(settlement.net);
        if (settlement.currency !== event.currency || settlement.amount !== event.amountMinor
          || fee === null || net === null || fee + net !== event.amountMinor) {
          throw new BillingHttpError(400, "provider_settlement_evidence_mismatch");
        }
        event.providerBalanceTransactionId = providerReference(settlement.id, "txn");
        event.processorFeeMinor = fee;
        event.netAmountMinor = net;
      }
    }
    return event;
  }

  async createSellerOnboarding(_input: ProviderSellerOnboardingInput): Promise<ProviderSellerOnboardingResult> {
    throw new BillingHttpError(503, "third_party_money_hard_off");
  }

  async retrieveSellerStatus(_providerAccountReference: string): Promise<ProviderSellerStatus> {
    throw new BillingHttpError(503, "third_party_money_hard_off");
  }

  async ensureMarketplaceCatalog(_input: ProviderMarketplaceCatalogInput): Promise<ProviderMarketplaceCatalogResult> {
    throw new BillingHttpError(503, "third_party_money_hard_off");
  }
}

/** Compatibility entry point for isolated synthetic/sandbox qualification. */
export class StripeTestProvider extends StripeProvider {
  constructor(env: BillingEnv, fetcher: typeof fetch = fetch, now: () => number = Date.now) {
    stripeTestConfig(env);
    super(env, fetcher, now);
  }
}

export function createStripeProvider(env: BillingEnv): BillingProvider {
  stripeConfig(env);
  if (!/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID ?? "")) throw new BillingHttpError(503, "stripe_account_required");
  return new StripeProvider(env);
}

export function createStripeTestProvider(env: BillingEnv): BillingProvider {
  stripeTestConfig(env);
  return new StripeTestProvider(env);
}

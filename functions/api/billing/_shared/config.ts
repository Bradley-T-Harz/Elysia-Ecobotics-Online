import { BillingHttpError, validatedPublicOrigin } from "./http.ts";
import { economicPublicClientConfigured, economicServerClientConfigured } from "./auth.ts";
import type { BillingEnv } from "./types.ts";

export type StripeTestConfig = {
  secretKey: string;
  webhookSecret: string;
  apiVersion: string;
  webhookApiVersion: string;
  webhookToleranceSeconds: number;
  mode: "test" | "live";
};

function nonPlaceholder(value: string | undefined, minimum: number, maximum: number): string {
  if (
    !value
    || value.length < minimum
    || value.length > maximum
    || /[\r\n]/.test(value)
    || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(value)
  ) throw new BillingHttpError(503, "billing_misconfigured");
  return value;
}

function stripeApiVersion(value: string | undefined): string {
  const version = value?.trim() || "";
  if (!/^\d{4}-\d{2}-\d{2}(?:\.[a-z][a-z0-9_]*)?$/.test(version)) {
    throw new BillingHttpError(503, "billing_misconfigured");
  }
  return version;
}

export function assertTestOnlyBillingMode(env: BillingEnv): void {
  if (env.BILLING_MODE !== "test" || env.STRIPE_LIVE_ENABLED === "true") {
    throw new BillingHttpError(503, "billing_live_disabled");
  }
  if (
    env.BILLING_STAGING_ACCESS_CONFIRMED !== "true"
    || env.BILLING_EDGE_RATE_LIMIT_CONFIRMED !== "true"
  ) throw new BillingHttpError(503, "billing_test_route_protection_required");
}

export function assertBillingEnabled(env: BillingEnv): void {
  assertBillingMode(env);
  if (env.BILLING_ENABLED !== "true") throw new BillingHttpError(503, "billing_disabled");
}

export function assertBillingMutationEnabled(env: BillingEnv): void {
  assertBillingEnabled(env);
}

export function assertGuestCheckoutAbuseControls(env: BillingEnv): void {
  if (
    (env.BILLING_MODE === "test" && env.BILLING_STAGING_ACCESS_CONFIRMED !== "true")
    || env.BILLING_EDGE_RATE_LIMIT_CONFIRMED !== "true"
  ) throw new BillingHttpError(503, "guest_checkout_abuse_controls_required");
}

export type BillingFeatureFlag =
  | "BILLING_SUPPORT_CHECKOUT_ENABLED"
  | "BILLING_RECURRING_ENABLED"
  | "BILLING_WEBHOOK_FULFILLMENT_ENABLED"
  | "BILLING_NOTIFICATION_RETRY_ENABLED"
  | "BILLING_PORTAL_ENABLED"
  | "BILLING_SELLER_ONBOARDING_ENABLED"
  | "BILLING_JOB_POST_FEES_ENABLED"
  | "BILLING_SANDBOX_PURCHASES_ENABLED"
  | "BILLING_MARKETPLACE_COMMERCE_ENABLED"
  | "BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED"
  | "BILLING_ORGANIZATION_SERVICES_ENABLED"
  | "BILLING_SPONSORSHIP_ADMIN_ENABLED"
  | "BILLING_SPONSORSHIP_CHECKOUT_ENABLED"
  | "BILLING_SPONSORSHIP_RECOGNITION_ENABLED"
  | "BILLING_ASSISTANCE_ADMIN_ENABLED"
  | "BILLING_SUPPORT_RECOGNITION_ENABLED"
  | "BILLING_ACCOUNT_LIFECYCLE_ENABLED"
  | "BILLING_ACCOUNTING_EXPORT_ENABLED"
  | "BILLING_TEST_REFUNDS_ENABLED";

export function assertBillingFeatureEnabled(env: BillingEnv, flag: BillingFeatureFlag, errorCode: string): void {
  if (["BILLING_SELLER_ONBOARDING_ENABLED", "BILLING_MARKETPLACE_COMMERCE_ENABLED", "BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED", "BILLING_SANDBOX_PURCHASES_ENABLED"].includes(flag)) throw new BillingHttpError(503, "third_party_money_hard_off");
  if (env[flag] !== "true") throw new BillingHttpError(503, errorCode);
}

export function assertBillingCheckoutReliabilityEnabled(env: BillingEnv): void {
  assertBillingFeatureEnabled(env, "BILLING_WEBHOOK_FULFILLMENT_ENABLED", "webhook_fulfillment_required");
  assertBillingFeatureEnabled(env, "BILLING_NOTIFICATION_RETRY_ENABLED", "notification_retry_required");
}

export function stripeConnectEnabled(_env: BillingEnv): boolean {
  return false;
}

export function stripeTestConfig(env: BillingEnv): StripeTestConfig {
  assertTestOnlyBillingMode(env);
  return stripeConfig(env);
}

export function assertBillingMode(env: BillingEnv): void {
  if (env.BILLING_MODE === "test") return assertTestOnlyBillingMode(env);
  if (env.BILLING_MODE !== "live" || env.STRIPE_LIVE_ENABLED !== "true"
    || env.BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED !== "true"
    || env.BILLING_EDGE_RATE_LIMIT_CONFIRMED !== "true"
    || !/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID ?? "")) {
    throw new BillingHttpError(503, "billing_live_preflight_required");
  }
  const forbidden = [env.STRIPE_CONNECT_ENABLED, env.BILLING_SELLER_ONBOARDING_ENABLED,
    env.BILLING_MARKETPLACE_COMMERCE_ENABLED, env.BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED,
    env.BILLING_SANDBOX_PURCHASES_ENABLED];
  if (forbidden.some(value => value === "true")) throw new BillingHttpError(503, "third_party_money_hard_off");
  if (validatedPublicOrigin(env) !== "https://elysiaecobotics.com") throw new BillingHttpError(503, "billing_live_origin_invalid");
}

export function stripeConfig(env: BillingEnv): StripeTestConfig {
  assertBillingMode(env);
  const mode = env.BILLING_MODE === "live" ? "live" : "test";
  const secretKey = nonPlaceholder(mode === "live" ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST, 16, 512);
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(secretKey)) {
    throw new BillingHttpError(503, "billing_live_disabled");
  }
  const webhookSecret = nonPlaceholder(mode === "live" ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST, 16, 512);
  if (!webhookSecret.startsWith("whsec_")) throw new BillingHttpError(503, "billing_misconfigured");
  const apiVersion = stripeApiVersion(env.STRIPE_API_VERSION);
  const webhookApiVersion = stripeApiVersion(env.STRIPE_WEBHOOK_API_VERSION);
  const toleranceText = env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? "300";
  if (!/^\d+$/.test(toleranceText)) throw new BillingHttpError(503, "billing_misconfigured");
  const webhookToleranceSeconds = Number(toleranceText);
  if (webhookToleranceSeconds < 60 || webhookToleranceSeconds > 900) {
    throw new BillingHttpError(503, "billing_misconfigured");
  }
  return { secretKey, webhookSecret, apiVersion, webhookApiVersion, webhookToleranceSeconds, mode };
}

export function billingCapabilities(env: BillingEnv): {
  enabled: boolean;
  configured: boolean;
  serverConfigured: boolean;
  providerConfigured: boolean;
  redirectConfigured: boolean;
  connectEnabled: boolean;
  oneTimeSupport: boolean;
  recurringSupport: boolean;
  customerPortal: boolean;
  webhookFulfillment: boolean;
  notificationRetry: boolean;
  accountLifecycle: boolean;
  sellerOnboarding: boolean;
  organizationServiceCheckout: boolean;
  sponsorshipCheckout: boolean;
} {
  const configured = economicPublicClientConfigured(env);
  const serverConfigured = economicServerClientConfigured(env);
  let providerConfigured = false;
  let redirectConfigured = false;
  try {
    stripeConfig(env);
    providerConfigured = configured && serverConfigured;
    validatedPublicOrigin(env);
    redirectConfigured = providerConfigured;
  } catch {
    // A missing redirect origin disables Checkout/Portal redirects without
    // disabling owner-scoped read-only economic history.
  }
  let modeValid = false;
  try { assertBillingMode(env); modeValid = true; } catch { /* Fail closed. */ }
  const enabled = env.BILLING_ENABLED === "true" && modeValid;
  return {
    enabled,
    configured,
    serverConfigured,
    providerConfigured,
    redirectConfigured,
    connectEnabled: false,
    oneTimeSupport: enabled
      && env.BILLING_SUPPORT_CHECKOUT_ENABLED === "true"
      && (env.BILLING_MODE === "live" || env.BILLING_STAGING_ACCESS_CONFIRMED === "true")
      && env.BILLING_EDGE_RATE_LIMIT_CONFIRMED === "true",
    recurringSupport: enabled
      && env.BILLING_RECURRING_ENABLED === "true"
      && env.BILLING_PORTAL_ENABLED === "true",
    // Cancellation and billing management must remain available when new
    // acquisition is disabled by the global checkout kill switch.
    customerPortal: modeValid && env.BILLING_PORTAL_ENABLED === "true",
    webhookFulfillment: env.BILLING_WEBHOOK_FULFILLMENT_ENABLED === "true",
    notificationRetry: env.BILLING_NOTIFICATION_RETRY_ENABLED === "true",
    accountLifecycle: modeValid && env.BILLING_ACCOUNT_LIFECYCLE_ENABLED === "true",
    sellerOnboarding: false,
    organizationServiceCheckout: enabled && env.BILLING_ORGANIZATION_SERVICES_ENABLED === "true",
    sponsorshipCheckout: enabled && env.BILLING_SPONSORSHIP_CHECKOUT_ENABLED === "true"
  };
}

import { BillingHttpError, validatedPublicOrigin } from "./http.ts";
import { economicPublicClientConfigured, economicServerClientConfigured } from "./auth.ts";
import type { BillingEnv } from "./types.ts";

export type StripeTestConfig = {
  secretKey: string;
  webhookSecret: string;
  apiVersion: string;
  webhookApiVersion: string;
  webhookToleranceSeconds: number;
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
  assertTestOnlyBillingMode(env);
  if (env.BILLING_ENABLED !== "true") throw new BillingHttpError(503, "billing_disabled");
}

export function assertBillingMutationEnabled(env: BillingEnv): void {
  assertBillingEnabled(env);
}

export function assertGuestCheckoutAbuseControls(env: BillingEnv): void {
  if (
    env.BILLING_STAGING_ACCESS_CONFIRMED !== "true"
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
  if (env[flag] !== "true") throw new BillingHttpError(503, errorCode);
}

export function assertBillingCheckoutReliabilityEnabled(env: BillingEnv): void {
  assertBillingFeatureEnabled(env, "BILLING_WEBHOOK_FULFILLMENT_ENABLED", "webhook_fulfillment_required");
  assertBillingFeatureEnabled(env, "BILLING_NOTIFICATION_RETRY_ENABLED", "notification_retry_required");
}

export function stripeConnectEnabled(env: BillingEnv): boolean {
  return env.STRIPE_CONNECT_ENABLED === "true";
}

export function stripeTestConfig(env: BillingEnv): StripeTestConfig {
  assertTestOnlyBillingMode(env);
  const secretKey = nonPlaceholder(env.STRIPE_SECRET_KEY_TEST, 16, 512);
  if (!secretKey.startsWith("sk_test_") || secretKey.startsWith("sk_live_")) {
    throw new BillingHttpError(503, "billing_live_disabled");
  }
  const webhookSecret = nonPlaceholder(env.STRIPE_WEBHOOK_SECRET_TEST, 16, 512);
  if (!webhookSecret.startsWith("whsec_")) throw new BillingHttpError(503, "billing_misconfigured");
  const apiVersion = stripeApiVersion(env.STRIPE_API_VERSION);
  const webhookApiVersion = stripeApiVersion(env.STRIPE_WEBHOOK_API_VERSION);
  const toleranceText = env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? "300";
  if (!/^\d+$/.test(toleranceText)) throw new BillingHttpError(503, "billing_misconfigured");
  const webhookToleranceSeconds = Number(toleranceText);
  if (webhookToleranceSeconds < 60 || webhookToleranceSeconds > 900) {
    throw new BillingHttpError(503, "billing_misconfigured");
  }
  return { secretKey, webhookSecret, apiVersion, webhookApiVersion, webhookToleranceSeconds };
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
    stripeTestConfig(env);
    providerConfigured = configured && serverConfigured;
    validatedPublicOrigin(env);
    redirectConfigured = providerConfigured;
  } catch {
    // A missing redirect origin disables Checkout/Portal redirects without
    // disabling owner-scoped read-only economic history.
  }
  const testOnly = env.BILLING_MODE === "test" && env.STRIPE_LIVE_ENABLED !== "true";
  const protectedTestOnly = testOnly
    && env.BILLING_STAGING_ACCESS_CONFIRMED === "true"
    && env.BILLING_EDGE_RATE_LIMIT_CONFIRMED === "true";
  const enabled = env.BILLING_ENABLED === "true" && protectedTestOnly;
  return {
    enabled,
    configured,
    serverConfigured,
    providerConfigured,
    redirectConfigured,
    connectEnabled: env.STRIPE_CONNECT_ENABLED === "true",
    oneTimeSupport: enabled
      && env.BILLING_SUPPORT_CHECKOUT_ENABLED === "true"
      && env.BILLING_STAGING_ACCESS_CONFIRMED === "true"
      && env.BILLING_EDGE_RATE_LIMIT_CONFIRMED === "true",
    recurringSupport: enabled
      && env.BILLING_RECURRING_ENABLED === "true"
      && env.BILLING_PORTAL_ENABLED === "true",
    // Cancellation and billing management must remain available when new
    // acquisition is disabled by the global checkout kill switch.
    customerPortal: protectedTestOnly && env.BILLING_PORTAL_ENABLED === "true",
    webhookFulfillment: env.BILLING_WEBHOOK_FULFILLMENT_ENABLED === "true",
    notificationRetry: env.BILLING_NOTIFICATION_RETRY_ENABLED === "true",
    accountLifecycle: protectedTestOnly && env.BILLING_ACCOUNT_LIFECYCLE_ENABLED === "true",
    sellerOnboarding: enabled && env.BILLING_SELLER_ONBOARDING_ENABLED === "true" && env.STRIPE_CONNECT_ENABLED === "true",
    organizationServiceCheckout: enabled && env.BILLING_ORGANIZATION_SERVICES_ENABLED === "true",
    sponsorshipCheckout: enabled && env.BILLING_SPONSORSHIP_CHECKOUT_ENABLED === "true"
  };
}

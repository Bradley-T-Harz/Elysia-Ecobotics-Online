// Fields supported by the pinned 2025-02-24.acacia PMC API. New methods need review.
// No currency/geography/recurrence eligibility table: Stripe owns those decisions.
export const STRIPE_PAYMENT_METHOD_POLICY_VERSION = "20260917";
export const STRIPE_PERMITTED_METHODS = Object.freeze([
  "acss_debit", "alipay", "amazon_pay", "apple_pay", "au_becs_debit", "bacs_debit",
  "bancontact", "blik", "boleto", "card", "cartes_bancaires", "cashapp", "customer_balance",
  "eps", "fpx", "giropay", "google_pay", "grabpay", "ideal", "jcb", "konbini", "link",
  "mobilepay", "multibanco", "nz_bank_account", "p24", "paynow", "paypal", "promptpay",
  "revolut_pay", "sepa_debit", "sofort", "swish", "twint", "us_bank_account", "wechat_pay"
] as const);
export const STRIPE_EXCLUDED_METHODS = Object.freeze([
  "affirm", "afterpay_clearpay", "alma", "apple_pay_later", "klarna", "sunbit", "zip", "oxxo", "crypto"
] as const);
type MethodSetting = { available: boolean; display_preference: { preference: string; value: "on" | "off" } };
type Configuration = Record<string, unknown>;
const allowed = new Set<string>(STRIPE_PERMITTED_METHODS);
const excluded = new Set<string>(STRIPE_EXCLUDED_METHODS);

export function paymentMethodConfigurationName(mode: string): string {
  if (mode !== "test" && mode !== "live") throw new Error("payment_method_mode_invalid");
  return `elysia_first_party_${mode}_${STRIPE_PAYMENT_METHOD_POLICY_VERSION}`;
}

export function paymentMethodSettings(value: unknown): Record<string, MethodSetting> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("payment_method_configuration_invalid");
  const settings: Record<string, MethodSetting> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !("display_preference" in entry)) continue;
    const method = entry as MethodSetting;
    if (typeof method.available !== "boolean" || !method.display_preference
      || !["on", "off"].includes(method.display_preference.value)
      || !["on", "off", "none"].includes(method.display_preference.preference)) throw new Error("payment_method_setting_invalid");
    settings[key] = method;
  }
  if (!settings.card) throw new Error("payment_method_configuration_incomplete");
  return settings;
}

export function assertDirectPaymentMethodConfiguration(value: unknown, mode: string): asserts value is Configuration {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("payment_method_configuration_invalid");
  const config = value as Configuration;
  if (!/^pmc_[A-Za-z0-9]+$/.test(String(config.id ?? "")) || config.livemode !== (mode === "live")
    || config.active !== true || config.parent != null || config.application != null) throw new Error("payment_method_configuration_scope_invalid");
  paymentMethodSettings(config);
}

/** Snapshot the own-account default preferences, without enabling unavailable methods. */
export function desiredPaymentMethods(defaultConfig: unknown, mode: string): Record<string, "on" | "off"> {
  assertDirectPaymentMethodConfiguration(defaultConfig, mode);
  if (defaultConfig.is_default !== true) throw new Error("payment_method_default_required");
  const result: Record<string, "on" | "off"> = {};
  for (const [method, setting] of Object.entries(paymentMethodSettings(defaultConfig))) {
    // Unsupported future fields cannot be sent to the pinned API. They also
    // cannot be enabled in a managed configuration (runtime rejects them).
    if (!allowed.has(method) && !excluded.has(method)) continue;
    // Crypto is not a writable PMC field in Acacia; an upgraded provider
    // response enabling it requires a separate API/policy qualification.
    if (method === "crypto") continue;
    result[method] = allowed.has(method) && setting.available && setting.display_preference.value === "on" ? "on" : "off";
  }
  if (!Object.values(result).includes("on")) throw new Error("payment_method_none_available");
  return result;
}

export function assertPaymentMethodPolicy(value: unknown, mode: string, expected?: Record<string, "on" | "off">): asserts value is Configuration {
  assertDirectPaymentMethodConfiguration(value, mode);
  if (value.is_default !== false || value.name !== paymentMethodConfigurationName(mode)) throw new Error("payment_method_managed_configuration_required");
  const settings = paymentMethodSettings(value);
  for (const [method, setting] of Object.entries(settings)) {
    if ((!allowed.has(method) || !setting.available) && (setting.display_preference.value !== "off" || setting.display_preference.preference === "on")) {
      throw new Error("payment_method_policy_violation");
    }
    if (expected && setting.display_preference.value !== (expected[method] ?? "off")) throw new Error("payment_method_configuration_drift");
  }
  if (expected && Object.keys(expected).some(key => !settings[key])) throw new Error("payment_method_configuration_incomplete");
  if (!Object.values(settings).some(setting => setting.available && setting.display_preference.value === "on")) throw new Error("payment_method_none_available");
}

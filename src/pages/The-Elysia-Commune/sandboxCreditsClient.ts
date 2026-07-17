export type SandboxCreditSourceCategory = "starter" | "recurring_support" | "purchased" | "sponsored" | "waiver" | "waived" | "operational" | "operator" | "test";
export type SandboxCreditReceiptType = "grant" | "reserve" | "consume" | "release" | "expire" | "refund_adjustment" | "dispute_hold" | "admin_correction" | "compensating_credit" | "compensating_debit";
export type SandboxCreditReceiptSourceCategory = SandboxCreditSourceCategory | "sandbox_run" | "refund" | "dispute";

export type SandboxCreditRate = {
  baseUnits: number;
  inputKibUnits: number;
  outputKibUnits: number;
  cpuSecondUnits: number;
  memoryGibSecondUnits: number;
  maximumRunUnits: number;
};

export type SandboxCreditSourceSummary = {
  category: SandboxCreditSourceCategory;
  availableUnits: number;
};

export type SandboxCreditReservationSummary = {
  runId: string;
  reservedUnits: number;
  expiresAt: string;
};

export type SandboxCreditReceiptSummary = {
  id: string;
  entryType: SandboxCreditReceiptType;
  unitsDelta: number;
  sourceCategory: SandboxCreditReceiptSourceCategory;
  runId: string | null;
  createdAt: string;
};

export type SandboxCreditSummary = {
  available: true;
  mode: "test";
  displayEnabled: boolean;
  enforcementEnabled: boolean;
  testMode: true;
  unitScale: number;
  balanceUnits: number;
  reservedUnits: number;
  availableUnits: number;
  availableCredits: number;
  purchasedCredits: number;
  sponsoredCredits: number;
  waivedCredits: number;
  operatorGrantedCredits: number;
  activeRate: SandboxCreditRate | null;
  sourceCategories: SandboxCreditSourceSummary[];
  activeReservations: SandboxCreditReservationSummary[];
  recentReceipts: SandboxCreditReceiptSummary[];
  warnings: string[];
};

type UnknownRecord = Record<string, unknown>;

const MAX_RESPONSE_BYTES = 96_000;
const CACHE_MILLISECONDS = 30_000;
const sourceCategories = new Set<SandboxCreditSourceCategory>(["starter", "recurring_support", "purchased", "sponsored", "waiver", "waived", "operational", "operator", "test"]);
const receiptSourceCategories = new Set<SandboxCreditReceiptSourceCategory>([...sourceCategories, "sandbox_run", "refund", "dispute"]);
const receiptTypes = new Set<SandboxCreditReceiptType>(["grant", "reserve", "consume", "release", "expire", "refund_adjustment", "dispute_hold", "admin_correction", "compensating_credit", "compensating_debit"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeKeyPattern = /^[a-z][a-z0-9_]{1,100}$/;

let cache: { token: string; loadedAt: number; summary: SandboxCreditSummary } | null = null;
let inFlight: { token: string; request: Promise<SandboxCreditSummary> } | null = null;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function invalidSummary(): never {
  throw new Error("sandbox_credit_summary_invalid");
}

function boundedArray(value: unknown, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) invalidSummary();
  return value;
}

function exactBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function boundedInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function boundedNumber(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

function boundedString(value: unknown, maximum = 120) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function timestamp(value: unknown) {
  const text = boundedString(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function safeIdentifier(value: unknown) {
  const text = boundedString(value, 80);
  return text && uuidPattern.test(text) ? text.toLowerCase() : null;
}

function safeKey(value: unknown) {
  const text = boundedString(value, 101);
  return text && safeKeyPattern.test(text) ? text : null;
}

function safeWarning(value: unknown) {
  const text = boundedString(value, 320);
  if (!text || /secret|service.?role|provider|stripe|token|authorization|database|sql|table|function|rpc|identifier/i.test(text)) return null;
  if (/provisional test values|not approved for live sale/i.test(text)) return "Sandbox credit rates are provisional test values and are not approved for live sale.";
  if (/never change safety limits|network policy|reviewer status|governance authority/i.test(text)) return "Credits never change safety limits, network policy, reviewer status, or governance authority.";
  return null;
}

function parseRate(value: unknown): SandboxCreditRate | null {
  if (value === null) return null;
  const row = record(value);
  if (!row) invalidSummary();
  const baseUnits = boundedInteger(row.base_units, 0, 1_000_000_000);
  const inputKibUnits = boundedInteger(row.input_kib_units, 0, 1_000_000_000);
  const outputKibUnits = boundedInteger(row.output_kib_units, 0, 1_000_000_000);
  const cpuSecondUnits = boundedInteger(row.cpu_second_units, 0, 1_000_000_000);
  const memoryGibSecondUnits = boundedInteger(row.memory_gib_second_units, 0, 1_000_000_000);
  const maximumRunUnits = boundedInteger(row.maximum_run_units, 1, 1_000_000_000);
  if (!safeKey(row.rate_key) || row.approved_for_live_use !== false || [baseUnits, inputKibUnits, outputKibUnits, cpuSecondUnits, memoryGibSecondUnits, maximumRunUnits].some((item) => item === null)) {
    invalidSummary();
  }
  return { baseUnits: baseUnits!, inputKibUnits: inputKibUnits!, outputKibUnits: outputKibUnits!, cpuSecondUnits: cpuSecondUnits!, memoryGibSecondUnits: memoryGibSecondUnits!, maximumRunUnits: maximumRunUnits! };
}

function parseSummary(value: unknown): SandboxCreditSummary {
  const row = record(value);
  if (!row) invalidSummary();
  const displayEnabled = exactBoolean(row.display_enabled);
  const enforcementEnabled = exactBoolean(row.enforcement_enabled);
  const unitScale = boundedInteger(row.unit_scale, 1, 1_000_000);
  const balanceUnits = boundedInteger(row.balance_units);
  const reservedUnits = boundedInteger(row.reserved_units);
  const availableUnits = boundedInteger(row.available_units);
  const availableCredits = boundedNumber(row.available_credits);
  const purchasedCredits = boundedNumber(row.purchased_credits);
  const sponsoredCredits = boundedNumber(row.sponsored_credits);
  const waivedCredits = boundedNumber(row.waived_credits);
  const operatorGrantedCredits = boundedNumber(row.operator_granted_credits);
  if (row.available !== true || row.mode !== "test" || row.test_mode !== true || displayEnabled === null || enforcementEnabled === null
    || [unitScale, balanceUnits, reservedUnits, availableUnits, availableCredits, purchasedCredits, sponsoredCredits, waivedCredits, operatorGrantedCredits].some((item) => item === null)
    || reservedUnits! > balanceUnits! || availableUnits !== balanceUnits! - reservedUnits!) {
    invalidSummary();
  }

  const sources = boundedArray(row.source_categories, 20).map((value) => {
    const source = record(value);
    const category = sourceCategories.has(source?.category as SandboxCreditSourceCategory) ? source?.category as SandboxCreditSourceCategory : null;
    const units = boundedInteger(source?.available_units);
    if (!category || units === null) invalidSummary();
    return { category, availableUnits: units };
  });

  const reservations = boundedArray(row.active_reservations, 50).map((value) => {
    const reservation = record(value);
    const runId = safeIdentifier(reservation?.run_id);
    const units = boundedInteger(reservation?.reserved_units);
    const expiresAt = timestamp(reservation?.expires_at);
    if (!runId || units === null || units < 1 || !expiresAt) invalidSummary();
    return { runId, reservedUnits: units, expiresAt };
  });

  const receipts = boundedArray(row.recent_receipts, 50).map((value) => {
    const receipt = record(value);
    const id = safeIdentifier(receipt?.id);
    const entryType = receiptTypes.has(receipt?.entry_type as SandboxCreditReceiptType) ? receipt?.entry_type as SandboxCreditReceiptType : null;
    const unitsDelta = boundedInteger(receipt?.units_delta, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const sourceCategory = receiptSourceCategories.has(receipt?.source_category as SandboxCreditReceiptSourceCategory) ? receipt?.source_category as SandboxCreditReceiptSourceCategory : null;
    const runId = receipt?.run_id === null ? null : safeIdentifier(receipt?.run_id);
    const createdAt = timestamp(receipt?.created_at);
    if (!id || !entryType || unitsDelta === null || unitsDelta === 0 || !sourceCategory || !createdAt || (receipt?.run_id !== null && !runId)) invalidSummary();
    return { id, entryType, unitsDelta, sourceCategory, runId, createdAt };
  });

  return {
    available: true,
    mode: "test",
    displayEnabled: displayEnabled!,
    enforcementEnabled: enforcementEnabled!,
    testMode: true,
    unitScale: unitScale!,
    balanceUnits: balanceUnits!,
    reservedUnits: reservedUnits!,
    availableUnits: availableUnits!,
    availableCredits: availableCredits!,
    purchasedCredits: purchasedCredits!,
    sponsoredCredits: sponsoredCredits!,
    waivedCredits: waivedCredits!,
    operatorGrantedCredits: operatorGrantedCredits!,
    activeRate: parseRate(row.active_rate),
    sourceCategories: sources,
    activeReservations: reservations,
    recentReceipts: receipts,
    warnings: boundedArray(row.warnings, 20).slice(0, 8).flatMap((warning) => {
      const safe = safeWarning(warning);
      return safe ? [safe] : [];
    })
  };
}

async function fetchSandboxCreditSummary(accessToken: string): Promise<SandboxCreditSummary> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("/api/sandbox/credits", {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal
    });
    const declaredLength = Number(response.headers.get("content-length") || "0");
    if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_RESPONSE_BYTES) throw new Error("sandbox_credit_summary_invalid");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error("sandbox_credit_summary_invalid");
    const envelope = record(JSON.parse(text) as unknown);
    if (!response.ok || envelope?.ok !== true) throw new Error("sandbox_credit_summary_unavailable");
    return parseSummary(envelope.summary);
  } catch {
    throw new Error("Private sandbox credit information is unavailable right now. Existing sandbox execution rules remain authoritative.");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadSandboxCreditSummary(accessToken: string, options: { force?: boolean } = {}): Promise<SandboxCreditSummary> {
  const now = Date.now();
  if (!options.force && cache?.token === accessToken && now - cache.loadedAt < CACHE_MILLISECONDS) return cache.summary;
  if (!options.force && inFlight?.token === accessToken) return inFlight.request;
  const request = fetchSandboxCreditSummary(accessToken).then((summary) => {
    cache = { token: accessToken, loadedAt: Date.now(), summary };
    return summary;
  }).finally(() => {
    if (inFlight?.request === request) inFlight = null;
  });
  inFlight = { token: accessToken, request };
  return request;
}

export function sandboxCreditClientMessage(error: unknown) {
  return error instanceof Error && error.message.startsWith("Private sandbox credit information")
    ? error.message
    : "Private sandbox credit information is unavailable right now. Existing sandbox execution rules remain authoritative.";
}

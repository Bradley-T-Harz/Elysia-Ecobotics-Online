import { PublicHttpError } from "./http.ts";

type JsonObject = Record<string, unknown>;

export type PublicSandboxCreditSummary = {
  available: true;
  mode: "test";
  display_enabled: boolean;
  enforcement_enabled: boolean;
  test_mode: true;
  unit_scale: number;
  balance_units: number;
  reserved_units: number;
  available_units: number;
  available_credits: number;
  purchased_credits: number;
  sponsored_credits: number;
  waived_credits: number;
  operator_granted_credits: number;
  active_rate: null | {
    rate_key: string;
    base_units: number;
    input_kib_units: number;
    output_kib_units: number;
    cpu_second_units: number;
    memory_gib_second_units: number;
    maximum_run_units: number;
    approved_for_live_use: false;
  };
  source_categories: Array<{ category: string; available_units: number }>;
  active_reservations: Array<{ run_id: string; reserved_units: number; expires_at: string }>;
  recent_receipts: Array<{
    id: string;
    entry_type: string;
    units_delta: number;
    source_category: string;
    run_id: string | null;
    created_at: string;
  }>;
  warnings: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^[a-z][a-z0-9_]{1,100}$/;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as JsonObject;
}

function invalid(): never {
  throw new PublicHttpError(503, "sandbox_credit_summary_invalid");
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function integer(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > 9_000_000_000_000_000) invalid();
  return Number(value);
}

function signedInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Math.abs(Number(value)) > 9_000_000_000_000_000) invalid();
  return Number(value);
}

function nonnegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9_000_000_000_000_000) invalid();
  return value;
}

function safeKey(value: unknown): string {
  if (typeof value !== "string" || !SAFE_KEY.test(value)) invalid();
  return value;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
  return value.toLowerCase();
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 40) invalid();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalid();
  return value;
}

function boundedArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  return value;
}

function activeRate(value: unknown): PublicSandboxCreditSummary["active_rate"] {
  if (value === null) return null;
  const rate = object(value);
  if (rate.approved_for_live_use !== false) invalid();
  return {
    rate_key: safeKey(rate.rate_key),
    base_units: integer(rate.base_units),
    input_kib_units: integer(rate.input_kib_units),
    output_kib_units: integer(rate.output_kib_units),
    cpu_second_units: integer(rate.cpu_second_units),
    memory_gib_second_units: integer(rate.memory_gib_second_units),
    maximum_run_units: integer(rate.maximum_run_units, 1),
    approved_for_live_use: false
  };
}

export function parseSandboxCreditSummary(value: unknown): PublicSandboxCreditSummary {
  const summary = object(value);
  if (summary.available !== true || summary.mode !== "test" || summary.test_mode !== true) invalid();
  const unitScale = integer(summary.unit_scale, 1);
  const balanceUnits = integer(summary.balance_units);
  const reservedUnits = integer(summary.reserved_units);
  const availableUnits = integer(summary.available_units);
  if (reservedUnits > balanceUnits || availableUnits !== balanceUnits - reservedUnits) invalid();

  const parsed: PublicSandboxCreditSummary = {
    available: true,
    mode: "test",
    display_enabled: boolean(summary.display_enabled),
    enforcement_enabled: boolean(summary.enforcement_enabled),
    test_mode: true,
    unit_scale: unitScale,
    balance_units: balanceUnits,
    reserved_units: reservedUnits,
    available_units: availableUnits,
    available_credits: nonnegativeNumber(summary.available_credits),
    purchased_credits: nonnegativeNumber(summary.purchased_credits),
    sponsored_credits: nonnegativeNumber(summary.sponsored_credits),
    waived_credits: nonnegativeNumber(summary.waived_credits),
    operator_granted_credits: nonnegativeNumber(summary.operator_granted_credits),
    active_rate: activeRate(summary.active_rate),
    source_categories: boundedArray(summary.source_categories, 20).map((item) => {
      const category = object(item);
      return { category: safeKey(category.category), available_units: integer(category.available_units) };
    }),
    active_reservations: boundedArray(summary.active_reservations, 50).map((item) => {
      const reservation = object(item);
      return {
        run_id: uuid(reservation.run_id),
        reserved_units: integer(reservation.reserved_units, 1),
        expires_at: timestamp(reservation.expires_at)
      };
    }),
    recent_receipts: boundedArray(summary.recent_receipts, 50).map((item) => {
      const receipt = object(item);
      return {
        id: uuid(receipt.id),
        entry_type: safeKey(receipt.entry_type),
        units_delta: signedInteger(receipt.units_delta),
        source_category: safeKey(receipt.source_category),
        run_id: receipt.run_id === null ? null : uuid(receipt.run_id),
        created_at: timestamp(receipt.created_at)
      };
    }),
    warnings: boundedArray(summary.warnings, 20).map((item) => {
      if (typeof item !== "string" || item.length < 1 || item.length > 500 || /[\u0000-\u001f\u007f]/.test(item)) invalid();
      return item;
    })
  };

  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > 65_536) invalid();
  return parsed;
}

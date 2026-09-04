import {
  hasSupabaseConfig,
  supabase,
  supabaseNotConfiguredMessage
} from "../../pages/The-Elysia-Marketplace/lib/supabase";

export const operationalMetricStates = ["clear", "attention", "critical"] as const;
export type OperationalMetricState = typeof operationalMetricStates[number];

export type OperationalMetric = {
  key: string;
  domain: string;
  label: string;
  count: number;
  oldestAt: string | null;
  state: OperationalMetricState;
};

export type OperationalExternalBoundary = {
  key: string;
  label: string;
  state: string;
  boundary: string;
};

export type AdminOperationalOverview = {
  generatedAt: string;
  scope: "database_aggregate_only";
  administratorOnly: true;
  metrics: OperationalMetric[];
  externalBoundaries: OperationalExternalBoundary[];
};

const KEY_PATTERN = /^[a-z][a-z0-9_]{2,79}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum: number) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isTimestampOrNull(value: unknown): value is string | null {
  return value === null
    || (typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)));
}

function parseMetric(value: unknown): OperationalMetric | null {
  if (!isRecord(value)
      || typeof value.key !== "string" || !KEY_PATTERN.test(value.key)
      || typeof value.domain !== "string" || !KEY_PATTERN.test(value.domain)
      || !isBoundedText(value.label, 120)
      || typeof value.count !== "number" || !Number.isSafeInteger(value.count) || value.count < 0
      || !isTimestampOrNull(value.oldestAt)
      || typeof value.state !== "string"
      || !operationalMetricStates.includes(value.state as OperationalMetricState)) return null;
  return value as OperationalMetric;
}

function parseBoundary(value: unknown): OperationalExternalBoundary | null {
  if (!isRecord(value)
      || typeof value.key !== "string" || !KEY_PATTERN.test(value.key)
      || !isBoundedText(value.label, 120)
      || typeof value.state !== "string" || !KEY_PATTERN.test(value.state)
      || !isBoundedText(value.boundary, 260)) return null;
  return value as OperationalExternalBoundary;
}

function parseOverview(value: unknown): AdminOperationalOverview | null {
  if (!isRecord(value)
      || value.scope !== "database_aggregate_only"
      || value.administratorOnly !== true
      || !isTimestampOrNull(value.generatedAt) || value.generatedAt === null
      || !Array.isArray(value.metrics) || value.metrics.length !== 12
      || !Array.isArray(value.externalBoundaries) || value.externalBoundaries.length > 8) return null;
  const metrics = value.metrics.map(parseMetric);
  const boundaries = value.externalBoundaries.map(parseBoundary);
  if (metrics.some((metric) => metric === null)
      || boundaries.some((boundary) => boundary === null)
      || new Set(metrics.map((metric) => metric?.key)).size !== metrics.length
      || new Set(boundaries.map((boundary) => boundary?.key)).size !== boundaries.length) return null;
  return {
    generatedAt: value.generatedAt,
    scope: value.scope,
    administratorOnly: true,
    metrics: metrics as OperationalMetric[],
    externalBoundaries: boundaries as OperationalExternalBoundary[]
  };
}

function operationalWarning(message: string) {
  if (import.meta.env.DEV) console.warn("[operational-overview]", message);
  if (/operational_overview_admin_required|permission denied|row-level security|RLS/i.test(message)) {
    return "Administrator authority is required for the operational overview.";
  }
  if (/does not exist|schema cache|Could not find/i.test(message)) {
    return "The governed operational-overview backend is not active in this environment.";
  }
  return "The operational overview is temporarily unavailable.";
}

export async function loadAdminOperationalOverview(): Promise<{
  overview: AdminOperationalOverview | null;
  warnings: string[];
}> {
  if (!hasSupabaseConfig || !supabase) {
    return { overview: null, warnings: [supabaseNotConfiguredMessage] };
  }
  const { data, error } = await supabase.rpc("current_admin_operational_overview");
  if (error) return { overview: null, warnings: [operationalWarning(error.message)] };
  const overview = parseOverview(data);
  if (!overview) {
    return {
      overview: null,
      warnings: ["The operational overview returned an invalid or unexpected aggregate shape."]
    };
  }
  return { overview, warnings: [] };
}

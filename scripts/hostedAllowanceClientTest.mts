import assert from "node:assert/strict";
import {
  formatHostedAllowance,
  parseHostedAllowanceSummary,
} from "../src/shared/sandbox/hostedAllowanceClient.ts";

const liveSummary = {
  available: true,
  mode: "live",
  display_enabled: true,
  enforcement_enabled: true,
  test_mode: false,
  unit_scale: 100,
  allowance_total_units: 1_000,
  used_units: 200,
  balance_units: 800,
  reserved_units: 150,
  available_units: 650,
  remaining_percent: 65,
  allowance_type: "one_time_starter",
  renews_at: null,
  paid_allowance_available: false,
  accounting_mode: "finite",
  accounting_policy_version: "hosted_execution_allowance_v1",
  administrative_operational_access: false,
  operational_reserved_units: 0,
  available_credits: 6.5,
  purchased_credits: 0,
  sponsored_credits: 0,
  waived_credits: 0,
  operator_granted_credits: 6.5,
  active_rate: {
    rate_key: "hosted_allowance_client_fixture",
    base_units: 10,
    input_kib_units: 1,
    output_kib_units: 1,
    cpu_second_units: 5,
    memory_gib_second_units: 2,
    maximum_run_units: 100,
    approved_for_live_use: true,
  },
  source_categories: [{ category: "starter", available_units: 650 }],
  active_reservations: [{
    run_id: "a1600000-0000-4000-8000-000000000001",
    reserved_units: 150,
    expires_at: "2026-09-06T20:00:00.000Z",
  }],
  recent_receipts: [{
    id: "a1700000-0000-4000-8000-000000000001",
    entry_type: "consume",
    units_delta: -20,
    source_category: "sandbox_run",
    run_id: "a1800000-0000-4000-8000-000000000001",
    created_at: "2026-09-06T19:00:00.000Z",
  }],
  recent_operational_usage: [],
  warnings: ["Local Elysia computation is not metered by EcoSyneva."],
};

const parsed = parseHostedAllowanceSummary(liveSummary);
assert.equal(parsed.mode, "live");
assert.equal(parsed.remainingPercent, 65);
assert.equal(parsed.availableUnits, 650);
assert.equal(parsed.paidAllowanceAvailable, false);
assert.equal(parsed.renewsAt, null);
assert.equal(parsed.activeRate?.approvedForLiveUse, true);
assert.equal(parsed.administrativeOperationalAccess, false);
assert.equal(formatHostedAllowance(parsed.availableUnits, parsed.unitScale), "6.5");

assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, remaining_percent: 64 }),
  /sandbox_credit_summary_invalid/,
  "The client must reject a percentage that does not match authoritative available and total units.",
);

assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, administrative_operational_access: true }),
  /sandbox_credit_summary_invalid/,
  "A client-side or malformed administrator flag must not contradict the server accounting mode.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, recent_operational_usage: [{
    run_id: "a1800000-0000-4000-8000-000000000002",
    calculated_units: 19,
    charged_units: 0,
    failure_class: null,
    measured_at: "2026-09-06T19:10:00.000Z",
  }] }),
  /sandbox_credit_summary_invalid/,
  "A finite account must not receive administrator operational history.",
);

const adminSummary = parseHostedAllowanceSummary({
  ...liveSummary,
  accounting_mode: "admin_operational",
  accounting_policy_version: "admin_operational_allowance_v1",
  administrative_operational_access: true,
  operational_reserved_units: 100,
  recent_operational_usage: [{
    run_id: "a1800000-0000-4000-8000-000000000002",
    calculated_units: 19,
    charged_units: 0,
    failure_class: null,
    measured_at: "2026-09-06T19:10:00.000Z",
  }],
});
assert.equal(adminSummary.accountingMode, "admin_operational");
assert.equal(adminSummary.administrativeOperationalAccess, true);
assert.equal(adminSummary.operationalReservedUnits, 100);
assert.equal(adminSummary.recentOperationalUsage[0]?.calculatedUnits, 19);
assert.equal(adminSummary.recentOperationalUsage[0]?.chargedUnits, 0);
assert.equal(adminSummary.balanceUnits, 800, "Administrative operations must not rewrite the ordinary balance projection.");
assert.throws(
  () => parseHostedAllowanceSummary({
    ...liveSummary,
    accounting_mode: "admin_operational",
    accounting_policy_version: "admin_operational_allowance_v1",
    administrative_operational_access: true,
    recent_operational_usage: [{
      run_id: "a1800000-0000-4000-8000-000000000002",
      calculated_units: 19,
      charged_units: 1,
      failure_class: null,
      measured_at: "2026-09-06T19:10:00.000Z",
    }],
  }),
  /sandbox_credit_summary_invalid/,
  "Administrator operational history must fail closed if it claims ordinary-balance depletion.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, balance_units: 799 }),
  /sandbox_credit_summary_invalid/,
  "The client must reject inconsistent balance, reservation, and available-unit state.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, paid_allowance_available: true }),
  /sandbox_credit_summary_invalid/,
  "The current client contract must fail closed if paid allowance is advertised as available.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, active_rate: { ...liveSummary.active_rate, approved_for_live_use: false } }),
  /sandbox_credit_summary_invalid/,
  "A live projection must not accept an unapproved test rate.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, active_rate: null }),
  /sandbox_credit_summary_invalid/,
  "A live projection must identify the approved versioned meter it uses.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, allowance_type: "replenishing", renews_at: null }),
  /sandbox_credit_summary_invalid/,
  "A replenishing allowance must not omit its authoritative next renewal time.",
);
assert.throws(
  () => parseHostedAllowanceSummary({ ...liveSummary, allowance_type: "one_time_starter", renews_at: "2026-10-01T00:00:00.000Z" }),
  /sandbox_credit_summary_invalid/,
  "A one-time starter allowance must not imply that it renews.",
);

const testSummary = parseHostedAllowanceSummary({
  ...liveSummary,
  mode: "test",
  display_enabled: false,
  enforcement_enabled: false,
  test_mode: true,
  allowance_total_units: null,
  used_units: null,
  remaining_percent: null,
  allowance_type: "test_only",
  active_rate: { ...liveSummary.active_rate, approved_for_live_use: false },
});
assert.equal(testSummary.mode, "test");
assert.equal(testSummary.remainingPercent, null);

console.log("Hosted allowance client contract passed for live/test mode separation, authoritative percentage and balance invariants, paid-flow refusal, live-rate approval, and display-unit formatting.");

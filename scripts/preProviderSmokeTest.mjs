import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { preparationCommandSchema, preparationOverviewSchema } from "../src/shared/economics/preProviderContracts.ts";
import { providerReadiness, previewPlatformWaiver, acknowledgmentBoundary } from "../src/shared/economics/providerBoundary.ts";
import { handlePreparationCommand, handlePreparationState } from "../functions/api/economic-preparation/_shared/handler.ts";

const actor = "e9000000-0000-4000-8000-000000000001";
const requestId = "e9000000-0000-4000-8000-000000000010";
const env = { ECONOMIC_PREPARATION_ENABLED: "true", ECONOMIC_PREPARATION_MODE: "pre_provider", ECONOMIC_PREPARATION_PUBLIC_ORIGIN: "https://example.invalid", ECONOMIC_PREPARATION_ACCESS_CONFIRMED: "true", ECONOMIC_PREPARATION_RATE_LIMIT_CONFIRMED: "true" };
const command = { action: "waiver_approve", requestId, orderId: actor, component: "ecosyneva_platform_fee", amountMinor: 50, reason: "Synthetic owned platform fee waiver", confirmation: "WAIVE ECOSYNEVA OWNED AMOUNT ONLY" };
let calls = [];
const state = { mode: "pre_provider", providerActionsAvailable: false, enabled: true, lanes: { sellers: true, settlements: true, waivers: true, support: true }, capabilities: [], sellerEligible: true, termsVersion: "2026-09-08-readiness", termsPath: "/legal/marketplace-commerce-terms", sellers: [], offers: [], publisherOptions: [], versionOptions: [], proposals: [], settlements: [], waivers: [], supportCases: [], subscriptions: [], records: [], audit: [], bounded: true, truncated: false };
const deps = {
  async authenticate() { calls.push("authenticate"); return { userId: actor }; },
  async load(_env, user, audience) { calls.push(["load", user, audience]); return state; },
  async command(_env, user, input) { calls.push(["command", user, input.action]); return { mode: "pre_provider", providerActionsAvailable: false, requestId: input.requestId, targetId: actor, revision: 1, idempotentReplay: false }; }
};
function post(body, origin = "https://example.invalid", extra = {}) { return new Request("https://example.invalid/api/economic-preparation/command", { method: "POST", headers: { "content-type": "application/json", origin, ...extra }, body: JSON.stringify(body) }); }
for (const config of [{}, { ...env, ECONOMIC_PREPARATION_ENABLED: "TRUE" }, { ...env, ECONOMIC_PREPARATION_ENABLED: "1" }, { ...env, ECONOMIC_PREPARATION_MODE: "live" }, { ...env, ECONOMIC_PREPARATION_MODE: "test" }, { ...env, ECONOMIC_PREPARATION_ACCESS_CONFIRMED: "false" }, { ...env, ECONOMIC_PREPARATION_RATE_LIMIT_CONFIRMED: "" }]) {
  calls = [];
  assert.equal((await handlePreparationCommand(post(command), config, deps)).status, 503);
  assert.deepEqual(calls, [], "Disabled or mistyped gate reached authentication or mutation.");
}
calls = [];
assert.equal((await handlePreparationCommand(post(command, "https://other.invalid"), env, deps)).status, 403);
assert.deepEqual(calls, []);
for (const bad of [{ ...command, component: "creator_share" }, { ...command, component: "processor_fee" }, { ...command, component: "tax" }, { ...command, actorUserId: actor }, { ...command, bankAccount: "forbidden" }, { ...command, amountMinor: 1.5 }, { ...command, amountMinor: -1 }, { ...command, confirmation: "waive everything" }, { ...command, reason: "1234567890123456" }]) {
  calls = [];
  assert.equal((await handlePreparationCommand(post(bad), env, deps)).status, 400);
  assert.ok(!calls.some(call => Array.isArray(call) && call[0] === "command"));
}
assert.equal((await handlePreparationCommand(post(command, "https://example.invalid", { "content-length": "20000" }), env, deps)).status, 413);
const successful = await handlePreparationCommand(post(command), env, deps);
assert.equal(successful.status, 200);
assert.equal(successful.headers.get("cache-control"), "no-store");
assert.equal((await successful.json()).result.providerActionsAvailable, false);
assert.equal((await handlePreparationCommand(post(command), env, { ...deps, command: async () => ({ mode: "live", providerActionsAvailable: true }) })).status, 503);
const mismatched = await handlePreparationCommand(post(command), env, { ...deps, command: async () => ({ mode: "pre_provider", providerActionsAvailable: false, requestId: actor, targetId: actor, revision: 1, idempotentReplay: false }) });
assert.equal(mismatched.status, 503);
const get = audience => new Request(`https://example.invalid/api/economic-preparation/state?audience=${audience}`);
assert.equal((await handlePreparationState(get("operator"), env, deps)).status, 200);
assert.equal((await handlePreparationState(get("operator&actor=other"), env, deps)).status, 400);
assert.equal((await handlePreparationState(get("account"), env, { ...deps, load: async () => ({ ...state, bankDetails: "forbidden" }) })).status, 503);
const failure = await handlePreparationState(get("account"), env, { ...deps, load: async () => { throw new Error("synthetic-private-error-must-not-leak"); } });
assert.ok(!(await failure.text()).includes("synthetic-private-error"));
assert.equal(preparationOverviewSchema.safeParse({ ...state, providerActionsAvailable: true }).success, false);
assert.equal(preparationCommandSchema.safeParse({ action: "provider_payout_complete", requestId }).success, false);
assert.equal(preparationCommandSchema.safeParse({ action: "policy_propose", requestId, kind: "marketplace_fee_bps", value: 500, reason: "Synthetic proposal only", adopted: true }).success, false);
for (const lane of ["support", "recurring_support", "seller_onboarding", "marketplace", "refunds", "payouts"]) {
  assert.equal(providerReadiness({ lane, provider: "stripe", ownerAuthorizationRecorded: true, providerApprovalRecorded: true, liabilityModelAdopted: true, legalTermsAdopted: true, adapterQualified: true }).dispatchAllowed, false);
}
const fullWaiver = previewPlatformWaiver({ creatorPriceMinor: 1000, platformFeeMinor: 50, processorFeeMinor: null, taxMinor: null }, 0, 50);
assert.equal(fullWaiver.creatorPriceMinor, 1000); assert.equal(fullWaiver.creatorShareBeforeProcessorMinor, 1000); assert.equal(fullWaiver.remainingPlatformFeeMinor, 0); assert.equal(fullWaiver.processorFeeMinor, null);
assert.equal(previewPlatformWaiver({ creatorPriceMinor: 1000, platformFeeMinor: 50, processorFeeMinor: 59, taxMinor: 0 }, 20, 10).creatorShareBeforeProcessorMinor, 980);
assert.throws(() => previewPlatformWaiver({ creatorPriceMinor: 1000, platformFeeMinor: 50, processorFeeMinor: 0, taxMinor: 0 }, 40, 11));
for (const kind of ["support_acknowledgment", "marketplace_payment", "refund_record", "payout_preparation"]) {
  const boundary = acknowledgmentBoundary(kind); assert.equal(boundary.provesCreatorPayout, false); assert.equal(boundary.provesProviderDelivery, false); assert.equal(boundary.donationReceipt, false);
}
const routes = JSON.parse(await fs.readFile("public/_routes.json", "utf8"));
assert.ok(routes.include.every(route => !route.includes("billing") && !route.includes("economic-preparation")));
const html = await fs.readFile("index.html", "utf8");
assert.ok(html.includes('name="elysia-billing-api-publication" content="disabled"'));
assert.ok(html.includes('name="elysia-economic-preparation-publication" content="disabled"'));
const migration = await fs.readFile("supabase/migrations/20260908040000_pre_provider_preparation.sql", "utf8");
assert.ok(!/update\s+private\.economic_active_legal/i.test(migration));
assert.ok(!/update\s+private\.economic_feature_flags/i.test(migration));
console.log("Pre-provider HTTP, strict schemas, disabled defaults, actor binding, private errors, provider separation, owned-fee waiver math and record-truth checks passed.");

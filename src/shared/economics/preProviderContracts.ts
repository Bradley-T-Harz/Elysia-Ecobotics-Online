import { z } from "zod";

export const preparationMode = "pre_provider" as const;
export const proposedMarketplaceFeeBps = 500;
export const proposedProofRetentionDays = 30;
export const preparationSections = [
  ["readiness", "Overview / readiness"], ["support", "Support & recurring support"],
  ["sellers", "Marketplace sellers"], ["offers", "Marketplace offers & fees"],
  ["onboarding", "Seller onboarding"], ["settlement", "Seller settlement / payouts"],
  ["refunds", "Refunds & disputes"], ["receipts", "Receipts / acknowledgments"],
  ["organizations", "Organization services"], ["sponsorship", "Sponsorship"],
  ["job-fees", "Job-post fees"], ["hosted-allowance", "Hosted allowance"],
  ["legal", "Legal / consent versions"], ["provider", "Provider readiness"],
  ["waivers", "EcoSyneva fee waivers"], ["audit", "Economic audit log"]
] as const;
export type PreparationSection = typeof preparationSections[number][0];
const uuid = z.string().uuid();
const minor = z.number().int().min(0).max(100_000_000_000);
const revision = z.number().int().min(0).max(1_000_000);
const text = (min: number, max: number) => z.string().trim().min(min).max(max)
  .refine(value => !/[\u0000-\u001f\u007f]|\d{9,}|\b(?:sk|rk)_(?:live|test)_|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(value), "Use a brief description without financial identifiers or credentials.");
const reason = text(8, 500);
const url = z.string().max(300).refine(value => {
  if (value === "") return true;
  try { const parsed = new URL(value); return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash; }
  catch { return false; }
}, "Use a public HTTPS support page without access tokens or query parameters.");
const base = { requestId: uuid };
const versioned = { ...base, expectedRevision: revision };

// Exact object schemas intentionally have no bank, card, tax-ID, provider-ID,
// onboarding-link or executed-payment fields. The server binds the actor.
export const preparationCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...versioned, action: z.literal("seller_save"), displayName: text(2, 80), supportUrl: url, intent: z.enum(["free", "commercial", "both"]) }).strict(),
  z.object({ ...versioned, action: z.literal("seller_terms"), documentVersion: text(1, 120), accept: z.literal(true) }).strict(),
  z.object({ ...versioned, action: z.literal("seller_link"), publisherId: uuid, reason }).strict(),
  z.object({ ...versioned, action: z.literal("seller_submit") }).strict(),
  z.object({ ...versioned, action: z.literal("seller_withdraw"), reason }).strict(),
  z.object({ ...versioned, action: z.literal("seller_review"), sellerId: uuid, decision: z.enum(["approved", "changes_requested", "rejected", "suspended"]), reason }).strict(),
  z.object({ ...versioned, action: z.literal("offer_save"), offerId: uuid, addonVersionId: uuid, kind: z.enum(["free", "commercial"]), amountMinor: minor, currency: z.literal("usd"), licenseKey: text(2, 100), licenseVersion: text(1, 120), feeProposalId: uuid.nullable() }).strict(),
  z.object({ ...versioned, action: z.literal("offer_review"), offerId: uuid, decision: z.enum(["prepared", "changes_requested", "retired"]), reason }).strict(),
  z.object({ ...base, action: z.literal("policy_propose"), kind: z.enum(["marketplace_fee_bps", "proof_retention_days"]), value: z.number().int().min(0).max(5000), reason }).strict(),
  z.object({ ...versioned, action: z.literal("settlement_refresh"), orderId: uuid, reason }).strict(),
  z.object({ ...versioned, action: z.literal("settlement_review"), orderId: uuid, decision: z.enum(["hold", "prepare_handoff", "cancel"]), evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/), reason }).strict(),
  z.object({ ...base, action: z.literal("waiver_approve"), orderId: uuid, component: z.enum(["ecosyneva_platform_fee", "ecosyneva_job_fee", "ecosyneva_service_fee"]), amountMinor: minor.refine(value => value > 0), reason, confirmation: z.literal("WAIVE ECOSYNEVA OWNED AMOUNT ONLY") }).strict(),
  z.object({ ...versioned, action: z.literal("waiver_revoke"), waiverId: uuid, reason }).strict(),
  z.object({ ...base, action: z.literal("support_request"), kind: z.enum(["support_cancellation", "support_refund", "acknowledgment_delivery"]), targetId: uuid, amountMinor: minor.nullable(), reason }).strict(),
  z.object({ ...versioned, action: z.literal("support_review"), caseId: uuid, decision: z.enum(["reviewing", "awaiting_provider", "declined"]), reason }).strict()
]);
export type PreparationCommand = z.infer<typeof preparationCommandSchema>;
export type PreparationAudience = "seller" | "operator" | "account";
const time = z.string().datetime({ offset: true });
const statusText = z.string().regex(/^[a-z_]{2,60}$/);
const boundedText = z.string().max(1000);
const nullableMinor = minor.nullable();
export const sellerPreparationSchema = z.object({
  sellerId: uuid, displayName: z.string().max(80), supportUrl: z.string().max(300), intent: z.enum(["free", "commercial", "both"]),
  status: z.enum(["draft", "submitted", "changes_requested", "approved", "rejected", "suspended", "withdrawn"]), revision,
  termsVersion: z.string().max(120).nullable(), publisherId: uuid.nullable(), reviewReason: boundedText.nullable(),
  blockers: z.array(statusText).max(20), updatedAt: time
}).strict();
export const offerPreparationSchema = z.object({
  offerId: uuid, sellerId: uuid, addonVersionId: uuid, kind: z.enum(["free", "commercial"]), amountMinor: minor, currency: z.literal("usd"),
  licenseKey: z.string().max(100), licenseVersion: z.string().max(120), feeProposalId: uuid.nullable(),
  status: z.enum(["draft", "prepared", "changes_requested", "retired"]), revision, blockers: z.array(statusText).max(20), updatedAt: time
}).strict();
export const settlementPreparationSchema = z.object({
  orderId: uuid, sellerId: uuid, currency: z.string().regex(/^[a-z]{3}$/), grossMinor: minor, platformFeeMinor: nullableMinor,
  creatorShareMinor: nullableMinor, processorFeeMinor: nullableMinor, refundedMinor: minor, disputeExposureMinor: minor,
  creatorPayableMinor: z.number().int().min(-100_000_000_000).max(100_000_000_000).nullable(),
  status: z.enum(["awaiting_payment", "reconciliation_required", "refund_hold", "dispute_hold", "review_required", "held", "handoff_prepared", "canceled"]),
  revision, evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/), blockers: z.array(statusText).max(30),
  providerPayoutStatus: z.literal("not_verified"), updatedAt: time
}).strict();
export const preparationOverviewSchema = z.object({
  mode: z.literal("pre_provider"), providerActionsAvailable: z.literal(false), enabled: z.boolean(),
  lanes: z.object({ sellers: z.boolean(), settlements: z.boolean(), waivers: z.boolean(), support: z.boolean() }).strict(),
  capabilities: z.array(z.string().max(80)).max(30), sellerEligible: z.boolean(),
  termsVersion: z.string().max(120), termsPath: z.literal("/legal/marketplace-commerce-terms"),
  sellers: z.array(sellerPreparationSchema).max(50), offers: z.array(offerPreparationSchema).max(50),
  publisherOptions: z.array(z.object({ publisherId: uuid, name: z.string().max(300), verified: z.boolean() }).strict()).max(100),
  versionOptions: z.array(z.object({ addonVersionId: uuid, name: z.string().max(300), version: z.string().max(120) }).strict()).max(100),
  proposals: z.array(z.object({ proposalId: uuid, kind: z.enum(["marketplace_fee_bps", "proof_retention_days"]), value: z.number().int(), adopted: z.literal(false), createdAt: time }).strict()).max(50),
  settlements: z.array(settlementPreparationSchema).max(50),
  waivers: z.array(z.object({ waiverId: uuid, orderId: uuid, component: z.enum(["ecosyneva_platform_fee", "ecosyneva_job_fee", "ecosyneva_service_fee"]), amountMinor: minor, currency: z.string().regex(/^[a-z]{3}$/), status: z.enum(["approved_preparation", "revoked"]), revision, actorId: uuid, reason: boundedText, createdAt: time }).strict()).max(50),
  supportCases: z.array(z.object({ caseId: uuid, targetId: uuid, kind: z.enum(["support_cancellation", "support_refund", "acknowledgment_delivery"]), amountMinor: nullableMinor, status: z.enum(["requested", "reviewing", "awaiting_provider", "declined"]), revision, reason: boundedText, createdAt: time }).strict()).max(50),
  subscriptions: z.array(z.object({ subscriptionId: uuid, status: statusText, cancelAtPeriodEnd: z.boolean(), currentPeriodEnd: time.nullable() }).strict()).max(50),
  records: z.array(z.object({ recordId: uuid, orderId: uuid.nullable(), kind: z.enum(["support_acknowledgment", "marketplace_payment", "refund_record", "payout_preparation"]), amountMinor: minor, currency: z.string().regex(/^[a-z]{3}$/), status: statusText, deliveryStatus: z.literal("not_established"), evidence: z.enum(["verified_internal_record", "preparation_only"]), createdAt: time }).strict()).max(50),
  audit: z.array(z.object({ eventId: uuid, action: statusText, targetId: uuid.nullable(), actorId: uuid, reason: boundedText.nullable(), createdAt: time }).strict()).max(50),
  bounded: z.literal(true), truncated: z.boolean()
}).strict();
export type PreparationOverview = z.infer<typeof preparationOverviewSchema>;
export type SellerPreparation = z.infer<typeof sellerPreparationSchema>;
export type OfferPreparation = z.infer<typeof offerPreparationSchema>;
export type SettlementPreparation = z.infer<typeof settlementPreparationSchema>;

export const preparationMutationResultSchema = z.object({
  mode: z.literal("pre_provider"), providerActionsAvailable: z.literal(false), requestId: uuid,
  targetId: uuid, revision, idempotentReplay: z.boolean()
}).strict();

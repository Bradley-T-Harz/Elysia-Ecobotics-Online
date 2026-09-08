// Synthetic, local-only UI fixture. Database authorization and persistence are
// tested independently by preProviderBehavior.sql, never emulated as provider facts.
export const id = number => `e9900000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const fixtureTime = "2026-09-08T00:00:00Z";
export function preparationFixture() {
  return {
    mode: "pre_provider", providerActionsAvailable: false, enabled: true,
    lanes: { sellers: true, settlements: true, waivers: true, support: true },
    capabilities: ["marketplace_payout_manage", "economic_assistance_manage", "economic_refunds_manage", "recurring_support_manage", "economic_feature_flags_manage", "economic_payments_view", "economic_audit_view"],
    sellerEligible: true, termsVersion: "2026-09-08-readiness", termsPath: "/legal/marketplace-commerce-terms",
    sellers: [], offers: [], publisherOptions: [{ publisherId: id(2), name: "Synthetic Creator Publisher", verified: true }],
    versionOptions: [{ addonVersionId: id(3), name: "Synthetic reviewed add-on", version: "1.0.0" }, { addonVersionId: id(4), name: "Synthetic reviewed add-on", version: "1.1.0" }],
    proposals: [{ proposalId: "e9090800-0000-4000-8000-000000000005", kind: "marketplace_fee_bps", value: 500, adopted: false, createdAt: fixtureTime }, { proposalId: id(5), kind: "proof_retention_days", value: 30, adopted: false, createdAt: fixtureTime }],
    settlements: [{ orderId: id(6), sellerId: id(1), currency: "usd", grossMinor: 1000, platformFeeMinor: 50, creatorShareMinor: 950, processorFeeMinor: null, refundedMinor: 0, disputeExposureMinor: 0, creatorPayableMinor: 950, status: "review_required", revision: 1, evidenceSha256: "a".repeat(64), blockers: ["processor_fee_evidence_missing", "provider_payout_execution_disabled"], providerPayoutStatus: "not_verified", updatedAt: fixtureTime }],
    waivers: [], supportCases: [],
    subscriptions: [{ subscriptionId: id(7), status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: "2026-10-08T00:00:00Z" }],
    records: ["support_acknowledgment", "marketplace_payment", "refund_record", "payout_preparation"].map((kind, index) => ({ recordId: id(10 + index), orderId: index === 3 ? null : id(20 + index), kind, amountMinor: index === 2 ? 100 : 1000, currency: "usd", status: index === 3 ? "prepared" : "succeeded", deliveryStatus: "not_established", evidence: index === 3 ? "preparation_only" : "verified_internal_record", createdAt: fixtureTime })),
    audit: [], bounded: true, truncated: false
  };
}
export function applyInternalFixtureCommand(state, command) {
  let targetId = id(1), revision = (command.expectedRevision ?? 0) + 1;
  const seller = state.sellers[0];
  switch (command.action) {
    case "seller_save": state.sellers = [{ sellerId: id(1), displayName: command.displayName, supportUrl: command.supportUrl, intent: command.intent, status: "draft", revision, termsVersion: seller?.termsVersion ?? null, publisherId: seller?.publisherId ?? null, reviewReason: null, blockers: ["terms_acknowledgment_required", "verified_publisher_link_required", "internal_review_required"], updatedAt: fixtureTime }]; break;
    case "seller_terms": Object.assign(seller, { termsVersion: command.documentVersion, revision }); seller.blockers = seller.blockers.filter(item => item !== "terms_acknowledgment_required"); break;
    case "seller_link": Object.assign(seller, { publisherId: command.publisherId, revision }); seller.blockers = seller.blockers.filter(item => item !== "verified_publisher_link_required"); break;
    case "seller_submit": Object.assign(seller, { status: "submitted", revision }); break;
    case "seller_review": Object.assign(seller, { status: command.decision, reviewReason: command.reason, revision, blockers: ["commercial_policy_pending", "provider_onboarding_disabled", "payouts_disabled"] }); break;
    case "offer_save": {
      targetId = command.offerId;
      const offer = { offerId: targetId, sellerId: id(1), addonVersionId: command.addonVersionId, kind: command.kind, amountMinor: command.amountMinor, currency: command.currency, licenseKey: command.licenseKey, licenseVersion: command.licenseVersion, feeProposalId: command.feeProposalId, status: "draft", revision, blockers: command.kind === "free" ? [] : ["fee_proposal_not_adopted", "paid_offer_activation_disabled"], updatedAt: fixtureTime };
      state.offers = [...state.offers.filter(item => item.offerId !== targetId), offer]; break;
    }
    case "offer_review": targetId = command.offerId; Object.assign(state.offers.find(item => item.offerId === targetId), { status: command.decision, revision }); break;
    case "support_request": targetId = id(30 + state.supportCases.length); state.supportCases.push({ caseId: targetId, targetId: command.targetId, kind: command.kind, amountMinor: command.amountMinor, status: "requested", revision, reason: command.reason, createdAt: fixtureTime }); break;
    case "support_review": targetId = command.caseId; Object.assign(state.supportCases.find(item => item.caseId === targetId), { status: command.decision, revision }); break;
    case "waiver_approve": targetId = id(40); state.waivers.push({ waiverId: targetId, orderId: command.orderId, component: command.component, amountMinor: command.amountMinor, currency: "usd", status: "approved_preparation", revision, actorId: id(90), reason: command.reason, createdAt: fixtureTime }); break;
    case "waiver_revoke": targetId = command.waiverId; Object.assign(state.waivers[0], { status: "revoked", revision }); break;
    case "settlement_review": targetId = command.orderId; Object.assign(state.settlements[0], { status: "held", revision }); break;
    default: throw new Error(`Unimplemented synthetic internal command: ${command.action}`);
  }
  state.audit.unshift({ eventId: command.requestId, action: command.action, targetId, actorId: id(90), reason: command.reason ?? null, createdAt: fixtureTime });
  return { mode: "pre_provider", providerActionsAvailable: false, requestId: command.requestId, targetId, revision, idempotentReplay: false };
}

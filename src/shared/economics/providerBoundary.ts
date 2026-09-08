// Domain contracts only. A future qualified adapter must supply evidence; no
// implementation here can create a customer, charge, onboarding link or payout.
export type ProviderLane = "support" | "recurring_support" | "seller_onboarding" | "marketplace" | "refunds" | "payouts";
export type ProviderQualification = {
  lane: ProviderLane; provider: "stripe" | null;
  ownerAuthorizationRecorded: boolean; providerApprovalRecorded: boolean;
  liabilityModelAdopted: boolean; legalTermsAdopted: boolean; adapterQualified: boolean;
};
export function providerReadiness(input: ProviderQualification) {
  const blockers: string[] = [];
  if (!input.ownerAuthorizationRecorded) blockers.push("owner_authorization_missing");
  if (!input.providerApprovalRecorded) blockers.push("provider_approval_missing");
  if (!input.liabilityModelAdopted) blockers.push("liability_model_pending");
  if (!input.legalTermsAdopted) blockers.push("legal_terms_pending");
  if (!input.adapterQualified) blockers.push("adapter_qualification_pending");
  if (input.provider !== "stripe") blockers.push("provider_not_selected");
  // Even a fully checked preview cannot grant execution authority.
  blockers.push("provider_execution_not_implemented_in_preparation");
  return { lane: input.lane, status: "DISABLED" as const, dispatchAllowed: false as const, blockers };
}

export type OwnedChargeComponents = {
  creatorPriceMinor: number; platformFeeMinor: number; processorFeeMinor: number | null; taxMinor: number | null;
};
function amount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000) throw new Error("Invalid integer amount.");
  return value;
}
export function previewPlatformWaiver(parts: OwnedChargeComponents, priorWaiverMinor: number, waiverMinor: number) {
  amount(parts.creatorPriceMinor); amount(parts.platformFeeMinor); amount(priorWaiverMinor); amount(waiverMinor);
  if (parts.processorFeeMinor !== null) amount(parts.processorFeeMinor);
  if (parts.taxMinor !== null) amount(parts.taxMinor);
  if (parts.platformFeeMinor > parts.creatorPriceMinor || priorWaiverMinor + waiverMinor > parts.platformFeeMinor) throw new Error("Waiver exceeds EcoSyneva's owned portion.");
  const remainingPlatformFeeMinor = parts.platformFeeMinor - priorWaiverMinor - waiverMinor;
  return Object.freeze({ preparationOnly: true, creatorPriceMinor: parts.creatorPriceMinor,
    creatorShareBeforeProcessorMinor: parts.creatorPriceMinor - remainingPlatformFeeMinor,
    remainingPlatformFeeMinor, processorFeeMinor: parts.processorFeeMinor, taxMinor: parts.taxMinor,
    providerActionPerformed: false });
}

export function acknowledgmentBoundary(kind: "support_acknowledgment" | "marketplace_payment" | "refund_record" | "payout_preparation") {
  const labels = { support_acknowledgment: "Support Acknowledgment", marketplace_payment: "Marketplace Payment Record", refund_record: "Refund Record", payout_preparation: "Creator Payout Preparation" };
  return { title: labels[kind], donationReceipt: false, taxInvoice: false,
    provesCreatorPayout: false, provesProviderDelivery: false,
    preparationOnly: kind === "payout_preparation" };
}

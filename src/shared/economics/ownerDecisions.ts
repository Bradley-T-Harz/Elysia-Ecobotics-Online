/** Adopted by the owner on 2026-09-10. Policy is not provider activation. */
export const ownerEconomicPolicy = Object.freeze({
  version: "2026-09-10-owner-decisions",
  marketplaceFeeBps: 500,
  freeMarketplaceFeeBps: 0,
  buyerConvenienceFeeMinor: 0,
  commercialJobPostFeeMinor: 1000,
  currency: "usd",
  jobPostCollectionPoint: "after_content_approval_before_publication",
  proofRetentionDaysAfterFinalReviewOrAppeal: 30,
  messagingDeclineCooldownDays: 30,
  supportGrantsPersonalCompute: false,
  providerModelPreference: "creator_as_seller_direct_charge",
  providerModelApproved: false,
  processorFeeAllocation: "provider_dependent",
  taxCollectionAndRemittance: "provider_and_accounting_dependent",
  financialActivation: false
} as const);

export type RefundLane = "support" | "marketplace" | "job_post" | "organization_services";
export type RefundReason = "duplicate" | "mistaken_amount" | "unauthorized" | "cancel_future_renewal" | "prolonged_material_failure" | "non_delivery" | "misrepresentation" | "security_defect" | "mandatory_right" | "rejected_before_publication" | "failed_to_publish_after_payment" | "withdrawn_after_publication" | "platform_error_removal" | "poster_misconduct" | "other";
export type RefundDisposition = "refund" | "review_refund" | "refund_and_investigate" | "cancel_future_renewal" | "notice_and_refund_or_cancellation_offer" | "no_charge" | "full_refund" | "normally_no_refund" | "fair_refund_or_credit" | "contract_specific" | "review_required";

// This is triage, never a claim that a refund/cancellation/payout was executed.
export function refundPolicyDisposition(lane: RefundLane, reason: RefundReason): RefundDisposition {
  if (lane === "organization_services") return "contract_specific";
  if (reason === "mandatory_right") return "review_refund";
  if (lane === "support") {
    const policy: Partial<Record<RefundReason, RefundDisposition>> = {
      duplicate: "refund", mistaken_amount: "review_refund", unauthorized: "refund_and_investigate",
      cancel_future_renewal: "cancel_future_renewal", prolonged_material_failure: "notice_and_refund_or_cancellation_offer"
    };
    return policy[reason] ?? "review_required";
  }
  if (lane === "marketplace") return ["non_delivery", "misrepresentation", "security_defect", "duplicate", "unauthorized"].includes(reason) ? "review_refund" : "review_required";
  const policy: Partial<Record<RefundReason, RefundDisposition>> = {
    rejected_before_publication: "no_charge", failed_to_publish_after_payment: "full_refund",
    withdrawn_after_publication: "normally_no_refund", platform_error_removal: "fair_refund_or_credit", poster_misconduct: "normally_no_refund"
  };
  return policy[reason] ?? "review_required";
}

export function marketplaceFeeAllocation(creatorPriceMinor: number, ownedFeeWaiverMinor = 0) {
  if (!Number.isSafeInteger(creatorPriceMinor) || creatorPriceMinor < 0 || creatorPriceMinor > 100_000_000_000) throw new Error("Invalid creator price.");
  const platformFeeMinor = Math.round(creatorPriceMinor * ownerEconomicPolicy.marketplaceFeeBps / 10000);
  if (!Number.isSafeInteger(ownedFeeWaiverMinor) || ownedFeeWaiverMinor < 0 || ownedFeeWaiverMinor > platformFeeMinor) throw new Error("Only EcoSyneva’s own platform fee may be waived.");
  return { creatorPriceMinor, platformFeeMinor: platformFeeMinor - ownedFeeWaiverMinor, waivedValueMinor: ownedFeeWaiverMinor,
    creatorPayableBeforeProcessorAndTaxMinor: creatorPriceMinor - platformFeeMinor + ownedFeeWaiverMinor,
    processorFeeMinor: null, taxMinor: null, payoutCompleted: false };
}

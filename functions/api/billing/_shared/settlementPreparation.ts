// Local preparation only. No imports, credentials, network, persistence or live
// dispatch. Account-scoped evidence must come from a future qualified adapter.
export type ProposedFeeTerms = {
  version: string; adopted: false; basisPoints: number;
  processorFeePayer: "seller" | "platform";
};
function minor(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000) throw new Error("Invalid minor-unit amount.");
  return BigInt(value);
}
function roundRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}
export function previewFeeSnapshot(grossMinor: number, currency: string, terms: ProposedFeeTerms | null, processorFeeMinor: number | null, taxMinor: number | null) {
  const gross = minor(grossMinor);
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Explicit currency required.");
  if (processorFeeMinor !== null) minor(processorFeeMinor);
  if (gross === 0n && ((processorFeeMinor !== null && processorFeeMinor !== 0) || (taxMinor !== null && taxMinor !== 0))) throw new Error("Free offering cannot carry payment fees or tax.");
  if (taxMinor !== null && minor(taxMinor) > gross) throw new Error("Tax exceeds gross.");
  if (terms && (terms.adopted !== false || !/^[A-Za-z0-9._:-]{1,120}$/.test(terms.version)
    || !Number.isSafeInteger(terms.basisPoints) || terms.basisPoints < 0 || terms.basisPoints > 5000
    || !["seller", "platform"].includes(terms.processorFeePayer))) throw new Error("Invalid proposed fee terms.");
  // No default commission. Free offers stay free. Proposed percentage basis is
  // the price excluding tax; this basis and rounding still require adoption.
  const platformFeeMinor = gross === 0n ? 0 : !terms || taxMinor === null ? null
    : Number(roundRatio((gross - BigInt(taxMinor)) * BigInt(terms.basisPoints), 10000n));
  const creatorProceedsMinor = gross === 0n ? 0 : platformFeeMinor === null || processorFeeMinor === null || taxMinor === null || !terms ? null
    : grossMinor - taxMinor - platformFeeMinor - (terms.processorFeePayer === "seller" ? processorFeeMinor : 0);
  const platformNetMinor = !terms || platformFeeMinor === null || processorFeeMinor === null ? null
    : platformFeeMinor - (terms.processorFeePayer === "platform" ? processorFeeMinor : 0);
  return Object.freeze({ proposalOnly: true, activationAllowed: false, currency, grossMinor, taxMinor,
    platformFeeMinor, processorFeeMinor, processorFeePayer: terms?.processorFeePayer ?? null,
    creatorProceedsMinor, platformNetMinor, feeVersion: terms?.version ?? null });
}

// Reverse the cumulative original commission proportionally, then subtract the
// previous reversal. This prevents per-refund rounding from over-reversing fees.
export function previewFeeReversal(grossMinor: number, originalFeeMinor: number, previousRefundMinor: number, nextRefundMinor: number) {
  const gross = minor(grossMinor), fee = minor(originalFeeMinor), previous = minor(previousRefundMinor), next = minor(nextRefundMinor);
  if (gross === 0n || fee > gross || previous > next || next > gross) throw new Error("Invalid cumulative refund.");
  const totalFeeReversed = roundRatio(fee * next, gross);
  return { totalRefundMinor: nextRefundMinor, totalFeeReversedMinor: Number(totalFeeReversed),
    newFeeReversalMinor: Number(totalFeeReversed - roundRatio(fee * previous, gross)),
    creatorRefundShareMinor: Number(next - previous - (totalFeeReversed - roundRatio(fee * previous, gross))) };
}

export type SettlementScope = { provider: "stripe"; account: string; orderId: string; sellerId: string | null; currency: string };
export type SettlementEvidence = SettlementScope & {
  testMode: true; balanceTransactionId: string; sourceSha256: string;
  kind: "charge" | "refund" | "transfer" | "payout";
  grossMinor: number; processorFeeMinor: number | null; netMinor: number | null;
  state: "pending" | "available" | "paid" | "failed";
};
function scopeKey(scope: SettlementScope): string {
  if (scope.provider !== "stripe" || !/^(platform|acct_[A-Za-z0-9]{1,100})$/.test(scope.account)
    || !/^[0-9a-f-]{36}$/.test(scope.orderId) || (scope.sellerId !== null && !/^[0-9a-f-]{36}$/.test(scope.sellerId))
    || !/^[a-z]{3}$/.test(scope.currency)) throw new Error("Invalid settlement scope.");
  return JSON.stringify([scope.provider, scope.account, scope.orderId, scope.sellerId, scope.currency]);
}
// A bounded, pure reconciliation preview. Repeating an identical import does
// not count twice; a conflicting retry is refused. Payout/transfer evidence is
// never recognized as a second sale. Unknown processor net remains unknown.
export function reconcileSettlementPreview(expected: SettlementScope[], evidence: SettlementEvidence[]) {
  if (expected.length > 1000 || evidence.length > 1000) throw new Error("Settlement preview batch too large.");
  const scopes = new Set(expected.map(scopeKey));
  if (scopes.size !== expected.length) throw new Error("Duplicate expected scope.");
  const seen = new Map<string, string>();
  const totals = new Map<string, { currency: string; account: string; sellerId: string | null; chargesMinor: number; refundsMinor: number; processorFeesMinor: number | null; netMinor: number | null; transfersMinor: number; paidPayoutsMinor: number }>();
  for (const item of evidence) {
    if (!scopes.has(scopeKey(item)) || item.testMode !== true || !/^txn_[A-Za-z0-9]{1,100}$/.test(item.balanceTransactionId)
      || !/^[a-f0-9]{64}$/.test(item.sourceSha256) || !["charge", "refund", "transfer", "payout"].includes(item.kind)
      || !["pending", "available", "paid", "failed"].includes(item.state)) throw new Error("Unmatched settlement evidence.");
    const gross = minor(item.grossMinor);
    if ((item.processorFeeMinor === null) !== (item.netMinor === null)) throw new Error("Partially known processor settlement.");
    if (item.processorFeeMinor !== null && item.netMinor !== null) {
      const fee = minor(item.processorFeeMinor);
      if (!Number.isSafeInteger(item.netMinor) || BigInt(item.netMinor) !== gross - fee) throw new Error("Settlement gross/fee/net mismatch.");
    }
    const id = JSON.stringify([item.provider, item.account, item.balanceTransactionId]);
    const fingerprint = JSON.stringify([scopeKey(item), item.testMode, item.sourceSha256, item.kind, item.grossMinor, item.processorFeeMinor, item.netMinor, item.state]);
    if (seen.has(id)) {
      if (seen.get(id) !== fingerprint) throw new Error("Conflicting settlement import.");
      continue;
    }
    seen.set(id, fingerprint);
    // Pending and failed evidence is retained by a future adapter but contributes
    // no settled totals. A later snapshot replaces a preview, never appends cash.
    if (item.state === "failed" || item.state === "pending") continue;
    if ((item.kind === "charge" || item.kind === "refund" || item.kind === "transfer") && item.state !== "available") throw new Error("Unqualified settlement state.");
    const partition = JSON.stringify([item.account, item.sellerId, item.currency]);
    const total = totals.get(partition) ?? { currency: item.currency, account: item.account, sellerId: item.sellerId,
      chargesMinor: 0, refundsMinor: 0, processorFeesMinor: 0, netMinor: 0, transfersMinor: 0, paidPayoutsMinor: 0 };
    if (item.kind === "charge" || item.kind === "refund") {
      if (item.kind === "charge") total.chargesMinor += item.grossMinor;
      else total.refundsMinor += item.grossMinor;
      total.processorFeesMinor = total.processorFeesMinor === null || item.processorFeeMinor === null ? null : total.processorFeesMinor + item.processorFeeMinor;
      // Refund evidence amounts are outgoing; refunded processor fee credits
      // require a separately qualified adjustment, not a guessed zero/credit.
      total.netMinor = total.netMinor === null || item.netMinor === null ? null
        : total.netMinor + (item.kind === "charge" ? item.netMinor : -item.grossMinor - item.processorFeeMinor!);
    } else if (item.kind === "transfer") total.transfersMinor += item.grossMinor;
    else if (item.state === "paid") total.paidPayoutsMinor += item.grossMinor;
    totals.set(partition, total);
  }
  return { testMode: true, previewOnly: true, uniqueEvidenceCount: seen.size, partitions: [...totals.values()],
    unrestrictedRevenueMinor: null, reserveBalanceMinor: null };
}

export function savedMethodReusePermitted(method: { buyerId: string; account: string; purpose: "support" | "marketplace"; consent: boolean }, target: { buyerId: string; account: string; purpose: "support" | "marketplace" }): boolean {
  return method.consent === true && /^(platform|acct_[A-Za-z0-9]{1,100})$/.test(method.account) && ["support", "marketplace"].includes(method.purpose) && Boolean(method.buyerId) && method.buyerId === target.buyerId && method.account === target.account && method.purpose === target.purpose;
}

export function proposedDirectChargePlan(input: { scope: SettlementScope; grossMinor: number; fee: ProposedFeeTerms | null; sellerAuthorized: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; countryCurrencyQualified: boolean }) {
  scopeKey(input.scope); minor(input.grossMinor);
  const blockers = ["charge_model_not_adopted", "fee_terms_not_adopted", "provider_qualification_required", "live_dispatch_disabled"];
  if (!input.fee) blockers.push("fee_proposal_missing");
  else previewFeeSnapshot(input.grossMinor, input.scope.currency, input.fee, null, null);
  if (!input.scope.sellerId || input.scope.account === "platform" || !input.sellerAuthorized || !input.chargesEnabled || !input.payoutsEnabled || !input.countryCurrencyQualified) blockers.push("seller_not_qualified");
  return { proposedModel: "creator_connected_direct_charge", providerManagedPayouts: true, dispatchAllowed: false,
    // Private fixture plan; do not publish provider account references to buyers.
    accountScope: input.scope.account, orderId: input.scope.orderId, blockers };
}

export function dispatchPreparedSettlement(): never {
  throw new Error("Settlement dispatch is disabled; separate model, provider and activation authorization is required.");
}

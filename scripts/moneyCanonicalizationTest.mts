import assert from "node:assert/strict";
import { feeMinorUnits, cumulativeFeeReversal, roundMoneyRatio, MAX_MONEY_MINOR } from "../functions/api/billing/_shared/money.ts";
import { previewFeeSnapshot, previewFeeReversal } from "../functions/api/billing/_shared/settlementPreparation.ts";

for (const [gross, fee] of [[0, 0], [1, 0], [9, 0], [10, 1], [11, 1], [100, 5], [199, 10], [999, 50], [1000, 50], [2000, 100], [10000, 500], [MAX_MONEY_MINOR, 5_000_000_000]]) {
  assert.equal(feeMinorUnits(gross, 500), fee);
  assert.equal(previewFeeSnapshot(gross, "usd", { version: "round-half-up-v1", adopted: false, basisPoints: 500, processorFeePayer: "seller" }, 0, 0).platformFeeMinor, fee);
}
for (const value of [-1, 0.1, NaN, Infinity, MAX_MONEY_MINOR + 1, Number.MAX_SAFE_INTEGER]) assert.throws(() => feeMinorUnits(value, 500));
for (const bps of [-1, 0.5, NaN, 10001]) assert.throws(() => feeMinorUnits(199, bps));
assert.equal(roundMoneyRatio(1n, 3n), 0n);
assert.equal(roundMoneyRatio(2n, 3n), 1n);
for (const gross of [1, 10, 199, 999, 1000, 10001]) {
  // Both historical floor snapshots and new snapshots reverse exactly.
  for (const fee of new Set([Math.floor(gross / 20), feeMinorUnits(gross, 500)])) {
    let reversed = 0;
    for (let next = 1; next <= gross; next++) {
      const step = previewFeeReversal(gross, fee, next - 1, next);
      assert.ok(step.newFeeReversalMinor >= 0 && step.newFeeReversalMinor <= 1);
      assert.equal(step.newFeeReversalMinor + step.creatorRefundShareMinor, 1);
      reversed += step.newFeeReversalMinor;
      assert.equal(reversed, cumulativeFeeReversal(gross, fee, next));
    }
    assert.equal(reversed, fee);
  }
}
assert.throws(() => cumulativeFeeReversal(0, 0, 0));
assert.throws(() => cumulativeFeeReversal(199, 10, 200));
console.log("Canonical minor-unit money: boundaries, odd denominators, previews and cumulative historical/new reversals passed.");

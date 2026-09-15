/** Authoritative nonnegative minor units. Round exact ratios half up. */
export const MAX_MONEY_MINOR = 100_000_000_000;

export function minorUnits(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_MINOR) {
    throw new Error("Invalid minor-unit amount.");
  }
  return BigInt(value);
}

export function roundMoneyRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("Invalid money ratio.");
  return (2n * numerator + denominator) / (2n * denominator);
}

export function feeMinorUnits(amountMinor: number, basisPoints: number): number {
  const amount = minorUnits(amountMinor);
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error("Invalid fee basis points.");
  }
  return Number(roundMoneyRatio(amount * BigInt(basisPoints), 10_000n));
}

/** Reverse the original recorded fee cumulatively; never recalculate old terms. */
export function cumulativeFeeReversal(grossMinor: number, recordedFeeMinor: number, refundedMinor: number): number {
  const gross = minorUnits(grossMinor), fee = minorUnits(recordedFeeMinor), refund = minorUnits(refundedMinor);
  if (gross === 0n || fee > gross || refund > gross) throw new Error("Invalid cumulative refund.");
  return Number(roundMoneyRatio(fee * refund, gross));
}

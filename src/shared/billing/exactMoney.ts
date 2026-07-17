/**
 * Convert a plain, non-negative USD decimal string to minor units without
 * passing the decimal through binary floating-point arithmetic.
 *
 * This deliberately rejects whitespace, signs, exponent notation, leading
 * zeroes, and more than two fractional digits. Domain-specific minimum and
 * maximum amounts remain the caller's responsibility.
 */
export function exactUsdDecimalToMinor(value: string): number | null {
  if (value.length === 0 || value.length > 18) return null;
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(value);
  if (!match) return null;

  const wholeMinor = Number(match[1]) * 100;
  const fractionalMinor = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const amountMinor = wholeMinor + fractionalMinor;
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
}

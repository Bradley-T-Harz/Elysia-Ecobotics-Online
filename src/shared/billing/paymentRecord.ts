export function formatMinorAmount(amount: number | null, currency: string): string {
  if (amount === null) return "Not yet verified";
  if (!Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return "Amount unavailable";
  try {
    const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    const scale = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
    return formatter.format(amount / scale);
  } catch {
    return "Amount unavailable";
  }
}

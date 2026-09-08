import type { ReceiptSummary } from "./billingClient";
import { formatMinorAmount } from "./paymentRecord";

export default function PaymentRecordCard({ receipt }: { receipt: ReceiptSummary }) {
  const support = receipt.flow === "support_one_time" || receipt.flow === "support_recurring";
  return <article className="economic-summary-card" aria-label={support ? "Support acknowledgment" : "Payment record"}>
    <h3>{support ? "Support acknowledgment" : "Payment record"}</h3>
    <p className="boundary-note">Test-mode record — no real payment or refund is claimed.</p>
    <dl className="mini-facts">
      <div><dt>Purpose</dt><dd>{receipt.label}</dd></div>
      <div><dt>Payee / seller</dt><dd>{receipt.payee ?? "Seller identity is unavailable in this historical record; contact billing support."}</dd></div>
      <div><dt>Amount</dt><dd>{formatMinorAmount(receipt.amountCents, receipt.currency)}</dd></div>
      <div><dt>Cadence</dt><dd>{receipt.cadence === "monthly" ? "Monthly support" : "One-time payment"}</dd></div>
      <div><dt>Recorded</dt><dd>{receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : "Unavailable"}</dd></div>
      <div><dt>Current order state</dt><dd>{receipt.orderStatus?.replace(/_/g, " ") ?? "Not included in this record"}</dd></div>
      <div><dt>Refunds recorded</dt><dd>{formatMinorAmount(receipt.refundedAmountCents, receipt.currency)}</dd></div>
    </dl>
    <p className="small-note">Elysia reference: <code>{receipt.publicReference}</code></p>
    <p>{support ? "This is not a charitable contribution receipt and is not represented as tax-deductible. It acknowledges support for EcoSyneva's own work; no personal units or privileges are purchased." : "This payment record is not automatically a tax invoice, fulfillment confirmation or evidence that a creator's bank payout completed."}</p>
    <p>Provider email delivery is not established by this record. Recurring cancellation and its effective date are shown separately in your subscription history or authorized billing management.</p>
    <a className="button-link" href={`mailto:support@elysiaecobotics.com?subject=${encodeURIComponent(`Private billing help · ${receipt.publicReference}`)}`}>Ask about this transaction</a>
  </article>;
}

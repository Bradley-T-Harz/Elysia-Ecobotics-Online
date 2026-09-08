// Prepared public clarifications. No new fee, retention deadline, reserve target,
// renewal allowance or outage SLA is adopted here. Historical text is archived.
export const readinessLegalVersion = "2026-09-08-readiness";

export const economicReadinessNotice = `## Current funding and payment availability

Support and paid Marketplace checkout are not active. Both are being prepared for provider review and operational readiness. A public explanation, account, approved listing or connected seller account does not mean payments or payouts are enabled. No provider approval is claimed.

EcoSyneva Commons LLC receives its own optional support for existing and continuing free software and community work: development, maintenance, security, education, moderation, shared infrastructure and operations. Support may help build emergency savings for continuity; this is not a claim that a reserve is already funded. Nonpayers remain included. Support does not grant personal sandbox units, execution priority, authority, equity or investor returns, and is not presented as a tax-deductible charitable contribution to EcoSyneva.

Marketplace purchases are separate transactions for an identified seller's offering. Creators may sell their own work and EcoSyneva may sell its own offerings. Seller identity, price, license, applicable fees and responsibilities must be disclosed before a paid offer can activate. No platform fee rate is adopted by this notice; free listings do not acquire a fee. Seller onboarding, payment, available funds and completed payout are separate states.

Independent giving goes directly to each outside organization through its own channels. EcoSyneva does not collect, hold, forward or commission those gifts. Optional recognition review is separate from payment processing and tax certification.

See [How EcoSyneva Is Funded](/support#how-ecosyneva-is-funded). For an existing payment or cancellation problem, contact support@elysiaecobotics.com using only the Elysia reference and the minimum necessary information. New-checkout availability does not remove existing obligations or mandatory consumer rights.`;

export const hostedProofNotice = `When you choose to submit a recognition request through Commons Profile setup, the configured public website sends the request and any optional redacted proof to Supabase. Proof files use private hosted storage. Authorized stewardship reviewers and administrators can obtain temporary access for review. This is a cloud-facing workflow, separate from Elysia's private local core; service-provider processing and access controls do not eliminate all risk.

Remove unnecessary addresses, bank/card details, full transaction identifiers, QR codes or transaction-access links, tax/identity numbers and unrelated personal information before submission. Documents are untrusted evidence, not payment authorization, an independent organization's receipt issued by EcoSyneva, or a guarantee of authenticity or tax treatment. Do not submit a complete financial history.

Optional files and review metadata have different retention needs from payment, consent and accounting records. A fixed automatic proof-deletion schedule is not currently promised. Contact privacy@elysiaecobotics.com for access, correction, withdrawal or deletion review. Pending review, appeals, justified time-bounded holds, backups and restored copies must be considered; a file hash or account identifier is not automatically anonymous. Local-only drafts are not submitted for review.`;

export function clarifyEconomicPolicy(slug: string, original: string): string {
  let body = original.split("https://elysia-ecobotics-online.pages.dev").join("https://elysiaecobotics.com");
  if (slug === "donation-recognition-terms") {
    body = body.replace(/## 10\. Proof file handling[\s\S]*?(?=## 11\.)/, `## 10. Hosted proof handling\n\n${hostedProofNotice}\n\n`)
      .replace(/## 17\. Future administrator workflow[\s\S]*$/, `## 17. Submission and review\n\nDonate directly through the independent organization's own channel if you choose. Commons Profile setup can submit a recognition request and optional redacted proof to the configured website backend. Authorized reviewers can approve, reject or request redaction; recognition is a separate decision. A local-only draft is not a submitted request.\n`);
  }
  if (slug === "privacy-policy") {
    body = body.replace(/If stewardship recognition verification becomes active,[\s\S]*?(?=### 3\.8)/, `Recognition requests may include account and organization identifiers, an optional donation date or amount range, a note, review status, redaction confirmation and optional proof-file metadata. Exact amount is not a payment entitlement or public ranking.\n\n${hostedProofNotice}\n\n`)
      .replace("process stewardship recognition drafts or future administrator review", "process stewardship recognition requests and authorized review")
      .replace("Future retention rules should distinguish", "Retention review must distinguish")
      .replace("Proof files, if ever accepted, should have a limited retention period and deletion process.", "Proof files are accepted through the configured hosted workflow. No fixed automatic deletion deadline is promised; requests and any justified retention needs require review.");
  }
  if (slug === "sandbox-credit-terms") {
    body = body.replace("Purchased, recurring, sponsored, waived, starter, and operational credit sources remain distinguishable in the private ledger.", "Historical test credit sources remain distinguishable in the private ledger. The current shared hosted allowance is finite starter access: no paid top-up, scheduled replenishment or balance expiry is currently offered.")
      .replace("## 3. Disclosure before activation", "## 3. Dormant commercial machinery")
      .replace("Before paid credits can be sold,", "Paid compute is not part of the current Support or Marketplace preparation. Historical test-only machinery does not constitute an offer. Any different future proposal would require separate authorization; before any paid credits could be sold,");
  }
  if (slug === "support-and-billing-terms") body = body.replace("Stripe may send receipts to the checkout email.", "Provider receipt email depends on configured delivery settings and is not confirmed here. An EcoSyneva payment acknowledgment is distinct from a purchase invoice or external stewardship evidence; it does not establish that every applicable invoice requirement has been met.");
  return body.replace(/\*\*Version:\*\* 2026-07-16/g, `**Version:** ${readinessLegalVersion}`)
    .replace(/\*\*Last updated:\*\* \d{4}-\d{2}-\d{2}/g, "**Last updated:** 2026-09-08")
    .trimEnd() + "\n\n" + economicReadinessNotice + "\n";
}

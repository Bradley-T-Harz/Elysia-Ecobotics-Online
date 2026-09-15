// Prospective revision; earlier composed pages and acceptance hashes stay frozen.
export const firstPartyLegalVersion = "2026-09-15-first-party";
export const firstPartyLegalSlugs = new Set([
  "support-and-billing-terms", "privacy-policy", "account-closure-financial-retention",
  "refund-and-cancellation-policy", "job-post-fee-terms", "organization-services-terms",
  "sponsorship-independence-policy", "marketplace-commerce-terms", "sandbox-credit-terms",
  "donation-recognition-terms", "terms-of-use"
]);
export function applyFirstPartyLegal(slug: string, body: string) {
  let next = body
    .replace(/\*\*Version:\*\* [^\n]+/, `**Version:** ${firstPartyLegalVersion}`)
    .replace(/\*\*Last updated:\*\* [^\n]+/, "**Last updated:** 2026-09-15")
    .replace("Support and paid Marketplace checkout are not active. Both are being prepared for provider review and operational readiness. A public explanation, account, approved listing or connected seller account does not mean payments or payouts are enabled. No provider approval is claimed.", "Stripe approved EcoSyneva Commons LLC’s first-party account on September 15, 2026. Each payment lane still requires its own technical, operational and tax-readiness checks. Current availability is shown on Support and in the relevant account workflow. An approval, public explanation or listing does not establish that checkout is enabled. Third-party paid Marketplace sales, Stripe Connect, seller onboarding and creator payouts remain disabled pending separate approval and activation.")
    .replace("No payment is currently collected, and no payment information is requested.", "The checkout control appears only when that lane is enabled and the approved post has a payable economic condition. Card information is entered on Stripe-hosted Checkout.")
    .split("No real refund, cancellation of a live subscription or payment-provider action is enabled by these principles. Current account records, requests and completed provider actions must always be distinguished.").join("These principles do not themselves perform a refund or cancellation. Current account records, requests and provider-confirmed actions remain distinct. Cancellation and payment management remain available for existing obligations when new checkout is paused.");
  if (!["marketplace-commerce-terms", "sandbox-credit-terms"].includes(slug)) next = next
    .replace(/Stripe test mode/g, "Stripe-hosted payment processing when enabled")
    .replace(/test-mode checkout/g, "enabled checkout")
    .replace(/Test-mode checkout/g, "Enabled checkout")
    .replace(/\*\*Status:\*\* [^\n]*[Tt]est-mode[^\n]*/, "**Status:** First-party operating terms; lane availability is separately controlled.")
    .replace("Repository billing is test-mode-only. Test payments move no real funds and cannot produce a real refund. This policy defines the intended fair process that must be reviewed before live activation.", "Billing records distinguish sandbox tests from provider-confirmed live payments. Sandbox tests move no real funds. Refund availability follows the applicable lane, verified payment record and policy below.")
    .replace("Live payment activation requires separate business, banking, provider-verification, legal, tax, accounting, pricing, and operational approval.", "Stripe first-party account approval is recorded. Each live payment lane still requires qualified configuration, legal and tax decisions, accounting readiness and operational checks.")
    .replace(/test-mode payment records/g, "environment-labeled payment records")
    .replace(/test-mode recurring support/g, "recurring support when enabled");
  return next.trimEnd() + `\n\n## First-party payment records and availability\n\nStripe moves money; EcoSyneva records consent, purpose, permissions and accounting history. Returning from Checkout is not proof of payment. Payment and refund status require verified provider evidence. A hosted payment receipt, a service invoice and an EcoSyneva acknowledgment have different purposes; none is automatically a tax-deductible donation receipt. Tax treatment and invoice requirements depend on the payment lane and applicable facts; this revision does not decide them.\n\nSupport grants no governance, membership, status, badges, compute credits or priority. Job Post payment cannot buy content approval, publication, ranking or endorsement. Organization services require their existing contract review; sponsorship requires its existing agreement and ethics review. Third-party commerce, paid hosted compute and hardware sales remain unavailable. Free Creator Studio, Developer Forge, drafts, review and free publication remain available.\n`;
}

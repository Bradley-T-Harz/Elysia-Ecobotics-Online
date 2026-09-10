export const ownerDecisionLegalVersion = "2026-09-10-owner-decisions";
export const ownerDecisionLegalSlugs = new Set([
  "donation-recognition-terms", "privacy-policy", "terms-of-use", "support-and-billing-terms",
  "refund-and-cancellation-policy", "sandbox-credit-terms", "job-post-fee-terms", "marketplace-commerce-terms",
  "sponsorship-independence-policy", "organization-services-terms", "account-closure-financial-retention",
  "marketplace-developer-agreement", "volunteer-contributor-disclaimer", "community-guidelines"
]);
const marketplace = `EcoSyneva's adopted platform fee is 5% of successful paid third-party Marketplace sales. Free add-ons have a 0% platform fee, with no ordinary free submission/listing fee and no separate buyer convenience fee. EcoSyneva may waive only its own platform fee; it may not reduce, redirect or forgive a creator's price/share, processor fees or taxes without the proper third-party authorization. Creator price, EcoSyneva fee, processor costs, taxes, refunds/disputes and any creator-authorized promotion remain separate accounting facts.

The preferred future structure is creator-as-seller with provider direct charges and a disclosed application fee. This remains a preference pending provider approval. Final account/charge configuration, processor-fee allocation, losses/refunds/dispute liability and tax collection/remittance remain pending provider and legal/accounting decisions. No provider onboarding, paid checkout or payout is active. A payment record is not evidence of completed creator settlement.`;
const retention = `Raw stewardship proof is deleted from active hosted storage 30 days after final review. An open appeal pauses deletion; the 30-day period starts again when that appeal closes. A legitimate fraud/abuse investigation or legal hold retains evidence only as necessary, with a recorded reason and review date. Once deletion starts, the file may no longer be recoverable. Minimal review/deletion metadata and a private object-name hash remain to enforce deletion if a copy is restored; file bytes, file hash, original filename, size and MIME details are removed after deletion is confirmed. Backups or restored copies remain subject to access controls and the same deletion obligation.

Use [My stewardship requests & proof](/commons-circle/signals/requests-reviews#stewardship-proof) to see review, appeal and proof-retention status. No exact donation amount is required or publicly displayed by default. Recognition is not wealth ranking. The independent organization receives the gift and handles its own receipts; EcoSyneva does not issue a donation receipt for that organization.`;
const workWith = `Work With applications and optional CVs are private to the applicant and accounts separately authorized as Work With reviewers. Administrator, Marketplace reviewer and economic-operator status alone do not grant application or CV access. CV downloads use short-lived authorized links; files never become public profile content. Applicants can use [My Work With requests](/commons-circle/signals/work-with) to view applications, retry an incomplete upload, respond to an information request, withdraw an open request and read the final outcome. Review does not itself grant employment, account roles, payment, governance or local Elysia authority.`;
const job = `The adopted fee for a commercial for-profit Job Post is $10 USD per posting. It may be collected only after content/publication approval and immediately before publication. Rejected posts incur no charge. No fee is charged to applicants or job seekers. No payment is currently collected, and no payment information is requested.

Community, volunteer, legitimate nonprofit, educational, research and qualifying public-interest paths may be free under the governed assessment. A for-profit poster claiming public benefit must request a waiver or reduction; that claim alone does not establish a free path. Any commercial poster may [request a fee waiver or assistance](/commons-circle/signals/requests-reviews?domain=job_posts#posting-fees). A short explanation and optional category are enough; bank statements, tax returns, income proof and hardship documents are not required.

Authorized outcomes may be normal fee, reduced fee, fully waived, or assistance/subsidized. Decisions are private and audited. Foregone-fee waivers have no artificial cash budget; waived value is tracked separately. Subsidies spending actual cash or compute require a separate bounded assistance budget. Only EcoSyneva's own fee can be waived. Payment, waiver, reduction, subsidy or assistance never buys publication, ranking, endorsement, moderation preference, trust or authority.`;
const refunds = `## Lane-specific refund and cancellation principles

**Support:** duplicate payments are refundable; mistaken amounts receive review and a refund where appropriate; unauthorized payments require refund/investigation. Recurring-support cancellation stops future renewal. Prolonged material EcoSyneva failure requires transparent notice and an appropriate refund/cancellation offer. Voluntary Support is not an SLA.

**Marketplace:** baseline protection covers non-delivery, material misrepresentation, malware/security defects, duplicate purchases, unauthorized payments and legally required refunds. Creators may provide more generous terms, but may not reduce this baseline or applicable rights. A review or approved refund request is distinct from a provider-confirmed refund and from creator payout reconciliation.

**Job Posts:** rejection before publication means no charge. If EcoSyneva fails to publish after payment, a full refund is due. Ordinary withdrawal after successful publication normally receives no refund. Removal due to EcoSyneva error merits a fair refund or credit; removal for poster misconduct or false information generally receives no refund. Mandatory rights remain unaffected.

**Professional/organization services:** refund and cancellation terms are contract-specific. No support payment silently creates a service contract.

No real refund, cancellation of a live subscription or payment-provider action is enabled by these principles. Current account records, requests and completed provider actions must always be distinguished.`;

export function applyOwnerDecisionLegal(slug: string, original: string) {
  let body = original.split("https://elysia-ecobotics-online.pages.dev").join("https://elysiaecobotics.com")
    .replace(/\*\*Version:\*\* [^\n]+/, `**Version:** ${ownerDecisionLegalVersion}`)
    .replace(/\*\*Last updated:\*\* [^\n]+/, "**Last updated:** 2026-09-10")
    .replace("No platform fee rate is adopted by this notice; free listings do not acquire a fee.", "The adopted platform fee is 5% on paid third-party sales and 0% on free add-ons; collection remains inactive.")
    .split("Authorized stewardship reviewers and administrators").join("Separately authorized stewardship reviewers")
    .replace("A fixed automatic proof-deletion schedule is not currently promised.", "Raw proof follows the adopted 30-day retention rule below.")
    .replace("No fixed automatic deletion deadline is promised; requests and any justified retention needs require review.", "Raw proof follows the adopted 30-day retention rule below, with reviewable appeal and hold exceptions.")
    .replace("Eligible sellers may complete provider-hosted identity, tax, and bank onboarding through Stripe Connect test mode.", "Seller banking, identity and tax onboarding is disabled. If approved and separately activated, financial credential collection will occur through the approved provider; EcoSyneva does not collect raw banking/card/KYC details here.");
  body = body.replace("Administrator review may consider whether the proof", "Scoped stewardship review may consider whether the proof")
    .replace("reviewer/admin ID if approved", "authorized reviewer ID if approved")
    .replace("Stewardship recognition, badges, or membership tiers may be reviewed by administrators.", "Stewardship evidence requires separately authorized stewardship review; badge and account-role administration remain distinct.")
    .replace("and administrator-review status.", "and scoped Work With review status.")
    .replace("Unless a backend administrator review queue is live, these requests may be stored locally in your browser as drafts or pending-review placeholders.", "Submitted Work With requests enter the private, source-backed Work With review queue. Locally saved drafts remain on your device until you choose to submit.")
    .replace("local-only draft flows where backend review is not ready, and administrator review for sensitive workflows", "private drafts, source-backed review records, and separately scoped access for sensitive workflows")
    .replace("A request may be saved locally as a draft, held for future administrator review, accepted, declined, unanswered, redirected, postponed, or closed because the project lacks capacity. We cannot promise response times.", "A request may be saved locally as a draft or submitted for scoped Work With review. Submitted requests may receive information requests, approval, decline or closure; applicants can respond or withdraw open requests. We cannot promise response times or employment.");
  if (!body.includes(`**Version:** ${ownerDecisionLegalVersion}`)) body = body.replace(/^(# [^\n]+\n)/, `$1\n**Version:** ${ownerDecisionLegalVersion}\n`);
  if (["marketplace-commerce-terms", "marketplace-developer-agreement"].includes(slug)) body += `\n\n## Adopted fee and seller boundaries\n\n${marketplace}\n`;
  if (["donation-recognition-terms", "privacy-policy", "account-closure-financial-retention"].includes(slug)) body += `\n\n## Stewardship proof retention\n\n${retention}\n`;
  if (["privacy-policy", "volunteer-contributor-disclaimer", "terms-of-use"].includes(slug)) body += `\n\n## Scoped Work With review\n\n${workWith}\n`;
  if (slug === "job-post-fee-terms") {
    body = body.replace(/## 3\. Clear checkout[\s\S]*?(?=## 5\. Privacy)/, `## 3. Adopted fee, waiver and community access\n\n${job}\n\n`);
    body += `\n\n${refunds}\n`;
  }
  if (slug === "refund-and-cancellation-policy") body = body.replace(/## 4\. One-time voluntary support[\s\S]*?(?=## 6\. Method and timing)/, `${refunds}\n\n`);
  if (["marketplace-commerce-terms", "support-and-billing-terms"].includes(slug)) body += `\n\n${refunds}\n`;
  if (["support-and-billing-terms", "terms-of-use"].includes(slug)) body += "\n\nSupport is voluntary support for free software, community work, shared infrastructure and continued operation. It grants no automatic personal hosted-compute entitlement, membership, governance, trust, status, badges, priority, Marketplace approval, publication, ownership or authority.\n";
  if (["privacy-policy", "community-guidelines"].includes(slug)) body += "\n\n## Private messaging choices\n\nDeclining a conversation request applies a 30-day cooldown in the sender-to-recipient direction. The recipient may initiate contact at any time. A block remains in place until explicitly removed. Sender-facing unavailability uses neutral wording: “Private messaging is unavailable for this profile.” Internal review and safety history is retained without exposing the reason for unavailability. Manage requests and blocks in [Inbox & Private Messages](/commons-circle/signals/inbox) and [Messaging settings](/commons-circle/signals/inbox/settings).\n";
  return body.trimEnd() + "\n";
}

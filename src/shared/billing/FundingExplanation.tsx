import { Link } from "react-router-dom";

export function FundingLink() {
  return <Link className="button-link" to="/support#how-ecosyneva-is-funded">How EcoSyneva is funded</Link>;
}

export default function FundingExplanation() {
  return <section className="section-card" id="how-ecosyneva-is-funded" aria-labelledby="funding-explanation-title">
    <p className="eyebrow">Our funding relationships</p>
    <h2 id="funding-explanation-title">How EcoSyneva Is Funded</h2>
    <p>EcoSyneva Commons LLC develops free, open-source local software and operates shared community resources. Ordinary local Elysia and Codev use and ordinary community participation remain available without financial support.</p>
    <h3>Optional support for our own work</h3>
    <p>Support Elysia is a voluntary payment to EcoSyneva Commons LLC for its existing and continuing software, community and public-interest work. It helps sustain development, maintenance, security, education, moderation, shared infrastructure and company operations. Support may also build emergency savings for continuity; this does not mean a reserve is already funded.</p>
    <p>Support funds that work as a whole, rather than purchasing a particular server invoice, personal execution units, priority or an exclusive deliverable. Supporters and non-supporters share the same community rules and hosted resource policy. Hosted capacity is finite and may be limited when resources are scarce.</p>
    <p>Choose a one-time amount or an explicitly selected monthly amount. Support purchases no membership, badge, trust, governance, ranking, ownership, equity or investment return. It is not presented as a tax-deductible charitable contribution to EcoSyneva.</p>
    <h3>Marketplace purchases are separate</h3>
    <p>We are preparing creator sales alongside voluntary support. A Marketplace purchase will identify the seller, offering, license, price and applicable refund terms before payment. Creators can sell their own work, and EcoSyneva can offer its own work. Any platform fee must be agreed and disclosed before paid sales are enabled; free offerings do not acquire a fee.</p>
    <h3>Support is first-party EcoSyneva revenue</h3>
    <p>Optional Support is paid directly to EcoSyneva Commons LLC as first-party business revenue and is used toward EcoSyneva's own operating costs, including software development, hosting, servers, databases, storage, security, moderation, documentation, backups, and continued operation. It is not an investment and is not money collected for another person or organization.</p>
    <h3>Independent giving stays direct</h3>
    <p>The independent giving directory links to outside nonprofit and stewardship organizations. If a member chooses to donate, the payment is made directly on that organization's own website or official channel. EcoSyneva does not receive, hold, route, refund, process, or take a commission on those funds. This off-site giving is separate from EcoSyneva's first-party Support payments and from optional stewardship recognition.</p>
    <p className="boundary-note">Stripe completed its first-party account review on September 15, 2026. First-party checkout requires separate technical activation; the Support controls above show current availability. Paid third-party Marketplace checkout, seller onboarding and creator payouts remain disabled pending separate platform/Connect qualification. Free software, community participation and the current free hosted allowance remain separate from that preparation.</p>
    <div className="button-row"><Link className="button-link" to="/marketplace">Explore the free catalog</Link><Link className="button-link" to="/commons-circle/setup/stewardship">Independent giving and recognition</Link><Link className="button-link" to="/commons-circle/support-billing">Private Support &amp; Billing</Link></div>
  </section>;
}

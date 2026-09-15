import PublisherLibrary from "../../../shared/addons/PublisherLibrary";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHero from "../../../shared/components/PageHero";
import { useAccountDoorways } from "../../../shared/navigation/useAccountDoorways";
import { useAuth } from "../../../shared/auth/useAuth";
import { supabase } from "../lib/supabase";
import { loadForgeState, type ForgeState } from "../../The-Developer-Forge/developerForgeApi";

type Library = { token: string; forge: ForgeState; warning: string };
const destinations = [
  ["Identity & profile", "Your developer identity and Marketplace profile have separate purposes. Review their recorded status and keep your public information current.", "/developer-forge/profile", "Developer identity", "/marketplace/account#marketplace-profile", "Marketplace profile"],
  ["Drafts & versions", "Prepare your add-ons, manifests, permissions and selected packages in the existing Forge workbench.", "/developer-forge/drafts", "Your drafts", "/developer-forge/drafts/new", "New draft"],
  ["Submissions & feedback", "Read Marketplace review outcomes and follow your submission timeline. Submission does not mean approval or publication.", "/commons-circle/signals/notifications?filter=marketplace", "Review outcomes", "/developer-forge/submissions", "Submission timeline"],
  ["Seller & offering preparation", "Your identity/publisher link, free or commercial intent, terms and proposed offers remain separate from publication and payment approval.", "/marketplace/account#seller-preparation", "Seller preparation", "/legal/marketplace-commerce-terms", "Marketplace policies"],
  ["Licenses & financial records", "Account licenses and any available seller payment, refund/dispute and payable records stay in Marketplace Account. A payment record does not establish completed creator payout.", "/marketplace/account#marketplace-licenses", "Account licenses", "/marketplace/account#seller-records", "Seller records & payout status"],
  ["Publishing guidance", "Check manifest compatibility, licensing, permissions and security before review. Free listings and paid-offer preparation follow separate requirements.", "/developer-forge/docs", "Creator documentation", "/marketplace/trust", "Trust & review policy"]
] as const;

export default function CreatorStudioPage() {
  const access = useAccountDoorways();
  const { userId, accessToken } = useAuth();
  const [library, setLibrary] = useState<Library | null>(null);
  useEffect(() => {
    let current = true;
    if (!userId || !accessToken || !supabase) return;
    void loadForgeState({ allowLocalFallback: false }).then(forge => {
      if (!current || !forge.signedIn || forge.userId !== userId) return;
      // Forge supports browser-local drafts. Studio's cloud ownership view must not adopt those as account records.
      forge = { ...forge, drafts: forge.drafts.filter(draft => draft.owner_user_id === userId), submissions: forge.submissions.filter(item => item.submitted_by === userId) };
      setLibrary({ token: accessToken, forge, warning: forge.warnings.length ? "Some records could not be loaded. Open the original workspace or reload before drawing conclusions about missing work." : "" });
    }).catch(() => { if (current) setLibrary(null); });
    return () => { current = false; };
  }, [access.profile?.id, userId, accessToken]);
  const owned = library?.token === accessToken ? library : null;
  return <div className="page-stack creator-studio-page">
    <PageHero eyebrow="Elysia Marketplace" title="Creator Studio"><p>Your work, identity and Marketplace preparation in one place. Creation remains open; support does not purchase review, trust or authority.</p></PageHero>
    <nav className="button-row" aria-label="Creator Studio back links"><Link className="button-link" to="/developer-forge">Developer Forge</Link><Link className="button-link" to="/developer-forge/drafts/new">Create an add-on</Link><Link className="button-link" to="/marketplace">Marketplace</Link><Link className="button-link" to="/marketplace/account">Marketplace Account</Link><Link className="button-link" to="/commons-circle/signals">Signals</Link></nav>
    <PublisherLibrary />
    {access.loading ? <p role="status">Checking your creator identity…</p> : !access.creator ? <section className="section-card"><h2>{access.signedIn ? "Start with your developer identity" : "Sign in to open your own workspace"}</h2><p>{access.signedIn ? "An account-linked developer profile or governed publisher management relationship opens this workspace. A public developer checkbox, support payment or admin role does not establish that identity." : "Your drafts, feedback and seller records belong to your Website Account. Public Marketplace browsing and the Forge documentation remain available."}</p><div className="button-row"><Link className="button-link button-link--primary" to={access.signedIn ? "/developer-forge/profile" : "/commons-circle"}>{access.signedIn ? "Create developer profile" : "Sign in through Commons Circle"}</Link><Link className="button-link" to="/developer-forge/docs">Read creator documentation</Link></div>{access.warning && <p role="status">{access.warning}</p>}</section> : <>
      <section className="section-card"><div className="section-heading section-heading--inline"><div><p className="eyebrow">Your recorded developer identity</p><h2>{access.profile?.display_name ?? "Publisher manager"}</h2></div><span className="trust-badge">{access.profile?.status ?? "Status unavailable"}</span></div><p>Identity review, publisher ownership, add-on approval and seller readiness are separate. This status does not claim that any offering is published or payable.</p></section>
      <section className="feature-grid feature-grid--three" aria-label="Creator workspaces">{destinations.map(([title, description, primary, primaryLabel, secondary, secondaryLabel]) => <article className="feature-card" key={title}><h2>{title}</h2><p>{description}</p><div className="button-row"><Link className="button-link" to={primary}>{primaryLabel}</Link><Link className="button-link" to={secondary}>{secondaryLabel}</Link></div></article>)}</section>
      <section className="section-card"><h2>Your recent add-ons &amp; review records</h2><p>This account view shows up to 100 personal drafts and submissions. Publisher listings are shown separately above. Browser-local drafts remain in the Forge; they are not treated as cloud-owned records.</p>{!owned ? <p role="status">Account records are loading or unavailable. The original workspaces above remain accessible.</p> : <>{owned.warning && <p role="status">{owned.warning}</p>}<div className="feature-grid feature-grid--three"><div><h3>Drafts &amp; manifests</h3><ul>{owned.forge.drafts.map(draft => <li key={draft.id}><Link to={`/developer-forge/drafts/${encodeURIComponent(draft.id)}`}>{draft.addon_name} · {draft.version}</Link></li>)}</ul>{!owned.forge.drafts.length && <p>No account-owned drafts returned.</p>}</div><div><h3>Submitted for review</h3><ul>{owned.forge.submissions.map(item => <li key={item.id}><Link to="/developer-forge/submissions">Submission timeline · {item.status.replace(/_/g, " ")}</Link></li>)}</ul>{!owned.forge.submissions.length && <p>No account-owned submissions returned.</p>}</div></div></>}</section>
      <section className="section-card"><h2>Seller payments are not active</h2><p>Third-party seller onboarding, paid creator checkout and creator payouts remain disabled. Free drafts, manifests, submissions, review and publication remain available. Earnings and completed payouts are not claimed here. EcoSyneva does not request or store raw bank or card details; financial onboarding belongs with an approved provider.</p><p>The adopted fee for future paid third-party Marketplace sales is 5%; free add-ons have a 0% platform fee. Separate platform/Connect qualification is still required. EcoSyneva can waive only its own portion, never a creator’s money without separately governed creator authorization.</p></section>
    </>}
  </div>;
}

import { useCallback } from "react";
import AuthPanel from "../components/AuthPanel";
import ProfilePanel from "../components/ProfilePanel";
import MarketplaceCommerceAccountPanel from "../components/MarketplaceCommerceAccountPanel";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function AccountPage() {
  const { profile, pushMessage, supabaseConfigured, refreshProfile, refreshReviewQueue } = useMarketplaceContext();

  const refreshAccountSurfaces = useCallback(async () => {
    await refreshProfile();
    await refreshReviewQueue();
  }, [refreshProfile, refreshReviewQueue]);

  return (
    <div className="account-page page-card">
      <section className="section-card account-intro">
        <p className="eyebrow">Marketplace Account</p>
        <h1>Cloud profile here. Local account stays local.</h1>
        <p>
          The marketplace account is for saving add-ons, managing public profile fields,
          developer submissions, and future catalog sync. It is separate from the local Elysia account.
        </p>
        <p className={supabaseConfigured ? "status-strip" : "demo-banner"}>
          {supabaseConfigured
            ? "Supabase is configured. Auth, profile, saved add-ons, and submissions use the remote project when Row Level Security allows them."
            : "Supabase env vars are not configured. Account panels show demo-mode behavior only."}
        </p>
        <div className="details-grid">
          <div><h3>Marketplace account</h3><p>Supabase Auth handles website sign-in, saved add-ons, submissions, and public profile data.</p></div>
          <div><h3>Local Elysia account</h3><p>Stays on the private machine. The website does not ask for it and does not share passwords.</p></div>
          <div><h3>Future linking</h3><p>A short-lived pairing code can later link accounts after explicit local approval.</p></div>
        </div>
      </section>
      <section className="two-column">
        <AuthPanel onMessage={pushMessage} onAuthChanged={refreshAccountSurfaces} />
        <ProfilePanel profile={profile} supabaseConfigured={supabaseConfigured} onMessage={pushMessage} onProfileSaved={refreshAccountSurfaces} />
      </section>
      <MarketplaceCommerceAccountPanel />
    </div>
  );
}

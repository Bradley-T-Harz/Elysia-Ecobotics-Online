import { useCallback, useEffect, useState } from "react";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import ProfilePanel from "../The-Elysia-Marketplace/components/ProfilePanel";
import { loadCurrentProfile, loadAdminReviewQueue } from "../The-Elysia-Marketplace/lib/marketplaceApi";
import { hasSupabaseConfig } from "../The-Elysia-Marketplace/lib/supabase";
import type { MarketplaceProfile } from "../The-Elysia-Marketplace/types";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function CommonsCirclePage() {
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const pushMessage = useCallback((message: string) => { if (message.trim()) setMessages((current) => [message, ...current].slice(0, 4)); }, []);
  const refreshProfile = useCallback(async () => { const result = await loadCurrentProfile(); setProfile(result.data); result.warnings.forEach(pushMessage); }, [pushMessage]);
  const refreshReviewQueue = useCallback(async () => { const result = await loadAdminReviewQueue(); result.warnings.forEach(pushMessage); }, [pushMessage]);
  const refreshAccountSurfaces = useCallback(async () => { await refreshProfile(); await refreshReviewQueue(); }, [refreshProfile, refreshReviewQueue]);
  useEffect(() => { void refreshAccountSurfaces(); }, [refreshAccountSurfaces]);
  return (
    <div className="page-stack">
      <PageHero eyebrow="Membership" title="The Commons Circle"><p>The Commons Circle is the account and membership hub for Elysia Ecobotics Online. Membership is free and community-centered, not pay-to-win.</p><p>It will gather saved add-ons, saved sources, posts, product interests, badges, contribution history, stewardship recognition, developer links, and local Elysia connection status as those features become real.</p></PageHero>
      {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}
      <section className="feature-grid feature-grid--five"><FeatureCard title="Free Member"><p>Basic account, saved items, profile, and public participation.</p></FeatureCard><FeatureCard title="Contributor Member"><p>Recognition for concrete contributions, not special access to basic safety or privacy.</p></FeatureCard><FeatureCard title="Steward Member"><p>Careful support for the commons around Elysia.</p></FeatureCard><FeatureCard title="Guardian / Reviewer"><p>Future trust, security, moderation, and review roles.</p></FeatureCard><FeatureCard title="Founding Steward"><p>Early project recognition without pay-to-win power.</p></FeatureCard></section>
      <section className="two-column"><AuthPanel onMessage={pushMessage} onAuthChanged={refreshAccountSurfaces} /><ProfilePanel profile={profile} supabaseConfigured={hasSupabaseConfig} onMessage={pushMessage} onProfileSaved={refreshAccountSurfaces} /></section>
      <section className="feature-grid feature-grid--three"><FeatureCard title="Saved across the site"><p>Saved add-ons are live through the Marketplace path. Library sources, posts, products, and roles can join later.</p></FeatureCard><FeatureCard title="Stewardship recognition"><p>Future recognition should use redacted proof and direct support to independent stewardship organizations. This page does not implement donations or payments.</p></FeatureCard><FeatureCard title="Connected local Elysia"><p>Future account linking must be explicit. Private memory, files, logs, local passwords, and credentials do not sync by default.</p></FeatureCard></section>
    </div>
  );
}

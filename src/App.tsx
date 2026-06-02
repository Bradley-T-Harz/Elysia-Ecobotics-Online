import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { loadAdminReviewQueue, loadCurrentProfile, loadPublishedAddons, saveAddonForUser } from "./lib/marketplaceApi";
import { getAddonById, getCategories, getTrustTiers, sortAddons } from "./lib/addonCatalog";
import { hasSupabaseConfig } from "./lib/supabase";
import type { AddonManifest, AddonSubmission, CatalogSourceState, MarketplaceProfile } from "./types";

import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import AddonDetailsPage from "./pages/AddonDetailsPage";
import ActionPreviewPage from "./pages/ActionPreviewPage";
import AccountPage from "./pages/AccountPage";
import SubmitPage from "./pages/SubmitPage";
import TrustPage from "./pages/TrustPage";
import ManifestApiPage from "./pages/ManifestApiPage";
import AdminPage from "./pages/AdminPage";

export type MarketplaceContext = {
  addons: AddonManifest[];
  sortedAddons: AddonManifest[];
  categories: string[];
  trustTiers: string[];
  profile: MarketplaceProfile | null;
  reviewQueue: AddonSubmission[];
  demoMode: boolean;
  supabaseConfigured: boolean;
  seedFallbackActive: boolean;
  catalogSourceState: CatalogSourceState | null;
  catalogStatusMessage: string;
  messages: string[];
  pushMessage: (message: string) => void;
  refreshProfile: () => Promise<void>;
  refreshReviewQueue: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  saveAddon: (addonId: string) => Promise<void>;
  getAddon: (addonId: string | undefined) => AddonManifest | null;
};

function MarketplaceLayout() {
  const [addons, setAddons] = useState<AddonManifest[]>([]);
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [reviewQueue, setReviewQueue] = useState<AddonSubmission[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [seedFallbackActive, setSeedFallbackActive] = useState(false);
  const [catalogSourceState, setCatalogSourceState] = useState<CatalogSourceState | null>(null);
  const [catalogStatusMessage, setCatalogStatusMessage] = useState("Loading marketplace catalog...");

  const pushMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    setMessages((current) => [message, ...current.filter((existing) => existing !== message)].slice(0, 4));
  }, []);

  const refreshCatalog = useCallback(async () => {
    const catalog = await loadPublishedAddons();
    setAddons(catalog.data);
    setDemoMode((current) => current || catalog.demoMode);
    setSeedFallbackActive(Boolean(catalog.seedFallbackActive));
    setCatalogSourceState(catalog.sourceState ?? null);
    setCatalogStatusMessage(catalog.statusMessage ?? (catalog.demoMode ? "Seed catalog fallback active." : "Supabase catalog loaded."));
    catalog.warnings.forEach(pushMessage);
  }, [pushMessage]);

  const refreshProfile = useCallback(async () => {
    const currentProfile = await loadCurrentProfile();
    setProfile(currentProfile.data);
    setDemoMode((current) => current || currentProfile.demoMode);
    currentProfile.warnings.forEach(pushMessage);
  }, [pushMessage]);

  const refreshReviewQueue = useCallback(async () => {
    const queue = await loadAdminReviewQueue();
    setReviewQueue(queue.data);
    setDemoMode((current) => current || queue.demoMode);
    queue.warnings.forEach(pushMessage);
  }, [pushMessage]);

  useEffect(() => {
    async function load() {
      await refreshCatalog();
      await refreshProfile();
      await refreshReviewQueue();
    }
    void load();
  }, [refreshCatalog, refreshProfile, refreshReviewQueue]);

  const sortedAddons = useMemo(() => sortAddons(addons), [addons]);
  const categories = useMemo(() => getCategories(sortedAddons), [sortedAddons]);
  const trustTiers = useMemo(() => getTrustTiers(sortedAddons), [sortedAddons]);

  const saveAddon = useCallback(async (addonId: string) => {
    const result = await saveAddonForUser(addonId);
    const addon = getAddonById(sortedAddons, addonId);
    pushMessage(result.warnings.join(" ") || result.statusMessage || `${addon?.name ?? addonId} saved to marketplace profile plan.`);
    await refreshProfile();
  }, [pushMessage, refreshProfile, sortedAddons]);

  const context: MarketplaceContext = {
    addons,
    sortedAddons,
    categories,
    trustTiers,
    profile,
    reviewQueue,
    demoMode,
    supabaseConfigured: hasSupabaseConfig,
    seedFallbackActive,
    catalogSourceState,
    catalogStatusMessage,
    messages,
    pushMessage,
    refreshProfile,
    refreshReviewQueue,
    refreshCatalog,
    saveAddon,
    getAddon: (addonId) => addonId ? getAddonById(sortedAddons, addonId) ?? null : null
  };

  return (
    <div className="app-shell">
      <nav className="top-nav" aria-label="Marketplace pages">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/browse">Browse</NavLink>
        <NavLink to="/action-preview">Action preview</NavLink>
        <NavLink to="/account">Account</NavLink>
        <NavLink to="/submit">Submit</NavLink>
        <NavLink to="/trust">Trust</NavLink>
        <NavLink to="/manifest-api">Manifest API</NavLink>
        <NavLink to="/admin">Admin</NavLink>
      </nav>

      {messages.length > 0 && (
        <section className="message-stack" aria-live="polite">
          {messages.map((message, index) => <div key={`${message}-${index}`} className="message">{message}</div>)}
        </section>
      )}

      <main>
        <Outlet context={context} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MarketplaceLayout />}>
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="addons/:id" element={<AddonDetailsPage />} />
          <Route path="action-preview" element={<ActionPreviewPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="submit" element={<SubmitPage />} />
          <Route path="trust" element={<TrustPage />} />
          <Route path="manifest-api" element={<ManifestApiPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

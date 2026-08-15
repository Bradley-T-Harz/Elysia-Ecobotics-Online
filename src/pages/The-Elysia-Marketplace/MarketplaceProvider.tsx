import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { loadAdminReviewQueue, loadCurrentProfile, loadPublishedAddons, removeSavedAddon, saveAddonForUser } from "./lib/marketplaceApi";
import { getAddonById, getCategories, getTrustTiers, sortAddons } from "./lib/addonCatalog";
import { hasSupabaseConfig } from "./lib/supabase";
import { prepareLocalInstallIntent } from "./lib/installIntentApi";
import type { AddonManifest, AddonSubmission, CatalogSourceState, MarketplaceProfile } from "./types";

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
  removeAddon: (addonId: string) => Promise<void>;
  prepareLocalInstall: (addonId: string) => Promise<void>;
  getAddon: (addonId: string | undefined) => AddonManifest | null;
};

export default function MarketplaceProvider() {
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
    setCatalogStatusMessage(catalog.statusMessage ?? (catalog.demoMode ? "Non-installable candidate fallback active." : "Supabase catalog loaded."));
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
    if (result.data.saved) await refreshProfile();
  }, [pushMessage, refreshProfile, sortedAddons]);

  const removeAddon = useCallback(async (addonId: string) => {
    const result = await removeSavedAddon(addonId);
    const addon = getAddonById(sortedAddons, addonId);
    pushMessage(result.warnings.join(" ") || result.statusMessage || `${addon?.name ?? addonId} removed from saved add-ons.`);
    if (result.data.removed) await refreshProfile();
  }, [pushMessage, refreshProfile, sortedAddons]);

  const prepareLocalInstall = useCallback(async (addonId: string) => {
    const addon = getAddonById(sortedAddons, addonId);
    if (!addon) {
      pushMessage("Choose an approved Marketplace add-on before preparing a local install intent.");
      return;
    }
    const result = await prepareLocalInstallIntent(addon);
    pushMessage(result.statusMessage || result.data.message || result.warnings.join(" "));
  }, [pushMessage, sortedAddons]);

  const context: MarketplaceContext = {
    addons, sortedAddons, categories, trustTiers, profile, reviewQueue, demoMode,
    supabaseConfigured: hasSupabaseConfig, seedFallbackActive, catalogSourceState, catalogStatusMessage,
    messages, pushMessage, refreshProfile, refreshReviewQueue, refreshCatalog, saveAddon, removeAddon, prepareLocalInstall,
    getAddon: (addonId) => addonId ? getAddonById(sortedAddons, addonId) ?? null : null
  };

  return (
    <section className="marketplace-scope">
      {messages.length > 0 && (
        <section className="message-stack" aria-live="polite">
          {messages.map((message, index) => <div key={`${message}-${index}`} className="message">{message}</div>)}
        </section>
      )}
      <Outlet context={context} />
    </section>
  );
}

import { seedAddons } from "../data/seedAddons";
import type {
  AddonCategory,
  AddonManifest,
  AddonSubmission,
  MarketplaceApiResult,
  MarketplaceProfile,
  MarketplaceProfileDraft,
  TrustTier
} from "../types";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "./supabase";

const seedBySlug = new Map(seedAddons.map((addon) => [addon.id, addon]));

const demoProfile: MarketplaceProfile = {
  username: "demo-builder",
  display_name: "Demo Builder",
  bio: "Demo profile shown because Supabase env vars are not configured.",
  interests: "Local-first add-ons, privacy, and governed integrations.",
  website_url: "",
  github_url: "",
  organization: "",
  is_developer: true,
  is_admin: true,
  saved_addon_ids: ["advanced-pdf-parser", "searxng-research"]
};

function demo<T>(data: T, extraWarnings: string[] = []): MarketplaceApiResult<T> {
  return {
    data,
    demoMode: true,
    warnings: [supabaseNotConfiguredMessage, ...extraWarnings],
    sourceState: "supabase_not_configured",
    statusMessage: supabaseNotConfiguredMessage,
    supabaseConfigured: false,
    seedFallbackActive: true
  };
}

function configuredResult<T>(
  data: T,
  options: Omit<MarketplaceApiResult<T>, "data" | "demoMode" | "warnings" | "supabaseConfigured"> & { warnings?: string[] } = {}
): MarketplaceApiResult<T> {
  return {
    data,
    demoMode: false,
    warnings: options.warnings ?? [],
    sourceState: options.sourceState,
    statusMessage: options.statusMessage,
    supabaseConfigured: true,
    seedFallbackActive: options.seedFallbackActive ?? false
  };
}

type AddonRow = {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: AddonCategory | string;
  trust_tier: TrustTier | string;
  latest_version?: string | null;
  homepage_url?: string | null;
  source_url?: string | null;
  license?: string | null;
  local_only?: boolean | null;
  network_access?: boolean | null;
  addon_versions?: { manifest?: AddonManifest; review_status?: string; published_at?: string | null }[] | null;
};

function rowToManifest(row: AddonRow): AddonManifest {
  const approvedVersion = row.addon_versions?.find((version) => version.review_status === "approved" && version.manifest)?.manifest;
  if (approvedVersion) return approvedVersion;

  const seedMatch = seedBySlug.get(row.slug);
  if (seedMatch) {
    return {
      ...seedMatch,
      name: row.name || seedMatch.name,
      summary: row.summary || seedMatch.summary,
      description: row.description || seedMatch.description,
      category: (row.category as AddonCategory) || seedMatch.category,
      trust_tier: (row.trust_tier as TrustTier) || seedMatch.trust_tier,
      version: row.latest_version || seedMatch.version,
      local_only: row.local_only ?? seedMatch.local_only,
      network_access: row.network_access ?? seedMatch.network_access,
      homepage_url: row.homepage_url ?? seedMatch.homepage_url,
      source_url: row.source_url ?? seedMatch.source_url,
      license: row.license ?? seedMatch.license
    };
  }

  const networkAccess = Boolean(row.network_access);
  return {
    schema_version: "1.0",
    id: row.slug,
    name: row.name,
    publisher: "Marketplace Seed",
    version: row.latest_version || "0.1.0",
    category: row.category as AddonCategory,
    summary: row.summary,
    description: row.description,
    trust_tier: row.trust_tier as TrustTier,
    local_only: row.local_only ?? !networkAccess,
    network_access: networkAccess,
    dependencies: [],
    actions: [
      {
        action_key: "review_manifest",
        action_label: "Review manifest before local action",
        action_kind: "manual_instruction",
        allowed: true,
        risk_level: networkAccess ? "moderate" : "low",
        requires_local_operator_password: true,
        network_access: networkAccess,
        notes: [
          "Remote listing did not include a rich approved manifest version.",
          "The marketplace can save or prepare this add-on plan, but local Elysia must perform any future action after password-gated review."
        ]
      }
    ],
    security: {
      operator_only: true,
      model_accessible: false,
      chat_accessible: false,
      memory_promotion_allowed: false,
      outward_sharing_allowed: networkAccess,
      local_file_access: "none",
      outward_sharing_risk: networkAccess ? "Public query or dependency metadata may leave local control if approved in local Elysia later." : undefined
    },
    tags: [String(row.category), String(row.trust_tier)],
    homepage_url: row.homepage_url ?? undefined,
    source_url: row.source_url ?? undefined,
    license: row.license ?? undefined,
    status: "approved"
  };
}

function submissionFromVersion(row: { id: string; manifest?: AddonManifest | null; review_status: AddonSubmission["review_status"]; review_notes?: string | null }): AddonSubmission {
  const manifest = row.manifest ?? null;
  return {
    id: row.id,
    addon_name: manifest?.name ?? "Untitled add-on",
    slug: manifest?.id ?? row.id,
    publisher_name: manifest?.publisher ?? "Unknown publisher",
    category: manifest?.category ?? "Developer Tools",
    summary: manifest?.summary ?? "No summary supplied.",
    review_status: row.review_status,
    manifest,
    notes: row.review_notes ?? ""
  };
}
function safeUsernameFromAuthUser(user: { id: string; email?: string | null }): string {
  const prefix = user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") ?? "";
  const suffix = user.id.replace(/-/g, "").slice(0, 8);
  return prefix ? `${prefix.slice(0, 22)}_${suffix}` : `user_${suffix}`;
}

async function ensureMarketplaceProfileForUser(user: { id: string; email?: string | null }): Promise<{ ok: boolean; warnings: string[] }> {
  if (!supabase) return { ok: false, warnings: [supabaseNotConfiguredMessage] };

  const { data: existingProfile, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) return { ok: false, warnings: [`Marketplace profile check failed: ${existingError.message}`] };
  if (existingProfile) return { ok: true, warnings: [] };

  const username = safeUsernameFromAuthUser(user);
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name: username,
    bio: "",
    interests: null,
    website_url: null,
    github_url: null,
    organization: null,
    is_developer: false,
    is_admin: false
  }, { onConflict: "id" });

  if (error) return { ok: false, warnings: [`Marketplace profile bootstrap failed: ${error.message}`] };
  return { ok: true, warnings: ["Created a minimal Marketplace profile row for this signed-in account before saving/submitting."] };
}


export async function loadPublishedAddons(): Promise<MarketplaceApiResult<AddonManifest[]>> {
  if (!hasSupabaseConfig || !supabase) return demo(seedAddons);

  const { data, error } = await supabase
    .from("addons")
    .select("*, addon_versions(manifest, review_status, published_at)")
    .eq("status", "approved")
    .order("name", { ascending: true });

  if (error) {
    const message = `Supabase is configured, but the approved add-on query failed: ${error.message}. Showing local seed catalog.`;
    return configuredResult(seedAddons, {
      sourceState: "supabase_query_failed",
      statusMessage: message,
      warnings: [message],
      seedFallbackActive: true
    });
  }

  const rows = (data ?? []) as AddonRow[];
  if (!rows.length) {
    const message = "Supabase is connected, but no approved remote add-ons were returned. Showing local seed catalog.";
    return configuredResult(seedAddons, {
      sourceState: "supabase_empty_seed_fallback",
      statusMessage: message,
      warnings: [message],
      seedFallbackActive: true
    });
  }

  return configuredResult(rows.map(rowToManifest), {
    sourceState: "supabase_connected",
    statusMessage: `Supabase is connected and returned ${rows.length} approved add-on${rows.length === 1 ? "" : "s"}.`
  });
}

export async function loadCurrentProfile(): Promise<MarketplaceApiResult<MarketplaceProfile | null>> {
  if (!hasSupabaseConfig || !supabase) return demo(demoProfile);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult(null, { statusMessage: "Supabase is configured. Sign in to load or create a Marketplace profile." });

  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) return configuredResult(null, { warnings: [error.message], statusMessage: `Profile query failed: ${error.message}` });

  const profile = data as (MarketplaceProfile & { saved_addon_ids?: string[] }) | null;
  if (!profile) {
    return configuredResult(null, { statusMessage: "No Marketplace profile exists yet for this signed-in user." });
  }

  const { data: savedRows, error: savedError } = await supabase
    .from("user_saved_addons")
    .select("addon_slug")
    .eq("user_id", auth.user.id);

  return configuredResult({ ...profile, saved_addon_ids: (savedRows ?? []).map((row) => row.addon_slug as string) }, {
    warnings: savedError ? [savedError.message] : [],
    statusMessage: "Marketplace profile loaded."
  });
}

export async function upsertMarketplaceProfile(draft: MarketplaceProfileDraft): Promise<MarketplaceApiResult<MarketplaceProfile | null>> {
  if (!hasSupabaseConfig || !supabase) return demo(demoProfile, ["Demo mode does not save Marketplace profiles remotely."]);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult(null, { warnings: ["Sign in before creating a Marketplace profile."] });

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .maybeSingle();

  const safeDraft = {
    id: auth.user.id,
    username: draft.username.trim(),
    display_name: draft.display_name.trim(),
    bio: draft.bio.trim(),
    interests: draft.interests?.trim() || null,
    website_url: draft.website_url?.trim() || null,
    github_url: draft.github_url?.trim() || null,
    is_developer: draft.is_developer,
    is_admin: Boolean((existingProfile as { is_admin?: boolean } | null)?.is_admin)
  };

  if (!safeDraft.username) return configuredResult(null, { warnings: ["Username is required."] });

  const { data, error } = await supabase
    .from("profiles")
    .upsert(safeDraft, { onConflict: "id" })
    .select("*")
    .single();

  if (error) return configuredResult(null, { warnings: [error.message] });
  const profile = data as MarketplaceProfile;
  return configuredResult({ ...profile, saved_addon_ids: profile.saved_addon_ids ?? [] }, { statusMessage: "Marketplace profile saved." });
}

export async function saveAddonForUser(addonId: string): Promise<MarketplaceApiResult<{ saved: boolean; addonId: string }>> {
  if (!hasSupabaseConfig || !supabase) return demo({ saved: true, addonId }, ["Saved only in this demo session; no remote Marketplace account write occurred."]);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult({ saved: false, addonId }, { warnings: ["Sign in to save add-ons to your Marketplace account."] });

  const profileReady = await ensureMarketplaceProfileForUser(auth.user);
  if (!profileReady.ok) return configuredResult({ saved: false, addonId }, { warnings: profileReady.warnings });

  const { error } = await supabase.from("user_saved_addons").upsert({ user_id: auth.user.id, addon_slug: addonId });
  return configuredResult({ saved: !error, addonId }, {
    warnings: error ? [error.message] : profileReady.warnings,
    statusMessage: error ? undefined : "Add-on saved to your Marketplace account. No local Elysia installation occurred."
  });
}

export async function removeSavedAddon(addonId: string): Promise<MarketplaceApiResult<{ removed: boolean; addonId: string }>> {
  if (!hasSupabaseConfig || !supabase) return demo({ removed: true, addonId }, ["Removed only from demo state."]);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult({ removed: false, addonId }, { warnings: ["Sign in first."] });
  const { error } = await supabase.from("user_saved_addons").delete().eq("user_id", auth.user.id).eq("addon_slug", addonId);
  return configuredResult({ removed: !error, addonId }, { warnings: error ? [error.message] : [], statusMessage: error ? undefined : "Saved add-on removed." });
}

export async function submitAddonDraft(payload: unknown): Promise<MarketplaceApiResult<{ submitted: boolean }>> {
  if (!hasSupabaseConfig || !supabase) return demo({ submitted: false }, ["Demo mode validates locally but does not save drafts."]);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult({ submitted: false }, { warnings: ["Sign in before submitting an add-on for review."] });

  const profileReady = await ensureMarketplaceProfileForUser(auth.user);
  if (!profileReady.ok) return configuredResult({ submitted: false }, { warnings: profileReady.warnings });

  const submission = payload as { manifest?: AddonManifest; version?: string };
  const version = submission.version ?? submission.manifest?.version ?? "0.1.0";
  const { error } = await supabase.from("addon_versions").insert({
    manifest: submission.manifest ?? payload,
    version,
    review_status: "submitted",
    created_by: auth.user.id
  });
  return configuredResult({ submitted: !error }, {
    warnings: error ? [error.message] : profileReady.warnings,
    statusMessage: error ? undefined : "Add-on draft submitted for Marketplace review. It is not approved or installable yet."
  });
}

export async function loadUserSubmissions(): Promise<MarketplaceApiResult<AddonSubmission[]>> {
  if (!hasSupabaseConfig || !supabase) {
    return demo([
      {
        id: "demo-submission",
        addon_name: "Demo Add-on Draft",
        slug: "demo-addon-draft",
        publisher_name: "Demo Publisher",
        category: "Developer Tools",
        summary: "Demo review queue item.",
        review_status: "submitted",
        manifest: seedAddons[0],
        notes: "Visible in demo mode only."
      }
    ]);
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return configuredResult([], { statusMessage: "Sign in to view your Marketplace submissions." });

  const { data, error } = await supabase
    .from("addon_versions")
    .select("id, manifest, review_status, review_notes")
    .eq("created_by", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return configuredResult([], { warnings: [error.message] });
  return configuredResult(((data ?? []) as { id: string; manifest?: AddonManifest | null; review_status: AddonSubmission["review_status"]; review_notes?: string | null }[]).map(submissionFromVersion));
}

export async function loadAdminReviewQueue(): Promise<MarketplaceApiResult<AddonSubmission[]>> {
  if (!hasSupabaseConfig || !supabase) return loadUserSubmissions();

  const profileResult = await loadCurrentProfile();
  if (!profileResult.data?.is_admin) {
    return configuredResult([], { statusMessage: "Admin review queue requires a Marketplace admin profile. Demo mode does not grant admin authority." });
  }

  const { data, error } = await supabase
    .from("addon_versions")
    .select("id, manifest, review_status, review_notes")
    .in("review_status", ["submitted", "needs_changes", "security_hold"])
    .order("created_at", { ascending: true });

  if (error) return configuredResult([], { warnings: [error.message], statusMessage: `Admin review query failed: ${error.message}` });
  return configuredResult(((data ?? []) as { id: string; manifest?: AddonManifest | null; review_status: AddonSubmission["review_status"]; review_notes?: string | null }[]).map(submissionFromVersion), {
    statusMessage: `Admin review queue loaded ${data?.length ?? 0} item${(data?.length ?? 0) === 1 ? "" : "s"}.`
  });
}

export async function approveSubmission(versionId: string, notes: string): Promise<MarketplaceApiResult<{ approved: boolean; versionId: string; notes: string }>> {
  return configuredResult({ approved: false, versionId, notes }, { warnings: ["Admin approval writes remain a reviewed Supabase admin action; no local installation or local Elysia authority is involved."] });
}

export async function rejectSubmission(versionId: string, notes: string): Promise<MarketplaceApiResult<{ rejected: boolean; versionId: string; notes: string }>> {
  return configuredResult({ rejected: false, versionId, notes }, { warnings: ["Admin rejection writes remain a reviewed Supabase admin action; no local installation or local Elysia authority is involved."] });
}

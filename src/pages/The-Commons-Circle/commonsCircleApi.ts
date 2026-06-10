import { livingLibrarySources } from "../The-Living-Library/livingLibrarySources";
import type { LivingLibrarySource } from "../The-Living-Library/livingLibrarySources";
import type { MarketplaceProfile } from "../The-Elysia-Marketplace/types";
import { loadCurrentProfile } from "../The-Elysia-Marketplace/lib/marketplaceApi";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";

export type ProfileWithSetup = MarketplaceProfile & {
  commons_onboarding_completed_at?: string | null;
  stewardship_onboarding_skipped_at?: string | null;
  work_with_onboarding_skipped_at?: string | null;
  avatar_url?: string | null;
};

export type VisibilitySettings = {
  show_display_name: boolean;
  show_bio: boolean;
  show_interests: boolean;
  show_website: boolean;
  show_github: boolean;
  show_badges: boolean;
  show_stewardship_recognition: boolean;
  show_saved_addons: boolean;
  show_saved_sources: boolean;
  show_source_collections: boolean;
  show_commune_posts: boolean;
  show_work_with_status: boolean;
  show_developer_status: boolean;
  show_member_tier: boolean;
};

export type ProfileCustomization = {
  theme_mode: string;
  accent_color: string;
  background_style: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  decal_set: string;
  selected_decals: string[];
  profile_layout: string;
};

export type NotificationPreferences = {
  commune_replies: boolean;
  followed_threads: boolean;
  marketplace_updates: boolean;
  living_library_updates: boolean;
  review_status_updates: boolean;
  admin_queue_alerts: boolean;
};

export type SavedAddonPreview = { addon_slug: string; addon_name?: string | null; addon_version_id?: string | null; saved_at?: string | null; notes?: string | null };
export type SavedLivingSourcePreview = { id?: string; source_id: string; source_name: string; source_url?: string | null; category?: string | null; saved_at?: string | null; notes?: string | null };
export type SavedCitationPreview = { id?: string; source_id: string; citation_text: string; citation_format?: string | null; saved_at?: string | null };
export type SourceCollectionPreview = { id?: string; title: string; description?: string | null; visibility: string; source_count: number; created_at?: string | null; source_ids?: string[] };
export type CommuneShelfPreview = { id: string; title: string; status: string; type: string; updated_at?: string; source: "local" | "account"; target_id?: string | null };
export type FollowedThreadPreview = { id: string; title: string; unread_count?: number; muted?: boolean; source: "local" | "account" };
export type NotificationPreview = { id: string; title: string; body?: string | null; action_url?: string | null; read_at?: string | null; created_at?: string | null; notification_type?: string | null };
export type BadgeDefinition = { badge_key: string; name: string; description: string; badge_type: string; category?: string | null; rarity: string; is_active?: boolean };
export type UserBadge = BadgeDefinition & { awarded_at?: string | null; award_reason?: string | null; visibility?: string | null; earned: boolean };

export type LocalLivingSnapshot = {
  savedSourceIds: string[];
  savedSources: LivingLibrarySource[];
  savedCitationIds: string[];
  savedCitations: SavedCitationPreview[];
  collections: SourceCollectionPreview[];
  rawCollections: LocalCollection[];
};

export type CommonsHomebaseData = {
  profile: ProfileWithSetup | null;
  userId: string | null;
  warnings: string[];
  signedIn: boolean;
  supabaseConfigured: boolean;
  visibility: VisibilitySettings;
  customization: ProfileCustomization;
  notificationPreferences: NotificationPreferences;
  savedAddons: SavedAddonPreview[];
  savedLivingSources: SavedLivingSourcePreview[];
  savedCitations: SavedCitationPreview[];
  sourceCollections: SourceCollectionPreview[];
  communePosts: CommuneShelfPreview[];
  followedThreads: FollowedThreadPreview[];
  notifications: NotificationPreview[];
  badgeDefinitions: BadgeDefinition[];
  userBadges: UserBadge[];
  localLiving: LocalLivingSnapshot;
  localCommuneDrafts: CommuneShelfPreview[];
  localFollowedThreads: FollowedThreadPreview[];
};

export type PublicCommonsProfile = {
  profile: ProfileWithSetup;
  visibility: VisibilitySettings;
  customization: ProfileCustomization;
  badges: UserBadge[];
  publicCollections: SourceCollectionPreview[];
  publicSavedSources: SavedLivingSourcePreview[];
  isOwner: boolean;
};

type LocalCollection = { name?: string; title?: string; description?: string; sourceIds?: string[]; visibility?: string };
type LocalCommuneDraft = { id?: string; title?: string; status?: string; postType?: string; createdAt?: string; updatedAt?: string };
type LocalThread = { id?: string; title?: string; threadId?: string; muted?: boolean };

export const commonsStorageKeys = {
  onboarding: "commonsCircle.onboarding.v1",
  stewardshipDrafts: "commonsCircle.stewardshipVerificationDrafts.v1",
  privacySettings: "commonsCircle.privacySettings.v1",
  membershipLocalState: "commonsCircle.membershipLocalState.v1",
  contributionRequests: "commonsCircle.contributionInterestRequests.v1",
  syncChoice: "commonsCircle.livingLibrarySyncChoice.v1"
} as const;

export const defaultVisibility: VisibilitySettings = {
  show_display_name: true,
  show_bio: true,
  show_interests: true,
  show_website: true,
  show_github: true,
  show_badges: true,
  show_stewardship_recognition: true,
  show_saved_addons: false,
  show_saved_sources: false,
  show_source_collections: true,
  show_commune_posts: true,
  show_work_with_status: false,
  show_developer_status: true,
  show_member_tier: true
};

export const defaultCustomization: ProfileCustomization = {
  theme_mode: "starlit_archive",
  accent_color: "#8ee8dc",
  background_style: "soft_cyber_garden",
  avatar_url: null,
  banner_url: null,
  decal_set: "none",
  selected_decals: [],
  profile_layout: "classic_homebase"
};

export const defaultNotificationPreferences: NotificationPreferences = {
  commune_replies: true,
  followed_threads: true,
  marketplace_updates: true,
  living_library_updates: true,
  review_status_updates: true,
  admin_queue_alerts: true
};

export const plannedBadges: BadgeDefinition[] = [
  { badge_key: "free_member", name: "Free Member", description: "Default recognition for joining the public website commons.", badge_type: "member", category: "membership", rarity: "common" },
  { badge_key: "stewardship_supporter", name: "Stewardship Supporter", description: "Recognition for reviewed public-benefit stewardship support.", badge_type: "stewardship", category: "stewardship", rarity: "uncommon" },
  { badge_key: "water_steward", name: "Water Steward", description: "Recognition connected to water access, watersheds, wetlands, or aquatic care.", badge_type: "stewardship", category: "water", rarity: "uncommon" },
  { badge_key: "forest_steward", name: "Forest Steward", description: "Recognition connected to forests, restoration, and habitat care.", badge_type: "stewardship", category: "forest", rarity: "uncommon" },
  { badge_key: "reef_steward", name: "Reef Steward", description: "Recognition connected to reef and ocean stewardship.", badge_type: "stewardship", category: "reef", rarity: "uncommon" },
  { badge_key: "health_steward", name: "Health Steward", description: "Recognition connected to health, dignity, and public-benefit support.", badge_type: "stewardship", category: "health", rarity: "uncommon" },
  { badge_key: "knowledge_commons_supporter", name: "Knowledge Commons Supporter", description: "Recognition for supporting public knowledge and open learning.", badge_type: "stewardship", category: "knowledge", rarity: "uncommon" },
  { badge_key: "source_curator", name: "Source Curator", description: "Recognition for useful Living Library source suggestions and care.", badge_type: "contributor", category: "living_library", rarity: "rare" },
  { badge_key: "troubleshooting_helper", name: "Troubleshooting Helper", description: "Recognition for helping others resolve issues safely.", badge_type: "contributor", category: "commune", rarity: "rare" },
  { badge_key: "developer_contributor", name: "Developer Contributor", description: "Recognition for add-on, tooling, or developer ecosystem contributions.", badge_type: "developer", category: "developer", rarity: "rare" },
  { badge_key: "founding_steward", name: "Founding Steward", description: "Early project recognition manually assigned by an administrator.", badge_type: "founding", category: "membership", rarity: "founding" },
  { badge_key: "guardian_reviewer", name: "Guardian / Reviewer", description: "Recognition associated with trust and review work. Authority still requires roles assigned by administrators.", badge_type: "review", category: "authority-linked", rarity: "epic" }
];

export function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function citationFor(source: LivingLibrarySource) {
  return `${source.name}. ${source.officialUrl}. Last checked ${source.lastChecked}.`;
}

function localLivingSnapshot(): LocalLivingSnapshot {
  const savedSourceIds = readLocalStorage<string[]>("elysiaLivingLibrary.savedSources.v1", []);
  const savedCitationIds = readLocalStorage<string[]>("elysiaLivingLibrary.savedCitations.v1", []);
  const rawCollections = readLocalStorage<LocalCollection[]>("elysiaLivingLibrary.collections.v1", []);
  const savedSources = livingLibrarySources.filter((source) => savedSourceIds.includes(source.id));
  return {
    savedSourceIds,
    savedSources,
    savedCitationIds,
    savedCitations: livingLibrarySources.filter((source) => savedCitationIds.includes(source.id)).map((source) => ({ source_id: source.id, citation_text: citationFor(source), citation_format: "plain" })),
    rawCollections,
    collections: rawCollections.map((collection, index) => ({
      id: `local-${index}`,
      title: collection.title || collection.name || "Research shelf",
      description: collection.description || null,
      visibility: collection.visibility || "local_private",
      source_count: collection.sourceIds?.length ?? 0,
      source_ids: collection.sourceIds ?? []
    }))
  };
}

function localCommuneDrafts(): CommuneShelfPreview[] {
  const postDrafts = readLocalStorage<LocalCommuneDraft[]>("commune.postDrafts.v1", []);
  const postRequests = readLocalStorage<LocalCommuneDraft[]>("commune.postRequests.v1", []);
  return [...postDrafts, ...postRequests].slice(0, 8).map((draft, index) => ({
    id: draft.id || `local-post-${index}`,
    title: draft.title || "Untitled Commune draft",
    status: draft.status || "draft_local",
    type: draft.postType || "Commune post",
    updated_at: draft.updatedAt || draft.createdAt,
    source: "local"
  }));
}

function localFollowedThreads(): FollowedThreadPreview[] {
  return readLocalStorage<LocalThread[]>("commune.followedThreads.v1", []).slice(0, 8).map((thread, index) => ({
    id: thread.threadId || thread.id || `local-thread-${index}`,
    title: thread.title || "Followed thread draft",
    unread_count: 0,
    muted: Boolean(thread.muted),
    source: "local"
  }));
}

const missingTablePattern = /Could not find the table 'public\.([^']+)' in the schema cache|relation "public\.([^"]+)" does not exist/i;
const tableReadinessLabels: Record<string, string> = {
  "Badge definitions": "Account-backed badges are not configured yet.",
  "User badges": "Account-backed badge awards are not configured yet.",
  "Followed Commune threads": "No followed Commune threads yet.",
  "Notifications": "No notifications yet.",
  "Saved Commune posts": "No saved Commune posts yet.",
  "Source collections": "No source collections yet.",
  "Source collection items": "Source collection details are not configured yet.",
  "Saved Living Library sources": "No account-backed Living Library saves yet.",
  "Saved citations": "No account-backed saved citations yet.",
  "Saved add-ons": "No account-backed Marketplace saves yet."
};

function logBackendDetail(label: string, message: string) {
  if (import.meta.env.DEV) console.warn(`[Commons Circle] ${label}: ${message}`);
}

function friendlyBackendMessage(label: string, message: string) {
  logBackendDetail(label, message);
  if (missingTablePattern.test(message)) return tableReadinessLabels[label] ?? `${label} are not configured yet.`;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) return `${label}: Account storage is not available for this section yet.`;
  return `${label}: Account-backed data is temporarily unavailable.`;
}

async function safeQuery<T>(warnings: string[], label: string, query: PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await query;
    if (error) {
      warnings.push(friendlyBackendMessage(label, error.message));
      return fallback;
    }
    return (data ?? fallback) as T;
  } catch (error) {
    warnings.push(friendlyBackendMessage(label, error instanceof Error ? error.message : String(error)));
    return fallback;
  }
}

function mergeBadges(definitions: BadgeDefinition[], awarded: Array<{ badge_key: string; awarded_at?: string | null; award_reason?: string | null; visibility?: string | null }>): UserBadge[] {
  const allDefinitions = definitions.length ? definitions : plannedBadges;
  const awardedByKey = new Map(awarded.map((badge) => [badge.badge_key, badge]));
  return allDefinitions.map((definition) => {
    const award = awardedByKey.get(definition.badge_key);
    return { ...definition, earned: Boolean(award), awarded_at: award?.awarded_at, award_reason: award?.award_reason, visibility: award?.visibility ?? "public" };
  });
}

export async function loadCommonsHomebase(): Promise<CommonsHomebaseData> {
  const warnings: string[] = [];
  const profileResult = await loadCurrentProfile();
  warnings.push(...profileResult.warnings.map((warning) => missingTablePattern.test(warning) || /permission denied|row-level security/i.test(warning) ? friendlyBackendMessage("Commons Profile", warning) : warning));
  const profile = profileResult.data as ProfileWithSetup | null;
  const localLiving = localLivingSnapshot();
  const localCommune = localCommuneDrafts();
  const localThreads = localFollowedThreads();

  if (!hasSupabaseConfig || !supabase) {
    warnings.push(supabaseNotConfiguredMessage);
    return {
      profile,
      userId: profile?.id ?? null,
      warnings,
      signedIn: Boolean(profile),
      supabaseConfigured: false,
      visibility: readLocalStorage("commonsCircle.publicVisibilityDemo.v1", defaultVisibility),
      customization: readLocalStorage("commonsCircle.customizationDemo.v1", defaultCustomization),
      notificationPreferences: defaultNotificationPreferences,
      savedAddons: (profile?.saved_addon_ids ?? []).map((addon_slug) => ({ addon_slug, addon_name: addon_slug })),
      savedLivingSources: [],
      savedCitations: [],
      sourceCollections: [],
      communePosts: [],
      followedThreads: [],
      notifications: [],
      badgeDefinitions: plannedBadges,
      userBadges: mergeBadges(plannedBadges, [{ badge_key: "free_member", awarded_at: new Date().toISOString(), visibility: "public" }]),
      localLiving,
      localCommuneDrafts: localCommune,
      localFollowedThreads: localThreads
    };
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) {
    return {
      profile: null,
      userId: null,
      warnings,
      signedIn: false,
      supabaseConfigured: true,
      visibility: defaultVisibility,
      customization: defaultCustomization,
      notificationPreferences: defaultNotificationPreferences,
      savedAddons: [],
      savedLivingSources: [],
      savedCitations: [],
      sourceCollections: [],
      communePosts: [],
      followedThreads: [],
      notifications: [],
      badgeDefinitions: plannedBadges,
      userBadges: mergeBadges(plannedBadges, []),
      localLiving,
      localCommuneDrafts: localCommune,
      localFollowedThreads: localThreads
    };
  }

  const [visibilityRows, customizationRows, mediaRows, prefRows, savedAddons, savedSources, savedCitations, collectionRows, collectionItems, savedCommuneRows, followedRows, notificationRows, definitions, awarded] = await Promise.all([
    safeQuery<VisibilitySettings[]>(warnings, "Visibility settings", supabase.from("profile_visibility_settings").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<ProfileCustomization[]>(warnings, "Profile customization", supabase.from("profile_customization").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<Array<{ media_type: string; public_url?: string | null }>>(warnings, "Profile media", supabase.from("profile_media").select("media_type, public_url").eq("user_id", userId).eq("status", "active"), []),
    safeQuery<NotificationPreferences[]>(warnings, "Notification preferences", supabase.from("notification_preferences").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<SavedAddonPreview[]>(warnings, "Saved add-ons", supabase.from("user_saved_addons").select("addon_slug, addon_name, addon_version_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedLivingSourcePreview[]>(warnings, "Saved Living Library sources", supabase.from("user_saved_living_sources").select("id, source_id, source_name, source_url, category, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedCitationPreview[]>(warnings, "Saved citations", supabase.from("user_saved_citations").select("id, source_id, citation_text, citation_format, saved_at").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; title: string; description?: string | null; visibility: string; created_at?: string | null }>>(warnings, "Source collections", supabase.from("user_source_collections").select("id, title, description, visibility, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ collection_id: string; source_id: string }>>(warnings, "Source collection items", supabase.from("user_source_collection_items").select("collection_id, source_id"), []),
    safeQuery<Array<{ id: string; post_id?: string | null; draft_id?: string | null; saved_at?: string | null; notes?: string | null }>>(warnings, "Saved Commune posts", supabase.from("user_saved_commune_posts").select("id, post_id, draft_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; thread_id: string; followed_at?: string | null; last_read_at?: string | null; muted?: boolean | null }>>(warnings, "Followed Commune threads", supabase.from("user_followed_commune_threads").select("id, thread_id, followed_at, last_read_at, muted").eq("user_id", userId).order("followed_at", { ascending: false }).limit(200), []),
    safeQuery<NotificationPreview[]>(warnings, "Notifications", supabase.from("user_notifications").select("id, title, body, action_url, read_at, created_at, notification_type").eq("user_id", userId).order("created_at", { ascending: false }).limit(12), []),
    safeQuery<BadgeDefinition[]>(warnings, "Badge definitions", supabase.from("badge_definitions").select("badge_key, name, description, badge_type, category, rarity, is_active").eq("is_active", true).order("name"), plannedBadges),
    safeQuery<Array<{ badge_key: string; awarded_at?: string | null; award_reason?: string | null; visibility?: string | null }>>(warnings, "User badges", supabase.from("user_badges").select("badge_key, awarded_at, award_reason, visibility").eq("user_id", userId), [])
  ]);

  const avatarUrl = mediaRows.find((row) => row.media_type === "avatar")?.public_url;
  const bannerUrl = mediaRows.find((row) => row.media_type === "banner")?.public_url;
  const customization = { ...defaultCustomization, ...(customizationRows[0] ?? {}), avatar_url: avatarUrl ?? (profile?.avatar_url || null), banner_url: bannerUrl ?? customizationRows[0]?.banner_url ?? null };
  const collectionSourceIds = collectionItems.reduce<Record<string, string[]>>((collections, item) => ({
    ...collections,
    [item.collection_id]: [...(collections[item.collection_id] ?? []), item.source_id]
  }), {});
  const sourceCollections = collectionRows.map((collection) => ({
    ...collection,
    source_count: collectionSourceIds[collection.id]?.length ?? 0,
    source_ids: collectionSourceIds[collection.id] ?? []
  }));

  return {
    profile,
    userId,
    warnings,
    signedIn: true,
    supabaseConfigured: true,
    visibility: { ...defaultVisibility, ...(visibilityRows[0] ?? {}) },
    customization,
    notificationPreferences: { ...defaultNotificationPreferences, ...(prefRows[0] ?? {}) },
    savedAddons,
    savedLivingSources: savedSources,
    savedCitations,
    sourceCollections,
    communePosts: savedCommuneRows.map((row) => ({ id: row.id, target_id: row.post_id || row.draft_id || null, title: row.notes || row.post_id || row.draft_id || "Saved Commune item", status: "saved", type: row.post_id ? "post" : "draft", updated_at: row.saved_at ?? undefined, source: "account" })),
    followedThreads: followedRows.map((row) => ({ id: row.thread_id, title: `Thread ${row.thread_id.slice(0, 8)}`, unread_count: 0, muted: Boolean(row.muted), source: "account" })),
    notifications: notificationRows,
    badgeDefinitions: definitions.length ? definitions : plannedBadges,
    userBadges: mergeBadges(definitions.length ? definitions : plannedBadges, awarded.length ? awarded : [{ badge_key: "free_member", awarded_at: profile?.commons_onboarding_completed_at ?? new Date().toISOString(), visibility: "public" }]),
    localLiving,
    localCommuneDrafts: localCommune,
    localFollowedThreads: localThreads
  };
}

export async function saveVisibilitySettings(settings: VisibilitySettings): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before saving account-backed visibility settings."];
  const { error } = await supabase.from("profile_visibility_settings").upsert({ user_id: auth.user.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? [friendlyBackendMessage("Visibility settings", error.message)] : [];
}

export async function saveNotificationPreferences(settings: NotificationPreferences): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before saving notification preferences."];
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: auth.user.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? [friendlyBackendMessage("Notification preferences", error.message)] : [];
}

export async function saveCustomization(settings: ProfileCustomization): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before saving profile customization."];
  const payload = {
    user_id: auth.user.id,
    theme_mode: settings.theme_mode,
    accent_color: settings.accent_color,
    background_style: settings.background_style,
    decal_set: settings.decal_set,
    selected_decals: settings.selected_decals,
    profile_layout: settings.profile_layout,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("profile_customization").upsert(payload, { onConflict: "user_id" });
  return error ? [friendlyBackendMessage("Profile customization", error.message)] : [];
}

export async function uploadProfileMedia(file: File, mediaType: "avatar" | "banner"): Promise<{ publicUrl?: string; warnings: string[] }> {
  if (!supabase) return { warnings: [supabaseNotConfiguredMessage] };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { warnings: ["Sign in before uploading profile media."] };
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) return { warnings: ["Avatar and banner uploads must be PNG, JPG, JPEG, or WebP."] };
  if (file.size > 5 * 1024 * 1024) return { warnings: ["Avatar and banner uploads must be 5 MB or smaller."] };
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const bucket = mediaType === "avatar" ? "profile-avatars" : "profile-banners";
  const storagePath = `${auth.user.id}/${mediaType}-${Date.now()}.${ext}`;
  const upload = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: true, contentType: file.type });
  if (upload.error) return { warnings: [friendlyBackendMessage("Profile media", upload.error.message)] };
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  const { error } = await supabase.from("profile_media").insert({ user_id: auth.user.id, media_type: mediaType, bucket, storage_path: storagePath, public_url: publicUrl, status: "active" });
  return { publicUrl, warnings: error ? [friendlyBackendMessage("Profile media", error.message)] : [] };
}

export async function syncLocalLivingLibraryToAccount(): Promise<{ synced: number; warnings: string[] }> {
  const snapshot = localLivingSnapshot();
  const warnings: string[] = [];
  if (!supabase) return { synced: 0, warnings: [supabaseNotConfiguredMessage] };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { synced: 0, warnings: ["Sign in before syncing browser-local Living Library saves to your Website Account."] };
  let synced = 0;
  if (snapshot.savedSources.length) {
    const rows = snapshot.savedSources.map((source) => ({ user_id: auth.user!.id, source_id: source.id, source_name: source.name, source_url: source.officialUrl, category: source.category }));
    const { error } = await supabase.from("user_saved_living_sources").upsert(rows, { onConflict: "user_id,source_id" });
    if (error) warnings.push(friendlyBackendMessage("Saved Living Library sources", error.message)); else synced += rows.length;
  }
  if (snapshot.savedCitations.length) {
    const rows = snapshot.savedCitations.map((citation) => ({ user_id: auth.user!.id, ...citation }));
    const { error } = await supabase.from("user_saved_citations").insert(rows);
    if (error) warnings.push(friendlyBackendMessage("Saved citations", error.message)); else synced += rows.length;
  }
  for (const collection of snapshot.rawCollections) {
    const title = collection.title || collection.name || "Research shelf";
    const { data, error } = await supabase.from("user_source_collections").insert({ user_id: auth.user.id, title, description: collection.description || null, visibility: "private" }).select("id").single();
    if (error || !data) { warnings.push(error ? friendlyBackendMessage("Source collections", error.message) : "Source collections: Account-backed data is temporarily unavailable."); continue; }
    const ids = collection.sourceIds ?? [];
    if (ids.length) {
      const { error: itemError } = await supabase.from("user_source_collection_items").insert(ids.map((source_id) => ({ collection_id: data.id, source_id })));
      if (itemError) warnings.push(friendlyBackendMessage("Source collection items", itemError.message)); else synced += ids.length;
    }
    synced += 1;
  }
  writeLocalStorage(commonsStorageKeys.syncChoice, { choice: warnings.length ? "sync_partial" : "synced", syncedAt: new Date().toISOString() });
  return { synced, warnings };
}

export async function markNotificationRead(id: string): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before updating notifications."];
  const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", auth.user.id);
  return error ? [friendlyBackendMessage("Notifications", error.message)] : [];
}

export async function markAllNotificationsRead(): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before updating notifications."];
  const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.user.id).is("read_at", null);
  return error ? [friendlyBackendMessage("Notifications", error.message)] : [];
}

export async function updateBadgeVisibility(badgeKey: string, visibility: "public" | "private" | "hidden"): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before updating badge visibility."];
  const { error } = await supabase.from("user_badges").update({ visibility }).eq("user_id", auth.user.id).eq("badge_key", badgeKey);
  return error ? [friendlyBackendMessage("User badges", error.message)] : [];
}

async function currentUserIdForShelfAction(actionLabel: string): Promise<{ userId?: string; warnings: string[] }> {
  if (!supabase) return { warnings: [supabaseNotConfiguredMessage] };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { warnings: [`Sign in before ${actionLabel}.`] };
  return { userId: auth.user.id, warnings: [] };
}

export async function removeSavedAddon(addonSlug: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("removing saved add-ons");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_saved_addons").delete().eq("user_id", auth.userId).eq("addon_slug", addonSlug);
  return error ? [friendlyBackendMessage("Saved add-ons", error.message)] : ["Removed add-on from Saved Shelves."];
}

export async function removeSavedLivingSource(sourceId: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("removing saved Living Library sources");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_saved_living_sources").delete().eq("user_id", auth.userId).eq("source_id", sourceId);
  return error ? [friendlyBackendMessage("Saved Living Library sources", error.message)] : ["Removed source from Saved Shelves."];
}

export async function saveCitationToAccount(sourceId: string, citationText: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("saving citations");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_saved_citations").insert({ user_id: auth.userId, source_id: sourceId, citation_text: citationText, citation_format: "plain" });
  return error ? [friendlyBackendMessage("Saved citations", error.message)] : ["Citation saved to Saved Shelves."];
}

export async function removeSavedCitation(id: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("removing saved citations");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_saved_citations").delete().eq("user_id", auth.userId).eq("id", id);
  return error ? [friendlyBackendMessage("Saved citations", error.message)] : ["Removed citation from Saved Shelves."];
}

export async function removeSourceCollection(id: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("removing source collections");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_source_collections").delete().eq("user_id", auth.userId).eq("id", id);
  return error ? [friendlyBackendMessage("Source collections", error.message)] : ["Removed source collection."];
}

export async function updateSourceCollectionVisibility(id: string, visibility: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("updating source collection visibility");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_source_collections").update({ visibility, updated_at: new Date().toISOString() }).eq("user_id", auth.userId).eq("id", id);
  return error ? [friendlyBackendMessage("Source collections", error.message)] : ["Updated collection visibility."];
}

export async function removeSavedCommunePost(id: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("removing saved Commune posts");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_saved_commune_posts").delete().eq("user_id", auth.userId).eq("id", id);
  return error ? [friendlyBackendMessage("Saved Commune posts", error.message)] : ["Removed Commune item from Saved Shelves."];
}

export async function markFollowedThreadRead(threadId: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("marking followed threads read");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_followed_commune_threads").update({ last_read_at: new Date().toISOString() }).eq("user_id", auth.userId).eq("thread_id", threadId);
  return error ? [friendlyBackendMessage("Followed Commune threads", error.message)] : ["Marked followed thread read."];
}

export async function setFollowedThreadMuted(threadId: string, muted: boolean): Promise<string[]> {
  const auth = await currentUserIdForShelfAction(muted ? "muting followed threads" : "unmuting followed threads");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_followed_commune_threads").update({ muted }).eq("user_id", auth.userId).eq("thread_id", threadId);
  return error ? [friendlyBackendMessage("Followed Commune threads", error.message)] : [muted ? "Muted followed thread." : "Unmuted followed thread."];
}

export async function unfollowCommuneThread(threadId: string): Promise<string[]> {
  const auth = await currentUserIdForShelfAction("unfollowing Commune threads");
  if (!auth.userId || !supabase) return auth.warnings;
  const { error } = await supabase.from("user_followed_commune_threads").delete().eq("user_id", auth.userId).eq("thread_id", threadId);
  return error ? [friendlyBackendMessage("Followed Commune threads", error.message)] : ["Unfollowed thread."];
}

export async function loadPublicCommonsProfile(username: string): Promise<{ data: PublicCommonsProfile | null; warnings: string[] }> {
  const warnings: string[] = [];
  if (!hasSupabaseConfig || !supabase) return { data: null, warnings: [supabaseNotConfiguredMessage] };
  const cleanUsername = username.replace(/^@/, "").trim();
  const { data: profile, error } = await supabase.from("profiles").select("id, username, display_name, bio, interests, website_url, github_url, organization, is_developer, is_admin, avatar_url, commons_onboarding_completed_at").eq("username", cleanUsername).maybeSingle();
  if (error) return { data: null, warnings: [friendlyBackendMessage("Commons Profile", error.message)] };
  if (!profile) return { data: null, warnings: [] };
  const profileRow = { ...(profile as ProfileWithSetup), saved_addon_ids: [] };
  const [visibilityRows, customizationRows, mediaRows, definitions, awarded, collections, savedSources] = await Promise.all([
    safeQuery<VisibilitySettings[]>(warnings, "Public visibility", supabase.from("profile_visibility_settings").select("*").eq("user_id", profileRow.id).limit(1), []),
    safeQuery<ProfileCustomization[]>(warnings, "Public customization", supabase.from("profile_customization").select("*").eq("user_id", profileRow.id).limit(1), []),
    safeQuery<Array<{ media_type: string; public_url?: string | null }>>(warnings, "Public profile media", supabase.from("profile_media").select("media_type, public_url").eq("user_id", profileRow.id).eq("status", "active"), []),
    safeQuery<BadgeDefinition[]>(warnings, "Public badges", supabase.from("badge_definitions").select("badge_key, name, description, badge_type, category, rarity, is_active").eq("is_active", true), plannedBadges),
    safeQuery<Array<{ badge_key: string; awarded_at?: string | null; award_reason?: string | null; visibility?: string | null }>>(warnings, "Public user badges", supabase.from("user_badges").select("badge_key, awarded_at, award_reason, visibility").eq("user_id", profileRow.id).eq("visibility", "public"), []),
    safeQuery<Array<{ id: string; title: string; description?: string | null; visibility: string; created_at?: string | null }>>(warnings, "Public collections", supabase.from("user_source_collections").select("id, title, description, visibility, created_at").eq("user_id", profileRow.id).eq("visibility", "public").limit(12), []),
    safeQuery<SavedLivingSourcePreview[]>(warnings, "Public saved sources", supabase.from("user_saved_living_sources").select("id, source_id, source_name, source_url, category, saved_at, notes").eq("user_id", profileRow.id).limit(12), [])
  ]);
  const { data: auth } = await supabase.auth.getUser();
  const avatarUrl = mediaRows.find((row) => row.media_type === "avatar")?.public_url;
  const bannerUrl = mediaRows.find((row) => row.media_type === "banner")?.public_url;
  const visibility = { ...defaultVisibility, ...(visibilityRows[0] ?? {}) };
  return {
    data: {
      profile: profileRow,
      visibility,
      customization: { ...defaultCustomization, ...(customizationRows[0] ?? {}), avatar_url: avatarUrl ?? profileRow.avatar_url ?? null, banner_url: bannerUrl ?? null },
      badges: visibility.show_badges ? mergeBadges(definitions, awarded).filter((badge) => badge.earned && badge.visibility === "public") : [],
      publicCollections: visibility.show_source_collections ? collections.map((collection) => ({ ...collection, source_count: 0 })) : [],
      publicSavedSources: visibility.show_saved_sources ? savedSources : [],
      isOwner: auth.user?.id === profileRow.id
    },
    warnings
  };
}

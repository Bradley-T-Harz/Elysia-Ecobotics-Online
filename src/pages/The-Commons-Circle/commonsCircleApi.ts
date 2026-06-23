import { livingLibrarySources } from "../The-Living-Library/livingLibrarySources";
import type { LivingLibrarySource } from "../The-Living-Library/livingLibrarySources";
import type { FeaturedPublicLink, MarketplaceProfile } from "../The-Elysia-Marketplace/types";
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
export type BadgeDefinition = { badge_key: string; name: string; description: string; badge_type: string; category?: string | null; rarity: string; is_active?: boolean; icon_path?: string | null; tags?: string[]; authority?: boolean; authority_linked?: boolean | null; award_mode?: string | null; rule_summary?: string | null; is_manual_only?: boolean | null; sort_order?: number | null; note?: string; default_status?: string };
export type BadgeAwardRow = { badge_key: string; awarded_at?: string | null; award_reason?: string | null; award_source?: string | null; evidence_type?: string | null; evidence_id?: string | null; visibility?: "public" | "private" | null; revoked_at?: string | null };
export type UserBadge = BadgeDefinition & BadgeAwardRow & { visibility?: "public" | "private" | null; earned: true };
export type PublicCommunePostPreview = { id: string; title: string; post_type?: string | null; excerpt?: string | null; published_at?: string | null; created_at?: string | null };
export type PublicCommuneCommentPreview = { id: string; post_id: string; parent_comment_id?: string | null; body: string; published_at?: string | null; created_at?: string | null };

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
  publicLinks: FeaturedPublicLink[];
  publicCommunePosts: PublicCommunePostPreview[];
  publicCommuneComments: PublicCommuneCommentPreview[];
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
  { badge_key: "free_member", name: "Free Member", description: "Default recognition for joining the public website commons.", badge_type: "member", category: "membership", rarity: "common", icon_path: "/images/badges/Free_Member.png", tags: ["membership", "common"], authority: false, award_mode: "automatic for website members", default_status: "earned" },
  { badge_key: "stewardship_supporter", name: "Stewardship Supporter", description: "Recognition for reviewed public-benefit stewardship support.", badge_type: "stewardship", category: "stewardship", rarity: "uncommon", icon_path: "/images/badges/Stewardship_Supporter.png", tags: ["stewardship", "public-benefit"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "water_steward", name: "Water Steward", description: "Recognition connected to water access, watersheds, wetlands, or aquatic care.", badge_type: "stewardship", category: "water", rarity: "uncommon", icon_path: "/images/badges/Water_Steward.png", tags: ["water", "stewardship"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "forest_steward", name: "Forest Steward", description: "Recognition connected to forests, restoration, and habitat care.", badge_type: "stewardship", category: "forest", rarity: "uncommon", icon_path: "/images/badges/Forest_Steward.png", tags: ["forest", "stewardship"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "reef_steward", name: "Reef Steward", description: "Recognition connected to reef and ocean stewardship.", badge_type: "stewardship", category: "reef", rarity: "uncommon", icon_path: "/images/badges/Reef_Steward.png", tags: ["reef", "ocean", "stewardship"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "health_steward", name: "Health Steward", description: "Recognition connected to health, dignity, and public-benefit support.", badge_type: "stewardship", category: "health", rarity: "uncommon", icon_path: "/images/badges/Health_Steward.png", tags: ["health", "stewardship"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "knowledge_commons_supporter", name: "Knowledge Commons Supporter", description: "Recognition for supporting public knowledge and open learning.", badge_type: "stewardship", category: "knowledge", rarity: "uncommon", icon_path: "/images/badges/Knowledge_Commons_Supporter.png", tags: ["knowledge", "learning"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "source_curator", name: "Source Curator", description: "Recognition for useful Living Library source suggestions and care.", badge_type: "contributor", category: "living-library", rarity: "rare", icon_path: "/images/badges/Source_Curator.png", tags: ["living-library", "curation"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "troubleshooting_helper", name: "Troubleshooting Helper", description: "Recognition for helping others resolve issues safely.", badge_type: "contributor", category: "commune", rarity: "rare", icon_path: "/images/badges/Troubleshooting_Helper.png", tags: ["commune", "support"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "developer_contributor", name: "Developer Contributor", description: "Recognition for add-on, tooling, or developer ecosystem contributions.", badge_type: "developer", category: "developer", rarity: "rare", icon_path: "/images/badges/Developer_Contributor.png", tags: ["developer", "code"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "founding_steward", name: "Founding Steward", description: "Early project recognition manually assigned by an administrator.", badge_type: "founding", category: "membership", rarity: "epic", icon_path: "/images/badges/Founding_Steward.png", tags: ["founding", "membership"], authority: false, award_mode: "admin-awarded", default_status: "planned/locked", note: "This is one of the rarest badges. It is recognition for meaningful early support and foundational contribution, not automatic administrative authority." },
  { badge_key: "guardian_reviewer", name: "Guardian / Reviewer", description: "Recognition associated with trust and review work. Authority still requires roles assigned by administrators.", badge_type: "review", category: "authority-linked", rarity: "epic", icon_path: "/images/badges/Guardian_Reviewer.png", tags: ["trust", "review", "authority-linked"], authority: true, award_mode: "admin-awarded / role-linked", default_status: "planned/locked", note: "This badge may be authority-linked, but the badge itself should not grant permissions in frontend code." },
  { badge_key: "seed_sower", name: "Seed Sower", description: "Recognition for planting a first useful contribution in the public commons.", badge_type: "contributor", category: "contribution", rarity: "common", icon_path: "/images/badges/Seed_Sower.png", tags: ["contribution", "first-step"], authority: false, award_mode: "earned or review-awarded later", default_status: "planned/locked" },
  { badge_key: "bridge_builder", name: "Bridge Builder", description: "Recognition for helping people, projects, ideas, and resources find each other.", badge_type: "community", category: "community", rarity: "uncommon", icon_path: "/images/badges/Bridge_Builder.png", tags: ["community", "connection"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "archive_warden", name: "Archive Warden", description: "Recognition for preserving records, improving sources, checking links, and strengthening public memory.", badge_type: "archive", category: "archive", rarity: "uncommon", icon_path: "/images/badges/Archive_Warden.png", tags: ["archive", "documentation"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "forge_tester", name: "Forge Tester", description: "Recognition for careful testing, bug reports, compatibility notes, and safe release feedback.", badge_type: "testing", category: "testing", rarity: "rare", icon_path: "/images/badges/Forge_Tester.png", tags: ["testing", "release"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "field_witness", name: "Field Witness", description: "Recognition for public ecological observations, field evidence, maps, restoration notes, or environmental records.", badge_type: "ecology", category: "fieldwork", rarity: "rare", icon_path: "/images/badges/Field_Witness.png", tags: ["fieldwork", "ecology"], authority: false, award_mode: "review-awarded / evidence-linked", default_status: "planned/locked" },
  { badge_key: "radiant_scribe", name: "Radiant Scribe", description: "Recognition for clear writing, tutorials, research notes, guides, and public learning contributions.", badge_type: "writing", category: "writing", rarity: "rare", icon_path: "/images/badges/Radiant_Scribe.png", tags: ["writing", "teaching"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "hearth_keeper", name: "Hearth Keeper", description: "Recognition for trusted moderation and care of the public Commune.", badge_type: "moderation", category: "authority-linked", rarity: "epic", icon_path: "/images/badges/Hearth_Keeper.png", tags: ["commune", "moderation", "authority-linked"], authority: true, award_mode: "admin-awarded / role-linked", default_status: "planned/locked", note: "This is one of the rarest badges. It should only appear as earned when the person actually holds a moderator or equivalent trust role assigned by an administrator. Nobody can self-assign it." },
  { badge_key: "ecobotics_forgewright", name: "Ecobotics Forgewright", description: "Recognition for robotics, hardware, ecological devices, and physical system contributions.", badge_type: "ecobotics", category: "robotics", rarity: "epic", icon_path: "/images/badges/Ecobotics_Forgewright.png", tags: ["robotics", "hardware", "ecobotics"], authority: false, award_mode: "review-awarded / project-contribution", default_status: "planned/locked", note: "This is one of the rarest badges. It does not grant permission to control hardware, deploy drones, access private systems, or operate real devices." },
  { badge_key: "elysian_artwright", name: "Elysian Artwright", description: "Recognition for visual art, concept work, icons, and imagery that help give Elysia Ecobotics a living face.", badge_type: "art", category: "art", rarity: "rare", icon_path: "/images/badges/Elysian_Artwright.png", tags: ["art", "visual-identity"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "kindred_ally", name: "Kindred Ally", description: "Recognition for helping allied people, friends, collaborators, and associated projects with care and usefulness.", badge_type: "community", category: "allied-service", rarity: "uncommon", icon_path: "/images/badges/Kindred_Ally.png", tags: ["allied-service", "community"], authority: false, award_mode: "admin-awarded", default_status: "planned/locked", note: "This does not imply official partnership, sponsorship, endorsement, or authority." },
  { badge_key: "open_pathmaker", name: "Open Pathmaker", description: "Recognition for making the Commons easier, clearer, and more accessible for more people.", badge_type: "accessibility", category: "accessibility", rarity: "rare", icon_path: "/images/badges/Open_Pathmaker.png", tags: ["accessibility", "inclusion"], authority: false, award_mode: "review-awarded", default_status: "planned/locked" },
  { badge_key: "boundary_lantern", name: "Boundary Lantern", description: "Recognition for strengthening privacy, consent, safety, and ethical boundaries in the public commons.", badge_type: "safety", category: "privacy", rarity: "rare", icon_path: "/images/badges/Boundary_Lantern.png", tags: ["privacy", "safety", "ethics"], authority: false, award_mode: "admin-or-review-awarded", default_status: "planned/locked", note: "This is not the same as Guardian / Reviewer. It recognizes ethical architecture work without automatically granting formal review authority." }
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
  "Saved add-ons": "No account-backed Marketplace saves yet.",
  "Public profile fields": "Optional public profile fields are not active yet."
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

function orderedBadgeDefinitions(definitions: BadgeDefinition[]) {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.badge_key, definition]));
  const plannedByKey = new Map(plannedBadges.map((definition) => [definition.badge_key, definition]));
  const ordered = plannedBadges.map((planned, index) => {
    const databaseDefinition = definitionsByKey.get(planned.badge_key);
    return databaseDefinition ? {
      ...planned,
      ...databaseDefinition,
      icon_path: databaseDefinition.icon_path || planned.icon_path,
      tags: planned.tags,
      authority: Boolean(databaseDefinition.authority_linked ?? planned.authority),
      authority_linked: databaseDefinition.authority_linked ?? planned.authority ?? false,
      award_mode: databaseDefinition.award_mode || planned.award_mode,
      rule_summary: databaseDefinition.rule_summary ?? null,
      sort_order: databaseDefinition.sort_order ?? index + 1,
      note: planned.note,
      default_status: planned.default_status
    } : { ...planned, sort_order: index + 1, authority_linked: planned.authority ?? false };
  });
  const extra = definitions.filter((definition) => !plannedByKey.has(definition.badge_key));
  return [...ordered, ...extra].sort((left, right) => (left.sort_order ?? 999) - (right.sort_order ?? 999) || left.name.localeCompare(right.name));
}

function mergeBadges(definitions: BadgeDefinition[], awarded: BadgeAwardRow[]): UserBadge[] {
  const definitionsByKey = new Map(orderedBadgeDefinitions(definitions.length ? definitions : plannedBadges).map((definition) => [definition.badge_key, definition]));
  const earned: UserBadge[] = [];
  for (const award of awarded) {
    if (award.revoked_at) continue;
    const definition = definitionsByKey.get(award.badge_key) ?? plannedBadges.find((badge) => badge.badge_key === award.badge_key);
    if (!definition) continue;
    earned.push({ ...definition, ...award, visibility: award.visibility ?? "public", earned: true });
  }
  return earned.sort((left, right) => (left.sort_order ?? 999) - (right.sort_order ?? 999) || left.name.localeCompare(right.name));
}

function safePublicLinks(value: unknown): FeaturedPublicLink[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim().slice(0, 80) : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const kind = typeof row.kind === "string" ? row.kind.trim().slice(0, 32) : undefined;
    if (!label || !/^https?:\/\/[^\s<>"']+$/i.test(url)) return [];
    return [{ label, url, kind }];
  });
}

export function freeMemberFallbackBadge(awardedAt?: string | null): UserBadge {
  return mergeBadges(plannedBadges, [{ badge_key: "free_member", awarded_at: awardedAt ?? new Date().toISOString(), award_source: "local_fallback", visibility: "public" }])[0];
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
      userBadges: [freeMemberFallbackBadge()],
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
      userBadges: [],
      localLiving,
      localCommuneDrafts: localCommune,
      localFollowedThreads: localThreads
    };
  }

  const [visibilityRows, customizationRows, mediaRows, prefRows, savedAddons, savedSources, savedCitations, collectionRows, collectionItems, savedCommuneRows, followedRows, notificationRows, definitions, awarded] = await Promise.all([
    safeQuery<VisibilitySettings[]>(warnings, "Visibility settings", supabase.from("profile_visibility_settings").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<ProfileCustomization[]>(warnings, "Profile customization", supabase.from("profile_customization").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<Array<{ media_type: string; public_url?: string | null; created_at?: string | null }>>(warnings, "Profile media", supabase.from("profile_media").select("media_type, public_url, created_at").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }), []),
    safeQuery<NotificationPreferences[]>(warnings, "Notification preferences", supabase.from("notification_preferences").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<SavedAddonPreview[]>(warnings, "Saved add-ons", supabase.from("user_saved_addons").select("addon_slug, addon_name, addon_version_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedLivingSourcePreview[]>(warnings, "Saved Living Library sources", supabase.from("user_saved_living_sources").select("id, source_id, source_name, source_url, category, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedCitationPreview[]>(warnings, "Saved citations", supabase.from("user_saved_citations").select("id, source_id, citation_text, citation_format, saved_at").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; title: string; description?: string | null; visibility: string; created_at?: string | null }>>(warnings, "Source collections", supabase.from("user_source_collections").select("id, title, description, visibility, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ collection_id: string; source_id: string }>>(warnings, "Source collection items", supabase.from("user_source_collection_items").select("collection_id, source_id"), []),
    safeQuery<Array<{ id: string; post_id?: string | null; draft_id?: string | null; saved_at?: string | null; notes?: string | null }>>(warnings, "Saved Commune posts", supabase.from("user_saved_commune_posts").select("id, post_id, draft_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; thread_id: string; followed_at?: string | null; last_read_at?: string | null; muted?: boolean | null }>>(warnings, "Followed Commune threads", supabase.from("user_followed_commune_threads").select("id, thread_id, followed_at, last_read_at, muted").eq("user_id", userId).order("followed_at", { ascending: false }).limit(200), []),
    safeQuery<NotificationPreview[]>(warnings, "Notifications", supabase.from("user_notifications").select("id, title, body, action_url, read_at, created_at, notification_type").eq("user_id", userId).order("created_at", { ascending: false }).limit(12), []),
    safeQuery<BadgeDefinition[]>(warnings, "Badge definitions", supabase.from("badge_definitions").select("badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active").eq("is_active", true).order("sort_order", { ascending: true }), plannedBadges),
    safeQuery<BadgeAwardRow[]>(warnings, "User badges", supabase.from("user_badges").select("badge_key, awarded_at, award_reason, award_source, evidence_type, evidence_id, visibility, revoked_at").eq("user_id", userId).is("revoked_at", null), [])
  ]);

  const avatarUrl = mediaRows.find((row) => row.media_type === "avatar")?.public_url;
  const bannerUrl = mediaRows.find((row) => row.media_type === "banner")?.public_url;
  const localOnboarding = readLocalStorage<{ completed?: boolean; completedAt?: string }>(commonsStorageKeys.onboarding, {});
  const profileQualifiesForFreeMember = Boolean(profile && (profile.commons_onboarding_completed_at || localOnboarding.completed));
  let badgeAwards: BadgeAwardRow[] = [...awarded];
  const hasFreeMemberAward = badgeAwards.some((badge) => badge.badge_key === "free_member" && !badge.revoked_at);
  if (profileQualifiesForFreeMember && !hasFreeMemberAward) {
    const rpcResult = await supabase.rpc("grant_free_member_for_user", { p_target_user_id: userId });
    if (rpcResult.error) {
      logBackendDetail("Free Member badge", rpcResult.error.message);
      badgeAwards = [{ badge_key: "free_member", awarded_at: profile?.commons_onboarding_completed_at ?? localOnboarding.completedAt ?? new Date().toISOString(), award_source: "local_fallback", visibility: "public" }, ...badgeAwards];
    } else {
      const refreshed = await safeQuery<BadgeAwardRow[]>(warnings, "User badges", supabase.from("user_badges").select("badge_key, awarded_at, award_reason, award_source, evidence_type, evidence_id, visibility, revoked_at").eq("user_id", userId).is("revoked_at", null), []);
      badgeAwards = refreshed.some((badge) => badge.badge_key === "free_member" && !badge.revoked_at)
        ? refreshed
        : [{ badge_key: "free_member", awarded_at: profile?.commons_onboarding_completed_at ?? localOnboarding.completedAt ?? new Date().toISOString(), award_source: "local_fallback", visibility: "public" }, ...badgeAwards];
    }
  }
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
    userBadges: mergeBadges(definitions.length ? definitions : plannedBadges, badgeAwards),
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
  const previous = await supabase.from("profile_media").update({ status: "hidden" }).eq("user_id", auth.user.id).eq("media_type", mediaType).eq("status", "active");
  if (previous.error) logBackendDetail("Profile media replacement", previous.error.message);
  const { data: mediaRow, error } = await supabase.from("profile_media").insert({ user_id: auth.user.id, media_type: mediaType, bucket, storage_path: storagePath, public_url: publicUrl, status: "active" }).select("id").single();
  const warnings = error ? [friendlyBackendMessage("Profile media", error.message)] : [];
  if (!error) {
    const mediaId = (mediaRow as { id?: string } | null)?.id ?? null;
    const customizationPatch = {
      [mediaType === "avatar" ? "avatar_media_id" : "banner_media_id"]: mediaId,
      updated_at: new Date().toISOString()
    };
    const customizationResult = await supabase.from("profile_customization").upsert({ user_id: auth.user.id, ...customizationPatch }, { onConflict: "user_id" });
    if (customizationResult.error) warnings.push(friendlyBackendMessage("Profile customization", customizationResult.error.message));
    if (mediaType === "avatar") {
      const profileResult = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", auth.user.id);
      if (profileResult.error) warnings.push(friendlyBackendMessage("Commons Profile avatar", profileResult.error.message));
    }
  }
  return { publicUrl, warnings };
}

export async function removeProfileMedia(mediaType: "avatar" | "banner"): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before removing profile media."];
  const warnings: string[] = [];
  const result = await supabase
    .from("profile_media")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .eq("media_type", mediaType)
    .eq("status", "active");
  if (result.error) warnings.push(friendlyBackendMessage("Profile media", result.error.message));
  if (mediaType === "avatar") {
    const profileResult = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
    if (profileResult.error) warnings.push(friendlyBackendMessage("Commons Profile avatar", profileResult.error.message));
  }
  const customizationResult = await supabase
    .from("profile_customization")
    .update({ [mediaType === "avatar" ? "avatar_media_id" : "banner_media_id"]: null, updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id);
  if (customizationResult.error) warnings.push(friendlyBackendMessage("Profile customization", customizationResult.error.message));
  return warnings;
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

export async function updateBadgeVisibility(badgeKey: string, visibility: "public" | "private"): Promise<string[]> {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ["Sign in before updating badge visibility."];
  const { error } = await supabase.from("user_badges").update({ visibility, updated_at: new Date().toISOString() }).eq("user_id", auth.user.id).eq("badge_key", badgeKey).is("revoked_at", null);
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
  const { data: profile, error } = await supabase.from("profiles").select("id, username, display_name, bio, interests, website_url, github_url, avatar_url, commons_onboarding_completed_at").eq("username", cleanUsername).maybeSingle();
  if (error) return { data: null, warnings: [friendlyBackendMessage("Commons Profile", error.message)] };
  if (!profile) return { data: null, warnings: [] };
  const profileRow = { ...(profile as ProfileWithSetup), saved_addon_ids: [] };
  const [publicFieldRows, visibilityRows, customizationRows, mediaRows, definitions, awarded, collections, publicPosts, publicComments] = await Promise.all([
    safeQuery<Array<{ organization?: string | null; headline?: string | null; featured_public_links?: unknown }>>(warnings, "Public profile fields", supabase.from("profiles").select("organization, headline, featured_public_links").eq("id", profileRow.id).limit(1), []),
    safeQuery<VisibilitySettings[]>(warnings, "Public visibility", supabase.from("profile_visibility_settings").select("*").eq("user_id", profileRow.id).limit(1), []),
    safeQuery<ProfileCustomization[]>(warnings, "Public customization", supabase.from("profile_customization").select("*").eq("user_id", profileRow.id).limit(1), []),
    safeQuery<Array<{ media_type: string; public_url?: string | null; created_at?: string | null }>>(warnings, "Public profile media", supabase.from("profile_media").select("media_type, public_url, created_at").eq("user_id", profileRow.id).eq("status", "active").order("created_at", { ascending: false }), []),
    safeQuery<BadgeDefinition[]>(warnings, "Public badges", supabase.from("badge_definitions").select("badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active").eq("is_active", true).order("sort_order", { ascending: true }), plannedBadges),
    safeQuery<BadgeAwardRow[]>(warnings, "Public user badges", supabase.from("user_badges").select("badge_key, awarded_at, award_reason, award_source, evidence_type, evidence_id, visibility, revoked_at").eq("user_id", profileRow.id).eq("visibility", "public").is("revoked_at", null), []),
    safeQuery<Array<{ id: string; title: string; description?: string | null; visibility: string; created_at?: string | null }>>(warnings, "Public collections", supabase.from("user_source_collections").select("id, title, description, visibility, created_at").eq("user_id", profileRow.id).eq("visibility", "public").limit(12), []),
    safeQuery<PublicCommunePostPreview[]>(warnings, "Public Commune posts", supabase.from("commune_posts").select("id, title, post_type, excerpt, published_at, created_at").eq("user_id", profileRow.id).eq("status", "published").eq("visibility", "public").order("published_at", { ascending: false }).limit(6), []),
    safeQuery<PublicCommuneCommentPreview[]>(warnings, "Public Commune comments", supabase.from("commune_comments").select("id, post_id, parent_comment_id, body, published_at, created_at").eq("user_id", profileRow.id).eq("status", "published").eq("visibility_state", "published").order("published_at", { ascending: false }).limit(6), [])
  ]);
  const { data: auth } = await supabase.auth.getUser();
  const avatarUrl = mediaRows.find((row) => row.media_type === "avatar")?.public_url;
  const bannerUrl = mediaRows.find((row) => row.media_type === "banner")?.public_url;
  const visibility = { ...defaultVisibility, ...(visibilityRows[0] ?? {}) };
  const publicFields = publicFieldRows[0] ?? {};
  const publicProfileRow = {
    ...profileRow,
    organization: publicFields.organization ?? profileRow.organization ?? null,
    headline: publicFields.headline ?? profileRow.headline ?? null,
    featured_public_links: safePublicLinks(publicFields.featured_public_links)
  };
  return {
    data: {
      profile: publicProfileRow,
      visibility,
      customization: { ...defaultCustomization, ...(customizationRows[0] ?? {}), avatar_url: avatarUrl ?? profileRow.avatar_url ?? null, banner_url: bannerUrl ?? null },
      badges: visibility.show_badges ? mergeBadges(definitions.length ? definitions : plannedBadges, awarded).filter((badge) => badge.visibility === "public") : [],
      publicCollections: visibility.show_source_collections ? collections.map((collection) => ({ ...collection, source_count: 0 })) : [],
      publicLinks: safePublicLinks(publicProfileRow.featured_public_links),
      publicCommunePosts: visibility.show_commune_posts ? publicPosts : [],
      publicCommuneComments: visibility.show_commune_posts ? publicComments : [],
      isOwner: auth.user?.id === profileRow.id
    },
    warnings
  };
}

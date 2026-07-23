import { livingLibrarySources } from "../The-Living-Library/livingLibrarySources";
import type { LivingLibrarySource } from "../The-Living-Library/livingLibrarySources";
import type { FeaturedPublicLink, MarketplaceProfile } from "../The-Elysia-Marketplace/types";
import { loadCurrentProfile } from "../The-Elysia-Marketplace/lib/marketplaceApi";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { DEFAULT_COMMONS_BACKGROUND_STYLE, normalizeCommonsBackgroundStyle } from "../../shared/commonsBackgroundStyles";
import {
  DEFAULT_COMMONS_PROFILE_LAYOUT,
  normalizeCommonsProfileLayout,
  type CommonsProfileLayoutKey,
} from "../../shared/commonsProfileLayouts";
import {
  DEFAULT_COMMONS_THEME_MODE,
  normalizeCommonsThemeMode,
  type CommonsThemeModeKey,
} from "../../shared/commonsThemeModes";
import { canReviewDomain, loadCurrentRoleState } from "../../shared/review/reviewClient";

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
  theme_mode: CommonsThemeModeKey;
  accent_color: string;
  background_style: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  avatar_media_id?: string | null;
  banner_media_id?: string | null;
  decal_set: string;
  selected_decals: string[];
  profile_layout: CommonsProfileLayoutKey;
  banner_zoom: number;
  banner_position_x: number;
  banner_position_y: number;
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
export type NotificationPreview = { id: string; title: string; body?: string | null; action_url?: string | null; read_at?: string | null; created_at?: string | null; notification_type?: string | null; source_type?: string | null; source_id?: string | null };
export type CodeProposalSignalStatus = "draft" | "submitted" | "needs_changes" | "accepted" | "rejected" | "withdrawn" | "hidden_by_moderation";
export type CodeProposalSignalPreview = {
  id: string;
  post_id: string;
  code_snippet_id: string;
  proposer_user_id: string;
  original_author_user_id: string;
  change_summary: string;
  explanation?: string | null;
  proposal_status: CodeProposalSignalStatus;
  submitted_at?: string | null;
  decided_at?: string | null;
  withdrawn_at?: string | null;
  hidden_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  source_room: "coding_cornucopia" | "troubleshooting_grove";
  post_title?: string | null;
};
export type TroubleshootingSignalPreview = {
  id: string;
  post_id?: string | null;
  thread_id?: string | null;
  author_user_id?: string | null;
  issue_type?: string | null;
  affected_area?: string | null;
  troubleshooting_status?: string | null;
  accepted_resolution_kind?: string | null;
  accepted_summary?: string | null;
  accepted_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  post_title?: string | null;
  action_url: string;
  role_context: "owner" | "reviewer" | "resolution";
};
export type ResearchNotesSignalPreview = {
  id: string;
  post_id?: string | null;
  thread_id?: string | null;
  author_user_id?: string | null;
  research_question?: string | null;
  domain?: string | null;
  evidence_strength?: string | null;
  review_status?: string | null;
  living_library_source_link?: string | null;
  correction_note?: string | null;
  reviewed_at?: string | null;
  corrected_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  post_title?: string | null;
  action_url: string;
  role_context: "owner" | "reviewer" | "clarification";
};
export type RepositoryShowcaseSignalPreview = {
  id: string;
  post_id?: string | null;
  repository_url?: string | null;
  project_name?: string | null;
  status?: string | null;
  sandbox_review_requested?: boolean | null;
  sandbox_review_status?: string | null;
  sandbox_review_request_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  role_context: "owner" | "reviewer" | "sandbox";
};
export type ElysiaIterationShowcaseSignalPreview = {
  id: string;
  post_id?: string | null;
  author_user_id?: string | null;
  iteration_type?: string | null;
  version_build_label?: string | null;
  status?: string | null;
  sandbox_review_requested?: boolean | null;
  sandbox_review_status?: string | null;
  sandbox_review_request_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  role_context: "owner" | "reviewer" | "sandbox";
};
export type JobPostSignalPreview = {
  id: string;
  post_id?: string | null;
  thread_id?: string | null;
  author_user_id?: string | null;
  role_title?: string | null;
  organization_project?: string | null;
  role_type?: string | null;
  paid_volunteer_status?: string | null;
  location_mode?: string | null;
  application_status?: string | null;
  anti_scam_review_status?: string | null;
  public_correction_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  role_context: "owner" | "reviewer" | "status";
};
export type OfficialUpdateSignalPreview = {
  id: string;
  post_id?: string | null;
  admin_user_id?: string | null;
  brand_author_name?: string | null;
  update_type?: string | null;
  official_status?: string | null;
  severity?: string | null;
  pinned?: boolean | null;
  important?: boolean | null;
  comments_enabled?: boolean | null;
  correction_status?: string | null;
  correction_note?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  role_context: "author" | "reviewer" | "notification";
};
export type CommunityVoteSignalPreview = {
  post_id: string;
  created_by?: string | null;
  question?: string | null;
  vote_status?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  results_visibility?: string | null;
  allow_comments?: boolean | null;
  admin_outcome_summary?: string | null;
  official_update_post_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_url: string;
  role_context: "author" | "reviewer" | "closing_soon" | "outcome";
};
export type BadgeDefinition = { badge_key: string; name: string; description: string; badge_type: string; category?: string | null; rarity: string; is_active?: boolean; icon_path?: string | null; tags?: string[]; authority?: boolean; authority_linked?: boolean | null; award_mode?: string | null; rule_summary?: string | null; is_manual_only?: boolean | null; sort_order?: number | null; note?: string; default_status?: string };
// Evidence fields remain optional for a future privileged, audited RPC result.
// Ordinary/self and public reads below deliberately request only presentation-safe columns.
export type BadgeAwardRow = { badge_key: string; awarded_at?: string | null; award_reason?: string | null; award_source?: string | null; evidence_type?: string | null; evidence_id?: string | null; visibility?: "public" | "private" | null; revoked_at?: string | null };
const selfBadgeAwardColumns = "badge_key, awarded_at, award_source, visibility, revoked_at";
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

export type SignalConsoleData = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  userId: string | null;
  warnings: string[];
  signals: NotificationPreview[];
  codeProposalActivity: CodeProposalSignalPreview[];
  needsMyReview: CodeProposalSignalPreview[];
  mySubmittedProposals: CodeProposalSignalPreview[];
  troubleshootingActivity: TroubleshootingSignalPreview[];
  myTroubleshootingIssues: TroubleshootingSignalPreview[];
  troubleshootingNeedingReview: TroubleshootingSignalPreview[];
  troubleshootingResolutionActivity: TroubleshootingSignalPreview[];
  researchNotesActivity: ResearchNotesSignalPreview[];
  myResearchNotes: ResearchNotesSignalPreview[];
  researchNotesNeedingReview: ResearchNotesSignalPreview[];
  researchClarificationActivity: ResearchNotesSignalPreview[];
  repositoryShowcaseActivity: RepositoryShowcaseSignalPreview[];
  myRepositoryShowcases: RepositoryShowcaseSignalPreview[];
  repositoryShowcasesNeedingReview: RepositoryShowcaseSignalPreview[];
  repositorySandboxActivity: RepositoryShowcaseSignalPreview[];
  iterationShowcaseActivity: ElysiaIterationShowcaseSignalPreview[];
  myIterationShowcases: ElysiaIterationShowcaseSignalPreview[];
  iterationShowcasesNeedingReview: ElysiaIterationShowcaseSignalPreview[];
  iterationSandboxActivity: ElysiaIterationShowcaseSignalPreview[];
  jobPostActivity: JobPostSignalPreview[];
  myJobPosts: JobPostSignalPreview[];
  jobPostsNeedingReview: JobPostSignalPreview[];
  jobPostStatusActivity: JobPostSignalPreview[];
  officialUpdateActivity: OfficialUpdateSignalPreview[];
  myOfficialUpdates: OfficialUpdateSignalPreview[];
  officialUpdatesNeedingAttention: OfficialUpdateSignalPreview[];
  communityVoteActivity: CommunityVoteSignalPreview[];
  myCommunityVotes: CommunityVoteSignalPreview[];
  communityVotesNeedingAttention: CommunityVoteSignalPreview[];
  communityVoteLifecycleActivity: CommunityVoteSignalPreview[];
  unreadCount: number;
  codeProposalCount: number;
  troubleshootingCount: number;
  researchNotesCount: number;
  repositoryShowcaseCount: number;
  iterationShowcaseCount: number;
  jobPostCount: number;
  officialUpdateCount: number;
  communityVoteCount: number;
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

type PublicProfilePresentation = {
  profile: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    shortPublicBio: string | null;
    headline: string | null;
    organization: string | null;
    interests: string | null;
    websiteUrl: string | null;
    githubUrl: string | null;
    isDeveloper: boolean;
    canonicalProfileUrl: string;
  };
  visibility: VisibilitySettings;
  customization: ProfileCustomization;
  publicBadges: BadgeAwardRow[];
  publicLinks: FeaturedPublicLink[];
  publicCollections: SourceCollectionPreview[];
  publicCommunePosts: PublicCommunePostPreview[];
  publicCommuneComments: PublicCommuneCommentPreview[];
  isOwner: boolean;
};

export type PublicProfileHandleResolution = {
  requestedHandle: string;
  currentHandle: string;
  canonicalProfileUrl: string;
  redirect: true;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/;

function plainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalBoundedText(value: unknown, maximumLength: number): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.length <= maximumLength ? value : undefined;
}

function exactRecordKeys(record: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(record);
  return keys.length === expected.length && expected.every((key) => key in record);
}

function safePublicTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

function decodePublicBadgeAwards(value: unknown): BadgeAwardRow[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const decoded: BadgeAwardRow[] = [];
  for (const item of value) {
    const row = plainRecord(item);
    if (!row || !exactRecordKeys(row, ["badgeKey", "awardedAt", "awardSource", "visibility"])) return null;
    const awardedAt = safePublicTimestamp(row.awardedAt);
    const awardSource = optionalBoundedText(row.awardSource, 120);
    if (
      typeof row.badgeKey !== "string" || !/^[a-z][a-z0-9_]{1,79}$/.test(row.badgeKey)
      || awardedAt === undefined || awardSource === undefined
      || row.visibility !== "public"
    ) return null;
    decoded.push({
      badge_key: row.badgeKey,
      awarded_at: awardedAt,
      award_source: awardSource,
      visibility: "public"
    });
  }
  return decoded;
}

function decodeFeaturedPublicLinks(value: unknown): FeaturedPublicLink[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const decoded: FeaturedPublicLink[] = [];
  for (const item of value) {
    const row = plainRecord(item);
    if (!row || !exactRecordKeys(row, ["label", "url", "kind"])) return null;
    const kind = optionalBoundedText(row.kind, 32);
    if (
      typeof row.label !== "string" || row.label.length < 1
      || row.label.length > 80
      || typeof row.url !== "string" || row.url.length > 2048
      || !/^https?:\/\/[^\s<>"']+$/i.test(row.url)
      || kind === undefined
    ) return null;
    decoded.push({ label: row.label, url: row.url, kind: kind ?? undefined });
  }
  return decoded;
}

function decodePublicCollections(value: unknown): SourceCollectionPreview[] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const decoded: SourceCollectionPreview[] = [];
  for (const item of value) {
    const row = plainRecord(item);
    if (!row || !exactRecordKeys(row, ["collectionId", "title", "description", "visibility", "sourceCount", "createdAt"])) return null;
    const description = optionalBoundedText(row.description, 4_000);
    const createdAt = safePublicTimestamp(row.createdAt);
    if (
      typeof row.collectionId !== "string" || !UUID_PATTERN.test(row.collectionId)
      || typeof row.title !== "string" || row.title.length < 1 || row.title.length > 240
      || description === undefined || row.visibility !== "public"
      || typeof row.sourceCount !== "number" || !Number.isSafeInteger(row.sourceCount)
      || row.sourceCount < 0 || row.sourceCount > 100_000
      || createdAt === undefined
    ) return null;
    decoded.push({
      id: row.collectionId,
      title: row.title,
      description,
      visibility: "public",
      source_count: row.sourceCount,
      created_at: createdAt
    });
  }
  return decoded;
}

function decodePublicCommunePosts(value: unknown): PublicCommunePostPreview[] | null {
  if (!Array.isArray(value) || value.length > 6) return null;
  const decoded: PublicCommunePostPreview[] = [];
  for (const item of value) {
    const row = plainRecord(item);
    if (!row || !exactRecordKeys(row, ["postId", "title", "postType", "excerpt", "publishedAt", "createdAt"])) return null;
    const postType = optionalBoundedText(row.postType, 80);
    const excerpt = optionalBoundedText(row.excerpt, 2_000);
    const publishedAt = safePublicTimestamp(row.publishedAt);
    const createdAt = safePublicTimestamp(row.createdAt);
    if (
      typeof row.postId !== "string" || !UUID_PATTERN.test(row.postId)
      || typeof row.title !== "string" || row.title.length < 1 || row.title.length > 300
      || postType === undefined || excerpt === undefined
      || publishedAt === undefined || createdAt === undefined
    ) return null;
    decoded.push({
      id: row.postId,
      title: row.title,
      post_type: postType,
      excerpt,
      published_at: publishedAt,
      created_at: createdAt
    });
  }
  return decoded;
}

function decodePublicCommuneComments(value: unknown): PublicCommuneCommentPreview[] | null {
  if (!Array.isArray(value) || value.length > 6) return null;
  const decoded: PublicCommuneCommentPreview[] = [];
  for (const item of value) {
    const row = plainRecord(item);
    if (!row || !exactRecordKeys(row, ["commentId", "postId", "parentCommentId", "body", "publishedAt", "createdAt"])) return null;
    const parentCommentId = optionalBoundedText(row.parentCommentId, 36);
    const publishedAt = safePublicTimestamp(row.publishedAt);
    const createdAt = safePublicTimestamp(row.createdAt);
    if (
      typeof row.commentId !== "string" || !UUID_PATTERN.test(row.commentId)
      || typeof row.postId !== "string" || !UUID_PATTERN.test(row.postId)
      || parentCommentId === undefined
      || (parentCommentId !== null && !UUID_PATTERN.test(parentCommentId))
      || typeof row.body !== "string" || row.body.length < 1 || row.body.length > 50_000
      || publishedAt === undefined || createdAt === undefined
    ) return null;
    decoded.push({
      id: row.commentId,
      post_id: row.postId,
      parent_comment_id: parentCommentId,
      body: row.body,
      published_at: publishedAt,
      created_at: createdAt
    });
  }
  return decoded;
}

function decodePublicProfilePresentation(value: unknown): PublicProfilePresentation | null {
  const root = plainRecord(Array.isArray(value) ? value[0] : value);
  if (
    !root || Object.keys(root).length === 0
    || !exactRecordKeys(root, [
      "profile", "visibility", "customization", "media", "isOwner",
      "publicBadges", "publicLinks", "publicSourceCollections", "publicCommunePosts",
      "publicCommuneComments"
    ])
  ) return null;
  const profile = plainRecord(root.profile);
  const visibility = plainRecord(root.visibility);
  const customization = plainRecord(root.customization);
  const media = plainRecord(root.media);
  if (
    !profile || !visibility || !customization || !media
    || !exactRecordKeys(profile, [
      "handle", "displayName", "avatarUrl", "shortPublicBio",
      "headline", "organization", "interests", "websiteUrl", "githubUrl",
      "isDeveloper",
      "canonicalProfileUrl", "updatedAt"
    ])
    || !exactRecordKeys(media, [
      "avatarMediaId", "avatarUrl", "bannerMediaId", "bannerUrl"
    ])
  ) return null;

  const handle = profile.handle;
  const displayName = optionalBoundedText(profile.displayName, 120);
  const shortPublicBio = optionalBoundedText(profile.shortPublicBio, 280);
  const headline = optionalBoundedText(profile.headline, 240);
  const organization = optionalBoundedText(profile.organization, 240);
  const interests = optionalBoundedText(profile.interests, 2_000);
  const websiteUrl = optionalBoundedText(profile.websiteUrl, 2_048);
  const githubUrl = optionalBoundedText(profile.githubUrl, 2_048);
  const avatarUrl = optionalBoundedText(profile.avatarUrl, 100);
  const bannerUrl = optionalBoundedText(media.bannerUrl, 100);
  const avatarMediaId = optionalBoundedText(media.avatarMediaId, 36);
  const bannerMediaId = optionalBoundedText(media.bannerMediaId, 36);
  if (
    typeof handle !== "string" || !PUBLIC_HANDLE_PATTERN.test(handle)
    || displayName === undefined || shortPublicBio === undefined
    || headline === undefined || organization === undefined
    || interests === undefined || websiteUrl === undefined
    || githubUrl === undefined || typeof profile.isDeveloper !== "boolean"
    || (websiteUrl !== null && !/^https?:\/\/[^\s<>"']+$/i.test(websiteUrl))
    || (githubUrl !== null && !/^https?:\/\/[^\s<>"']+$/i.test(githubUrl))
    || avatarUrl === undefined || bannerUrl === undefined
    || avatarMediaId === undefined || bannerMediaId === undefined
    || profile.canonicalProfileUrl !== `https://elysiaecobotics.com/commons-circle/@${handle}`
    || safePublicTimestamp(profile.updatedAt) === undefined
    || (avatarMediaId !== null && !UUID_PATTERN.test(avatarMediaId))
    || (bannerMediaId !== null && !UUID_PATTERN.test(bannerMediaId))
    || (avatarUrl !== null && avatarUrl !== `/api/public/profile-avatars/${avatarMediaId}`)
    || (bannerUrl !== null && bannerUrl !== `/api/public/profile-banners/${bannerMediaId}`)
  ) return null;

  const visibilityMap: Array<[keyof VisibilitySettings, string]> = [
    ["show_display_name", "showDisplayName"], ["show_bio", "showBio"],
    ["show_interests", "showInterests"], ["show_website", "showWebsite"],
    ["show_github", "showGithub"], ["show_badges", "showBadges"],
    ["show_stewardship_recognition", "showStewardshipRecognition"],
    ["show_saved_addons", "showSavedAddons"], ["show_saved_sources", "showSavedSources"],
    ["show_source_collections", "showSourceCollections"], ["show_commune_posts", "showCommunePosts"],
    ["show_work_with_status", "showWorkWithStatus"], ["show_developer_status", "showDeveloperStatus"],
    ["show_member_tier", "showMemberTier"]
  ];
  const decodedVisibility = {} as VisibilitySettings;
  for (const [target, source] of visibilityMap) {
    if (typeof visibility[source] !== "boolean") return null;
    decodedVisibility[target] = visibility[source] as boolean;
  }
  if (!exactRecordKeys(visibility, visibilityMap.map(([, source]) => source))) return null;

  const accentColor = customization.accentColor;
  if (
    !exactRecordKeys(customization, [
      "themeMode", "accentColor", "backgroundStyle", "decalSet",
      "profileLayout", "bannerZoom", "bannerPositionX", "bannerPositionY"
    ])
    || typeof customization.themeMode !== "string"
    || typeof accentColor !== "string" || !/^#[0-9a-f]{6}$/i.test(accentColor)
    || typeof customization.backgroundStyle !== "string"
    || typeof customization.decalSet !== "string"
    || typeof customization.profileLayout !== "string"
    || typeof customization.bannerZoom !== "number"
    || typeof customization.bannerPositionX !== "number"
    || typeof customization.bannerPositionY !== "number"
  ) return null;

  const publicBadges = decodePublicBadgeAwards(root.publicBadges);
  const publicLinks = decodeFeaturedPublicLinks(root.publicLinks);
  const publicCollections = decodePublicCollections(root.publicSourceCollections);
  const publicCommunePosts = decodePublicCommunePosts(root.publicCommunePosts);
  const publicCommuneComments = decodePublicCommuneComments(root.publicCommuneComments);
  if (
    typeof root.isOwner !== "boolean"
    || !publicBadges || !publicLinks || !publicCollections
    || !publicCommunePosts || !publicCommuneComments
  ) return null;

  return {
    profile: {
      handle, displayName, avatarUrl, shortPublicBio,
      headline, organization, interests, websiteUrl, githubUrl,
      isDeveloper: profile.isDeveloper,
      canonicalProfileUrl: profile.canonicalProfileUrl as string
    },
    visibility: decodedVisibility,
    customization: normalizeProfileCustomization({
      theme_mode: customization.themeMode as CommonsThemeModeKey,
      accent_color: accentColor,
      background_style: customization.backgroundStyle,
      decal_set: customization.decalSet,
      profile_layout: customization.profileLayout as CommonsProfileLayoutKey,
      banner_zoom: customization.bannerZoom,
      banner_position_x: customization.bannerPositionX,
      banner_position_y: customization.bannerPositionY,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      avatar_media_id: avatarMediaId,
      banner_media_id: bannerMediaId,
      selected_decals: []
    }),
    publicBadges,
    publicLinks,
    publicCollections,
    publicCommunePosts,
    publicCommuneComments,
    isOwner: root.isOwner
  };
}

function decodePublicProfileHandleResolution(value: unknown): PublicProfileHandleResolution | null {
  const record = plainRecord(Array.isArray(value) ? value[0] : value);
  if (!record || Object.keys(record).length === 0) return null;
  const requestedHandle = record.requestedHandle;
  const currentHandle = record.currentHandle;
  const canonicalProfileUrl = record.canonicalProfileUrl;
  if (
    typeof requestedHandle !== "string" || !PUBLIC_HANDLE_PATTERN.test(requestedHandle)
    || typeof currentHandle !== "string" || !PUBLIC_HANDLE_PATTERN.test(currentHandle)
    || requestedHandle === currentHandle || record.redirect !== true
    || canonicalProfileUrl !== `https://elysiaecobotics.com/commons-circle/@${currentHandle}`
  ) return null;
  return { requestedHandle, currentHandle, canonicalProfileUrl, redirect: true };
}

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
  theme_mode: DEFAULT_COMMONS_THEME_MODE,
  accent_color: "#8ee8dc",
  background_style: DEFAULT_COMMONS_BACKGROUND_STYLE,
  avatar_url: null,
  banner_url: null,
  avatar_media_id: null,
  banner_media_id: null,
  decal_set: "none",
  selected_decals: [],
  profile_layout: DEFAULT_COMMONS_PROFILE_LAYOUT,
  banner_zoom: 1,
  banner_position_x: 50,
  banner_position_y: 50
};

export const DEFAULT_COMMONS_BANNER_ZOOM = 1;
export const DEFAULT_COMMONS_BANNER_POSITION_X = 50;
export const DEFAULT_COMMONS_BANNER_POSITION_Y = 50;
export const COMMONS_BANNER_ZOOM_MIN = 0.5;
export const COMMONS_BANNER_ZOOM_MAX = 2;
export const COMMONS_BANNER_POSITION_MIN = 0;
export const COMMONS_BANNER_POSITION_MAX = 100;

export function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeCommonsBannerZoom(value: unknown) {
  return clampNumber(value, COMMONS_BANNER_ZOOM_MIN, COMMONS_BANNER_ZOOM_MAX, DEFAULT_COMMONS_BANNER_ZOOM);
}

export function normalizeCommonsBannerPosition(value: unknown) {
  return clampNumber(value, COMMONS_BANNER_POSITION_MIN, COMMONS_BANNER_POSITION_MAX, DEFAULT_COMMONS_BANNER_POSITION_X);
}

function normalizeProfileCustomization(settings: Partial<ProfileCustomization>): ProfileCustomization {
  const merged = { ...defaultCustomization, ...settings };
  return {
    ...merged,
    accent_color: merged.accent_color || defaultCustomization.accent_color,
    avatar_url: merged.avatar_url ?? null,
    banner_url: merged.banner_url ?? null,
    avatar_media_id: merged.avatar_media_id ?? null,
    banner_media_id: merged.banner_media_id ?? null,
    decal_set: merged.decal_set || defaultCustomization.decal_set,
    selected_decals: Array.isArray(merged.selected_decals) ? merged.selected_decals : [],
    theme_mode: normalizeCommonsThemeMode(merged.theme_mode),
    background_style: normalizeCommonsBackgroundStyle(merged.background_style),
    profile_layout: normalizeCommonsProfileLayout(merged.profile_layout),
    banner_zoom: normalizeCommonsBannerZoom(merged.banner_zoom),
    banner_position_x: normalizeCommonsBannerPosition(merged.banner_position_x),
    banner_position_y: normalizeCommonsBannerPosition(merged.banner_position_y),
  };
}

export const defaultNotificationPreferences: NotificationPreferences = {
  commune_replies: true,
  followed_threads: true,
  marketplace_updates: true,
  living_library_updates: true,
  review_status_updates: true,
  admin_queue_alerts: true
};

export const plannedBadges: BadgeDefinition[] = [
  { badge_key: "free_member", name: "Free Member", description: "Recognition for completing signed-in Commons Profile onboarding.", badge_type: "member", category: "membership", rarity: "common", icon_path: "/images/badges/Free_Member.png", tags: ["membership", "common"], authority: false, award_mode: "automatic after Commons onboarding", default_status: "earned" },
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
  "Notification preferences": "Notification preferences are not configured yet.",
  "Visibility settings": "Profile visibility settings are not configured yet.",
  "Profile customization": "Profile customization is not configured yet.",
  "Saved Commune posts": "No saved Commune posts yet.",
  "Source collections": "No source collections yet.",
  "Source collection items": "Source collection details are not configured yet.",
  "Saved Living Library sources": "No account-backed Living Library saves yet.",
  "Saved citations": "No account-backed saved citations yet.",
  "Saved add-ons": "No account-backed Marketplace saves yet.",
  "Public profile fields": "Optional public profile fields are not active yet.",
  "Coding Cornucopia proposal activity": "Coding Cornucopia proposal activity is not configured yet.",
  "Coding Cornucopia proposal posts": "Coding Cornucopia proposal post details are not configured yet.",
  "Troubleshooting Grove activity": "Troubleshooting Grove structured activity is not configured yet.",
  "Troubleshooting Grove review activity": "Troubleshooting Grove review activity is not configured yet.",
  "Troubleshooting Grove linked posts": "Troubleshooting Grove linked post details are not configured yet.",
  "Repository Showcase activity": "Repository Showcase activity is not configured yet.",
  "Repository Showcase review activity": "Repository Showcase review activity is not configured yet.",
  "Official Update activity": "Official Update structured activity is not configured yet.",
  "Official Update review activity": "Official Update review activity is not configured yet."
};

function logBackendDetail(label: string, message: string) {
  if (import.meta.env.DEV) console.warn(`[Commons Circle] ${label}: ${message}`);
}

function friendlyBackendMessage(label: string, message: string) {
  logBackendDetail(label, message);
  if (missingTablePattern.test(message)) return tableReadinessLabels[label] ?? `${label} is not configured yet.`;
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

type ActivePublicCommunePost = {
  id: string;
  title?: string | null;
  post_type?: string | null;
  excerpt?: string | null;
  status?: string | null;
  visibility?: string | null;
  visibility_state?: string | null;
  hidden_at?: string | null;
  removed_at?: string | null;
  archived_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

export function isActivePublicCommunePost(post?: ActivePublicCommunePost | null) {
  if (!post) return false;
  const visibilityState = post.visibility_state ?? "published";
  return post.status === "published"
    && post.visibility === "public"
    && (visibilityState === "published" || visibilityState === "public")
    && !post.hidden_at
    && !post.removed_at
    && !post.archived_at;
}

function uniqueStringIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap((value) => value ? [value] : [])));
}

export function extractCommunePostIdFromActionUrl(actionUrl?: string | null) {
  if (!actionUrl) return null;
  const match = actionUrl.match(/\/commune\/posts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=$|[/?#])/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function notificationCommunePostId(notification: NotificationPreview) {
  const actionPostId = extractCommunePostIdFromActionUrl(notification.action_url);
  if (actionPostId) return actionPostId;
  const sourceType = (notification.source_type ?? "").toLowerCase();
  const notificationType = (notification.notification_type ?? "").toLowerCase();
  if (!notification.source_id) return null;
  if (["commune_post", "commune_posts", "community_vote", "commune_vote_post", "commune_vote_posts"].includes(sourceType)) return notification.source_id;
  if (/commune_post|community_vote_post|commune_vote_post/.test(notificationType) && !/comment|reply/.test(notificationType)) return notification.source_id;
  return null;
}

async function loadActivePublicCommunePostMap(postIds: Array<string | null | undefined>, warnings: string[]) {
  const ids = uniqueStringIds(postIds);
  if (!ids.length || !supabase) return new Map<string, ActivePublicCommunePost>();
  const posts = await safeQuery<ActivePublicCommunePost[]>(
    warnings,
    "Active Commune parent posts",
    supabase
      .from("commune_posts")
      .select("id, title, post_type, excerpt, status, visibility, visibility_state, hidden_at, removed_at, archived_at, published_at, created_at")
      .in("id", ids),
    []
  );
  return new Map(posts.filter(isActivePublicCommunePost).map((post) => [post.id, post]));
}

async function filterNotificationsByActiveCommunePost(notifications: NotificationPreview[], warnings: string[]) {
  const postIds = uniqueStringIds(notifications.map(notificationCommunePostId));
  if (!postIds.length) return notifications;
  const activePosts = await loadActivePublicCommunePostMap(postIds, warnings);
  return notifications.filter((notification) => {
    const postId = notificationCommunePostId(notification);
    return !postId || activePosts.has(postId);
  });
}

async function filterFollowedThreadsByActiveCommunePost<T extends { thread_id: string }>(rows: T[], warnings: string[]) {
  const threadIds = uniqueStringIds(rows.map((row) => row.thread_id));
  if (!threadIds.length || !supabase) return rows;
  const threads = await safeQuery<Array<{ id: string; post_id?: string | null; status?: string | null; visibility?: string | null }>>(
    warnings,
    "Followed Commune thread parent posts",
    supabase.from("commune_threads").select("id, post_id, status, visibility").in("id", threadIds),
    []
  );
  const activePosts = await loadActivePublicCommunePostMap(threads.map((thread) => thread.post_id), warnings);
  const activeThreadIds = new Set(threads
    .filter((thread) => thread.post_id && activePosts.has(thread.post_id) && !["hidden", "removed", "archived"].includes(thread.status ?? "") && (thread.visibility ?? "public") === "public")
    .map((thread) => thread.id));
  return rows.filter((row) => activeThreadIds.has(row.thread_id));
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
      customization: normalizeProfileCustomization(readLocalStorage("commonsCircle.customizationDemo.v1", defaultCustomization)),
      notificationPreferences: defaultNotificationPreferences,
      savedAddons: (profile?.saved_addon_ids ?? []).map((addon_slug) => ({ addon_slug, addon_name: addon_slug })),
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
    safeQuery<Array<{ id?: string | null; media_type: string; bucket?: string | null; storage_path?: string | null; created_at?: string | null }>>(warnings, "Profile media", supabase.from("profile_media").select("id, media_type, bucket, storage_path, created_at").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }), []),
    safeQuery<NotificationPreferences[]>(warnings, "Notification preferences", supabase.from("notification_preferences").select("*").eq("user_id", userId).limit(1), []),
    safeQuery<SavedAddonPreview[]>(warnings, "Saved add-ons", supabase.from("user_saved_addons").select("addon_slug, addon_name, addon_version_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedLivingSourcePreview[]>(warnings, "Saved Living Library sources", supabase.from("user_saved_living_sources").select("id, source_id, source_name, source_url, category, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<SavedCitationPreview[]>(warnings, "Saved citations", supabase.from("user_saved_citations").select("id, source_id, citation_text, citation_format, saved_at").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; title: string; description?: string | null; visibility: string; created_at?: string | null }>>(warnings, "Source collections", supabase.from("user_source_collections").select("id, title, description, visibility, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ collection_id: string; source_id: string }>>(warnings, "Source collection items", supabase.from("user_source_collection_items").select("collection_id, source_id"), []),
    safeQuery<Array<{ id: string; post_id?: string | null; draft_id?: string | null; saved_at?: string | null; notes?: string | null }>>(warnings, "Saved Commune posts", supabase.from("user_saved_commune_posts").select("id, post_id, draft_id, saved_at, notes").eq("user_id", userId).order("saved_at", { ascending: false }).limit(200), []),
    safeQuery<Array<{ id: string; thread_id: string; followed_at?: string | null; last_read_at?: string | null; muted?: boolean | null }>>(warnings, "Followed Commune threads", supabase.from("user_followed_commune_threads").select("id, thread_id, followed_at, last_read_at, muted").eq("user_id", userId).order("followed_at", { ascending: false }).limit(200), []),
    safeQuery<NotificationPreview[]>(warnings, "Notifications", supabase.from("user_notifications").select("id, title, body, action_url, read_at, created_at, notification_type, source_type, source_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(12), []),
    safeQuery<BadgeDefinition[]>(warnings, "Badge definitions", supabase.from("badge_definitions").select("badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active").eq("is_active", true).order("sort_order", { ascending: true }), plannedBadges),
    safeQuery<BadgeAwardRow[]>(warnings, "User badges", supabase.from("user_badges").select(selfBadgeAwardColumns).eq("user_id", userId).is("revoked_at", null), [])
  ]);

  const avatarMedia = mediaRows.find((row) => row.media_type === "avatar");
  const bannerMedia = mediaRows.find((row) => row.media_type === "banner");
  const ownerProfileMediaUrl = async (row: typeof avatarMedia, mediaType: "avatar" | "banner") => {
    if (!row || !supabase) return null;
    const expectedBucket = mediaType === "avatar" ? "profile-avatars" : "profile-banners";
    const expectedFolder = mediaType === "avatar" ? "avatars" : "banners";
    if (
      row.bucket !== expectedBucket
      || typeof row.storage_path !== "string"
      || !row.storage_path.startsWith(`${userId}/${expectedFolder}/`)
    ) {
      warnings.push(`${mediaType === "avatar" ? "Avatar" : "Banner"} preview: the private media reference was invalid.`);
      return null;
    }
    const signed = await supabase.storage.from(expectedBucket).createSignedUrl(row.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) {
      if (signed.error) logBackendDetail(`${mediaType} owner preview`, signed.error.message);
      warnings.push(`${mediaType === "avatar" ? "Avatar" : "Banner"} preview is temporarily unavailable.`);
      return null;
    }
    return signed.data.signedUrl;
  };
  const [avatarUrl, bannerUrl] = await Promise.all([
    ownerProfileMediaUrl(avatarMedia, "avatar"),
    ownerProfileMediaUrl(bannerMedia, "banner")
  ]);
  const canonicalFreeMemberCompletedAt = profile?.commons_onboarding_completed_at ?? null;
  const profileQualifiesForFreeMember = Boolean(canonicalFreeMemberCompletedAt);
  let badgeAwards: BadgeAwardRow[] = [...awarded];
  const hasFreeMemberAward = badgeAwards.some((badge) => badge.badge_key === "free_member" && !badge.revoked_at);
  if (profileQualifiesForFreeMember && !hasFreeMemberAward) {
    const rpcResult = await supabase.rpc("grant_free_member_for_user", { p_target_user_id: userId });
    if (rpcResult.error) {
      logBackendDetail("Free Member badge", rpcResult.error.message);
      badgeAwards = [{ badge_key: "free_member", awarded_at: canonicalFreeMemberCompletedAt as string, award_source: "local_fallback", visibility: "public" }, ...badgeAwards];
    } else {
      const refreshed = await safeQuery<BadgeAwardRow[]>(warnings, "User badges", supabase.from("user_badges").select(selfBadgeAwardColumns).eq("user_id", userId).is("revoked_at", null), []);
      badgeAwards = refreshed.some((badge) => badge.badge_key === "free_member" && !badge.revoked_at)
        ? refreshed
        : [{ badge_key: "free_member", awarded_at: canonicalFreeMemberCompletedAt as string, award_source: "local_fallback", visibility: "public" }, ...badgeAwards];
    }
  }
  const customization = normalizeProfileCustomization({
    ...defaultCustomization,
    ...(customizationRows[0] ?? {}),
    avatar_url: avatarUrl ?? (profile?.avatar_url || null),
    banner_url: bannerUrl ?? customizationRows[0]?.banner_url ?? null,
    avatar_media_id: avatarMedia?.id ?? customizationRows[0]?.avatar_media_id ?? null,
    banner_media_id: bannerMedia?.id ?? customizationRows[0]?.banner_media_id ?? null,
  });
  const collectionSourceIds = collectionItems.reduce<Record<string, string[]>>((collections, item) => ({
    ...collections,
    [item.collection_id]: [...(collections[item.collection_id] ?? []), item.source_id]
  }), {});
  const sourceCollections = collectionRows.map((collection) => ({
    ...collection,
    source_count: collectionSourceIds[collection.id]?.length ?? 0,
    source_ids: collectionSourceIds[collection.id] ?? []
  }));
  const activeSavedCommunePosts = await loadActivePublicCommunePostMap(savedCommuneRows.map((row) => row.post_id), warnings);
  const visibleSavedCommuneRows = savedCommuneRows.filter((row) => row.post_id ? activeSavedCommunePosts.has(row.post_id) : Boolean(row.draft_id));
  const visibleFollowedRows = await filterFollowedThreadsByActiveCommunePost(followedRows, warnings);
  const visibleNotificationRows = await filterNotificationsByActiveCommunePost(notificationRows, warnings);

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
    communePosts: visibleSavedCommuneRows.map((row) => {
      const parentPost = row.post_id ? activeSavedCommunePosts.get(row.post_id) : null;
      return { id: row.id, target_id: row.post_id || row.draft_id || null, title: row.notes || parentPost?.title || row.draft_id || "Saved Commune item", status: "saved", type: row.post_id ? parentPost?.post_type || "post" : "draft", updated_at: row.saved_at ?? undefined, source: "account" };
    }),
    followedThreads: visibleFollowedRows.map((row) => ({ id: row.thread_id, title: `Thread ${row.thread_id.slice(0, 8)}`, unread_count: 0, muted: Boolean(row.muted), source: "account" })),
    notifications: visibleNotificationRows,
    badgeDefinitions: definitions.length ? definitions : plannedBadges,
    userBadges: mergeBadges(definitions.length ? definitions : plannedBadges, badgeAwards),
    localLiving,
    localCommuneDrafts: localCommune,
    localFollowedThreads: localThreads
  };
}

export async function loadSignalConsole(): Promise<SignalConsoleData> {
  const warnings: string[] = [];
  const empty = { signals: [], codeProposalActivity: [], needsMyReview: [], mySubmittedProposals: [], troubleshootingActivity: [], myTroubleshootingIssues: [], troubleshootingNeedingReview: [], troubleshootingResolutionActivity: [], researchNotesActivity: [], myResearchNotes: [], researchNotesNeedingReview: [], researchClarificationActivity: [], repositoryShowcaseActivity: [], myRepositoryShowcases: [], repositoryShowcasesNeedingReview: [], repositorySandboxActivity: [], iterationShowcaseActivity: [], myIterationShowcases: [], iterationShowcasesNeedingReview: [], iterationSandboxActivity: [], jobPostActivity: [], myJobPosts: [], jobPostsNeedingReview: [], jobPostStatusActivity: [], officialUpdateActivity: [], myOfficialUpdates: [], officialUpdatesNeedingAttention: [], communityVoteActivity: [], myCommunityVotes: [], communityVotesNeedingAttention: [], communityVoteLifecycleActivity: [], unreadCount: 0, codeProposalCount: 0, troubleshootingCount: 0, researchNotesCount: 0, repositoryShowcaseCount: 0, iterationShowcaseCount: 0, jobPostCount: 0, officialUpdateCount: 0, communityVoteCount: 0 };
  if (!hasSupabaseConfig || !supabase) return { signedIn: false, supabaseConfigured: false, userId: null, warnings: [supabaseNotConfiguredMessage], ...empty };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) return { signedIn: false, supabaseConfigured: true, userId: null, warnings: [], ...empty };
  const signalRows = await safeQuery<NotificationPreview[]>(warnings, "Notifications", supabase.from("user_notifications").select("id, title, body, action_url, read_at, created_at, notification_type, source_type, source_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(100), []);
  const signals = await filterNotificationsByActiveCommunePost(signalRows, warnings);
  const codeProposalActivityRows = await safeQuery<Omit<CodeProposalSignalPreview, "action_url" | "source_room" | "post_title">[]>(warnings, "Coding Cornucopia proposal activity", supabase.from("commune_code_revision_proposals").select("id, post_id, code_snippet_id, proposer_user_id, original_author_user_id, change_summary, explanation, proposal_status, submitted_at, decided_at, withdrawn_at, hidden_at, created_at, updated_at").or("original_author_user_id.eq." + userId + ",proposer_user_id.eq." + userId).order("created_at", { ascending: false }).limit(100), []);
  const proposalPostIds = Array.from(new Set(codeProposalActivityRows.map((proposal) => proposal.post_id).filter(Boolean)));
  const proposalPostById = await loadActivePublicCommunePostMap(proposalPostIds, warnings);
  const codeProposalActivity = codeProposalActivityRows.filter((proposal) => !proposal.hidden_at && proposal.proposal_status !== "hidden_by_moderation" && proposalPostById.has(proposal.post_id)).map((proposal) => ({
    ...proposal,
    source_room: proposalPostById.get(proposal.post_id)?.post_type === "troubleshooting" ? "troubleshooting_grove" as const : "coding_cornucopia" as const,
    post_title: proposalPostById.get(proposal.post_id)?.title ?? null,
    action_url: (proposalPostById.get(proposal.post_id)?.post_type === "troubleshooting" ? "/commune/troubleshooting-grove/review" : "/commune/coding-cornucopia/review") + "?proposal=" + proposal.id
  }));
  const needsMyReview = codeProposalActivity.filter((proposal) => proposal.original_author_user_id === userId && ["submitted", "needs_changes"].includes(proposal.proposal_status));
  const mySubmittedProposals = codeProposalActivity.filter((proposal) => proposal.proposer_user_id === userId);

  type RepositoryShowcaseSignalRow = Omit<RepositoryShowcaseSignalPreview, "action_url" | "role_context"> & { user_id?: string | null };
  const roleState = await loadCurrentRoleState();
  warnings.push(...roleState.warnings);
  const canReviewCommune = roleState.isAdmin || canReviewDomain(roleState.roles, "commune");
  type TroubleshootingSignalRow = Omit<TroubleshootingSignalPreview, "action_url" | "role_context" | "post_title">;
  const troubleshootingSelect = "id, post_id, thread_id, author_user_id, issue_type, affected_area, troubleshooting_status, accepted_resolution_kind, accepted_summary, accepted_at, resolved_at, closed_at, archived_at, created_at, updated_at";
  const myTroubleshootingRows = await safeQuery<TroubleshootingSignalRow[]>(warnings, "Troubleshooting Grove activity", supabase.from("commune_troubleshooting_posts").select(troubleshootingSelect).eq("author_user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewTroubleshootingRows = canReviewCommune
    ? await safeQuery<TroubleshootingSignalRow[]>(warnings, "Troubleshooting Grove review activity", supabase.from("commune_troubleshooting_posts").select(troubleshootingSelect).in("troubleshooting_status", ["needs_information", "fix_proposed", "in_progress"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const troubleshootingPostIds = Array.from(new Set([...myTroubleshootingRows, ...reviewTroubleshootingRows].map((row) => row.post_id).filter(Boolean) as string[]));
  const troubleshootingPostById = await loadActivePublicCommunePostMap(troubleshootingPostIds, warnings);
  const visibleMyTroubleshootingRows = myTroubleshootingRows.filter((row) => row.post_id && troubleshootingPostById.has(row.post_id));
  const visibleReviewTroubleshootingRows = reviewTroubleshootingRows.filter((row) => row.post_id && troubleshootingPostById.has(row.post_id));
  const mapTroubleshooting = (row: TroubleshootingSignalRow, role: TroubleshootingSignalPreview["role_context"]): TroubleshootingSignalPreview => ({ ...row, post_title: row.post_id ? troubleshootingPostById.get(row.post_id)?.title ?? null : null, action_url: row.post_id ? "/commune/posts/" + row.post_id : "/commune/troubleshooting", role_context: role });
  const myTroubleshootingIssues = visibleMyTroubleshootingRows.map((row) => mapTroubleshooting(row, row.accepted_summary || row.resolved_at || row.closed_at ? "resolution" : "owner"));
  const troubleshootingNeedingReview = visibleReviewTroubleshootingRows.map((row) => mapTroubleshooting(row, "reviewer"));
  const troubleshootingResolutionActivity = [...myTroubleshootingIssues, ...troubleshootingNeedingReview]
    .filter((row) => Boolean(row.accepted_summary || row.accepted_at || row.resolved_at || row.troubleshooting_status === "resolved" || row.troubleshooting_status === "workaround_found"));
  const troubleshootingActivity = Array.from(new Map([...myTroubleshootingIssues, ...troubleshootingNeedingReview, ...troubleshootingResolutionActivity].map((row) => [row.role_context + ":" + row.id, row])).values());

  type ResearchNotesSignalRow = Omit<ResearchNotesSignalPreview, "action_url" | "role_context" | "post_title">;
  const researchSelect = "id, post_id, thread_id, author_user_id, research_question, domain, evidence_strength, review_status, living_library_source_link, correction_note, reviewed_at, corrected_at, archived_at, created_at, updated_at";
  const myResearchRows = await safeQuery<ResearchNotesSignalRow[]>(warnings, "Research Notes activity", supabase.from("commune_research_notes").select(researchSelect).eq("author_user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewResearchRows = canReviewCommune
    ? await safeQuery<ResearchNotesSignalRow[]>(warnings, "Research Notes review activity", supabase.from("commune_research_notes").select(researchSelect).in("review_status", ["submitted", "needs_citation", "needs_clarification", "source_issue", "overclaiming_evidence"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const researchPostIds = Array.from(new Set([...myResearchRows, ...reviewResearchRows].map((row) => row.post_id).filter(Boolean) as string[]));
  const researchPostById = await loadActivePublicCommunePostMap(researchPostIds, warnings);
  const visibleMyResearchRows = myResearchRows.filter((row) => row.post_id && researchPostById.has(row.post_id));
  const visibleReviewResearchRows = reviewResearchRows.filter((row) => row.post_id && researchPostById.has(row.post_id));
  const mapResearch = (row: ResearchNotesSignalRow, role: ResearchNotesSignalPreview["role_context"]): ResearchNotesSignalPreview => ({ ...row, post_title: row.post_id ? researchPostById.get(row.post_id)?.title ?? null : null, action_url: row.post_id ? "/commune/posts/" + row.post_id : "/commune/rooms/research-notes", role_context: role });
  const myResearchNotes = visibleMyResearchRows.map((row) => mapResearch(row, ["needs_citation", "needs_clarification", "source_issue", "overclaiming_evidence"].includes(row.review_status ?? "") ? "clarification" : "owner"));
  const researchNotesNeedingReview = visibleReviewResearchRows.map((row) => mapResearch(row, "reviewer"));
  const researchClarificationActivity = [...myResearchNotes, ...researchNotesNeedingReview]
    .filter((row) => ["needs_citation", "needs_clarification", "source_issue", "overclaiming_evidence", "corrected"].includes(row.review_status ?? "") || Boolean(row.correction_note || row.corrected_at));
  const researchNotesActivity = Array.from(new Map([...myResearchNotes, ...researchNotesNeedingReview, ...researchClarificationActivity].map((row) => [row.role_context + ":" + row.id, row])).values());

  const repoSelect = "id, user_id, post_id, repository_url, project_name, status, sandbox_review_requested, sandbox_review_status, sandbox_review_request_id, created_at, updated_at";
  const myRepoRows = await safeQuery<RepositoryShowcaseSignalRow[]>(warnings, "Repository Showcase activity", supabase.from("commune_repository_showcases").select(repoSelect).eq("user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewRepoRows = canReviewCommune
    ? await safeQuery<RepositoryShowcaseSignalRow[]>(warnings, "Repository Showcase review activity", supabase.from("commune_repository_showcases").select(repoSelect).in("status", ["pending_review", "in_review", "needs_information"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const repoPostById = await loadActivePublicCommunePostMap([...myRepoRows, ...reviewRepoRows].map((row) => row.post_id), warnings);
  const visibleMyRepoRows = myRepoRows.filter((row) => row.post_id && repoPostById.has(row.post_id));
  const visibleReviewRepoRows = reviewRepoRows.filter((row) => row.post_id && repoPostById.has(row.post_id));
  const repoActionUrl = (row: RepositoryShowcaseSignalRow) => {
    if ((row.sandbox_review_requested || row.sandbox_review_status) && (row.id || row.post_id)) {
      const params = new URLSearchParams();
      if (row.post_id) params.set("post", row.post_id);
      if (row.id) params.set("showcase", row.id);
      return "/commune/repository-showcase/sandbox-request?" + params.toString();
    }
    return row.post_id ? "/commune/posts/" + row.post_id : "/commune/repository-showcase/sandbox-request?showcase=" + row.id;
  };
  const mapRepo = (row: RepositoryShowcaseSignalRow, role: RepositoryShowcaseSignalPreview["role_context"]): RepositoryShowcaseSignalPreview => ({ ...row, action_url: repoActionUrl(row), role_context: role });
  const myRepositoryShowcases = visibleMyRepoRows.map((row) => mapRepo(row, row.sandbox_review_requested ? "sandbox" : "owner"));
  const repositoryShowcasesNeedingReview = visibleReviewRepoRows.map((row) => mapRepo(row, "reviewer"));
  const repositorySandboxActivity = [...myRepositoryShowcases, ...repositoryShowcasesNeedingReview]
    .filter((row) => row.sandbox_review_requested || (row.sandbox_review_status && row.sandbox_review_status !== "not_requested"));
  const repositoryShowcaseActivity = Array.from(new Map([...myRepositoryShowcases, ...repositoryShowcasesNeedingReview, ...repositorySandboxActivity].map((row) => [row.role_context + ":" + row.id, row])).values());

  type IterationShowcaseSignalRow = Omit<ElysiaIterationShowcaseSignalPreview, "action_url" | "role_context">;
  const iterationSelect = "id, author_user_id, post_id, iteration_type, version_build_label, status, sandbox_review_requested, sandbox_review_status, sandbox_review_request_id, created_at, updated_at";
  const myIterationRows = await safeQuery<IterationShowcaseSignalRow[]>(warnings, "Elysia Iteration Showcase activity", supabase.from("commune_iteration_showcases").select(iterationSelect).eq("author_user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewIterationRows = canReviewCommune
    ? await safeQuery<IterationShowcaseSignalRow[]>(warnings, "Elysia Iteration Showcase review activity", supabase.from("commune_iteration_showcases").select(iterationSelect).in("status", ["pending_review", "in_review", "needs_information"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const iterationPostById = await loadActivePublicCommunePostMap([...myIterationRows, ...reviewIterationRows].map((row) => row.post_id), warnings);
  const visibleMyIterationRows = myIterationRows.filter((row) => row.post_id && iterationPostById.has(row.post_id));
  const visibleReviewIterationRows = reviewIterationRows.filter((row) => row.post_id && iterationPostById.has(row.post_id));
  const iterationActionUrl = (row: IterationShowcaseSignalRow) => {
    if ((row.sandbox_review_requested || row.sandbox_review_status) && (row.id || row.post_id)) {
      const params = new URLSearchParams();
      if (row.post_id) params.set("post", row.post_id);
      if (row.id) params.set("iteration", row.id);
      return "/commune/elysia-iteration-showcase/sandbox-request?" + params.toString();
    }
    return row.post_id ? "/commune/posts/" + row.post_id : "/commune/elysia-iteration-showcase/sandbox-request?iteration=" + row.id;
  };
  const mapIteration = (row: IterationShowcaseSignalRow, role: ElysiaIterationShowcaseSignalPreview["role_context"]): ElysiaIterationShowcaseSignalPreview => ({ ...row, action_url: iterationActionUrl(row), role_context: role });
  const myIterationShowcases = visibleMyIterationRows.map((row) => mapIteration(row, row.sandbox_review_requested ? "sandbox" : "owner"));
  const iterationShowcasesNeedingReview = visibleReviewIterationRows.map((row) => mapIteration(row, "reviewer"));
  const iterationSandboxActivity = [...myIterationShowcases, ...iterationShowcasesNeedingReview]
    .filter((row) => row.sandbox_review_requested || (row.sandbox_review_status && row.sandbox_review_status !== "not_requested"));
  const iterationShowcaseActivity = Array.from(new Map([...myIterationShowcases, ...iterationShowcasesNeedingReview, ...iterationSandboxActivity].map((row) => [row.role_context + ":" + row.id, row])).values());

  type JobPostSignalRow = Omit<JobPostSignalPreview, "action_url" | "role_context">;
  const jobSelect = "id, post_id, thread_id, author_user_id, role_title, organization_project, role_type, paid_volunteer_status, location_mode, application_status, anti_scam_review_status, public_correction_note, created_at, updated_at";
  const myJobRows = await safeQuery<JobPostSignalRow[]>(warnings, "Job Post activity", supabase.from("commune_job_posts").select(jobSelect).eq("author_user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewJobRows = canReviewCommune
    ? await safeQuery<JobPostSignalRow[]>(warnings, "Job Post review activity", supabase.from("commune_job_posts").select(jobSelect).in("anti_scam_review_status", ["not_reviewed", "needs_pay_clarification", "needs_contact_clarification", "needs_location_clarification", "suspicious"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const jobPostById = await loadActivePublicCommunePostMap([...myJobRows, ...reviewJobRows].map((row) => row.post_id), warnings);
  const visibleMyJobRows = myJobRows.filter((row) => row.post_id && jobPostById.has(row.post_id));
  const visibleReviewJobRows = reviewJobRows.filter((row) => row.post_id && jobPostById.has(row.post_id));
  const mapJob = (row: JobPostSignalRow, role: JobPostSignalPreview["role_context"]): JobPostSignalPreview => ({ ...row, action_url: row.post_id ? "/commune/posts/" + row.post_id : "/commune/rooms/job-post/posts", role_context: role });
  const myJobPosts = visibleMyJobRows.map((row) => mapJob(row, ["filled", "closed", "archived", "needs_clarification"].includes(row.application_status ?? "") ? "status" : "owner"));
  const jobPostsNeedingReview = visibleReviewJobRows.map((row) => mapJob(row, "reviewer"));
  const jobPostStatusActivity = [...myJobPosts, ...jobPostsNeedingReview]
    .filter((row) => ["filled", "closed", "archived", "needs_clarification"].includes(row.application_status ?? "") || ["needs_pay_clarification", "needs_contact_clarification", "needs_location_clarification", "suspicious", "removed"].includes(row.anti_scam_review_status ?? "") || Boolean(row.public_correction_note));
  const jobPostActivity = Array.from(new Map([...myJobPosts, ...jobPostsNeedingReview, ...jobPostStatusActivity].map((row) => [row.role_context + ":" + row.id, row])).values());

  type CommunityVoteSignalRow = Omit<CommunityVoteSignalPreview, "action_url" | "role_context">;
  const voteSelect = "post_id, created_by, question, vote_status, opens_at, closes_at, results_visibility, allow_comments, admin_outcome_summary, official_update_post_id, created_at, updated_at";
  const myCommunityVoteRows = await safeQuery<CommunityVoteSignalRow[]>(warnings, "Community Voting Room activity", supabase.from("commune_vote_posts").select(voteSelect).eq("created_by", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewCommunityVoteRows = canReviewCommune
    ? await safeQuery<CommunityVoteSignalRow[]>(warnings, "Community Voting Room review activity", supabase.from("commune_vote_posts").select(voteSelect).in("vote_status", ["open", "closed", "accepted", "declined", "posted_to_official_update", "archived"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const votePostById = await loadActivePublicCommunePostMap([...myCommunityVoteRows, ...reviewCommunityVoteRows].map((row) => row.post_id), warnings);
  const visibleMyCommunityVoteRows = myCommunityVoteRows.filter((row) => votePostById.has(row.post_id));
  const visibleReviewCommunityVoteRows = reviewCommunityVoteRows.filter((row) => votePostById.has(row.post_id));
  const mapCommunityVote = (row: CommunityVoteSignalRow, role: CommunityVoteSignalPreview["role_context"]): CommunityVoteSignalPreview => ({ ...row, action_url: row.post_id ? "/commune/posts/" + row.post_id : "/commune/rooms/community-vote", role_context: role });
  const voteClosingSoon = (row: CommunityVoteSignalRow) => {
    if (!row.closes_at || row.vote_status !== "open") return false;
    const closesAt = new Date(row.closes_at).getTime();
    if (!Number.isFinite(closesAt)) return false;
    const hours = (closesAt - Date.now()) / (1000 * 60 * 60);
    return hours >= 0 && hours <= 48;
  };
  const myCommunityVotes = visibleMyCommunityVoteRows.map((row) => mapCommunityVote(row, "author"));
  const communityVotesNeedingAttention = visibleReviewCommunityVoteRows
    .filter((row) => voteClosingSoon(row) || row.vote_status === "closed" || ["accepted", "declined", "posted_to_official_update", "archived"].includes(row.vote_status ?? ""))
    .map((row) => mapCommunityVote(row, voteClosingSoon(row) ? "closing_soon" : row.vote_status === "closed" ? "reviewer" : "outcome"));
  const communityVoteLifecycleActivity = [...myCommunityVotes, ...communityVotesNeedingAttention]
    .filter((row) => ["closed", "accepted", "declined", "posted_to_official_update", "archived"].includes(row.vote_status ?? "") || voteClosingSoon(row) || Boolean(row.admin_outcome_summary || row.official_update_post_id));
  const communityVoteActivity = Array.from(new Map([...myCommunityVotes, ...communityVotesNeedingAttention, ...communityVoteLifecycleActivity].map((row) => [row.role_context + ":" + row.post_id, row])).values());

  type OfficialUpdateSignalRow = Omit<OfficialUpdateSignalPreview, "action_url" | "role_context">;
  const officialSelect = "id, post_id, admin_user_id, brand_author_name, update_type, official_status, severity, pinned, important, comments_enabled, correction_status, correction_note, published_at, updated_at";
  const myOfficialRows = await safeQuery<OfficialUpdateSignalRow[]>(warnings, "Official Update activity", supabase.from("commune_official_updates").select(officialSelect).eq("admin_user_id", userId).order("updated_at", { ascending: false }).limit(100), []);
  const reviewOfficialRows = canReviewCommune
    ? await safeQuery<OfficialUpdateSignalRow[]>(warnings, "Official Update review activity", supabase.from("commune_official_updates").select(officialSelect).in("official_status", ["published", "updated", "corrected", "retracted", "monitoring", "resolved"]).order("updated_at", { ascending: false }).limit(100), [])
    : [];
  const officialPostById = await loadActivePublicCommunePostMap([...myOfficialRows, ...reviewOfficialRows].map((row) => row.post_id), warnings);
  const visibleMyOfficialRows = myOfficialRows.filter((row) => row.post_id && officialPostById.has(row.post_id));
  const visibleReviewOfficialRows = reviewOfficialRows.filter((row) => row.post_id && officialPostById.has(row.post_id));
  const mapOfficial = (row: OfficialUpdateSignalRow, role: OfficialUpdateSignalPreview["role_context"]): OfficialUpdateSignalPreview => ({ ...row, action_url: row.post_id ? "/commune/posts/" + row.post_id : "/commune/rooms/official-updates", role_context: role });
  const myOfficialUpdates = visibleMyOfficialRows.map((row) => mapOfficial(row, "author"));
  const officialUpdatesNeedingAttention = visibleReviewOfficialRows.filter((row) => ["critical", "urgent"].includes(row.severity ?? "") || ["retracted", "corrected", "monitoring"].includes(row.official_status ?? "")).map((row) => mapOfficial(row, "reviewer"));
  const officialUpdateActivity = Array.from(new Map([...myOfficialUpdates, ...officialUpdatesNeedingAttention].map((row) => [row.role_context + ":" + row.id, row])).values());
  const proposalNotificationIds = signals
    .filter((signal) => /code_revision|proposal/i.test((signal.notification_type ?? "") + " " + (signal.source_type ?? "")))
    .map((signal) => signal.source_id || signal.id);
  return {
    signedIn: true,
    supabaseConfigured: true,
    userId,
    warnings,
    signals,
    codeProposalActivity,
    needsMyReview,
    mySubmittedProposals,
    troubleshootingActivity,
    myTroubleshootingIssues,
    troubleshootingNeedingReview,
    troubleshootingResolutionActivity,
    researchNotesActivity,
    myResearchNotes,
    researchNotesNeedingReview,
    researchClarificationActivity,
    repositoryShowcaseActivity,
    myRepositoryShowcases,
    repositoryShowcasesNeedingReview,
    repositorySandboxActivity,
    iterationShowcaseActivity,
    myIterationShowcases,
    iterationShowcasesNeedingReview,
    iterationSandboxActivity,
    jobPostActivity,
    myJobPosts,
    jobPostsNeedingReview,
    jobPostStatusActivity,
    officialUpdateActivity,
    myOfficialUpdates,
    officialUpdatesNeedingAttention,
    communityVoteActivity,
    myCommunityVotes,
    communityVotesNeedingAttention,
    communityVoteLifecycleActivity,
    unreadCount: signals.filter((signal) => !signal.read_at).length,
    codeProposalCount: new Set([...codeProposalActivity.map((proposal) => proposal.id), ...proposalNotificationIds]).size,
    troubleshootingCount: new Set(troubleshootingActivity.map((item) => item.id)).size,
    researchNotesCount: new Set(researchNotesActivity.map((item) => item.id)).size,
    repositoryShowcaseCount: new Set(repositoryShowcaseActivity.map((item) => item.id)).size,
    iterationShowcaseCount: new Set(iterationShowcaseActivity.map((item) => item.id)).size,
    jobPostCount: new Set(jobPostActivity.map((item) => item.id)).size,
    officialUpdateCount: new Set(officialUpdateActivity.map((item) => item.id)).size,
    communityVoteCount: new Set(communityVoteActivity.map((item) => item.post_id)).size
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
  const normalized = normalizeProfileCustomization(settings);
  const payload = {
    user_id: auth.user.id,
    theme_mode: normalized.theme_mode,
    accent_color: normalized.accent_color,
    background_style: normalized.background_style,
    decal_set: normalized.decal_set,
    selected_decals: normalized.selected_decals,
    profile_layout: normalized.profile_layout,
    banner_zoom: normalized.banner_zoom,
    banner_position_x: normalized.banner_position_x,
    banner_position_y: normalized.banner_position_y,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("profile_customization").upsert(payload, { onConflict: "user_id" });
  return error ? [friendlyBackendMessage("Profile customization", error.message)] : [];
}

function safeFileSuffix(fileName: string) {
  const suffix = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return suffix || "profile-image";
}

function safeStorageObjectId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure profile-media randomness is unavailable.");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function uploadProfileMedia(file: File, mediaType: "avatar" | "banner"): Promise<{ publicUrl?: string; mediaId?: string | null; warnings: string[] }> {
  if (!supabase) return { warnings: [supabaseNotConfiguredMessage] };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { warnings: ["Sign in before uploading profile media."] };
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) return { warnings: ["Avatar and banner uploads must be PNG, JPG, JPEG, or WebP."] };
  if (file.size > 5 * 1024 * 1024) return { warnings: ["Avatar and banner uploads must be 5 MB or smaller."] };
  const bucket = mediaType === "avatar" ? "profile-avatars" : "profile-banners";
  const folder = mediaType === "avatar" ? "avatars" : "banners";
  const storagePath = `${auth.user.id}/${folder}/${safeStorageObjectId()}-${safeFileSuffix(file.name)}`;
  const upload = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: false, contentType: file.type });
  if (upload.error) return { warnings: [friendlyBackendMessage("Profile media", upload.error.message)] };
  const { data: mediaRow, error } = await supabase.from("profile_media").insert({ user_id: auth.user.id, media_type: mediaType, bucket, storage_path: storagePath, public_url: null, status: "active" }).select("id").single();
  const mediaId = (mediaRow as { id?: string } | null)?.id ?? null;
  const warnings = error ? [friendlyBackendMessage("Profile media", error.message)] : [];
  if (error || !mediaId) {
    const cleanup = await supabase.storage.from(bucket).remove([storagePath]);
    if (cleanup.error) logBackendDetail("Unreferenced profile media cleanup", cleanup.error.message);
    return { warnings };
  }
  const previous = await supabase.from("profile_media").update({ status: "hidden" }).eq("user_id", auth.user.id).eq("media_type", mediaType).eq("status", "active").neq("id", mediaId);
  if (previous.error) logBackendDetail("Profile media replacement", previous.error.message);
  const signed = await supabase.storage.from(bucket).createSignedUrl(storagePath, 300);
  const ownerPreviewUrl = signed.data?.signedUrl;
  if (signed.error || !ownerPreviewUrl) warnings.push(friendlyBackendMessage("Profile media preview", signed.error?.message ?? "Signed preview could not be created."));
  if (!error) {
    const customizationPatch = {
      [mediaType === "avatar" ? "avatar_media_id" : "banner_media_id"]: mediaId,
      updated_at: new Date().toISOString()
    };
    const customizationResult = await supabase.from("profile_customization").upsert({ user_id: auth.user.id, ...customizationPatch }, { onConflict: "user_id" });
    if (customizationResult.error) warnings.push(friendlyBackendMessage("Profile customization", customizationResult.error.message));
    if (mediaType === "avatar") {
      const profileResult = await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", auth.user.id);
      if (profileResult.error) warnings.push(friendlyBackendMessage("Commons Profile avatar", profileResult.error.message));
    }
  }
  return { publicUrl: ownerPreviewUrl, mediaId, warnings };
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
  const { error } = await supabase.from("user_badges").update({ visibility }).eq("user_id", auth.user.id).eq("badge_key", badgeKey).is("revoked_at", null);
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

export async function resolvePublicCommonsProfileHandle(
  username: string
): Promise<PublicProfileHandleResolution | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
  if (!PUBLIC_HANDLE_PATTERN.test(cleanUsername)) return null;
  const { data, error } = await supabase.rpc("resolve_online_public_profile_handle", { p_handle: cleanUsername });
  return error ? null : decodePublicProfileHandleResolution(data);
}

export async function loadPublicCommonsProfile(username: string): Promise<{ data: PublicCommonsProfile | null; warnings: string[] }> {
  const warnings: string[] = [];
  if (!hasSupabaseConfig || !supabase) return { data: null, warnings: [supabaseNotConfiguredMessage] };
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
  const { data: presentationResult, error } = await supabase.rpc("get_public_commons_profile_presentation", { p_handle: cleanUsername });
  if (error) return { data: null, warnings: [friendlyBackendMessage("Commons Profile", error.message)] };
  const presentation = decodePublicProfilePresentation(presentationResult);
  if (!presentation) {
    const resultRecord = plainRecord(Array.isArray(presentationResult) ? presentationResult[0] : presentationResult);
    return Object.keys(resultRecord ?? {}).length === 0
      ? { data: null, warnings: [] }
      : { data: null, warnings: ["Commons Profile: The public presentation contract returned an invalid record, so the profile was hidden safely."] };
  }
  const profileRow: ProfileWithSetup = {
    username: presentation.profile.handle,
    display_name: presentation.profile.displayName ?? `@${presentation.profile.handle}`,
    bio: presentation.profile.shortPublicBio ?? "",
    interests: presentation.profile.interests,
    website_url: presentation.profile.websiteUrl,
    github_url: presentation.profile.githubUrl,
    avatar_url: presentation.profile.avatarUrl,
    organization: presentation.profile.organization,
    headline: presentation.profile.headline,
    featured_public_links: presentation.publicLinks,
    is_developer: presentation.profile.isDeveloper,
    is_admin: false,
    saved_addon_ids: [],
    commons_onboarding_completed_at: null,
  };
  const definitions = await safeQuery<BadgeDefinition[]>(
    warnings,
    "Public badges",
    supabase.from("badge_definitions")
      .select("badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    plannedBadges
  );
  const visibility = presentation.visibility;
  return {
    data: {
      profile: profileRow,
      visibility,
      customization: presentation.customization,
      badges: visibility.show_badges ? mergeBadges(
        definitions.length ? definitions : plannedBadges,
        presentation.publicBadges
      ).filter((badge) => badge.visibility === "public") : [],
      publicCollections: visibility.show_source_collections ? presentation.publicCollections : [],
      publicLinks: presentation.publicLinks,
      publicCommunePosts: visibility.show_commune_posts ? presentation.publicCommunePosts : [],
      publicCommuneComments: visibility.show_commune_posts ? presentation.publicCommuneComments : [],
      isOwner: presentation.isOwner
    },
    warnings
  };
}

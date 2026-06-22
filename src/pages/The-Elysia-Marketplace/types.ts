export type TrustTier =
  | "official"
  | "reviewed"
  | "community"
  | "unreviewed"
  | "deprecated"
  | "blocked";

export type AddonCategory =
  | "Files"
  | "Research / Web"
  | "Models"
  | "Data / Science"
  | "GIS"
  | "Services"
  | "Robotics / Field"
  | "Developer Tools"
  | "Security"
  | "External Managers";

export type AddonStatus =
  | "available"
  | "saved"
  | "pending_review"
  | "approved"
  | "rejected"
  | "deprecated"
  | "security_hold"
  | "revoked";

export type ActionKind =
  | "python_package_install"
  | "python_package_uninstall"
  | "docker_compose_setup"
  | "docker_compose_start"
  | "docker_compose_stop"
  | "docker_compose_restart"
  | "config_toggle"
  | "open_external_manager"
  | "manual_instruction"
  | "setup_script";

export type RiskLevel = "low" | "moderate" | "high" | "critical" | "unknown";

export type CatalogSourceState =
  | "supabase_not_configured"
  | "supabase_connected"
  | "supabase_query_failed"
  | "supabase_empty_seed_fallback"
  | "seed_fallback_active";

export type AddonDependency = {
  ecosystem: string;
  package_name: string;
  source?: string;
  version_constraint?: string;
  required: boolean;
};

export type AddonAction = {
  action_key: string;
  action_label: string;
  action_kind: ActionKind;
  allowed: boolean;
  risk_level: RiskLevel;
  requires_local_operator_password: boolean;
  network_access?: boolean;
  notes: string[];
};

export type AddonManifest = {
  schema_version: string;
  id: string;
  name: string;
  publisher: string;
  version: string;
  category: AddonCategory;
  summary: string;
  description: string;
  trust_tier: TrustTier;
  local_only: boolean;
  network_access: boolean;
  dependencies: AddonDependency[];
  actions: AddonAction[];
  security: {
    operator_only: boolean;
    model_accessible: boolean;
    chat_accessible: boolean;
    memory_promotion_allowed: boolean;
    outward_sharing_allowed: boolean;
    local_file_access: "none" | "selected_files_only" | "project_scope" | "broad";
    outward_sharing_risk?: string;
  };
  tags: string[];
  homepage_url?: string;
  source_url?: string;
  license?: string;
  status?: AddonStatus;
  marketplace_listing_id?: string;
  marketplace_addon_version_id?: string;
  signature_status?: "unsigned" | "pending" | "signed" | "signature_failed" | string;
  package_sha256?: string;
  revocation_reason?: string;
};

export type CatalogFilters = {
  search: string;
  category: "all" | AddonCategory;
  trustTier: "all" | TrustTier;
  locality: "all" | "local_only" | "networked";
};

export type MarketplaceProfile = {
  id?: string;
  username: string;
  display_name: string;
  headline?: string | null;
  bio: string;
  interests?: string | null;
  website_url?: string | null;
  github_url?: string | null;
  organization?: string | null;
  featured_public_links?: FeaturedPublicLink[];
  is_developer: boolean;
  is_admin: boolean;
  saved_addon_ids: string[];
  commons_onboarding_completed_at?: string | null;
  stewardship_onboarding_skipped_at?: string | null;
  work_with_onboarding_skipped_at?: string | null;
};

export type MarketplaceProfileDraft = {
  username: string;
  display_name: string;
  headline?: string;
  bio: string;
  interests?: string;
  website_url?: string;
  github_url?: string;
  organization?: string;
  featured_public_links?: FeaturedPublicLink[];
  is_developer: boolean;
};

export type FeaturedPublicLink = {
  label: string;
  url: string;
  kind?: string;
};

export type Publisher = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  verified: boolean;
};

export type AddonSubmission = {
  id: string;
  addon_name: string;
  slug: string;
  publisher_name: string;
  category: AddonCategory;
  summary: string;
  review_status: "draft" | "submitted" | "needs_changes" | "approved" | "rejected" | "deprecated" | "security_hold";
  manifest: AddonManifest | null;
  notes: string;
};

export type MarketplaceApiResult<T> = {
  data: T;
  demoMode: boolean;
  warnings: string[];
  sourceState?: CatalogSourceState;
  statusMessage?: string;
  supabaseConfigured?: boolean;
  seedFallbackActive?: boolean;
};

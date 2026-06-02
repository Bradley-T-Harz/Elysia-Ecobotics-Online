create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  website_url text,
  github_url text,
  avatar_url text,
  is_developer boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists publishers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  website_url text,
  github_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists addons (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid references publishers(id) on delete set null,
  slug text unique not null,
  name text not null,
  summary text not null,
  description text not null,
  category text not null,
  trust_tier text not null default 'unreviewed',
  status text not null default 'draft',
  latest_version text,
  homepage_url text,
  source_url text,
  license text,
  local_only boolean not null default true,
  network_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trust_tier in ('official','reviewed','community','unreviewed','deprecated','blocked')),
  check (status in ('draft','submitted','needs_changes','approved','rejected','deprecated','security_hold'))
);

create table if not exists addon_versions (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid references addons(id) on delete cascade,
  version text not null,
  manifest jsonb not null,
  review_status text not null default 'draft',
  review_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(addon_id, version),
  check (review_status in ('draft','submitted','needs_changes','approved','rejected','deprecated','security_hold'))
);

create table if not exists addon_dependencies (
  id uuid primary key default gen_random_uuid(),
  addon_version_id uuid not null references addon_versions(id) on delete cascade,
  ecosystem text not null,
  package_name text not null,
  version_constraint text,
  required boolean not null default true,
  source text
);

create table if not exists addon_actions (
  id uuid primary key default gen_random_uuid(),
  addon_version_id uuid not null references addon_versions(id) on delete cascade,
  action_key text not null,
  action_label text not null,
  action_kind text not null,
  allowed boolean not null default false,
  risk_level text not null default 'unknown',
  requires_local_operator_password boolean not null default true,
  manifest_fragment jsonb not null default '{}'::jsonb
);

create table if not exists user_saved_addons (
  user_id uuid not null references profiles(id) on delete cascade,
  addon_slug text not null references addons(slug) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key(user_id, addon_slug)
);

create table if not exists addon_reviews (
  id uuid primary key default gen_random_uuid(),
  addon_version_id uuid not null references addon_versions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  decision text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Future only: local Elysia pairing should use short-lived codes and never share local passwords.
-- create table device_links (...);

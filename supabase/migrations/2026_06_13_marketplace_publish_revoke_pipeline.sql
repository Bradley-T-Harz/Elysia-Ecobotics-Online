-- Marketplace publish/revoke pipeline for reviewed Developer Forge submissions.
-- Website publication remains a catalog/review action only. Local Elysia remains the
-- final installer/runtime/permission authority, and package inspection never
-- executes uploaded code.

create extension if not exists pgcrypto;

alter table public.addon_submissions
  add column if not exists reviewer_feedback text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  addon_id text unique not null,
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  source_submission_id uuid references public.addon_submissions(id) on delete set null,
  name text not null,
  slug text unique not null,
  summary text,
  description text,
  category text,
  tags text[] default '{}',
  icon_url text,
  current_version text,
  listing_status text not null default 'draft',
  risk_level text default 'unknown',
  permission_summary text,
  compatibility_summary text,
  published_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listings_status_check check (listing_status in ('draft','submitted','approved','published','hidden','removed','archived','revoked'))
);

create table if not exists public.marketplace_addon_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  version text not null,
  manifest_json jsonb not null default '{}'::jsonb,
  package_id uuid references public.addon_packages(id) on delete set null,
  package_sha256 text,
  package_size bigint,
  signature_status text not null default 'unsigned',
  compatibility_status text default 'unknown',
  review_status text default 'approved',
  published_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_addon_versions_signature_check check (signature_status in ('unsigned','pending','signed','signature_failed')),
  constraint marketplace_addon_versions_review_check check (review_status in ('pending','changes_requested','approved','rejected','security_hold','published','revoked'))
);

alter table public.marketplace_addon_versions
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete cascade,
  add column if not exists version text,
  add column if not exists manifest_json jsonb not null default '{}'::jsonb,
  add column if not exists package_id uuid references public.addon_packages(id) on delete set null,
  add column if not exists package_sha256 text,
  add column if not exists package_size bigint,
  add column if not exists signature_status text not null default 'unsigned',
  add column if not exists compatibility_status text default 'unknown',
  add column if not exists review_status text default 'approved',
  add column if not exists published_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists marketplace_addon_versions_listing_version_idx on public.marketplace_addon_versions(listing_id, version);
create index if not exists marketplace_listings_status_idx on public.marketplace_listings(listing_status, revoked_at);

create table if not exists public.marketplace_publication_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_publication_events_action_check check (action in ('approved','published','revoked','hidden','removed','archived','restored','changes_requested','rejected','security_hold'))
);

alter table public.marketplace_revocations
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete cascade,
  add column if not exists marketplace_addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null,
  add column if not exists revoked_by_user uuid references auth.users(id) on delete set null,
  add column if not exists public_notice text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

alter table public.marketplace_install_intents
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete set null,
  add column if not exists marketplace_addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null;

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_addon_versions enable row level security;
alter table public.marketplace_publication_events enable row level security;
alter table public.marketplace_revocations enable row level security;
alter table public.marketplace_install_intents enable row level security;

drop policy if exists "public reads published marketplace listings" on public.marketplace_listings;
create policy "public reads published marketplace listings" on public.marketplace_listings for select
  using (listing_status = 'published' and revoked_at is null);

drop policy if exists "developers read own marketplace listings" on public.marketplace_listings;
create policy "developers read own marketplace listings" on public.marketplace_listings for select to authenticated
  using (exists (select 1 from public.addon_submissions s where s.id = source_submission_id and s.submitted_by = auth.uid()));

drop policy if exists "marketplace reviewers manage marketplace listings" on public.marketplace_listings;
create policy "marketplace reviewers manage marketplace listings" on public.marketplace_listings for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "public reads published marketplace versions" on public.marketplace_addon_versions;
create policy "public reads published marketplace versions" on public.marketplace_addon_versions for select
  using (revoked_at is null and exists (select 1 from public.marketplace_listings ml where ml.id = listing_id and ml.listing_status = 'published' and ml.revoked_at is null));

drop policy if exists "developers read own marketplace versions" on public.marketplace_addon_versions;
create policy "developers read own marketplace versions" on public.marketplace_addon_versions for select to authenticated
  using (exists (select 1 from public.marketplace_listings ml join public.addon_submissions s on s.id = ml.source_submission_id where ml.id = listing_id and s.submitted_by = auth.uid()));

drop policy if exists "marketplace reviewers manage marketplace versions" on public.marketplace_addon_versions;
create policy "marketplace reviewers manage marketplace versions" on public.marketplace_addon_versions for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "marketplace reviewers read publication events" on public.marketplace_publication_events;
create policy "marketplace reviewers read publication events" on public.marketplace_publication_events for select to authenticated
  using (public.current_user_can_review_domain('marketplace'));

drop policy if exists "marketplace reviewers write publication events" on public.marketplace_publication_events;
create policy "marketplace reviewers write publication events" on public.marketplace_publication_events for insert to authenticated
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "public reads active marketplace revocations" on public.marketplace_revocations;
drop policy if exists "public revocations readable" on public.marketplace_revocations;
create policy "public reads active marketplace revocations" on public.marketplace_revocations for select
  using (is_active = true);

drop policy if exists "marketplace reviewers manage revocations" on public.marketplace_revocations;
create policy "marketplace reviewers manage revocations" on public.marketplace_revocations for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "users insert own install intents" on public.marketplace_install_intents;
drop policy if exists "users create own install intents" on public.marketplace_install_intents;
create policy "users insert own install intents" on public.marketplace_install_intents for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      listing_id is null
      or exists (select 1 from public.marketplace_listings ml where ml.id = listing_id and ml.listing_status = 'published' and ml.revoked_at is null)
    )
    and (
      marketplace_addon_version_id is null
      or exists (
        select 1 from public.marketplace_addon_versions mav
        join public.marketplace_listings ml on ml.id = mav.listing_id
        where mav.id = marketplace_addon_version_id
          and mav.revoked_at is null
          and ml.listing_status = 'published'
          and ml.revoked_at is null
      )
    )
  );

grant select on table public.marketplace_listings to anon, authenticated;
grant select on table public.marketplace_addon_versions to anon, authenticated;
grant select on table public.marketplace_revocations to anon, authenticated;
grant select, insert, update, delete on table public.marketplace_listings to authenticated;
grant select, insert, update, delete on table public.marketplace_addon_versions to authenticated;
grant select, insert on table public.marketplace_publication_events to authenticated;
grant select, insert, update on table public.marketplace_revocations to authenticated;
grant select, insert, update on table public.marketplace_install_intents to authenticated;

-- Commons Circle homebase and public profile system.
-- Private saved/request material remains private by default. Badges are recognition, not authority.

create extension if not exists pgcrypto;

alter table public.user_saved_addons
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists addon_id uuid references public.addons(id) on delete set null,
  add column if not exists addon_version_id uuid references public.addon_versions(id) on delete set null,
  add column if not exists addon_name text,
  add column if not exists notes text;

create table if not exists public.user_saved_living_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  source_name text not null,
  source_url text,
  category text,
  saved_at timestamptz not null default now(),
  notes text,
  unique(user_id, source_id)
);

create table if not exists public.user_saved_citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  citation_text text not null,
  citation_format text default 'plain',
  saved_at timestamptz not null default now()
);

create table if not exists public.user_source_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility in ('private','public','unlisted'))
);

create table if not exists public.user_source_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.user_source_collections(id) on delete cascade,
  source_id text not null,
  added_at timestamptz not null default now(),
  unique(collection_id, source_id)
);

create table if not exists public.user_saved_commune_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid,
  draft_id uuid,
  saved_at timestamptz not null default now(),
  last_read_at timestamptz,
  notes text
);

create table if not exists public.user_followed_commune_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  followed_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  unique(user_id, thread_id)
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  source_type text,
  source_id uuid,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  commune_replies boolean not null default true,
  followed_threads boolean not null default true,
  marketplace_updates boolean not null default true,
  living_library_updates boolean not null default true,
  review_status_updates boolean not null default true,
  admin_queue_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_visibility_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_display_name boolean not null default true,
  show_bio boolean not null default true,
  show_interests boolean not null default true,
  show_website boolean not null default true,
  show_github boolean not null default true,
  show_badges boolean not null default true,
  show_stewardship_recognition boolean not null default true,
  show_saved_addons boolean not null default false,
  show_saved_sources boolean not null default false,
  show_source_collections boolean not null default true,
  show_commune_posts boolean not null default true,
  show_work_with_status boolean not null default false,
  show_developer_status boolean not null default true,
  show_member_tier boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_customization (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_mode text not null default 'starlit_archive',
  accent_color text default '#8ee8dc',
  background_style text default 'soft_cyber_garden',
  banner_media_id uuid,
  avatar_media_id uuid,
  decal_set text default 'none',
  selected_decals text[] default '{}',
  profile_layout text default 'classic_homebase',
  updated_at timestamptz not null default now(),
  check (theme_mode in ('deep_grove','starlit_archive','solar_meadow','moonlit_reef','aether_blue','high_contrast'))
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  bucket text not null,
  storage_path text not null,
  public_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(bucket, storage_path),
  check (media_type in ('avatar','banner')),
  check (bucket in ('profile-avatars','profile-banners')),
  check (status in ('active','hidden','removed'))
);

create table if not exists public.profile_decals (
  id uuid primary key default gen_random_uuid(),
  decal_key text unique not null,
  name text not null,
  image_path text,
  category text,
  unlock_condition text,
  is_active boolean not null default true
);

create table if not exists public.user_profile_decals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decal_key text not null references public.profile_decals(decal_key),
  placement text not null default 'profile_card_corner',
  created_at timestamptz not null default now()
);

create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  badge_key text unique not null,
  name text not null,
  description text not null,
  badge_type text not null,
  icon_path text,
  category text,
  rarity text not null default 'common',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null references public.badge_definitions(badge_key),
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  award_reason text,
  visibility text not null default 'public',
  unique(user_id, badge_key),
  check (visibility in ('public','private','hidden'))
);

insert into public.profile_decals (decal_key, name, category, unlock_condition) values
  ('leaf_glyph', 'Leaf Glyph', 'stewardship', 'Available by default'),
  ('water_ripple', 'Water Ripple', 'stewardship', 'Available by default'),
  ('star_map', 'Star Map', 'aether', 'Available by default'),
  ('mushroom_badge', 'Mushroom Badge', 'ecology', 'Available by default'),
  ('circuit_vine', 'Circuit Vine', 'developer', 'Available by default'),
  ('pollinator', 'Pollinator', 'ecology', 'Available by default'),
  ('wetland_reed', 'Wetland Reed', 'water', 'Available by default'),
  ('moon_crest', 'Moon Crest', 'archive', 'Available by default'),
  ('robotic_seed', 'Robotic Seed', 'ecobotics', 'Available by default')
on conflict (decal_key) do nothing;

insert into public.badge_definitions (badge_key, name, description, badge_type, category, rarity) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', 'membership', 'common'),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', 'stewardship', 'uncommon'),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', 'water', 'uncommon'),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', 'forest', 'uncommon'),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', 'reef', 'uncommon'),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', 'health', 'uncommon'),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', 'knowledge', 'uncommon'),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', 'living_library', 'rare'),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', 'commune', 'rare'),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', 'developer', 'rare'),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', 'membership', 'founding'),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires user_roles.', 'review', 'authority-linked', 'epic')
on conflict (badge_key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-avatars', 'profile-avatars', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('profile-banners', 'profile-banners', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.user_saved_living_sources enable row level security;
alter table public.user_saved_citations enable row level security;
alter table public.user_source_collections enable row level security;
alter table public.user_source_collection_items enable row level security;
alter table public.user_saved_commune_posts enable row level security;
alter table public.user_followed_commune_threads enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.profile_visibility_settings enable row level security;
alter table public.profile_customization enable row level security;
alter table public.profile_media enable row level security;
alter table public.profile_decals enable row level security;
alter table public.user_profile_decals enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;

-- Private saved shelves: owner only.
drop policy if exists "users manage own saved living sources" on public.user_saved_living_sources;
create policy "users manage own saved living sources" on public.user_saved_living_sources for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved citations" on public.user_saved_citations;
create policy "users manage own saved citations" on public.user_saved_citations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved commune posts" on public.user_saved_commune_posts;
create policy "users manage own saved commune posts" on public.user_saved_commune_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own followed commune threads" on public.user_followed_commune_threads;
create policy "users manage own followed commune threads" on public.user_followed_commune_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Collections: owner manages; public can read public collection summaries/items.
drop policy if exists "users manage own source collections" on public.user_source_collections;
create policy "users manage own source collections" on public.user_source_collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads public source collections" on public.user_source_collections;
create policy "public reads public source collections" on public.user_source_collections for select using (visibility = 'public');
drop policy if exists "users manage own source collection items" on public.user_source_collection_items;
create policy "users manage own source collection items" on public.user_source_collection_items for all to authenticated using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid())) with check (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid()));
drop policy if exists "public reads public source collection items" on public.user_source_collection_items;
create policy "public reads public source collection items" on public.user_source_collection_items for select using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.visibility = 'public'));

-- Notifications and preferences are private owner data.
drop policy if exists "users manage own notifications" on public.user_notifications;
create policy "users manage own notifications" on public.user_notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Visibility/customization: owner manages, public reads the presentation controls only.
drop policy if exists "users manage own visibility settings" on public.profile_visibility_settings;
create policy "users manage own visibility settings" on public.profile_visibility_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads visibility settings" on public.profile_visibility_settings;
create policy "public reads visibility settings" on public.profile_visibility_settings for select using (true);
drop policy if exists "users manage own profile customization" on public.profile_customization;
create policy "users manage own profile customization" on public.profile_customization for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads profile customization" on public.profile_customization;
create policy "public reads profile customization" on public.profile_customization for select using (true);

-- Public profile media is only avatar/banner. Never use these buckets for resumes or receipts.
drop policy if exists "users manage own profile media" on public.profile_media;
create policy "users manage own profile media" on public.profile_media for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and bucket in ('profile-avatars','profile-banners'));
drop policy if exists "public reads active profile media" on public.profile_media;
create policy "public reads active profile media" on public.profile_media for select using (status = 'active' and bucket in ('profile-avatars','profile-banners'));
drop policy if exists "users upload own profile avatars" on storage.objects;
create policy "users upload own profile avatars" on storage.objects for insert to authenticated with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update own profile avatars" on storage.objects;
create policy "users update own profile avatars" on storage.objects for update to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete own profile avatars" on storage.objects;
create policy "users delete own profile avatars" on storage.objects for delete to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads profile avatars" on storage.objects;
create policy "public reads profile avatars" on storage.objects for select using (bucket_id = 'profile-avatars');
drop policy if exists "users upload own profile banners" on storage.objects;
create policy "users upload own profile banners" on storage.objects for insert to authenticated with check (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update own profile banners" on storage.objects;
create policy "users update own profile banners" on storage.objects for update to authenticated using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete own profile banners" on storage.objects;
create policy "users delete own profile banners" on storage.objects for delete to authenticated using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads profile banners" on storage.objects;
create policy "public reads profile banners" on storage.objects for select using (bucket_id = 'profile-banners');

-- Decals are curated. Users choose from active decals only.
drop policy if exists "public reads active profile decals" on public.profile_decals;
create policy "public reads active profile decals" on public.profile_decals for select using (is_active = true);
drop policy if exists "users manage own profile decals" on public.user_profile_decals;
create policy "users manage own profile decals" on public.user_profile_decals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads user public profile decals" on public.user_profile_decals;
create policy "public reads user public profile decals" on public.user_profile_decals for select using (true);

-- Badges are recognition, not authority. Users cannot award official badges to themselves.
drop policy if exists "public reads active badge definitions" on public.badge_definitions;
create policy "public reads active badge definitions" on public.badge_definitions for select using (is_active = true);
drop policy if exists "public reads visible user badges" on public.user_badges;
create policy "public reads visible user badges" on public.user_badges for select using (visibility = 'public');
drop policy if exists "users read own badges" on public.user_badges;
create policy "users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());
drop policy if exists "users update own badge visibility" on public.user_badges;
create policy "users update own badge visibility" on public.user_badges for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admins award badges" on public.user_badges;
create policy "admins award badges" on public.user_badges for insert to authenticated with check (public.current_user_is_admin() and user_id <> auth.uid());
drop policy if exists "admins manage badges" on public.user_badges;
create policy "admins manage badges" on public.user_badges for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

grant select, insert, update, delete on table public.user_saved_living_sources to authenticated;
grant select, insert, update, delete on table public.user_saved_citations to authenticated;
grant select, insert, update, delete on table public.user_source_collections to authenticated;
grant select, insert, update, delete on table public.user_source_collection_items to authenticated;
grant select, insert, update, delete on table public.user_saved_commune_posts to authenticated;
grant select, insert, update, delete on table public.user_followed_commune_threads to authenticated;
grant select, insert, update, delete on table public.user_notifications to authenticated;
grant select, insert, update, delete on table public.notification_preferences to authenticated;
grant select, insert, update, delete on table public.profile_visibility_settings to authenticated;
grant select on table public.profile_visibility_settings to anon;
grant select, insert, update, delete on table public.profile_customization to authenticated;
grant select on table public.profile_customization to anon;
grant select, insert, update, delete on table public.profile_media to authenticated;
grant select on table public.profile_media to anon;
grant select on table public.profile_decals to anon, authenticated;
grant select, insert, update, delete on table public.user_profile_decals to authenticated;
grant select on table public.user_profile_decals to anon;
grant select on table public.badge_definitions to anon, authenticated;
grant select, update on table public.user_badges to authenticated;
grant select on table public.user_badges to anon;

-- Commons Circle homebase table readiness fix.
-- Keeps account-backed shelves, notifications, and badges available without exposing private user data.

create extension if not exists pgcrypto;

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
  updated_at timestamptz not null default now()
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

create unique index if not exists user_saved_commune_posts_user_post_unique on public.user_saved_commune_posts(user_id, post_id) where post_id is not null;

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
  unique(user_id, badge_key)
);

create table if not exists public.user_saved_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  addon_id uuid,
  addon_version_id uuid,
  addon_slug text,
  addon_name text,
  saved_at timestamptz not null default now(),
  notes text
);

create unique index if not exists user_saved_addons_user_slug_unique on public.user_saved_addons(user_id, addon_slug) where addon_slug is not null;

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common'),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', '/images/badges/Stewardship_Supporter.png', 'stewardship', 'uncommon'),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', '/images/badges/Water_Steward.png', 'water', 'uncommon'),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', '/images/badges/Forest_Steward.png', 'forest', 'uncommon'),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', '/images/badges/Reef_Steward.png', 'reef', 'uncommon'),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', '/images/badges/Health_Steward.png', 'health', 'uncommon'),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', '/images/badges/Knowledge_Commons_Supporter.png', 'knowledge', 'uncommon'),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', '/images/badges/Source_Curator.png', 'living-library', 'rare'),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', '/images/badges/Troubleshooting_Helper.png', 'commune', 'rare'),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', '/images/badges/Developer_Contributor.png', 'developer', 'rare'),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', '/images/badges/Founding_Steward.png', 'membership', 'epic'),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires roles assigned by administrators.', 'review', '/images/badges/Guardian_Reviewer.png', 'authority-linked', 'epic'),
  ('seed_sower', 'Seed Sower', 'Recognition for planting a first useful contribution in the public commons.', 'contributor', '/images/badges/Seed_Sower.png', 'contribution', 'common'),
  ('bridge_builder', 'Bridge Builder', 'Recognition for helping people, projects, ideas, and resources find each other.', 'community', '/images/badges/Bridge_Builder.png', 'community', 'uncommon'),
  ('archive_warden', 'Archive Warden', 'Recognition for preserving records, improving sources, checking links, and strengthening public memory.', 'archive', '/images/badges/Archive_Warden.png', 'archive', 'uncommon'),
  ('forge_tester', 'Forge Tester', 'Recognition for careful testing, bug reports, compatibility notes, and safe release feedback.', 'testing', '/images/badges/Forge_Tester.png', 'testing', 'rare'),
  ('field_witness', 'Field Witness', 'Recognition for public ecological observations, field evidence, maps, restoration notes, or environmental records.', 'ecology', '/images/badges/Field_Witness.png', 'fieldwork', 'rare'),
  ('radiant_scribe', 'Radiant Scribe', 'Recognition for clear writing, tutorials, research notes, guides, and public learning contributions.', 'writing', '/images/badges/Radiant_Scribe.png', 'writing', 'rare'),
  ('hearth_keeper', 'Hearth Keeper', 'Recognition for trusted moderation and care of the public Commune.', 'moderation', '/images/badges/Hearth_Keeper.png', 'authority-linked', 'epic'),
  ('ecobotics_forgewright', 'Ecobotics Forgewright', 'Recognition for robotics, hardware, ecological devices, and physical system contributions.', 'ecobotics', '/images/badges/Ecobotics_Forgewright.png', 'robotics', 'epic'),
  ('elysian_artwright', 'Elysian Artwright', 'Recognition for visual art, concept work, icons, and imagery that help give Elysia Ecobotics a living face.', 'art', '/images/badges/Elysian_Artwright.png', 'art', 'rare'),
  ('kindred_ally', 'Kindred Ally', 'Recognition for helping allied people, friends, collaborators, and associated projects with care and usefulness.', 'community', '/images/badges/Kindred_Ally.png', 'allied-service', 'uncommon'),
  ('open_pathmaker', 'Open Pathmaker', 'Recognition for making the Commons easier, clearer, and more accessible for more people.', 'accessibility', '/images/badges/Open_Pathmaker.png', 'accessibility', 'rare'),
  ('boundary_lantern', 'Boundary Lantern', 'Recognition for strengthening privacy, consent, safety, and ethical boundaries in the public commons.', 'safety', '/images/badges/Boundary_Lantern.png', 'privacy', 'rare')
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  badge_type = excluded.badge_type,
  icon_path = excluded.icon_path,
  category = excluded.category,
  rarity = excluded.rarity,
  is_active = true;

alter table public.user_saved_living_sources enable row level security;
alter table public.user_saved_citations enable row level security;
alter table public.user_source_collections enable row level security;
alter table public.user_source_collection_items enable row level security;
alter table public.user_saved_commune_posts enable row level security;
alter table public.user_followed_commune_threads enable row level security;
alter table public.user_notifications enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;
alter table public.user_saved_addons enable row level security;

drop policy if exists "users manage own saved living sources" on public.user_saved_living_sources;
create policy "users manage own saved living sources" on public.user_saved_living_sources for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved citations" on public.user_saved_citations;
create policy "users manage own saved citations" on public.user_saved_citations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own source collections" on public.user_source_collections;
create policy "users manage own source collections" on public.user_source_collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads public source collections" on public.user_source_collections;
create policy "public reads public source collections" on public.user_source_collections for select using (visibility = 'public');
drop policy if exists "users manage own source collection items" on public.user_source_collection_items;
create policy "users manage own source collection items" on public.user_source_collection_items for all to authenticated using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid())) with check (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid()));
drop policy if exists "public reads public source collection items" on public.user_source_collection_items;
create policy "public reads public source collection items" on public.user_source_collection_items for select using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.visibility = 'public'));
drop policy if exists "users manage own saved commune posts" on public.user_saved_commune_posts;
create policy "users manage own saved commune posts" on public.user_saved_commune_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own followed commune threads" on public.user_followed_commune_threads;
create policy "users manage own followed commune threads" on public.user_followed_commune_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own notifications" on public.user_notifications;
create policy "users manage own notifications" on public.user_notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads active badge definitions" on public.badge_definitions;
create policy "public reads active badge definitions" on public.badge_definitions for select using (is_active = true);
drop policy if exists "public reads visible user badges" on public.user_badges;
create policy "public reads visible user badges" on public.user_badges for select using (visibility = 'public');
drop policy if exists "users read own badges" on public.user_badges;
create policy "users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());
drop policy if exists "users update own badge visibility" on public.user_badges;
create policy "users update own badge visibility" on public.user_badges for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved addons" on public.user_saved_addons;
create policy "users manage own saved addons" on public.user_saved_addons for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'current_user_is_admin') then
    drop policy if exists "admins award badges" on public.user_badges;
    create policy "admins award badges" on public.user_badges for insert to authenticated with check (public.current_user_is_admin() and user_id <> auth.uid());
    drop policy if exists "admins manage badges" on public.user_badges;
    create policy "admins manage badges" on public.user_badges for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
  end if;
end $$;

grant select, insert, update, delete on table public.user_saved_living_sources to authenticated;
grant select, insert, update, delete on table public.user_saved_citations to authenticated;
grant select, insert, update, delete on table public.user_source_collections to authenticated;
grant select, insert, update, delete on table public.user_source_collection_items to authenticated;
grant select on table public.user_source_collections to anon;
grant select on table public.user_source_collection_items to anon;
grant select, insert, update, delete on table public.user_saved_commune_posts to authenticated;
grant select, insert, update, delete on table public.user_followed_commune_threads to authenticated;
grant select, insert, update, delete on table public.user_notifications to authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select, update on table public.user_badges to authenticated;
grant select on table public.user_badges to anon;
grant select, insert, update, delete on table public.user_saved_addons to authenticated;

revoke all on table public.user_saved_living_sources from anon;
revoke all on table public.user_saved_citations from anon;
revoke all on table public.user_saved_commune_posts from anon;
revoke all on table public.user_followed_commune_threads from anon;
revoke all on table public.user_notifications from anon;
revoke all on table public.user_saved_addons from anon;

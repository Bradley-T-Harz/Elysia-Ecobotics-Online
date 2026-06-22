-- Commons Circle public profile field repair.
-- These are explicit, user-controlled public profile fields. They do not grant
-- administrator, reviewer, moderator, developer trust, or other authority.

alter table public.profiles
  add column if not exists organization text,
  add column if not exists headline text,
  add column if not exists featured_public_links jsonb not null default '[]'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_featured_public_links_array_check;

alter table public.profiles
  add constraint profiles_featured_public_links_array_check
  check (jsonb_typeof(featured_public_links) = 'array');

comment on column public.profiles.organization is
  'Optional public organization/affiliation text entered by the Commons Profile owner.';

comment on column public.profiles.headline is
  'Optional public Commons Profile headline entered by the profile owner.';

comment on column public.profiles.featured_public_links is
  'Optional public links entered by the profile owner. Expected item shape: {"label": "...", "url": "https://...", "kind": "website"}.';

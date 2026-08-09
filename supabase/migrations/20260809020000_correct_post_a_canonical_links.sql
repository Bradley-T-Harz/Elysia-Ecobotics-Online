-- Correct two stale same-origin destinations on the existing published Job Post.
-- The guard permits clean database bootstraps where this production row is absent,
-- accepts an already-corrected row, and refuses to overwrite any unexpected edits.

begin;

do $$
declare
  current_links text[];
  old_links constant text[] := array[
    'The Elysia Commune | https://elysiaecobotics.com/commune',
    'Community Guidelines | https://elysiaecobotics.com/community-guidelines',
    'Work With Elysia Ecobotics | https://elysiaecobotics.com/work-with'
  ]::text[];
  canonical_links constant text[] := array[
    'The Elysia Commune | https://elysiaecobotics.com/commune',
    'Community Guidelines | https://elysiaecobotics.com/legal/community-guidelines',
    'Work With Elysia Ecobotics | https://elysiaecobotics.com/work-with-elysia-ecobotics'
  ]::text[];
begin
  select links
  into current_links
  from public.commune_posts
  where id = '9af957a1-4164-498d-8dc0-6356c71d21a7'::uuid
  for update;

  if not found then
    raise notice 'Post A is absent; no production content correction is needed in this database.';
    return;
  end if;

  if current_links is not distinct from canonical_links then
    return;
  end if;

  if current_links is distinct from old_links then
    raise exception 'Post A links no longer match the reviewed correction precondition.';
  end if;

  update public.commune_posts
  set links = canonical_links,
      updated_at = now()
  where id = '9af957a1-4164-498d-8dc0-6356c71d21a7'::uuid;
end
$$;

commit;

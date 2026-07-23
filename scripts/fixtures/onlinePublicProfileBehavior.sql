\set ON_ERROR_STOP on

begin;

-- Synthetic disposable identities only. The fixture proves that the original
-- Online public-profile confirmation remains public without publishing the
-- newer shared cross-site card.
insert into auth.users(
  id, email, email_confirmed_at, created_at, updated_at
)
values (
  'fa000000-0000-4000-8000-000000000001',
  'legacy-online-profile@example.invalid',
  now(), now(), now()
);

insert into public.profiles(
  id, username, display_name, bio, headline, organization, interests,
  website_url, github_url, featured_public_links, is_developer,
  commons_onboarding_completed_at
)
values (
  'fa000000-0000-4000-8000-000000000001',
  'fixture-online-public',
  'Fixture Online Public',
  'Synthetic pre-cutover Online Commons Profile.',
  'Fixture ecological systems builder',
  'Fixture Commons',
  'Ecological robotics',
  'https://example.invalid/profile',
  'https://example.invalid/code',
  '[{"label":"Fixture work","url":"https://example.invalid/work","kind":"website","ignored":"must-not-leak"}]'::jsonb,
  true,
  '2026-07-17 23:59:59+00'
);

insert into private.account_participation(
  user_id, participation_state, age_band, assurance_status
)
values (
  'fa000000-0000-4000-8000-000000000001',
  'read_only', 'unknown', 'not_collected'
)
on conflict (user_id) do update
set participation_state = excluded.participation_state,
    age_band = excluded.age_band,
    assurance_status = excluded.assurance_status,
    assurance_method = null,
    assurance_provider = null,
    assurance_expires_at = null,
    updated_at = now();

update public.profile_public_cards
set public_profile_enabled = false,
    short_public_bio = null
where user_id = 'fa000000-0000-4000-8000-000000000001';

insert into public.profile_handle_history(
  handle, profile_user_id, replaced_by_handle, retired_at
)
values (
  'fixture-online-old',
  'fa000000-0000-4000-8000-000000000001',
  'fixture-online-public',
  now()
);

do $online_legacy_contract$
declare
  v_presentation jsonb;
  v_resolution jsonb;
  v_shared_count integer;
begin
  select pg_catalog.count(*) into v_shared_count
  from public.get_public_profile_card('fixture-online-public');
  if v_shared_count <> 0 then
    raise exception 'legacy Online compatibility published the shared cross-site card';
  end if;

  v_presentation := public.get_public_commons_profile_presentation(
    'fixture-online-public'
  );
  if v_presentation #>> '{profile,handle}' <> 'fixture-online-public'
     or v_presentation #>> '{profile,displayName}' <> 'Fixture Online Public'
     or v_presentation #>> '{profile,shortPublicBio}'
          <> 'Synthetic pre-cutover Online Commons Profile.'
     or v_presentation #>> '{profile,headline}'
          <> 'Fixture ecological systems builder'
     or v_presentation #>> '{profile,organization}' <> 'Fixture Commons'
     or v_presentation #>> '{profile,interests}' <> 'Ecological robotics'
     or v_presentation #>> '{profile,websiteUrl}'
          <> 'https://example.invalid/profile'
     or v_presentation #>> '{profile,githubUrl}'
          <> 'https://example.invalid/code'
     or (v_presentation #>> '{profile,isDeveloper}')::boolean is not true
     or v_presentation #>> '{publicLinks,0,label}' <> 'Fixture work'
     or v_presentation #>> '{publicLinks,0,url}'
          <> 'https://example.invalid/work'
     or (v_presentation #> '{publicLinks,0}') ? 'ignored'
     or v_presentation #>> '{profile,canonicalProfileUrl}'
          <> 'https://elysiaecobotics.com/commons-circle/@fixture-online-public'
     or v_presentation ? 'userId'
     or (v_presentation -> 'profile') ? 'userId'
     or v_presentation::text ~* 'email|objectKey|storageProvider|privateReason'
     or v_presentation::text ~
          'fa000000-0000-4000-8000-000000000001' then
    raise exception 'legacy Online public presentation drifted or leaked: %',
      v_presentation;
  end if;

  v_resolution := public.resolve_online_public_profile_handle(
    'fixture-online-old'
  );
  if v_resolution ->> 'requestedHandle' <> 'fixture-online-old'
     or v_resolution ->> 'currentHandle' <> 'fixture-online-public'
     or (v_resolution ->> 'redirect')::boolean is not true
     or v_resolution ? 'userId'
     or v_resolution::text ~
          'fa000000-0000-4000-8000-000000000001' then
    raise exception 'legacy Online handle resolution drifted or leaked: %',
      v_resolution;
  end if;

  if public.get_public_commons_profile_presentation(
       'fixture-online-missing'
     ) <> '{}'::jsonb
     or public.resolve_online_public_profile_handle(
       'fixture-online-missing'
     ) <> '{}'::jsonb then
    raise exception 'nonexistent Online profile did not remain fail-closed';
  end if;
end
$online_legacy_contract$;

set local role anon;
do $online_anon_acl_contract$
declare
  v_presentation jsonb;
begin
  v_presentation := public.get_public_commons_profile_presentation(
    '@fixture-online-public'
  );
  if v_presentation #>> '{profile,handle}' <> 'fixture-online-public' then
    raise exception 'anonymous caller could not read safe Online presentation';
  end if;
  if has_function_privilege(
       'anon',
       'public.get_online_public_profile_avatar_asset(uuid)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.get_online_public_profile_banner_asset(uuid)',
       'execute'
     ) then
    raise exception 'anonymous caller inherited private media lookup authority';
  end if;
end
$online_anon_acl_contract$;
reset role;

-- A new audited owner choice permanently supersedes the legacy compatibility
-- path even if a stale card value were to remain.
insert into private.profile_publication_events(
  client_request_id, user_id, enabled, short_public_bio
)
values (
  gen_random_uuid(),
  'fa000000-0000-4000-8000-000000000001',
  false,
  null
);

do $online_explicit_choice_contract$
begin
  if public.get_public_commons_profile_presentation(
       'fixture-online-public'
     ) <> '{}'::jsonb
     or public.resolve_online_public_profile_handle(
       'fixture-online-old'
     ) <> '{}'::jsonb then
    raise exception 'audited publication decision did not suppress legacy compatibility';
  end if;
end
$online_explicit_choice_contract$;

rollback;

\echo 'Online public profile compatibility behavior checks ok.'

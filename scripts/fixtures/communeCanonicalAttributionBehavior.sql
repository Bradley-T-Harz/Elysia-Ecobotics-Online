\set ON_ERROR_STOP on

begin;

-- Synthetic disposable identity and content only. Snapshot attribution remains
-- handle A while the profile legitimately advances to handle B.
insert into auth.users(
  id, email, email_confirmed_at, created_at, updated_at
)
values (
  'fb000000-0000-4000-8000-000000000001',
  'canonical-author@example.invalid',
  now(), now(), now()
);

insert into public.profiles(
  id, username, display_name, commons_onboarding_completed_at
)
values (
  'fb000000-0000-4000-8000-000000000001',
  'fixture-author-a',
  'Fixture Canonical Author',
  now()
);

insert into private.account_participation(
  user_id, participation_state, age_band, assurance_status
)
values (
  'fb000000-0000-4000-8000-000000000001',
  'read_only', 'unknown', 'not_collected'
)
on conflict (user_id) do update
set participation_state = excluded.participation_state,
    age_band = excluded.age_band,
    assurance_status = excluded.assurance_status,
    updated_at = now();

insert into public.commune_rooms(
  id, slug, name, room_type, requires_moderation
)
values (
  'fb100000-0000-4000-8000-000000000001',
  'fixture-canonical-room',
  'Fixture Canonical Room',
  'community',
  false
);

insert into public.commune_posts(
  id, user_id, author_username, post_type, title, body, status, visibility,
  visibility_state, published_at
)
values (
  'fb200000-0000-4000-8000-000000000001',
  'fb000000-0000-4000-8000-000000000001',
  'fixture-author-a',
  'community_network',
  'Fixture historical post',
  'The immutable fixture post body.',
  'published',
  'public',
  'published',
  now()
);

insert into public.commune_threads(
  id, post_id, room_id, title, created_by, status, visibility
)
values (
  'fb300000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000001',
  'fb100000-0000-4000-8000-000000000001',
  'Fixture discussion',
  'fb000000-0000-4000-8000-000000000001',
  'open',
  'public'
);

insert into public.commune_comments(
  id, thread_id, post_id, parent_comment_id, user_id, author_username,
  body, status, visibility_state, published_at
)
values
  (
    'fb400000-0000-4000-8000-000000000001',
    'fb300000-0000-4000-8000-000000000001',
    'fb200000-0000-4000-8000-000000000001',
    null,
    'fb000000-0000-4000-8000-000000000001',
    'fixture-author-a',
    'The immutable fixture comment.',
    'published',
    'published',
    now()
  ),
  (
    'fb400000-0000-4000-8000-000000000002',
    'fb300000-0000-4000-8000-000000000001',
    'fb200000-0000-4000-8000-000000000001',
    'fb400000-0000-4000-8000-000000000001',
    'fb000000-0000-4000-8000-000000000001',
    'fixture-author-a',
    'The immutable fixture reply.',
    'published',
    'published',
    now()
  );

insert into public.commune_realtime_rooms(
  id, slug, title, visibility_state, posting_mode, created_by
)
values (
  'fb500000-0000-4000-8000-000000000001',
  'fixture-canonical-chat',
  'Fixture Canonical Chat',
  'published',
  'open_signed_in',
  'fb000000-0000-4000-8000-000000000001'
);

insert into public.commune_realtime_messages(
  id, room_id, room_slug, author_user_id, body, body_plain, visibility_state
)
values (
  'fb600000-0000-4000-8000-000000000001',
  'fb500000-0000-4000-8000-000000000001',
  'fixture-canonical-chat',
  'fb000000-0000-4000-8000-000000000001',
  'The immutable fixture realtime message.',
  'The immutable fixture realtime message.',
  'published'
);

update public.profiles
set username = 'fixture-author-b',
    display_name = 'Fixture Canonical Author B'
where id = 'fb000000-0000-4000-8000-000000000001';

set local role anon;

do $canonical_attribution_contract$
declare
  v_rows jsonb;
  v_resolution jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(attribution)), '[]')
  into v_rows
  from public.resolve_public_commune_attributions(
    array['fb200000-0000-4000-8000-000000000001'::uuid],
    array[
      'fb400000-0000-4000-8000-000000000001'::uuid,
      'fb400000-0000-4000-8000-000000000002'::uuid
    ],
    array['fb600000-0000-4000-8000-000000000001'::uuid]
  ) as attribution;

  if pg_catalog.jsonb_array_length(v_rows) <> 4
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_rows) as item
       where item ->> 'author_handle' <> 'fixture-author-b'
          or item ->> 'canonical_profile_url'
             <> 'https://elysiaecobotics.com/commons-circle/@fixture-author-b'
          or (item ->> 'viewer_is_owner')::boolean
     )
     or v_rows::text ~
          'fb000000-0000-4000-8000-000000000001'
     or v_rows::text ~* 'author_user_id|user_id|email|storage|credential'
     or v_rows::text ~ 'fixture-author-a' then
    raise exception 'canonical Commune attribution drifted or leaked: %',
      v_rows;
  end if;

  v_resolution := public.resolve_online_public_profile_handle(
    'fixture-author-a'
  );
  if v_resolution ->> 'currentHandle' <> 'fixture-author-b'
     or (v_resolution ->> 'redirect')::boolean is not true then
    raise exception 'historical handle did not resolve canonically: %',
      v_resolution;
  end if;
end
$canonical_attribution_contract$;

reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'fb000000-0000-4000-8000-000000000001',
  true
);

do $signed_in_owner_attribution_contract$
begin
  if exists (
    select 1
    from public.resolve_public_commune_attributions(
      array['fb200000-0000-4000-8000-000000000001'::uuid],
      array['fb400000-0000-4000-8000-000000000001'::uuid],
      array['fb600000-0000-4000-8000-000000000001'::uuid]
    )
    where not viewer_is_owner
  ) then
    raise exception 'signed-in owner attribution lost bounded ownership state';
  end if;
end
$signed_in_owner_attribution_contract$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);

do $content_immutability_contract$
begin
  if (
    select author_username <> 'fixture-author-a'
      or body <> 'The immutable fixture post body.'
      or user_id <> 'fb000000-0000-4000-8000-000000000001'::uuid
    from public.commune_posts
    where id = 'fb200000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.commune_comments
    where id in (
      'fb400000-0000-4000-8000-000000000001',
      'fb400000-0000-4000-8000-000000000002'
    )
      and author_username <> 'fixture-author-a'
  ) then
    raise exception 'canonical read projection rewrote authored content';
  end if;
end
$content_immutability_contract$;

-- Deleted, restricted, and explicitly unpublished accounts must fall back to
-- anonymous attribution rather than leaking either current or snapshot handle.
update auth.users
set deleted_at = now()
where id = 'fb000000-0000-4000-8000-000000000001';

do $deleted_attribution_contract$
begin
  if exists (
    select 1
    from public.resolve_public_commune_attributions(
      array['fb200000-0000-4000-8000-000000000001'::uuid],
      '{}'::uuid[],
      '{}'::uuid[]
    )
  ) then
    raise exception 'deleted account retained public Commune attribution';
  end if;
end
$deleted_attribution_contract$;

update auth.users
set deleted_at = null
where id = 'fb000000-0000-4000-8000-000000000001';

update private.account_participation
set participation_state = 'suspended'
where user_id = 'fb000000-0000-4000-8000-000000000001';

do $restricted_attribution_contract$
begin
  if exists (
    select 1
    from public.resolve_public_commune_attributions(
      array['fb200000-0000-4000-8000-000000000001'::uuid],
      '{}'::uuid[],
      '{}'::uuid[]
    )
  ) then
    raise exception 'restricted account retained public Commune attribution';
  end if;
end
$restricted_attribution_contract$;

update private.account_participation
set participation_state = 'read_only'
where user_id = 'fb000000-0000-4000-8000-000000000001';

insert into private.profile_publication_events(
  client_request_id, user_id, enabled
)
values (
  gen_random_uuid(),
  'fb000000-0000-4000-8000-000000000001',
  false
);

do $private_attribution_contract$
begin
  if exists (
    select 1
    from public.resolve_public_commune_attributions(
      array['fb200000-0000-4000-8000-000000000001'::uuid],
      array['fb400000-0000-4000-8000-000000000001'::uuid],
      array['fb600000-0000-4000-8000-000000000001'::uuid]
    )
  ) then
    raise exception 'unpublished account retained public Commune attribution';
  end if;
end
$private_attribution_contract$;

do $attribution_acl_contract$
begin
  if not has_function_privilege(
       'anon',
       'public.resolve_public_commune_attributions(uuid[],uuid[],uuid[])',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_public_commune_attributions(uuid[],uuid[],uuid[])',
       'execute'
     ) then
    raise exception 'bounded Commune attribution RPC ACL drifted';
  end if;
end
$attribution_acl_contract$;

rollback;

\echo 'Canonical Commune attribution behavior checks ok.'

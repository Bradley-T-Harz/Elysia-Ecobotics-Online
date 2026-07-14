\set ON_ERROR_STOP on

-- This fixture runs only in the disposable Supabase Postgres container created
-- by sandboxDatabaseMigrationTest.mjs. Every identifier and token is synthetic.

do $catalog_assertions$
declare
  v_missing integer;
  v_unsafe integer;
  v_old_rpc oid := 'public.record_commune_sandbox_run_result(text,text,text,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,text,integer,integer,jsonb)'::regprocedure;
  v_reaction_trigger oid := 'public.sync_commune_content_reaction_totals()'::regprocedure;
begin
  select count(*) into v_missing
  from (
    values
      ('provider'), ('default_branch'), ('commit_sha'), ('manifest_status'),
      ('elysia_compatibility'), ('short_description'), ('readme_preview'),
      ('file_tree_preview'), ('screenshot_notes_or_urls'), ('risk_flags'),
      ('sandbox_review_status'), ('sandbox_review_request_id'), ('import_source'),
      ('imported_metadata'), ('imported_at'), ('redaction_notes')
  ) as required(column_name)
  where not exists (
    select 1 from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'commune_repository_showcases'
      and column_info.column_name = required.column_name
  );
  if v_missing <> 0 then raise exception 'repository_fields_missing:%', v_missing; end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'commune_repository_showcases_sandbox_review_status_check'
      and conrelid = 'public.commune_repository_showcases'::regclass
      and convalidated
  ) then raise exception 'repository_constraint_missing_or_unvalidated'; end if;

  if (select count(*) from pg_catalog.pg_indexes
      where schemaname = 'public'
        and indexname in (
          'commune_repository_showcases_post_idx',
          'commune_repository_showcases_owner_status_idx',
          'commune_repository_showcases_sandbox_review_idx',
          'commune_repository_showcases_sandbox_request_idx'
        )) <> 4 then raise exception 'repository_indexes_missing'; end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as view_info
    join pg_catalog.pg_namespace as namespace_info on namespace_info.oid = view_info.relnamespace
    where namespace_info.nspname = 'public'
      and view_info.relname = 'commune_content_reaction_counts'
      and view_info.relkind = 'v'
      and pg_catalog.pg_get_userbyid(view_info.relowner) = 'postgres'
      and coalesce(view_info.reloptions, '{}'::text[]) @> array[
        'security_invoker=true',
        'security_barrier=true'
      ]::text[]
      and pg_catalog.pg_get_viewdef(view_info.oid, true) like '%commune_content_reaction_totals%'
  ) then raise exception 'reaction_count_view_not_security_invoker'; end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_info
    join pg_catalog.pg_namespace as namespace_info on namespace_info.oid = table_info.relnamespace
    where namespace_info.nspname = 'public'
      and table_info.relname = 'commune_content_reaction_totals'
      and table_info.relkind = 'r'
      and table_info.relrowsecurity
      and pg_catalog.pg_get_userbyid(table_info.relowner) = 'postgres'
  ) then raise exception 'reaction_totals_rls_or_owner_missing'; end if;

  if not pg_catalog.has_table_privilege('anon', 'public.commune_content_reaction_counts', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.commune_content_reaction_counts', 'SELECT')
     or not pg_catalog.has_table_privilege('anon', 'public.commune_content_reaction_totals', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.commune_content_reaction_totals', 'SELECT')
  then raise exception 'reaction_count_select_grants_missing'; end if;

  if pg_catalog.has_table_privilege('anon', 'public.commune_content_reaction_totals', 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
     or pg_catalog.has_table_privilege('authenticated', 'public.commune_content_reaction_totals', 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
     or pg_catalog.has_table_privilege('service_role', 'public.commune_content_reaction_totals', 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
  then raise exception 'reaction_totals_unsafe_grant'; end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy as policy_info
    where policy_info.polrelid = 'public.commune_content_reaction_totals'::regclass
      and policy_info.polname = 'visible content reaction totals are readable'
  ) then raise exception 'reaction_totals_visibility_policy_missing'; end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_info
    where trigger_info.tgrelid = 'public.commune_content_reactions'::regclass
      and trigger_info.tgname = 'sync_commune_content_reaction_totals'
      and not trigger_info.tgisinternal
      and trigger_info.tgenabled = 'O'
  ) then raise exception 'reaction_totals_trigger_missing'; end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as function_info
    where function_info.oid = v_reaction_trigger
      and function_info.prosecdef
      and pg_catalog.pg_get_userbyid(function_info.proowner) = 'postgres'
      and coalesce(function_info.proconfig, '{}'::text[]) @> array['search_path=""']::text[]
  ) then raise exception 'reaction_totals_trigger_security_failed'; end if;

  if pg_catalog.has_function_privilege('anon', v_reaction_trigger, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_reaction_trigger, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_reaction_trigger, 'EXECUTE')
     or exists (
       select 1
       from pg_catalog.aclexplode(coalesce(
         (select proacl from pg_catalog.pg_proc where oid = v_reaction_trigger),
         pg_catalog.acldefault('f', (select proowner from pg_catalog.pg_proc where oid = v_reaction_trigger))
       )) as acl
       where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     )
  then raise exception 'reaction_totals_trigger_executable'; end if;

  if pg_catalog.has_function_privilege('anon', v_old_rpc, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_old_rpc, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_old_rpc, 'EXECUTE')
     or exists (
       select 1
       from pg_catalog.aclexplode(coalesce(
         (select proacl from pg_catalog.pg_proc where oid = v_old_rpc),
         pg_catalog.acldefault('f', (select proowner from pg_catalog.pg_proc where oid = v_old_rpc))
       )) as acl
       where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     )
  then raise exception 'legacy_result_rpc_still_executable'; end if;

  select count(*) into v_unsafe
  from pg_catalog.pg_proc as function_info
  join pg_catalog.pg_namespace as namespace_info on namespace_info.oid = function_info.pronamespace
  where namespace_info.nspname in ('public', 'private')
    and function_info.proname in (
      'enforce_sandbox_run_status_transition', 'sandbox_finalizer_token_is_valid',
      'sandbox_actor_is_active', 'sandbox_source_is_authorized',
      'current_user_sandbox_access', 'reserve_commune_sandbox_run',
      'start_commune_sandbox_run', 'finalize_commune_sandbox_run',
      'reconcile_stale_commune_sandbox_runs'
    )
    and (
      not function_info.prosecdef
      or pg_catalog.pg_get_userbyid(function_info.proowner) <> 'postgres'
      or not coalesce(function_info.proconfig, '{}'::text[]) @> array['search_path=""']::text[]
      or exists (
        select 1 from pg_catalog.aclexplode(coalesce(function_info.proacl, pg_catalog.acldefault('f', function_info.proowner))) as acl
        where (acl.grantee = 0 or acl.grantee = 'anon'::regrole)
          and acl.privilege_type = 'EXECUTE'
      )
    );
  if v_unsafe <> 0 then raise exception 'protected_function_security_failure:%', v_unsafe; end if;

  if (select count(*) from pg_catalog.pg_proc as function_info
      join pg_catalog.pg_namespace as namespace_info on namespace_info.oid = function_info.pronamespace
      where namespace_info.nspname in ('public', 'private')
        and function_info.proname in (
          'enforce_sandbox_run_status_transition', 'sandbox_finalizer_token_is_valid',
          'sandbox_actor_is_active', 'sandbox_source_is_authorized',
          'current_user_sandbox_access', 'reserve_commune_sandbox_run',
          'start_commune_sandbox_run', 'finalize_commune_sandbox_run',
          'reconcile_stale_commune_sandbox_runs'
        )) <> 9 then raise exception 'protected_function_count_mismatch'; end if;

  foreach v_old_rpc in array array[
    'public.commune_sandbox_runs'::regclass::oid,
    'public.commune_code_diagnostics'::regclass::oid
  ] loop
    if exists (
      select 1
      from pg_catalog.pg_class as table_info,
           lateral pg_catalog.aclexplode(coalesce(table_info.relacl, pg_catalog.acldefault('r', table_info.relowner))) as acl
      where table_info.oid = v_old_rpc
        and (acl.grantee = 0 or acl.grantee in ('anon'::regrole, 'authenticated'::regrole))
        and acl.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN')
    ) then raise exception 'unsafe_sandbox_table_grant:%', v_old_rpc::regclass; end if;
  end loop;

  if not pg_catalog.has_table_privilege('authenticated', 'public.commune_sandbox_runs', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.commune_code_diagnostics', 'SELECT')
  then raise exception 'sandbox_select_grant_missing'; end if;

  if exists (
    select 1
    from private.sandbox_proxy_secrets
    where secret_name = 'sandbox_db_finalizer' and secret_hash_hex is not null
  ) then raise exception 'finalizer_hash_must_start_null'; end if;
end
$catalog_assertions$;

insert into auth.users(id, email, banned_until, deleted_at, is_anonymous, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'active-viewer@example.invalid', null, null, false, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'banned@example.invalid', now() + interval '1 day', null, false, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'deleted@example.invalid', null, now(), false, now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'anonymous@example.invalid', null, null, true, now(), now()),
  ('55555555-5555-4555-8555-555555555555', 'profileless@example.invalid', null, null, false, now(), now()),
  ('66666666-6666-4666-8666-666666666666', 'owner@example.invalid', null, null, false, now(), now()),
  ('77777777-7777-4777-8777-777777777777', 'reviewer@example.invalid', null, null, false, now(), now()),
  ('88888888-8888-4888-8888-888888888888', 'admin@example.invalid', null, null, false, now(), now()),
  ('99999999-9999-4999-8999-999999999999', 'quota@example.invalid', null, null, false, now(), now());

insert into public.profiles(id, username, is_admin)
values
  ('11111111-1111-4111-8111-111111111111', 'active_viewer', false),
  ('22222222-2222-4222-8222-222222222222', 'banned_user', false),
  ('33333333-3333-4333-8333-333333333333', 'deleted_user', false),
  ('44444444-4444-4444-8444-444444444444', 'anonymous_user', false),
  ('66666666-6666-4666-8666-666666666666', 'source_owner', false),
  ('77777777-7777-4777-8777-777777777777', 'source_reviewer', false),
  ('88888888-8888-4888-8888-888888888888', 'sandbox_admin', true),
  ('99999999-9999-4999-8999-999999999999', 'quota_user', false);

insert into public.user_roles(user_id, role)
values ('77777777-7777-4777-8777-777777777777', 'commune_moderator');

insert into public.commune_posts(id, user_id, post_type, title, body, status, visibility)
values
  ('a1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'code_sharing', 'Public snippet', 'Public', 'published', 'public'),
  ('a2222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'code_sharing', 'Private snippet', 'Private', 'published', 'private_draft'),
  ('b1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'repository_showcase', 'Public repository', 'Public', 'published', 'public'),
  ('b2222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'repository_showcase', 'Private repository', 'Private', 'published', 'private_draft');

insert into public.commune_code_snippets(id, post_id, author_user_id, language, file_name, code_text)
values
  ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'python', 'public.py', 'print(1)'),
  ('c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'python', 'private.py', 'print(2)');

insert into public.commune_repository_showcases(id, user_id, post_id, repository_url, status)
values
  ('d1111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'b1111111-1111-4111-8111-111111111111', 'https://example.invalid/public', 'approved'),
  ('d2222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'b2222222-2222-4222-8222-222222222222', 'https://example.invalid/private', 'approved');

insert into public.commune_content_reactions(id, user_id, target_type, target_id, reaction)
values
  ('01000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'post', 'a1111111-1111-4111-8111-111111111111', 'helpful'),
  ('01000000-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', 'post', 'a1111111-1111-4111-8111-111111111111', 'caution'),
  ('01000000-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666', 'post', 'a2222222-2222-4222-8222-222222222222', 'helpful');

set role anon;
do $anon_rls$
begin
  if (select count(*) from public.commune_code_snippets) <> 1 then raise exception 'anon_snippet_rls_failed'; end if;
  if (select count(*) from public.commune_repository_showcases) <> 1 then raise exception 'anon_repository_rls_failed'; end if;
  if not exists (
    select 1
    from public.commune_content_reaction_counts
    where target_type = 'post'
      and target_id = 'a1111111-1111-4111-8111-111111111111'
      and helpful_count = 1
      and caution_count = 1
  ) then raise exception 'anon_public_reaction_counts_failed'; end if;
  if exists (
    select 1
    from public.commune_content_reaction_counts
    where target_id = 'a2222222-2222-4222-8222-222222222222'
  ) then raise exception 'anon_private_reaction_counts_exposed'; end if;
  if (select count(*) from public.commune_content_reaction_totals) <> 1 then raise exception 'anon_reaction_totals_rls_failed'; end if;
end
$anon_rls$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $viewer_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if coalesce((v_access ->> 'authorized')::boolean, false) is not true then raise exception 'active_access_denied:%', v_access; end if;
  if (select count(*) from public.commune_code_snippets) <> 1 then raise exception 'viewer_snippet_rls_failed'; end if;
  if (select count(*) from public.commune_repository_showcases) <> 1 then raise exception 'viewer_repository_rls_failed'; end if;
  if (select count(*) from public.commune_content_reaction_counts) <> 1 then raise exception 'viewer_private_reaction_counts_exposed'; end if;
  if (select count(*) from public.commune_content_reactions where user_id = auth.uid()) <> 1 then raise exception 'viewer_own_reaction_read_failed'; end if;

  insert into public.commune_content_reactions(user_id, target_type, target_id, reaction, updated_at)
  values (auth.uid(), 'post', 'a1111111-1111-4111-8111-111111111111', 'caution', pg_catalog.now())
  on conflict (user_id, target_type, target_id) do update
    set reaction = excluded.reaction,
        updated_at = excluded.updated_at;
  if not exists (
    select 1 from public.commune_content_reaction_counts
    where target_id = 'a1111111-1111-4111-8111-111111111111'
      and helpful_count = 0 and caution_count = 2
  ) then raise exception 'reaction_upsert_aggregate_update_failed'; end if;

  insert into public.commune_content_reactions(user_id, target_type, target_id, reaction, updated_at)
  values (auth.uid(), 'post', 'a1111111-1111-4111-8111-111111111111', 'helpful', pg_catalog.now())
  on conflict (user_id, target_type, target_id) do update
    set reaction = excluded.reaction,
        updated_at = excluded.updated_at;
  delete from public.commune_content_reactions
  where target_type = 'post'
    and target_id = 'a1111111-1111-4111-8111-111111111111';
  if not exists (
    select 1 from public.commune_content_reaction_counts
    where target_id = 'a1111111-1111-4111-8111-111111111111'
      and helpful_count = 0 and caution_count = 1
  ) then raise exception 'reaction_delete_aggregate_update_failed'; end if;

  insert into public.commune_content_reactions(user_id, target_type, target_id, reaction)
  values (auth.uid(), 'post', 'a1111111-1111-4111-8111-111111111111', 'helpful');
  if not exists (
    select 1 from public.commune_content_reaction_counts
    where target_id = 'a1111111-1111-4111-8111-111111111111'
      and helpful_count = 1 and caution_count = 1
  ) then raise exception 'reaction_insert_aggregate_update_failed'; end if;
end
$viewer_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $banned_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if v_access ->> 'reason' <> 'account_disabled' then raise exception 'banned_access_not_denied:%', v_access; end if;
  begin
    perform public.reserve_commune_sandbox_run('e1000000-0000-4000-8000-000000000001', 'banned', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('a',64), 8);
    raise exception 'banned_reservation_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_account_disabled' then raise; end if;
  end;
end
$banned_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
do $deleted_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if v_access ->> 'reason' <> 'account_disabled' then raise exception 'deleted_access_not_denied:%', v_access; end if;
  begin
    perform public.reserve_commune_sandbox_run('e1000000-0000-4000-8000-000000000002', 'deleted', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('a',64), 8);
    raise exception 'deleted_reservation_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_account_disabled' then raise; end if;
  end;
end
$deleted_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
do $anonymous_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if v_access ->> 'reason' <> 'account_disabled' then raise exception 'anonymous_access_not_denied:%', v_access; end if;
  begin
    perform public.reserve_commune_sandbox_run('e1000000-0000-4000-8000-000000000003', 'anonymous', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('a',64), 8);
    raise exception 'anonymous_reservation_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_account_disabled' then raise; end if;
  end;
end
$anonymous_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
do $profileless_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if v_access ->> 'reason' <> 'profile_required' then raise exception 'profileless_access_not_denied:%', v_access; end if;
  begin
    perform public.reserve_commune_sandbox_run('e1000000-0000-4000-8000-000000000004', 'profileless', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('a',64), 8);
    raise exception 'profileless_reservation_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_profile_required' then raise; end if;
  end;
end
$profileless_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '', false);
do $unauthenticated_access$
declare v_access jsonb;
begin
  v_access := public.current_user_sandbox_access();
  if v_access ->> 'reason' <> 'authentication_required' then raise exception 'anonymous_access_reason_failed:%', v_access; end if;
  begin
    perform public.reserve_commune_sandbox_run('e1000000-0000-4000-8000-000000000005', 'unauthenticated', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('a',64), 8);
    raise exception 'unauthenticated_reservation_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_authentication_required' then raise; end if;
  end;
end
$unauthenticated_access$;

select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $viewer_source_and_idempotency$
declare
  v_first jsonb;
  v_replay jsonb;
  v_busy jsonb;
begin
  begin
    perform public.reserve_commune_sandbox_run('e2000000-0000-4000-8000-000000000001', 'private-snippet', 'commune_post_snippet', 'c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', null, null, 'python', 'private.py', repeat('b',64), 8);
    raise exception 'private_snippet_publicly_authorized';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_source_unauthorized' then raise; end if;
  end;
  begin
    perform public.reserve_commune_sandbox_run('e2000000-0000-4000-8000-000000000002', 'private-repository', 'repository_showcase_artifact', 'd2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', null, null, 'python', 'private.py', repeat('c',64), 8);
    raise exception 'private_repository_publicly_authorized';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_source_unauthorized' then raise; end if;
  end;

  v_first := public.reserve_commune_sandbox_run('e3000000-0000-4000-8000-000000000001', 'public-snippet', 'commune_post_snippet', 'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', null, null, 'python', 'public.py', repeat('d',64), 8);
  if coalesce((v_first ->> 'accepted')::boolean, false) is not true or coalesce((v_first ->> 'idempotentReplay')::boolean, true) is not false then raise exception 'public_source_reservation_failed:%', v_first; end if;

  v_replay := public.reserve_commune_sandbox_run('e3000000-0000-4000-8000-000000000001', 'public-snippet', 'commune_post_snippet', 'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', null, null, 'python', 'public.py', repeat('d',64), 8);
  if coalesce((v_replay ->> 'idempotentReplay')::boolean, false) is not true then raise exception 'idempotent_replay_failed:%', v_replay; end if;

  begin
    perform public.reserve_commune_sandbox_run('e3000000-0000-4000-8000-000000000001', 'public-snippet', 'commune_post_snippet', 'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', null, null, 'python', 'public.py', repeat('e',64), 8);
    raise exception 'idempotency_conflict_accepted';
  exception when unique_violation then
    if sqlerrm <> 'sandbox_idempotency_conflict' then raise; end if;
  end;

  v_busy := public.reserve_commune_sandbox_run('e3000000-0000-4000-8000-000000000002', 'busy-probe', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('f',64), 8);
  if v_busy ->> 'reason' <> 'active_reservation' or (v_busy ->> 'retryAfter')::integer <> 4 then raise exception 'active_reservation_not_enforced:%', v_busy; end if;
end
$viewer_source_and_idempotency$;
reset role;

update private.sandbox_proxy_secrets
set secret_hash_hex = encode(extensions.digest('disposable-finalizer-token-0123456789abcdef', 'sha256'), 'hex'),
    rotated_at = now()
where secret_name = 'sandbox_db_finalizer';

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $lifecycle$
declare
  v_run_id uuid;
  v_result jsonb;
begin
  select id into v_run_id from public.commune_sandbox_runs where requester_user_id = auth.uid() and client_request_id = 'e3000000-0000-4000-8000-000000000001';
  begin
    perform public.start_commune_sandbox_run(v_run_id, 'e3000000-0000-4000-8000-000000000001', 'wrong-disposable-finalizer-token-000000');
    raise exception 'wrong_finalizer_token_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_finalizer_denied' then raise; end if;
  end;

  v_result := public.start_commune_sandbox_run(v_run_id, 'e3000000-0000-4000-8000-000000000001', 'disposable-finalizer-token-0123456789abcdef');
  if v_result ->> 'status' <> 'running' then raise exception 'start_transition_failed:%', v_result; end if;

  v_result := public.finalize_commune_sandbox_run(
    v_run_id, 'e3000000-0000-4000-8000-000000000001',
    'disposable-finalizer-token-0123456789abcdef', 'completed', true,
    'Completed.', 'ok', '', 0, 7, false,
    '[{"severity":"info","phase":"runtime","category":"policy_info","message":"done"}]'::jsonb
  );
  if v_result ->> 'status' <> 'completed' or coalesce((v_result ->> 'alreadyFinalized')::boolean, true) is not false then raise exception 'finalize_transition_failed:%', v_result; end if;

  v_result := public.finalize_commune_sandbox_run(
    v_run_id, 'e3000000-0000-4000-8000-000000000001',
    'disposable-finalizer-token-0123456789abcdef', 'completed', true,
    'Completed.', '', '', 0, 7, false, '[]'::jsonb
  );
  if coalesce((v_result ->> 'alreadyFinalized')::boolean, false) is not true then raise exception 'finalize_idempotency_failed:%', v_result; end if;

  if exists (select 1 from public.commune_sandbox_runs where id = v_run_id and (status <> 'completed' or reservation_expires_at is not null)) then raise exception 'finalized_lease_not_cleared'; end if;
  if (select count(*) from public.commune_code_diagnostics where run_id = v_run_id) <> 1 then raise exception 'diagnostic_finalization_failed'; end if;
end
$lifecycle$;

do $bounded_finalization$
declare
  v_run_id uuid;
  v_result jsonb;
  v_diagnostics jsonb;
begin
  v_result := public.reserve_commune_sandbox_run(
    'e3000000-0000-4000-8000-000000000010', 'bounded-finalization',
    'manual_snapshot', null, null, null, null,
    'python', 'bounded.py', repeat('a',64), 24
  );
  v_run_id := (v_result ->> 'runId')::uuid;
  if v_run_id is null then raise exception 'bounded_reservation_failed:%', v_result; end if;

  perform public.start_commune_sandbox_run(
    v_run_id,
    'e3000000-0000-4000-8000-000000000010',
    'disposable-finalizer-token-0123456789abcdef'
  );

  select jsonb_agg(jsonb_build_object(
    'severity', 'invalid',
    'phase', 'invalid',
    'category', 'invalid',
    'line', '12345678',
    'column', '12345678',
    'message', repeat('diagnostic', 150)
  )) into v_diagnostics
  from pg_catalog.generate_series(1,45);

  v_result := public.finalize_commune_sandbox_run(
    v_run_id,
    'e3000000-0000-4000-8000-000000000010',
    'disposable-finalizer-token-0123456789abcdef',
    'failed', false, repeat('message', 100), repeat('o', 40000), repeat('e', 40000),
    999, 20000, true, v_diagnostics
  );
  if v_result ->> 'status' <> 'failed' then raise exception 'bounded_finalize_failed:%', v_result; end if;

  if not exists (
    select 1
    from public.commune_sandbox_runs
    where id = v_run_id
      and length(result_summary ->> 'message') = 500
      and jsonb_array_length(result_summary -> 'diagnostics') = 40
      and length(stdout_preview) = 32768
      and length(stderr_preview) = 32768
      and exit_code is null
      and duration_ms is null
      and output_truncated is true
      and not (request_payload ? 'code')
  ) then raise exception 'bounded_run_fields_failed'; end if;

  if (select count(*) from public.commune_code_diagnostics where run_id = v_run_id) <> 40 then
    raise exception 'bounded_diagnostic_count_failed';
  end if;
  if exists (
    select 1
    from public.commune_code_diagnostics
    where run_id = v_run_id
      and (
        severity <> 'info'
        or phase <> 'sandbox'
        or category <> 'sandbox_internal_failure'
        or line_number is not null
        or column_number is not null
        or length(message) > 1000
      )
  ) then raise exception 'bounded_diagnostic_normalization_failed'; end if;
end
$bounded_finalization$;

select pg_catalog.set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
do $owner_sources$
declare v_result jsonb; v_run_id uuid;
begin
  v_result := public.reserve_commune_sandbox_run('e4000000-0000-4000-8000-000000000001', 'owner-private-snippet', 'commune_post_snippet', 'c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', null, null, 'python', 'private.py', repeat('1',64), 8);
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then raise exception 'owner_snippet_denied:%', v_result; end if;
  v_run_id := (v_result ->> 'runId')::uuid;
  perform public.finalize_commune_sandbox_run(v_run_id, 'e4000000-0000-4000-8000-000000000001', 'disposable-finalizer-token-0123456789abcdef', 'policy_blocked', false, 'Fixture cleanup.', '', '', null, 0, false, '[]'::jsonb);

  v_result := public.reserve_commune_sandbox_run('e4000000-0000-4000-8000-000000000002', 'owner-private-repository', 'repository_showcase_artifact', 'd2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', null, null, 'python', 'private.py', repeat('2',64), 8);
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then raise exception 'owner_repository_denied:%', v_result; end if;
  if (select count(*) from public.commune_code_snippets) <> 2 or (select count(*) from public.commune_repository_showcases) <> 2 then raise exception 'owner_rls_path_failed'; end if;
  if (select count(*) from public.commune_content_reaction_counts) <> 2 then raise exception 'reaction_owner_visibility_failed'; end if;
  if not exists (
    select 1 from public.commune_content_reaction_counts
    where target_id = 'a2222222-2222-4222-8222-222222222222'
      and helpful_count = 1 and caution_count = 0
  ) then raise exception 'reaction_owner_private_count_failed'; end if;
end
$owner_sources$;

select pg_catalog.set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
do $reviewer_source$
declare v_result jsonb;
begin
  v_result := public.reserve_commune_sandbox_run('e5000000-0000-4000-8000-000000000001', 'reviewer-private-snippet', 'commune_post_snippet', 'c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', null, null, 'python', 'private.py', repeat('3',64), 8);
  if coalesce((v_result ->> 'accepted')::boolean, false) is not true then raise exception 'reviewer_source_denied:%', v_result; end if;
  if (select count(*) from public.commune_code_snippets) <> 2 or (select count(*) from public.commune_repository_showcases) <> 2 then raise exception 'reviewer_rls_path_failed'; end if;
  if (select count(*) from public.commune_content_reaction_counts) <> 2 then raise exception 'reaction_reviewer_visibility_failed'; end if;
end
$reviewer_source$;
reset role;

update public.commune_sandbox_runs
set reservation_expires_at = now() - interval '1 minute'
where requester_user_id = '66666666-6666-4666-8666-666666666666'
  and client_request_id = 'e4000000-0000-4000-8000-000000000002';

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', false);
do $stale_recovery$
declare v_count integer;
begin
  if (select count(*) from public.commune_content_reaction_counts) <> 2 then raise exception 'reaction_admin_visibility_failed'; end if;
  v_count := public.reconcile_stale_commune_sandbox_runs();
  if v_count < 1 then raise exception 'stale_recovery_count_failed:%', v_count; end if;
end
$stale_recovery$;
reset role;

do $stale_state_and_transition$
declare v_run_id uuid;
begin
  select id into v_run_id from public.commune_sandbox_runs
  where requester_user_id = '66666666-6666-4666-8666-666666666666'
    and client_request_id = 'e4000000-0000-4000-8000-000000000002';
  if exists (select 1 from public.commune_sandbox_runs where id = v_run_id and (status <> 'sandbox_unavailable' or reservation_expires_at is not null)) then raise exception 'stale_recovery_state_failed'; end if;
  begin
    update public.commune_sandbox_runs set status = 'running' where id = v_run_id;
    raise exception 'invalid_transition_accepted';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'sandbox_transition_invalid' then raise; end if;
  end;
end
$stale_state_and_transition$;

insert into public.commune_sandbox_runs(
  requester_user_id, source_type, snapshot_id, language, status,
  client_request_id, code_sha256, code_bytes, completed_at
)
select
  '99999999-9999-4999-8999-999999999999', 'manual_snapshot',
  'quota-' || series::text, 'python', 'failed',
  ('f0000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  repeat('4',64), 8, now()
from pg_catalog.generate_series(1,10) as series;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', false);
do $quota$
declare v_result jsonb;
begin
  v_result := public.reserve_commune_sandbox_run('f1000000-0000-4000-8000-000000000001', 'quota-probe', 'manual_snapshot', null, null, null, null, 'python', 'main.py', repeat('5',64), 8);
  if v_result ->> 'reason' <> 'quota_exceeded' then raise exception 'quota_not_enforced:%', v_result; end if;
end
$quota$;
reset role;

select 'sandbox_database_behavior_ok' as result;

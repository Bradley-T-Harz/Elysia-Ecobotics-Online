\set ON_ERROR_STOP on

begin;

do $account_auth_deletion_lifecycle_behavior$
declare
  v_disposable_user_id constant uuid := '0d171000-0000-4000-8000-000000000001';
  v_governed_user_id constant uuid := '0d171000-0000-4000-8000-000000000002';
  v_hold_id constant uuid := '0d171000-0000-4000-8000-000000000003';
  v_constraint_name text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_state
    join pg_catalog.pg_class as source_relation
      on source_relation.oid = constraint_state.conrelid
    join pg_catalog.pg_namespace as source_namespace
      on source_namespace.oid = source_relation.relnamespace
    where source_namespace.nspname = 'private'
      and source_relation.relname = 'account_participation'
      and constraint_state.conname = 'account_participation_user_id_fkey'
      and constraint_state.contype = 'f'
      and constraint_state.confrelid = 'auth.users'::pg_catalog.regclass
      and constraint_state.confdeltype = 'c'
      and constraint_state.confupdtype = 'a'
      and not constraint_state.condeferrable
      and constraint_state.convalidated
  ) then
    raise exception 'account_participation Auth lifecycle constraint is not the reviewed CASCADE';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_state
    join pg_catalog.pg_class as source_relation
      on source_relation.oid = constraint_state.conrelid
    join pg_catalog.pg_namespace as source_namespace
      on source_namespace.oid = source_relation.relnamespace
    where source_namespace.nspname = 'private'
      and source_relation.relname = 'community_notification_preferences'
      and constraint_state.conname = 'community_notification_preferences_user_id_fkey'
      and constraint_state.contype = 'f'
      and constraint_state.confrelid = 'auth.users'::pg_catalog.regclass
      and constraint_state.confdeltype = 'c'
      and constraint_state.confupdtype = 'a'
      and not constraint_state.condeferrable
      and constraint_state.convalidated
  ) then
    raise exception 'community_notification_preferences Auth lifecycle constraint is not the reviewed CASCADE';
  end if;

  insert into auth.users(id, email, created_at, updated_at)
  values (
    v_disposable_user_id,
    'auth-deletion-disposable@example.invalid',
    pg_catalog.now(),
    pg_catalog.now()
  );

  if not exists (
    select 1 from private.account_participation
    where user_id = v_disposable_user_id
      and participation_state = 'read_only'
      and age_band = 'unknown'
      and assurance_status = 'not_collected'
  ) or not exists (
    select 1 from private.community_notification_preferences
    where user_id = v_disposable_user_id
      and in_app_enabled
      and not email_enabled
  ) then
    raise exception 'signup bootstrap did not create safe default account state';
  end if;

  insert into public.profile_handle_history(
    handle,
    profile_user_id,
    replaced_by_handle,
    redirect_enabled,
    retired_at
  ) values (
    'disposable-former-member',
    v_disposable_user_id,
    null,
    false,
    pg_catalog.now()
  );

  delete from auth.users where id = v_disposable_user_id;

  if exists (select 1 from auth.users where id = v_disposable_user_id)
     or exists (select 1 from private.account_participation where user_id = v_disposable_user_id)
     or exists (select 1 from private.community_notification_preferences where user_id = v_disposable_user_id) then
    raise exception 'Auth deletion left disposable account state behind';
  end if;

  if not exists (
    select 1
    from public.profile_handle_history
    where handle = 'disposable-former-member'
      and profile_user_id is null
      and not redirect_enabled
  ) then
    raise exception 'historical handle tombstone did not survive under its SET NULL policy';
  end if;

  insert into auth.users(id, email, created_at, updated_at)
  values (
    v_governed_user_id,
    'auth-deletion-governed@example.invalid',
    pg_catalog.now(),
    pg_catalog.now()
  );
  insert into private.account_legal_holds(
    id,
    user_id,
    scope,
    reason_code,
    imposed_by,
    private_reason
  ) values (
    v_hold_id,
    v_governed_user_id,
    'account',
    'disposable_test_hold',
    v_governed_user_id,
    'Disposable legal-hold deletion guard verification.'
  );

  begin
    delete from auth.users where id = v_governed_user_id;
    raise exception 'active legal hold did not block Auth-user hard deletion';
  exception
    when foreign_key_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name not in (
        'account_legal_holds_user_id_fkey',
        'account_legal_holds_imposed_by_fkey'
      ) then
        raise exception 'unexpected governed deletion blocker: %', v_constraint_name;
      end if;
  end;

  if not exists (select 1 from auth.users where id = v_governed_user_id)
     or not exists (select 1 from private.account_participation where user_id = v_governed_user_id)
     or not exists (select 1 from private.community_notification_preferences where user_id = v_governed_user_id)
     or not exists (select 1 from private.account_legal_holds where id = v_hold_id) then
    raise exception 'failed governed deletion did not roll back atomically';
  end if;

  delete from private.account_legal_holds where id = v_hold_id;
  delete from auth.users where id = v_governed_user_id;

  if exists (select 1 from auth.users where id = v_governed_user_id)
     or exists (select 1 from private.account_participation where user_id = v_governed_user_id)
     or exists (select 1 from private.community_notification_preferences where user_id = v_governed_user_id) then
    raise exception 'retry after governed cleanup did not complete idempotently';
  end if;
end;
$account_auth_deletion_lifecycle_behavior$;

select 'Account Auth deletion lifecycle behavior checks ok.' as result;

rollback;

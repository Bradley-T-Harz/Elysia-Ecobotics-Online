-- Make only the two automatically bootstrapped, identity-bound account rows
-- follow the Auth user lifecycle. Historical, authored, moderation, legal,
-- guardian, economic, and attribution relations intentionally retain their
-- existing governed deletion policies.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $auth_user_deletion_prerequisites$
declare
  v_constraint record;
begin
  for v_constraint in
    select
      constraint_state.conname,
      constraint_state.confdeltype,
      constraint_state.confupdtype,
      constraint_state.condeferrable,
      constraint_state.condeferred,
      constraint_state.convalidated,
      source_attribute.attnotnull,
      pg_catalog.format_type(source_attribute.atttypid, source_attribute.atttypmod) as column_type
    from pg_catalog.pg_constraint as constraint_state
    join pg_catalog.pg_class as source_relation
      on source_relation.oid = constraint_state.conrelid
    join pg_catalog.pg_namespace as source_namespace
      on source_namespace.oid = source_relation.relnamespace
    join pg_catalog.pg_attribute as source_attribute
      on source_attribute.attrelid = source_relation.oid
     and source_attribute.attnum = constraint_state.conkey[1]
    where source_namespace.nspname = 'private'
      and (
        (source_relation.relname = 'account_participation'
          and constraint_state.conname = 'account_participation_user_id_fkey')
        or
        (source_relation.relname = 'community_notification_preferences'
          and constraint_state.conname = 'community_notification_preferences_user_id_fkey')
      )
      and constraint_state.contype = 'f'
      and constraint_state.confrelid = 'auth.users'::pg_catalog.regclass
  loop
    if v_constraint.confdeltype <> 'r'
       or v_constraint.confupdtype <> 'a'
       or v_constraint.condeferrable
       or v_constraint.condeferred
       or not v_constraint.convalidated
       or not v_constraint.attnotnull
       or v_constraint.column_type <> 'uuid' then
      raise exception using
        errcode = '55000',
        message = 'auth_user_deletion_lifecycle_prerequisite_drift';
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_constraint as constraint_state
    join pg_catalog.pg_class as source_relation
      on source_relation.oid = constraint_state.conrelid
    join pg_catalog.pg_namespace as source_namespace
      on source_namespace.oid = source_relation.relnamespace
    where source_namespace.nspname = 'private'
      and (
        (source_relation.relname = 'account_participation'
          and constraint_state.conname = 'account_participation_user_id_fkey')
        or
        (source_relation.relname = 'community_notification_preferences'
          and constraint_state.conname = 'community_notification_preferences_user_id_fkey')
      )
      and constraint_state.contype = 'f'
      and constraint_state.confrelid = 'auth.users'::pg_catalog.regclass
  ) <> 2 then
    raise exception using
      errcode = '55000',
      message = 'auth_user_deletion_lifecycle_constraints_missing';
  end if;
end;
$auth_user_deletion_prerequisites$;

alter table private.account_participation
  drop constraint account_participation_user_id_fkey;
alter table private.account_participation
  add constraint account_participation_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on update no action
  on delete cascade
  not valid;
alter table private.account_participation
  validate constraint account_participation_user_id_fkey;

comment on constraint account_participation_user_id_fkey
  on private.account_participation is
  'Disposable server-owned participation state. It is created for every Auth account and is removed with that Auth user; age, guardian, moderation, legal, and audit evidence live in separately governed relations.';

alter table private.community_notification_preferences
  drop constraint community_notification_preferences_user_id_fkey;
alter table private.community_notification_preferences
  add constraint community_notification_preferences_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on update no action
  on delete cascade
  not valid;
alter table private.community_notification_preferences
  validate constraint community_notification_preferences_user_id_fkey;

comment on constraint community_notification_preferences_user_id_fkey
  on private.community_notification_preferences is
  'Disposable delivery preferences created for every Auth account. They have no independent retention purpose and are removed with that Auth user.';

commit;

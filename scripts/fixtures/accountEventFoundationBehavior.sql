\set ON_ERROR_STOP on

-- Runs after the full active migration chain in a disposable database. All
-- identities and event contents below are synthetic and rolled back.
begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('ae000000-0000-4000-8000-000000000001', 'event-actor@example.invalid', now(), now(), now()),
  ('ae000000-0000-4000-8000-000000000002', 'event-recipient@example.invalid', now(), now(), now()),
  ('ae000000-0000-4000-8000-000000000003', 'event-unrelated@example.invalid', now(), now(), now());

do $account_event_catalog$
begin
  if pg_catalog.has_table_privilege('authenticated', 'private.account_events', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.account_inbox_items', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.account_notifications', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.account_inbox_items', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.account_notifications', 'DELETE') then
    raise exception 'account_event_direct_mutation_grant_present';
  end if;
  if pg_catalog.has_column_privilege(
    'authenticated', 'public.account_inbox_items', 'completed_at', 'UPDATE'
  ) or pg_catalog.has_column_privilege(
    'authenticated', 'public.account_inbox_items', 'superseded_at', 'UPDATE'
  ) then
    raise exception 'account_inbox_source_state_is_browser_writable';
  end if;
  if not pg_catalog.has_column_privilege(
    'authenticated', 'public.account_inbox_items', 'read_at', 'UPDATE'
  ) or not pg_catalog.has_column_privilege(
    'authenticated', 'public.account_notifications', 'archived_at', 'UPDATE'
  ) then
    raise exception 'account_projection_presentation_state_grant_missing';
  end if;
end
$account_event_catalog$;

do $account_event_server_behavior$
declare
  v_event_id uuid;
  v_replay_id uuid;
  v_projection jsonb;
begin
  v_event_id := private.record_account_event(
    'fixture.review_requested', 1, 'commune', 'code_revision_proposal',
    'ae100000-0000-4000-8000-000000000001',
    'ae000000-0000-4000-8000-000000000001', 'user',
    'fixture:event-foundation:review-requested:v1',
    'suppressible', 'work_reviews',
    'A revision proposal is ready for review',
    'Open the governed source workflow to review it.', '{}'::jsonb,
    '/commune/coding-cornucopia/review?proposal=ae100000-0000-4000-8000-000000000001',
    'source_lifecycle', 'ae200000-0000-4000-8000-000000000001'
  );
  v_replay_id := private.record_account_event(
    'fixture.review_requested', 1, 'commune', 'code_revision_proposal',
    'ae100000-0000-4000-8000-000000000001',
    'ae000000-0000-4000-8000-000000000001', 'user',
    'fixture:event-foundation:review-requested:v1',
    'suppressible', 'work_reviews',
    'A revision proposal is ready for review',
    'Open the governed source workflow to review it.', '{}'::jsonb,
    '/commune/coding-cornucopia/review?proposal=ae100000-0000-4000-8000-000000000001',
    'source_lifecycle', 'ae200000-0000-4000-8000-000000000001'
  );
  if v_event_id is distinct from v_replay_id then
    raise exception 'account_event_exact_replay_created_duplicate';
  end if;
  begin
    perform private.record_account_event(
      'fixture.review_requested', 1, 'commune', 'code_revision_proposal',
      'ae100000-0000-4000-8000-000000000001',
      'ae000000-0000-4000-8000-000000000001', 'user',
      'fixture:event-foundation:review-requested:v1',
      'suppressible', 'work_reviews', 'Conflicting safe title', null,
      '{}'::jsonb, '/commons-circle/inbox', 'source_lifecycle', null
    );
    raise exception 'account_event_idempotency_conflict_accepted';
  exception when unique_violation then
    if sqlerrm <> 'account_event_idempotency_conflict' then raise; end if;
  end;
  begin
    perform private.record_account_event(
      'fixture.unsafe_link', 1, 'system', 'fixture_notice',
      'ae100000-0000-4000-8000-000000000002', null, 'system',
      'fixture:event-foundation:unsafe-link:v1', 'mandatory',
      'account_security', 'Unsafe link fixture', null, '{}'::jsonb,
      'https://example.invalid/escape', 'audit', null
    );
    raise exception 'account_event_external_deep_link_accepted';
  exception when check_violation then null;
  end;
  v_projection := private.project_account_event(
    v_event_id, 'ae000000-0000-4000-8000-000000000002',
    'action', 'review_proposal', 75, 'information', false
  );
  perform private.project_account_event(
    v_event_id, 'ae000000-0000-4000-8000-000000000002',
    'action', 'review_proposal', 75, 'information', false
  );
  if (select pg_catalog.count(*) from public.account_inbox_items
      where event_id = v_event_id) <> 1
     or (select pg_catalog.count(*) from public.account_notifications
      where event_id = v_event_id) <> 1 then
    raise exception 'account_event_projection_replay_created_duplicate';
  end if;
  begin
    update private.account_events set safe_title = 'Mutated' where id = v_event_id;
    raise exception 'account_event_update_was_accepted';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'account_event_is_immutable' then raise; end if;
  end;
  begin
    delete from private.account_events where id = v_event_id;
    raise exception 'account_event_delete_was_accepted';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'account_event_is_immutable' then raise; end if;
  end;
end
$account_event_server_behavior$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'ae000000-0000-4000-8000-000000000003', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

do $account_event_unrelated_rls$
begin
  if exists (select 1 from public.account_inbox_items)
     or exists (select 1 from public.account_notifications) then
    raise exception 'unrelated_account_read_event_projection';
  end if;
  begin
    insert into public.account_notifications(
      event_id, recipient_user_id, source_domain, source_type,
      source_record_id, category, delivery_class, safe_title, deep_link
    ) select id, auth.uid(), source_domain, source_type, source_record_id,
      category, delivery_class, safe_title, deep_link
    from private.account_events limit 1;
    raise exception 'browser_created_account_notification';
  exception when insufficient_privilege then null;
  end;
end
$account_event_unrelated_rls$;

select pg_catalog.set_config('request.jwt.claim.sub', 'ae000000-0000-4000-8000-000000000002', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $account_event_recipient_behavior$
declare
  v_counts jsonb;
  v_items jsonb;
  v_inbox_id uuid;
  v_notification_id uuid;
begin
  v_counts := public.current_user_event_counts();
  if (v_counts->>'inboxNeedsAttention')::integer <> 1
     or (v_counts->>'inboxUnread')::integer <> 1
     or (v_counts->>'notificationsUnread')::integer <> 1 then
    raise exception 'account_event_exact_counts_incorrect';
  end if;
  v_items := public.current_user_inbox_items('attention', null, 30, null, null);
  if pg_catalog.jsonb_array_length(v_items->'items') <> 1
     or (v_items #>> '{items,0,title}') <> 'A revision proposal is ready for review'
     or coalesce(v_items #>> '{items,0,preview}', '') like '%private%proposal%body%' then
    raise exception 'account_inbox_safe_list_contract_failed';
  end if;
  select id into v_inbox_id from public.account_inbox_items limit 1;
  select id into v_notification_id from public.account_notifications limit 1;
  perform public.set_current_user_inbox_read(v_inbox_id, true);
  perform public.set_current_user_inbox_archived(v_inbox_id, true);
  perform public.set_current_user_notification_read(v_notification_id, true);
  perform public.set_current_user_notification_archived(v_notification_id, true);
  begin
    update public.account_inbox_items set completed_at = now() where id = v_inbox_id;
    raise exception 'recipient_completed_source_action_directly';
  exception when insufficient_privilege then null;
  end;
  perform public.update_current_user_account_event_preference(
    'work_reviews', false, false, null, null, 0
  );
end
$account_event_recipient_behavior$;

reset role;

do $account_event_preference_and_mandatory_behavior$
declare
  v_suppressible_id uuid;
  v_mandatory_id uuid;
begin
  v_suppressible_id := private.record_account_event(
    'fixture.optional_outcome', 1, 'commune', 'code_revision_proposal',
    'ae100000-0000-4000-8000-000000000003', null, 'system',
    'fixture:event-foundation:optional:v1', 'suppressible', 'work_reviews',
    'Optional review update', null, '{}'::jsonb,
    '/commons-circle/notifications', 'source_lifecycle', null
  );
  perform private.project_account_event(
    v_suppressible_id, 'ae000000-0000-4000-8000-000000000002',
    null, null, 50, 'outcome', true
  );
  if exists (select 1 from public.account_notifications where event_id = v_suppressible_id)
     or exists (select 1 from private.account_delivery_outbox where event_id = v_suppressible_id) then
    raise exception 'suppressible_preference_not_honored';
  end if;

  v_mandatory_id := private.record_account_event(
    'fixture.security_notice', 1, 'account', 'security_notice',
    'ae100000-0000-4000-8000-000000000004', null, 'system',
    'fixture:event-foundation:mandatory:v1', 'mandatory', 'work_reviews',
    'Account action required', 'Open your account to review this notice.',
    '{}'::jsonb, '/commons-circle/inbox', 'audit', null
  );
  perform private.project_account_event(
    v_mandatory_id, 'ae000000-0000-4000-8000-000000000002',
    'required_action', 'review_account_notice', 100,
    'mandatory_notice', true
  );
  if not exists (select 1 from public.account_notifications where event_id = v_mandatory_id)
     or not exists (select 1 from private.account_delivery_outbox where event_id = v_mandatory_id) then
    raise exception 'mandatory_event_was_suppressed';
  end if;

  perform private.resolve_account_inbox_items(
    'commune', 'code_revision_proposal',
    'ae100000-0000-4000-8000-000000000001',
    'ae000000-0000-4000-8000-000000000002', 'completed'
  );
  if not exists (
    select 1 from public.account_inbox_items
    where source_record_id = 'ae100000-0000-4000-8000-000000000001'
      and completed_at is not null
  ) then
    raise exception 'source_controlled_inbox_completion_failed';
  end if;
end
$account_event_preference_and_mandatory_behavior$;

delete from auth.users where id = 'ae000000-0000-4000-8000-000000000001';
do $account_event_actor_lifecycle$
begin
  if not exists (
    select 1 from private.account_events
    where idempotency_key = 'fixture:event-foundation:review-requested:v1'
      and actor_user_id is null
  ) then
    raise exception 'deleted_actor_did_not_become_event_tombstone';
  end if;
end
$account_event_actor_lifecycle$;

delete from auth.users where id = 'ae000000-0000-4000-8000-000000000002';
do $account_event_recipient_lifecycle$
begin
  if exists (select 1 from public.account_inbox_items
      where recipient_user_id = 'ae000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.account_notifications
      where recipient_user_id = 'ae000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.account_event_preferences
      where user_id = 'ae000000-0000-4000-8000-000000000002')
     or exists (select 1 from private.account_delivery_outbox
      where recipient_user_id = 'ae000000-0000-4000-8000-000000000002') then
    raise exception 'recipient_account_lifecycle_did_not_remove_projections';
  end if;
  if not exists (
    select 1 from private.account_events
    where idempotency_key = 'fixture:event-foundation:mandatory:v1'
  ) then
    raise exception 'recipient_deletion_removed_immutable_event';
  end if;
end
$account_event_recipient_lifecycle$;

rollback;

select 'account_event_foundation_behavior_ok' as result;

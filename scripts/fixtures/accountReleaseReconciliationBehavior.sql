\set ON_ERROR_STOP on

-- Verifies the release reconciliation migration against the synthetic
-- pre-event proposal and legacy rows staged before Task C/D migrations.

do $account_release_reconciliation_behavior$
declare
  v_event_id uuid;
  v_notification_id uuid;
begin
  if not exists (
    select 1
    from public.commune_code_revision_proposals
    where id = 'd1300000-0000-4000-8000-000000000001'
      and client_request_id = id
      and proposal_status = 'submitted'
  ) then
    raise exception 'release_reconciliation_proposal_backfill_failed';
  end if;

  select event.id into strict v_event_id
  from private.account_events as event
  where event.source_domain = 'commune'
    and event.source_type = 'code_revision_proposal'
    and event.source_record_id = 'd1300000-0000-4000-8000-000000000001'
    and event.idempotency_key =
      'code-proposal:d1300000-0000-4000-8000-000000000001:submitted:v1';

  if exists (
    select 1
    from private.account_events as event
    where event.id = v_event_id
      and (
        event.safe_title like '%PRIVATE_%'
        or coalesce(event.safe_preview, '') like '%PRIVATE_%'
        or event.safe_payload::text like '%PRIVATE_%'
      )
  ) then
    raise exception 'release_reconciliation_private_proposal_content_projected';
  end if;

  if (select pg_catalog.count(*) from public.account_inbox_items
      where event_id = v_event_id
        and recipient_user_id = 'd1000000-0000-4000-8000-000000000002'
        and action_kind = 'review_code_proposal'
        and completed_at is null
        and superseded_at is null) <> 1 then
    raise exception 'release_reconciliation_inbox_action_incorrect';
  end if;

  select notification.id into strict v_notification_id
  from public.account_notifications as notification
  where notification.event_id = v_event_id
    and notification.recipient_user_id = 'd1000000-0000-4000-8000-000000000002';

  if (select pg_catalog.count(*) from public.account_notifications
      where source_domain = 'commune'
        and source_type = 'code_revision_proposal'
        and source_record_id = 'd1300000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'release_reconciliation_proposal_notification_duplicated';
  end if;

  if not exists (
    select 1
    from private.account_legacy_notification_projection_map
    where legacy_notification_id = 'd1400000-0000-4000-8000-000000000001'
      and event_id = v_event_id
      and notification_id = v_notification_id
  ) then
    raise exception 'release_reconciliation_proposal_legacy_row_not_reused';
  end if;

  if not exists (
    select 1
    from private.account_legacy_notification_projection_map as mapping
    join public.account_notifications as notification
      on notification.id = mapping.notification_id
    join private.account_events as event on event.id = mapping.event_id
    where mapping.legacy_notification_id = 'd1400000-0000-4000-8000-000000000002'
      and notification.read_at is not null
      and notification.deep_link = '/commons-circle/notifications'
      and event.safe_title = 'Request or review update'
      and event.safe_title not like '%UNTRUSTED_LEGACY_TITLE%'
      and coalesce(event.safe_preview, '') not like '%PRIVATE_GENERIC%'
      and event.safe_payload::text not like '%PRIVATE_GENERIC%'
  ) then
    raise exception 'release_reconciliation_generic_legacy_safety_failed';
  end if;

  if exists (
    select 1
    from public.user_notifications as notification
    where not exists (
      select 1
      from private.account_legacy_notification_projection_map as mapping
      where mapping.legacy_notification_id = notification.id
    )
  ) then
    raise exception 'release_reconciliation_left_unmapped_legacy_rows';
  end if;

  if not exists (
    select 1
    from public.commune_code_snippets
    where id = 'd1200000-0000-4000-8000-000000000001'
      and code_text = 'console.log("published snapshot remains unchanged")'
      and coalesce(accepted_version_number, 1) = 1
  ) then
    raise exception 'release_reconciliation_changed_published_snapshot';
  end if;
end;
$account_release_reconciliation_behavior$;

select 'account_release_reconciliation_behavior_ok' as result;

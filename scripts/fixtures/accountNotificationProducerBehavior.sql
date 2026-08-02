\set ON_ERROR_STOP on

-- Synthetic source transitions only. The entire producer fixture rolls back.
begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'producer-owner@example.invalid', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000002', 'producer-actor@example.invalid', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000003', 'producer-admin@example.invalid', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000004', 'producer-unrelated@example.invalid', now(), now(), now());

insert into public.profiles(id, username, display_name, commons_onboarding_completed_at, is_admin)
values
  ('c1000000-0000-4000-8000-000000000001', 'producer-owner', 'Producer Owner', now(), false),
  ('c1000000-0000-4000-8000-000000000002', 'producer-actor', 'Producer Actor', now(), false),
  ('c1000000-0000-4000-8000-000000000003', 'producer-admin', 'Producer Admin', now(), true),
  ('c1000000-0000-4000-8000-000000000004', 'producer-unrelated', 'Producer Unrelated', now(), false);

insert into public.user_roles(user_id, role, granted_by, reason)
values (
  'c1000000-0000-4000-8000-000000000003', 'administrator',
  'c1000000-0000-4000-8000-000000000003', 'Synthetic producer fixture administrator'
);

do $account_notification_producer_catalog$
begin
  if pg_catalog.has_table_privilege('authenticated', 'public.user_notifications', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.user_notifications', 'UPDATE') then
    raise exception 'legacy_notification_generic_browser_mutation_remains';
  end if;
  if not pg_catalog.has_column_privilege(
    'authenticated', 'public.user_notifications', 'read_at', 'UPDATE'
  ) or pg_catalog.has_column_privilege(
    'authenticated', 'public.user_notifications', 'title', 'UPDATE'
  ) then
    raise exception 'legacy_notification_presentation_grants_incorrect';
  end if;
  if pg_catalog.has_table_privilege(
    'authenticated', 'public.commune_comment_mentions', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'private.account_legacy_notification_projection_map', 'SELECT'
  ) then
    raise exception 'producer_private_or_source_fact_grant_too_broad';
  end if;
end
$account_notification_producer_catalog$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $account_notification_browser_forgery$
begin
  begin
    insert into public.user_notifications(user_id, title, notification_type)
    values (auth.uid(), 'Forged', 'forged');
    raise exception 'legacy_notification_browser_forgery_accepted';
  exception when insufficient_privilege then null;
  end;
end
$account_notification_browser_forgery$;

reset role;

insert into public.work_with_requests(
  id, user_id, name, preferred_contact, request_type, message, status
) values (
  'c1100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'Synthetic Owner', 'Website Account', 'collaboration',
  'PRIVATE_WORK_WITH_BODY_MUST_NOT_PROJECT', 'pending_review'
);

update public.work_with_requests
set status = 'needs_information', updated_at = now() + interval '1 second'
where id = 'c1100000-0000-4000-8000-000000000001';

do $account_notification_work_with$
begin
  if not exists (
    select 1 from public.account_inbox_items
    where recipient_user_id = 'c1000000-0000-4000-8000-000000000001'
      and source_domain = 'work_with'
      and source_type = 'work_with_request'
      and source_record_id = 'c1100000-0000-4000-8000-000000000001'
      and action_kind = 'respond_work_with'
      and completed_at is null
  ) then raise exception 'work_with_required_action_not_projected'; end if;
  if exists (
    select 1 from private.account_events
    where safe_title like '%PRIVATE_WORK_WITH_BODY%'
       or coalesce(safe_preview, '') like '%PRIVATE_WORK_WITH_BODY%'
       or safe_payload::text like '%PRIVATE_WORK_WITH_BODY%'
  ) then raise exception 'work_with_private_body_projected'; end if;
end
$account_notification_work_with$;

insert into public.commune_posts(
  id, user_id, post_type, title, body, status, visibility
) values (
  'c1200000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'community_network', 'Synthetic producer post', 'Synthetic public body.',
  'published', 'public'
);
insert into public.commune_threads(
  id, post_id, title, created_by, status, visibility
) values (
  'c1210000-0000-4000-8000-000000000001',
  'c1200000-0000-4000-8000-000000000001',
  'Synthetic producer thread', 'c1000000-0000-4000-8000-000000000001',
  'open', 'public'
);
insert into public.commune_comments(
  id, thread_id, post_id, user_id, body, status, published_at
) values (
  'c1220000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000001',
  'c1200000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'Synthetic published reply without private data.', 'published', now()
);

do $account_notification_comment$
begin
  if (select pg_catalog.count(*) from private.account_events
      where source_type = 'commune_comment'
        and source_record_id = 'c1220000-0000-4000-8000-000000000001') <> 1
     or (select pg_catalog.count(*) from public.account_notifications
      where source_type = 'commune_comment'
        and source_record_id = 'c1220000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'comment_recipient_deduplication_failed';
  end if;
end
$account_notification_comment$;

update public.commune_comments
set status = 'hidden', hidden_by = 'c1000000-0000-4000-8000-000000000003',
    hidden_at = now(), moderation_reason = 'Synthetic moderation decision',
    updated_at = now() + interval '1 second'
where id = 'c1220000-0000-4000-8000-000000000001';

do $account_notification_comment_moderation$
begin
  if not exists (
    select 1 from public.account_notifications
    where recipient_user_id = 'c1000000-0000-4000-8000-000000000002'
      and source_type = 'commune_comment'
      and source_record_id = 'c1220000-0000-4000-8000-000000000001'
      and delivery_class = 'mandatory'
  ) then raise exception 'comment_moderation_outcome_not_projected'; end if;
end
$account_notification_comment_moderation$;

insert into public.commune_media(
  id, owner_user_id, post_id, storage_bucket, storage_path, file_name,
  media_kind, visibility_state
) values (
  'c1230000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'c1200000-0000-4000-8000-000000000001',
  'commune-media', 'synthetic/private-fixture.txt',
  'PRIVATE_MEDIA_NAME_MUST_NOT_PROJECT.txt', 'document', 'submitted'
);

update public.commune_media
set visibility_state = 'removed', updated_at = now() + interval '1 second'
where id = 'c1230000-0000-4000-8000-000000000001';

do $account_notification_media_moderation$
begin
  if not exists (
    select 1 from public.account_notifications
    where recipient_user_id = 'c1000000-0000-4000-8000-000000000002'
      and source_type = 'commune_media'
      and source_record_id = 'c1230000-0000-4000-8000-000000000001'
      and delivery_class = 'mandatory'
  ) then raise exception 'media_moderation_outcome_not_projected'; end if;
  if exists (
    select 1 from private.account_events
    where safe_title like '%PRIVATE_MEDIA_NAME%'
       or coalesce(safe_preview, '') like '%PRIVATE_MEDIA_NAME%'
       or safe_payload::text like '%PRIVATE_MEDIA_NAME%'
  ) then raise exception 'private_media_name_projected'; end if;
end
$account_notification_media_moderation$;

insert into public.commune_sandbox_review_requests(
  id, user_id, submitted_by, post_id, request_title, title,
  requested_review_scope, risk_notes, status, request_status, review_status
) values (
  'c1240000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'c1200000-0000-4000-8000-000000000001',
  'PRIVATE_SANDBOX_TITLE_MUST_NOT_PROJECT',
  'PRIVATE_SANDBOX_TITLE_MUST_NOT_PROJECT',
  'Synthetic selected artifact only', 'PRIVATE_SANDBOX_RISK_MUST_NOT_PROJECT',
  'requested', 'submitted', 'pending_review'
);

update public.commune_sandbox_review_requests
set status = 'needs_information', request_status = 'changes_requested',
    review_status = 'changes_requested', reviewer_public_feedback = 'Safe public feedback',
    reviewer_private_note = 'PRIVATE_SANDBOX_NOTE_MUST_NOT_PROJECT',
    updated_at = now() + interval '1 second'
where id = 'c1240000-0000-4000-8000-000000000001';

do $account_notification_sandbox_review$
begin
  if not exists (
    select 1 from public.account_inbox_items
    where recipient_user_id = 'c1000000-0000-4000-8000-000000000002'
      and source_domain = 'sandbox'
      and source_type = 'sandbox_review_request'
      and source_record_id = 'c1240000-0000-4000-8000-000000000001'
      and action_kind = 'update_sandbox_review_request'
      and completed_at is null
  ) then raise exception 'sandbox_review_required_action_not_projected'; end if;
  if exists (
    select 1 from private.account_events
    where safe_title like '%PRIVATE_SANDBOX%'
       or coalesce(safe_preview, '') like '%PRIVATE_SANDBOX%'
       or safe_payload::text like '%PRIVATE_SANDBOX%'
  ) then raise exception 'private_sandbox_review_content_projected'; end if;
end
$account_notification_sandbox_review$;

insert into private.account_restrictions(
  id, target_user_id, scope, restriction_type, reason_code,
  public_notice, private_reason, imposed_by
) values (
  'c1300000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'commune_posting', 'read_only', 'fixture_restriction',
  'Review the current participation notice.',
  'PRIVATE_RESTRICTION_REASON_MUST_NOT_PROJECT',
  'c1000000-0000-4000-8000-000000000003'
);

do $account_notification_mandatory$
begin
  if not exists (
    select 1 from public.account_notifications
    where recipient_user_id = 'c1000000-0000-4000-8000-000000000001'
      and source_type = 'account_restriction'
      and delivery_class = 'mandatory'
  ) or not exists (
    select 1 from private.account_delivery_outbox as delivery
    join private.account_events as event on event.id = delivery.event_id
    where event.source_type = 'account_restriction'
  ) then raise exception 'mandatory_restriction_delivery_not_projected'; end if;
  if exists (
    select 1 from private.account_events
    where safe_title like '%PRIVATE_RESTRICTION_REASON%'
       or coalesce(safe_preview, '') like '%PRIVATE_RESTRICTION_REASON%'
       or safe_payload::text like '%PRIVATE_RESTRICTION_REASON%'
  ) then raise exception 'private_restriction_reason_projected'; end if;
end
$account_notification_mandatory$;

insert into public.user_notifications(
  id, user_id, notification_type, title, body, source_type, source_id,
  action_url, is_read
) values (
  'c1400000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'legacy_fixture_update', 'UNTRUSTED_LEGACY_TITLE',
  'PRIVATE_LEGACY_BODY_MUST_NOT_PROJECT', 'fixture_source',
  'c1200000-0000-4000-8000-000000000001',
  'https://example.invalid/not-allowed', false
);

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000003', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

do $account_notification_legacy_reconciliation$
declare v_result jsonb;
begin
  v_result := public.reconcile_legacy_account_notifications(2000);
  if (v_result->>'processed')::integer < 1 then
    raise exception 'legacy_reconciliation_processed_no_rows';
  end if;
end
$account_notification_legacy_reconciliation$;

reset role;

do $account_notification_legacy_safety$
begin
  if not exists (
    select 1 from private.account_legacy_notification_projection_map
    where legacy_notification_id = 'c1400000-0000-4000-8000-000000000001'
  ) then raise exception 'legacy_notification_not_mapped'; end if;
  if exists (
    select 1 from private.account_events
    where safe_title like '%UNTRUSTED_LEGACY_TITLE%'
       or coalesce(safe_preview, '') like '%PRIVATE_LEGACY_BODY%'
       or safe_payload::text like '%PRIVATE_LEGACY_BODY%'
  ) then raise exception 'legacy_private_or_untrusted_text_projected'; end if;
  if exists (
    select 1 from public.account_notifications
    where event_id = (
      select event_id from private.account_legacy_notification_projection_map
      where legacy_notification_id = 'c1400000-0000-4000-8000-000000000001'
    ) and deep_link <> '/commons-circle/notifications'
  ) then raise exception 'legacy_external_deep_link_preserved'; end if;
  if not private.account_event_source_available(
    'legacy', 'legacy_notification', 'c1400000-0000-4000-8000-000000000001'
  ) then raise exception 'legacy_notification_tombstone_reference_incorrect'; end if;
end
$account_notification_legacy_safety$;

rollback;

select 'account_notification_producer_behavior_ok' as result;

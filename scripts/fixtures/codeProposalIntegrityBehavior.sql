\set ON_ERROR_STOP on

-- Runs after the full active migration chain in a disposable database. All
-- accounts, source rows, and values are synthetic fixtures.

do $proposal_integrity_catalog$
begin
  if pg_catalog.has_table_privilege('authenticated', 'public.commune_code_revision_proposals', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.commune_code_revision_proposals', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.commune_code_revision_proposals', 'DELETE') then
    raise exception 'proposal_direct_write_grant_remains';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.commune_code_revision_proposals'::pg_catalog.regclass
      and conname = 'commune_code_revision_proposals_post_snippet_fk'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'proposal_post_snippet_constraint_missing';
  end if;
end
$proposal_integrity_catalog$;

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, pg_catalog.now())
where id in (
  '11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666'
);

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', false);

do $proposal_integrity_behavior$
declare
  v_request_id uuid := '88000000-0000-4000-8000-000000000001';
  v_first uuid;
  v_replay uuid;
  v_decision_proposal uuid;
  v_before_code text;
  v_before_version integer;
begin
  select code_text, accepted_version_number
  into v_before_code, v_before_version
  from public.commune_code_snippets
  where id = 'c1111111-1111-4111-8111-111111111111';

  v_first := public.submit_commune_code_revision_proposal_v2(
    v_request_id,
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(5)',
    'javascript',
    'public.js',
    'Retry-safe synthetic revision.',
    'Synthetic private explanation that must stay only on the proposal.'
  );
  v_replay := public.submit_commune_code_revision_proposal_v2(
    v_request_id,
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(5)',
    'javascript',
    'public.js',
    'Retry-safe synthetic revision.',
    'Synthetic private explanation that must stay only on the proposal.'
  );
  if v_first is distinct from v_replay then
    raise exception 'proposal_idempotent_replay_created_another_id';
  end if;
  if exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and (code_text is distinct from v_before_code or accepted_version_number is distinct from v_before_version)
  ) then
    raise exception 'proposal_submission_changed_published_snapshot';
  end if;

  begin
    perform public.submit_commune_code_revision_proposal_v2(
      v_request_id,
      'a1111111-1111-4111-8111-111111111111',
      'c1111111-1111-4111-8111-111111111111',
      'console.log(6)', 'javascript', 'public.js',
      'Conflicting replay.', null
    );
    raise exception 'proposal_idempotency_conflict_was_accepted';
  exception when unique_violation then
    if sqlerrm <> 'code_proposal_idempotency_conflict' then raise; end if;
  end;

  begin
    perform public.submit_commune_code_revision_proposal_v2(
      '88000000-0000-4000-8000-000000000002',
      'a2222222-2222-4222-8222-222222222222',
      'c1111111-1111-4111-8111-111111111111',
      'console.log(7)', 'javascript', 'public.js',
      'Mismatched source.', null
    );
    raise exception 'proposal_mismatched_post_snippet_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'code_proposal_source_unavailable' then raise; end if;
  end;

  begin
    insert into public.commune_code_revision_proposals (
      client_request_id, post_id, code_snippet_id, proposer_user_id,
      original_author_user_id, base_code_text, proposed_code_text,
      change_summary, proposal_status
    ) values (
      '88000000-0000-4000-8000-000000000003',
      'a1111111-1111-4111-8111-111111111111',
      'c1111111-1111-4111-8111-111111111111',
      auth.uid(), '66666666-6666-4666-8666-666666666666',
      'forged base', 'forged proposal', 'Forged direct insert.', 'submitted'
    );
    raise exception 'proposal_direct_insert_was_accepted';
  exception when insufficient_privilege then null;
  end;

  v_decision_proposal := public.submit_commune_code_revision_proposal_v2(
    '88000000-0000-4000-8000-000000000004',
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(8)',
    'javascript',
    'accepted.js',
    'Synthetic proposal for the author decision event.',
    'A second private explanation that must never enter an event preview.'
  );
  if v_decision_proposal is null then
    raise exception 'proposal_for_decision_event_was_not_created';
  end if;

  perform public.withdraw_commune_code_revision_proposal(v_first);
  if not exists (
    select 1 from public.commune_code_revision_proposals
    where id = v_first and proposal_status = 'withdrawn' and withdrawn_at is not null
  ) then
    raise exception 'governed_proposal_withdrawal_failed';
  end if;
  if exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and (code_text is distinct from v_before_code or accepted_version_number is distinct from v_before_version)
  ) then
    raise exception 'proposal_withdrawal_changed_published_snapshot';
  end if;
end
$proposal_integrity_behavior$;

select pg_catalog.set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}', false);
do $proposal_author_inbox_and_decision$
declare
  v_proposal_id uuid;
  v_self_proposal_id uuid;
  v_inbox_id uuid;
begin
  select id into strict v_proposal_id
  from public.commune_code_revision_proposals
  where client_request_id = '88000000-0000-4000-8000-000000000004';
  select id into strict v_inbox_id
  from public.account_inbox_items
  where source_record_id = v_proposal_id
    and action_kind = 'review_code_proposal'
    and completed_at is null
    and superseded_at is null;
  if exists (
    select 1 from public.account_inbox_items
    where source_record_id = v_proposal_id
      and (
        coalesce(safe_title, '') like '%console.log%'
        or coalesce(safe_preview, '') like '%private explanation%'
      )
  ) then
    raise exception 'proposal_private_body_leaked_to_author_inbox';
  end if;

  perform public.decide_commune_code_revision_proposal(
    v_proposal_id, 'accepted', 'Synthetic author decision.'
  );
  if not exists (
    select 1 from public.account_inbox_items
    where id = v_inbox_id and completed_at is not null
  ) then
    raise exception 'proposal_decision_did_not_complete_author_inbox_item';
  end if;
  if not exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text = 'console.log(8)'
      and file_name = 'accepted.js'
  ) then
    raise exception 'author_acceptance_did_not_publish_exact_proposal';
  end if;

  v_self_proposal_id := public.submit_commune_code_revision_proposal_v2(
    '88000000-0000-4000-8000-000000000005',
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(9)', 'javascript', 'self.js',
    'Synthetic self proposal.', null
  );
  if exists (
    select 1 from public.account_inbox_items where source_record_id = v_self_proposal_id
  ) or exists (
    select 1 from public.account_notifications where source_record_id = v_self_proposal_id
  ) then
    raise exception 'self_proposal_created_useless_self_projection';
  end if;
end
$proposal_author_inbox_and_decision$;

select pg_catalog.set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', false);
do $proposal_privacy$
begin
  if exists (
    select 1 from public.commune_code_revision_proposals
    where client_request_id = '88000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'unrelated_account_read_private_proposal';
  end if;
end
$proposal_privacy$;

select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', false);
do $proposal_outcome_visibility$
declare v_proposal_id uuid;
begin
  select id into strict v_proposal_id
  from public.commune_code_revision_proposals
  where client_request_id = '88000000-0000-4000-8000-000000000004';
  if (select pg_catalog.count(*) from public.account_notifications
      where source_record_id = v_proposal_id
        and projection_kind = 'outcome') <> 1 then
    raise exception 'proposer_did_not_receive_exactly_one_outcome_notification';
  end if;
  if exists (
    select 1 from public.account_notifications
    where source_record_id = v_proposal_id
      and (
        coalesce(safe_title, '') like '%console.log%'
        or coalesce(safe_preview, '') like '%private explanation%'
      )
  ) then
    raise exception 'proposal_private_body_leaked_to_outcome_notification';
  end if;
end
$proposal_outcome_visibility$;

reset role;

do $proposal_event_server_contract$
declare
  v_withdrawn_id uuid;
  v_accepted_id uuid;
  v_self_id uuid;
begin
  select id into strict v_withdrawn_id
  from public.commune_code_revision_proposals
  where client_request_id = '88000000-0000-4000-8000-000000000001';
  select id into strict v_accepted_id
  from public.commune_code_revision_proposals
  where client_request_id = '88000000-0000-4000-8000-000000000004';
  select id into strict v_self_id
  from public.commune_code_revision_proposals
  where client_request_id = '88000000-0000-4000-8000-000000000005';

  if (select pg_catalog.count(*) from private.account_events
      where idempotency_key = 'code-proposal:' || v_withdrawn_id::text || ':submitted:v1') <> 1
     or (select pg_catalog.count(*) from private.account_events
      where idempotency_key = 'code-proposal:' || v_withdrawn_id::text || ':withdrawn:v1') <> 1
     or (select pg_catalog.count(*) from private.account_events
      where idempotency_key = 'code-proposal:' || v_accepted_id::text || ':accepted:v1') <> 1 then
    raise exception 'proposal_event_idempotency_contract_failed';
  end if;
  if exists (
    select 1 from private.account_events
    where source_type = 'code_revision_proposal'
      and (
        safe_title like '%console.log%'
        or coalesce(safe_preview, '') like '%private explanation%'
        or safe_payload::text like '%private explanation%'
      )
  ) then
    raise exception 'proposal_private_content_leaked_to_account_event';
  end if;
  if not exists (
    select 1 from public.account_inbox_items
    where source_record_id = v_withdrawn_id and superseded_at is not null
  ) then
    raise exception 'withdrawal_did_not_supersede_author_inbox_item';
  end if;
  if not exists (
    select 1 from public.account_notifications
    where source_record_id = v_withdrawn_id
      and safe_title like '%withdrawn%'
  ) then
    raise exception 'withdrawal_did_not_notify_original_author';
  end if;
  if exists (
    select 1 from public.account_inbox_items where source_record_id = v_self_id
    union all
    select 1 from public.account_notifications where source_record_id = v_self_id
  ) then
    raise exception 'self_proposal_projection_exists';
  end if;
  if (select pg_catalog.count(*) from public.user_notifications
      where source_id = v_withdrawn_id
        and notification_type = 'commune_code_revision_proposed') <> 1
     or (select pg_catalog.count(*) from public.user_notifications
      where source_id = v_withdrawn_id
        and notification_type = 'commune_code_revision_withdrawn') <> 1
     or (select pg_catalog.count(*) from public.user_notifications
      where source_id = v_accepted_id
        and notification_type = 'commune_code_revision_accepted') <> 1 then
    raise exception 'proposal_legacy_compatibility_projection_failed';
  end if;
end
$proposal_event_server_contract$;

select 'code_proposal_integrity_behavior_ok' as result;

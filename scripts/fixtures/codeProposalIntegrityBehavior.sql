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

reset role;

select 'code_proposal_integrity_behavior_ok' as result;

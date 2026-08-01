\set ON_ERROR_STOP on

-- This fixture runs only after sandboxDatabaseBehavior.sql in the disposable
-- Supabase Postgres container. Every identifier and value is synthetic.

set role authenticated;

do $proposal_lifecycle$
declare
  v_proposal_id uuid;
  v_rejected_id uuid;
  v_withdrawn_id uuid;
  v_initial_code text;
  v_initial_language text;
  v_initial_file_name text;
  v_initial_version integer;
begin
  select code_text, language, file_name, accepted_version_number
  into v_initial_code, v_initial_language, v_initial_file_name, v_initial_version
  from public.commune_code_snippets
  where id = 'c1111111-1111-4111-8111-111111111111';

  perform pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  v_proposal_id := public.submit_commune_code_revision_proposal(
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(2)',
    'javascript',
    'public.js',
    'Switch the fixture artifact to JavaScript.',
    'Synthetic proposal explanation.'
  );
  if v_proposal_id is null then raise exception 'proposal_submission_returned_null'; end if;
  if exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and (code_text <> v_initial_code or language <> v_initial_language or file_name <> v_initial_file_name or accepted_version_number <> v_initial_version)
  ) then raise exception 'proposal_submission_mutated_attached_snapshot'; end if;
  if not exists (
    select 1 from public.commune_code_revision_proposals
    where id = v_proposal_id
      and proposer_user_id = '11111111-1111-4111-8111-111111111111'
      and original_author_user_id = '66666666-6666-4666-8666-666666666666'
      and proposal_status = 'submitted'
      and base_code_text = v_initial_code
      and proposed_code_text = 'console.log(2)'
  ) then raise exception 'proposal_submission_history_or_attribution_failed'; end if;

  begin
    perform public.decide_commune_code_revision_proposal(v_proposal_id, 'accepted', 'Unauthorized fixture decision.');
    raise exception 'non_author_acceptance_succeeded';
  exception when others then
    if sqlerrm = 'non_author_acceptance_succeeded' then raise; end if;
    if sqlerrm not like 'Only the original post author%' then raise; end if;
  end;
  if exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text <> v_initial_code
  ) then raise exception 'non_author_attempt_mutated_attached_snapshot'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
  perform public.decide_commune_code_revision_proposal(v_proposal_id, 'needs_changes', 'Clarify the fixture revision.');
  if exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text <> v_initial_code
  ) then raise exception 'needs_changes_mutated_attached_snapshot'; end if;

  perform public.decide_commune_code_revision_proposal(v_proposal_id, 'accepted', 'Accepted synthetic revision.');
  if not exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text = 'console.log(2)'
      and language = 'javascript'
      and file_name = 'public.js'
      and accepted_revision_id = v_proposal_id
      and accepted_version_number = v_initial_version + 1
      and accepted_revision_proposer_user_id = '11111111-1111-4111-8111-111111111111'
  ) then raise exception 'author_acceptance_did_not_publish_expected_version'; end if;
  if not exists (
    select 1 from public.commune_code_revision_proposals
    where id = v_proposal_id
      and proposal_status = 'accepted'
      and accepted_version_number = v_initial_version + 1
      and decision_by = '66666666-6666-4666-8666-666666666666'
  ) then raise exception 'author_acceptance_history_failed'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  v_rejected_id := public.submit_commune_code_revision_proposal(
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(3)',
    'javascript',
    'public.js',
    'Rejected synthetic revision.',
    null
  );
  perform pg_catalog.set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
  perform public.decide_commune_code_revision_proposal(v_rejected_id, 'rejected', 'Rejected synthetic revision.');
  if not exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text = 'console.log(2)'
      and accepted_revision_id = v_proposal_id
      and accepted_version_number = v_initial_version + 1
  ) then raise exception 'rejection_mutated_attached_snapshot'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  v_withdrawn_id := public.submit_commune_code_revision_proposal(
    'a1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'console.log(4)',
    'javascript',
    'public.js',
    'Withdrawn synthetic revision.',
    null
  );
  update public.commune_code_revision_proposals
  set proposal_status = 'withdrawn', withdrawn_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_withdrawn_id
    and proposer_user_id = auth.uid();
  if not found then raise exception 'proposal_withdrawal_not_permitted_for_proposer'; end if;
  if not exists (
    select 1 from public.commune_code_revision_proposals
    where id = v_withdrawn_id and proposal_status = 'withdrawn'
  ) then raise exception 'proposal_withdrawal_status_failed'; end if;
  if not exists (
    select 1 from public.commune_code_snippets
    where id = 'c1111111-1111-4111-8111-111111111111'
      and code_text = 'console.log(2)'
      and accepted_revision_id = v_proposal_id
      and accepted_version_number = v_initial_version + 1
  ) then raise exception 'withdrawal_mutated_attached_snapshot'; end if;
end
$proposal_lifecycle$;

reset role;

select 'code_revision_proposal_behavior_ok' as result;

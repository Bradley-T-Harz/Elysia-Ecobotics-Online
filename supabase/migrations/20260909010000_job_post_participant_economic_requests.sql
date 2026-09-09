-- Private participant intake only. Existing assessments/grants remain the sole
-- economic authority. No fee, publication, provider, policy or feature flag changes.
begin;

create table private.job_post_economic_requests (
  job_post_id uuid primary key references public.commune_job_posts(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  category text,
  explanation text not null,
  status text not null default 'submitted',
  response text not null default '',
  revision integer not null default 1 check (revision > 0),
  last_command_id uuid not null unique,
  last_command_hash text not null,
  responded_by uuid references auth.users(id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category is null or category in ('small_organization', 'community_benefit', 'financial_hardship', 'education_research', 'other')),
  check (length(btrim(explanation)) between 1 and 500),
  check (length(response) <= 500),
  check (status in ('submitted', 'reviewing', 'needs_information', 'answered', 'withdrawn'))
);
alter table private.job_post_economic_requests owner to postgres;
alter table private.job_post_economic_requests enable row level security;
alter table private.job_post_economic_requests force row level security;
revoke all on private.job_post_economic_requests from public, anon, authenticated, service_role;

insert into private.online_action_rate_policies(policy_key, resource_domain, action, new_or_unverified_limit, established_verified_limit, window_seconds)
values ('job_post_assistance_request', 'commune', 'assistance_request', 10, 30, 86400);

create function private.job_post_request_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.community_account_is_active(v_actor)
     or not private.community_account_is_recoverable(v_actor)
     or not exists (select 1 from auth.users u where u.id = v_actor
       and u.deleted_at is null and not coalesce(u.is_anonymous, false)
       and (u.banned_until is null or u.banned_until <= now())) then
    raise exception using errcode = '42501', message = 'job_post_request_forbidden';
  end if;
  return v_actor;
end;
$$;
alter function private.job_post_request_actor() owner to postgres;
revoke all on function private.job_post_request_actor() from public, anon, authenticated, service_role;

create function public.current_user_job_post_fee_workspace(p_operator boolean default false, p_job_post_id uuid default null, p_before uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := private.job_post_request_actor();
  v_can_review boolean := private.economic_operator_has_capability(v_actor, 'economic_assistance_manage');
  v_rows jsonb;
begin
  if p_operator is null or (p_operator and not (v_can_review or private.economic_operator_has_capability(v_actor, 'job_fee_assess'))) then
    raise exception using errcode = '42501', message = 'job_post_request_forbidden';
  end if;
  if p_job_post_id is not null and not exists (
    select 1 from public.commune_job_posts j join public.commune_posts p on p.id = j.post_id
    where j.id = p_job_post_id and j.author_user_id = p.user_id
      and p.post_type = 'job_post' and (p_operator or j.author_user_id = v_actor)
  ) then raise exception using errcode = '42501', message = 'job_post_request_forbidden'; end if;
  select coalesce(jsonb_agg(item order by id desc), '[]'::jsonb) into v_rows from (
    select j.id, jsonb_build_object(
      'jobPostId', j.id, 'postId', j.post_id, 'authorUserId', case when p_operator then j.author_user_id else null end, 'title', left(p.title, 240),
      'contentStatus', p.status,
      'classification', coalesce(c.classification, 'not_assessed'),
      'conditionStatus', case when c.classification in ('waived', 'subsidized') and not exists (
        select 1 from private.economic_assistance_grants g where g.id = coalesce(c.waiver_id, c.subsidy_id)
          and g.beneficiary_user_id = j.author_user_id and g.scope = 'job_post_fee'
          and g.status = 'consumed' and g.consumed_resource_id = j.id
      ) then 'reconciliation_required' else coalesce(c.condition_status, 'not_assessed') end,
      'request', case when r.job_post_id is null then null else jsonb_build_object(
        'category', r.category, 'explanation', r.explanation, 'status', r.status,
        'response', r.response, 'revision', r.revision, 'updatedAt', r.updated_at
      ) end
    ) item
    from public.commune_job_posts j join public.commune_posts p on p.id = j.post_id
    left join private.job_post_economic_conditions c on c.job_post_id = j.id and c.author_user_id = j.author_user_id and c.post_id = j.post_id
    left join private.job_post_economic_requests r on r.job_post_id = j.id and r.author_user_id = j.author_user_id
    where j.author_user_id = p.user_id and p.post_type = 'job_post'
      and (case when p_operator then r.job_post_id is not null else j.author_user_id = v_actor end)
      and (p_job_post_id is null or j.id = p_job_post_id) and (p_before is null or j.id < p_before)
    order by j.id desc limit 21
  ) bounded;
  return jsonb_build_object('items', case when jsonb_array_length(v_rows) > 20 then v_rows - 20 else v_rows end,
    'hasMore', jsonb_array_length(v_rows) > 20,
    'cursor', case when jsonb_array_length(v_rows) > 20 then v_rows->19->>'jobPostId' else null end,
    'canReview', p_operator and v_can_review,
    'canAssess', p_operator and private.economic_operator_has_capability(v_actor, 'job_fee_assess'), 'paymentsCollected', false);
end;
$$;

create function public.submit_job_post_fee_request_command(p_command jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := private.job_post_request_actor();
  v_action text := p_command->>'action';
  v_job uuid;
  v_author uuid;
  v_command uuid;
  v_revision integer;
  v_request private.job_post_economic_requests%rowtype;
  v_keys text[];
  v_hash text := md5(p_command::text);
  v_status text;
begin
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text) > 5000 then
    raise exception using errcode = '22023', message = 'job_post_request_invalid';
  end if;
  v_keys := case v_action
    when 'submit' then array['action','jobPostId','commandId','expectedRevision','category','explanation']
    when 'withdraw' then array['action','jobPostId','commandId','expectedRevision']
    when 'review' then array['action','jobPostId','commandId','expectedRevision','status','response'] end;
  if v_keys is null or (select count(*) from jsonb_object_keys(p_command)) <> cardinality(v_keys)
     or p_command - v_keys <> '{}'::jsonb
     or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number'
     or (p_command->>'expectedRevision') !~ '^[0-9]{1,9}$' then
    raise exception using errcode = '22023', message = 'job_post_request_invalid';
  end if;
  v_job := (p_command->>'jobPostId')::uuid;
  v_command := (p_command->>'commandId')::uuid;
  v_revision := (p_command->>'expectedRevision')::integer;
  if v_job is null or v_command is null then raise exception using errcode = '22023', message = 'job_post_request_invalid'; end if;
  -- Lock the source even before the first request; serialize concurrent creates.
  select j.author_user_id into v_author from public.commune_job_posts j
    join public.commune_posts p on p.id = j.post_id
    where j.id = v_job and j.author_user_id = p.user_id and p.post_type = 'job_post' for update of j;
  if not found or (v_action <> 'review' and v_author <> v_actor)
     or (v_action = 'review' and not private.economic_operator_has_capability(v_actor, 'economic_assistance_manage')) then
    raise exception using errcode = '42501', message = 'job_post_request_forbidden';
  end if;
  select * into v_request from private.job_post_economic_requests where job_post_id = v_job for update;
  if v_request.job_post_id is not null and v_request.author_user_id <> v_author then
    raise exception using errcode = '42501', message = 'job_post_request_forbidden';
  end if;
  if v_request.last_command_id = v_command then
    if v_request.last_command_hash <> v_hash then raise exception using errcode = '40001', message = 'job_post_request_conflict'; end if;
    return jsonb_build_object('jobPostId', v_job, 'revision', v_request.revision, 'commandId', v_command);
  end if;
  if v_revision <> coalesce(v_request.revision, 0) then raise exception using errcode = '40001', message = 'job_post_request_conflict'; end if;
  if v_action = 'submit' then
    if jsonb_typeof(p_command->'explanation') is distinct from 'string'
       or length(btrim(p_command->>'explanation')) not between 1 and 500
       or (p_command->'category' <> 'null'::jsonb and (jsonb_typeof(p_command->'category') <> 'string'
         or p_command->>'category' not in ('small_organization','community_benefit','financial_hardship','education_research','other'))) then
      raise exception using errcode = '22023', message = 'job_post_request_invalid';
    end if;
    perform private.consume_online_action_rate(v_actor, 'job_post_assistance_request', 'job_post_fee_request');
    v_status := 'submitted';
    insert into private.job_post_economic_requests(job_post_id, author_user_id, category, explanation, last_command_id, last_command_hash)
      values (v_job, v_actor, p_command->>'category', btrim(p_command->>'explanation'), v_command, v_hash)
    on conflict (job_post_id) do update set category = excluded.category, explanation = excluded.explanation,
      status = 'submitted', revision = job_post_economic_requests.revision + 1,
      last_command_id = v_command, last_command_hash = v_hash, updated_at = now();
  else
    if v_request.job_post_id is null or v_request.status = 'withdrawn' then
      raise exception using errcode = '40001', message = 'job_post_request_conflict';
    end if;
    v_status := case when v_action = 'withdraw' then 'withdrawn' else p_command->>'status' end;
    if v_action = 'review' and (v_status is null or v_status not in ('reviewing','needs_information','answered')
       or jsonb_typeof(p_command->'response') is distinct from 'string'
       or length(btrim(p_command->>'response')) not between 1 and 500) then
      raise exception using errcode = '22023', message = 'job_post_request_invalid';
    end if;
    update private.job_post_economic_requests set status = v_status, revision = revision + 1,
      response = case when v_action = 'review' then btrim(p_command->>'response') else response end,
      responded_by = case when v_action = 'review' then v_actor else responded_by end,
      responded_at = case when v_action = 'review' then now() else responded_at end,
      last_command_id = v_command, last_command_hash = v_hash, updated_at = now() where job_post_id = v_job;
  end if;
  -- No private explanation is copied into generic notifications or public metadata.
  insert into private.economic_audit_events(actor_user_id, actor_kind, action, target_type, target_id, reason, metadata)
    values (v_actor, case when v_action = 'review' then 'economic_operator' else 'user' end,
      'job_post_fee_request_' || v_action, 'job_post', v_job, 'Private request handling; no economic or content decision.',
      jsonb_build_object('request_status', v_status, 'revision', v_revision + 1, 'command_id', v_command,
        'previous_status', v_request.status));
  return jsonb_build_object('jobPostId', v_job, 'revision', v_revision + 1, 'commandId', v_command);
end;
$$;

alter function public.current_user_job_post_fee_workspace(boolean, uuid, uuid) owner to postgres;
alter function public.submit_job_post_fee_request_command(jsonb) owner to postgres;
revoke all on function public.current_user_job_post_fee_workspace(boolean, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.submit_job_post_fee_request_command(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.current_user_job_post_fee_workspace(boolean, uuid, uuid) to authenticated;
grant execute on function public.submit_job_post_fee_request_command(jsonb) to authenticated;
comment on table private.job_post_economic_requests is 'Private participant request intake. No grant, discount, payment, content decision or public entitlement is created here. Retention policy remains an owner decision; no automatic deletion.';
commit;

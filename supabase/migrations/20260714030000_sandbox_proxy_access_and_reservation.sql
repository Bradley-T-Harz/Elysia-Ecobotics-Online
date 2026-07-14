-- Governed Coding Cornucopia sandbox proxy access, reservations, and finalization.
-- Additive only. Review and apply at the explicit production checkpoint.
-- No secret value belongs in this migration: private.sandbox_proxy_secrets is
-- provisioned with a NULL hash and must be initialized directly by an operator.

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
alter schema private owner to postgres;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.sandbox_proxy_secrets (
  secret_name text primary key,
  secret_hash_hex char(64),
  rotated_at timestamptz,
  constraint sandbox_proxy_secret_hash_check check (
    secret_hash_hex is null or secret_hash_hex ~ '^[0-9a-f]{64}$'
  )
);
alter table private.sandbox_proxy_secrets owner to postgres;

revoke all on table private.sandbox_proxy_secrets from public, anon, authenticated;

insert into private.sandbox_proxy_secrets(secret_name, secret_hash_hex)
values ('sandbox_db_finalizer', null)
on conflict (secret_name) do nothing;

alter table public.commune_sandbox_runs
  add column if not exists client_request_id uuid,
  add column if not exists code_sha256 char(64),
  add column if not exists code_bytes integer,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists attempt_count integer not null default 1,
  add column if not exists output_truncated boolean not null default false;

update public.commune_sandbox_runs
set client_request_id = gen_random_uuid()
where client_request_id is null;

alter table public.commune_sandbox_runs
  alter column client_request_id set default gen_random_uuid(),
  alter column client_request_id set not null;

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_status_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_status_check check (
    status in (
      'draft', 'requested', 'queued', 'running', 'completed', 'failed',
      'denied', 'policy_blocked', 'sandbox_unavailable'
    )
  );

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_code_hash_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_code_hash_check check (
    code_sha256 is null or code_sha256 ~ '^[0-9a-f]{64}$'
  );

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_code_bytes_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_code_bytes_check check (
    code_bytes is null or code_bytes between 0 and 65536
  );

create unique index if not exists commune_sandbox_runs_idempotency_idx
  on public.commune_sandbox_runs(requester_user_id, client_request_id)
  where requester_user_id is not null;

create index if not exists commune_sandbox_runs_active_lease_idx
  on public.commune_sandbox_runs(requester_user_id, reservation_expires_at)
  where status in ('queued', 'running');

insert into public.commune_sandbox_policies(policy_key, policy_value, notes)
values
  (
    'v1_resource_limits',
    '{"cpus":"0.5","memory":"256m","timeout_seconds":5,"pids_limit":32,"max_output_bytes":65536,"hard_output_bytes":98304,"max_concurrent_runs":1,"queue":false}'::jsonb,
    'Production V1 is one rootless Podman execution at a time with no in-process queue.'
  ),
  (
    'v1_request_quota',
    '{"member":{"per_hour":10,"per_day":30},"reviewer":{"per_hour":20,"per_day":60},"admin":{"per_hour":30,"per_day":100},"reservation_lease_seconds":60,"busy_retry_after_seconds":4}'::jsonb,
    'Atomic per-user reservation limits derived from server-side roles. Every tier has identical container isolation.'
  )
on conflict (policy_key) do update set
  policy_value = excluded.policy_value,
  notes = excluded.notes,
  updated_at = now();

-- The former browser-callable function accepted arbitrary success results.
-- Keep the historical migration intact, but remove every API role's ability to
-- execute that exact overload.
revoke execute on function public.record_commune_sandbox_run_result(
  text, text, text, uuid, uuid, uuid, text, text, text, jsonb, jsonb,
  text, text, integer, integer, jsonb
) from public, anon, authenticated, service_role;

revoke all privileges on table public.commune_sandbox_runs from public, anon, authenticated;
revoke all privileges on table public.commune_code_diagnostics from public, anon, authenticated;
grant select on table public.commune_sandbox_runs to authenticated;
grant select on table public.commune_code_diagnostics to authenticated;

drop policy if exists "users create own coding cornucopia sandbox run requests" on public.commune_sandbox_runs;
drop policy if exists "reviewers update coding cornucopia sandbox runs" on public.commune_sandbox_runs;
drop policy if exists "reviewers write coding cornucopia diagnostics" on public.commune_code_diagnostics;

create or replace function private.enforce_sandbox_run_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'requested')
    or (old.status = 'requested' and new.status in ('queued', 'denied', 'policy_blocked', 'sandbox_unavailable'))
    or (old.status = 'queued' and new.status in ('running', 'denied', 'policy_blocked', 'sandbox_unavailable'))
    or (old.status = 'running' and new.status in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable'))
  ) then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  return new;
end;
$$;

alter function private.enforce_sandbox_run_status_transition() owner to postgres;

revoke execute on function private.enforce_sandbox_run_status_transition()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_sandbox_run_status_transition on public.commune_sandbox_runs;
create trigger enforce_sandbox_run_status_transition
before update of status on public.commune_sandbox_runs
for each row execute function private.enforce_sandbox_run_status_transition();

create or replace function private.sandbox_finalizer_token_is_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.sandbox_proxy_secrets as secret
    where secret.secret_name = 'sandbox_db_finalizer'
      and secret.secret_hash_hex is not null
      and length(coalesce(p_token, '')) between 32 and 512
      and secret.secret_hash_hex = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

alter function private.sandbox_finalizer_token_is_valid(text) owner to postgres;

revoke execute on function private.sandbox_finalizer_token_is_valid(text)
  from public, anon, authenticated, service_role;

create or replace function private.sandbox_actor_is_active(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    join public.profiles as profile on profile.id = account.id
    where account.id = p_actor
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  );
$$;

alter function private.sandbox_actor_is_active(uuid) owner to postgres;

revoke execute on function private.sandbox_actor_is_active(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_sandbox_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object('authorized', false, 'reason', 'authentication_required')
    when not exists (select 1 from public.profiles where id = auth.uid()) then
      jsonb_build_object('authorized', false, 'reason', 'profile_required')
    when not private.sandbox_actor_is_active(auth.uid()) then
      jsonb_build_object('authorized', false, 'reason', 'account_disabled')
    else
      jsonb_build_object(
        'authorized', true,
        'reason', 'authorized',
        'tier', case
          when public.current_user_is_admin() then 'admin'
          when public.current_user_can_review_domain('commune'::public.review_domain) then 'reviewer'
          else 'member'
        end,
        'limits', case
          when public.current_user_is_admin() then jsonb_build_object('perHour', 30, 'perDay', 100)
          when public.current_user_can_review_domain('commune'::public.review_domain) then jsonb_build_object('perHour', 20, 'perDay', 60)
          else jsonb_build_object('perHour', 10, 'perDay', 30)
        end,
        'reviewer', (
          public.current_user_is_admin()
          or public.current_user_can_review_domain('commune'::public.review_domain)
        )
      )
  end;
$$;

alter function public.current_user_sandbox_access() owner to postgres;

revoke execute on function public.current_user_sandbox_access()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_sandbox_access() to authenticated;

drop policy if exists "public reads published commune code snippets" on public.commune_code_snippets;
create policy "public reads published commune code snippets" on public.commune_code_snippets
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts as post
      where post.id = public.commune_code_snippets.post_id
        and post.status = 'published'
        and post.visibility = 'public'
    )
  );

create or replace function private.sandbox_source_is_authorized(
  p_actor uuid,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_reviewer boolean;
begin
  if p_source_type = 'manual_snapshot' then
    return nullif(trim(coalesce(p_source_id, '')), '') is null
      and p_post_id is null
      and p_code_document_id is null
      and p_code_version_id is null;
  end if;

  if coalesce(p_source_id, '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  v_source_id := p_source_id::uuid;
  v_reviewer := public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain);

  if p_source_type = 'commune_post_snippet' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_snippets as snippet
        join public.commune_posts as post on post.id = snippet.post_id
        where snippet.id = v_source_id
          and snippet.post_id = p_post_id
          and (
            (post.status = 'published' and post.visibility = 'public')
            or snippet.author_user_id = p_actor
            or v_reviewer
          )
      );
  elsif p_source_type = 'commune_code_document' then
    return p_post_id is null
      and p_code_version_id is null
      and p_code_document_id = v_source_id
      and exists (
        select 1
        from public.commune_code_documents as document
        where document.id = v_source_id
          and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'commune_code_version' then
    return p_post_id is null
      and p_code_version_id = v_source_id
      and exists (
        select 1
        from public.commune_code_document_versions as version
        join public.commune_code_documents as document on document.id = version.document_id
        where version.id = v_source_id
          and version.document_id = p_code_document_id
          and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'commune_code_revision_proposal' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_revision_proposals as proposal
        where proposal.id = v_source_id
          and proposal.post_id = p_post_id
          and (proposal.proposer_user_id = p_actor or proposal.original_author_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'repository_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_repository_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and (
            (post.post_type = 'repository_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.user_id = p_actor
            or v_reviewer
          )
      );
  elsif p_source_type = 'iteration_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_iteration_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and (
            (post.post_type = 'elysia_iteration_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.author_user_id = p_actor
            or v_reviewer
          )
      );
  end if;

  return false;
end;
$$;

alter function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  owner to postgres;

revoke execute on function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.reserve_commune_sandbox_run(
  p_client_request_id uuid,
  p_snapshot_id text,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid,
  p_language text,
  p_file_name text,
  p_code_sha256 text,
  p_code_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.commune_sandbox_runs%rowtype;
  v_run public.commune_sandbox_runs%rowtype;
  v_hour_count integer;
  v_day_count integer;
  v_hour_limit integer;
  v_day_limit integer;
  v_source_type text := trim(coalesce(p_source_type, ''));
  v_language text := lower(trim(coalesce(p_language, '')));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor) then
    raise exception using errcode = '42501', message = 'sandbox_profile_required';
  end if;

  if not private.sandbox_actor_is_active(v_actor) then
    raise exception using errcode = '42501', message = 'sandbox_account_disabled';
  end if;

  if public.current_user_is_admin() then
    v_hour_limit := 30;
    v_day_limit := 100;
  elsif public.current_user_can_review_domain('commune'::public.review_domain) then
    v_hour_limit := 20;
    v_day_limit := 60;
  else
    v_hour_limit := 10;
    v_day_limit := 30;
  end if;

  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'sandbox_client_request_id_required';
  end if;

  if length(trim(coalesce(p_snapshot_id, ''))) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'sandbox_snapshot_id_invalid';
  end if;

  if v_source_type not in (
    'commune_post_snippet',
    'commune_code_document',
    'commune_code_version',
    'commune_code_revision_proposal',
    'repository_showcase_artifact',
    'iteration_showcase_artifact',
    'manual_snapshot'
  ) then
    raise exception using errcode = '22023', message = 'sandbox_source_type_invalid';
  end if;

  if v_source_type <> 'manual_snapshot' and coalesce(p_source_id, '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception using errcode = '22023', message = 'sandbox_source_id_invalid';
  end if;

  if not private.sandbox_source_is_authorized(
    v_actor, v_source_type, p_source_id, p_post_id, p_code_document_id, p_code_version_id
  ) then
    raise exception using errcode = '42501', message = 'sandbox_source_unauthorized';
  end if;

  if v_language not in ('python', 'javascript', 'typescript', 'json', 'yaml', 'markdown', 'html', 'css') then
    raise exception using errcode = '22023', message = 'sandbox_language_invalid';
  end if;

  if coalesce(p_code_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'sandbox_code_hash_invalid';
  end if;

  if p_code_bytes is null or p_code_bytes not between 1 and 65536 then
    raise exception using errcode = '22023', message = 'sandbox_code_size_invalid';
  end if;

  -- Serialize reservations per user so active-run and quota checks cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 0));

  update public.commune_sandbox_runs
  set
    status = 'sandbox_unavailable',
    result_summary = jsonb_build_object(
      'ok', false,
      'message', 'The reservation expired before finalization.',
      'reason', 'reservation_expired',
      'diagnostics', '[]'::jsonb
    ),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where requester_user_id = v_actor
    and status in ('queued', 'running')
    and reservation_expires_at < now();

  select * into v_existing
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id = p_client_request_id;

  if found then
    if v_existing.code_sha256 is distinct from p_code_sha256
       or v_existing.source_type is distinct from v_source_type
       or v_existing.source_id is distinct from nullif(trim(coalesce(p_source_id, '')), '')
       or v_existing.snapshot_id is distinct from trim(p_snapshot_id)
       or v_existing.language is distinct from v_language
       or v_existing.file_name is distinct from nullif(left(trim(coalesce(p_file_name, '')), 160), '')
       or v_existing.post_id is distinct from p_post_id
       or v_existing.code_document_id is distinct from p_code_document_id
       or v_existing.code_version_id is distinct from p_code_version_id
       or v_existing.code_bytes is distinct from p_code_bytes
    then
      raise exception using errcode = '23505', message = 'sandbox_idempotency_conflict';
    end if;

    update public.commune_sandbox_runs
    set attempt_count = attempt_count + 1,
        updated_at = now()
    where id = v_existing.id
    returning * into v_existing;

    return jsonb_build_object(
      'accepted', true,
      'idempotentReplay', true,
      'runId', v_existing.id,
      'status', v_existing.status,
      'leaseExpiresAt', v_existing.reservation_expires_at,
      'result', case when v_existing.status in ('completed','failed','denied','policy_blocked','sandbox_unavailable')
        then jsonb_build_object(
          'ok', coalesce((v_existing.result_summary ->> 'ok')::boolean, false),
          'status', v_existing.status,
          'language', v_existing.language,
          'file', v_existing.file_name,
          'snapshotId', v_existing.snapshot_id,
          'stdout', coalesce(v_existing.stdout_preview, ''),
          'stderr', coalesce(v_existing.stderr_preview, ''),
          'exitCode', v_existing.exit_code,
          'durationMs', v_existing.duration_ms,
          'outputTruncated', v_existing.output_truncated,
          'diagnostics', coalesce(v_existing.result_summary -> 'diagnostics', '[]'::jsonb),
          'message', coalesce(v_existing.result_summary ->> 'message', 'Sandbox run finalized.')
        ) else null end
    );
  end if;

  if exists (
    select 1 from public.commune_sandbox_runs
    where requester_user_id = v_actor
      and status in ('queued', 'running')
      and reservation_expires_at >= now()
  ) then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'active_reservation',
      'retryAfter', 4
    );
  end if;

  select count(*) into v_hour_count
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id is not null
    and code_sha256 is not null
    and created_at >= now() - interval '1 hour';

  select count(*) into v_day_count
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id is not null
    and code_sha256 is not null
    and created_at >= now() - interval '24 hours';

  if v_hour_count >= v_hour_limit or v_day_count >= v_day_limit then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'quota_exceeded',
      'retryAfter', case when v_hour_count >= v_hour_limit then 3600 else 86400 end
    );
  end if;

  insert into public.commune_sandbox_runs (
    requester_user_id,
    post_id,
    code_document_id,
    code_version_id,
    source_type,
    source_id,
    snapshot_id,
    language,
    file_name,
    status,
    request_payload,
    result_summary,
    public_visibility,
    client_request_id,
    code_sha256,
    code_bytes,
    reservation_expires_at
  ) values (
    v_actor,
    p_post_id,
    p_code_document_id,
    p_code_version_id,
    v_source_type,
    nullif(trim(coalesce(p_source_id, '')), ''),
    trim(p_snapshot_id),
    v_language,
    nullif(left(trim(coalesce(p_file_name, '')), 160), ''),
    'queued',
    jsonb_build_object(
      'client_request_id', p_client_request_id,
      'source_type', v_source_type,
      'source_id', nullif(trim(coalesce(p_source_id, '')), ''),
      'snapshot_id', trim(p_snapshot_id),
      'language', v_language,
      'file_name', nullif(left(trim(coalesce(p_file_name, '')), 160), ''),
      'code_sha256', p_code_sha256,
      'code_bytes', p_code_bytes,
      'network_policy', 'disabled',
      'filesystem_policy', 'temporary_workspace_only'
    ),
    '{}'::jsonb,
    'private',
    p_client_request_id,
    p_code_sha256,
    p_code_bytes,
    now() + interval '60 seconds'
  ) returning * into v_run;

  return jsonb_build_object(
    'accepted', true,
    'idempotentReplay', false,
    'runId', v_run.id,
    'status', v_run.status,
    'leaseExpiresAt', v_run.reservation_expires_at
  );
end;
$$;

alter function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) owner to postgres;

revoke execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) to authenticated;

create or replace function public.start_commune_sandbox_run(
  p_run_id uuid,
  p_client_request_id uuid,
  p_finalizer_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.commune_sandbox_runs%rowtype;
begin
  if v_actor is null or not private.sandbox_finalizer_token_is_valid(p_finalizer_token) then
    raise exception using errcode = '42501', message = 'sandbox_finalizer_denied';
  end if;

  update public.commune_sandbox_runs
  set
    status = 'running',
    started_at = coalesce(started_at, now()),
    reservation_expires_at = now() + interval '60 seconds',
    updated_at = now()
  where id = p_run_id
    and requester_user_id = v_actor
    and client_request_id = p_client_request_id
    and status = 'queued'
    and reservation_expires_at >= now()
  returning * into v_run;

  if not found then
    raise exception using errcode = '55000', message = 'sandbox_reservation_not_startable';
  end if;

  return jsonb_build_object(
    'runId', v_run.id,
    'status', v_run.status,
    'leaseExpiresAt', v_run.reservation_expires_at
  );
end;
$$;

alter function public.start_commune_sandbox_run(uuid, uuid, text) owner to postgres;

revoke execute on function public.start_commune_sandbox_run(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.start_commune_sandbox_run(uuid, uuid, text) to authenticated;

create or replace function public.finalize_commune_sandbox_run(
  p_run_id uuid,
  p_client_request_id uuid,
  p_finalizer_token text,
  p_status text,
  p_ok boolean,
  p_message text,
  p_stdout_preview text,
  p_stderr_preview text,
  p_exit_code integer,
  p_duration_ms integer,
  p_output_truncated boolean,
  p_diagnostics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.commune_sandbox_runs%rowtype;
  v_diag jsonb;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_severity text;
  v_phase text;
  v_category text;
  v_line integer;
  v_column integer;
  v_diagnostics jsonb := '[]'::jsonb;
begin
  if v_actor is null or not private.sandbox_finalizer_token_is_valid(p_finalizer_token) then
    raise exception using errcode = '42501', message = 'sandbox_finalizer_denied';
  end if;

  if v_status not in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable') then
    raise exception using errcode = '22023', message = 'sandbox_final_status_invalid';
  end if;

  if coalesce(p_ok, false) is distinct from (v_status = 'completed') then
    raise exception using errcode = '22023', message = 'sandbox_final_result_inconsistent';
  end if;

  select * into v_run
  from public.commune_sandbox_runs
  where id = p_run_id
    and requester_user_id = v_actor
    and client_request_id = p_client_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_reservation_not_found';
  end if;

  if v_run.status in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable') then
    return jsonb_build_object('runId', v_run.id, 'status', v_run.status, 'alreadyFinalized', true);
  end if;

  if v_run.status not in ('queued', 'running') then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  if v_run.status = 'queued' and v_status not in ('denied', 'policy_blocked', 'sandbox_unavailable') then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  if jsonb_typeof(coalesce(p_diagnostics, '[]'::jsonb)) = 'array' then
    for v_diag in select value from jsonb_array_elements(p_diagnostics) limit 40 loop
      v_severity := coalesce(v_diag ->> 'severity', 'info');
      if v_severity not in ('info', 'warning', 'error') then v_severity := 'info'; end if;
      v_phase := coalesce(v_diag ->> 'phase', 'sandbox');
      if v_phase not in ('static', 'policy', 'runtime', 'sandbox', 'security') then v_phase := 'sandbox'; end if;
      v_category := coalesce(v_diag ->> 'category', 'sandbox_internal_failure');
      if v_category not in (
        'syntax_error', 'type_error', 'compile_error', 'runtime_error', 'test_failure',
        'lint_warning', 'dependency_blocked', 'network_denied', 'filesystem_denied',
        'timeout', 'memory_exceeded', 'output_truncated', 'forbidden_operation',
        'secret_scan_warning', 'unsupported_language', 'sandbox_internal_failure', 'policy_info'
      ) then v_category := 'sandbox_internal_failure'; end if;
      v_line := case when coalesce(v_diag ->> 'line', '') ~ '^[0-9]{1,7}$' then (v_diag ->> 'line')::integer else null end;
      v_column := case when coalesce(v_diag ->> 'column', '') ~ '^[0-9]{1,7}$' then (v_diag ->> 'column')::integer else null end;

      v_diagnostics := v_diagnostics || jsonb_build_array(jsonb_build_object(
        'severity', v_severity,
        'phase', v_phase,
        'category', v_category,
        'language', v_run.language,
        'file', v_run.file_name,
        'line', v_line,
        'column', v_column,
        'message', left(coalesce(v_diag ->> 'message', 'Sandbox diagnostic.'), 1000),
        'source', 'Coding Cornucopia sandbox'
      ));
    end loop;
  end if;

  update public.commune_sandbox_runs
  set
    status = v_status,
    result_summary = jsonb_build_object(
      'ok', coalesce(p_ok, false),
      'message', left(coalesce(p_message, 'Sandbox run finalized.'), 500),
      'diagnostics', v_diagnostics
    ),
    stdout_preview = left(coalesce(p_stdout_preview, ''), 32768),
    stderr_preview = left(coalesce(p_stderr_preview, ''), 32768),
    exit_code = case when p_exit_code between -1 and 255 then p_exit_code else null end,
    duration_ms = case when p_duration_ms between 0 and 15000 then p_duration_ms else null end,
    output_truncated = coalesce(p_output_truncated, false),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where id = v_run.id;

  delete from public.commune_code_diagnostics where run_id = v_run.id;

  for v_diag in select value from jsonb_array_elements(v_diagnostics) loop
    insert into public.commune_code_diagnostics (
      run_id, post_id, code_document_id, code_version_id,
      severity, phase, category, language, file_name,
      line_number, column_number, message, source, public_visibility
    ) values (
      v_run.id, v_run.post_id, v_run.code_document_id, v_run.code_version_id,
      v_diag ->> 'severity', v_diag ->> 'phase', v_diag ->> 'category',
      v_run.language, v_run.file_name,
      case when jsonb_typeof(v_diag -> 'line') = 'number' then (v_diag ->> 'line')::integer else null end,
      case when jsonb_typeof(v_diag -> 'column') = 'number' then (v_diag ->> 'column')::integer else null end,
      v_diag ->> 'message', v_diag ->> 'source', 'private'
    );
  end loop;

  return jsonb_build_object('runId', v_run.id, 'status', v_status, 'alreadyFinalized', false);
end;
$$;

alter function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) owner to postgres;

revoke execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) to authenticated;

create or replace function public.reconcile_stale_commune_sandbox_runs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'sandbox_reconciliation_denied';
  end if;

  update public.commune_sandbox_runs
  set
    status = 'sandbox_unavailable',
    result_summary = jsonb_build_object(
      'ok', false,
      'message', 'The reservation expired before finalization.',
      'reason', 'reservation_expired',
      'diagnostics', '[]'::jsonb
    ),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where status in ('queued', 'running')
    and reservation_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter function public.reconcile_stale_commune_sandbox_runs() owner to postgres;

revoke execute on function public.reconcile_stale_commune_sandbox_runs()
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_stale_commune_sandbox_runs()
  to authenticated;

comment on table private.sandbox_proxy_secrets is
  'Private hashes for narrowly scoped proxy credentials. Never store a plaintext token here.';
comment on function public.reserve_commune_sandbox_run is
  'Atomically reserves one governed sandbox run per authenticated user with idempotency, quota, and stale-lease recovery.';
comment on function public.finalize_commune_sandbox_run is
  'Finalizes a reserved run only when the caller JWT, user, idempotency key, run, lifecycle, and private proxy finalizer token all match.';
comment on function public.reconcile_stale_commune_sandbox_runs is
  'Allows an authenticated administrator to finalize genuinely stale sandbox leases without changing completed evidence.';

commit;

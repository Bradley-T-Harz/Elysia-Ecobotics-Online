-- User-sovereign account lifecycle completion.
--
-- This forward-only migration closes direct Storage/sandbox activation gaps
-- and adds a leased, service-role-only automatic finalizer over the existing
-- canonical account_lifecycle_requests state/history. Participation and
-- activation remain independent; no existing account data is rewritten.

begin;

-- One additive gate for ordinary account-owned mutations. Existing
-- per-feature participation, role, ownership, and moderation checks remain in
-- force; this adds only the shared voluntary pause/deletion boundary.
create or replace function private.community_account_allows_ordinary_mutation(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not exists (
      select 1
      from private.account_lifecycle_requests as request
      where request.user_id = p_user_id
        and request.action = 'account_deletion'
        and request.status in (
          'submitted','identity_verification','cooling_period','operator_review',
          'processing','storage_inventory','storage_cleanup',
          'auth_deletion_ready','auth_deletion_confirmed','blocked_by_legal_hold'
        )
    ),
    false
  );
$$;

alter function private.community_account_allows_ordinary_mutation(uuid) owner to postgres;
revoke all privileges on function private.community_account_allows_ordinary_mutation(uuid)
  from public, anon, authenticated, service_role;
-- Storage evaluates policy expressions as the authenticated database role.
-- The function remains in the non-exposed private schema and grants no
-- mutation authority; this execute grant is only what lets the policy obtain
-- its fail-closed boolean decision.
grant execute on function private.community_account_allows_ordinary_mutation(uuid)
  to authenticated;

create or replace function private.community_deletion_has_active_account_hold(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from private.account_legal_holds as hold
      where hold.user_id = p_user_id and hold.lifted_at is null
    )
    or exists (
      select 1
      from artisan.legal_hold_records as hold
      where hold.target_type = 'account'
        and hold.target_id = p_user_id
        and hold.released_at is null
    ),
    false
  );
$$;

alter function private.community_deletion_has_active_account_hold(uuid) owner to postgres;
revoke all privileges on function private.community_deletion_has_active_account_hold(uuid)
  from public, anon, authenticated, service_role;

-- Recreate every permissive account-owned Storage mutation policy with the
-- shared activation/deletion gate. Reads needed by export, lifecycle support,
-- moderation, and trusted cleanup remain unchanged.
drop policy if exists "users upload own profile avatars" on storage.objects;
create policy "users upload own profile avatars"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own profile avatars" on storage.objects;
create policy "users update own profile avatars"
on storage.objects for update to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own profile avatars" on storage.objects;
create policy "users delete own profile avatars"
on storage.objects for delete to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users upload own profile banners" on storage.objects;
create policy "users upload own profile banners"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own profile banners" on storage.objects;
create policy "users update own profile banners"
on storage.objects for update to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own profile banners" on storage.objects;
create policy "users delete own profile banners"
on storage.objects for delete to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile owners upload private originals" on storage.objects;
create policy "profile owners upload private originals"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and pg_catalog.char_length(name) between 48 and 500
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
);

drop policy if exists "profile owners replace private originals" on storage.objects;
create policy "profile owners replace private originals"
on storage.objects for update to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
)
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and pg_catalog.char_length(name) between 48 and 500
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
);

drop policy if exists "profile owners delete private originals" on storage.objects;
create policy "profile owners delete private originals"
on storage.objects for delete to authenticated
using (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
);

drop policy if exists "users upload own commune files" on storage.objects;
create policy "users upload own commune files"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'commune-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users upload own commune media files" on storage.objects;
create policy "users upload own commune media files"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'commune-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "developers upload own addon packages" on storage.objects;
create policy "developers upload own addon packages"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'addon-packages'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "developers upload own addon icons" on storage.objects;
create policy "developers upload own addon icons"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('addon-icons','addon-listing-assets')
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The sandbox's direct RPC path now observes the same account pause/deletion
-- boundary while preserving every pre-existing Auth/profile/ban requirement.
create or replace function private.sandbox_actor_is_active(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_account_allows_ordinary_mutation(p_actor)
    and exists (
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
revoke all privileges on function private.sandbox_actor_is_active(uuid)
  from public, anon, authenticated, service_role;

-- A durable finalizer lease is distinct from the human operator claim. The
-- canonical deletion request remains the state machine and source of subject
-- authority; this table contains only scheduler coordination/evidence.
create table private.account_deletion_finalizer_jobs (
  lifecycle_request_id uuid primary key
    references private.account_lifecycle_requests(id) on delete restrict,
  phase text not null default 'eligibility',
  status text not null default 'pending',
  available_at timestamptz not null,
  claim_count integer not null default 0,
  failure_count integer not null default 0,
  claimed_by text,
  lease_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  last_error_evidence_sha256 text,
  completed_at timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint account_deletion_finalizer_phase_check check (
    phase in ('eligibility','storage_inventory','storage_cleanup','artisan_cleanup','auth_deletion','completion')
  ),
  constraint account_deletion_finalizer_status_check check (
    status in ('pending','processing','failed','blocked','completed','canceled','abandoned')
  ),
  constraint account_deletion_finalizer_count_check check (
    claim_count between 0 and 1000000 and failure_count between 0 and 20
  ),
  constraint account_deletion_finalizer_worker_check check (
    claimed_by is null or (
      pg_catalog.char_length(claimed_by) between 3 and 160
      and claimed_by ~ '^[A-Za-z0-9._:-]+$'
    )
  ),
  constraint account_deletion_finalizer_claim_check check (
    (status = 'processing' and claimed_by is not null and lease_token is not null
      and claimed_at is not null and lease_expires_at is not null)
    or (status <> 'processing' and claimed_by is null and lease_token is null
      and claimed_at is null and lease_expires_at is null)
  ),
  constraint account_deletion_finalizer_error_check check (
    (last_error_code is null and last_error_at is null and last_error_evidence_sha256 is null)
    or (last_error_code ~ '^[a-z][a-z0-9_]{2,99}$'
      and last_error_at is not null
      and last_error_evidence_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint account_deletion_finalizer_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

alter table private.account_deletion_finalizer_jobs owner to postgres;
alter table private.account_deletion_finalizer_jobs enable row level security;
alter table private.account_deletion_finalizer_jobs force row level security;
revoke all on private.account_deletion_finalizer_jobs
  from public, anon, authenticated, service_role;

create index account_deletion_finalizer_due_idx
on private.account_deletion_finalizer_jobs(available_at, lifecycle_request_id)
where status in ('pending','failed');

create or replace function private.sync_account_deletion_finalizer_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action <> 'account_deletion' then return new; end if;
  insert into private.account_deletion_finalizer_jobs(
    lifecycle_request_id, available_at, status
  ) values (
    new.id,
    coalesce(new.cooling_period_ends_at, 'infinity'::timestamptz),
    case when new.status = 'canceled' then 'canceled' else 'pending' end
  )
  on conflict (lifecycle_request_id) do update
  set status = case
        when new.status = 'canceled' then 'canceled'
        when private.account_deletion_finalizer_jobs.status = 'canceled'
          and new.status <> 'canceled' then 'pending'
        else private.account_deletion_finalizer_jobs.status
      end,
      available_at = case
        when private.account_deletion_finalizer_jobs.status in ('pending','failed','canceled')
          then coalesce(new.cooling_period_ends_at, 'infinity'::timestamptz)
        else private.account_deletion_finalizer_jobs.available_at
      end,
      claimed_by = case when new.status = 'canceled' then null
        else private.account_deletion_finalizer_jobs.claimed_by end,
      lease_token = case when new.status = 'canceled' then null
        else private.account_deletion_finalizer_jobs.lease_token end,
      claimed_at = case when new.status = 'canceled' then null
        else private.account_deletion_finalizer_jobs.claimed_at end,
      lease_expires_at = case when new.status = 'canceled' then null
        else private.account_deletion_finalizer_jobs.lease_expires_at end,
      updated_at = pg_catalog.now();
  return new;
end;
$$;

alter function private.sync_account_deletion_finalizer_job() owner to postgres;
revoke all privileges on function private.sync_account_deletion_finalizer_job()
  from public, anon, authenticated, service_role;

create trigger account_deletion_finalizer_job_sync
after insert or update of status, cooling_period_ends_at
on private.account_lifecycle_requests
for each row execute function private.sync_account_deletion_finalizer_job();

insert into private.account_deletion_finalizer_jobs(
  lifecycle_request_id, available_at, status
)
select request.id, coalesce(request.cooling_period_ends_at, 'infinity'::timestamptz),
  case when request.status = 'canceled' then 'canceled' else 'pending' end
from private.account_lifecycle_requests as request
where request.action = 'account_deletion'
on conflict (lifecycle_request_id) do nothing;

create or replace function private.community_deletion_finalizer_lease_valid(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_caller_is_service_role()
    and coalesce(p_worker_id, '') ~ '^[A-Za-z0-9._:-]{3,160}$'
    and exists (
      select 1
      from private.account_deletion_finalizer_jobs as job
      where job.lifecycle_request_id = p_request_id
        and job.status = 'processing'
        and job.claimed_by = p_worker_id
        and job.lease_token = p_lease_token
        and job.lease_expires_at > pg_catalog.now()
    );
$$;

alter function private.community_deletion_finalizer_lease_valid(text, uuid, uuid) owner to postgres;
revoke all privileges on function private.community_deletion_finalizer_lease_valid(text, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.claim_community_deletion_finalizer_jobs(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or p_limit not between 1 and 10
     or p_lease_seconds not between 60 and 900 then
    raise exception using errcode = '22023', message = 'community_deletion_finalizer_claim_invalid';
  end if;

  update private.account_deletion_finalizer_jobs as job
  set status = case when job.failure_count >= 19 then 'abandoned' else 'failed' end,
      failure_count = least(job.failure_count + 1, 20),
      available_at = pg_catalog.now() + interval '5 minutes',
      claimed_by = null, lease_token = null, claimed_at = null, lease_expires_at = null,
      last_error_code = 'lease_expired', last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'community-deletion-finalizer-lease-expired:' || job.lifecycle_request_id::text,
        'sha256'
      ), 'hex'),
      updated_at = pg_catalog.now()
  where job.status = 'processing' and job.lease_expires_at <= pg_catalog.now();

  -- Legal and economic problems are exception states, not ordinary approval
  -- steps. They never enter the destructive claim.
  update private.account_deletion_finalizer_jobs as job
  set status = 'blocked',
      last_error_code = 'legal_hold_active', last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'community-deletion-finalizer-legal-hold:' || job.lifecycle_request_id::text,
        'sha256'
      ), 'hex'),
      updated_at = pg_catalog.now()
  from private.account_lifecycle_requests as request
  where request.id = job.lifecycle_request_id
    and job.status in ('pending','failed') and job.available_at <= pg_catalog.now()
    and private.community_deletion_has_active_account_hold(request.user_id);

  update private.account_lifecycle_requests as request
  set status = 'blocked_by_legal_hold', legal_hold_present = true,
      updated_at = pg_catalog.now()
  from private.account_deletion_finalizer_jobs as job
  where job.lifecycle_request_id = request.id
    and job.status = 'blocked' and job.last_error_code = 'legal_hold_active'
    and request.status not in ('completed','rejected','canceled','blocked_by_legal_hold');

  update private.account_deletion_finalizer_jobs as job
  set status = 'blocked',
      last_error_code = 'economic_closure_required', last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'community-deletion-finalizer-economic-hold:' || job.lifecycle_request_id::text,
        'sha256'
      ), 'hex'),
      updated_at = pg_catalog.now()
  from private.account_lifecycle_requests as request
  where request.id = job.lifecycle_request_id
    and job.status in ('pending','failed') and job.available_at <= pg_catalog.now()
    and request.status in ('submitted','identity_verification','cooling_period','operator_review')
    and not private.community_deletion_has_active_account_hold(request.user_id)
    and not coalesce(
      (private.community_economic_deletion_readiness(request.user_id) ->> 'canComplete')::boolean,
      false
    );

  update private.account_lifecycle_requests as request
  set status = 'operator_review', legal_hold_present = false,
      updated_at = pg_catalog.now()
  from private.account_deletion_finalizer_jobs as job
  where job.lifecycle_request_id = request.id
    and job.status = 'blocked' and job.last_error_code = 'economic_closure_required'
    and request.status not in ('completed','rejected','canceled','operator_review');

  with candidates as (
    select job.lifecycle_request_id
    from private.account_deletion_finalizer_jobs as job
    join private.account_lifecycle_requests as request
      on request.id = job.lifecycle_request_id
    where job.status in ('pending','failed')
      and job.available_at <= pg_catalog.now()
      and job.failure_count < 20
      and request.action = 'account_deletion'
      and request.cooling_period_ends_at is not null
      and request.cooling_period_ends_at <= pg_catalog.now()
      and (
        (job.phase = 'eligibility'
          and request.status in ('submitted','identity_verification','cooling_period','operator_review'))
        or (job.phase = 'storage_inventory' and request.status = 'processing')
        or (job.phase in ('storage_cleanup','artisan_cleanup') and request.status = 'storage_cleanup')
        or (job.phase = 'auth_deletion' and request.status = 'auth_deletion_ready')
      )
      and not private.community_deletion_has_active_account_hold(request.user_id)
      and coalesce(
        (private.community_economic_deletion_readiness(request.user_id) ->> 'canComplete')::boolean,
        false
      )
    order by job.available_at, job.lifecycle_request_id
    for update of job skip locked
    limit p_limit
  ), claimed as (
    update private.account_deletion_finalizer_jobs as job
    set status = 'processing',
        phase = case when job.phase = 'eligibility' then 'storage_inventory' else job.phase end,
        claim_count = job.claim_count + 1,
        claimed_by = p_worker_id, lease_token = gen_random_uuid(),
        claimed_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        last_error_code = null, last_error_at = null,
        last_error_evidence_sha256 = null, updated_at = pg_catalog.now()
    from candidates
    where job.lifecycle_request_id = candidates.lifecycle_request_id
    returning job.*
  ), advanced as (
    update private.account_lifecycle_requests as request
    set status = 'processing', legal_hold_present = false,
        updated_at = pg_catalog.now()
    from claimed
    where request.id = claimed.lifecycle_request_id
      and request.status in ('submitted','identity_verification','cooling_period','operator_review')
    returning request.id, request.user_id, request.submitted_at,
      request.cooling_period_ends_at, request.status
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'requestId', claimed.lifecycle_request_id,
    'leaseToken', claimed.lease_token,
    'phase', claimed.phase,
    'claimCount', claimed.claim_count,
    'leaseExpiresAt', claimed.lease_expires_at
  ) order by claimed.claimed_at, claimed.lifecycle_request_id), '[]'::jsonb)
  into v_items
  from claimed;

  update private.account_participation as participation
  set participation_state = 'deletion_pending', evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where participation.user_id in (
    select request.user_id
    from private.account_lifecycle_requests as request
    join private.account_deletion_finalizer_jobs as job
      on job.lifecycle_request_id = request.id
    where job.status = 'processing' and job.claimed_by = p_worker_id
      and job.claimed_at >= pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds)
  );

  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  )
  select gen_random_uuid(), job.lifecycle_request_id, null,
    'automatic_deletion_claimed', request.status, request.status,
    'Automatic finalizer durably claimed an eligible owner-directed deletion.',
    pg_catalog.jsonb_build_object(
      'phase', job.phase, 'claimCount', job.claim_count,
      'worker', job.claimed_by
    )
  from private.account_deletion_finalizer_jobs as job
  join private.account_lifecycle_requests as request
    on request.id = job.lifecycle_request_id
  where job.status = 'processing' and job.claimed_by = p_worker_id
    and job.claimed_at >= pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds);

  return pg_catalog.jsonb_build_object('workerId', p_worker_id, 'items', v_items);
end;
$$;

alter function public.claim_community_deletion_finalizer_jobs(text, integer, integer) owner to postgres;
revoke all privileges on function public.claim_community_deletion_finalizer_jobs(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_community_deletion_finalizer_jobs(text, integer, integer)
  to service_role;

create or replace function public.get_community_deletion_finalizer_storage_page(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_limit integer,
  p_after_bucket text default null,
  p_after_name text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_items jsonb;
  v_total integer;
  v_evidence text;
  v_next_bucket text;
  v_next_name text;
begin
  if not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     )
     or p_limit not between 1 and 100
     or (p_after_bucket is null) <> (p_after_name is null)
     or pg_catalog.char_length(coalesce(p_after_bucket, '')) > 100
     or pg_catalog.char_length(coalesce(p_after_name, '')) > 500 then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select request.user_id into strict v_user_id
  from private.account_lifecycle_requests as request
  join private.account_deletion_finalizer_jobs as job
    on job.lifecycle_request_id = request.id
  where request.id = p_request_id and request.action = 'account_deletion'
    and request.status in ('processing','storage_cleanup')
    and job.phase in ('storage_inventory','storage_cleanup');

  select pg_catalog.count(*)::integer,
    pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(
      object.id::text || ':' || object.bucket_id || ':' || object.name,
      E'\n' order by object.bucket_id, object.name, object.id
    ), 'empty'), 'sha256'), 'hex')
  into v_total, v_evidence
  from storage.objects as object
  where object.owner_id::text = v_user_id::text;

  with page as (
    select object.id, object.bucket_id, object.name
    from storage.objects as object
    where object.owner_id::text = v_user_id::text
      and (
        p_after_bucket is null
        or (object.bucket_id, object.name) > (p_after_bucket, p_after_name)
      )
    order by object.bucket_id, object.name, object.id
    limit p_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'objectId', page.id,
      'bucket', page.bucket_id,
      'name', page.name
    ) order by page.bucket_id, page.name, page.id), '[]'::jsonb),
    case when pg_catalog.count(*) = p_limit then (array_agg(page.bucket_id order by page.bucket_id, page.name, page.id))[p_limit] else null end,
    case when pg_catalog.count(*) = p_limit then (array_agg(page.name order by page.bucket_id, page.name, page.id))[p_limit] else null end
  into v_items, v_next_bucket, v_next_name
  from page;

  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id,
    'totalCount', v_total,
    'inventoryEvidenceSha256', v_evidence,
    'items', v_items,
    'nextBucket', v_next_bucket,
    'nextName', v_next_name
  );
end;
$$;

alter function public.get_community_deletion_finalizer_storage_page(text, uuid, uuid, integer, text, text) owner to postgres;
revoke all privileges on function public.get_community_deletion_finalizer_storage_page(text, uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_deletion_finalizer_storage_page(text, uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.record_community_deletion_finalizer_inventory(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
  v_count integer;
  v_evidence text;
begin
  if p_client_request_id is null or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion' and status = 'processing'
  for update;
  if not exists (
    select 1 from private.account_deletion_finalizer_jobs
    where lifecycle_request_id = p_request_id and phase = 'storage_inventory'
  ) then
    raise exception using errcode = '55000', message = 'community_deletion_finalizer_phase_invalid';
  end if;
  select pg_catalog.count(*)::integer,
    pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(
      object.id::text || ':' || object.bucket_id || ':' || object.name,
      E'\n' order by object.bucket_id, object.name, object.id
    ), 'empty'), 'sha256'), 'hex')
  into v_count, v_evidence
  from storage.objects as object
  where object.owner_id::text = v_request.user_id::text;

  insert into private.account_deletion_handoffs(
    lifecycle_request_id, content_disposition,
    storage_inventory_completed_at, storage_inventory_evidence_sha256,
    owned_storage_object_count, updated_by
  ) values (
    p_request_id, 'remove_user_content_preserve_required_legal_evidence',
    pg_catalog.now(), v_evidence, v_count, null
  )
  on conflict (lifecycle_request_id) do update
  set storage_inventory_completed_at = coalesce(
        private.account_deletion_handoffs.storage_inventory_completed_at,
        excluded.storage_inventory_completed_at
      ),
      storage_inventory_evidence_sha256 = coalesce(
        private.account_deletion_handoffs.storage_inventory_evidence_sha256,
        excluded.storage_inventory_evidence_sha256
      ),
      owned_storage_object_count = coalesce(
        private.account_deletion_handoffs.owned_storage_object_count,
        excluded.owned_storage_object_count
      ),
      updated_at = pg_catalog.now()
  returning * into v_handoff;
  if v_handoff.storage_inventory_evidence_sha256 <> v_evidence
     or v_handoff.owned_storage_object_count <> v_count then
    raise exception using errcode = '23505', message = 'community_deletion_inventory_snapshot_conflict';
  end if;

  update private.account_lifecycle_requests
  set status = 'storage_cleanup', updated_at = pg_catalog.now()
  where id = p_request_id;
  update private.account_deletion_finalizer_jobs
  set phase = 'storage_cleanup', updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_storage_inventory_completed', 'processing', 'storage_cleanup',
    'Automatic finalizer recorded the account-owned Storage inventory.',
    pg_catalog.jsonb_build_object('ownedStorageObjectCount', v_count)
  ) on conflict (client_request_id) do nothing;
  insert into private.community_audit_events(
    actor_kind, capability, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_lifecycle_manage',
    'community_deletion_storage_inventory_completed',
    'account_lifecycle_request', p_request_id, p_client_request_id,
    pg_catalog.jsonb_build_object('ownedStorageObjectCount', v_count)
  );
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id,
    'phase', 'storage_cleanup',
    'ownedStorageObjectCount', v_count,
    'inventoryEvidenceSha256', v_evidence
  );
end;
$$;

alter function public.record_community_deletion_finalizer_inventory(text, uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.record_community_deletion_finalizer_inventory(text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_community_deletion_finalizer_inventory(text, uuid, uuid, uuid)
  to service_role;

create or replace function public.complete_community_deletion_finalizer_storage(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
  v_remaining integer;
  v_evidence text;
begin
  if p_client_request_id is null or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion' and status = 'storage_cleanup'
  for update;
  select * into strict v_handoff
  from private.account_deletion_handoffs
  where lifecycle_request_id = p_request_id
    and storage_inventory_completed_at is not null
    and storage_inventory_evidence_sha256 is not null
  for update;
  select pg_catalog.count(*)::integer into v_remaining
  from storage.objects where owner_id::text = v_request.user_id::text;
  if v_remaining <> 0 then
    raise exception using errcode = '55000', message = 'community_deletion_storage_objects_remain';
  end if;
  v_evidence := pg_catalog.encode(extensions.digest(
    'community-online-storage-cleanup-v1:' || p_request_id::text || ':' ||
    v_handoff.storage_inventory_evidence_sha256 || ':' ||
    v_handoff.owned_storage_object_count::text || ':0', 'sha256'
  ), 'hex');
  update private.account_deletion_handoffs
  set storage_cleanup_completed_at = coalesce(storage_cleanup_completed_at, pg_catalog.now()),
      storage_cleanup_evidence_sha256 = coalesce(storage_cleanup_evidence_sha256, v_evidence),
      updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
  returning * into v_handoff;
  if v_handoff.storage_cleanup_evidence_sha256 <> v_evidence then
    raise exception using errcode = '23505', message = 'community_deletion_storage_cleanup_evidence_conflict';
  end if;
  update private.account_deletion_finalizer_jobs
  set phase = 'artisan_cleanup', updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_storage_cleanup_completed', 'storage_cleanup', 'storage_cleanup',
    'Automatic finalizer confirmed deletion of account-owned Online Storage objects.',
    pg_catalog.jsonb_build_object('remainingOwnedStorageObjectCount', 0)
  ) on conflict (client_request_id) do nothing;
  insert into private.community_audit_events(
    actor_kind, capability, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_lifecycle_manage',
    'community_deletion_storage_cleanup_completed',
    'account_lifecycle_request', p_request_id, p_client_request_id,
    pg_catalog.jsonb_build_object('remainingOwnedStorageObjectCount', 0)
  );
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id,
    'phase', 'artisan_cleanup',
    'storageCleanupEvidenceSha256', v_evidence
  );
end;
$$;

alter function public.complete_community_deletion_finalizer_storage(text, uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.complete_community_deletion_finalizer_storage(text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_community_deletion_finalizer_storage(text, uuid, uuid, uuid)
  to service_role;

create or replace function public.enqueue_community_deletion_finalizer_artisan_cleanup(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
  v_run artisan.account_cleanup_runs%rowtype;
  v_expected integer;
  v_completed integer;
  v_evidence text;
begin
  if p_client_request_id is null or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion' and status = 'storage_cleanup'
  for update;
  select * into strict v_handoff
  from private.account_deletion_handoffs
  where lifecycle_request_id = p_request_id
    and storage_cleanup_completed_at is not null
    and storage_cleanup_evidence_sha256 is not null;
  if private.community_deletion_has_active_account_hold(v_request.user_id)
     or exists (
    select 1 from artisan.media_assets as media
    where media.owner_user_id = v_request.user_id
      and private.artisan_retention_target_has_legal_hold('media_asset', media.id)
  ) then
    update private.account_deletion_finalizer_jobs
    set status = 'blocked', claimed_by = null, lease_token = null,
        claimed_at = null, lease_expires_at = null,
        last_error_code = 'legal_hold_active', last_error_at = pg_catalog.now(),
        last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
          'community-deletion-finalizer-artisan-hold:' || p_request_id::text,
          'sha256'
        ), 'hex'), updated_at = pg_catalog.now()
    where lifecycle_request_id = p_request_id;
    update private.account_lifecycle_requests
    set status = 'blocked_by_legal_hold', legal_hold_present = true,
        updated_at = pg_catalog.now()
    where id = p_request_id;
    return pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'status', 'blocked_by_legal_hold',
      'expectedAssetCount', 0, 'completedAssetCount', 0,
      'completionEvidenceSha256', null, 'ready', false
    );
  end if;

  select pg_catalog.count(*)::integer into v_expected
  from artisan.media_assets as media
  where media.owner_user_id = v_request.user_id;
  insert into artisan.account_cleanup_runs(
    lifecycle_request_id, user_id, content_disposition,
    status, expected_asset_count, completed_asset_count,
    completion_evidence_sha256, completed_at
  ) values (
    p_request_id, v_request.user_id, v_handoff.content_disposition,
    case when v_expected = 0 then 'completed' else 'processing' end,
    v_expected, 0,
    case when v_expected = 0 then pg_catalog.encode(extensions.digest(
      'artisan-account-cleanup-empty:' || p_request_id::text, 'sha256'
    ), 'hex') else null end,
    case when v_expected = 0 then pg_catalog.now() else null end
  ) on conflict (lifecycle_request_id) do nothing;
  select * into strict v_run
  from artisan.account_cleanup_runs
  where lifecycle_request_id = p_request_id
  for update;
  if v_run.user_id <> v_request.user_id
     or v_run.content_disposition <> v_handoff.content_disposition
     or v_run.expected_asset_count <> v_expected then
    raise exception using errcode = '23505', message = 'artisan_account_cleanup_snapshot_conflict';
  end if;
  if v_expected > 0 and v_run.status <> 'blocked_by_legal_hold' then
    with upserted as (
      insert into artisan.retention_tasks(
        target_type, target_id, action, due_at, status, legal_hold_checked_at
      )
      select 'media_asset', media.id, 'delete_account_media', pg_catalog.now(),
        case when private.artisan_retention_target_has_legal_hold('media_asset', media.id)
          then 'blocked_by_legal_hold' else 'pending' end,
        pg_catalog.now()
      from artisan.media_assets as media
      where media.owner_user_id = v_request.user_id
      on conflict (target_type, target_id, action) do update
      set due_at = least(artisan.retention_tasks.due_at, excluded.due_at),
          status = case when artisan.retention_tasks.status = 'completed'
            then 'completed' else excluded.status end,
          legal_hold_checked_at = excluded.legal_hold_checked_at,
          claimed_by = null, claimed_at = null, lease_expires_at = null
      returning id, target_id
    )
    insert into artisan.account_cleanup_assets(
      lifecycle_request_id, media_asset_id, retention_task_id
    )
    select p_request_id, upserted.target_id, upserted.id
    from upserted
    on conflict (lifecycle_request_id, media_asset_id) do nothing;
    select pg_catalog.count(*) filter (where task.status = 'completed')::integer,
      pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(
        task.id::text || ':' || coalesce(task.completion_evidence_sha256, ''),
        ',' order by task.id
      ), 'empty'), 'sha256'), 'hex')
    into v_completed, v_evidence
    from artisan.account_cleanup_assets as asset
    join artisan.retention_tasks as task on task.id = asset.retention_task_id
    where asset.lifecycle_request_id = p_request_id;
    update artisan.account_cleanup_runs
    set completed_asset_count = v_completed,
        status = case when v_completed = expected_asset_count
          then 'completed' else 'processing' end,
        completion_evidence_sha256 = case when v_completed = expected_asset_count
          then v_evidence else null end,
        completed_at = case when v_completed = expected_asset_count
          then pg_catalog.now() else null end,
        updated_at = pg_catalog.now()
    where lifecycle_request_id = p_request_id
    returning * into v_run;
  end if;
  insert into private.community_audit_events(
    actor_kind, capability, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_lifecycle_manage',
    'artisan_account_cleanup_enqueued', 'account_lifecycle_request',
    p_request_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'status', v_run.status,
      'expectedAssetCount', v_run.expected_asset_count,
      'completedAssetCount', v_run.completed_asset_count
    )
  );
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id,
    'status', v_run.status,
    'expectedAssetCount', v_run.expected_asset_count,
    'completedAssetCount', v_run.completed_asset_count,
    'completionEvidenceSha256', v_run.completion_evidence_sha256,
    'ready', v_run.status = 'completed'
  );
end;
$$;

alter function public.enqueue_community_deletion_finalizer_artisan_cleanup(text, uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.enqueue_community_deletion_finalizer_artisan_cleanup(text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_community_deletion_finalizer_artisan_cleanup(text, uuid, uuid, uuid)
  to service_role;

-- Apply the already-canonical database deletion/anonymization contract. This
-- helper is private and idempotent; external Storage and Auth deletion remain
-- separate verified phases.
create or replace function private.apply_automatic_community_deletion_anonymization(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
begin
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion'
  for update;
  select * into strict v_handoff
  from private.account_deletion_handoffs
  where lifecycle_request_id = p_request_id
    and storage_cleanup_completed_at is not null
    and storage_cleanup_evidence_sha256 is not null;

  update public.profile_public_cards
  set public_profile_enabled = false, display_name = null,
      short_public_bio = null, avatar_media_id = null,
      updated_at = pg_catalog.now()
  where user_id = v_request.user_id;
  update public.profiles
  set display_name = null, bio = null, website_url = null, github_url = null,
      avatar_url = null, interests = null, organization = null, headline = null,
      featured_public_links = '[]'::jsonb,
      is_developer = false, is_admin = false, updated_at = pg_catalog.now()
  where id = v_request.user_id;
  update public.profile_media set status = 'hidden'
  where user_id = v_request.user_id and status = 'active';
  update public.profile_customization
  set avatar_media_id = null, banner_media_id = null, updated_at = pg_catalog.now()
  where user_id = v_request.user_id;
  update public.developer_profiles
  set status = 'revoked', contact_email = null, website_url = null,
      github_url = null, support_url = null, updated_at = pg_catalog.now()
  where user_id = v_request.user_id and status <> 'revoked';
  update public.addon_drafts
  set submission_status = 'archived', review_status = case
        when review_status = 'security_hold' then review_status else 'withdrawn' end,
      archived_at = coalesce(archived_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where owner_user_id = v_request.user_id
    and submission_status not in ('archived','security_hold');
  update public.addon_submissions
  set status = case when status = 'security_hold' then status else 'withdrawn' end,
      updated_at = pg_catalog.now()
  where submitted_by = v_request.user_id
    and status not in ('withdrawn','security_hold');
  update public.marketplace_listings as listing
  set listing_status = 'revoked', revoked_at = coalesce(revoked_at, pg_catalog.now()),
      revocation_reason = coalesce(revocation_reason, 'publisher_account_deactivated'),
      updated_at = pg_catalog.now()
  from public.developer_profiles as developer
  where listing.developer_profile_id = developer.id
    and developer.user_id = v_request.user_id
    and listing.listing_status <> 'revoked';
  update public.commune_job_posts
  set application_status = 'archived', work_with_link_enabled = false,
      archived_at = coalesce(archived_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where author_user_id = v_request.user_id
    and application_status <> 'archived';
  update public.commune_sandbox_review_requests
  set request_status = case when request_status = 'security_hold'
        then request_status else 'revoked' end,
      handoff_status = 'revoked', handoff_bundle_json = null,
      updated_at = pg_catalog.now()
  where coalesce(submitted_by, user_id) = v_request.user_id
    and request_status <> 'security_hold';
  update public.commune_media
  set visibility_state = case when visibility_state = 'removed'
        then visibility_state else 'revoked' end,
      updated_at = pg_catalog.now()
  where owner_user_id = v_request.user_id;
  update public.commune_uploads
  set status = case when status = 'removed_by_moderator'
        then status else 'deleted_by_user' end
  where user_id = v_request.user_id
    and status not in ('removed_by_moderator','deleted_by_user');
  delete from public.user_followed_commune_threads where user_id = v_request.user_id;
  delete from public.user_saved_commune_posts where user_id = v_request.user_id;
  delete from public.user_saved_addons where user_id = v_request.user_id;
  delete from public.user_notifications where user_id = v_request.user_id;
  update public.user_roles
  set revoked_at = coalesce(revoked_at, pg_catalog.now()),
      revoked_by = coalesce(revoked_by, v_request.user_id),
      reason = coalesce(reason, 'account_deletion')
  where user_id = v_request.user_id and revoked_at is null;
  update artisan.memberships
  set status = 'closed', closed_at = coalesce(closed_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where user_id = v_request.user_id and status <> 'closed';
  update artisan.notifications set status = 'suppressed'
  where user_id = v_request.user_id and status in ('pending','failed');
  delete from artisan.appreciations where user_id = v_request.user_id;
  delete from artisan.user_blocks
  where blocker_user_id = v_request.user_id or blocked_user_id = v_request.user_id;

  if v_handoff.content_disposition = 'remove_user_content_preserve_required_legal_evidence' then
    update public.commune_comments
    set status = 'deleted_by_user', body = '[withdrawn]',
        updated_at = pg_catalog.now()
    where user_id = v_request.user_id
      and status not in ('deleted_by_user','removed_by_moderator');
    update public.commune_posts
    set status = 'deleted_by_user', visibility = 'private_draft',
        visibility_state = 'removed', body = '[withdrawn]',
        excerpt = null, repository_url = null, links = '{}'::text[],
        removed_at = coalesce(removed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where user_id = v_request.user_id
      and status not in ('deleted_by_user','removed_by_moderator');
    update artisan.artworks
    set status = 'removed', removed_at = coalesce(removed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where owner_user_id = v_request.user_id and status not in ('removed','archived')
      and moderation_status <> 'legal_hold'
      and not exists (
        select 1 from artisan.legal_hold_records as hold
        where hold.target_type = 'artwork' and hold.target_id = artisan.artworks.id
          and hold.released_at is null
      );
    update artisan.forum_posts
    set status = 'removed', removed_at = coalesce(removed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where owner_user_id = v_request.user_id and status not in ('removed','archived')
      and moderation_status <> 'legal_hold'
      and not exists (
        select 1 from artisan.legal_hold_records as hold
        where hold.target_type = 'post' and hold.target_id = artisan.forum_posts.id
          and hold.released_at is null
      );
    update artisan.comments
    set status = 'deleted_by_user', body = '[withdrawn]',
        deleted_at = coalesce(deleted_at, pg_catalog.now())
    where user_id = v_request.user_id
      and status not in ('deleted_by_user','removed_by_moderator')
      and moderation_status <> 'legal_hold'
      and not exists (
        select 1 from artisan.legal_hold_records as hold
        where hold.target_type = 'comment' and hold.target_id = artisan.comments.id
          and hold.released_at is null
      );
  else
    update public.commune_posts
    set status = 'archived', visibility = 'private_draft',
        visibility_state = 'archived',
        archived_at = coalesce(archived_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where user_id = v_request.user_id and status = 'published';
    update public.commune_comments
    set status = 'archived', archived_at = coalesce(archived_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where user_id = v_request.user_id and status in ('published','edited');
    update artisan.artworks
    set status = 'archived', archived_at = coalesce(archived_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where owner_user_id = v_request.user_id and status = 'published';
    update artisan.forum_posts
    set status = 'archived', archived_at = coalesce(archived_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where owner_user_id = v_request.user_id and status = 'published';
  end if;
end;
$$;

alter function private.apply_automatic_community_deletion_anonymization(uuid) owner to postgres;
revoke all privileges on function private.apply_automatic_community_deletion_anonymization(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.advance_community_deletion_finalizer_to_auth(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_readiness jsonb;
begin
  if p_client_request_id is null or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion' and status = 'storage_cleanup'
  for update;
  if private.community_deletion_has_active_account_hold(v_request.user_id) then
    update private.account_deletion_finalizer_jobs
    set status = 'blocked', claimed_by = null, lease_token = null,
        claimed_at = null, lease_expires_at = null,
        last_error_code = 'legal_hold_active', last_error_at = pg_catalog.now(),
        last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
          'community-deletion-finalizer-pre-auth-hold:' || p_request_id::text,
          'sha256'
        ), 'hex'), updated_at = pg_catalog.now()
    where lifecycle_request_id = p_request_id;
    update private.account_lifecycle_requests
    set status = 'blocked_by_legal_hold', legal_hold_present = true,
        updated_at = pg_catalog.now()
    where id = p_request_id;
    return pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'phase', 'artisan_cleanup',
      'ready', false, 'status', 'blocked_by_legal_hold'
    );
  end if;
  if not coalesce(
    (private.community_economic_deletion_readiness(v_request.user_id) ->> 'canComplete')::boolean,
    false
  ) then
    update private.account_deletion_finalizer_jobs
    set status = 'blocked', claimed_by = null, lease_token = null,
        claimed_at = null, lease_expires_at = null,
        last_error_code = 'economic_closure_required', last_error_at = pg_catalog.now(),
        last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
          'community-deletion-finalizer-pre-auth-economic:' || p_request_id::text,
          'sha256'
        ), 'hex'), updated_at = pg_catalog.now()
    where lifecycle_request_id = p_request_id;
    return pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'phase', 'artisan_cleanup',
      'ready', false, 'status', 'economic_closure_required'
    );
  end if;
  select public.get_community_artisan_cleanup_readiness(p_request_id)
    into v_readiness;
  if not coalesce((v_readiness ->> 'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'phase', 'artisan_cleanup',
      'ready', false, 'status', coalesce(v_readiness ->> 'status', 'processing')
    );
  end if;
  if not exists (
    select 1 from private.account_deletion_handoffs as handoff
    where handoff.lifecycle_request_id = p_request_id
      and handoff.storage_cleanup_completed_at is not null
      and handoff.storage_cleanup_evidence_sha256 is not null
  ) then
    raise exception using errcode = '55000', message = 'community_deletion_storage_cleanup_required';
  end if;
  perform private.apply_automatic_community_deletion_anonymization(p_request_id);
  update private.account_lifecycle_requests
  set status = 'auth_deletion_ready', updated_at = pg_catalog.now()
  where id = p_request_id;
  update private.account_deletion_finalizer_jobs
  set phase = 'auth_deletion', updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_auth_deletion_ready', 'storage_cleanup', 'auth_deletion_ready',
    'Automatic finalizer completed governed database and Artisan readiness gates.'
  ) on conflict (client_request_id) do nothing;
  insert into private.community_audit_events(
    actor_kind, capability, action, target_type, target_id, request_id
  ) values (
    'service', 'community_lifecycle_manage',
    'community_deletion_auth_deletion_ready',
    'account_lifecycle_request', p_request_id, p_client_request_id
  );
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'phase', 'auth_deletion',
    'ready', true, 'status', 'auth_deletion_ready'
  );
end;
$$;

alter function public.advance_community_deletion_finalizer_to_auth(text, uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.advance_community_deletion_finalizer_to_auth(text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.advance_community_deletion_finalizer_to_auth(text, uuid, uuid, uuid)
  to service_role;

create or replace function public.begin_community_deletion_finalizer_auth(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_evidence text;
  v_deleted boolean;
begin
  if p_client_request_id is null or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion'
    and status = 'auth_deletion_ready'
  for update;
  v_evidence := pg_catalog.encode(extensions.digest(
    'community-auth-deletion-requested-v1:' || p_request_id::text || ':' ||
    v_request.user_id::text || ':supabase-auth-soft-delete-v1', 'sha256'
  ), 'hex');
  update private.account_deletion_handoffs
  set auth_deletion_requested_at = coalesce(auth_deletion_requested_at, pg_catalog.now()),
      auth_deletion_request_evidence_sha256 = coalesce(
        auth_deletion_request_evidence_sha256, v_evidence
      ),
      updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
    and storage_cleanup_completed_at is not null;
  if not found then
    raise exception using errcode = '55000', message = 'community_deletion_storage_cleanup_required';
  end if;
  select coalesce(account.deleted_at is not null, false) into v_deleted
  from auth.users as account where account.id = v_request.user_id;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_auth_deletion_requested', 'auth_deletion_ready', 'auth_deletion_ready',
    'Automatic finalizer requested canonical Auth soft deletion.'
  ) on conflict (client_request_id) do nothing;
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id,
    'userId', v_request.user_id,
    'authDeleted', coalesce(v_deleted, false),
    'requestEvidenceSha256', v_evidence
  );
end;
$$;

alter function public.begin_community_deletion_finalizer_auth(text, uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.begin_community_deletion_finalizer_auth(text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_community_deletion_finalizer_auth(text, uuid, uuid, uuid)
  to service_role;

create or replace function public.complete_community_deletion_finalizer_auth(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid,
  p_confirmation_evidence_sha256 text,
  p_auth_provider_receipt_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
begin
  if p_client_request_id is null
     or coalesce(p_confirmation_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_auth_provider_receipt_sha256, '') !~ '^[0-9a-f]{64}$'
     or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion'
    and status = 'auth_deletion_ready'
  for update;
  if not exists (
    select 1 from auth.users as account
    where account.id = v_request.user_id and account.deleted_at is not null
  ) then
    raise exception using errcode = '55000', message = 'community_auth_deletion_not_confirmed';
  end if;
  update private.account_deletion_handoffs
  set auth_deletion_confirmed_at = coalesce(auth_deletion_confirmed_at, pg_catalog.now()),
      auth_deletion_confirmation_evidence_sha256 = coalesce(
        auth_deletion_confirmation_evidence_sha256, p_confirmation_evidence_sha256
      ),
      auth_provider_receipt_sha256 = coalesce(
        auth_provider_receipt_sha256, p_auth_provider_receipt_sha256
      ),
      updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
    and auth_deletion_requested_at is not null;
  if not found then
    raise exception using errcode = '55000', message = 'community_auth_deletion_request_evidence_required';
  end if;
  update private.account_lifecycle_requests
  set status = 'completed', resolved_by = v_request.user_id,
      private_resolution = 'The automatic finalizer completed the owner-directed deletion.',
      completed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_request_id;
  update private.account_participation
  set participation_state = 'deactivated', evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = v_request.user_id;
  update private.account_deletion_finalizer_jobs
  set phase = 'completion', status = 'completed', completed_at = pg_catalog.now(),
      claimed_by = null, lease_token = null, claimed_at = null,
      lease_expires_at = null, updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_deletion_completed', 'auth_deletion_ready', 'completed',
    'Automatic finalizer completed owner-directed permanent account deletion.',
    pg_catalog.jsonb_build_object('authProviderReceiptRecorded', true)
  ) on conflict (client_request_id) do nothing;
  insert into private.community_audit_events(
    actor_kind, capability, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_lifecycle_manage',
    'community_deletion_automatically_completed',
    'account_lifecycle_request', p_request_id, p_client_request_id,
    pg_catalog.jsonb_build_object('authProviderReceiptRecorded', true)
  );
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'status', 'completed',
    'completedAt', pg_catalog.now()
  );
end;
$$;

alter function public.complete_community_deletion_finalizer_auth(text, uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.complete_community_deletion_finalizer_auth(text, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_community_deletion_finalizer_auth(text, uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.defer_community_deletion_finalizer_job(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_retry_after_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job private.account_deletion_finalizer_jobs%rowtype;
begin
  if p_retry_after_seconds not between 30 and 86400
     or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  update private.account_deletion_finalizer_jobs
  set status = 'pending',
      available_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      claimed_by = null, lease_token = null, claimed_at = null,
      lease_expires_at = null, updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
  returning * into strict v_job;
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'status', v_job.status,
    'phase', v_job.phase, 'availableAt', v_job.available_at
  );
end;
$$;

alter function public.defer_community_deletion_finalizer_job(text, uuid, uuid, integer) owner to postgres;
revoke all privileges on function public.defer_community_deletion_finalizer_job(text, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.defer_community_deletion_finalizer_job(text, uuid, uuid, integer)
  to service_role;

create or replace function public.fail_community_deletion_finalizer_job(
  p_worker_id text,
  p_request_id uuid,
  p_lease_token uuid,
  p_client_request_id uuid,
  p_error_code text,
  p_failure_evidence_sha256 text,
  p_retry_after_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job private.account_deletion_finalizer_jobs%rowtype;
begin
  if p_client_request_id is null
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,99}$'
     or coalesce(p_failure_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_retry_after_seconds not between 30 and 86400
     or not private.community_deletion_finalizer_lease_valid(
       p_worker_id, p_request_id, p_lease_token
     ) then
    raise exception using errcode = '42501', message = 'community_deletion_finalizer_lease_required';
  end if;
  update private.account_deletion_finalizer_jobs
  set failure_count = least(failure_count + 1, 20),
      status = case when failure_count >= 19 then 'abandoned' else 'failed' end,
      available_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      claimed_by = null, lease_token = null, claimed_at = null,
      lease_expires_at = null,
      last_error_code = p_error_code, last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = p_failure_evidence_sha256,
      updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
  returning * into strict v_job;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  ) values (
    p_client_request_id, p_request_id, null,
    'automatic_deletion_retry_recorded',
    (select status from private.account_lifecycle_requests where id = p_request_id),
    (select status from private.account_lifecycle_requests where id = p_request_id),
    'Automatic finalizer recorded a bounded technical retry.',
    pg_catalog.jsonb_build_object(
      'errorCode', p_error_code,
      'failureCount', v_job.failure_count,
      'jobStatus', v_job.status
    )
  ) on conflict (client_request_id) do nothing;
  return pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'status', v_job.status,
    'phase', v_job.phase, 'failureCount', v_job.failure_count,
    'availableAt', v_job.available_at
  );
end;
$$;

alter function public.fail_community_deletion_finalizer_job(text, uuid, uuid, uuid, text, text, integer) owner to postgres;
revoke all privileges on function public.fail_community_deletion_finalizer_job(text, uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.fail_community_deletion_finalizer_job(text, uuid, uuid, uuid, text, text, integer)
  to service_role;

comment on table private.account_deletion_finalizer_jobs is
  'Leased scheduler coordination for automatic owner-directed deletion. The canonical request remains authoritative; blocked jobs are operator exceptions only.';
comment on function private.community_account_allows_ordinary_mutation(uuid) is
  'Additional activation/deletion gate for ordinary account-owned mutations; feature-specific governance remains authoritative.';
comment on function private.community_deletion_has_active_account_hold(uuid) is
  'Canonical account-level finalization hold across Online and the shared Artisan identity.';

commit;

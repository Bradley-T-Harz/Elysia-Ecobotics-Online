-- Narrow automatic executor for Artisan media tasks that were created by the
-- canonical owner-directed account-deletion finalizer. General media-retention
-- reconciliation remains independently disabled.

begin;

create or replace function public.artisan_claim_account_deletion_retention_tasks(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or p_limit not between 1 and 25
     or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023',
      message = 'artisan_account_deletion_retention_claim_invalid';
  end if;

  -- Recover only expired leases that belong to canonical account-cleanup
  -- assets. An unrelated Artisan retention task is never touched here.
  update artisan.retention_tasks as task
  set status = case when task.attempt_count >= 20 then 'abandoned' else 'failed' end,
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null,
      due_at = pg_catalog.now(),
      last_error_code = 'lease_expired',
      last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'account_deletion_retention_lease_expired:' || task.id::text,
        'sha256'
      ), 'hex')
  from artisan.account_cleanup_assets as asset
  where asset.retention_task_id = task.id
    and task.action = 'delete_account_media'
    and task.status = 'processing'
    and task.lease_expires_at <= pg_catalog.now();

  update artisan.retention_tasks as task
  set status = 'blocked_by_legal_hold',
      legal_hold_checked_at = pg_catalog.now(),
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null
  from artisan.account_cleanup_assets as asset
  join artisan.account_cleanup_runs as cleanup
    on cleanup.lifecycle_request_id = asset.lifecycle_request_id
  where asset.retention_task_id = task.id
    and cleanup.status = 'processing'
    and task.action = 'delete_account_media'
    and task.status in ('pending','failed')
    and task.due_at <= pg_catalog.now()
    and private.artisan_retention_target_has_legal_hold(
      task.target_type, task.target_id
    );

  update artisan.account_cleanup_runs as cleanup
  set status = 'blocked_by_legal_hold',
      updated_at = pg_catalog.now()
  where cleanup.status = 'processing'
    and exists (
      select 1
      from artisan.account_cleanup_assets as asset
      join artisan.retention_tasks as task
        on task.id = asset.retention_task_id
      where asset.lifecycle_request_id = cleanup.lifecycle_request_id
        and task.action = 'delete_account_media'
        and task.status = 'blocked_by_legal_hold'
    );

  with candidates as (
    select task.id
    from artisan.retention_tasks as task
    join artisan.account_cleanup_assets as asset
      on asset.retention_task_id = task.id
    join artisan.account_cleanup_runs as cleanup
      on cleanup.lifecycle_request_id = asset.lifecycle_request_id
    join private.account_deletion_finalizer_jobs as finalizer
      on finalizer.lifecycle_request_id = cleanup.lifecycle_request_id
    where task.action = 'delete_account_media'
      and task.target_type = 'media_asset'
      and task.status in ('pending','failed')
      and task.due_at <= pg_catalog.now()
      and task.attempt_count < 20
      and cleanup.status = 'processing'
      and finalizer.phase = 'artisan_cleanup'
      and finalizer.status in ('pending','processing','failed')
      and not private.artisan_retention_target_has_legal_hold(
        task.target_type, task.target_id
      )
    order by task.due_at, task.created_at, task.id
    for update of task skip locked
    limit p_limit
  ), claimed as (
    update artisan.retention_tasks as task
    set status = 'processing',
        claimed_by = p_worker_id,
        claimed_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now()
          + pg_catalog.make_interval(secs => p_lease_seconds),
        attempt_count = task.attempt_count + 1,
        legal_hold_checked_at = pg_catalog.now()
    from candidates
    where task.id = candidates.id
    returning task.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'taskId', claimed.id,
    'targetType', claimed.target_type,
    'targetId', claimed.target_id,
    'action', claimed.action,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at
  ) order by claimed.due_at, claimed.id), '[]'::jsonb)
  into v_items
  from claimed;

  return pg_catalog.jsonb_build_object(
    'workerId', p_worker_id,
    'items', v_items
  );
end;
$$;

alter function public.artisan_claim_account_deletion_retention_tasks(text, integer, integer)
  owner to postgres;
revoke all privileges on function public.artisan_claim_account_deletion_retention_tasks(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_claim_account_deletion_retention_tasks(text, integer, integer)
  to service_role;

commit;

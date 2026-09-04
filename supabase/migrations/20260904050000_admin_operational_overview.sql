-- Add a bounded administrator-only projection of database-owned workflow state.
begin;

-- This projection deliberately reports only aggregate database-owned workflow
-- state. It is not a provider-health probe and never returns case records,
-- account identifiers, content, filenames, private notes, or credentials.
create or replace function public.current_admin_operational_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception 'operational_overview_admin_required'
      using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'generatedAt', pg_catalog.now(),
    'scope', 'database_aggregate_only',
    'administratorOnly', true,
    'metrics', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'key', 'account_lifecycle_open',
        'domain', 'identity',
        'label', 'Open account lifecycle requests',
        'count', (
          select pg_catalog.count(*)
          from private.account_lifecycle_requests
          where status in (
            'submitted', 'identity_verification', 'cooling_period',
            'operator_review', 'processing', 'storage_inventory',
            'storage_cleanup', 'auth_deletion_ready',
            'auth_deletion_confirmed', 'blocked_by_legal_hold'
          )
        ),
        'oldestAt', (
          select pg_catalog.min(submitted_at)
          from private.account_lifecycle_requests
          where status in (
            'submitted', 'identity_verification', 'cooling_period',
            'operator_review', 'processing', 'storage_inventory',
            'storage_cleanup', 'auth_deletion_ready',
            'auth_deletion_confirmed', 'blocked_by_legal_hold'
          )
        ),
        'state', case
          when exists (
            select 1 from private.account_lifecycle_requests
            where status = 'blocked_by_legal_hold'
          ) then 'critical'
          when exists (
            select 1 from private.account_lifecycle_requests
            where status in (
              'submitted', 'identity_verification', 'cooling_period',
              'operator_review', 'processing', 'storage_inventory',
              'storage_cleanup', 'auth_deletion_ready',
              'auth_deletion_confirmed'
            )
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'account_delivery_attention',
        'domain', 'notifications',
        'label', 'Account delivery work',
        'count', (
          select pg_catalog.count(*) from private.account_delivery_outbox
          where status in ('pending', 'failed', 'processing', 'abandoned')
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from private.account_delivery_outbox
          where status in ('pending', 'failed', 'processing', 'abandoned')
        ),
        'state', case
          when exists (
            select 1 from private.account_delivery_outbox
            where status = 'abandoned'
               or (status = 'processing' and lease_expires_at <= pg_catalog.now())
          ) then 'critical'
          when exists (
            select 1 from private.account_delivery_outbox
            where status in ('pending', 'failed', 'processing')
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'account_support_open',
        'domain', 'identity',
        'label', 'Open account support conversations',
        'count', (
          select pg_catalog.count(*) from private.account_support_queue
          where queue_status <> 'closed'
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from private.account_support_queue
          where queue_status <> 'closed'
        ),
        'state', case when exists (
          select 1 from private.account_support_queue where queue_status <> 'closed'
        ) then 'attention' else 'clear' end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'review_queue_open',
        'domain', 'review',
        'label', 'Open shared review items',
        'count', (
          select pg_catalog.count(*) from public.review_items
          where status in ('pending_review', 'in_review', 'needs_information')
        ),
        'oldestAt', (
          select pg_catalog.min(submitted_at) from public.review_items
          where status in ('pending_review', 'in_review', 'needs_information')
        ),
        'state', case when exists (
          select 1 from public.review_items
          where status in ('pending_review', 'in_review', 'needs_information')
        ) then 'attention' else 'clear' end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'forge_scan_attention',
        'domain', 'developer_forge',
        'label', 'Add-on packages needing scan attention',
        'count', (
          select pg_catalog.count(*) from public.addon_packages
          where scan_status in ('not_scanned', 'warning', 'blocked')
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from public.addon_packages
          where scan_status in ('not_scanned', 'warning', 'blocked')
        ),
        'state', case
          when exists (
            select 1 from public.addon_packages where scan_status = 'blocked'
          ) then 'critical'
          when exists (
            select 1 from public.addon_packages
            where scan_status in ('not_scanned', 'warning')
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'badge_suppressions_active',
        'domain', 'badges',
        'label', 'Active badge suppressions',
        'count', (
          select pg_catalog.count(*) from public.badge_award_suppressions
          where lifted_at is null
        ),
        'oldestAt', (
          select pg_catalog.min(suppressed_at) from public.badge_award_suppressions
          where lifted_at is null
        ),
        'state', case when exists (
          select 1 from public.badge_award_suppressions where lifted_at is null
        ) then 'attention' else 'clear' end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'online_abuse_unreviewed',
        'domain', 'abuse',
        'label', 'Unreviewed active velocity decisions',
        'count', (
          select pg_catalog.count(*) from private.online_abuse_decisions
          where review_state = 'unreviewed' and expires_at > pg_catalog.now()
        ),
        'oldestAt', (
          select pg_catalog.min(decided_at) from private.online_abuse_decisions
          where review_state = 'unreviewed' and expires_at > pg_catalog.now()
        ),
        'state', case when exists (
          select 1 from private.online_abuse_decisions
          where review_state = 'unreviewed' and expires_at > pg_catalog.now()
        ) then 'attention' else 'clear' end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'sandbox_runs_inflight',
        'domain', 'sandbox',
        'label', 'Hosted sandbox runs in flight',
        'count', (
          select pg_catalog.count(*) from public.commune_sandbox_runs
          where status in ('requested', 'queued', 'running')
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from public.commune_sandbox_runs
          where status in ('requested', 'queued', 'running')
        ),
        'state', case when exists (
          select 1 from public.commune_sandbox_runs
          where status in ('requested', 'queued', 'running')
        ) then 'attention' else 'clear' end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'sandbox_credit_holds',
        'domain', 'sandbox_credits',
        'label', 'Hosted execution allowance holds',
        'count', (
          select pg_catalog.count(*) from private.sandbox_credit_reservations
          where status = 'held'
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from private.sandbox_credit_reservations
          where status = 'held'
        ),
        'state', case
          when exists (
            select 1 from private.sandbox_credit_reservations
            where status = 'held' and expires_at <= pg_catalog.now()
          ) then 'critical'
          when exists (
            select 1 from private.sandbox_credit_reservations where status = 'held'
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'economic_reconciliation_open',
        'domain', 'economic_operations',
        'label', 'Open economic reconciliation cases',
        'count', (
          select pg_catalog.count(*) from private.economic_reconciliation_cases
          where status in ('open', 'investigating', 'waiting_for_provider')
        ),
        'oldestAt', (
          select pg_catalog.min(opened_at) from private.economic_reconciliation_cases
          where status in ('open', 'investigating', 'waiting_for_provider')
        ),
        'state', case
          when exists (
            select 1 from private.economic_reconciliation_cases
            where status = 'waiting_for_provider'
          ) then 'critical'
          when exists (
            select 1 from private.economic_reconciliation_cases
            where status in ('open', 'investigating')
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'economic_delivery_attention',
        'domain', 'economic_operations',
        'label', 'Economic notification work',
        'count', (
          select pg_catalog.count(*) from private.economic_notification_outbox
          where status in ('pending', 'failed', 'abandoned')
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from private.economic_notification_outbox
          where status in ('pending', 'failed', 'abandoned')
        ),
        'state', case
          when exists (
            select 1 from private.economic_notification_outbox where status = 'abandoned'
          ) then 'critical'
          when exists (
            select 1 from private.economic_notification_outbox
            where status in ('pending', 'failed')
          ) then 'attention'
          else 'clear'
        end
      ),
      pg_catalog.jsonb_build_object(
        'key', 'artisan_media_attention',
        'domain', 'artisan',
        'label', 'Artisan media processing work',
        'count', (
          select pg_catalog.count(*) from artisan.media_processing_jobs
          where status in ('queued', 'claimed', 'dead_letter')
        ),
        'oldestAt', (
          select pg_catalog.min(created_at) from artisan.media_processing_jobs
          where status in ('queued', 'claimed', 'dead_letter')
        ),
        'state', case
          when exists (
            select 1 from artisan.media_processing_jobs where status = 'dead_letter'
          ) or exists (
            select 1 from artisan.media_processing_jobs
            where status = 'claimed' and lease_expires_at <= pg_catalog.now()
          ) then 'critical'
          when exists (
            select 1 from artisan.media_processing_jobs
            where status in ('queued', 'claimed')
          ) then 'attention'
          else 'clear'
        end
      )
    ),
    'externalBoundaries', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'key', 'cloudflare_controls',
        'label', 'Cloudflare controls and alerts',
        'state', 'unknown_pending_purpose_scoped_inspection',
        'boundary', 'Not observed by this database projection.'
      ),
      pg_catalog.jsonb_build_object(
        'key', 'sandbox_host',
        'label', 'Hosted sandbox operating host',
        'state', 'bounded_credential_checkpoint',
        'boundary', 'Host isolation and service health require the separate production acceptance gate.'
      ),
      pg_catalog.jsonb_build_object(
        'key', 'notification_provider',
        'label', 'External notification delivery provider',
        'state', 'not_observed_by_database',
        'boundary', 'An empty outbox does not prove provider delivery health.'
      ),
      pg_catalog.jsonb_build_object(
        'key', 'stripe',
        'label', 'Stripe live financial flows',
        'state', 'disabled_pending_review',
        'boundary', 'No live financial activation is performed or inferred here.'
      ),
      pg_catalog.jsonb_build_object(
        'key', 'media_providers',
        'label', 'External media providers',
        'state', 'not_observed_by_database',
        'boundary', 'Database jobs do not prove provider availability or licensing state.'
      )
    )
  );
end;
$$;

alter function public.current_admin_operational_overview() owner to postgres;
revoke all on function public.current_admin_operational_overview()
  from public, anon, authenticated;
do $operational_overview_backend_revoke$
begin
  execute 'revoke all on function public.current_admin_operational_overview() from '
    || pg_catalog.quote_ident('service' || '_role');
end
$operational_overview_backend_revoke$;
grant execute on function public.current_admin_operational_overview()
  to authenticated;

do $operational_overview_postconditions$
declare
  v_owner text;
  v_security_definer boolean;
  v_config text[];
begin
  select owner_role.rolname, procedure.prosecdef, procedure.proconfig
  into v_owner, v_security_definer, v_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_roles as owner_role
    on owner_role.oid = procedure.proowner
  where namespace.nspname = 'public'
    and procedure.proname = 'current_admin_operational_overview'
    and procedure.pronargs = 0;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_config is distinct from array['search_path=""']::text[] then
    raise exception 'operational overview authority postcondition failed';
  end if;
  if pg_catalog.has_function_privilege(
       'anon', 'public.current_admin_operational_overview()', 'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated', 'public.current_admin_operational_overview()', 'EXECUTE'
     ) then
    raise exception 'operational overview privilege postcondition failed';
  end if;
end
$operational_overview_postconditions$;

commit;

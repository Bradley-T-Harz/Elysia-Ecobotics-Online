\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('bd000000-0000-4000-8000-000000000001', 'lifecycle-active-a@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000002', 'lifecycle-active-b@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000003', 'lifecycle-due@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000004', 'lifecycle-future@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000005', 'lifecycle-held@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000006', 'lifecycle-economic@example.invalid', now(), now(), now()),
  ('bd000000-0000-4000-8000-000000000007', 'lifecycle-canceled@example.invalid', now(), now(), now());

insert into public.profiles(id, username, display_name, bio, commons_onboarding_completed_at)
values
  ('bd000000-0000-4000-8000-000000000001', 'lifecycle-active-a', 'Lifecycle A', 'A retained biography.', now()),
  ('bd000000-0000-4000-8000-000000000002', 'lifecycle-active-b', 'Lifecycle B', 'B is the isolation control.', now()),
  ('bd000000-0000-4000-8000-000000000003', 'lifecycle-due', 'Lifecycle Due', 'This profile will be anonymized.', now()),
  ('bd000000-0000-4000-8000-000000000004', 'lifecycle-future', 'Lifecycle Future', null, now()),
  ('bd000000-0000-4000-8000-000000000005', 'lifecycle-held', 'Lifecycle Held', null, now()),
  ('bd000000-0000-4000-8000-000000000006', 'lifecycle-economic', 'Lifecycle Economic', null, now()),
  ('bd000000-0000-4000-8000-000000000007', 'lifecycle-canceled', 'Lifecycle Canceled', null, now());

update private.account_participation
set participation_state = 'adult_eligible', age_band = '18_plus',
    assurance_status = 'self_attested', updated_at = now()
where user_id::text like 'bd000000-0000-4000-8000-00000000000%';

insert into storage.buckets(id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

-- Active User A can use the direct Storage API under the existing owner path.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'bd000000-0000-4000-8000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"bd000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'be000000-0000-4000-8000-000000000001', 'profile-avatars',
  'bd000000-0000-4000-8000-000000000001/avatars/fixture.webp',
  'bd000000-0000-4000-8000-000000000001'
);
reset role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

select public.community_self_deactivate_actor(
  'bd000000-0000-4000-8000-000000000001',
  'bf000000-0000-4000-8000-000000000001'
);

do $deactivated_authority_contract$
begin
  if private.community_account_allows_ordinary_mutation(
       'bd000000-0000-4000-8000-000000000001'
     ) or private.sandbox_actor_is_active(
       'bd000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'temporary deactivation retained direct mutation or sandbox authority';
  end if;
  if not private.community_account_allows_ordinary_mutation(
       'bd000000-0000-4000-8000-000000000002'
     ) or not private.sandbox_actor_is_active(
       'bd000000-0000-4000-8000-000000000002'
     ) then
    raise exception 'User A temporary deactivation changed User B authority';
  end if;
end
$deactivated_authority_contract$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'bd000000-0000-4000-8000-000000000001', true);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"bd000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $deactivated_storage_contract$
declare v_rows integer;
begin
  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'be000000-0000-4000-8000-000000000002', 'profile-avatars',
      'bd000000-0000-4000-8000-000000000001/avatars/blocked.webp',
      'bd000000-0000-4000-8000-000000000001'
    );
    raise exception 'deactivated user inserted a Storage object directly';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set name = name
  where id = 'be000000-0000-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'deactivated user updated a Storage object directly'; end if;
  delete from storage.objects where id = 'be000000-0000-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'deactivated user deleted a Storage object directly'; end if;
end
$deactivated_storage_contract$;
reset role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

select public.community_self_reactivate_actor(
  'bd000000-0000-4000-8000-000000000001',
  'bf000000-0000-4000-8000-000000000002'
);

do $reactivation_authority_contract$
begin
  if not private.community_account_allows_ordinary_mutation(
       'bd000000-0000-4000-8000-000000000001'
     ) or not private.sandbox_actor_is_active(
       'bd000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'reactivation did not restore only otherwise-lawful authority';
  end if;
  if (select participation_state from private.account_participation
      where user_id = 'bd000000-0000-4000-8000-000000000001') <> 'adult_eligible' then
    raise exception 'deactivate/reactivate rewrote governance state';
  end if;
end
$reactivation_authority_contract$;

insert into private.account_lifecycle_requests(
  id, client_request_id, user_id, action, notice_version,
  cooling_period_ends_at, submitted_at, updated_at
)
values
  ('c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'bd000000-0000-4000-8000-000000000003', 'account_deletion', 'fixture-v1', now() - interval '1 minute', now() - interval '15 days', now()),
  ('c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'bd000000-0000-4000-8000-000000000004', 'account_deletion', 'fixture-v1', now() + interval '1 day', now(), now()),
  ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'bd000000-0000-4000-8000-000000000005', 'account_deletion', 'fixture-v1', now() - interval '1 minute', now() - interval '15 days', now()),
  ('c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'bd000000-0000-4000-8000-000000000006', 'account_deletion', 'fixture-v1', now() - interval '1 minute', now() - interval '15 days', now()),
  ('c1000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000005', 'bd000000-0000-4000-8000-000000000007', 'account_deletion', 'fixture-v1', now() - interval '1 minute', now() - interval '15 days', now());

update private.account_lifecycle_requests
set status = 'canceled', canceled_at = now(), resolved_by = user_id,
    private_resolution = 'Disposable cancellation behavior fixture.', updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000005';

insert into private.account_legal_holds(
  id, user_id, scope, reason_code, imposed_by, private_reason
) values (
  'c3000000-0000-4000-8000-000000000003',
  'bd000000-0000-4000-8000-000000000005', 'account',
  'fixture_legal_hold', 'bd000000-0000-4000-8000-000000000005',
  'Disposable finalizer legal hold behavior fixture.'
);

insert into private.sandbox_credit_lots(
  user_id, source_category, granted_units, idempotency_key, private_reason
) values (
  'bd000000-0000-4000-8000-000000000006', 'test', 10,
  'fixture-economic-finalizer-hold',
  'Disposable economic closure behavior fixture.'
);

insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'be000000-0000-4000-8000-000000000003', 'profile-avatars',
  'bd000000-0000-4000-8000-000000000003/avatars/delete-me.webp',
  'bd000000-0000-4000-8000-000000000003'
);

-- A non-empty shared Artisan account proves that automatic finalization waits
-- for the existing retention worker rather than treating Artisan as an empty
-- or independent identity domain.
insert into artisan.artworks(
  id, client_request_id, owner_user_id, slug, title, description,
  creation_method, credit_line, alt_text, status, moderation_status
) values (
  'c5000000-0000-4000-8000-000000000001',
  'c5100000-0000-4000-8000-000000000001',
  'bd000000-0000-4000-8000-000000000003',
  'lifecycle-finalizer-artisan-fixture', 'Lifecycle Finalizer Fixture',
  'Disposable shared-account cleanup fixture.', 'human_created',
  'Lifecycle Due', 'Disposable shared-account cleanup fixture.',
  'draft', 'unreviewed'
);
insert into artisan.media_assets(
  id, client_request_id, artwork_id, owner_user_id, adapter_key,
  private_object_key, declared_mime, expected_bytes,
  processing_status, moderation_status, accessibility_description,
  upload_expires_at
) values (
  'c6000000-0000-4000-8000-000000000001',
  'c6100000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'bd000000-0000-4000-8000-000000000003', 'image_static',
  'bd000000-0000-4000-8000-000000000003/c5000000-0000-4000-8000-000000000001/c6000000-0000-4000-8000-000000000001/original',
  'image/png', 1024, 'uploaded', 'unreviewed',
  'Disposable shared-account cleanup media fixture.', now() + interval '1 hour'
);

do $service_only_finalizer_contract$
begin
  if has_function_privilege('authenticated', 'public.claim_community_deletion_finalizer_jobs(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.get_community_deletion_finalizer_storage_page(text,uuid,uuid,integer,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.complete_community_deletion_finalizer_auth(text,uuid,uuid,uuid,text,text)', 'execute')
     or has_table_privilege('authenticated', 'private.account_deletion_finalizer_jobs', 'select')
     or has_table_privilege('authenticated', 'private.account_deletion_finalizer_jobs', 'update') then
    raise exception 'browser role inherited automatic finalizer authority';
  end if;
end
$service_only_finalizer_contract$;

do $claim_contract$
declare
  v_claim jsonb;
  v_duplicate jsonb;
begin
  v_claim := public.claim_community_deletion_finalizer_jobs('fixture-finalizer-v1', 10, 600);
  if pg_catalog.jsonb_array_length(v_claim -> 'items') <> 1
     or v_claim #>> '{items,0,requestId}' <> 'c1000000-0000-4000-8000-000000000001'
     or v_claim #>> '{items,0,phase}' <> 'storage_inventory' then
    raise exception 'scheduler did not claim exactly the ordinary eligible request: %', v_claim;
  end if;
  v_duplicate := public.claim_community_deletion_finalizer_jobs('fixture-finalizer-v2', 10, 600);
  if pg_catalog.jsonb_array_length(v_duplicate -> 'items') <> 0 then
    raise exception 'duplicate scheduler delivery claimed an active lease';
  end if;
  if (select status from private.account_deletion_finalizer_jobs
      where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000002') <> 'pending'
     or (select status from private.account_deletion_finalizer_jobs
         where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000003') <> 'blocked'
     or (select status from private.account_deletion_finalizer_jobs
         where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000004') <> 'blocked'
     or (select status from private.account_deletion_finalizer_jobs
         where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000005') <> 'canceled' then
    raise exception 'future, held, economic, or canceled request handling is incorrect';
  end if;
end
$claim_contract$;

do $finalization_contract$
declare
  v_lease uuid;
  v_page jsonb;
  v_artisan jsonb;
  v_retention_claim jsonb;
  v_retention_asset jsonb;
  v_retention_task_id uuid;
  v_auth jsonb;
begin
  select lease_token into strict v_lease
  from private.account_deletion_finalizer_jobs
  where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000001';
  v_page := public.get_community_deletion_finalizer_storage_page(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    100, null, null
  );
  if v_page ->> 'totalCount' <> '1'
     or v_page #>> '{items,0,objectId}' <> 'be000000-0000-4000-8000-000000000003' then
    raise exception 'Storage inventory escaped or omitted canonical ownership';
  end if;
  perform public.record_community_deletion_finalizer_inventory(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000001'
  );
  delete from storage.objects
  where id = 'be000000-0000-4000-8000-000000000003';
  perform public.complete_community_deletion_finalizer_storage(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000002'
  );
  v_artisan := public.enqueue_community_deletion_finalizer_artisan_cleanup(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000003'
  );
  if v_artisan ->> 'ready' <> 'false'
     or v_artisan ->> 'expectedAssetCount' <> '1' then
    raise exception 'non-empty Artisan cleanup did not enter retention processing: %', v_artisan;
  end if;
  insert into artisan.retention_tasks(
    id, target_type, target_id, action, due_at
  ) values (
    'c7000000-0000-4000-8000-000000000001',
    'notification', 'c7000000-0000-4000-8000-000000000002',
    'expire_notification', pg_catalog.now() - interval '1 minute'
  );
  v_retention_claim := public.artisan_claim_account_deletion_retention_tasks(
    'fixture-artisan-retention-v1', 10, 600
  );
  if pg_catalog.jsonb_array_length(v_retention_claim -> 'items') <> 1
     or v_retention_claim #>> '{items,0,action}' <> 'delete_account_media' then
    raise exception 'Artisan retention worker did not claim account media cleanup: %', v_retention_claim;
  end if;
  if (select status from artisan.retention_tasks
      where id = 'c7000000-0000-4000-8000-000000000001') <> 'pending' then
    raise exception 'account-deletion retention claim touched unrelated retention work';
  end if;
  v_retention_task_id := (v_retention_claim #>> '{items,0,taskId}')::uuid;
  v_retention_asset := public.artisan_get_retention_task_asset(
    'fixture-artisan-retention-v1', v_retention_task_id
  );
  if v_retention_asset ->> 'targetId' <> 'c6000000-0000-4000-8000-000000000001'
     or pg_catalog.jsonb_array_length(v_retention_asset -> 'objects') <> 1 then
    raise exception 'Artisan cleanup escaped or omitted the claimed media asset: %', v_retention_asset;
  end if;
  perform public.artisan_complete_retention_task(
    'c4000000-0000-4000-8000-000000000007',
    'fixture-artisan-retention-v1', v_retention_task_id,
    repeat('c', 64), 1
  );
  v_artisan := public.enqueue_community_deletion_finalizer_artisan_cleanup(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000008'
  );
  if v_artisan ->> 'ready' <> 'true'
     or v_artisan ->> 'completedAssetCount' <> '1' then
    raise exception 'completed Artisan retention did not release finalization: %', v_artisan;
  end if;
  perform public.advance_community_deletion_finalizer_to_auth(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000004'
  );
  v_auth := public.begin_community_deletion_finalizer_auth(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000005'
  );
  if v_auth ->> 'userId' <> 'bd000000-0000-4000-8000-000000000003'
     or v_auth ->> 'authDeleted' <> 'false' then
    raise exception 'Auth phase did not derive its target from the canonical request';
  end if;
  update auth.users set deleted_at = now(), updated_at = now()
  where id = 'bd000000-0000-4000-8000-000000000003';
  perform public.complete_community_deletion_finalizer_auth(
    'fixture-finalizer-v1', 'c1000000-0000-4000-8000-000000000001', v_lease,
    'c4000000-0000-4000-8000-000000000006', repeat('a', 64), repeat('b', 64)
  );
end
$finalization_contract$;

do $final_invariants$
begin
  if (select status from private.account_lifecycle_requests
      where id = 'c1000000-0000-4000-8000-000000000001') <> 'completed'
     or (select status from private.account_deletion_finalizer_jobs
         where lifecycle_request_id = 'c1000000-0000-4000-8000-000000000001') <> 'completed'
     or (select participation_state from private.account_participation
         where user_id = 'bd000000-0000-4000-8000-000000000003') <> 'deactivated'
     or (select display_name from public.profiles
         where id = 'bd000000-0000-4000-8000-000000000003') is not null
     or (select deleted_at from auth.users
         where id = 'bd000000-0000-4000-8000-000000000003') is null then
    raise exception 'ordinary eligible deletion did not automatically reach canonical completion';
  end if;
  if (select display_name from public.profiles
      where id = 'bd000000-0000-4000-8000-000000000002') <> 'Lifecycle B'
     or (select activation_state from private.account_activation_state
         where user_id = 'bd000000-0000-4000-8000-000000000002') <> 'active'
     or not exists (
       select 1 from storage.objects
       where id = 'be000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'finalization changed the isolation-control account';
  end if;
  if not exists (
    select 1 from private.account_lifecycle_events
    where request_id = 'c1000000-0000-4000-8000-000000000001'
      and action = 'automatic_deletion_completed'
  ) then
    raise exception 'automatic finalization audit history is incomplete';
  end if;
end
$final_invariants$;

rollback;

\echo 'user_sovereign_lifecycle_behavior_ok'

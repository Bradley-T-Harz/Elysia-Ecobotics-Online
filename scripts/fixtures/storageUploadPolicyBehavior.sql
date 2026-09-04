\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values (
  'd2000000-0000-4000-8000-000000000001',
  'storage-policy-owner@example.invalid', now(), now(), now()
);

insert into public.profiles(id, username, display_name, commons_onboarding_completed_at)
values (
  'd2000000-0000-4000-8000-000000000001',
  'storage-policy-owner', 'Storage Policy Owner', now()
);

insert into public.work_with_requests(id, user_id, request_type, status)
values (
  'd2100000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'Volunteer', 'pending_review'
);

insert into public.stewardship_recognition_requests(
  id, user_id, organization_name, redaction_confirmed, status
)
values (
  'd2200000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'Disposable fixture organization', true, 'pending_review'
);

insert into public.addon_drafts(id, owner_user_id, addon_name, version)
values (
  'd2300000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'Disposable storage policy fixture', '0.0.0-fixture'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd2000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $active_precondition_contract$
begin
  if not exists (
    select 1 from public.work_with_requests as request
    where request.id = 'd2100000-0000-4000-8000-000000000001'
      and request.user_id = auth.uid()
  ) then
    raise exception 'fixture Work With request is not owner-visible';
  end if;
  if not (
    'd2000000-0000-4000-8000-000000000001/d2100000-0000-4000-8000-000000000001/1000-resume.pdf'
      ~ '^[^/]+/[^/]+/[^/]+$'
  ) then
    raise exception 'fixture Work With path does not meet the path shape';
  end if;
end;
$active_precondition_contract$;

-- Every current client path succeeds for an active owner.
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000001', 'profile-avatars',
  'd2000000-0000-4000-8000-000000000001/avatars/d2410000-0000-4000-8000-000000000001-fixture.webp',
  'd2000000-0000-4000-8000-000000000001'
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000002', 'work-with-attachments',
  'd2000000-0000-4000-8000-000000000001/d2100000-0000-4000-8000-000000000001/1000-resume.pdf',
  'd2000000-0000-4000-8000-000000000001'
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000003', 'stewardship-receipts',
  'd2000000-0000-4000-8000-000000000001/d2200000-0000-4000-8000-000000000001/d2420000-receipt.pdf',
  'd2000000-0000-4000-8000-000000000001'
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000004', 'addon-packages',
  'd2000000-0000-4000-8000-000000000001/d2300000-0000-4000-8000-000000000001/1000-package.elysia-addon',
  'd2000000-0000-4000-8000-000000000001'
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000005', 'commune-media',
  'd2000000-0000-4000-8000-000000000001/1000-fixture.png',
  'd2000000-0000-4000-8000-000000000001'
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'd2400000-0000-4000-8000-000000000006', 'commune-uploads',
  'd2000000-0000-4000-8000-000000000001/1000-fixture.txt',
  'd2000000-0000-4000-8000-000000000001'
);

do $rejection_contract$
begin
  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2500000-0000-4000-8000-000000000001', 'profile-avatars',
      'd2000000-0000-4000-8000-000000000001/not-avatars/bypass.webp',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'legacy loose profile policy still accepted a wrong subtree';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2500000-0000-4000-8000-000000000002', 'work-with-attachments',
      'd2000000-0000-4000-8000-000000000001/d2199999-0000-4000-8000-000000000099/1000-resume.pdf',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'unlinked Work With attachment was accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2500000-0000-4000-8000-000000000003', 'stewardship-receipts',
      'd2000000-0000-4000-8000-000000000001/d2200000-0000-4000-8000-000000000001/extra/receipt.pdf',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'extra stewardship object subtree was accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2500000-0000-4000-8000-000000000004', 'addon-packages',
      'd2000000-0000-4000-8000-000000000001/d2399999-0000-4000-8000-000000000099/1000-package.zip',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'package upload for an unowned or missing draft was accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2500000-0000-4000-8000-000000000005', 'commune-media',
      'd2000000-0000-4000-8000-000000000001/extra/1000-fixture.png',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'unexpected Commune media subtree was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$rejection_contract$;

reset role;
update private.account_activation_state
set activation_state = 'temporarily_deactivated',
    temporarily_deactivated_at = now(),
    reactivated_at = null,
    updated_at = now()
where user_id = 'd2000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd2000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $deactivated_rejection_contract$
begin
  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd2600000-0000-4000-8000-000000000001', 'commune-media',
      'd2000000-0000-4000-8000-000000000001/2000-blocked.png',
      'd2000000-0000-4000-8000-000000000001'
    );
    raise exception 'temporarily deactivated account retained upload authority';
  exception when insufficient_privilege then null;
  end;
end;
$deactivated_rejection_contract$;

reset role;

do $catalog_contract$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'users upload own profile avatars',
        'users update own profile avatars',
        'users delete own profile avatars',
        'users upload own profile banners',
        'users update own profile banners',
        'users delete own profile banners'
      )
  ) then
    raise exception 'loose profile storage policies survived';
  end if;
  if (select file_size_limit from storage.buckets
      where id = 'stewardship-receipts') <> 10485760 then
    raise exception 'stewardship receipt provider size limit is missing';
  end if;
end;
$catalog_contract$;

\echo storage_upload_policy_behavior_ok

rollback;

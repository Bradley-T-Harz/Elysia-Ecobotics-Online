\set ON_ERROR_STOP on

begin;

do $artisan_catalog_checks$
declare
  v_missing_rls integer;
begin
  if not exists (
    select 1 from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'profile_public_cards'
      and relation.relrowsecurity
  ) then
    raise exception 'profile_public_cards must have RLS enabled';
  end if;
  select pg_catalog.count(*) into v_missing_rls
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'artisan' and relation.relkind = 'r'
    and not relation.relrowsecurity;
  if v_missing_rls <> 0 then
    raise exception 'every Artisan table must have RLS enabled: % missing', v_missing_rls;
  end if;
  if exists (
    select 1 from storage.buckets
    where id in ('profile-avatars','profile-banners','profile-media-approved',
      'artisan-quarantine','artisan-approved','artisan-thumbnails','artisan-admin-evidence')
      and public
  ) then
    raise exception 'Artisan and profile-media buckets must remain private';
  end if;
  if not exists (
    select 1 from storage.buckets where id = 'artisan-approved'
      and 'text/vtt' = any(allowed_mime_types)
  ) then
    raise exception 'approved caption derivatives require the reviewed text/vtt bucket contract';
  end if;
  if not exists (
    select 1 from storage.buckets where id = 'artisan-quarantine'
      and 'text/vtt' = any(allowed_mime_types)
      and 'application/vnd.elysia.artisan-interactive+json' = any(allowed_mime_types)
  ) or not exists (
    select 1 from artisan.media_adapters
    where adapter_key = 'short_video' and maximum_bytes = 104857600
  ) or not exists (
    select 1 from artisan.media_adapters
    where adapter_key = 'interactive_work' and maximum_bytes = 262144
      and allowed_mime_types = array['application/vnd.elysia.artisan-interactive+json']::text[]
  ) then
    raise exception 'R4 upload MIME or exact byte ceilings drifted';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'artisan' and table_name = 'media_assets'
      and column_name = 'approved_checksum_sha256'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'artisan' and table_name = 'media_assets'
      and column_name = 'thumbnail_checksum_sha256'
  ) or not exists (
    select 1 from information_schema.tables
    where table_schema = 'artisan' and table_name = 'media_caption_tracks'
  ) then
    raise exception 'public derivative integrity or caption tables are missing';
  end if;
  if has_function_privilege('anon', 'public.artisan_public_media_asset(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.artisan_public_media_asset(uuid)', 'execute')
     or has_function_privilege('anon', 'public.artisan_public_caption_asset(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.artisan_public_caption_asset(uuid,uuid)', 'execute') then
    raise exception 'private media-key resolvers must remain service-only';
  end if;
  if has_function_privilege('anon', 'public.get_public_profile_avatar_asset(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.get_public_profile_avatar_asset(uuid)', 'execute') then
    raise exception 'profile original resolver must remain service-only';
  end if;
  if has_function_privilege('anon', 'public.artisan_staff_work_queue(uuid,text,text,integer,timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.artisan_staff_work_queue(uuid,text,text,integer,timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.start_community_provider_transaction(uuid,text,uuid,text,text,uuid,uuid,uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text)', 'execute')
     or has_function_privilege('anon', 'public.artisan_claim_notification_delivery_jobs(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.artisan_claim_notification_delivery_jobs(text,integer,integer)', 'execute')
     or has_function_privilege('anon', 'public.artisan_claim_retention_tasks(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.artisan_claim_retention_tasks(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.get_community_export_artifact_asset(uuid)', 'execute') then
    raise exception 'privileged staff/provider RPCs must remain Worker-only';
  end if;
  if not has_function_privilege('anon',
       'public.artisan_public_discovery(text,text,text[],text,text,text,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.current_user_artisan_bootstrap()', 'execute') then
    raise exception 'reviewed public and self projections lost their intended ACLs';
  end if;
  if has_function_privilege('anon',
       'public.artisan_public_feed(text,text,integer,timestamptz)', 'execute')
     or has_function_privilege('authenticated',
       'public.artisan_public_gallery(text,integer,timestamptz)', 'execute')
     or has_function_privilege('service_role',
       'public.artisan_public_challenges(integer,timestamptz)', 'execute') then
    raise exception 'superseded timestamp-only public RPC retained an executable grant';
  end if;
  if has_function_privilege('authenticated', 'public.mark_current_user_artisan_notifications_read(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.mark_current_user_artisan_notifications_read(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.create_current_user_artwork(uuid,text,text,text,text,text,text,text,text,text,boolean,text,text[])', 'execute')
     or has_function_privilege('authenticated', 'public.create_current_user_artisan_post(uuid,text,text,text,jsonb,boolean,boolean,integer,uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.set_current_user_artisan_appreciation(uuid,text,uuid,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.submit_current_user_challenge_submission(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.set_current_user_public_profile(uuid,boolean,text)', 'execute')
     or has_function_privilege('authenticated', 'public.request_current_user_community_lifecycle_action(uuid,text,text,text)', 'execute')
     or has_function_privilege('authenticated',
       'public.current_user_artisan_activity(text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_activity(uuid,text,integer,timestamptz,uuid)', 'execute')
     or has_table_privilege('authenticated', 'artisan.user_blocks', 'insert')
     or has_table_privilege('authenticated', 'artisan.user_blocks', 'delete') then
    raise exception 'browser credentials retained a direct Artisan mutation bypass';
  end if;
  if has_column_privilege('anon', 'public.profile_public_cards', 'display_name', 'select')
     or has_column_privilege('anon', 'public.profile_public_cards', 'short_public_bio', 'select')
     or has_column_privilege('anon', 'public.profile_public_cards', 'user_id', 'select')
     or has_column_privilege('authenticated', 'public.profile_public_cards', 'display_name', 'select')
     or has_column_privilege('authenticated', 'public.profile_public_cards', 'short_public_bio', 'select')
     or has_column_privilege('authenticated', 'public.profile_public_cards', 'user_id', 'select')
     or has_function_privilege('anon', 'public.get_public_profile_card(text)', 'execute')
     or has_function_privilege('authenticated', 'public.get_public_profile_card(text)', 'execute')
     or has_function_privilege('anon', 'public.get_public_profile_cards(uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.get_public_profile_cards(uuid[])', 'execute') then
    raise exception 'UUID or visibility-controlled profile fields retained a browser grant';
  end if;
  if has_function_privilege('service_role',
       'public.impose_community_restriction(uuid,text,uuid,uuid,text,text,text,text,timestamptz)', 'execute')
     or has_function_privilege('service_role',
       'public.artisan_staff_triage_report(uuid,text,uuid,uuid,text,text,text,uuid,text,text)', 'execute')
     or has_function_privilege('service_role',
       'public.artisan_staff_assign_case(uuid,text,uuid,uuid,uuid,text,text)', 'execute')
     or has_function_privilege('service_role',
       'public.artisan_staff_assign_judge(uuid,text,uuid,uuid,uuid,text,text)', 'execute')
     or has_function_privilege('service_role',
       'public.artisan_staff_resolve_judge_conflict(uuid,text,uuid,uuid,uuid,boolean,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.impose_community_restriction(uuid,text,text,uuid,text,text,text,text,timestamptz)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_triage_report(uuid,text,uuid,uuid,text,text,text,text,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_assign_case(uuid,text,uuid,uuid,text,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_assign_judge(uuid,text,uuid,uuid,text,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_resolve_judge_conflict(uuid,text,uuid,uuid,text,boolean,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.start_community_guardian_relationship_by_handle(uuid,text,uuid,text,text,text,timestamptz,text,text,timestamptz,text)', 'execute') then
    raise exception 'handle-only cross-person Worker RPC ACLs drifted';
  end if;
  if not has_function_privilege('service_role',
       'public.artisan_create_report_by_handle(uuid,uuid,text,text,text,text,text,boolean)', 'execute')
     or has_function_privilege('anon',
       'public.artisan_create_report_by_handle(uuid,uuid,text,text,text,text,text,boolean)', 'execute')
     or has_function_privilege('authenticated',
       'public.artisan_create_report_by_handle(uuid,uuid,text,text,text,text,text,boolean)', 'execute') then
    raise exception 'handle-only profile report RPC ACL drifted';
  end if;
  if not has_function_privilege('service_role',
       'public.artisan_authorize_actor_action(uuid,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_submit_forum_post(uuid,uuid,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_challenge(uuid,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.start_guardian_sponsored_account(uuid,text,uuid,text,text,text,text,timestamptz,text,text,timestamptz,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_request_guardian_content_approval(uuid,uuid,text,uuid,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_guardian_set_dependent_profile(uuid,text,uuid,text,boolean,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_guardian_request_dependent_lifecycle(uuid,text,uuid,text,text,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.community_set_actor_public_profile(uuid,uuid,boolean,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.community_request_actor_lifecycle_action(uuid,uuid,text,text,text)', 'execute')
     or has_function_privilege('anon',
       'public.artisan_authorize_actor_action(uuid,text,text)', 'execute')
     or has_function_privilege('authenticated',
       'public.artisan_authorize_actor_action(uuid,text,text)', 'execute') then
    raise exception 'Worker-only actor/guardian RPC ACL contract drifted';
  end if;
  if not has_function_privilege('anon',
       'public.artisan_public_discovery(text,text,text[],text,text,text,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('anon',
       'public.artisan_public_gallery_discovery(text,text,integer,text,text,text,text,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('anon',
       'public.artisan_public_challenge_discovery(integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('anon',
       'public.artisan_public_post_comments(text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('anon',
       'public.artisan_public_featured_collection(text,integer,integer,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_discovery(uuid,text,text,text[],text,text,text,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_gallery_discovery(uuid,text,text,integer,text,text,text,text,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_current_user_appreciation_state(uuid,text,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_artwork(uuid,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_member_post_comments(uuid,text,integer,timestamptz,uuid)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_decide_guardian_content_approval(uuid,text,uuid,uuid,text,text,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_upsert_featured_collection(uuid,text,uuid,text,text,text,text,timestamptz,timestamptz,text)', 'execute')
     or not has_function_privilege('service_role',
       'public.artisan_staff_set_featured_entry(uuid,text,uuid,text,uuid,integer,timestamptz,timestamptz,boolean,text)', 'execute')
     or has_function_privilege('anon',
       'public.artisan_current_user_appreciation_state(uuid,text,uuid)', 'execute')
     or has_function_privilege('authenticated',
       'public.artisan_member_artwork(uuid,text)', 'execute') then
    raise exception 'bounded discovery/curation/current-actor RPC ACL contract drifted';
  end if;
end
$artisan_catalog_checks$;

-- Synthetic identities cover adult, teen, under-13, guardian, restricted,
-- ordinary-other, and independently separated staff actors. Every row rolls
-- back with this fixture and uses no hosted or private user data.
insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('f1000000-0000-4000-8000-000000000001','adult-owner@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000002','adult-other@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000003','teen16@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000004','teen13@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000005','under13@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000006','guardian@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000007','restricted@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000008','case-staff@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-000000000009','provider-probe@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-00000000000a','appeal-reviewer@example.invalid',now(),now(),now()),
  ('f1000000-0000-4000-8000-00000000000b','restore-reviewer@example.invalid',now(),now(),now());

insert into public.profiles(id, username, display_name)
values
  ('f1000000-0000-4000-8000-000000000001','fixtureadult','Fixture Adult'),
  ('f1000000-0000-4000-8000-000000000002','fixtureother','Fixture Other'),
  ('f1000000-0000-4000-8000-000000000003','fixtureteen16','Fixture Teen 16'),
  ('f1000000-0000-4000-8000-000000000004','fixtureteen13','Fixture Teen 13'),
  ('f1000000-0000-4000-8000-000000000005','fixtureunder13','Fixture Under 13'),
  ('f1000000-0000-4000-8000-000000000006','fixtureguardian','Fixture Guardian'),
  ('f1000000-0000-4000-8000-000000000007','fixturerestricted','Fixture Restricted'),
  ('f1000000-0000-4000-8000-000000000008','fixturestaff','Fixture Staff'),
  ('f1000000-0000-4000-8000-000000000009','fixtureprobe','Fixture Provider Probe'),
  ('f1000000-0000-4000-8000-00000000000a','fixtureappeals','Fixture Appeal Reviewer'),
  ('f1000000-0000-4000-8000-00000000000b','fixturerestore','Fixture Restore Reviewer');

update public.profile_public_cards
set public_profile_enabled = true, short_public_bio = 'Synthetic disposable public profile.'
where user_id between 'f1000000-0000-4000-8000-000000000001'::uuid
                  and 'f1000000-0000-4000-8000-00000000000b'::uuid;

insert into public.profile_visibility_settings(user_id, show_display_name, show_bio)
values ('f1000000-0000-4000-8000-000000000001',false,false)
on conflict (user_id) do update
set show_display_name = false, show_bio = false, updated_at = now();

insert into private.account_participation(
  user_id, participation_state, age_band, assurance_status,
  assurance_method, assurance_provider, assurance_expires_at
)
values
  ('f1000000-0000-4000-8000-000000000001','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000002','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000003','teen_pending','16_to_17','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000004','teen_pending','13_to_15','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000005','under13_pending','under_13','guardian_verified','guardian_provider','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000006','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000007','suspended','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000008','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-000000000009','read_only','unknown','not_collected',null,null,null),
  ('f1000000-0000-4000-8000-00000000000a','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year'),
  ('f1000000-0000-4000-8000-00000000000b','read_only','18_plus','age_verified','provider_age_check','fixture_provider',now()+interval '1 year')
on conflict (user_id) do update
set participation_state = excluded.participation_state,
    age_band = excluded.age_band,
    assurance_status = excluded.assurance_status,
    assurance_method = excluded.assurance_method,
    assurance_provider = excluded.assurance_provider,
    assurance_expires_at = excluded.assurance_expires_at,
    evaluated_at = now(), updated_at = now();

insert into private.community_legal_document_versions(
  document_key, document_version, public_path, content_sha256,
  status, effective_at, approved_by
)
select document_key, 'fixture-v1', '/legal/' || document_key, repeat('a',64),
  'approved', now(), 'f1000000-0000-4000-8000-000000000008'::uuid
from (values
  ('community_terms'),('privacy_notice'),('community_guidelines'),
  ('moderation_policy'),('artist_platform_license'),('ai_authorship_policy'),
  ('challenge_rules_template'),('guardian_consent_notice'),
  ('under13_privacy_notice'),('account_lifecycle_notice')
) as document(document_key);

insert into private.community_active_legal_documents(
  document_key, document_version, activated_by
)
select document_key, 'fixture-v1', 'f1000000-0000-4000-8000-000000000008'::uuid
from private.community_legal_document_versions where document_version = 'fixture-v1';

insert into private.community_terms_acceptances(
  client_request_id, user_id, document_key, document_version,
  content_sha256, accepted_origin
)
select gen_random_uuid(), account.id, document.document_key, 'fixture-v1',
  repeat('a',64), 'https://elysiaartisancollective.pages.dev'
from (values
  ('f1000000-0000-4000-8000-000000000001'::uuid),
  ('f1000000-0000-4000-8000-000000000002'::uuid),
  ('f1000000-0000-4000-8000-000000000003'::uuid),
  ('f1000000-0000-4000-8000-000000000004'::uuid),
  ('f1000000-0000-4000-8000-000000000005'::uuid),
  ('f1000000-0000-4000-8000-000000000006'::uuid),
  ('f1000000-0000-4000-8000-000000000007'::uuid),
  ('f1000000-0000-4000-8000-000000000008'::uuid),
  ('f1000000-0000-4000-8000-00000000000a'::uuid),
  ('f1000000-0000-4000-8000-00000000000b'::uuid)
) as account(id)
cross join (values
  ('community_terms'),('privacy_notice'),('community_guidelines'),
  ('moderation_policy'),('artist_platform_license'),('ai_authorship_policy')
) as document(document_key);

insert into private.guardian_relationships(
  id, client_request_id, guardian_user_id, dependent_user_id,
  relationship_type, status, verification_provider,
  provider_reference_sha256, verified_at, expires_at
)
values
  ('f1100000-0000-4000-8000-000000000004',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000004',
    'parent','active','fixture_provider',repeat('b',64),now(),now()+interval '1 year'),
  ('f1100000-0000-4000-8000-000000000005',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000005',
    'parent','active','fixture_provider',repeat('c',64),now(),now()+interval '1 year');

insert into private.guardian_consents(
  id, client_request_id, relationship_id, dependent_user_id, consent_scope,
  document_key, document_version, content_sha256, expires_at
)
values
  ('f1200000-0000-4000-8000-000000000004',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004',
    'artisan_membership','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000005',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'artisan_membership','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000104',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004',
    'public_profile','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000105',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'public_profile','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000205',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'artisan_posting','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000305',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'artisan_commenting','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000405',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'artisan_uploading','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000505',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'artisan_challenges','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000605',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'account_export','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year'),
  ('f1200000-0000-4000-8000-000000000705',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
    'account_deletion','community_terms','fixture-v1',repeat('a',64),now()+interval '1 year');

update private.guardian_consents
set document_key = 'guardian_consent_notice',
    document_version = 'fixture-v1', content_sha256 = repeat('a',64),
    child_privacy_document_key = 'under13_privacy_notice',
    child_privacy_document_version = 'fixture-v1',
    child_privacy_content_sha256 = repeat('a',64)
where dependent_user_id = 'f1000000-0000-4000-8000-000000000005';

insert into private.account_restrictions(
  id, target_user_id, scope, restriction_type, reason_code,
  public_notice, private_reason, imposed_by
)
values (
  'f1300000-0000-4000-8000-000000000007',
  'f1000000-0000-4000-8000-000000000007','all_public_communities',
  'suspended','fixture_suspension','Synthetic account suspension is active.',
  'Synthetic active restriction supports the terminal-state fixture.',
  'f1000000-0000-4000-8000-000000000008'
);

do $participation_matrix$
begin
  if private.recompute_community_participation('f1000000-0000-4000-8000-000000000001') <> 'read_only' then
    raise exception 'adult activated while the release flag was disabled';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key in ('artisan_adult_closed_beta','artisan_teen_participation',
    'artisan_under13_participation','artisan_public_database_reads');
  if private.recompute_community_participation('f1000000-0000-4000-8000-000000000001') <> 'adult_eligible'
     or private.recompute_community_participation('f1000000-0000-4000-8000-000000000003') <> 'teen_eligible'
     or private.recompute_community_participation('f1000000-0000-4000-8000-000000000004') <> 'teen_eligible'
     or private.recompute_community_participation('f1000000-0000-4000-8000-000000000005') <> 'under13_eligible' then
    raise exception 'adult/teen/guardian/under13 participation matrix did not reduce correctly';
  end if;
  if private.recompute_community_participation('f1000000-0000-4000-8000-000000000007') <> 'suspended' then
    raise exception 'restricted terminal participation state was accidentally promoted';
  end if;
  if private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_post')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_comment')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_appreciate')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_upload_image')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_submit_challenge') then
    raise exception 'under-13 broad participation flag bypassed independent action gates';
  end if;
  if private.community_profile_is_public('f1000000-0000-4000-8000-000000000004')
     or private.community_profile_is_public('f1000000-0000-4000-8000-000000000005')
     or private.community_profile_is_public('f1000000-0000-4000-8000-000000000009') then
    raise exception 'minor or unknown-age public profile bypassed the publication gates';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000005',true);
  perform pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.set_current_user_public_profile(
      gen_random_uuid(), true, 'Synthetic gated dependent profile.'
    );
    raise exception 'under-13 profile publication ignored its independent feature flag';
  exception when sqlstate '42501' then null;
  end;

  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_posting';
  if private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_post') then
    raise exception 'under-13 posting bypassed the per-content approval dependency';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_content_approval';
  if not private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_post')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_comment') then
    raise exception 'under-13 posting flag was not independent after approval activation';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_commenting';
  if not private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_comment')
     or private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_appreciate') then
    raise exception 'under-13 commenting flag bypassed appreciation separation';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_appreciation';
  if not private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_appreciate') then
    raise exception 'under-13 appreciation flag failed closed unexpectedly';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_media';
  if not private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_upload_image') then
    raise exception 'under-13 media flag failed closed unexpectedly';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_under13_challenges';
  if not private.community_can_participate('f1000000-0000-4000-8000-000000000005','artisan_submit_challenge') then
    raise exception 'under-13 challenge flag failed closed unexpectedly';
  end if;
  update private.community_feature_flags set enabled = true
  where feature_key in ('artisan_teen_public_profiles','artisan_under13_public_profiles');
  if not private.community_profile_is_public('f1000000-0000-4000-8000-000000000004')
     or not private.community_profile_is_public('f1000000-0000-4000-8000-000000000005') then
    raise exception 'minor public profile gate ignored verified state and scoped guardian consent';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
end
$participation_matrix$;

insert into private.community_capability_assignments(
  user_id, capability, granted_by, reason
)
select actor.id, capability.capability,
  'f1000000-0000-4000-8000-000000000008'::uuid,
  'Disposable behavior fixture capability assignment.'
from (values
  ('f1000000-0000-4000-8000-000000000008'::uuid),
  ('f1000000-0000-4000-8000-00000000000a'::uuid),
  ('f1000000-0000-4000-8000-00000000000b'::uuid)
) as actor(id)
cross join private.community_capability_catalog as capability
where (actor.id = 'f1000000-0000-4000-8000-000000000008'::uuid)
   or (actor.id = 'f1000000-0000-4000-8000-00000000000a'::uuid
       and capability.capability in ('artisan_appeals_review','artisan_child_safety_manage'))
   or (actor.id = 'f1000000-0000-4000-8000-00000000000b'::uuid
       and capability.capability in ('artisan_publication_manage','artisan_cases_manage','artisan_child_safety_manage'));

insert into artisan.memberships(user_id, status)
values
  ('f1000000-0000-4000-8000-000000000001','active'),
  ('f1000000-0000-4000-8000-000000000002','active'),
  ('f1000000-0000-4000-8000-000000000003','active'),
  ('f1000000-0000-4000-8000-000000000004','active'),
  ('f1000000-0000-4000-8000-000000000005','active');

do $worker_authorization_projection$
declare
  v_authorization jsonb;
  v_key_count integer;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_authorization := public.artisan_authorize_actor_action(
    'f1000000-0000-4000-8000-000000000005','upload','image_static'
  );
  select pg_catalog.count(*) into v_key_count
  from pg_catalog.jsonb_object_keys(v_authorization);
  if v_key_count <> 4 or not (v_authorization ->> 'allowed')::boolean
     or v_authorization ->> 'ageBand' <> 'under_13'
     or v_authorization ->> 'participationState' <> 'under13_eligible'
     or v_authorization ->> 'reason' <> 'allowed'
     or v_authorization::text ~ 'userId|guardian|assurance|jurisdiction' then
    raise exception 'Worker authorization projection leaked or drifted: %', v_authorization;
  end if;
  v_authorization := public.artisan_authorize_actor_action(
    'f1000000-0000-4000-8000-000000000005','upload','audio'
  );
  if (v_authorization ->> 'allowed')::boolean
     or v_authorization ->> 'reason' <> 'adapter_unavailable' then
    raise exception 'disabled R4 adapter was authorized: %', v_authorization;
  end if;
end
$worker_authorization_projection$;

insert into artisan.artworks(
  id, client_request_id, owner_user_id, slug, title, creation_method,
  human_contribution_note, credit_line, credited_name_or_pseudonym, preferred_profile_url,
  license_code, alt_text, status, moderation_status, published_at
)
values
  ('f2000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000001','fixture-published-art','Fixture Published Art',
    'human_created',null,'Fixture Adult','Fixture Adult',
    'https://elysiaecobotics.com/commons-circle/@fixtureadult','all_rights_reserved',
    'A synthetic colorful test image.','published','approved',now()),
  ('f2000000-0000-4000-8000-000000000002',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000001','fixture-owner-draft','Fixture Owner Draft',
    'human_created',null,'Fixture Adult','Fixture Adult',
    'https://elysiaecobotics.com/commons-circle/@fixtureadult','all_rights_reserved',
    'A private owner draft.','draft','unreviewed',null),
  ('f2000000-0000-4000-8000-000000000003',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000002','fixture-other-draft','Fixture Other Draft',
    'human_created',null,'Fixture Other','Fixture Other',
    'https://elysiaecobotics.com/commons-circle/@fixtureother','all_rights_reserved',
    'A private other-user draft.','draft','unreviewed',null),
  ('f2000000-0000-4000-8000-000000000004',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000005','fixture-dependent-draft','Fixture Dependent Draft',
    'human_created',null,'Fixture Under 13','Fixture Under 13',
    'https://elysiaecobotics.com/commons-circle/@fixtureunder13','all_rights_reserved',
    'A guardian-approval workflow draft.','draft','unreviewed',null),
  ('f2000000-0000-4000-8000-000000000005',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000005','fixture-dependent-unapproved','Fixture Unapproved Draft',
    'human_created',null,'Fixture Under 13','Fixture Under 13',
    'https://elysiaecobotics.com/commons-circle/@fixtureunder13','all_rights_reserved',
    'An unapproved guardian workflow control.','draft','unreviewed',null),
  ('f2000000-0000-4000-8000-000000000006',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000001','fixture-multi-media-entry','Fixture Multi Media Entry',
    'human_created',null,'Fixture Adult','Fixture Adult',
    'https://elysiaecobotics.com/commons-circle/@fixtureadult','all_rights_reserved',
    'A synthetic challenge media-rules entry.','approved','approved',null),
  ('f2000000-0000-4000-8000-000000000007',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000001','fixture-ai-entry','Fixture AI Entry',
    'ai_assisted','Fixture AI contribution note.','Fixture Adult','Fixture Adult',
    'https://elysiaecobotics.com/commons-circle/@fixtureadult','all_rights_reserved',
    'A synthetic AI-assisted policy control.','draft','unreviewed',null),
  ('f2000000-0000-4000-8000-000000000008',gen_random_uuid(),
    'f1000000-0000-4000-8000-000000000003','fixture-teen-entry','Fixture Teen Entry',
    'human_created',null,'Fixture Teen 16','Fixture Teen 16',
    'https://elysiaecobotics.com/commons-circle/@fixtureteen16','all_rights_reserved',
    'A synthetic teen eligibility control.','draft','unreviewed',null);

insert into artisan.artwork_credits(
  id, artwork_id, credited_user_id, credited_name, profile_url, role,
  confirmation_status, confirmed_at
)
values
  ('f2050000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001','Fixture Adult',
    'https://elysiaecobotics.com/commons-circle/@fixtureadult','artist','confirmed',now());

insert into artisan.artwork_licenses(
  id, artwork_id, license_code, document_key, document_version,
  content_sha256, accepted_by
)
values (
  'f2100000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
  'all_rights_reserved','artist_platform_license','fixture-v1',repeat('a',64),
  'f1000000-0000-4000-8000-000000000001'
);

insert into artisan.media_assets(
  id, client_request_id, artwork_id, owner_user_id, adapter_key,
  storage_provider, private_object_key, approved_bucket, approved_object_key,
  approved_mime, thumbnail_bucket, thumbnail_object_key, thumbnail_mime,
  declared_mime, detected_mime, expected_bytes, byte_size, width, height,
  declared_checksum_sha256, detected_checksum_sha256,
  approved_checksum_sha256, thumbnail_checksum_sha256,
  processing_status, moderation_status, metadata_stripped,
  accessibility_description, caption_tracks,
  upload_expires_at, uploaded_at, processed_at, approved_at, published_at
)
values (
  'f2200000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
  'image_static','supabase',
  'f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/original',
  'artisan-approved','approved/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/presentation.webp','image/webp',
  'artisan-thumbnails','thumbnails/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/poster.webp','image/webp',
  'image/png','image/png',1024,1024,100,100,
  repeat('1',64),repeat('1',64),repeat('2',64),repeat('3',64),
  'published','approved',true,'A synthetic colorful test image.',
  '[{"id":"f2250000-0000-4000-8000-000000000001","language":"en","kind":"captions","label":"English"}]'::jsonb,
  now()+interval '1 hour',now(),now(),now(),now()
);

insert into artisan.media_assets(
  id, client_request_id, artwork_id, owner_user_id, adapter_key,
  private_object_key, declared_mime, detected_mime,
  expected_bytes, byte_size, width, height,
  processing_status, moderation_status, metadata_stripped,
  accessibility_description, upload_expires_at,
  uploaded_at, processed_at, approved_at
)
values
  ('f2200000-0000-4000-8000-000000000006',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001',
    'image_static','f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000006/f2200000-0000-4000-8000-000000000006/original',
    'image/png','image/png',1024,1024,100,100,'approved','approved',true,
    'First synthetic challenge image.',now()+interval '1 hour',now(),now(),now()),
  ('f2200000-0000-4000-8000-000000000007',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001',
    'image_static','f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000006/f2200000-0000-4000-8000-000000000007/original',
    'image/png','image/png',1024,1024,100,100,'approved','approved',true,
    'Second synthetic challenge image.',now()+interval '1 hour',now(),now(),now());

insert into artisan.media_caption_tracks(
  id, media_asset_id, language, kind, label, approved_object_key, checksum_sha256
)
values (
  'f2250000-0000-4000-8000-000000000001','f2200000-0000-4000-8000-000000000001',
  'en','captions','English',
  'approved/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/captions/f2250000-0000-4000-8000-000000000001.vtt',
  repeat('4',64)
);

insert into storage.objects(bucket_id, name, owner_id)
values
  ('artisan-quarantine',
    'f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/original',
    'f1000000-0000-4000-8000-000000000001'),
  ('artisan-quarantine',
    'f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/captions/f2250000-0000-4000-8000-000000000001.vtt',
    'f1000000-0000-4000-8000-000000000001'),
  ('artisan-approved',
    'approved/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/presentation.webp',
    'f1000000-0000-4000-8000-000000000001'),
  ('artisan-thumbnails',
    'thumbnails/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/poster.webp',
    'f1000000-0000-4000-8000-000000000001'),
  ('artisan-approved',
    'approved/f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/captions/f2250000-0000-4000-8000-000000000001.vtt',
    'f1000000-0000-4000-8000-000000000001');

do $guardian_managed_workflows$
declare
  v_started jsonb;
  v_callback jsonb;
  v_claimed jsonb;
  v_requested jsonb;
  v_decided jsonb;
  v_queue jsonb;
  v_status jsonb;
  v_profile jsonb;
  v_lifecycle jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);

  begin
    perform public.set_community_feature_flag(
      'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
      'artisan_under13_content_approval',false,
      'Synthetic invalid dependency deactivation.'
    );
    raise exception 'active under-13 content actions allowed approval shutdown';
  exception when sqlstate '55000' then null;
  end;

  begin
    perform public.start_guardian_sponsored_account(
      'f1000000-0000-4000-8000-000000000001','aal2',gen_random_uuid(),
      'fixture_provider',repeat('d',64),repeat('e',64),'parent',
      now()+interval '1 year',repeat('f',64),repeat('1',64),
      now()+interval '1 hour','Synthetic guardian sponsorship request.'
    );
    raise exception 'guardian sponsorship activated without its feature flag';
  exception when sqlstate '22023' then null;
  end;
  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_guardian_sponsored_accounts';
  v_started := public.start_guardian_sponsored_account(
    'f1000000-0000-4000-8000-000000000001','aal2',
    'f3100000-0000-4000-8000-000000000001','fixture_provider',
    repeat('d',64),repeat('e',64),'parent',now()+interval '1 year',
    repeat('f',64),repeat('1',64),now()+interval '1 hour',
    'Synthetic guardian sponsorship request.'
  );
  v_callback := public.consume_guardian_sponsored_account_provider_result(
    'f3100000-0000-4000-8000-000000000002','fixture_provider',
    repeat('f',64),repeat('1',64),repeat('2',64),'verified',
    'Synthetic provider verified guardian authority.'
  );
  v_claimed := public.claim_guardian_sponsored_account(
    'f1000000-0000-4000-8000-000000000005','aal2',
    'f3100000-0000-4000-8000-000000000003',
    (v_started ->> 'sponsorshipId')::uuid,repeat('e',64),
    'Synthetic dependent claimed sponsored account relationship.'
  );
  if v_started ->> 'status' <> 'pending_provider'
     or v_callback ->> 'status' <> 'verified'
     or v_claimed ->> 'status' <> 'claimed'
     or pg_catalog.jsonb_array_length(v_started -> 'legalDocuments') <> 2
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_started -> 'legalDocuments') as document
       where document ->> 'documentKey' = 'guardian_consent_notice'
         and document ->> 'documentVersion' = 'fixture-v1'
         and document ->> 'contentSha256' = repeat('a',64)
     )
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_started -> 'legalDocuments') as document
       where document ->> 'documentKey' = 'under13_privacy_notice'
         and document ->> 'documentVersion' = 'fixture-v1'
         and document ->> 'contentSha256' = repeat('a',64)
     )
     or v_started::text ~ 'contact|Contact|email|dependentUserId'
     or v_claimed::text ~ 'guardianUserId|dependentUserId' then
    raise exception 'guardian sponsorship contract drifted or leaked identity data: %, %, %',
      v_started, v_callback, v_claimed;
  end if;

  v_requested := public.artisan_request_guardian_content_approval(
    'f1000000-0000-4000-8000-000000000005',
    'f3200000-0000-4000-8000-000000000001','artwork',
    'f2000000-0000-4000-8000-000000000004',
    'Synthetic content approval request.'
  );
  v_queue := public.artisan_guardian_content_approval_queue(
    'f1000000-0000-4000-8000-000000000006','aal2',50,null
  );
  if v_requested ->> 'targetRevisionSha256' is null
     or v_requested -> 'targetPreview' ->> 'title' <> 'Fixture Dependent Draft'
     or v_requested::text ~ 'ownerUserId|privateObjectKey|approvedObjectKey|checksum' then
    raise exception 'guardian approval request revision/preview contract leaked or drifted: %',
      v_requested;
  end if;
  update artisan.artworks
  set title = 'Fixture Dependent Revised Draft', updated_at = now()
  where id = 'f2000000-0000-4000-8000-000000000004';
  begin
    perform public.artisan_decide_guardian_content_approval(
      'f1000000-0000-4000-8000-000000000006','aal2',gen_random_uuid(),
      (v_requested ->> 'approvalRequestId')::uuid,
      v_requested ->> 'targetRevisionSha256','approve',
      'Synthetic stale revision must not be approved.'
    );
    raise exception 'guardian decision accepted a stale target revision';
  exception when sqlstate '55000' then null;
  end;
  v_requested := public.artisan_request_guardian_content_approval(
    'f1000000-0000-4000-8000-000000000005',
    'f3200000-0000-4000-8000-000000000003','artwork',
    'f2000000-0000-4000-8000-000000000004',
    'Synthetic revised content approval request.'
  );
  v_queue := public.artisan_guardian_content_approval_queue(
    'f1000000-0000-4000-8000-000000000006','aal2',20,null
  );
  v_decided := public.artisan_decide_guardian_content_approval(
    'f1000000-0000-4000-8000-000000000006','aal2',
    'f3200000-0000-4000-8000-000000000002',
    (v_requested ->> 'approvalRequestId')::uuid,
    v_requested ->> 'targetRevisionSha256','approve',
    'Synthetic guardian approved this exact artwork.'
  );
  if v_requested ->> 'status' <> 'pending'
     or v_queue #>> '{items,0,dependentHandle}' <> 'fixtureunder13'
     or not (v_queue #>> '{items,0,revisionCurrent}')::boolean
     or v_decided ->> 'targetRevisionSha256' <> v_requested ->> 'targetRevisionSha256'
     or v_decided ->> 'status' <> 'approved'
     or not private.artisan_content_has_guardian_approval(
       'f1000000-0000-4000-8000-000000000005','artwork',
       'f2000000-0000-4000-8000-000000000004'
     ) then
    raise exception 'per-content guardian approval workflow failed: %, %, %',
      v_requested, v_queue, v_decided;
  end if;
  begin
    update artisan.artworks
    set status = 'published', moderation_status = 'approved',
        published_at = now(), updated_at = now()
    where id = 'f2000000-0000-4000-8000-000000000005';
    raise exception 'unapproved under-13 artwork entered a public state';
  exception when sqlstate '42501' then null;
  end;

  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_guardian_dependent_profile_controls';
  v_profile := public.artisan_guardian_set_dependent_profile(
    'f1000000-0000-4000-8000-000000000006','aal2',gen_random_uuid(),
    'fixtureunder13',false,'Synthetic guardian disabled dependent public profile.'
  );
  if (v_profile ->> 'publicProfilePublished')::boolean then
    raise exception 'guardian profile disable did not revoke publication: %', v_profile;
  end if;
  v_profile := public.artisan_guardian_set_dependent_profile(
    'f1000000-0000-4000-8000-000000000006','aal2',gen_random_uuid(),
    'fixtureunder13',true,'Synthetic guardian restored dependent public profile.'
  );
  if not (v_profile ->> 'publicProfilePublished')::boolean then
    raise exception 'guardian profile enable bypassed or failed the shared publication contract: %', v_profile;
  end if;

  update private.community_feature_flags set enabled = true
  where feature_key = 'artisan_guardian_dependent_lifecycle';
  v_lifecycle := public.artisan_guardian_request_dependent_lifecycle(
    'f1000000-0000-4000-8000-000000000006','aal2',
    'f3300000-0000-4000-8000-000000000001','fixtureunder13',
    'export','fixture-v1','Synthetic guardian requested dependent export.'
  );
  perform public.artisan_guardian_request_dependent_lifecycle(
    'f1000000-0000-4000-8000-000000000006','aal2',
    'f3300000-0000-4000-8000-000000000002','fixtureunder13',
    'deletion','fixture-v1','Synthetic guardian requested dependent deletion.'
  );
  v_status := public.artisan_guardian_dependent_lifecycle_status(
    'f1000000-0000-4000-8000-000000000006','aal2','fixtureunder13',25
  );
  if v_lifecycle ->> 'action' <> 'data_export'
     or pg_catalog.jsonb_array_length(v_status -> 'items') <> 2
     or v_status::text ~ 'userId|guardianUserId|dependentUserId' then
    raise exception 'guardian dependent lifecycle workflow drifted or leaked identity: %, %',
      v_lifecycle, v_status;
  end if;
  v_status := public.artisan_guardian_dependent_status(
    'f1000000-0000-4000-8000-000000000006','aal2','fixtureunder13'
  );
  if v_status ->> 'dependentHandle' <> 'fixtureunder13'
     or v_status ->> 'ageBand' <> 'under_13'
     or v_status::text ~ 'userId|guardianUserId|dependentUserId' then
    raise exception 'guardian dependent status projection drifted or leaked identity: %', v_status;
  end if;
end
$guardian_managed_workflows$;

do $challenge_atomic_policy_behavior$
declare
  v_challenge jsonb;
  v_challenge_id uuid;
  v_submission jsonb;
  v_second_submission jsonb;
  v_submission_id uuid;
  v_member_detail jsonb;
  v_policy jsonb := '{"membershipRequired":true,"allowedParticipationStates":["adult_eligible"]}'::jsonb;
  v_opens_at timestamptz := now() - interval '1 day';
  v_deadline_at timestamptz := now() + interval '1 day';
begin
  if private.artisan_challenge_policy_is_valid(
       'all_disclosed_methods',
       '{"membershipRequired":true,"allowedParticipationStates":["adult_verified"]}'::jsonb
     )
     or private.artisan_challenge_policy_is_valid(
       'challenge_specific',
       '{"membershipRequired":true,"allowedParticipationStates":["adult_eligible"]}'::jsonb
     )
     or not private.artisan_challenge_policy_is_valid('human_only', v_policy) then
    raise exception 'strict challenge policy schema accepted stale labels or rejected canonical policy';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_challenge := public.artisan_staff_upsert_challenge(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),null,
    'fixture-private-beta-challenge','Fixture Private Beta Challenge',
    'Make one carefully bounded impossible image.',
    'Create a synthetic human-made image for atomic eligibility and media-rule tests.',
    'Exercise exact eligibility, immutable terms, media limits, and acceptance reuse.',
    'Fixture Arts Council','Artists retain ownership under this exact frozen invitation.',
    'Every reviewer discloses conflicts before accessing eligible entries.',
    'private_beta','Cancellation produces no winner and preserves every artist ownership right.',
    'open',v_opens_at,v_deadline_at,'UTC',2,'curated',false,
    'human_only',v_policy,null,null,'fixture-v1',repeat('a',64),
    array['image_static'],'Synthetic private-beta challenge creation.'
  );
  v_challenge_id := (v_challenge ->> 'challengeId')::uuid;
  v_member_detail := public.artisan_member_challenge(
    'f1000000-0000-4000-8000-000000000001','fixture-private-beta-challenge'
  );
  if public.artisan_public_challenge('fixture-private-beta-challenge') <> '{}'::jsonb
     or v_member_detail ->> 'challengeId' <> v_challenge_id::text
     or v_member_detail ->> 'visibility' <> 'private_beta' then
    raise exception 'private-beta member challenge boundary failed: %', v_member_detail;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
  perform pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.create_current_user_challenge_submission(
      gen_random_uuid(),v_challenge_id,'f2000000-0000-4000-8000-000000000007',
      gen_random_uuid(),'fixture-v1',repeat('a',64)
    );
    raise exception 'human-only challenge accepted AI-assisted artwork';
  exception when sqlstate '42501' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
  begin
    perform public.create_current_user_challenge_submission(
      gen_random_uuid(),v_challenge_id,'f2000000-0000-4000-8000-000000000008',
      gen_random_uuid(),'fixture-v1',repeat('a',64)
    );
    raise exception 'adult-only challenge accepted a teen entry';
  exception when sqlstate '42501' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
  v_submission := public.create_current_user_challenge_submission(
    'f3400000-0000-4000-8000-000000000001',v_challenge_id,
    'f2000000-0000-4000-8000-000000000006',
    'f3400000-0000-4000-8000-000000000002','fixture-v1',repeat('a',64)
  );
  v_submission_id := (v_submission ->> 'submissionId')::uuid;
  if (select pg_catalog.count(*) from artisan.submission_media
      where submission_id = v_submission_id) <> 2 then
    raise exception 'challenge draft did not capture all approved artwork media';
  end if;
  begin
    perform public.submit_current_user_challenge_submission(
      v_submission_id,'f3400000-0000-4000-8000-000000000003'
    );
    raise exception 'challenge maximumFiles rule was not enforced atomically';
  exception when sqlstate '55000' then null;
  end;
  delete from artisan.submission_media
  where submission_id = v_submission_id
    and media_asset_id = 'f2200000-0000-4000-8000-000000000007';
  update artisan.challenge_media_rules
  set maximum_width = 50 where challenge_id = v_challenge_id and adapter_key = 'image_static';
  begin
    perform public.submit_current_user_challenge_submission(
      v_submission_id,'f3400000-0000-4000-8000-000000000004'
    );
    raise exception 'challenge maximumWidth rule was not enforced';
  exception when sqlstate '55000' then null;
  end;
  update artisan.challenge_media_rules
  set maximum_width = 200, maximum_duration_seconds = 1
  where challenge_id = v_challenge_id and adapter_key = 'image_static';
  begin
    perform public.submit_current_user_challenge_submission(
      v_submission_id,'f3400000-0000-4000-8000-000000000005'
    );
    raise exception 'challenge measured-duration requirement failed open';
  exception when sqlstate '55000' then null;
  end;
  update artisan.challenge_media_rules
  set maximum_duration_seconds = null, maximum_bytes = 2048
  where challenge_id = v_challenge_id and adapter_key = 'image_static';
  v_submission := public.submit_current_user_challenge_submission(
    v_submission_id,'f3400000-0000-4000-8000-000000000006'
  );
  if v_submission ->> 'status' <> 'pending_review' then
    raise exception 'valid bounded challenge submission did not enter premoderation: %', v_submission;
  end if;
  v_second_submission := public.create_current_user_challenge_submission(
    'f3400000-0000-4000-8000-000000000007',v_challenge_id,
    'f2000000-0000-4000-8000-000000000002',
    'f3400000-0000-4000-8000-000000000008','fixture-v1',repeat('a',64)
  );
  if v_second_submission ->> 'status' <> 'draft'
     or (select pg_catalog.count(*) from artisan.challenge_rule_acceptances
         where challenge_id = v_challenge_id
           and user_id = 'f1000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'multi-entry challenge did not reuse exact frozen rule acceptance: %',
      v_second_submission;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_staff_upsert_challenge(
      'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_challenge_id,
      'fixture-private-beta-challenge','Fixture Private Beta Challenge',
      'Make one carefully bounded impossible image.',
      'Create a synthetic human-made image for atomic eligibility and media-rule tests.',
      'Exercise exact eligibility, immutable terms, media limits, and acceptance reuse.',
      'Changed Sponsor','Artists retain ownership under this exact frozen invitation.',
      'Every reviewer discloses conflicts before accessing eligible entries.',
      'private_beta','Cancellation produces no winner and preserves every artist ownership right.',
      'open',v_opens_at,v_deadline_at,'UTC',2,'curated',false,
      'human_only',v_policy,null,null,'fixture-v1',repeat('a',64),
      array['image_static'],'Synthetic forbidden material-term change.'
    );
    raise exception 'published challenge material terms remained mutable';
  exception when sqlstate '55000' then null;
  end;
end
$challenge_atomic_policy_behavior$;

insert into artisan.forum_posts(
  id, client_request_id, owner_user_id, slug, title, theme,
  status, moderation_status, submitted_at, published_at
)
values (
  'f2300000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f1000000-0000-4000-8000-000000000001','fixture-room','Fixture Room',
  '{"accent":"violet"}'::jsonb,'published','approved',now(),now()
);
insert into artisan.post_artworks(post_id, artwork_id)
values ('f2300000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001');
insert into artisan.comments(
  id, client_request_id, post_id, user_id, body,
  status, moderation_status, published_at
)
values (
  'f2400000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f2300000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',
  'A synthetic reviewed comment.','published','approved',now()
);
insert into artisan.appreciations(user_id, target_type, target_id, client_request_id)
values
  ('f1000000-0000-4000-8000-000000000002','artwork',
    'f2000000-0000-4000-8000-000000000001',gen_random_uuid()),
  ('f1000000-0000-4000-8000-000000000002','post',
    'f2300000-0000-4000-8000-000000000001',gen_random_uuid());

insert into artisan.challenges(
  id, client_request_id, slug, title, short_prompt, full_brief, purpose,
  status, opens_at, deadline_at, rules_document_version, rules_content_sha256,
  published_at, created_by, updated_by
)
values (
  'f2500000-0000-4000-8000-000000000001',gen_random_uuid(),
  'fixture-challenge','Fixture Challenge','Make an impossible color.',
  'Create a synthetic work used only by the disposable database behavior suite.',
  'Exercise challenge, award, and gallery publication boundaries.',
  'open',now()-interval '1 day',now()+interval '1 day','fixture-v1',repeat('a',64),now(),
  'f1000000-0000-4000-8000-000000000008','f1000000-0000-4000-8000-000000000008'
);
insert into artisan.challenge_rule_acceptances(
  id, client_request_id, challenge_id, user_id,
  document_key, document_version, content_sha256
)
values (
  'f2600000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f2500000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
  'challenge_rules_template','fixture-v1',repeat('a',64)
);
insert into artisan.challenge_submissions(
  id, client_request_id, challenge_id, artwork_id, submitter_user_id,
  status, moderation_status, eligibility_status, rule_acceptance_id,
  submitted_at, published_at
)
values (
  'f2700000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f2500000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001','published','approved','eligible',
  'f2600000-0000-4000-8000-000000000001',now(),now()
);
insert into artisan.submission_media(submission_id, media_asset_id)
values ('f2700000-0000-4000-8000-000000000001','f2200000-0000-4000-8000-000000000001');
insert into artisan.challenge_awards(
  id, client_request_id, challenge_id, submission_id, award_type,
  selected_by, selection_reason, winner_license_id,
  status, confirmed_at, published_at
)
values (
  'f2800000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f2500000-0000-4000-8000-000000000001','f2700000-0000-4000-8000-000000000001',
  'winner','f1000000-0000-4000-8000-000000000008',
  'Synthetic selection for bounded gallery behavior.','f2100000-0000-4000-8000-000000000001',
  'published',now(),now()
);
insert into artisan.gallery_entries(
  id, artwork_id, challenge_id, submission_id, award_id,
  gallery_kind, status, frozen_credit_line, frozen_profile_url,
  frozen_creation_method, frozen_license_code, accessible_description, published_at
)
values (
  'f2900000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
  'f2500000-0000-4000-8000-000000000001','f2700000-0000-4000-8000-000000000001',
  'f2800000-0000-4000-8000-000000000001','winner','published','Fixture Adult',
  'https://elysiaecobotics.com/commons-circle/@fixtureadult','human_created',
  'all_rights_reserved','A synthetic gallery entry.',now()
);

update artisan.artworks
set tags = array['impossible','violet']::text[]
where id = 'f2000000-0000-4000-8000-000000000001';
update artisan.forum_posts
set tags = array['corkboard','impossible']::text[]
where id = 'f2300000-0000-4000-8000-000000000001';
do $featured_curation_write_contract$
declare
  v_collection jsonb;
  v_entry jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_collection := public.artisan_staff_upsert_featured_collection(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'fixture-featured','Fixture Featured Artists',
    'A deliberately curated synthetic collection.','published',
    now()-interval '1 hour',null,
    'Synthetic explicit collection curation.'
  );
  v_entry := public.artisan_staff_set_featured_entry(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'fixture-featured','f2900000-0000-4000-8000-000000000001',7,
    now()-interval '1 hour',null,true,
    'Synthetic explicit curation membership.'
  );
  if v_collection ->> 'status' <> 'published'
     or v_entry ->> 'collectionSlug' <> 'fixture-featured'
     or not (v_entry ->> 'enabled')::boolean
     or (v_entry ->> 'displayOrder')::integer <> 7 then
    raise exception 'scoped audited featured curation write drifted: %, %',
      v_collection, v_entry;
  end if;
end
$featured_curation_write_contract$;

do $discovery_tag_write_contract$
declare
  v_result jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_result := public.artisan_set_content_tags(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'artwork','f2000000-0000-4000-8000-000000000002',
    array['zeta','alpha']::text[]
  );
  if v_result -> 'tags' <> '["alpha", "zeta"]'::jsonb
     or v_result ->> 'status' <> 'draft'
     or not (v_result ->> 'requiresReview')::boolean then
    raise exception 'canonical discovery tag write drifted: %', v_result;
  end if;
  v_result := public.artisan_set_content_tags(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'artwork','f2000000-0000-4000-8000-000000000002','{}'::text[]
  );
  if v_result -> 'tags' <> '[]'::jsonb then
    raise exception 'empty discovery tag write drifted: %', v_result;
  end if;
  begin
    perform public.artisan_set_content_tags(
      'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
      'artwork','f2000000-0000-4000-8000-000000000002',
      array['duplicate','duplicate']::text[]
    );
    raise exception 'duplicate discovery tags were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.artisan_set_content_tags(
      'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
      'artwork','f2000000-0000-4000-8000-000000000002',
      array['Uppercase']::text[]
    );
    raise exception 'noncanonical discovery tag was accepted';
  exception when sqlstate '22023' then null;
  end;
end
$discovery_tag_write_contract$;

-- Public projection and strict media presentation contract.
do $public_projection_checks$
declare
  v_artwork jsonb;
  v_media jsonb;
  v_caption jsonb;
  v_card jsonb;
  v_cards jsonb;
  v_commons jsonb;
  v_forum_feed jsonb;
  v_artwork_feed jsonb;
  v_post jsonb;
  v_gallery jsonb;
  v_discovery jsonb;
  v_gallery_discovery jsonb;
  v_challenge_discovery jsonb;
  v_comments jsonb;
  v_featured jsonb;
  v_appreciation jsonb;
  v_member_artwork jsonb;
  v_activity_comments jsonb;
  v_activity_media jsonb;
  v_activity_artworks jsonb;
  v_activity_posts jsonb;
  v_key_count integer;
begin
  select to_jsonb(card) into v_card
  from public.get_public_profile_card('fixtureadult') as card;
  select coalesce(pg_catalog.jsonb_agg(to_jsonb(card)), '[]'::jsonb) into v_cards
  from public.get_public_profile_cards(array[
    'f1000000-0000-4000-8000-000000000001'::uuid
  ]) as card;
  v_commons := public.get_public_commons_profile_presentation('fixtureadult');
  v_forum_feed := public.artisan_public_feed('forum',null,20,null);
  v_artwork_feed := public.artisan_public_feed('artwork',null,20,null);
  v_post := public.artisan_public_post('fixture-room');
  v_gallery := public.artisan_public_gallery('winner',20,null);
  v_artwork := public.artisan_public_artwork('fixture-published-art');
  v_discovery := public.artisan_public_discovery(
    'artwork','fixtureadult',array['impossible']::text[],
    'human_created','image','fixture-challenge','fixture-featured',20,null,null
  );
  v_gallery_discovery := public.artisan_public_gallery_discovery(
    'winner','fixture-challenge',
    pg_catalog.extract(year from pg_catalog.now())::integer,
    'human_created','image','fixtureadult','fixture-featured','newest',20,null,null
  );
  v_challenge_discovery := public.artisan_public_challenge_discovery(20,null,null);
  v_comments := public.artisan_public_post_comments('fixture-room',20,null,null);
  v_featured := public.artisan_public_featured_collection(
    'fixture-featured',20,null,null
  );
  v_appreciation := public.artisan_current_user_appreciation_state(
    'f1000000-0000-4000-8000-000000000001','artwork',
    'f2000000-0000-4000-8000-000000000001'
  );
  v_member_artwork := public.artisan_member_artwork(
    'f1000000-0000-4000-8000-000000000002','fixture-published-art'
  );
  v_activity_comments := public.artisan_member_activity(
    'f1000000-0000-4000-8000-000000000002','comments',20,null,null
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_activity_media := public.artisan_member_activity(
    'f1000000-0000-4000-8000-000000000001','media',20,null,null
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_activity_artworks := public.artisan_member_activity(
    'f1000000-0000-4000-8000-000000000001','artworks',20,null,null
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_activity_posts := public.artisan_member_activity(
    'f1000000-0000-4000-8000-000000000001','posts',20,null,null
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  if v_card -> 'display_name' <> 'null'::jsonb
     or v_card -> 'short_public_bio' <> 'null'::jsonb
     or v_cards -> 0 -> 'display_name' <> 'null'::jsonb
     or v_cards -> 0 -> 'short_public_bio' <> 'null'::jsonb
     or v_commons #> '{profile,displayName}' <> 'null'::jsonb
     or v_commons #> '{profile,shortPublicBio}' <> 'null'::jsonb
     or v_forum_feed #> '{items,0,artist,displayName}' <> 'null'::jsonb
     or v_artwork_feed #> '{items,0,artist,displayName}' <> 'null'::jsonb
     or v_artwork #> '{artist,displayName}' <> 'null'::jsonb
     or v_post #> '{artist,displayName}' <> 'null'::jsonb
     or v_gallery #> '{items,0,artist,displayName}' <> 'null'::jsonb then
    raise exception 'visibility-safe public profile projection drifted: %, %, %, %, %, %, %',
      v_card, v_cards, v_commons, v_forum_feed, v_artwork_feed, v_post, v_gallery;
  end if;
  if v_commons #> '{profile,userId}' is not null
     or pg_catalog.jsonb_typeof(v_commons -> 'isOwner') <> 'boolean'
     or pg_catalog.jsonb_typeof(v_commons -> 'publicBadges') <> 'array'
     or pg_catalog.jsonb_typeof(v_commons -> 'publicSourceCollections') <> 'array'
     or pg_catalog.jsonb_typeof(v_commons -> 'publicCommunePosts') <> 'array'
     or pg_catalog.jsonb_typeof(v_commons -> 'publicCommuneComments') <> 'array' then
    raise exception 'Commons Profile presentation enrichment or UUID boundary drifted: %', v_commons;
  end if;
  if v_artwork ->> 'artworkId' <> 'f2000000-0000-4000-8000-000000000001'
     or pg_catalog.jsonb_array_length(v_artwork -> 'media') <> 1 then
    raise exception 'published artwork projection failed: %', v_artwork;
  end if;
  if v_discovery #>> '{items,0,artworkId}' <> 'f2000000-0000-4000-8000-000000000001'
     or v_gallery_discovery #>> '{items,0,galleryEntryId}' <>
       'f2900000-0000-4000-8000-000000000001'
     or not pg_catalog.jsonb_exists(
       v_gallery_discovery #> '{items,0}', 'artistStatement'
     )
     or v_challenge_discovery #>> '{items,0,challengeId}' <>
       'f2500000-0000-4000-8000-000000000001'
     or v_comments #>> '{items,0,commentId}' <>
       'f2400000-0000-4000-8000-000000000001'
     or v_post #>> '{commentsPage,items,0,commentId}' <>
       'f2400000-0000-4000-8000-000000000001'
     or v_featured #>> '{collection,slug}' <> 'fixture-featured'
     or v_featured #>> '{items,0,galleryEntryId}' <>
       'f2900000-0000-4000-8000-000000000001'
     or (v_featured #>> '{items,0,displayOrder}')::integer <> 7
     or v_featured #>> '{featuredArtists,0,handle}' <> 'fixtureadult'
     or (v_appreciation ->> 'appreciated')::boolean
     or not (v_member_artwork #>> '{currentActor,appreciated}')::boolean
     or v_member_artwork ? 'appreciationCount'
     or v_artwork ? 'appreciationCount'
     or v_post ? 'appreciationCount'
     or (v_discovery #> '{items,0}') ? 'appreciationCount'
     or (v_gallery_discovery #> '{items,0}') ? 'appreciationCount'
     or v_activity_comments #>> '{items,0,commentId}' <>
       'f2400000-0000-4000-8000-000000000001'
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_activity_media -> 'items') as item
       where item ->> 'mediaAssetId' = 'f2200000-0000-4000-8000-000000000001'
     )
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(
         v_activity_artworks -> 'items'
       ) as item
       where item ->> 'artworkId' = 'f2000000-0000-4000-8000-000000000001'
         and (item ->> 'appreciationCount')::integer = 1
     )
     or v_activity_posts #>> '{items,0,postId}' <>
       'f2300000-0000-4000-8000-000000000001'
     or (v_activity_posts #>> '{items,0,appreciationCount}')::integer <> 1
     or (v_discovery::text || v_gallery_discovery::text || v_comments::text ||
         v_featured::text) ~
       'ownerUserId|privateObjectKey|approvedObjectKey|thumbnailObjectKey|checksumSha256' then
    raise exception 'bounded discovery/curation/current-actor projections drifted: %, %, %, %, %, %, %, %, %, %, %',
      v_discovery, v_gallery_discovery, v_challenge_discovery,
      v_comments, v_featured, v_appreciation, v_member_artwork,
      v_activity_comments, v_activity_media,
      v_activity_artworks, v_activity_posts;
  end if;
  begin
    perform public.artisan_member_activity(
      'f1000000-0000-4000-8000-000000000001','artworks',20,now(),null
    );
    raise exception 'half-specified owner activity cursor was accepted';
  exception when sqlstate '22023' then null;
  end;
  v_media := (v_artwork -> 'media') -> 0;
  select pg_catalog.count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_media);
  if v_key_count <> 20
     or v_media ->> 'status' <> 'ready'
     or v_media ->> 'posterPath' <> '/api/public/media/f2200000-0000-4000-8000-000000000001/poster'
     or v_media ? 'captionsPath' or v_media ? 'contentWarnings'
     or v_media ? 'width' or v_media ? 'durationSeconds' then
    raise exception 'PublicMediaPresentation contract drifted: %', v_media;
  end if;
  v_caption := (v_media -> 'captions') -> 0;
  select pg_catalog.count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_caption);
  if v_key_count <> 4
     or v_caption ->> 'path' <> '/api/public/media/f2200000-0000-4000-8000-000000000001/captions/f2250000-0000-4000-8000-000000000001'
     or v_caption ->> 'kind' <> 'captions'
     or v_caption ? 'id' or v_caption ? 'approvedObjectKey' then
    raise exception 'public caption metadata leaked or drifted: %', v_caption;
  end if;
  if pg_catalog.jsonb_array_length(public.artisan_public_challenges(20,null::timestamptz) -> 'items') <> 1
     or pg_catalog.jsonb_array_length(public.artisan_public_gallery('winner',20,null) -> 'items') <> 1 then
    raise exception 'challenge, award, or winner gallery public behavior failed';
  end if;
end
$public_projection_checks$;

-- RLS actor matrix: anonymous sees only reviewed public rows; owners see their
-- own drafts; other members do not; no browser role can read quarantine.
set local role anon;
do $anon_rls$
begin
  if (select pg_catalog.count(*) from public.profile_public_cards
      where handle = 'fixtureadult') <> 1
     or (select pg_catalog.count(*) from public.profile_public_cards
      where handle = 'fixturerestricted') <> 0 then
    raise exception 'anonymous public-profile publication predicate failed';
  end if;
  if (select pg_catalog.count(*) from artisan.artworks
      where id = 'f2000000-0000-4000-8000-000000000001') <> 1
     or (select pg_catalog.count(*) from artisan.artworks
      where id in ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003')) <> 0 then
    raise exception 'anonymous artwork RLS exposed drafts or hid reviewed content';
  end if;
  if has_table_privilege('anon', 'storage.objects', 'select') then
    raise exception 'anonymous storage table privilege exposed private originals or derivatives';
  end if;
end
$anon_rls$;
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $owner_rls$
begin
  if (select pg_catalog.count(*) from artisan.artworks
      where id = 'f2000000-0000-4000-8000-000000000002') <> 1
     or (select pg_catalog.count(*) from artisan.artworks
      where id = 'f2000000-0000-4000-8000-000000000003') <> 0 then
    raise exception 'owner/other draft RLS boundary failed';
  end if;
  if (select pg_catalog.count(*) from storage.objects
      where bucket_id = 'artisan-quarantine') <> 0
     or (select pg_catalog.count(*) from storage.objects
      where bucket_id in ('artisan-approved','artisan-thumbnails')) <> 3 then
    raise exception 'owner storage boundary did not separate quarantine from approved derivatives';
  end if;
end
$owner_rls$;
reset role;

-- Service-only media resolvers return private keys only after publication and
-- the caption resolver preserves provider identity for fail-closed routing.
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
do $service_media_resolvers$
declare
  v_media jsonb;
  v_caption jsonb;
  v_original_retention jsonb;
  v_rejected_retention jsonb;
begin
  v_media := public.artisan_public_media_asset('f2200000-0000-4000-8000-000000000001');
  v_caption := public.artisan_public_caption_asset(
    'f2200000-0000-4000-8000-000000000001',
    'f2250000-0000-4000-8000-000000000001'
  );
  if v_media ->> 'status' <> 'ready'
     or v_media ->> 'approvedObjectKey' is null
     or v_caption ->> 'status' <> 'ready'
     or v_caption ->> 'storageProvider' <> 'supabase'
     or v_caption ->> 'presentationMime' <> 'text/vtt' then
    raise exception 'service media/caption resolver failed closed incorrectly: %, %', v_media, v_caption;
  end if;

  insert into artisan.retention_tasks(
    id, target_type, target_id, action, due_at, status,
    legal_hold_checked_at, attempt_count, claimed_by, claimed_at, lease_expires_at
  ) values (
    'f2260000-0000-4000-8000-000000000001','media_asset',
    'f2200000-0000-4000-8000-000000000001','delete_quarantine_original',now(),
    'processing',now(),1,'fixture-retention-worker',now(),now()+interval '5 minutes'
  ),(
    'f2260000-0000-4000-8000-000000000002','media_asset',
    'f2200000-0000-4000-8000-000000000001','delete_rejected_media',now(),
    'processing',now(),1,'fixture-retention-worker',now(),now()+interval '5 minutes'
  );
  v_original_retention := public.artisan_get_retention_task_asset(
    'fixture-retention-worker','f2260000-0000-4000-8000-000000000001'
  );
  v_rejected_retention := public.artisan_get_retention_task_asset(
    'fixture-retention-worker','f2260000-0000-4000-8000-000000000002'
  );
  if pg_catalog.jsonb_array_length(v_original_retention -> 'objects') <> 2
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_original_retention -> 'objects') as object
       where object ->> 'kind' = 'quarantineCaption'
         and object ->> 'bucket' = 'artisan-quarantine'
         and object ->> 'privateObjectKey' =
           'f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/f2200000-0000-4000-8000-000000000001/captions/f2250000-0000-4000-8000-000000000001.vtt'
     ) or exists (
       select 1 from pg_catalog.jsonb_array_elements(v_original_retention -> 'objects') as object
       where object ->> 'kind' in ('approvedDerivative','thumbnail','caption')
     ) then
    raise exception 'original retention omitted its private caption or escalated to a derivative: %',
      v_original_retention;
  end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_rejected_retention -> 'objects') as object
    where object ->> 'kind' = 'quarantineCaption'
  ) or not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_rejected_retention -> 'objects') as object
    where object ->> 'kind' = 'caption'
  ) then
    raise exception 'full rejected-media retention omitted private or approved captions: %',
      v_rejected_retention;
  end if;
  -- These direct fixture leases exist only to exercise the private resolver;
  -- remove them before later legal-hold behavior tests.
  delete from artisan.retention_tasks
  where id in (
    'f2260000-0000-4000-8000-000000000001',
    'f2260000-0000-4000-8000-000000000002'
  );
end
$service_media_resolvers$;

-- Every cross-person browser mutation resolves a canonical handle internally,
-- returns no auth UUID, and preserves attribution independently of blocking or
-- later profile privacy.
do $handle_contract_behavior$
declare
  v_result jsonb;
  v_list jsonb;
  v_invitation_id uuid;
  v_challenge_id uuid;
  v_credit_request jsonb;
  v_public_artwork jsonb;
  v_owner_artwork jsonb;
  v_owner_post jsonb;
  v_awards jsonb;
  v_rubric jsonb := '{"criteria":[{"key":"craft","label":"Craft","description":"Deliberate execution and material choices.","weight":40,"minimumScore":0,"maximumScore":10},{"key":"imagination","label":"Imagination","description":"Originality and response to the impossible prompt.","weight":35,"minimumScore":0,"maximumScore":10},{"key":"communication","label":"Communication","description":"Clarity, accessibility, and emotional resonance.","weight":25,"minimumScore":0,"maximumScore":10}]}'::jsonb;
  v_score_client_request_id uuid := 'f3200000-0000-4000-8000-000000000001';
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',false);
  if private.recompute_community_participation(
    'f1000000-0000-4000-8000-000000000002'
  ) <> 'adult_eligible' then
    raise exception 'handle fixture collaborator did not become participation eligible';
  end if;
  insert into public.profile_handle_history(
    handle, profile_user_id, replaced_by_handle, redirect_enabled, retired_at
  ) values (
    'fixtureold','f1000000-0000-4000-8000-000000000002',
    'fixtureother',true,now()
  );

  v_result := public.issue_artisan_invitation_by_handle(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    repeat('9',64),'fixtureother',1,now()+interval '7 days',
    'Synthetic targeted invitation issuance.'
  );
  v_invitation_id := (v_result ->> 'invitationId')::uuid;
  if v_result ->> 'targetHandle' <> 'fixtureother'
     or v_result::text ~ 'invitedUserId|invitedEmail|codeSha256' then
    raise exception 'invitation issuance leaked an identity/hash contract: %', v_result;
  end if;
  v_list := public.artisan_staff_list_invitations(
    'f1000000-0000-4000-8000-000000000008','aal2','issued',20,null
  );
  if v_list -> 'items' -> 0 ->> 'targetHandle' <> 'fixtureother'
     or v_list::text ~ 'invitedUserId|invitedEmail|invitationCode|privateReason' then
    raise exception 'invitation list leaked private metadata: %', v_list;
  end if;
  v_result := public.artisan_staff_revoke_invitation(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    v_invitation_id,'Synthetic targeted invitation revocation.'
  );
  if v_result ->> 'status' <> 'revoked' or v_result ? 'targetUserId' then
    raise exception 'invitation revocation contract drifted: %', v_result;
  end if;

  v_result := public.artisan_create_report_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),null,
    'fixtureother','impersonation','Synthetic profile report by public handle.',
    'Disposable details verify the profile UUID remains internal.',true
  );
  if v_result ->> 'targetType' <> 'profile'
     or v_result ->> 'targetHandle' <> 'fixtureother'
     or v_result::text ~ 'targetUserId|profileUserId' then
    raise exception 'profile report leaked a person UUID contract: %', v_result;
  end if;

  v_result := public.artisan_set_block_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'fixtureother',true
  );
  -- Actor-assuming aliases intentionally set authenticated claims for the
  -- nested owner RPC. Model the next independent Worker request explicitly.
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_list := public.artisan_current_user_blocks(
    'f1000000-0000-4000-8000-000000000001',20,null
  );
  if v_result ->> 'targetHandle' <> 'fixtureother'
     or v_result ? 'targetUserId'
     or v_list -> 'items' -> 0 ->> 'targetHandle' <> 'fixtureother'
     or v_list::text ~ 'targetUserId|blockedUserId' then
    raise exception 'handle block/list contract leaked a UUID: %, %', v_result, v_list;
  end if;
  perform public.artisan_set_block_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'fixtureother',false
  );

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_result := public.artisan_invite_collaborator_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000001','fixtureother','illustrator'
  );
  if v_result ->> 'collaboratorHandle' <> 'fixtureother'
     or v_result ->> 'status' <> 'pending' or v_result ? 'collaboratorUserId' then
    raise exception 'collaborator invitation contract drifted: %', v_result;
  end if;
  v_result := public.artisan_respond_collaboration(
    'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000001','accepted'
  );
  if v_result ->> 'status' <> 'accepted' or v_result ? 'userId' then
    raise exception 'collaborator response leaked a UUID: %', v_result;
  end if;
  perform public.artisan_set_block_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'fixtureother',true
  );
  v_public_artwork := public.artisan_public_artwork('fixture-published-art');
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_public_artwork -> 'credits') as credit
    where credit ->> 'creditedName' = 'Fixture Other'
      and credit ->> 'creditedHandle' = 'fixtureother'
      and credit ->> 'profileUrl' = 'https://elysiaecobotics.com/commons-circle/@fixtureother'
  ) then
    raise exception 'blocking erased a legitimate confirmed attribution: %', v_public_artwork -> 'credits';
  end if;
  update public.profile_public_cards set public_profile_enabled = false
  where handle = 'fixtureother';
  v_public_artwork := public.artisan_public_artwork('fixture-published-art');
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_public_artwork -> 'credits') as credit
    where credit ->> 'creditedName' = 'Fixture Other'
      and credit -> 'creditedHandle' = 'null'::jsonb
      and credit -> 'profileUrl' = 'null'::jsonb
  ) then
    raise exception 'private collaborator did not fall back to an unlinked credited name: %', v_public_artwork -> 'credits';
  end if;
  update public.profile_public_cards set public_profile_enabled = true
  where handle = 'fixtureother';
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  perform public.artisan_set_block_by_handle(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'fixtureother',false
  );

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_credit_request := public.artisan_create_credit_correction(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000001','collaborator',
    '{"creditedName":"Fixture Other","creditedHandle":"@fixtureold","role":"illustrator","displayOrder":12}'::jsonb,
    'Synthetic handle-based collaborator correction.'
  );
  v_result := public.artisan_member_credit_correction(
    'f1000000-0000-4000-8000-000000000001',
    (v_credit_request ->> 'requestId')::uuid
  );
  if v_result #>> '{requestedValue,creditedHandle}' <> 'fixtureother'
     or v_result::text ~ 'creditedUserId|requestedCreditedUserId' then
    raise exception 'credit correction failed canonical retired-handle resolution: %', v_result;
  end if;

  begin
    perform public.impose_community_restriction(
      'f1000000-0000-4000-8000-000000000008','aal2','fixtureold',
      gen_random_uuid(),'artisan_posting','read_only','fixture_policy',
      'Synthetic retired-handle restriction rejection.',now()+interval '1 day'
    );
    raise exception 'retired handle was accepted for a new restriction';
  exception when sqlstate '22023' then null;
  end;

  if not private.artisan_judging_rubric_is_valid(
       'blind_rubric','fixture-rubric-v1',v_rubric
     )
     or private.artisan_judging_rubric_is_valid(
       'blind_rubric','fixture-rubric-v1',
       pg_catalog.jsonb_set(v_rubric,'{criteria,0,weight}','39'::jsonb)
     ) then
    raise exception 'bounded judging rubric validation drifted';
  end if;
  v_result := public.artisan_staff_upsert_challenge(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),null,
    'fixture-judging-contract','Fixture Judging Contract',
    'A bounded synthetic judging prompt.','A full synthetic judging brief long enough for validation.',
    'Exercise sponsor, licensing, cancellation, conflict, and blind-review behavior.',
    'Fixture Arts Council','Artists retain ownership under the exact accepted challenge terms.',
    'Every judge must disclose conflicts before receiving any eligible entry.',
    'public','Cancellation produces no winner and preserves every artist ownership right.',
    'judging',now()-interval '2 days',now()-interval '1 day','UTC',1,
    'blind_rubric',true,'all_disclosed_methods','{}'::jsonb,
    'fixture-rubric-v1',v_rubric,
    'fixture-v1',repeat('a',64),array['image_static'],
    'Synthetic challenge contract creation.'
  );
  v_challenge_id := (v_result ->> 'challengeId')::uuid;
  if v_result ->> 'sponsorName' <> 'Fixture Arts Council'
     or v_result ->> 'visibility' <> 'public'
     or v_result ->> 'judgingRubricVersion' <> 'fixture-rubric-v1'
     or public.artisan_public_challenge('fixture-judging-contract') ->> 'cancellationTerms'
       <> 'Cancellation produces no winner and preserves every artist ownership right.'
     or public.artisan_public_challenge('fixture-judging-contract') ->> 'judgingRubricVersion'
       <> 'fixture-rubric-v1'
     or pg_catalog.jsonb_array_length(
       public.artisan_public_challenge('fixture-judging-contract') #> '{judgingRubric,criteria}'
     ) <> 3 then
    raise exception 'challenge sponsor/legal/visibility contract drifted: %', v_result;
  end if;
  insert into artisan.challenge_submissions(
    id, client_request_id, challenge_id, artwork_id, submitter_user_id,
    status, moderation_status, eligibility_status, submitted_at
  ) values (
    'f2700000-0000-4000-8000-000000000002',gen_random_uuid(),
    v_challenge_id,'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'eligible','approved','eligible',now()-interval '12 hours'
  );
  insert into artisan.submission_media(submission_id, media_asset_id, display_order)
  values (
    'f2700000-0000-4000-8000-000000000002',
    'f2200000-0000-4000-8000-000000000001',0
  );
  v_result := public.artisan_staff_assign_judge(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    v_challenge_id,'fixtureother','judge','Synthetic judge assignment by handle.'
  );
  if v_result ->> 'judgeHandle' <> 'fixtureother' or v_result ? 'judgeUserId' then
    raise exception 'judge assignment leaked a UUID: %', v_result;
  end if;
  perform public.artisan_submit_judge_conflict(
    'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
    v_challenge_id,'Synthetic disclosure confirms there is no material conflict.',false
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_result := public.artisan_staff_resolve_judge_conflict(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    v_challenge_id,'fixtureother',true,'Synthetic independent conflict clearance.'
  );
  if v_result ->> 'judgeHandle' <> 'fixtureother' or v_result ? 'judgeUserId' then
    raise exception 'judge conflict resolution leaked a UUID: %', v_result;
  end if;
  v_list := public.artisan_current_user_judging(
    'f1000000-0000-4000-8000-000000000002',20,null
  );
  if v_list -> 'items' -> 0 ->> 'assignmentStatus' <> 'cleared'
     or v_list -> 'items' -> 0 ->> 'judgingRubricVersion' <> 'fixture-rubric-v1'
     or pg_catalog.jsonb_array_length(
       v_list #> '{items,0,judgingRubric,criteria}'
     ) <> 3
     or pg_catalog.jsonb_array_length(v_list #> '{items,0,submissions}') <> 1
     or v_list #> '{items,0,submissions,0,artist}' <> 'null'::jsonb
     or v_list #> '{items,0,submissions,0,artworkTitle}' <> 'null'::jsonb
     or v_list::text ~ 'judgeUserId|submitterUserId|ownerUserId' then
    raise exception 'blind-safe judging activity leaked identity: %', v_list;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_result := public.artisan_submit_challenge_score(
    'f1000000-0000-4000-8000-000000000002',v_score_client_request_id,
    v_challenge_id,'f2700000-0000-4000-8000-000000000002',
    'fixture-rubric-v1',
    '{"criteria":{"craft":8,"imagination":9.5,"communication":7}}'::jsonb,
    'Synthetic rubric score with bounded criterion values.'
  );
  if v_result ->> 'rubricVersion' <> 'fixture-rubric-v1'
     or v_result ->> 'action' <> 'submitted' then
    raise exception 'valid rubric score submission drifted: %', v_result;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_submit_challenge_score(
      'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
      v_challenge_id,'f2700000-0000-4000-8000-000000000002',
      'invented-rubric-v9',
      '{"criteria":{"craft":8,"imagination":9,"communication":7}}'::jsonb,null
    );
    raise exception 'noncanonical rubric version was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_submit_challenge_score(
      'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
      v_challenge_id,'f2700000-0000-4000-8000-000000000002',
      'fixture-rubric-v1','{"criteria":{"craft":8,"imagination":9}}'::jsonb,null
    );
    raise exception 'missing rubric criterion was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_submit_challenge_score(
      'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
      v_challenge_id,'f2700000-0000-4000-8000-000000000002',
      'fixture-rubric-v1',
      '{"criteria":{"craft":8,"imagination":9,"communication":7,"invented":10}}'::jsonb,null
    );
    raise exception 'unknown rubric criterion was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_submit_challenge_score(
      'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
      v_challenge_id,'f2700000-0000-4000-8000-000000000002',
      'fixture-rubric-v1',
      '{"criteria":{"craft":11,"imagination":9,"communication":7}}'::jsonb,null
    );
    raise exception 'out-of-range rubric score was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_submit_challenge_score(
      'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
      v_challenge_id,'f2700000-0000-4000-8000-000000000002',
      'fixture-rubric-v1',
      '{"criteria":{"craft":8,"imagination":"high","communication":7}}'::jsonb,null
    );
    raise exception 'nonnumeric rubric score was accepted';
  exception when sqlstate '22023' then null;
  end;

  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_list := public.artisan_current_user_judging(
    'f1000000-0000-4000-8000-000000000002',20,null
  );
  if v_list #>> '{items,0,submissions,0,score,rubricVersion}' <> 'fixture-rubric-v1'
     or v_list #>> '{items,0,submissions,0,score,score,criteria,craft}' <> '8' then
    raise exception 'judge feed did not project the exact stored rubric score: %', v_list;
  end if;
  v_owner_artwork := public.artisan_owner_artwork_detail(
    'f1000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001'
  );
  v_owner_post := public.artisan_owner_post_detail(
    'f1000000-0000-4000-8000-000000000001',
    'f2300000-0000-4000-8000-000000000001'
  );
  v_awards := public.artisan_current_user_awards(
    'f1000000-0000-4000-8000-000000000001',20,null
  );
  if v_owner_artwork ->> 'artworkId' <> 'f2000000-0000-4000-8000-000000000001'
     or v_owner_post ->> 'postId' <> 'f2300000-0000-4000-8000-000000000001'
     or (v_owner_artwork ->> 'appreciationCount')::integer <> 1
     or (v_owner_post ->> 'appreciationCount')::integer <> 1
     or v_owner_artwork::text ~ 'ownerUserId|creditedUserId|collaboratorUserId|quarantineObjectKey|approvedObjectKey|thumbnailObjectKey'
     or v_owner_post::text ~ 'ownerUserId'
     or v_awards #>> '{items,0,actionPath}' <> '/account/activity?kind=awards'
     or v_awards::text ~ 'submitterUserId|ownerUserId|selectedBy' then
    raise exception 'owner detail or award activity projection drifted: %, %, %',
      v_owner_artwork, v_owner_post, v_awards;
  end if;
end
$handle_contract_behavior$;

-- Provider start/callback exact replay, conflict rejection, successful age
-- reduction, failed guardian non-materialization, and guardian-only resolver.
do $provider_behavior$
declare
  v_first jsonb;
  v_replay jsonb;
  v_callback jsonb;
  v_relationship jsonb;
  v_guardian_start jsonb;
  v_under13_consent_start jsonb;
  v_under13_consent_result jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_guardian_start := public.start_community_guardian_relationship_by_handle(
    'f1000000-0000-4000-8000-000000000006','aal1',
    'f3100000-0000-4000-8000-000000000005','fixture_provider',
    'fixtureteen16','parent',now()+interval '1 year',
    repeat('1',64),repeat('2',64),now()+interval '1 hour',
    'Synthetic handle-only guardian relationship start.'
  );
  if v_guardian_start ->> 'dependentHandle' <> 'fixtureteen16'
     or v_guardian_start::text ~ 'subjectUserId|dependentUserId|guardianUserId' then
    raise exception 'guardian start leaked a person UUID contract: %', v_guardian_start;
  end if;
  v_first := public.start_community_provider_transaction(
    'f1000000-0000-4000-8000-000000000009','aal1',
    'f3100000-0000-4000-8000-000000000001','fixture_provider','age_assurance',
    'f1000000-0000-4000-8000-000000000009',null,null,null,null,null,null,null,null,
    repeat('d',64),repeat('e',64),now()+interval '1 hour','Synthetic age assurance start.'
  );
  v_replay := public.start_community_provider_transaction(
    'f1000000-0000-4000-8000-000000000009','aal1',
    'f3100000-0000-4000-8000-000000000001','fixture_provider','age_assurance',
    'f1000000-0000-4000-8000-000000000009',null,null,null,null,null,null,null,null,
    repeat('d',64),repeat('e',64),now()+interval '1 hour','Synthetic age assurance start.'
  );
  if v_first <> v_replay then raise exception 'provider start exact replay changed'; end if;
  begin
    perform public.start_community_provider_transaction(
      'f1000000-0000-4000-8000-000000000009','aal1',
      'f3100000-0000-4000-8000-000000000001','fixture_provider','age_assurance',
      'f1000000-0000-4000-8000-000000000009',null,null,null,null,null,null,null,null,
      repeat('f',64),repeat('e',64),now()+interval '1 hour','Synthetic age assurance start.'
    );
    raise exception 'provider start idempotency conflict was accepted';
  exception when sqlstate '22000' then null;
  end;
  v_callback := public.consume_community_provider_transaction(
    'f3100000-0000-4000-8000-000000000002','fixture_provider',
    repeat('d',64),repeat('e',64),repeat('f',64),'verified','fixture_age_ok',
    '18_plus','age_verified',now()+interval '1 year','US','Synthetic provider callback.'
  );
  if v_callback ->> 'participationState' <> 'read_only' then
    raise exception 'verified adult callback bypassed exact current terms: %', v_callback;
  end if;
  if public.consume_community_provider_transaction(
    'f3100000-0000-4000-8000-000000000002','fixture_provider',
    repeat('d',64),repeat('e',64),repeat('f',64),'verified','fixture_age_ok',
    '18_plus','age_verified',now()+interval '1 year','US','Synthetic provider callback.'
  ) <> v_callback then raise exception 'provider callback replay changed'; end if;

  perform public.start_community_provider_transaction(
    'f1000000-0000-4000-8000-000000000006','aal1',
    'f3100000-0000-4000-8000-000000000003','fixture_provider','guardian_relationship',
    'f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000006',
    null,'parent',null,null,null,null,now()+interval '1 year',
    repeat('6',64),repeat('7',64),now()+interval '1 hour','Synthetic guardian start.'
  );
  perform public.consume_community_provider_transaction(
    'f3100000-0000-4000-8000-000000000004','fixture_provider',
    repeat('6',64),repeat('7',64),repeat('8',64),'failed','fixture_guardian_failed',
    null,null,null,null,'Synthetic failed guardian callback.'
  );
  if exists (select 1 from private.guardian_relationships where provider_reference_sha256 = repeat('8',64)) then
    raise exception 'failed guardian callback materialized a relationship';
  end if;
  v_under13_consent_start := public.start_community_provider_transaction(
    'f1000000-0000-4000-8000-000000000006','aal2',
    'f3100000-0000-4000-8000-000000000006','fixture_provider','guardian_consent',
    'f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000006',
    'f1100000-0000-4000-8000-000000000005',null,'artisan_notifications',
    'guardian_consent_notice','fixture-v1',repeat('a',64),now()+interval '6 months',
    repeat('0',63)||'1',repeat('0',63)||'2',now()+interval '1 hour',
    'Synthetic exact child privacy provider consent start.'
  );
  if pg_catalog.jsonb_array_length(v_under13_consent_start -> 'legalDocuments') <> 2
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(
         v_under13_consent_start -> 'legalDocuments'
       ) as document
       where document ->> 'documentKey' = 'under13_privacy_notice'
         and document ->> 'documentVersion' = 'fixture-v1'
         and document ->> 'contentSha256' = repeat('a',64)
     ) then
    raise exception 'under-13 provider consent omitted exact child privacy notice: %',
      v_under13_consent_start;
  end if;
  v_under13_consent_result := public.consume_community_provider_transaction(
    'f3100000-0000-4000-8000-000000000007','fixture_provider',
    repeat('0',63)||'1',repeat('0',63)||'2',repeat('0',63)||'3',
    'verified','fixture_under13_consent_ok',null,null,null,null,
    'Synthetic exact child privacy provider consent callback.'
  );
  if v_under13_consent_result ->> 'purpose' <> 'guardian_consent'
     or not exists (
       select 1 from private.guardian_consents as consent
       where consent.dependent_user_id = 'f1000000-0000-4000-8000-000000000005'
         and consent.consent_scope = 'artisan_notifications'
         and consent.status = 'active'
         and consent.document_key = 'guardian_consent_notice'
         and consent.document_version = 'fixture-v1'
         and consent.content_sha256 = repeat('a',64)
         and consent.child_privacy_document_key = 'under13_privacy_notice'
         and consent.child_privacy_document_version = 'fixture-v1'
         and consent.child_privacy_content_sha256 = repeat('a',64)
     ) then
    raise exception 'under-13 provider consent failed exact dual-document binding: %',
      v_under13_consent_result;
  end if;
  v_relationship := public.get_community_guardian_relationship_for_provider(
    'f1000000-0000-4000-8000-000000000006','f1100000-0000-4000-8000-000000000005'
  );
  if v_relationship ->> 'dependentUserId' <> 'f1000000-0000-4000-8000-000000000005'
     or v_relationship ->> 'ageBand' <> 'under_13'
     or pg_catalog.jsonb_array_length(v_relationship -> 'legalDocuments') <> 2
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(
         v_relationship -> 'legalDocuments'
       ) as document
       where document ->> 'documentKey' = 'under13_privacy_notice'
         and document ->> 'documentVersion' = 'fixture-v1'
         and document ->> 'contentSha256' = repeat('a',64)
     )
     or public.get_community_guardian_relationship_for_provider(
       'f1000000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000005'
     ) <> '{}'::jsonb then
    raise exception 'guardian provider relationship resolver exposed the dependent to a non-guardian';
  end if;
end
$provider_behavior$;

-- Guardian revocation must immediately downgrade protected youth, and a new
-- exact current consent must restore eligibility only through the reducer.
do $guardian_revocation_behavior$
declare
  v_state text;
begin
  perform public.revoke_guardian_consent(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f1200000-0000-4000-8000-000000000004','Synthetic guardian consent revocation.'
  );
  select participation_state into v_state from private.account_participation
  where user_id = 'f1000000-0000-4000-8000-000000000004';
  if v_state <> 'teen_pending' then raise exception 'guardian revocation did not downgrade teen: %', v_state; end if;
  perform public.record_guardian_consent(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f1100000-0000-4000-8000-000000000004','artisan_membership',
    'community_terms','fixture-v1',repeat('a',64),now()+interval '1 year',
    'Synthetic guardian consent replacement.'
  );
  select participation_state into v_state from private.account_participation
  where user_id = 'f1000000-0000-4000-8000-000000000004';
  if v_state <> 'teen_eligible' then raise exception 'replacement guardian consent did not restore teen eligibility'; end if;
end
$guardian_revocation_behavior$;

-- AAL/capability separation, reporting, moderation, independent appeal review,
-- and non-automatic restoration.
do $moderation_appeal_behavior$
declare
  v_report jsonb;
  v_triage jsonb;
  v_case_id uuid;
  v_action jsonb;
  v_appeal jsonb;
  v_assignment jsonb;
  v_status text;
begin
  begin
    perform public.artisan_staff_work_queue(
      'f1000000-0000-4000-8000-000000000008','aal1','reports',20,null
    );
    raise exception 'AAL1 staff queue read was accepted';
  exception when sqlstate '42501' then null;
  end;
  v_report := public.artisan_create_report(
    'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),null,
    'post','f2300000-0000-4000-8000-000000000001','stolen_art',
    'Synthetic stolen-art report.','Disposable evidence summary.',true
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_triage := public.artisan_staff_triage_report(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    (v_report ->> 'reportId')::uuid,'open_case','stolen_art','high',
    'fixtureadult',
    'Synthetic case opened for independent review.','Synthetic report triage reason.'
  );
  v_case_id := (v_triage ->> 'caseId')::uuid;
  v_assignment := public.artisan_staff_assign_case(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    v_case_id,'fixtureappeals','appeal_reviewer',
    'Synthetic independent appeal-review assignment by handle.'
  );
  if v_assignment ->> 'assignedHandle' <> 'fixtureappeals'
     or v_assignment ? 'assignedUserId' then
    raise exception 'case assignment leaked a person UUID contract: %', v_assignment;
  end if;
  v_action := public.artisan_staff_moderate(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    v_case_id,'remove','post','f2300000-0000-4000-8000-000000000001',
    'stolen_art','Synthetic removal pending appeal.','The work was removed pending review.'
  );
  v_appeal := public.artisan_create_appeal(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),v_case_id,null,
    (v_action ->> 'moderationActionId')::uuid,
    'This synthetic appeal contains enough detail for independent review.'
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.artisan_staff_decide_appeal(
      'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
      (v_appeal ->> 'appealId')::uuid,'granted',
      'Original case actor must not review this appeal.','The appeal was reviewed independently.'
    );
    raise exception 'original case actor reviewed its own appeal';
  exception when sqlstate '42501' then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  perform public.artisan_staff_decide_appeal(
    'f1000000-0000-4000-8000-00000000000a','aal2',gen_random_uuid(),
    (v_appeal ->> 'appealId')::uuid,'granted',
    'Independent reviewer granted the synthetic appeal.','The appeal was granted after independent review.'
  );
  perform public.artisan_staff_restore_after_appeal(
    'f1000000-0000-4000-8000-00000000000b','aal2',gen_random_uuid(),
    (v_appeal ->> 'appealId')::uuid,'post','f2300000-0000-4000-8000-000000000001',
    'Separate publication reviewer staged restoration.','The work is eligible for a new publication review.'
  );
  select status into v_status from artisan.forum_posts
  where id = 'f2300000-0000-4000-8000-000000000001';
  if v_status <> 'approved' then raise exception 'appeal restoration auto-published or failed: %', v_status; end if;
end
$moderation_appeal_behavior$;

-- Attribution correction is member-created, independently decided, auditable,
-- and propagated to frozen gallery credit without granting AI-training rights.
do $credit_behavior$
declare
  v_request jsonb;
  v_status jsonb;
  v_credit_line text;
begin
  v_request := public.artisan_create_credit_correction(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'f2000000-0000-4000-8000-000000000001','credit_line',
    '{"creditLine":"Fixture Adult — corrected"}'::jsonb,
    'Synthetic evidence for a credit correction.'
  );
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  perform public.artisan_staff_decide_credit_correction(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    (v_request ->> 'requestId')::uuid,'approved',
    'Synthetic independent credit correction approval.'
  );
  v_status := public.artisan_member_credit_correction(
    'f1000000-0000-4000-8000-000000000001',(v_request ->> 'requestId')::uuid
  );
  select credit_line into v_credit_line from artisan.artworks
  where id = 'f2000000-0000-4000-8000-000000000001';
  if v_status ->> 'status' <> 'approved' or v_credit_line <> 'Fixture Adult — corrected'
     or not exists (select 1 from artisan.gallery_entries
       where artwork_id = 'f2000000-0000-4000-8000-000000000001'
         and frozen_credit_line = 'Fixture Adult — corrected') then
    raise exception 'credit correction did not apply atomically: %, %', v_status, v_credit_line;
  end if;
end
$credit_behavior$;

select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

-- Copyright workflow records encrypted claimant material privately, imposes a
-- hold, stages takedown, records counter-notice evidence, and never auto-
-- republishes after restoration.
do $dmca_behavior$
declare
  v_case jsonb;
  v_case_id uuid;
  v_status text;
begin
  v_case := public.artisan_staff_create_dmca_case(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'fixture-dmca-0001','artwork','f2000000-0000-4000-8000-000000000001',
    repeat('ciphertext.',4),repeat('5',64),'Synthetic encrypted DMCA intake.'
  );
  v_case_id := (v_case ->> 'dmcaCaseId')::uuid;
  perform public.artisan_staff_record_dmca_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_case_id,
    'begin_validation',null,null,'Synthetic notice validation started.'
  );
  perform public.artisan_staff_record_dmca_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_case_id,
    'takedown',null,repeat('6',64),'Synthetic legal takedown decision.'
  );
  select status into v_status from artisan.artworks where id = 'f2000000-0000-4000-8000-000000000001';
  if v_status <> 'removed' then raise exception 'DMCA takedown did not hide the work'; end if;
  perform public.artisan_staff_record_dmca_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_case_id,
    'counter_notice',repeat('7',64),repeat('8',64),'Synthetic counter-notice recorded.'
  );
  perform public.artisan_staff_record_dmca_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_case_id,
    'begin_waiting_period',null,null,'Synthetic waiting period started.'
  );
  perform public.artisan_staff_record_dmca_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),v_case_id,
    'restore',null,repeat('9',64),'Synthetic legally reviewed restoration.'
  );
  select status into v_status from artisan.artworks where id = 'f2000000-0000-4000-8000-000000000001';
  if v_status <> 'approved' then raise exception 'DMCA restoration auto-published or failed: %', v_status; end if;
end
$dmca_behavior$;

-- Notification delivery is leased, evidence-backed, externally-email-gated,
-- and read state can never cross the authenticated owner boundary.
insert into artisan.notifications(
  id, delivery_key, user_id, notification_type, title, body, action_path
)
values (
  'f5000000-0000-4000-8000-000000000001','fixture-delivery-success-0001',
  'f1000000-0000-4000-8000-000000000001','system',
  'Synthetic delivery job','Disposable delivery body.','/account/notifications'
),(
  'f5000000-0000-4000-8000-000000000002','fixture-delivery-failure-0002',
  'f1000000-0000-4000-8000-000000000001','system',
  'Synthetic retry job','Disposable retry body.','/account/notifications'
);

do $notification_delivery_behavior$
declare
  v_claim jsonb;
  v_item jsonb;
  v_read jsonb;
  v_failure jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_claim := public.artisan_claim_notification_delivery_jobs('fixture-notify-worker',50,300);
  select item.value into v_item
  from pg_catalog.jsonb_array_elements(v_claim -> 'items') as item(value)
  where item.value ->> 'notificationId' = 'f5000000-0000-4000-8000-000000000001';
  if v_item is null or (v_item ->> 'emailDeliveryAllowed')::boolean then
    raise exception 'default-off notification delivery claim drifted: %', v_claim;
  end if;
  perform public.artisan_complete_notification_delivery(
    gen_random_uuid(),'fixture-notify-worker',
    'f5000000-0000-4000-8000-000000000001',repeat('5',64)
  );
  v_read := public.artisan_mark_notifications_read(
    'f1000000-0000-4000-8000-000000000001',gen_random_uuid(),
    'f5000000-0000-4000-8000-000000000001'
  );
  if (v_read ->> 'markedCount')::integer <> 1 then
    raise exception 'notification owner mark-read failed: %', v_read;
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_read := public.artisan_mark_notifications_read(
    'f1000000-0000-4000-8000-000000000002',gen_random_uuid(),
    'f5000000-0000-4000-8000-000000000001'
  );
  if (v_read ->> 'markedCount')::integer <> 0 then
    raise exception 'cross-user notification mark-read was accepted';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_failure := public.artisan_fail_notification_delivery(
    gen_random_uuid(),'fixture-notify-worker',
    'f5000000-0000-4000-8000-000000000002','fixture_transient_failure',
    repeat('6',64),60
  );
  if v_failure ->> 'status' <> 'failed'
     or not exists (select 1 from artisan.notifications
       where id = 'f5000000-0000-4000-8000-000000000002'
         and last_error_evidence_sha256 = repeat('6',64)) then
    raise exception 'notification failure/retry evidence was not persisted: %', v_failure;
  end if;
end
$notification_delivery_behavior$;

select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

-- Account export and deletion worker lifecycle: AAL2 claim, exact artifact,
-- inventory/cleanup/auth-soft-delete handoff, and final deactivation.
insert into private.account_lifecycle_requests(
  id, client_request_id, user_id, action, status, notice_version,
  cooling_period_ends_at
)
values (
  'f4000000-0000-4000-8000-000000000001',gen_random_uuid(),
  'f1000000-0000-4000-8000-000000000001','data_export','submitted','fixture-v1',null
),(
  'f4000000-0000-4000-8000-000000000002',gen_random_uuid(),
  'f1000000-0000-4000-8000-000000000002','account_deletion','operator_review','fixture-v1',
  now() - interval '1 day'
);

do $lifecycle_behavior$
declare
  v_queue jsonb;
  v_export jsonb;
  v_export_status jsonb;
  v_snapshot jsonb;
  v_expires_at timestamptz := now() + interval '1 day';
  v_state text;
begin
  begin
    perform public.claim_community_lifecycle_work(
      'f1000000-0000-4000-8000-000000000008','aal1',gen_random_uuid(),10,
      'Synthetic lifecycle claim denial.'
    );
    raise exception 'AAL1 lifecycle claim was accepted';
  exception when sqlstate '42501' then null;
  end;
  v_queue := public.claim_community_lifecycle_work(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),10,
    'Synthetic lifecycle queue claim.'
  );
  if pg_catalog.jsonb_array_length(v_queue -> 'items') <> 1 then
    raise exception 'lifecycle queue claim omitted pending work: %', v_queue;
  end if;
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000001','operator_review',null,null,
    'Synthetic export operator review.'
  );
  v_queue := public.claim_community_lifecycle_work(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),10,
    'Synthetic export lifecycle claim.'
  );
  if pg_catalog.jsonb_array_length(v_queue -> 'items') <> 1
     or (v_queue -> 'items' -> 0 ->> 'requestId') <> 'f4000000-0000-4000-8000-000000000001' then
    raise exception 'export lifecycle claim was not exact: %', v_queue;
  end if;
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000001','processing',null,null,
    'Synthetic export processing.'
  );
  v_snapshot := public.get_community_export_snapshot(
    'f1000000-0000-4000-8000-000000000008','aal2',
    'f4000000-0000-4000-8000-000000000001','profile',25,null
  );
  if v_snapshot ->> 'snapshotVersion' <> 'community-account-export-v2'
     or v_snapshot -> 'items' -> 0 ->> 'id' <> 'f1000000-0000-4000-8000-000000000001'
     or (v_snapshot::text ~ 'private_object_key') then
    raise exception 'bounded export snapshot leaked or drifted: %', v_snapshot;
  end if;
  v_export := public.record_community_export_artifact(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000001',
    'exports/f4000000-0000-4000-8000-000000000001/f4100000-0000-4000-8000-000000000001.json',
    repeat('a',64),4096,'application/json',v_expires_at,
    'Synthetic private export artifact recorded.'
  );
  if v_export ->> 'downloadPath'
       <> '/api/identity/v1/account/exports/' || (v_export ->> 'artifactId') then
    raise exception 'export artifact exposed the wrong download boundary: %', v_export;
  end if;
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000001','completed',repeat('a',64),v_expires_at,
    'Synthetic export artifact completed.'
  );
  if not exists (select 1 from private.account_lifecycle_requests
    where id = 'f4000000-0000-4000-8000-000000000001'
      and status = 'completed' and export_artifact_sha256 = repeat('a',64)) then
    raise exception 'data export completed without its exact artifact contract';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
  perform pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
  v_export_status := public.current_user_community_export_status(
    'f4000000-0000-4000-8000-000000000001'
  );
  if v_export_status ->> 'downloadPath'
       <> '/api/identity/v1/account/exports/' || (v_export_status ->> 'artifactId')
     or v_export_status ? 'privateObjectKey' then
    raise exception 'owner export status exposed a private key or wrong route: %', v_export_status;
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);

  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','processing',null,null,
    'Synthetic deletion processing.'
  );
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','storage_inventory',null,null,
    'Synthetic deletion inventory.'
  );
  perform public.record_community_deletion_handoff(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','storage_inventory_completed',
    repeat('1',64),'preserve_public_credit_anonymize_account',0,null,
    'Synthetic inventory completed.'
  );
  v_queue := public.enqueue_artisan_account_cleanup(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002'
  );
  if v_queue ->> 'status' <> 'completed'
     or (v_queue ->> 'expectedAssetCount')::integer <> 0
     or v_queue ? 'privateObjectKey' then
    raise exception 'zero-asset Artisan cleanup handshake failed or leaked a key: %', v_queue;
  end if;
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','storage_cleanup',null,null,
    'Synthetic deletion cleanup.'
  );
  perform public.record_community_deletion_handoff(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','storage_cleanup_completed',
    repeat('2',64),null,null,null,'Synthetic cleanup completed.'
  );
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','auth_deletion_ready',null,null,
    'Synthetic auth deletion handoff ready.'
  );
  perform public.record_community_deletion_handoff(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','auth_deletion_requested',
    repeat('3',64),null,null,null,'Synthetic Auth soft-delete requested.'
  );
  perform public.record_community_deletion_handoff(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','auth_deletion_confirmed',
    repeat('4',64),null,null,repeat('b',64),'Synthetic Auth soft-delete confirmed.'
  );
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','auth_deletion_confirmed',null,null,
    'Synthetic auth deletion confirmation transition.'
  );
  perform public.transition_community_lifecycle_action(
    'f1000000-0000-4000-8000-000000000008','aal2',gen_random_uuid(),
    'f4000000-0000-4000-8000-000000000002','completed',null,null,
    'Synthetic account deletion completed.'
  );
  select participation_state into v_state from private.account_participation
  where user_id = 'f1000000-0000-4000-8000-000000000002';
  if v_state <> 'deactivated' or exists (select 1 from public.profile_public_cards
    where user_id = 'f1000000-0000-4000-8000-000000000002' and public_profile_enabled) then
    raise exception 'account deletion failed to disable public participation: %', v_state;
  end if;
end
$lifecycle_behavior$;

-- Restrictions remain server enforced and lifting them delegates to the
-- canonical reducer rather than guessing a youth/adult state.
do $restriction_behavior$
declare
  v_result jsonb;
  v_restriction_id uuid;
  v_state text;
begin
  v_result := public.impose_community_restriction(
    'f1000000-0000-4000-8000-000000000008','aal2',
    'fixtureteen16',gen_random_uuid(),
    'artisan_posting','suspended','fixture_policy',
    'Synthetic scoped participation restriction.',now()+interval '1 day'
  );
  v_restriction_id := (v_result ->> 'restrictionId')::uuid;
  if private.community_can_participate('f1000000-0000-4000-8000-000000000003','artisan_post') then
    raise exception 'active restriction permitted teen posting';
  end if;
  perform public.lift_community_restriction(
    'f1000000-0000-4000-8000-000000000008','aal2',v_restriction_id,
    gen_random_uuid(),'Synthetic scoped restriction lifted.'
  );
  select participation_state into v_state from private.account_participation
  where user_id = 'f1000000-0000-4000-8000-000000000003';
  if v_state <> 'teen_eligible' then
    raise exception 'restriction lift bypassed or failed canonical recomputation: %', v_state;
  end if;
end
$restriction_behavior$;

-- Immutable audit/history must reject mutation even for the migration actor.
do $append_only_behavior$
begin
  begin
    update private.community_audit_events set action = 'tampered_event'
    where id = (select id from private.community_audit_events limit 1);
    raise exception 'immutable community audit accepted an update';
  exception when sqlstate '55000' then null;
  end;
  if exists (
    select 1 from public.artisan_public_artwork('fixture-published-art') as impossible
  ) then
    -- The work is intentionally only approved after the DMCA restoration. The
    -- public projection must now be empty until a separate publication review.
    if public.artisan_public_artwork('fixture-published-art') <> '{}'::jsonb then
      raise exception 'restoration accidentally republished content';
    end if;
  end if;
end
$append_only_behavior$;

rollback;

\echo 'Artisan database behavior checks ok.'

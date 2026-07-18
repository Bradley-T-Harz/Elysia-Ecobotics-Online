-- Shared public identity and community-governance foundation for Elysia Online
-- and the separate Artisan origin. Protected state remains in private; browser
-- callers receive only bounded projections. Every participation feature starts
-- fail-closed until legal, provider, staffing, and hosted-service gates pass.

begin;

create schema if not exists private;
alter schema private owner to postgres;
revoke all on schema private from public, anon, authenticated;

create or replace function private.community_caller_is_service_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role'
    or pg_catalog.current_setting('role', true) = 'service_role',
    false
  );
$$;

alter function private.community_caller_is_service_role() owner to postgres;
revoke all privileges on function private.community_caller_is_service_role()
  from public, anon, authenticated, service_role;

create or replace function private.community_history_is_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'community_history_is_append_only';
end;
$$;

alter function private.community_history_is_append_only() owner to postgres;
revoke all privileges on function private.community_history_is_append_only()
  from public, anon, authenticated, service_role;

create table private.community_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  capability text,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason_code text,
  private_reason text,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint community_audit_actor_kind_check
    check (actor_kind in ('user', 'guardian', 'staff', 'service', 'provider', 'system')),
  constraint community_audit_action_check
    check (action ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint community_audit_target_type_check
    check (target_type ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint community_audit_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  constraint community_audit_reason_check
    check (private_reason is null or pg_catalog.char_length(private_reason) between 8 and 2000)
);

create unique index community_audit_request_action_idx
  on private.community_audit_events(request_id, action)
  where request_id is not null;
create index community_audit_target_created_idx
  on private.community_audit_events(target_type, target_id, created_at desc);

create trigger community_audit_events_are_append_only
before update or delete on private.community_audit_events
for each row execute function private.community_history_is_append_only();

-- Shared request ledger for every request-ID mutation. The normalized payload
-- is private, so replays can be compared exactly without logging sensitive
-- values in public responses. `_begin` serializes concurrent attempts; `_finish`
-- stores the stable response returned by an exact replay.
create table private.community_idempotency_keys (
  client_request_id uuid primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  normalized_payload jsonb not null,
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint community_idempotency_action_check
    check (action ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint community_idempotency_payload_check
    check (pg_catalog.jsonb_typeof(normalized_payload) = 'object'),
  constraint community_idempotency_response_check
    check (response is null or pg_catalog.jsonb_typeof(response) = 'object'),
  constraint community_idempotency_completion_check
    check ((response is null and completed_at is null) or (response is not null and completed_at is not null))
);

alter table private.community_idempotency_keys owner to postgres;
alter table private.community_idempotency_keys enable row level security;
revoke all on private.community_idempotency_keys from public, anon, authenticated, service_role;

create or replace function private.community_idempotency_begin(
  p_client_request_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_normalized_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean := false;
  v_key private.community_idempotency_keys%rowtype;
begin
  if p_client_request_id is null
     or p_action !~ '^[a-z][a-z0-9_]{2,100}$'
     or pg_catalog.jsonb_typeof(p_normalized_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'community_idempotency_invalid';
  end if;
  insert into private.community_idempotency_keys(
    client_request_id, actor_user_id, action, normalized_payload
  ) values (
    p_client_request_id, p_actor_user_id, p_action, p_normalized_payload
  )
  on conflict (client_request_id) do nothing
  returning true into v_inserted;

  select * into strict v_key
  from private.community_idempotency_keys
  where client_request_id = p_client_request_id
  for update;

  if v_key.actor_user_id is distinct from p_actor_user_id
     or v_key.action <> p_action
     or v_key.normalized_payload <> p_normalized_payload then
    raise exception using errcode = '22000', message = 'community_idempotency_conflict';
  end if;
  if not coalesce(v_inserted, false) then
    if v_key.response is null then
      raise exception using errcode = '55000', message = 'community_idempotency_in_progress';
    end if;
    return v_key.response;
  end if;
  return null;
end;
$$;

alter function private.community_idempotency_begin(uuid, uuid, text, jsonb) owner to postgres;
revoke all privileges on function private.community_idempotency_begin(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.community_idempotency_finish(
  p_client_request_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_response) <> 'object' then
    raise exception using errcode = '22023', message = 'community_idempotency_response_invalid';
  end if;
  update private.community_idempotency_keys
  set response = p_response, completed_at = pg_catalog.now()
  where client_request_id = p_client_request_id and response is null;
  if not found then
    raise exception using errcode = '55000', message = 'community_idempotency_not_reserved';
  end if;
  return p_response;
end;
$$;

alter function private.community_idempotency_finish(uuid, jsonb) owner to postgres;
revoke all privileges on function private.community_idempotency_finish(uuid, jsonb)
  from public, anon, authenticated, service_role;

create table private.community_feature_flags (
  feature_key text primary key,
  enabled boolean not null default false,
  reason text not null,
  external_prerequisites text[] not null default '{}'::text[],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint community_feature_key_check
    check (feature_key ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint community_feature_reason_check
    check (pg_catalog.char_length(reason) between 8 and 1000)
);

create table private.community_feature_flag_actions (
  client_request_id uuid primary key,
  feature_key text not null references private.community_feature_flags(feature_key) on delete restrict,
  enabled boolean not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_aal text not null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint community_feature_action_aal_check check (actor_aal = 'aal2'),
  constraint community_feature_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

insert into private.community_feature_flags(feature_key, enabled, reason, external_prerequisites)
values
  ('artisan_adult_closed_beta', false, 'Requires explicit production activation after hosted RLS, moderation, legal, and operational verification.', array['hosted_supabase_reconciliation','legal_approval','trained_moderation_staff','media_pipeline_verified']),
  ('artisan_teen_participation', false, 'Teen participation remains unavailable until legal and operational youth-safety gates are complete.', array['legal_approval','teen_privacy_review','trained_child_safety_staff','provider_configuration']),
  ('artisan_teen_public_profiles', false, 'Teen public Commons Profiles remain unavailable until the conservative profile-publication policy and guardian-consent operations are approved.', array['legal_approval','teen_privacy_review','guardian_provider_contract','trained_child_safety_staff']),
  ('artisan_under13_participation', false, 'Under-thirteen participation requires a separately approved verifiable guardian-consent product and remains unavailable.', array['coppa_review','guardian_provider_contract','parent_notice_approval','trained_child_safety_staff']),
  ('artisan_under13_public_profiles', false, 'Under-thirteen public Commons Profiles are an independently gated capability and remain unavailable by default.', array['coppa_review','guardian_provider_contract','parent_notice_approval','trained_child_safety_staff']),
  ('artisan_under13_posting', false, 'Under-thirteen artwork and room posting is independently gated and remains unavailable by default.', array['coppa_review','guardian_provider_contract','trained_child_safety_staff','posting_controls_verified']),
  ('artisan_under13_commenting', false, 'Under-thirteen commenting is independently gated and remains unavailable by default.', array['coppa_review','guardian_provider_contract','trained_child_safety_staff','comment_controls_verified']),
  ('artisan_under13_appreciation', false, 'Under-thirteen appreciation reactions are independently gated and remain unavailable by default.', array['coppa_review','guardian_provider_contract','privacy_review']),
  ('artisan_under13_media', false, 'Under-thirteen media uploads are independently gated and remain unavailable by default.', array['coppa_review','guardian_provider_contract','media_pipeline_verified','trained_child_safety_staff']),
  ('artisan_under13_challenges', false, 'Under-thirteen challenge submissions are independently gated and remain unavailable by default.', array['coppa_review','guardian_provider_contract','challenge_review','trained_child_safety_staff']),
  ('artisan_guardian_sponsored_accounts', false, 'Guardian-sponsored account onboarding remains unavailable until the approved identity and verifiable-parental-consent provider flow is configured.', array['coppa_review','guardian_provider_contract','identity_provider_configuration','parent_notice_approval']),
  ('artisan_under13_content_approval', false, 'Per-content guardian approval for under-thirteen participants remains unavailable until the review workflow and staffing model are operationally verified.', array['coppa_review','guardian_provider_contract','content_review_runbook','trained_child_safety_staff']),
  ('artisan_guardian_dependent_profile_controls', false, 'Guardian controls for a dependent public Commons Profile remain unavailable until the dependent-notice and revocation experience is approved.', array['coppa_review','guardian_provider_contract','dependent_notice_approval','privacy_review']),
  ('artisan_guardian_dependent_lifecycle', false, 'Guardian-initiated dependent export and deletion requests remain unavailable until identity verification and lifecycle operations are approved.', array['coppa_review','guardian_provider_contract','identity_verification_runbook','deletion_runbook']),
  ('artisan_audio_media', false, 'Audio remains unavailable until validation, metadata removal, preview, transcript, moderation, and retention paths are verified.', array['audio_processor_verified','accessibility_review','moderation_review']),
  ('artisan_short_video_media', false, 'Video remains unavailable until codec validation, transcoding, flash analysis, captions, moderation, and retention paths are verified.', array['video_processor_verified','flash_analysis_verified','accessibility_review','moderation_review']),
  ('artisan_document_media', false, 'Documents remain unavailable until sanitizer, metadata removal, safe preview, accessibility, and moderation paths are verified.', array['document_sanitizer_verified','accessibility_review','moderation_review']),
  ('artisan_animation_media', false, 'Animation remains unavailable until validated preview, flash controls, accessibility, and moderation paths are verified.', array['animation_processor_verified','flash_analysis_verified','accessibility_review']),
  ('artisan_3d_media', false, 'Three-dimensional media remains unavailable until format, resource, viewer, preview, and accessibility controls are verified.', array['model_processor_verified','sandbox_review','accessibility_review']),
  ('artisan_interactive_media', false, 'Interactive work remains unavailable until a no-network declarative sandbox and resource enforcement are verified.', array['interactive_sandbox_verified','security_review','accessibility_review']),
  ('artisan_external_email_notifications', false, 'External email delivery remains unavailable until a transactional provider, sender authentication, privacy review, and unsubscribe operations are verified.', array['email_provider_configured','sender_domain_verified','privacy_review','unsubscribe_runbook_verified']),
  ('artisan_public_database_reads', false, 'Database-backed public Artisan content remains unavailable until the hosted schema and publication pipeline are verified.', array['hosted_supabase_reconciliation','production_content_review'])
on conflict (feature_key) do nothing;

create trigger community_feature_flag_actions_are_append_only
before update or delete on private.community_feature_flag_actions
for each row execute function private.community_history_is_append_only();

create table private.community_legal_document_versions (
  document_key text not null,
  document_version text not null,
  public_path text not null,
  content_sha256 text not null,
  status text not null default 'draft',
  effective_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (document_key, document_version),
  constraint community_legal_key_check
    check (document_key ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint community_legal_version_check
    check (pg_catalog.char_length(document_version) between 1 and 120),
  constraint community_legal_path_check
    check (public_path ~ '^/[A-Za-z0-9/_?&=.%:-]*$'),
  constraint community_legal_hash_check
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint community_legal_status_check
    check (status in ('draft', 'approved', 'retired')),
  constraint community_legal_approval_check
    check ((status = 'draft' and approved_by is null and effective_at is null)
      or (status in ('approved', 'retired') and approved_by is not null and effective_at is not null))
);

create table private.community_active_legal_documents (
  document_key text primary key,
  document_version text not null,
  activated_at timestamptz not null default now(),
  activated_by uuid not null references auth.users(id) on delete restrict,
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict
);

create table private.community_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null,
  accepted_origin text not null,
  accepted_at timestamptz not null default now(),
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  constraint community_terms_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint community_terms_origin_check check (
    accepted_origin in (
      'https://elysiaecobotics.com',
      'https://elysiaartisancollective.pages.dev',
      'https://artisans.elysiaecobotics.com',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174'
    )
  ),
  unique (client_request_id, document_key)
);

create unique index community_terms_user_document_version_idx
  on private.community_terms_acceptances(user_id, document_key, document_version);

create trigger community_legal_document_versions_are_append_only
before update or delete on private.community_legal_document_versions
for each row execute function private.community_history_is_append_only();
create trigger community_terms_acceptances_are_append_only
before update or delete on private.community_terms_acceptances
for each row execute function private.community_history_is_append_only();

create table private.account_participation (
  user_id uuid primary key references auth.users(id) on delete restrict,
  participation_state text not null default 'read_only',
  age_band text not null default 'unknown',
  assurance_status text not null default 'not_collected',
  assurance_method text,
  assurance_provider text,
  jurisdiction_code text,
  assurance_expires_at timestamptz,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_participation_state_check check (
    participation_state in (
      'read_only', 'adult_eligible', 'teen_pending', 'teen_eligible',
      'under13_pending', 'under13_eligible', 'restricted', 'suspended', 'blocked',
      'deletion_pending', 'deactivated'
    )
  ),
  constraint account_participation_age_band_check check (
    age_band in ('unknown', 'under_13', '13_to_15', '16_to_17', '18_plus')
  ),
  constraint account_participation_assurance_check check (
    assurance_status in (
      'not_collected', 'self_attested', 'age_estimated', 'age_verified',
      'guardian_verified', 'verification_expired', 'restricted', 'blocked'
    )
  ),
  constraint account_participation_method_check check (
    assurance_method is null
    or assurance_method in ('self_attestation', 'age_estimation', 'provider_age_check', 'guardian_provider', 'manual_legal_review')
  ),
  constraint account_participation_jurisdiction_check check (
    jurisdiction_code is null or jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
  )
);

create table private.age_assurance_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_reference_sha256 text not null,
  age_band text not null,
  assurance_status text not null,
  jurisdiction_code text,
  expires_at timestamptz,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint age_event_provider_check check (provider ~ '^[a-z][a-z0-9_-]{1,80}$'),
  constraint age_event_reference_check check (provider_reference_sha256 ~ '^[0-9a-f]{64}$'),
  constraint age_event_band_check check (age_band in ('unknown', 'under_13', '13_to_15', '16_to_17', '18_plus')),
  constraint age_event_status_check check (
    assurance_status in ('self_attested', 'age_estimated', 'age_verified', 'guardian_verified', 'verification_expired', 'restricted', 'blocked')
  ),
  constraint age_event_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create trigger age_assurance_events_are_append_only
before update or delete on private.age_assurance_events
for each row execute function private.community_history_is_append_only();

create table private.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  guardian_user_id uuid not null references auth.users(id) on delete restrict,
  dependent_user_id uuid not null references auth.users(id) on delete restrict,
  relationship_type text not null,
  status text not null default 'pending_verification',
  verification_provider text not null,
  provider_reference_sha256 text not null,
  verified_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_relationship_distinct_users_check check (guardian_user_id <> dependent_user_id),
  constraint guardian_relationship_type_check check (relationship_type in ('parent', 'legal_guardian', 'court_authorized_guardian')),
  constraint guardian_relationship_status_check check (status in ('pending_verification', 'active', 'expired', 'revoked', 'disputed', 'rejected')),
  constraint guardian_relationship_provider_check check (verification_provider ~ '^[a-z][a-z0-9_-]{1,80}$'),
  constraint guardian_relationship_reference_check check (provider_reference_sha256 ~ '^[0-9a-f]{64}$'),
  constraint guardian_relationship_revocation_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by is not null and pg_catalog.char_length(revocation_reason) between 8 and 1000)
    or (status <> 'revoked' and revoked_at is null and revoked_by is null and revocation_reason is null)
  )
);

create unique index guardian_relationship_active_pair_idx
  on private.guardian_relationships(guardian_user_id, dependent_user_id)
  where status in ('pending_verification', 'active', 'disputed');

create table private.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  relationship_id uuid not null references private.guardian_relationships(id) on delete restrict,
  dependent_user_id uuid not null references auth.users(id) on delete restrict,
  consent_scope text not null,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null,
  child_privacy_document_key text,
  child_privacy_document_version text,
  child_privacy_content_sha256 text,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  foreign key (child_privacy_document_key, child_privacy_document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  constraint guardian_consent_scope_check check (
    consent_scope in (
      'account', 'public_profile', 'artisan_membership', 'artisan_posting',
      'artisan_commenting', 'artisan_uploading', 'artisan_challenges',
      'artisan_notifications', 'account_export', 'account_deletion'
    )
  ),
  constraint guardian_consent_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint guardian_consent_child_privacy_check check (
    (child_privacy_document_key is null and child_privacy_document_version is null
      and child_privacy_content_sha256 is null)
    or (child_privacy_document_key = 'under13_privacy_notice'
      and child_privacy_document_version is not null
      and child_privacy_content_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint guardian_consent_status_check check (status in ('active', 'expired', 'revoked', 'superseded')),
  constraint guardian_consent_expiry_check check (expires_at > granted_at),
  constraint guardian_consent_revocation_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by is not null and pg_catalog.char_length(revocation_reason) between 8 and 1000)
    or (status <> 'revoked' and revoked_at is null and revoked_by is null and revocation_reason is null)
  )
);

create unique index guardian_consent_one_current_scope_idx
  on private.guardian_consents(dependent_user_id, consent_scope)
  where status = 'active';

create table private.guardian_consent_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  consent_id uuid not null references private.guardian_consents(id) on delete restrict,
  relationship_id uuid not null references private.guardian_relationships(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint guardian_consent_event_action_check check (action in ('granted', 'revoked', 'expired', 'superseded')),
  constraint guardian_consent_event_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.guardian_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id_sha256 text not null unique,
  event_type text not null,
  payload_sha256 text not null,
  processing_status text not null default 'received',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint guardian_provider_event_hashes_check check (
    provider_event_id_sha256 ~ '^[0-9a-f]{64}$' and payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint guardian_provider_event_status_check check (processing_status in ('received', 'processed', 'ignored', 'failed'))
);

-- Ephemeral provider callback binding. Only hashes of external references,
-- state nonces, and result payloads are stored; raw vendor payloads and secrets
-- never enter the database or browser contract.
create table private.community_provider_transactions (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  provider text not null,
  purpose text not null,
  subject_user_id uuid not null references auth.users(id) on delete restrict,
  guardian_user_id uuid references auth.users(id) on delete restrict,
  guardian_relationship_id uuid references private.guardian_relationships(id) on delete restrict,
  relationship_type text,
  consent_scope text,
  document_key text,
  document_version text,
  content_sha256 text,
  child_privacy_document_key text,
  child_privacy_document_version text,
  child_privacy_content_sha256 text,
  authority_expires_at timestamptz,
  external_reference_sha256 text not null unique,
  state_nonce_sha256 text not null unique,
  status text not null default 'pending',
  result_event_sha256 text unique,
  evidence_code text,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_privacy_document_key, child_privacy_document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  constraint community_provider_name_check check (provider ~ '^[a-z][a-z0-9_-]{2,80}$'),
  constraint community_provider_purpose_check check (purpose in ('age_assurance','guardian_relationship','guardian_consent')),
  constraint community_provider_hash_check check (
    external_reference_sha256 ~ '^[0-9a-f]{64}$'
    and state_nonce_sha256 ~ '^[0-9a-f]{64}$'
    and (result_event_sha256 is null or result_event_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint community_provider_status_check check (status in ('pending','verified','failed','expired','canceled')),
  constraint community_provider_guardian_check check (
    (purpose = 'age_assurance' and guardian_user_id is null
      and guardian_relationship_id is null and relationship_type is null
      and consent_scope is null and document_key is null and document_version is null
      and content_sha256 is null and child_privacy_document_key is null
      and child_privacy_document_version is null
      and child_privacy_content_sha256 is null and authority_expires_at is null)
    or (purpose = 'guardian_relationship' and guardian_user_id is not null
      and guardian_user_id <> subject_user_id and guardian_relationship_id is null
      and relationship_type in ('parent','legal_guardian','court_authorized_guardian')
      and consent_scope is null and document_key is null and document_version is null
      and content_sha256 is null and child_privacy_document_key is null
      and child_privacy_document_version is null
      and child_privacy_content_sha256 is null and authority_expires_at is not null)
    or (purpose = 'guardian_consent' and guardian_user_id is not null
      and guardian_user_id <> subject_user_id and guardian_relationship_id is not null
      and relationship_type is null
      and consent_scope in (
        'account','public_profile','artisan_membership','artisan_posting',
        'artisan_commenting','artisan_uploading','artisan_challenges',
        'artisan_notifications','account_export','account_deletion'
      )
      and document_key is not null and document_version is not null
      and content_sha256 ~ '^[0-9a-f]{64}$'
      and ((child_privacy_document_key is null
          and child_privacy_document_version is null
          and child_privacy_content_sha256 is null)
        or (child_privacy_document_key = 'under13_privacy_notice'
          and child_privacy_document_version is not null
          and child_privacy_content_sha256 ~ '^[0-9a-f]{64}$'))
      and authority_expires_at is not null)
  ),
  constraint community_provider_authority_expiry_check check (
    authority_expires_at is null or authority_expires_at > created_at
  ),
  constraint community_provider_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  constraint community_provider_consumption_check check (
    (status = 'pending' and consumed_at is null and result_event_sha256 is null)
    or (status <> 'pending' and consumed_at is not null)
  )
);

create table private.community_provider_transaction_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  provider_transaction_id uuid not null references private.community_provider_transactions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  result_event_sha256 text,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint community_provider_transaction_action_check check (action in ('started','verified','failed','expired','canceled')),
  constraint community_provider_transaction_event_hash_check check (result_event_sha256 is null or result_event_sha256 ~ '^[0-9a-f]{64}$'),
  constraint community_provider_transaction_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create trigger community_provider_transaction_events_are_append_only
before update or delete on private.community_provider_transaction_events
for each row execute function private.community_history_is_append_only();

create table private.profile_media_derivatives (
  profile_media_id uuid primary key references public.profile_media(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  media_type text not null,
  storage_provider text not null default 'supabase',
  approved_bucket text not null default 'profile-media-approved',
  approved_object_key text not null unique,
  detected_mime text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  metadata_stripped boolean not null,
  processing_status text not null default 'approved',
  accessibility_description text,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint profile_media_derivative_type_check check (media_type in ('avatar','banner')),
  constraint profile_media_derivative_provider_check check (storage_provider in ('supabase','r2')),
  constraint profile_media_derivative_bucket_check check (approved_bucket = 'profile-media-approved'),
  constraint profile_media_derivative_mime_check check (detected_mime in ('image/jpeg','image/webp')),
  constraint profile_media_derivative_size_check check (byte_size between 1 and 5242880),
  constraint profile_media_derivative_hash_check check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint profile_media_derivative_status_check check (processing_status in ('approved','removed')),
  constraint profile_media_derivative_metadata_check check (metadata_stripped),
  constraint profile_media_derivative_accessibility_check check (
    accessibility_description is null or pg_catalog.char_length(accessibility_description) between 1 and 2000
  )
);

create table private.profile_media_derivative_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  profile_media_id uuid not null references public.profile_media(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  checksum_sha256 text,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint profile_media_derivative_event_action_check check (action in ('approved','removed')),
  constraint profile_media_derivative_event_hash_check check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint profile_media_derivative_event_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create trigger profile_media_derivative_events_are_append_only
before update or delete on private.profile_media_derivative_events
for each row execute function private.community_history_is_append_only();

create trigger guardian_consent_events_are_append_only
before update or delete on private.guardian_consent_events
for each row execute function private.community_history_is_append_only();
create trigger guardian_provider_events_are_append_only
before update or delete on private.guardian_provider_events
for each row execute function private.community_history_is_append_only();

-- Pre-account guardian sponsorship stores only Worker-produced hashes. It
-- never stores a dependent's raw email, name, birth date, provider payload,
-- or credential, and it cannot create an Auth user. A verified sponsorship
-- may be claimed only after the dependent has an existing canonical account.
create table private.guardian_account_sponsorships (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  guardian_user_id uuid not null references auth.users(id) on delete restrict,
  dependent_contact_hmac_sha256 text not null,
  claim_nonce_sha256 text not null unique,
  relationship_type text not null,
  provider text not null,
  guardian_notice_document_key text not null,
  guardian_notice_document_version text not null,
  guardian_notice_content_sha256 text not null,
  child_privacy_document_key text not null,
  child_privacy_document_version text not null,
  child_privacy_content_sha256 text not null,
  external_reference_sha256 text not null,
  state_nonce_sha256 text not null unique,
  provider_result_sha256 text,
  status text not null default 'pending_provider',
  authority_expires_at timestamptz not null,
  request_expires_at timestamptz not null,
  verified_at timestamptz,
  claimed_by uuid references auth.users(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_sponsorship_hashes_check check (
    dependent_contact_hmac_sha256 ~ '^[0-9a-f]{64}$'
    and claim_nonce_sha256 ~ '^[0-9a-f]{64}$'
    and external_reference_sha256 ~ '^[0-9a-f]{64}$'
    and state_nonce_sha256 ~ '^[0-9a-f]{64}$'
    and guardian_notice_content_sha256 ~ '^[0-9a-f]{64}$'
    and child_privacy_content_sha256 ~ '^[0-9a-f]{64}$'
    and (provider_result_sha256 is null or provider_result_sha256 ~ '^[0-9a-f]{64}$')
  ),
  foreign key (guardian_notice_document_key, guardian_notice_document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  foreign key (child_privacy_document_key, child_privacy_document_version)
    references private.community_legal_document_versions(document_key, document_version)
    on delete restrict,
  constraint guardian_sponsorship_legal_keys_check check (
    guardian_notice_document_key = 'guardian_consent_notice'
    and child_privacy_document_key = 'under13_privacy_notice'
  ),
  constraint guardian_sponsorship_relationship_check check (
    relationship_type in ('parent','legal_guardian','court_authorized_guardian')
  ),
  constraint guardian_sponsorship_provider_check check (provider ~ '^[a-z][a-z0-9_-]{2,80}$'),
  constraint guardian_sponsorship_status_check check (
    status in ('pending_provider','verified','claimed','failed','expired','revoked')
  ),
  constraint guardian_sponsorship_expiry_check check (
    request_expires_at > created_at
    and request_expires_at <= created_at + interval '24 hours'
    and authority_expires_at > created_at
  ),
  constraint guardian_sponsorship_state_check check (
    (status = 'pending_provider' and provider_result_sha256 is null
      and verified_at is null and claimed_by is null and claimed_at is null)
    or (status = 'verified' and provider_result_sha256 is not null
      and verified_at is not null and claimed_by is null and claimed_at is null)
    or (status = 'claimed' and provider_result_sha256 is not null
      and verified_at is not null and claimed_by is not null and claimed_at is not null)
    or (status in ('failed','expired','revoked') and claimed_by is null and claimed_at is null)
  )
);

create unique index guardian_sponsorship_active_contact_idx
  on private.guardian_account_sponsorships(guardian_user_id, dependent_contact_hmac_sha256)
  where status in ('pending_provider','verified');

create table private.guardian_account_sponsorship_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  sponsorship_id uuid not null references private.guardian_account_sponsorships(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  result_sha256 text,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint guardian_sponsorship_event_action_check check (
    action in ('started','verified','claimed','failed','expired','revoked')
  ),
  constraint guardian_sponsorship_event_hash_check check (
    result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint guardian_sponsorship_event_reason_check check (
    pg_catalog.char_length(private_reason) between 8 and 1000
  )
);

create trigger guardian_account_sponsorship_events_are_append_only
before update or delete on private.guardian_account_sponsorship_events
for each row execute function private.community_history_is_append_only();

create table private.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null,
  restriction_type text not null,
  status text not null default 'active',
  reason_code text not null,
  public_notice text not null,
  private_reason text not null,
  appeal_eligible boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  imposed_by uuid not null references auth.users(id) on delete restrict,
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_restriction_scope_check check (
    scope in (
      'all_public_communities', 'commons_profile_publication', 'commune_posting',
      'commune_commenting', 'marketplace_publishing', 'job_posting',
      'artisan_membership', 'artisan_posting',
      'artisan_commenting', 'artisan_appreciation', 'artisan_uploading',
      'artisan_challenges', 'artisan_notifications'
    )
  ),
  constraint account_restriction_type_check check (
    restriction_type in ('read_only', 'no_comments', 'no_uploads', 'no_challenges', 'suspended', 'banned')
  ),
  constraint account_restriction_status_check check (status in ('active', 'expired', 'lifted')),
  constraint account_restriction_reason_code_check check (reason_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint account_restriction_notice_check check (pg_catalog.char_length(public_notice) between 8 and 1000),
  constraint account_restriction_private_reason_check check (pg_catalog.char_length(private_reason) between 8 and 2000),
  constraint account_restriction_lift_check check (
    (status = 'lifted' and lifted_at is not null and lifted_by is not null)
    or (status <> 'lifted' and lifted_at is null and lifted_by is null)
  )
);

create index account_restrictions_effective_idx
  on private.account_restrictions(target_user_id, scope, starts_at, expires_at)
  where status = 'active';

create table private.account_restriction_actions (
  client_request_id uuid primary key,
  restriction_id uuid not null references private.account_restrictions(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint account_restriction_action_check check (action in ('imposed', 'lifted', 'expired')),
  constraint account_restriction_action_reason_check check (pg_catalog.char_length(private_reason) between 8 and 2000)
);

create trigger account_restriction_actions_are_append_only
before update or delete on private.account_restriction_actions
for each row execute function private.community_history_is_append_only();

create table private.account_lifecycle_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  status text not null default 'submitted',
  notice_version text not null,
  user_note text,
  cooling_period_ends_at timestamptz,
  legal_hold_present boolean not null default false,
  export_artifact_sha256 text,
  export_expires_at timestamptz,
  claimed_by uuid references auth.users(id) on delete restrict,
  claimed_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  private_resolution text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  canceled_at timestamptz,
  constraint lifecycle_action_check check (action in ('data_export', 'account_deletion', 'account_deactivation', 'account_reactivation')),
  constraint lifecycle_status_check check (
    status in (
      'submitted', 'identity_verification', 'cooling_period', 'operator_review',
      'processing', 'storage_inventory', 'storage_cleanup',
      'auth_deletion_ready', 'auth_deletion_confirmed',
      'blocked_by_legal_hold', 'completed', 'rejected', 'canceled'
    )
  ),
  constraint lifecycle_notice_check check (pg_catalog.char_length(notice_version) between 1 and 120),
  constraint lifecycle_note_check check (user_note is null or pg_catalog.char_length(user_note) <= 2000),
  constraint lifecycle_export_check check (
    export_artifact_sha256 is null
    or (action = 'data_export' and export_artifact_sha256 ~ '^[0-9a-f]{64}$' and export_expires_at is not null)
  ),
  constraint lifecycle_claim_check check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  ),
  constraint lifecycle_completion_check check (
    (status = 'completed' and completed_at is not null and resolved_by is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint lifecycle_cancel_check check (
    (status = 'canceled' and canceled_at is not null)
    or (status <> 'canceled' and canceled_at is null)
  )
);

create unique index lifecycle_one_open_action_idx
  on private.account_lifecycle_requests(user_id, action)
  where status in (
    'submitted', 'identity_verification', 'cooling_period', 'operator_review',
    'processing', 'storage_inventory', 'storage_cleanup',
    'auth_deletion_ready', 'auth_deletion_confirmed', 'blocked_by_legal_hold'
  );

-- Deletion is orchestrated by a trusted Worker because Auth deletion and owned
-- Storage-object removal cannot be truthfully completed by SQL. This handoff
-- records evidence without claiming the external operations succeeded.
create table private.account_deletion_handoffs (
  lifecycle_request_id uuid primary key references private.account_lifecycle_requests(id) on delete restrict,
  content_disposition text not null default 'preserve_public_credit_anonymize_account',
  storage_inventory_completed_at timestamptz,
  storage_inventory_evidence_sha256 text,
  owned_storage_object_count integer,
  storage_cleanup_completed_at timestamptz,
  storage_cleanup_evidence_sha256 text,
  auth_deletion_requested_at timestamptz,
  auth_deletion_request_evidence_sha256 text,
  auth_deletion_confirmed_at timestamptz,
  auth_deletion_confirmation_evidence_sha256 text,
  auth_provider_receipt_sha256 text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint deletion_handoff_disposition_check check (
    content_disposition in ('preserve_public_credit_anonymize_account','remove_user_content_preserve_required_legal_evidence')
  ),
  constraint deletion_handoff_storage_count_check check (owned_storage_object_count is null or owned_storage_object_count >= 0),
  constraint deletion_handoff_inventory_check check (
    (storage_inventory_completed_at is null and owned_storage_object_count is null
      and storage_inventory_evidence_sha256 is null)
    or (storage_inventory_completed_at is not null and owned_storage_object_count is not null
      and storage_inventory_evidence_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint deletion_handoff_cleanup_check check (
    (storage_cleanup_completed_at is null and storage_cleanup_evidence_sha256 is null)
    or (storage_cleanup_completed_at is not null
      and storage_cleanup_evidence_sha256 ~ '^[0-9a-f]{64}$'
      and storage_inventory_completed_at is not null)
  ),
  constraint deletion_handoff_auth_request_check check (
    (auth_deletion_requested_at is null and auth_deletion_request_evidence_sha256 is null)
    or (auth_deletion_requested_at is not null
      and auth_deletion_request_evidence_sha256 ~ '^[0-9a-f]{64}$'
      and storage_cleanup_completed_at is not null)
  ),
  constraint deletion_handoff_auth_confirmation_check check (
    (auth_deletion_confirmed_at is null
      and auth_deletion_confirmation_evidence_sha256 is null
      and auth_provider_receipt_sha256 is null)
    or (auth_deletion_confirmed_at is not null and auth_deletion_requested_at is not null
      and auth_deletion_confirmation_evidence_sha256 ~ '^[0-9a-f]{64}$'
      and auth_provider_receipt_sha256 ~ '^[0-9a-f]{64}$')
  )
);

alter table private.account_deletion_handoffs owner to postgres;
alter table private.account_deletion_handoffs enable row level security;
revoke all on private.account_deletion_handoffs from public, anon, authenticated, service_role;

-- Worker-produced account exports are private artifacts. The randomized object
-- key is service-only; an owner later receives only an opaque same-origin path.
create table private.account_export_artifacts (
  id uuid primary key default gen_random_uuid(),
  lifecycle_request_id uuid not null unique
    references private.account_lifecycle_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  storage_provider text not null default 'r2',
  bucket_binding text not null default 'COMMUNITY_EXPORTS',
  private_object_key text not null unique,
  artifact_sha256 text not null,
  byte_size bigint not null,
  mime_type text not null,
  encryption_at_rest text not null default 'r2_provider_managed',
  status text not null default 'available',
  retention_status text not null default 'pending',
  retention_available_at timestamptz not null,
  retention_attempt_count integer not null default 0,
  retention_claimed_by text,
  retention_claimed_at timestamptz,
  retention_lease_expires_at timestamptz,
  retention_last_error_code text,
  retention_last_error_at timestamptz,
  retention_last_error_evidence_sha256 text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  deletion_evidence_sha256 text,
  updated_at timestamptz not null default now(),
  constraint account_export_storage_check check (
    storage_provider = 'r2' and bucket_binding = 'COMMUNITY_EXPORTS'
  ),
  constraint account_export_encryption_check check (
    encryption_at_rest = 'r2_provider_managed'
  ),
  constraint account_export_object_key_check check (
    private_object_key ~ '^exports/[0-9a-f-]{36}/[0-9a-f-]{36}\.(json|zip)$'
    and private_object_key !~ '(^|/)\.\.(/|$)'
    and private_object_key !~ '[\\\\]'
  ),
  constraint account_export_sha_check check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  constraint account_export_size_check check (byte_size between 1 and 104857600),
  constraint account_export_mime_check check (mime_type in ('application/json','application/zip')),
  constraint account_export_status_check check (status in ('available','expired','deleted')),
  constraint account_export_retention_status_check check (
    retention_status in (
      'pending','processing','failed','blocked_by_legal_hold','completed','abandoned'
    )
  ),
  constraint account_export_retention_attempt_check check (
    retention_attempt_count between 0 and 20
  ),
  constraint account_export_retention_claim_check check (
    (retention_status = 'processing' and retention_claimed_by is not null
      and retention_claimed_at is not null and retention_lease_expires_at is not null)
    or (retention_status <> 'processing' and retention_claimed_by is null
      and retention_claimed_at is null and retention_lease_expires_at is null)
  ),
  constraint account_export_retention_error_check check (
    (retention_last_error_code is null and retention_last_error_at is null
      and retention_last_error_evidence_sha256 is null)
    or (retention_last_error_code ~ '^[a-z][a-z0-9_]{2,99}$'
      and retention_last_error_at is not null
      and retention_last_error_evidence_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint account_export_expiry_check check (expires_at > created_at),
  constraint account_export_deletion_check check (
    (status in ('available','expired') and deleted_at is null and deletion_evidence_sha256 is null)
    or (status = 'deleted' and deleted_at is not null
      and deletion_evidence_sha256 ~ '^[0-9a-f]{64}$')
  )
);

create table private.account_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  request_id uuid not null references private.account_lifecycle_requests(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text not null,
  private_reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lifecycle_event_action_check check (action ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint lifecycle_event_reason_check check (pg_catalog.char_length(private_reason) between 8 and 2000),
  constraint lifecycle_event_metadata_check check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create table private.account_legal_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null,
  reason_code text not null,
  imposed_by uuid not null references auth.users(id) on delete restrict,
  imposed_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete restrict,
  private_reason text not null,
  constraint account_legal_hold_scope_check check (scope in ('account', 'moderation_evidence', 'copyright', 'child_safety', 'challenge_agreement')),
  constraint account_legal_hold_reason_check check (pg_catalog.char_length(private_reason) between 8 and 2000),
  constraint account_legal_hold_lift_check check ((lifted_at is null and lifted_by is null) or (lifted_at is not null and lifted_by is not null))
);

create trigger account_lifecycle_events_are_append_only
before update or delete on private.account_lifecycle_events
for each row execute function private.community_history_is_append_only();

create table private.community_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete restrict,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  mentions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  challenge_updates_enabled boolean not null default true,
  moderation_updates_enabled boolean not null default true,
  guardian_updates_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now(),
  constraint notification_quiet_hours_pair_check check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

create table private.community_capability_catalog (
  capability text primary key,
  description text not null,
  requires_aal2 boolean not null default true,
  sensitive_evidence_access boolean not null default false,
  active boolean not null default true,
  constraint community_capability_key_check check (capability ~ '^[a-z][a-z0-9_]{2,100}$')
);

insert into private.community_capability_catalog(capability, description, sensitive_evidence_access)
values
  ('community_capabilities_manage', 'Grant and revoke scoped community capabilities.', false),
  ('community_feature_flags_manage', 'Activate or disable reviewed community feature gates.', false),
  ('community_legal_manage', 'Register and activate exact community legal-document versions.', true),
  ('community_age_assurance_manage', 'Record reviewed age-assurance outcomes.', true),
  ('community_guardian_manage', 'Manage verified guardian relationships and scoped consent.', true),
  ('community_restrictions_manage', 'Impose and lift scoped public-community restrictions.', true),
  ('community_lifecycle_manage', 'Review account export, deletion, deactivation, and legal-hold-aware lifecycle actions.', true),
  ('artisan_memberships_manage', 'Issue and revoke invite-only Artisan memberships.', false),
  ('artisan_challenges_manage', 'Create and transition Artisan challenges.', false),
  ('artisan_judging_manage', 'Assign challenge judges and review disclosed conflicts.', true),
  ('artisan_submissions_review', 'Review challenge submissions and eligibility.', false),
  ('artisan_media_review', 'Review quarantined media and publication derivatives.', true),
  ('artisan_publication_manage', 'Publish approved works and their sanitized derivatives atomically.', true),
  ('artisan_gallery_manage', 'Materialize and curate winner and all-entry galleries.', false),
  ('artisan_forum_moderate', 'Moderate Artisan posts and comments.', false),
  ('artisan_reports_triage', 'Read and triage reports.', true),
  ('artisan_cases_manage', 'Manage moderation cases and actions.', true),
  ('artisan_appeals_review', 'Review appeals independently.', true),
  ('artisan_credits_correct', 'Review and apply attribution corrections.', false),
  ('artisan_copyright_manage', 'Manage copyright notices and counter-notices.', true),
  ('artisan_child_safety_manage', 'Manage separately protected child-safety cases.', true),
  ('artisan_audit_view', 'Read bounded community and Artisan audit records.', true),
  ('artisan_user_restrict', 'Apply Artisan-scoped user restrictions.', true),
  ('artisan_system_view', 'Read bounded operational health and retention queues.', false)
on conflict (capability) do nothing;

create table private.community_capability_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  capability text not null references private.community_capability_catalog(capability) on delete restrict,
  granted_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  constraint community_capability_reason_check check (pg_catalog.char_length(reason) between 8 and 1000),
  constraint community_capability_revoke_check check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and pg_catalog.char_length(revocation_reason) between 8 and 1000)
  )
);

create unique index community_capability_active_assignment_idx
  on private.community_capability_assignments(user_id, capability)
  where revoked_at is null;

create table private.community_capability_actions (
  client_request_id uuid primary key,
  assignment_id uuid not null references private.community_capability_assignments(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  capability text not null,
  action text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint community_capability_action_check check (action in ('granted', 'revoked', 'expired')),
  constraint community_capability_action_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create trigger community_capability_actions_are_append_only
before update or delete on private.community_capability_actions
for each row execute function private.community_history_is_append_only();

do $shared_private_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'community_audit_events', 'community_idempotency_keys',
    'community_feature_flags', 'community_feature_flag_actions',
    'community_legal_document_versions', 'community_active_legal_documents', 'community_terms_acceptances',
    'account_participation', 'age_assurance_events', 'guardian_relationships', 'guardian_consents',
    'guardian_consent_events', 'guardian_provider_events',
    'guardian_account_sponsorships', 'guardian_account_sponsorship_events',
    'community_provider_transactions',
    'community_provider_transaction_events', 'profile_media_derivatives',
    'profile_media_derivative_events', 'account_restrictions',
    'account_restriction_actions', 'account_lifecycle_requests', 'account_deletion_handoffs',
    'account_export_artifacts', 'account_lifecycle_events',
    'account_legal_holds', 'community_notification_preferences', 'community_capability_catalog',
    'community_capability_assignments', 'community_capability_actions'
  ] loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$shared_private_table_hardening$;

create or replace function private.community_feature_enabled(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select flag.enabled
    from private.community_feature_flags as flag
    where flag.feature_key = p_feature_key
  ), false);
$$;

alter function private.community_feature_enabled(text) owner to postgres;
revoke all privileges on function private.community_feature_enabled(text)
  from public, anon, authenticated, service_role;

create or replace function private.community_account_is_recoverable(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from auth.users as account
    where account.id = p_user_id
      and account.deleted_at is null
      and account.is_anonymous is false
      and account.email_confirmed_at is not null
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ), false);
$$;

alter function private.community_account_is_recoverable(uuid) owner to postgres;
revoke all privileges on function private.community_account_is_recoverable(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.community_has_current_document(p_user_id uuid, p_document_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.community_active_legal_documents as active_document
    join private.community_legal_document_versions as document
      on document.document_key = active_document.document_key
     and document.document_version = active_document.document_version
     and document.status = 'approved'
    join private.community_terms_acceptances as acceptance
      on acceptance.user_id = p_user_id
     and acceptance.document_key = document.document_key
     and acceptance.document_version = document.document_version
     and acceptance.content_sha256 = document.content_sha256
    where active_document.document_key = p_document_key
  ), false);
$$;

alter function private.community_has_current_document(uuid, text) owner to postgres;
revoke all privileges on function private.community_has_current_document(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.community_has_active_restriction(p_user_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.account_restrictions as restriction
    where restriction.target_user_id = p_user_id
      and restriction.status = 'active'
      and restriction.starts_at <= pg_catalog.now()
      and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())
      and restriction.scope in ('all_public_communities', p_scope)
  ), false);
$$;

alter function private.community_has_active_restriction(uuid, text) owner to postgres;
revoke all privileges on function private.community_has_active_restriction(uuid, text)
  from public, anon, authenticated, service_role;

-- Single fail-closed publication predicate for every public identity surface.
-- SECURITY DEFINER projections must call this explicitly because they bypass
-- table RLS. Keeping the predicate centralized prevents a suspended account
-- from remaining visible through a handle redirect, avatar, or Artisan join.
create or replace function private.community_profile_is_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Replaced immediately after the guardian-consent helper is declared below.
  -- The bootstrap definition is deliberately fail-closed so no intermediate
  -- migration statement can expose an unclassified account.
  select false;
$$;

alter function private.community_profile_is_public(uuid) owner to postgres;
revoke all privileges on function private.community_profile_is_public(uuid)
  from public, anon, authenticated, service_role;
-- RLS policies on the physical public-card/handle tables invoke this bounded
-- boolean predicate as the caller; it exposes no underlying participation row.
grant execute on function private.community_profile_is_public(uuid)
  to anon, authenticated;

create or replace function private.community_has_guardian_consent(p_user_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.guardian_consents as consent
    join private.guardian_relationships as relationship
      on relationship.id = consent.relationship_id
     and relationship.status = 'active'
     and relationship.dependent_user_id = p_user_id
     and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
    join private.community_active_legal_documents as active_document
      on active_document.document_key = consent.document_key
     and active_document.document_version = consent.document_version
    join private.community_legal_document_versions as document
      on document.document_key = consent.document_key
     and document.document_version = consent.document_version
     and document.content_sha256 = consent.content_sha256
     and document.status = 'approved'
    join private.account_participation as participation
      on participation.user_id = consent.dependent_user_id
    where consent.dependent_user_id = p_user_id
      and consent.consent_scope = p_scope
      and consent.status = 'active'
      and consent.expires_at > pg_catalog.now()
      and (participation.age_band <> 'under_13' or (
        consent.document_key = 'guardian_consent_notice'
        and consent.child_privacy_document_key = 'under13_privacy_notice'
        and exists (
          select 1
          from private.community_active_legal_documents as child_active
          join private.community_legal_document_versions as child_document
            on child_document.document_key = child_active.document_key
           and child_document.document_version = child_active.document_version
           and child_document.status = 'approved'
          where child_active.document_key = consent.child_privacy_document_key
            and child_document.document_version = consent.child_privacy_document_version
            and child_document.content_sha256 = consent.child_privacy_content_sha256
        )
      ))
  ), false);
$$;

alter function private.community_has_guardian_consent(uuid, text) owner to postgres;
revoke all privileges on function private.community_has_guardian_consent(uuid, text)
  from public, anon, authenticated, service_role;

-- Public identity is independently age-gated. Unknown age is never treated as
-- adult; every minor requires the reviewed age-band feature, an eligible state,
-- and exact current guardian consent for the public_profile scope. This helper
-- is consulted both when enabling a card and every time any public projection
-- reads it, so revocation or a flag shutdown takes effect immediately.
create or replace function private.community_can_publish_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'commons_profile_publication')
    and not private.community_has_active_restriction(p_user_id, 'all_public_communities')
    and private.community_has_current_document(p_user_id, 'community_terms')
    and private.community_has_current_document(p_user_id, 'privacy_notice')
    and private.community_has_current_document(p_user_id, 'community_guidelines')
    and private.community_has_current_document(p_user_id, 'moderation_policy')
    and exists (
      select 1
      from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state not in (
          'restricted','suspended','blocked','deletion_pending','deactivated'
        )
        and (
          participation.assurance_expires_at is null
          or participation.assurance_expires_at > pg_catalog.now()
        )
        and case
          when participation.age_band = '18_plus' then
            participation.assurance_status in (
              'self_attested','age_estimated','age_verified'
            )
          when participation.age_band in ('13_to_15','16_to_17') then
            participation.participation_state = 'teen_eligible'
            and participation.assurance_status in ('age_verified','guardian_verified')
            and private.community_feature_enabled('artisan_teen_participation')
            and private.community_feature_enabled('artisan_teen_public_profiles')
            and private.community_has_guardian_consent(p_user_id, 'public_profile')
          when participation.age_band = 'under_13' then
            participation.participation_state = 'under13_eligible'
            and participation.assurance_status = 'guardian_verified'
            and private.community_feature_enabled('artisan_under13_participation')
            and private.community_feature_enabled('artisan_under13_public_profiles')
            and private.community_has_guardian_consent(p_user_id, 'public_profile')
          else false
        end
    ),
    false
  );
$$;

alter function private.community_can_publish_profile(uuid) owner to postgres;
revoke all privileges on function private.community_can_publish_profile(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.community_profile_is_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_can_publish_profile(p_user_id);
$$;

alter function private.community_profile_is_public(uuid) owner to postgres;

-- Canonical state reducer. Age/provider callbacks, exact terms acceptance, and
-- guardian changes all call the same reducer so no endpoint can accidentally
-- promote a youth account with only part of the required evidence.
create or replace function private.recompute_community_participation(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access private.account_participation%rowtype;
  v_has_terms boolean;
  v_next_state text;
begin
  select * into strict v_access
  from private.account_participation
  where user_id = p_user_id
  for update;

  if v_access.participation_state in ('deletion_pending', 'deactivated') then
    return v_access.participation_state;
  end if;
  if v_access.participation_state in ('restricted', 'suspended', 'blocked')
     and (
       v_access.assurance_status in ('restricted','blocked')
       or exists (
         select 1 from private.account_restrictions as restriction
         where restriction.target_user_id = p_user_id
           and restriction.status = 'active'
           and restriction.starts_at <= pg_catalog.now()
           and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())
       )
     ) then
    return v_access.participation_state;
  end if;

  v_has_terms :=
    private.community_has_current_document(p_user_id, 'community_terms')
    and private.community_has_current_document(p_user_id, 'privacy_notice')
    and private.community_has_current_document(p_user_id, 'community_guidelines')
    and private.community_has_current_document(p_user_id, 'moderation_policy')
    and private.community_has_current_document(p_user_id, 'artist_platform_license')
    and private.community_has_current_document(p_user_id, 'ai_authorship_policy');

  v_next_state := case
    when v_access.assurance_status in ('blocked', 'restricted')
      then v_access.assurance_status
    when v_access.assurance_expires_at is not null
      and v_access.assurance_expires_at <= pg_catalog.now()
      then 'read_only'
    when v_access.age_band = '18_plus'
      and v_access.assurance_status in ('self_attested', 'age_estimated', 'age_verified')
      and v_has_terms
      and private.community_feature_enabled('artisan_adult_closed_beta')
      then 'adult_eligible'
    when v_access.age_band = '16_to_17'
      and v_access.assurance_status in ('age_verified', 'guardian_verified')
      and v_has_terms
      and private.community_feature_enabled('artisan_teen_participation')
      then 'teen_eligible'
    when v_access.age_band = '13_to_15'
      and v_access.assurance_status in ('age_verified', 'guardian_verified')
      and v_has_terms
      and private.community_feature_enabled('artisan_teen_participation')
      and private.community_has_guardian_consent(p_user_id, 'artisan_membership')
      then 'teen_eligible'
    when v_access.age_band in ('13_to_15', '16_to_17')
      then 'teen_pending'
    when v_access.age_band = 'under_13'
      and v_access.assurance_status = 'guardian_verified'
      and v_has_terms
      and private.community_feature_enabled('artisan_under13_participation')
      and private.community_has_guardian_consent(p_user_id, 'artisan_membership')
      then 'under13_eligible'
    when v_access.age_band = 'under_13'
      then 'under13_pending'
    else 'read_only'
  end;

  update private.account_participation
  set participation_state = v_next_state,
      evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = p_user_id;
  return v_next_state;
end;
$$;

alter function private.recompute_community_participation(uuid) owner to postgres;
revoke all privileges on function private.recompute_community_participation(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.community_user_has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and exists (
      select 1
      from private.community_capability_assignments as assignment
      join private.community_capability_catalog as catalog
        on catalog.capability = assignment.capability and catalog.active
      where assignment.user_id = p_user_id
        and assignment.capability = p_capability
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
    ),
    false
  );
$$;

alter function private.community_user_has_capability(uuid, text) owner to postgres;
revoke all privileges on function private.community_user_has_capability(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.require_community_operator(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_capability text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  if p_actor_aal <> 'aal2' then
    raise exception using errcode = '42501', message = 'community_operator_aal2_required';
  end if;
  if not private.community_user_has_capability(p_actor_user_id, p_capability) then
    raise exception using errcode = '42501', message = 'community_operator_capability_required';
  end if;
end;
$$;

alter function private.require_community_operator(uuid, text, text) owner to postgres;
revoke all privileges on function private.require_community_operator(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.community_can_participate(p_user_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access private.account_participation%rowtype;
  v_restriction_scope text;
  v_guardian_scope text;
  v_media_feature text;
  v_under13_feature text;
begin
  if p_action = 'browse_public' then
    return true;
  end if;
  if p_action not in (
    'artisan_membership','artisan_post','artisan_comment','artisan_appreciate',
    'artisan_submit_challenge','artisan_upload_image','artisan_upload_audio',
    'artisan_upload_video','artisan_upload_document','artisan_upload_animation',
    'artisan_upload_3d','artisan_upload_interactive'
  ) then
    return false;
  end if;
  if not private.community_account_is_recoverable(p_user_id) then
    return false;
  end if;
  select * into v_access
  from private.account_participation
  where user_id = p_user_id;
  if not found or v_access.participation_state in ('read_only', 'restricted', 'suspended', 'blocked', 'deletion_pending', 'deactivated') then
    return false;
  end if;
  if v_access.assurance_expires_at is not null and v_access.assurance_expires_at <= pg_catalog.now() then
    return false;
  end if;

  v_restriction_scope := case
    when p_action = 'artisan_membership' then 'artisan_membership'
    when p_action = 'artisan_post' then 'artisan_posting'
    when p_action = 'artisan_comment' then 'artisan_commenting'
    when p_action = 'artisan_appreciate' then 'artisan_appreciation'
    when p_action = 'artisan_submit_challenge' then 'artisan_challenges'
    when p_action in (
      'artisan_upload_image','artisan_upload_audio','artisan_upload_video',
      'artisan_upload_document','artisan_upload_animation','artisan_upload_3d',
      'artisan_upload_interactive'
    ) then 'artisan_uploading'
  end;
  if private.community_has_active_restriction(p_user_id, v_restriction_scope) then
    return false;
  end if;

  if not private.community_has_current_document(p_user_id, 'community_terms')
     or not private.community_has_current_document(p_user_id, 'privacy_notice')
     or not private.community_has_current_document(p_user_id, 'community_guidelines')
     or not private.community_has_current_document(p_user_id, 'moderation_policy')
     or not private.community_has_current_document(p_user_id, 'artist_platform_license')
     or not private.community_has_current_document(p_user_id, 'ai_authorship_policy') then
    return false;
  end if;

  v_media_feature := case p_action
    when 'artisan_upload_audio' then 'artisan_audio_media'
    when 'artisan_upload_video' then 'artisan_short_video_media'
    when 'artisan_upload_document' then 'artisan_document_media'
    when 'artisan_upload_animation' then 'artisan_animation_media'
    when 'artisan_upload_3d' then 'artisan_3d_media'
    when 'artisan_upload_interactive' then 'artisan_interactive_media'
    else null
  end;
  if v_media_feature is not null and not private.community_feature_enabled(v_media_feature) then
    return false;
  end if;

  if v_access.age_band = '18_plus'
     and v_access.participation_state = 'adult_eligible'
     and v_access.assurance_status in ('self_attested', 'age_estimated', 'age_verified') then
    return private.community_feature_enabled('artisan_adult_closed_beta');
  end if;

  if v_access.age_band in ('13_to_15', '16_to_17')
     and v_access.participation_state = 'teen_eligible'
     and v_access.assurance_status in ('age_verified', 'guardian_verified')
     and private.community_feature_enabled('artisan_teen_participation') then
    v_guardian_scope := case p_action
      when 'artisan_membership' then 'artisan_membership'
      when 'artisan_post' then 'artisan_posting'
      when 'artisan_comment' then 'artisan_commenting'
      when 'artisan_submit_challenge' then 'artisan_challenges'
      when 'artisan_appreciate' then 'artisan_commenting'
      else 'artisan_uploading'
    end;
    return v_access.age_band = '16_to_17'
      or private.community_has_guardian_consent(p_user_id, v_guardian_scope);
  end if;

  if v_access.age_band = 'under_13'
     and v_access.participation_state = 'under13_eligible'
     and v_access.assurance_status = 'guardian_verified'
     and private.community_feature_enabled('artisan_under13_participation') then
    v_under13_feature := case
      when p_action = 'artisan_membership' then null
      when p_action = 'artisan_post' then 'artisan_under13_posting'
      when p_action = 'artisan_comment' then 'artisan_under13_commenting'
      when p_action = 'artisan_appreciate' then 'artisan_under13_appreciation'
      when p_action = 'artisan_submit_challenge' then 'artisan_under13_challenges'
      else 'artisan_under13_media'
    end;
    if v_under13_feature is not null
       and not private.community_feature_enabled(v_under13_feature) then
      return false;
    end if;
    if p_action in (
      'artisan_post','artisan_comment','artisan_submit_challenge',
      'artisan_upload_image','artisan_upload_audio','artisan_upload_video',
      'artisan_upload_document','artisan_upload_animation','artisan_upload_3d',
      'artisan_upload_interactive'
    ) and not private.community_feature_enabled('artisan_under13_content_approval') then
      return false;
    end if;
    v_guardian_scope := case p_action
      when 'artisan_membership' then 'artisan_membership'
      when 'artisan_post' then 'artisan_posting'
      when 'artisan_comment' then 'artisan_commenting'
      when 'artisan_appreciate' then 'artisan_commenting'
      when 'artisan_submit_challenge' then 'artisan_challenges'
      else 'artisan_uploading'
    end;
    return private.community_has_guardian_consent(p_user_id, v_guardian_scope);
  end if;

  return false;
end;
$$;

alter function private.community_can_participate(uuid, text) owner to postgres;
revoke all privileges on function private.community_can_participate(uuid, text)
  from public, anon, authenticated, service_role;

-- Minimal, physical public projection. It is intentionally independent of the
-- broad historical profiles row and contains no internal roles or age state.
create table public.profile_public_cards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null unique,
  display_name text,
  avatar_media_id uuid references public.profile_media(id) on delete set null,
  avatar_url text generated always as (
    case when avatar_media_id is null then null
      else '/api/public/profile-avatars/' || avatar_media_id::text end
  ) stored,
  short_public_bio text,
  canonical_profile_url text generated always as (
    'https://elysiaecobotics.com/commons-circle/@' || handle
  ) stored,
  public_profile_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint profile_public_cards_handle_check check (
    handle = pg_catalog.lower(handle)
    and pg_catalog.char_length(handle) between 2 and 80
    and handle ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
  ),
  constraint profile_public_cards_display_name_check check (
    display_name is null or pg_catalog.char_length(display_name) between 1 and 120
  ),
  constraint profile_public_cards_bio_check check (
    short_public_bio is null or pg_catalog.char_length(short_public_bio) <= 280
  ),
  constraint profile_public_cards_avatar_delivery_check check (
    avatar_url is null or avatar_url ~ '^/api/public/profile-avatars/[0-9a-f-]{36}$'
  )
);

create table public.profile_handle_history (
  handle text primary key,
  profile_user_id uuid references auth.users(id) on delete set null,
  replaced_by_handle text,
  redirect_enabled boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_handle_history_handle_check check (
    handle = pg_catalog.lower(handle)
    and pg_catalog.char_length(handle) between 2 and 80
    and handle ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
  ),
  constraint profile_handle_history_replacement_check check (
    replaced_by_handle is null
    or (replaced_by_handle = pg_catalog.lower(replaced_by_handle)
      and pg_catalog.char_length(replaced_by_handle) between 2 and 80
      and replaced_by_handle ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
      and replaced_by_handle <> handle)
  )
);

create table private.profile_publication_events (
  client_request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  enabled boolean not null,
  short_public_bio text,
  created_at timestamptz not null default now(),
  constraint profile_publication_event_bio_check
    check (short_public_bio is null or pg_catalog.char_length(short_public_bio) <= 280)
);

alter table public.profile_public_cards owner to postgres;
alter table public.profile_handle_history owner to postgres;
alter table private.profile_publication_events owner to postgres;
alter table public.profile_public_cards enable row level security;
alter table public.profile_handle_history enable row level security;
alter table private.profile_publication_events enable row level security;
revoke all on public.profile_public_cards from public, anon, authenticated, service_role;
revoke all on public.profile_handle_history from public, anon, authenticated, service_role;
revoke all on private.profile_publication_events from public, anon, authenticated, service_role;

insert into public.profile_public_cards(
  user_id, handle, display_name, avatar_media_id, short_public_bio,
  public_profile_enabled, updated_at
)
select
  profile.id,
  pg_catalog.lower(profile.username),
  nullif(pg_catalog.btrim(profile.display_name), ''),
  avatar.id,
  null,
  false,
  profile.updated_at
from public.profiles as profile
left join lateral (
  select media.id
  from public.profile_media as media
  where media.user_id = profile.id
    and media.media_type = 'avatar'
    and media.bucket = 'profile-avatars'
    and media.status = 'active'
    and media.storage_path like profile.id::text || '/avatars/%'
    and media.storage_path !~ '(^|/)\.\.(/|$)'
    and media.storage_path !~ '[\\\\]'
  order by media.created_at desc, media.id desc
  limit 1
) as avatar on true
where pg_catalog.char_length(profile.username) between 2 and 80
  and pg_catalog.lower(profile.username) ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
on conflict (user_id) do nothing;

insert into public.profile_handle_history(handle, profile_user_id)
select card.handle, card.user_id
from public.profile_public_cards as card
on conflict (handle) do nothing;

create or replace function private.sync_profile_public_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := pg_catalog.lower(new.username);
  v_old_handle text;
  v_avatar_media_id uuid;
begin
  if pg_catalog.char_length(v_handle) not between 2 and 80
     or v_handle !~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$' then
    -- Preserve legacy profile edits without publishing a noncanonical handle;
    -- a new or changed handle must meet the shared 2-80 contract.
    if tg_op = 'UPDATE' and new.username is not distinct from old.username then
      return new;
    end if;
    raise exception using errcode = '22023', message = 'profile_handle_invalid';
  end if;
  if tg_op = 'UPDATE' then
    v_old_handle := pg_catalog.lower(old.username);
    if v_old_handle <> v_handle then
      if exists (
        select 1 from public.profile_handle_history as history
        where history.handle = v_handle and history.profile_user_id is distinct from new.id
      ) then
        raise exception using errcode = '23505', message = 'profile_handle_retired';
      end if;
      update public.profile_handle_history
      set retired_at = coalesce(retired_at, pg_catalog.now()),
          replaced_by_handle = v_handle,
          redirect_enabled = true
      where handle = v_old_handle and profile_user_id = new.id;
    end if;
  end if;

  select media.id into v_avatar_media_id
  from public.profile_media as media
  where media.user_id = new.id
    and media.media_type = 'avatar'
    and media.bucket = 'profile-avatars'
    and media.status = 'active'
    and media.storage_path like new.id::text || '/avatars/%'
    and media.storage_path !~ '(^|/)\.\.(/|$)'
    and media.storage_path !~ '[\\\\]'
  order by media.created_at desc, media.id desc
  limit 1;

  insert into public.profile_public_cards(
    user_id, handle, display_name, avatar_media_id, public_profile_enabled, updated_at
  ) values (
    new.id, v_handle, nullif(pg_catalog.btrim(new.display_name), ''),
    v_avatar_media_id, false, pg_catalog.now()
  )
  on conflict (user_id) do update
  set handle = excluded.handle,
      display_name = excluded.display_name,
      avatar_media_id = excluded.avatar_media_id,
      updated_at = pg_catalog.now();

  insert into public.profile_handle_history(handle, profile_user_id)
  values (v_handle, new.id)
  on conflict (handle) do update
  set profile_user_id = case
        when public.profile_handle_history.profile_user_id = new.id then new.id
        else public.profile_handle_history.profile_user_id
      end,
      retired_at = case
        when public.profile_handle_history.profile_user_id = new.id then null
        else public.profile_handle_history.retired_at
      end,
      replaced_by_handle = case
        when public.profile_handle_history.profile_user_id = new.id then null
        else public.profile_handle_history.replaced_by_handle
      end;
  return new;
end;
$$;

alter function private.sync_profile_public_card() owner to postgres;
revoke all privileges on function private.sync_profile_public_card()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_profile_public_card on public.profiles;
create trigger sync_profile_public_card
after insert or update of username, display_name, avatar_url on public.profiles
for each row execute function private.sync_profile_public_card();

create or replace function private.sync_profile_public_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_avatar_media_id uuid;
begin
  select media.id into v_avatar_media_id
  from public.profile_media as media
  where media.user_id = v_user_id
    and media.media_type = 'avatar'
    and media.bucket = 'profile-avatars'
    and media.status = 'active'
    and media.storage_path like v_user_id::text || '/avatars/%'
    and media.storage_path !~ '(^|/)\.\.(/|$)'
    and media.storage_path !~ '[\\\\]'
  order by media.created_at desc, media.id desc
  limit 1;
  update public.profile_public_cards
  set avatar_media_id = v_avatar_media_id, updated_at = pg_catalog.now()
  where user_id = v_user_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function private.sync_profile_public_avatar() owner to postgres;
revoke all privileges on function private.sync_profile_public_avatar()
  from public, anon, authenticated, service_role;
drop trigger if exists sync_profile_public_avatar on public.profile_media;
create trigger sync_profile_public_avatar
after insert or update of status, storage_path, bucket, media_type or delete on public.profile_media
for each row execute function private.sync_profile_public_avatar();

drop policy if exists "public profile cards are readable" on public.profile_public_cards;
create policy "public profile cards are readable"
on public.profile_public_cards for select to anon, authenticated
using (
  user_id = auth.uid()
  or (public_profile_enabled and private.community_profile_is_public(user_id))
);

drop policy if exists "public handle redirects are readable" on public.profile_handle_history;
create policy "public handle redirects are readable"
on public.profile_handle_history for select to anon, authenticated
using (
  redirect_enabled
  and exists (
    select 1 from public.profile_public_cards as card
    where card.user_id = profile_handle_history.profile_user_id
      and card.public_profile_enabled
      and private.community_profile_is_public(card.user_id)
  )
);

-- Every cross-origin/public presentation must consume this one visibility-aware
-- projection. The physical card remains useful for owner/admin workflows, but
-- its optional display name and biography are never a public table contract.
create view private.community_safe_public_profile_cards
with (security_barrier = true)
as
select
  card.user_id,
  card.handle,
  case when coalesce(visibility.show_display_name, true)
    then card.display_name else null end as display_name,
  card.avatar_media_id,
  card.avatar_url,
  case when coalesce(visibility.show_bio, true)
    then card.short_public_bio else null end as short_public_bio,
  card.canonical_profile_url,
  card.public_profile_enabled,
  card.updated_at,
  coalesce(visibility.show_display_name, true) as show_display_name,
  coalesce(visibility.show_bio, true) as show_bio
from public.profile_public_cards as card
left join public.profile_visibility_settings as visibility
  on visibility.user_id = card.user_id
where card.public_profile_enabled
  and private.community_profile_is_public(card.user_id);

alter view private.community_safe_public_profile_cards owner to postgres;
revoke all on private.community_safe_public_profile_cards
  from public, anon, authenticated, service_role;

-- Prevent direct selection of the two visibility-controlled values. Public
-- callers use the bounded RPCs below; harmless identity/linkage columns remain
-- available for the existing profile-card RLS contract.
grant select (
  handle, avatar_media_id, avatar_url, canonical_profile_url,
  public_profile_enabled, updated_at
) on public.profile_public_cards to anon, authenticated;
grant select on public.profile_public_cards to service_role;
-- The physical history row carries profile_user_id. Public redirect resolution
-- is handle-only through resolve_public_profile_handle; raw history is trusted
-- service metadata.
grant select on public.profile_handle_history to service_role;

-- Retire the historical all-row profile policy. Authenticated users retain their
-- own full record; only legacy administrators receive cross-user full-profile
-- reads. Public and ordinary cross-user reads use profile_public_cards.
drop policy if exists "public profiles are readable" on public.profiles;
drop policy if exists "profile owners read own full profile" on public.profiles;
drop policy if exists "administrators read full profiles" on public.profiles;
revoke all on public.profiles from public, anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy "profile owners read own full profile"
on public.profiles for select to authenticated
using (id = auth.uid());
create policy "administrators read full profiles"
on public.profiles for select to authenticated
using (public.current_user_is_admin());

-- Raw profile-media rows include mutable URLs and object paths, so they are no
-- longer a public table contract. Owners retain only the DML used by Online;
-- public avatars are resolved through the bounded service RPC below.
drop policy if exists "public reads active profile media" on public.profile_media;
revoke all on public.profile_media from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.profile_media to authenticated;
grant all on public.profile_media to service_role;

create or replace function public.get_public_profile_avatar_asset(p_media_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'mediaId', media.id,
      'storageProvider', 'supabase',
      'bucket', media.bucket,
      'objectKey', media.storage_path,
      'deliveryMode', 'private_original_requires_safe_transform'
    )
    from public.profile_media as media
    join public.profile_public_cards as card on card.avatar_media_id = media.id
    where media.id = p_media_id
      and card.public_profile_enabled
      and private.community_profile_is_public(card.user_id)
      and media.user_id = card.user_id
      and media.media_type = 'avatar'
      and media.bucket = 'profile-avatars'
      and media.status = 'active'
      and media.storage_path like media.user_id::text || '/avatars/%'
      and media.storage_path !~ '(^|/)\.\.(/|$)'
      and media.storage_path !~ '[\\\\]'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_public_profile_avatar_asset(uuid) owner to postgres;
revoke all privileges on function public.get_public_profile_avatar_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile_avatar_asset(uuid) to service_role;

create or replace function public.get_public_commons_profile_presentation(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pg_catalog.jsonb_build_object(
      'profile', pg_catalog.jsonb_build_object(
        'handle', card.handle,
        'displayName', card.display_name,
        'avatarUrl', card.avatar_url,
        'shortPublicBio', card.short_public_bio,
        'canonicalProfileUrl', card.canonical_profile_url,
        'updatedAt', card.updated_at
      ),
      'visibility', pg_catalog.jsonb_build_object(
        'showDisplayName', coalesce(visibility.show_display_name, true),
        'showBio', coalesce(visibility.show_bio, true),
        'showInterests', coalesce(visibility.show_interests, true),
        'showWebsite', coalesce(visibility.show_website, true),
        'showGithub', coalesce(visibility.show_github, true),
        'showBadges', coalesce(visibility.show_badges, true),
        'showStewardshipRecognition', coalesce(visibility.show_stewardship_recognition, true),
        'showSavedAddons', coalesce(visibility.show_saved_addons, false),
        'showSavedSources', coalesce(visibility.show_saved_sources, false),
        'showSourceCollections', coalesce(visibility.show_source_collections, true),
        'showCommunePosts', coalesce(visibility.show_commune_posts, true),
        'showWorkWithStatus', coalesce(visibility.show_work_with_status, false),
        'showDeveloperStatus', coalesce(visibility.show_developer_status, true),
        'showMemberTier', coalesce(visibility.show_member_tier, true)
      ),
      'customization', pg_catalog.jsonb_build_object(
        'themeMode', case when customization.theme_mode = any(array[
          'deep_grove','starlit_archive','solar_meadow','moonlit_reef','aether_blue','high_contrast'
        ]::text[]) then customization.theme_mode else 'starlit_archive' end,
        'accentColor', case when customization.accent_color ~ '^#[0-9A-Fa-f]{6}$'
          then customization.accent_color else '#8ee8dc' end,
        'backgroundStyle', case when customization.background_style = any(array[
          'soft_cyber_garden','starfield_mantle','living_archive','clear_lantern',
          'mycelium_glow','watershed_mist','aurora_canopy','solar_restoration',
          'obsidian_laboratory','field_notebook'
        ]::text[]) then customization.background_style else 'soft_cyber_garden' end,
        'decalSet', case when customization.decal_set = any(array[
          'none','leaf_glyph','water_ripple','star_map','mushroom_badge','circuit_vine',
          'pollinator','wetland_reed','moon_crest','robotic_seed'
        ]::text[]) then customization.decal_set else 'none' end,
        'profileLayout', case when customization.profile_layout = any(array[
          'classic_homebase','compact_archive','garden_shelves','field_notebook_layout',
          'constellation_map','stewardship_board'
        ]::text[]) then customization.profile_layout else 'classic_homebase' end,
        'bannerZoom', least(greatest(coalesce(customization.banner_zoom, 1), 0.5), 2),
        'bannerPositionX', least(greatest(coalesce(customization.banner_position_x, 50), 0), 100),
        'bannerPositionY', least(greatest(coalesce(customization.banner_position_y, 50), 0), 100)
      ),
      'media', pg_catalog.jsonb_build_object(
        'avatarMediaId', card.avatar_media_id,
        'avatarUrl', card.avatar_url,
        'bannerMediaId', banner.id,
        'bannerUrl', case when banner.id is null then null
          else '/api/public/profile-banners/' || banner.id::text end
      ),
      'isOwner', coalesce(auth.uid() = card.user_id, false),
      'publicBadges', case when coalesce(visibility.show_badges, true) then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'badgeKey', badge.badge_key,
          'awardedAt', badge.awarded_at,
          'awardSource', badge.award_source,
          'visibility', badge.visibility
        ) order by badge.awarded_at desc, badge.badge_key)
        from public.user_badges as badge
        where badge.user_id = card.user_id
          and badge.visibility = 'public' and badge.revoked_at is null
      ), '[]'::jsonb) else '[]'::jsonb end,
      'publicSourceCollections', case when coalesce(visibility.show_source_collections, true) then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'collectionId', collection.id,
          'title', collection.title,
          'description', collection.description,
          'visibility', collection.visibility,
          'sourceCount', (
            select pg_catalog.count(*)
            from public.user_source_collection_items as item
            where item.collection_id = collection.id
          ),
          'createdAt', collection.created_at
        ) order by collection.created_at desc, collection.id)
        from (
          select source_collection.*
          from public.user_source_collections as source_collection
          where source_collection.user_id = card.user_id
            and source_collection.visibility = 'public'
          order by source_collection.created_at desc, source_collection.id
          limit 12
        ) as collection
      ), '[]'::jsonb) else '[]'::jsonb end,
      'publicCommunePosts', case when coalesce(visibility.show_commune_posts, true) then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'postId', post.id,
          'title', post.title,
          'postType', post.post_type,
          'excerpt', post.excerpt,
          'publishedAt', post.published_at,
          'createdAt', post.created_at
        ) order by post.published_at desc, post.id)
        from (
          select commune_post.*
          from public.commune_posts as commune_post
          where commune_post.user_id = card.user_id
            and commune_post.status::text = 'published'
            and commune_post.visibility::text = 'public'
            and coalesce(commune_post.visibility_state, 'published') not in (
              'flagged','hidden','removed','archived','revoked'
            )
            and commune_post.hidden_at is null
            and commune_post.removed_at is null
            and commune_post.archived_at is null
            and commune_post.revoked_at is null
          order by commune_post.published_at desc, commune_post.id
          limit 6
        ) as post
      ), '[]'::jsonb) else '[]'::jsonb end,
      'publicCommuneComments', case when coalesce(visibility.show_commune_posts, true) then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'commentId', comment.id,
          'postId', comment.post_id,
          'parentCommentId', comment.parent_comment_id,
          'body', comment.body,
          'publishedAt', comment.published_at,
          'createdAt', comment.created_at
        ) order by comment.published_at desc, comment.id)
        from (
          select commune_comment.*
          from public.commune_comments as commune_comment
          join public.commune_posts as parent_post
            on parent_post.id = commune_comment.post_id
          where commune_comment.user_id = card.user_id
            and commune_comment.status = 'published'
            and coalesce(commune_comment.visibility_state, 'published') = 'published'
            and commune_comment.hidden_at is null
            and commune_comment.removed_at is null
            and commune_comment.archived_at is null
            and parent_post.status::text = 'published'
            and parent_post.visibility::text = 'public'
            and coalesce(parent_post.visibility_state, 'published') not in (
              'flagged','hidden','removed','archived','revoked'
            )
            and parent_post.hidden_at is null
            and parent_post.removed_at is null
            and parent_post.archived_at is null
            and parent_post.revoked_at is null
          order by commune_comment.published_at desc, commune_comment.id
          limit 6
        ) as comment
      ), '[]'::jsonb) else '[]'::jsonb end
    )
    from private.community_safe_public_profile_cards as card
    join private.account_participation as participation on participation.user_id = card.user_id
    left join public.profile_visibility_settings as visibility on visibility.user_id = card.user_id
    left join public.profile_customization as customization on customization.user_id = card.user_id
    left join lateral (
      select media.id
      from public.profile_media as media
      where media.id = customization.banner_media_id
        and media.user_id = card.user_id and media.media_type = 'banner'
        and media.bucket = 'profile-banners' and media.status = 'active'
        and media.storage_path like card.user_id::text || '/banners/%'
        and media.storage_path !~ '(^|/)\.\.(/|$)' and media.storage_path !~ '[\\\\]'
      limit 1
    ) as banner on true
    where card.handle = pg_catalog.lower(pg_catalog.ltrim(coalesce(p_handle, ''), '@'))
  ), '{}'::jsonb);
$$;

alter function public.get_public_commons_profile_presentation(text) owner to postgres;
revoke all privileges on function public.get_public_commons_profile_presentation(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_commons_profile_presentation(text) to anon, authenticated, service_role;

create or replace function public.get_public_profile_banner_asset(p_media_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'mediaId', media.id, 'storageProvider', 'supabase',
      'bucket', media.bucket, 'objectKey', media.storage_path,
      'deliveryMode', 'private_original_requires_safe_transform'
    )
    from public.profile_media as media
    join public.profile_customization as customization
      on customization.user_id = media.user_id and customization.banner_media_id = media.id
    join public.profile_public_cards as card
      on card.user_id = media.user_id and card.public_profile_enabled
    where media.id = p_media_id and media.media_type = 'banner'
      and private.community_profile_is_public(card.user_id)
      and media.bucket = 'profile-banners' and media.status = 'active'
      and media.storage_path like media.user_id::text || '/banners/%'
      and media.storage_path !~ '(^|/)\.\.(/|$)' and media.storage_path !~ '[\\\\]'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_public_profile_banner_asset(uuid) owner to postgres;
revoke all privileges on function public.get_public_profile_banner_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile_banner_asset(uuid) to service_role;

create or replace function public.get_public_profile_card(p_handle text)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  short_public_bio text,
  canonical_profile_url text,
  public_profile_enabled boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    card.user_id, card.handle, card.display_name, card.avatar_url,
    card.short_public_bio, card.canonical_profile_url,
    card.public_profile_enabled, card.updated_at
  from private.community_safe_public_profile_cards as card
  where card.handle = pg_catalog.lower(pg_catalog.ltrim(coalesce(p_handle, ''), '@'))
  limit 1;
$$;

alter function public.get_public_profile_card(text) owner to postgres;
revoke all privileges on function public.get_public_profile_card(text)
  from public, anon, authenticated, service_role;
-- Legacy row-shaped lookup includes an internal UUID and is trusted-service
-- only. Browser presentation uses get_public_commons_profile_presentation.
grant execute on function public.get_public_profile_card(text) to service_role;

create or replace function public.get_public_profile_cards(p_user_ids uuid[])
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  short_public_bio text,
  canonical_profile_url text,
  public_profile_enabled boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    card.user_id, card.handle, card.display_name, card.avatar_url,
    card.short_public_bio, card.canonical_profile_url,
    card.public_profile_enabled, card.updated_at
  from private.community_safe_public_profile_cards as card
  where card.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
  order by card.handle
  limit 100;
$$;

alter function public.get_public_profile_cards(uuid[]) owner to postgres;
revoke all privileges on function public.get_public_profile_cards(uuid[])
  from public, anon, authenticated, service_role;
-- UUID-array hydration is an internal Worker optimization, never a browser API.
grant execute on function public.get_public_profile_cards(uuid[]) to service_role;

create or replace function public.resolve_public_profile_handle(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pg_catalog.jsonb_build_object(
      'requestedHandle', history.handle,
      'currentHandle', card.handle,
      'canonicalProfileUrl', card.canonical_profile_url,
      'redirect', history.handle <> card.handle
    )
    from public.profile_handle_history as history
    join public.profile_public_cards as card
      on card.user_id = history.profile_user_id and card.public_profile_enabled
     and private.community_profile_is_public(card.user_id)
    where history.handle = pg_catalog.lower(pg_catalog.ltrim(coalesce(p_handle, ''), '@'))
      and history.redirect_enabled
    limit 1
  ), '{}'::jsonb);
$$;

alter function public.resolve_public_profile_handle(text) owner to postgres;
revoke all privileges on function public.resolve_public_profile_handle(text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_public_profile_handle(text) to anon, authenticated, service_role;

create or replace function public.set_current_user_public_profile(
  p_client_request_id uuid,
  p_enabled boolean,
  p_short_public_bio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.profile_public_cards%rowtype;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id) then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'community_client_request_id_required';
  end if;
  if pg_catalog.char_length(coalesce(p_short_public_bio, '')) > 280 then
    raise exception using errcode = '22023', message = 'profile_public_bio_too_long';
  end if;
  if p_enabled and not private.community_can_publish_profile(v_user_id) then
    raise exception using errcode = '42501', message = 'profile_publication_not_permitted';
  end if;

  insert into private.profile_publication_events(
    client_request_id, user_id, enabled, short_public_bio
  ) values (
    p_client_request_id, v_user_id, p_enabled,
    nullif(pg_catalog.btrim(p_short_public_bio), '')
  ) on conflict (client_request_id) do nothing;

  if not found and not exists (
    select 1 from private.profile_publication_events as event
    where event.client_request_id = p_client_request_id
      and event.user_id = v_user_id
      and event.enabled = p_enabled
      and event.short_public_bio is not distinct from nullif(pg_catalog.btrim(p_short_public_bio), '')
  ) then
    raise exception using errcode = '23505', message = 'profile_publication_idempotency_conflict';
  end if;

  update public.profile_public_cards
  set public_profile_enabled = p_enabled,
      short_public_bio = nullif(pg_catalog.btrim(p_short_public_bio), ''),
      updated_at = pg_catalog.now()
  where user_id = v_user_id
  returning * into v_card;
  if not found then
    raise exception using errcode = '55000', message = 'profile_public_card_missing';
  end if;

  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    v_user_id, 'user', 'profile_publication_changed', 'profile_public_card',
    v_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('enabled', p_enabled)
  ) on conflict (request_id, action) where request_id is not null do nothing;

  return pg_catalog.jsonb_build_object(
    'handle', v_card.handle,
    'displayName', v_card.display_name,
    'avatarUrl', v_card.avatar_url,
    'shortPublicBio', v_card.short_public_bio,
    'canonicalProfileUrl', v_card.canonical_profile_url,
    'publicProfileEnabled', v_card.public_profile_enabled,
    'updatedAt', v_card.updated_at
  );
end;
$$;

alter function public.set_current_user_public_profile(uuid, boolean, text) owner to postgres;
revoke all privileges on function public.set_current_user_public_profile(uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_current_user_public_profile(uuid, boolean, text) to authenticated;

create or replace function public.current_user_community_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then '{}'::jsonb
    else pg_catalog.jsonb_build_object(
      'userId', participation.user_id,
      'participationState', participation.participation_state,
      'ageBand', participation.age_band,
      'assuranceStatus', participation.assurance_status,
      'assuranceExpiresAt', participation.assurance_expires_at,
      'jurisdictionCode', participation.jurisdiction_code,
      'publicProfileEnabled', coalesce(card.public_profile_enabled, false),
      'publicProfilePublished', coalesce(card.public_profile_enabled, false)
        and private.community_can_publish_profile(participation.user_id),
      'canPublishPublicProfile', private.community_can_publish_profile(participation.user_id),
      'profileComplete', card.user_id is not null,
      'canJoinArtisan', private.community_can_participate(participation.user_id, 'artisan_membership'),
      'canPostArtisan', private.community_can_participate(participation.user_id, 'artisan_post'),
      'canCommentArtisan', private.community_can_participate(participation.user_id, 'artisan_comment'),
      'canAppreciateArtisan', private.community_can_participate(participation.user_id, 'artisan_appreciate'),
      'canUploadImage', private.community_can_participate(participation.user_id, 'artisan_upload_image'),
      'canSubmitChallenge', private.community_can_participate(participation.user_id, 'artisan_submit_challenge'),
      'evaluatedAt', participation.evaluated_at
    )
  end
  from private.account_participation as participation
  left join public.profile_public_cards as card on card.user_id = participation.user_id
  where participation.user_id = auth.uid();
$$;

alter function public.current_user_community_access() owner to postgres;
revoke all privileges on function public.current_user_community_access()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_community_access() to authenticated;

create or replace function public.current_artisan_feature_manifest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_object_agg(flag.feature_key, flag.enabled order by flag.feature_key), '{}'::jsonb)
  from private.community_feature_flags as flag
  where flag.feature_key = any(array[
    'artisan_adult_closed_beta', 'artisan_teen_participation',
    'artisan_teen_public_profiles', 'artisan_under13_participation',
    'artisan_under13_public_profiles', 'artisan_under13_posting',
    'artisan_under13_commenting', 'artisan_under13_appreciation',
    'artisan_under13_media', 'artisan_under13_challenges',
    'artisan_guardian_sponsored_accounts', 'artisan_under13_content_approval',
    'artisan_guardian_dependent_profile_controls', 'artisan_guardian_dependent_lifecycle',
    'artisan_audio_media',
    'artisan_short_video_media', 'artisan_document_media',
    'artisan_animation_media', 'artisan_3d_media',
    'artisan_interactive_media', 'artisan_public_database_reads'
  ]::text[]);
$$;

alter function public.current_artisan_feature_manifest() owner to postgres;
revoke all privileges on function public.current_artisan_feature_manifest()
  from public, anon, authenticated, service_role;
grant execute on function public.current_artisan_feature_manifest() to anon, authenticated, service_role;

create or replace function public.accept_current_user_community_documents(
  p_client_request_id uuid,
  p_acceptances jsonb,
  p_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_active private.community_active_legal_documents%rowtype;
  v_document private.community_legal_document_versions%rowtype;
  v_supplied jsonb;
  v_count integer := 0;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id) then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  if p_client_request_id is null or pg_catalog.jsonb_typeof(p_acceptances) <> 'object' then
    raise exception using errcode = '22023', message = 'community_acceptance_payload_invalid';
  end if;
  if p_origin not in (
    'https://elysiaecobotics.com',
    'https://elysiaartisancollective.pages.dev',
    'https://artisans.elysiaecobotics.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ) then
    raise exception using errcode = '22023', message = 'community_acceptance_origin_invalid';
  end if;

  for v_active in
    select * from private.community_active_legal_documents
    where document_key = any(array[
      'community_terms', 'privacy_notice', 'community_guidelines',
      'moderation_policy', 'artist_platform_license', 'ai_authorship_policy'
    ]::text[])
    order by document_key
  loop
    select * into strict v_document
    from private.community_legal_document_versions
    where document_key = v_active.document_key
      and document_version = v_active.document_version
      and status = 'approved';
    v_supplied := p_acceptances -> v_active.document_key;
    if pg_catalog.jsonb_typeof(v_supplied) <> 'object'
       or v_supplied ->> 'version' <> v_document.document_version
       or coalesce(v_supplied ->> 'contentSha256', v_supplied ->> 'contentHash') <> v_document.content_sha256 then
      raise exception using errcode = '22023', message = 'community_acceptance_version_mismatch';
    end if;
    insert into private.community_terms_acceptances(
      client_request_id, user_id, document_key, document_version,
      content_sha256, accepted_origin
    ) values (
      p_client_request_id, v_user_id, v_document.document_key,
      v_document.document_version, v_document.content_sha256, p_origin
    ) on conflict (client_request_id, document_key) do nothing;
    v_count := v_count + 1;
  end loop;
  if v_count <> 6 then
    raise exception using errcode = '55000', message = 'community_active_document_set_incomplete';
  end if;
  perform private.recompute_community_participation(v_user_id);
  return public.current_user_community_access();
end;
$$;

alter function public.accept_current_user_community_documents(uuid, jsonb, text) owner to postgres;
revoke all privileges on function public.accept_current_user_community_documents(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.accept_current_user_community_documents(uuid, jsonb, text) to authenticated;

create or replace function public.request_current_user_community_lifecycle_action(
  p_client_request_id uuid,
  p_action text,
  p_notice_version text,
  p_user_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request private.account_lifecycle_requests%rowtype;
  v_action text := case p_action
    when 'export' then 'data_export'
    when 'deletion' then 'account_deletion'
    when 'deactivation' then 'account_deactivation'
    when 'reactivation' then 'account_reactivation'
    else p_action
  end;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id) then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  if v_action not in ('data_export', 'account_deletion', 'account_deactivation', 'account_reactivation') then
    raise exception using errcode = '22023', message = 'community_lifecycle_action_invalid';
  end if;
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_notice_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_user_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'community_lifecycle_request_invalid';
  end if;

  insert into private.account_lifecycle_requests(
    client_request_id, user_id, action, notice_version, user_note,
    cooling_period_ends_at
  ) values (
    p_client_request_id, v_user_id, v_action, p_notice_version,
    nullif(pg_catalog.btrim(p_user_note), ''),
    case when v_action in ('account_deletion', 'account_deactivation')
      then pg_catalog.now() + interval '14 days' else null end
  )
  on conflict (client_request_id) do nothing
  returning * into v_request;
  if not found then
    select * into strict v_request
    from private.account_lifecycle_requests
    where client_request_id = p_client_request_id and user_id = v_user_id;
    if v_request.action <> v_action or v_request.notice_version <> p_notice_version
       or v_request.user_note is distinct from nullif(pg_catalog.btrim(p_user_note), '') then
      raise exception using errcode = '23505', message = 'community_lifecycle_idempotency_conflict';
    end if;
  else
    insert into private.account_lifecycle_events(
      client_request_id, request_id, actor_user_id, action,
      to_status, private_reason
    ) values (
      p_client_request_id, v_request.id, v_user_id, 'request_submitted',
      'submitted', 'Current user submitted a community account lifecycle request.'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'requestId', v_request.id,
    'action', v_request.action,
    'status', v_request.status,
    'submittedAt', v_request.submitted_at,
    'coolingPeriodEndsAt', v_request.cooling_period_ends_at
  );
end;
$$;

alter function public.request_current_user_community_lifecycle_action(uuid, text, text, text) owner to postgres;
revoke all privileges on function public.request_current_user_community_lifecycle_action(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_current_user_community_lifecycle_action(uuid, text, text, text) to authenticated;

create or replace function public.bootstrap_community_capability_operator(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.community_capability_assignments%rowtype;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  if p_actor_aal <> 'aal2' then
    raise exception using errcode = '42501', message = 'community_operator_aal2_required';
  end if;
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_operator_bootstrap_invalid';
  end if;
  if not private.community_account_is_recoverable(p_actor_user_id)
     or not public.has_role(p_actor_user_id, 'administrator'::public.app_role)
     or not coalesce((select profile.is_admin from public.profiles as profile where profile.id = p_actor_user_id), false) then
    raise exception using errcode = '42501', message = 'community_operator_bootstrap_admin_required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('community-capability-bootstrap', 0));
  if exists (
    select 1 from private.community_capability_assignments as assignment
    where assignment.capability = 'community_capabilities_manage'
      and assignment.revoked_at is null
      and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
  ) then
    raise exception using errcode = '55000', message = 'community_operator_bootstrap_closed';
  end if;
  insert into private.community_capability_assignments(
    user_id, capability, granted_by, reason
  ) values (
    p_actor_user_id, 'community_capabilities_manage', p_actor_user_id,
    pg_catalog.btrim(p_private_reason)
  ) returning * into v_assignment;
  insert into private.community_capability_actions(
    client_request_id, assignment_id, target_user_id, capability,
    action, actor_user_id, private_reason
  ) values (
    p_client_request_id, v_assignment.id, p_actor_user_id,
    v_assignment.capability, 'granted', p_actor_user_id,
    pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason
  ) values (
    p_actor_user_id, 'staff', 'community_capabilities_manage',
    'community_capability_operator_bootstrapped', 'community_capability_assignment',
    v_assignment.id, p_client_request_id, pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object('assignmentId', v_assignment.id, 'capability', v_assignment.capability);
end;
$$;

alter function public.bootstrap_community_capability_operator(uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.bootstrap_community_capability_operator(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bootstrap_community_capability_operator(uuid, text, uuid, text) to service_role;

create or replace function public.set_community_capability_assignment(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_target_user_id uuid,
  p_capability text,
  p_enabled boolean,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.community_capability_assignments%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_capabilities_manage');
  if p_client_request_id is null or not private.community_account_is_recoverable(p_target_user_id)
     or not exists (select 1 from private.community_capability_catalog where capability = p_capability and active)
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_capability_assignment_invalid';
  end if;
  if p_enabled then
    insert into private.community_capability_assignments(
      user_id, capability, granted_by, reason, expires_at
    ) values (
      p_target_user_id, p_capability, p_actor_user_id,
      pg_catalog.btrim(p_private_reason), p_expires_at
    ) returning * into v_assignment;
    insert into private.community_capability_actions(
      client_request_id, assignment_id, target_user_id, capability,
      action, actor_user_id, private_reason
    ) values (
      p_client_request_id, v_assignment.id, p_target_user_id, p_capability,
      'granted', p_actor_user_id, pg_catalog.btrim(p_private_reason)
    );
  else
    select * into strict v_assignment
    from private.community_capability_assignments
    where user_id = p_target_user_id and capability = p_capability and revoked_at is null
    for update;
    if p_target_user_id = p_actor_user_id and p_capability = 'community_capabilities_manage'
       and not exists (
         select 1 from private.community_capability_assignments as other
         where other.capability = 'community_capabilities_manage'
           and other.revoked_at is null and other.user_id <> p_actor_user_id
           and (other.expires_at is null or other.expires_at > pg_catalog.now())
       ) then
      raise exception using errcode = '55000', message = 'community_last_capability_manager_required';
    end if;
    update private.community_capability_assignments
    set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
        revocation_reason = pg_catalog.btrim(p_private_reason)
    where id = v_assignment.id
    returning * into v_assignment;
    insert into private.community_capability_actions(
      client_request_id, assignment_id, target_user_id, capability,
      action, actor_user_id, private_reason
    ) values (
      p_client_request_id, v_assignment.id, p_target_user_id, p_capability,
      'revoked', p_actor_user_id, pg_catalog.btrim(p_private_reason)
    );
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_capabilities_manage',
    case when p_enabled then 'community_capability_granted' else 'community_capability_revoked' end,
    'community_capability_assignment', v_assignment.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('targetUserId', p_target_user_id, 'capability', p_capability)
  );
  return pg_catalog.jsonb_build_object(
    'assignmentId', v_assignment.id, 'targetUserId', p_target_user_id,
    'capability', p_capability, 'enabled', p_enabled
  );
end;
$$;

alter function public.set_community_capability_assignment(uuid, text, uuid, uuid, text, boolean, timestamptz, text) owner to postgres;
revoke all privileges on function public.set_community_capability_assignment(uuid, text, uuid, uuid, text, boolean, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_community_capability_assignment(uuid, text, uuid, uuid, text, boolean, timestamptz, text) to service_role;

create or replace function public.record_community_age_provider_result(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_target_user_id uuid,
  p_client_request_id uuid,
  p_age_band text,
  p_assurance_status text,
  p_provider text,
  p_provider_reference_sha256 text,
  p_jurisdiction_code text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_age_assurance_manage');
  if not private.community_account_is_recoverable(p_target_user_id)
     or p_client_request_id is null
     or p_age_band not in ('unknown', 'under_13', '13_to_15', '16_to_17', '18_plus')
     or p_assurance_status not in ('self_attested', 'age_estimated', 'age_verified', 'guardian_verified', 'verification_expired', 'restricted', 'blocked')
     or coalesce(p_provider, '') !~ '^[a-z][a-z0-9_-]{1,80}$'
     or coalesce(p_provider_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_age_provider_result_invalid';
  end if;
  insert into private.age_assurance_events(
    client_request_id, user_id, actor_user_id, provider,
    provider_reference_sha256, age_band, assurance_status,
    jurisdiction_code, expires_at, private_reason
  ) values (
    p_client_request_id, p_target_user_id, p_actor_user_id, p_provider,
    p_provider_reference_sha256, p_age_band, p_assurance_status,
    p_jurisdiction_code, p_expires_at, pg_catalog.btrim(p_private_reason)
  );
  update private.account_participation
  set age_band = p_age_band,
      assurance_status = p_assurance_status,
      assurance_method = case when p_provider = 'self_attestation' then 'self_attestation' else 'provider_age_check' end,
      assurance_provider = p_provider,
      jurisdiction_code = p_jurisdiction_code,
      assurance_expires_at = p_expires_at,
      participation_state = case
        when p_assurance_status = 'blocked' then 'blocked'
        when p_assurance_status = 'restricted' then 'restricted'
        when p_age_band in ('13_to_15','16_to_17') then 'teen_pending'
        when p_age_band = 'under_13' then 'under13_pending'
        else 'read_only'
      end,
      evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = p_target_user_id;
  v_state := private.recompute_community_participation(p_target_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_age_assurance_manage',
    'community_age_result_recorded', 'account_participation', p_target_user_id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('ageBand', p_age_band, 'assuranceStatus', p_assurance_status, 'provider', p_provider)
  );
  return pg_catalog.jsonb_build_object('userId', p_target_user_id, 'participationState', v_state, 'ageBand', p_age_band, 'assuranceStatus', p_assurance_status);
end;
$$;

alter function public.record_community_age_provider_result(uuid, text, uuid, uuid, text, text, text, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.record_community_age_provider_result(uuid, text, uuid, uuid, text, text, text, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_community_age_provider_result(uuid, text, uuid, uuid, text, text, text, text, text, timestamptz, text) to service_role;

create or replace function private.bootstrap_community_account_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.account_participation(user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into private.community_notification_preferences(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

alter function private.bootstrap_community_account_state() owner to postgres;
revoke all privileges on function private.bootstrap_community_account_state()
  from public, anon, authenticated, service_role;

drop trigger if exists bootstrap_community_account_state on auth.users;
create trigger bootstrap_community_account_state
after insert on auth.users
for each row execute function private.bootstrap_community_account_state();

insert into private.account_participation(user_id)
select account.id from auth.users as account
on conflict (user_id) do nothing;
insert into private.community_notification_preferences(user_id)
select account.id from auth.users as account
on conflict (user_id) do nothing;

comment on table public.profile_public_cards is
  'Minimal cross-origin public Commons identity contract. Never add email, age, internal roles, moderation, recovery, billing, or private profile data.';
comment on table private.account_participation is
  'Canonical server-owned participation and age-band state shared by public Elysia community surfaces.';
comment on table private.guardian_consents is
  'Scope-specific, version-bound, expiring guardian consent. A relationship alone never grants participation.';
comment on table private.community_feature_flags is
  'Fail-closed activation gates. Repository presence never proves legal, staffing, provider, or hosted-service readiness.';

commit;

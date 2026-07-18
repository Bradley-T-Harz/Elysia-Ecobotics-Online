-- Canonical Artisan Collective domain schema. Identity, age, terms, guardian,
-- restrictions, and account lifecycle remain shared private truth; this schema
-- stores only Artisan membership, creative work, community, challenge, media,
-- moderation, attribution, notification, and retention state.

begin;

create schema if not exists artisan;
alter schema artisan owner to postgres;
revoke all on schema artisan from public, anon, authenticated;

create or replace function private.artisan_caption_tracks_are_safe(p_tracks jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_tracks is null or pg_catalog.jsonb_typeof(p_tracks) <> 'array' then false
    else pg_catalog.jsonb_array_length(p_tracks) <= 20
      and pg_catalog.char_length(p_tracks::text) <= 10000
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_tracks) as track(value)
        where case
          when pg_catalog.jsonb_typeof(track.value) <> 'object' then true
          else coalesce(track.value ->> 'language', '') !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
            or coalesce(track.value ->> 'kind', '') not in ('captions','subtitles')
            or pg_catalog.char_length(coalesce(track.value ->> 'label', '')) not between 1 and 80
            or exists (
            select 1 from pg_catalog.jsonb_object_keys(track.value) as key
            where key not in ('id','language','kind','label')
            )
            or coalesce(track.value ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        end
      )
  end;
$$;

alter function private.artisan_caption_tracks_are_safe(jsonb) owner to postgres;
revoke all privileges on function private.artisan_caption_tracks_are_safe(jsonb)
  from public, anon, authenticated, service_role;

-- Discovery tags are deliberately small canonical slugs. Arrays are kept on
-- the owned content rows so tag changes participate in the same moderation,
-- guardian-approval revision, export, and deletion lifecycle as the content.
create or replace function private.artisan_discovery_tags_are_valid(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    pg_catalog.cardinality(p_tags) between 0 and 12
    and (select pg_catalog.count(distinct tag) from pg_catalog.unnest(p_tags) as tag)
      = pg_catalog.cardinality(p_tags)
    and p_tags = coalesce((
      select pg_catalog.array_agg(tag order by tag)
      from pg_catalog.unnest(p_tags) as tag
    ), '{}'::text[])
    and not exists (
      select 1 from pg_catalog.unnest(p_tags) as tag
      where tag !~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'
    ),
    false
  );
$$;

alter function private.artisan_discovery_tags_are_valid(text[]) owner to postgres;
revoke all privileges on function private.artisan_discovery_tags_are_valid(text[])
  from public, anon, authenticated, service_role;

create table artisan.invitations (
  id uuid primary key default gen_random_uuid(),
  invitation_code_sha256 text not null unique,
  invited_user_id uuid references auth.users(id) on delete restrict,
  invited_email_sha256 text,
  status text not null default 'issued',
  maximum_uses integer not null default 1,
  use_count integer not null default 0,
  issued_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint artisan_invitation_code_hash_check check (invitation_code_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_invitation_email_hash_check check (invited_email_sha256 is null or invited_email_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_invitation_status_check check (status in ('issued', 'consumed', 'expired', 'revoked')),
  constraint artisan_invitation_use_check check (maximum_uses between 1 and 100 and use_count between 0 and maximum_uses),
  constraint artisan_invitation_reason_check check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint artisan_invitation_revoke_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by is not null)
    or (status <> 'revoked' and revoked_at is null and revoked_by is null)
  )
);

create table artisan.memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null default 'active',
  invitation_id uuid references artisan.invitations(id) on delete restrict,
  joined_at timestamptz not null default now(),
  paused_at timestamptz,
  closed_at timestamptz,
  default_credit_line text,
  default_creation_method text,
  default_license_code text not null default 'all_rights_reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_membership_status_check check (status in ('active', 'paused', 'suspended', 'closed')),
  constraint artisan_membership_credit_check check (default_credit_line is null or pg_catalog.char_length(default_credit_line) <= 160),
  constraint artisan_membership_creation_method_check check (
    default_creation_method is null or default_creation_method in (
      'human_created', 'ai_assisted', 'ai_generated_human_directed',
      'hybrid_mixed_process', 'procedural_generative', 'undisclosed_legacy'
    )
  ),
  constraint artisan_membership_license_check check (
    default_license_code in ('all_rights_reserved', 'cc_by_4_0', 'cc_by_sa_4_0', 'cc0_1_0', 'elysia_display_license')
  )
);

create table artisan.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete restrict,
  blocked_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint artisan_user_blocks_distinct_check check (blocker_user_id <> blocked_user_id)
);

create table artisan.media_adapters (
  adapter_key text primary key,
  media_kind text not null,
  enabled boolean not null default false,
  feature_flag_key text,
  allowed_mime_types text[] not null,
  allowed_extensions text[] not null,
  maximum_bytes bigint not null,
  maximum_width integer,
  maximum_height integer,
  maximum_pixels bigint,
  maximum_duration_seconds numeric(10,3),
  validator_key text not null,
  sanitizer_key text not null,
  previewer_key text not null,
  accessibility_requirements jsonb not null,
  moderation_requirements jsonb not null,
  retention_days integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_media_adapter_key_check check (adapter_key ~ '^[a-z][a-z0-9_]{2,80}$'),
  constraint artisan_media_adapter_kind_check check (media_kind in ('image', 'audio', 'video', 'document', 'animation', 'model_3d', 'interactive')),
  constraint artisan_media_adapter_size_check check (maximum_bytes between 1024 and 1073741824),
  constraint artisan_media_adapter_dimension_check check (
    (maximum_width is null or maximum_width between 1 and 32768)
    and (maximum_height is null or maximum_height between 1 and 32768)
    and (maximum_pixels is null or maximum_pixels between 1 and 268435456)
  ),
  constraint artisan_media_adapter_duration_check check (maximum_duration_seconds is null or maximum_duration_seconds between 0.1 and 3600),
  constraint artisan_media_adapter_requirements_check check (
    pg_catalog.jsonb_typeof(accessibility_requirements) = 'object'
    and pg_catalog.jsonb_typeof(moderation_requirements) = 'object'
  ),
  constraint artisan_media_adapter_retention_check check (retention_days between 1 and 365)
);

insert into artisan.media_adapters(
  adapter_key, media_kind, enabled, feature_flag_key,
  allowed_mime_types, allowed_extensions, maximum_bytes,
  maximum_width, maximum_height, maximum_pixels, maximum_duration_seconds,
  validator_key, sanitizer_key, previewer_key,
  accessibility_requirements, moderation_requirements, retention_days
)
values
  ('image_static', 'image', true, null,
    array['image/jpeg','image/png','image/webp'], array['jpg','jpeg','png','webp'],
    26214400, 12000, 12000, 72000000, null,
    'image_magic_decode_v1', 'image_strip_reencode_v1', 'image_derivatives_v1',
    '{"altTextRequired":true,"decorativeAllowed":true,"autoplay":false}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"policyReview":true,"csamEscalation":true}'::jsonb, 30),
  ('audio', 'audio', false, 'artisan_audio_media',
    array['audio/mpeg','audio/ogg','audio/wav','audio/mp4'], array['mp3','ogg','wav','m4a'],
    52428800, null, null, null, 600,
    'audio_probe_decode_v1', 'audio_strip_transcode_v1', 'audio_waveform_v1',
    '{"descriptionRequired":true,"transcriptWhenSpoken":true,"noAutoplay":true,"loudnessControl":true}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"audioPolicyReview":true}'::jsonb, 14),
  ('short_video', 'video', false, 'artisan_short_video_media',
    array['video/mp4','video/webm'], array['mp4','webm'],
    104857600, 3840, 2160, 8294400, 180,
    'video_probe_decode_v1', 'video_safe_transcode_v1', 'video_poster_v1',
    '{"captionsOrTranscriptRequired":true,"posterRequired":true,"noAutoplay":true,"flashAnalysisRequired":true}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"frameSampling":true,"audioPolicyReview":true}'::jsonb, 14),
  ('pdf_document', 'document', false, 'artisan_document_media',
    array['application/pdf'], array['pdf'],
    26214400, null, null, null, null,
    'pdf_structure_v1', 'pdf_active_content_strip_v1', 'pdf_raster_preview_v1',
    '{"descriptionRequired":true,"accessibleTextOrTranscriptRequired":true,"pageLimit":100}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"activeContentRejected":true}'::jsonb, 14),
  ('animation', 'animation', false, 'artisan_animation_media',
    array['video/webm','video/mp4'], array['webm','mp4'],
    52428800, 1920, 1080, 2073600, 60,
    'animation_probe_v1', 'animation_safe_transcode_v1', 'animation_poster_v1',
    '{"descriptionRequired":true,"noAutoplay":true,"flashAnalysisRequired":true}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"frameSampling":true}'::jsonb, 14),
  ('model_3d', 'model_3d', false, 'artisan_3d_media',
    array['model/gltf+json','model/gltf-binary'], array['gltf','glb'],
    52428800, null, null, null, null,
    'gltf_resource_limits_v1', 'gltf_external_reference_strip_v1', 'gltf_turntable_preview_v1',
    '{"textDescriptionRequired":true,"staticPreviewRequired":true,"keyboardViewerRequired":true}'::jsonb,
    '{"premoderation":true,"malwareScan":true,"externalResourcesRejected":true,"scriptsRejected":true}'::jsonb, 14),
  ('interactive_work', 'interactive', false, 'artisan_interactive_media',
    array['application/vnd.elysia.artisan-interactive+json'], array['elysia-interactive.json'],
    262144, 1920, 1080, 2073600, 120,
    'elysia_declarative_scene_v1', 'elysia_declarative_scene_sanitize_v1', 'elysia_scene_video_preview_v1',
    '{"keyboardRequired":true,"textAlternativeRequired":true,"reducedMotionRequired":true,"staticPreviewRequired":true}'::jsonb,
    '{"premoderation":true,"noNetwork":true,"noScript":true,"noIframe":true,"resourceBudgetRequired":true}'::jsonb, 7)
on conflict (adapter_key) do nothing;

create table artisan.artworks (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique,
  title text not null,
  description text,
  artist_statement text,
  creation_method text not null,
  human_contribution_note text,
  credit_line text not null,
  credited_name_or_pseudonym text,
  preferred_profile_url text,
  license_code text not null default 'all_rights_reserved',
  download_allowed boolean not null default false,
  alt_text text not null,
  content_warnings text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  status text not null default 'draft',
  moderation_status text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  removed_at timestamptz,
  constraint artisan_artwork_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  constraint artisan_artwork_title_check check (pg_catalog.char_length(title) between 1 and 180),
  constraint artisan_artwork_description_check check (description is null or pg_catalog.char_length(description) <= 10000),
  constraint artisan_artwork_statement_check check (artist_statement is null or pg_catalog.char_length(artist_statement) <= 10000),
  constraint artisan_artwork_creation_method_check check (
    creation_method in ('human_created', 'ai_assisted', 'ai_generated_human_directed', 'hybrid_mixed_process', 'procedural_generative', 'undisclosed_legacy')
  ),
  constraint artisan_artwork_human_note_check check (
    (creation_method = 'human_created' and human_contribution_note is null)
    or (creation_method <> 'human_created' and pg_catalog.char_length(coalesce(human_contribution_note, '')) between 8 and 2000)
  ),
  constraint artisan_artwork_credit_check check (pg_catalog.char_length(credit_line) between 1 and 200),
  constraint artisan_artwork_license_check check (license_code in ('all_rights_reserved', 'cc_by_4_0', 'cc_by_sa_4_0', 'cc0_1_0', 'elysia_display_license')),
  constraint artisan_artwork_alt_text_check check (pg_catalog.char_length(alt_text) between 1 and 2000),
  constraint artisan_artwork_warnings_check check (
    content_warnings <@ array['flashing_or_motion','horror_or_disturbing_imagery','non_graphic_violence','grief_or_death','political_or_social_conflict','loud_audio']::text[]
  ),
  constraint artisan_artwork_tags_check check (private.artisan_discovery_tags_are_valid(tags)),
  constraint artisan_artwork_status_check check (status in ('draft', 'processing', 'pending_review', 'changes_requested', 'approved', 'published', 'archived', 'removed', 'appealed')),
  constraint artisan_artwork_moderation_check check (moderation_status in ('unreviewed', 'pending', 'approved', 'changes_requested', 'rejected', 'removed', 'legal_hold')),
  constraint artisan_artwork_publish_check check ((status = 'published' and published_at is not null and moderation_status = 'approved') or status <> 'published')
);

create index artisan_artworks_owner_created_idx on artisan.artworks(owner_user_id, created_at desc);
create index artisan_artworks_public_idx on artisan.artworks(published_at desc, id) where status = 'published' and moderation_status = 'approved';
create index artisan_artworks_tags_idx on artisan.artworks using gin(tags)
  where status = 'published' and moderation_status = 'approved';

create table artisan.artwork_credits (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  credited_user_id uuid references auth.users(id) on delete restrict,
  credited_name text not null,
  profile_url text,
  role text not null,
  display_order integer not null default 0,
  confirmation_status text not null default 'not_required',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint artisan_credit_name_check check (pg_catalog.char_length(credited_name) between 1 and 160),
  constraint artisan_credit_profile_url_check check (
    profile_url is null or profile_url ~ '^https://elysiaecobotics\.com/commons-circle/@[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
  ),
  constraint artisan_credit_role_check check (role in ('artist','illustrator','photographer','model','editor','prompt_designer','composer','animator','curator','writer','other')),
  constraint artisan_credit_order_check check (display_order between 0 and 100),
  constraint artisan_credit_confirmation_check check (confirmation_status in ('not_required','pending','confirmed','declined'))
  ,constraint artisan_credit_linked_role_unique unique (artwork_id, credited_user_id, role)
);

create table artisan.artwork_collaborators (
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  collaborator_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  status text not null default 'pending',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (artwork_id, collaborator_user_id),
  constraint artisan_collaborator_role_check check (role in ('artist','illustrator','photographer','model','editor','prompt_designer','composer','animator','curator','writer','other')),
  constraint artisan_collaborator_status_check check (status in ('pending','accepted','declined','removed')),
  constraint artisan_collaborator_response_check check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted','declined','removed') and responded_at is not null)
  )
);

create table artisan.artwork_licenses (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  license_code text not null,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null,
  scope text not null default 'artisan_display',
  accepted_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  terminated_at timestamptz,
  termination_reason text,
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version) on delete restrict,
  constraint artisan_artwork_license_code_check check (license_code in ('all_rights_reserved', 'cc_by_4_0', 'cc_by_sa_4_0', 'cc0_1_0', 'elysia_display_license', 'winner_usage_agreement')),
  constraint artisan_artwork_license_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_artwork_license_scope_check check (scope in ('artisan_display','challenge_entry','winner_usage','online_placement')),
  constraint artisan_artwork_license_termination_check check ((terminated_at is null and termination_reason is null) or (terminated_at is not null and pg_catalog.char_length(termination_reason) between 8 and 1000))
);

create table artisan.artwork_provenance_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint artisan_provenance_event_type_check check (event_type in ('created','creation_method_changed','media_added','media_replaced','credit_changed','license_changed','challenge_associated','submitted','approved','published','archived','removed')),
  constraint artisan_provenance_metadata_check check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create table artisan.media_assets (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  adapter_key text not null references artisan.media_adapters(adapter_key) on delete restrict,
  storage_provider text not null default 'supabase',
  quarantine_bucket text not null default 'artisan-quarantine',
  private_object_key text not null unique,
  approved_bucket text,
  approved_object_key text unique,
  approved_mime text,
  thumbnail_bucket text,
  thumbnail_object_key text unique,
  thumbnail_mime text,
  original_filename text,
  declared_mime text not null,
  detected_mime text,
  expected_bytes bigint not null,
  byte_size bigint,
  width integer,
  height integer,
  duration_seconds numeric(10,3),
  declared_checksum_sha256 text,
  detected_checksum_sha256 text,
  approved_checksum_sha256 text,
  thumbnail_checksum_sha256 text,
  processing_status text not null default 'upload_authorized',
  moderation_status text not null default 'unreviewed',
  metadata_stripped boolean not null default false,
  accessibility_description text not null,
  transcript text,
  audio_description text,
  keyboard_instructions text,
  static_equivalent_description text,
  captions_object_key text,
  caption_tracks jsonb not null default '[]'::jsonb,
  flash_warning boolean not null default false,
  loud_audio_warning boolean not null default false,
  upload_expires_at timestamptz not null,
  uploaded_at timestamptz,
  processed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  rejected_at timestamptz,
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_media_storage_provider_check check (storage_provider in ('supabase','r2')),
  constraint artisan_media_quarantine_bucket_check check (quarantine_bucket = 'artisan-quarantine'),
  constraint artisan_media_private_key_check check (private_object_key !~ '(^|/)\.\.(/|$)' and private_object_key !~ '[\\\\]'),
  constraint artisan_media_mime_check check (declared_mime ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$' and (detected_mime is null or detected_mime ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$')),
  constraint artisan_media_derivative_mime_check check (
    (approved_mime is null or approved_mime ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$')
    and (thumbnail_mime is null or thumbnail_mime in ('image/jpeg','image/webp'))
  ),
  constraint artisan_media_size_check check (expected_bytes > 0 and (byte_size is null or byte_size > 0)),
  constraint artisan_media_checksum_check check (
    (declared_checksum_sha256 is null or declared_checksum_sha256 ~ '^[0-9a-f]{64}$')
    and (detected_checksum_sha256 is null or detected_checksum_sha256 ~ '^[0-9a-f]{64}$')
    and (approved_checksum_sha256 is null or approved_checksum_sha256 ~ '^[0-9a-f]{64}$')
    and (thumbnail_checksum_sha256 is null or thumbnail_checksum_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint artisan_media_processing_status_check check (
    processing_status in ('upload_authorized','uploaded','type_validating','decoded','metadata_stripped','reencoded','thumbnail_created','scanning','pending_review','approved','published','validation_failed','processing_failed','quarantined','rejected','expired','removed')
  ),
  constraint artisan_media_moderation_status_check check (moderation_status in ('unreviewed','pending','approved','rejected','quarantined','removed','legal_hold')),
  constraint artisan_media_accessibility_check check (pg_catalog.char_length(accessibility_description) between 1 and 4000),
  constraint artisan_media_extended_accessibility_check check (
    (transcript is null or pg_catalog.char_length(transcript) between 1 and 30000)
    and (audio_description is null or pg_catalog.char_length(audio_description) between 1 and 10000)
    and (keyboard_instructions is null or pg_catalog.char_length(keyboard_instructions) between 1 and 5000)
    and (static_equivalent_description is null or pg_catalog.char_length(static_equivalent_description) between 1 and 10000)
  ),
  constraint artisan_media_caption_tracks_check check (
    private.artisan_caption_tracks_are_safe(caption_tracks)
  ),
  constraint artisan_media_publication_check check (
    (processing_status = 'published' and moderation_status = 'approved'
      and approved_object_key is not null and approved_checksum_sha256 is not null and approved_mime is not null
      and thumbnail_object_key is not null and thumbnail_checksum_sha256 is not null and thumbnail_mime is not null
      and metadata_stripped and published_at is not null)
    or processing_status <> 'published'
  )
);

create index artisan_media_owner_created_idx on artisan.media_assets(owner_user_id, created_at desc);
create index artisan_media_processing_queue_idx on artisan.media_assets(processing_status, created_at) where processing_status not in ('published','rejected','expired','removed');
create index artisan_media_retention_idx on artisan.media_assets(retention_expires_at) where retention_expires_at is not null and processing_status <> 'published';

-- Caption derivatives are normalized so a public UUID can never be confused
-- with a private Storage key. Workers resolve a single ready track through a
-- service-only RPC; public projections expose only UUID-derived same-origin
-- paths plus the bounded language and label metadata.
create table artisan.media_caption_tracks (
  id uuid primary key,
  media_asset_id uuid not null references artisan.media_assets(id) on delete restrict,
  language text not null,
  kind text not null,
  label text not null,
  approved_bucket text not null default 'artisan-approved',
  approved_object_key text not null,
  checksum_sha256 text not null,
  mime_type text not null default 'text/vtt',
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_asset_id, id),
  constraint artisan_caption_language_check check (language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  constraint artisan_caption_kind_check check (kind in ('captions','subtitles')),
  constraint artisan_caption_label_check check (pg_catalog.char_length(label) between 1 and 80),
  constraint artisan_caption_bucket_check check (approved_bucket = 'artisan-approved'),
  constraint artisan_caption_key_check check (
    approved_object_key !~ '(^|/)\.\.(/|$)'
    and approved_object_key !~ '[\\\\]'
    and pg_catalog.char_length(approved_object_key) between 48 and 500
  ),
  constraint artisan_caption_checksum_check check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_caption_mime_check check (mime_type = 'text/vtt'),
  constraint artisan_caption_status_check check (status in ('ready','rejected','removed'))
);

create index artisan_media_caption_tracks_asset_idx
  on artisan.media_caption_tracks(media_asset_id, language, id)
  where status = 'ready';

create table artisan.media_processing_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  media_asset_id uuid not null references artisan.media_assets(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  from_status text,
  to_status text not null,
  validator_key text,
  sanitizer_key text,
  result_sha256 text,
  private_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint artisan_media_event_actor_check check (actor_kind in ('owner','processor','moderator','system')),
  constraint artisan_media_event_result_hash_check check (result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_media_event_reason_check check (private_reason is null or pg_catalog.char_length(private_reason) between 8 and 2000),
  constraint artisan_media_event_metadata_check check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

-- Transactional outbox. Upload completion and job creation occur in the same
-- database transaction; Queue delivery is only a wake-up signal. Scheduled
-- reconciliation can safely recover queued or expired claims.
create table artisan.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null unique references artisan.media_assets(id) on delete restrict,
  status text not null default 'queued',
  revision integer not null default 1,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_media_job_status_check check (status in ('queued','claimed','completed','dead_letter')),
  constraint artisan_media_job_revision_check check (revision between 1 and 2147483647),
  constraint artisan_media_job_attempt_check check (attempt_count between 0 and 100),
  constraint artisan_media_job_claim_check check (
    (status = 'claimed' and claimed_by is not null and claimed_at is not null and lease_expires_at is not null)
    or status <> 'claimed'
  ),
  constraint artisan_media_job_completion_check check (
    (status = 'completed' and completed_at is not null) or status <> 'completed'
  ),
  constraint artisan_media_job_worker_check check (
    claimed_by is null or (pg_catalog.char_length(claimed_by) between 3 and 160 and claimed_by ~ '^[A-Za-z0-9._:-]+$')
  ),
  constraint artisan_media_job_error_check check (
    last_error_code is null or (pg_catalog.char_length(last_error_code) between 3 and 100 and last_error_code ~ '^[a-z][a-z0-9_]+$')
  )
);

create index artisan_media_jobs_dispatch_idx
  on artisan.media_processing_jobs(status, available_at, created_at)
  where status in ('queued','claimed');

create table artisan.forum_posts (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique,
  title text not null,
  artist_statement text,
  theme jsonb not null,
  tags text[] not null default '{}'::text[],
  comments_enabled boolean not null default true,
  appreciations_enabled boolean not null default true,
  slow_mode_seconds integer not null default 0,
  status text not null default 'draft',
  moderation_status text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  removed_at timestamptz,
  constraint artisan_forum_post_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  constraint artisan_forum_post_title_check check (pg_catalog.char_length(title) between 1 and 180),
  constraint artisan_forum_post_statement_check check (artist_statement is null or pg_catalog.char_length(artist_statement) <= 10000),
  constraint artisan_forum_post_theme_check check (
    pg_catalog.jsonb_typeof(theme) = 'object'
    and pg_catalog.jsonb_array_length(pg_catalog.jsonb_path_query_array(theme, '$.*')) <= 8
  ),
  constraint artisan_forum_post_tags_check check (private.artisan_discovery_tags_are_valid(tags)),
  constraint artisan_forum_post_slow_mode_check check (slow_mode_seconds between 0 and 86400),
  constraint artisan_forum_post_status_check check (status in ('draft','processing','pending_review','changes_requested','approved','published','archived','removed','appealed')),
  constraint artisan_forum_post_moderation_check check (moderation_status in ('unreviewed','pending','approved','changes_requested','rejected','removed','legal_hold')),
  constraint artisan_forum_post_publish_check check ((status = 'published' and moderation_status = 'approved' and published_at is not null) or status <> 'published')
);

create index artisan_forum_posts_public_idx on artisan.forum_posts(published_at desc, id) where status = 'published' and moderation_status = 'approved';
create index artisan_forum_posts_owner_idx on artisan.forum_posts(owner_user_id, created_at desc);
create index artisan_forum_posts_tags_idx on artisan.forum_posts using gin(tags)
  where status = 'published' and moderation_status = 'approved';

create table artisan.post_artworks (
  post_id uuid not null references artisan.forum_posts(id) on delete restrict,
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  display_order integer not null default 0,
  primary key (post_id, artwork_id),
  constraint artisan_post_artwork_order_check check (display_order between 0 and 100)
);

create table artisan.comments (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  post_id uuid not null references artisan.forum_posts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  parent_comment_id uuid references artisan.comments(id) on delete restrict,
  depth smallint not null default 0,
  body text not null,
  status text not null default 'pending_review',
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  published_at timestamptz,
  deleted_at timestamptz,
  removed_at timestamptz,
  constraint artisan_comment_depth_check check (depth between 0 and 4),
  constraint artisan_comment_body_check check (pg_catalog.char_length(body) between 1 and 5000),
  constraint artisan_comment_status_check check (status in ('pending_review','published','edited','deleted_by_user','removed_by_moderator','rejected')),
  constraint artisan_comment_moderation_check check (moderation_status in ('pending','approved','rejected','removed','legal_hold')),
  constraint artisan_comment_publish_check check ((status in ('published','edited') and moderation_status = 'approved' and published_at is not null) or status not in ('published','edited'))
);

create index artisan_comments_post_public_idx on artisan.comments(post_id, created_at, id) where status in ('published','edited') and moderation_status = 'approved';
create index artisan_comments_user_created_idx on artisan.comments(user_id, created_at desc);

create table artisan.comment_revisions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references artisan.comments(id) on delete restrict,
  body text not null,
  edited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint artisan_comment_revision_body_check check (pg_catalog.char_length(body) between 1 and 5000)
);

create table artisan.comment_mentions (
  comment_id uuid not null references artisan.comments(id) on delete restrict,
  mentioned_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_user_id)
);

create table artisan.appreciations (
  user_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null,
  target_id uuid not null,
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id),
  constraint artisan_appreciation_target_check check (target_type in ('artwork','post'))
);

-- A rubric is server-owned challenge policy, not an arbitrary score envelope
-- supplied by a judge. Rubric challenges use one immutable, explicitly
-- versioned definition with bounded, uniquely keyed criteria whose weights add
-- to 100. Non-rubric selection methods carry no dormant rubric state.
create or replace function private.artisan_judging_rubric_is_valid(
  p_selection_method text,
  p_rubric_version text,
  p_rubric jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_criterion jsonb;
  v_key text;
  v_keys text[] := array[]::text[];
  v_weight_total integer := 0;
  v_minimum integer;
  v_maximum integer;
begin
  if p_selection_method not in ('rubric','blind_rubric') then
    return p_rubric_version is null and p_rubric is null;
  end if;
  if coalesce(p_rubric_version, '') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'
     or pg_catalog.jsonb_typeof(p_rubric) <> 'object'
     or pg_catalog.char_length(p_rubric::text) > 20000
     or not (p_rubric ? 'criteria')
     or exists (
       select 1 from pg_catalog.jsonb_object_keys(p_rubric) as key
       where key <> 'criteria'
     )
     or pg_catalog.jsonb_typeof(p_rubric -> 'criteria') <> 'array'
     or pg_catalog.jsonb_array_length(p_rubric -> 'criteria') not between 1 and 12 then
    return false;
  end if;
  for v_criterion in
    select value from pg_catalog.jsonb_array_elements(p_rubric -> 'criteria')
  loop
    if pg_catalog.jsonb_typeof(v_criterion) <> 'object'
       or not (v_criterion ?& array[
         'key','label','description','weight','minimumScore','maximumScore'
       ])
       or exists (
         select 1 from pg_catalog.jsonb_object_keys(v_criterion) as key
         where key not in (
           'key','label','description','weight','minimumScore','maximumScore'
         )
       )
       or pg_catalog.jsonb_typeof(v_criterion -> 'key') <> 'string'
       or pg_catalog.jsonb_typeof(v_criterion -> 'label') <> 'string'
       or pg_catalog.jsonb_typeof(v_criterion -> 'description') <> 'string'
       or pg_catalog.jsonb_typeof(v_criterion -> 'weight') <> 'number'
       or pg_catalog.jsonb_typeof(v_criterion -> 'minimumScore') <> 'number'
       or pg_catalog.jsonb_typeof(v_criterion -> 'maximumScore') <> 'number' then
      return false;
    end if;
    v_key := v_criterion ->> 'key';
    if v_key !~ '^[a-z][a-z0-9_]{1,39}$'
       or v_key = any(v_keys)
       or pg_catalog.btrim(v_criterion ->> 'label') <> v_criterion ->> 'label'
       or pg_catalog.char_length(v_criterion ->> 'label') not between 2 and 120
       or pg_catalog.btrim(v_criterion ->> 'description') <> v_criterion ->> 'description'
       or pg_catalog.char_length(v_criterion ->> 'description') not between 8 and 1000
       or (v_criterion ->> 'weight') !~ '^(?:[1-9][0-9]?|100)$'
       or (v_criterion ->> 'minimumScore') !~ '^(?:0|[1-9][0-9]?)$'
       or (v_criterion ->> 'maximumScore') !~ '^(?:[1-9][0-9]?|100)$' then
      return false;
    end if;
    v_minimum := (v_criterion ->> 'minimumScore')::integer;
    v_maximum := (v_criterion ->> 'maximumScore')::integer;
    if v_maximum <= v_minimum then return false; end if;
    v_keys := pg_catalog.array_append(v_keys, v_key);
    v_weight_total := v_weight_total + (v_criterion ->> 'weight')::integer;
  end loop;
  return v_weight_total = 100;
end;
$$;

alter function private.artisan_judging_rubric_is_valid(text, text, jsonb) owner to postgres;
revoke all privileges on function private.artisan_judging_rubric_is_valid(text, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_challenge_score_is_valid(
  p_rubric jsonb,
  p_score jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_criterion jsonb;
  v_key text;
  v_value numeric;
  v_minimum numeric;
  v_maximum numeric;
begin
  if pg_catalog.jsonb_typeof(p_rubric) <> 'object'
     or pg_catalog.jsonb_typeof(p_rubric -> 'criteria') <> 'array'
     or pg_catalog.jsonb_typeof(p_score) <> 'object'
     or pg_catalog.char_length(p_score::text) > 5000
     or not (p_score ? 'criteria')
     or exists (
       select 1 from pg_catalog.jsonb_object_keys(p_score) as key
       where key <> 'criteria'
     )
     or pg_catalog.jsonb_typeof(p_score -> 'criteria') <> 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_score -> 'criteria'))
       <> pg_catalog.jsonb_array_length(p_rubric -> 'criteria') then
    return false;
  end if;
  for v_criterion in
    select value from pg_catalog.jsonb_array_elements(p_rubric -> 'criteria')
  loop
    v_key := v_criterion ->> 'key';
    if not ((p_score -> 'criteria') ? v_key)
       or pg_catalog.jsonb_typeof((p_score -> 'criteria') -> v_key) <> 'number' then
      return false;
    end if;
    v_value := ((p_score -> 'criteria') ->> v_key)::numeric;
    v_minimum := (v_criterion ->> 'minimumScore')::numeric;
    v_maximum := (v_criterion ->> 'maximumScore')::numeric;
    if v_value < v_minimum or v_value > v_maximum
       or pg_catalog.scale(v_value) > 3 then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

alter function private.artisan_challenge_score_is_valid(jsonb, jsonb) owner to postgres;
revoke all privileges on function private.artisan_challenge_score_is_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;

-- Empty eligibility is the conservative legacy shorthand for active,
-- adult-eligible members only. Any explicit policy is an exact bounded object;
-- unknown UI labels or future fields fail closed until a migration defines
-- their semantics.
create or replace function private.artisan_challenge_policy_is_valid(
  p_creation_method_policy text,
  p_eligibility_policy jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_states jsonb;
  v_methods jsonb;
begin
  if pg_catalog.jsonb_typeof(p_eligibility_policy) <> 'object' then
    return false;
  end if;
  if p_eligibility_policy = '{}'::jsonb then
    return p_creation_method_policy <> 'challenge_specific';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_eligibility_policy) as key
    where key not in ('membershipRequired','allowedParticipationStates','allowedCreationMethods')
  ) or not pg_catalog.jsonb_exists(p_eligibility_policy, 'membershipRequired')
    or not pg_catalog.jsonb_exists(p_eligibility_policy, 'allowedParticipationStates')
    or p_eligibility_policy -> 'membershipRequired' is distinct from 'true'::jsonb then
    return false;
  end if;
  v_states := p_eligibility_policy -> 'allowedParticipationStates';
  if pg_catalog.jsonb_typeof(v_states) <> 'array'
     or pg_catalog.jsonb_array_length(v_states) not between 1 and 3
     or exists (
       select 1 from pg_catalog.jsonb_array_elements_text(v_states) as state(value)
       where state.value not in ('adult_eligible','teen_eligible','under13_eligible')
     )
     or (select pg_catalog.count(distinct state.value)
         from pg_catalog.jsonb_array_elements_text(v_states) as state(value))
       <> pg_catalog.jsonb_array_length(v_states) then
    return false;
  end if;
  v_methods := p_eligibility_policy -> 'allowedCreationMethods';
  if p_creation_method_policy = 'challenge_specific' then
    if pg_catalog.jsonb_typeof(v_methods) <> 'array'
       or pg_catalog.jsonb_array_length(v_methods) not between 1 and 5
       or exists (
         select 1 from pg_catalog.jsonb_array_elements_text(v_methods) as method(value)
         where method.value not in (
           'human_created','ai_assisted','ai_generated_human_directed',
           'hybrid_mixed_process','procedural_generative'
         )
       )
       or (select pg_catalog.count(distinct method.value)
           from pg_catalog.jsonb_array_elements_text(v_methods) as method(value))
         <> pg_catalog.jsonb_array_length(v_methods) then
      return false;
    end if;
  elsif pg_catalog.jsonb_exists(p_eligibility_policy, 'allowedCreationMethods') then
    return false;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

alter function private.artisan_challenge_policy_is_valid(text, jsonb) owner to postgres;
revoke all privileges on function private.artisan_challenge_policy_is_valid(text, jsonb)
  from public, anon, authenticated, service_role;

create table artisan.challenges (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  slug text not null unique,
  title text not null,
  short_prompt text not null,
  full_brief text not null,
  purpose text not null,
  sponsor_name text not null default 'EcoSyneva Commons LLC',
  license_summary text not null default 'Artists retain ownership. Display rights are limited to the exact accepted challenge and platform license terms.',
  conflict_of_interest_rules text not null default 'Judges must disclose conflicts and may not score an entry until an independent reviewer clears the disclosure.',
  visibility text not null default 'public',
  cancellation_terms text not null default 'If this challenge is cancelled, no entry is declared a winner and submitted work remains owned by its artist.',
  status text not null default 'draft',
  opens_at timestamptz,
  deadline_at timestamptz,
  timezone text not null default 'UTC',
  maximum_entries_per_artist integer not null default 1,
  selection_method text not null default 'curated',
  blind_review boolean not null default false,
  creation_method_policy text not null default 'all_disclosed_methods',
  eligibility_policy jsonb not null default '{}'::jsonb,
  judging_rubric_version text,
  judging_rubric jsonb,
  rules_document_key text not null default 'challenge_rules_template',
  rules_document_version text,
  rules_content_sha256 text,
  published_at timestamptz,
  closed_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_challenge_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  constraint artisan_challenge_title_check check (pg_catalog.char_length(title) between 1 and 180),
  constraint artisan_challenge_text_check check (pg_catalog.char_length(short_prompt) between 8 and 500 and pg_catalog.char_length(full_brief) between 20 and 30000 and pg_catalog.char_length(purpose) between 8 and 5000),
  constraint artisan_challenge_sponsor_check check (pg_catalog.char_length(pg_catalog.btrim(sponsor_name)) between 2 and 200),
  constraint artisan_challenge_license_summary_check check (pg_catalog.char_length(pg_catalog.btrim(license_summary)) between 20 and 5000),
  constraint artisan_challenge_conflict_rules_check check (pg_catalog.char_length(pg_catalog.btrim(conflict_of_interest_rules)) between 20 and 5000),
  constraint artisan_challenge_visibility_check check (visibility in ('public','unlisted','private_beta')),
  constraint artisan_challenge_cancellation_terms_check check (pg_catalog.char_length(pg_catalog.btrim(cancellation_terms)) between 20 and 5000),
  constraint artisan_challenge_status_check check (status in ('draft','scheduled','open','closed','judging','selection_pending','completed','cancelled','archived')),
  constraint artisan_challenge_entry_limit_check check (maximum_entries_per_artist between 1 and 20),
  constraint artisan_challenge_selection_check check (selection_method in ('curated','rubric','blind_rubric','community_mosaic','no_selection')),
  constraint artisan_challenge_creation_method_policy_check check (creation_method_policy in ('human_only','ai_assisted_allowed','all_disclosed_methods','challenge_specific')),
  constraint artisan_challenge_eligibility_check check (
    private.artisan_challenge_policy_is_valid(creation_method_policy, eligibility_policy)
  ),
  constraint artisan_challenge_judging_rubric_check check (
    private.artisan_judging_rubric_is_valid(
      selection_method, judging_rubric_version, judging_rubric
    )
  ),
  constraint artisan_challenge_time_check check (deadline_at is null or opens_at is null or deadline_at > opens_at),
  constraint artisan_challenge_rules_hash_check check (rules_content_sha256 is null or rules_content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_challenge_publication_check check ((status in ('scheduled','open','closed','judging','selection_pending','completed','archived') and published_at is not null) or status in ('draft','cancelled'))
);

create index artisan_challenges_public_idx on artisan.challenges(status, opens_at desc, id) where published_at is not null;

create table artisan.challenge_media_rules (
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  adapter_key text not null references artisan.media_adapters(adapter_key) on delete restrict,
  maximum_files integer not null default 1,
  maximum_bytes bigint,
  maximum_width integer,
  maximum_height integer,
  maximum_duration_seconds numeric(10,3),
  required_alt_text boolean not null default true,
  required_creation_method_disclosure boolean not null default true,
  primary key (challenge_id, adapter_key),
  constraint artisan_challenge_media_files_check check (maximum_files between 1 and 20),
  constraint artisan_challenge_media_bytes_check check (maximum_bytes is null or maximum_bytes > 0)
);

create table artisan.challenge_judges (
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'judge',
  status text not null default 'conflict_pending',
  conflict_disclosure text,
  conflict_cleared_by uuid references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (challenge_id, judge_user_id),
  constraint artisan_judge_role_check check (role in ('curator','judge','chair')),
  constraint artisan_judge_status_check check (status in ('conflict_pending','cleared','recused','released')),
  constraint artisan_judge_conflict_check check (conflict_disclosure is null or pg_catalog.char_length(conflict_disclosure) between 8 and 2000)
);

create table artisan.challenge_rule_acceptances (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null,
  accepted_at timestamptz not null default now(),
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version) on delete restrict,
  constraint artisan_challenge_acceptance_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  unique (challenge_id, user_id, document_version)
);

create table artisan.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  submitter_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft',
  moderation_status text not null default 'unreviewed',
  eligibility_status text not null default 'not_evaluated',
  rule_acceptance_id uuid references artisan.challenge_rule_acceptances(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  selected_at timestamptz,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_submission_status_check check (status in ('draft','uploading','processing','pending_review','eligible','changes_requested','ineligible','withdrawn','judging','selected','not_selected','published')),
  constraint artisan_submission_moderation_check check (moderation_status in ('unreviewed','pending','approved','changes_requested','rejected','removed','legal_hold')),
  constraint artisan_submission_eligibility_check check (eligibility_status in ('not_evaluated','eligible','ineligible','conflict_hold','rights_hold','age_hold')),
  constraint artisan_submission_submit_check check ((status in ('pending_review','eligible','judging','selected','not_selected','published') and submitted_at is not null) or status in ('draft','uploading','processing','changes_requested','ineligible','withdrawn'))
);

create unique index artisan_submission_one_artwork_challenge_idx on artisan.challenge_submissions(challenge_id, artwork_id);
create index artisan_submissions_owner_idx on artisan.challenge_submissions(submitter_user_id, created_at desc);
create index artisan_submissions_review_idx on artisan.challenge_submissions(challenge_id, status, submitted_at);

create table artisan.submission_media (
  submission_id uuid not null references artisan.challenge_submissions(id) on delete restrict,
  media_asset_id uuid not null references artisan.media_assets(id) on delete restrict,
  display_order integer not null default 0,
  primary key (submission_id, media_asset_id),
  constraint artisan_submission_media_order_check check (display_order between 0 and 100)
);

create table artisan.challenge_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  submission_id uuid not null references artisan.challenge_submissions(id) on delete restrict,
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  rubric_version text not null,
  score jsonb not null,
  private_note text,
  conflict_declared boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_challenge_score_payload_check check (pg_catalog.jsonb_typeof(score) = 'object'),
  constraint artisan_challenge_score_note_check check (private_note is null or pg_catalog.char_length(private_note) <= 5000),
  unique (submission_id, judge_user_id, rubric_version)
);

create table artisan.challenge_score_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  score_id uuid not null references artisan.challenge_scores(id) on delete restrict,
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  submission_id uuid not null references artisan.challenge_submissions(id) on delete restrict,
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  rubric_version text not null,
  score jsonb not null,
  private_note text,
  conflict_declared boolean not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint artisan_score_event_payload_check check (pg_catalog.jsonb_typeof(score) = 'object'),
  constraint artisan_score_event_action_check check (action in ('submitted','revised','withdrawn')),
  constraint artisan_score_event_note_check check (private_note is null or pg_catalog.char_length(private_note) <= 5000)
);

-- Defense in depth for privileged/direct writes: a score row or immutable score
-- event must belong to the challenge/submission/judge tuple and match that
-- challenge's exact rubric version and criterion contract.
create or replace function private.artisan_enforce_challenge_score_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rubric_version text;
  v_rubric jsonb;
begin
  select challenge.judging_rubric_version, challenge.judging_rubric
  into v_rubric_version, v_rubric
  from artisan.challenges as challenge
  where challenge.id = new.challenge_id;
  if not found
     or new.rubric_version is distinct from v_rubric_version
     or not private.artisan_challenge_score_is_valid(v_rubric, new.score)
     or not exists (
       select 1 from artisan.challenge_submissions as submission
       where submission.id = new.submission_id
         and submission.challenge_id = new.challenge_id
     )
     or not exists (
       select 1 from artisan.challenge_judges as judge
       where judge.challenge_id = new.challenge_id
         and judge.judge_user_id = new.judge_user_id
     ) then
    raise exception using errcode = '23514', message = 'artisan_challenge_score_contract_invalid';
  end if;
  return new;
end;
$$;

alter function private.artisan_enforce_challenge_score_contract() owner to postgres;
revoke all privileges on function private.artisan_enforce_challenge_score_contract()
  from public, anon, authenticated, service_role;

create trigger artisan_challenge_scores_enforce_contract
before insert or update on artisan.challenge_scores
for each row execute function private.artisan_enforce_challenge_score_contract();

create trigger artisan_challenge_score_events_enforce_contract
before insert or update on artisan.challenge_score_events
for each row execute function private.artisan_enforce_challenge_score_contract();

create table artisan.challenge_awards (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  challenge_id uuid not null references artisan.challenges(id) on delete restrict,
  submission_id uuid not null references artisan.challenge_submissions(id) on delete restrict,
  award_type text not null,
  display_order integer not null default 0,
  selected_by uuid not null references auth.users(id) on delete restrict,
  selection_reason text not null,
  winner_license_id uuid references artisan.artwork_licenses(id) on delete restrict,
  status text not null default 'selection_pending',
  selected_at timestamptz not null default now(),
  confirmed_at timestamptz,
  published_at timestamptz,
  revoked_at timestamptz,
  constraint artisan_award_type_check check (award_type in ('winner','runner_up','featured','honorable_recognition','community_mosaic')),
  constraint artisan_award_order_check check (display_order between 0 and 100),
  constraint artisan_award_reason_check check (pg_catalog.char_length(selection_reason) between 8 and 5000),
  constraint artisan_award_status_check check (status in ('selection_pending','artist_confirmed','published','declined','revoked')),
  constraint artisan_award_publish_check check ((status = 'published' and confirmed_at is not null and published_at is not null and winner_license_id is not null) or status <> 'published')
);

create table artisan.award_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  award_id uuid not null references artisan.challenge_awards(id) on delete restrict,
  artist_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null,
  winner_license_id uuid references artisan.artwork_licenses(id) on delete restrict,
  private_note text,
  created_at timestamptz not null default now(),
  foreign key (document_key, document_version)
    references private.community_legal_document_versions(document_key, document_version) on delete restrict,
  constraint artisan_award_agreement_decision_check check (decision in ('accepted','declined')),
  constraint artisan_award_agreement_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_award_agreement_license_check check (
    (decision = 'accepted' and winner_license_id is not null)
    or (decision = 'declined' and winner_license_id is null)
  ),
  constraint artisan_award_agreement_note_check check (private_note is null or pg_catalog.char_length(private_note) between 8 and 2000),
  unique (award_id, artist_user_id)
);

create table artisan.gallery_entries (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  challenge_id uuid references artisan.challenges(id) on delete restrict,
  submission_id uuid references artisan.challenge_submissions(id) on delete restrict,
  award_id uuid references artisan.challenge_awards(id) on delete restrict,
  gallery_kind text not null,
  status text not null default 'draft',
  frozen_credit_line text not null,
  frozen_profile_url text not null,
  frozen_creation_method text not null,
  frozen_license_code text not null,
  accessible_description text not null,
  published_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint artisan_gallery_kind_check check (gallery_kind in ('winner','all_entries','featured')),
  constraint artisan_gallery_status_check check (status in ('draft','published','removed')),
  constraint artisan_gallery_credit_check check (pg_catalog.char_length(frozen_credit_line) between 1 and 200),
  constraint artisan_gallery_description_check check (pg_catalog.char_length(accessible_description) between 1 and 4000),
  constraint artisan_gallery_publish_check check ((status = 'published' and published_at is not null) or status <> 'published'),
  unique (gallery_kind, artwork_id, challenge_id)
);

create index artisan_gallery_public_idx on artisan.gallery_entries(gallery_kind, published_at desc, id) where status = 'published';

-- A collection is a real, auditable curation object rather than a UI label.
-- Public discovery only observes published collections inside their optional
-- visibility window; curation never becomes an engagement-ranking signal.
create table artisan.featured_collections (
  slug text primary key,
  title text not null,
  description text not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  curated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_featured_collection_slug_check check (
    slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'
  ),
  constraint artisan_featured_collection_title_check check (
    pg_catalog.char_length(pg_catalog.btrim(title)) between 2 and 160
  ),
  constraint artisan_featured_collection_description_check check (
    pg_catalog.char_length(pg_catalog.btrim(description)) between 8 and 2000
  ),
  constraint artisan_featured_collection_status_check check (
    status in ('draft','published','archived')
  ),
  constraint artisan_featured_collection_window_check check (
    ends_at is null or (starts_at is not null and ends_at > starts_at)
  ),
  constraint artisan_featured_collection_publish_check check (
    (status = 'published' and published_at is not null and archived_at is null)
    or (status = 'archived' and published_at is not null and archived_at is not null)
    or (status = 'draft' and published_at is null and archived_at is null)
  )
);

create index artisan_featured_collections_public_idx
  on artisan.featured_collections(published_at desc, slug)
  where status = 'published';

create table artisan.featured_entries (
  id uuid primary key default gen_random_uuid(),
  gallery_entry_id uuid not null references artisan.gallery_entries(id) on delete restrict,
  collection_slug text not null references artisan.featured_collections(slug) on delete restrict,
  display_order integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  curated_by uuid not null references auth.users(id) on delete restrict,
  curation_reason text not null,
  created_at timestamptz not null default now(),
  constraint artisan_featured_order_check check (display_order between 0 and 10000),
  constraint artisan_featured_reason_check check (pg_catalog.char_length(curation_reason) between 8 and 1000),
  constraint artisan_featured_time_check check (ends_at is null or ends_at > starts_at),
  unique (collection_slug, gallery_entry_id)
);

create index artisan_featured_entries_collection_idx
  on artisan.featured_entries(collection_slug, display_order, id);

create table artisan.reports (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_fingerprint_sha256 text,
  target_type text not null,
  target_id uuid not null,
  reason_code text not null,
  summary text not null,
  details text,
  status text not null default 'submitted',
  priority text not null default 'normal',
  child_safety_sensitive boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artisan_report_fingerprint_check check (reporter_fingerprint_sha256 is null or reporter_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  constraint artisan_report_target_check check (target_type in ('artwork','post','comment','profile','challenge','submission','media')),
  constraint artisan_report_reason_code_check check (reason_code in ('sexual_or_exploitative','minor_safety','threat_or_harassment','hate','doxxing','stolen_art','copyright','impersonation','self_harm_concern','spam','malware','manipulated_media','other')),
  constraint artisan_report_summary_check check (pg_catalog.char_length(summary) between 8 and 500),
  constraint artisan_report_details_check check (details is null or pg_catalog.char_length(details) <= 5000),
  constraint artisan_report_status_check check (status in ('submitted','triaged','case_opened','resolved_no_action','action_taken','dismissed','escalated')),
  constraint artisan_report_priority_check check (priority in ('low','normal','high','urgent'))
);

create index artisan_reports_queue_idx on artisan.reports(priority desc, submitted_at) where status in ('submitted','triaged','case_opened','escalated');

create table artisan.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references artisan.reports(id) on delete restrict,
  case_type text not null,
  status text not null default 'open',
  severity text not null default 'normal',
  subject_user_id uuid references auth.users(id) on delete restrict,
  target_type text,
  target_id uuid,
  child_safety_sensitive boolean not null default false,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  closed_at timestamptz,
  resolution_code text,
  private_summary text not null,
  constraint artisan_case_type_check check (case_type in ('content','harassment','child_safety','copyright','stolen_art','impersonation','account_abuse','credit_dispute','malware','other')),
  constraint artisan_case_status_check check (status in ('open','triage','investigating','action_proposed','waiting_user','appealed','closed','legal_hold')),
  constraint artisan_case_severity_check check (severity in ('low','normal','high','critical')),
  constraint artisan_case_summary_check check (pg_catalog.char_length(private_summary) between 8 and 5000),
  constraint artisan_case_close_check check ((status = 'closed' and closed_at is not null and resolution_code is not null) or status <> 'closed')
);

create index artisan_cases_queue_idx on artisan.moderation_cases(severity desc, opened_at) where status not in ('closed');

create table artisan.case_assignments (
  case_id uuid not null references artisan.moderation_cases(id) on delete restrict,
  assigned_user_id uuid not null references auth.users(id) on delete restrict,
  assignment_role text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  primary key (case_id, assigned_user_id, assignment_role),
  constraint artisan_case_assignment_role_check check (assignment_role in ('triage','investigator','decision_maker','appeal_reviewer','child_safety','copyright'))
);

create table artisan.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  case_id uuid not null references artisan.moderation_cases(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  capability text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason_code text not null,
  private_reason text not null,
  public_notice text,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint artisan_moderation_action_check check (action in ('no_action','request_changes','hide_temporarily','remove','restore','lock_comments','unlock_comments','limit_interactions','restrict_feature','suspend_artisan','cross_community_escalation','preserve_evidence','release_evidence')),
  constraint artisan_moderation_reason_check check (pg_catalog.char_length(private_reason) between 8 and 5000),
  constraint artisan_moderation_notice_check check (public_notice is null or pg_catalog.char_length(public_notice) between 8 and 2000),
  constraint artisan_moderation_reverse_check check ((reversed_at is null and reversed_by is null) or (reversed_at is not null and reversed_by is not null))
);

create table artisan.appeals (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  appellant_user_id uuid not null references auth.users(id) on delete restrict,
  case_id uuid references artisan.moderation_cases(id) on delete restrict,
  restriction_id uuid references private.account_restrictions(id) on delete restrict,
  moderation_action_id uuid references artisan.moderation_actions(id) on delete restrict,
  statement text not null,
  status text not null default 'submitted',
  appeal_deadline_at timestamptz,
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  decision text,
  private_reason text,
  public_notice text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint artisan_appeal_target_check check (num_nonnulls(case_id, restriction_id, moderation_action_id) >= 1),
  constraint artisan_appeal_statement_check check (pg_catalog.char_length(statement) between 20 and 10000),
  constraint artisan_appeal_status_check check (status in ('submitted','under_review','more_information','granted','partially_granted','denied','withdrawn')),
  constraint artisan_appeal_decision_check check ((status in ('granted','partially_granted','denied') and reviewer_user_id is not null and reviewed_at is not null and decision is not null) or status not in ('granted','partially_granted','denied'))
);

create index artisan_appeals_queue_idx on artisan.appeals(submitted_at) where status in ('submitted','under_review','more_information');

create table artisan.credit_correction_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  artwork_id uuid not null references artisan.artworks(id) on delete restrict,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  correction_type text not null,
  requested_value jsonb not null,
  requested_credited_user_id uuid references auth.users(id) on delete restrict,
  evidence_note text,
  status text not null default 'submitted',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  private_reason text,
  created_at timestamptz not null default now(),
  constraint artisan_credit_correction_type_check check (correction_type in ('credit_line','credited_name','collaborator','profile_link','creation_method','license')),
  constraint artisan_credit_correction_value_check check (pg_catalog.jsonb_typeof(requested_value) = 'object'),
  constraint artisan_credit_correction_evidence_check check (evidence_note is null or pg_catalog.char_length(evidence_note) <= 5000),
  constraint artisan_credit_correction_reason_check check (private_reason is null or pg_catalog.char_length(private_reason) between 8 and 5000),
  constraint artisan_credit_correction_status_check check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  constraint artisan_credit_correction_link_check check (
    (correction_type = 'profile_link' and requested_credited_user_id is not null)
    or correction_type = 'collaborator'
    or (correction_type not in ('collaborator','profile_link') and requested_credited_user_id is null)
  ),
  constraint artisan_credit_correction_review_check check (
    (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null and private_reason is not null)
    or status not in ('approved','rejected')
  )
);

create table artisan.dmca_cases (
  id uuid primary key default gen_random_uuid(),
  external_reference text not null unique,
  status text not null default 'notice_received',
  target_type text not null,
  target_id uuid not null,
  claimant_contact_ciphertext text not null,
  notice_sha256 text not null,
  counter_notice_sha256 text,
  repeat_infringer_review boolean not null default false,
  received_at timestamptz not null default now(),
  takedown_at timestamptz,
  counter_notice_at timestamptz,
  restoration_at timestamptz,
  closed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete restrict,
  constraint artisan_dmca_reference_check check (pg_catalog.char_length(external_reference) between 8 and 200),
  constraint artisan_dmca_target_check check (target_type in ('artwork','post','comment','media')),
  constraint artisan_dmca_claimant_ciphertext_check check (pg_catalog.char_length(claimant_contact_ciphertext) between 32 and 20000),
  constraint artisan_dmca_status_check check (status in ('notice_received','validating','takedown','counter_notice_received','waiting_period','restored','closed','rejected')),
  constraint artisan_dmca_hash_check check (notice_sha256 ~ '^[0-9a-f]{64}$' and (counter_notice_sha256 is null or counter_notice_sha256 ~ '^[0-9a-f]{64}$'))
);

create table artisan.content_takedowns (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  target_type text not null,
  target_id uuid not null,
  legal_basis text not null,
  case_id uuid references artisan.moderation_cases(id) on delete restrict,
  dmca_case_id uuid references artisan.dmca_cases(id) on delete restrict,
  imposed_by uuid not null references auth.users(id) on delete restrict,
  imposed_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete restrict,
  constraint artisan_takedown_target_check check (target_type in ('artwork','post','comment','profile','challenge','submission','media')),
  constraint artisan_takedown_target_presence_check check (target_id is not null),
  constraint artisan_takedown_basis_check check (legal_basis in ('dmca','court_order','privacy','child_safety','nonconsensual_intimate_imagery','platform_policy')),
  constraint artisan_takedown_restore_check check ((restored_at is null and restored_by is null) or (restored_at is not null and restored_by is not null))
);

create table artisan.legal_hold_records (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  case_id uuid references artisan.moderation_cases(id) on delete restrict,
  scope text not null,
  imposed_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  imposed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete restrict,
  constraint artisan_legal_hold_target_check check (target_type in ('artwork','post','comment','profile','challenge','submission','media','account')),
  constraint artisan_legal_hold_scope_check check (scope in ('content','media_original','moderation_evidence','copyright','child_safety','challenge_agreement')),
  constraint artisan_legal_hold_reason_check check (pg_catalog.char_length(private_reason) between 8 and 5000),
  constraint artisan_legal_hold_release_check check ((released_at is null and released_by is null) or (released_at is not null and released_by is not null))
);

create table artisan.notifications (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  notification_type text not null,
  title text not null,
  body text,
  action_path text,
  source_type text,
  source_id uuid,
  status text not null default 'pending',
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  last_error_evidence_sha256 text,
  delivery_evidence_sha256 text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint artisan_notification_delivery_key_check check (pg_catalog.char_length(delivery_key) between 8 and 255),
  constraint artisan_notification_type_check check (notification_type in ('comment_published','mention','challenge_update','submission_update','award_update','moderation_notice','appeal_update','credit_update','guardian_update','system')),
  constraint artisan_notification_title_check check (pg_catalog.char_length(title) between 1 and 200),
  constraint artisan_notification_action_path_check check (action_path is null or (action_path ~ '^/[A-Za-z0-9/_?&=.%:-]*$' and action_path !~ '^//')),
  constraint artisan_notification_status_check check (status in ('pending','processing','delivered','failed','suppressed')),
  constraint artisan_notification_attempt_check check (attempt_count between 0 and 20),
  constraint artisan_notification_claim_check check (
    (status = 'processing' and claimed_by is not null and claimed_at is not null and lease_expires_at is not null)
    or (status <> 'processing' and claimed_by is null and claimed_at is null and lease_expires_at is null)
  ),
  constraint artisan_notification_worker_check check (
    claimed_by is null or (pg_catalog.char_length(claimed_by) between 3 and 160
      and claimed_by ~ '^[A-Za-z0-9._:-]+$')
  ),
  constraint artisan_notification_error_check check (
    last_error_code is null or (pg_catalog.char_length(last_error_code) between 3 and 100
      and last_error_code ~ '^[a-z][a-z0-9_]+$')
  ),
  constraint artisan_notification_error_evidence_check check (
    (last_error_code is null and last_error_evidence_sha256 is null)
    or (last_error_code is not null and last_error_evidence_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint artisan_notification_delivery_check check (
    (status = 'delivered' and delivered_at is not null
      and delivery_evidence_sha256 ~ '^[0-9a-f]{64}$')
    or (status <> 'delivered' and delivered_at is null and delivery_evidence_sha256 is null)
  )
);

create index artisan_notifications_user_created_idx on artisan.notifications(user_id, created_at desc);
create index artisan_notifications_delivery_idx
  on artisan.notifications(status, available_at, created_at)
  where status in ('pending','processing','failed');

-- The Identity Worker coordinates account lifecycle by opaque request ID and
-- aggregate evidence only. Object keys remain exclusively in the Artisan
-- retention worker contract.
create table artisan.account_cleanup_runs (
  lifecycle_request_id uuid primary key
    references private.account_lifecycle_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  content_disposition text not null,
  status text not null default 'queued',
  expected_asset_count integer not null default 0,
  completed_asset_count integer not null default 0,
  completion_evidence_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint artisan_account_cleanup_disposition_check check (
    content_disposition in (
      'preserve_public_credit_anonymize_account',
      'remove_user_content_preserve_required_legal_evidence'
    )
  ),
  constraint artisan_account_cleanup_status_check check (
    status in ('queued','processing','completed','blocked_by_legal_hold','failed')
  ),
  constraint artisan_account_cleanup_count_check check (
    expected_asset_count >= 0 and completed_asset_count between 0 and expected_asset_count
  ),
  constraint artisan_account_cleanup_completion_check check (
    (status = 'completed' and completed_at is not null
      and completion_evidence_sha256 ~ '^[0-9a-f]{64}$'
      and completed_asset_count = expected_asset_count)
    or (status <> 'completed' and completed_at is null
      and completion_evidence_sha256 is null)
  )
);

create table artisan.account_cleanup_assets (
  lifecycle_request_id uuid not null
    references artisan.account_cleanup_runs(lifecycle_request_id) on delete restrict,
  media_asset_id uuid not null references artisan.media_assets(id) on delete restrict,
  retention_task_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (lifecycle_request_id, media_asset_id)
);

create table artisan.retention_tasks (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  action text not null,
  due_at timestamptz not null,
  status text not null default 'pending',
  legal_hold_checked_at timestamptz,
  attempt_count integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  last_error_evidence_sha256 text,
  completion_evidence_sha256 text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint artisan_retention_action_check check (action in ('delete_quarantine_original','delete_rejected_media','delete_abandoned_upload','delete_account_media','delete_expired_export','anonymize_account_link','expire_notification','rebuild_thumbnail')),
  constraint artisan_retention_status_check check (status in ('pending','processing','completed','blocked_by_legal_hold','failed','abandoned')),
  constraint artisan_retention_attempt_check check (attempt_count between 0 and 20),
  constraint artisan_retention_claim_check check (
    (status = 'processing' and claimed_by is not null and claimed_at is not null and lease_expires_at is not null)
    or (status <> 'processing' and claimed_by is null and claimed_at is null and lease_expires_at is null)
  ),
  constraint artisan_retention_worker_check check (
    claimed_by is null or (pg_catalog.char_length(claimed_by) between 3 and 160
      and claimed_by ~ '^[A-Za-z0-9._:-]+$')
  ),
  constraint artisan_retention_error_check check (
    last_error_code is null or (pg_catalog.char_length(last_error_code) between 3 and 100
      and last_error_code ~ '^[a-z][a-z0-9_]+$')
  ),
  constraint artisan_retention_error_evidence_check check (
    (last_error_code is null and last_error_evidence_sha256 is null)
    or (last_error_code is not null and last_error_evidence_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint artisan_retention_hold_check check (
    status <> 'blocked_by_legal_hold' or legal_hold_checked_at is not null
  ),
  constraint artisan_retention_completion_check check (
    (status = 'completed' and completed_at is not null
      and completion_evidence_sha256 ~ '^[0-9a-f]{64}$')
    or (status <> 'completed' and completed_at is null and completion_evidence_sha256 is null)
  ),
  constraint artisan_retention_task_unique unique(target_type, target_id, action)
);

create index artisan_retention_due_idx on artisan.retention_tasks(due_at, created_at) where status in ('pending','failed');

alter table artisan.account_cleanup_assets
  add constraint artisan_account_cleanup_asset_task_fkey
  foreign key (retention_task_id) references artisan.retention_tasks(id) on delete restrict;

-- A separate, private approval ledger lets a verified guardian approve one
-- dependent-owned item without granting blanket publishing authority. Target
-- existence and ownership are validated by narrow security-definer RPCs; the
-- generic UUID avoids polymorphic foreign keys and is never publicly readable.
create table artisan.guardian_content_approvals (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  relationship_id uuid not null references private.guardian_relationships(id) on delete restrict,
  dependent_user_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null,
  target_id uuid not null,
  target_revision_sha256 text not null,
  decision_revision_sha256 text,
  consent_scope text not null,
  status text not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  approval_expires_at timestamptz,
  decision_reason text,
  updated_at timestamptz not null default now(),
  constraint artisan_guardian_content_target_check check (
    target_type in ('artwork','post','comment','submission','media')
  ),
  constraint artisan_guardian_content_scope_check check (
    consent_scope in ('artisan_posting','artisan_commenting','artisan_uploading','artisan_challenges')
  ),
  constraint artisan_guardian_content_revision_check check (
    target_revision_sha256 ~ '^[0-9a-f]{64}$'
    and (decision_revision_sha256 is null or decision_revision_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint artisan_guardian_content_status_check check (
    status in ('pending','approved','rejected','withdrawn','expired')
  ),
  constraint artisan_guardian_content_decision_check check (
    (status = 'pending' and decided_by is null and decided_at is null
      and decision_revision_sha256 is null
      and approval_expires_at is null and decision_reason is null)
    or (status = 'approved' and decided_by is not null and decided_at is not null
      and decision_revision_sha256 = target_revision_sha256
      and approval_expires_at is not null and approval_expires_at > decided_at
      and pg_catalog.char_length(decision_reason) between 8 and 1000)
    or (status = 'rejected' and decided_by is not null and decided_at is not null
      and decision_revision_sha256 = target_revision_sha256
      and approval_expires_at is null
      and pg_catalog.char_length(decision_reason) between 8 and 1000)
    or (status in ('withdrawn','expired') and decided_at is not null
      and approval_expires_at is null
      and pg_catalog.char_length(decision_reason) between 8 and 1000)
  )
);

create unique index artisan_guardian_content_one_active_idx
  on artisan.guardian_content_approvals(dependent_user_id, target_type, target_id)
  where status in ('pending','approved');
create index artisan_guardian_content_guardian_queue_idx
  on artisan.guardian_content_approvals(relationship_id, status, requested_at, id);

create table artisan.guardian_content_approval_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  approval_id uuid not null references artisan.guardian_content_approvals(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint artisan_guardian_content_event_action_check check (
    action in ('requested','approved','rejected','withdrawn','expired')
  ),
  constraint artisan_guardian_content_event_reason_check check (
    pg_catalog.char_length(private_reason) between 8 and 1000
  )
);

do $artisan_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'invitations','memberships','user_blocks','media_adapters','artworks',
    'artwork_credits','artwork_collaborators','artwork_licenses','artwork_provenance_events',
    'media_assets','media_caption_tracks','media_processing_events','media_processing_jobs','forum_posts','post_artworks','comments',
    'comment_revisions','comment_mentions','appreciations','challenges','challenge_media_rules',
    'challenge_judges','challenge_rule_acceptances','challenge_submissions','submission_media',
    'challenge_scores','challenge_score_events','challenge_awards','award_agreement_acceptances',
    'gallery_entries','featured_collections','featured_entries','reports',
    'moderation_cases','case_assignments','moderation_actions','appeals','credit_correction_requests',
    'dmca_cases','content_takedowns','legal_hold_records','notifications',
    'account_cleanup_runs','account_cleanup_assets','retention_tasks',
    'guardian_content_approvals','guardian_content_approval_events'
  ] loop
    execute pg_catalog.format('alter table artisan.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table artisan.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table artisan.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$artisan_table_hardening$;

create trigger artisan_provenance_events_are_append_only
before update or delete on artisan.artwork_provenance_events
for each row execute function private.community_history_is_append_only();
create trigger artisan_media_processing_events_are_append_only
before update or delete on artisan.media_processing_events
for each row execute function private.community_history_is_append_only();
create trigger artisan_comment_revisions_are_append_only
before update or delete on artisan.comment_revisions
for each row execute function private.community_history_is_append_only();
create trigger artisan_challenge_rule_acceptances_are_append_only
before update or delete on artisan.challenge_rule_acceptances
for each row execute function private.community_history_is_append_only();
create trigger artisan_challenge_score_events_are_append_only
before update or delete on artisan.challenge_score_events
for each row execute function private.community_history_is_append_only();
create trigger artisan_award_agreement_acceptances_are_append_only
before update or delete on artisan.award_agreement_acceptances
for each row execute function private.community_history_is_append_only();
create trigger artisan_guardian_content_approval_events_are_append_only
before update or delete on artisan.guardian_content_approval_events
for each row execute function private.community_history_is_append_only();

-- Enforcement/action rows keep immutable decision fields while permitting one
-- explicit terminal reversal/restoration transition recorded by audited RPCs.
create or replace function private.artisan_moderation_action_reversal_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or old.reversed_at is not null or old.reversed_by is not null
     or new.reversed_at is null or new.reversed_by is null
     or (to_jsonb(new) - array['reversed_at','reversed_by']::text[])
       is distinct from (to_jsonb(old) - array['reversed_at','reversed_by']::text[]) then
    raise exception using errcode = '55000', message = 'artisan_moderation_action_is_immutable';
  end if;
  return new;
end;
$$;

alter function private.artisan_moderation_action_reversal_only() owner to postgres;
revoke all privileges on function private.artisan_moderation_action_reversal_only()
  from public, anon, authenticated, service_role;

create or replace function private.artisan_content_takedown_restoration_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or old.restored_at is not null or old.restored_by is not null
     or new.restored_at is null or new.restored_by is null
     or (to_jsonb(new) - array['restored_at','restored_by']::text[])
       is distinct from (to_jsonb(old) - array['restored_at','restored_by']::text[]) then
    raise exception using errcode = '55000', message = 'artisan_content_takedown_is_immutable';
  end if;
  return new;
end;
$$;

alter function private.artisan_content_takedown_restoration_only() owner to postgres;
revoke all privileges on function private.artisan_content_takedown_restoration_only()
  from public, anon, authenticated, service_role;

create trigger artisan_moderation_actions_are_append_only
before update or delete on artisan.moderation_actions
for each row execute function private.artisan_moderation_action_reversal_only();
create trigger artisan_content_takedowns_are_append_only
before update or delete on artisan.content_takedowns
for each row execute function private.artisan_content_takedown_restoration_only();

comment on schema artisan is
  'Public creative-community domain. It never stores or depends on private local Elysia memory, conversations, files, logs, prompts, credentials, runtime state, or machine data.';
comment on table artisan.media_assets is
  'Private upload and derivative metadata. Public clients never receive quarantine keys or unprocessed originals.';
comment on table artisan.artworks is
  'Canonical artwork attribution, creation-method disclosure, accessibility description, license choice, and publication state.';
comment on table artisan.appreciations is
  'One private appreciation per user and target. It is never a public engagement-ranking input.';
comment on table artisan.featured_collections is
  'Explicit staff-curated discovery collections. They are never inferred from engagement or appreciation activity.';

commit;

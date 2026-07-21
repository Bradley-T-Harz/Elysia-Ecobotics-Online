-- Artisan RLS, private Storage declarations, bounded projections, and atomic
-- mutation RPCs. Browser-safe self-service functions derive auth.uid(); Worker
-- functions accept a separately verified actor UUID and are service-role-only.

begin;

grant usage on schema artisan to anon, authenticated, service_role;

-- Creator accessibility/safety declarations are distinct from processor facts.
-- Persist them end-to-end so the Worker can enforce the declared contract and
-- a later processor result cannot silently erase creator-provided warnings.
alter table artisan.media_assets
  add column if not exists spoken_content boolean not null default false,
  add column if not exists creator_declared_flash_risk boolean not null default false;

-- All buckets are private. Quarantine originals and staff evidence have no
-- browser read policy. Approved derivatives are still served through the
-- controlled media Worker/signed delivery path, never as public originals.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-avatars', 'profile-avatars', false, 5242880,
    array['image/jpeg','image/png','image/webp']),
  ('profile-banners', 'profile-banners', false, 5242880,
    array['image/jpeg','image/png','image/webp']),
  ('profile-media-approved', 'profile-media-approved', false, 5242880,
    array['image/jpeg','image/webp']),
  ('artisan-quarantine', 'artisan-quarantine', false, 104857600,
    array['image/jpeg','image/png','image/webp','audio/mpeg','audio/ogg','audio/wav','audio/mp4','video/mp4','video/webm','application/pdf','model/gltf+json','model/gltf-binary','text/vtt','application/vnd.elysia.artisan-interactive+json']),
  ('artisan-approved', 'artisan-approved', false, 104857600,
    array['image/webp','audio/mpeg','audio/ogg','video/mp4','application/pdf','model/gltf-binary','text/vtt','application/vnd.elysia.artisan-interactive+json']),
  ('artisan-thumbnails', 'artisan-thumbnails', false, 5242880,
    array['image/webp']),
  ('artisan-admin-evidence', 'artisan-admin-evidence', false, 104857600, null)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Existing Online uploads remain compatible, but the source objects become
-- owner-only private inputs. Public delivery is a service-role lookup followed
-- by bounded magic-byte/dimension validation and canonical re-encoding in the
-- Identity Worker. There is deliberately no anon policy and no public original.
drop policy if exists "profile owners read private originals" on storage.objects;
create policy "profile owners read private originals"
on storage.objects for select to authenticated
using (
  bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
);

drop policy if exists "profile owners upload private originals" on storage.objects;
create policy "profile owners upload private originals"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('profile-avatars','profile-banners')
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
  bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
)
with check (
  bucket_id in ('profile-avatars','profile-banners')
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
  bucket_id in ('profile-avatars','profile-banners')
  and pg_catalog.split_part(name, '/', 1) = auth.uid()::text
  and pg_catalog.split_part(name, '/', 2) = case bucket_id
    when 'profile-avatars' then 'avatars' else 'banners' end
  and name !~ '(^|/)\.\.(/|$)' and name !~ '[\\\\]'
);

drop policy if exists "artisan owners read approved derivatives" on storage.objects;
create policy "artisan owners read approved derivatives"
on storage.objects for select to authenticated
using (
  bucket_id in ('artisan-approved', 'artisan-thumbnails')
  and exists (
    select 1
    from artisan.media_assets as media
    where media.owner_user_id = auth.uid()
      and media.moderation_status = 'approved'
      and (
        (media.approved_bucket = bucket_id and media.approved_object_key = name)
        or (media.thumbnail_bucket = bucket_id and media.thumbnail_object_key = name)
        or exists (
          select 1 from artisan.media_caption_tracks as caption
          where caption.media_asset_id = media.id
            and caption.status = 'ready'
            and caption.approved_bucket = bucket_id
            and caption.approved_object_key = name
        )
      )
  )
);

-- Table privileges are still required before Storage RLS is evaluated. Anon
-- receives none; authenticated operations remain limited by the policies above.
grant select, insert, update, delete on storage.objects to authenticated, service_role;

create or replace function public.current_user_can_artisan_action(p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.uid() is not null and private.community_can_participate(auth.uid(), p_action), false);
$$;

alter function public.current_user_can_artisan_action(text) owner to postgres;
revoke all privileges on function public.current_user_can_artisan_action(text)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_artisan_action(text) to authenticated;

create or replace function public.current_user_has_artisan_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and auth.jwt() ->> 'aal' = 'aal2'
    and private.community_user_has_capability(auth.uid(), p_capability),
    false
  );
$$;

alter function public.current_user_has_artisan_capability(text) owner to postgres;
revoke all privileges on function public.current_user_has_artisan_capability(text)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_has_artisan_capability(text) to authenticated;

create or replace function private.artisan_active_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1 from artisan.memberships as membership
    where membership.user_id = p_user_id and membership.status = 'active'
  ), false);
$$;

alter function private.artisan_active_member(uuid) owner to postgres;
revoke all privileges on function private.artisan_active_member(uuid)
  from public, anon, authenticated, service_role;

-- Worker preflight for actor-scoped Artisan mutations. This deliberately
-- returns only coarse authorization state: no user id, assurance evidence,
-- jurisdiction, guardian record, or other private identity data crosses the
-- service boundary.
create or replace function public.artisan_authorize_actor_action(
  p_actor_user_id uuid,
  p_action text,
  p_adapter_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access private.account_participation%rowtype;
  v_internal_action text;
  v_allowed boolean := false;
  v_reason text := 'policy_gate_closed';
  v_adapter artisan.media_adapters%rowtype;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;

  select * into v_access
  from private.account_participation
  where user_id = p_actor_user_id;

  if not found then
    return pg_catalog.jsonb_build_object(
      'allowed', false,
      'ageBand', 'unknown',
      'participationState', 'read_only',
      'reason', 'participation_unavailable'
    );
  end if;

  if p_action not in ('membership','post','comment','appreciate','upload','challenge')
     or (p_action = 'upload' and p_adapter_key is null)
     or (p_action <> 'upload' and p_adapter_key is not null) then
    v_reason := 'invalid_action';
  elsif not private.community_account_is_recoverable(p_actor_user_id) then
    v_reason := 'account_unavailable';
  elsif p_action <> 'membership' and not private.artisan_active_member(p_actor_user_id) then
    v_reason := 'membership_required';
  else
    if p_action = 'upload' then
      select * into v_adapter
      from artisan.media_adapters
      where adapter_key = p_adapter_key;
      if not found or not v_adapter.enabled
         or (v_adapter.feature_flag_key is not null
             and not private.community_feature_enabled(v_adapter.feature_flag_key)) then
        v_reason := 'adapter_unavailable';
      else
        v_internal_action := case v_adapter.adapter_key
          when 'image_static' then 'artisan_upload_image'
          when 'audio' then 'artisan_upload_audio'
          when 'short_video' then 'artisan_upload_video'
          when 'pdf_document' then 'artisan_upload_document'
          when 'animation' then 'artisan_upload_animation'
          when 'model_3d' then 'artisan_upload_3d'
          when 'interactive_work' then 'artisan_upload_interactive'
          else null
        end;
      end if;
    else
      v_internal_action := case p_action
        when 'membership' then 'artisan_membership'
        when 'post' then 'artisan_post'
        when 'comment' then 'artisan_comment'
        when 'appreciate' then 'artisan_appreciate'
        when 'challenge' then 'artisan_submit_challenge'
      end;
    end if;

    if v_internal_action is not null then
      v_allowed := private.community_can_participate(p_actor_user_id, v_internal_action);
      v_reason := case when v_allowed then 'allowed' else 'policy_gate_closed' end;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'allowed', v_allowed,
    'ageBand', v_access.age_band,
    'participationState', v_access.participation_state,
    'reason', v_reason
  );
end;
$$;

alter function public.artisan_authorize_actor_action(uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_authorize_actor_action(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_authorize_actor_action(uuid, text, text) to service_role;

create or replace function private.artisan_theme_is_safe(p_theme jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_typeof(p_theme) = 'object'
    and not exists (
      select 1 from pg_catalog.jsonb_object_keys(p_theme) as key
      where key not in ('themeFamily','palette','frameStyle','typePairing','layout','motionLevel','textureFamily')
    )
    and coalesce(p_theme ->> 'themeFamily', '') in ('cosmic_scrapbook','infinite_corkboard','living_cave','impossible_museum','quiet_gate')
    and coalesce(p_theme ->> 'palette', '') in ('bruised_sunset','moss_and_ink','electric_lavender','rust_and_stars','paper_night','calm_neutral')
    and coalesce(p_theme ->> 'frameStyle', '') in ('paper_tape','rusted_reliquary','floating_museum','scribbled_border','plain_accessible')
    and coalesce(p_theme ->> 'typePairing', '') in ('cutout_and_serif','mono_and_hand','display_and_sans','quiet_serif')
    and coalesce(p_theme ->> 'layout', '') in ('clustered','linear','gallery','zine','quiet')
    and coalesce(p_theme ->> 'motionLevel', '') in ('none','subtle')
    and coalesce(p_theme ->> 'textureFamily', '') in ('paper','paint','stars','cork','stone','none'),
    false
  );
$$;

alter function private.artisan_theme_is_safe(jsonb) owner to postgres;
revoke all privileges on function private.artisan_theme_is_safe(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_target_exists(p_target_type text, p_target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return case p_target_type
    when 'artwork' then exists (select 1 from artisan.artworks where id = p_target_id)
    when 'post' then exists (select 1 from artisan.forum_posts where id = p_target_id)
    when 'comment' then exists (select 1 from artisan.comments where id = p_target_id)
    when 'profile' then exists (select 1 from public.profile_public_cards where user_id = p_target_id)
    when 'challenge' then exists (select 1 from artisan.challenges where id = p_target_id)
    when 'submission' then exists (select 1 from artisan.challenge_submissions where id = p_target_id)
    when 'media' then exists (select 1 from artisan.media_assets where id = p_target_id)
    else false
  end;
end;
$$;

alter function private.artisan_target_exists(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_target_exists(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_target_owner(
  p_target_type text,
  p_target_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_target_type
    when 'artwork' then (select owner_user_id from artisan.artworks where id = p_target_id)
    when 'post' then (select owner_user_id from artisan.forum_posts where id = p_target_id)
    when 'comment' then (select user_id from artisan.comments where id = p_target_id)
    when 'profile' then p_target_id
    when 'submission' then (select submitter_user_id from artisan.challenge_submissions where id = p_target_id)
    when 'media' then (select owner_user_id from artisan.media_assets where id = p_target_id)
    else null
  end;
$$;

alter function private.artisan_target_owner(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_target_owner(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_challenge_policy_allows(
  p_user_id uuid,
  p_challenge_id uuid,
  p_artwork_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from artisan.challenges as challenge
    join artisan.artworks as artwork
      on artwork.id = p_artwork_id and artwork.owner_user_id = p_user_id
    join private.account_participation as participation
      on participation.user_id = p_user_id
    where challenge.id = p_challenge_id
      and case
        when challenge.eligibility_policy = '{}'::jsonb
          then participation.participation_state = 'adult_eligible'
        else pg_catalog.jsonb_exists(
          challenge.eligibility_policy -> 'allowedParticipationStates',
          participation.participation_state
        )
      end
      and case challenge.creation_method_policy
        when 'human_only' then artwork.creation_method = 'human_created'
        when 'ai_assisted_allowed' then artwork.creation_method in (
          'human_created','ai_assisted','hybrid_mixed_process'
        )
        when 'all_disclosed_methods' then artwork.creation_method in (
          'human_created','ai_assisted','ai_generated_human_directed',
          'hybrid_mixed_process','procedural_generative'
        )
        when 'challenge_specific' then pg_catalog.jsonb_exists(
          challenge.eligibility_policy -> 'allowedCreationMethods',
          artwork.creation_method
        )
        else false
      end
  ), false);
$$;

alter function private.artisan_challenge_policy_allows(uuid, uuid, uuid) owner to postgres;
revoke all privileges on function private.artisan_challenge_policy_allows(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_challenge_submission_media_is_valid(
  p_submission_id uuid,
  p_challenge_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1 from artisan.submission_media
      where submission_id = p_submission_id
    )
    and not exists (
      select 1
      from artisan.submission_media as linked
      join artisan.challenge_submissions as submission
        on submission.id = linked.submission_id
      join artisan.artworks as artwork on artwork.id = submission.artwork_id
      join artisan.media_assets as media on media.id = linked.media_asset_id
      left join artisan.challenge_media_rules as rule
        on rule.challenge_id = p_challenge_id
       and rule.adapter_key = media.adapter_key
      where linked.submission_id = p_submission_id
        and (
          submission.challenge_id <> p_challenge_id
          or media.artwork_id <> submission.artwork_id
          or media.owner_user_id <> submission.submitter_user_id
          or media.processing_status not in ('approved','published')
          or media.moderation_status <> 'approved'
          or not media.metadata_stripped
          or rule.challenge_id is null
          or (rule.maximum_bytes is not null
            and (media.byte_size is null or media.byte_size > rule.maximum_bytes))
          or (rule.maximum_width is not null
            and (media.width is null or media.width > rule.maximum_width))
          or (rule.maximum_height is not null
            and (media.height is null or media.height > rule.maximum_height))
          or (rule.maximum_duration_seconds is not null
            and (media.duration_seconds is null
              or media.duration_seconds > rule.maximum_duration_seconds))
          or (rule.required_alt_text
            and pg_catalog.char_length(pg_catalog.btrim(artwork.alt_text)) = 0)
          or (rule.required_creation_method_disclosure
            and artwork.creation_method = 'undisclosed_legacy')
        )
    )
    and not exists (
      select 1
      from artisan.submission_media as linked
      join artisan.media_assets as media on media.id = linked.media_asset_id
      join artisan.challenge_media_rules as rule
        on rule.challenge_id = p_challenge_id
       and rule.adapter_key = media.adapter_key
      where linked.submission_id = p_submission_id
      group by rule.adapter_key, rule.maximum_files
      having pg_catalog.count(*) > rule.maximum_files
    ),
    false
  );
$$;

alter function private.artisan_challenge_submission_media_is_valid(uuid, uuid) owner to postgres;
revoke all privileges on function private.artisan_challenge_submission_media_is_valid(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_guardian_scope_for_target(p_target_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_target_type
    when 'artwork' then 'artisan_posting'
    when 'post' then 'artisan_posting'
    when 'comment' then 'artisan_commenting'
    when 'submission' then 'artisan_challenges'
    when 'media' then 'artisan_uploading'
    else null
  end;
$$;

alter function private.artisan_guardian_scope_for_target(text) owner to postgres;
revoke all privileges on function private.artisan_guardian_scope_for_target(text)
  from public, anon, authenticated, service_role;

-- Guardian approval is bound to exact server-canonical content, never merely
-- to a reusable UUID. The revision document includes all material content and
-- processed-media fingerprints but never Storage keys. The separate preview
-- is deliberately reviewable and bounded without exposing fingerprints,
-- private evidence, user UUIDs, or an unprocessed object URL.
create or replace function private.artisan_guardian_target_revision_document(
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_document jsonb;
begin
  if p_target_type = 'media' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type', 'media', 'id', media.id,
      'artworkId', media.artwork_id, 'adapterKey', media.adapter_key,
      'declaredMime', media.declared_mime, 'detectedMime', media.detected_mime,
      'approvedMime', media.approved_mime, 'byteSize', media.byte_size,
      'width', media.width, 'height', media.height,
      'durationSeconds', media.duration_seconds,
      'detectedChecksumSha256', media.detected_checksum_sha256,
      'approvedChecksumSha256', media.approved_checksum_sha256,
      'metadataStripped', media.metadata_stripped,
      'accessibilityDescription', media.accessibility_description,
      'transcript', media.transcript, 'audioDescription', media.audio_description,
      'keyboardInstructions', media.keyboard_instructions,
      'staticEquivalentDescription', media.static_equivalent_description,
      'captionTracks', media.caption_tracks,
      'flashWarning', media.flash_warning,
      'loudAudioWarning', media.loud_audio_warning,
      'spokenContent', media.spoken_content,
      'creatorDeclaresFlashRisk', media.creator_declared_flash_risk
    )) into v_document
    from artisan.media_assets as media where media.id = p_target_id;
  elsif p_target_type = 'artwork' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type', 'artwork', 'id', artwork.id, 'title', artwork.title,
      'description', artwork.description, 'artistStatement', artwork.artist_statement,
      'creationMethod', artwork.creation_method,
      'humanContributionNote', artwork.human_contribution_note,
      'creditLine', artwork.credit_line,
      'creditedNameOrPseudonym', artwork.credited_name_or_pseudonym,
      'licenseCode', artwork.license_code,
      'downloadAllowed', artwork.download_allowed,
      'altText', artwork.alt_text, 'contentWarnings', artwork.content_warnings,
      'tags', artwork.tags,
      'media', coalesce((
        select pg_catalog.jsonb_agg(
          private.artisan_guardian_target_revision_document('media', media.id)
          order by media.created_at, media.id
        ) from artisan.media_assets as media
        where media.artwork_id = artwork.id
          and media.processing_status not in ('expired','removed')
      ), '[]'::jsonb)
    )) into v_document
    from artisan.artworks as artwork where artwork.id = p_target_id;
  elsif p_target_type = 'post' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type', 'post', 'id', post.id, 'title', post.title,
      'artistStatement', post.artist_statement, 'theme', post.theme,
      'tags', post.tags, 'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds,
      'artworks', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'displayOrder', link.display_order,
          'revision', private.artisan_guardian_target_revision_document('artwork', link.artwork_id)
        ) order by link.display_order, link.artwork_id)
        from artisan.post_artworks as link where link.post_id = post.id
      ), '[]'::jsonb)
    )) into v_document
    from artisan.forum_posts as post where post.id = p_target_id;
  elsif p_target_type = 'comment' then
    select pg_catalog.jsonb_build_object(
      'type', 'comment', 'id', comment.id, 'postId', comment.post_id,
      'parentCommentId', comment.parent_comment_id,
      'depth', comment.depth, 'body', comment.body
    ) into v_document
    from artisan.comments as comment where comment.id = p_target_id;
  elsif p_target_type = 'submission' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type', 'submission', 'id', submission.id,
      'challengeId', submission.challenge_id,
      'artworkRevision', private.artisan_guardian_target_revision_document(
        'artwork', submission.artwork_id
      ),
      'ruleAcceptance', case when acceptance.id is null then null else
        pg_catalog.jsonb_build_object(
          'documentKey', acceptance.document_key,
          'documentVersion', acceptance.document_version,
          'contentSha256', acceptance.content_sha256
        ) end,
      'media', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'displayOrder', linked.display_order,
          'revision', private.artisan_guardian_target_revision_document(
            'media', linked.media_asset_id
          )
        ) order by linked.display_order, linked.media_asset_id)
        from artisan.submission_media as linked
        where linked.submission_id = submission.id
      ), '[]'::jsonb)
    )) into v_document
    from artisan.challenge_submissions as submission
    left join artisan.challenge_rule_acceptances as acceptance
      on acceptance.id = submission.rule_acceptance_id
    where submission.id = p_target_id;
  end if;
  return v_document;
end;
$$;

alter function private.artisan_guardian_target_revision_document(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_guardian_target_revision_document(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_guardian_target_revision_sha256(
  p_target_type text,
  p_target_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when revision.document is null then null else pg_catalog.encode(
    extensions.digest(revision.document::text, 'sha256'), 'hex'
  ) end
  from (select private.artisan_guardian_target_revision_document(
    p_target_type, p_target_id
  ) as document) as revision;
$$;

alter function private.artisan_guardian_target_revision_sha256(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_guardian_target_revision_sha256(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_guardian_target_preview(
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_preview jsonb;
begin
  if p_target_type = 'media' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'mediaAssetId', media.id, 'artworkId', media.artwork_id,
      'adapterKey', media.adapter_key,
      'declaredMime', media.declared_mime,
      'detectedMime', media.detected_mime,
      'approvedMime', media.approved_mime,
      'byteSize', media.byte_size, 'width', media.width, 'height', media.height,
      'durationSeconds', media.duration_seconds,
      'metadataStripped', media.metadata_stripped,
      'accessibilityDescription', media.accessibility_description,
      'transcript', media.transcript, 'audioDescription', media.audio_description,
      'keyboardInstructions', media.keyboard_instructions,
      'staticEquivalentDescription', media.static_equivalent_description,
      'flashWarning', media.flash_warning,
      'loudAudioWarning', media.loud_audio_warning,
      'spokenContent', media.spoken_content,
      'creatorDeclaresFlashRisk', media.creator_declared_flash_risk
    )) into v_preview from artisan.media_assets as media where media.id = p_target_id;
  elsif p_target_type = 'artwork' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'artworkId', artwork.id, 'title', artwork.title,
      'description', artwork.description, 'artistStatement', artwork.artist_statement,
      'creationMethod', artwork.creation_method,
      'humanContributionNote', artwork.human_contribution_note,
      'creditLine', artwork.credit_line, 'licenseCode', artwork.license_code,
      'altText', artwork.alt_text, 'contentWarnings', artwork.content_warnings,
      'tags', artwork.tags,
      'media', coalesce((select pg_catalog.jsonb_agg(
        private.artisan_guardian_target_preview('media', media.id)
        order by media.created_at, media.id
      ) from artisan.media_assets as media where media.artwork_id = artwork.id
        and media.processing_status not in ('expired','removed')), '[]'::jsonb)
    )) into v_preview from artisan.artworks as artwork where artwork.id = p_target_id;
  elsif p_target_type = 'post' then
    select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'postId', post.id, 'title', post.title,
      'artistStatement', post.artist_statement, 'theme', post.theme,
      'tags', post.tags, 'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds,
      'artworks', coalesce((select pg_catalog.jsonb_agg(
        private.artisan_guardian_target_preview('artwork', link.artwork_id)
        order by link.display_order, link.artwork_id
      ) from artisan.post_artworks as link where link.post_id = post.id), '[]'::jsonb)
    )) into v_preview from artisan.forum_posts as post where post.id = p_target_id;
  elsif p_target_type = 'comment' then
    select pg_catalog.jsonb_build_object(
      'commentId', comment.id, 'postId', comment.post_id,
      'postTitle', post.title, 'depth', comment.depth, 'body', comment.body
    ) into v_preview from artisan.comments as comment
    join artisan.forum_posts as post on post.id = comment.post_id
    where comment.id = p_target_id;
  elsif p_target_type = 'submission' then
    select pg_catalog.jsonb_build_object(
      'submissionId', submission.id,
      'challenge', pg_catalog.jsonb_build_object(
        'challengeId', challenge.id, 'slug', challenge.slug, 'title', challenge.title,
        'shortPrompt', challenge.short_prompt, 'deadlineAt', challenge.deadline_at
      ),
      'artwork', private.artisan_guardian_target_preview('artwork', submission.artwork_id),
      'media', coalesce((select pg_catalog.jsonb_agg(
        private.artisan_guardian_target_preview('media', linked.media_asset_id)
        order by linked.display_order, linked.media_asset_id
      ) from artisan.submission_media as linked
        where linked.submission_id = submission.id), '[]'::jsonb)
    ) into v_preview
    from artisan.challenge_submissions as submission
    join artisan.challenges as challenge on challenge.id = submission.challenge_id
    where submission.id = p_target_id;
  end if;
  return v_preview;
end;
$$;

alter function private.artisan_guardian_target_preview(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_guardian_target_preview(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_content_has_guardian_approval(
  p_owner_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from private.account_participation as participation
      where participation.user_id = p_owner_user_id
        and participation.age_band = 'under_13'
    ) then true
    when not private.community_feature_enabled('artisan_under13_content_approval') then false
    else exists (
      select 1
      from artisan.guardian_content_approvals as approval
      join private.guardian_relationships as relationship
        on relationship.id = approval.relationship_id
       and relationship.guardian_user_id = approval.decided_by
       and relationship.dependent_user_id = approval.dependent_user_id
       and relationship.status = 'active'
       and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
      join private.guardian_consents as consent
        on consent.relationship_id = relationship.id
       and consent.dependent_user_id = approval.dependent_user_id
       and consent.consent_scope = approval.consent_scope
       and consent.status = 'active'
       and consent.expires_at > pg_catalog.now()
      where approval.dependent_user_id = p_owner_user_id
        and approval.target_type = p_target_type
        and approval.target_id = p_target_id
        and approval.status = 'approved'
        and approval.approval_expires_at > pg_catalog.now()
        and approval.decision_revision_sha256 = approval.target_revision_sha256
        and approval.target_revision_sha256 =
          private.artisan_guardian_target_revision_sha256(p_target_type, p_target_id)
    )
  end;
$$;

alter function private.artisan_content_has_guardian_approval(uuid, text, uuid) owner to postgres;
revoke all privileges on function private.artisan_content_has_guardian_approval(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_guardian_approval_status(
  p_owner_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_approval artisan.guardian_content_approvals%rowtype;
  v_current_revision_sha256 text;
begin
  if not exists (
    select 1 from private.account_participation as participation
    where participation.user_id = p_owner_user_id
      and participation.age_band = 'under_13'
  ) then
    return pg_catalog.jsonb_build_object('required', false, 'status', 'not_required');
  end if;
  v_current_revision_sha256 := private.artisan_guardian_target_revision_sha256(
    p_target_type, p_target_id
  );
  select * into v_approval
  from artisan.guardian_content_approvals as approval
  where approval.dependent_user_id = p_owner_user_id
    and approval.target_type = p_target_type
    and approval.target_id = p_target_id
  order by (approval.status in ('pending','approved')) desc,
    approval.requested_at desc, approval.id desc
  limit 1;
  if v_approval.id is null then
    return pg_catalog.jsonb_build_object(
      'required', true, 'status', 'not_requested',
      'currentRevisionSha256', v_current_revision_sha256
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'required', true,
    'approvalRequestId', v_approval.id,
    'status', v_approval.status,
    'targetRevisionSha256', v_approval.target_revision_sha256,
    'currentRevisionSha256', v_current_revision_sha256,
    'revisionCurrent', v_approval.target_revision_sha256 = v_current_revision_sha256,
    'requestedAt', v_approval.requested_at,
    'decidedAt', v_approval.decided_at,
    'approvalExpiresAt', v_approval.approval_expires_at
  );
end;
$$;

alter function private.artisan_guardian_approval_status(uuid, text, uuid) owner to postgres;
revoke all privileges on function private.artisan_guardian_approval_status(uuid, text, uuid)
  from public, anon, authenticated, service_role;

-- This trigger is a final database backstop. Worker preflight and mutation
-- RPCs provide friendly errors, while direct table mutation still cannot make
-- under-thirteen content reviewable or public without the item-level approval.
create or replace function private.artisan_enforce_guardian_content_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_type text;
  v_target_id uuid;
  v_owner_user_id uuid;
  v_enters_guarded_state boolean := false;
begin
  if tg_table_name = 'artworks' then
    v_target_type := 'artwork'; v_target_id := new.id; v_owner_user_id := new.owner_user_id;
    v_enters_guarded_state := new.status in ('pending_review','published')
      and old.status not in ('pending_review','published');
  elsif tg_table_name = 'forum_posts' then
    v_target_type := 'post'; v_target_id := new.id; v_owner_user_id := new.owner_user_id;
    v_enters_guarded_state := new.status in ('pending_review','published')
      and old.status not in ('pending_review','published');
  elsif tg_table_name = 'comments' then
    v_target_type := 'comment'; v_target_id := new.id; v_owner_user_id := new.user_id;
    v_enters_guarded_state := new.status in ('published','edited')
      and old.status not in ('published','edited');
  elsif tg_table_name = 'challenge_submissions' then
    v_target_type := 'submission'; v_target_id := new.id; v_owner_user_id := new.submitter_user_id;
    v_enters_guarded_state := new.status in (
      'pending_review','eligible','judging','selected','not_selected','published'
    ) and old.status not in (
      'pending_review','eligible','judging','selected','not_selected','published'
    );
  elsif tg_table_name = 'media_assets' then
    v_target_type := 'media'; v_target_id := new.id; v_owner_user_id := new.owner_user_id;
    v_enters_guarded_state := new.processing_status in ('approved','published')
      and old.processing_status not in ('approved','published');
  end if;

  if v_enters_guarded_state
     and not private.artisan_content_has_guardian_approval(
       v_owner_user_id, v_target_type, v_target_id
     ) then
    raise exception using errcode = '42501', message = 'artisan_guardian_content_approval_required';
  end if;
  return new;
end;
$$;

alter function private.artisan_enforce_guardian_content_approval() owner to postgres;
revoke all privileges on function private.artisan_enforce_guardian_content_approval()
  from public, anon, authenticated, service_role;

create trigger artisan_artworks_require_guardian_content_approval
before update of status on artisan.artworks
for each row execute function private.artisan_enforce_guardian_content_approval();
create trigger artisan_posts_require_guardian_content_approval
before update of status on artisan.forum_posts
for each row execute function private.artisan_enforce_guardian_content_approval();
create trigger artisan_comments_require_guardian_content_approval
before update of status on artisan.comments
for each row execute function private.artisan_enforce_guardian_content_approval();
create trigger artisan_submissions_require_guardian_content_approval
before update of status on artisan.challenge_submissions
for each row execute function private.artisan_enforce_guardian_content_approval();
create trigger artisan_media_require_guardian_content_approval
before update of processing_status on artisan.media_assets
for each row execute function private.artisan_enforce_guardian_content_approval();

-- Once dependent content is reviewable or public, a material edit must match
-- the exact approved revision. Draft edits remain possible; requesting a new
-- approval atomically expires the older active revision. Nested checks prevent
-- a media or artwork edit from silently changing an already-approved room or
-- challenge submission.
create or replace function private.artisan_guardian_assert_current_revision(
  p_owner_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_guarded boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_guarded and not private.artisan_content_has_guardian_approval(
    p_owner_user_id, p_target_type, p_target_id
  ) then
    raise exception using errcode = '42501',
      message = 'artisan_guardian_content_revision_changed';
  end if;
end;
$$;

alter function private.artisan_guardian_assert_current_revision(uuid, text, uuid, boolean) owner to postgres;
revoke all privileges on function private.artisan_guardian_assert_current_revision(uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_guardian_material_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_artwork_id uuid;
  v_owner_user_id uuid;
begin
  if tg_table_name = 'artworks' then
    perform private.artisan_guardian_assert_current_revision(
      new.owner_user_id, 'artwork', new.id,
      new.status in ('pending_review','published')
    );
    for v_row in
      select post.owner_user_id, post.id, post.status
      from artisan.post_artworks as link
      join artisan.forum_posts as post on post.id = link.post_id
      where link.artwork_id = new.id
    loop
      perform private.artisan_guardian_assert_current_revision(
        v_row.owner_user_id, 'post', v_row.id,
        v_row.status in ('pending_review','published')
      );
    end loop;
    for v_row in
      select submission.submitter_user_id, submission.id, submission.status
      from artisan.challenge_submissions as submission
      where submission.artwork_id = new.id
    loop
      perform private.artisan_guardian_assert_current_revision(
        v_row.submitter_user_id, 'submission', v_row.id,
        v_row.status in ('pending_review','eligible','judging','selected','not_selected','published')
      );
    end loop;
  elsif tg_table_name = 'forum_posts' then
    perform private.artisan_guardian_assert_current_revision(
      new.owner_user_id, 'post', new.id,
      new.status in ('pending_review','published')
    );
  elsif tg_table_name = 'comments' then
    perform private.artisan_guardian_assert_current_revision(
      new.user_id, 'comment', new.id,
      new.status in ('published','edited')
    );
  elsif tg_table_name = 'challenge_submissions' then
    perform private.artisan_guardian_assert_current_revision(
      new.submitter_user_id, 'submission', new.id,
      new.status in ('pending_review','eligible','judging','selected','not_selected','published')
    );
  elsif tg_table_name = 'media_assets' then
    v_artwork_id := coalesce(new.artwork_id, old.artwork_id);
    v_owner_user_id := coalesce(new.owner_user_id, old.owner_user_id);
    if tg_op <> 'DELETE' then
      perform private.artisan_guardian_assert_current_revision(
        new.owner_user_id, 'media', new.id,
        new.processing_status in ('approved','published')
      );
    end if;
    select artwork.owner_user_id into v_owner_user_id
    from artisan.artworks as artwork where artwork.id = v_artwork_id;
    if v_owner_user_id is not null then
      perform private.artisan_guardian_assert_current_revision(
        v_owner_user_id, 'artwork', v_artwork_id,
        (select artwork.status in ('pending_review','published')
         from artisan.artworks as artwork where artwork.id = v_artwork_id)
      );
    end if;
    for v_row in
      select post.owner_user_id, post.id, post.status
      from artisan.post_artworks as link
      join artisan.forum_posts as post on post.id = link.post_id
      where link.artwork_id = v_artwork_id
    loop
      perform private.artisan_guardian_assert_current_revision(
        v_row.owner_user_id, 'post', v_row.id,
        v_row.status in ('pending_review','published')
      );
    end loop;
    for v_row in
      select distinct submission.submitter_user_id, submission.id, submission.status
      from artisan.challenge_submissions as submission
      left join artisan.submission_media as linked on linked.submission_id = submission.id
      where submission.artwork_id = v_artwork_id
         or linked.media_asset_id = coalesce(new.id, old.id)
    loop
      perform private.artisan_guardian_assert_current_revision(
        v_row.submitter_user_id, 'submission', v_row.id,
        v_row.status in ('pending_review','eligible','judging','selected','not_selected','published')
      );
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function private.artisan_guardian_material_revision_guard() owner to postgres;
revoke all privileges on function private.artisan_guardian_material_revision_guard()
  from public, anon, authenticated, service_role;

create trigger artisan_artworks_guard_approved_revision
after update of title, description, artist_statement, creation_method,
  human_contribution_note, credit_line, credited_name_or_pseudonym,
  license_code, download_allowed, alt_text, content_warnings, tags
on artisan.artworks for each row
execute function private.artisan_guardian_material_revision_guard();
create trigger artisan_posts_guard_approved_revision
after update of title, artist_statement, theme, tags, comments_enabled,
  appreciations_enabled, slow_mode_seconds
on artisan.forum_posts for each row
execute function private.artisan_guardian_material_revision_guard();
create trigger artisan_comments_guard_approved_revision
after update of body on artisan.comments for each row
execute function private.artisan_guardian_material_revision_guard();
create trigger artisan_submissions_guard_approved_revision
after update of challenge_id, artwork_id, rule_acceptance_id
on artisan.challenge_submissions for each row
execute function private.artisan_guardian_material_revision_guard();
create trigger artisan_media_guard_approved_revision
after insert or delete or update of artwork_id, adapter_key, declared_mime,
  detected_mime, approved_mime, byte_size, width, height, duration_seconds,
  detected_checksum_sha256, approved_checksum_sha256, metadata_stripped,
  accessibility_description, transcript, audio_description,
  keyboard_instructions, static_equivalent_description, caption_tracks,
  flash_warning, loud_audio_warning, spoken_content, creator_declared_flash_risk
on artisan.media_assets for each row
execute function private.artisan_guardian_material_revision_guard();

create or replace function private.artisan_guardian_link_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_parent_id uuid;
begin
  if tg_table_name = 'post_artworks' then
    v_parent_id := coalesce(new.post_id, old.post_id);
    select post.owner_user_id, post.status into v_row
    from artisan.forum_posts as post where post.id = v_parent_id;
    if found then
      perform private.artisan_guardian_assert_current_revision(
        v_row.owner_user_id, 'post', v_parent_id,
        v_row.status in ('pending_review','published')
      );
    end if;
  elsif tg_table_name = 'submission_media' then
    v_parent_id := coalesce(new.submission_id, old.submission_id);
    select submission.submitter_user_id, submission.status into v_row
    from artisan.challenge_submissions as submission where submission.id = v_parent_id;
    if found then
      perform private.artisan_guardian_assert_current_revision(
        v_row.submitter_user_id, 'submission', v_parent_id,
        v_row.status in ('pending_review','eligible','judging','selected','not_selected','published')
      );
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function private.artisan_guardian_link_revision_guard() owner to postgres;
revoke all privileges on function private.artisan_guardian_link_revision_guard()
  from public, anon, authenticated, service_role;

create trigger artisan_post_artworks_guard_approved_revision
after insert or update or delete on artisan.post_artworks for each row
execute function private.artisan_guardian_link_revision_guard();
create trigger artisan_submission_media_guard_approved_revision
after insert or update or delete on artisan.submission_media for each row
execute function private.artisan_guardian_link_revision_guard();

create or replace function private.artisan_staff_can_read(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and auth.jwt() ->> 'aal' = 'aal2'
    and private.community_user_has_capability(auth.uid(), p_capability),
    false
  );
$$;

alter function private.artisan_staff_can_read(text) owner to postgres;
revoke all privileges on function private.artisan_staff_can_read(text)
  from public, anon, authenticated, service_role;
grant execute on function private.artisan_staff_can_read(text) to authenticated;

-- One deliberately narrow RLS predicate exposes only the activation state. The
-- underlying feature flag table remains private, and the default is fail-closed.
create or replace function private.artisan_public_reads_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_feature_enabled('artisan_public_database_reads');
$$;

alter function private.artisan_public_reads_enabled() owner to postgres;
revoke all privileges on function private.artisan_public_reads_enabled()
  from public, anon, authenticated, service_role;
grant execute on function private.artisan_public_reads_enabled() to anon, authenticated;

-- Existing Online participation predates the Artisan age/legal activation
-- gates. Preserve those features while enforcing lifecycle terminal states and
-- the exact shared/narrow sanctions immediately. Future Online age/terms gates
-- can be activated separately without coupling them to the Artisan beta flag.
create or replace function private.community_online_action_allowed(
  p_user_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and p_scope in (
      'commune_posting','commune_commenting',
      'marketplace_publishing','job_posting'
    )
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, p_scope)
    and not exists (
      select 1 from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state in (
          'restricted','suspended','blocked','deletion_pending','deactivated'
        )
    ),
    false
  );
$$;

alter function private.community_online_action_allowed(uuid, text) owner to postgres;
revoke all privileges on function private.community_online_action_allowed(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.community_online_action_allowed(uuid, text)
  to authenticated;

-- Restrictive policies compose with the historical owner/reviewer policies.
-- They constrain a user's own writes while leaving moderators able to hide or
-- preserve evidence belonging to a sanctioned account.
drop policy if exists "shared restrictions gate own commune posts" on public.commune_posts;
create policy "shared restrictions gate own commune posts"
on public.commune_posts as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
)
with check (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own commune comments" on public.commune_comments;
create policy "shared restrictions gate own commune comments"
on public.commune_comments as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_commenting')
)
with check (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_commenting')
);

drop policy if exists "shared restrictions gate own commune media" on public.commune_media;
create policy "shared restrictions gate own commune media"
on public.commune_media as restrictive for all to authenticated
using (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'commune_posting')
)
with check (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own commune uploads" on public.commune_uploads;
create policy "shared restrictions gate own commune uploads"
on public.commune_uploads as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
)
with check (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own code documents" on public.commune_code_documents;
create policy "shared restrictions gate own code documents"
on public.commune_code_documents as restrictive for all to authenticated
using (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'commune_posting')
)
with check (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own code annotations" on public.commune_code_annotations;
create policy "shared restrictions gate own code annotations"
on public.commune_code_annotations as restrictive for all to authenticated
using (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_commenting')
)
with check (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_commenting')
);

drop policy if exists "shared restrictions gate own code revisions" on public.commune_code_revision_proposals;
create policy "shared restrictions gate own code revisions"
on public.commune_code_revision_proposals as restrictive for all to authenticated
using (
  proposer_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(proposer_user_id, 'commune_commenting')
)
with check (
  proposer_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(proposer_user_id, 'commune_commenting')
);

drop policy if exists "shared restrictions gate own repo showcases" on public.commune_repository_showcases;
create policy "shared restrictions gate own repo showcases"
on public.commune_repository_showcases as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
)
with check (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own research notes" on public.commune_research_notes;
create policy "shared restrictions gate own research notes"
on public.commune_research_notes as restrictive for all to authenticated
using (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_posting')
)
with check (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own troubleshooting" on public.commune_troubleshooting_posts;
create policy "shared restrictions gate own troubleshooting"
on public.commune_troubleshooting_posts as restrictive for all to authenticated
using (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_posting')
)
with check (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'commune_posting')
);

drop policy if exists "shared restrictions gate own sandbox reviews" on public.commune_sandbox_review_requests;
create policy "shared restrictions gate own sandbox reviews"
on public.commune_sandbox_review_requests as restrictive for all to authenticated
using (
  coalesce(submitted_by, user_id) is distinct from auth.uid()
  or private.community_online_action_allowed(coalesce(submitted_by, user_id), 'commune_posting')
)
with check (
  coalesce(submitted_by, user_id) is distinct from auth.uid()
  or private.community_online_action_allowed(coalesce(submitted_by, user_id), 'commune_posting')
);

drop policy if exists "shared restrictions gate own job posts" on public.commune_job_posts;
create policy "shared restrictions gate own job posts"
on public.commune_job_posts as restrictive for all to authenticated
using (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'job_posting')
)
with check (
  author_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(author_user_id, 'job_posting')
);

drop policy if exists "shared restrictions gate own developer profile" on public.developer_profiles;
create policy "shared restrictions gate own developer profile"
on public.developer_profiles as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'marketplace_publishing')
)
with check (
  user_id is distinct from auth.uid()
  or private.community_online_action_allowed(user_id, 'marketplace_publishing')
);

drop policy if exists "shared restrictions gate own addon drafts" on public.addon_drafts;
create policy "shared restrictions gate own addon drafts"
on public.addon_drafts as restrictive for all to authenticated
using (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'marketplace_publishing')
)
with check (
  owner_user_id is distinct from auth.uid()
  or private.community_online_action_allowed(owner_user_id, 'marketplace_publishing')
);

drop policy if exists "shared restrictions gate own addon submissions" on public.addon_submissions;
create policy "shared restrictions gate own addon submissions"
on public.addon_submissions as restrictive for all to authenticated
using (
  submitted_by is distinct from auth.uid()
  or private.community_online_action_allowed(submitted_by, 'marketplace_publishing')
)
with check (
  submitted_by is distinct from auth.uid()
  or private.community_online_action_allowed(submitted_by, 'marketplace_publishing')
);

-- Publication triggers also cover SECURITY DEFINER review/publish functions,
-- which intentionally bypass RLS. Moderation can still hide/remove content;
-- only transitions that expose sanctioned content are rejected.
create or replace function private.enforce_shared_commune_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text = 'published'
     and (new.visibility::text = 'public'
       or coalesce(new.visibility_state, '') in ('published','public'))
     and not private.community_online_action_allowed(new.user_id, 'commune_posting') then
    raise exception using errcode = '42501', message = 'commune_shared_restriction_active';
  end if;
  if new.post_type::text = 'job_post'
     and new.status::text = 'published' and new.visibility::text = 'public'
     and not private.community_online_action_allowed(new.user_id, 'job_posting') then
    raise exception using errcode = '42501', message = 'job_post_shared_restriction_active';
  end if;
  return new;
end;
$$;

alter function private.enforce_shared_commune_publication() owner to postgres;
revoke all privileges on function private.enforce_shared_commune_publication()
  from public, anon, authenticated, service_role;
drop trigger if exists enforce_shared_commune_publication on public.commune_posts;
create trigger enforce_shared_commune_publication
before insert or update of status, visibility, visibility_state, post_type, user_id
on public.commune_posts for each row
execute function private.enforce_shared_commune_publication();

create or replace function private.enforce_shared_comment_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('published','edited')
     and not private.community_online_action_allowed(new.user_id, 'commune_commenting') then
    raise exception using errcode = '42501', message = 'commune_comment_shared_restriction_active';
  end if;
  return new;
end;
$$;

alter function private.enforce_shared_comment_publication() owner to postgres;
revoke all privileges on function private.enforce_shared_comment_publication()
  from public, anon, authenticated, service_role;
drop trigger if exists enforce_shared_comment_publication on public.commune_comments;
create trigger enforce_shared_comment_publication
before insert or update of status, visibility_state, user_id
on public.commune_comments for each row
execute function private.enforce_shared_comment_publication();

create or replace function private.enforce_shared_marketplace_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_user_id uuid;
  v_publishing boolean := false;
begin
  if tg_table_name = 'developer_profiles' then
    v_user_id := (v_row ->> 'user_id')::uuid;
    v_publishing := v_row ->> 'status' in ('requested','active','trusted');
  elsif tg_table_name = 'addon_drafts' then
    v_user_id := (v_row ->> 'owner_user_id')::uuid;
    v_publishing := (v_row ->> 'submission_status') in (
      'ready_to_submit','submitted','approved','published'
    ) or (v_row ->> 'review_status') in ('pending','approved','published');
  elsif tg_table_name = 'addon_submissions' then
    v_user_id := (v_row ->> 'submitted_by')::uuid;
    v_publishing := (v_row ->> 'status') in ('pending','approved','published');
  elsif tg_table_name = 'marketplace_listings' then
    select profile.user_id into v_user_id
    from public.developer_profiles as profile
    where profile.id = (v_row ->> 'developer_profile_id')::uuid;
    v_publishing := v_row ->> 'listing_status' = 'published';
  elsif tg_table_name = 'marketplace_addon_versions' then
    select profile.user_id into v_user_id
    from public.marketplace_listings as listing
    join public.developer_profiles as profile
      on profile.id = listing.developer_profile_id
    where listing.id = (v_row ->> 'listing_id')::uuid;
    v_publishing := v_row ->> 'review_status' = 'approved'
      and v_row ->> 'published_at' is not null;
  end if;
  if v_publishing and v_user_id is not null
     and not private.community_online_action_allowed(v_user_id, 'marketplace_publishing') then
    raise exception using errcode = '42501', message = 'marketplace_shared_restriction_active';
  end if;
  return new;
end;
$$;

alter function private.enforce_shared_marketplace_publication() owner to postgres;
revoke all privileges on function private.enforce_shared_marketplace_publication()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_shared_marketplace_publication on public.developer_profiles;
create trigger enforce_shared_marketplace_publication
before insert or update on public.developer_profiles for each row
execute function private.enforce_shared_marketplace_publication();
drop trigger if exists enforce_shared_marketplace_publication on public.addon_drafts;
create trigger enforce_shared_marketplace_publication
before insert or update on public.addon_drafts for each row
execute function private.enforce_shared_marketplace_publication();
drop trigger if exists enforce_shared_marketplace_publication on public.addon_submissions;
create trigger enforce_shared_marketplace_publication
before insert or update on public.addon_submissions for each row
execute function private.enforce_shared_marketplace_publication();
drop trigger if exists enforce_shared_marketplace_publication on public.marketplace_listings;
create trigger enforce_shared_marketplace_publication
before insert or update on public.marketplace_listings for each row
execute function private.enforce_shared_marketplace_publication();
drop trigger if exists enforce_shared_marketplace_publication on public.marketplace_addon_versions;
create trigger enforce_shared_marketplace_publication
before insert or update on public.marketplace_addon_versions for each row
execute function private.enforce_shared_marketplace_publication();

create or replace function private.artisan_mentions_are_valid(
  p_actor_user_id uuid,
  p_mentioned_user_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select mentioned_user_id
    from pg_catalog.unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as mentioned_user_id
  )
  select coalesce(
    pg_catalog.cardinality(coalesce(p_mentioned_user_ids, '{}'::uuid[])) <= 20
    and (select pg_catalog.count(*) from requested)
      = (select pg_catalog.count(distinct mentioned_user_id) from requested)
    and not exists (
      select 1
      from requested
      left join public.profile_public_cards as card
        on card.user_id = requested.mentioned_user_id and card.public_profile_enabled
       and private.community_profile_is_public(card.user_id)
      where requested.mentioned_user_id = p_actor_user_id
         or card.user_id is null
         or exists (
           select 1 from artisan.user_blocks as block
           where (block.blocker_user_id = p_actor_user_id and block.blocked_user_id = requested.mentioned_user_id)
              or (block.blocked_user_id = p_actor_user_id and block.blocker_user_id = requested.mentioned_user_id)
         )
    ),
    false
  );
$$;

alter function private.artisan_mentions_are_valid(uuid, uuid[]) owner to postgres;
revoke all privileges on function private.artisan_mentions_are_valid(uuid, uuid[])
  from public, anon, authenticated, service_role;

-- Resolve browser-visible handles to internal UUIDs without ever returning the
-- mapping. The whole mention set fails atomically when any handle is malformed,
-- duplicated after normalization, unavailable, self-referential, or blocked.
create or replace function private.artisan_resolve_mention_handles(
  p_actor_user_id uuid,
  p_mentioned_handles text[]
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_handles text[];
  v_user_ids uuid[];
begin
  select coalesce(pg_catalog.array_agg(
    pg_catalog.lower(case when pg_catalog.left(value, 1) = '@'
      then pg_catalog.substr(value, 2) else value end)
    order by ordinality
  ), '{}'::text[])
  into v_handles
  from pg_catalog.unnest(coalesce(p_mentioned_handles, '{}'::text[]))
    with ordinality as requested(value, ordinality);

  if pg_catalog.cardinality(v_handles) > 20
     or exists (
       select 1 from pg_catalog.unnest(v_handles) as handle
       where handle is null
          or pg_catalog.char_length(handle) not between 2 and 80
          or handle !~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
     )
     or (select pg_catalog.count(*) from pg_catalog.unnest(v_handles))
       <> (select pg_catalog.count(distinct handle) from pg_catalog.unnest(v_handles) as handle) then
    raise exception using errcode = '22023', message = 'artisan_comment_mentions_invalid';
  end if;

  select coalesce(pg_catalog.array_agg(card.user_id order by requested.ordinality), '{}'::uuid[])
  into v_user_ids
  from pg_catalog.unnest(v_handles) with ordinality as requested(handle, ordinality)
  join private.community_safe_public_profile_cards as card
    on card.handle = requested.handle;

  if pg_catalog.cardinality(v_user_ids) <> pg_catalog.cardinality(v_handles)
     or not private.artisan_mentions_are_valid(p_actor_user_id, v_user_ids) then
    raise exception using errcode = '22023', message = 'artisan_comment_mentions_invalid';
  end if;
  return v_user_ids;
end;
$$;

alter function private.artisan_resolve_mention_handles(uuid, text[]) owner to postgres;
revoke all privileges on function private.artisan_resolve_mention_handles(uuid, text[])
  from public, anon, authenticated, service_role;

-- Public and self RLS. Sensitive queues remain inaccessible to browsers unless
-- an explicit AAL2 capability policy is present.
create policy "members read own membership"
on artisan.memberships for select to authenticated
using (user_id = auth.uid());

create policy "users read own blocks"
on artisan.user_blocks for select to authenticated
using (blocker_user_id = auth.uid());
create policy "users create own blocks"
on artisan.user_blocks for insert to authenticated
with check (blocker_user_id = auth.uid() and blocked_user_id <> auth.uid());
create policy "users remove own blocks"
on artisan.user_blocks for delete to authenticated
using (blocker_user_id = auth.uid());

create policy "media adapter catalog is readable"
on artisan.media_adapters for select to anon, authenticated
using (true);

create policy "published artworks are readable"
on artisan.artworks for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'published' and moderation_status = 'approved'
);
create policy "owners read own artworks"
on artisan.artworks for select to authenticated
using (owner_user_id = auth.uid());
create policy "artwork staff read scoped artworks"
on artisan.artworks for select to authenticated
using (
  private.artisan_staff_can_read('artisan_media_review')
  or private.artisan_staff_can_read('artisan_forum_moderate')
  or private.artisan_staff_can_read('artisan_submissions_review')
  or private.artisan_staff_can_read('artisan_cases_manage')
);

create policy "owners read own caption derivative metadata"
on artisan.media_caption_tracks for select to authenticated
using (exists (
  select 1 from artisan.media_assets as media
  where media.id = media_caption_tracks.media_asset_id
    and media.owner_user_id = auth.uid()
));
create policy "media reviewers read caption derivative metadata"
on artisan.media_caption_tracks for select to authenticated
using (private.artisan_staff_can_read('artisan_media_review'));

create policy "public reads published artwork credits"
on artisan.artwork_credits for select to anon, authenticated
using (confirmation_status in ('not_required','confirmed') and exists (
  select 1 from artisan.artworks as artwork
  where artwork.id = artwork_credits.artwork_id
    and private.artisan_public_reads_enabled()
    and artwork.status = 'published' and artwork.moderation_status = 'approved'
));
create policy "owners read artwork credits"
on artisan.artwork_credits for select to authenticated
using (exists (
  select 1 from artisan.artworks as artwork
  where artwork.id = artwork_credits.artwork_id and artwork.owner_user_id = auth.uid()
));

create policy "public reads confirmed collaborators"
on artisan.artwork_collaborators for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'accepted' and exists (
    select 1 from artisan.artworks as artwork
    where artwork.id = artwork_collaborators.artwork_id
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
  )
);
create policy "collaborators read own invitations"
on artisan.artwork_collaborators for select to authenticated
using (collaborator_user_id = auth.uid());

create policy "public reads active published artwork licenses"
on artisan.artwork_licenses for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and terminated_at is null
  and exists (
    select 1 from artisan.artworks as artwork
    where artwork.id = artwork_licenses.artwork_id
      and artwork.status = 'published'
      and artwork.moderation_status = 'approved'
  )
);
create policy "owners read artwork license history"
on artisan.artwork_licenses for select to authenticated
using (exists (
  select 1 from artisan.artworks as artwork
  where artwork.id = artwork_licenses.artwork_id and artwork.owner_user_id = auth.uid()
));

create policy "owners read own media records"
on artisan.media_assets for select to authenticated
using (owner_user_id = auth.uid());
create policy "media reviewers read media records"
on artisan.media_assets for select to authenticated
using (private.artisan_staff_can_read('artisan_media_review'));
create policy "system operators read media job health"
on artisan.media_processing_jobs for select to authenticated
using (private.artisan_staff_can_read('artisan_system_view'));

create policy "published forum posts are readable"
on artisan.forum_posts for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'published' and moderation_status = 'approved'
);
create policy "owners read own forum posts"
on artisan.forum_posts for select to authenticated
using (owner_user_id = auth.uid());
create policy "forum moderators read forum posts"
on artisan.forum_posts for select to authenticated
using (private.artisan_staff_can_read('artisan_forum_moderate'));

create policy "post artwork links follow post visibility"
on artisan.post_artworks for select to anon, authenticated
using (exists (
  select 1 from artisan.forum_posts as post
  where post.id = post_artworks.post_id
    and private.artisan_public_reads_enabled()
    and post.status = 'published' and post.moderation_status = 'approved'
));
create policy "owners read own post artwork links"
on artisan.post_artworks for select to authenticated
using (exists (
  select 1 from artisan.forum_posts as post
  where post.id = post_artworks.post_id and post.owner_user_id = auth.uid()
));

create policy "published comments are readable"
on artisan.comments for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status in ('published','edited') and moderation_status = 'approved'
  and exists (
    select 1 from artisan.forum_posts as post
    where post.id = comments.post_id
      and post.status = 'published'
      and post.moderation_status = 'approved'
  )
);
create policy "authors read own comments"
on artisan.comments for select to authenticated
using (user_id = auth.uid());
create policy "forum moderators read comments"
on artisan.comments for select to authenticated
using (private.artisan_staff_can_read('artisan_forum_moderate'));

create policy "comment authors read own revisions"
on artisan.comment_revisions for select to authenticated
using (exists (
  select 1 from artisan.comments as comment
  where comment.id = comment_revisions.comment_id and comment.user_id = auth.uid()
));
create policy "forum moderators read comment revisions"
on artisan.comment_revisions for select to authenticated
using (private.artisan_staff_can_read('artisan_forum_moderate'));
create policy "comment participants read mentions"
on artisan.comment_mentions for select to authenticated
using (
  mentioned_user_id = auth.uid()
  or exists (
    select 1 from artisan.comments as comment
    where comment.id = comment_mentions.comment_id and comment.user_id = auth.uid()
  )
  or private.artisan_staff_can_read('artisan_forum_moderate')
);

create policy "users read own appreciations"
on artisan.appreciations for select to authenticated
using (user_id = auth.uid());

create policy "published challenges are readable"
on artisan.challenges for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and published_at is not null and status not in ('draft','cancelled')
  and visibility in ('public','unlisted')
);
create policy "challenge managers read all challenges"
on artisan.challenges for select to authenticated
using (private.artisan_staff_can_read('artisan_challenges_manage'));

create policy "published challenge media rules are readable"
on artisan.challenge_media_rules for select to anon, authenticated
using (exists (
  select 1 from artisan.challenges as challenge
  where challenge.id = challenge_media_rules.challenge_id
    and private.artisan_public_reads_enabled()
    and challenge.published_at is not null and challenge.status not in ('draft','cancelled')
    and challenge.visibility in ('public','unlisted')
));
create policy "challenge managers read all media rules"
on artisan.challenge_media_rules for select to authenticated
using (private.artisan_staff_can_read('artisan_challenges_manage'));

create policy "judges read own assignments"
on artisan.challenge_judges for select to authenticated
using (judge_user_id = auth.uid());
create policy "judging managers read assignments"
on artisan.challenge_judges for select to authenticated
using (
  private.artisan_staff_can_read('artisan_judging_manage')
  or private.artisan_staff_can_read('artisan_challenges_manage')
);

create policy "submitters read own rule acceptances"
on artisan.challenge_rule_acceptances for select to authenticated
using (user_id = auth.uid());
create policy "submitters read own submissions"
on artisan.challenge_submissions for select to authenticated
using (submitter_user_id = auth.uid());
create policy "submission reviewers read submissions"
on artisan.challenge_submissions for select to authenticated
using (private.artisan_staff_can_read('artisan_submissions_review'));
create policy "submitters read own submission media"
on artisan.submission_media for select to authenticated
using (exists (
  select 1 from artisan.challenge_submissions as submission
  where submission.id = submission_media.submission_id
    and submission.submitter_user_id = auth.uid()
));
create policy "submission reviewers read submission media"
on artisan.submission_media for select to authenticated
using (private.artisan_staff_can_read('artisan_submissions_review'));

create policy "judges read own score records"
on artisan.challenge_scores for select to authenticated
using (judge_user_id = auth.uid());
create policy "challenge managers read scores"
on artisan.challenge_scores for select to authenticated
using (private.artisan_staff_can_read('artisan_challenges_manage'));
create policy "judges read own score history"
on artisan.challenge_score_events for select to authenticated
using (judge_user_id = auth.uid());
create policy "challenge managers read score history"
on artisan.challenge_score_events for select to authenticated
using (
  private.artisan_staff_can_read('artisan_challenges_manage')
  or private.artisan_staff_can_read('artisan_judging_manage')
);

create policy "published awards are readable"
on artisan.challenge_awards for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'published'
  and exists (
    select 1
    from artisan.challenge_submissions as submission
    join artisan.artworks as artwork on artwork.id = submission.artwork_id
    where submission.id = challenge_awards.submission_id
      and submission.status = 'published'
      and submission.moderation_status = 'approved'
      and artwork.status = 'published'
      and artwork.moderation_status = 'approved'
  )
);
create policy "challenge managers read awards"
on artisan.challenge_awards for select to authenticated
using (private.artisan_staff_can_read('artisan_challenges_manage'));
create policy "artists read own winner agreements"
on artisan.award_agreement_acceptances for select to authenticated
using (artist_user_id = auth.uid());
create policy "challenge managers read winner agreements"
on artisan.award_agreement_acceptances for select to authenticated
using (
  private.artisan_staff_can_read('artisan_challenges_manage')
  or private.artisan_staff_can_read('artisan_gallery_manage')
);

create policy "published gallery entries are readable"
on artisan.gallery_entries for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'published'
  and exists (
    select 1 from artisan.artworks as artwork
    where artwork.id = gallery_entries.artwork_id
      and artwork.status = 'published'
      and artwork.moderation_status = 'approved'
  )
  and (
    award_id is null
    or exists (
      select 1 from artisan.challenge_awards as award
      where award.id = gallery_entries.award_id and award.status = 'published'
    )
  )
);
create policy "published featured collections are readable"
on artisan.featured_collections for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and status = 'published'
  and (starts_at is null or starts_at <= pg_catalog.now())
  and (ends_at is null or ends_at > pg_catalog.now())
);
create policy "published featured entries are readable"
on artisan.featured_entries for select to anon, authenticated
using (
  private.artisan_public_reads_enabled()
  and starts_at <= pg_catalog.now()
  and (ends_at is null or ends_at > pg_catalog.now())
  and exists (
    select 1 from artisan.featured_collections as collection
    where collection.slug = featured_entries.collection_slug
      and collection.status = 'published'
      and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
      and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
  )
  and exists (
    select 1
    from artisan.gallery_entries as gallery
    join artisan.artworks as artwork on artwork.id = gallery.artwork_id
    where gallery.id = featured_entries.gallery_entry_id
      and gallery.status = 'published'
      and artwork.status = 'published'
      and artwork.moderation_status = 'approved'
      and (
        gallery.award_id is null
        or exists (
          select 1 from artisan.challenge_awards as award
          where award.id = gallery.award_id and award.status = 'published'
        )
      )
  )
);

create policy "reporters read own report status"
on artisan.reports for select to authenticated
using (reporter_user_id = auth.uid());
create policy "report triagers read reports"
on artisan.reports for select to authenticated
using (private.artisan_staff_can_read('artisan_reports_triage'));
create policy "case managers read ordinary cases"
on artisan.moderation_cases for select to authenticated
using (
  not child_safety_sensitive and private.artisan_staff_can_read('artisan_cases_manage')
  or child_safety_sensitive and private.artisan_staff_can_read('artisan_child_safety_manage')
);
create policy "assigned staff read case assignments"
on artisan.case_assignments for select to authenticated
using (
  assigned_user_id = auth.uid()
  or private.artisan_staff_can_read('artisan_cases_manage')
  or private.artisan_staff_can_read('artisan_child_safety_manage')
);
create policy "case staff read moderation actions"
on artisan.moderation_actions for select to authenticated
using (
  private.artisan_staff_can_read('artisan_cases_manage')
  or private.artisan_staff_can_read('artisan_child_safety_manage')
  or private.artisan_staff_can_read('artisan_appeals_review')
);
create policy "appellants read own appeals"
on artisan.appeals for select to authenticated
using (appellant_user_id = auth.uid());
create policy "appeal reviewers read appeals"
on artisan.appeals for select to authenticated
using (private.artisan_staff_can_read('artisan_appeals_review'));
create policy "requesters read own credit corrections"
on artisan.credit_correction_requests for select to authenticated
using (requester_user_id = auth.uid());
create policy "credit reviewers read corrections"
on artisan.credit_correction_requests for select to authenticated
using (private.artisan_staff_can_read('artisan_credits_correct'));
create policy "copyright staff read dmca cases"
on artisan.dmca_cases for select to authenticated
using (private.artisan_staff_can_read('artisan_copyright_manage'));
create policy "authorized staff read content takedowns"
on artisan.content_takedowns for select to authenticated
using (
  private.artisan_staff_can_read('artisan_copyright_manage')
  or private.artisan_staff_can_read('artisan_child_safety_manage')
  or private.artisan_staff_can_read('artisan_cases_manage')
);
create policy "case staff read legal holds"
on artisan.legal_hold_records for select to authenticated
using (
  private.artisan_staff_can_read('artisan_cases_manage')
  or private.artisan_staff_can_read('artisan_child_safety_manage')
  or private.artisan_staff_can_read('artisan_copyright_manage')
);
create policy "users read own notifications"
on artisan.notifications for select to authenticated
using (user_id = auth.uid());
create policy "system operators read retention tasks"
on artisan.retention_tasks for select to authenticated
using (private.artisan_staff_can_read('artisan_system_view'));

grant select on artisan.media_adapters to anon, authenticated;
grant select on artisan.artworks, artisan.artwork_credits, artisan.artwork_collaborators, artisan.artwork_licenses,
  artisan.forum_posts, artisan.post_artworks, artisan.comments,
  artisan.challenges, artisan.challenge_media_rules, artisan.challenge_awards,
  artisan.gallery_entries, artisan.featured_collections, artisan.featured_entries
  to anon, authenticated;
grant select on artisan.memberships, artisan.user_blocks, artisan.media_assets, artisan.media_caption_tracks, artisan.media_processing_jobs,
  artisan.comment_revisions, artisan.comment_mentions, artisan.appreciations, artisan.challenge_rule_acceptances,
  artisan.challenge_judges, artisan.challenge_submissions, artisan.submission_media, artisan.challenge_scores,
  artisan.challenge_score_events, artisan.award_agreement_acceptances,
  artisan.reports, artisan.moderation_cases, artisan.case_assignments,
  artisan.moderation_actions, artisan.appeals, artisan.credit_correction_requests,
  artisan.dmca_cases, artisan.content_takedowns, artisan.legal_hold_records, artisan.notifications,
  artisan.retention_tasks
  to authenticated;
grant insert, delete on artisan.user_blocks to authenticated;

-- Worker and self-service RPCs follow.

create or replace function public.register_community_legal_document_version(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_document_key text,
  p_document_version text,
  p_public_path text,
  p_content_sha256 text,
  p_activate boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_legal_manage');
  if p_client_request_id is null
     or coalesce(p_document_key, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or pg_catalog.char_length(coalesce(p_document_version, '')) not between 1 and 120
     or coalesce(p_public_path, '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
     or coalesce(p_content_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_legal_document_invalid';
  end if;
  insert into private.community_legal_document_versions(
    document_key, document_version, public_path, content_sha256,
    status, effective_at, approved_by
  ) values (
    p_document_key, p_document_version, p_public_path, p_content_sha256,
    'approved', pg_catalog.now(), p_actor_user_id
  );
  if p_activate then
    insert into private.community_active_legal_documents(
      document_key, document_version, activated_by
    ) values (
      p_document_key, p_document_version, p_actor_user_id
    ) on conflict (document_key) do update
    set document_version = excluded.document_version,
        activated_at = pg_catalog.now(), activated_by = excluded.activated_by;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_legal_manage',
    'community_legal_document_registered', 'community_legal_document',
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'documentKey', p_document_key, 'documentVersion', p_document_version,
      'contentSha256', p_content_sha256, 'activated', p_activate
    )
  );
  return pg_catalog.jsonb_build_object(
    'documentKey', p_document_key, 'documentVersion', p_document_version,
    'contentSha256', p_content_sha256, 'active', p_activate
  );
end;
$$;

alter function public.register_community_legal_document_version(uuid, text, uuid, text, text, text, text, boolean, text) owner to postgres;
revoke all privileges on function public.register_community_legal_document_version(uuid, text, uuid, text, text, text, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_community_legal_document_version(uuid, text, uuid, text, text, text, text, boolean, text) to service_role;

create or replace function public.set_community_feature_flag(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_feature_key text,
  p_enabled boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_feature_flags_manage');
  if p_client_request_id is null
     or not exists (select 1 from private.community_feature_flags where feature_key = p_feature_key)
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_feature_flag_action_invalid';
  end if;
  if p_enabled and (
    (p_feature_key = 'artisan_teen_public_profiles'
      and not private.community_feature_enabled('artisan_teen_participation'))
    or (p_feature_key = 'artisan_under13_public_profiles' and (
      not private.community_feature_enabled('artisan_under13_participation')
      or not private.community_feature_enabled('artisan_guardian_dependent_profile_controls')
    ))
    or (p_feature_key in (
      'artisan_under13_posting','artisan_under13_commenting',
      'artisan_under13_media','artisan_under13_challenges'
    ) and (
      not private.community_feature_enabled('artisan_under13_participation')
      or not private.community_feature_enabled('artisan_under13_content_approval')
    ))
    or (p_feature_key = 'artisan_under13_appreciation'
      and not private.community_feature_enabled('artisan_under13_participation'))
  ) then
    raise exception using errcode = '55000', message = 'community_feature_flag_dependency_missing';
  end if;
  if not p_enabled and (
    (p_feature_key = 'artisan_teen_participation'
      and private.community_feature_enabled('artisan_teen_public_profiles'))
    or (p_feature_key = 'artisan_under13_participation' and exists (
      select 1 from private.community_feature_flags as flag
      where flag.feature_key in (
        'artisan_under13_public_profiles','artisan_under13_posting',
        'artisan_under13_commenting','artisan_under13_appreciation',
        'artisan_under13_media','artisan_under13_challenges'
      ) and flag.enabled
    ))
    or (p_feature_key = 'artisan_under13_content_approval' and exists (
      select 1 from private.community_feature_flags as flag
      where flag.feature_key in (
        'artisan_under13_posting','artisan_under13_commenting',
        'artisan_under13_media','artisan_under13_challenges'
      ) and flag.enabled
    ))
    or (p_feature_key = 'artisan_guardian_dependent_profile_controls'
      and private.community_feature_enabled('artisan_under13_public_profiles'))
  ) then
    raise exception using errcode = '55000', message = 'community_feature_flag_dependency_active';
  end if;
  insert into private.community_feature_flag_actions(
    client_request_id, feature_key, enabled, actor_user_id, actor_aal, private_reason
  ) values (
    p_client_request_id, p_feature_key, p_enabled, p_actor_user_id,
    p_actor_aal, pg_catalog.btrim(p_private_reason)
  );
  update private.community_feature_flags
  set enabled = p_enabled, updated_by = p_actor_user_id, updated_at = pg_catalog.now()
  where feature_key = p_feature_key;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'community_feature_flags_manage',
    'community_feature_flag_changed', 'community_feature_flag',
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('featureKey', p_feature_key, 'enabled', p_enabled)
  );
  return pg_catalog.jsonb_build_object('featureKey', p_feature_key, 'enabled', p_enabled);
end;
$$;

alter function public.set_community_feature_flag(uuid, text, uuid, text, boolean, text) owner to postgres;
revoke all privileges on function public.set_community_feature_flag(uuid, text, uuid, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_community_feature_flag(uuid, text, uuid, text, boolean, text) to service_role;

create or replace function public.create_guardian_relationship(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_guardian_user_id uuid,
  p_dependent_user_id uuid,
  p_relationship_type text,
  p_provider text,
  p_provider_reference_sha256 text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relationship private.guardian_relationships%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_guardian_manage');
  if p_client_request_id is null
     or p_guardian_user_id = p_dependent_user_id
     or not private.community_account_is_recoverable(p_guardian_user_id)
     or not private.community_account_is_recoverable(p_dependent_user_id)
     or p_relationship_type not in ('parent','legal_guardian','court_authorized_guardian')
     or coalesce(p_provider, '') !~ '^[a-z][a-z0-9_-]{1,80}$'
     or coalesce(p_provider_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_expires_at is null or p_expires_at <= pg_catalog.now()
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_relationship_invalid';
  end if;
  insert into private.guardian_relationships(
    client_request_id, guardian_user_id, dependent_user_id,
    relationship_type, status, verification_provider,
    provider_reference_sha256, verified_at, expires_at
  ) values (
    p_client_request_id, p_guardian_user_id, p_dependent_user_id,
    p_relationship_type, 'active', p_provider,
    p_provider_reference_sha256, pg_catalog.now(), p_expires_at
  ) returning * into v_relationship;
  update private.account_participation
  set assurance_status = 'guardian_verified',
      assurance_method = 'guardian_provider',
      assurance_provider = p_provider,
      assurance_expires_at = p_expires_at,
      updated_at = pg_catalog.now()
  where user_id = p_dependent_user_id
    and age_band = 'under_13';
  perform private.recompute_community_participation(p_dependent_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_guardian_manage',
    'guardian_relationship_created', 'guardian_relationship',
    v_relationship.id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('provider', p_provider, 'relationshipType', p_relationship_type)
  );
  return pg_catalog.jsonb_build_object(
    'relationshipId', v_relationship.id, 'status', v_relationship.status,
    'expiresAt', v_relationship.expires_at
  );
end;
$$;

alter function public.create_guardian_relationship(uuid, text, uuid, uuid, uuid, text, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.create_guardian_relationship(uuid, text, uuid, uuid, uuid, text, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_guardian_relationship(uuid, text, uuid, uuid, uuid, text, text, text, timestamptz, text) to service_role;

create or replace function public.revoke_guardian_relationship(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_relationship_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relationship private.guardian_relationships%rowtype;
  v_consent private.guardian_consents%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_guardian_manage');
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_relationship_revocation_invalid';
  end if;
  select * into strict v_relationship
  from private.guardian_relationships
  where id = p_relationship_id and status = 'active'
  for update;
  update private.guardian_relationships
  set status = 'revoked', revoked_at = pg_catalog.now(),
      revoked_by = p_actor_user_id,
      revocation_reason = pg_catalog.btrim(p_private_reason),
      updated_at = pg_catalog.now()
  where id = p_relationship_id
  returning * into v_relationship;
  for v_consent in
    update private.guardian_consents
    set status = 'revoked', revoked_at = pg_catalog.now(),
        revoked_by = p_actor_user_id,
        revocation_reason = pg_catalog.btrim(p_private_reason)
    where relationship_id = p_relationship_id and status = 'active'
    returning *
  loop
    insert into private.guardian_consent_events(
      client_request_id, consent_id, relationship_id,
      actor_user_id, action, private_reason
    ) values (
      gen_random_uuid(), v_consent.id, p_relationship_id,
      p_actor_user_id, 'revoked', pg_catalog.btrim(p_private_reason)
    );
  end loop;
  update private.account_participation
  set assurance_status = 'verification_expired',
      assurance_expires_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = v_relationship.dependent_user_id
    and assurance_status = 'guardian_verified'
    and not exists (
      select 1 from private.guardian_relationships as other
      where other.dependent_user_id = v_relationship.dependent_user_id
        and other.status = 'active'
        and (other.expires_at is null or other.expires_at > pg_catalog.now())
    );
  perform private.recompute_community_participation(v_relationship.dependent_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason
  ) values (
    p_actor_user_id, 'staff', 'community_guardian_manage',
    'guardian_relationship_revoked', 'guardian_relationship',
    p_relationship_id, p_client_request_id, pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object('relationshipId', p_relationship_id, 'status', 'revoked');
end;
$$;

alter function public.revoke_guardian_relationship(uuid, text, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.revoke_guardian_relationship(uuid, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_guardian_relationship(uuid, text, uuid, uuid, text) to service_role;

create or replace function public.record_guardian_consent(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_relationship_id uuid,
  p_scope text,
  p_document_key text,
  p_document_version text,
  p_content_sha256 text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relationship private.guardian_relationships%rowtype;
  v_consent private.guardian_consents%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_guardian_manage');
  select * into strict v_relationship
  from private.guardian_relationships
  where id = p_relationship_id and status = 'active'
    and (expires_at is null or expires_at > pg_catalog.now())
  for share;
  if p_client_request_id is null
     or p_scope not in ('account','public_profile','artisan_membership','artisan_posting','artisan_commenting','artisan_uploading','artisan_challenges','artisan_notifications','account_export','account_deletion')
     or p_expires_at is null or p_expires_at <= pg_catalog.now()
     or not exists (
       select 1
       from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where document.document_key = p_document_key
         and document.document_version = p_document_version
         and document.content_sha256 = p_content_sha256
     )
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_consent_invalid';
  end if;
  update private.guardian_consents
  set status = 'superseded'
  where dependent_user_id = v_relationship.dependent_user_id
    and consent_scope = p_scope and status = 'active';
  insert into private.guardian_consents(
    client_request_id, relationship_id, dependent_user_id, consent_scope,
    document_key, document_version, content_sha256, expires_at
  ) values (
    p_client_request_id, p_relationship_id, v_relationship.dependent_user_id,
    p_scope, p_document_key, p_document_version, p_content_sha256, p_expires_at
  ) returning * into v_consent;
  insert into private.guardian_consent_events(
    client_request_id, consent_id, relationship_id,
    actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_consent.id, p_relationship_id,
    p_actor_user_id, 'granted', pg_catalog.btrim(p_private_reason)
  );
  perform private.recompute_community_participation(v_relationship.dependent_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_guardian_manage',
    'guardian_consent_recorded', 'guardian_consent', v_consent.id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('scope', p_scope, 'documentVersion', p_document_version)
  );
  return pg_catalog.jsonb_build_object('consentId', v_consent.id, 'scope', p_scope, 'status', 'active', 'expiresAt', p_expires_at);
end;
$$;

alter function public.record_guardian_consent(uuid, text, uuid, uuid, text, text, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.record_guardian_consent(uuid, text, uuid, uuid, text, text, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_guardian_consent(uuid, text, uuid, uuid, text, text, text, text, timestamptz, text) to service_role;

create or replace function public.revoke_guardian_consent(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_consent_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent private.guardian_consents%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_guardian_manage');
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_consent_revocation_invalid';
  end if;
  update private.guardian_consents
  set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
      revocation_reason = pg_catalog.btrim(p_private_reason)
  where id = p_consent_id and status = 'active'
  returning * into v_consent;
  if not found then
    raise exception using errcode = '55000', message = 'guardian_consent_not_active';
  end if;
  insert into private.guardian_consent_events(
    client_request_id, consent_id, relationship_id,
    actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_consent.id, v_consent.relationship_id,
    p_actor_user_id, 'revoked', pg_catalog.btrim(p_private_reason)
  );
  perform private.recompute_community_participation(v_consent.dependent_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason
  ) values (
    p_actor_user_id, 'staff', 'community_guardian_manage',
    'guardian_consent_revoked', 'guardian_consent', p_consent_id,
    p_client_request_id, pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object('consentId', p_consent_id, 'status', 'revoked');
end;
$$;

alter function public.revoke_guardian_consent(uuid, text, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.revoke_guardian_consent(uuid, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_guardian_consent(uuid, text, uuid, uuid, text) to service_role;

create or replace function public.impose_community_restriction(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_target_user_id uuid,
  p_client_request_id uuid,
  p_scope text,
  p_restriction text,
  p_reason_code text,
  p_private_reason text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restriction private.account_restrictions%rowtype;
  v_capability text := case when p_scope like 'artisan_%' then 'artisan_user_restrict' else 'community_restrictions_manage' end;
  v_public_notice text;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_client_request_id is null
     or not private.community_account_is_recoverable(p_target_user_id)
     or p_scope not in ('all_public_communities','commons_profile_publication','commune_posting','commune_commenting','marketplace_publishing','job_posting','artisan_membership','artisan_posting','artisan_commenting','artisan_appreciation','artisan_uploading','artisan_challenges','artisan_notifications')
     or p_restriction not in ('read_only','no_comments','no_uploads','no_challenges','suspended','banned')
     or coalesce(p_reason_code, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 2000
     or (p_expires_at is not null and p_expires_at <= pg_catalog.now()) then
    raise exception using errcode = '22023', message = 'community_restriction_invalid';
  end if;
  v_public_notice := case p_restriction
    when 'read_only' then 'This account is temporarily limited to read-only access.'
    when 'no_comments' then 'Commenting is temporarily unavailable for this account.'
    when 'no_uploads' then 'Media uploads are temporarily unavailable for this account.'
    when 'no_challenges' then 'Challenge participation is temporarily unavailable for this account.'
    when 'suspended' then 'Participation is suspended. Review the account status and appeal options.'
    else 'Participation is blocked. Review the account status and appeal options.'
  end;
  insert into private.account_restrictions(
    target_user_id, scope, restriction_type, reason_code, public_notice,
    private_reason, expires_at, imposed_by,
    appeal_eligible
  ) values (
    p_target_user_id, p_scope, p_restriction, p_reason_code, v_public_notice,
    pg_catalog.btrim(p_private_reason), p_expires_at, p_actor_user_id,
    p_restriction <> 'banned'
  ) returning * into v_restriction;
  insert into private.account_restriction_actions(
    client_request_id, restriction_id, target_user_id,
    actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_restriction.id, p_target_user_id,
    p_actor_user_id, 'imposed', pg_catalog.btrim(p_private_reason)
  );
  if p_restriction in ('suspended','banned') then
    update private.account_participation
    set participation_state = case when p_restriction = 'banned' then 'blocked' else 'suspended' end,
        evaluated_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where user_id = p_target_user_id;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, reason_code, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'community_restriction_imposed',
    'account_restriction', v_restriction.id, p_client_request_id,
    p_reason_code, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('scope', p_scope, 'restriction', p_restriction, 'targetUserId', p_target_user_id)
  );
  return pg_catalog.jsonb_build_object(
    'restrictionId', v_restriction.id, 'scope', p_scope,
    'restriction', p_restriction, 'status', 'active',
    'publicNotice', v_public_notice, 'expiresAt', p_expires_at
  );
end;
$$;

alter function public.impose_community_restriction(uuid, text, uuid, uuid, text, text, text, text, timestamptz) owner to postgres;
revoke all privileges on function public.impose_community_restriction(uuid, text, uuid, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.impose_community_restriction(uuid, text, uuid, uuid, text, text, text, text, timestamptz) to service_role;

create or replace function public.lift_community_restriction(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_restriction_id uuid,
  p_client_request_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restriction private.account_restrictions%rowtype;
  v_capability text;
begin
  select * into strict v_restriction
  from private.account_restrictions
  where id = p_restriction_id and status = 'active'
  for update;
  v_capability := case when v_restriction.scope like 'artisan_%' then 'artisan_user_restrict' else 'community_restrictions_manage' end;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'community_restriction_lift_invalid';
  end if;
  update private.account_restrictions
  set status = 'lifted', lifted_at = pg_catalog.now(), lifted_by = p_actor_user_id,
      updated_at = pg_catalog.now()
  where id = p_restriction_id;
  insert into private.account_restriction_actions(
    client_request_id, restriction_id, target_user_id,
    actor_user_id, action, private_reason
  ) values (
    p_client_request_id, p_restriction_id, v_restriction.target_user_id,
    p_actor_user_id, 'lifted', pg_catalog.btrim(p_private_reason)
  );
  if v_restriction.restriction_type in ('suspended','banned')
     and not private.community_has_active_restriction(v_restriction.target_user_id, 'all_public_communities') then
    perform private.recompute_community_participation(v_restriction.target_user_id);
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason
  ) values (
    p_actor_user_id, 'staff', v_capability, 'community_restriction_lifted',
    'account_restriction', p_restriction_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object('restrictionId', p_restriction_id, 'status', 'lifted');
end;
$$;

alter function public.lift_community_restriction(uuid, text, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.lift_community_restriction(uuid, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.lift_community_restriction(uuid, text, uuid, uuid, text) to service_role;

create or replace function private.community_economic_deletion_readiness(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_obligations jsonb := private.economic_account_closure_obligations(p_user_id);
  v_has_footprint boolean;
  v_closure_completed boolean;
begin
  v_has_footprint := exists (
    select 1 from private.economic_orders where user_id = p_user_id
  ) or exists (
    select 1 from private.economic_subscriptions where user_id = p_user_id
  ) or exists (
    select 1 from private.economic_seller_accounts where user_id = p_user_id
  ) or exists (
    select 1 from private.marketplace_licenses where buyer_user_id = p_user_id
  ) or exists (
    select 1 from private.sandbox_credit_lots where user_id = p_user_id
  ) or exists (
    select 1 from private.job_post_economic_conditions where author_user_id = p_user_id
  ) or exists (
    select 1 from private.economic_organization_memberships where user_id = p_user_id
  );
  v_closure_completed := exists (
    select 1 from private.economic_account_action_requests as request
    where request.user_id = p_user_id
      and request.request_type = 'economic_account_closure'
      and request.status = 'completed'
  );
  return pg_catalog.jsonb_build_object(
    'canComplete', coalesce((v_obligations ->> 'canComplete')::boolean, false)
      and (not v_has_footprint or v_closure_completed),
    'hasEconomicFootprint', v_has_footprint,
    'economicClosureCompleted', v_closure_completed,
    'closureRequired', v_has_footprint and not v_closure_completed,
    'obligations', v_obligations,
    'financialRecordsRetained', true
  );
end;
$$;

alter function private.community_economic_deletion_readiness(uuid) owner to postgres;
revoke all privileges on function private.community_economic_deletion_readiness(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.transition_community_lifecycle_action(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_request_id uuid,
  p_to_status text,
  p_export_artifact_sha256 text,
  p_export_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
  v_export_artifact private.account_export_artifacts%rowtype;
  v_economic_readiness jsonb;
  v_from_status text;
  v_transition_allowed boolean := false;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_client_request_id is null
     or p_to_status not in (
       'identity_verification','cooling_period','operator_review','processing',
       'storage_inventory','storage_cleanup','auth_deletion_ready',
       'auth_deletion_confirmed','blocked_by_legal_hold',
       'completed','rejected','canceled'
     )
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'community_lifecycle_transition_invalid';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id
  for update;
  v_from_status := v_request.status;
  if exists (
    select 1 from private.account_legal_holds as hold
    where hold.user_id = v_request.user_id and hold.lifted_at is null
  ) and p_to_status in (
    'processing','storage_inventory','storage_cleanup','auth_deletion_ready',
    'auth_deletion_confirmed','completed'
  ) and v_request.action in ('account_deletion','account_deactivation') then
    p_to_status := 'blocked_by_legal_hold';
  end if;

  v_transition_allowed := case v_from_status
    when 'submitted' then p_to_status in ('identity_verification','cooling_period','operator_review','rejected','canceled')
    when 'identity_verification' then p_to_status in ('cooling_period','operator_review','rejected','canceled')
    when 'cooling_period' then p_to_status in ('operator_review','blocked_by_legal_hold','canceled')
    when 'operator_review' then p_to_status in ('processing','blocked_by_legal_hold','rejected','canceled')
    when 'processing' then p_to_status in ('storage_inventory','completed','rejected','canceled')
    when 'storage_inventory' then p_to_status in ('storage_cleanup','blocked_by_legal_hold')
    when 'storage_cleanup' then p_to_status in ('auth_deletion_ready','blocked_by_legal_hold')
    when 'auth_deletion_ready' then p_to_status in ('auth_deletion_confirmed','blocked_by_legal_hold')
    when 'auth_deletion_confirmed' then p_to_status = 'completed'
    when 'blocked_by_legal_hold' then p_to_status in ('operator_review','canceled')
    else false
  end;
  if not v_transition_allowed then
    raise exception using errcode = '55000', message = 'community_lifecycle_transition_not_allowed';
  end if;
  if v_from_status = 'blocked_by_legal_hold' and p_to_status = 'operator_review'
     and exists (
       select 1 from private.account_legal_holds as hold
       where hold.user_id = v_request.user_id and hold.lifted_at is null
     ) then
    raise exception using errcode = '55000', message = 'community_lifecycle_legal_hold_active';
  end if;
  if v_request.action in ('account_deletion','account_deactivation')
     and p_to_status = 'processing'
     and (v_request.cooling_period_ends_at is null or v_request.cooling_period_ends_at > pg_catalog.now()) then
    raise exception using errcode = '55000', message = 'community_lifecycle_cooling_period_active';
  end if;
  if v_request.action = 'account_deletion'
     and p_to_status = 'completed'
     and v_from_status <> 'auth_deletion_confirmed' then
    raise exception using errcode = '55000', message = 'community_auth_deletion_confirmation_required';
  end if;
  if v_request.action <> 'account_deletion'
     and p_to_status in ('storage_inventory','storage_cleanup','auth_deletion_ready','auth_deletion_confirmed') then
    raise exception using errcode = '55000', message = 'community_deletion_handoff_not_applicable';
  end if;
  if p_export_artifact_sha256 is not null
     and (v_request.action <> 'data_export' or p_export_artifact_sha256 !~ '^[0-9a-f]{64}$'
       or p_export_expires_at is null or p_export_expires_at <= pg_catalog.now()) then
    raise exception using errcode = '22023', message = 'community_lifecycle_export_invalid';
  end if;
  if v_request.action = 'data_export' and p_to_status = 'completed'
  then
    select * into v_export_artifact
    from private.account_export_artifacts as artifact
    where artifact.lifecycle_request_id = v_request.id
      and artifact.user_id = v_request.user_id
      and artifact.status = 'available'
    for share;
    if v_export_artifact.id is null
       or v_export_artifact.expires_at <= pg_catalog.now()
       or (p_export_artifact_sha256 is not null
         and p_export_artifact_sha256 <> v_export_artifact.artifact_sha256)
       or (p_export_expires_at is not null
         and p_export_expires_at <> v_export_artifact.expires_at) then
      raise exception using errcode = '55000', message = 'community_lifecycle_export_artifact_required';
    end if;
    p_export_artifact_sha256 := v_export_artifact.artifact_sha256;
    p_export_expires_at := v_export_artifact.expires_at;
  end if;
  if v_request.action = 'account_deletion'
     and p_to_status in ('storage_cleanup','auth_deletion_ready','auth_deletion_confirmed','completed') then
    select * into v_handoff
    from private.account_deletion_handoffs
    where lifecycle_request_id = v_request.id;
    if v_handoff.lifecycle_request_id is null
       or (p_to_status = 'storage_cleanup' and (
         v_handoff.storage_inventory_completed_at is null
         or v_handoff.storage_inventory_evidence_sha256 is null))
       or (p_to_status = 'auth_deletion_ready' and (
         v_handoff.storage_cleanup_completed_at is null
         or v_handoff.storage_cleanup_evidence_sha256 is null))
       or (p_to_status in ('auth_deletion_confirmed','completed')
         and (v_handoff.auth_deletion_confirmed_at is null
           or v_handoff.auth_deletion_confirmation_evidence_sha256 is null
           or v_handoff.auth_provider_receipt_sha256 is null)) then
      raise exception using errcode = '55000', message = 'community_deletion_handoff_evidence_required';
    end if;
  end if;
  if v_request.action = 'account_deletion' and p_to_status = 'auth_deletion_ready' then
    if not exists (
      select 1 from artisan.account_cleanup_runs as cleanup
      where cleanup.lifecycle_request_id = v_request.id
        and cleanup.user_id = v_request.user_id
        and cleanup.status = 'completed'
        and cleanup.completed_asset_count = cleanup.expected_asset_count
        and cleanup.completion_evidence_sha256 is not null
    ) then
      raise exception using errcode = '55000', message = 'community_artisan_cleanup_not_ready';
    end if;
    v_economic_readiness := private.community_economic_deletion_readiness(v_request.user_id);
    if not coalesce((v_economic_readiness ->> 'canComplete')::boolean, false) then
      raise exception using errcode = '55000', message = 'community_economic_closure_required';
    end if;
  end if;
  update private.account_lifecycle_requests
  set status = p_to_status,
      export_artifact_sha256 = coalesce(p_export_artifact_sha256, export_artifact_sha256),
      export_expires_at = coalesce(p_export_expires_at, export_expires_at),
      legal_hold_present = p_to_status = 'blocked_by_legal_hold',
      resolved_by = case when p_to_status in ('completed','rejected','canceled') then p_actor_user_id else resolved_by end,
      private_resolution = case when p_to_status in ('completed','rejected','canceled') then pg_catalog.btrim(p_private_reason) else private_resolution end,
      completed_at = case when p_to_status = 'completed' then pg_catalog.now() else null end,
      canceled_at = case when p_to_status = 'canceled' then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_request;
  if v_request.action = 'account_deletion' and p_to_status = 'auth_deletion_ready' then
    -- Database-side anonymization and publication shutdown happen before the
    -- Worker may request Auth soft deletion. Immutable terms, licenses,
    -- moderation, credit, and audit evidence remain; interactive/public state
    -- is disabled immediately. Auth must use soft deletion because retained FK
    -- evidence intentionally continues to reference the non-recoverable row.
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
        revoked_by = coalesce(revoked_by, p_actor_user_id),
        reason = coalesce(reason, 'account_deletion')
    where user_id = v_request.user_id and revoked_at is null;
    update artisan.memberships
    set status = 'closed', closed_at = pg_catalog.now(), updated_at = pg_catalog.now()
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
      set status = 'deleted_by_user', body = '[withdrawn]', deleted_at = pg_catalog.now()
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
  end if;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason,
    metadata
  ) values (
    p_client_request_id, p_request_id, p_actor_user_id,
    'request_transitioned', v_from_status, p_to_status,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('exportArtifactAttached', p_export_artifact_sha256 is not null)
  );
  if v_request.action in ('account_deletion','account_deactivation') and p_to_status in (
    'cooling_period','processing','storage_inventory','storage_cleanup','auth_deletion_ready','auth_deletion_confirmed'
  ) then
    update private.account_participation
    set participation_state = 'deletion_pending', evaluated_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where user_id = v_request.user_id;
  elsif v_request.action in ('account_deletion','account_deactivation') and p_to_status = 'completed' then
    update private.account_participation
    set participation_state = 'deactivated', evaluated_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where user_id = v_request.user_id;
    update public.profile_public_cards
    set public_profile_enabled = false, short_public_bio = null, updated_at = pg_catalog.now()
    where user_id = v_request.user_id;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'community_lifecycle_manage',
    'community_lifecycle_request_transitioned', 'account_lifecycle_request',
    p_request_id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('fromStatus', v_from_status, 'toStatus', p_to_status)
  );
  return pg_catalog.jsonb_build_object('requestId', p_request_id, 'action', v_request.action, 'status', p_to_status);
end;
$$;

alter function public.transition_community_lifecycle_action(uuid, text, uuid, uuid, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.transition_community_lifecycle_action(uuid, text, uuid, uuid, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.transition_community_lifecycle_action(uuid, text, uuid, uuid, text, text, timestamptz, text) to service_role;

create or replace function public.current_user_guardian_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else
    pg_catalog.jsonb_build_object(
      'relationships', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'relationshipId', relationship.id,
            'callerRole', case when relationship.guardian_user_id = auth.uid() then 'guardian' else 'dependent' end,
            'relationshipType', relationship.relationship_type,
            'status', relationship.status,
            'expiresAt', relationship.expires_at,
            'consents', coalesce((
              select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'consentId', consent.id,
                  'scope', consent.consent_scope,
                  'documentKey', consent.document_key,
                  'documentVersion', consent.document_version,
                  'status', consent.status,
                  'expiresAt', consent.expires_at
                ) order by consent.consent_scope
              )
              from private.guardian_consents as consent
              where consent.relationship_id = relationship.id
                and consent.status = 'active'
                and consent.expires_at > pg_catalog.now()
            ), '[]'::jsonb)
          ) order by relationship.created_at, relationship.id
        )
        from private.guardian_relationships as relationship
        where relationship.guardian_user_id = auth.uid()
           or relationship.dependent_user_id = auth.uid()
      ), '[]'::jsonb)
    )
  end;
$$;

alter function public.current_user_guardian_summary() owner to postgres;
revoke all privileges on function public.current_user_guardian_summary()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_guardian_summary() to authenticated;

create or replace function public.revoke_current_user_guardian_relationship(
  p_client_request_id uuid,
  p_relationship_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_relationship private.guardian_relationships%rowtype;
  v_consent private.guardian_consents%rowtype;
begin
  if v_user_id is null or p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_self_revocation_invalid';
  end if;
  select * into strict v_relationship
  from private.guardian_relationships
  where id = p_relationship_id and status = 'active'
    and (guardian_user_id = v_user_id or dependent_user_id = v_user_id)
  for update;
  update private.guardian_relationships
  set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = v_user_id,
      revocation_reason = pg_catalog.btrim(p_reason), updated_at = pg_catalog.now()
  where id = p_relationship_id;
  for v_consent in
    update private.guardian_consents
    set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = v_user_id,
        revocation_reason = pg_catalog.btrim(p_reason)
    where relationship_id = p_relationship_id and status = 'active'
    returning *
  loop
    insert into private.guardian_consent_events(
      client_request_id, consent_id, relationship_id, actor_user_id,
      action, private_reason
    ) values (
      gen_random_uuid(), v_consent.id, p_relationship_id, v_user_id,
      'revoked', pg_catalog.btrim(p_reason)
    );
  end loop;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason,
    metadata
  ) values (
    v_user_id,
    case when v_relationship.guardian_user_id = v_user_id then 'guardian' else 'user' end,
    'guardian_relationship_self_revoked', 'guardian_relationship',
    p_relationship_id, p_client_request_id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('callerRole', case when v_relationship.guardian_user_id = v_user_id then 'guardian' else 'dependent' end)
  );
  return pg_catalog.jsonb_build_object('relationshipId', p_relationship_id, 'status', 'revoked');
end;
$$;

alter function public.revoke_current_user_guardian_relationship(uuid, uuid, text) owner to postgres;
revoke all privileges on function public.revoke_current_user_guardian_relationship(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_current_user_guardian_relationship(uuid, uuid, text) to authenticated;

create or replace function public.revoke_current_user_guardian_consent(
  p_client_request_id uuid,
  p_consent_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_consent private.guardian_consents%rowtype;
  v_relationship private.guardian_relationships%rowtype;
begin
  if v_user_id is null or p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_consent_self_revocation_invalid';
  end if;
  select consent.* into v_consent
  from private.guardian_consents as consent
  where consent.id = p_consent_id and consent.status = 'active'
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'guardian_consent_not_revocable';
  end if;
  select relationship.* into strict v_relationship
  from private.guardian_relationships as relationship
  where relationship.id = v_consent.relationship_id
    and (relationship.guardian_user_id = v_user_id or relationship.dependent_user_id = v_user_id);
  update private.guardian_consents
  set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = v_user_id,
      revocation_reason = pg_catalog.btrim(p_reason)
  where id = p_consent_id;
  insert into private.guardian_consent_events(
    client_request_id, consent_id, relationship_id, actor_user_id,
    action, private_reason
  ) values (
    p_client_request_id, p_consent_id, v_consent.relationship_id, v_user_id,
    'revoked', pg_catalog.btrim(p_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason,
    metadata
  ) values (
    v_user_id,
    case when v_relationship.guardian_user_id = v_user_id then 'guardian' else 'user' end,
    'guardian_consent_self_revoked', 'guardian_consent', p_consent_id,
    p_client_request_id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('scope', v_consent.consent_scope)
  );
  return pg_catalog.jsonb_build_object('consentId', p_consent_id, 'status', 'revoked');
end;
$$;

alter function public.revoke_current_user_guardian_consent(uuid, uuid, text) owner to postgres;
revoke all privileges on function public.revoke_current_user_guardian_consent(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_current_user_guardian_consent(uuid, uuid, text) to authenticated;

create or replace function private.guardian_revocation_downgrades_under13()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_dependent_user_id uuid;
begin
  if old.status = 'active' and new.status <> 'active' then
    v_dependent_user_id := case
      when tg_table_name = 'guardian_relationships' then new.dependent_user_id
      else new.dependent_user_id
    end;
    if tg_table_name = 'guardian_relationships' and not exists (
      select 1 from private.guardian_relationships as relationship
      where relationship.dependent_user_id = v_dependent_user_id
        and relationship.status = 'active'
        and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
    ) then
      update private.account_participation
      set assurance_status = case when assurance_status = 'guardian_verified'
            then 'verification_expired' else assurance_status end,
          assurance_expires_at = case when assurance_status = 'guardian_verified'
            then pg_catalog.now() else assurance_expires_at end,
          updated_at = pg_catalog.now()
      where user_id = v_dependent_user_id;
    end if;
    perform private.recompute_community_participation(v_dependent_user_id);
  end if;
  return new;
end;
$$;

alter function private.guardian_revocation_downgrades_under13() owner to postgres;
revoke all privileges on function private.guardian_revocation_downgrades_under13()
  from public, anon, authenticated, service_role;
create trigger guardian_relationship_revocation_downgrades_under13
after update of status on private.guardian_relationships
for each row execute function private.guardian_revocation_downgrades_under13();
create trigger guardian_consent_revocation_downgrades_under13
after update of status on private.guardian_consents
for each row execute function private.guardian_revocation_downgrades_under13();

create or replace function public.current_community_legal_manifest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with required_documents(document_key) as (
    values
      ('community_terms'::text),
      ('privacy_notice'),
      ('community_guidelines'),
      ('moderation_policy'),
      ('artist_platform_license'),
      ('ai_authorship_policy')
  ), allowed_documents(document_key, scope, title) as (
    values
      ('community_terms'::text, 'shared_participation'::text, 'Community Terms'::text),
      ('privacy_notice', 'shared_participation', 'Privacy Notice'),
      ('community_guidelines', 'shared_participation', 'Community Guidelines'),
      ('moderation_policy', 'shared_participation', 'Moderation and Appeals Policy'),
      ('artist_platform_license', 'artisan_participation', 'Artist Rights and Platform License'),
      ('ai_authorship_policy', 'artisan_participation', 'AI and Authorship Disclosure Policy'),
      ('challenge_rules_template', 'challenge_submission', 'Challenge Rules'),
      ('winner_usage_agreement_template', 'winner_confirmation', 'Winner Usage Agreement'),
      ('guardian_consent_notice', 'guardian_consent', 'Guardian Consent Notice'),
      ('under13_privacy_notice', 'under13_privacy', 'Children’s Privacy Notice'),
      ('account_lifecycle_notice', 'account_lifecycle', 'Account Export and Deletion Notice')
  ), active_manifest as (
    select
      document.document_key,
      document.document_version,
      document.content_sha256,
      allowed.scope,
      allowed.title,
      document.public_path,
      document.effective_at
    from allowed_documents as allowed
    join private.community_active_legal_documents as active_document
      on active_document.document_key = allowed.document_key
    join private.community_legal_document_versions as document
      on document.document_key = active_document.document_key
     and document.document_version = active_document.document_version
     and document.status = 'approved'
  ), required_state as (
    select
      required.document_key,
      manifest.document_key is not null as active_and_approved,
      auth.uid() is not null
        and manifest.document_key is not null
        and private.community_has_current_document(auth.uid(), required.document_key) as accepted
    from required_documents as required
    left join active_manifest as manifest on manifest.document_key = required.document_key
  ), missing as (
    select state.document_key
    from required_state as state
    where not state.active_and_approved or not state.accepted
  )
  select pg_catalog.jsonb_build_object(
    'documents', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'documentKey', manifest.document_key,
          'version', manifest.document_version,
          'contentSha256', manifest.content_sha256,
          'scope', manifest.scope,
          'title', manifest.title,
          'publicPath', manifest.public_path,
          'effectiveAt', manifest.effective_at
        ) order by manifest.scope, manifest.document_key
      ) from active_manifest as manifest
    ), '[]'::jsonb),
    'missingAcceptances', coalesce((
      select pg_catalog.jsonb_agg(missing.document_key order by missing.document_key)
      from missing
    ), '[]'::jsonb),
    'requiredDocumentsReady', (
      select pg_catalog.count(*) = 6 and pg_catalog.bool_and(state.active_and_approved)
      from required_state as state
    ),
    'complete', auth.uid() is not null
      and (select pg_catalog.count(*) = 6 and pg_catalog.bool_and(state.active_and_approved and state.accepted)
           from required_state as state)
  );
$$;

alter function public.current_community_legal_manifest() owner to postgres;
revoke all privileges on function public.current_community_legal_manifest()
  from public, anon, authenticated, service_role;
grant execute on function public.current_community_legal_manifest() to anon, authenticated, service_role;

create or replace function public.current_user_artisan_bootstrap()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else
    pg_catalog.jsonb_build_object(
      'communityAccess', coalesce(public.current_user_community_access(), '{}'::jsonb),
      'membership', (
        select pg_catalog.jsonb_build_object(
          'status', membership.status,
          'joinedAt', membership.joined_at,
          'defaultCreditLine', membership.default_credit_line,
          'defaultCreationMethod', membership.default_creation_method,
          'defaultLicenseCode', membership.default_license_code
        )
        from artisan.memberships as membership
        where membership.user_id = auth.uid()
      ),
      'profileCard', (
        select pg_catalog.jsonb_build_object(
          'handle', card.handle,
          'displayName', card.display_name,
          'avatarUrl', card.avatar_url,
          'shortPublicBio', card.short_public_bio,
          'canonicalProfileUrl', card.canonical_profile_url,
          'publicProfileEnabled', card.public_profile_enabled,
          'updatedAt', card.updated_at
        )
        from public.profile_public_cards as card
        where card.user_id = auth.uid()
      ),
      'guardianSummary', public.current_user_guardian_summary(),
      'guardianControls', pg_catalog.jsonb_build_object(
        'under13ParticipationEnabled',
          private.community_feature_enabled('artisan_under13_participation'),
        'contentApprovalEnabled',
          private.community_feature_enabled('artisan_under13_content_approval'),
        'profileEnableEnabled',
          private.community_feature_enabled('artisan_guardian_dependent_profile_controls'),
        'profileDisableAvailable', true,
        'lifecycleRequestAvailable',
          private.community_feature_enabled('artisan_guardian_dependent_lifecycle'),
        'lifecycleHistoryAvailable', true
      ),
      'legalManifest', public.current_community_legal_manifest(),
      'notificationPreferences', (
        select pg_catalog.jsonb_build_object(
          'inAppEnabled', preference.in_app_enabled,
          'emailEnabled', preference.email_enabled,
          'mentionsEnabled', preference.mentions_enabled,
          'commentsEnabled', preference.comments_enabled,
          'challengeUpdatesEnabled', preference.challenge_updates_enabled,
          'moderationUpdatesEnabled', preference.moderation_updates_enabled,
          'guardianUpdatesEnabled', preference.guardian_updates_enabled,
          'quietHoursStart', preference.quiet_hours_start,
          'quietHoursEnd', preference.quiet_hours_end,
          'updatedAt', preference.updated_at
        )
        from private.community_notification_preferences as preference
        where preference.user_id = auth.uid()
      ),
      'featureFlags', public.current_artisan_feature_manifest()
    )
  end;
$$;

alter function public.current_user_artisan_bootstrap() owner to postgres;
revoke all privileges on function public.current_user_artisan_bootstrap()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_artisan_bootstrap() to authenticated;

create or replace function public.issue_artisan_invitation(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_invitation_code_sha256 text,
  p_invited_user_id uuid,
  p_invited_email_sha256 text,
  p_maximum_uses integer,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation artisan.invitations%rowtype;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_memberships_manage');
  if p_client_request_id is null
     or coalesce(p_invitation_code_sha256, '') !~ '^[0-9a-f]{64}$'
     or (p_invited_email_sha256 is not null and p_invited_email_sha256 !~ '^[0-9a-f]{64}$')
     or p_maximum_uses not between 1 and 100
     or p_expires_at is null or p_expires_at <= pg_catalog.now()
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_invitation_invalid';
  end if;
  if p_invited_user_id is not null and not private.community_account_is_recoverable(p_invited_user_id) then
    raise exception using errcode = '22023', message = 'artisan_invitation_account_invalid';
  end if;
  insert into artisan.invitations(
    invitation_code_sha256, invited_user_id, invited_email_sha256,
    maximum_uses, issued_by, expires_at, private_reason
  ) values (
    p_invitation_code_sha256, p_invited_user_id, p_invited_email_sha256,
    p_maximum_uses, p_actor_user_id, p_expires_at,
    pg_catalog.btrim(p_private_reason)
  ) returning * into v_invitation;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_memberships_manage',
    'artisan_invitation_issued', 'artisan_invitation', v_invitation.id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('maximumUses', p_maximum_uses, 'expiresAt', p_expires_at)
  );
  return pg_catalog.jsonb_build_object('invitationId', v_invitation.id, 'status', v_invitation.status, 'expiresAt', v_invitation.expires_at);
end;
$$;

alter function public.issue_artisan_invitation(uuid, text, uuid, text, uuid, text, integer, timestamptz, text) owner to postgres;
revoke all privileges on function public.issue_artisan_invitation(uuid, text, uuid, text, uuid, text, integer, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_artisan_invitation(uuid, text, uuid, text, uuid, text, integer, timestamptz, text) to service_role;

create or replace function public.create_current_user_artisan_membership(
  p_client_request_id uuid,
  p_invitation_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code_sha256 text;
  v_invitation artisan.invitations%rowtype;
  v_membership artisan.memberships%rowtype;
begin
  if v_user_id is null or not private.community_can_participate(v_user_id, 'artisan_membership') then
    raise exception using errcode = '42501', message = 'artisan_membership_not_permitted';
  end if;
  if p_client_request_id is null or pg_catalog.char_length(coalesce(p_invitation_code, '')) not between 16 and 200 then
    raise exception using errcode = '22023', message = 'artisan_invitation_code_invalid';
  end if;
  if not exists (
    select 1 from public.profile_public_cards as card
    where card.user_id = v_user_id and card.public_profile_enabled
      and private.community_profile_is_public(card.user_id)
  ) then
    raise exception using errcode = '55000', message = 'artisan_public_profile_required';
  end if;
  v_code_sha256 := pg_catalog.encode(extensions.digest(p_invitation_code, 'sha256'), 'hex');
  select * into strict v_invitation
  from artisan.invitations
  where invitation_code_sha256 = v_code_sha256
    and status = 'issued'
    and expires_at > pg_catalog.now()
    and use_count < maximum_uses
    and (invited_user_id is null or invited_user_id = v_user_id)
  for update;
  insert into artisan.memberships(user_id, invitation_id)
  values (v_user_id, v_invitation.id)
  on conflict (user_id) do update
  set status = case when artisan.memberships.status = 'closed' then artisan.memberships.status else 'active' end,
      updated_at = pg_catalog.now()
  returning * into v_membership;
  update artisan.invitations
  set use_count = use_count + 1,
      status = case when use_count + 1 >= maximum_uses then 'consumed' else status end
  where id = v_invitation.id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    v_user_id, 'user', 'artisan_membership_created', 'artisan_membership',
    v_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('invitationId', v_invitation.id)
  );
  return pg_catalog.jsonb_build_object('status', v_membership.status, 'joinedAt', v_membership.joined_at);
end;
$$;

alter function public.create_current_user_artisan_membership(uuid, text) owner to postgres;
revoke all privileges on function public.create_current_user_artisan_membership(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_current_user_artisan_membership(uuid, text) to authenticated;

create or replace function public.update_current_user_artisan_notification_preferences(
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_mentions_enabled boolean,
  p_comments_enabled boolean,
  p_challenge_updates_enabled boolean,
  p_moderation_updates_enabled boolean,
  p_guardian_updates_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id) then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  if (p_quiet_hours_start is null) <> (p_quiet_hours_end is null) then
    raise exception using errcode = '22023', message = 'notification_quiet_hours_invalid';
  end if;
  update private.community_notification_preferences
  set in_app_enabled = p_in_app_enabled,
      email_enabled = p_email_enabled,
      mentions_enabled = p_mentions_enabled,
      comments_enabled = p_comments_enabled,
      challenge_updates_enabled = p_challenge_updates_enabled,
      moderation_updates_enabled = p_moderation_updates_enabled,
      guardian_updates_enabled = p_guardian_updates_enabled,
      quiet_hours_start = p_quiet_hours_start,
      quiet_hours_end = p_quiet_hours_end,
      updated_at = pg_catalog.now()
  where user_id = v_user_id;
  return public.current_user_artisan_bootstrap() -> 'notificationPreferences';
end;
$$;

alter function public.update_current_user_artisan_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time) owner to postgres;
revoke all privileges on function public.update_current_user_artisan_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time)
  from public, anon, authenticated, service_role;
grant execute on function public.update_current_user_artisan_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time) to authenticated;

create or replace function public.create_current_user_artwork(
  p_client_request_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_artist_statement text,
  p_creation_method text,
  p_human_contribution_note text,
  p_credit_line text,
  p_credited_name text,
  p_license_code text,
  p_download_allowed boolean,
  p_alt_text text,
  p_content_warnings text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_artwork artisan.artworks%rowtype;
  v_license_document private.community_legal_document_versions%rowtype;
  v_license_id uuid;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_post') then
    raise exception using errcode = '42501', message = 'artisan_artwork_create_not_permitted';
  end if;
  insert into artisan.artworks(
    client_request_id, owner_user_id, slug, title, description,
    artist_statement, creation_method, human_contribution_note,
    credit_line, credited_name_or_pseudonym, preferred_profile_url,
    license_code, download_allowed, alt_text, content_warnings
  )
  select
    p_client_request_id, v_user_id, pg_catalog.lower(p_slug),
    pg_catalog.btrim(p_title), nullif(pg_catalog.btrim(p_description), ''),
    nullif(pg_catalog.btrim(p_artist_statement), ''), p_creation_method,
    nullif(pg_catalog.btrim(p_human_contribution_note), ''),
    pg_catalog.btrim(p_credit_line), nullif(pg_catalog.btrim(p_credited_name), ''),
    card.canonical_profile_url, p_license_code, p_download_allowed,
    pg_catalog.btrim(p_alt_text), coalesce(p_content_warnings, '{}'::text[])
  from public.profile_public_cards as card
  where card.user_id = v_user_id and card.public_profile_enabled
    and private.community_profile_is_public(card.user_id)
  returning * into v_artwork;
  if not found then
    raise exception using errcode = '55000', message = 'artisan_public_profile_required';
  end if;
  select document.* into strict v_license_document
  from private.community_active_legal_documents as active_document
  join private.community_legal_document_versions as document
    on document.document_key = active_document.document_key
   and document.document_version = active_document.document_version
  where active_document.document_key = 'artist_platform_license'
    and document.status = 'approved'
    and exists (
      select 1 from private.community_terms_acceptances as acceptance
      where acceptance.user_id = v_user_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
        and acceptance.content_sha256 = document.content_sha256
    );
  insert into artisan.artwork_licenses(
    artwork_id, license_code, document_key, document_version,
    content_sha256, scope, accepted_by
  ) values (
    v_artwork.id, v_artwork.license_code, v_license_document.document_key,
    v_license_document.document_version, v_license_document.content_sha256,
    'artisan_display', v_user_id
  ) returning id into v_license_id;
  insert into artisan.artwork_credits(
    artwork_id, credited_user_id, credited_name, profile_url, role
  ) values (
    v_artwork.id, v_user_id,
    coalesce(v_artwork.credited_name_or_pseudonym, v_artwork.credit_line),
    v_artwork.preferred_profile_url, 'artist'
  );
  insert into artisan.artwork_provenance_events(
    client_request_id, artwork_id, actor_user_id, event_type,
    metadata
  ) values (
    p_client_request_id, v_artwork.id, v_user_id, 'created',
    pg_catalog.jsonb_build_object(
      'creationMethod', v_artwork.creation_method,
      'licenseCode', v_artwork.license_code,
      'licenseId', v_license_id,
      'licenseDocumentKey', v_license_document.document_key,
      'licenseDocumentVersion', v_license_document.document_version,
      'licenseContentSha256', v_license_document.content_sha256
    )
  );
  return pg_catalog.jsonb_build_object('artworkId', v_artwork.id, 'slug', v_artwork.slug, 'status', v_artwork.status);
end;
$$;

alter function public.create_current_user_artwork(uuid, text, text, text, text, text, text, text, text, text, boolean, text, text[]) owner to postgres;
revoke all privileges on function public.create_current_user_artwork(uuid, text, text, text, text, text, text, text, text, text, boolean, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_current_user_artwork(uuid, text, text, text, text, text, text, text, text, text, boolean, text, text[]) to authenticated;

create or replace function public.update_current_user_artwork_draft(
  p_artwork_id uuid,
  p_client_request_id uuid,
  p_title text,
  p_description text,
  p_artist_statement text,
  p_creation_method text,
  p_human_contribution_note text,
  p_credit_line text,
  p_credited_name text,
  p_license_code text,
  p_download_allowed boolean,
  p_alt_text text,
  p_content_warnings text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_artwork artisan.artworks%rowtype;
  v_previous_artwork artisan.artworks%rowtype;
  v_license_document private.community_legal_document_versions%rowtype;
  v_license_id uuid;
begin
  if v_user_id is null or not private.community_can_participate(v_user_id, 'artisan_post') then
    raise exception using errcode = '42501', message = 'artisan_artwork_update_not_permitted';
  end if;
  select * into strict v_previous_artwork
  from artisan.artworks
  where id = p_artwork_id and owner_user_id = v_user_id
    and status in ('draft','changes_requested','approved','published')
  for update;
  -- A material revision is never edited in place while it is public. Forum
  -- rooms that embed the work return to draft atomically. Challenge and gallery
  -- records are intentionally immutable references and require the existing
  -- correction/withdrawal workflow instead of silently changing an entry.
  if v_previous_artwork.status in ('approved','published') then
    if exists (
      select 1 from artisan.challenge_submissions as submission
      where submission.artwork_id = p_artwork_id
        and submission.status not in ('draft','changes_requested','ineligible','withdrawn')
    ) or exists (
      select 1 from artisan.gallery_entries as gallery
      where gallery.artwork_id = p_artwork_id and gallery.status = 'published'
    ) then
      raise exception using errcode = '55000',
        message = 'artisan_artwork_revision_requires_correction_workflow';
    end if;
    update artisan.forum_posts as post
    set status = 'draft', moderation_status = 'unreviewed',
        submitted_at = null, published_at = null, updated_at = pg_catalog.now()
    where post.id in (
      select link.post_id from artisan.post_artworks as link
      where link.artwork_id = p_artwork_id
    ) and post.status in ('approved','published');
  end if;
  update artisan.artworks
  set title = pg_catalog.btrim(p_title),
      description = nullif(pg_catalog.btrim(p_description), ''),
      artist_statement = nullif(pg_catalog.btrim(p_artist_statement), ''),
      creation_method = p_creation_method,
      human_contribution_note = nullif(pg_catalog.btrim(p_human_contribution_note), ''),
      credit_line = pg_catalog.btrim(p_credit_line),
      credited_name_or_pseudonym = nullif(pg_catalog.btrim(p_credited_name), ''),
      license_code = p_license_code,
      download_allowed = p_download_allowed,
      alt_text = pg_catalog.btrim(p_alt_text),
      content_warnings = coalesce(p_content_warnings, '{}'::text[]),
      status = 'draft', moderation_status = 'unreviewed',
      submitted_at = null, published_at = null,
      updated_at = pg_catalog.now()
  where id = p_artwork_id and owner_user_id = v_user_id
    and status in ('draft','changes_requested','approved','published')
  returning * into v_artwork;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_artwork_not_editable';
  end if;
  if v_previous_artwork.license_code <> v_artwork.license_code then
    select document.* into strict v_license_document
    from private.community_active_legal_documents as active_document
    join private.community_legal_document_versions as document
      on document.document_key = active_document.document_key
     and document.document_version = active_document.document_version
    where active_document.document_key = 'artist_platform_license'
      and document.status = 'approved'
      and exists (
        select 1 from private.community_terms_acceptances as acceptance
        where acceptance.user_id = v_user_id
          and acceptance.document_key = document.document_key
          and acceptance.document_version = document.document_version
          and acceptance.content_sha256 = document.content_sha256
      );
    update artisan.artwork_licenses
    set terminated_at = pg_catalog.now(),
        termination_reason = 'Artist selected a replacement display license.'
    where artwork_id = p_artwork_id and scope = 'artisan_display' and terminated_at is null;
    insert into artisan.artwork_licenses(
      artwork_id, license_code, document_key, document_version,
      content_sha256, scope, accepted_by
    ) values (
      p_artwork_id, v_artwork.license_code, v_license_document.document_key,
      v_license_document.document_version, v_license_document.content_sha256,
      'artisan_display', v_user_id
    ) returning id into v_license_id;
  end if;
  insert into artisan.artwork_provenance_events(
    client_request_id, artwork_id, actor_user_id, event_type,
    metadata
  ) values (
    p_client_request_id, p_artwork_id, v_user_id,
    case when v_previous_artwork.license_code <> v_artwork.license_code
      then 'license_changed' else 'creation_method_changed' end,
    pg_catalog.jsonb_build_object(
      'previousCreationMethod', v_previous_artwork.creation_method,
      'creationMethod', p_creation_method,
      'previousLicenseCode', v_previous_artwork.license_code,
      'licenseCode', p_license_code,
      'licenseId', v_license_id,
      'licenseDocumentVersion', v_license_document.document_version,
      'licenseContentSha256', v_license_document.content_sha256
    )
  );
  update artisan.artwork_credits
  set credited_name = coalesce(v_artwork.credited_name_or_pseudonym, v_artwork.credit_line),
      profile_url = v_artwork.preferred_profile_url
  where artwork_id = p_artwork_id and credited_user_id = v_user_id and role = 'artist';
  return pg_catalog.jsonb_build_object(
    'artworkId', v_artwork.id, 'status', v_artwork.status,
    'requiresReview', true, 'updatedAt', v_artwork.updated_at
  );
end;
$$;

alter function public.update_current_user_artwork_draft(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[]) owner to postgres;
revoke all privileges on function public.update_current_user_artwork_draft(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.update_current_user_artwork_draft(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[]) to authenticated;

create or replace function public.create_current_user_artisan_post(
  p_client_request_id uuid,
  p_slug text,
  p_title text,
  p_artist_statement text,
  p_theme jsonb,
  p_comments_enabled boolean,
  p_appreciations_enabled boolean,
  p_slow_mode_seconds integer,
  p_artwork_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_post artisan.forum_posts%rowtype;
  v_requested_count integer;
  v_owned_count integer;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_post') then
    raise exception using errcode = '42501', message = 'artisan_post_create_not_permitted';
  end if;
  if not private.artisan_theme_is_safe(p_theme)
     or p_slow_mode_seconds not between 0 and 86400
     or coalesce(pg_catalog.cardinality(p_artwork_ids), 0) not between 1 and 12 then
    raise exception using errcode = '22023', message = 'artisan_post_payload_invalid';
  end if;
  select pg_catalog.count(distinct id) into v_requested_count
  from pg_catalog.unnest(p_artwork_ids) as id;
  select pg_catalog.count(*) into v_owned_count
  from artisan.artworks
  where id = any(p_artwork_ids) and owner_user_id = v_user_id
    and status in ('draft','changes_requested','approved','published');
  if v_requested_count <> v_owned_count then
    raise exception using errcode = '42501', message = 'artisan_post_artwork_ownership_required';
  end if;
  insert into artisan.forum_posts(
    client_request_id, owner_user_id, slug, title, artist_statement,
    theme, comments_enabled, appreciations_enabled, slow_mode_seconds
  ) values (
    p_client_request_id, v_user_id, pg_catalog.lower(p_slug), pg_catalog.btrim(p_title),
    nullif(pg_catalog.btrim(p_artist_statement), ''), p_theme,
    p_comments_enabled, p_appreciations_enabled, p_slow_mode_seconds
  ) returning * into v_post;
  insert into artisan.post_artworks(post_id, artwork_id, display_order)
  select v_post.id, artwork_id, ordinality - 1
  from pg_catalog.unnest(p_artwork_ids) with ordinality as selected(artwork_id, ordinality)
  on conflict (post_id, artwork_id) do nothing;
  return pg_catalog.jsonb_build_object('postId', v_post.id, 'slug', v_post.slug, 'status', v_post.status);
end;
$$;

alter function public.create_current_user_artisan_post(uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[]) owner to postgres;
revoke all privileges on function public.create_current_user_artisan_post(uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_current_user_artisan_post(uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[]) to authenticated;

create or replace function public.submit_current_user_artisan_post(
  p_post_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_post artisan.forum_posts%rowtype;
begin
  if v_user_id is null or not private.community_can_participate(v_user_id, 'artisan_post') then
    raise exception using errcode = '42501', message = 'artisan_post_submit_not_permitted';
  end if;
  select * into strict v_post
  from artisan.forum_posts
  where id = p_post_id and owner_user_id = v_user_id
    and status in ('draft','changes_requested')
  for update;
  if not exists (select 1 from artisan.post_artworks where post_id = p_post_id)
     or exists (
       select 1
       from artisan.post_artworks as link
       where link.post_id = p_post_id
         and not exists (
           select 1 from artisan.media_assets as media
           where media.artwork_id = link.artwork_id
             and media.processing_status in ('approved','published')
             and media.moderation_status = 'approved'
             and media.metadata_stripped
         )
     ) then
    raise exception using errcode = '55000', message = 'artisan_post_approved_media_required';
  end if;
  update artisan.forum_posts
  set status = 'pending_review', moderation_status = 'pending',
      submitted_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_post_id
  returning * into v_post;
  update artisan.artworks
  set status = 'pending_review', moderation_status = 'pending',
      submitted_at = coalesce(submitted_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where id in (select artwork_id from artisan.post_artworks where post_id = p_post_id)
    and owner_user_id = v_user_id and status in ('draft','changes_requested','approved');
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    v_user_id, 'user', 'artisan_post_submitted', 'artisan_forum_post', p_post_id, p_client_request_id
  );
  return pg_catalog.jsonb_build_object('postId', p_post_id, 'status', v_post.status, 'moderationStatus', v_post.moderation_status);
end;
$$;

alter function public.submit_current_user_artisan_post(uuid, uuid) owner to postgres;
revoke all privileges on function public.submit_current_user_artisan_post(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_current_user_artisan_post(uuid, uuid) to authenticated;

create or replace function public.create_current_user_artisan_comment(
  p_client_request_id uuid,
  p_post_id uuid,
  p_parent_comment_id uuid,
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_post artisan.forum_posts%rowtype;
  v_parent artisan.comments%rowtype;
  v_depth smallint := 0;
  v_comment artisan.comments%rowtype;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_comment') then
    raise exception using errcode = '42501', message = 'artisan_comment_not_permitted';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'artisan_comment_body_invalid';
  end if;
  if not private.artisan_mentions_are_valid(v_user_id, p_mentioned_user_ids) then
    raise exception using errcode = '22023', message = 'artisan_comment_mentions_invalid';
  end if;
  select * into strict v_post
  from artisan.forum_posts
  where id = p_post_id and status = 'published'
    and moderation_status = 'approved' and comments_enabled
  for share;
  if exists (
    select 1 from artisan.user_blocks
    where (blocker_user_id = v_user_id and blocked_user_id = v_post.owner_user_id)
       or (blocker_user_id = v_post.owner_user_id and blocked_user_id = v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'artisan_comment_blocked';
  end if;
  if p_parent_comment_id is not null then
    select * into strict v_parent
    from artisan.comments
    where id = p_parent_comment_id and post_id = p_post_id
      and status in ('published','edited') and moderation_status = 'approved';
    v_depth := v_parent.depth + 1;
    if v_depth > 4 then
      raise exception using errcode = '22023', message = 'artisan_comment_depth_exceeded';
    end if;
  end if;
  if v_post.slow_mode_seconds > 0 and exists (
    select 1 from artisan.comments
    where post_id = p_post_id and user_id = v_user_id
      and created_at > pg_catalog.now() - pg_catalog.make_interval(secs => v_post.slow_mode_seconds)
  ) then
    raise exception using errcode = '55000', message = 'artisan_comment_slow_mode';
  end if;
  insert into artisan.comments(
    client_request_id, post_id, user_id, parent_comment_id, depth, body
  ) values (
    p_client_request_id, p_post_id, v_user_id, p_parent_comment_id,
    v_depth, pg_catalog.btrim(p_body)
  ) returning * into v_comment;
  insert into artisan.comment_mentions(comment_id, mentioned_user_id)
  select v_comment.id, mentioned_user_id
  from pg_catalog.unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as mentioned_user_id;
  return pg_catalog.jsonb_build_object('commentId', v_comment.id, 'status', v_comment.status, 'depth', v_comment.depth);
end;
$$;

alter function public.create_current_user_artisan_comment(uuid, uuid, uuid, text, uuid[]) owner to postgres;
revoke all privileges on function public.create_current_user_artisan_comment(uuid, uuid, uuid, text, uuid[])
  from public, anon, authenticated, service_role;
-- UUID mention mutation is an internal implementation detail; the public site
-- uses the service-only handle wrapper below.

create or replace function public.update_current_user_artisan_comment(
  p_client_request_id uuid,
  p_comment_id uuid,
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment artisan.comments%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_comment') then
    raise exception using errcode = '42501', message = 'artisan_comment_edit_not_permitted';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 5000
     or not private.artisan_mentions_are_valid(v_user_id, p_mentioned_user_ids) then
    raise exception using errcode = '22023', message = 'artisan_comment_edit_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_comment_updated',
    pg_catalog.jsonb_build_object(
      'commentId', p_comment_id,
      'body', pg_catalog.btrim(p_body),
      'mentionedUserIds', coalesce(p_mentioned_user_ids, '{}'::uuid[])
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_comment
  from artisan.comments
  where id = p_comment_id and user_id = v_user_id
    and status in ('pending_review','published','edited','rejected')
    and moderation_status <> 'legal_hold'
  for update;
  if exists (
    select 1 from artisan.forum_posts as post
    where post.id = v_comment.post_id
      and (post.status <> 'published' or post.moderation_status <> 'approved' or not post.comments_enabled)
  ) then
    raise exception using errcode = '55000', message = 'artisan_comment_parent_unavailable';
  end if;
  insert into artisan.comment_revisions(comment_id, body, edited_by)
  values (v_comment.id, v_comment.body, v_user_id);
  update artisan.comments
  set body = pg_catalog.btrim(p_body), status = 'pending_review',
      moderation_status = 'pending', edited_at = pg_catalog.now(),
      published_at = null
  where id = v_comment.id;
  delete from artisan.comment_mentions where comment_id = v_comment.id;
  insert into artisan.comment_mentions(comment_id, mentioned_user_id)
  select v_comment.id, mentioned_user_id
  from pg_catalog.unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as mentioned_user_id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    v_user_id, 'user', 'artisan_comment_updated', 'artisan_comment', v_comment.id, p_client_request_id
  );
  v_response := pg_catalog.jsonb_build_object(
    'commentId', v_comment.id, 'status', 'pending_review',
    'moderationStatus', 'pending', 'editedAt', pg_catalog.now()
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.update_current_user_artisan_comment(uuid, uuid, text, uuid[]) owner to postgres;
revoke all privileges on function public.update_current_user_artisan_comment(uuid, uuid, text, uuid[])
  from public, anon, authenticated, service_role;
-- UUID mention mutation is an internal implementation detail; the public site
-- uses the service-only handle wrapper below.

create or replace function public.delete_current_user_artisan_comment(
  p_client_request_id uuid,
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment artisan.comments%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id) then
    raise exception using errcode = '42501', message = 'artisan_comment_delete_not_permitted';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_comment_deleted',
    pg_catalog.jsonb_build_object('commentId', p_comment_id)
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_comment
  from artisan.comments
  where id = p_comment_id and user_id = v_user_id
    and status not in ('deleted_by_user','removed_by_moderator')
  for update;
  insert into artisan.comment_revisions(comment_id, body, edited_by)
  values (v_comment.id, v_comment.body, v_user_id);
  update artisan.comments
  set body = '[deleted by author]', status = 'deleted_by_user',
      deleted_at = pg_catalog.now(), edited_at = pg_catalog.now()
  where id = v_comment.id;
  delete from artisan.comment_mentions where comment_id = v_comment.id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    v_user_id, 'user', 'artisan_comment_deleted', 'artisan_comment',
    v_comment.id, p_client_request_id,
    pg_catalog.jsonb_build_object('legalHoldPreservedInRevision', v_comment.moderation_status = 'legal_hold')
  );
  v_response := pg_catalog.jsonb_build_object(
    'commentId', v_comment.id, 'status', 'deleted_by_user', 'deletedAt', pg_catalog.now()
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.delete_current_user_artisan_comment(uuid, uuid) owner to postgres;
revoke all privileges on function public.delete_current_user_artisan_comment(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_current_user_artisan_comment(uuid, uuid) to authenticated;

create or replace function public.set_current_user_artisan_appreciation(
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_appreciated boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
        v_target_owner uuid;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_appreciate') then
    raise exception using errcode = '42501', message = 'artisan_appreciation_not_permitted';
  end if;
  if p_target_type not in ('artwork','post')
     or not private.artisan_target_exists(p_target_type, p_target_id) then
    raise exception using errcode = '22023', message = 'artisan_appreciation_target_invalid';
  end if;
  v_target_owner := private.artisan_target_owner(p_target_type, p_target_id);
  if v_target_owner is null or v_target_owner = v_user_id
     or exists (
       select 1 from artisan.user_blocks as block
       where (block.blocker_user_id = v_user_id and block.blocked_user_id = v_target_owner)
          or (block.blocker_user_id = v_target_owner and block.blocked_user_id = v_user_id)
     ) then
    raise exception using errcode = '42501', message = 'artisan_interaction_blocked';
  end if;
  if p_appreciated then
    insert into artisan.appreciations(user_id, target_type, target_id, client_request_id)
    values (v_user_id, p_target_type, p_target_id, p_client_request_id)
    on conflict (user_id, target_type, target_id) do nothing;
  else
    delete from artisan.appreciations
    where user_id = v_user_id and target_type = p_target_type and target_id = p_target_id;
  end if;
  return pg_catalog.jsonb_build_object('targetType', p_target_type, 'targetId', p_target_id, 'appreciated', p_appreciated);
end;
$$;

alter function public.set_current_user_artisan_appreciation(uuid, text, uuid, boolean) owner to postgres;
revoke all privileges on function public.set_current_user_artisan_appreciation(uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_current_user_artisan_appreciation(uuid, text, uuid, boolean) to authenticated;

create or replace function public.create_current_user_challenge_submission(
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_artwork_id uuid,
  p_rules_client_request_id uuid,
  p_document_version text,
  p_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge artisan.challenges%rowtype;
  v_acceptance artisan.challenge_rule_acceptances%rowtype;
  v_submission artisan.challenge_submissions%rowtype;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_submit_challenge') then
    raise exception using errcode = '42501', message = 'artisan_challenge_submission_not_permitted';
  end if;
  select * into strict v_challenge
  from artisan.challenges
  where id = p_challenge_id and status = 'open'
    and opens_at <= pg_catalog.now() and deadline_at > pg_catalog.now()
  for share;
  if v_challenge.rules_document_version is null
     or v_challenge.rules_content_sha256 is null
     or p_document_version <> v_challenge.rules_document_version
     or p_content_sha256 <> v_challenge.rules_content_sha256
     or not exists (
       select 1 from artisan.artworks
       where id = p_artwork_id and owner_user_id = v_user_id
     ) then
    raise exception using errcode = '22023', message = 'artisan_challenge_rules_or_artwork_invalid';
  end if;
  if not private.artisan_challenge_policy_allows(
    v_user_id, p_challenge_id, p_artwork_id
  ) then
    raise exception using errcode = '42501', message = 'artisan_challenge_policy_not_permitted';
  end if;
  if (
    select pg_catalog.count(*) from artisan.challenge_submissions
    where challenge_id = p_challenge_id and submitter_user_id = v_user_id
      and status not in ('withdrawn','ineligible')
  ) >= v_challenge.maximum_entries_per_artist then
    raise exception using errcode = '55000', message = 'artisan_challenge_submission_limit_reached';
  end if;
  select * into v_acceptance
  from artisan.challenge_rule_acceptances
  where challenge_id = p_challenge_id and user_id = v_user_id
    and document_key = v_challenge.rules_document_key
    and document_version = p_document_version
    and content_sha256 = p_content_sha256
  order by accepted_at desc, id
  limit 1;
  if v_acceptance.id is null then
    insert into artisan.challenge_rule_acceptances(
      client_request_id, challenge_id, user_id, document_key,
      document_version, content_sha256
    ) values (
      p_rules_client_request_id, p_challenge_id, v_user_id,
      v_challenge.rules_document_key, p_document_version, p_content_sha256
    ) returning * into v_acceptance;
  end if;
  insert into artisan.challenge_submissions(
    client_request_id, challenge_id, artwork_id, submitter_user_id,
    rule_acceptance_id
  ) values (
    p_client_request_id, p_challenge_id, p_artwork_id, v_user_id,
    v_acceptance.id
  ) returning * into v_submission;
  insert into artisan.submission_media(submission_id, media_asset_id, display_order)
  select v_submission.id, media.id,
         pg_catalog.row_number() over (order by media.created_at, media.id) - 1
  from artisan.media_assets as media
  where media.artwork_id = p_artwork_id
    and media.owner_user_id = v_user_id
    and media.processing_status in ('approved','published')
    and media.moderation_status = 'approved';
  return pg_catalog.jsonb_build_object('submissionId', v_submission.id, 'status', v_submission.status);
end;
$$;

alter function public.create_current_user_challenge_submission(uuid, uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.create_current_user_challenge_submission(uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_current_user_challenge_submission(uuid, uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.submit_current_user_challenge_submission(
  p_submission_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission artisan.challenge_submissions%rowtype;
  v_challenge artisan.challenges%rowtype;
begin
  if v_user_id is null or not private.community_can_participate(v_user_id, 'artisan_submit_challenge') then
    raise exception using errcode = '42501', message = 'artisan_challenge_submit_not_permitted';
  end if;
  select * into strict v_submission
  from artisan.challenge_submissions
  where id = p_submission_id and submitter_user_id = v_user_id
    and status in ('draft','uploading','processing','changes_requested')
  for update;
  select * into strict v_challenge
  from artisan.challenges
  where id = v_submission.challenge_id and status = 'open'
    and opens_at <= pg_catalog.now() and deadline_at > pg_catalog.now()
  for share;
  if not private.artisan_challenge_policy_allows(
       v_user_id, v_challenge.id, v_submission.artwork_id
     ) then
    raise exception using errcode = '42501', message = 'artisan_challenge_policy_not_permitted';
  end if;
  if v_submission.rule_acceptance_id is null
     or not exists (
       select 1
       from artisan.challenge_rule_acceptances as acceptance
       where acceptance.id = v_submission.rule_acceptance_id
         and acceptance.challenge_id = v_challenge.id
         and acceptance.user_id = v_user_id
         and acceptance.document_key = v_challenge.rules_document_key
         and acceptance.document_version = v_challenge.rules_document_version
         and acceptance.content_sha256 = v_challenge.rules_content_sha256
     )
     or not private.artisan_challenge_submission_media_is_valid(
       p_submission_id, v_challenge.id
     ) then
    raise exception using errcode = '55000', message = 'artisan_challenge_submission_not_ready';
  end if;
  update artisan.challenge_submissions
  set status = 'pending_review', moderation_status = 'pending',
      eligibility_status = 'not_evaluated', submitted_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = p_submission_id
  returning * into v_submission;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    v_user_id, 'user', 'artisan_challenge_submission_submitted',
    'artisan_challenge_submission', p_submission_id, p_client_request_id
  );
  return pg_catalog.jsonb_build_object('submissionId', p_submission_id, 'status', v_submission.status);
end;
$$;

alter function public.submit_current_user_challenge_submission(uuid, uuid) owner to postgres;
revoke all privileges on function public.submit_current_user_challenge_submission(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_current_user_challenge_submission(uuid, uuid) to authenticated;

create or replace function public.submit_current_user_artisan_appeal(
  p_client_request_id uuid,
  p_case_id uuid,
  p_restriction_id uuid,
  p_moderation_action_id uuid,
  p_statement text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_appeal artisan.appeals%rowtype;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id)
     or pg_catalog.num_nonnulls(p_case_id, p_restriction_id, p_moderation_action_id) < 1
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_statement, ''))) not between 20 and 10000 then
    raise exception using errcode = '22023', message = 'artisan_appeal_invalid';
  end if;
  if p_restriction_id is not null and not exists (
    select 1 from private.account_restrictions
    where id = p_restriction_id and target_user_id = v_user_id and appeal_eligible
  ) then
    raise exception using errcode = '42501', message = 'artisan_appeal_target_not_owned';
  end if;
  if p_case_id is not null and not exists (
    select 1 from artisan.moderation_cases where id = p_case_id and subject_user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'artisan_appeal_target_not_owned';
  end if;
  if p_moderation_action_id is not null and not exists (
    select 1
    from artisan.moderation_actions as action
    join artisan.moderation_cases as moderation_case on moderation_case.id = action.case_id
    where action.id = p_moderation_action_id and moderation_case.subject_user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'artisan_appeal_target_not_owned';
  end if;
  insert into artisan.appeals(
    client_request_id, appellant_user_id, case_id,
    restriction_id, moderation_action_id, statement
  ) values (
    p_client_request_id, v_user_id, p_case_id,
    p_restriction_id, p_moderation_action_id, pg_catalog.btrim(p_statement)
  ) returning * into v_appeal;
  if p_case_id is not null then
    update artisan.moderation_cases set status = 'appealed' where id = p_case_id and status <> 'closed';
  end if;
  return pg_catalog.jsonb_build_object('appealId', v_appeal.id, 'status', v_appeal.status, 'submittedAt', v_appeal.submitted_at);
end;
$$;

alter function public.submit_current_user_artisan_appeal(uuid, uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.submit_current_user_artisan_appeal(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_current_user_artisan_appeal(uuid, uuid, uuid, uuid, text) to authenticated;

create or replace function public.artisan_authorize_media_upload(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_artwork_id uuid,
  p_storage_provider text,
  p_adapter_key text,
  p_declared_mime text,
  p_expected_bytes bigint,
  p_declared_checksum_sha256 text,
  p_original_filename text,
  p_accessibility_description text,
  p_transcript text default null,
  p_audio_description text default null,
  p_keyboard_instructions text default null,
  p_static_equivalent_description text default null,
  p_caption_tracks jsonb default '[]'::jsonb,
  p_loud_audio_warning boolean default false,
  p_spoken_content boolean default false,
  p_creator_declares_flash_risk boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adapter artisan.media_adapters%rowtype;
  v_asset_id uuid := gen_random_uuid();
  v_object_key text;
  v_asset artisan.media_assets%rowtype;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  if not private.artisan_active_member(p_actor_user_id)
     or not private.community_can_participate(
       p_actor_user_id,
       case p_adapter_key
         when 'image_static' then 'artisan_upload_image'
         when 'audio' then 'artisan_upload_audio'
         when 'short_video' then 'artisan_upload_video'
         when 'pdf_document' then 'artisan_upload_document'
         when 'animation' then 'artisan_upload_animation'
         when 'model_3d' then 'artisan_upload_3d'
         when 'interactive_work' then 'artisan_upload_interactive'
         else 'artisan_upload_unknown'
       end
     ) then
    raise exception using errcode = '42501', message = 'artisan_upload_not_permitted';
  end if;
  select * into strict v_adapter
  from artisan.media_adapters
  where adapter_key = p_adapter_key and enabled;
  if v_adapter.feature_flag_key is not null
     and not private.community_feature_enabled(v_adapter.feature_flag_key) then
    raise exception using errcode = '42501', message = 'artisan_media_adapter_disabled';
  end if;
  if p_client_request_id is null
     or p_storage_provider not in ('supabase','r2')
     or not exists (
       select 1 from artisan.artworks
       where id = p_artwork_id and owner_user_id = p_actor_user_id
         and status in ('draft','processing','changes_requested')
     )
     or p_declared_mime is null
     or not (p_declared_mime = any(v_adapter.allowed_mime_types))
     or p_expected_bytes <= 0 or p_expected_bytes > v_adapter.maximum_bytes
     or coalesce(p_declared_checksum_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_accessibility_description, ''))) not between 1 and 4000
     or pg_catalog.char_length(coalesce(p_transcript, '')) > 30000
     or pg_catalog.char_length(coalesce(p_audio_description, '')) > 10000
     or pg_catalog.char_length(coalesce(p_keyboard_instructions, '')) > 5000
     or pg_catalog.char_length(coalesce(p_static_equivalent_description, '')) > 10000
     or not private.artisan_caption_tracks_are_safe(coalesce(p_caption_tracks, '[]'::jsonb))
     or p_loud_audio_warning is null
     or p_spoken_content is null
     or p_creator_declares_flash_risk is null
     or (p_adapter_key = 'interactive_work' and (
       pg_catalog.char_length(pg_catalog.btrim(coalesce(p_keyboard_instructions, ''))) < 8
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_static_equivalent_description, ''))) < 8
     )) then
    raise exception using errcode = '22023', message = 'artisan_upload_authorization_invalid';
  end if;
  v_object_key := p_actor_user_id::text || '/' || p_artwork_id::text || '/' || v_asset_id::text || '/original';
  insert into artisan.media_assets(
    id, client_request_id, artwork_id, owner_user_id, adapter_key,
    storage_provider,
    private_object_key, original_filename, declared_mime,
    expected_bytes, declared_checksum_sha256, accessibility_description,
    transcript, audio_description, keyboard_instructions,
    static_equivalent_description, caption_tracks, loud_audio_warning,
    spoken_content, creator_declared_flash_risk,
    upload_expires_at, retention_expires_at
  ) values (
    v_asset_id, p_client_request_id, p_artwork_id, p_actor_user_id, p_adapter_key,
    p_storage_provider,
    v_object_key,
    nullif(pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_original_filename, ''), '[^A-Za-z0-9._ -]', '_', 'g'), 255), ''),
    p_declared_mime, p_expected_bytes, p_declared_checksum_sha256,
    pg_catalog.btrim(p_accessibility_description),
    nullif(pg_catalog.btrim(p_transcript), ''),
    nullif(pg_catalog.btrim(p_audio_description), ''),
    nullif(pg_catalog.btrim(p_keyboard_instructions), ''),
    nullif(pg_catalog.btrim(p_static_equivalent_description), ''),
    coalesce(p_caption_tracks, '[]'::jsonb), p_loud_audio_warning,
    p_spoken_content, p_creator_declares_flash_risk,
    pg_catalog.now() + interval '15 minutes',
    pg_catalog.now() + pg_catalog.make_interval(days => v_adapter.retention_days)
  ) returning * into v_asset;
  insert into artisan.media_processing_events(
    client_request_id, media_asset_id, actor_user_id, actor_kind,
    to_status, metadata
  ) values (
    p_client_request_id, v_asset.id, p_actor_user_id, 'owner',
    'upload_authorized',
    pg_catalog.jsonb_build_object(
      'adapterKey', p_adapter_key, 'storageProvider', p_storage_provider,
      'expectedBytes', p_expected_bytes, 'declaredMime', p_declared_mime,
      'spokenContent', p_spoken_content,
      'creatorDeclaresFlashRisk', p_creator_declares_flash_risk
    )
  );
  return pg_catalog.jsonb_build_object(
    'mediaAssetId', v_asset.id,
    'storageProvider', v_asset.storage_provider,
    'bucket', v_asset.quarantine_bucket,
    'privateObjectKey', v_asset.private_object_key,
    'objectKey', v_asset.private_object_key,
    'expectedBytes', v_asset.expected_bytes,
    'declaredMime', v_asset.declared_mime,
    'spokenContent', v_asset.spoken_content,
    'creatorDeclaresFlashRisk', v_asset.creator_declared_flash_risk,
    'uploadExpiresAt', v_asset.upload_expires_at,
    'processingStatus', v_asset.processing_status
  );
end;
$$;

alter function public.artisan_authorize_media_upload(uuid, uuid, uuid, text, text, text, bigint, text, text, text, text, text, text, text, jsonb, boolean, boolean, boolean) owner to postgres;
revoke all privileges on function public.artisan_authorize_media_upload(uuid, uuid, uuid, text, text, text, bigint, text, text, text, text, text, text, text, jsonb, boolean, boolean, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_authorize_media_upload(uuid, uuid, uuid, text, text, text, bigint, text, text, text, text, text, text, text, jsonb, boolean, boolean, boolean) to service_role;

create or replace function public.artisan_get_media_upload_permit(
  p_actor_user_id uuid,
  p_media_asset_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'mediaAssetId', media.id,
      'ownerUserId', media.owner_user_id,
      'artworkId', media.artwork_id,
      'storageProvider', media.storage_provider,
      'bucket', media.quarantine_bucket,
      'privateObjectKey', media.private_object_key,
      'objectKey', media.private_object_key,
      'adapterKey', media.adapter_key,
      'expectedBytes', media.expected_bytes,
      'declaredMime', media.declared_mime,
      'declaredChecksumSha256', media.declared_checksum_sha256,
      'uploadExpiresAt', media.upload_expires_at,
      'processingStatus', media.processing_status
    )
    from artisan.media_assets as media
    where media.id = p_media_asset_id
      and media.owner_user_id = p_actor_user_id
      and media.processing_status = 'upload_authorized'
      and media.upload_expires_at > pg_catalog.now()
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_get_media_upload_permit(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_get_media_upload_permit(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_get_media_upload_permit(uuid, uuid) to service_role;

create or replace function public.artisan_record_media_uploaded(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_media_asset_id uuid,
  p_byte_size bigint,
  p_detected_mime text,
  p_detected_checksum_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset artisan.media_assets%rowtype;
  v_adapter artisan.media_adapters%rowtype;
  v_valid boolean;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select * into strict v_asset
  from artisan.media_assets
  where id = p_media_asset_id and owner_user_id = p_actor_user_id
    and processing_status = 'upload_authorized'
    and upload_expires_at > pg_catalog.now()
  for update;
  select * into strict v_adapter from artisan.media_adapters where adapter_key = v_asset.adapter_key;
  v_valid := p_byte_size > 0 and p_byte_size <= v_asset.expected_bytes
    and p_byte_size <= v_adapter.maximum_bytes
    and p_detected_mime = any(v_adapter.allowed_mime_types)
    and p_detected_mime = v_asset.declared_mime
    and p_detected_checksum_sha256 ~ '^[0-9a-f]{64}$'
    and (v_asset.declared_checksum_sha256 is null or v_asset.declared_checksum_sha256 = p_detected_checksum_sha256);
  update artisan.media_assets
  set byte_size = p_byte_size,
      detected_mime = p_detected_mime,
      detected_checksum_sha256 = p_detected_checksum_sha256,
      processing_status = case when v_valid then 'uploaded' else 'validation_failed' end,
      moderation_status = case when v_valid then 'pending' else 'quarantined' end,
      uploaded_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_media_asset_id
  returning * into v_asset;
  insert into artisan.media_processing_events(
    client_request_id, media_asset_id, actor_user_id, actor_kind,
    from_status, to_status, validator_key, result_sha256,
    metadata
  ) values (
    p_client_request_id, p_media_asset_id, p_actor_user_id, 'owner',
    'upload_authorized', v_asset.processing_status, v_adapter.validator_key,
    p_detected_checksum_sha256,
    pg_catalog.jsonb_build_object('byteSize', p_byte_size, 'detectedMime', p_detected_mime, 'valid', v_valid)
  );
  if v_valid then
    insert into artisan.media_processing_jobs(media_asset_id, status, available_at)
    values (p_media_asset_id, 'queued', pg_catalog.now())
    on conflict (media_asset_id) do update
    set status = case when artisan.media_processing_jobs.status = 'completed'
        then artisan.media_processing_jobs.status else 'queued' end,
        revision = artisan.media_processing_jobs.revision + 1,
        available_at = pg_catalog.now(), claimed_by = null, claimed_at = null,
        lease_expires_at = null, updated_at = pg_catalog.now();
  end if;
  if not v_valid then
    insert into artisan.retention_tasks(target_type, target_id, action, due_at)
    values ('media_asset', p_media_asset_id, 'delete_rejected_media', pg_catalog.now() + interval '72 hours');
  end if;
  return pg_catalog.jsonb_build_object('mediaAssetId', p_media_asset_id, 'processingStatus', v_asset.processing_status, 'valid', v_valid);
end;
$$;

alter function public.artisan_record_media_uploaded(uuid, uuid, uuid, bigint, text, text) owner to postgres;
revoke all privileges on function public.artisan_record_media_uploaded(uuid, uuid, uuid, bigint, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_record_media_uploaded(uuid, uuid, uuid, bigint, text, text) to service_role;

create or replace function public.artisan_get_media_processing_job(
  p_media_asset_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'mediaAssetId', media.id,
      'jobRevision', job.revision,
      'ownerUserId', media.owner_user_id,
      'artworkId', media.artwork_id,
      'storageProvider', media.storage_provider,
      'bucket', media.quarantine_bucket,
      'privateObjectKey', media.private_object_key,
      'objectKey', media.private_object_key,
      'adapterKey', adapter.adapter_key,
      'allowedMimeTypes', adapter.allowed_mime_types,
      'maximumBytes', adapter.maximum_bytes,
      'maximumWidth', adapter.maximum_width,
      'maximumHeight', adapter.maximum_height,
      'maximumPixels', adapter.maximum_pixels,
      'maximumDurationSeconds', adapter.maximum_duration_seconds,
      'validatorKey', adapter.validator_key,
      'sanitizerKey', adapter.sanitizer_key,
      'previewerKey', adapter.previewer_key,
      'accessibilityRequirements', adapter.accessibility_requirements,
      'moderationRequirements', adapter.moderation_requirements,
      'declaredMime', media.declared_mime,
      'declaredChecksumSha256', media.declared_checksum_sha256,
      'detectedMime', media.detected_mime,
      'byteSize', media.byte_size,
      'detectedChecksumSha256', media.detected_checksum_sha256,
      'sourceChecksumSha256', media.declared_checksum_sha256,
      'approvedObjectKey', media.approved_object_key,
      'approvedChecksumSha256', media.approved_checksum_sha256,
      'approvedMime', media.approved_mime,
      'thumbnailObjectKey', media.thumbnail_object_key,
      'thumbnailChecksumSha256', media.thumbnail_checksum_sha256,
      'thumbnailMime', media.thumbnail_mime,
      'width', media.width,
      'height', media.height,
      'durationSeconds', media.duration_seconds,
      'metadataStripped', media.metadata_stripped,
      'flashWarning', media.flash_warning,
      'loudAudioWarning', media.loud_audio_warning,
      'accessibilityDescription', media.accessibility_description,
      'transcript', media.transcript,
      'audioDescription', media.audio_description,
      'keyboardInstructions', media.keyboard_instructions,
      'staticEquivalent', media.static_equivalent_description,
      'captionTracks', media.caption_tracks,
      'spokenContent', media.spoken_content,
      'creatorDeclaresFlashRisk', media.creator_declared_flash_risk,
      'processingStatus', media.processing_status
    )
    from artisan.media_assets as media
    join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
    join artisan.media_processing_jobs as job on job.media_asset_id = media.id
    where media.id = p_media_asset_id
      and media.processing_status in ('uploaded','type_validating','decoded','metadata_stripped','reencoded','thumbnail_created','scanning','pending_review')
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_get_media_processing_job(uuid) owner to postgres;
revoke all privileges on function public.artisan_get_media_processing_job(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_get_media_processing_job(uuid) to service_role;

create or replace function public.artisan_record_media_processing_result(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_media_asset_id uuid,
  p_from_status text,
  p_to_status text,
  p_detected_mime text,
  p_detected_checksum_sha256 text,
  p_approved_object_key text,
  p_thumbnail_object_key text,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric,
  p_metadata_stripped boolean,
  p_flash_warning boolean,
  p_loud_audio_warning boolean,
  p_private_reason text,
  p_processing_metadata jsonb default '{}'::jsonb,
  p_approved_checksum_sha256 text default null,
  p_thumbnail_checksum_sha256 text default null,
  p_approved_mime text default null,
  p_thumbnail_mime text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset artisan.media_assets%rowtype;
  v_adapter artisan.media_adapters%rowtype;
  v_human_decision boolean := false;
  v_transition_allowed boolean := false;
  v_approved_prefix text;
  v_thumbnail_prefix text;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select * into strict v_asset
  from artisan.media_assets
  where id = p_media_asset_id and processing_status = p_from_status
  for update;
  select * into strict v_adapter from artisan.media_adapters where adapter_key = v_asset.adapter_key;
  v_human_decision := (
    p_from_status = 'pending_review' and p_to_status in ('approved','rejected','quarantined')
  ) or p_to_status = 'removed';
  if v_human_decision then
    perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_media_review');
  elsif p_actor_user_id is not null or p_actor_aal <> 'service' then
    raise exception using errcode = '42501', message = 'artisan_media_processor_actor_invalid';
  end if;
  v_transition_allowed := case p_from_status
    when 'uploaded' then p_to_status = 'type_validating'
    when 'type_validating' then p_to_status in ('decoded','validation_failed','quarantined')
    when 'decoded' then p_to_status in ('metadata_stripped','validation_failed','processing_failed','quarantined')
    when 'metadata_stripped' then p_to_status in ('reencoded','validation_failed','processing_failed','quarantined')
    when 'reencoded' then p_to_status in ('thumbnail_created','processing_failed','quarantined')
    when 'thumbnail_created' then p_to_status in ('scanning','processing_failed','quarantined')
    when 'scanning' then p_to_status in ('pending_review','quarantined','processing_failed')
    when 'pending_review' then p_to_status in ('approved','rejected','quarantined')
    when 'approved' then p_to_status in ('published','removed')
    when 'published' then p_to_status = 'removed'
    else false
  end;
  if not v_transition_allowed then
    raise exception using errcode = '55000', message = 'artisan_media_transition_not_allowed';
  end if;
  v_approved_prefix := 'approved/' || v_asset.owner_user_id::text || '/' || v_asset.artwork_id::text || '/' || v_asset.id::text || '/';
  v_thumbnail_prefix := 'thumbnails/' || v_asset.owner_user_id::text || '/' || v_asset.artwork_id::text || '/' || v_asset.id::text || '/';
  if p_client_request_id is null
     or p_to_status not in ('type_validating','decoded','metadata_stripped','reencoded','thumbnail_created','scanning','pending_review','approved','published','validation_failed','processing_failed','quarantined','rejected','removed')
     or p_detected_mime is null
     or not (p_detected_mime = any(v_adapter.allowed_mime_types))
     or coalesce(p_detected_checksum_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_detected_checksum_sha256 <> v_asset.detected_checksum_sha256
     or (p_approved_checksum_sha256 is not null and p_approved_checksum_sha256 !~ '^[0-9a-f]{64}$')
     or (p_thumbnail_checksum_sha256 is not null and p_thumbnail_checksum_sha256 !~ '^[0-9a-f]{64}$')
     or (p_approved_mime is not null and not case v_asset.adapter_key
       when 'image_static' then p_approved_mime = 'image/webp'
       when 'audio' then p_approved_mime in ('audio/mpeg','audio/ogg')
       when 'short_video' then p_approved_mime = 'video/mp4'
       when 'pdf_document' then p_approved_mime = 'application/pdf'
       when 'animation' then p_approved_mime = 'video/mp4'
       when 'model_3d' then p_approved_mime = 'model/gltf-binary'
       when 'interactive_work' then p_approved_mime = 'application/vnd.elysia.artisan-interactive+json'
       else false end)
     or (p_thumbnail_mime is not null and p_thumbnail_mime <> 'image/webp')
     or (p_width is not null and (p_width <= 0 or (v_adapter.maximum_width is not null and p_width > v_adapter.maximum_width)))
     or (p_height is not null and (p_height <= 0 or (v_adapter.maximum_height is not null and p_height > v_adapter.maximum_height)))
     or (p_width is not null and p_height is not null and v_adapter.maximum_pixels is not null and p_width::bigint * p_height::bigint > v_adapter.maximum_pixels)
     or (p_duration_seconds is not null and v_adapter.maximum_duration_seconds is not null and p_duration_seconds > v_adapter.maximum_duration_seconds)
     or p_metadata_stripped is null or p_flash_warning is null
     or p_loud_audio_warning is null
     or p_processing_metadata is null
     or pg_catalog.jsonb_typeof(p_processing_metadata) <> 'object'
     or pg_catalog.char_length(p_processing_metadata::text) > 4000
     or exists (
       select 1 from pg_catalog.jsonb_object_keys(p_processing_metadata) as key
       where key not in (
         'processorVersion','decoderVersion','sanitizerVersion',
         'scannerProvider','scannerVersion','scannerCheckId',
         'scannerOutcome','scannerAssessedAt','adapterFacts'
       )
     )
     or (p_processing_metadata ? 'adapterFacts'
       and pg_catalog.jsonb_typeof(p_processing_metadata -> 'adapterFacts') <> 'object')
     or (v_human_decision and pg_catalog.char_length(coalesce(p_private_reason, '')) not between 8 and 2000) then
    raise exception using errcode = '22023', message = 'artisan_media_processing_result_invalid';
  end if;
  if ((p_from_status = 'scanning' and p_to_status = 'pending_review')
      or (not v_human_decision and p_to_status = 'quarantined'))
     and (
       coalesce(p_processing_metadata ->> 'scannerProvider', '') !~ '^[A-Za-z0-9._:-]{2,120}$'
       or coalesce(p_processing_metadata ->> 'scannerVersion', '') !~ '^[A-Za-z0-9._:+-]{1,120}$'
       or coalesce(p_processing_metadata ->> 'scannerCheckId', '') !~ '^[A-Za-z0-9._:-]{8,200}$'
       or coalesce(p_processing_metadata ->> 'scannerOutcome', '') not in ('clean','quarantined')
       or coalesce(p_processing_metadata ->> 'scannerAssessedAt', '') !~ '^\d{4}-\d{2}-\d{2}T'
     ) then
    raise exception using errcode = '55000', message = 'artisan_scanner_evidence_required';
  end if;
  if p_to_status in ('approved','published')
     and (
       not (v_asset.metadata_stripped or p_metadata_stripped)
       or coalesce(p_approved_object_key, v_asset.approved_object_key) is null
       or coalesce(p_approved_checksum_sha256, v_asset.approved_checksum_sha256) is null
       or coalesce(p_approved_mime, v_asset.approved_mime) is null
       or coalesce(p_thumbnail_object_key, v_asset.thumbnail_object_key) is null
       or coalesce(p_thumbnail_checksum_sha256, v_asset.thumbnail_checksum_sha256) is null
       or coalesce(p_thumbnail_mime, v_asset.thumbnail_mime) is null
     ) then
    raise exception using errcode = '55000', message = 'artisan_sanitized_derivatives_required';
  end if;
  if (p_approved_object_key is not null and (
        p_approved_object_key not like v_approved_prefix || '%'
        or p_approved_object_key ~ '(^|/)\.\.(/|$)' or p_approved_object_key ~ '[\\\\]'
        or p_approved_checksum_sha256 is null
        or p_approved_mime is null
      ))
     or (p_thumbnail_object_key is not null and (
       p_thumbnail_object_key not like v_thumbnail_prefix || '%'
       or p_thumbnail_object_key ~ '(^|/)\.\.(/|$)' or p_thumbnail_object_key ~ '[\\\\]'
       or p_thumbnail_checksum_sha256 is null
       or p_thumbnail_mime is null
     )) then
    raise exception using errcode = '22023', message = 'artisan_media_object_key_invalid';
  end if;
  update artisan.media_assets
  set detected_mime = p_detected_mime,
      approved_bucket = case when p_approved_object_key is not null then 'artisan-approved' else approved_bucket end,
      approved_object_key = coalesce(p_approved_object_key, approved_object_key),
      approved_checksum_sha256 = coalesce(p_approved_checksum_sha256, approved_checksum_sha256),
      approved_mime = coalesce(p_approved_mime, approved_mime),
      thumbnail_bucket = case when p_thumbnail_object_key is not null then 'artisan-thumbnails' else thumbnail_bucket end,
      thumbnail_object_key = coalesce(p_thumbnail_object_key, thumbnail_object_key),
      thumbnail_checksum_sha256 = coalesce(p_thumbnail_checksum_sha256, thumbnail_checksum_sha256),
      thumbnail_mime = coalesce(p_thumbnail_mime, thumbnail_mime),
      width = coalesce(p_width, width), height = coalesce(p_height, height),
      duration_seconds = coalesce(p_duration_seconds, duration_seconds),
      metadata_stripped = metadata_stripped or p_metadata_stripped,
      flash_warning = flash_warning or creator_declared_flash_risk or p_flash_warning,
      loud_audio_warning = loud_audio_warning or p_loud_audio_warning,
      processing_status = p_to_status,
      moderation_status = case
        when p_to_status = 'approved' then 'approved'
        when p_to_status = 'rejected' then 'rejected'
        when p_to_status = 'quarantined' then 'quarantined'
        when p_to_status = 'removed' then 'removed'
        when p_to_status = 'pending_review' then 'pending'
        else moderation_status
      end,
      processed_at = case when p_to_status in ('pending_review','approved','published','rejected','quarantined') then pg_catalog.now() else processed_at end,
      approved_at = case when p_to_status = 'approved' then pg_catalog.now() else approved_at end,
      published_at = case when p_to_status = 'published' then pg_catalog.now() else published_at end,
      rejected_at = case when p_to_status in ('rejected','quarantined') then pg_catalog.now() else rejected_at end,
      updated_at = pg_catalog.now()
  where id = p_media_asset_id
  returning * into v_asset;
  insert into artisan.media_processing_events(
    client_request_id, media_asset_id, actor_user_id, actor_kind,
    from_status, to_status, validator_key, sanitizer_key,
    result_sha256, private_reason,
    metadata
  ) values (
    p_client_request_id, p_media_asset_id, p_actor_user_id,
    case when v_human_decision then 'moderator' else 'processor' end,
    p_from_status, p_to_status, v_adapter.validator_key, v_adapter.sanitizer_key,
    p_detected_checksum_sha256, nullif(pg_catalog.btrim(p_private_reason), ''),
    pg_catalog.jsonb_build_object(
      'metadataStripped', p_metadata_stripped, 'flashWarning', p_flash_warning,
      'loudAudioWarning', p_loud_audio_warning,
      'width', p_width, 'height', p_height, 'durationSeconds', p_duration_seconds
    ) || p_processing_metadata
  );
  if p_to_status in ('pending_review','validation_failed','processing_failed','quarantined','rejected','removed','published') then
    update artisan.media_processing_jobs
    set status = case when p_to_status = 'processing_failed' then 'dead_letter' else 'completed' end,
        revision = revision + 1,
        completed_at = case when p_to_status = 'processing_failed' then null else pg_catalog.now() end,
        claimed_by = null, claimed_at = null, lease_expires_at = null,
        last_error_code = case when p_to_status in ('validation_failed','processing_failed','quarantined')
          then p_to_status else last_error_code end,
        last_error_at = case when p_to_status in ('validation_failed','processing_failed','quarantined')
          then pg_catalog.now() else last_error_at end,
        updated_at = pg_catalog.now()
    where media_asset_id = p_media_asset_id;
  end if;
  if p_to_status in ('rejected','quarantined','removed') then
    insert into artisan.retention_tasks(target_type, target_id, action, due_at)
    values ('media_asset', p_media_asset_id, 'delete_rejected_media', pg_catalog.now() + interval '72 hours')
    on conflict do nothing;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason,
    metadata
  ) values (
    p_actor_user_id, case when v_human_decision then 'staff' else 'service' end,
    case when v_human_decision then 'artisan_media_review' else null end,
    'artisan_media_processing_transitioned', 'artisan_media_asset',
    p_media_asset_id, p_client_request_id, nullif(pg_catalog.btrim(p_private_reason), ''),
    pg_catalog.jsonb_build_object('fromStatus', p_from_status, 'toStatus', p_to_status)
  );
  return pg_catalog.jsonb_build_object(
    'mediaAssetId', p_media_asset_id,
    'processingStatus', v_asset.processing_status,
    'moderationStatus', v_asset.moderation_status,
    'metadataStripped', v_asset.metadata_stripped,
    'loudAudioWarning', v_asset.loud_audio_warning
  );
end;
$$;

alter function public.artisan_record_media_processing_result(uuid, text, uuid, uuid, text, text, text, text, text, text, integer, integer, numeric, boolean, boolean, boolean, text, jsonb, text, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_record_media_processing_result(uuid, text, uuid, uuid, text, text, text, text, text, text, integer, integer, numeric, boolean, boolean, boolean, text, jsonb, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_record_media_processing_result(uuid, text, uuid, uuid, text, text, text, text, text, text, integer, integer, numeric, boolean, boolean, boolean, text, jsonb, text, text, text, text) to service_role;

create or replace function public.artisan_replace_media_caption_tracks(
  p_client_request_id uuid,
  p_media_asset_id uuid,
  p_tracks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset artisan.media_assets%rowtype;
  v_expected_prefix text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select * into strict v_asset from artisan.media_assets
  where id = p_media_asset_id
    and processing_status in ('reencoded','thumbnail_created','scanning','pending_review')
    and moderation_status not in ('rejected','quarantined','removed','legal_hold')
  for update;
  v_expected_prefix := 'approved/' || v_asset.owner_user_id::text || '/'
    || v_asset.artwork_id::text || '/' || v_asset.id::text || '/captions/';
  if p_client_request_id is null
     or p_tracks is null
     or pg_catalog.jsonb_typeof(p_tracks) <> 'array'
     or pg_catalog.jsonb_array_length(p_tracks) > 20
     or pg_catalog.char_length(p_tracks::text) > 50000
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
       where case
         when pg_catalog.jsonb_typeof(requested.value) <> 'object' then true
         else coalesce(requested.value ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           or coalesce(requested.value ->> 'language', '') !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
           or coalesce(requested.value ->> 'kind', '') not in ('captions','subtitles')
           or pg_catalog.char_length(coalesce(requested.value ->> 'label', '')) not between 1 and 80
           or coalesce(requested.value ->> 'checksumSha256', '') !~ '^[0-9a-f]{64}$'
           or coalesce(requested.value ->> 'mimeType', '') <> 'text/vtt'
           or coalesce(requested.value ->> 'approvedObjectKey', '')
             <> v_expected_prefix || (requested.value ->> 'id') || '.vtt'
           or exists (
             select 1 from pg_catalog.jsonb_object_keys(requested.value) as key
             where key not in (
               'id','language','kind','label',
               'approvedObjectKey','checksumSha256','mimeType'
             )
           )
       end
     )
     or exists (
       select requested.value ->> 'id'
       from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
       group by requested.value ->> 'id'
       having pg_catalog.count(*) <> 1
     )
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
       where not exists (
         select 1
         from pg_catalog.jsonb_array_elements(v_asset.caption_tracks) as declared(value)
         where declared.value ->> 'id' = requested.value ->> 'id'
           and declared.value ->> 'language' = requested.value ->> 'language'
           and declared.value ->> 'kind' = requested.value ->> 'kind'
           and declared.value ->> 'label' = requested.value ->> 'label'
       )
     )
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
       join artisan.media_caption_tracks as existing
         on existing.id::text = requested.value ->> 'id'
       where existing.media_asset_id <> p_media_asset_id
     ) then
    raise exception using errcode = '22023', message = 'artisan_caption_derivatives_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_caption_derivatives_replaced',
    pg_catalog.jsonb_build_object('mediaAssetId', p_media_asset_id, 'tracks', p_tracks)
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.media_caption_tracks
  set status = 'removed', updated_at = pg_catalog.now()
  where media_asset_id = p_media_asset_id
    and status <> 'removed'
    and id not in (
      select (requested.value ->> 'id')::uuid
      from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
    );
  insert into artisan.media_caption_tracks(
    id, media_asset_id, language, kind, label,
    approved_object_key, checksum_sha256, mime_type, status
  )
  select
    (requested.value ->> 'id')::uuid, p_media_asset_id,
    requested.value ->> 'language', requested.value ->> 'kind',
    requested.value ->> 'label', requested.value ->> 'approvedObjectKey',
    requested.value ->> 'checksumSha256', requested.value ->> 'mimeType', 'ready'
  from pg_catalog.jsonb_array_elements(p_tracks) as requested(value)
  on conflict (id) do update
  set language = excluded.language, kind = excluded.kind, label = excluded.label,
      approved_object_key = excluded.approved_object_key,
      checksum_sha256 = excluded.checksum_sha256,
      mime_type = excluded.mime_type, status = 'ready',
      updated_at = pg_catalog.now();
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'artisan_caption_derivatives_replaced',
    'artisan_media_asset', p_media_asset_id, p_client_request_id,
    pg_catalog.jsonb_build_object('trackCount', pg_catalog.jsonb_array_length(p_tracks))
  );
  select pg_catalog.jsonb_build_object(
    'mediaAssetId', p_media_asset_id,
    'captions', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'path', '/api/public/media/' || track.media_asset_id::text || '/captions/' || track.id::text,
      'language', track.language, 'label', track.label
    ) order by track.language, track.id), '[]'::jsonb)
  ) into v_response
  from artisan.media_caption_tracks as track
  where track.media_asset_id = p_media_asset_id and track.status = 'ready';
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_replace_media_caption_tracks(uuid, uuid, jsonb) owner to postgres;
revoke all privileges on function public.artisan_replace_media_caption_tracks(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_replace_media_caption_tracks(uuid, uuid, jsonb) to service_role;

create or replace function public.artisan_public_media_asset(p_media_asset_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role()
    and private.community_feature_enabled('artisan_public_database_reads') then coalesce((
      select pg_catalog.jsonb_build_object(
        'mediaAssetId', media.id,
        'artworkId', media.artwork_id,
        'storageProvider', media.storage_provider,
        'adapterKey', media.adapter_key,
        'presentationMime', media.approved_mime,
        'approvedBucket', media.approved_bucket,
        'approvedObjectKey', media.approved_object_key,
        'approvedChecksumSha256', media.approved_checksum_sha256,
        'checksumSha256', media.approved_checksum_sha256,
        'thumbnailBucket', media.thumbnail_bucket,
        'thumbnailObjectKey', media.thumbnail_object_key,
        'thumbnailChecksumSha256', media.thumbnail_checksum_sha256,
        'thumbnailMime', media.thumbnail_mime,
        'width', media.width,
        'height', media.height,
        'durationSeconds', media.duration_seconds,
        'accessibilityDescription', media.accessibility_description,
        'transcript', media.transcript,
        'audioDescription', media.audio_description,
        'keyboardInstructions', media.keyboard_instructions,
        'staticEquivalent', media.static_equivalent_description,
        'spokenContent', media.spoken_content,
        'creatorDeclaresFlashRisk', media.creator_declared_flash_risk,
        'flashWarning', media.flash_warning,
        'mediaPath', '/api/public/media/' || media.id::text,
        'posterPath', '/api/public/media/' || media.id::text || '/poster',
        'captions', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'path', '/api/public/media/' || caption.media_asset_id::text || '/captions/' || caption.id::text,
            'language', caption.language,
            'kind', caption.kind,
            'label', caption.label
          ) order by caption.language, caption.id)
          from artisan.media_caption_tracks as caption
          where caption.media_asset_id = media.id and caption.status = 'ready'
        ), '[]'::jsonb),
        'altText', media.accessibility_description,
        'loudAudioWarning', media.loud_audio_warning,
        'sanitizedDerivative', true,
        'autoplay', false,
        'status', 'ready',
        'publishedAt', media.published_at
      )
      from artisan.media_assets as media
      join artisan.artworks as artwork on artwork.id = media.artwork_id
      where media.id = p_media_asset_id
        and media.processing_status = 'published'
        and media.moderation_status = 'approved'
        and artwork.status = 'published'
        and artwork.moderation_status = 'approved'
        and media.metadata_stripped
    ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_media_asset(uuid) owner to postgres;
revoke all privileges on function public.artisan_public_media_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_media_asset(uuid) to service_role;

create or replace function public.artisan_public_caption_asset(
  p_media_asset_id uuid,
  p_caption_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role()
    and private.community_feature_enabled('artisan_public_database_reads') then coalesce((
      select pg_catalog.jsonb_build_object(
        'mediaAssetId', media.id,
        'captionTrackId', caption.id,
        'storageProvider', media.storage_provider,
        'approvedBucket', caption.approved_bucket,
        'approvedObjectKey', caption.approved_object_key,
        'checksumSha256', caption.checksum_sha256,
        'presentationMime', caption.mime_type,
        'path', '/api/public/media/' || media.id::text || '/captions/' || caption.id::text,
        'language', caption.language,
        'kind', caption.kind,
        'label', caption.label,
        'status', 'ready'
      )
      from artisan.media_caption_tracks as caption
      join artisan.media_assets as media on media.id = caption.media_asset_id
      join artisan.artworks as artwork on artwork.id = media.artwork_id
      where media.id = p_media_asset_id and caption.id = p_caption_track_id
        and caption.status = 'ready'
        and media.processing_status = 'published'
        and media.moderation_status = 'approved'
        and artwork.status = 'published'
        and artwork.moderation_status = 'approved'
        and media.metadata_stripped
    ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_caption_asset(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_caption_asset(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_caption_asset(uuid, uuid) to service_role;

create or replace function public.artisan_create_report(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_reporter_fingerprint_sha256 text,
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_summary text,
  p_details text,
  p_turnstile_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report artisan.reports%rowtype;
  v_sensitive boolean := p_reason_code in ('sexual_or_exploitative','minor_safety');
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  if not p_turnstile_verified
     or p_client_request_id is null
     or (p_actor_user_id is not null and not private.community_account_is_recoverable(p_actor_user_id))
     or (p_reporter_fingerprint_sha256 is not null and p_reporter_fingerprint_sha256 !~ '^[0-9a-f]{64}$')
     or p_target_type not in ('artwork','post','comment','profile','challenge','submission','media')
     or not private.artisan_target_exists(p_target_type, p_target_id)
     or p_reason_code not in ('sexual_or_exploitative','minor_safety','threat_or_harassment','hate','doxxing','stolen_art','copyright','impersonation','self_harm_concern','spam','malware','manipulated_media','other')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_summary, ''))) not between 8 and 500
     or pg_catalog.char_length(coalesce(p_details, '')) > 5000 then
    raise exception using errcode = '22023', message = 'artisan_report_invalid';
  end if;
  if (
    select pg_catalog.count(*) from artisan.reports
    where submitted_at > pg_catalog.now() - interval '1 hour'
      and ((p_actor_user_id is not null and reporter_user_id = p_actor_user_id)
        or (p_actor_user_id is null and reporter_fingerprint_sha256 = p_reporter_fingerprint_sha256))
  ) >= 10 then
    raise exception using errcode = '55000', message = 'artisan_report_rate_limited';
  end if;
  insert into artisan.reports(
    client_request_id, reporter_user_id, reporter_fingerprint_sha256,
    target_type, target_id, reason_code, summary, details,
    priority, child_safety_sensitive
  ) values (
    p_client_request_id, p_actor_user_id, p_reporter_fingerprint_sha256,
    p_target_type, p_target_id, p_reason_code, pg_catalog.btrim(p_summary),
    nullif(pg_catalog.btrim(p_details), ''),
    case when v_sensitive then 'urgent' when p_reason_code in ('threat_or_harassment','doxxing','malware') then 'high' else 'normal' end,
    v_sensitive
  ) returning * into v_report;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    p_actor_user_id, case when p_actor_user_id is null then 'system' else 'user' end,
    'artisan_report_submitted', 'artisan_report', v_report.id,
    p_client_request_id,
    pg_catalog.jsonb_build_object('targetType', p_target_type, 'reasonCode', p_reason_code, 'childSafetySensitive', v_sensitive)
  );
  return pg_catalog.jsonb_build_object('reportId', v_report.id, 'status', v_report.status, 'priority', v_report.priority);
end;
$$;

alter function public.artisan_create_report(uuid, uuid, text, text, uuid, text, text, text, boolean) owner to postgres;
revoke all privileges on function public.artisan_create_report(uuid, uuid, text, text, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_report(uuid, uuid, text, text, uuid, text, text, text, boolean) to service_role;

-- Bounded public projections. These functions intentionally return no email,
-- age, internal role, report, moderation-note, original-object, or private
-- profile fields. Every projection independently checks the hosted-read gate.
create or replace function public.artisan_public_feed(
  p_kind text,
  p_query text,
  p_limit integer,
  p_cursor timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb := '[]'::jsonb;
  v_next_cursor timestamptz;
begin
  if p_kind not in ('forum','artwork')
     or (p_query is not null and pg_catalog.char_length(p_query) not between 1 and 100) then
    raise exception using errcode = '22023', message = 'artisan_public_feed_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object('items', v_items, 'nextCursor', null, 'enabled', false);
  end if;
  if p_kind = 'forum' then
    with selected as (
      select post.*, card.handle, card.display_name, card.avatar_url, card.canonical_profile_url
      from artisan.forum_posts as post
      join private.community_safe_public_profile_cards as card
        on card.user_id = post.owner_user_id
      where post.status = 'published' and post.moderation_status = 'approved'
        and (p_cursor is null or post.published_at < p_cursor)
        and (p_query is null or post.title ilike '%' || p_query || '%'
          or coalesce(post.artist_statement, '') ilike '%' || p_query || '%')
      order by post.published_at desc, post.id desc
      limit v_limit
    )
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'kind', 'forum', 'postId', selected.id, 'slug', selected.slug,
        'title', selected.title, 'artistStatement', selected.artist_statement,
        'theme', selected.theme, 'commentsEnabled', selected.comments_enabled,
        'appreciationsEnabled', selected.appreciations_enabled,
        'publishedAt', selected.published_at,
        'artist', pg_catalog.jsonb_build_object(
          'handle', selected.handle, 'displayName', selected.display_name,
          'avatarUrl', selected.avatar_url, 'profileUrl', selected.canonical_profile_url
        )
      ) order by selected.published_at desc, selected.id desc
    ), '[]'::jsonb), pg_catalog.min(selected.published_at)
    into v_items, v_next_cursor from selected;
  else
    with selected as (
      select artwork.*, card.handle, card.display_name, card.avatar_url, card.canonical_profile_url,
        (select media.id from artisan.media_assets as media
         where media.artwork_id = artwork.id and media.processing_status = 'published'
           and media.moderation_status = 'approved'
         order by media.published_at, media.id limit 1) as preview_media_id
      from artisan.artworks as artwork
      join private.community_safe_public_profile_cards as card
        on card.user_id = artwork.owner_user_id
      where artwork.status = 'published' and artwork.moderation_status = 'approved'
        and (p_cursor is null or artwork.published_at < p_cursor)
        and (p_query is null or artwork.title ilike '%' || p_query || '%'
          or coalesce(artwork.description, '') ilike '%' || p_query || '%')
      order by artwork.published_at desc, artwork.id desc
      limit v_limit
    )
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'kind', 'artwork', 'artworkId', selected.id, 'slug', selected.slug,
        'title', selected.title, 'description', selected.description,
        'creationMethod', selected.creation_method, 'creditLine', selected.credit_line,
        'licenseCode', selected.license_code, 'altText', selected.alt_text,
        'contentWarnings', selected.content_warnings, 'previewMediaId', selected.preview_media_id,
        'publishedAt', selected.published_at,
        'artist', pg_catalog.jsonb_build_object(
          'handle', selected.handle, 'displayName', selected.display_name,
          'avatarUrl', selected.avatar_url, 'profileUrl', selected.canonical_profile_url
        )
      ) order by selected.published_at desc, selected.id desc
    ), '[]'::jsonb), pg_catalog.min(selected.published_at)
    into v_items, v_next_cursor from selected;
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextCursor', case when pg_catalog.jsonb_array_length(v_items) = v_limit then v_next_cursor else null end,
    'enabled', true
  );
end;
$$;

alter function public.artisan_public_feed(text, text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_public_feed(text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_feed(text, text, integer, timestamptz) to anon, authenticated, service_role;

create or replace function public.artisan_public_artwork(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'artworkId', artwork.id, 'slug', artwork.slug, 'title', artwork.title,
      'description', artwork.description, 'artistStatement', artwork.artist_statement,
      'creationMethod', artwork.creation_method,
      'humanContributionNote', artwork.human_contribution_note,
      'creditLine', artwork.credit_line, 'licenseCode', artwork.license_code,
      'downloadAllowed', artwork.download_allowed, 'altText', artwork.alt_text,
      'contentWarnings', artwork.content_warnings, 'tags', artwork.tags,
      'publishedAt', artwork.published_at,
      'artist', pg_catalog.jsonb_build_object(
        'handle', card.handle, 'displayName', card.display_name,
        'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
      ),
      'credits', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'creditedName', credit.credited_name,
          'creditedHandle', collaborator.handle,
          'profileUrl', collaborator.canonical_profile_url,
          'role', credit.role,
          'displayOrder', credit.display_order, 'confirmationStatus', credit.confirmation_status
        ) order by credit.display_order, credit.id)
        from artisan.artwork_credits as credit
        left join private.community_safe_public_profile_cards as collaborator
          on collaborator.user_id = credit.credited_user_id
         and credit.confirmation_status = 'confirmed'
        where credit.artwork_id = artwork.id
          and credit.confirmation_status in ('not_required','confirmed')
      ), '[]'::jsonb),
      'license', (
        select pg_catalog.jsonb_build_object(
          'licenseCode', license.license_code, 'documentKey', license.document_key,
          'documentVersion', license.document_version,
          'contentSha256', license.content_sha256, 'scope', license.scope,
          'acceptedAt', license.accepted_at
        ) from artisan.artwork_licenses as license
        where license.artwork_id = artwork.id and license.terminated_at is null
        order by license.accepted_at desc limit 1
      ),
      'media', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'mediaAssetId', media.id, 'adapterKey', media.adapter_key,
          'presentationMime', media.approved_mime,
          'mediaPath', '/api/public/media/' || media.id::text,
          'posterPath', '/api/public/media/' || media.id::text || '/poster',
          'captions', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'path', '/api/public/media/' || caption.media_asset_id::text || '/captions/' || caption.id::text,
              'language', caption.language,
              'kind', caption.kind,
              'label', caption.label
            ) order by caption.language, caption.id)
            from artisan.media_caption_tracks as caption
            where caption.media_asset_id = media.id and caption.status = 'ready'
          ), '[]'::jsonb),
          'title', artwork.title,
          'altText', media.accessibility_description,
          'accessibilityDescription', media.accessibility_description,
          'transcript', media.transcript,
          'audioDescription', media.audio_description,
          'keyboardInstructions', media.keyboard_instructions,
          'staticEquivalent', media.static_equivalent_description,
          'spokenContent', media.spoken_content,
          'creatorDeclaresFlashRisk', media.creator_declared_flash_risk,
          'flashWarning', media.flash_warning,
          'loudAudioWarning', media.loud_audio_warning,
          'autoplay', false, 'sanitizedDerivative', true,
          'status', 'ready'
        ) order by media.created_at, media.id)
        from artisan.media_assets as media
        where media.artwork_id = artwork.id and media.processing_status = 'published'
          and media.moderation_status = 'approved'
      ), '[]'::jsonb)
    )
    from artisan.artworks as artwork
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    where artwork.slug = pg_catalog.lower(p_slug)
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_artwork(text) owner to postgres;
revoke all privileges on function public.artisan_public_artwork(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_artwork(text) to anon, authenticated, service_role;

create or replace function public.artisan_public_post(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'postId', post.id, 'slug', post.slug, 'title', post.title,
      'artistStatement', post.artist_statement, 'theme', post.theme,
      'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds, 'publishedAt', post.published_at,
      'artist', pg_catalog.jsonb_build_object(
        'handle', card.handle, 'displayName', card.display_name,
        'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
      ),
      'artworks', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'artworkId', artwork.id, 'slug', artwork.slug, 'title', artwork.title,
          'creditLine', artwork.credit_line, 'creationMethod', artwork.creation_method,
          'licenseCode', artwork.license_code, 'altText', artwork.alt_text,
          'displayOrder', link.display_order
        ) order by link.display_order, artwork.id)
        from artisan.post_artworks as link
        join artisan.artworks as artwork on artwork.id = link.artwork_id
        where link.post_id = post.id and artwork.status = 'published'
          and artwork.moderation_status = 'approved'
      ), '[]'::jsonb),
      'comments', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'commentId', comment.id, 'parentCommentId', comment.parent_comment_id,
          'depth', comment.depth, 'body', comment.body, 'status', comment.status,
          'createdAt', comment.created_at, 'editedAt', comment.edited_at,
          'author', pg_catalog.jsonb_build_object(
            'handle', commenter.handle, 'displayName', commenter.display_name,
            'avatarUrl', commenter.avatar_url, 'profileUrl', commenter.canonical_profile_url
          )
        ) order by comment.created_at, comment.id)
        from artisan.comments as comment
        join private.community_safe_public_profile_cards as commenter
          on commenter.user_id = comment.user_id
        where comment.post_id = post.id and comment.status in ('published','edited')
          and comment.moderation_status = 'approved'
      ), '[]'::jsonb)
    )
    from artisan.forum_posts as post
    join private.community_safe_public_profile_cards as card
      on card.user_id = post.owner_user_id
    where post.slug = pg_catalog.lower(p_slug)
      and post.status = 'published' and post.moderation_status = 'approved'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_post(text) owner to postgres;
revoke all privileges on function public.artisan_public_post(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_post(text) to anon, authenticated, service_role;

create or replace function public.artisan_public_challenges(
  p_limit integer,
  p_cursor timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected as (
    select challenge.* from artisan.challenges as challenge
    where private.community_feature_enabled('artisan_public_database_reads')
      and challenge.published_at is not null and challenge.status not in ('draft','cancelled')
      and challenge.visibility = 'public'
      and (p_cursor is null or challenge.published_at < p_cursor)
    order by challenge.published_at desc, challenge.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'challengeId', selected.id, 'slug', selected.slug, 'title', selected.title,
      'shortPrompt', selected.short_prompt, 'purpose', selected.purpose,
      'sponsorName', selected.sponsor_name,
      'licenseSummary', selected.license_summary,
      'visibility', selected.visibility,
      'status', selected.status, 'opensAt', selected.opens_at,
      'deadlineAt', selected.deadline_at, 'timezone', selected.timezone,
      'maximumEntriesPerArtist', selected.maximum_entries_per_artist,
      'selectionMethod', selected.selection_method,
      'judgingRubricVersion', selected.judging_rubric_version,
      'creationMethodPolicy', selected.creation_method_policy,
      'publishedAt', selected.published_at
    ) order by selected.published_at desc, selected.id desc), '[]'::jsonb),
    'nextCursor', case when pg_catalog.count(*) = least(greatest(coalesce(p_limit, 20), 1), 50)
      then pg_catalog.min(selected.published_at) else null end,
    'enabled', private.community_feature_enabled('artisan_public_database_reads')
  ) from selected;
$$;

alter function public.artisan_public_challenges(integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_public_challenges(integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_challenges(integer, timestamptz) to anon, authenticated, service_role;

create or replace function public.artisan_public_challenge(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'challengeId', challenge.id, 'slug', challenge.slug, 'title', challenge.title,
      'shortPrompt', challenge.short_prompt, 'fullBrief', challenge.full_brief,
      'purpose', challenge.purpose, 'sponsorName', challenge.sponsor_name,
      'licenseSummary', challenge.license_summary,
      'conflictOfInterestRules', challenge.conflict_of_interest_rules,
      'visibility', challenge.visibility,
      'cancellationTerms', challenge.cancellation_terms,
      'status', challenge.status, 'opensAt', challenge.opens_at,
      'deadlineAt', challenge.deadline_at, 'timezone', challenge.timezone,
      'maximumEntriesPerArtist', challenge.maximum_entries_per_artist,
      'selectionMethod', challenge.selection_method, 'blindReview', challenge.blind_review,
      'judgingRubricVersion', challenge.judging_rubric_version,
      'judgingRubric', challenge.judging_rubric,
      'creationMethodPolicy', challenge.creation_method_policy,
      'eligibilityPolicy', challenge.eligibility_policy,
      'rulesDocumentVersion', challenge.rules_document_version,
      'rulesContentSha256', challenge.rules_content_sha256,
      'mediaRules', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'adapterKey', rule.adapter_key, 'maximumFiles', rule.maximum_files,
          'maximumBytes', rule.maximum_bytes, 'maximumWidth', rule.maximum_width,
          'maximumHeight', rule.maximum_height,
          'maximumDurationSeconds', rule.maximum_duration_seconds,
          'requiredAltText', rule.required_alt_text,
          'requiredCreationMethodDisclosure', rule.required_creation_method_disclosure
        ) order by rule.adapter_key)
        from artisan.challenge_media_rules as rule where rule.challenge_id = challenge.id
      ), '[]'::jsonb)
    ) from artisan.challenges as challenge
    where challenge.slug = pg_catalog.lower(p_slug)
      and challenge.published_at is not null and challenge.status not in ('draft','cancelled')
      and challenge.visibility in ('public','unlisted')
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_challenge(text) owner to postgres;
revoke all privileges on function public.artisan_public_challenge(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_challenge(text) to anon, authenticated, service_role;

-- Private-beta invitations are not public content. The same-origin Worker may
-- request one exact challenge only for an active member whose shared
-- participation state permits challenge entry; the response matches the
-- public challenge-detail contract and contains no membership or identity row.
create or replace function public.artisan_member_challenge(
  p_actor_user_id uuid,
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role()
    and private.community_feature_enabled('artisan_public_database_reads')
    and private.artisan_active_member(p_actor_user_id)
    and private.community_can_participate(p_actor_user_id, 'artisan_submit_challenge')
  then coalesce((
    select pg_catalog.jsonb_build_object(
      'challengeId', challenge.id, 'slug', challenge.slug, 'title', challenge.title,
      'shortPrompt', challenge.short_prompt, 'fullBrief', challenge.full_brief,
      'purpose', challenge.purpose, 'sponsorName', challenge.sponsor_name,
      'licenseSummary', challenge.license_summary,
      'conflictOfInterestRules', challenge.conflict_of_interest_rules,
      'visibility', challenge.visibility,
      'cancellationTerms', challenge.cancellation_terms,
      'status', challenge.status, 'opensAt', challenge.opens_at,
      'deadlineAt', challenge.deadline_at, 'timezone', challenge.timezone,
      'maximumEntriesPerArtist', challenge.maximum_entries_per_artist,
      'selectionMethod', challenge.selection_method, 'blindReview', challenge.blind_review,
      'judgingRubricVersion', challenge.judging_rubric_version,
      'judgingRubric', challenge.judging_rubric,
      'creationMethodPolicy', challenge.creation_method_policy,
      'eligibilityPolicy', challenge.eligibility_policy,
      'rulesDocumentVersion', challenge.rules_document_version,
      'rulesContentSha256', challenge.rules_content_sha256,
      'mediaRules', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'adapterKey', rule.adapter_key, 'maximumFiles', rule.maximum_files,
          'maximumBytes', rule.maximum_bytes, 'maximumWidth', rule.maximum_width,
          'maximumHeight', rule.maximum_height,
          'maximumDurationSeconds', rule.maximum_duration_seconds,
          'requiredAltText', rule.required_alt_text,
          'requiredCreationMethodDisclosure', rule.required_creation_method_disclosure
        ) order by rule.adapter_key)
        from artisan.challenge_media_rules as rule
        where rule.challenge_id = challenge.id
      ), '[]'::jsonb)
    )
    from artisan.challenges as challenge
    where challenge.slug = pg_catalog.lower(p_slug)
      and challenge.published_at is not null
      and challenge.status not in ('draft','cancelled')
      and challenge.visibility in ('public','unlisted','private_beta')
      and exists (
        select 1 from private.account_participation as participation
        where participation.user_id = p_actor_user_id
          and case when challenge.eligibility_policy = '{}'::jsonb
            then participation.participation_state = 'adult_eligible'
            else pg_catalog.jsonb_exists(
              challenge.eligibility_policy -> 'allowedParticipationStates',
              participation.participation_state
            ) end
      )
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_member_challenge(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_member_challenge(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_challenge(uuid, text) to service_role;

create or replace function public.artisan_public_gallery(
  p_kind text,
  p_limit integer,
  p_cursor timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
  v_next_cursor timestamptz;
begin
  if p_kind not in ('winner','all_entries','featured') then
    raise exception using errcode = '22023', message = 'artisan_gallery_kind_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'enabled', false);
  end if;
  with selected as (
    select gallery.*, artwork.slug, artwork.title, artwork.status as artwork_status,
      artwork.moderation_status as artwork_moderation_status,
      card.handle, card.display_name, card.avatar_url, card.canonical_profile_url,
      (select media.id from artisan.media_assets as media
       where media.artwork_id = artwork.id and media.processing_status = 'published'
         and media.moderation_status = 'approved'
       order by media.published_at, media.id limit 1) as preview_media_id
    from artisan.gallery_entries as gallery
    join artisan.artworks as artwork on artwork.id = gallery.artwork_id
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    where gallery.gallery_kind = p_kind and gallery.status = 'published'
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
      and (gallery.award_id is null or exists (
        select 1 from artisan.challenge_awards as award
        where award.id = gallery.award_id and award.status = 'published'
      ))
      and (p_cursor is null or gallery.published_at < p_cursor)
    order by gallery.published_at desc, gallery.id desc
    limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'galleryEntryId', selected.id, 'galleryKind', selected.gallery_kind,
    'artworkId', selected.artwork_id, 'artworkSlug', selected.slug,
    'title', selected.title, 'creditLine', selected.frozen_credit_line,
    'profileUrl', selected.canonical_profile_url,
    'creationMethod', selected.frozen_creation_method,
    'licenseCode', selected.frozen_license_code,
    'accessibleDescription', selected.accessible_description,
    'previewMediaId', selected.preview_media_id,
    'artist', pg_catalog.jsonb_build_object(
      'handle', selected.handle, 'displayName', selected.display_name,
      'avatarUrl', selected.avatar_url
    ),
    'publishedAt', selected.published_at
  ) order by selected.published_at desc, selected.id desc), '[]'::jsonb),
  pg_catalog.min(selected.published_at)
  into v_items, v_next_cursor from selected;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextCursor', case when pg_catalog.jsonb_array_length(v_items) = v_limit then v_next_cursor else null end,
    'enabled', true
  );
end;
$$;

alter function public.artisan_public_gallery(text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_public_gallery(text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_gallery(text, integer, timestamptz) to anon, authenticated, service_role;

-- The media key projection is service-only because even private-bucket object
-- names are implementation details. The same-origin Worker performs delivery.
revoke execute on function public.artisan_public_media_asset(uuid) from anon, authenticated;

create or replace function private.artisan_assume_verified_actor(p_actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_actor_user_id, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
end;
$$;

alter function private.artisan_assume_verified_actor(uuid) owner to postgres;
revoke all privileges on function private.artisan_assume_verified_actor(uuid)
  from public, anon, authenticated, service_role;

-- Exact service-role aliases consumed by the Artisan API Worker. Actor identity
-- is verified by the Worker and re-established transaction-locally before the
-- browser-safe self RPC runs; no frontend-only authorization is trusted.
create or replace function public.artisan_bootstrap_membership(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_invitation_code_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation artisan.invitations%rowtype;
  v_membership artisan.memberships%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_can_participate(p_actor_user_id, 'artisan_membership')
     or coalesce(p_invitation_code_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'artisan_invitation_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_membership_bootstrapped',
    pg_catalog.jsonb_build_object('invitationCodeSha256', p_invitation_code_sha256)
  );
  if v_replay is not null then return v_replay; end if;
  if not exists (
    select 1 from public.profile_public_cards as card
    where card.user_id = p_actor_user_id and card.public_profile_enabled
      and private.community_profile_is_public(card.user_id)
  ) then
    raise exception using errcode = '55000', message = 'artisan_public_profile_required';
  end if;
  select * into strict v_invitation from artisan.invitations
  where invitation_code_sha256 = p_invitation_code_sha256
    and status = 'issued' and expires_at > pg_catalog.now()
    and use_count < maximum_uses
    and (invited_user_id is null or invited_user_id = p_actor_user_id)
  for update;
  insert into artisan.memberships(user_id, invitation_id)
  values (p_actor_user_id, v_invitation.id)
  on conflict (user_id) do update
  set status = case when artisan.memberships.status = 'closed' then 'closed' else 'active' end,
      updated_at = pg_catalog.now()
  returning * into v_membership;
  update artisan.invitations set use_count = use_count + 1,
    status = case when use_count + 1 >= maximum_uses then 'consumed' else status end
  where id = v_invitation.id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_membership_created', 'artisan_membership',
    p_actor_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('invitationId', v_invitation.id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'status', v_membership.status, 'joinedAt', v_membership.joined_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_bootstrap_membership(uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_bootstrap_membership(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_bootstrap_membership(uuid, uuid, text) to service_role;

create or replace function public.artisan_create_artwork(
  p_actor_user_id uuid, p_client_request_id uuid, p_slug text, p_title text,
  p_description text, p_artist_statement text, p_creation_method text,
  p_human_contribution_note text, p_credit_line text,
  p_credited_name_or_pseudonym text, p_preferred_profile_url text,
  p_license_code text, p_download_allowed boolean, p_alt_text text,
  p_content_warnings text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb; v_canonical_url text;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select canonical_profile_url into v_canonical_url from public.profile_public_cards
  where user_id = p_actor_user_id and public_profile_enabled;
  if v_canonical_url is null
     or (p_preferred_profile_url is not null and p_preferred_profile_url <> v_canonical_url) then
    raise exception using errcode = '22023', message = 'artisan_profile_url_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_artwork_created',
    pg_catalog.jsonb_build_object(
      'slug', p_slug, 'title', p_title, 'description', p_description,
      'artistStatement', p_artist_statement, 'creationMethod', p_creation_method,
      'humanContributionNote', p_human_contribution_note, 'creditLine', p_credit_line,
      'creditedName', p_credited_name_or_pseudonym, 'profileUrl', v_canonical_url,
      'licenseCode', p_license_code, 'downloadAllowed', p_download_allowed,
      'altText', p_alt_text, 'contentWarnings', coalesce(p_content_warnings, '{}'::text[])
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.create_current_user_artwork(
    p_client_request_id, p_slug, p_title, p_description, p_artist_statement,
    p_creation_method, p_human_contribution_note, p_credit_line,
    p_credited_name_or_pseudonym, p_license_code, p_download_allowed,
    p_alt_text, p_content_warnings
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_create_artwork(uuid, uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, text[]) owner to postgres;
revoke all privileges on function public.artisan_create_artwork(uuid, uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_artwork(uuid, uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, text[]) to service_role;

create or replace function public.artisan_create_forum_post(
  p_actor_user_id uuid, p_client_request_id uuid, p_slug text, p_title text,
  p_artist_statement text, p_theme jsonb, p_comments_enabled boolean,
  p_appreciations_enabled boolean, p_slow_mode_seconds integer,
  p_artwork_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_forum_post_created',
    pg_catalog.jsonb_build_object(
      'slug', p_slug, 'title', p_title, 'artistStatement', p_artist_statement,
      'theme', p_theme, 'commentsEnabled', p_comments_enabled,
      'appreciationsEnabled', p_appreciations_enabled,
      'slowModeSeconds', p_slow_mode_seconds,
      'artworkIds', coalesce(p_artwork_ids, '{}'::uuid[])
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.create_current_user_artisan_post(
    p_client_request_id, p_slug, p_title, p_artist_statement, p_theme,
    p_comments_enabled, p_appreciations_enabled, p_slow_mode_seconds, p_artwork_ids
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_create_forum_post(uuid, uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[]) owner to postgres;
revoke all privileges on function public.artisan_create_forum_post(uuid, uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_forum_post(uuid, uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[]) to service_role;

create or replace function public.artisan_submit_forum_post(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_forum_post_submitted',
    pg_catalog.jsonb_build_object('postId', p_post_id)
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.submit_current_user_artisan_post(
    p_post_id, p_client_request_id
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_submit_forum_post(uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_submit_forum_post(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_submit_forum_post(uuid, uuid, uuid) to service_role;

create or replace function public.artisan_create_comment(
  p_actor_user_id uuid, p_client_request_id uuid, p_post_id uuid,
  p_parent_comment_id uuid, p_body text, p_mentioned_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_response jsonb;
  v_mentions uuid[];
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select coalesce(pg_catalog.array_agg(distinct mentioned_user_id order by mentioned_user_id), '{}'::uuid[])
  into v_mentions
  from pg_catalog.unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as mentioned_user_id;
  if pg_catalog.cardinality(v_mentions) <> pg_catalog.cardinality(coalesce(p_mentioned_user_ids, '{}'::uuid[])) then
    raise exception using errcode = '22023', message = 'artisan_comment_mentions_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_comment_created',
    pg_catalog.jsonb_build_object(
      'postId', p_post_id, 'parentCommentId', p_parent_comment_id,
      'body', pg_catalog.btrim(p_body), 'mentionedUserIds', v_mentions
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.create_current_user_artisan_comment(
    p_client_request_id, p_post_id, p_parent_comment_id, p_body, v_mentions
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_create_comment(uuid, uuid, uuid, uuid, text, uuid[]) owner to postgres;
revoke all privileges on function public.artisan_create_comment(uuid, uuid, uuid, uuid, text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_comment(uuid, uuid, uuid, uuid, text, uuid[]) to service_role;

create or replace function public.artisan_create_comment_by_handles(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_post_id uuid,
  p_parent_comment_id uuid,
  p_body text,
  p_mentioned_handles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentions uuid[];
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_mentions := private.artisan_resolve_mention_handles(
    p_actor_user_id, p_mentioned_handles
  );
  return public.artisan_create_comment(
    p_actor_user_id, p_client_request_id, p_post_id,
    p_parent_comment_id, p_body, v_mentions
  );
end;
$$;

alter function public.artisan_create_comment_by_handles(uuid, uuid, uuid, uuid, text, text[]) owner to postgres;
revoke all privileges on function public.artisan_create_comment_by_handles(uuid, uuid, uuid, uuid, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_comment_by_handles(uuid, uuid, uuid, uuid, text, text[]) to service_role;

create or replace function public.artisan_set_appreciation(
  p_actor_user_id uuid, p_client_request_id uuid, p_target_type text,
  p_target_id uuid, p_appreciated boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_appreciation_set',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id, 'appreciated', p_appreciated
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.set_current_user_artisan_appreciation(
    p_client_request_id, p_target_type, p_target_id, p_appreciated
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_set_appreciation(uuid, uuid, text, uuid, boolean) owner to postgres;
revoke all privileges on function public.artisan_set_appreciation(uuid, uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_set_appreciation(uuid, uuid, text, uuid, boolean) to service_role;

-- Remaining challenge, moderation, lifecycle, and staff RPCs continue below.

create or replace function public.set_current_user_artisan_block(
  p_client_request_id uuid,
  p_target_user_id uuid,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or not private.community_account_is_recoverable(v_user_id)
     or p_target_user_id is null or p_target_user_id = v_user_id
     or not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception using errcode = '42501', message = 'artisan_block_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_user_block_set',
    pg_catalog.jsonb_build_object('targetUserId', p_target_user_id, 'blocked', p_blocked)
  );
  if v_replay is not null then return v_replay; end if;
  if p_blocked then
    insert into artisan.user_blocks(blocker_user_id, blocked_user_id)
    values (v_user_id, p_target_user_id)
    on conflict (blocker_user_id, blocked_user_id) do nothing;
    delete from artisan.appreciations as appreciation
    where (appreciation.user_id = v_user_id
      and private.artisan_target_owner(appreciation.target_type, appreciation.target_id) = p_target_user_id)
       or (appreciation.user_id = p_target_user_id
      and private.artisan_target_owner(appreciation.target_type, appreciation.target_id) = v_user_id);
    delete from artisan.comment_mentions as mention
    using artisan.comments as comment
    where comment.id = mention.comment_id
      and ((comment.user_id = v_user_id and mention.mentioned_user_id = p_target_user_id)
        or (comment.user_id = p_target_user_id and mention.mentioned_user_id = v_user_id));
  else
    delete from artisan.user_blocks
    where blocker_user_id = v_user_id and blocked_user_id = p_target_user_id;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    v_user_id, 'user', case when p_blocked then 'artisan_user_blocked' else 'artisan_user_unblocked' end,
    'artisan_user', p_target_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('blocked', p_blocked)
  );
  v_response := pg_catalog.jsonb_build_object('targetUserId', p_target_user_id, 'blocked', p_blocked);
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.set_current_user_artisan_block(uuid, uuid, boolean) owner to postgres;
revoke all privileges on function public.set_current_user_artisan_block(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
-- UUID target mutation remains an internal implementation detail. Public
-- browser traffic uses the service-only handle resolver below.

create or replace function public.artisan_set_block(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_target_user_id uuid,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.set_current_user_artisan_block(
    p_client_request_id, p_target_user_id, p_blocked
  );
end;
$$;

alter function public.artisan_set_block(uuid, uuid, uuid, boolean) owner to postgres;
revoke all privileges on function public.artisan_set_block(uuid, uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_set_block(uuid, uuid, uuid, boolean) to service_role;

-- Public Artisan surfaces intentionally do not expose profile UUIDs. Resolve a
-- current public handle inside the trusted boundary, then reuse the audited,
-- idempotent UUID mutation without returning that UUID to the browser.
create or replace function public.artisan_set_block_by_handle(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_target_handle text,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := pg_catalog.lower(case
    when pg_catalog.left(coalesce(p_target_handle, ''), 1) = '@'
      then pg_catalog.substr(p_target_handle, 2)
    else coalesce(p_target_handle, '')
  end);
  v_target_user_id uuid;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  if pg_catalog.char_length(v_handle) not between 2 and 80
     or v_handle !~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$' then
    raise exception using errcode = '22023', message = 'artisan_block_handle_invalid';
  end if;
  if p_blocked then
    select card.user_id into v_target_user_id
    from private.community_safe_public_profile_cards as card
    where card.handle = v_handle
    limit 1;
  else
    select card.user_id into v_target_user_id
    from public.profile_public_cards as card
    where card.handle = v_handle
      and exists (
        select 1 from artisan.user_blocks as block
        where block.blocker_user_id = p_actor_user_id
          and block.blocked_user_id = card.user_id
      )
    limit 1;
  end if;
  if v_target_user_id is null or v_target_user_id = p_actor_user_id then
    raise exception using errcode = '42501', message = 'artisan_block_target_unavailable';
  end if;
  perform public.artisan_set_block(
    p_actor_user_id, p_client_request_id, v_target_user_id, p_blocked
  );
  return pg_catalog.jsonb_build_object(
    'targetHandle', v_handle,
    'blocked', p_blocked
  );
end;
$$;

alter function public.artisan_set_block_by_handle(uuid, uuid, text, boolean) owner to postgres;
revoke all privileges on function public.artisan_set_block_by_handle(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_set_block_by_handle(uuid, uuid, text, boolean) to service_role;

create or replace function public.artisan_submit_challenge_entry(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_artwork_id uuid,
  p_rules_client_request_id uuid,
  p_rules_document_version text,
  p_rules_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_created jsonb; v_response jsonb; v_submission_id uuid;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_challenge_entry_submitted',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'artworkId', p_artwork_id,
      'rulesClientRequestId', p_rules_client_request_id,
      'rulesDocumentVersion', p_rules_document_version,
      'rulesContentSha256', p_rules_content_sha256
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_created := public.create_current_user_challenge_submission(
    p_client_request_id, p_challenge_id, p_artwork_id,
    p_rules_client_request_id, p_rules_document_version, p_rules_content_sha256
  );
  v_submission_id := (v_created ->> 'submissionId')::uuid;
  v_response := public.submit_current_user_challenge_submission(
    v_submission_id, p_client_request_id
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_submit_challenge_entry(uuid, uuid, uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_submit_challenge_entry(uuid, uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_submit_challenge_entry(uuid, uuid, uuid, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_create_appeal(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_case_id uuid,
  p_restriction_id uuid,
  p_moderation_action_id uuid,
  p_statement text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_appeal_created',
    pg_catalog.jsonb_build_object(
      'caseId', p_case_id, 'restrictionId', p_restriction_id,
      'moderationActionId', p_moderation_action_id,
      'statement', pg_catalog.btrim(p_statement)
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.submit_current_user_artisan_appeal(
    p_client_request_id, p_case_id, p_restriction_id,
    p_moderation_action_id, p_statement
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_create_appeal(uuid, uuid, uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_create_appeal(uuid, uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_appeal(uuid, uuid, uuid, uuid, uuid, text) to service_role;

create or replace function public.artisan_staff_bootstrap(
  p_actor_user_id uuid,
  p_actor_aal text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_staff_aal2_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(assignment.capability order by assignment.capability)
      from private.community_capability_assignments as assignment
      join private.community_capability_catalog as catalog on catalog.capability = assignment.capability
      where assignment.user_id = p_actor_user_id and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
        and catalog.active and assignment.capability like 'artisan\_%' escape '\'
    ), '[]'::jsonb),
    'queues', pg_catalog.jsonb_build_object(
      'pendingMedia', (select pg_catalog.count(*) from artisan.media_assets where processing_status = 'pending_review'),
      'pendingPosts', (select pg_catalog.count(*) from artisan.forum_posts where status = 'pending_review'),
      'pendingSubmissions', (select pg_catalog.count(*) from artisan.challenge_submissions where status = 'pending_review'),
      'openReports', (select pg_catalog.count(*) from artisan.reports where status in ('submitted','triaged','case_opened','escalated')),
      'openAppeals', (select pg_catalog.count(*) from artisan.appeals where status in ('submitted','under_review','more_information'))
    ),
    'featureFlags', public.current_artisan_feature_manifest()
  );
end;
$$;

alter function public.artisan_staff_bootstrap(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_staff_bootstrap(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_bootstrap(uuid, text) to service_role;

create or replace function public.artisan_staff_review_content(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_decision text,
  p_private_reason text,
  p_public_notice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capability text;
  v_owner_user_id uuid;
  v_status text;
  v_moderation_status text;
  v_replay jsonb;
  v_response jsonb;
begin
  v_capability := case p_target_type
    when 'artwork' then 'artisan_media_review'
    when 'post' then 'artisan_forum_moderate'
    when 'comment' then 'artisan_forum_moderate'
    when 'submission' then 'artisan_submissions_review'
    else null
  end;
  if v_capability is null or p_decision not in ('approve','changes_requested','reject')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000
     or pg_catalog.char_length(coalesce(p_public_notice, '')) > 2000 then
    raise exception using errcode = '22023', message = 'artisan_content_review_invalid';
  end if;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_content_reviewed',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id,
      'decision', p_decision, 'privateReason', pg_catalog.btrim(p_private_reason),
      'publicNotice', nullif(pg_catalog.btrim(p_public_notice), '')
    )
  );
  if v_replay is not null then return v_replay; end if;

  if p_target_type = 'artwork' then
    select owner_user_id into strict v_owner_user_id from artisan.artworks
    where id = p_target_id and status = 'pending_review' and moderation_status = 'pending'
    for update;
    if p_decision = 'approve' and (
      not exists (select 1 from artisan.artwork_credits where artwork_id = p_target_id)
      or not exists (select 1 from artisan.artwork_licenses where artwork_id = p_target_id and terminated_at is null)
      or not exists (
        select 1 from artisan.media_assets where artwork_id = p_target_id
          and processing_status = 'approved' and moderation_status = 'approved'
          and metadata_stripped
          and approved_object_key is not null and approved_checksum_sha256 is not null and approved_mime is not null
          and thumbnail_object_key is not null and thumbnail_checksum_sha256 is not null and thumbnail_mime is not null
      )
      or not exists (
        select 1 from public.profile_public_cards as card
        join artisan.artworks as artwork on artwork.owner_user_id = card.user_id
        where artwork.id = p_target_id and card.public_profile_enabled
          and private.community_profile_is_public(card.user_id)
          and pg_catalog.char_length(artwork.alt_text) > 0
          and artwork.creation_method <> 'undisclosed_legacy'
      )
    ) then
      raise exception using errcode = '55000', message = 'artisan_artwork_review_prerequisites_missing';
    end if;
    update artisan.artworks set
      status = case p_decision when 'approve' then 'approved' when 'changes_requested' then 'changes_requested' else 'removed' end,
      moderation_status = case p_decision when 'approve' then 'approved' when 'changes_requested' then 'changes_requested' else 'rejected' end,
      updated_at = pg_catalog.now(), removed_at = case when p_decision = 'reject' then pg_catalog.now() else removed_at end
    where id = p_target_id
    returning status, moderation_status into v_status, v_moderation_status;
  elsif p_target_type = 'post' then
    select owner_user_id into strict v_owner_user_id from artisan.forum_posts
    where id = p_target_id and status = 'pending_review' and moderation_status = 'pending'
    for update;
    if p_decision = 'approve' and (
      not exists (select 1 from artisan.post_artworks where post_id = p_target_id)
      or exists (
        select 1 from artisan.post_artworks as link
        join artisan.artworks as artwork on artwork.id = link.artwork_id
        where link.post_id = p_target_id and artwork.status not in ('approved','published')
      )
    ) then
      raise exception using errcode = '55000', message = 'artisan_post_review_prerequisites_missing';
    end if;
    update artisan.forum_posts set
      status = case p_decision when 'approve' then 'approved' when 'changes_requested' then 'changes_requested' else 'removed' end,
      moderation_status = case p_decision when 'approve' then 'approved' when 'changes_requested' then 'changes_requested' else 'rejected' end,
      updated_at = pg_catalog.now(), removed_at = case when p_decision = 'reject' then pg_catalog.now() else removed_at end
    where id = p_target_id
    returning status, moderation_status into v_status, v_moderation_status;
  elsif p_target_type = 'comment' then
    select user_id into strict v_owner_user_id from artisan.comments
    where id = p_target_id and status = 'pending_review' and moderation_status = 'pending'
    for update;
    if p_decision = 'approve' and not exists (
      select 1 from artisan.comments as comment
      join artisan.forum_posts as post on post.id = comment.post_id
      join public.profile_public_cards as card on card.user_id = comment.user_id and card.public_profile_enabled
      where comment.id = p_target_id and post.status = 'published'
        and private.community_profile_is_public(card.user_id)
        and post.moderation_status = 'approved' and post.comments_enabled
    ) then
      raise exception using errcode = '55000', message = 'artisan_comment_review_prerequisites_missing';
    end if;
    update artisan.comments set
      status = case p_decision when 'approve' then case when edited_at is null then 'published' else 'edited' end
        when 'changes_requested' then 'rejected' else 'rejected' end,
      moderation_status = case p_decision when 'approve' then 'approved' else 'rejected' end,
      published_at = case when p_decision = 'approve' then pg_catalog.now() else null end,
      removed_at = case when p_decision = 'reject' then pg_catalog.now() else removed_at end
    where id = p_target_id
    returning status, moderation_status into v_status, v_moderation_status;
    if p_decision = 'approve' then
      insert into artisan.notifications(
        delivery_key, user_id, notification_type, title, body,
        action_path, source_type, source_id
      )
      select 'mention:' || p_target_id::text || ':' || mention.mentioned_user_id::text,
        mention.mentioned_user_id, 'mention', 'You were mentioned in the Artisan Collective',
        'A reviewed comment mentioned your public Commons Profile.',
        '/forum', 'comment', p_target_id
      from artisan.comment_mentions as mention
      join private.community_notification_preferences as preference
        on preference.user_id = mention.mentioned_user_id
        and preference.in_app_enabled and preference.mentions_enabled
      join artisan.comments as comment on comment.id = mention.comment_id
      where mention.comment_id = p_target_id
        and not exists (
          select 1 from artisan.user_blocks as block
          where (block.blocker_user_id = comment.user_id and block.blocked_user_id = mention.mentioned_user_id)
             or (block.blocker_user_id = mention.mentioned_user_id and block.blocked_user_id = comment.user_id)
        )
      on conflict (delivery_key) do nothing;
    end if;
  else
    select submitter_user_id into strict v_owner_user_id from artisan.challenge_submissions
    where id = p_target_id and status = 'pending_review' and moderation_status = 'pending'
    for update;
    if p_decision = 'approve' and (
      not exists (select 1 from artisan.submission_media where submission_id = p_target_id)
      or exists (
        select 1 from artisan.submission_media as link
        join artisan.media_assets as media on media.id = link.media_asset_id
        where link.submission_id = p_target_id
          and (media.processing_status <> 'approved' or media.moderation_status <> 'approved')
      )
    ) then
      raise exception using errcode = '55000', message = 'artisan_submission_review_prerequisites_missing';
    end if;
    update artisan.challenge_submissions set
      status = case p_decision when 'approve' then 'eligible' when 'changes_requested' then 'changes_requested' else 'ineligible' end,
      moderation_status = case p_decision when 'approve' then 'approved' when 'changes_requested' then 'changes_requested' else 'rejected' end,
      eligibility_status = case p_decision when 'approve' then 'eligible' when 'reject' then 'ineligible' else eligibility_status end,
      reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = p_target_id
    returning status, moderation_status into v_status, v_moderation_status;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_content_reviewed',
    'artisan_' || p_target_type, p_target_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('decision', p_decision, 'ownerUserId', v_owner_user_id, 'publicNotice', nullif(pg_catalog.btrim(p_public_notice), ''))
  );
  v_response := pg_catalog.jsonb_build_object(
    'targetType', p_target_type, 'targetId', p_target_id,
    'status', v_status, 'moderationStatus', v_moderation_status,
    'decision', p_decision
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_review_content(uuid, text, uuid, text, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_review_content(uuid, text, uuid, text, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_review_content(uuid, text, uuid, text, uuid, text, text, text) to service_role;

create or replace function public.artisan_staff_publish_content(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_media_asset_ids uuid[],
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb; v_owner_user_id uuid; v_status text;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_publication_manage');
  if p_target_type not in ('artwork','post','submission')
     or (p_target_type = 'artwork' and coalesce(pg_catalog.cardinality(p_media_asset_ids), 0) not between 1 and 20)
     or (p_target_type <> 'artwork' and coalesce(pg_catalog.cardinality(p_media_asset_ids), 0) <> 0)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_publication_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_content_published',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id,
      'mediaAssetIds', coalesce(p_media_asset_ids, '{}'::uuid[]),
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_target_type = 'artwork' then
    select owner_user_id into strict v_owner_user_id from artisan.artworks
    where id = p_target_id and status = 'approved' and moderation_status = 'approved'
    for update;
    if not exists (
      select 1 from public.profile_public_cards as card
      join artisan.artworks as artwork on artwork.owner_user_id = card.user_id
      where artwork.id = p_target_id and card.public_profile_enabled
        and private.community_profile_is_public(card.user_id)
        and pg_catalog.char_length(artwork.alt_text) > 0
        and artwork.creation_method <> 'undisclosed_legacy'
        and exists (select 1 from artisan.artwork_credits where artwork_id = artwork.id)
        and exists (select 1 from artisan.artwork_licenses where artwork_id = artwork.id and terminated_at is null)
        and exists (
          select 1 from artisan.media_assets where artwork_id = artwork.id
            and id = any(p_media_asset_ids)
            and processing_status = 'approved' and moderation_status = 'approved'
            and metadata_stripped
            and approved_object_key is not null and approved_checksum_sha256 is not null and approved_mime is not null
            and thumbnail_object_key is not null and thumbnail_checksum_sha256 is not null and thumbnail_mime is not null
        )
    ) then
      raise exception using errcode = '55000', message = 'artisan_publication_prerequisites_missing';
    end if;
    if (select pg_catalog.count(distinct media.id) from artisan.media_assets as media
        where media.id = any(p_media_asset_ids) and media.artwork_id = p_target_id
          and media.processing_status = 'approved' and media.moderation_status = 'approved'
          and media.metadata_stripped and media.approved_object_key is not null
          and media.approved_checksum_sha256 is not null and media.approved_mime is not null
          and media.thumbnail_object_key is not null
          and media.thumbnail_checksum_sha256 is not null and media.thumbnail_mime is not null
          and case media.adapter_key
            when 'audio' then media.transcript is not null or media.audio_description is not null
            when 'short_video' then pg_catalog.jsonb_array_length(media.caption_tracks) > 0
              and media.audio_description is not null
              and (select pg_catalog.count(*) from artisan.media_caption_tracks as caption
                   where caption.media_asset_id = media.id and caption.status = 'ready')
                  = pg_catalog.jsonb_array_length(media.caption_tracks)
            when 'pdf_document' then media.static_equivalent_description is not null
            when 'animation' then media.static_equivalent_description is not null
            when 'model_3d' then media.keyboard_instructions is not null
              and media.static_equivalent_description is not null
            when 'interactive_work' then media.keyboard_instructions is not null
              and media.static_equivalent_description is not null
            else true
          end)
       <> (select pg_catalog.count(distinct media_id) from pg_catalog.unnest(p_media_asset_ids) as media_id) then
      raise exception using errcode = '55000', message = 'artisan_selected_media_invalid';
    end if;
    insert into artisan.media_processing_events(
      client_request_id, media_asset_id, actor_user_id, actor_kind,
      from_status, to_status, private_reason, metadata
    )
    select gen_random_uuid(), media.id, p_actor_user_id, 'moderator',
      'approved', 'published', pg_catalog.btrim(p_private_reason),
      pg_catalog.jsonb_build_object('publicationRequestId', p_client_request_id)
    from artisan.media_assets as media
    where media.artwork_id = p_target_id and media.id = any(p_media_asset_ids)
      and media.processing_status = 'approved'
      and media.moderation_status = 'approved';
    update artisan.media_assets set processing_status = 'published',
      published_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where artwork_id = p_target_id and id = any(p_media_asset_ids) and processing_status = 'approved'
      and moderation_status = 'approved';
    update artisan.artworks set status = 'published', published_at = pg_catalog.now(),
      updated_at = pg_catalog.now() where id = p_target_id returning status into v_status;
    insert into artisan.artwork_provenance_events(
      client_request_id, artwork_id, actor_user_id, event_type, metadata
    ) values (
      p_client_request_id, p_target_id, p_actor_user_id, 'published',
      pg_catalog.jsonb_build_object('mediaPublishedAtomically', true)
    );
  elsif p_target_type = 'post' then
    select owner_user_id into strict v_owner_user_id from artisan.forum_posts
    where id = p_target_id and status = 'approved' and moderation_status = 'approved'
    for update;
    if not exists (select 1 from artisan.post_artworks where post_id = p_target_id)
       or exists (
         select 1 from artisan.post_artworks as link
         join artisan.artworks as artwork on artwork.id = link.artwork_id
         where link.post_id = p_target_id
           and (artwork.status <> 'published' or artwork.moderation_status <> 'approved')
       ) then
      raise exception using errcode = '55000', message = 'artisan_post_publication_prerequisites_missing';
    end if;
    update artisan.forum_posts set status = 'published', published_at = pg_catalog.now(),
      updated_at = pg_catalog.now() where id = p_target_id returning status into v_status;
  else
    select submitter_user_id into strict v_owner_user_id from artisan.challenge_submissions
    where id = p_target_id and status = 'eligible' and moderation_status = 'approved'
      and eligibility_status = 'eligible' for update;
    if exists (
      select 1 from artisan.challenge_submissions as submission
      join artisan.artworks as artwork on artwork.id = submission.artwork_id
      where submission.id = p_target_id
        and (artwork.status <> 'published' or artwork.moderation_status <> 'approved')
    ) or not exists (
      select 1 from artisan.submission_media as link
      join artisan.media_assets as media on media.id = link.media_asset_id
      where link.submission_id = p_target_id and media.processing_status = 'published'
        and media.moderation_status = 'approved'
    ) then
      raise exception using errcode = '55000', message = 'artisan_submission_publication_prerequisites_missing';
    end if;
    update artisan.challenge_submissions set status = 'published', published_at = pg_catalog.now(),
      updated_at = pg_catalog.now() where id = p_target_id returning status into v_status;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_publication_manage', 'artisan_content_published',
    'artisan_' || p_target_type, p_target_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('ownerUserId', v_owner_user_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'targetType', p_target_type, 'targetId', p_target_id, 'status', v_status
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_publish_content(uuid, text, uuid, text, uuid, uuid[], text) owner to postgres;
revoke all privileges on function public.artisan_staff_publish_content(uuid, text, uuid, text, uuid, uuid[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_publish_content(uuid, text, uuid, text, uuid, uuid[], text) to service_role;

create or replace function public.artisan_staff_moderate(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_case_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_private_reason text,
  p_public_notice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case artisan.moderation_cases%rowtype;
  v_action artisan.moderation_actions%rowtype;
  v_capability text;
  v_replay jsonb;
  v_response jsonb;
begin
  select * into strict v_case from artisan.moderation_cases
  where id = p_case_id and status <> 'closed' for update;
  v_capability := case when v_case.child_safety_sensitive
    then 'artisan_child_safety_manage' else 'artisan_cases_manage' end;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_action not in (
      'no_action','request_changes','hide_temporarily','remove','restore',
      'lock_comments','unlock_comments','limit_interactions','restrict_feature',
      'suspend_artisan','cross_community_escalation','preserve_evidence','release_evidence'
    )
     or p_target_type not in ('artwork','post','comment','profile','challenge','submission','media','account')
     or (p_target_type <> 'account' and not private.artisan_target_exists(p_target_type, p_target_id))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason_code, ''))) not between 3 and 100
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000
     or (p_public_notice is not null and pg_catalog.char_length(pg_catalog.btrim(p_public_notice)) not between 8 and 2000) then
    raise exception using errcode = '22023', message = 'artisan_moderation_action_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_staff_moderated',
    pg_catalog.jsonb_build_object(
      'caseId', p_case_id, 'action', p_action, 'targetType', p_target_type,
      'targetId', p_target_id, 'reasonCode', p_reason_code,
      'privateReason', pg_catalog.btrim(p_private_reason),
      'publicNotice', nullif(pg_catalog.btrim(p_public_notice), '')
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.moderation_actions(
    client_request_id, case_id, actor_user_id, capability, action,
    target_type, target_id, reason_code, private_reason, public_notice
  ) values (
    p_client_request_id, p_case_id, p_actor_user_id, v_capability, p_action,
    p_target_type, p_target_id, p_reason_code, pg_catalog.btrim(p_private_reason),
    nullif(pg_catalog.btrim(p_public_notice), '')
  ) returning * into v_action;

  if p_target_type = 'artwork' and p_action in ('hide_temporarily','remove') then
    update artisan.artworks set status = 'removed', moderation_status = 'removed',
      removed_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'post' and p_action in ('hide_temporarily','remove') then
    update artisan.forum_posts set status = 'removed', moderation_status = 'removed',
      removed_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'comment' and p_action in ('hide_temporarily','remove') then
    update artisan.comments set status = 'removed_by_moderator', moderation_status = 'removed',
      removed_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'submission' and p_action in ('hide_temporarily','remove') then
    update artisan.challenge_submissions set status = 'ineligible', moderation_status = 'removed',
      eligibility_status = 'ineligible', updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'media' and p_action in ('hide_temporarily','remove') then
    update artisan.media_assets set processing_status = 'removed', moderation_status = 'removed',
      updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'post' and p_action = 'lock_comments' then
    update artisan.forum_posts set comments_enabled = false, updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'post' and p_action = 'unlock_comments' then
    update artisan.forum_posts set comments_enabled = true, updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_action = 'restore' then
    raise exception using errcode = '55000', message = 'artisan_restore_requires_independent_review';
  end if;
  if p_action = 'preserve_evidence' then
    insert into artisan.legal_hold_records(
      target_type, target_id, case_id, scope, imposed_by, private_reason
    ) values (
      p_target_type, p_target_id, p_case_id,
      case when v_case.child_safety_sensitive then 'child_safety' else 'content' end,
      p_actor_user_id, pg_catalog.btrim(p_private_reason)
    );
  end if;
  update artisan.moderation_cases set status = case
    when p_action = 'no_action' then 'closed' else 'investigating' end,
    closed_at = case when p_action = 'no_action' then pg_catalog.now() else closed_at end,
    resolution_code = case when p_action = 'no_action' then 'no_action' else resolution_code end
  where id = p_case_id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, reason_code, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_moderation_action_recorded',
    'artisan_moderation_action', v_action.id, p_client_request_id, p_reason_code,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('caseId', p_case_id, 'action', p_action, 'contentTargetType', p_target_type, 'contentTargetId', p_target_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'moderationActionId', v_action.id, 'caseId', p_case_id,
    'action', p_action, 'effectiveAt', v_action.effective_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_moderate(uuid, text, uuid, uuid, text, text, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_moderate(uuid, text, uuid, uuid, text, text, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_moderate(uuid, text, uuid, uuid, text, text, uuid, text, text, text) to service_role;

create or replace function public.artisan_staff_upsert_challenge(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_challenge_id uuid, p_slug text, p_title text, p_short_prompt text,
  p_full_brief text, p_purpose text, p_sponsor_name text,
  p_license_summary text, p_conflict_of_interest_rules text,
  p_visibility text, p_cancellation_terms text,
  p_status text, p_opens_at timestamptz,
  p_deadline_at timestamptz, p_timezone text, p_maximum_entries_per_artist integer,
  p_selection_method text, p_blind_review boolean,
  p_creation_method_policy text, p_eligibility_policy jsonb,
  p_judging_rubric_version text, p_judging_rubric jsonb,
  p_rules_document_version text, p_rules_content_sha256 text,
  p_adapter_keys text[], p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge artisan.challenges%rowtype;
  v_previous_status text;
  v_was_published boolean := false;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_challenges_manage');
  if p_status not in ('draft','scheduled','open','closed','judging','selection_pending','completed','cancelled','archived')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_sponsor_name, ''))) not between 2 and 200
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_license_summary, ''))) not between 20 and 5000
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_conflict_of_interest_rules, ''))) not between 20 and 5000
     or p_visibility not in ('public','unlisted','private_beta')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_cancellation_terms, ''))) not between 20 and 5000
     or not private.artisan_judging_rubric_is_valid(
       p_selection_method, p_judging_rubric_version, p_judging_rubric
     )
     or not private.artisan_challenge_policy_is_valid(
       p_creation_method_policy, p_eligibility_policy
     )
     or coalesce(pg_catalog.cardinality(p_adapter_keys), 0)
       <> (select pg_catalog.count(distinct adapter_key)
           from pg_catalog.unnest(p_adapter_keys) as adapter_key)
     or coalesce(pg_catalog.cardinality(p_adapter_keys), 0) not between 1 and 7
     or pg_catalog.char_length(coalesce(p_timezone, '')) not between 1 and 100
     or not exists (
       select 1 from pg_catalog.pg_timezone_names as timezone
       where timezone.name = p_timezone
     )
     or (p_status not in ('draft','cancelled') and (
       p_opens_at is null or p_deadline_at is null or p_deadline_at <= p_opens_at
     ))
     or (p_status = 'scheduled' and p_opens_at <= pg_catalog.now())
     or (p_status = 'open' and (
       p_opens_at > pg_catalog.now() or p_deadline_at <= pg_catalog.now()
     ))
     or (p_status in ('closed','judging','selection_pending','completed','archived')
       and p_deadline_at > pg_catalog.now())
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 2000
     or not exists (
       select 1 from private.community_legal_document_versions as document
       where document.document_key = 'challenge_rules_template'
         and document.document_version = p_rules_document_version
         and document.content_sha256 = p_rules_content_sha256
         and document.status = 'approved'
     )
     or (select pg_catalog.count(distinct adapter_key) from artisan.media_adapters
         where adapter_key = any(p_adapter_keys))
        <> (select pg_catalog.count(distinct adapter_key) from pg_catalog.unnest(p_adapter_keys) as adapter_key) then
    raise exception using errcode = '22023', message = 'artisan_challenge_payload_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_challenge_upserted',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'slug', p_slug, 'title', p_title,
      'shortPrompt', p_short_prompt, 'fullBrief', p_full_brief, 'purpose', p_purpose,
      'sponsorName', pg_catalog.btrim(p_sponsor_name),
      'licenseSummary', pg_catalog.btrim(p_license_summary),
      'conflictOfInterestRules', pg_catalog.btrim(p_conflict_of_interest_rules),
      'visibility', p_visibility,
      'cancellationTerms', pg_catalog.btrim(p_cancellation_terms),
      'status', p_status, 'opensAt', p_opens_at, 'deadlineAt', p_deadline_at,
      'timezone', p_timezone, 'maximumEntriesPerArtist', p_maximum_entries_per_artist,
      'selectionMethod', p_selection_method, 'blindReview', p_blind_review,
      'creationMethodPolicy', p_creation_method_policy,
      'eligibilityPolicy', p_eligibility_policy,
      'judgingRubricVersion', p_judging_rubric_version,
      'judgingRubric', p_judging_rubric,
      'rulesDocumentVersion', p_rules_document_version,
      'rulesContentSha256', p_rules_content_sha256,
      'adapterKeys', p_adapter_keys, 'reason', pg_catalog.btrim(p_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_challenge_id is null then
    insert into artisan.challenges(
      client_request_id, slug, title, short_prompt, full_brief, purpose,
      sponsor_name, license_summary, conflict_of_interest_rules, visibility, cancellation_terms,
      status, opens_at, deadline_at, timezone, maximum_entries_per_artist,
      selection_method, blind_review, creation_method_policy, eligibility_policy,
      judging_rubric_version, judging_rubric,
      rules_document_version, rules_content_sha256, published_at,
      created_by, updated_by
    ) values (
      p_client_request_id, pg_catalog.lower(p_slug), pg_catalog.btrim(p_title),
      pg_catalog.btrim(p_short_prompt), pg_catalog.btrim(p_full_brief), pg_catalog.btrim(p_purpose),
      pg_catalog.btrim(p_sponsor_name), pg_catalog.btrim(p_license_summary),
      pg_catalog.btrim(p_conflict_of_interest_rules), p_visibility,
      pg_catalog.btrim(p_cancellation_terms),
      p_status, p_opens_at, p_deadline_at, p_timezone, p_maximum_entries_per_artist,
      p_selection_method, p_blind_review, p_creation_method_policy, p_eligibility_policy,
      p_judging_rubric_version, p_judging_rubric,
      p_rules_document_version, p_rules_content_sha256,
      case when p_status not in ('draft','cancelled') then pg_catalog.now() else null end,
      p_actor_user_id, p_actor_user_id
    ) returning * into v_challenge;
  else
    select * into strict v_challenge from artisan.challenges where id = p_challenge_id for update;
    v_previous_status := v_challenge.status;
    v_was_published := v_challenge.published_at is not null;
    if not (case v_previous_status
      when 'draft' then p_status in ('draft','scheduled','open','cancelled')
      when 'scheduled' then p_status in ('scheduled','open','cancelled')
      when 'open' then p_status in ('open','closed','cancelled')
      when 'closed' then p_status in ('closed','judging','cancelled')
      when 'judging' then p_status in ('judging','selection_pending')
      when 'selection_pending' then p_status in ('selection_pending','judging','completed')
      when 'completed' then p_status in ('completed','archived')
      when 'archived' then p_status = 'archived'
      else false end) then
      raise exception using errcode = '55000', message = 'artisan_challenge_transition_not_allowed';
    end if;
    if v_was_published and (
      v_challenge.slug is distinct from pg_catalog.lower(p_slug)
      or v_challenge.title is distinct from pg_catalog.btrim(p_title)
      or v_challenge.short_prompt is distinct from pg_catalog.btrim(p_short_prompt)
      or v_challenge.full_brief is distinct from pg_catalog.btrim(p_full_brief)
      or v_challenge.purpose is distinct from pg_catalog.btrim(p_purpose)
      or v_challenge.sponsor_name is distinct from pg_catalog.btrim(p_sponsor_name)
      or v_challenge.license_summary is distinct from pg_catalog.btrim(p_license_summary)
      or v_challenge.conflict_of_interest_rules is distinct from pg_catalog.btrim(p_conflict_of_interest_rules)
      or v_challenge.visibility is distinct from p_visibility
      or v_challenge.cancellation_terms is distinct from pg_catalog.btrim(p_cancellation_terms)
      or v_challenge.opens_at is distinct from p_opens_at
      or v_challenge.deadline_at is distinct from p_deadline_at
      or v_challenge.timezone is distinct from p_timezone
      or v_challenge.maximum_entries_per_artist is distinct from p_maximum_entries_per_artist
      or v_challenge.selection_method is distinct from p_selection_method
      or v_challenge.blind_review is distinct from p_blind_review
      or v_challenge.creation_method_policy is distinct from p_creation_method_policy
      or v_challenge.eligibility_policy is distinct from p_eligibility_policy
      or v_challenge.judging_rubric_version is distinct from p_judging_rubric_version
      or v_challenge.judging_rubric is distinct from p_judging_rubric
      or v_challenge.rules_document_version is distinct from p_rules_document_version
      or v_challenge.rules_content_sha256 is distinct from p_rules_content_sha256
    ) then
      raise exception using errcode = '55000', message = 'artisan_published_challenge_policy_immutable';
    end if;
    if v_was_published and (
      (select pg_catalog.count(*) from artisan.challenge_media_rules
       where challenge_id = v_challenge.id)
        <> pg_catalog.cardinality(p_adapter_keys)
      or exists (
        select 1 from artisan.challenge_media_rules
        where challenge_id = v_challenge.id
          and not (adapter_key = any(p_adapter_keys))
      )
    ) then
      raise exception using errcode = '55000', message = 'artisan_published_challenge_media_rules_immutable';
    end if;
    update artisan.challenges set
      slug = pg_catalog.lower(p_slug), title = pg_catalog.btrim(p_title),
      short_prompt = pg_catalog.btrim(p_short_prompt), full_brief = pg_catalog.btrim(p_full_brief),
      purpose = pg_catalog.btrim(p_purpose), sponsor_name = pg_catalog.btrim(p_sponsor_name),
      license_summary = pg_catalog.btrim(p_license_summary),
      conflict_of_interest_rules = pg_catalog.btrim(p_conflict_of_interest_rules),
      visibility = p_visibility, cancellation_terms = pg_catalog.btrim(p_cancellation_terms),
      status = p_status,
      opens_at = p_opens_at, deadline_at = p_deadline_at, timezone = p_timezone,
      maximum_entries_per_artist = p_maximum_entries_per_artist,
      selection_method = p_selection_method, blind_review = p_blind_review,
      creation_method_policy = p_creation_method_policy, eligibility_policy = p_eligibility_policy,
      judging_rubric_version = p_judging_rubric_version,
      judging_rubric = p_judging_rubric,
      rules_document_version = p_rules_document_version,
      rules_content_sha256 = p_rules_content_sha256,
      published_at = case when p_status not in ('draft','cancelled') then coalesce(published_at, pg_catalog.now()) else published_at end,
      closed_at = case when p_status = 'closed' then pg_catalog.now() else closed_at end,
      completed_at = case when p_status = 'completed' then pg_catalog.now() else completed_at end,
      canceled_at = case when p_status = 'cancelled' then pg_catalog.now() else canceled_at end,
      updated_by = p_actor_user_id, updated_at = pg_catalog.now()
    where id = p_challenge_id returning * into v_challenge;
    if not v_was_published then
      delete from artisan.challenge_media_rules
      where challenge_id = v_challenge.id
        and not (adapter_key = any(p_adapter_keys));
    end if;
  end if;
  insert into artisan.challenge_media_rules(
    challenge_id, adapter_key, maximum_files, maximum_bytes,
    maximum_width, maximum_height, maximum_duration_seconds
  )
  select v_challenge.id, adapter.adapter_key, 1, adapter.maximum_bytes,
    adapter.maximum_width, adapter.maximum_height, adapter.maximum_duration_seconds
  from artisan.media_adapters as adapter where adapter.adapter_key = any(p_adapter_keys)
  on conflict (challenge_id, adapter_key) do nothing;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_challenges_manage', 'artisan_challenge_upserted',
    'artisan_challenge', v_challenge.id, p_client_request_id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('status', v_challenge.status, 'previousStatus', v_previous_status)
  );
  v_response := pg_catalog.jsonb_build_object(
    'challengeId', v_challenge.id, 'slug', v_challenge.slug,
    'status', v_challenge.status, 'visibility', v_challenge.visibility,
    'sponsorName', v_challenge.sponsor_name,
    'judgingRubricVersion', v_challenge.judging_rubric_version,
    'publishedAt', v_challenge.published_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_upsert_challenge(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, jsonb, text, jsonb, text, text, text[], text) owner to postgres;
revoke all privileges on function public.artisan_staff_upsert_challenge(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, jsonb, text, jsonb, text, text, text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_upsert_challenge(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, jsonb, text, jsonb, text, text, text[], text) to service_role;

create or replace function public.artisan_staff_select_award(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_challenge_id uuid, p_submission_id uuid, p_award_type text,
  p_display_order integer, p_selection_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_submission artisan.challenge_submissions%rowtype; v_award artisan.challenge_awards%rowtype;
  v_replay jsonb; v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_challenges_manage');
  if p_award_type not in ('winner','runner_up','featured','honorable_recognition','community_mosaic')
     or p_display_order not between 0 and 100
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_selection_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '22023', message = 'artisan_award_selection_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_award_selected',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'submissionId', p_submission_id,
      'awardType', p_award_type, 'displayOrder', p_display_order,
      'selectionReason', pg_catalog.btrim(p_selection_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if not exists (select 1 from artisan.challenges where id = p_challenge_id and status in ('judging','selection_pending')) then
    raise exception using errcode = '55000', message = 'artisan_challenge_not_selecting';
  end if;
  select * into strict v_submission from artisan.challenge_submissions
  where id = p_submission_id and challenge_id = p_challenge_id
    and status in ('eligible','judging','published') and moderation_status = 'approved'
    and eligibility_status = 'eligible' for update;
  insert into artisan.challenge_awards(
    client_request_id, challenge_id, submission_id, award_type,
    display_order, selected_by, selection_reason
  ) values (
    p_client_request_id, p_challenge_id, p_submission_id, p_award_type,
    p_display_order, p_actor_user_id, pg_catalog.btrim(p_selection_reason)
  ) returning * into v_award;
  update artisan.challenge_submissions set status = 'selected', selected_at = pg_catalog.now(),
    updated_at = pg_catalog.now() where id = p_submission_id;
  insert into artisan.notifications(
    delivery_key, user_id, notification_type, title, body,
    action_path, source_type, source_id
  ) values (
    'award-selected:' || v_award.id::text, v_submission.submitter_user_id,
    'award_update', 'A challenge recognition is awaiting your response',
    'Review and accept or decline the exact winner usage agreement.',
    '/account/activity?kind=awards', 'award', v_award.id
  ) on conflict (delivery_key) do nothing;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_challenges_manage', 'artisan_award_selected',
    'artisan_challenge_award', v_award.id, p_client_request_id,
    pg_catalog.btrim(p_selection_reason),
    pg_catalog.jsonb_build_object('challengeId', p_challenge_id, 'submissionId', p_submission_id, 'awardType', p_award_type)
  );
  v_response := pg_catalog.jsonb_build_object(
    'awardId', v_award.id, 'status', v_award.status,
    'awardType', v_award.award_type, 'selectedAt', v_award.selected_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_select_award(uuid, text, uuid, uuid, uuid, text, integer, text) owner to postgres;
revoke all privileges on function public.artisan_staff_select_award(uuid, text, uuid, uuid, uuid, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_select_award(uuid, text, uuid, uuid, uuid, text, integer, text) to service_role;

create or replace function public.artisan_staff_assign_judge(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_challenge_id uuid, p_judge_user_id uuid, p_role text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_judging_manage');
  if p_judge_user_id = p_actor_user_id or p_role not in ('curator','judge','chair')
     or not private.community_account_is_recoverable(p_judge_user_id)
     or not exists (select 1 from artisan.challenges where id = p_challenge_id and status in ('closed','judging','selection_pending'))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_judge_assignment_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_judge_assigned',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'judgeUserId', p_judge_user_id,
      'role', p_role, 'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.challenge_judges(challenge_id, judge_user_id, role, status)
  values (p_challenge_id, p_judge_user_id, p_role, 'conflict_pending')
  on conflict (challenge_id, judge_user_id) do update
  set role = excluded.role, status = 'conflict_pending',
      conflict_disclosure = null, conflict_cleared_by = null
  where artisan.challenge_judges.status = 'released';
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_judging_manage', 'artisan_judge_assigned',
    'artisan_challenge', p_challenge_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('judgeUserId', p_judge_user_id, 'role', p_role)
  );
  v_response := pg_catalog.jsonb_build_object(
    'challengeId', p_challenge_id, 'judgeUserId', p_judge_user_id,
    'role', p_role, 'status', 'conflict_pending'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, uuid, text, text) to service_role;

create or replace function public.submit_current_user_judge_conflict_disclosure(
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_disclosure text,
  p_recuse boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_replay jsonb; v_response jsonb;
begin
  if v_user_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_disclosure, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_judge_disclosure_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_judge_conflict_disclosed',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'disclosure', pg_catalog.btrim(p_disclosure),
      'recuse', p_recuse
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.challenge_judges
  set conflict_disclosure = pg_catalog.btrim(p_disclosure),
      status = case when p_recuse then 'recused' else 'conflict_pending' end,
      conflict_cleared_by = null
  where challenge_id = p_challenge_id and judge_user_id = v_user_id
    and status in ('conflict_pending','cleared') ;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_judge_assignment_unavailable';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    v_user_id, 'user', 'artisan_judge_conflict_disclosed', 'artisan_challenge',
    p_challenge_id, p_client_request_id, pg_catalog.jsonb_build_object('recused', p_recuse)
  );
  v_response := pg_catalog.jsonb_build_object(
    'challengeId', p_challenge_id, 'status', case when p_recuse then 'recused' else 'conflict_pending' end
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.submit_current_user_judge_conflict_disclosure(uuid, uuid, text, boolean) owner to postgres;
revoke all privileges on function public.submit_current_user_judge_conflict_disclosure(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_current_user_judge_conflict_disclosure(uuid, uuid, text, boolean) to authenticated;

create or replace function public.artisan_staff_resolve_judge_conflict(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_challenge_id uuid, p_judge_user_id uuid, p_cleared boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb; v_status text;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_judging_manage');
  if p_actor_user_id = p_judge_user_id
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_judge_conflict_resolution_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_judge_conflict_resolved',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'judgeUserId', p_judge_user_id,
      'cleared', p_cleared, 'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  v_status := case when p_cleared then 'cleared' else 'recused' end;
  update artisan.challenge_judges set status = v_status,
    conflict_cleared_by = case when p_cleared then p_actor_user_id else null end
  where challenge_id = p_challenge_id and judge_user_id = p_judge_user_id
    and status = 'conflict_pending' and conflict_disclosure is not null;
  if not found then
    raise exception using errcode = '55000', message = 'artisan_judge_disclosure_required';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_judging_manage', 'artisan_judge_conflict_resolved',
    'artisan_challenge', p_challenge_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('judgeUserId', p_judge_user_id, 'status', v_status)
  );
  v_response := pg_catalog.jsonb_build_object(
    'challengeId', p_challenge_id, 'judgeUserId', p_judge_user_id, 'status', v_status
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, uuid, boolean, text) owner to postgres;
revoke all privileges on function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, uuid, boolean, text) to service_role;

create or replace function public.submit_current_user_challenge_score(
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_submission_id uuid,
  p_rubric_version text,
  p_score jsonb,
  p_private_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge artisan.challenges%rowtype;
  v_score artisan.challenge_scores%rowtype;
  v_action text;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_private_note, '')) > 5000
     or pg_catalog.char_length(coalesce(p_rubric_version, '')) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'artisan_challenge_score_invalid';
  end if;
  select * into v_challenge from artisan.challenges
  where id = p_challenge_id;
  if not found
     or v_challenge.status not in ('judging','selection_pending')
     or v_challenge.selection_method not in ('rubric','blind_rubric')
     or p_rubric_version is distinct from v_challenge.judging_rubric_version
     or not private.artisan_challenge_score_is_valid(
       v_challenge.judging_rubric, p_score
     ) then
    raise exception using errcode = '22023', message = 'artisan_challenge_score_invalid';
  end if;
  if not exists (
    select 1 from artisan.challenge_judges as judge
    where judge.challenge_id = p_challenge_id and judge.judge_user_id = v_user_id
      and judge.status = 'cleared'
  ) or exists (
    select 1 from artisan.challenge_submissions
    where id = p_submission_id and submitter_user_id = v_user_id
  ) or not exists (
    select 1 from artisan.challenge_submissions
    where id = p_submission_id and challenge_id = p_challenge_id
      and status in ('eligible','judging','selected','not_selected','published')
      and moderation_status = 'approved' and eligibility_status = 'eligible'
  ) then
    raise exception using errcode = '42501', message = 'artisan_challenge_score_not_permitted';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_challenge_score_submitted',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'submissionId', p_submission_id,
      'rubricVersion', p_rubric_version, 'score', p_score,
      'privateNote', nullif(pg_catalog.btrim(p_private_note), '')
    )
  );
  if v_replay is not null then return v_replay; end if;
  select case when exists (
    select 1 from artisan.challenge_scores where submission_id = p_submission_id
      and judge_user_id = v_user_id and rubric_version = p_rubric_version
  ) then 'revised' else 'submitted' end into v_action;
  insert into artisan.challenge_scores(
    challenge_id, submission_id, judge_user_id, rubric_version,
    score, private_note, conflict_declared
  ) values (
    p_challenge_id, p_submission_id, v_user_id, p_rubric_version,
    p_score, nullif(pg_catalog.btrim(p_private_note), ''), false
  ) on conflict (submission_id, judge_user_id, rubric_version) do update
  set score = excluded.score, private_note = excluded.private_note,
      conflict_declared = false, updated_at = pg_catalog.now()
  returning * into v_score;
  insert into artisan.challenge_score_events(
    client_request_id, score_id, challenge_id, submission_id,
    judge_user_id, rubric_version, score, private_note,
    conflict_declared, action
  ) values (
    p_client_request_id, v_score.id, p_challenge_id, p_submission_id,
    v_user_id, p_rubric_version, p_score,
    nullif(pg_catalog.btrim(p_private_note), ''), false, v_action
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    v_user_id, 'user', 'artisan_challenge_score_submitted', 'artisan_challenge_submission',
    p_submission_id, p_client_request_id,
    pg_catalog.jsonb_build_object('challengeId', p_challenge_id, 'rubricVersion', p_rubric_version, 'action', v_action)
  );
  v_response := pg_catalog.jsonb_build_object(
    'scoreId', v_score.id, 'submissionId', p_submission_id,
    'rubricVersion', p_rubric_version, 'action', v_action,
    'submittedAt', v_score.submitted_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.submit_current_user_challenge_score(uuid, uuid, uuid, text, jsonb, text) owner to postgres;
revoke all privileges on function public.submit_current_user_challenge_score(uuid, uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_current_user_challenge_score(uuid, uuid, uuid, text, jsonb, text) to authenticated;

create or replace function public.respond_current_user_artisan_award(
  p_client_request_id uuid,
  p_award_id uuid,
  p_decision text,
  p_document_version text,
  p_content_sha256 text,
  p_private_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_award artisan.challenge_awards%rowtype;
  v_submission artisan.challenge_submissions%rowtype;
  v_license_id uuid;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or p_decision not in ('accepted','declined')
     or pg_catalog.char_length(coalesce(p_private_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'artisan_award_response_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_award_responded',
    pg_catalog.jsonb_build_object(
      'awardId', p_award_id, 'decision', p_decision,
      'documentVersion', p_document_version, 'contentSha256', p_content_sha256,
      'privateNote', nullif(pg_catalog.btrim(p_private_note), '')
    )
  );
  if v_replay is not null then return v_replay; end if;
  select award.* into strict v_award from artisan.challenge_awards as award
  join artisan.challenge_submissions as submission on submission.id = award.submission_id
  where award.id = p_award_id and award.status = 'selection_pending'
    and submission.submitter_user_id = v_user_id for update of award;
  select * into strict v_submission from artisan.challenge_submissions where id = v_award.submission_id;
  if not exists (
    select 1 from private.community_active_legal_documents as active_document
    join private.community_legal_document_versions as document
      on document.document_key = active_document.document_key
     and document.document_version = active_document.document_version
    where active_document.document_key = 'winner_usage_agreement_template'
      and document.document_version = p_document_version
      and document.content_sha256 = p_content_sha256
      and document.status = 'approved'
  ) then
    raise exception using errcode = '55000', message = 'artisan_winner_agreement_version_mismatch';
  end if;
  if p_decision = 'accepted' then
    insert into artisan.artwork_licenses(
      artwork_id, license_code, document_key, document_version,
      content_sha256, scope, accepted_by
    ) values (
      v_submission.artwork_id, 'winner_usage_agreement',
      'winner_usage_agreement_template', p_document_version,
      p_content_sha256, 'winner_usage', v_user_id
    ) returning id into v_license_id;
  end if;
  insert into artisan.award_agreement_acceptances(
    client_request_id, award_id, artist_user_id, decision,
    document_key, document_version, content_sha256,
    winner_license_id, private_note
  ) values (
    p_client_request_id, p_award_id, v_user_id, p_decision,
    'winner_usage_agreement_template', p_document_version, p_content_sha256,
    v_license_id, nullif(pg_catalog.btrim(p_private_note), '')
  );
  update artisan.challenge_awards set
    status = case when p_decision = 'accepted' then 'artist_confirmed' else 'declined' end,
    winner_license_id = v_license_id,
    confirmed_at = case when p_decision = 'accepted' then pg_catalog.now() else null end
  where id = p_award_id returning * into v_award;
  if p_decision = 'declined' then
    update artisan.challenge_submissions set status = 'not_selected', updated_at = pg_catalog.now()
    where id = v_award.submission_id;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    v_user_id, 'user', 'artisan_award_responded', 'artisan_challenge_award',
    p_award_id, p_client_request_id,
    pg_catalog.jsonb_build_object('decision', p_decision, 'documentVersion', p_document_version, 'contentSha256', p_content_sha256)
  );
  v_response := pg_catalog.jsonb_build_object(
    'awardId', p_award_id, 'status', v_award.status,
    'decision', p_decision, 'winnerLicenseId', v_license_id
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.respond_current_user_artisan_award(uuid, uuid, text, text, text, text) owner to postgres;
revoke all privileges on function public.respond_current_user_artisan_award(uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.respond_current_user_artisan_award(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.artisan_staff_publish_award(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_award_id uuid, p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_award artisan.challenge_awards%rowtype;
  v_submission artisan.challenge_submissions%rowtype;
  v_artwork artisan.artworks%rowtype;
  v_gallery artisan.gallery_entries%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_gallery_manage');
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_award_publication_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_award_published',
    pg_catalog.jsonb_build_object('awardId', p_award_id, 'privateReason', pg_catalog.btrim(p_private_reason))
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_award from artisan.challenge_awards
  where id = p_award_id and status = 'artist_confirmed'
    and winner_license_id is not null and confirmed_at is not null for update;
  select * into strict v_submission from artisan.challenge_submissions where id = v_award.submission_id for update;
  select * into strict v_artwork from artisan.artworks where id = v_submission.artwork_id
    and status = 'published' and moderation_status = 'approved';
  if not exists (
    select 1 from artisan.award_agreement_acceptances
    where award_id = p_award_id and decision = 'accepted'
      and winner_license_id = v_award.winner_license_id
  ) or not exists (
    select 1 from artisan.artwork_licenses where id = v_award.winner_license_id
      and artwork_id = v_artwork.id and scope = 'winner_usage' and terminated_at is null
  ) then
    raise exception using errcode = '55000', message = 'artisan_award_agreement_required';
  end if;
  update artisan.challenge_awards set status = 'published', published_at = pg_catalog.now()
  where id = p_award_id returning * into v_award;
  update artisan.challenge_submissions set status = 'published', published_at = coalesce(published_at, pg_catalog.now()),
    updated_at = pg_catalog.now() where id = v_submission.id;
  insert into artisan.gallery_entries(
    artwork_id, challenge_id, submission_id, award_id, gallery_kind,
    status, frozen_credit_line, frozen_profile_url, frozen_creation_method,
    frozen_license_code, accessible_description, published_at
  ) values (
    v_artwork.id, v_award.challenge_id, v_submission.id, v_award.id, 'winner',
    'published', v_artwork.credit_line, v_artwork.preferred_profile_url,
    v_artwork.creation_method, 'winner_usage_agreement', v_artwork.alt_text,
    pg_catalog.now()
  ) on conflict (gallery_kind, artwork_id, challenge_id) do update
  set award_id = excluded.award_id, status = 'published',
      frozen_credit_line = excluded.frozen_credit_line,
      frozen_profile_url = excluded.frozen_profile_url,
      frozen_creation_method = excluded.frozen_creation_method,
      frozen_license_code = excluded.frozen_license_code,
      accessible_description = excluded.accessible_description,
      published_at = coalesce(artisan.gallery_entries.published_at, excluded.published_at)
  returning * into v_gallery;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_gallery_manage', 'artisan_award_published',
    'artisan_challenge_award', p_award_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('galleryEntryId', v_gallery.id, 'artworkId', v_artwork.id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'awardId', p_award_id, 'status', 'published', 'galleryEntryId', v_gallery.id,
    'publishedAt', v_award.published_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_publish_award(uuid, text, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_staff_publish_award(uuid, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_publish_award(uuid, text, uuid, uuid, text) to service_role;

create or replace function public.artisan_staff_materialize_gallery(
  p_actor_user_id uuid, p_actor_aal text, p_client_request_id uuid,
  p_challenge_id uuid, p_gallery_kind text, p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replay jsonb; v_response jsonb; v_count integer;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_gallery_manage');
  if p_gallery_kind not in ('all_entries','winner')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000
     or not exists (select 1 from artisan.challenges where id = p_challenge_id and status in ('closed','judging','selection_pending','completed','archived')) then
    raise exception using errcode = '22023', message = 'artisan_gallery_materialization_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_gallery_materialized',
    pg_catalog.jsonb_build_object(
      'challengeId', p_challenge_id, 'galleryKind', p_gallery_kind,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.gallery_entries(
    artwork_id, challenge_id, submission_id, award_id, gallery_kind,
    status, frozen_credit_line, frozen_profile_url, frozen_creation_method,
    frozen_license_code, accessible_description, published_at
  )
  select artwork.id, submission.challenge_id, submission.id, award.id, p_gallery_kind,
    'published', artwork.credit_line, artwork.preferred_profile_url,
    artwork.creation_method,
    case when p_gallery_kind = 'winner' then 'winner_usage_agreement' else artwork.license_code end,
    artwork.alt_text, pg_catalog.now()
  from artisan.challenge_submissions as submission
  join artisan.artworks as artwork on artwork.id = submission.artwork_id
  left join artisan.challenge_awards as award
    on award.submission_id = submission.id and award.status = 'published'
  where submission.challenge_id = p_challenge_id
    and submission.moderation_status = 'approved' and submission.eligibility_status = 'eligible'
    and submission.status in ('selected','not_selected','published')
    and artwork.status = 'published' and artwork.moderation_status = 'approved'
    and ((p_gallery_kind = 'winner' and award.id is not null) or p_gallery_kind = 'all_entries')
    and exists (
      select 1 from public.profile_public_cards as card
      where card.user_id = artwork.owner_user_id and card.public_profile_enabled
        and private.community_profile_is_public(card.user_id)
    )
  on conflict (gallery_kind, artwork_id, challenge_id) do nothing;
  get diagnostics v_count = row_count;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_gallery_manage', 'artisan_gallery_materialized',
    'artisan_challenge', p_challenge_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('galleryKind', p_gallery_kind, 'createdCount', v_count)
  );
  v_response := pg_catalog.jsonb_build_object(
    'challengeId', p_challenge_id, 'galleryKind', p_gallery_kind, 'createdCount', v_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_materialize_gallery(uuid, text, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_materialize_gallery(uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_materialize_gallery(uuid, text, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_claim_media_processing_jobs(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_jobs jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or p_limit not between 1 and 25 or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'artisan_media_job_claim_invalid';
  end if;
  with candidates as (
    select job.id
    from artisan.media_processing_jobs as job
    where (job.status = 'queued' and job.available_at <= pg_catalog.now())
       or (job.status = 'claimed' and job.lease_expires_at <= pg_catalog.now())
    order by job.available_at, job.created_at, job.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update artisan.media_processing_jobs as job
    set status = 'claimed', claimed_by = p_worker_id,
        revision = job.revision + 1,
        claimed_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        attempt_count = job.attempt_count + 1, updated_at = pg_catalog.now()
    from candidates where job.id = candidates.id
    returning job.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'jobId', claimed.id, 'mediaAssetId', claimed.media_asset_id,
    'attemptCount', claimed.attempt_count, 'claimedBy', claimed.claimed_by,
    'leaseExpiresAt', claimed.lease_expires_at
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_jobs from claimed;
  return pg_catalog.jsonb_build_object('jobs', v_jobs, 'workerId', p_worker_id);
end;
$$;

alter function public.artisan_claim_media_processing_jobs(text, integer, integer) owner to postgres;
revoke all privileges on function public.artisan_claim_media_processing_jobs(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_claim_media_processing_jobs(text, integer, integer) to service_role;

create or replace function public.artisan_mark_media_processing_job(
  p_client_request_id uuid,
  p_worker_id text,
  p_job_id uuid,
  p_outcome text,
  p_retry_after_seconds integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job artisan.media_processing_jobs%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or p_outcome not in ('retry','completed','dead_letter')
     or (p_outcome = 'retry' and p_retry_after_seconds not between 1 and 86400)
     or (p_outcome <> 'retry' and p_retry_after_seconds is not null)
     or (p_error_code is not null and p_error_code !~ '^[a-z][a-z0-9_]{2,99}$') then
    raise exception using errcode = '22023', message = 'artisan_media_job_result_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_media_job_marked',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'jobId', p_job_id, 'outcome', p_outcome,
      'retryAfterSeconds', p_retry_after_seconds, 'errorCode', p_error_code
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_job from artisan.media_processing_jobs
  where id = p_job_id and status = 'claimed' and claimed_by = p_worker_id
    and lease_expires_at > pg_catalog.now() for update;
  update artisan.media_processing_jobs set
    status = case when p_outcome = 'retry' then 'queued' else p_outcome end,
    revision = revision + 1,
    available_at = case when p_outcome = 'retry'
      then pg_catalog.now() + pg_catalog.make_interval(secs => p_retry_after_seconds) else available_at end,
    claimed_by = null, claimed_at = null, lease_expires_at = null,
    completed_at = case when p_outcome = 'completed' then pg_catalog.now() else null end,
    last_error_code = p_error_code,
    last_error_at = case when p_error_code is not null then pg_catalog.now() else last_error_at end,
    updated_at = pg_catalog.now()
  where id = p_job_id returning * into v_job;
  v_response := pg_catalog.jsonb_build_object(
    'jobId', v_job.id, 'mediaAssetId', v_job.media_asset_id,
    'status', v_job.status, 'availableAt', v_job.available_at,
    'attemptCount', v_job.attempt_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_mark_media_processing_job(uuid, text, uuid, text, integer, text) owner to postgres;
revoke all privileges on function public.artisan_mark_media_processing_job(uuid, text, uuid, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_mark_media_processing_job(uuid, text, uuid, text, integer, text) to service_role;

create or replace function public.artisan_reconcile_media_processing_jobs(
  p_client_request_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requeued integer;
  v_created integer;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_media_job_reconcile_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_media_jobs_reconciled',
    pg_catalog.jsonb_build_object('privateReason', pg_catalog.btrim(p_private_reason))
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.media_processing_jobs set status = 'queued', revision = revision + 1,
    available_at = pg_catalog.now(), claimed_by = null, claimed_at = null,
    lease_expires_at = null, updated_at = pg_catalog.now()
  where status = 'claimed' and lease_expires_at <= pg_catalog.now();
  get diagnostics v_requeued = row_count;
  insert into artisan.media_processing_jobs(media_asset_id, status, available_at)
  select media.id, 'queued', pg_catalog.now()
  from artisan.media_assets as media
  where media.processing_status in (
    'uploaded','type_validating','decoded','metadata_stripped','reencoded','thumbnail_created','scanning'
  ) and not exists (
    select 1 from artisan.media_processing_jobs as job where job.media_asset_id = media.id
  );
  get diagnostics v_created = row_count;
  insert into private.community_audit_events(
    actor_kind, action, target_type, request_id, private_reason, metadata
  ) values (
    'service', 'artisan_media_jobs_reconciled', 'artisan_media_processing_jobs',
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('requeuedCount', v_requeued, 'createdCount', v_created)
  );
  v_response := pg_catalog.jsonb_build_object(
    'requeuedCount', v_requeued, 'createdCount', v_created
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_reconcile_media_processing_jobs(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_reconcile_media_processing_jobs(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_reconcile_media_processing_jobs(uuid, text) to service_role;

-- Leased notification delivery. External email remains additionally gated by
-- the default-off feature flag and per-user preference; no email address or
-- Auth credential is returned by this database contract.
create or replace function public.artisan_claim_notification_delivery_jobs(
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
     or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'artisan_notification_claim_invalid';
  end if;
  update artisan.notifications as notification
  set status = case when notification.attempt_count >= 20 then 'suppressed' else 'failed' end,
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      available_at = pg_catalog.now(), last_error_code = 'lease_expired',
      last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'notification_delivery_lease_expired:' || notification.id::text, 'sha256'
      ), 'hex')
  where notification.status = 'processing'
    and notification.lease_expires_at <= pg_catalog.now();
  update artisan.notifications as notification
  set status = 'suppressed', claimed_by = null, claimed_at = null,
      lease_expires_at = null
  where notification.status in ('pending','failed')
    and notification.notification_type not in (
      'moderation_notice','appeal_update','guardian_update','system'
    )
    and (
      not coalesce((select preference.in_app_enabled
        from private.community_notification_preferences as preference
        where preference.user_id = notification.user_id), true)
      or private.community_has_active_restriction(notification.user_id, 'artisan_notifications')
      or private.community_has_active_restriction(notification.user_id, 'all_public_communities')
    );
  with candidates as (
    select notification.id
    from artisan.notifications as notification
    where notification.status in ('pending','failed')
      and notification.available_at <= pg_catalog.now()
      and notification.attempt_count < 20
    order by notification.available_at, notification.created_at, notification.id
    for update skip locked limit p_limit
  ), claimed as (
    update artisan.notifications as notification
    set status = 'processing', claimed_by = p_worker_id,
        claimed_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        attempt_count = notification.attempt_count + 1
    from candidates where notification.id = candidates.id
    returning notification.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'notificationId', claimed.id, 'userId', claimed.user_id,
    'type', claimed.notification_type, 'title', claimed.title,
    'body', claimed.body, 'actionPath', claimed.action_path,
    'sourceType', claimed.source_type, 'sourceId', claimed.source_id,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at,
    'emailDeliveryAllowed', private.community_feature_enabled('artisan_external_email_notifications')
      and coalesce((select preference.email_enabled
        from private.community_notification_preferences as preference
        where preference.user_id = claimed.user_id), false)
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_items from claimed;
  return pg_catalog.jsonb_build_object('workerId', p_worker_id, 'items', v_items);
end;
$$;

alter function public.artisan_claim_notification_delivery_jobs(text, integer, integer) owner to postgres;
revoke all privileges on function public.artisan_claim_notification_delivery_jobs(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_claim_notification_delivery_jobs(text, integer, integer) to service_role;

create or replace function public.artisan_complete_notification_delivery(
  p_client_request_id uuid,
  p_worker_id text,
  p_notification_id uuid,
  p_delivery_evidence_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification artisan.notifications%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_delivery_evidence_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'artisan_notification_completion_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_notification_delivery_completed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'notificationId', p_notification_id,
      'deliveryEvidenceSha256', p_delivery_evidence_sha256
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_notification from artisan.notifications
  where id = p_notification_id and status = 'processing'
    and claimed_by = p_worker_id and lease_expires_at > pg_catalog.now()
  for update;
  update artisan.notifications
  set status = 'delivered', delivered_at = pg_catalog.now(),
      delivery_evidence_sha256 = p_delivery_evidence_sha256,
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      last_error_code = null, last_error_at = null,
      last_error_evidence_sha256 = null
  where id = p_notification_id returning * into v_notification;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'artisan_notification_delivery_completed',
    'artisan_notification', p_notification_id, p_client_request_id,
    pg_catalog.jsonb_build_object('workerId', p_worker_id, 'userId', v_notification.user_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'notificationId', v_notification.id, 'status', v_notification.status,
    'deliveredAt', v_notification.delivered_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_complete_notification_delivery(uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_complete_notification_delivery(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_complete_notification_delivery(uuid, text, uuid, text) to service_role;

create or replace function public.artisan_fail_notification_delivery(
  p_client_request_id uuid,
  p_worker_id text,
  p_notification_id uuid,
  p_error_code text,
  p_failure_evidence_sha256 text,
  p_retry_after_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification artisan.notifications%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,99}$'
     or coalesce(p_failure_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_retry_after_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'artisan_notification_failure_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_notification_delivery_failed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'notificationId', p_notification_id,
      'errorCode', p_error_code, 'failureEvidenceSha256', p_failure_evidence_sha256,
      'retryAfterSeconds', p_retry_after_seconds
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_notification from artisan.notifications
  where id = p_notification_id and status = 'processing'
    and claimed_by = p_worker_id and lease_expires_at > pg_catalog.now()
  for update;
  update artisan.notifications
  set status = case when attempt_count >= 20 then 'suppressed' else 'failed' end,
      available_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      last_error_code = p_error_code, last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = p_failure_evidence_sha256
  where id = p_notification_id returning * into v_notification;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'artisan_notification_delivery_failed',
    'artisan_notification', p_notification_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'errorCode', p_error_code,
      'status', v_notification.status, 'attemptCount', v_notification.attempt_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'notificationId', v_notification.id, 'status', v_notification.status,
    'availableAt', v_notification.available_at,
    'attemptCount', v_notification.attempt_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_fail_notification_delivery(uuid, text, uuid, text, text, integer) owner to postgres;
revoke all privileges on function public.artisan_fail_notification_delivery(uuid, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_fail_notification_delivery(uuid, text, uuid, text, text, integer) to service_role;

create or replace function private.artisan_retention_target_has_legal_hold(
  p_target_type text,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_target_type
    when 'media_asset' then coalesce((
      select exists (
        select 1 from artisan.legal_hold_records as hold
        where hold.released_at is null and (
          (hold.target_type = 'media' and hold.target_id = media.id)
          or (hold.target_type = 'artwork' and hold.target_id = media.artwork_id)
          or (hold.target_type = 'account' and hold.target_id = media.owner_user_id)
        )
      ) or exists (
        select 1 from private.account_legal_holds as hold
        where hold.user_id = media.owner_user_id and hold.lifted_at is null
      )
      from artisan.media_assets as media where media.id = p_target_id
    ), false)
    when 'notification' then coalesce((
      select exists (
        select 1 from private.account_legal_holds as hold
        where hold.user_id = notification.user_id and hold.lifted_at is null
      ) or exists (
        select 1 from artisan.legal_hold_records as hold
        where hold.target_type = 'account' and hold.target_id = notification.user_id
          and hold.released_at is null
      )
      from artisan.notifications as notification where notification.id = p_target_id
    ), false)
    else true
  end;
$$;

alter function private.artisan_retention_target_has_legal_hold(text, uuid) owner to postgres;
revoke all privileges on function private.artisan_retention_target_has_legal_hold(text, uuid)
  from public, anon, authenticated, service_role;

-- Once a Worker receives a private deletion key, a newly activated legal hold
-- cannot truthfully recall that external operation. Fail hold activation while
-- an overlapping durable lease is processing; staff retry after the Worker has
-- completed or failed/requeued the task. This trigger covers every current and
-- future RPC that inserts a hold rather than relying on each caller to remember.
create or replace function private.prevent_legal_hold_retention_race()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_target_type text;
  v_target_id uuid;
begin
  if tg_table_schema = 'private' then
    v_user_id := new.user_id;
  else
    v_target_type := new.target_type;
    v_target_id := new.target_id;
    if v_target_type = 'account' then
      v_user_id := v_target_id;
    end if;
  end if;
  if exists (
    select 1 from artisan.retention_tasks as task
    join artisan.media_assets as media
      on task.target_type = 'media_asset' and task.target_id = media.id
    where task.status = 'processing'
      and (
        (v_target_type = 'media' and media.id = v_target_id)
        or (v_target_type = 'artwork' and media.artwork_id = v_target_id)
        or (v_user_id is not null and media.owner_user_id = v_user_id)
      )
  ) or (v_user_id is not null and exists (
    select 1 from private.account_export_artifacts as artifact
    where artifact.user_id = v_user_id
      and artifact.retention_status = 'processing'
  )) then
    raise exception using errcode = '55000', message = 'legal_hold_wait_for_retention_lease';
  end if;
  return new;
end;
$$;

alter function private.prevent_legal_hold_retention_race() owner to postgres;
revoke all privileges on function private.prevent_legal_hold_retention_race()
  from public, anon, authenticated, service_role;
drop trigger if exists prevent_legal_hold_retention_race on artisan.legal_hold_records;
create trigger prevent_legal_hold_retention_race
before insert on artisan.legal_hold_records for each row
execute function private.prevent_legal_hold_retention_race();
drop trigger if exists prevent_account_legal_hold_retention_race on private.account_legal_holds;
create trigger prevent_account_legal_hold_retention_race
before insert on private.account_legal_holds for each row
execute function private.prevent_legal_hold_retention_race();

create or replace function public.artisan_reconcile_retention_tasks(
  p_client_request_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_abandoned integer := 0;
  v_originals integer := 0;
  v_notifications integer := 0;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_client_request_id is null
     or p_limit not between 1 and 500 then
    raise exception using errcode = '22023', message = 'artisan_retention_reconcile_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_retention_tasks_reconciled',
    pg_catalog.jsonb_build_object('limit', p_limit)
  );
  if v_replay is not null then return v_replay; end if;

  with candidates as (
    select media.id
    from artisan.media_assets as media
    where media.processing_status = 'upload_authorized'
      and media.upload_expires_at <= pg_catalog.now()
      and not private.artisan_retention_target_has_legal_hold('media_asset', media.id)
      and not exists (
        select 1 from artisan.retention_tasks as task
        where task.target_type = 'media_asset' and task.target_id = media.id
          and task.action = 'delete_abandoned_upload'
      )
    order by media.upload_expires_at, media.id
    for update skip locked limit p_limit
  ), inserted as (
    insert into artisan.retention_tasks(target_type, target_id, action, due_at)
    select 'media_asset', candidate.id, 'delete_abandoned_upload', pg_catalog.now()
    from candidates as candidate
    on conflict (target_type, target_id, action) do nothing
    returning id
  ) select pg_catalog.count(*)::integer into v_abandoned from inserted;

  with candidates as (
    select media.id
    from artisan.media_assets as media
    where media.processing_status in ('pending_review','approved','published')
      and media.metadata_stripped
      and media.private_object_key is not null
      and media.retention_expires_at is not null
      and media.retention_expires_at <= pg_catalog.now()
      and not private.artisan_retention_target_has_legal_hold('media_asset', media.id)
      and not exists (
        select 1 from artisan.retention_tasks as task
        where task.target_type = 'media_asset' and task.target_id = media.id
          and task.action = 'delete_quarantine_original'
      )
    order by media.retention_expires_at, media.id
    for update skip locked limit p_limit
  ), inserted as (
    insert into artisan.retention_tasks(target_type, target_id, action, due_at)
    select 'media_asset', candidate.id, 'delete_quarantine_original', pg_catalog.now()
    from candidates as candidate
    on conflict (target_type, target_id, action) do nothing
    returning id
  ) select pg_catalog.count(*)::integer into v_originals from inserted;

  with candidates as (
    select notification.id
    from artisan.notifications as notification
    where notification.created_at <= pg_catalog.now() - interval '365 days'
      and notification.status in ('delivered','failed','suppressed')
      and not private.artisan_retention_target_has_legal_hold('notification', notification.id)
      and not exists (
        select 1 from artisan.retention_tasks as task
        where task.target_type = 'notification' and task.target_id = notification.id
          and task.action = 'expire_notification'
      )
    order by notification.created_at, notification.id
    for update skip locked limit p_limit
  ), inserted as (
    insert into artisan.retention_tasks(target_type, target_id, action, due_at)
    select 'notification', candidate.id, 'expire_notification', pg_catalog.now()
    from candidates as candidate
    on conflict (target_type, target_id, action) do nothing
    returning id
  ) select pg_catalog.count(*)::integer into v_notifications from inserted;

  insert into private.community_audit_events(
    actor_kind, action, target_type, request_id, metadata
  ) values (
    'service', 'artisan_retention_tasks_reconciled',
    'artisan_retention_queue', p_client_request_id,
    pg_catalog.jsonb_build_object(
      'abandonedUploadTasks', v_abandoned,
      'quarantineOriginalTasks', v_originals,
      'notificationTasks', v_notifications
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'abandonedUploadTasks', v_abandoned,
    'quarantineOriginalTasks', v_originals,
    'notificationTasks', v_notifications,
    'totalEnqueued', v_abandoned + v_originals + v_notifications
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_reconcile_retention_tasks(uuid, integer) owner to postgres;
revoke all privileges on function public.artisan_reconcile_retention_tasks(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_reconcile_retention_tasks(uuid, integer)
  to service_role;

create or replace function public.artisan_claim_retention_tasks(
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
     or p_limit not between 1 and 25 or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'artisan_retention_claim_invalid';
  end if;
  update artisan.retention_tasks as task
  set status = case when task.attempt_count >= 20 then 'abandoned' else 'failed' end,
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      due_at = pg_catalog.now(), last_error_code = 'lease_expired',
      last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = pg_catalog.encode(extensions.digest(
        'retention_task_lease_expired:' || task.id::text, 'sha256'
      ), 'hex')
  where task.status = 'processing' and task.lease_expires_at <= pg_catalog.now();
  update artisan.retention_tasks as task
  set status = 'pending', legal_hold_checked_at = pg_catalog.now(),
      due_at = least(task.due_at, pg_catalog.now())
  where task.status = 'blocked_by_legal_hold'
    and task.action in (
      'delete_quarantine_original','delete_rejected_media',
      'delete_abandoned_upload','delete_account_media','expire_notification'
    )
    and not private.artisan_retention_target_has_legal_hold(task.target_type, task.target_id);
  update artisan.retention_tasks as task
  set status = 'blocked_by_legal_hold', legal_hold_checked_at = pg_catalog.now(),
      claimed_by = null, claimed_at = null, lease_expires_at = null
  where task.status in ('pending','failed') and task.due_at <= pg_catalog.now()
    and task.action in (
      'delete_quarantine_original','delete_rejected_media',
      'delete_abandoned_upload','delete_account_media','expire_notification'
    )
    and private.artisan_retention_target_has_legal_hold(task.target_type, task.target_id);
  with candidates as (
    select task.id from artisan.retention_tasks as task
    where task.status in ('pending','failed') and task.due_at <= pg_catalog.now()
      and task.attempt_count < 20
      and task.action in (
        'delete_quarantine_original','delete_rejected_media',
        'delete_abandoned_upload','delete_account_media','expire_notification'
      )
      and not private.artisan_retention_target_has_legal_hold(task.target_type, task.target_id)
    order by task.due_at, task.created_at, task.id
    for update skip locked limit p_limit
  ), claimed as (
    update artisan.retention_tasks as task
    set status = 'processing', claimed_by = p_worker_id,
        claimed_at = pg_catalog.now(),
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        attempt_count = task.attempt_count + 1,
        legal_hold_checked_at = pg_catalog.now()
    from candidates where task.id = candidates.id
    returning task.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'taskId', claimed.id, 'targetType', claimed.target_type,
    'targetId', claimed.target_id, 'action', claimed.action,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at
  ) order by claimed.due_at, claimed.id), '[]'::jsonb)
  into v_items from claimed;
  return pg_catalog.jsonb_build_object('workerId', p_worker_id, 'items', v_items);
end;
$$;

alter function public.artisan_claim_retention_tasks(text, integer, integer) owner to postgres;
revoke all privileges on function public.artisan_claim_retention_tasks(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_claim_retention_tasks(text, integer, integer) to service_role;

create or replace function public.artisan_get_retention_task_asset(
  p_worker_id text,
  p_task_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_task artisan.retention_tasks%rowtype;
  v_objects jsonb := '[]'::jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$' then
    raise exception using errcode = '42501', message = 'artisan_retention_worker_required';
  end if;
  select * into strict v_task from artisan.retention_tasks
  where id = p_task_id and status = 'processing'
    and claimed_by = p_worker_id and lease_expires_at > pg_catalog.now();
  if private.artisan_retention_target_has_legal_hold(v_task.target_type, v_task.target_id) then
    raise exception using errcode = '55000', message = 'artisan_retention_legal_hold_active';
  end if;
  if v_task.target_type = 'media_asset' then
    select coalesce(pg_catalog.jsonb_agg(
      object order by object ->> 'kind', object ->> 'privateObjectKey'
    ), '[]'::jsonb)
    into v_objects from (
      select pg_catalog.jsonb_build_object(
        'kind', 'quarantineOriginal', 'storageProvider', media.storage_provider,
        'bucket', media.quarantine_bucket, 'privateObjectKey', media.private_object_key
      ) as object from artisan.media_assets as media
      where media.id = v_task.target_id
        and v_task.action in (
          'delete_quarantine_original','delete_rejected_media','delete_abandoned_upload','delete_account_media'
        )
      union all
      select pg_catalog.jsonb_build_object(
        'kind', 'quarantineCaption', 'storageProvider', media.storage_provider,
        'bucket', media.quarantine_bucket,
        'privateObjectKey',
          media.owner_user_id::text || '/' || media.artwork_id::text || '/' ||
          media.id::text || '/captions/' || pg_catalog.lower(track.value ->> 'id') || '.vtt'
      ) from artisan.media_assets as media
      cross join lateral pg_catalog.jsonb_array_elements(media.caption_tracks) as track(value)
      where media.id = v_task.target_id
        and media.private_object_key = media.owner_user_id::text || '/' ||
          media.artwork_id::text || '/' || media.id::text || '/original'
        and track.value ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_task.action in (
          'delete_quarantine_original','delete_rejected_media','delete_abandoned_upload','delete_account_media'
        )
      union all
      select pg_catalog.jsonb_build_object(
        'kind', 'approvedDerivative', 'storageProvider', media.storage_provider,
        'bucket', media.approved_bucket, 'privateObjectKey', media.approved_object_key
      ) from artisan.media_assets as media
      where media.id = v_task.target_id and media.approved_object_key is not null
        and v_task.action in ('delete_rejected_media','delete_abandoned_upload','delete_account_media')
      union all
      select pg_catalog.jsonb_build_object(
        'kind', 'thumbnail', 'storageProvider', media.storage_provider,
        'bucket', media.thumbnail_bucket, 'privateObjectKey', media.thumbnail_object_key
      ) from artisan.media_assets as media
      where media.id = v_task.target_id and media.thumbnail_object_key is not null
        and v_task.action in ('delete_rejected_media','delete_abandoned_upload','delete_account_media')
      union all
      select pg_catalog.jsonb_build_object(
        'kind', 'caption', 'storageProvider', media.storage_provider,
        'bucket', 'artisan-approved', 'privateObjectKey', caption.approved_object_key
      ) from artisan.media_caption_tracks as caption
      join artisan.media_assets as media on media.id = caption.media_asset_id
      where caption.media_asset_id = v_task.target_id and caption.status <> 'removed'
        and v_task.action in ('delete_rejected_media','delete_abandoned_upload','delete_account_media')
    ) as resolved;
  end if;
  return pg_catalog.jsonb_build_object(
    'taskId', v_task.id, 'targetType', v_task.target_type,
    'targetId', v_task.target_id, 'action', v_task.action,
    'objects', coalesce(v_objects, '[]'::jsonb)
  );
end;
$$;

alter function public.artisan_get_retention_task_asset(text, uuid) owner to postgres;
revoke all privileges on function public.artisan_get_retention_task_asset(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_get_retention_task_asset(text, uuid) to service_role;

create or replace function public.artisan_complete_retention_task(
  p_client_request_id uuid,
  p_worker_id text,
  p_task_id uuid,
  p_completion_evidence_sha256 text,
  p_deleted_object_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task artisan.retention_tasks%rowtype;
  v_cleanup_request_id uuid;
  v_cleanup_expected integer;
  v_cleanup_completed integer;
  v_cleanup_evidence text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_completion_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_deleted_object_count not between 0 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_retention_completion_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_retention_task_completed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'taskId', p_task_id,
      'completionEvidenceSha256', p_completion_evidence_sha256,
      'deletedObjectCount', p_deleted_object_count
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_task from artisan.retention_tasks
  where id = p_task_id and status = 'processing'
    and claimed_by = p_worker_id and lease_expires_at > pg_catalog.now()
  for update;
  if private.artisan_retention_target_has_legal_hold(v_task.target_type, v_task.target_id) then
    update artisan.retention_tasks
    set status = 'blocked_by_legal_hold', legal_hold_checked_at = pg_catalog.now(),
        claimed_by = null, claimed_at = null, lease_expires_at = null
    where id = p_task_id returning * into v_task;
    v_response := pg_catalog.jsonb_build_object(
      'taskId', v_task.id, 'status', v_task.status,
      'completedAt', null, 'deletedObjectCount', 0
    );
    return private.community_idempotency_finish(p_client_request_id, v_response);
  end if;
  update artisan.retention_tasks
  set status = 'completed', completed_at = pg_catalog.now(),
      completion_evidence_sha256 = p_completion_evidence_sha256,
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      last_error_code = null, last_error_at = null,
      last_error_evidence_sha256 = null
  where id = p_task_id returning * into v_task;
  if v_task.target_type = 'media_asset'
     and v_task.action in ('delete_quarantine_original','delete_rejected_media','delete_abandoned_upload','delete_account_media') then
    update artisan.media_assets
    set retention_expires_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = v_task.target_id;
    if v_task.action in ('delete_rejected_media','delete_abandoned_upload','delete_account_media') then
      update artisan.media_caption_tracks set status = 'removed', updated_at = pg_catalog.now()
      where media_asset_id = v_task.target_id and status <> 'removed';
    end if;
    if v_task.action = 'delete_account_media' then
      update artisan.media_assets
      set processing_status = 'removed', moderation_status = case
            when moderation_status = 'legal_hold' then moderation_status else 'removed' end,
          updated_at = pg_catalog.now()
      where id = v_task.target_id;
      select asset.lifecycle_request_id into v_cleanup_request_id
      from artisan.account_cleanup_assets as asset
      where asset.retention_task_id = v_task.id;
      if v_cleanup_request_id is not null then
        select run.expected_asset_count,
          pg_catalog.count(*) filter (where task.status = 'completed')::integer,
          pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(
            task.id::text || ':' || coalesce(task.completion_evidence_sha256, ''),
            ',' order by task.id
          ), 'empty'), 'sha256'), 'hex')
        into v_cleanup_expected, v_cleanup_completed, v_cleanup_evidence
        from artisan.account_cleanup_runs as run
        left join artisan.account_cleanup_assets as asset
          on asset.lifecycle_request_id = run.lifecycle_request_id
        left join artisan.retention_tasks as task on task.id = asset.retention_task_id
        where run.lifecycle_request_id = v_cleanup_request_id
        group by run.expected_asset_count;
        update artisan.account_cleanup_runs
        set completed_asset_count = v_cleanup_completed,
            status = case when v_cleanup_completed = v_cleanup_expected
              then 'completed' else 'processing' end,
            completion_evidence_sha256 = case when v_cleanup_completed = v_cleanup_expected
              then v_cleanup_evidence else null end,
            completed_at = case when v_cleanup_completed = v_cleanup_expected
              then pg_catalog.now() else null end,
            updated_at = pg_catalog.now()
        where lifecycle_request_id = v_cleanup_request_id;
      end if;
    end if;
  elsif v_task.target_type = 'notification'
     and v_task.action = 'expire_notification' then
    delete from artisan.notifications where id = v_task.target_id;
  end if;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'artisan_retention_task_completed',
    'artisan_retention_task', p_task_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'targetType', v_task.target_type,
      'targetId', v_task.target_id, 'retentionAction', v_task.action,
      'deletedObjectCount', p_deleted_object_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'taskId', v_task.id, 'status', v_task.status,
    'completedAt', v_task.completed_at,
    'deletedObjectCount', p_deleted_object_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_complete_retention_task(uuid, text, uuid, text, integer) owner to postgres;
revoke all privileges on function public.artisan_complete_retention_task(uuid, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_complete_retention_task(uuid, text, uuid, text, integer) to service_role;

create or replace function public.artisan_fail_retention_task(
  p_client_request_id uuid,
  p_worker_id text,
  p_task_id uuid,
  p_error_code text,
  p_failure_evidence_sha256 text,
  p_retry_after_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task artisan.retention_tasks%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,99}$'
     or coalesce(p_failure_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_retry_after_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'artisan_retention_failure_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'artisan_retention_task_failed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'taskId', p_task_id,
      'errorCode', p_error_code, 'failureEvidenceSha256', p_failure_evidence_sha256,
      'retryAfterSeconds', p_retry_after_seconds
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_task from artisan.retention_tasks
  where id = p_task_id and status = 'processing'
    and claimed_by = p_worker_id and lease_expires_at > pg_catalog.now()
  for update;
  update artisan.retention_tasks
  set status = case when attempt_count >= 20 then 'abandoned' else 'failed' end,
      due_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      claimed_by = null, claimed_at = null, lease_expires_at = null,
      last_error_code = p_error_code, last_error_at = pg_catalog.now(),
      last_error_evidence_sha256 = p_failure_evidence_sha256
  where id = p_task_id returning * into v_task;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'artisan_retention_task_failed',
    'artisan_retention_task', p_task_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'errorCode', p_error_code,
      'status', v_task.status, 'attemptCount', v_task.attempt_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'taskId', v_task.id, 'status', v_task.status,
    'dueAt', v_task.due_at, 'attemptCount', v_task.attempt_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_fail_retention_task(uuid, text, uuid, text, text, integer) owner to postgres;
revoke all privileges on function public.artisan_fail_retention_task(uuid, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_fail_retention_task(uuid, text, uuid, text, text, integer) to service_role;

create or replace function public.artisan_update_comment(
  p_actor_user_id uuid, p_client_request_id uuid, p_comment_id uuid,
  p_body text, p_mentioned_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.update_current_user_artisan_comment(
    p_client_request_id, p_comment_id, p_body, p_mentioned_user_ids
  );
end;
$$;

alter function public.artisan_update_comment(uuid, uuid, uuid, text, uuid[]) owner to postgres;
revoke all privileges on function public.artisan_update_comment(uuid, uuid, uuid, text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_comment(uuid, uuid, uuid, text, uuid[]) to service_role;

create or replace function public.artisan_update_comment_by_handles(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_comment_id uuid,
  p_body text,
  p_mentioned_handles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentions uuid[];
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_mentions := private.artisan_resolve_mention_handles(
    p_actor_user_id, p_mentioned_handles
  );
  return public.artisan_update_comment(
    p_actor_user_id, p_client_request_id, p_comment_id, p_body, v_mentions
  );
end;
$$;

alter function public.artisan_update_comment_by_handles(uuid, uuid, uuid, text, text[]) owner to postgres;
revoke all privileges on function public.artisan_update_comment_by_handles(uuid, uuid, uuid, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_comment_by_handles(uuid, uuid, uuid, text, text[]) to service_role;

create or replace function public.artisan_delete_comment(
  p_actor_user_id uuid, p_client_request_id uuid, p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.delete_current_user_artisan_comment(p_client_request_id, p_comment_id);
end;
$$;

alter function public.artisan_delete_comment(uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_delete_comment(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_delete_comment(uuid, uuid, uuid) to service_role;

create or replace function public.artisan_submit_judge_conflict(
  p_actor_user_id uuid, p_client_request_id uuid, p_challenge_id uuid,
  p_disclosure text, p_recuse boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.submit_current_user_judge_conflict_disclosure(
    p_client_request_id, p_challenge_id, p_disclosure, p_recuse
  );
end;
$$;

alter function public.artisan_submit_judge_conflict(uuid, uuid, uuid, text, boolean) owner to postgres;
revoke all privileges on function public.artisan_submit_judge_conflict(uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_submit_judge_conflict(uuid, uuid, uuid, text, boolean) to service_role;

create or replace function public.artisan_submit_challenge_score(
  p_actor_user_id uuid, p_client_request_id uuid, p_challenge_id uuid,
  p_submission_id uuid, p_rubric_version text, p_score jsonb,
  p_private_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.submit_current_user_challenge_score(
    p_client_request_id, p_challenge_id, p_submission_id,
    p_rubric_version, p_score, p_private_note
  );
end;
$$;

alter function public.artisan_submit_challenge_score(uuid, uuid, uuid, uuid, text, jsonb, text) owner to postgres;
revoke all privileges on function public.artisan_submit_challenge_score(uuid, uuid, uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_submit_challenge_score(uuid, uuid, uuid, uuid, text, jsonb, text) to service_role;

create or replace function public.artisan_respond_award(
  p_actor_user_id uuid, p_client_request_id uuid, p_award_id uuid,
  p_decision text, p_document_version text, p_content_sha256 text,
  p_private_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.respond_current_user_artisan_award(
    p_client_request_id, p_award_id, p_decision,
    p_document_version, p_content_sha256, p_private_note
  );
end;
$$;

alter function public.artisan_respond_award(uuid, uuid, uuid, text, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_respond_award(uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_respond_award(uuid, uuid, uuid, text, text, text, text) to service_role;

create or replace function public.get_community_guardian_relationship_for_provider(
  p_actor_user_id uuid,
  p_relationship_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'relationshipId', relationship.id,
      'guardianUserId', relationship.guardian_user_id,
      'dependentUserId', relationship.dependent_user_id,
      'relationshipType', relationship.relationship_type,
      'ageBand', participation.age_band,
      'legalDocuments', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'documentKey', document.document_key,
          'documentVersion', document.document_version,
          'contentSha256', document.content_sha256,
          'publicPath', document.public_path
        ) order by pg_catalog.array_position(
          array['guardian_consent_notice','under13_privacy_notice']::text[],
          document.document_key
        ))
        from private.community_active_legal_documents as active_document
        join private.community_legal_document_versions as document
          on document.document_key = active_document.document_key
         and document.document_version = active_document.document_version
         and document.status = 'approved'
        where document.document_key = 'guardian_consent_notice'
           or (participation.age_band = 'under_13'
             and document.document_key = 'under13_privacy_notice')
      ), '[]'::jsonb),
      'status', relationship.status,
      'expiresAt', relationship.expires_at
    )
    from private.guardian_relationships as relationship
    join private.account_participation as participation
      on participation.user_id = relationship.dependent_user_id
    where relationship.id = p_relationship_id
      and relationship.guardian_user_id = p_actor_user_id
      and relationship.status = 'active'
      and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
      and private.community_account_is_recoverable(relationship.guardian_user_id)
      and private.community_account_is_recoverable(relationship.dependent_user_id)
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_community_guardian_relationship_for_provider(uuid, uuid) owner to postgres;
revoke all privileges on function public.get_community_guardian_relationship_for_provider(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_guardian_relationship_for_provider(uuid, uuid) to service_role;

create or replace function public.start_community_provider_transaction(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_provider text,
  p_purpose text,
  p_subject_user_id uuid,
  p_guardian_user_id uuid,
  p_guardian_relationship_id uuid,
  p_relationship_type text,
  p_consent_scope text,
  p_document_key text,
  p_document_version text,
  p_content_sha256 text,
  p_authority_expires_at timestamptz,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction private.community_provider_transactions%rowtype;
  v_child_document private.community_legal_document_versions%rowtype;
  v_subject_age_band text;
  v_replay jsonb;
  v_response jsonb;
  v_capability text;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  v_capability := case when p_purpose = 'age_assurance'
    then 'community_age_assurance_manage' else 'community_guardian_manage' end;
  select participation.age_band into v_subject_age_band
  from private.account_participation as participation
  where participation.user_id = p_subject_user_id;
  if p_actor_user_id <> p_subject_user_id
     and p_actor_user_id is distinct from p_guardian_user_id then
    perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  elsif p_actor_aal not in ('aal1','aal2')
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'community_provider_actor_invalid';
  end if;
  if p_provider !~ '^[a-z][a-z0-9_-]{2,80}$'
     or p_purpose not in ('age_assurance','guardian_relationship','guardian_consent')
     or not private.community_account_is_recoverable(p_subject_user_id)
     or (p_purpose = 'age_assurance' and p_guardian_user_id is not null)
     or (p_purpose <> 'age_assurance' and (
       p_guardian_user_id is null or p_guardian_user_id = p_subject_user_id
       or not private.community_account_is_recoverable(p_guardian_user_id)
     ))
     or (p_purpose = 'age_assurance' and (
       p_guardian_relationship_id is not null or p_relationship_type is not null
       or p_consent_scope is not null or p_document_key is not null
       or p_document_version is not null or p_content_sha256 is not null
       or p_authority_expires_at is not null
     ))
     or (p_purpose = 'guardian_relationship' and (
       p_guardian_relationship_id is not null
       or p_relationship_type not in ('parent','legal_guardian','court_authorized_guardian')
       or p_consent_scope is not null or p_document_key is not null
       or p_document_version is not null or p_content_sha256 is not null
       or p_authority_expires_at is null or p_authority_expires_at <= pg_catalog.now()
     ))
     or (p_purpose = 'guardian_consent' and (
       p_guardian_relationship_id is null or p_relationship_type is not null
       or p_consent_scope not in (
         'account','public_profile','artisan_membership','artisan_posting',
         'artisan_commenting','artisan_uploading','artisan_challenges',
         'artisan_notifications','account_export','account_deletion'
       )
       or p_authority_expires_at is null or p_authority_expires_at <= pg_catalog.now()
       or coalesce(p_content_sha256, '') !~ '^[0-9a-f]{64}$'
       or (v_subject_age_band = 'under_13' and (
         p_document_key <> 'guardian_consent_notice'
         or not exists (
           select 1
           from private.community_active_legal_documents as child_active
           join private.community_legal_document_versions as child_document
             on child_document.document_key = child_active.document_key
            and child_document.document_version = child_active.document_version
            and child_document.status = 'approved'
           where child_active.document_key = 'under13_privacy_notice'
         )
       ))
       or not exists (
         select 1
         from private.guardian_relationships as relationship
         where relationship.id = p_guardian_relationship_id
           and relationship.guardian_user_id = p_guardian_user_id
           and relationship.dependent_user_id = p_subject_user_id
           and relationship.status = 'active'
           and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
       )
       or not exists (
         select 1
         from private.community_active_legal_documents as active_document
         join private.community_legal_document_versions as document
           on document.document_key = active_document.document_key
          and document.document_version = active_document.document_version
          and document.status = 'approved'
         where document.document_key = p_document_key
           and document.document_version = p_document_version
           and document.content_sha256 = p_content_sha256
       )
     ))
     or coalesce(p_external_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_state_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_expires_at <= pg_catalog.now()
     or p_expires_at > pg_catalog.now() + interval '24 hours'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_provider_transaction_invalid';
  end if;
  if p_purpose = 'guardian_consent' and v_subject_age_band = 'under_13' then
    select child_document.* into strict v_child_document
    from private.community_active_legal_documents as child_active
    join private.community_legal_document_versions as child_document
      on child_document.document_key = child_active.document_key
     and child_document.document_version = child_active.document_version
     and child_document.status = 'approved'
    where child_active.document_key = 'under13_privacy_notice';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'community_provider_transaction_started',
    pg_catalog.jsonb_build_object(
      'provider', p_provider, 'purpose', p_purpose,
      'subjectUserId', p_subject_user_id, 'guardianUserId', p_guardian_user_id,
      'guardianRelationshipId', p_guardian_relationship_id,
      'relationshipType', p_relationship_type, 'consentScope', p_consent_scope,
      'documentKey', p_document_key, 'documentVersion', p_document_version,
      'contentSha256', p_content_sha256,
      'childPrivacyDocumentKey', v_child_document.document_key,
      'childPrivacyDocumentVersion', v_child_document.document_version,
      'childPrivacyContentSha256', v_child_document.content_sha256,
      'authorityExpiresAt', p_authority_expires_at,
      'externalReferenceSha256', p_external_reference_sha256,
      'stateNonceSha256', p_state_nonce_sha256, 'expiresAt', p_expires_at,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into private.community_provider_transactions(
    client_request_id, provider, purpose, subject_user_id, guardian_user_id,
    guardian_relationship_id, relationship_type, consent_scope,
    document_key, document_version, content_sha256,
    child_privacy_document_key, child_privacy_document_version,
    child_privacy_content_sha256, authority_expires_at,
    external_reference_sha256, state_nonce_sha256, created_by, expires_at
  ) values (
    p_client_request_id, p_provider, p_purpose, p_subject_user_id, p_guardian_user_id,
    p_guardian_relationship_id, p_relationship_type, p_consent_scope,
    p_document_key, p_document_version, p_content_sha256,
    v_child_document.document_key, v_child_document.document_version,
    v_child_document.content_sha256, p_authority_expires_at,
    p_external_reference_sha256, p_state_nonce_sha256, p_actor_user_id, p_expires_at
  ) returning * into v_transaction;
  insert into private.community_provider_transaction_events(
    client_request_id, provider_transaction_id, actor_user_id,
    action, private_reason
  ) values (
    p_client_request_id, v_transaction.id, p_actor_user_id,
    'started', pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id,
    case when p_actor_user_id in (p_subject_user_id, p_guardian_user_id) then 'user' else 'staff' end,
    case when p_actor_user_id in (p_subject_user_id, p_guardian_user_id) then null else v_capability end,
    'community_provider_transaction_started', 'community_provider_transaction',
    v_transaction.id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('provider', p_provider, 'purpose', p_purpose, 'subjectUserId', p_subject_user_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'providerTransactionId', v_transaction.id, 'provider', v_transaction.provider,
    'purpose', v_transaction.purpose, 'status', v_transaction.status,
    'legalDocuments', case when v_transaction.purpose = 'guardian_consent' then
      case when v_transaction.child_privacy_document_key is null then
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'documentKey', v_transaction.document_key,
          'documentVersion', v_transaction.document_version,
          'contentSha256', v_transaction.content_sha256
        )) else pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'documentKey', v_transaction.document_key,
            'documentVersion', v_transaction.document_version,
            'contentSha256', v_transaction.content_sha256
          ), pg_catalog.jsonb_build_object(
            'documentKey', v_transaction.child_privacy_document_key,
            'documentVersion', v_transaction.child_privacy_document_version,
            'contentSha256', v_transaction.child_privacy_content_sha256
          )
        ) end else '[]'::jsonb end,
    'expiresAt', v_transaction.expires_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.start_community_provider_transaction(uuid, text, uuid, text, text, uuid, uuid, uuid, text, text, text, text, text, timestamptz, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.start_community_provider_transaction(uuid, text, uuid, text, text, uuid, uuid, uuid, text, text, text, text, text, timestamptz, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.start_community_provider_transaction(uuid, text, uuid, text, text, uuid, uuid, uuid, text, text, text, text, text, timestamptz, text, text, timestamptz, text) to service_role;

create or replace function public.get_community_provider_transaction(
  p_provider text,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'providerTransactionId', transaction.id,
      'provider', transaction.provider, 'purpose', transaction.purpose,
      'subjectUserId', transaction.subject_user_id,
      'guardianUserId', transaction.guardian_user_id,
      'guardianRelationshipId', transaction.guardian_relationship_id,
      'relationshipType', transaction.relationship_type,
      'consentScope', transaction.consent_scope,
      'documentKey', transaction.document_key,
      'documentVersion', transaction.document_version,
      'contentSha256', transaction.content_sha256,
      'childPrivacyDocumentKey', transaction.child_privacy_document_key,
      'childPrivacyDocumentVersion', transaction.child_privacy_document_version,
      'childPrivacyContentSha256', transaction.child_privacy_content_sha256,
      'legalDocuments', case when transaction.purpose = 'guardian_consent' then
        case when transaction.child_privacy_document_key is null then
          pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'documentKey', transaction.document_key,
            'documentVersion', transaction.document_version,
            'contentSha256', transaction.content_sha256
          )) else pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'documentKey', transaction.document_key,
              'documentVersion', transaction.document_version,
              'contentSha256', transaction.content_sha256
            ), pg_catalog.jsonb_build_object(
              'documentKey', transaction.child_privacy_document_key,
              'documentVersion', transaction.child_privacy_document_version,
              'contentSha256', transaction.child_privacy_content_sha256
            )
          ) end else '[]'::jsonb end,
      'authorityExpiresAt', transaction.authority_expires_at,
      'status', transaction.status, 'expiresAt', transaction.expires_at
    ) from private.community_provider_transactions as transaction
    where transaction.provider = p_provider
      and transaction.external_reference_sha256 = p_external_reference_sha256
      and transaction.state_nonce_sha256 = p_state_nonce_sha256
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_community_provider_transaction(text, text, text) owner to postgres;
revoke all privileges on function public.get_community_provider_transaction(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_provider_transaction(text, text, text) to service_role;

create or replace function public.consume_community_provider_transaction(
  p_client_request_id uuid,
  p_provider text,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text,
  p_result_event_sha256 text,
  p_result_status text,
  p_evidence_code text,
  p_age_band text,
  p_assurance_status text,
  p_assurance_expires_at timestamptz,
  p_jurisdiction_code text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction private.community_provider_transactions%rowtype;
  v_relationship private.guardian_relationships%rowtype;
  v_consent private.guardian_consents%rowtype;
  v_replay jsonb;
  v_response jsonb;
  v_participation_state text;
begin
  if not private.community_caller_is_service_role()
     or p_result_status not in ('verified','failed')
     or coalesce(p_external_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_state_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_result_event_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_evidence_code, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_provider_callback_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'community_provider_transaction_consumed',
    pg_catalog.jsonb_build_object(
      'provider', p_provider, 'externalReferenceSha256', p_external_reference_sha256,
      'stateNonceSha256', p_state_nonce_sha256,
      'resultEventSha256', p_result_event_sha256, 'resultStatus', p_result_status,
      'evidenceCode', p_evidence_code, 'ageBand', p_age_band,
      'assuranceStatus', p_assurance_status,
      'assuranceExpiresAt', p_assurance_expires_at,
      'jurisdictionCode', p_jurisdiction_code,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_transaction
  from private.community_provider_transactions
  where provider = p_provider
    and external_reference_sha256 = p_external_reference_sha256
    and state_nonce_sha256 = p_state_nonce_sha256
    and status = 'pending'
  for update;
  if v_transaction.expires_at <= pg_catalog.now() then
    raise exception using errcode = '55000', message = 'community_provider_transaction_expired';
  end if;
  if v_transaction.purpose <> 'age_assurance'
     and (p_age_band is not null or p_assurance_status is not null
       or p_assurance_expires_at is not null or p_jurisdiction_code is not null) then
    raise exception using errcode = '22023', message = 'community_provider_callback_purpose_mismatch';
  end if;
  if v_transaction.purpose = 'age_assurance' and p_result_status = 'failed'
     and (p_age_band is not null or p_assurance_status is not null
       or p_assurance_expires_at is not null or p_jurisdiction_code is not null) then
    raise exception using errcode = '22023', message = 'community_provider_failed_result_must_be_empty';
  end if;
  if v_transaction.purpose = 'age_assurance' and p_result_status = 'verified' and (
    p_age_band not in ('under_13','13_to_15','16_to_17','18_plus')
    or p_assurance_status not in ('age_estimated','age_verified')
    or coalesce(p_jurisdiction_code, '') !~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'
    or p_assurance_expires_at is null
    or p_assurance_expires_at <= pg_catalog.now()
    or p_assurance_expires_at > pg_catalog.now() + interval '5 years'
  ) then
    raise exception using errcode = '22023', message = 'community_provider_age_result_invalid';
  end if;
  update private.community_provider_transactions
  set status = p_result_status, result_event_sha256 = p_result_event_sha256,
      evidence_code = p_evidence_code, consumed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_transaction.id;
  insert into private.community_provider_transaction_events(
    client_request_id, provider_transaction_id, action,
    result_event_sha256, private_reason
  ) values (
    p_client_request_id, v_transaction.id, p_result_status,
    p_result_event_sha256, pg_catalog.btrim(p_private_reason)
  );
  if v_transaction.purpose = 'age_assurance' and p_result_status = 'verified' then
    insert into private.age_assurance_events(
      client_request_id, user_id, actor_user_id, provider,
      provider_reference_sha256, age_band, assurance_status,
      jurisdiction_code, expires_at, private_reason
    ) values (
      p_client_request_id, v_transaction.subject_user_id, null, p_provider,
      p_result_event_sha256, p_age_band, p_assurance_status,
      p_jurisdiction_code, p_assurance_expires_at, pg_catalog.btrim(p_private_reason)
    );
    update private.account_participation
    set age_band = p_age_band, assurance_status = p_assurance_status,
        assurance_method = case when p_assurance_status = 'age_estimated'
          then 'age_estimation' else 'provider_age_check' end,
        assurance_provider = p_provider,
        jurisdiction_code = p_jurisdiction_code,
        assurance_expires_at = p_assurance_expires_at,
        participation_state = case
          when p_age_band in ('13_to_15','16_to_17') then 'teen_pending'
          when p_age_band = 'under_13' then 'under13_pending'
          else 'read_only'
        end,
        evaluated_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where user_id = v_transaction.subject_user_id;
    v_participation_state := private.recompute_community_participation(v_transaction.subject_user_id);
  elsif v_transaction.purpose <> 'age_assurance' then
    insert into private.guardian_provider_events(
      provider, provider_event_id_sha256, event_type,
      payload_sha256, processing_status, processed_at
    ) values (
      p_provider, p_result_event_sha256,
      v_transaction.purpose || '_' || p_result_status,
      p_result_event_sha256, 'processed', pg_catalog.now()
    );
    if p_result_status = 'verified' and v_transaction.purpose = 'guardian_relationship' then
      insert into private.guardian_relationships(
        client_request_id, guardian_user_id, dependent_user_id,
        relationship_type, status, verification_provider,
        provider_reference_sha256, verified_at, expires_at
      ) values (
        p_client_request_id, v_transaction.guardian_user_id,
        v_transaction.subject_user_id, v_transaction.relationship_type,
        'active', p_provider, p_result_event_sha256, pg_catalog.now(),
        v_transaction.authority_expires_at
      ) returning * into v_relationship;
      if exists (
        select 1 from private.account_participation as participation
        where participation.user_id = v_transaction.subject_user_id
          and participation.age_band = 'under_13'
      ) then
        insert into private.age_assurance_events(
          client_request_id, user_id, actor_user_id, provider,
          provider_reference_sha256, age_band, assurance_status,
          expires_at, private_reason
        ) values (
          gen_random_uuid(), v_transaction.subject_user_id, null, p_provider,
          p_result_event_sha256, 'under_13', 'guardian_verified',
          v_transaction.authority_expires_at, pg_catalog.btrim(p_private_reason)
        );
        update private.account_participation
        set assurance_status = 'guardian_verified',
            assurance_method = 'guardian_provider',
            assurance_provider = p_provider,
            assurance_expires_at = v_transaction.authority_expires_at,
            updated_at = pg_catalog.now()
        where user_id = v_transaction.subject_user_id and age_band = 'under_13';
      end if;
      v_participation_state := private.recompute_community_participation(v_transaction.subject_user_id);
    elsif p_result_status = 'verified' and v_transaction.purpose = 'guardian_consent' then
      select * into strict v_relationship
      from private.guardian_relationships
      where id = v_transaction.guardian_relationship_id
        and guardian_user_id = v_transaction.guardian_user_id
        and dependent_user_id = v_transaction.subject_user_id
        and status = 'active'
        and (expires_at is null or expires_at > pg_catalog.now())
      for share;
      if (v_relationship.expires_at is not null
          and v_transaction.authority_expires_at > v_relationship.expires_at)
         or not exists (
           select 1
           from private.community_active_legal_documents as active_document
           join private.community_legal_document_versions as document
             on document.document_key = active_document.document_key
            and document.document_version = active_document.document_version
            and document.status = 'approved'
           where document.document_key = v_transaction.document_key
             and document.document_version = v_transaction.document_version
             and document.content_sha256 = v_transaction.content_sha256
         )
         or (v_transaction.child_privacy_document_key is not null and not exists (
           select 1
           from private.community_active_legal_documents as child_active
           join private.community_legal_document_versions as child_document
             on child_document.document_key = child_active.document_key
            and child_document.document_version = child_active.document_version
            and child_document.status = 'approved'
           where child_document.document_key = v_transaction.child_privacy_document_key
             and child_document.document_version = v_transaction.child_privacy_document_version
             and child_document.content_sha256 = v_transaction.child_privacy_content_sha256
         )) then
        raise exception using errcode = '55000', message = 'community_provider_consent_intent_stale';
      end if;
      for v_consent in
        update private.guardian_consents
        set status = 'superseded'
        where dependent_user_id = v_transaction.subject_user_id
          and consent_scope = v_transaction.consent_scope
          and status = 'active'
        returning *
      loop
        insert into private.guardian_consent_events(
          client_request_id, consent_id, relationship_id,
          actor_user_id, action, private_reason
        ) values (
          gen_random_uuid(), v_consent.id, v_consent.relationship_id,
          v_transaction.guardian_user_id, 'superseded', pg_catalog.btrim(p_private_reason)
        );
      end loop;
      insert into private.guardian_consents(
        client_request_id, relationship_id, dependent_user_id,
        consent_scope, document_key, document_version,
        content_sha256, child_privacy_document_key,
        child_privacy_document_version, child_privacy_content_sha256,
        expires_at
      ) values (
        p_client_request_id, v_transaction.guardian_relationship_id,
        v_transaction.subject_user_id, v_transaction.consent_scope,
        v_transaction.document_key, v_transaction.document_version,
        v_transaction.content_sha256,
        v_transaction.child_privacy_document_key,
        v_transaction.child_privacy_document_version,
        v_transaction.child_privacy_content_sha256,
        v_transaction.authority_expires_at
      ) returning * into v_consent;
      insert into private.guardian_consent_events(
        client_request_id, consent_id, relationship_id,
        actor_user_id, action, private_reason
      ) values (
        p_client_request_id, v_consent.id, v_consent.relationship_id,
        v_transaction.guardian_user_id, 'granted', pg_catalog.btrim(p_private_reason)
      );
      v_participation_state := private.recompute_community_participation(v_transaction.subject_user_id);
    end if;
  end if;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id,
    private_reason, metadata
  ) values (
    'provider', 'community_provider_transaction_' || p_result_status,
    'community_provider_transaction', v_transaction.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'provider', p_provider, 'purpose', v_transaction.purpose,
      'subjectUserId', v_transaction.subject_user_id,
      'guardianUserId', v_transaction.guardian_user_id,
      'guardianRelationshipId', coalesce(v_consent.relationship_id, v_relationship.id, v_transaction.guardian_relationship_id),
      'consentId', v_consent.id,
      'participationState', v_participation_state,
      'resultEventSha256', p_result_event_sha256
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'providerTransactionId', v_transaction.id,
    'purpose', v_transaction.purpose, 'status', p_result_status,
    'subjectUserId', v_transaction.subject_user_id,
    'guardianUserId', v_transaction.guardian_user_id,
    'guardianRelationshipId', coalesce(v_consent.relationship_id, v_relationship.id, v_transaction.guardian_relationship_id),
    'consentId', v_consent.id,
    'participationState', v_participation_state
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.consume_community_provider_transaction(uuid, text, text, text, text, text, text, text, text, timestamptz, text, text) owner to postgres;
revoke all privileges on function public.consume_community_provider_transaction(uuid, text, text, text, text, text, text, text, text, timestamptz, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_community_provider_transaction(uuid, text, text, text, text, text, text, text, text, timestamptz, text, text) to service_role;

-- Bounded lifecycle orchestration. SQL records evidence, but never claims that
-- Storage or Auth deletion succeeded until a trusted Worker supplies the exact
-- phase result and (for Auth) a hashed provider receipt.
create or replace function public.claim_community_lifecycle_work(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_limit integer,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_items jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_limit not between 1 and 20
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'community_lifecycle_claim_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'community_lifecycle_work_claimed',
    pg_catalog.jsonb_build_object('limit', p_limit, 'privateReason', pg_catalog.btrim(p_private_reason))
  );
  if v_replay is not null then return v_replay; end if;
  with selected as (
    select request.id
    from private.account_lifecycle_requests as request
    where request.status = 'operator_review'
      and (request.claimed_by is null or request.claimed_at < pg_catalog.now() - interval '15 minutes')
      and (request.cooling_period_ends_at is null or request.cooling_period_ends_at <= pg_catalog.now())
      and not exists (
        select 1 from private.account_legal_holds as hold
        where hold.user_id = request.user_id and hold.lifted_at is null
      )
    order by request.submitted_at, request.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.account_lifecycle_requests as request
    set claimed_by = p_actor_user_id, claimed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    from selected
    where request.id = selected.id
    returning request.id, request.user_id, request.action, request.status,
      request.submitted_at, request.cooling_period_ends_at
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'requestId', claimed.id, 'userId', claimed.user_id,
    'action', claimed.action, 'status', claimed.status,
    'submittedAt', claimed.submitted_at,
    'coolingPeriodEndsAt', claimed.cooling_period_ends_at
  ) order by claimed.submitted_at, claimed.id), '[]'::jsonb)
  into v_items from claimed;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'community_lifecycle_manage',
    'community_lifecycle_work_claimed', 'account_lifecycle_queue',
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('count', pg_catalog.jsonb_array_length(v_items))
  );
  v_response := pg_catalog.jsonb_build_object('items', v_items);
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.claim_community_lifecycle_work(uuid, text, uuid, integer, text) owner to postgres;
revoke all privileges on function public.claim_community_lifecycle_work(uuid, text, uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_community_lifecycle_work(uuid, text, uuid, integer, text) to service_role;

create or replace function public.get_community_lifecycle_work_item(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  select coalesce(pg_catalog.jsonb_build_object(
    'requestId', request.id, 'userId', request.user_id,
    'action', request.action, 'status', request.status,
    'noticeVersion', request.notice_version,
    'legalHoldPresent', request.legal_hold_present,
    'submittedAt', request.submitted_at,
    'coolingPeriodEndsAt', request.cooling_period_ends_at,
    'claimedBy', request.claimed_by, 'claimedAt', request.claimed_at,
    'handoff', case when handoff.lifecycle_request_id is null then null else pg_catalog.jsonb_build_object(
      'contentDisposition', handoff.content_disposition,
      'storageInventoryCompletedAt', handoff.storage_inventory_completed_at,
      'ownedStorageObjectCount', handoff.owned_storage_object_count,
      'storageCleanupCompletedAt', handoff.storage_cleanup_completed_at,
      'authDeletionRequestedAt', handoff.auth_deletion_requested_at,
      'authDeletionConfirmedAt', handoff.auth_deletion_confirmed_at,
      'hasAuthProviderReceipt', handoff.auth_provider_receipt_sha256 is not null
    ) end
  ), '{}'::jsonb)
  into v_result
  from private.account_lifecycle_requests as request
  left join private.account_deletion_handoffs as handoff
    on handoff.lifecycle_request_id = request.id
  where request.id = p_request_id;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

alter function public.get_community_lifecycle_work_item(uuid, text, uuid) owner to postgres;
revoke all privileges on function public.get_community_lifecycle_work_item(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_lifecycle_work_item(uuid, text, uuid) to service_role;

-- A trusted export Worker reads only requester-owned sections through this
-- deterministic, UUID-cursor projection. It never receives moderation notes,
-- provider payloads, secret material, or private Storage/R2 object keys.
create or replace function public.get_community_export_snapshot(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_request_id uuid,
  p_section text,
  p_limit integer,
  p_after_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_items jsonb := '[]'::jsonb;
  v_next_id uuid;
  v_saved_sub text := current_setting('request.jwt.claim.sub', true);
  v_saved_role text := current_setting('request.jwt.claim.role', true);
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_section not in (
    'profile','terms','artworks','media','posts','comments',
    'submissions','reports','appeals','notifications',
    'commune_posts','commune_comments','commune_media',
    'commune_code_documents','commune_jobs','commune_abuse_reports',
    'commune_code_reports','forge_profile','forge_drafts',
    'forge_submissions','forge_sandbox','marketplace_library',
    'online_notifications','economic_summary'
  ) then
    raise exception using errcode = '22023', message = 'community_export_section_invalid';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'data_export'
    and status = 'processing' and claimed_by = p_actor_user_id;

  if p_section = 'profile' then
    select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', profile.id,
      'profile', to_jsonb(profile),
      'publicCard', (select to_jsonb(card) from public.profile_public_cards as card
        where card.user_id = profile.id),
      'participation', (select to_jsonb(participation) - 'user_id'
        from private.account_participation as participation where participation.user_id = profile.id),
      'notificationPreferences', (select to_jsonb(preference) - 'user_id'
        from private.community_notification_preferences as preference where preference.user_id = profile.id),
      'artisanMembership', (select to_jsonb(membership) - 'user_id'
        from artisan.memberships as membership where membership.user_id = profile.id)
    )) into v_items
    from public.profiles as profile where profile.id = v_request.user_id;
  elsif p_section = 'terms' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select acceptance.id, acceptance.document_key, acceptance.document_version,
        acceptance.content_sha256, acceptance.accepted_origin, acceptance.accepted_at
      from private.community_terms_acceptances as acceptance
      where acceptance.user_id = v_request.user_id
        and (p_after_id is null or acceptance.id > p_after_id)
      order by acceptance.id limit v_limit
    ) as item;
  elsif p_section = 'artworks' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select artwork.* from artisan.artworks as artwork
      where artwork.owner_user_id = v_request.user_id
        and (p_after_id is null or artwork.id > p_after_id)
      order by artwork.id limit v_limit
    ) as item;
  elsif p_section = 'media' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'storage_provider','quarantine_bucket','private_object_key',
        'approved_bucket','approved_object_key','thumbnail_bucket',
        'thumbnail_object_key','captions_object_key'
      ]::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select media.* from artisan.media_assets as media
      where media.owner_user_id = v_request.user_id
        and (p_after_id is null or media.id > p_after_id)
      order by media.id limit v_limit
    ) as item;
  elsif p_section = 'posts' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select post.* from artisan.forum_posts as post
      where post.owner_user_id = v_request.user_id
        and (p_after_id is null or post.id > p_after_id)
      order by post.id limit v_limit
    ) as item;
  elsif p_section = 'comments' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select comment.* from artisan.comments as comment
      where comment.user_id = v_request.user_id
        and (p_after_id is null or comment.id > p_after_id)
      order by comment.id limit v_limit
    ) as item;
  elsif p_section = 'submissions' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select submission.* from artisan.challenge_submissions as submission
      where submission.submitter_user_id = v_request.user_id
        and (p_after_id is null or submission.id > p_after_id)
      order by submission.id limit v_limit
    ) as item;
  elsif p_section = 'reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - 'reporter_fingerprint_sha256' order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select report.* from artisan.reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'appeals' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewer_user_id','private_reason']::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select appeal.* from artisan.appeals as appeal
      where appeal.appellant_user_id = v_request.user_id
        and (p_after_id is null or appeal.id > p_after_id)
      order by appeal.id limit v_limit
    ) as item;
  elsif p_section = 'notifications' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'claimed_by','claimed_at','lease_expires_at','last_error_code',
        'last_error_at','delivery_evidence_sha256'
      ]::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select notification.* from artisan.notifications as notification
      where notification.user_id = v_request.user_id
        and (p_after_id is null or notification.id > p_after_id)
      order by notification.id limit v_limit
    ) as item;
  elsif p_section = 'commune_posts' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['hidden_by','moderation_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select post.* from public.commune_posts as post
      where post.user_id = v_request.user_id
        and (p_after_id is null or post.id > p_after_id)
      order by post.id limit v_limit
    ) as item;
  elsif p_section = 'commune_comments' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['hidden_by','moderation_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select comment.* from public.commune_comments as comment
      where comment.user_id = v_request.user_id
        and (p_after_id is null or comment.id > p_after_id)
      order by comment.id limit v_limit
    ) as item;
  elsif p_section = 'commune_media' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'storage_bucket','storage_path','hidden_by','moderation_reason'
      ]::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select media.* from public.commune_media as media
      where media.owner_user_id = v_request.user_id
        and (p_after_id is null or media.id > p_after_id)
      order by media.id limit v_limit
    ) as item;
  elsif p_section = 'commune_code_documents' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - 'moderation_reason' order by item.id
    ), '[]'::jsonb) into v_items from (
      select document.* from public.commune_code_documents as document
      where document.owner_user_id = v_request.user_id
        and (p_after_id is null or document.id > p_after_id)
      order by document.id limit v_limit
    ) as item;
  elsif p_section = 'commune_jobs' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','private_application_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select job.* from public.commune_job_posts as job
      where job.author_user_id = v_request.user_id
        and (p_after_id is null or job.id > p_after_id)
      order by job.id limit v_limit
    ) as item;
  elsif p_section = 'commune_abuse_reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','resolution_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select report.* from public.commune_abuse_reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'commune_code_reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','reviewer_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select report.* from public.commune_code_reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'forge_profile' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select profile.* from public.developer_profiles as profile
      where profile.user_id = v_request.user_id
        and (p_after_id is null or profile.id > p_after_id)
      order by profile.id limit v_limit
    ) as item;
  elsif p_section = 'forge_drafts' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['icon_path','package_file_path','locked_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select draft.* from public.addon_drafts as draft
      where draft.owner_user_id = v_request.user_id
        and (p_after_id is null or draft.id > p_after_id)
      order by draft.id limit v_limit
    ) as item;
  elsif p_section = 'forge_submissions' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select submission.* from public.addon_submissions as submission
      where submission.submitted_by = v_request.user_id
        and (p_after_id is null or submission.id > p_after_id)
      order by submission.id limit v_limit
    ) as item;
  elsif p_section = 'forge_sandbox' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'handoff_bundle_json','reviewed_by','reviewer_private_note',
        'security_hold_reason','package_url'
      ]::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select request.* from public.commune_sandbox_review_requests as request
      where coalesce(request.submitted_by, request.user_id) = v_request.user_id
        and (p_after_id is null or request.id > p_after_id)
      order by request.id limit v_limit
    ) as item;
  elsif p_section = 'marketplace_library' then
    select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', v_request.user_id,
      'savedAddons', coalesce((
        select pg_catalog.jsonb_agg(to_jsonb(saved) order by saved.saved_at desc)
        from (select * from public.user_saved_addons
          where user_id = v_request.user_id order by saved_at desc, addon_slug) as saved
      ), '[]'::jsonb),
      'installIntents', coalesce((
        select pg_catalog.jsonb_agg(to_jsonb(intent) order by intent.created_at desc)
        from (select * from public.marketplace_install_intents
          where user_id = v_request.user_id order by created_at desc, id) as intent
      ), '[]'::jsonb),
      'licenses', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'licenseId', license.id, 'listingId', license.listing_id,
          'addonVersionId', license.addon_version_id,
          'listingSlug', listing.slug, 'listingName', listing.name,
          'version', version.version, 'licenseKey', license.license_key,
          'licenseVersion', license.license_version,
          'acquisitionKind', license.acquisition_kind,
          'economicStatus', license.economic_status,
          'acquiredAt', license.acquired_at
        ) order by license.acquired_at desc)
        from private.marketplace_licenses as license
        join public.marketplace_listings as listing on listing.id = license.listing_id
        join public.marketplace_addon_versions as version on version.id = license.addon_version_id
        where license.buyer_user_id = v_request.user_id
      ), '[]'::jsonb)
    )) into v_items;
  elsif p_section = 'online_notifications' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select notification.* from public.user_notifications as notification
      where notification.user_id = v_request.user_id
        and (p_after_id is null or notification.id > p_after_id)
      order by notification.id limit v_limit
    ) as item;
  else
    -- Reuse the deliberately owner-safe economic projection; temporarily
    -- assume only the data subject, then restore the service/operator claims.
    perform pg_catalog.set_config('request.jwt.claim.sub', v_request.user_id::text, true);
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    v_items := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', v_request.user_id,
      'accountSummary', public.current_user_economic_account_summary(),
      'closureReadiness', private.economic_account_closure_obligations(v_request.user_id)
    ));
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_saved_sub, ''), true);
    perform pg_catalog.set_config('request.jwt.claim.role', coalesce(v_saved_role, 'service_role'), true);
  end if;
  if p_section not in ('profile','marketplace_library','economic_summary')
     and pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_next_id := ((v_items -> -1) ->> 'id')::uuid;
  end if;
  return pg_catalog.jsonb_build_object(
    'snapshotVersion', 'community-account-export-v2',
    'requestId', v_request.id,
    'section', p_section,
    'items', v_items,
    'nextId', v_next_id
  );
end;
$$;

alter function public.get_community_export_snapshot(uuid, text, uuid, text, integer, uuid) owner to postgres;
revoke all privileges on function public.get_community_export_snapshot(uuid, text, uuid, text, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_export_snapshot(uuid, text, uuid, text, integer, uuid) to service_role;

create or replace function public.record_community_export_artifact(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_request_id uuid,
  p_private_object_key text,
  p_artifact_sha256 text,
  p_byte_size bigint,
  p_mime_type text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_artifact private.account_export_artifacts%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_client_request_id is null
     or coalesce(p_artifact_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_byte_size not between 1 and 104857600
     or p_mime_type not in ('application/json','application/zip')
     or p_private_object_key !~ (
       '^exports/' || p_request_id::text ||
       '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(json|zip)$'
     )
     or (p_mime_type = 'application/json' and p_private_object_key !~ '\.json$')
     or (p_mime_type = 'application/zip' and p_private_object_key !~ '\.zip$')
     or p_expires_at <= pg_catalog.now() + interval '5 minutes'
     or p_expires_at > pg_catalog.now() + interval '30 days'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'community_export_artifact_invalid';
  end if;
  select * into strict v_request from private.account_lifecycle_requests
  where id = p_request_id and action = 'data_export' and status = 'processing'
    and claimed_by = p_actor_user_id for update;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'community_export_artifact_recorded',
    pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'privateObjectKey', p_private_object_key,
      'artifactSha256', p_artifact_sha256, 'byteSize', p_byte_size,
      'mimeType', p_mime_type, 'expiresAt', p_expires_at,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into private.account_export_artifacts(
    lifecycle_request_id, user_id, private_object_key, artifact_sha256,
    byte_size, mime_type, created_by, expires_at, retention_available_at
  ) values (
    p_request_id, v_request.user_id, p_private_object_key, p_artifact_sha256,
    p_byte_size, p_mime_type, p_actor_user_id, p_expires_at, p_expires_at
  ) on conflict (lifecycle_request_id) do nothing
  returning * into v_artifact;
  if not found then
    select * into strict v_artifact from private.account_export_artifacts
    where lifecycle_request_id = p_request_id for update;
    if v_artifact.private_object_key <> p_private_object_key
       or v_artifact.artifact_sha256 <> p_artifact_sha256
       or v_artifact.byte_size <> p_byte_size
       or v_artifact.mime_type <> p_mime_type
       or v_artifact.expires_at <> p_expires_at then
      raise exception using errcode = '23505', message = 'community_export_artifact_conflict';
    end if;
  end if;
  update private.account_lifecycle_requests
  set export_artifact_sha256 = v_artifact.artifact_sha256,
      export_expires_at = v_artifact.expires_at,
      updated_at = pg_catalog.now()
  where id = p_request_id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'community_lifecycle_manage',
    'community_export_artifact_recorded', 'account_export_artifact',
    v_artifact.id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'lifecycleRequestId', p_request_id, 'byteSize', p_byte_size,
      'mimeType', p_mime_type, 'expiresAt', p_expires_at
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'artifactId', v_artifact.id, 'requestId', p_request_id,
    'status', v_artifact.status, 'byteSize', v_artifact.byte_size,
    'mimeType', v_artifact.mime_type,
    'encryptionAtRest', v_artifact.encryption_at_rest,
    'expiresAt', v_artifact.expires_at,
    'downloadPath', '/api/identity/v1/account/exports/' || v_artifact.id::text
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.record_community_export_artifact(uuid, text, uuid, uuid, text, text, bigint, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.record_community_export_artifact(uuid, text, uuid, uuid, text, text, bigint, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_community_export_artifact(uuid, text, uuid, uuid, text, text, bigint, text, timestamptz, text) to service_role;

create or replace function public.current_user_community_export_status(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else coalesce((
    select pg_catalog.jsonb_build_object(
      'requestId', request.id, 'status', request.status,
      'artifactId', artifact.id,
      'artifactStatus', case when artifact.status = 'available'
        and artifact.expires_at <= pg_catalog.now() then 'expired' else artifact.status end,
      'byteSize', artifact.byte_size, 'mimeType', artifact.mime_type,
      'encryptionAtRest', artifact.encryption_at_rest,
      'artifactSha256', artifact.artifact_sha256,
      'expiresAt', artifact.expires_at,
      'downloadPath', case when request.status = 'completed'
        and artifact.status = 'available' and artifact.expires_at > pg_catalog.now()
        then '/api/identity/v1/account/exports/' || artifact.id::text else null end
    )
    from private.account_lifecycle_requests as request
    left join private.account_export_artifacts as artifact
      on artifact.lifecycle_request_id = request.id
    where request.id = p_request_id and request.user_id = auth.uid()
      and request.action = 'data_export'
  ), '{}'::jsonb) end;
$$;

alter function public.current_user_community_export_status(uuid) owner to postgres;
revoke all privileges on function public.current_user_community_export_status(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_community_export_status(uuid) to authenticated;

create or replace function public.current_user_community_lifecycle_requests(
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
  v_next_before timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'requestId', request.id, 'action', request.action,
    'status', request.status, 'noticeVersion', request.notice_version,
    'userNote', request.user_note,
    'submittedAt', request.submitted_at, 'updatedAt', request.updated_at,
    'coolingPeriodEndsAt', request.cooling_period_ends_at,
    'completedAt', request.completed_at, 'canceledAt', request.canceled_at,
    'legalHoldPresent', request.legal_hold_present,
    'exportExpiresAt', request.export_expires_at,
    'canCancel', request.action = 'account_deletion'
      and request.status in (
        'submitted','identity_verification','cooling_period',
        'operator_review','blocked_by_legal_hold'
      )
  ) order by request.submitted_at desc, request.id desc), '[]'::jsonb)
  into v_items
  from (
    select * from private.account_lifecycle_requests
    where user_id = v_user_id
      and (p_before is null or submitted_at < p_before)
    order by submitted_at desc, id desc limit v_limit
  ) as request;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_next_before := ((v_items -> -1) ->> 'submittedAt')::timestamptz;
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextBefore', v_next_before
  );
end;
$$;

alter function public.current_user_community_lifecycle_requests(integer, timestamptz) owner to postgres;
revoke all privileges on function public.current_user_community_lifecycle_requests(integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_community_lifecycle_requests(integer, timestamptz)
  to authenticated;

create or replace function public.current_user_community_lifecycle_request(
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else coalesce((
    select pg_catalog.jsonb_build_object(
      'requestId', request.id, 'action', request.action,
      'status', request.status, 'noticeVersion', request.notice_version,
      'userNote', request.user_note,
      'submittedAt', request.submitted_at, 'updatedAt', request.updated_at,
      'coolingPeriodEndsAt', request.cooling_period_ends_at,
      'completedAt', request.completed_at, 'canceledAt', request.canceled_at,
      'legalHoldPresent', request.legal_hold_present,
      'canCancel', request.action = 'account_deletion'
        and request.status in (
          'submitted','identity_verification','cooling_period',
          'operator_review','blocked_by_legal_hold'
        ),
      'export', case when request.action <> 'data_export' then null
        else pg_catalog.jsonb_build_object(
          'artifactId', artifact.id,
          'artifactStatus', case when artifact.status = 'available'
            and artifact.expires_at <= pg_catalog.now() then 'expired'
            else artifact.status end,
          'byteSize', artifact.byte_size, 'mimeType', artifact.mime_type,
          'encryptionAtRest', artifact.encryption_at_rest,
          'artifactSha256', artifact.artifact_sha256,
          'expiresAt', artifact.expires_at,
          'downloadPath', case when request.status = 'completed'
            and artifact.status = 'available' and artifact.expires_at > pg_catalog.now()
            then '/api/identity/v1/account/exports/' || artifact.id::text else null end
        ) end
    )
    from private.account_lifecycle_requests as request
    left join private.account_export_artifacts as artifact
      on artifact.lifecycle_request_id = request.id
    where request.id = p_request_id and request.user_id = auth.uid()
  ), '{}'::jsonb) end;
$$;

alter function public.current_user_community_lifecycle_request(uuid) owner to postgres;
revoke all privileges on function public.current_user_community_lifecycle_request(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_community_lifecycle_request(uuid)
  to authenticated;

create or replace function public.cancel_current_user_community_deletion(
  p_client_request_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request private.account_lifecycle_requests%rowtype;
  v_from_status text;
  v_response jsonb;
begin
  if v_user_id is null or p_client_request_id is null then
    raise exception using errcode = '42501', message = 'community_authenticated_account_required';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and user_id = v_user_id
    and action = 'account_deletion'
  for update;
  if v_request.status = 'canceled' and exists (
    select 1 from private.account_lifecycle_events as event
    where event.client_request_id = p_client_request_id
      and event.request_id = p_request_id and event.action = 'user_canceled'
  ) then
    return pg_catalog.jsonb_build_object(
      'requestId', v_request.id, 'status', v_request.status,
      'canceledAt', v_request.canceled_at
    );
  end if;
  if v_request.status not in (
       'submitted','identity_verification','cooling_period',
       'operator_review','blocked_by_legal_hold'
     )
     or exists (
       select 1 from private.account_deletion_handoffs as handoff
       where handoff.lifecycle_request_id = v_request.id
         and handoff.storage_inventory_completed_at is not null
     ) then
    raise exception using errcode = '55000', message = 'community_deletion_cancel_not_allowed';
  end if;
  v_from_status := v_request.status;
  update private.account_lifecycle_requests
  set status = 'canceled', canceled_at = pg_catalog.now(),
      claimed_by = null, claimed_at = null,
      resolved_by = v_user_id,
      private_resolution = 'Current user canceled before storage processing.',
      legal_hold_present = false, updated_at = pg_catalog.now()
  where id = p_request_id returning * into v_request;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason
  ) values (
    p_client_request_id, p_request_id, v_user_id, 'user_canceled',
    v_from_status, 'canceled',
    'Current user canceled before storage processing.'
  );
  update private.account_participation
  set participation_state = 'read_only', evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = v_user_id and participation_state = 'deletion_pending';
  perform private.recompute_community_participation(v_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    v_user_id, 'user', 'community_deletion_canceled',
    'account_lifecycle_request', p_request_id, p_client_request_id
  );
  v_response := pg_catalog.jsonb_build_object(
    'requestId', v_request.id, 'status', v_request.status,
    'canceledAt', v_request.canceled_at
  );
  return v_response;
end;
$$;

alter function public.cancel_current_user_community_deletion(uuid, uuid) owner to postgres;
revoke all privileges on function public.cancel_current_user_community_deletion(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_current_user_community_deletion(uuid, uuid)
  to authenticated;

create or replace function public.get_community_export_artifact_asset(p_artifact_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'artifactId', artifact.id,
      'requestId', artifact.lifecycle_request_id,
      'userId', artifact.user_id,
      'storageProvider', artifact.storage_provider,
      'bucketBinding', artifact.bucket_binding,
      'privateObjectKey', artifact.private_object_key,
      'artifactSha256', artifact.artifact_sha256,
      'byteSize', artifact.byte_size,
      'mimeType', artifact.mime_type,
      'encryptionAtRest', artifact.encryption_at_rest,
      'status', artifact.status,
      'expiresAt', artifact.expires_at
    ) from private.account_export_artifacts as artifact
    where artifact.id = p_artifact_id and artifact.status <> 'deleted'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_community_export_artifact_asset(uuid) owner to postgres;
revoke all privileges on function public.get_community_export_artifact_asset(uuid)
  from public, anon, authenticated, service_role;
-- Replaced by the actor-bound download resolver below.

create or replace function public.get_community_export_download_asset(
  p_actor_user_id uuid,
  p_artifact_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'artifactId', artifact.id,
      'requestId', artifact.lifecycle_request_id,
      'storageProvider', artifact.storage_provider,
      'bucketBinding', artifact.bucket_binding,
      'privateObjectKey', artifact.private_object_key,
      'artifactSha256', artifact.artifact_sha256,
      'byteSize', artifact.byte_size, 'mimeType', artifact.mime_type,
      'encryptionAtRest', artifact.encryption_at_rest,
      'expiresAt', artifact.expires_at
    )
    from private.account_export_artifacts as artifact
    join private.account_lifecycle_requests as request
      on request.id = artifact.lifecycle_request_id
    where artifact.id = p_artifact_id and artifact.user_id = p_actor_user_id
      and request.user_id = p_actor_user_id and request.status = 'completed'
      and artifact.status = 'available' and artifact.expires_at > pg_catalog.now()
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_community_export_download_asset(uuid, uuid) owner to postgres;
revoke all privileges on function public.get_community_export_download_asset(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_export_download_asset(uuid, uuid)
  to service_role;

-- Export retention is an Identity-owned queue. It is deliberately separate
-- from Artisan media/evidence retention so neither Worker can claim the
-- other's private object keys.
create or replace function private.community_export_artifact_has_legal_hold(
  p_artifact_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select exists (
      select 1 from private.account_legal_holds as hold
      where hold.user_id = artifact.user_id and hold.lifted_at is null
    ) or exists (
      select 1 from artisan.legal_hold_records as hold
      where hold.target_type = 'account' and hold.target_id = artifact.user_id
        and hold.released_at is null
    )
    from private.account_export_artifacts as artifact
    where artifact.id = p_artifact_id
  ), true);
$$;

alter function private.community_export_artifact_has_legal_hold(uuid) owner to postgres;
revoke all privileges on function private.community_export_artifact_has_legal_hold(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.claim_community_export_retention_jobs(
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
  v_items jsonb := '[]'::jsonb;
  v_claimed_at timestamptz := pg_catalog.now();
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or p_limit not between 1 and 25
     or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'community_export_retention_claim_invalid';
  end if;

  update private.account_export_artifacts as artifact
  set retention_status = case when retention_attempt_count >= 20
        then 'abandoned' else 'failed' end,
      retention_available_at = v_claimed_at,
      retention_claimed_by = null, retention_claimed_at = null,
      retention_lease_expires_at = null,
      retention_last_error_code = 'lease_expired',
      retention_last_error_at = v_claimed_at,
      retention_last_error_evidence_sha256 = pg_catalog.encode(
        extensions.digest('community_export_retention_lease_expired:' || artifact.id::text, 'sha256'),
        'hex'
      )
  where artifact.retention_status = 'processing'
    and artifact.retention_lease_expires_at <= v_claimed_at;

  update private.account_export_artifacts as artifact
  set retention_status = 'pending',
      retention_available_at = least(retention_available_at, v_claimed_at)
  where artifact.retention_status = 'blocked_by_legal_hold'
    and not private.community_export_artifact_has_legal_hold(artifact.id);

  update private.account_export_artifacts as artifact
  set retention_status = 'blocked_by_legal_hold',
      retention_claimed_by = null, retention_claimed_at = null,
      retention_lease_expires_at = null
  where artifact.retention_status in ('pending','failed')
    and artifact.retention_available_at <= v_claimed_at
    and private.community_export_artifact_has_legal_hold(artifact.id);

  with candidates as (
    select artifact.id
    from private.account_export_artifacts as artifact
    where artifact.retention_status in ('pending','failed')
      and artifact.retention_available_at <= v_claimed_at
      and artifact.expires_at <= v_claimed_at
      and artifact.retention_attempt_count < 20
      and not private.community_export_artifact_has_legal_hold(artifact.id)
    order by artifact.retention_available_at, artifact.created_at, artifact.id
    for update skip locked limit p_limit
  ), claimed as (
    update private.account_export_artifacts as artifact
    set status = 'expired', retention_status = 'processing',
        retention_claimed_by = p_worker_id,
        retention_claimed_at = v_claimed_at,
        retention_lease_expires_at = v_claimed_at
          + pg_catalog.make_interval(secs => p_lease_seconds),
        retention_attempt_count = retention_attempt_count + 1,
        updated_at = v_claimed_at
    from candidates where artifact.id = candidates.id
    returning artifact.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'artifactId', claimed.id,
    'requestId', claimed.lifecycle_request_id,
    'attemptCount', claimed.retention_attempt_count,
    'leaseExpiresAt', claimed.retention_lease_expires_at
  ) order by claimed.retention_available_at, claimed.id), '[]'::jsonb)
  into v_items from claimed;

  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, metadata
  )
  select 'service', 'community_export_retention_claimed',
    'account_export_artifact', artifact.id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id,
      'attemptCount', artifact.retention_attempt_count,
      'leaseExpiresAt', artifact.retention_lease_expires_at
    )
  from private.account_export_artifacts as artifact
  where artifact.retention_claimed_by = p_worker_id
    and artifact.retention_claimed_at = v_claimed_at;

  return pg_catalog.jsonb_build_object('workerId', p_worker_id, 'items', v_items);
end;
$$;

alter function public.claim_community_export_retention_jobs(text, integer, integer) owner to postgres;
revoke all privileges on function public.claim_community_export_retention_jobs(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_community_export_retention_jobs(text, integer, integer)
  to service_role;

create or replace function public.get_community_export_retention_asset(
  p_worker_id text,
  p_artifact_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_artifact private.account_export_artifacts%rowtype;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$' then
    raise exception using errcode = '42501', message = 'community_export_retention_worker_required';
  end if;
  select * into strict v_artifact
  from private.account_export_artifacts
  where id = p_artifact_id and retention_status = 'processing'
    and retention_claimed_by = p_worker_id
    and retention_lease_expires_at > pg_catalog.now();
  if private.community_export_artifact_has_legal_hold(p_artifact_id) then
    raise exception using errcode = '55000', message = 'community_export_retention_legal_hold_active';
  end if;
  return pg_catalog.jsonb_build_object(
    'artifactId', v_artifact.id,
    'storageProvider', v_artifact.storage_provider,
    'bucketBinding', v_artifact.bucket_binding,
    'privateObjectKey', v_artifact.private_object_key,
    'artifactSha256', v_artifact.artifact_sha256,
    'byteSize', v_artifact.byte_size,
    'mimeType', v_artifact.mime_type,
    'encryptionAtRest', v_artifact.encryption_at_rest,
    'leaseExpiresAt', v_artifact.retention_lease_expires_at
  );
end;
$$;

alter function public.get_community_export_retention_asset(text, uuid) owner to postgres;
revoke all privileges on function public.get_community_export_retention_asset(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_export_retention_asset(text, uuid)
  to service_role;

create or replace function public.complete_community_export_retention(
  p_client_request_id uuid,
  p_worker_id text,
  p_artifact_id uuid,
  p_completion_evidence_sha256 text,
  p_deleted_object_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact private.account_export_artifacts%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_completion_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_deleted_object_count not between 0 and 1 then
    raise exception using errcode = '22023', message = 'community_export_retention_completion_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'community_export_retention_completed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'artifactId', p_artifact_id,
      'completionEvidenceSha256', p_completion_evidence_sha256,
      'deletedObjectCount', p_deleted_object_count
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_artifact
  from private.account_export_artifacts
  where id = p_artifact_id and retention_status = 'processing'
    and retention_claimed_by = p_worker_id
    and retention_lease_expires_at > pg_catalog.now()
  for update;
  if private.community_export_artifact_has_legal_hold(p_artifact_id) then
    update private.account_export_artifacts
    set retention_status = 'blocked_by_legal_hold',
        retention_claimed_by = null, retention_claimed_at = null,
        retention_lease_expires_at = null, updated_at = pg_catalog.now()
    where id = p_artifact_id returning * into v_artifact;
    v_response := pg_catalog.jsonb_build_object(
      'artifactId', v_artifact.id,
      'status', v_artifact.retention_status,
      'deletedAt', null,
      'deletedObjectCount', 0
    );
    return private.community_idempotency_finish(p_client_request_id, v_response);
  end if;
  update private.account_export_artifacts
  set status = 'deleted', retention_status = 'completed',
      deleted_at = pg_catalog.now(),
      deletion_evidence_sha256 = p_completion_evidence_sha256,
      retention_claimed_by = null, retention_claimed_at = null,
      retention_lease_expires_at = null,
      retention_last_error_code = null, retention_last_error_at = null,
      retention_last_error_evidence_sha256 = null,
      updated_at = pg_catalog.now()
  where id = p_artifact_id returning * into v_artifact;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_export_retention_completed',
    'account_export_artifact', p_artifact_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'deletedObjectCount', p_deleted_object_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'artifactId', v_artifact.id, 'status', v_artifact.status,
    'deletedAt', v_artifact.deleted_at,
    'deletedObjectCount', p_deleted_object_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.complete_community_export_retention(uuid, text, uuid, text, integer) owner to postgres;
revoke all privileges on function public.complete_community_export_retention(uuid, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_community_export_retention(uuid, text, uuid, text, integer)
  to service_role;

create or replace function public.fail_community_export_retention(
  p_client_request_id uuid,
  p_worker_id text,
  p_artifact_id uuid,
  p_error_code text,
  p_failure_evidence_sha256 text,
  p_retry_after_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact private.account_export_artifacts%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_worker_id, '') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,99}$'
     or coalesce(p_failure_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_retry_after_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'community_export_retention_failure_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'community_export_retention_failed',
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'artifactId', p_artifact_id,
      'errorCode', p_error_code,
      'failureEvidenceSha256', p_failure_evidence_sha256,
      'retryAfterSeconds', p_retry_after_seconds
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_artifact
  from private.account_export_artifacts
  where id = p_artifact_id and retention_status = 'processing'
    and retention_claimed_by = p_worker_id
    and retention_lease_expires_at > pg_catalog.now()
  for update;
  update private.account_export_artifacts
  set retention_status = case when retention_attempt_count >= 20
        then 'abandoned' else 'failed' end,
      retention_available_at = pg_catalog.now()
        + pg_catalog.make_interval(secs => p_retry_after_seconds),
      retention_claimed_by = null, retention_claimed_at = null,
      retention_lease_expires_at = null,
      retention_last_error_code = p_error_code,
      retention_last_error_at = pg_catalog.now(),
      retention_last_error_evidence_sha256 = p_failure_evidence_sha256,
      updated_at = pg_catalog.now()
  where id = p_artifact_id returning * into v_artifact;
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'service', 'community_export_retention_failed',
    'account_export_artifact', p_artifact_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'workerId', p_worker_id, 'errorCode', p_error_code,
      'status', v_artifact.retention_status,
      'attemptCount', v_artifact.retention_attempt_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'artifactId', v_artifact.id,
    'status', v_artifact.retention_status,
    'availableAt', v_artifact.retention_available_at,
    'attemptCount', v_artifact.retention_attempt_count
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.fail_community_export_retention(uuid, text, uuid, text, text, integer) owner to postgres;
revoke all privileges on function public.fail_community_export_retention(uuid, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.fail_community_export_retention(uuid, text, uuid, text, text, integer)
  to service_role;

create or replace function public.record_community_deletion_handoff(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_request_id uuid,
  p_phase text,
  p_evidence_sha256 text,
  p_content_disposition text,
  p_owned_storage_object_count integer,
  p_auth_provider_receipt_sha256 text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_handoff private.account_deletion_handoffs%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_phase not in ('storage_inventory_completed','storage_cleanup_completed','auth_deletion_requested','auth_deletion_confirmed')
     or coalesce(p_evidence_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000
     or (p_phase = 'storage_inventory_completed' and (
       p_owned_storage_object_count is null or p_owned_storage_object_count < 0
       or p_content_disposition not in (
         'preserve_public_credit_anonymize_account',
         'remove_user_content_preserve_required_legal_evidence'
       )
     ))
     or (p_phase <> 'storage_inventory_completed' and (
       p_owned_storage_object_count is not null or p_content_disposition is not null
     ))
     or (p_phase = 'auth_deletion_confirmed'
       and coalesce(p_auth_provider_receipt_sha256, '') !~ '^[0-9a-f]{64}$')
     or (p_phase <> 'auth_deletion_confirmed' and p_auth_provider_receipt_sha256 is not null) then
    raise exception using errcode = '22023', message = 'community_deletion_handoff_invalid';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'account_deletion'
  for update;
  if (p_phase = 'storage_inventory_completed' and v_request.status <> 'storage_inventory')
     or (p_phase = 'storage_cleanup_completed' and v_request.status <> 'storage_cleanup')
     or (p_phase in ('auth_deletion_requested','auth_deletion_confirmed')
       and v_request.status <> 'auth_deletion_ready') then
    raise exception using errcode = '55000', message = 'community_deletion_handoff_phase_not_ready';
  end if;
  if p_phase = 'storage_cleanup_completed' and not exists (
    select 1 from artisan.account_cleanup_runs as cleanup
    where cleanup.lifecycle_request_id = p_request_id
      and cleanup.user_id = v_request.user_id
      and cleanup.status = 'completed'
      and cleanup.completed_asset_count = cleanup.expected_asset_count
      and cleanup.completion_evidence_sha256 is not null
  ) then
    raise exception using errcode = '55000', message = 'community_artisan_cleanup_not_ready';
  end if;
  if exists (
    select 1 from private.account_legal_holds as hold
    where hold.user_id = v_request.user_id and hold.lifted_at is null
  ) then
    raise exception using errcode = '55000', message = 'community_deletion_handoff_legal_hold_active';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'community_deletion_handoff_recorded',
    pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'phase', p_phase,
      'evidenceSha256', p_evidence_sha256,
      'contentDisposition', p_content_disposition,
      'ownedStorageObjectCount', p_owned_storage_object_count,
      'authProviderReceiptSha256', p_auth_provider_receipt_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into private.account_deletion_handoffs(
    lifecycle_request_id, content_disposition,
    storage_inventory_completed_at, storage_inventory_evidence_sha256,
    owned_storage_object_count, updated_by
  ) values (
    p_request_id,
    coalesce(p_content_disposition, 'preserve_public_credit_anonymize_account'),
    case when p_phase = 'storage_inventory_completed' then pg_catalog.now() else null end,
    case when p_phase = 'storage_inventory_completed' then p_evidence_sha256 else null end,
    p_owned_storage_object_count, p_actor_user_id
  )
  on conflict (lifecycle_request_id) do nothing;
  select * into strict v_handoff
  from private.account_deletion_handoffs
  where lifecycle_request_id = p_request_id
  for update;
  if (p_phase = 'storage_cleanup_completed' and (
        v_handoff.storage_inventory_completed_at is null
        or v_handoff.storage_inventory_evidence_sha256 is null))
     or (p_phase = 'auth_deletion_requested' and (
       v_handoff.storage_cleanup_completed_at is null
       or v_handoff.storage_cleanup_evidence_sha256 is null))
     or (p_phase = 'auth_deletion_confirmed' and (
       v_handoff.auth_deletion_requested_at is null
       or v_handoff.auth_deletion_request_evidence_sha256 is null)) then
    raise exception using errcode = '55000', message = 'community_deletion_handoff_sequence_invalid';
  end if;
  if (p_phase = 'storage_inventory_completed' and (
       (v_handoff.storage_inventory_evidence_sha256 is not null
         and v_handoff.storage_inventory_evidence_sha256 <> p_evidence_sha256)
       or (v_handoff.owned_storage_object_count is not null
         and v_handoff.owned_storage_object_count <> p_owned_storage_object_count)
       or (v_handoff.content_disposition is not null
         and v_handoff.content_disposition <> p_content_disposition)))
     or (p_phase = 'storage_cleanup_completed'
       and v_handoff.storage_cleanup_evidence_sha256 is not null
       and v_handoff.storage_cleanup_evidence_sha256 <> p_evidence_sha256)
     or (p_phase = 'auth_deletion_requested'
       and v_handoff.auth_deletion_request_evidence_sha256 is not null
       and v_handoff.auth_deletion_request_evidence_sha256 <> p_evidence_sha256)
     or (p_phase = 'auth_deletion_confirmed' and (
       (v_handoff.auth_deletion_confirmation_evidence_sha256 is not null
         and v_handoff.auth_deletion_confirmation_evidence_sha256 <> p_evidence_sha256)
       or (v_handoff.auth_provider_receipt_sha256 is not null
         and v_handoff.auth_provider_receipt_sha256 <> p_auth_provider_receipt_sha256))) then
    raise exception using errcode = '23505', message = 'community_deletion_handoff_evidence_conflict';
  end if;
  update private.account_deletion_handoffs
  set storage_inventory_completed_at = case when p_phase = 'storage_inventory_completed'
        then coalesce(storage_inventory_completed_at, pg_catalog.now()) else storage_inventory_completed_at end,
      storage_inventory_evidence_sha256 = case when p_phase = 'storage_inventory_completed'
        then coalesce(storage_inventory_evidence_sha256, p_evidence_sha256) else storage_inventory_evidence_sha256 end,
      owned_storage_object_count = case when p_phase = 'storage_inventory_completed'
        then coalesce(owned_storage_object_count, p_owned_storage_object_count) else owned_storage_object_count end,
      storage_cleanup_completed_at = case when p_phase = 'storage_cleanup_completed'
        then coalesce(storage_cleanup_completed_at, pg_catalog.now()) else storage_cleanup_completed_at end,
      storage_cleanup_evidence_sha256 = case when p_phase = 'storage_cleanup_completed'
        then coalesce(storage_cleanup_evidence_sha256, p_evidence_sha256) else storage_cleanup_evidence_sha256 end,
      auth_deletion_requested_at = case when p_phase = 'auth_deletion_requested'
        then coalesce(auth_deletion_requested_at, pg_catalog.now()) else auth_deletion_requested_at end,
      auth_deletion_request_evidence_sha256 = case when p_phase = 'auth_deletion_requested'
        then coalesce(auth_deletion_request_evidence_sha256, p_evidence_sha256) else auth_deletion_request_evidence_sha256 end,
      auth_deletion_confirmed_at = case when p_phase = 'auth_deletion_confirmed'
        then coalesce(auth_deletion_confirmed_at, pg_catalog.now()) else auth_deletion_confirmed_at end,
      auth_deletion_confirmation_evidence_sha256 = case when p_phase = 'auth_deletion_confirmed'
        then coalesce(auth_deletion_confirmation_evidence_sha256, p_evidence_sha256) else auth_deletion_confirmation_evidence_sha256 end,
      auth_provider_receipt_sha256 = case when p_phase = 'auth_deletion_confirmed'
        then coalesce(auth_provider_receipt_sha256, p_auth_provider_receipt_sha256) else auth_provider_receipt_sha256 end,
      updated_by = p_actor_user_id, updated_at = pg_catalog.now()
  where lifecycle_request_id = p_request_id
  returning * into v_handoff;
  insert into private.account_lifecycle_events(
    client_request_id, request_id, actor_user_id, action,
    from_status, to_status, private_reason, metadata
  ) values (
    p_client_request_id, p_request_id, p_actor_user_id,
    'deletion_' || p_phase, v_request.status, v_request.status,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'ownedStorageObjectCount', p_owned_storage_object_count,
      'hasStructuredEvidence', p_evidence_sha256 is not null,
      'hasAuthProviderReceipt', p_auth_provider_receipt_sha256 is not null
    )
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'community_lifecycle_manage',
    'community_deletion_' || p_phase, 'account_lifecycle_request',
    p_request_id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('userId', v_request.user_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'phase', p_phase,
    'storageInventoryCompletedAt', v_handoff.storage_inventory_completed_at,
    'storageCleanupCompletedAt', v_handoff.storage_cleanup_completed_at,
    'authDeletionRequestedAt', v_handoff.auth_deletion_requested_at,
    'authDeletionConfirmedAt', v_handoff.auth_deletion_confirmed_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.record_community_deletion_handoff(uuid, text, uuid, uuid, text, text, text, integer, text, text) owner to postgres;
revoke all privileges on function public.record_community_deletion_handoff(uuid, text, uuid, uuid, text, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_community_deletion_handoff(uuid, text, uuid, uuid, text, text, text, integer, text, text) to service_role;

create or replace function public.update_current_user_artisan_post_draft(
  p_client_request_id uuid,
  p_post_id uuid,
  p_title text,
  p_artist_statement text,
  p_theme jsonb,
  p_comments_enabled boolean,
  p_appreciations_enabled boolean,
  p_slow_mode_seconds integer,
  p_artwork_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_post artisan.forum_posts%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null
     or not private.artisan_active_member(v_user_id)
     or not private.community_can_participate(v_user_id, 'artisan_post')
     or not private.artisan_theme_is_safe(p_theme)
     or p_slow_mode_seconds not between 0 and 86400
     or coalesce(pg_catalog.cardinality(p_artwork_ids), 0) not between 1 and 12
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''))) not between 1 and 180
     or pg_catalog.char_length(coalesce(p_artist_statement, '')) > 10000 then
    raise exception using errcode = '22023', message = 'artisan_post_update_invalid';
  end if;
  if (select pg_catalog.count(distinct id) from pg_catalog.unnest(p_artwork_ids) as id)
     <> (select pg_catalog.count(*) from artisan.artworks
         where id = any(p_artwork_ids) and owner_user_id = v_user_id
           and status in ('draft','changes_requested','approved','published')) then
    raise exception using errcode = '42501', message = 'artisan_post_artwork_ownership_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_post_draft_updated',
    pg_catalog.jsonb_build_object(
      'postId', p_post_id, 'title', pg_catalog.btrim(p_title),
      'artistStatement', nullif(pg_catalog.btrim(p_artist_statement), ''),
      'theme', p_theme, 'commentsEnabled', p_comments_enabled,
      'appreciationsEnabled', p_appreciations_enabled,
      'slowModeSeconds', p_slow_mode_seconds, 'artworkIds', p_artwork_ids
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.forum_posts
  set title = pg_catalog.btrim(p_title),
      artist_statement = nullif(pg_catalog.btrim(p_artist_statement), ''),
      theme = p_theme, comments_enabled = p_comments_enabled,
      appreciations_enabled = p_appreciations_enabled,
      slow_mode_seconds = p_slow_mode_seconds,
      status = 'draft', moderation_status = 'unreviewed',
      submitted_at = null, published_at = null,
      updated_at = pg_catalog.now()
  where id = p_post_id and owner_user_id = v_user_id
    and status in ('draft','changes_requested','approved','published')
  returning * into v_post;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_post_not_editable';
  end if;
  delete from artisan.post_artworks where post_id = p_post_id;
  insert into artisan.post_artworks(post_id, artwork_id, display_order)
  select p_post_id, selected.artwork_id, selected.ordinality - 1
  from pg_catalog.unnest(p_artwork_ids) with ordinality as selected(artwork_id, ordinality);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    v_user_id, 'user', 'artisan_post_draft_updated', 'artisan_forum_post', p_post_id, p_client_request_id
  );
  v_response := pg_catalog.jsonb_build_object(
    'postId', v_post.id, 'status', v_post.status,
    'requiresReview', true, 'updatedAt', v_post.updated_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.update_current_user_artisan_post_draft(uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[]) owner to postgres;
revoke all privileges on function public.update_current_user_artisan_post_draft(uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.update_current_user_artisan_post_draft(uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[]) to authenticated;

create or replace function public.set_current_user_artisan_room_controls(
  p_client_request_id uuid,
  p_post_id uuid,
  p_comments_enabled boolean,
  p_appreciations_enabled boolean,
  p_slow_mode_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_post artisan.forum_posts%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or p_slow_mode_seconds not between 0 and 86400 then
    raise exception using errcode = '22023', message = 'artisan_room_controls_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_room_controls_updated',
    pg_catalog.jsonb_build_object(
      'postId', p_post_id, 'commentsEnabled', p_comments_enabled,
      'appreciationsEnabled', p_appreciations_enabled,
      'slowModeSeconds', p_slow_mode_seconds
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.forum_posts
  set comments_enabled = p_comments_enabled,
      appreciations_enabled = p_appreciations_enabled,
      slow_mode_seconds = p_slow_mode_seconds,
      updated_at = pg_catalog.now()
  where id = p_post_id and owner_user_id = v_user_id
    and status in ('draft','changes_requested','approved','published')
    and moderation_status <> 'legal_hold'
  returning * into v_post;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_room_controls_not_permitted';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    v_user_id, 'user', 'artisan_room_controls_updated', 'artisan_forum_post',
    p_post_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'commentsEnabled', p_comments_enabled,
      'appreciationsEnabled', p_appreciations_enabled,
      'slowModeSeconds', p_slow_mode_seconds
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'postId', p_post_id, 'commentsEnabled', v_post.comments_enabled,
    'appreciationsEnabled', v_post.appreciations_enabled,
    'slowModeSeconds', v_post.slow_mode_seconds
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.set_current_user_artisan_room_controls(uuid, uuid, boolean, boolean, integer) owner to postgres;
revoke all privileges on function public.set_current_user_artisan_room_controls(uuid, uuid, boolean, boolean, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.set_current_user_artisan_room_controls(uuid, uuid, boolean, boolean, integer) to authenticated;

create or replace function public.withdraw_current_user_artisan_content(
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null or p_target_type not in ('artwork','post')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_content_withdrawal_invalid';
  end if;
  if exists (
    select 1 from artisan.legal_hold_records as hold
    where hold.target_type = p_target_type and hold.target_id = p_target_id
      and hold.released_at is null
  ) then
    raise exception using errcode = '55000', message = 'artisan_content_legal_hold_active';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_content_withdrawn',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id,
      'reason', pg_catalog.btrim(p_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_target_type = 'artwork' then
    update artisan.artworks
    set status = case when status = 'published' then 'archived' else 'removed' end,
        archived_at = case when status = 'published' then pg_catalog.now() else archived_at end,
        removed_at = case when status <> 'published' then pg_catalog.now() else removed_at end,
        updated_at = pg_catalog.now()
    where id = p_target_id and owner_user_id = v_user_id
      and status not in ('archived','removed') and moderation_status <> 'legal_hold'
    returning status into v_status;
    if not found then raise exception using errcode = '42501', message = 'artisan_content_not_withdrawable'; end if;
    insert into artisan.artwork_provenance_events(
      client_request_id, artwork_id, actor_user_id, event_type, metadata
    ) values (
      p_client_request_id, p_target_id, v_user_id,
      case when v_status = 'archived' then 'archived' else 'removed' end,
      pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason))
    );
  else
    update artisan.forum_posts
    set status = case when status = 'published' then 'archived' else 'removed' end,
        archived_at = case when status = 'published' then pg_catalog.now() else archived_at end,
        removed_at = case when status <> 'published' then pg_catalog.now() else removed_at end,
        updated_at = pg_catalog.now()
    where id = p_target_id and owner_user_id = v_user_id
      and status not in ('archived','removed') and moderation_status <> 'legal_hold'
    returning status into v_status;
    if not found then raise exception using errcode = '42501', message = 'artisan_content_not_withdrawable'; end if;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason
  ) values (
    v_user_id, 'user', 'artisan_content_withdrawn', 'artisan_' || p_target_type,
    p_target_id, p_client_request_id, pg_catalog.btrim(p_reason)
  );
  v_response := pg_catalog.jsonb_build_object(
    'targetType', p_target_type, 'targetId', p_target_id, 'status', v_status
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.withdraw_current_user_artisan_content(uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.withdraw_current_user_artisan_content(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.withdraw_current_user_artisan_content(uuid, text, uuid, text) to authenticated;

create or replace function public.withdraw_current_user_challenge_submission(
  p_client_request_id uuid,
  p_submission_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission artisan.challenge_submissions%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if v_user_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_submission_withdrawal_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_challenge_submission_withdrawn',
    pg_catalog.jsonb_build_object(
      'submissionId', p_submission_id, 'reason', pg_catalog.btrim(p_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.challenge_submissions as submission
  set status = 'withdrawn', withdrawn_at = pg_catalog.now(), updated_at = pg_catalog.now()
  from artisan.challenges as challenge
  where submission.id = p_submission_id
    and submission.challenge_id = challenge.id
    and submission.submitter_user_id = v_user_id
    and submission.status in (
      'draft','uploading','processing','pending_review','eligible','changes_requested'
    )
    and challenge.deadline_at > pg_catalog.now()
    and not exists (
      select 1 from artisan.legal_hold_records as hold
      where hold.target_type = 'submission' and hold.target_id = submission.id
        and hold.released_at is null
    )
  returning submission.* into v_submission;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_submission_not_withdrawable';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason
  ) values (
    v_user_id, 'user', 'artisan_challenge_submission_withdrawn',
    'artisan_challenge_submission', p_submission_id,
    p_client_request_id, pg_catalog.btrim(p_reason)
  );
  v_response := pg_catalog.jsonb_build_object(
    'submissionId', p_submission_id, 'status', v_submission.status,
    'withdrawnAt', v_submission.withdrawn_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.withdraw_current_user_challenge_submission(uuid, uuid, text) owner to postgres;
revoke all privileges on function public.withdraw_current_user_challenge_submission(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.withdraw_current_user_challenge_submission(uuid, uuid, text) to authenticated;

create or replace function public.current_user_artisan_activity(
  p_kind text,
  p_limit integer default 20,
  p_before timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null
     or ((p_before is null) <> (p_before_id is null))
     or p_kind not in (
       'artworks','posts','comments','media','submissions',
       'reports','appeals','notifications'
     ) then
    raise exception using errcode = '22023', message = 'artisan_activity_query_invalid';
  end if;
  if p_kind = 'artworks' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'artworkId', item.id, 'slug', item.slug, 'title', item.title,
      'status', item.status, 'moderationStatus', item.moderation_status,
      'tags', item.tags,
      'appreciationCount', (
        select pg_catalog.count(*) from artisan.appreciations as appreciation
        where appreciation.target_type = 'artwork'
          and appreciation.target_id = item.id
      ),
      'approvalStatus', private.artisan_guardian_approval_status(
        v_user_id, 'artwork', item.id
      ),
      'updatedAt', item.updated_at
    ) order by item.updated_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from artisan.artworks where owner_user_id = v_user_id
        and (p_before is null or (updated_at, id) < (p_before, p_before_id))
      order by updated_at desc, id desc limit v_limit
    ) as item;
  elsif p_kind = 'posts' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'postId', item.id, 'slug', item.slug, 'title', item.title,
      'status', item.status, 'moderationStatus', item.moderation_status,
      'commentsEnabled', item.comments_enabled,
      'appreciationsEnabled', item.appreciations_enabled,
      'tags', item.tags,
      'appreciationCount', (
        select pg_catalog.count(*) from artisan.appreciations as appreciation
        where appreciation.target_type = 'post'
          and appreciation.target_id = item.id
      ),
      'approvalStatus', private.artisan_guardian_approval_status(
        v_user_id, 'post', item.id
      ),
      'slowModeSeconds', item.slow_mode_seconds, 'updatedAt', item.updated_at
    ) order by item.updated_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from artisan.forum_posts where owner_user_id = v_user_id
        and (p_before is null or (updated_at, id) < (p_before, p_before_id))
      order by updated_at desc, id desc limit v_limit
    ) as item;
  elsif p_kind = 'comments' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'commentId', item.id, 'postId', item.post_id,
      'postSlug', item.post_slug, 'postTitle', item.post_title,
      'status', item.status, 'moderationStatus', item.moderation_status,
      'approvalStatus', private.artisan_guardian_approval_status(
        v_user_id, 'comment', item.id
      ),
      'createdAt', item.created_at, 'editedAt', item.edited_at,
      'updatedAt', item.activity_at
    ) order by item.activity_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select comment.*, post.slug as post_slug, post.title as post_title,
        coalesce(comment.edited_at, comment.created_at) as activity_at
      from artisan.comments as comment
      join artisan.forum_posts as post on post.id = comment.post_id
      where comment.user_id = v_user_id
        and (p_before is null or
          (coalesce(comment.edited_at, comment.created_at), comment.id) <
            (p_before, p_before_id))
      order by activity_at desc, comment.id desc limit v_limit
    ) as item;
  elsif p_kind = 'media' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'mediaAssetId', item.id, 'artworkId', item.artwork_id,
      'artworkSlug', item.artwork_slug, 'artworkTitle', item.artwork_title,
      'adapterKey', item.adapter_key,
      'processingStatus', item.processing_status,
      'moderationStatus', item.moderation_status,
      'accessibilityDescription', item.accessibility_description,
      'approvalStatus', private.artisan_guardian_approval_status(
        v_user_id, 'media', item.id
      ),
      'createdAt', item.created_at, 'updatedAt', item.updated_at
    ) order by item.updated_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select media.*, artwork.slug as artwork_slug, artwork.title as artwork_title
      from artisan.media_assets as media
      join artisan.artworks as artwork on artwork.id = media.artwork_id
      where media.owner_user_id = v_user_id
        and (p_before is null or
          (media.updated_at, media.id) < (p_before, p_before_id))
      order by media.updated_at desc, media.id desc limit v_limit
    ) as item;
  elsif p_kind = 'submissions' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'submissionId', item.id, 'challengeId', item.challenge_id,
      'challengeSlug', item.challenge_slug, 'challengeTitle', item.challenge_title,
      'artworkId', item.artwork_id, 'artworkSlug', item.artwork_slug,
      'artworkTitle', item.artwork_title, 'status', item.status,
      'moderationStatus', item.moderation_status,
      'eligibilityStatus', item.eligibility_status,
      'approvalStatus', private.artisan_guardian_approval_status(
        v_user_id, 'submission', item.id
      ),
      'updatedAt', item.updated_at
    ) order by item.updated_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select submission.*, challenge.slug as challenge_slug,
        challenge.title as challenge_title, artwork.slug as artwork_slug,
        artwork.title as artwork_title
      from artisan.challenge_submissions as submission
      join artisan.challenges as challenge on challenge.id = submission.challenge_id
      join artisan.artworks as artwork on artwork.id = submission.artwork_id
      where submission.submitter_user_id = v_user_id
        and (p_before is null or
          (submission.updated_at, submission.id) < (p_before, p_before_id))
      order by submission.updated_at desc, submission.id desc limit v_limit
    ) as item;
  elsif p_kind = 'reports' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'reportId', item.id, 'targetType', item.target_type,
      'targetId', item.target_id, 'reasonCode', item.reason_code,
      'status', item.status, 'priority', item.priority,
      'submittedAt', item.submitted_at
    ) order by item.submitted_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from artisan.reports where reporter_user_id = v_user_id
        and (p_before is null or (submitted_at, id) < (p_before, p_before_id))
      order by submitted_at desc, id desc limit v_limit
    ) as item;
  elsif p_kind = 'appeals' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'appealId', item.id, 'status', item.status,
      'decision', item.decision, 'publicNotice', item.public_notice,
      'submittedAt', item.submitted_at, 'reviewedAt', item.reviewed_at
    ) order by item.submitted_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from artisan.appeals where appellant_user_id = v_user_id
        and (p_before is null or (submitted_at, id) < (p_before, p_before_id))
      order by submitted_at desc, id desc limit v_limit
    ) as item;
  else
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'notificationId', item.id, 'type', item.notification_type,
      'title', item.title, 'body', item.body, 'actionPath', item.action_path,
      'status', item.status, 'readAt', item.read_at, 'createdAt', item.created_at
    ) order by item.created_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from artisan.notifications where user_id = v_user_id
        and (p_before is null or (created_at, id) < (p_before, p_before_id))
      order by created_at desc, id desc limit v_limit
    ) as item;
  end if;
  return pg_catalog.jsonb_build_object(
    'kind', p_kind, 'items', v_items,
    'nextCursor', case when pg_catalog.jsonb_array_length(v_items) = v_limit then
      pg_catalog.jsonb_build_object(
        'timestamp', (v_items -> -1) -> case
          when p_kind in ('artworks','posts','comments','media','submissions') then 'updatedAt'
          when p_kind = 'notifications' then 'createdAt'
          else 'submittedAt' end,
        'id', (v_items -> -1) -> case p_kind
          when 'artworks' then 'artworkId'
          when 'posts' then 'postId'
          when 'comments' then 'commentId'
          when 'media' then 'mediaAssetId'
          when 'submissions' then 'submissionId'
          when 'reports' then 'reportId'
          when 'appeals' then 'appealId'
          else 'notificationId' end
      ) else null end
  );
end;
$$;

alter function public.current_user_artisan_activity(text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.current_user_artisan_activity(text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_artisan_activity(text, integer, timestamptz, uuid) to authenticated;

create or replace function public.mark_current_user_artisan_notifications_read(
  p_client_request_id uuid,
  p_notification_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_replay jsonb;
  v_marked_count integer;
  v_read_at timestamptz := pg_catalog.now();
  v_response jsonb;
begin
  if v_user_id is null or p_client_request_id is null then
    raise exception using errcode = '42501', message = 'artisan_notification_owner_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, v_user_id, 'artisan_notifications_marked_read',
    pg_catalog.jsonb_build_object('notificationId', p_notification_id)
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.notifications
  set read_at = v_read_at
  where user_id = v_user_id and read_at is null
    and (p_notification_id is null or id = p_notification_id);
  get diagnostics v_marked_count = row_count;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    v_user_id, 'user', 'artisan_notifications_marked_read',
    case when p_notification_id is null then 'artisan_notification_inbox' else 'artisan_notification' end,
    p_notification_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'allUnread', p_notification_id is null,
      'markedCount', v_marked_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'notificationId', p_notification_id,
    'markedCount', v_marked_count,
    'readAt', v_read_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.mark_current_user_artisan_notifications_read(uuid, uuid) owner to postgres;
revoke all privileges on function public.mark_current_user_artisan_notifications_read(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_current_user_artisan_notifications_read(uuid, uuid) to authenticated;

create or replace function public.artisan_mark_notifications_read(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.mark_current_user_artisan_notifications_read(
    p_client_request_id, p_notification_id
  );
end;
$$;

alter function public.artisan_mark_notifications_read(uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_mark_notifications_read(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_mark_notifications_read(uuid, uuid, uuid) to service_role;

create or replace function public.artisan_update_notification_preferences(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_mentions_enabled boolean,
  p_comments_enabled boolean,
  p_challenge_updates_enabled boolean,
  p_moderation_updates_enabled boolean,
  p_guardian_updates_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id,
    'artisan_notification_preferences_updated',
    pg_catalog.jsonb_build_object(
      'inAppEnabled', p_in_app_enabled, 'emailEnabled', p_email_enabled,
      'mentionsEnabled', p_mentions_enabled, 'commentsEnabled', p_comments_enabled,
      'challengeUpdatesEnabled', p_challenge_updates_enabled,
      'moderationUpdatesEnabled', p_moderation_updates_enabled,
      'guardianUpdatesEnabled', p_guardian_updates_enabled,
      'quietHoursStart', p_quiet_hours_start,
      'quietHoursEnd', p_quiet_hours_end
    )
  );
  if v_replay is not null then return v_replay; end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  v_response := public.update_current_user_artisan_notification_preferences(
    p_in_app_enabled, p_email_enabled, p_mentions_enabled, p_comments_enabled,
    p_challenge_updates_enabled, p_moderation_updates_enabled,
    p_guardian_updates_enabled, p_quiet_hours_start, p_quiet_hours_end
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_update_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time) owner to postgres;
revoke all privileges on function public.artisan_update_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time) to service_role;

create or replace function public.artisan_staff_work_queue(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_queue text,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_capability text;
  v_items jsonb := '[]'::jsonb;
begin
  v_capability := case p_queue
    when 'reports' then 'artisan_reports_triage'
    when 'child_safety' then 'artisan_child_safety_manage'
    when 'cases' then 'artisan_cases_manage'
    when 'appeals' then 'artisan_appeals_review'
    when 'credits' then 'artisan_credits_correct'
    when 'copyright' then 'artisan_copyright_manage'
    when 'media' then 'artisan_media_review'
    when 'lifecycle' then 'community_lifecycle_manage'
    when 'system' then 'artisan_system_view'
    when 'audit' then 'artisan_audit_view'
    else null
  end;
  if v_capability is null then
    raise exception using errcode = '22023', message = 'artisan_staff_queue_invalid';
  end if;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_queue in ('reports','child_safety') then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'reportId', item.id, 'targetType', item.target_type,
      'targetId', item.target_id, 'reasonCode', item.reason_code,
      'summary', item.summary, 'status', item.status,
      'priority', item.priority, 'childSafetySensitive', item.child_safety_sensitive,
      'submittedAt', item.submitted_at
    ) order by item.submitted_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.reports
      where status in ('submitted','triaged','case_opened','escalated')
        and child_safety_sensitive = (p_queue = 'child_safety')
        and (p_before is null or submitted_at > p_before)
      order by priority desc, submitted_at, id limit v_limit
    ) as item;
  elsif p_queue = 'cases' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'caseId', item.id, 'caseType', item.case_type,
      'status', item.status, 'severity', item.severity,
      'targetType', item.target_type, 'targetId', item.target_id,
      'openedAt', item.opened_at, 'dueAt', item.due_at
    ) order by item.opened_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.moderation_cases
      where status <> 'closed' and not child_safety_sensitive
        and (p_before is null or opened_at > p_before)
      order by severity desc, opened_at, id limit v_limit
    ) as item;
  elsif p_queue = 'appeals' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'appealId', item.id, 'caseId', item.case_id,
      'restrictionId', item.restriction_id,
      'moderationActionId', item.moderation_action_id,
      'status', item.status, 'submittedAt', item.submitted_at,
      'appealDeadlineAt', item.appeal_deadline_at
    ) order by item.submitted_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.appeals
      where status in ('submitted','under_review','more_information')
        and (p_before is null or submitted_at > p_before)
      order by submitted_at, id limit v_limit
    ) as item;
  elsif p_queue = 'credits' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requestId', item.id, 'artworkId', item.artwork_id,
      'requesterUserId', item.requester_user_id,
      'correctionType', item.correction_type,
      'requestedValue', item.requested_value,
      'status', item.status, 'createdAt', item.created_at
    ) order by item.created_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.credit_correction_requests
      where status in ('submitted','under_review')
        and (p_before is null or created_at > p_before)
      order by created_at, id limit v_limit
    ) as item;
  elsif p_queue = 'copyright' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'dmcaCaseId', item.id, 'externalReference', item.external_reference,
      'status', item.status, 'targetType', item.target_type,
      'targetId', item.target_id, 'repeatInfringerReview', item.repeat_infringer_review,
      'receivedAt', item.received_at
    ) order by item.received_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.dmca_cases
      where status not in ('closed','rejected')
        and (p_before is null or received_at > p_before)
      order by received_at, id limit v_limit
    ) as item;
  elsif p_queue = 'media' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'mediaAssetId', item.id, 'artworkId', item.artwork_id,
      'adapterKey', item.adapter_key, 'processingStatus', item.processing_status,
      'moderationStatus', item.moderation_status, 'createdAt', item.created_at
    ) order by item.created_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.media_assets
      where processing_status = 'pending_review' and moderation_status = 'pending'
        and (p_before is null or created_at > p_before)
      order by created_at, id limit v_limit
    ) as item;
  elsif p_queue = 'lifecycle' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requestId', item.id, 'action', item.action, 'status', item.status,
      'submittedAt', item.submitted_at,
      'coolingPeriodEndsAt', item.cooling_period_ends_at,
      'legalHoldPresent', item.legal_hold_present,
      'claimedAt', item.claimed_at
    ) order by item.submitted_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from private.account_lifecycle_requests
      where status not in ('completed','rejected','canceled')
        and (p_before is null or submitted_at > p_before)
      order by submitted_at, id limit v_limit
    ) as item;
  elsif p_queue = 'system' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'jobId', item.id, 'mediaAssetId', item.media_asset_id,
      'status', item.status, 'attemptCount', item.attempt_count,
      'availableAt', item.available_at, 'leaseExpiresAt', item.lease_expires_at,
      'lastErrorCode', item.last_error_code
    ) order by item.available_at, item.id), '[]'::jsonb)
    into v_items from (
      select * from artisan.media_processing_jobs
      where status in ('queued','claimed','dead_letter')
        and (p_before is null or created_at > p_before)
      order by available_at, id limit v_limit
    ) as item;
  elsif p_queue = 'audit' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'auditEventId', item.id, 'actorKind', item.actor_kind,
      'capability', item.capability, 'action', item.action,
      'targetType', item.target_type, 'targetId', item.target_id,
      'createdAt', item.created_at
    ) order by item.created_at desc, item.id desc), '[]'::jsonb)
    into v_items from (
      select * from private.community_audit_events
      where (p_before is null or created_at < p_before)
      order by created_at desc, id desc limit v_limit
    ) as item;
  end if;
  return pg_catalog.jsonb_build_object('queue', p_queue, 'items', v_items);
end;
$$;

alter function public.artisan_staff_work_queue(uuid, text, text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_staff_work_queue(uuid, text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_work_queue(uuid, text, text, integer, timestamptz) to service_role;

create or replace function public.artisan_staff_work_item(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report artisan.reports%rowtype;
  v_case artisan.moderation_cases%rowtype;
  v_appeal artisan.appeals%rowtype;
  v_capability text;
  v_response jsonb;
begin
  if p_client_request_id is null
     or p_item_type not in ('report','case','appeal')
     or p_item_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_staff_work_item_invalid';
  end if;
  if p_item_type = 'report' then
    select * into strict v_report from artisan.reports where id = p_item_id;
    v_capability := case when v_report.child_safety_sensitive
      then 'artisan_child_safety_manage' else 'artisan_reports_triage' end;
    perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
    v_response := pg_catalog.jsonb_build_object(
      'itemType', 'report', 'reportId', v_report.id,
      'reporterUserId', v_report.reporter_user_id,
      'targetType', v_report.target_type, 'targetId', v_report.target_id,
      'reasonCode', v_report.reason_code, 'summary', v_report.summary,
      'details', v_report.details, 'status', v_report.status,
      'priority', v_report.priority,
      'childSafetySensitive', v_report.child_safety_sensitive,
      'submittedAt', v_report.submitted_at, 'updatedAt', v_report.updated_at
    );
  elsif p_item_type = 'case' then
    select * into strict v_case from artisan.moderation_cases where id = p_item_id;
    v_capability := case when v_case.child_safety_sensitive
      then 'artisan_child_safety_manage' else 'artisan_cases_manage' end;
    perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
    v_response := pg_catalog.jsonb_build_object(
      'itemType', 'case', 'caseId', v_case.id, 'reportId', v_case.report_id,
      'caseType', v_case.case_type, 'status', v_case.status,
      'severity', v_case.severity, 'subjectUserId', v_case.subject_user_id,
      'targetType', v_case.target_type, 'targetId', v_case.target_id,
      'childSafetySensitive', v_case.child_safety_sensitive,
      'openedAt', v_case.opened_at, 'dueAt', v_case.due_at,
      'closedAt', v_case.closed_at, 'resolutionCode', v_case.resolution_code,
      'privateSummary', v_case.private_summary,
      'assignments', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'assignedUserId', assignment.assigned_user_id,
          'assignmentRole', assignment.assignment_role,
          'assignedAt', assignment.assigned_at,
          'releasedAt', assignment.released_at
        ) order by assignment.assigned_at desc)
        from (select * from artisan.case_assignments
          where case_id = v_case.id order by assigned_at desc limit 50) as assignment
      ), '[]'::jsonb),
      'actions', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'moderationActionId', action.id, 'actorUserId', action.actor_user_id,
          'action', action.action, 'targetType', action.target_type,
          'targetId', action.target_id, 'reasonCode', action.reason_code,
          'privateReason', action.private_reason, 'publicNotice', action.public_notice,
          'effectiveAt', action.effective_at, 'reversedAt', action.reversed_at
        ) order by action.created_at desc)
        from (select * from artisan.moderation_actions
          where case_id = v_case.id order by created_at desc limit 50) as action
      ), '[]'::jsonb)
    );
  else
    select * into strict v_appeal from artisan.appeals where id = p_item_id;
    perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_appeals_review');
    if v_appeal.case_id is not null and exists (
      select 1 from artisan.moderation_cases
      where id = v_appeal.case_id and child_safety_sensitive
    ) then
      perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_child_safety_manage');
    end if;
    v_capability := 'artisan_appeals_review';
    v_response := pg_catalog.jsonb_build_object(
      'itemType', 'appeal', 'appealId', v_appeal.id,
      'appellantUserId', v_appeal.appellant_user_id,
      'caseId', v_appeal.case_id, 'restrictionId', v_appeal.restriction_id,
      'moderationActionId', v_appeal.moderation_action_id,
      'statement', v_appeal.statement, 'status', v_appeal.status,
      'appealDeadlineAt', v_appeal.appeal_deadline_at,
      'reviewerUserId', v_appeal.reviewer_user_id,
      'decision', v_appeal.decision, 'privateReason', v_appeal.private_reason,
      'publicNotice', v_appeal.public_notice,
      'submittedAt', v_appeal.submitted_at, 'reviewedAt', v_appeal.reviewed_at
    );
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_staff_work_item_viewed',
    'artisan_' || p_item_type, p_item_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('itemType', p_item_type)
  );
  return v_response;
end;
$$;

alter function public.artisan_staff_work_item(uuid, text, uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_staff_work_item(uuid, text, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_work_item(uuid, text, uuid, text, uuid, text) to service_role;

create or replace function public.artisan_staff_triage_report(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_report_id uuid,
  p_decision text,
  p_case_type text,
  p_severity text,
  p_subject_user_id uuid,
  p_private_summary text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report artisan.reports%rowtype;
  v_case artisan.moderation_cases%rowtype;
  v_capability text;
  v_replay jsonb;
  v_response jsonb;
begin
  select * into strict v_report from artisan.reports
  where id = p_report_id and status in ('submitted','triaged','escalated') for update;
  v_capability := case when v_report.child_safety_sensitive
    then 'artisan_child_safety_manage' else 'artisan_reports_triage' end;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_decision not in ('open_case','dismiss','escalate')
     or (p_decision = 'open_case' and (
       p_case_type not in ('content','harassment','child_safety','copyright','stolen_art','impersonation','account_abuse','credit_dispute','malware','other')
       or p_severity not in ('low','normal','high','critical')
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_summary, ''))) not between 8 and 5000
     ))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_report_triage_invalid';
  end if;
  if v_report.child_safety_sensitive and p_decision = 'open_case' and p_case_type <> 'child_safety' then
    raise exception using errcode = '22023', message = 'artisan_child_safety_case_type_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_report_triaged',
    pg_catalog.jsonb_build_object(
      'reportId', p_report_id, 'decision', p_decision,
      'caseType', p_case_type, 'severity', p_severity,
      'subjectUserId', p_subject_user_id,
      'privateSummary', p_private_summary, 'privateReason', p_private_reason
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_decision = 'open_case' then
    insert into artisan.moderation_cases(
      report_id, case_type, status, severity, subject_user_id,
      target_type, target_id, child_safety_sensitive,
      opened_by, private_summary
    ) values (
      v_report.id, p_case_type, 'open', p_severity, p_subject_user_id,
      v_report.target_type, v_report.target_id, v_report.child_safety_sensitive,
      p_actor_user_id, pg_catalog.btrim(p_private_summary)
    ) returning * into v_case;
    update artisan.reports set status = 'case_opened', updated_at = pg_catalog.now()
    where id = p_report_id;
  elsif p_decision = 'dismiss' then
    update artisan.reports set status = 'dismissed', updated_at = pg_catalog.now()
    where id = p_report_id;
  else
    update artisan.reports set status = 'escalated', priority = 'urgent', updated_at = pg_catalog.now()
    where id = p_report_id;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_report_triaged',
    'artisan_report', p_report_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('decision', p_decision, 'caseId', v_case.id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'reportId', p_report_id, 'decision', p_decision,
    'caseId', v_case.id,
    'status', case p_decision when 'open_case' then 'case_opened'
      when 'dismiss' then 'dismissed' else 'escalated' end
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, uuid, text, text) to service_role;

create or replace function public.artisan_staff_assign_case(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_case_id uuid,
  p_assigned_user_id uuid,
  p_assignment_role text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case artisan.moderation_cases%rowtype;
  v_capability text;
  v_replay jsonb;
  v_response jsonb;
begin
  select * into strict v_case from artisan.moderation_cases
  where id = p_case_id and status <> 'closed' for update;
  v_capability := case when v_case.child_safety_sensitive
    then 'artisan_child_safety_manage' else 'artisan_cases_manage' end;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_assignment_role not in ('triage','investigator','decision_maker','appeal_reviewer','child_safety','copyright')
     or not private.community_account_is_recoverable(p_assigned_user_id)
     or (p_assignment_role = 'appeal_reviewer'
       and (p_assigned_user_id = v_case.opened_by or exists (
         select 1 from artisan.case_assignments as assignment
         where assignment.case_id = p_case_id
           and assignment.assigned_user_id = p_assigned_user_id
           and assignment.assignment_role in ('triage','investigator','decision_maker')
           and assignment.released_at is null
       )))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_case_assignment_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_case_assigned',
    pg_catalog.jsonb_build_object(
      'caseId', p_case_id, 'assignedUserId', p_assigned_user_id,
      'assignmentRole', p_assignment_role,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.case_assignments(
    case_id, assigned_user_id, assignment_role, assigned_by
  ) values (p_case_id, p_assigned_user_id, p_assignment_role, p_actor_user_id)
  on conflict (case_id, assigned_user_id, assignment_role) do update
  set released_at = null, assigned_by = excluded.assigned_by,
      assigned_at = pg_catalog.now();
  update artisan.moderation_cases set status = case when status = 'open' then 'triage' else status end
  where id = p_case_id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_case_assigned',
    'artisan_moderation_case', p_case_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('assignedUserId', p_assigned_user_id, 'assignmentRole', p_assignment_role)
  );
  v_response := pg_catalog.jsonb_build_object(
    'caseId', p_case_id, 'assignedUserId', p_assigned_user_id,
    'assignmentRole', p_assignment_role
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_assign_case(uuid, text, uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_assign_case(uuid, text, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_assign_case(uuid, text, uuid, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_staff_decide_appeal(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_appeal_id uuid,
  p_decision text,
  p_private_reason text,
  p_public_notice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appeal artisan.appeals%rowtype;
  v_case artisan.moderation_cases%rowtype;
  v_action artisan.moderation_actions%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_appeals_review');
  select * into strict v_appeal from artisan.appeals
  where id = p_appeal_id and status in ('submitted','under_review','more_information') for update;
  if v_appeal.case_id is not null then
    select * into strict v_case from artisan.moderation_cases where id = v_appeal.case_id;
  end if;
  if v_appeal.moderation_action_id is not null then
    select * into strict v_action from artisan.moderation_actions where id = v_appeal.moderation_action_id;
  end if;
  if p_decision not in ('granted','partially_granted','denied','more_information')
     or (v_case.id is not null and p_actor_user_id = v_case.opened_by)
     or (v_action.id is not null and p_actor_user_id = v_action.actor_user_id)
     or exists (
       select 1 from artisan.case_assignments as assignment
       where assignment.case_id = v_appeal.case_id
         and assignment.assigned_user_id = p_actor_user_id
         and assignment.assignment_role in ('triage','investigator','decision_maker')
         and assignment.released_at is null
     )
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_public_notice, ''))) not between 8 and 2000 then
    raise exception using errcode = '42501', message = 'artisan_appeal_independent_review_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_appeal_decided',
    pg_catalog.jsonb_build_object(
      'appealId', p_appeal_id, 'decision', p_decision,
      'privateReason', pg_catalog.btrim(p_private_reason),
      'publicNotice', pg_catalog.btrim(p_public_notice)
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.appeals
  set status = p_decision, reviewer_user_id = case when p_decision = 'more_information' then null else p_actor_user_id end,
      decision = case when p_decision = 'more_information' then null else p_decision end,
      private_reason = pg_catalog.btrim(p_private_reason),
      public_notice = pg_catalog.btrim(p_public_notice),
      reviewed_at = case when p_decision = 'more_information' then null else pg_catalog.now() end
  where id = p_appeal_id
  returning * into v_appeal;
  if p_decision = 'granted' and v_appeal.restriction_id is not null then
    update private.account_restrictions
    set status = 'lifted', lifted_at = pg_catalog.now(), lifted_by = p_actor_user_id,
        updated_at = pg_catalog.now()
    where id = v_appeal.restriction_id and status = 'active';
    if found then
      insert into private.account_restriction_actions(
        client_request_id, restriction_id, target_user_id,
        actor_user_id, action, private_reason
      ) select gen_random_uuid(), restriction.id, restriction.target_user_id,
        p_actor_user_id, 'lifted', pg_catalog.btrim(p_private_reason)
      from private.account_restrictions as restriction
      where restriction.id = v_appeal.restriction_id;
      perform private.recompute_community_participation((
        select restriction.target_user_id
        from private.account_restrictions as restriction
        where restriction.id = v_appeal.restriction_id
      ));
    end if;
  end if;
  if p_decision = 'granted' and v_appeal.moderation_action_id is not null then
    update artisan.moderation_actions
    set reversed_at = pg_catalog.now(), reversed_by = p_actor_user_id
    where id = v_appeal.moderation_action_id and reversed_at is null;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_appeals_review', 'artisan_appeal_decided',
    'artisan_appeal', p_appeal_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('decision', p_decision, 'requiresRestorationReview', p_decision in ('granted','partially_granted'))
  );
  v_response := pg_catalog.jsonb_build_object(
    'appealId', p_appeal_id, 'status', v_appeal.status,
    'requiresRestorationReview', p_decision in ('granted','partially_granted')
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_decide_appeal(uuid, text, uuid, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_decide_appeal(uuid, text, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_decide_appeal(uuid, text, uuid, uuid, text, text, text) to service_role;

create or replace function public.artisan_staff_restore_after_appeal(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_appeal_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_private_reason text,
  p_public_notice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appeal artisan.appeals%rowtype;
  v_case artisan.moderation_cases%rowtype;
  v_original_action artisan.moderation_actions%rowtype;
  v_restore_action artisan.moderation_actions%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_publication_manage');
  select * into strict v_appeal from artisan.appeals
  where id = p_appeal_id and status in ('granted','partially_granted') for update;
  if v_appeal.case_id is not null then
    select * into strict v_case from artisan.moderation_cases where id = v_appeal.case_id for update;
  elsif v_appeal.moderation_action_id is not null then
    select * into strict v_original_action from artisan.moderation_actions
    where id = v_appeal.moderation_action_id;
    select * into strict v_case from artisan.moderation_cases
    where id = v_original_action.case_id for update;
  else
    raise exception using errcode = '55000', message = 'artisan_appeal_content_restoration_not_applicable';
  end if;
  if v_appeal.moderation_action_id is not null and v_original_action.id is null then
    select * into strict v_original_action from artisan.moderation_actions
    where id = v_appeal.moderation_action_id;
  end if;
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal,
    case when v_case.child_safety_sensitive then 'artisan_child_safety_manage' else 'artisan_cases_manage' end
  );
  if p_client_request_id is null
     or p_target_type not in ('artwork','post','comment','submission','media')
     or not private.artisan_target_exists(p_target_type, p_target_id)
     or p_actor_user_id in (v_appeal.reviewer_user_id, v_case.opened_by, v_original_action.actor_user_id)
     or (v_original_action.id is not null and (
       v_original_action.target_type <> p_target_type
       or v_original_action.target_id is distinct from p_target_id
     ))
     or (v_original_action.id is null and (
       v_case.target_type <> p_target_type or v_case.target_id is distinct from p_target_id
     ))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_public_notice, ''))) not between 8 and 2000
     or exists (
       select 1 from artisan.legal_hold_records as hold
       where hold.target_type = p_target_type and hold.target_id = p_target_id
         and hold.released_at is null
     )
     or exists (
       select 1 from artisan.content_takedowns as takedown
       where takedown.target_type = p_target_type and takedown.target_id = p_target_id
         and takedown.restored_at is null
     ) then
    raise exception using errcode = '42501', message = 'artisan_independent_restoration_not_permitted';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_appeal_restoration_staged',
    pg_catalog.jsonb_build_object(
      'appealId', p_appeal_id, 'targetType', p_target_type, 'targetId', p_target_id,
      'privateReason', pg_catalog.btrim(p_private_reason),
      'publicNotice', pg_catalog.btrim(p_public_notice)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_target_type = 'artwork' then
    update artisan.artworks set status = 'approved', moderation_status = 'approved',
      removed_at = null, updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'post' then
    update artisan.forum_posts set status = 'approved', moderation_status = 'approved',
      removed_at = null, updated_at = pg_catalog.now() where id = p_target_id;
  elsif p_target_type = 'comment' then
    update artisan.comments set status = 'pending_review', moderation_status = 'pending',
      removed_at = null, published_at = null where id = p_target_id;
  elsif p_target_type = 'submission' then
    update artisan.challenge_submissions set status = 'eligible', moderation_status = 'approved',
      eligibility_status = 'eligible', updated_at = pg_catalog.now()
    where id = p_target_id;
  else
    update artisan.media_assets set processing_status = 'approved', moderation_status = 'approved',
      rejected_at = null, updated_at = pg_catalog.now() where id = p_target_id;
  end if;
  if v_original_action.id is not null and v_original_action.reversed_at is null then
    update artisan.moderation_actions set reversed_at = pg_catalog.now(), reversed_by = p_actor_user_id
    where id = v_original_action.id;
  end if;
  insert into artisan.moderation_actions(
    client_request_id, case_id, actor_user_id, capability, action,
    target_type, target_id, reason_code, private_reason, public_notice
  ) values (
    p_client_request_id, v_case.id, p_actor_user_id, 'artisan_publication_manage', 'restore',
    p_target_type, p_target_id, 'appeal_granted', pg_catalog.btrim(p_private_reason),
    pg_catalog.btrim(p_public_notice)
  ) returning * into v_restore_action;
  update artisan.moderation_cases
  set status = 'closed', closed_at = pg_catalog.now(),
      resolution_code = 'appeal_restoration_staged'
  where id = v_case.id;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_publication_manage',
    'artisan_appeal_restoration_staged', 'artisan_moderation_action',
    v_restore_action.id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'appealId', p_appeal_id, 'caseId', v_case.id,
      'contentTargetType', p_target_type, 'contentTargetId', p_target_id,
      'autoPublished', false
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'appealId', p_appeal_id, 'moderationActionId', v_restore_action.id,
    'targetType', p_target_type, 'targetId', p_target_id,
    'restorationStaged', true, 'autoPublished', false,
    'requiresPublicationReview', true
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_restore_after_appeal(uuid, text, uuid, uuid, text, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_restore_after_appeal(uuid, text, uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_restore_after_appeal(uuid, text, uuid, uuid, text, uuid, text, text) to service_role;

create or replace function private.artisan_credit_correction_value_is_safe(
  p_correction_type text,
  p_value jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_creation_method text;
  v_human_note text;
begin
  if p_correction_type not in ('credit_line','credited_name','collaborator','profile_link','creation_method','license')
     or p_value is null or coalesce(pg_catalog.jsonb_typeof(p_value), '') <> 'object'
     or pg_catalog.char_length(p_value::text) > 4000 then
    return false;
  end if;
  if p_correction_type = 'credit_line' then
    return pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'creditLine', ''))) between 1 and 200
      and not exists (select 1 from pg_catalog.jsonb_object_keys(p_value) as key where key <> 'creditLine');
  elsif p_correction_type = 'credited_name' then
    return pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'creditedName', ''))) between 1 and 160
      and not exists (select 1 from pg_catalog.jsonb_object_keys(p_value) as key where key <> 'creditedName');
  elsif p_correction_type = 'collaborator' then
    return pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'creditedName', ''))) between 1 and 160
      and coalesce(p_value ->> 'role', '') in ('artist','illustrator','photographer','model','editor','prompt_designer','composer','animator','curator','writer','other')
      and (not (p_value ? 'creditedHandle') or (
        pg_catalog.char_length(pg_catalog.lower(pg_catalog.ltrim(coalesce(p_value ->> 'creditedHandle', ''), '@'))) between 2 and 80
        and pg_catalog.lower(pg_catalog.ltrim(coalesce(p_value ->> 'creditedHandle', ''), '@'))
          ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
      ))
      and (not (p_value ? 'displayOrder') or (
        case when coalesce(p_value ->> 'displayOrder', '') ~ '^[0-9]{1,3}$'
          then (p_value ->> 'displayOrder')::integer between 0 and 100
          else false
        end
      ))
      and not exists (
        select 1 from pg_catalog.jsonb_object_keys(p_value) as key
        where key not in ('creditedName','creditedHandle','role','displayOrder')
      );
  elsif p_correction_type = 'profile_link' then
    return pg_catalog.char_length(pg_catalog.lower(pg_catalog.ltrim(coalesce(p_value ->> 'creditedHandle', ''), '@'))) between 2 and 80
      and pg_catalog.lower(pg_catalog.ltrim(coalesce(p_value ->> 'creditedHandle', ''), '@'))
        ~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$'
      and not exists (select 1 from pg_catalog.jsonb_object_keys(p_value) as key where key <> 'creditedHandle');
  elsif p_correction_type = 'creation_method' then
    v_creation_method := p_value ->> 'creationMethod';
    v_human_note := nullif(pg_catalog.btrim(p_value ->> 'humanContributionNote'), '');
    return v_creation_method in ('human_created','ai_assisted','ai_generated_human_directed','hybrid_mixed_process','procedural_generative')
      and ((v_creation_method = 'human_created' and v_human_note is null)
        or (v_creation_method <> 'human_created' and pg_catalog.char_length(coalesce(v_human_note, '')) between 8 and 2000))
      and not exists (
        select 1 from pg_catalog.jsonb_object_keys(p_value) as key
        where key not in ('creationMethod','humanContributionNote')
      );
  else
    return coalesce(p_value ->> 'licenseCode', '') in ('all_rights_reserved','cc_by_4_0','cc_by_sa_4_0','cc0_1_0','elysia_display_license')
      and not exists (select 1 from pg_catalog.jsonb_object_keys(p_value) as key where key <> 'licenseCode');
  end if;
end;
$$;

alter function private.artisan_credit_correction_value_is_safe(text, jsonb) owner to postgres;
revoke all privileges on function private.artisan_credit_correction_value_is_safe(text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_create_credit_correction(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_artwork_id uuid,
  p_correction_type text,
  p_requested_value jsonb,
  p_evidence_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artwork artisan.artworks%rowtype;
  v_request artisan.credit_correction_requests%rowtype;
  v_requested_value jsonb := p_requested_value;
  v_credited_user_id uuid;
  v_credited_handle text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select * into strict v_artwork from artisan.artworks where id = p_artwork_id;
  if p_client_request_id is null
     or not private.artisan_credit_correction_value_is_safe(p_correction_type, p_requested_value)
     or pg_catalog.char_length(coalesce(p_evidence_note, '')) > 5000
     or not (
       v_artwork.owner_user_id = p_actor_user_id
       or exists (select 1 from artisan.artwork_credits
         where artwork_id = p_artwork_id and credited_user_id = p_actor_user_id)
     or exists (select 1 from artisan.artwork_collaborators
         where artwork_id = p_artwork_id and collaborator_user_id = p_actor_user_id and status = 'accepted')
     )
     or (p_correction_type = 'license' and v_artwork.owner_user_id <> p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_credit_correction_not_permitted';
  end if;
  if p_correction_type = 'profile_link'
     or (p_correction_type = 'collaborator' and p_requested_value ? 'creditedHandle') then
    select resolved.user_id, resolved.current_handle
    into v_credited_user_id, v_credited_handle
    from private.community_resolve_profile_handle(
      p_requested_value ->> 'creditedHandle', true, true
    ) as resolved;
    if v_credited_user_id is null
       or (p_correction_type = 'profile_link' and v_credited_user_id <> p_actor_user_id) then
      raise exception using errcode = '42501', message = 'artisan_credit_handle_unavailable';
    end if;
    v_requested_value := pg_catalog.jsonb_set(
      p_requested_value, '{creditedHandle}', pg_catalog.to_jsonb(v_credited_handle), true
    );
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_credit_correction_created',
    pg_catalog.jsonb_build_object(
      'artworkId', p_artwork_id, 'correctionType', p_correction_type,
      'requestedValue', v_requested_value,
      'evidenceNote', nullif(pg_catalog.btrim(p_evidence_note), '')
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.credit_correction_requests(
    client_request_id, artwork_id, requester_user_id,
    correction_type, requested_value, requested_credited_user_id, evidence_note
  ) values (
    p_client_request_id, p_artwork_id, p_actor_user_id,
    p_correction_type, v_requested_value, v_credited_user_id,
    nullif(pg_catalog.btrim(p_evidence_note), '')
  ) returning * into v_request;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_credit_correction_created',
    'artisan_credit_correction', v_request.id, p_client_request_id,
    pg_catalog.jsonb_build_object('artworkId', p_artwork_id, 'correctionType', p_correction_type)
  );
  v_response := pg_catalog.jsonb_build_object(
    'requestId', v_request.id, 'artworkId', p_artwork_id,
    'correctionType', p_correction_type, 'status', v_request.status,
    'createdAt', v_request.created_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_create_credit_correction(uuid, uuid, uuid, text, jsonb, text) owner to postgres;
revoke all privileges on function public.artisan_create_credit_correction(uuid, uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_credit_correction(uuid, uuid, uuid, text, jsonb, text) to service_role;

create or replace function public.artisan_member_credit_correction(
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'requestId', request.id, 'artworkId', request.artwork_id,
      'correctionType', request.correction_type,
      'requestedValue', request.requested_value,
      'evidenceNote', request.evidence_note, 'status', request.status,
      'privateReason', request.private_reason,
      'createdAt', request.created_at, 'reviewedAt', request.reviewed_at
    ) from artisan.credit_correction_requests as request
    where request.id = p_request_id and request.requester_user_id = p_actor_user_id
      and private.community_account_is_recoverable(p_actor_user_id)
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_member_credit_correction(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_credit_correction(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_credit_correction(uuid, uuid) to service_role;

create or replace function public.artisan_staff_decide_credit_correction(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_request_id uuid,
  p_decision text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request artisan.credit_correction_requests%rowtype;
  v_artwork artisan.artworks%rowtype;
  v_document private.community_legal_document_versions%rowtype;
  v_profile_url text;
  v_credited_user_id uuid;
  v_credit_id uuid;
  v_event_type text := 'credit_changed';
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_credits_correct');
  select * into strict v_request from artisan.credit_correction_requests
  where id = p_request_id and status in ('submitted','under_review') for update;
  select * into strict v_artwork from artisan.artworks where id = v_request.artwork_id for update;
  if p_client_request_id is null
     or p_decision not in ('under_review','approved','rejected')
     or p_actor_user_id = v_request.requester_user_id
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '42501', message = 'artisan_credit_independent_review_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_credit_correction_decided',
    pg_catalog.jsonb_build_object(
      'requestId', p_request_id, 'decision', p_decision,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_decision = 'approved' then
    if v_request.correction_type = 'credit_line' then
      update artisan.artworks set credit_line = pg_catalog.btrim(v_request.requested_value ->> 'creditLine'),
        updated_at = pg_catalog.now() where id = v_artwork.id returning * into v_artwork;
    elsif v_request.correction_type = 'credited_name' then
      update artisan.artwork_credits
      set credited_name = pg_catalog.btrim(v_request.requested_value ->> 'creditedName')
      where artwork_id = v_artwork.id and credited_user_id = v_request.requester_user_id;
      if not found and v_request.requester_user_id = v_artwork.owner_user_id then
        update artisan.artworks
        set credited_name_or_pseudonym = pg_catalog.btrim(v_request.requested_value ->> 'creditedName'),
            updated_at = pg_catalog.now()
        where id = v_artwork.id returning * into v_artwork;
        update artisan.artwork_credits
        set credited_name = v_artwork.credited_name_or_pseudonym
        where artwork_id = v_artwork.id and credited_user_id = v_artwork.owner_user_id and role = 'artist';
      elsif not found then
        raise exception using errcode = '55000', message = 'artisan_credit_record_missing';
      end if;
    elsif v_request.correction_type = 'collaborator' then
      v_credited_user_id := v_request.requested_credited_user_id;
      if v_credited_user_id is not null and not private.community_account_is_recoverable(v_credited_user_id) then
        raise exception using errcode = '55000', message = 'artisan_credited_account_unavailable';
      end if;
      update artisan.artwork_credits
      set credited_name = pg_catalog.btrim(v_request.requested_value ->> 'creditedName'),
          display_order = coalesce((v_request.requested_value ->> 'displayOrder')::integer, display_order),
          confirmation_status = case when v_credited_user_id is null then 'not_required'
            when v_credited_user_id = v_request.requester_user_id then 'confirmed' else 'pending' end,
          confirmed_at = case when v_credited_user_id = v_request.requester_user_id then pg_catalog.now() else null end
      where artwork_id = v_artwork.id
        and credited_user_id is not distinct from v_credited_user_id
        and role = v_request.requested_value ->> 'role'
      returning id into v_credit_id;
      if not found then
        insert into artisan.artwork_credits(
          artwork_id, credited_user_id, credited_name, role, display_order,
          confirmation_status, confirmed_at
        ) values (
          v_artwork.id, v_credited_user_id,
          pg_catalog.btrim(v_request.requested_value ->> 'creditedName'),
          v_request.requested_value ->> 'role',
          coalesce((v_request.requested_value ->> 'displayOrder')::integer, 0),
          case when v_credited_user_id is null then 'not_required'
            when v_credited_user_id = v_request.requester_user_id then 'confirmed' else 'pending' end,
          case when v_credited_user_id = v_request.requester_user_id then pg_catalog.now() else null end
        ) returning id into v_credit_id;
      end if;
    elsif v_request.correction_type = 'profile_link' then
      select card.canonical_profile_url into strict v_profile_url
      from public.profile_public_cards as card
      where card.user_id = v_request.requested_credited_user_id
        and card.public_profile_enabled
        and private.community_profile_is_public(card.user_id);
      update artisan.artwork_credits set profile_url = v_profile_url
      where artwork_id = v_artwork.id and credited_user_id = v_request.requested_credited_user_id;
      if v_request.requested_credited_user_id = v_artwork.owner_user_id then
        update artisan.artworks set preferred_profile_url = v_profile_url,
          updated_at = pg_catalog.now() where id = v_artwork.id returning * into v_artwork;
      elsif not found then
        raise exception using errcode = '55000', message = 'artisan_credit_record_missing';
      end if;
    elsif v_request.correction_type = 'creation_method' then
      update artisan.artworks
      set creation_method = v_request.requested_value ->> 'creationMethod',
          human_contribution_note = nullif(pg_catalog.btrim(v_request.requested_value ->> 'humanContributionNote'), ''),
          updated_at = pg_catalog.now()
      where id = v_artwork.id returning * into v_artwork;
      v_event_type := 'creation_method_changed';
    else
      if v_request.requester_user_id <> v_artwork.owner_user_id then
        raise exception using errcode = '42501', message = 'artisan_license_owner_required';
      end if;
      select document.* into strict v_document
      from private.community_active_legal_documents as active_document
      join private.community_legal_document_versions as document
        on document.document_key = active_document.document_key
       and document.document_version = active_document.document_version
      where active_document.document_key = 'artist_platform_license'
        and document.status = 'approved'
        and exists (
          select 1 from private.community_terms_acceptances as acceptance
          where acceptance.user_id = v_request.requester_user_id
            and acceptance.document_key = document.document_key
            and acceptance.document_version = document.document_version
            and acceptance.content_sha256 = document.content_sha256
        );
      update artisan.artwork_licenses set terminated_at = pg_catalog.now(),
        termination_reason = 'Approved artist-requested license correction.'
      where artwork_id = v_artwork.id and scope = 'artisan_display' and terminated_at is null;
      insert into artisan.artwork_licenses(
        artwork_id, license_code, document_key, document_version,
        content_sha256, scope, accepted_by
      ) values (
        v_artwork.id, v_request.requested_value ->> 'licenseCode',
        v_document.document_key, v_document.document_version,
        v_document.content_sha256, 'artisan_display', v_request.requester_user_id
      );
      update artisan.artworks set license_code = v_request.requested_value ->> 'licenseCode',
        updated_at = pg_catalog.now() where id = v_artwork.id returning * into v_artwork;
      v_event_type := 'license_changed';
    end if;
    update artisan.gallery_entries
    set frozen_credit_line = v_artwork.credit_line,
        frozen_profile_url = v_artwork.preferred_profile_url,
        frozen_creation_method = v_artwork.creation_method
    where artwork_id = v_artwork.id;
    insert into artisan.artwork_provenance_events(
      client_request_id, artwork_id, actor_user_id, event_type, metadata
    ) values (
      p_client_request_id, v_artwork.id, p_actor_user_id, v_event_type,
      pg_catalog.jsonb_build_object(
        'creditCorrectionRequestId', p_request_id,
        'correctionType', v_request.correction_type
      )
    );
  end if;
  update artisan.credit_correction_requests
  set status = p_decision,
      reviewed_by = case when p_decision = 'under_review' then null else p_actor_user_id end,
      reviewed_at = case when p_decision = 'under_review' then null else pg_catalog.now() end,
      private_reason = pg_catalog.btrim(p_private_reason)
  where id = p_request_id returning * into v_request;
  insert into artisan.notifications(
    delivery_key, user_id, notification_type, title, body,
    action_path, source_type, source_id
  ) values (
    'credit:' || p_request_id::text || ':' || p_decision,
    v_request.requester_user_id, 'credit_update',
    'Credit correction updated', 'Your credit correction is now ' || replace(p_decision, '_', ' ') || '.',
    '/account/credits', 'credit_correction', p_request_id
  ) on conflict (delivery_key) do nothing;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_credits_correct',
    'artisan_credit_correction_decided', 'artisan_credit_correction',
    p_request_id, p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('decision', p_decision, 'artworkId', v_request.artwork_id)
  );
  v_response := pg_catalog.jsonb_build_object(
    'requestId', p_request_id, 'artworkId', v_request.artwork_id,
    'status', v_request.status, 'reviewedAt', v_request.reviewed_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_decide_credit_correction(uuid, text, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_decide_credit_correction(uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_decide_credit_correction(uuid, text, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_staff_set_legal_hold(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_action text,
  p_hold_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_case_id uuid,
  p_scope text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold artisan.legal_hold_records%rowtype;
  v_capability text;
  v_replay jsonb;
  v_response jsonb;
begin
  if p_action = 'release' then
    select * into strict v_hold from artisan.legal_hold_records
    where id = p_hold_id and released_at is null for update;
    p_target_type := v_hold.target_type;
    p_target_id := v_hold.target_id;
    p_case_id := v_hold.case_id;
    p_scope := v_hold.scope;
  end if;
  v_capability := case p_scope
    when 'child_safety' then 'artisan_child_safety_manage'
    when 'copyright' then 'artisan_copyright_manage'
    else 'artisan_cases_manage'
  end;
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, v_capability);
  if p_client_request_id is null
     or p_action not in ('impose','release')
     or (p_action = 'impose' and p_hold_id is not null)
     or (p_action = 'release' and p_hold_id is null)
     or p_scope not in ('content','media_original','moderation_evidence','copyright','child_safety','challenge_agreement')
     or p_target_type not in ('artwork','post','comment','profile','challenge','submission','media','account')
     or not (
       (p_target_type = 'account' and private.community_account_is_recoverable(p_target_id))
       or (p_target_type <> 'account' and private.artisan_target_exists(p_target_type, p_target_id))
     )
     or (p_case_id is not null and not exists (
       select 1 from artisan.moderation_cases where id = p_case_id
     ))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '22023', message = 'artisan_legal_hold_action_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_legal_hold_' || p_action,
    pg_catalog.jsonb_build_object(
      'holdId', p_hold_id, 'targetType', p_target_type, 'targetId', p_target_id,
      'caseId', p_case_id, 'scope', p_scope,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_action = 'impose' then
    insert into artisan.legal_hold_records(
      target_type, target_id, case_id, scope, imposed_by, private_reason
    ) values (
      p_target_type, p_target_id, p_case_id, p_scope,
      p_actor_user_id, pg_catalog.btrim(p_private_reason)
    ) returning * into v_hold;
  else
    update artisan.legal_hold_records
    set released_at = pg_catalog.now(), released_by = p_actor_user_id
    where id = p_hold_id and released_at is null returning * into v_hold;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', v_capability, 'artisan_legal_hold_' || p_action,
    'artisan_legal_hold', v_hold.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'contentTargetType', v_hold.target_type,
      'contentTargetId', v_hold.target_id, 'scope', v_hold.scope,
      'caseId', v_hold.case_id
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'holdId', v_hold.id, 'action', p_action,
    'targetType', v_hold.target_type, 'targetId', v_hold.target_id,
    'scope', v_hold.scope, 'active', v_hold.released_at is null
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_set_legal_hold(uuid, text, uuid, text, uuid, text, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_set_legal_hold(uuid, text, uuid, text, uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_set_legal_hold(uuid, text, uuid, text, uuid, text, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_staff_create_dmca_case(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_external_reference text,
  p_target_type text,
  p_target_id uuid,
  p_claimant_contact_ciphertext text,
  p_notice_sha256 text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case artisan.dmca_cases%rowtype;
  v_hold artisan.legal_hold_records%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_copyright_manage');
  if p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_external_reference, ''))) not between 8 and 200
     or p_target_type not in ('artwork','post','comment','media')
     or not private.artisan_target_exists(p_target_type, p_target_id)
     or pg_catalog.char_length(coalesce(p_claimant_contact_ciphertext, '')) not between 32 and 20000
     or coalesce(p_notice_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '22023', message = 'artisan_dmca_case_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_dmca_case_created',
    pg_catalog.jsonb_build_object(
      'externalReference', pg_catalog.btrim(p_external_reference),
      'targetType', p_target_type, 'targetId', p_target_id,
      'claimantContactCiphertext', p_claimant_contact_ciphertext,
      'noticeSha256', p_notice_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.dmca_cases(
    external_reference, target_type, target_id,
    claimant_contact_ciphertext, notice_sha256, assigned_to
  ) values (
    pg_catalog.btrim(p_external_reference), p_target_type, p_target_id,
    p_claimant_contact_ciphertext, p_notice_sha256, p_actor_user_id
  ) returning * into v_case;
  insert into artisan.legal_hold_records(
    target_type, target_id, scope, imposed_by, private_reason
  ) values (
    p_target_type, p_target_id, 'copyright', p_actor_user_id,
    pg_catalog.btrim(p_private_reason)
  ) returning * into v_hold;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_copyright_manage',
    'artisan_dmca_case_created', 'artisan_dmca_case', v_case.id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'contentTargetType', p_target_type, 'contentTargetId', p_target_id,
      'noticeSha256', p_notice_sha256, 'legalHoldId', v_hold.id
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'dmcaCaseId', v_case.id, 'status', v_case.status,
    'targetType', v_case.target_type, 'targetId', v_case.target_id,
    'legalHoldId', v_hold.id, 'receivedAt', v_case.received_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_create_dmca_case(uuid, text, uuid, text, text, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_create_dmca_case(uuid, text, uuid, text, text, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_create_dmca_case(uuid, text, uuid, text, text, uuid, text, text, text) to service_role;

create or replace function public.artisan_staff_record_dmca_action(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_dmca_case_id uuid,
  p_action text,
  p_counter_notice_sha256 text,
  p_decision_evidence_sha256 text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case artisan.dmca_cases%rowtype;
  v_to_status text;
  v_replay jsonb;
  v_response jsonb;
  v_takedown_id uuid;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_copyright_manage');
  select * into strict v_case from artisan.dmca_cases where id = p_dmca_case_id for update;
  v_to_status := case p_action
    when 'begin_validation' then 'validating'
    when 'takedown' then 'takedown'
    when 'counter_notice' then 'counter_notice_received'
    when 'begin_waiting_period' then 'waiting_period'
    when 'restore' then 'restored'
    when 'close' then 'closed'
    when 'reject' then 'rejected'
    when 'mark_repeat_infringer_review' then v_case.status
    else null
  end;
  if p_client_request_id is null or v_to_status is null
     or not (case v_case.status
       when 'notice_received' then p_action in ('begin_validation','reject')
       when 'validating' then p_action in ('takedown','reject')
       when 'takedown' then p_action in ('counter_notice','close','mark_repeat_infringer_review')
       when 'counter_notice_received' then p_action in ('begin_waiting_period','close')
       when 'waiting_period' then p_action in ('restore','close')
       when 'restored' then p_action = 'close'
       else false
     end)
     or (p_action = 'counter_notice' and coalesce(p_counter_notice_sha256, '') !~ '^[0-9a-f]{64}$')
     or (p_action <> 'counter_notice' and p_counter_notice_sha256 is not null)
     or (p_action in ('takedown','counter_notice','restore','reject','close')
       and coalesce(p_decision_evidence_sha256, '') !~ '^[0-9a-f]{64}$')
     or (p_action not in ('takedown','counter_notice','restore','reject','close')
       and p_decision_evidence_sha256 is not null)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '55000', message = 'artisan_dmca_transition_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_dmca_action_recorded',
    pg_catalog.jsonb_build_object(
      'dmcaCaseId', p_dmca_case_id, 'action', p_action,
      'counterNoticeSha256', p_counter_notice_sha256,
      'decisionEvidenceSha256', p_decision_evidence_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_action = 'takedown' then
    insert into artisan.content_takedowns(
      client_request_id, target_type, target_id, legal_basis,
      dmca_case_id, imposed_by
    ) values (
      p_client_request_id, v_case.target_type, v_case.target_id, 'dmca',
      v_case.id, p_actor_user_id
    ) returning id into v_takedown_id;
    if v_case.target_type = 'artwork' then
      update artisan.artworks set status = 'removed', moderation_status = 'removed',
        removed_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = v_case.target_id;
    elsif v_case.target_type = 'post' then
      update artisan.forum_posts set status = 'removed', moderation_status = 'removed',
        removed_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = v_case.target_id;
    elsif v_case.target_type = 'comment' then
      update artisan.comments set status = 'removed_by_moderator', moderation_status = 'removed',
        removed_at = pg_catalog.now() where id = v_case.target_id;
    else
      update artisan.media_assets set processing_status = 'removed', moderation_status = 'removed',
        updated_at = pg_catalog.now() where id = v_case.target_id;
    end if;
  elsif p_action = 'restore' then
    update artisan.content_takedowns set restored_at = pg_catalog.now(), restored_by = p_actor_user_id
    where dmca_case_id = v_case.id and restored_at is null returning id into v_takedown_id;
    if not found then
      raise exception using errcode = '55000', message = 'artisan_dmca_active_takedown_missing';
    end if;
    update artisan.legal_hold_records set released_at = pg_catalog.now(), released_by = p_actor_user_id
    where target_type = v_case.target_type and target_id = v_case.target_id
      and scope = 'copyright' and released_at is null;
    if v_case.target_type = 'artwork' then
      update artisan.artworks set status = 'approved', moderation_status = 'approved',
        removed_at = null, updated_at = pg_catalog.now() where id = v_case.target_id;
    elsif v_case.target_type = 'post' then
      update artisan.forum_posts set status = 'approved', moderation_status = 'approved',
        removed_at = null, updated_at = pg_catalog.now() where id = v_case.target_id;
    elsif v_case.target_type = 'comment' then
      update artisan.comments set status = 'pending_review', moderation_status = 'pending',
        removed_at = null, published_at = null where id = v_case.target_id;
    else
      update artisan.media_assets set processing_status = 'approved', moderation_status = 'approved',
        rejected_at = null, updated_at = pg_catalog.now() where id = v_case.target_id;
    end if;
  elsif p_action = 'reject' then
    update artisan.legal_hold_records set released_at = pg_catalog.now(), released_by = p_actor_user_id
    where target_type = v_case.target_type and target_id = v_case.target_id
      and scope = 'copyright' and released_at is null;
  end if;
  update artisan.dmca_cases
  set status = v_to_status,
      counter_notice_sha256 = case when p_action = 'counter_notice'
        then p_counter_notice_sha256 else counter_notice_sha256 end,
      repeat_infringer_review = repeat_infringer_review or p_action = 'mark_repeat_infringer_review',
      takedown_at = case when p_action = 'takedown' then pg_catalog.now() else takedown_at end,
      counter_notice_at = case when p_action = 'counter_notice' then pg_catalog.now() else counter_notice_at end,
      restoration_at = case when p_action = 'restore' then pg_catalog.now() else restoration_at end,
      closed_at = case when p_action in ('close','reject') then pg_catalog.now() else closed_at end,
      assigned_to = p_actor_user_id
  where id = p_dmca_case_id returning * into v_case;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_copyright_manage',
    'artisan_dmca_' || p_action, 'artisan_dmca_case', p_dmca_case_id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'fromStatus', case p_action when 'begin_validation' then 'notice_received' else null end,
      'toStatus', v_case.status, 'takedownId', v_takedown_id,
      'decisionEvidenceRecorded', p_decision_evidence_sha256 is not null,
      'autoPublished', false
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'dmcaCaseId', v_case.id, 'action', p_action, 'status', v_case.status,
    'targetType', v_case.target_type, 'targetId', v_case.target_id,
    'takedownId', v_takedown_id,
    'autoPublished', false,
    'requiresPublicationReview', p_action = 'restore'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_record_dmca_action(uuid, text, uuid, uuid, text, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_record_dmca_action(uuid, text, uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_record_dmca_action(uuid, text, uuid, uuid, text, text, text, text) to service_role;

create or replace function public.artisan_staff_record_child_safety_handoff(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_case_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_evidence_sha256 text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case artisan.moderation_cases%rowtype;
  v_moderation_action artisan.moderation_actions%rowtype;
  v_hold artisan.legal_hold_records%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'artisan_child_safety_manage');
  select * into strict v_case from artisan.moderation_cases
  where id = p_case_id and child_safety_sensitive and status <> 'closed' for update;
  if p_client_request_id is null
     or p_action not in ('internal_escalation','evidence_preserved','evidence_released')
     or p_target_type not in ('artwork','post','comment','profile','challenge','submission','media','account')
     or not (
       (p_target_type = 'account' and private.community_account_is_recoverable(p_target_id))
       or (p_target_type <> 'account' and private.artisan_target_exists(p_target_type, p_target_id))
     )
     or (v_case.target_id is not null and (
       v_case.target_type <> p_target_type or v_case.target_id <> p_target_id
     ))
     or (p_action in ('evidence_preserved','evidence_released')
       and coalesce(p_evidence_sha256, '') !~ '^[0-9a-f]{64}$')
     or (p_action = 'internal_escalation' and p_evidence_sha256 is not null)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 5000 then
    raise exception using errcode = '22023', message = 'artisan_child_safety_handoff_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_child_safety_handoff_recorded',
    pg_catalog.jsonb_build_object(
      'caseId', p_case_id, 'action', p_action,
      'targetType', p_target_type, 'targetId', p_target_id,
      'evidenceSha256', p_evidence_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_action = 'evidence_preserved' then
    insert into artisan.legal_hold_records(
      target_type, target_id, case_id, scope, imposed_by, private_reason
    ) values (
      p_target_type, p_target_id, p_case_id, 'child_safety',
      p_actor_user_id, pg_catalog.btrim(p_private_reason)
    ) returning * into v_hold;
  elsif p_action = 'evidence_released' then
    select * into strict v_hold from artisan.legal_hold_records
    where case_id = p_case_id and target_type = p_target_type
      and target_id = p_target_id and scope = 'child_safety'
      and released_at is null
    order by imposed_at desc limit 1 for update;
    update artisan.legal_hold_records
    set released_at = pg_catalog.now(), released_by = p_actor_user_id
    where id = v_hold.id returning * into v_hold;
  else
    update artisan.moderation_cases
    set status = 'investigating', severity = 'critical',
        due_at = least(coalesce(due_at, pg_catalog.now() + interval '1 hour'), pg_catalog.now() + interval '1 hour')
    where id = p_case_id returning * into v_case;
  end if;
  insert into artisan.moderation_actions(
    client_request_id, case_id, actor_user_id, capability, action,
    target_type, target_id, reason_code, private_reason
  ) values (
    p_client_request_id, p_case_id, p_actor_user_id, 'artisan_child_safety_manage',
    case p_action when 'internal_escalation' then 'cross_community_escalation'
      when 'evidence_preserved' then 'preserve_evidence' else 'release_evidence' end,
    p_target_type, p_target_id, 'child_safety_internal', pg_catalog.btrim(p_private_reason)
  ) returning * into v_moderation_action;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_child_safety_manage',
    'artisan_child_safety_' || p_action, 'artisan_moderation_case', p_case_id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'moderationActionId', v_moderation_action.id,
      'legalHoldId', v_hold.id,
      'evidenceHashRecorded', p_evidence_sha256 is not null,
      'externalFilingPerformed', false
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'caseId', p_case_id, 'action', p_action,
    'moderationActionId', v_moderation_action.id,
    'legalHoldId', v_hold.id,
    'externalFilingPerformed', false
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_record_child_safety_handoff(uuid, text, uuid, uuid, text, text, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_record_child_safety_handoff(uuid, text, uuid, uuid, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_record_child_safety_handoff(uuid, text, uuid, uuid, text, text, uuid, text, text) to service_role;

-- Actor-first, service-only aliases for the Artisan API Worker. The Worker
-- verifies the user token, then the database installs only the verified UUID in
-- transaction-local claims before invoking the self-service invariant logic.
create or replace function public.artisan_update_artwork(
  p_actor_user_id uuid, p_artwork_id uuid, p_client_request_id uuid,
  p_title text, p_description text, p_artist_statement text,
  p_creation_method text, p_human_contribution_note text,
  p_credit_line text, p_credited_name text, p_license_code text,
  p_download_allowed boolean, p_alt_text text, p_content_warnings text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.update_current_user_artwork_draft(
    p_artwork_id, p_client_request_id, p_title, p_description,
    p_artist_statement, p_creation_method, p_human_contribution_note,
    p_credit_line, p_credited_name, p_license_code,
    p_download_allowed, p_alt_text, p_content_warnings
  );
end;
$$;

alter function public.artisan_update_artwork(uuid, uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[]) owner to postgres;
revoke all privileges on function public.artisan_update_artwork(uuid, uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_artwork(uuid, uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[]) to service_role;

create or replace function public.artisan_update_post(
  p_actor_user_id uuid, p_client_request_id uuid, p_post_id uuid,
  p_title text, p_artist_statement text, p_theme jsonb,
  p_comments_enabled boolean, p_appreciations_enabled boolean,
  p_slow_mode_seconds integer, p_artwork_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.update_current_user_artisan_post_draft(
    p_client_request_id, p_post_id, p_title, p_artist_statement,
    p_theme, p_comments_enabled, p_appreciations_enabled,
    p_slow_mode_seconds, p_artwork_ids
  );
end;
$$;

alter function public.artisan_update_post(uuid, uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[]) owner to postgres;
revoke all privileges on function public.artisan_update_post(uuid, uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_post(uuid, uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[]) to service_role;

create or replace function public.artisan_set_room_controls(
  p_actor_user_id uuid, p_client_request_id uuid, p_post_id uuid,
  p_comments_enabled boolean, p_appreciations_enabled boolean,
  p_slow_mode_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.set_current_user_artisan_room_controls(
    p_client_request_id, p_post_id, p_comments_enabled,
    p_appreciations_enabled, p_slow_mode_seconds
  );
end;
$$;

alter function public.artisan_set_room_controls(uuid, uuid, uuid, boolean, boolean, integer) owner to postgres;
revoke all privileges on function public.artisan_set_room_controls(uuid, uuid, uuid, boolean, boolean, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_set_room_controls(uuid, uuid, uuid, boolean, boolean, integer) to service_role;

create or replace function public.artisan_withdraw_content(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_target_type text, p_target_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.withdraw_current_user_artisan_content(
    p_client_request_id, p_target_type, p_target_id, p_reason
  );
end;
$$;

alter function public.artisan_withdraw_content(uuid, uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_withdraw_content(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_withdraw_content(uuid, uuid, text, uuid, text) to service_role;

create or replace function public.artisan_withdraw_submission(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_submission_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.withdraw_current_user_challenge_submission(
    p_client_request_id, p_submission_id, p_reason
  );
end;
$$;

alter function public.artisan_withdraw_submission(uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_withdraw_submission(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_withdraw_submission(uuid, uuid, uuid, text) to service_role;

create or replace function public.artisan_member_activity(
  p_actor_user_id uuid, p_kind text,
  p_limit integer default 20, p_before timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.current_user_artisan_activity(
    p_kind, p_limit, p_before, p_before_id
  );
end;
$$;

alter function public.artisan_member_activity(uuid, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_activity(uuid, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_activity(uuid, text, integer, timestamptz, uuid) to service_role;

create or replace function public.artisan_update_media_accessibility(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_media_asset_id uuid,
  p_accessibility_description text,
  p_transcript text,
  p_audio_description text,
  p_keyboard_instructions text,
  p_static_equivalent_description text,
  p_caption_tracks jsonb,
  p_loud_audio_warning boolean,
  p_spoken_content boolean,
  p_creator_declares_flash_risk boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset artisan.media_assets%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_accessibility_description, ''))) not between 1 and 4000
     or pg_catalog.char_length(coalesce(p_transcript, '')) > 30000
     or pg_catalog.char_length(coalesce(p_audio_description, '')) > 10000
     or pg_catalog.char_length(coalesce(p_keyboard_instructions, '')) > 5000
     or pg_catalog.char_length(coalesce(p_static_equivalent_description, '')) > 10000
     or not private.artisan_caption_tracks_are_safe(coalesce(p_caption_tracks, '[]'::jsonb))
     or p_loud_audio_warning is null
     or p_spoken_content is null
     or p_creator_declares_flash_risk is null then
    raise exception using errcode = '22023', message = 'artisan_media_accessibility_invalid';
  end if;
  select * into strict v_asset from artisan.media_assets
  where id = p_media_asset_id and owner_user_id = p_actor_user_id
    and processing_status not in ('rejected','expired','removed')
    and moderation_status <> 'legal_hold'
  for update;
  if v_asset.adapter_key = 'interactive_work' and (
       pg_catalog.char_length(pg_catalog.btrim(coalesce(p_keyboard_instructions, ''))) < 8
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_static_equivalent_description, ''))) < 8
     ) then
    raise exception using errcode = '22023', message = 'artisan_interactive_accessibility_required';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_media_accessibility_updated',
    pg_catalog.jsonb_build_object(
      'mediaAssetId', p_media_asset_id,
      'accessibilityDescription', pg_catalog.btrim(p_accessibility_description),
      'transcript', nullif(pg_catalog.btrim(p_transcript), ''),
      'audioDescription', nullif(pg_catalog.btrim(p_audio_description), ''),
      'keyboardInstructions', nullif(pg_catalog.btrim(p_keyboard_instructions), ''),
      'staticEquivalent', nullif(pg_catalog.btrim(p_static_equivalent_description), ''),
      'captionTracks', coalesce(p_caption_tracks, '[]'::jsonb),
      'loudAudioWarning', p_loud_audio_warning,
      'spokenContent', p_spoken_content,
      'creatorDeclaresFlashRisk', p_creator_declares_flash_risk
    )
  );
  if v_replay is not null then return v_replay; end if;
  if v_asset.processing_status in ('approved','published') then
    if exists (
      select 1 from artisan.challenge_submissions as submission
      left join artisan.submission_media as linked
        on linked.submission_id = submission.id
      where (submission.artwork_id = v_asset.artwork_id
          or linked.media_asset_id = p_media_asset_id)
        and submission.status not in ('draft','changes_requested','ineligible','withdrawn')
    ) or exists (
      select 1 from artisan.gallery_entries as gallery
      where gallery.artwork_id = v_asset.artwork_id and gallery.status = 'published'
    ) then
      raise exception using errcode = '55000',
        message = 'artisan_media_revision_requires_correction_workflow';
    end if;
    update artisan.forum_posts as post
    set status = 'draft', moderation_status = 'unreviewed',
        submitted_at = null, published_at = null, updated_at = pg_catalog.now()
    where post.id in (
      select link.post_id from artisan.post_artworks as link
      where link.artwork_id = v_asset.artwork_id
    ) and post.status in ('approved','published');
    update artisan.artworks
    set status = 'draft', moderation_status = 'unreviewed',
        submitted_at = null, published_at = null, updated_at = pg_catalog.now()
    where id = v_asset.artwork_id and status in ('approved','published');
  end if;
  update artisan.media_assets
  set accessibility_description = pg_catalog.btrim(p_accessibility_description),
      transcript = nullif(pg_catalog.btrim(p_transcript), ''),
      audio_description = nullif(pg_catalog.btrim(p_audio_description), ''),
      keyboard_instructions = nullif(pg_catalog.btrim(p_keyboard_instructions), ''),
      static_equivalent_description = nullif(pg_catalog.btrim(p_static_equivalent_description), ''),
      caption_tracks = coalesce(p_caption_tracks, '[]'::jsonb),
      loud_audio_warning = p_loud_audio_warning,
      spoken_content = p_spoken_content,
      creator_declared_flash_risk = p_creator_declares_flash_risk,
      processing_status = case when v_asset.processing_status in ('approved','published')
        then 'pending_review' else processing_status end,
      moderation_status = case when v_asset.processing_status in ('approved','published')
        then 'pending' else moderation_status end,
      approved_at = case when v_asset.processing_status in ('approved','published')
        then null else approved_at end,
      published_at = case when v_asset.processing_status in ('approved','published')
        then null else published_at end,
      updated_at = pg_catalog.now()
  where id = p_media_asset_id
  returning * into v_asset;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_media_accessibility_updated',
    'artisan_media_asset', p_media_asset_id, p_client_request_id,
    pg_catalog.jsonb_build_object('adapterKey', v_asset.adapter_key)
  );
  v_response := pg_catalog.jsonb_build_object(
    'mediaAssetId', p_media_asset_id,
    'accessibilityDescription', v_asset.accessibility_description,
    'captionTracks', v_asset.caption_tracks,
    'loudAudioWarning', v_asset.loud_audio_warning,
    'spokenContent', v_asset.spoken_content,
    'creatorDeclaresFlashRisk', v_asset.creator_declared_flash_risk,
    'processingStatus', v_asset.processing_status,
    'requiresReview', v_asset.processing_status = 'pending_review'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_update_media_accessibility(uuid, uuid, uuid, text, text, text, text, text, jsonb, boolean, boolean, boolean) owner to postgres;
revoke all privileges on function public.artisan_update_media_accessibility(uuid, uuid, uuid, text, text, text, text, text, jsonb, boolean, boolean, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_update_media_accessibility(uuid, uuid, uuid, text, text, text, text, text, jsonb, boolean, boolean, boolean) to service_role;

-- Browser contracts identify people by their canonical Commons Profile handle,
-- never by an auth UUID. Resolution stays inside the database boundary. The
-- caller selects whether a historical redirect is acceptable and whether the
-- target must currently be publicly visible.
create or replace function private.community_resolve_profile_handle(
  p_handle text,
  p_allow_retired boolean,
  p_require_public boolean
)
returns table (
  user_id uuid,
  current_handle text,
  requested_handle text,
  redirected boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requested_handle text := pg_catalog.lower(pg_catalog.btrim(case
    when pg_catalog.left(pg_catalog.btrim(coalesce(p_handle, '')), 1) = '@'
      then pg_catalog.substr(pg_catalog.btrim(coalesce(p_handle, '')), 2)
    else pg_catalog.btrim(coalesce(p_handle, ''))
  end));
begin
  if pg_catalog.char_length(v_requested_handle) not between 2 and 80
     or v_requested_handle !~ '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$' then
    return;
  end if;
  if p_allow_retired then
    return query
    select card.user_id, card.handle, v_requested_handle,
      history.handle <> card.handle
    from public.profile_handle_history as history
    join public.profile_public_cards as card
      on card.user_id = history.profile_user_id
    where history.handle = v_requested_handle
      and history.redirect_enabled
      and private.community_account_is_recoverable(card.user_id)
      and (not p_require_public or (
        card.public_profile_enabled
        and private.community_profile_is_public(card.user_id)
      ))
    limit 1;
  else
    return query
    select card.user_id, card.handle, v_requested_handle, false
    from public.profile_public_cards as card
    where card.handle = v_requested_handle
      and private.community_account_is_recoverable(card.user_id)
      and (not p_require_public or (
        card.public_profile_enabled
        and private.community_profile_is_public(card.user_id)
      ))
    limit 1;
  end if;
end;
$$;

alter function private.community_resolve_profile_handle(text, boolean, boolean) owner to postgres;
revoke all privileges on function private.community_resolve_profile_handle(text, boolean, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.issue_artisan_invitation_by_handle(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_invitation_code_sha256 text,
  p_target_handle text,
  p_maximum_uses integer,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_target_current_handle text;
  v_invitation jsonb;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'artisan_memberships_manage'
  );
  if p_client_request_id is null
     or coalesce(p_invitation_code_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_maximum_uses not between 1 and 100
     or p_expires_at is null or p_expires_at <= pg_catalog.now()
     or p_expires_at > pg_catalog.now() + interval '90 days'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_invitation_invalid';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_target_handle, '')), '') is not null then
    select resolved.user_id, resolved.current_handle
    into v_target_user_id, v_target_current_handle
    from private.community_resolve_profile_handle(p_target_handle, false, true) as resolved;
    if v_target_user_id is null or p_maximum_uses <> 1 then
      raise exception using errcode = '22023', message = 'artisan_invitation_target_unavailable';
    end if;
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_invitation_by_handle_issued',
    pg_catalog.jsonb_build_object(
      'invitationCodeSha256', p_invitation_code_sha256,
      'targetHandle', v_target_current_handle,
      'maximumUses', p_maximum_uses,
      'expiresAt', p_expires_at,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  v_invitation := public.issue_artisan_invitation(
    p_actor_user_id, p_actor_aal, p_client_request_id,
    p_invitation_code_sha256, v_target_user_id, null,
    p_maximum_uses, p_expires_at, p_private_reason
  );
  v_response := pg_catalog.jsonb_build_object(
    'invitationId', v_invitation -> 'invitationId',
    'status', v_invitation -> 'status',
    'targetHandle', v_target_current_handle,
    'maximumUses', p_maximum_uses,
    'useCount', 0,
    'expiresAt', v_invitation -> 'expiresAt'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.issue_artisan_invitation_by_handle(uuid, text, uuid, text, text, integer, timestamptz, text) owner to postgres;
revoke all privileges on function public.issue_artisan_invitation_by_handle(uuid, text, uuid, text, text, integer, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_artisan_invitation_by_handle(uuid, text, uuid, text, text, integer, timestamptz, text) to service_role;
-- The UUID/email-hash variant remains callable only from trusted definer code.
revoke execute on function public.issue_artisan_invitation(uuid, text, uuid, text, uuid, text, integer, timestamptz, text)
  from service_role;

create or replace function public.artisan_staff_list_invitations(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_status text default null,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'artisan_memberships_manage'
  );
  if p_status is not null and p_status not in ('issued','consumed','expired','revoked') then
    raise exception using errcode = '22023', message = 'artisan_invitation_list_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'invitationId', item.id,
    'status', item.effective_status,
    'targetHandle', item.target_handle,
    'maximumUses', item.maximum_uses,
    'useCount', item.use_count,
    'expiresAt', item.expires_at,
    'revokedAt', item.revoked_at,
    'createdAt', item.created_at
  ) order by item.created_at desc, item.id desc), '[]'::jsonb)
  into v_items
  from (
    select invitation.*,
      case when invitation.status = 'issued' and invitation.expires_at <= pg_catalog.now()
        then 'expired' else invitation.status end as effective_status,
      card.handle as target_handle
    from artisan.invitations as invitation
    left join public.profile_public_cards as card
      on card.user_id = invitation.invited_user_id
    where (p_before is null or invitation.created_at < p_before)
      and (p_status is null or p_status = case
        when invitation.status = 'issued' and invitation.expires_at <= pg_catalog.now()
          then 'expired' else invitation.status end)
    order by invitation.created_at desc, invitation.id desc
    limit v_limit
  ) as item;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'createdAt' else null end
  );
end;
$$;

alter function public.artisan_staff_list_invitations(uuid, text, text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_staff_list_invitations(uuid, text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_list_invitations(uuid, text, text, integer, timestamptz) to service_role;

create or replace function public.artisan_staff_revoke_invitation(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_invitation_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation artisan.invitations%rowtype;
  v_target_handle text;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'artisan_memberships_manage'
  );
  if p_client_request_id is null or p_invitation_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_invitation_revocation_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_invitation_revoked',
    pg_catalog.jsonb_build_object(
      'invitationId', p_invitation_id,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_invitation from artisan.invitations
  where id = p_invitation_id for update;
  if v_invitation.status in ('consumed','expired')
     or (v_invitation.status = 'issued' and v_invitation.expires_at <= pg_catalog.now()) then
    raise exception using errcode = '55000', message = 'artisan_invitation_not_revocable';
  end if;
  if v_invitation.status = 'issued' then
    update artisan.invitations
    set status = 'revoked', revoked_at = pg_catalog.now(),
        revoked_by = p_actor_user_id
    where id = p_invitation_id returning * into v_invitation;
    insert into private.community_audit_events(
      actor_user_id, actor_kind, capability, action, target_type,
      target_id, request_id, private_reason
    ) values (
      p_actor_user_id, 'staff', 'artisan_memberships_manage',
      'artisan_invitation_revoked', 'artisan_invitation', p_invitation_id,
      p_client_request_id, pg_catalog.btrim(p_private_reason)
    );
  end if;
  select card.handle into v_target_handle
  from public.profile_public_cards as card
  where card.user_id = v_invitation.invited_user_id;
  v_response := pg_catalog.jsonb_build_object(
    'invitationId', v_invitation.id,
    'status', 'revoked',
    'targetHandle', v_target_handle,
    'revokedAt', v_invitation.revoked_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_staff_revoke_invitation(uuid, text, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_staff_revoke_invitation(uuid, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_revoke_invitation(uuid, text, uuid, uuid, text) to service_role;

create or replace function public.impose_community_restriction(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_target_handle text,
  p_client_request_id uuid,
  p_scope text,
  p_restriction text,
  p_reason_code text,
  p_private_reason text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_target_handle text;
  v_response jsonb;
begin
  select resolved.user_id, resolved.current_handle
  into v_target_user_id, v_target_handle
  from private.community_resolve_profile_handle(p_target_handle, false, false) as resolved;
  if v_target_user_id is null or v_target_user_id = p_actor_user_id then
    raise exception using errcode = '22023', message = 'community_restriction_target_unavailable';
  end if;
  v_response := public.impose_community_restriction(
    p_actor_user_id, p_actor_aal, v_target_user_id, p_client_request_id,
    p_scope, p_restriction, p_reason_code, p_private_reason, p_expires_at
  );
  return v_response || pg_catalog.jsonb_build_object('targetHandle', v_target_handle);
end;
$$;

alter function public.impose_community_restriction(uuid, text, text, uuid, text, text, text, text, timestamptz) owner to postgres;
revoke all privileges on function public.impose_community_restriction(uuid, text, text, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.impose_community_restriction(uuid, text, text, uuid, text, text, text, text, timestamptz) to service_role;
revoke execute on function public.impose_community_restriction(uuid, text, uuid, uuid, text, text, text, text, timestamptz)
  from service_role;

create or replace function public.artisan_staff_triage_report(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_report_id uuid,
  p_decision text,
  p_case_type text,
  p_severity text,
  p_subject_handle text,
  p_private_summary text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_user_id uuid;
  v_subject_handle text;
  v_response jsonb;
begin
  if nullif(pg_catalog.btrim(coalesce(p_subject_handle, '')), '') is not null then
    select resolved.user_id, resolved.current_handle
    into v_subject_user_id, v_subject_handle
    from private.community_resolve_profile_handle(p_subject_handle, false, false) as resolved;
    if v_subject_user_id is null or v_subject_user_id = p_actor_user_id then
      raise exception using errcode = '22023', message = 'artisan_report_subject_unavailable';
    end if;
  end if;
  v_response := public.artisan_staff_triage_report(
    p_actor_user_id, p_actor_aal, p_client_request_id, p_report_id,
    p_decision, p_case_type, p_severity, v_subject_user_id,
    p_private_summary, p_private_reason
  );
  return v_response || pg_catalog.jsonb_build_object('subjectHandle', v_subject_handle);
end;
$$;

alter function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, text, text, text) to service_role;
revoke execute on function public.artisan_staff_triage_report(uuid, text, uuid, uuid, text, text, text, uuid, text, text)
  from service_role;

create or replace function public.artisan_staff_assign_case(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_case_id uuid,
  p_assigned_handle text,
  p_assignment_role text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned_user_id uuid;
  v_assigned_handle text;
  v_required_capability text;
  v_child_safety_sensitive boolean;
  v_response jsonb;
begin
  select resolved.user_id, resolved.current_handle
  into v_assigned_user_id, v_assigned_handle
  from private.community_resolve_profile_handle(p_assigned_handle, false, false) as resolved;
  select moderation_case.child_safety_sensitive into v_child_safety_sensitive
  from artisan.moderation_cases as moderation_case where moderation_case.id = p_case_id;
  v_required_capability := case p_assignment_role
    when 'triage' then 'artisan_reports_triage'
    when 'appeal_reviewer' then 'artisan_appeals_review'
    when 'child_safety' then 'artisan_child_safety_manage'
    when 'copyright' then 'artisan_copyright_manage'
    else 'artisan_cases_manage'
  end;
  if v_assigned_user_id is null
     or v_required_capability is null
     or not private.community_user_has_capability(v_assigned_user_id, v_required_capability)
     or (coalesce(v_child_safety_sensitive, false)
       and not private.community_user_has_capability(v_assigned_user_id, 'artisan_child_safety_manage')) then
    raise exception using errcode = '22023', message = 'artisan_case_assignee_unavailable';
  end if;
  v_response := public.artisan_staff_assign_case(
    p_actor_user_id, p_actor_aal, p_client_request_id, p_case_id,
    v_assigned_user_id, p_assignment_role, p_private_reason
  );
  return (v_response - 'assignedUserId') || pg_catalog.jsonb_build_object(
    'assignedHandle', v_assigned_handle
  );
end;
$$;

alter function public.artisan_staff_assign_case(uuid, text, uuid, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_assign_case(uuid, text, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_assign_case(uuid, text, uuid, uuid, text, text, text) to service_role;
revoke execute on function public.artisan_staff_assign_case(uuid, text, uuid, uuid, uuid, text, text)
  from service_role;

create or replace function public.artisan_staff_assign_judge(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_judge_handle text,
  p_role text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_judge_user_id uuid;
  v_judge_handle text;
  v_response jsonb;
begin
  select resolved.user_id, resolved.current_handle
  into v_judge_user_id, v_judge_handle
  from private.community_resolve_profile_handle(p_judge_handle, false, true) as resolved;
  if v_judge_user_id is null or v_judge_user_id = p_actor_user_id
     or not private.community_can_participate(v_judge_user_id, 'artisan_submit_challenge')
     or not exists (
       select 1 from artisan.memberships as membership
       where membership.user_id = v_judge_user_id and membership.status = 'active'
     ) then
    raise exception using errcode = '22023', message = 'artisan_judge_handle_unavailable';
  end if;
  v_response := public.artisan_staff_assign_judge(
    p_actor_user_id, p_actor_aal, p_client_request_id, p_challenge_id,
    v_judge_user_id, p_role, p_private_reason
  );
  return (v_response - 'judgeUserId') || pg_catalog.jsonb_build_object(
    'judgeHandle', v_judge_handle
  );
end;
$$;

alter function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, text, text, text) to service_role;
revoke execute on function public.artisan_staff_assign_judge(uuid, text, uuid, uuid, uuid, text, text)
  from service_role;

create or replace function public.artisan_staff_resolve_judge_conflict(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_challenge_id uuid,
  p_judge_handle text,
  p_cleared boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_judge_user_id uuid;
  v_judge_handle text;
  v_response jsonb;
begin
  select resolved.user_id, resolved.current_handle
  into v_judge_user_id, v_judge_handle
  from private.community_resolve_profile_handle(p_judge_handle, true, false) as resolved;
  if v_judge_user_id is null or v_judge_user_id = p_actor_user_id then
    raise exception using errcode = '22023', message = 'artisan_judge_handle_unavailable';
  end if;
  v_response := public.artisan_staff_resolve_judge_conflict(
    p_actor_user_id, p_actor_aal, p_client_request_id, p_challenge_id,
    v_judge_user_id, p_cleared, p_private_reason
  );
  return (v_response - 'judgeUserId') || pg_catalog.jsonb_build_object(
    'judgeHandle', v_judge_handle
  );
end;
$$;

alter function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, text, boolean, text) owner to postgres;
revoke all privileges on function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, text, boolean, text) to service_role;
revoke execute on function public.artisan_staff_resolve_judge_conflict(uuid, text, uuid, uuid, uuid, boolean, text)
  from service_role;

create or replace function public.artisan_current_user_blocks(
  p_actor_user_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'targetHandle', item.handle,
    'blocked', true,
    'createdAt', item.created_at
  ) order by item.created_at desc, item.handle), '[]'::jsonb)
  into v_items
  from (
    select card.handle, block.created_at
    from artisan.user_blocks as block
    join public.profile_public_cards as card
      on card.user_id = block.blocked_user_id
    where block.blocker_user_id = p_actor_user_id
      and (p_before is null or block.created_at < p_before)
    order by block.created_at desc, card.handle
    limit v_limit
  ) as item;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'createdAt' else null end
  );
end;
$$;

alter function public.artisan_current_user_blocks(uuid, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_current_user_blocks(uuid, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_blocks(uuid, integer, timestamptz) to service_role;

-- Profile cards expose canonical handles, never auth UUIDs. Preserve the
-- generic report pipeline for content IDs while giving profile reports an
-- equally audited, rate-limited, Turnstile-gated handle-only entry point.
create or replace function public.artisan_create_report_by_handle(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_reporter_fingerprint_sha256 text,
  p_target_handle text,
  p_reason_code text,
  p_summary text,
  p_details text,
  p_turnstile_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_target_handle text;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'artisan_service_role_required';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_target_user_id, v_target_handle
  from private.community_resolve_profile_handle(p_target_handle, false, true) as resolved;
  if v_target_user_id is null then
    raise exception using errcode = '22023', message = 'artisan_report_profile_unavailable';
  end if;
  v_response := public.artisan_create_report(
    p_actor_user_id, p_client_request_id, p_reporter_fingerprint_sha256,
    'profile', v_target_user_id, p_reason_code, p_summary, p_details,
    p_turnstile_verified
  );
  return v_response || pg_catalog.jsonb_build_object(
    'targetType', 'profile', 'targetHandle', v_target_handle
  );
end;
$$;

alter function public.artisan_create_report_by_handle(uuid, uuid, text, text, text, text, text, boolean) owner to postgres;
revoke all privileges on function public.artisan_create_report_by_handle(uuid, uuid, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_create_report_by_handle(uuid, uuid, text, text, text, text, text, boolean) to service_role;

create or replace function public.start_community_guardian_relationship_by_handle(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_provider text,
  p_dependent_handle text,
  p_relationship_type text,
  p_authority_expires_at timestamptz,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text,
  p_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dependent_user_id uuid;
  v_dependent_handle text;
  v_age_band text;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal not in ('aal1','aal2')
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'community_provider_actor_invalid';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_dependent_user_id, v_dependent_handle
  from private.community_resolve_profile_handle(p_dependent_handle, false, false) as resolved;
  select participation.age_band into v_age_band
  from private.account_participation as participation
  where participation.user_id = v_dependent_user_id
    and participation.participation_state not in (
      'restricted','suspended','blocked','deletion_pending','deactivated'
    );
  if v_dependent_user_id is null or v_dependent_user_id = p_actor_user_id
     or v_age_band not in ('under_13','13_to_15','16_to_17')
     or (v_age_band = 'under_13'
       and not private.community_feature_enabled('artisan_under13_participation'))
     or (v_age_band in ('13_to_15','16_to_17')
       and not private.community_feature_enabled('artisan_teen_participation'))
     or exists (
       select 1 from artisan.user_blocks as block
       where (block.blocker_user_id = p_actor_user_id and block.blocked_user_id = v_dependent_user_id)
          or (block.blocked_user_id = p_actor_user_id and block.blocker_user_id = v_dependent_user_id)
     ) then
    raise exception using errcode = '42501', message = 'community_guardian_dependent_unavailable';
  end if;
  v_response := public.start_community_provider_transaction(
    p_actor_user_id, p_actor_aal, p_client_request_id,
    p_provider, 'guardian_relationship', v_dependent_user_id,
    p_actor_user_id, null, p_relationship_type, null, null, null, null,
    p_authority_expires_at, p_external_reference_sha256,
    p_state_nonce_sha256, p_expires_at, p_private_reason
  );
  return v_response || pg_catalog.jsonb_build_object(
    'dependentHandle', v_dependent_handle
  );
end;
$$;

alter function public.start_community_guardian_relationship_by_handle(uuid, text, uuid, text, text, text, timestamptz, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.start_community_guardian_relationship_by_handle(uuid, text, uuid, text, text, text, timestamptz, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.start_community_guardian_relationship_by_handle(uuid, text, uuid, text, text, text, timestamptz, text, text, timestamptz, text) to service_role;

create or replace function public.start_guardian_sponsored_account(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_provider text,
  p_dependent_contact_hmac_sha256 text,
  p_claim_nonce_sha256 text,
  p_relationship_type text,
  p_authority_expires_at timestamptz,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text,
  p_request_expires_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsorship private.guardian_account_sponsorships%rowtype;
  v_guardian_document private.community_legal_document_versions%rowtype;
  v_child_document private.community_legal_document_versions%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id)
     or not private.community_feature_enabled('artisan_guardian_sponsored_accounts')
     or p_client_request_id is null
     or p_provider !~ '^[a-z][a-z0-9_-]{2,80}$'
     or p_relationship_type not in ('parent','legal_guardian','court_authorized_guardian')
     or coalesce(p_dependent_contact_hmac_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_claim_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_external_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_state_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_request_expires_at <= pg_catalog.now()
     or p_request_expires_at > pg_catalog.now() + interval '24 hours'
     or p_authority_expires_at <= p_request_expires_at
     or p_authority_expires_at > pg_catalog.now() + interval '2 years'
     or not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where active_document.document_key = 'guardian_consent_notice'
     )
     or not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where active_document.document_key = 'under13_privacy_notice'
     )
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_sponsored_account_request_invalid';
  end if;
  select document.* into strict v_guardian_document
  from private.community_active_legal_documents as active_document
  join private.community_legal_document_versions as document
    on document.document_key = active_document.document_key
   and document.document_version = active_document.document_version
   and document.status = 'approved'
  where active_document.document_key = 'guardian_consent_notice';
  select document.* into strict v_child_document
  from private.community_active_legal_documents as active_document
  join private.community_legal_document_versions as document
    on document.document_key = active_document.document_key
   and document.document_version = active_document.document_version
   and document.status = 'approved'
  where active_document.document_key = 'under13_privacy_notice';
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'guardian_sponsored_account_started',
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'dependentContactHmacSha256', p_dependent_contact_hmac_sha256,
      'claimNonceSha256', p_claim_nonce_sha256,
      'relationshipType', p_relationship_type,
      'guardianNoticeDocumentVersion', v_guardian_document.document_version,
      'guardianNoticeContentSha256', v_guardian_document.content_sha256,
      'childPrivacyDocumentVersion', v_child_document.document_version,
      'childPrivacyContentSha256', v_child_document.content_sha256,
      'authorityExpiresAt', p_authority_expires_at,
      'externalReferenceSha256', p_external_reference_sha256,
      'stateNonceSha256', p_state_nonce_sha256,
      'requestExpiresAt', p_request_expires_at,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into private.guardian_account_sponsorships(
    client_request_id, guardian_user_id, dependent_contact_hmac_sha256,
    claim_nonce_sha256, relationship_type, provider,
    guardian_notice_document_key, guardian_notice_document_version,
    guardian_notice_content_sha256, child_privacy_document_key,
    child_privacy_document_version, child_privacy_content_sha256,
    external_reference_sha256, state_nonce_sha256,
    authority_expires_at, request_expires_at
  ) values (
    p_client_request_id, p_actor_user_id, p_dependent_contact_hmac_sha256,
    p_claim_nonce_sha256, p_relationship_type, p_provider,
    v_guardian_document.document_key, v_guardian_document.document_version,
    v_guardian_document.content_sha256, v_child_document.document_key,
    v_child_document.document_version, v_child_document.content_sha256,
    p_external_reference_sha256, p_state_nonce_sha256,
    p_authority_expires_at, p_request_expires_at
  ) returning * into v_sponsorship;
  insert into private.guardian_account_sponsorship_events(
    client_request_id, sponsorship_id, actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_sponsorship.id, p_actor_user_id,
    'started', pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'guardian', 'guardian_sponsored_account_started',
    'guardian_account_sponsorship', v_sponsorship.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('provider', p_provider, 'relationshipType', p_relationship_type)
  );
  v_response := pg_catalog.jsonb_build_object(
    'sponsorshipId', v_sponsorship.id,
    'provider', v_sponsorship.provider,
    'status', v_sponsorship.status,
    'legalDocuments', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'documentKey', v_sponsorship.guardian_notice_document_key,
        'documentVersion', v_sponsorship.guardian_notice_document_version,
        'contentSha256', v_sponsorship.guardian_notice_content_sha256
      ),
      pg_catalog.jsonb_build_object(
        'documentKey', v_sponsorship.child_privacy_document_key,
        'documentVersion', v_sponsorship.child_privacy_document_version,
        'contentSha256', v_sponsorship.child_privacy_content_sha256
      )
    ),
    'requestExpiresAt', v_sponsorship.request_expires_at,
    'authorityExpiresAt', v_sponsorship.authority_expires_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.start_guardian_sponsored_account(uuid, text, uuid, text, text, text, text, timestamptz, text, text, timestamptz, text) owner to postgres;
revoke all privileges on function public.start_guardian_sponsored_account(uuid, text, uuid, text, text, text, text, timestamptz, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.start_guardian_sponsored_account(uuid, text, uuid, text, text, text, text, timestamptz, text, text, timestamptz, text) to service_role;

create or replace function public.consume_guardian_sponsored_account_provider_result(
  p_client_request_id uuid,
  p_provider text,
  p_external_reference_sha256 text,
  p_state_nonce_sha256 text,
  p_result_sha256 text,
  p_result_status text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsorship private.guardian_account_sponsorships%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_feature_enabled('artisan_guardian_sponsored_accounts')
     or p_result_status not in ('verified','failed')
     or coalesce(p_external_reference_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_state_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_result_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_sponsored_account_callback_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, null, 'guardian_sponsored_account_provider_result',
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'externalReferenceSha256', p_external_reference_sha256,
      'stateNonceSha256', p_state_nonce_sha256,
      'resultSha256', p_result_sha256,
      'resultStatus', p_result_status,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_sponsorship
  from private.guardian_account_sponsorships
  where provider = p_provider
    and external_reference_sha256 = p_external_reference_sha256
    and state_nonce_sha256 = p_state_nonce_sha256
    and status = 'pending_provider'
  for update;
  if v_sponsorship.request_expires_at <= pg_catalog.now() then
    raise exception using errcode = '55000', message = 'guardian_sponsored_account_request_expired';
  end if;
  if not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where document.document_key = v_sponsorship.guardian_notice_document_key
         and document.document_version = v_sponsorship.guardian_notice_document_version
         and document.content_sha256 = v_sponsorship.guardian_notice_content_sha256
     ) or not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where document.document_key = v_sponsorship.child_privacy_document_key
         and document.document_version = v_sponsorship.child_privacy_document_version
         and document.content_sha256 = v_sponsorship.child_privacy_content_sha256
     ) then
    raise exception using errcode = '55000',
      message = 'guardian_sponsored_account_legal_intent_stale';
  end if;
  update private.guardian_account_sponsorships
  set status = p_result_status,
      provider_result_sha256 = p_result_sha256,
      verified_at = case when p_result_status = 'verified' then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = v_sponsorship.id
  returning * into v_sponsorship;
  insert into private.guardian_account_sponsorship_events(
    client_request_id, sponsorship_id, action, result_sha256, private_reason
  ) values (
    p_client_request_id, v_sponsorship.id, p_result_status,
    p_result_sha256, pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_kind, action, target_type, target_id, request_id,
    private_reason, metadata
  ) values (
    'provider', 'guardian_sponsored_account_' || p_result_status,
    'guardian_account_sponsorship', v_sponsorship.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('provider', p_provider, 'resultSha256', p_result_sha256)
  );
  v_response := pg_catalog.jsonb_build_object(
    'sponsorshipId', v_sponsorship.id,
    'status', v_sponsorship.status,
    'authorityExpiresAt', v_sponsorship.authority_expires_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.consume_guardian_sponsored_account_provider_result(uuid, text, text, text, text, text, text) owner to postgres;
revoke all privileges on function public.consume_guardian_sponsored_account_provider_result(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_guardian_sponsored_account_provider_result(uuid, text, text, text, text, text, text) to service_role;

create or replace function public.claim_guardian_sponsored_account(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_sponsorship_id uuid,
  p_claim_nonce_sha256 text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsorship private.guardian_account_sponsorships%rowtype;
  v_relationship private.guardian_relationships%rowtype;
  v_replay jsonb;
  v_response jsonb;
  v_participation_state text;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id)
     or not private.community_feature_enabled('artisan_guardian_sponsored_accounts')
     or coalesce(p_claim_nonce_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'guardian_sponsored_account_claim_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'guardian_sponsored_account_claimed',
    pg_catalog.jsonb_build_object(
      'sponsorshipId', p_sponsorship_id,
      'claimNonceSha256', p_claim_nonce_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  select sponsorship.* into strict v_sponsorship
  from private.guardian_account_sponsorships as sponsorship
  join private.account_participation as participation
    on participation.user_id = p_actor_user_id
   and participation.age_band = 'under_13'
   and participation.participation_state not in (
     'restricted','suspended','blocked','deletion_pending','deactivated'
   )
  where sponsorship.id = p_sponsorship_id
    and sponsorship.claim_nonce_sha256 = p_claim_nonce_sha256
    and sponsorship.status = 'verified'
    and sponsorship.guardian_user_id <> p_actor_user_id
    and sponsorship.authority_expires_at > pg_catalog.now()
  for update of sponsorship;
  if not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where document.document_key = v_sponsorship.guardian_notice_document_key
         and document.document_version = v_sponsorship.guardian_notice_document_version
         and document.content_sha256 = v_sponsorship.guardian_notice_content_sha256
     ) or not exists (
       select 1 from private.community_active_legal_documents as active_document
       join private.community_legal_document_versions as document
         on document.document_key = active_document.document_key
        and document.document_version = active_document.document_version
        and document.status = 'approved'
       where document.document_key = v_sponsorship.child_privacy_document_key
         and document.document_version = v_sponsorship.child_privacy_document_version
         and document.content_sha256 = v_sponsorship.child_privacy_content_sha256
     ) then
    raise exception using errcode = '55000',
      message = 'guardian_sponsored_account_legal_intent_stale';
  end if;
  insert into private.guardian_relationships(
    client_request_id, guardian_user_id, dependent_user_id,
    relationship_type, status, verification_provider,
    provider_reference_sha256, verified_at, expires_at
  ) values (
    p_client_request_id, v_sponsorship.guardian_user_id, p_actor_user_id,
    v_sponsorship.relationship_type, 'active', v_sponsorship.provider,
    v_sponsorship.provider_result_sha256, pg_catalog.now(),
    v_sponsorship.authority_expires_at
  ) returning * into v_relationship;
  update private.guardian_account_sponsorships
  set status = 'claimed', claimed_by = p_actor_user_id,
      claimed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_sponsorship.id;
  insert into private.guardian_account_sponsorship_events(
    client_request_id, sponsorship_id, actor_user_id,
    action, result_sha256, private_reason
  ) values (
    p_client_request_id, v_sponsorship.id, p_actor_user_id,
    'claimed', v_sponsorship.provider_result_sha256,
    pg_catalog.btrim(p_private_reason)
  );
  insert into private.age_assurance_events(
    client_request_id, user_id, actor_user_id, provider,
    provider_reference_sha256, age_band, assurance_status,
    expires_at, private_reason
  ) values (
    gen_random_uuid(), p_actor_user_id, null, v_sponsorship.provider,
    v_sponsorship.provider_result_sha256, 'under_13', 'guardian_verified',
    v_sponsorship.authority_expires_at, pg_catalog.btrim(p_private_reason)
  );
  update private.account_participation
  set assurance_status = 'guardian_verified', assurance_method = 'guardian_provider',
      assurance_provider = v_sponsorship.provider,
      assurance_expires_at = v_sponsorship.authority_expires_at,
      updated_at = pg_catalog.now()
  where user_id = p_actor_user_id and age_band = 'under_13';
  v_participation_state := private.recompute_community_participation(p_actor_user_id);
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'user', 'guardian_sponsored_account_claimed',
    'guardian_account_sponsorship', v_sponsorship.id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'relationshipId', v_relationship.id,
      'participationState', v_participation_state
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'sponsorshipId', v_sponsorship.id,
    'relationshipId', v_relationship.id,
    'status', 'claimed',
    'participationState', v_participation_state
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.claim_guardian_sponsored_account(uuid, text, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.claim_guardian_sponsored_account(uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_guardian_sponsored_account(uuid, text, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_request_guardian_content_approval(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relationship private.guardian_relationships%rowtype;
  v_approval artisan.guardian_content_approvals%rowtype;
  v_active artisan.guardian_content_approvals%rowtype;
  v_scope text := private.artisan_guardian_scope_for_target(p_target_type);
  v_target_revision_sha256 text;
  v_target_preview jsonb;
  v_expiry_event_id uuid;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_feature_enabled('artisan_under13_content_approval')
     or p_client_request_id is null or p_target_id is null or v_scope is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_guardian_content_request_invalid';
  end if;
  if private.artisan_target_owner(p_target_type, p_target_id) is distinct from p_actor_user_id
     or not private.community_has_guardian_consent(p_actor_user_id, v_scope)
     or not exists (
       select 1 from private.account_participation as participation
       where participation.user_id = p_actor_user_id
         and participation.age_band = 'under_13'
         and participation.participation_state = 'under13_eligible'
         and participation.assurance_status = 'guardian_verified'
     ) then
    raise exception using errcode = '42501', message = 'artisan_guardian_content_request_not_permitted';
  end if;
  v_target_revision_sha256 := private.artisan_guardian_target_revision_sha256(
    p_target_type, p_target_id
  );
  v_target_preview := private.artisan_guardian_target_preview(p_target_type, p_target_id);
  if v_target_revision_sha256 is null or v_target_preview is null then
    raise exception using errcode = '22023', message = 'artisan_guardian_content_target_invalid';
  end if;
  select relationship.* into v_relationship
  from private.guardian_relationships as relationship
  join private.guardian_consents as consent
    on consent.relationship_id = relationship.id
   and consent.dependent_user_id = relationship.dependent_user_id
   and consent.consent_scope = v_scope
   and consent.status = 'active'
   and consent.expires_at > pg_catalog.now()
  where relationship.dependent_user_id = p_actor_user_id
    and relationship.status = 'active'
    and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
  order by relationship.verified_at desc nulls last, relationship.created_at desc
  limit 1;
  if v_relationship.id is null then
    raise exception using errcode = '42501', message = 'artisan_guardian_content_authority_unavailable';
  end if;

  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_guardian_content_approval_requested',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id,
      'scope', v_scope, 'targetRevisionSha256', v_target_revision_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_active
  from artisan.guardian_content_approvals
  where dependent_user_id = p_actor_user_id
    and target_type = p_target_type and target_id = p_target_id
    and status in ('pending','approved')
  for update;
  if v_active.id is not null and v_active.target_revision_sha256 = v_target_revision_sha256 then
    v_response := pg_catalog.jsonb_build_object(
      'approvalRequestId', v_active.id,
      'targetType', v_active.target_type, 'targetId', v_active.target_id,
      'targetRevisionSha256', v_active.target_revision_sha256,
      'targetPreview', v_target_preview,
      'status', v_active.status, 'requestedAt', v_active.requested_at,
      'decidedAt', v_active.decided_at,
      'approvalExpiresAt', v_active.approval_expires_at
    );
    return private.community_idempotency_finish(p_client_request_id, v_response);
  elsif v_active.id is not null then
    v_expiry_event_id := gen_random_uuid();
    update artisan.guardian_content_approvals
    set status = 'expired', decided_at = coalesce(decided_at, pg_catalog.now()),
        approval_expires_at = null,
        decision_reason = 'Content changed after the prior guardian review request.',
        updated_at = pg_catalog.now()
    where id = v_active.id;
    insert into artisan.guardian_content_approval_events(
      client_request_id, approval_id, actor_user_id, action, private_reason
    ) values (
      v_expiry_event_id, v_active.id, p_actor_user_id, 'expired',
      'Content changed after the prior guardian review request.'
    );
    insert into private.community_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id,
      request_id, private_reason, metadata
    ) values (
      p_actor_user_id, 'system', 'artisan_guardian_content_approval_expired',
      'artisan_' || p_target_type, p_target_id, v_expiry_event_id,
      'Content changed after the prior guardian review request.',
      pg_catalog.jsonb_build_object(
        'approvalId', v_active.id,
        'previousRevisionSha256', v_active.target_revision_sha256,
        'currentRevisionSha256', v_target_revision_sha256
      )
    );
  end if;

  insert into artisan.guardian_content_approvals(
    client_request_id, relationship_id, dependent_user_id,
    target_type, target_id, target_revision_sha256,
    consent_scope, requested_by
  ) values (
    p_client_request_id, v_relationship.id, p_actor_user_id,
    p_target_type, p_target_id, v_target_revision_sha256,
    v_scope, p_actor_user_id
  ) returning * into v_approval;
  insert into artisan.guardian_content_approval_events(
    client_request_id, approval_id, actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_approval.id, p_actor_user_id,
    'requested', pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_guardian_content_approval_requested',
    'artisan_' || p_target_type, p_target_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'approvalId', v_approval.id, 'scope', v_scope,
      'targetRevisionSha256', v_target_revision_sha256
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'approvalRequestId', v_approval.id,
    'targetType', v_approval.target_type,
    'targetId', v_approval.target_id,
    'targetRevisionSha256', v_approval.target_revision_sha256,
    'targetPreview', v_target_preview,
    'status', v_approval.status,
    'requestedAt', v_approval.requested_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_request_guardian_content_approval(uuid, uuid, text, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_request_guardian_content_approval(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_request_guardian_content_approval(uuid, uuid, text, uuid, text) to service_role;

create or replace function public.artisan_guardian_content_approval_queue(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_guardian_content_queue_not_permitted';
  end if;
  select coalesce(pg_catalog.jsonb_agg(item), '[]'::jsonb) into v_items
  from (
    select pg_catalog.jsonb_build_object(
      'approvalRequestId', approval.id,
      'dependentHandle', card.handle,
      'targetType', approval.target_type,
      'targetId', approval.target_id,
      'targetRevisionSha256', approval.target_revision_sha256,
      'currentRevisionSha256', private.artisan_guardian_target_revision_sha256(
        approval.target_type, approval.target_id
      ),
      'revisionCurrent', approval.target_revision_sha256 =
        private.artisan_guardian_target_revision_sha256(
          approval.target_type, approval.target_id
        ),
      'targetPreview', private.artisan_guardian_target_preview(
        approval.target_type, approval.target_id
      ),
      'consentScope', approval.consent_scope,
      'status', approval.status,
      'requestedAt', approval.requested_at,
      'decidedAt', approval.decided_at,
      'approvalExpiresAt', approval.approval_expires_at
    ) as item
    from artisan.guardian_content_approvals as approval
    join private.guardian_relationships as relationship
      on relationship.id = approval.relationship_id
    join public.profile_public_cards as card
      on card.user_id = approval.dependent_user_id
    where relationship.guardian_user_id = p_actor_user_id
      and relationship.status = 'active'
      and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
      and (p_before is null or approval.requested_at < p_before)
    order by
      approval.requested_at desc,
      (
        approval.status = 'pending'
        and approval.target_revision_sha256 =
          private.artisan_guardian_target_revision_sha256(
            approval.target_type, approval.target_id
          )
      ) desc,
      approval.id desc
    limit v_limit
  ) as queued;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'requestedAt' else null end
  );
end;
$$;

alter function public.artisan_guardian_content_approval_queue(uuid, text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_guardian_content_approval_queue(uuid, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_guardian_content_approval_queue(uuid, text, integer, timestamptz) to service_role;

create or replace function public.artisan_decide_guardian_content_approval(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_approval_request_id uuid,
  p_expected_revision_sha256 text,
  p_decision text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approval artisan.guardian_content_approvals%rowtype;
  v_relationship private.guardian_relationships%rowtype;
  v_consent private.guardian_consents%rowtype;
  v_replay jsonb;
  v_response jsonb;
  v_expires_at timestamptz;
  v_current_revision_sha256 text;
  v_target_preview jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id)
     or not private.community_feature_enabled('artisan_under13_content_approval')
     or p_decision not in ('approve','reject')
     or coalesce(p_expected_revision_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'artisan_guardian_content_decision_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_guardian_content_approval_decided',
    pg_catalog.jsonb_build_object(
      'approvalRequestId', p_approval_request_id, 'decision', p_decision,
      'expectedRevisionSha256', p_expected_revision_sha256,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;

  select * into strict v_approval
  from artisan.guardian_content_approvals
  where id = p_approval_request_id and status = 'pending'
  for update;
  v_current_revision_sha256 := private.artisan_guardian_target_revision_sha256(
    v_approval.target_type, v_approval.target_id
  );
  v_target_preview := private.artisan_guardian_target_preview(
    v_approval.target_type, v_approval.target_id
  );
  if p_expected_revision_sha256 <> v_approval.target_revision_sha256
     or v_current_revision_sha256 is distinct from p_expected_revision_sha256
     or v_target_preview is null then
    raise exception using errcode = '55000', message = 'artisan_guardian_content_revision_stale';
  end if;
  select * into strict v_relationship
  from private.guardian_relationships
  where id = v_approval.relationship_id
    and guardian_user_id = p_actor_user_id
    and dependent_user_id = v_approval.dependent_user_id
    and status = 'active'
    and (expires_at is null or expires_at > pg_catalog.now())
  for share;
  select * into strict v_consent
  from private.guardian_consents
  where relationship_id = v_relationship.id
    and dependent_user_id = v_approval.dependent_user_id
    and consent_scope = v_approval.consent_scope
    and status = 'active' and expires_at > pg_catalog.now()
  for share;
  if not private.community_has_guardian_consent(
       v_approval.dependent_user_id, v_approval.consent_scope
     ) then
    raise exception using errcode = '55000',
      message = 'artisan_guardian_content_consent_stale';
  end if;
  if private.artisan_target_owner(v_approval.target_type, v_approval.target_id)
       is distinct from v_approval.dependent_user_id then
    raise exception using errcode = '55000', message = 'artisan_guardian_content_target_stale';
  end if;
  v_expires_at := least(
    v_consent.expires_at,
    coalesce(v_relationship.expires_at, v_consent.expires_at)
  );
  update artisan.guardian_content_approvals
  set status = case p_decision when 'approve' then 'approved' else 'rejected' end,
      decided_by = p_actor_user_id,
      decided_at = pg_catalog.now(),
      decision_revision_sha256 = v_current_revision_sha256,
      approval_expires_at = case p_decision when 'approve' then v_expires_at else null end,
      decision_reason = pg_catalog.btrim(p_private_reason),
      updated_at = pg_catalog.now()
  where id = v_approval.id
  returning * into v_approval;
  insert into artisan.guardian_content_approval_events(
    client_request_id, approval_id, actor_user_id, action, private_reason
  ) values (
    p_client_request_id, v_approval.id, p_actor_user_id,
    case p_decision when 'approve' then 'approved' else 'rejected' end,
    pg_catalog.btrim(p_private_reason)
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'guardian', 'artisan_guardian_content_approval_' || p_decision || 'd',
    'artisan_' || v_approval.target_type, v_approval.target_id,
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'approvalId', v_approval.id, 'scope', v_approval.consent_scope,
      'targetRevisionSha256', v_current_revision_sha256
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'approvalRequestId', v_approval.id,
    'targetType', v_approval.target_type,
    'targetId', v_approval.target_id,
    'targetRevisionSha256', v_approval.target_revision_sha256,
    'targetPreview', v_target_preview,
    'status', v_approval.status,
    'decidedAt', v_approval.decided_at,
    'approvalExpiresAt', v_approval.approval_expires_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_decide_guardian_content_approval(uuid, text, uuid, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_decide_guardian_content_approval(uuid, text, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_decide_guardian_content_approval(uuid, text, uuid, uuid, text, text, text) to service_role;

create or replace function public.artisan_guardian_dependent_status(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_dependent_handle text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dependent_user_id uuid;
  v_dependent_handle text;
  v_relationship private.guardian_relationships%rowtype;
  v_access private.account_participation%rowtype;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_guardian_status_not_permitted';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_dependent_user_id, v_dependent_handle
  from private.community_resolve_profile_handle(p_dependent_handle, false, false) as resolved;
  select * into v_relationship
  from private.guardian_relationships
  where guardian_user_id = p_actor_user_id
    and dependent_user_id = v_dependent_user_id
    and status = 'active'
    and (expires_at is null or expires_at > pg_catalog.now())
  order by verified_at desc nulls last, created_at desc
  limit 1;
  if v_relationship.id is null then
    raise exception using errcode = '42501', message = 'artisan_guardian_status_not_permitted';
  end if;
  select * into strict v_access from private.account_participation
  where user_id = v_dependent_user_id;
  return pg_catalog.jsonb_build_object(
    'dependentHandle', v_dependent_handle,
    'ageBand', v_access.age_band,
    'participationState', v_access.participation_state,
    'relationshipStatus', v_relationship.status,
    'publicProfilePublished', private.community_profile_is_public(v_dependent_user_id),
    'canPublishPublicProfile', private.community_can_publish_profile(v_dependent_user_id),
    'canJoin', private.community_can_participate(v_dependent_user_id, 'artisan_membership'),
    'canPost', private.community_can_participate(v_dependent_user_id, 'artisan_post'),
    'canComment', private.community_can_participate(v_dependent_user_id, 'artisan_comment'),
    'canAppreciate', private.community_can_participate(v_dependent_user_id, 'artisan_appreciate'),
    'canUploadImage', private.community_can_participate(v_dependent_user_id, 'artisan_upload_image'),
    'canSubmitChallenge', private.community_can_participate(v_dependent_user_id, 'artisan_submit_challenge'),
    'guardianControls', pg_catalog.jsonb_build_object(
      'under13ParticipationEnabled',
        private.community_feature_enabled('artisan_under13_participation'),
      'contentApprovalEnabled',
        private.community_feature_enabled('artisan_under13_content_approval'),
      'profileEnableEnabled',
        private.community_feature_enabled('artisan_guardian_dependent_profile_controls'),
      'profileDisableAvailable', true,
      'lifecycleRequestAvailable',
        private.community_feature_enabled('artisan_guardian_dependent_lifecycle'),
      'lifecycleHistoryAvailable', true
    ),
    'activeConsentScopes', coalesce((
      select pg_catalog.jsonb_agg(consent.consent_scope order by consent.consent_scope)
      from private.guardian_consents as consent
      where consent.relationship_id = v_relationship.id
        and consent.status = 'active' and consent.expires_at > pg_catalog.now()
    ), '[]'::jsonb),
    'pendingContentApprovalCount', (
      select pg_catalog.count(*) from artisan.guardian_content_approvals as approval
      where approval.relationship_id = v_relationship.id and approval.status = 'pending'
    ),
    'openLifecycleRequestCount', (
      select pg_catalog.count(*) from private.account_lifecycle_requests as request
      where request.user_id = v_dependent_user_id
        and request.status in (
          'submitted','identity_verification','cooling_period','operator_review',
          'processing','storage_inventory','storage_cleanup','auth_deletion_ready',
          'auth_deletion_confirmed','blocked_by_legal_hold'
        )
    )
  );
end;
$$;

alter function public.artisan_guardian_dependent_status(uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_guardian_dependent_status(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_guardian_dependent_status(uuid, text, text) to service_role;

create or replace function public.artisan_guardian_set_dependent_profile(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_dependent_handle text,
  p_enabled boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dependent_user_id uuid;
  v_dependent_handle text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id)
     or p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '42501', message = 'artisan_guardian_profile_control_not_permitted';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_dependent_user_id, v_dependent_handle
  from private.community_resolve_profile_handle(p_dependent_handle, false, false) as resolved;
  if not exists (
    select 1
    from private.guardian_relationships as relationship
    join private.guardian_consents as consent
      on consent.relationship_id = relationship.id
     and consent.dependent_user_id = relationship.dependent_user_id
     and consent.consent_scope = 'public_profile'
     and consent.status = 'active' and consent.expires_at > pg_catalog.now()
    where relationship.guardian_user_id = p_actor_user_id
      and relationship.dependent_user_id = v_dependent_user_id
      and relationship.status = 'active'
      and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
  ) or (p_enabled and (
    not private.community_feature_enabled('artisan_guardian_dependent_profile_controls')
    or not private.community_can_publish_profile(v_dependent_user_id)
  )) then
    raise exception using errcode = '42501', message = 'artisan_guardian_profile_control_not_permitted';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_guardian_dependent_profile_set',
    pg_catalog.jsonb_build_object(
      'dependentHandle', v_dependent_handle, 'enabled', p_enabled,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  update public.profile_public_cards
  set public_profile_enabled = p_enabled, updated_at = pg_catalog.now()
  where user_id = v_dependent_user_id;
  if not found then
    raise exception using errcode = '55000', message = 'artisan_dependent_profile_unavailable';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'guardian', 'artisan_guardian_dependent_profile_set',
    'commons_profile', v_dependent_user_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('enabled', p_enabled, 'dependentHandle', v_dependent_handle)
  );
  v_response := pg_catalog.jsonb_build_object(
    'dependentHandle', v_dependent_handle,
    'publicProfileEnabled', p_enabled,
    'publicProfilePublished', p_enabled and private.community_profile_is_public(v_dependent_user_id)
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_guardian_set_dependent_profile(uuid, text, uuid, text, boolean, text) owner to postgres;
revoke all privileges on function public.artisan_guardian_set_dependent_profile(uuid, text, uuid, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_guardian_set_dependent_profile(uuid, text, uuid, text, boolean, text) to service_role;

create or replace function public.artisan_guardian_request_dependent_lifecycle(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_dependent_handle text,
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
  v_dependent_user_id uuid;
  v_dependent_handle text;
  v_action text := case p_action when 'export' then 'data_export'
    when 'deletion' then 'account_deletion' else null end;
  v_scope text := case p_action when 'export' then 'account_export'
    when 'deletion' then 'account_deletion' else null end;
  v_request private.account_lifecycle_requests%rowtype;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id)
     or not private.community_feature_enabled('artisan_guardian_dependent_lifecycle')
     or v_action is null or p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_notice_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_user_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'artisan_guardian_lifecycle_request_invalid';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_dependent_user_id, v_dependent_handle
  from private.community_resolve_profile_handle(p_dependent_handle, false, false) as resolved;
  if not exists (
    select 1
    from private.guardian_relationships as relationship
    join private.guardian_consents as consent
      on consent.relationship_id = relationship.id
     and consent.dependent_user_id = relationship.dependent_user_id
     and consent.consent_scope = v_scope
     and consent.status = 'active' and consent.expires_at > pg_catalog.now()
    where relationship.guardian_user_id = p_actor_user_id
      and relationship.dependent_user_id = v_dependent_user_id
      and relationship.status = 'active'
      and (relationship.expires_at is null or relationship.expires_at > pg_catalog.now())
  ) then
    raise exception using errcode = '42501', message = 'artisan_guardian_lifecycle_request_not_permitted';
  end if;
  insert into private.account_lifecycle_requests(
    client_request_id, user_id, action, notice_version, user_note,
    cooling_period_ends_at
  ) values (
    p_client_request_id, v_dependent_user_id, v_action, p_notice_version,
    nullif(pg_catalog.btrim(p_user_note), ''),
    case when v_action = 'account_deletion' then pg_catalog.now() + interval '14 days' else null end
  )
  on conflict (client_request_id) do nothing
  returning * into v_request;
  if not found then
    select * into strict v_request from private.account_lifecycle_requests
    where client_request_id = p_client_request_id and user_id = v_dependent_user_id;
    if v_request.action <> v_action or v_request.notice_version <> p_notice_version
       or v_request.user_note is distinct from nullif(pg_catalog.btrim(p_user_note), '') then
      raise exception using errcode = '23505', message = 'community_lifecycle_idempotency_conflict';
    end if;
  else
    insert into private.account_lifecycle_events(
      client_request_id, request_id, actor_user_id, action,
      to_status, private_reason, metadata
    ) values (
      p_client_request_id, v_request.id, p_actor_user_id,
      'guardian_request_submitted', 'submitted',
      'Verified guardian submitted a dependent account lifecycle request.',
      pg_catalog.jsonb_build_object('dependentHandle', v_dependent_handle, 'scope', v_scope)
    );
    insert into private.community_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id,
      request_id, private_reason, metadata
    ) values (
      p_actor_user_id, 'guardian', 'artisan_guardian_dependent_lifecycle_requested',
      'account_lifecycle_request', v_request.id, p_client_request_id,
      'Verified guardian submitted a dependent account lifecycle request.',
      pg_catalog.jsonb_build_object('dependentHandle', v_dependent_handle, 'action', v_action)
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'requestId', v_request.id,
    'dependentHandle', v_dependent_handle,
    'action', v_request.action,
    'status', v_request.status,
    'submittedAt', v_request.submitted_at,
    'coolingPeriodEndsAt', v_request.cooling_period_ends_at
  );
end;
$$;

alter function public.artisan_guardian_request_dependent_lifecycle(uuid, text, uuid, text, text, text, text) owner to postgres;
revoke all privileges on function public.artisan_guardian_request_dependent_lifecycle(uuid, text, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_guardian_request_dependent_lifecycle(uuid, text, uuid, text, text, text, text) to service_role;

create or replace function public.artisan_guardian_dependent_lifecycle_status(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_dependent_handle text,
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dependent_user_id uuid;
  v_dependent_handle text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_aal <> 'aal2'
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_guardian_lifecycle_status_not_permitted';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_dependent_user_id, v_dependent_handle
  from private.community_resolve_profile_handle(p_dependent_handle, false, false) as resolved;
  if not exists (
    select 1 from private.guardian_relationships
    where guardian_user_id = p_actor_user_id
      and dependent_user_id = v_dependent_user_id
      and status = 'active'
      and (expires_at is null or expires_at > pg_catalog.now())
  ) then
    raise exception using errcode = '42501', message = 'artisan_guardian_lifecycle_status_not_permitted';
  end if;
  select coalesce(pg_catalog.jsonb_agg(item), '[]'::jsonb) into v_items
  from (
    select pg_catalog.jsonb_build_object(
      'requestId', request.id,
      'action', request.action,
      'status', request.status,
      'submittedAt', request.submitted_at,
      'updatedAt', request.updated_at,
      'coolingPeriodEndsAt', request.cooling_period_ends_at,
      'completedAt', request.completed_at
    ) as item
    from private.account_lifecycle_requests as request
    where request.user_id = v_dependent_user_id
    order by request.submitted_at desc, request.id
    limit v_limit
  ) as lifecycle;
  return pg_catalog.jsonb_build_object(
    'dependentHandle', v_dependent_handle,
    'items', v_items
  );
end;
$$;

alter function public.artisan_guardian_dependent_lifecycle_status(uuid, text, text, integer) owner to postgres;
revoke all privileges on function public.artisan_guardian_dependent_lifecycle_status(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_guardian_dependent_lifecycle_status(uuid, text, text, integer) to service_role;

create or replace function public.artisan_invite_collaborator_by_handle(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_artwork_id uuid,
  p_collaborator_handle text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artwork artisan.artworks%rowtype;
  v_collaborator_user_id uuid;
  v_collaborator_handle text;
  v_credited_name text;
  v_profile_url text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id)
     or p_role not in ('artist','illustrator','photographer','model','editor','prompt_designer','composer','animator','curator','writer','other') then
    raise exception using errcode = '42501', message = 'artisan_collaborator_invitation_not_permitted';
  end if;
  select * into strict v_artwork from artisan.artworks
  where id = p_artwork_id and owner_user_id = p_actor_user_id
    and status not in ('archived','removed') for update;
  if not private.community_can_participate(p_actor_user_id, 'artisan_post') then
    raise exception using errcode = '42501', message = 'artisan_collaborator_invitation_not_permitted';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_collaborator_user_id, v_collaborator_handle
  from private.community_resolve_profile_handle(p_collaborator_handle, false, true) as resolved;
  select coalesce(nullif(card.display_name, ''), '@' || card.handle),
    card.canonical_profile_url
  into v_credited_name, v_profile_url
  from private.community_safe_public_profile_cards as card
  where card.user_id = v_collaborator_user_id;
  if v_collaborator_user_id is null or v_collaborator_user_id = p_actor_user_id
     or not private.community_can_participate(v_collaborator_user_id, 'artisan_membership')
     or not exists (
       select 1 from artisan.memberships as membership
       where membership.user_id = v_collaborator_user_id and membership.status = 'active'
     )
     or exists (
       select 1 from artisan.user_blocks as block
       where (block.blocker_user_id = p_actor_user_id and block.blocked_user_id = v_collaborator_user_id)
          or (block.blocked_user_id = p_actor_user_id and block.blocker_user_id = v_collaborator_user_id)
     ) then
    raise exception using errcode = '42501', message = 'artisan_collaborator_handle_unavailable';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_collaborator_invited',
    pg_catalog.jsonb_build_object(
      'artworkId', p_artwork_id, 'collaboratorHandle', v_collaborator_handle,
      'role', p_role
    )
  );
  if v_replay is not null then return v_replay; end if;
  if exists (
    select 1 from artisan.artwork_collaborators
    where artwork_id = p_artwork_id and collaborator_user_id = v_collaborator_user_id
      and status in ('pending','accepted')
  ) then
    raise exception using errcode = '55000', message = 'artisan_collaboration_already_active';
  end if;
  insert into artisan.artwork_collaborators(
    artwork_id, collaborator_user_id, role, status, invited_at, responded_at
  ) values (
    p_artwork_id, v_collaborator_user_id, p_role, 'pending', pg_catalog.now(), null
  ) on conflict (artwork_id, collaborator_user_id) do update
  set role = excluded.role, status = 'pending', invited_at = pg_catalog.now(), responded_at = null;
  insert into artisan.artwork_credits(
    artwork_id, credited_user_id, credited_name, profile_url,
    role, display_order, confirmation_status, confirmed_at
  ) values (
    p_artwork_id, v_collaborator_user_id, v_credited_name, v_profile_url,
    p_role, 10, 'pending', null
  ) on conflict do nothing;
  update artisan.artwork_credits
  set credited_name = v_credited_name, profile_url = v_profile_url,
      role = p_role, confirmation_status = 'pending', confirmed_at = null
  where artwork_id = p_artwork_id and credited_user_id = v_collaborator_user_id;
  insert into artisan.notifications(
    delivery_key, user_id, notification_type, title, body,
    action_path, source_type, source_id
  ) values (
    'collaboration-invite:' || p_artwork_id::text || ':' || v_collaborator_user_id::text,
    v_collaborator_user_id, 'credit_update', 'Collaboration credit invitation',
    'An artwork owner invited you to confirm a collaboration credit.',
    '/account/credits?kind=collaborations', 'artwork', p_artwork_id
  ) on conflict (delivery_key) do update
  set status = 'pending', read_at = null, delivered_at = null,
      available_at = pg_catalog.now();
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_collaborator_invited',
    'artisan_artwork', p_artwork_id, p_client_request_id,
    pg_catalog.jsonb_build_object('collaboratorHandle', v_collaborator_handle, 'role', p_role)
  );
  v_response := pg_catalog.jsonb_build_object(
    'artworkId', p_artwork_id, 'collaboratorHandle', v_collaborator_handle,
    'role', p_role, 'status', 'pending'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_invite_collaborator_by_handle(uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_invite_collaborator_by_handle(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_invite_collaborator_by_handle(uuid, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_respond_collaboration(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_artwork_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artwork artisan.artworks%rowtype;
  v_collaboration artisan.artwork_collaborators%rowtype;
  v_actor_handle text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_decision not in ('accepted','declined')
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_collaboration_response_not_permitted';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_collaboration_responded',
    pg_catalog.jsonb_build_object('artworkId', p_artwork_id, 'decision', p_decision)
  );
  if v_replay is not null then return v_replay; end if;
  select * into strict v_artwork from artisan.artworks where id = p_artwork_id;
  select * into strict v_collaboration from artisan.artwork_collaborators
  where artwork_id = p_artwork_id and collaborator_user_id = p_actor_user_id
    and status = 'pending' for update;
  if p_decision = 'accepted' and (
       not private.community_can_participate(p_actor_user_id, 'artisan_membership')
       or exists (
         select 1 from artisan.user_blocks as block
         where (block.blocker_user_id = p_actor_user_id and block.blocked_user_id = v_artwork.owner_user_id)
            or (block.blocked_user_id = p_actor_user_id and block.blocker_user_id = v_artwork.owner_user_id)
       )
     ) then
    raise exception using errcode = '42501', message = 'artisan_collaboration_acceptance_not_permitted';
  end if;
  update artisan.artwork_collaborators
  set status = p_decision, responded_at = pg_catalog.now()
  where artwork_id = p_artwork_id and collaborator_user_id = p_actor_user_id
  returning * into v_collaboration;
  update artisan.artwork_credits
  set confirmation_status = case when p_decision = 'accepted' then 'confirmed' else 'declined' end,
      confirmed_at = case when p_decision = 'accepted' then pg_catalog.now() else null end
  where artwork_id = p_artwork_id and credited_user_id = p_actor_user_id
    and role = v_collaboration.role;
  select card.handle into v_actor_handle from public.profile_public_cards as card
  where card.user_id = p_actor_user_id;
  insert into artisan.notifications(
    delivery_key, user_id, notification_type, title, body,
    action_path, source_type, source_id
  ) values (
    'collaboration-response:' || p_artwork_id::text || ':' || p_actor_user_id::text || ':' || p_decision,
    v_artwork.owner_user_id, 'credit_update', 'Collaboration invitation updated',
    'A collaborator ' || p_decision || ' an artwork credit invitation.',
    '/account/credits?kind=collaborations', 'artwork', p_artwork_id
  ) on conflict (delivery_key) do nothing;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_collaboration_' || p_decision,
    'artisan_artwork', p_artwork_id, p_client_request_id,
    pg_catalog.jsonb_build_object('collaboratorHandle', v_actor_handle, 'role', v_collaboration.role)
  );
  v_response := pg_catalog.jsonb_build_object(
    'artworkId', p_artwork_id, 'role', v_collaboration.role,
    'status', p_decision, 'respondedAt', v_collaboration.responded_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_respond_collaboration(uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.artisan_respond_collaboration(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_respond_collaboration(uuid, uuid, uuid, text) to service_role;

create or replace function public.artisan_remove_collaborator_by_handle(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_artwork_id uuid,
  p_collaborator_handle text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collaborator_user_id uuid;
  v_collaborator_handle text;
  v_collaboration artisan.artwork_collaborators%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 1000
     or not exists (
       select 1 from artisan.artworks as artwork
       where artwork.id = p_artwork_id and artwork.owner_user_id = p_actor_user_id
     ) then
    raise exception using errcode = '42501', message = 'artisan_collaborator_removal_not_permitted';
  end if;
  select resolved.user_id, resolved.current_handle
  into v_collaborator_user_id, v_collaborator_handle
  from private.community_resolve_profile_handle(p_collaborator_handle, true, false) as resolved;
  if v_collaborator_user_id is null or v_collaborator_user_id = p_actor_user_id then
    raise exception using errcode = '22023', message = 'artisan_collaborator_handle_unavailable';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_collaborator_removed',
    pg_catalog.jsonb_build_object(
      'artworkId', p_artwork_id, 'collaboratorHandle', v_collaborator_handle,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  update artisan.artwork_collaborators
  set status = 'removed', responded_at = pg_catalog.now()
  where artwork_id = p_artwork_id and collaborator_user_id = v_collaborator_user_id
    and status in ('pending','accepted')
  returning * into v_collaboration;
  if v_collaboration.artwork_id is null then
    raise exception using errcode = '55000', message = 'artisan_collaboration_not_active';
  end if;
  -- Explicit removal ends the profile link but preserves the credited name.
  update artisan.artwork_credits
  set confirmation_status = 'not_required', confirmed_at = null, profile_url = null
  where artwork_id = p_artwork_id and credited_user_id = v_collaborator_user_id
    and role = v_collaboration.role;
  insert into artisan.notifications(
    delivery_key, user_id, notification_type, title, body,
    action_path, source_type, source_id
  ) values (
    'collaboration-removed:' || p_artwork_id::text || ':' || v_collaborator_user_id::text,
    v_collaborator_user_id, 'credit_update', 'Collaboration invitation removed',
    'An artwork collaboration link was removed; the credited name remains preserved.',
    '/account/credits?kind=collaborations', 'artwork', p_artwork_id
  ) on conflict (delivery_key) do nothing;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_collaborator_removed',
    'artisan_artwork', p_artwork_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('collaboratorHandle', v_collaborator_handle, 'role', v_collaboration.role)
  );
  v_response := pg_catalog.jsonb_build_object(
    'artworkId', p_artwork_id, 'collaboratorHandle', v_collaborator_handle,
    'role', v_collaboration.role, 'status', 'removed'
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_remove_collaborator_by_handle(uuid, uuid, uuid, text, text) owner to postgres;
revoke all privileges on function public.artisan_remove_collaborator_by_handle(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_remove_collaborator_by_handle(uuid, uuid, uuid, text, text) to service_role;

create or replace function public.artisan_current_user_collaborations(
  p_actor_user_id uuid,
  p_kind text,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id)
     or p_kind not in ('incoming','outgoing') then
    raise exception using errcode = '42501', message = 'artisan_collaboration_list_not_permitted';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'artworkId', item.artwork_id,
    'artworkTitle', item.artwork_title,
    'counterpartyHandle', item.counterparty_handle,
    'role', item.role,
    'status', item.status,
    'invitedAt', item.invited_at,
    'respondedAt', item.responded_at
  ) order by item.invited_at desc, item.artwork_id), '[]'::jsonb)
  into v_items
  from (
    select collaboration.artwork_id, artwork.title as artwork_title,
      case when p_kind = 'incoming' then owner_card.handle else collaborator_card.handle end as counterparty_handle,
      collaboration.role, collaboration.status,
      collaboration.invited_at, collaboration.responded_at
    from artisan.artwork_collaborators as collaboration
    join artisan.artworks as artwork on artwork.id = collaboration.artwork_id
    left join public.profile_public_cards as owner_card
      on owner_card.user_id = artwork.owner_user_id
    left join public.profile_public_cards as collaborator_card
      on collaborator_card.user_id = collaboration.collaborator_user_id
    where ((p_kind = 'incoming' and collaboration.collaborator_user_id = p_actor_user_id)
        or (p_kind = 'outgoing' and artwork.owner_user_id = p_actor_user_id))
      and (p_before is null or collaboration.invited_at < p_before)
    order by collaboration.invited_at desc, collaboration.artwork_id
    limit v_limit
  ) as item;
  return pg_catalog.jsonb_build_object(
    'kind', p_kind, 'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'invitedAt' else null end
  );
end;
$$;

alter function public.artisan_current_user_collaborations(uuid, text, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_current_user_collaborations(uuid, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_collaborations(uuid, text, integer, timestamptz) to service_role;

create or replace function public.artisan_owner_artwork_detail(
  p_actor_user_id uuid,
  p_artwork_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'artworkId', artwork.id,
      'slug', artwork.slug,
      'title', artwork.title,
      'description', artwork.description,
      'artistStatement', artwork.artist_statement,
      'creationMethod', artwork.creation_method,
      'humanContributionNote', artwork.human_contribution_note,
      'creditLine', artwork.credit_line,
      'creditedNameOrPseudonym', artwork.credited_name_or_pseudonym,
      'preferredProfileUrl', artwork.preferred_profile_url,
      'licenseCode', artwork.license_code,
      'downloadAllowed', artwork.download_allowed,
      'altText', artwork.alt_text,
      'contentWarnings', artwork.content_warnings,
      'tags', artwork.tags,
      'status', artwork.status,
      'moderationStatus', artwork.moderation_status,
      'createdAt', artwork.created_at,
      'updatedAt', artwork.updated_at,
      'submittedAt', artwork.submitted_at,
      'publishedAt', artwork.published_at,
      'appreciationCount', (
        select pg_catalog.count(*) from artisan.appreciations as appreciation
        where appreciation.target_type = 'artwork'
          and appreciation.target_id = artwork.id
      ),
      'credits', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'creditId', credit.id,
          'creditedName', credit.credited_name,
          'creditedHandle', card.handle,
          'profileUrl', case when credit.confirmation_status = 'confirmed'
            and private.community_profile_is_public(credit.credited_user_id)
            then card.canonical_profile_url else null end,
          'role', credit.role,
          'displayOrder', credit.display_order,
          'confirmationStatus', credit.confirmation_status,
          'confirmedAt', credit.confirmed_at
        ) order by credit.display_order, credit.id)
        from artisan.artwork_credits as credit
        left join public.profile_public_cards as card
          on card.user_id = credit.credited_user_id
        where credit.artwork_id = artwork.id
      ), '[]'::jsonb),
      'collaborators', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'collaboratorHandle', card.handle,
          'role', collaboration.role,
          'status', collaboration.status,
          'invitedAt', collaboration.invited_at,
          'respondedAt', collaboration.responded_at
        ) order by collaboration.invited_at, card.handle)
        from artisan.artwork_collaborators as collaboration
        left join public.profile_public_cards as card
          on card.user_id = collaboration.collaborator_user_id
        where collaboration.artwork_id = artwork.id
      ), '[]'::jsonb),
      'media', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'mediaAssetId', media.id,
          'adapterKey', media.adapter_key,
          'processingStatus', media.processing_status,
          'moderationStatus', media.moderation_status,
          'declaredMime', media.declared_mime,
          'approvedMime', media.approved_mime,
          'byteSize', media.byte_size,
          'width', media.width,
          'height', media.height,
          'durationSeconds', media.duration_seconds,
          'accessibilityDescription', media.accessibility_description,
          'transcript', media.transcript,
          'audioDescription', media.audio_description,
          'keyboardInstructions', media.keyboard_instructions,
          'staticEquivalentDescription', media.static_equivalent_description,
          'captionTracks', media.caption_tracks,
          'loudAudioWarning', media.loud_audio_warning,
          'spokenContent', media.spoken_content,
          'creatorDeclaresFlashRisk', media.creator_declared_flash_risk,
          'flashWarning', media.flash_warning,
          'createdAt', media.created_at,
          'updatedAt', media.updated_at
        ) order by media.created_at, media.id)
        from artisan.media_assets as media where media.artwork_id = artwork.id
      ), '[]'::jsonb)
    )
    from artisan.artworks as artwork
    where artwork.id = p_artwork_id and artwork.owner_user_id = p_actor_user_id
      and private.community_account_is_recoverable(p_actor_user_id)
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_owner_artwork_detail(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_owner_artwork_detail(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_owner_artwork_detail(uuid, uuid) to service_role;

create or replace function public.artisan_owner_post_detail(
  p_actor_user_id uuid,
  p_post_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'postId', post.id,
      'slug', post.slug,
      'title', post.title,
      'artistStatement', post.artist_statement,
      'theme', post.theme,
      'tags', post.tags,
      'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds,
      'status', post.status,
      'moderationStatus', post.moderation_status,
      'createdAt', post.created_at,
      'updatedAt', post.updated_at,
      'submittedAt', post.submitted_at,
      'publishedAt', post.published_at,
      'appreciationCount', (
        select pg_catalog.count(*) from artisan.appreciations as appreciation
        where appreciation.target_type = 'post'
          and appreciation.target_id = post.id
      ),
      'artworks', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'artworkId', artwork.id,
          'slug', artwork.slug,
          'title', artwork.title,
          'status', artwork.status,
          'moderationStatus', artwork.moderation_status,
          'displayOrder', link.display_order
        ) order by link.display_order, artwork.id)
        from artisan.post_artworks as link
        join artisan.artworks as artwork on artwork.id = link.artwork_id
        where link.post_id = post.id and artwork.owner_user_id = p_actor_user_id
      ), '[]'::jsonb)
    )
    from artisan.forum_posts as post
    where post.id = p_post_id and post.owner_user_id = p_actor_user_id
      and private.community_account_is_recoverable(p_actor_user_id)
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_owner_post_detail(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_owner_post_detail(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_owner_post_detail(uuid, uuid) to service_role;

create or replace function public.artisan_current_user_awards(
  p_actor_user_id uuid,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'awardId', item.award_id,
    'challengeId', item.challenge_id,
    'challengeSlug', item.challenge_slug,
    'challengeTitle', item.challenge_title,
    'submissionId', item.submission_id,
    'artworkId', item.artwork_id,
    'artworkTitle', item.artwork_title,
    'awardType', item.award_type,
    'status', item.status,
    'selectionReason', item.selection_reason,
    'selectedAt', item.selected_at,
    'confirmedAt', item.confirmed_at,
    'publishedAt', item.published_at,
    'requiresResponse', item.status = 'selection_pending',
    'agreement', case when item.status = 'selection_pending' then pg_catalog.jsonb_build_object(
      'documentKey', item.document_key,
      'documentVersion', item.document_version,
      'contentSha256', item.content_sha256,
      'publicPath', item.public_path
    ) else null end,
    'actionPath', '/account/activity?kind=awards'
  ) order by item.selected_at desc, item.award_id), '[]'::jsonb)
  into v_items
  from (
    select award.id as award_id, award.challenge_id,
      challenge.slug as challenge_slug, challenge.title as challenge_title,
      award.submission_id, submission.artwork_id, artwork.title as artwork_title,
      award.award_type, award.status, award.selection_reason,
      award.selected_at, award.confirmed_at, award.published_at,
      document.document_key, document.document_version,
      document.content_sha256, document.public_path
    from artisan.challenge_awards as award
    join artisan.challenge_submissions as submission on submission.id = award.submission_id
    join artisan.artworks as artwork on artwork.id = submission.artwork_id
    join artisan.challenges as challenge on challenge.id = award.challenge_id
    left join private.community_active_legal_documents as active_document
      on active_document.document_key = 'winner_usage_agreement_template'
    left join private.community_legal_document_versions as document
      on document.document_key = active_document.document_key
     and document.document_version = active_document.document_version
     and document.status = 'approved'
    where submission.submitter_user_id = p_actor_user_id
      and award.status <> 'revoked'
      and (p_before is null or award.selected_at < p_before)
    order by award.selected_at desc, award.id
    limit v_limit
  ) as item;
  return pg_catalog.jsonb_build_object(
    'kind', 'awards', 'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'selectedAt' else null end
  );
end;
$$;

alter function public.artisan_current_user_awards(uuid, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_current_user_awards(uuid, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_awards(uuid, integer, timestamptz) to service_role;

create or replace function public.artisan_current_user_judging(
  p_actor_user_id uuid,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'challengeId', item.challenge_id,
    'challengeSlug', item.challenge_slug,
    'challengeTitle', item.challenge_title,
    'challengeStatus', item.challenge_status,
    'role', item.judge_role,
    'assignmentStatus', item.assignment_status,
    'conflictDisclosure', item.conflict_disclosure,
    'blindReview', item.blind_review,
    'judgingRubricVersion', item.judging_rubric_version,
    'judgingRubric', item.judging_rubric,
    'assignedAt', item.assigned_at,
    'submissions', item.submissions
  ) order by item.assigned_at desc, item.challenge_id), '[]'::jsonb)
  into v_items
  from (
    select challenge.id as challenge_id,
      challenge.slug as challenge_slug,
      challenge.title as challenge_title,
      challenge.status as challenge_status,
      judge.role as judge_role,
      judge.status as assignment_status,
      judge.conflict_disclosure,
      challenge.blind_review,
      challenge.judging_rubric_version,
      challenge.judging_rubric,
      judge.assigned_at,
      case when judge.status = 'cleared'
        and challenge.status in ('judging','selection_pending') then coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'submissionId', submission.id,
            'entryLabel', 'Entry ' || pg_catalog.upper(pg_catalog.left(submission.id::text, 8)),
            'artworkTitle', case when challenge.blind_review then null else artwork.title end,
            'creationMethod', artwork.creation_method,
            'humanContributionNote', artwork.human_contribution_note,
            'accessibilityDescription', artwork.alt_text,
            'artist', case when not challenge.blind_review and artist.handle is not null
              then pg_catalog.jsonb_build_object(
                'handle', artist.handle,
                'profileUrl', artist.canonical_profile_url
              ) else null end,
            'media', coalesce((
              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'mediaAssetId', media.id,
                'adapterKey', media.adapter_key,
                'mediaPath', '/api/account/judging/media/' || media.id::text,
                'posterPath', '/api/account/judging/media/' || media.id::text || '/poster',
                'accessibilityDescription', media.accessibility_description,
                'transcript', media.transcript,
                'audioDescription', media.audio_description,
                'keyboardInstructions', media.keyboard_instructions,
                'staticEquivalentDescription', media.static_equivalent_description,
                'loudAudioWarning', media.loud_audio_warning,
                'flashWarning', media.flash_warning
              ) order by link.display_order, media.id)
              from artisan.submission_media as link
              join artisan.media_assets as media on media.id = link.media_asset_id
              where link.submission_id = submission.id
                and media.processing_status in ('approved','published')
                and media.moderation_status = 'approved'
            ), '[]'::jsonb),
            'score', (
              select pg_catalog.jsonb_build_object(
                'rubricVersion', score.rubric_version,
                'score', score.score,
                'privateNote', score.private_note,
                'updatedAt', score.updated_at
              )
              from artisan.challenge_scores as score
              where score.submission_id = submission.id
                and score.judge_user_id = p_actor_user_id
              order by score.updated_at desc limit 1
            )
          ) order by submission.submitted_at, submission.id)
          from artisan.challenge_submissions as submission
          join artisan.artworks as artwork on artwork.id = submission.artwork_id
          left join private.community_safe_public_profile_cards as artist
            on artist.user_id = submission.submitter_user_id
          where submission.challenge_id = challenge.id
            and submission.submitter_user_id <> p_actor_user_id
            and submission.status in ('eligible','judging','selected','not_selected','published')
            and submission.moderation_status = 'approved'
            and submission.eligibility_status = 'eligible'
        ), '[]'::jsonb) else '[]'::jsonb end as submissions
    from artisan.challenge_judges as judge
    join artisan.challenges as challenge on challenge.id = judge.challenge_id
    where judge.judge_user_id = p_actor_user_id
      and judge.status <> 'released'
      and (p_before is null or judge.assigned_at < p_before)
    order by judge.assigned_at desc, challenge.id
    limit v_limit
  ) as item;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextBefore', case when pg_catalog.jsonb_array_length(v_items) = v_limit
      then (v_items -> -1) ->> 'assignedAt' else null end
  );
end;
$$;

alter function public.artisan_current_user_judging(uuid, integer, timestamptz) owner to postgres;
revoke all privileges on function public.artisan_current_user_judging(uuid, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_judging(uuid, integer, timestamptz) to service_role;

create or replace function public.artisan_judge_media_asset(
  p_actor_user_id uuid,
  p_media_asset_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'mediaAssetId', media.id,
      'adapterKey', media.adapter_key,
      'storageProvider', media.storage_provider,
      'approvedBucket', media.approved_bucket,
      'approvedObjectKey', media.approved_object_key,
      'approvedChecksumSha256', media.approved_checksum_sha256,
      'approvedMime', media.approved_mime,
      'thumbnailBucket', media.thumbnail_bucket,
      'thumbnailObjectKey', media.thumbnail_object_key,
      'thumbnailChecksumSha256', media.thumbnail_checksum_sha256,
      'thumbnailMime', media.thumbnail_mime
    )
    from artisan.media_assets as media
    join artisan.submission_media as link on link.media_asset_id = media.id
    join artisan.challenge_submissions as submission on submission.id = link.submission_id
    join artisan.challenges as challenge on challenge.id = submission.challenge_id
    join artisan.challenge_judges as judge
      on judge.challenge_id = challenge.id and judge.judge_user_id = p_actor_user_id
    where media.id = p_media_asset_id
      and judge.status = 'cleared'
      and challenge.status in ('judging','selection_pending')
      and submission.submitter_user_id <> p_actor_user_id
      and submission.status in ('eligible','judging','selected','not_selected','published')
      and submission.moderation_status = 'approved'
      and submission.eligibility_status = 'eligible'
      and media.processing_status in ('approved','published')
      and media.moderation_status = 'approved'
      and media.approved_bucket = 'artisan-approved'
      and media.thumbnail_bucket = 'artisan-thumbnails'
      and media.approved_object_key like 'approved/' || media.owner_user_id::text || '/' || media.artwork_id::text || '/' || media.id::text || '/%'
      and media.thumbnail_object_key like 'thumbnails/' || media.owner_user_id::text || '/' || media.artwork_id::text || '/' || media.id::text || '/%'
      and media.approved_object_key !~ '(^|/)\.\.(/|$)'
      and media.thumbnail_object_key !~ '(^|/)\.\.(/|$)'
      and media.approved_object_key !~ '[\\\\]'
      and media.thumbnail_object_key !~ '[\\\\]'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_judge_media_asset(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_judge_media_asset(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_judge_media_asset(uuid, uuid) to service_role;

create or replace function public.enqueue_artisan_account_cleanup(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_lifecycle_request_id uuid
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
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'community_lifecycle_manage'
  );
  if p_client_request_id is null or p_lifecycle_request_id is null then
    raise exception using errcode = '22023', message = 'artisan_account_cleanup_invalid';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_lifecycle_request_id and action = 'account_deletion'
    and status in ('storage_inventory','storage_cleanup')
  for update;
  select * into strict v_handoff
  from private.account_deletion_handoffs
  where lifecycle_request_id = p_lifecycle_request_id
    and storage_inventory_completed_at is not null
    and storage_inventory_evidence_sha256 is not null;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_account_cleanup_enqueued',
    pg_catalog.jsonb_build_object('lifecycleRequestId', p_lifecycle_request_id)
  );
  if v_replay is not null then return v_replay; end if;
  select pg_catalog.count(*)::integer into v_expected
  from artisan.media_assets as media
  where media.owner_user_id = v_request.user_id;
  insert into artisan.account_cleanup_runs(
    lifecycle_request_id, user_id, content_disposition,
    status, expected_asset_count, completed_asset_count,
    completion_evidence_sha256, completed_at
  ) values (
    p_lifecycle_request_id, v_request.user_id, v_handoff.content_disposition,
    case
      when exists (
        select 1 from private.account_legal_holds as hold
        where hold.user_id = v_request.user_id and hold.lifted_at is null
      ) or exists (
        select 1 from artisan.media_assets as media
        where media.owner_user_id = v_request.user_id
          and private.artisan_retention_target_has_legal_hold('media_asset', media.id)
      ) then 'blocked_by_legal_hold'
      when v_expected = 0 then 'completed'
      else 'processing'
    end,
    v_expected, 0,
    case when v_expected = 0 then pg_catalog.encode(
      extensions.digest('artisan-account-cleanup-empty:' || p_lifecycle_request_id::text, 'sha256'), 'hex'
    ) else null end,
    case when v_expected = 0 then pg_catalog.now() else null end
  ) on conflict (lifecycle_request_id) do nothing;
  select * into strict v_run from artisan.account_cleanup_runs
  where lifecycle_request_id = p_lifecycle_request_id for update;
  if v_run.user_id <> v_request.user_id
     or v_run.content_disposition <> v_handoff.content_disposition
     or v_run.expected_asset_count <> v_expected then
    raise exception using errcode = '23505', message = 'artisan_account_cleanup_snapshot_conflict';
  end if;
  if v_run.status <> 'blocked_by_legal_hold' and v_expected > 0 then
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
    select p_lifecycle_request_id, upserted.target_id, upserted.id from upserted
    on conflict (lifecycle_request_id, media_asset_id) do nothing;
    select pg_catalog.count(*) filter (where task.status = 'completed')::integer,
      pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(
        task.id::text || ':' || coalesce(task.completion_evidence_sha256, ''),
        ',' order by task.id
      ), 'empty'), 'sha256'), 'hex')
    into v_completed, v_evidence
    from artisan.account_cleanup_assets as asset
    join artisan.retention_tasks as task on task.id = asset.retention_task_id
    where asset.lifecycle_request_id = p_lifecycle_request_id;
    update artisan.account_cleanup_runs
    set completed_asset_count = v_completed,
        status = case when v_completed = expected_asset_count
          then 'completed' else 'processing' end,
        completion_evidence_sha256 = case when v_completed = expected_asset_count
          then v_evidence else null end,
        completed_at = case when v_completed = expected_asset_count
          then pg_catalog.now() else null end,
        updated_at = pg_catalog.now()
    where lifecycle_request_id = p_lifecycle_request_id
    returning * into v_run;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    target_id, request_id, metadata
  ) values (
    p_actor_user_id, 'staff', 'community_lifecycle_manage',
    'artisan_account_cleanup_enqueued', 'account_lifecycle_request',
    p_lifecycle_request_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'status', v_run.status,
      'expectedAssetCount', v_run.expected_asset_count,
      'completedAssetCount', v_run.completed_asset_count
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'lifecycleRequestId', p_lifecycle_request_id,
    'status', v_run.status,
    'expectedAssetCount', v_run.expected_asset_count,
    'completedAssetCount', v_run.completed_asset_count,
    'completionEvidenceSha256', v_run.completion_evidence_sha256,
    'completedAt', v_run.completed_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.enqueue_artisan_account_cleanup(uuid, text, uuid, uuid) owner to postgres;
revoke all privileges on function public.enqueue_artisan_account_cleanup(uuid, text, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_artisan_account_cleanup(uuid, text, uuid, uuid) to service_role;

create or replace function public.get_community_artisan_cleanup_readiness(
  p_lifecycle_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_caller_is_service_role() then coalesce((
    select pg_catalog.jsonb_build_object(
      'lifecycleRequestId', run.lifecycle_request_id,
      'status', run.status,
      'expectedAssetCount', run.expected_asset_count,
      'completedAssetCount', run.completed_asset_count,
      'completionEvidenceSha256', run.completion_evidence_sha256,
      'completedAt', run.completed_at,
      'ready', run.status = 'completed'
    )
    from artisan.account_cleanup_runs as run
    where run.lifecycle_request_id = p_lifecycle_request_id
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.get_community_artisan_cleanup_readiness(uuid) owner to postgres;
revoke all privileges on function public.get_community_artisan_cleanup_readiness(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_community_artisan_cleanup_readiness(uuid) to service_role;

-- Shared-identity self-service mutations also cross the trusted Identity
-- Worker. Explicit actor wrappers preserve each canonical idempotent/audited
-- implementation while preventing a browser token from bypassing the
-- Worker's origin, rate, Turnstile, and session-policy checks.
create or replace function public.community_set_actor_public_profile(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_enabled boolean, p_short_public_bio text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.set_current_user_public_profile(
    p_client_request_id, p_enabled, p_short_public_bio
  );
end;
$$;
alter function public.community_set_actor_public_profile(uuid, uuid, boolean, text) owner to postgres;
revoke all privileges on function public.community_set_actor_public_profile(uuid, uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.community_set_actor_public_profile(uuid, uuid, boolean, text) to service_role;

create or replace function public.community_accept_actor_documents(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_acceptances jsonb, p_accepted_origin text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.accept_current_user_community_documents(
    p_client_request_id, p_acceptances, p_accepted_origin
  );
end;
$$;
alter function public.community_accept_actor_documents(uuid, uuid, jsonb, text) owner to postgres;
revoke all privileges on function public.community_accept_actor_documents(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.community_accept_actor_documents(uuid, uuid, jsonb, text) to service_role;

create or replace function public.community_request_actor_lifecycle_action(
  p_actor_user_id uuid, p_client_request_id uuid, p_action text,
  p_notice_version text, p_user_note text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.request_current_user_community_lifecycle_action(
    p_client_request_id, p_action, p_notice_version, p_user_note
  );
end;
$$;
alter function public.community_request_actor_lifecycle_action(uuid, uuid, text, text, text) owner to postgres;
revoke all privileges on function public.community_request_actor_lifecycle_action(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.community_request_actor_lifecycle_action(uuid, uuid, text, text, text) to service_role;

create or replace function public.community_cancel_actor_deletion(
  p_actor_user_id uuid, p_client_request_id uuid, p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.cancel_current_user_community_deletion(
    p_client_request_id, p_request_id
  );
end;
$$;
alter function public.community_cancel_actor_deletion(uuid, uuid, uuid) owner to postgres;
revoke all privileges on function public.community_cancel_actor_deletion(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.community_cancel_actor_deletion(uuid, uuid, uuid) to service_role;

create or replace function public.community_revoke_actor_guardian_relationship(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_relationship_id uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.revoke_current_user_guardian_relationship(
    p_client_request_id, p_relationship_id, p_reason
  );
end;
$$;
alter function public.community_revoke_actor_guardian_relationship(uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.community_revoke_actor_guardian_relationship(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.community_revoke_actor_guardian_relationship(uuid, uuid, uuid, text) to service_role;

create or replace function public.community_revoke_actor_guardian_consent(
  p_actor_user_id uuid, p_client_request_id uuid,
  p_consent_id uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'community_service_role_required';
  end if;
  perform private.artisan_assume_verified_actor(p_actor_user_id);
  return public.revoke_current_user_guardian_consent(
    p_client_request_id, p_consent_id, p_reason
  );
end;
$$;
alter function public.community_revoke_actor_guardian_consent(uuid, uuid, uuid, text) owner to postgres;
revoke all privileges on function public.community_revoke_actor_guardian_consent(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.community_revoke_actor_guardian_consent(uuid, uuid, uuid, text) to service_role;

-- Safe discovery presentation helpers expose only UUID-derived same-origin
-- delivery paths. They never expose quarantine/approved object keys, original
-- filenames, checksums, moderation evidence, user UUIDs, or engagement counts.
create or replace function private.artisan_users_block_each_other(
  p_actor_user_id uuid,
  p_other_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1 from artisan.user_blocks as block
    where (block.blocker_user_id = p_actor_user_id and block.blocked_user_id = p_other_user_id)
       or (block.blocked_user_id = p_actor_user_id and block.blocker_user_id = p_other_user_id)
  ), false);
$$;

alter function private.artisan_users_block_each_other(uuid, uuid) owner to postgres;
revoke all privileges on function private.artisan_users_block_each_other(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_media_presentations(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'mediaAssetId', media.id,
    'adapterKey', media.adapter_key,
    'mediaKind', media.media_kind,
    'presentationMime', media.approved_mime,
    'mediaPath', '/api/public/media/' || media.id::text,
    'posterPath', '/api/public/media/' || media.id::text || '/poster',
    'captions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'path', '/api/public/media/' || caption.media_asset_id::text ||
          '/captions/' || caption.id::text,
        'language', caption.language, 'kind', caption.kind, 'label', caption.label
      ) order by caption.language, caption.id)
      from artisan.media_caption_tracks as caption
      where caption.media_asset_id = media.id and caption.status = 'ready'
    ), '[]'::jsonb),
    'altText', media.accessibility_description,
    'accessibilityDescription', media.accessibility_description,
    'transcript', media.transcript,
    'audioDescription', media.audio_description,
    'keyboardInstructions', media.keyboard_instructions,
    'staticEquivalent', media.static_equivalent_description,
    'spokenContent', media.spoken_content,
    'creatorDeclaresFlashRisk', media.creator_declared_flash_risk,
    'flashWarning', media.flash_warning,
    'loudAudioWarning', media.loud_audio_warning,
    'autoplay', false, 'sanitizedDerivative', true, 'status', 'ready'
  ) order by media.published_at, media.id), '[]'::jsonb)
  from (
    select asset.*, adapter.media_kind
    from artisan.media_assets as asset
    join artisan.media_adapters as adapter on adapter.adapter_key = asset.adapter_key
    where asset.artwork_id = p_artwork_id
      and asset.processing_status = 'published'
      and asset.moderation_status = 'approved'
    order by asset.published_at, asset.id
    limit 12
  ) as media;
$$;

alter function private.artisan_public_media_presentations(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_media_presentations(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_media_kinds(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(kind.media_kind order by kind.media_kind), '[]'::jsonb)
  from (
    select distinct adapter.media_kind
    from artisan.media_assets as media
    join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
    where media.artwork_id = p_artwork_id
      and media.processing_status = 'published'
      and media.moderation_status = 'approved'
  ) as kind;
$$;

alter function private.artisan_public_media_kinds(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_media_kinds(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_media_card(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pg_catalog.jsonb_build_object(
    'mediaAssetId', media.id, 'adapterKey', media.adapter_key,
    'mediaKind', adapter.media_kind, 'presentationMime', media.approved_mime,
    'mediaPath', '/api/public/media/' || media.id::text,
    'posterPath', '/api/public/media/' || media.id::text || '/poster',
    'altText', media.accessibility_description,
    'flashWarning', media.flash_warning,
    'loudAudioWarning', media.loud_audio_warning,
    'autoplay', false, 'sanitizedDerivative', true, 'status', 'ready'
  ) from artisan.media_assets as media
  join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
  where media.artwork_id = p_artwork_id
    and media.processing_status = 'published'
    and media.moderation_status = 'approved'
  order by media.published_at, media.id limit 1), '{}'::jsonb);
$$;

alter function private.artisan_public_media_card(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_media_card(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_artwork_challenges(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'challengeId', challenge.id, 'slug', challenge.slug, 'title', challenge.title
  ) order by challenge.title, challenge.id), '[]'::jsonb)
  from (
    select distinct challenge.id, challenge.slug, challenge.title
    from artisan.gallery_entries as gallery
    join artisan.challenges as challenge on challenge.id = gallery.challenge_id
    where gallery.artwork_id = p_artwork_id and gallery.status = 'published'
      and challenge.visibility = 'public'
      and challenge.published_at is not null and challenge.status <> 'cancelled'
  ) as challenge;
$$;

alter function private.artisan_public_artwork_challenges(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_artwork_challenges(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_collection_slugs(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(collection.slug order by collection.slug), '[]'::jsonb)
  from (
    select distinct curated.slug
    from artisan.gallery_entries as gallery
    join artisan.featured_entries as featured on featured.gallery_entry_id = gallery.id
    join artisan.featured_collections as curated on curated.slug = featured.collection_slug
    where gallery.artwork_id = p_artwork_id and gallery.status = 'published'
      and curated.status = 'published'
      and (curated.starts_at is null or curated.starts_at <= pg_catalog.now())
      and (curated.ends_at is null or curated.ends_at > pg_catalog.now())
      and featured.starts_at <= pg_catalog.now()
      and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
  ) as collection;
$$;

alter function private.artisan_public_collection_slugs(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_collection_slugs(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_post_artworks(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'artworkId', artwork.id, 'slug', artwork.slug, 'title', artwork.title,
    'creditLine', artwork.credit_line,
    'creationMethod', artwork.creation_method,
    'licenseCode', artwork.license_code, 'altText', artwork.alt_text,
    'contentWarnings', artwork.content_warnings, 'tags', artwork.tags,
    'displayOrder', artwork.display_order,
    'mediaKinds', private.artisan_public_media_kinds(artwork.id),
    'mediaPreview', private.artisan_public_media_card(artwork.id),
    'challenges', private.artisan_public_artwork_challenges(artwork.id),
    'collectionSlugs', private.artisan_public_collection_slugs(artwork.id)
  ) order by artwork.display_order, artwork.id), '[]'::jsonb)
  from (
    select owned.*, link.display_order
    from artisan.post_artworks as link
    join artisan.artworks as owned on owned.id = link.artwork_id
    where link.post_id = p_post_id and owned.status = 'published'
      and owned.moderation_status = 'approved'
    order by link.display_order, owned.id
    limit 12
  ) as artwork;
$$;

alter function private.artisan_public_post_artworks(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_post_artworks(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_post_artwork_previews(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'artworkId', artwork.id, 'slug', artwork.slug, 'title', artwork.title,
    'creationMethod', artwork.creation_method,
    'contentWarnings', artwork.content_warnings, 'tags', artwork.tags,
    'displayOrder', artwork.display_order,
    'mediaPreview', private.artisan_public_media_card(artwork.id)
  ) order by artwork.display_order, artwork.id), '[]'::jsonb)
  from (
    select owned.id, owned.slug, owned.title, owned.creation_method,
      owned.content_warnings, owned.tags, link.display_order
    from artisan.post_artworks as link
    join artisan.artworks as owned on owned.id = link.artwork_id
    where link.post_id = p_post_id and owned.status = 'published'
      and owned.moderation_status = 'approved'
    order by link.display_order, owned.id limit 3
  ) as artwork;
$$;

alter function private.artisan_public_post_artwork_previews(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_post_artwork_previews(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_public_post(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'postId', post.id, 'slug', post.slug, 'title', post.title,
      'artistStatement', post.artist_statement, 'theme', post.theme,
      'tags', post.tags,
      'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds, 'publishedAt', post.published_at,
      'artist', pg_catalog.jsonb_build_object(
        'handle', card.handle, 'displayName', card.display_name,
        'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
      ),
      'artworks', private.artisan_public_post_artworks(post.id),
      'comments', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'commentId', comment.id, 'parentCommentId', comment.parent_comment_id,
          'depth', comment.depth, 'body', comment.body, 'status', comment.status,
          'createdAt', comment.created_at, 'editedAt', comment.edited_at,
          'author', pg_catalog.jsonb_build_object(
            'handle', commenter.handle, 'displayName', commenter.display_name,
            'avatarUrl', commenter.avatar_url,
            'profileUrl', commenter.canonical_profile_url
          )
        ) order by comment.created_at, comment.id)
        from artisan.comments as comment
        join private.community_safe_public_profile_cards as commenter
          on commenter.user_id = comment.user_id
        where comment.post_id = post.id and comment.status in ('published','edited')
          and comment.moderation_status = 'approved'
      ), '[]'::jsonb)
    )
    from artisan.forum_posts as post
    join private.community_safe_public_profile_cards as card
      on card.user_id = post.owner_user_id
    where post.slug = pg_catalog.lower(p_slug)
      and post.status = 'published' and post.moderation_status = 'approved'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;

alter function public.artisan_public_post(text) owner to postgres;
revoke all privileges on function public.artisan_public_post(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_post(text) to anon, authenticated, service_role;

create or replace function public.artisan_current_user_appreciation(
  p_actor_user_id uuid,
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select post.owner_user_id into v_owner_user_id
  from artisan.forum_posts as post
  where post.id = p_post_id and post.status = 'published'
    and post.moderation_status = 'approved';
  if v_owner_user_id is null
     or private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id) then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'postId', p_post_id,
    'appreciated', exists (
      select 1 from artisan.appreciations as appreciation
      where appreciation.user_id = p_actor_user_id
        and appreciation.target_type = 'post'
        and appreciation.target_id = p_post_id
    )
  );
end;
$$;

alter function public.artisan_current_user_appreciation(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_current_user_appreciation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_appreciation(uuid, uuid) to service_role;

create or replace function public.artisan_member_post(
  p_actor_user_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_post jsonb;
  v_post_id uuid;
  v_owner_user_id uuid;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select post.id, post.owner_user_id into v_post_id, v_owner_user_id
  from artisan.forum_posts as post
  where post.slug = pg_catalog.lower(p_slug) and post.status = 'published'
    and post.moderation_status = 'approved';
  if v_post_id is null
     or private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id) then
    return '{}'::jsonb;
  end if;
  v_post := public.artisan_public_post(p_slug);
  if v_post = '{}'::jsonb then return v_post; end if;
  return v_post || pg_catalog.jsonb_build_object(
    'currentActor', pg_catalog.jsonb_build_object(
      'appreciated', exists (
        select 1 from artisan.appreciations as appreciation
        where appreciation.user_id = p_actor_user_id
          and appreciation.target_type = 'post'
          and appreciation.target_id = v_post_id
      )
    )
  );
end;
$$;

alter function public.artisan_member_post(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_member_post(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_post(uuid, text) to service_role;

create or replace function public.artisan_set_content_tags(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tags text[];
  v_previous_status text;
  v_replay jsonb;
  v_response jsonb;
begin
  select coalesce(pg_catalog.array_agg(tag order by tag), '{}'::text[]) into v_tags
  from pg_catalog.unnest(coalesce(p_tags, '{}'::text[])) as tag;
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id)
     or not private.artisan_active_member(p_actor_user_id)
     or not private.community_can_participate(p_actor_user_id, 'artisan_post')
     or p_target_type not in ('artwork','post')
     or not private.artisan_discovery_tags_are_valid(v_tags) then
    raise exception using errcode = '22023', message = 'artisan_content_tags_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_content_tags_set',
    pg_catalog.jsonb_build_object(
      'targetType', p_target_type, 'targetId', p_target_id, 'tags', v_tags
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_target_type = 'artwork' then
    select artwork.status into v_previous_status
    from artisan.artworks as artwork
    where artwork.id = p_target_id and artwork.owner_user_id = p_actor_user_id
      and artwork.status in ('draft','changes_requested','approved','published')
      and artwork.moderation_status <> 'legal_hold'
    for update;
    if v_previous_status in ('approved','published') then
      if exists (
        select 1 from artisan.challenge_submissions as submission
        where submission.artwork_id = p_target_id
          and submission.status not in ('draft','changes_requested','ineligible','withdrawn')
      ) or exists (
        select 1 from artisan.gallery_entries as gallery
        where gallery.artwork_id = p_target_id and gallery.status = 'published'
      ) then
        raise exception using errcode = '55000',
          message = 'artisan_artwork_revision_requires_correction_workflow';
      end if;
      update artisan.forum_posts as post
      set status = 'draft', moderation_status = 'unreviewed',
          submitted_at = null, published_at = null, updated_at = pg_catalog.now()
      where post.id in (
        select link.post_id from artisan.post_artworks as link
        where link.artwork_id = p_target_id
      ) and post.status in ('approved','published');
    end if;
    update artisan.artworks set tags = v_tags, status = 'draft',
      moderation_status = 'unreviewed', submitted_at = null,
      published_at = null, updated_at = pg_catalog.now()
    where id = p_target_id and owner_user_id = p_actor_user_id
      and status in ('draft','changes_requested','approved','published')
      and moderation_status <> 'legal_hold';
  else
    update artisan.forum_posts set tags = v_tags, status = 'draft',
      moderation_status = 'unreviewed', submitted_at = null,
      published_at = null, updated_at = pg_catalog.now()
    where id = p_target_id and owner_user_id = p_actor_user_id
      and status in ('draft','changes_requested','approved','published')
      and moderation_status <> 'legal_hold';
  end if;
  if not found then
    raise exception using errcode = '42501', message = 'artisan_content_tags_not_editable';
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id,
    request_id, metadata
  ) values (
    p_actor_user_id, 'user', 'artisan_content_tags_set',
    'artisan_' || p_target_type, p_target_id, p_client_request_id,
    pg_catalog.jsonb_build_object('tags', v_tags)
  );
  v_response := pg_catalog.jsonb_build_object(
    'targetType', p_target_type, 'targetId', p_target_id, 'tags', v_tags,
    'status', 'draft', 'requiresReview', true
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.artisan_set_content_tags(uuid, uuid, text, uuid, text[]) owner to postgres;
revoke all privileges on function public.artisan_set_content_tags(uuid, uuid, text, uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_set_content_tags(uuid, uuid, text, uuid, text[]) to service_role;

create or replace function private.artisan_public_post_media_kinds(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(kind.media_kind order by kind.media_kind), '[]'::jsonb)
  from (
    select distinct adapter.media_kind
    from artisan.post_artworks as link
    join artisan.media_assets as media on media.artwork_id = link.artwork_id
    join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
    where link.post_id = p_post_id and media.processing_status = 'published'
      and media.moderation_status = 'approved'
  ) as kind;
$$;
alter function private.artisan_public_post_media_kinds(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_post_media_kinds(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_post_challenges(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'challengeId', challenge.id, 'slug', challenge.slug, 'title', challenge.title
  ) order by challenge.title, challenge.id), '[]'::jsonb)
  from (
    select distinct invitation.id, invitation.slug, invitation.title
    from artisan.post_artworks as link
    join artisan.gallery_entries as gallery on gallery.artwork_id = link.artwork_id
    join artisan.challenges as invitation on invitation.id = gallery.challenge_id
    where link.post_id = p_post_id and gallery.status = 'published'
      and invitation.visibility = 'public'
      and invitation.published_at is not null and invitation.status <> 'cancelled'
  ) as challenge;
$$;
alter function private.artisan_public_post_challenges(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_post_challenges(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_post_collection_slugs(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(collection.slug order by collection.slug), '[]'::jsonb)
  from (
    select distinct curated.slug
    from artisan.post_artworks as link
    join artisan.gallery_entries as gallery on gallery.artwork_id = link.artwork_id
    join artisan.featured_entries as featured on featured.gallery_entry_id = gallery.id
    join artisan.featured_collections as curated on curated.slug = featured.collection_slug
    where link.post_id = p_post_id and gallery.status = 'published'
      and curated.status = 'published'
      and (curated.starts_at is null or curated.starts_at <= pg_catalog.now())
      and (curated.ends_at is null or curated.ends_at > pg_catalog.now())
      and featured.starts_at <= pg_catalog.now()
      and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
  ) as collection;
$$;
alter function private.artisan_public_post_collection_slugs(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_post_collection_slugs(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_public_artwork_card(p_artwork_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pg_catalog.jsonb_build_object(
    'kind', 'artwork', 'artworkId', artwork.id, 'slug', artwork.slug,
    'title', artwork.title,
    'descriptionExcerpt', case when artwork.description is null then null
      else pg_catalog.left(artwork.description, 500) end,
    'creationMethod', artwork.creation_method,
    'creditLine', artwork.credit_line, 'licenseCode', artwork.license_code,
    'altText', artwork.alt_text, 'contentWarnings', artwork.content_warnings,
    'tags', artwork.tags,
    'mediaKinds', private.artisan_public_media_kinds(artwork.id),
    'mediaPreview', private.artisan_public_media_card(artwork.id),
    'challenges', private.artisan_public_artwork_challenges(artwork.id),
    'collectionSlugs', private.artisan_public_collection_slugs(artwork.id),
    'publishedAt', artwork.published_at,
    'artist', pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name,
      'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
    )
  ) from artisan.artworks as artwork
  join private.community_safe_public_profile_cards as card
    on card.user_id = artwork.owner_user_id
  where artwork.id = p_artwork_id and artwork.status = 'published'
    and artwork.moderation_status = 'approved'), '{}'::jsonb);
$$;
alter function private.artisan_public_artwork_card(uuid) owner to postgres;
revoke all privileges on function private.artisan_public_artwork_card(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.artisan_discovery_core(
  p_actor_user_id uuid,
  p_kind text,
  p_query text,
  p_tags text[],
  p_creation_method text,
  p_media_kind text,
  p_challenge_slug text,
  p_collection_slug text,
  p_limit integer,
  p_cursor_published_at timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_tags text[] := coalesce(p_tags, '{}'::text[]);
  v_query_pattern text := case when p_query is null then null else '%' ||
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
      p_query, E'\\', E'\\\\'
    ), '%', E'\\%'), '_', E'\\_') || '%' end;
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if p_kind not in ('forum','artwork')
     or (p_query is not null and pg_catalog.char_length(p_query) not between 1 and 100)
     or not private.artisan_discovery_tags_are_valid(v_tags)
     or (p_creation_method is not null and p_creation_method not in (
       'human_created','ai_assisted','ai_generated_human_directed',
       'hybrid_mixed_process','procedural_generative'
     ))
     or (p_media_kind is not null and p_media_kind not in (
       'image','audio','video','document','animation','model_3d','interactive'
     ))
     or (p_challenge_slug is not null and p_challenge_slug !~ '^[a-z0-9][a-z0-9-]{2,119}$')
     or (p_collection_slug is not null and p_collection_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$')
     or ((p_cursor_published_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'artisan_discovery_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;

  if p_kind = 'forum' then
    with selected as (
      select post.*, card.handle, card.display_name, card.avatar_url,
        card.canonical_profile_url
      from artisan.forum_posts as post
      join private.community_safe_public_profile_cards as card
        on card.user_id = post.owner_user_id
      where post.status = 'published' and post.moderation_status = 'approved'
        and (p_actor_user_id is null or not private.artisan_users_block_each_other(
          p_actor_user_id, post.owner_user_id
        ))
        and (p_cursor_published_at is null
          or (post.published_at, post.id) < (p_cursor_published_at, p_cursor_id))
        and (pg_catalog.cardinality(v_tags) = 0 or post.tags @> v_tags)
        and (p_query is null or post.title ilike v_query_pattern escape '\'
          or coalesce(post.artist_statement, '') ilike v_query_pattern escape '\'
          or card.handle ilike v_query_pattern escape '\'
          or coalesce(card.display_name, '') ilike v_query_pattern escape '\'
          or exists (
            select 1 from pg_catalog.unnest(post.tags) as tag
            where tag ilike v_query_pattern escape '\'
          )
          or exists (
            select 1 from artisan.post_artworks as search_link
            join artisan.artworks as search_artwork on search_artwork.id = search_link.artwork_id
            where search_link.post_id = post.id
              and (search_artwork.title ilike v_query_pattern escape '\'
                or exists (
                  select 1 from pg_catalog.unnest(search_artwork.tags) as artwork_tag
                  where artwork_tag ilike v_query_pattern escape '\'
                ))
          ))
        and (p_creation_method is null or exists (
          select 1 from artisan.post_artworks as creation_link
          join artisan.artworks as creation_artwork on creation_artwork.id = creation_link.artwork_id
          where creation_link.post_id = post.id
            and creation_artwork.status = 'published'
            and creation_artwork.moderation_status = 'approved'
            and creation_artwork.creation_method = p_creation_method
        ))
        and (p_media_kind is null or exists (
          select 1 from artisan.post_artworks as media_link
          join artisan.media_assets as media on media.artwork_id = media_link.artwork_id
          join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
          where media_link.post_id = post.id and media.processing_status = 'published'
            and media.moderation_status = 'approved'
            and adapter.media_kind = p_media_kind
        ))
        and (p_challenge_slug is null or exists (
          select 1 from artisan.post_artworks as challenge_link
          join artisan.gallery_entries as gallery on gallery.artwork_id = challenge_link.artwork_id
          join artisan.challenges as challenge on challenge.id = gallery.challenge_id
          where challenge_link.post_id = post.id and gallery.status = 'published'
            and challenge.visibility = 'public' and challenge.slug = p_challenge_slug
        ))
        and (p_collection_slug is null or exists (
          select 1 from artisan.post_artworks as collection_link
          join artisan.gallery_entries as gallery on gallery.artwork_id = collection_link.artwork_id
          join artisan.featured_entries as featured on featured.gallery_entry_id = gallery.id
          join artisan.featured_collections as collection
            on collection.slug = featured.collection_slug
          where collection_link.post_id = post.id and gallery.status = 'published'
            and collection.slug = p_collection_slug and collection.status = 'published'
            and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
            and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
            and featured.starts_at <= pg_catalog.now()
            and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
        ))
      order by post.published_at desc, post.id desc limit v_limit
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'kind', 'forum', 'postId', selected.id, 'slug', selected.slug,
      'title', selected.title, 'artistStatement', selected.artist_statement,
      'theme', selected.theme, 'tags', selected.tags,
      'commentsEnabled', selected.comments_enabled,
      'appreciationsEnabled', selected.appreciations_enabled,
      'publishedAt', selected.published_at,
      'mediaKinds', private.artisan_public_post_media_kinds(selected.id),
      'challenges', private.artisan_public_post_challenges(selected.id),
      'collectionSlugs', private.artisan_public_post_collection_slugs(selected.id),
      'artworkCount', (
        select pg_catalog.count(*) from artisan.post_artworks as link
        join artisan.artworks as artwork on artwork.id = link.artwork_id
        where link.post_id = selected.id and artwork.status = 'published'
          and artwork.moderation_status = 'approved'
      ),
      'artworkPreviews', private.artisan_public_post_artwork_previews(selected.id),
      'artist', pg_catalog.jsonb_build_object(
        'handle', selected.handle, 'displayName', selected.display_name,
        'avatarUrl', selected.avatar_url,
        'profileUrl', selected.canonical_profile_url
      )
    ) order by selected.published_at desc, selected.id desc), '[]'::jsonb)
    into v_items from selected;
  else
    with selected as (
      select artwork.id, artwork.published_at
      from artisan.artworks as artwork
      join private.community_safe_public_profile_cards as card
        on card.user_id = artwork.owner_user_id
      where artwork.status = 'published' and artwork.moderation_status = 'approved'
        and (p_actor_user_id is null or not private.artisan_users_block_each_other(
          p_actor_user_id, artwork.owner_user_id
        ))
        and (p_cursor_published_at is null
          or (artwork.published_at, artwork.id) < (p_cursor_published_at, p_cursor_id))
        and (pg_catalog.cardinality(v_tags) = 0 or artwork.tags @> v_tags)
        and (p_query is null or artwork.title ilike v_query_pattern escape '\'
          or coalesce(artwork.description, '') ilike v_query_pattern escape '\'
          or coalesce(artwork.artist_statement, '') ilike v_query_pattern escape '\'
          or card.handle ilike v_query_pattern escape '\'
          or coalesce(card.display_name, '') ilike v_query_pattern escape '\'
          or exists (
            select 1 from pg_catalog.unnest(artwork.tags) as tag
            where tag ilike v_query_pattern escape '\'
          ))
        and (p_creation_method is null or artwork.creation_method = p_creation_method)
        and (p_media_kind is null or exists (
          select 1 from artisan.media_assets as media
          join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
          where media.artwork_id = artwork.id and media.processing_status = 'published'
            and media.moderation_status = 'approved'
            and adapter.media_kind = p_media_kind
        ))
        and (p_challenge_slug is null or exists (
          select 1 from artisan.gallery_entries as gallery
          join artisan.challenges as challenge on challenge.id = gallery.challenge_id
          where gallery.artwork_id = artwork.id and gallery.status = 'published'
            and challenge.visibility = 'public' and challenge.slug = p_challenge_slug
        ))
        and (p_collection_slug is null or exists (
          select 1 from artisan.gallery_entries as gallery
          join artisan.featured_entries as featured on featured.gallery_entry_id = gallery.id
          join artisan.featured_collections as collection
            on collection.slug = featured.collection_slug
          where gallery.artwork_id = artwork.id and gallery.status = 'published'
            and collection.slug = p_collection_slug and collection.status = 'published'
            and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
            and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
            and featured.starts_at <= pg_catalog.now()
            and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
        ))
      order by artwork.published_at desc, artwork.id desc limit v_limit
    )
    select coalesce(pg_catalog.jsonb_agg(
      private.artisan_public_artwork_card(selected.id)
      order by selected.published_at desc, selected.id desc
    ), '[]'::jsonb) into v_items from selected;
  end if;

  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'publishedAt', v_last -> 'publishedAt',
      'id', case p_kind when 'forum' then v_last -> 'postId'
        else v_last -> 'artworkId' end
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function private.artisan_discovery_core(uuid, text, text, text[], text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function private.artisan_discovery_core(uuid, text, text, text[], text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_public_discovery(
  p_kind text, p_query text, p_tags text[], p_creation_method text,
  p_media_kind text, p_challenge_slug text, p_collection_slug text,
  p_limit integer, p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.artisan_discovery_core(
    null, p_kind, p_query, p_tags, p_creation_method, p_media_kind,
    p_challenge_slug, p_collection_slug, p_limit,
    p_cursor_published_at, p_cursor_id
  );
$$;
alter function public.artisan_public_discovery(text, text, text[], text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_discovery(text, text, text[], text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_discovery(text, text, text[], text, text, text, text, integer, timestamptz, uuid)
  to anon, authenticated, service_role;

create or replace function public.artisan_member_discovery(
  p_actor_user_id uuid, p_kind text, p_query text, p_tags text[],
  p_creation_method text, p_media_kind text, p_challenge_slug text,
  p_collection_slug text, p_limit integer,
  p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  return private.artisan_discovery_core(
    p_actor_user_id, p_kind, p_query, p_tags, p_creation_method, p_media_kind,
    p_challenge_slug, p_collection_slug, p_limit,
    p_cursor_published_at, p_cursor_id
  );
end;
$$;
alter function public.artisan_member_discovery(uuid, text, text, text[], text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_discovery(uuid, text, text, text[], text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_discovery(uuid, text, text, text[], text, text, text, text, integer, timestamptz, uuid)
  to service_role;

create or replace function private.artisan_gallery_discovery_core(
  p_actor_user_id uuid,
  p_kind text,
  p_challenge_slug text,
  p_year integer,
  p_media_kind text,
  p_artist_handle text,
  p_collection_slug text,
  p_limit integer,
  p_cursor_published_at timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if p_kind not in ('winner','all_entries','featured')
     or (p_challenge_slug is not null and p_challenge_slug !~ '^[a-z0-9][a-z0-9-]{2,119}$')
     or (p_year is not null and p_year not between 2000 and 2200)
     or (p_media_kind is not null and p_media_kind not in (
       'image','audio','video','document','animation','model_3d','interactive'
     ))
     or (p_artist_handle is not null and p_artist_handle !~
       '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$')
     or (p_collection_slug is not null and p_collection_slug !~
       '^[a-z0-9][a-z0-9-]{2,79}$')
     or ((p_cursor_published_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'artisan_gallery_discovery_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;
  with selected as (
    select gallery.*, artwork.slug as artwork_slug, artwork.title,
      artwork.owner_user_id, card.handle, card.display_name, card.avatar_url,
      card.canonical_profile_url,
      challenge.slug as challenge_slug, challenge.title as challenge_title,
      award.award_type
    from artisan.gallery_entries as gallery
    join artisan.artworks as artwork on artwork.id = gallery.artwork_id
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    left join artisan.challenges as challenge on challenge.id = gallery.challenge_id
    left join artisan.challenge_awards as award on award.id = gallery.award_id
    where gallery.gallery_kind = p_kind and gallery.status = 'published'
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
      and (gallery.challenge_id is null or (
        challenge.visibility = 'public' and challenge.published_at is not null
        and challenge.status <> 'cancelled'
      ))
      and (gallery.award_id is null or award.status = 'published')
      and (p_actor_user_id is null or not private.artisan_users_block_each_other(
        p_actor_user_id, artwork.owner_user_id
      ))
      and (p_cursor_published_at is null
        or (gallery.published_at, gallery.id) < (p_cursor_published_at, p_cursor_id))
      and (p_challenge_slug is null or challenge.slug = p_challenge_slug)
      and (p_year is null or pg_catalog.date_part('year', gallery.published_at)::integer = p_year)
      and (p_media_kind is null or exists (
        select 1 from artisan.media_assets as media
        join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
        where media.artwork_id = artwork.id and media.processing_status = 'published'
          and media.moderation_status = 'approved'
          and adapter.media_kind = p_media_kind
      ))
      and (p_artist_handle is null or card.handle = p_artist_handle)
      and (p_collection_slug is null or exists (
        select 1 from artisan.featured_entries as featured
        join artisan.featured_collections as collection
          on collection.slug = featured.collection_slug
        where featured.gallery_entry_id = gallery.id
          and collection.slug = p_collection_slug and collection.status = 'published'
          and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
          and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
          and featured.starts_at <= pg_catalog.now()
          and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
      ))
    order by gallery.published_at desc, gallery.id desc limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'galleryEntryId', selected.id, 'galleryKind', selected.gallery_kind,
    'artworkId', selected.artwork_id, 'artworkSlug', selected.artwork_slug,
    'title', selected.title, 'creditLine', selected.frozen_credit_line,
    'profileUrl', selected.canonical_profile_url,
    'creationMethod', selected.frozen_creation_method,
    'licenseCode', selected.frozen_license_code,
    'accessibleDescription', selected.accessible_description,
    'awardType', selected.award_type,
    'challenge', case when selected.challenge_id is null then null else
      pg_catalog.jsonb_build_object(
        'challengeId', selected.challenge_id,
        'slug', selected.challenge_slug, 'title', selected.challenge_title
      ) end,
    'year', pg_catalog.date_part('year', selected.published_at)::integer,
    'mediaKinds', private.artisan_public_media_kinds(selected.artwork_id),
    'mediaPreview', private.artisan_public_media_card(selected.artwork_id),
    'collectionSlugs', private.artisan_public_collection_slugs(selected.artwork_id),
    'artist', pg_catalog.jsonb_build_object(
      'handle', selected.handle, 'displayName', selected.display_name,
      'avatarUrl', selected.avatar_url,
      'profileUrl', selected.canonical_profile_url
    ),
    'publishedAt', selected.published_at
  ) order by selected.published_at desc, selected.id desc), '[]'::jsonb)
  into v_items from selected;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'publishedAt', v_last -> 'publishedAt',
      'id', v_last -> 'galleryEntryId'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function private.artisan_gallery_discovery_core(uuid, text, text, integer, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function private.artisan_gallery_discovery_core(uuid, text, text, integer, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_public_gallery_discovery(
  p_kind text, p_challenge_slug text, p_year integer, p_media_kind text,
  p_artist_handle text, p_collection_slug text, p_limit integer,
  p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.artisan_gallery_discovery_core(
    null, p_kind, p_challenge_slug, p_year, p_media_kind,
    p_artist_handle, p_collection_slug, p_limit,
    p_cursor_published_at, p_cursor_id
  );
$$;
alter function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, integer, timestamptz, uuid)
  to anon, authenticated, service_role;

create or replace function public.artisan_member_gallery_discovery(
  p_actor_user_id uuid, p_kind text, p_challenge_slug text, p_year integer,
  p_media_kind text, p_artist_handle text, p_collection_slug text,
  p_limit integer, p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  return private.artisan_gallery_discovery_core(
    p_actor_user_id, p_kind, p_challenge_slug, p_year, p_media_kind,
    p_artist_handle, p_collection_slug, p_limit,
    p_cursor_published_at, p_cursor_id
  );
end;
$$;
alter function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, integer, timestamptz, uuid)
  to service_role;

create or replace function public.artisan_public_featured_collections(
  p_limit integer,
  p_cursor_published_at timestamptz,
  p_cursor_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if ((p_cursor_published_at is null) <> (p_cursor_slug is null))
     or (p_cursor_slug is not null and p_cursor_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$') then
    raise exception using errcode = '22023', message = 'artisan_featured_collection_query_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;
  with selected as (
    select collection.* from artisan.featured_collections as collection
    where collection.status = 'published'
      and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
      and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
      and (p_cursor_published_at is null
        or (collection.published_at, collection.slug) <
          (p_cursor_published_at, p_cursor_slug))
    order by collection.published_at desc, collection.slug desc limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'slug', selected.slug, 'title', selected.title,
    'description', selected.description, 'startsAt', selected.starts_at,
    'endsAt', selected.ends_at, 'publishedAt', selected.published_at
  ) order by selected.published_at desc, selected.slug desc), '[]'::jsonb)
  into v_items from selected;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'publishedAt', v_last -> 'publishedAt', 'slug', v_last -> 'slug'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function public.artisan_public_featured_collections(integer, timestamptz, text) owner to postgres;
revoke all privileges on function public.artisan_public_featured_collections(integer, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_featured_collections(integer, timestamptz, text)
  to anon, authenticated, service_role;

create or replace function public.artisan_staff_upsert_featured_collection(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing artisan.featured_collections%rowtype;
  v_collection artisan.featured_collections%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'artisan_gallery_manage'
  );
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''))) not between 2 and 160
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_description, ''))) not between 8 and 2000
     or p_status not in ('draft','published','archived')
     or (p_ends_at is not null and (p_starts_at is null or p_ends_at <= p_starts_at))
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'artisan_featured_collection_invalid';
  end if;
  select * into v_existing from artisan.featured_collections
  where slug = p_slug for update;
  if (v_existing.slug is null and p_status = 'archived')
     or (v_existing.status = 'archived' and p_status <> 'archived') then
    raise exception using errcode = '55000', message = 'artisan_featured_collection_transition_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_featured_collection_upserted',
    pg_catalog.jsonb_build_object(
      'slug', p_slug, 'title', pg_catalog.btrim(p_title),
      'description', pg_catalog.btrim(p_description), 'status', p_status,
      'startsAt', p_starts_at, 'endsAt', p_ends_at,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  insert into artisan.featured_collections(
    slug, title, description, status, starts_at, ends_at,
    published_at, archived_at, curated_by
  ) values (
    p_slug, pg_catalog.btrim(p_title), pg_catalog.btrim(p_description),
    p_status, p_starts_at, p_ends_at,
    case when p_status = 'published' then pg_catalog.now() else null end,
    case when p_status = 'archived' then pg_catalog.now() else null end,
    p_actor_user_id
  ) on conflict (slug) do update set
    title = excluded.title, description = excluded.description,
    status = excluded.status, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    published_at = case
      when excluded.status in ('published','archived')
        then coalesce(artisan.featured_collections.published_at, pg_catalog.now())
      else null end,
    archived_at = case when excluded.status = 'archived'
      then coalesce(artisan.featured_collections.archived_at, pg_catalog.now())
      else null end,
    curated_by = p_actor_user_id, updated_at = pg_catalog.now()
  returning * into v_collection;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_gallery_manage',
    'artisan_featured_collection_upserted', 'artisan_featured_collection',
    p_client_request_id, pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object('slug', v_collection.slug, 'status', v_collection.status)
  );
  v_response := pg_catalog.jsonb_build_object(
    'slug', v_collection.slug, 'title', v_collection.title,
    'description', v_collection.description, 'status', v_collection.status,
    'startsAt', v_collection.starts_at, 'endsAt', v_collection.ends_at,
    'publishedAt', v_collection.published_at, 'archivedAt', v_collection.archived_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;
alter function public.artisan_staff_upsert_featured_collection(uuid, text, uuid, text, text, text, text, timestamptz, timestamptz, text) owner to postgres;
revoke all privileges on function public.artisan_staff_upsert_featured_collection(uuid, text, uuid, text, text, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_upsert_featured_collection(uuid, text, uuid, text, text, text, text, timestamptz, timestamptz, text)
  to service_role;

create or replace function public.artisan_staff_set_featured_entry(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_collection_slug text,
  p_gallery_entry_id uuid,
  p_display_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_enabled boolean,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry artisan.featured_entries%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  perform private.require_community_operator(
    p_actor_user_id, p_actor_aal, 'artisan_gallery_manage'
  );
  if p_collection_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
     or p_gallery_entry_id is null or p_display_order not between 0 and 10000
     or p_starts_at is null
     or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or p_enabled is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_private_reason, ''))) not between 8 and 2000
     or not exists (
       select 1 from artisan.featured_collections as collection
       where collection.slug = p_collection_slug and collection.status <> 'archived'
     )
     or not exists (
       select 1 from artisan.gallery_entries as gallery
       join artisan.artworks as artwork on artwork.id = gallery.artwork_id
       join private.community_safe_public_profile_cards as card
         on card.user_id = artwork.owner_user_id
       left join artisan.challenges as challenge on challenge.id = gallery.challenge_id
       left join artisan.challenge_awards as award on award.id = gallery.award_id
       where gallery.id = p_gallery_entry_id and gallery.status = 'published'
         and artwork.status = 'published' and artwork.moderation_status = 'approved'
         and (gallery.challenge_id is null or (
           challenge.visibility = 'public' and challenge.published_at is not null
           and challenge.status <> 'cancelled'
         ))
         and (gallery.award_id is null or award.status = 'published')
     ) then
    raise exception using errcode = '22023', message = 'artisan_featured_entry_invalid';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'artisan_featured_entry_set',
    pg_catalog.jsonb_build_object(
      'collectionSlug', p_collection_slug, 'galleryEntryId', p_gallery_entry_id,
      'displayOrder', p_display_order, 'startsAt', p_starts_at,
      'endsAt', p_ends_at, 'enabled', p_enabled,
      'privateReason', pg_catalog.btrim(p_private_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;
  if p_enabled then
    insert into artisan.featured_entries(
      gallery_entry_id, collection_slug, display_order, starts_at,
      ends_at, curated_by, curation_reason
    ) values (
      p_gallery_entry_id, p_collection_slug, p_display_order, p_starts_at,
      p_ends_at, p_actor_user_id, pg_catalog.btrim(p_private_reason)
    ) on conflict (collection_slug, gallery_entry_id) do update set
      display_order = excluded.display_order, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, curated_by = excluded.curated_by,
      curation_reason = excluded.curation_reason
    returning * into v_entry;
  else
    delete from artisan.featured_entries
    where collection_slug = p_collection_slug
      and gallery_entry_id = p_gallery_entry_id
    returning * into v_entry;
  end if;
  insert into private.community_audit_events(
    actor_user_id, actor_kind, capability, action, target_type, target_id,
    request_id, private_reason, metadata
  ) values (
    p_actor_user_id, 'staff', 'artisan_gallery_manage',
    case when p_enabled then 'artisan_featured_entry_enabled'
      else 'artisan_featured_entry_disabled' end,
    'artisan_gallery_entry', p_gallery_entry_id, p_client_request_id,
    pg_catalog.btrim(p_private_reason),
    pg_catalog.jsonb_build_object(
      'collectionSlug', p_collection_slug, 'displayOrder', p_display_order
    )
  );
  v_response := pg_catalog.jsonb_build_object(
    'collectionSlug', p_collection_slug, 'galleryEntryId', p_gallery_entry_id,
    'enabled', p_enabled, 'displayOrder', p_display_order,
    'startsAt', p_starts_at, 'endsAt', p_ends_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;
alter function public.artisan_staff_set_featured_entry(uuid, text, uuid, text, uuid, integer, timestamptz, timestamptz, boolean, text) owner to postgres;
revoke all privileges on function public.artisan_staff_set_featured_entry(uuid, text, uuid, text, uuid, integer, timestamptz, timestamptz, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_staff_set_featured_entry(uuid, text, uuid, text, uuid, integer, timestamptz, timestamptz, boolean, text)
  to service_role;

-- Bound every public artwork payload even if a future processing worker tries
-- to publish more derivatives than the public contract can safely return.
create or replace function private.artisan_public_media_payload_budget_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artwork_id uuid := case when tg_op = 'DELETE' then old.artwork_id else new.artwork_id end;
  v_count integer;
  v_text_bytes bigint;
begin
  select pg_catalog.count(*), coalesce(pg_catalog.sum(
    pg_catalog.octet_length(media.accessibility_description)
    + pg_catalog.octet_length(coalesce(media.transcript, ''))
    + pg_catalog.octet_length(coalesce(media.audio_description, ''))
    + pg_catalog.octet_length(coalesce(media.keyboard_instructions, ''))
    + pg_catalog.octet_length(coalesce(media.static_equivalent_description, ''))
    + pg_catalog.octet_length(media.caption_tracks::text)
  ), 0)
  into v_count, v_text_bytes
  from artisan.media_assets as media
  where media.artwork_id = v_artwork_id
    and media.processing_status = 'published'
    and media.moderation_status = 'approved';
  if v_count > 12 or v_text_bytes > 300000 then
    raise exception using errcode = '54000',
      message = 'artisan_public_media_payload_budget_exceeded';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
alter function private.artisan_public_media_payload_budget_guard() owner to postgres;
revoke all privileges on function private.artisan_public_media_payload_budget_guard()
  from public, anon, authenticated, service_role;

create trigger artisan_media_public_payload_budget_on_write
after insert or delete on artisan.media_assets for each row
execute function private.artisan_public_media_payload_budget_guard();
create trigger artisan_media_public_payload_budget_on_update
after update of artwork_id, processing_status, moderation_status,
  accessibility_description, transcript, audio_description,
  keyboard_instructions, static_equivalent_description, caption_tracks
on artisan.media_assets for each row
execute function private.artisan_public_media_payload_budget_guard();

-- Final bounded artwork detail contract. Full accessibility presentations are
-- limited to twelve and protected by the aggregate payload budget above.
create or replace function public.artisan_public_artwork(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'artworkId', artwork.id, 'slug', artwork.slug, 'title', artwork.title,
      'description', artwork.description, 'artistStatement', artwork.artist_statement,
      'creationMethod', artwork.creation_method,
      'humanContributionNote', artwork.human_contribution_note,
      'creditLine', artwork.credit_line, 'licenseCode', artwork.license_code,
      'downloadAllowed', artwork.download_allowed, 'altText', artwork.alt_text,
      'contentWarnings', artwork.content_warnings, 'tags', artwork.tags,
      'publishedAt', artwork.published_at,
      'artist', pg_catalog.jsonb_build_object(
        'handle', card.handle, 'displayName', card.display_name,
        'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
      ),
      'credits', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'creditedName', credit.credited_name,
          'creditedHandle', collaborator.handle,
          'profileUrl', collaborator.canonical_profile_url,
          'role', credit.role, 'displayOrder', credit.display_order,
          'confirmationStatus', credit.confirmation_status
        ) order by credit.display_order, credit.id)
        from artisan.artwork_credits as credit
        left join private.community_safe_public_profile_cards as collaborator
          on collaborator.user_id = credit.credited_user_id
         and credit.confirmation_status = 'confirmed'
        where credit.artwork_id = artwork.id
          and credit.confirmation_status in ('not_required','confirmed')
      ), '[]'::jsonb),
      'license', (
        select pg_catalog.jsonb_build_object(
          'licenseCode', license.license_code, 'documentKey', license.document_key,
          'documentVersion', license.document_version,
          'contentSha256', license.content_sha256, 'scope', license.scope,
          'acceptedAt', license.accepted_at
        ) from artisan.artwork_licenses as license
        where license.artwork_id = artwork.id and license.terminated_at is null
        order by license.accepted_at desc limit 1
      ),
      'media', private.artisan_public_media_presentations(artwork.id),
      'challenges', private.artisan_public_artwork_challenges(artwork.id),
      'collectionSlugs', private.artisan_public_collection_slugs(artwork.id)
    )
    from artisan.artworks as artwork
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    where artwork.slug = pg_catalog.lower(p_slug)
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;
alter function public.artisan_public_artwork(text) owner to postgres;
revoke all privileges on function public.artisan_public_artwork(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_artwork(text)
  to anon, authenticated, service_role;

-- Appreciation state is private to the current actor. No aggregate count or
-- ranking signal is returned for either posts or artworks.
create or replace function public.artisan_current_user_appreciation_state(
  p_actor_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
  v_enabled boolean := true;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  if p_target_type = 'post' then
    select post.owner_user_id, post.appreciations_enabled
    into v_owner_user_id, v_enabled
    from artisan.forum_posts as post
    where post.id = p_target_id and post.status = 'published'
      and post.moderation_status = 'approved';
  elsif p_target_type = 'artwork' then
    select artwork.owner_user_id into v_owner_user_id
    from artisan.artworks as artwork
    where artwork.id = p_target_id and artwork.status = 'published'
      and artwork.moderation_status = 'approved';
  else
    raise exception using errcode = '22023', message = 'artisan_appreciation_target_invalid';
  end if;
  if v_owner_user_id is null or not v_enabled
     or private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id) then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'targetType', p_target_type, 'targetId', p_target_id,
    'appreciated', exists (
      select 1 from artisan.appreciations as appreciation
      where appreciation.user_id = p_actor_user_id
        and appreciation.target_type = p_target_type
        and appreciation.target_id = p_target_id
    )
  );
end;
$$;
alter function public.artisan_current_user_appreciation_state(uuid, text, uuid) owner to postgres;
revoke all privileges on function public.artisan_current_user_appreciation_state(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_appreciation_state(uuid, text, uuid)
  to service_role;

create or replace function public.artisan_current_user_appreciation(
  p_actor_user_id uuid,
  p_post_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when state = '{}'::jsonb then state else
    pg_catalog.jsonb_build_object(
      'postId', p_post_id, 'appreciated', state -> 'appreciated'
    ) end
  from (select public.artisan_current_user_appreciation_state(
    p_actor_user_id, 'post', p_post_id
  ) as state) as current_state;
$$;
alter function public.artisan_current_user_appreciation(uuid, uuid) owner to postgres;
revoke all privileges on function public.artisan_current_user_appreciation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_current_user_appreciation(uuid, uuid)
  to service_role;

create or replace function public.artisan_member_artwork(
  p_actor_user_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_artwork jsonb;
  v_artwork_id uuid;
  v_owner_user_id uuid;
  v_state jsonb;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select artwork.id, artwork.owner_user_id into v_artwork_id, v_owner_user_id
  from artisan.artworks as artwork
  where artwork.slug = pg_catalog.lower(p_slug) and artwork.status = 'published'
    and artwork.moderation_status = 'approved';
  if v_artwork_id is null
     or private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id) then
    return '{}'::jsonb;
  end if;
  v_artwork := public.artisan_public_artwork(p_slug);
  if v_artwork = '{}'::jsonb then return v_artwork; end if;
  v_state := public.artisan_current_user_appreciation_state(
    p_actor_user_id, 'artwork', v_artwork_id
  );
  return v_artwork || pg_catalog.jsonb_build_object(
    'currentActor', pg_catalog.jsonb_build_object(
      'appreciated', coalesce((v_state ->> 'appreciated')::boolean, false)
    )
  );
end;
$$;
alter function public.artisan_member_artwork(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_member_artwork(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_artwork(uuid, text) to service_role;

-- Comments are a separate bounded stream. A member projection also excludes
-- comments from either side of a block relationship.
create or replace function private.artisan_post_comments_core(
  p_actor_user_id uuid,
  p_slug text,
  p_limit integer,
  p_cursor_created_at timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_post_id uuid;
  v_owner_user_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if ((p_cursor_created_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'artisan_comment_cursor_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'postId', null, 'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;
  select post.id, post.owner_user_id into v_post_id, v_owner_user_id
  from artisan.forum_posts as post
  where post.slug = pg_catalog.lower(p_slug) and post.status = 'published'
    and post.moderation_status = 'approved' and post.comments_enabled;
  if v_post_id is null or (p_actor_user_id is not null
     and private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id)) then
    return pg_catalog.jsonb_build_object(
      'postId', v_post_id, 'items', v_items, 'nextCursor', null, 'enabled', true
    );
  end if;
  with selected as (
    select comment.*, commenter.handle, commenter.display_name,
      commenter.avatar_url, commenter.canonical_profile_url
    from artisan.comments as comment
    join private.community_safe_public_profile_cards as commenter
      on commenter.user_id = comment.user_id
    where comment.post_id = v_post_id
      and comment.status in ('published','edited')
      and comment.moderation_status = 'approved'
      and (p_actor_user_id is null or not private.artisan_users_block_each_other(
        p_actor_user_id, comment.user_id
      ))
      and (p_cursor_created_at is null
        or (comment.created_at, comment.id) > (p_cursor_created_at, p_cursor_id))
    order by comment.created_at, comment.id limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'commentId', selected.id, 'parentCommentId', selected.parent_comment_id,
    'depth', selected.depth, 'body', selected.body, 'status', selected.status,
    'createdAt', selected.created_at, 'editedAt', selected.edited_at,
    'author', pg_catalog.jsonb_build_object(
      'handle', selected.handle, 'displayName', selected.display_name,
      'avatarUrl', selected.avatar_url,
      'profileUrl', selected.canonical_profile_url
    )
  ) order by selected.created_at, selected.id), '[]'::jsonb)
  into v_items from selected;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'createdAt', v_last -> 'createdAt', 'id', v_last -> 'commentId'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'postId', v_post_id, 'items', v_items,
    'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function private.artisan_post_comments_core(uuid, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function private.artisan_post_comments_core(uuid, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_public_post_comments(
  p_slug text, p_limit integer,
  p_cursor_created_at timestamptz, p_cursor_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.artisan_post_comments_core(
    null, p_slug, p_limit, p_cursor_created_at, p_cursor_id
  );
$$;
alter function public.artisan_public_post_comments(text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_post_comments(text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_post_comments(text, integer, timestamptz, uuid)
  to anon, authenticated, service_role;

create or replace function public.artisan_member_post_comments(
  p_actor_user_id uuid, p_slug text, p_limit integer,
  p_cursor_created_at timestamptz, p_cursor_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  return private.artisan_post_comments_core(
    p_actor_user_id, p_slug, p_limit, p_cursor_created_at, p_cursor_id
  );
end;
$$;
alter function public.artisan_member_post_comments(uuid, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_post_comments(uuid, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_post_comments(uuid, text, integer, timestamptz, uuid)
  to service_role;

create or replace function public.artisan_public_post(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.community_feature_enabled('artisan_public_database_reads') then coalesce((
    select pg_catalog.jsonb_build_object(
      'postId', post.id, 'slug', post.slug, 'title', post.title,
      'artistStatement', post.artist_statement, 'theme', post.theme,
      'tags', post.tags, 'commentsEnabled', post.comments_enabled,
      'appreciationsEnabled', post.appreciations_enabled,
      'slowModeSeconds', post.slow_mode_seconds, 'publishedAt', post.published_at,
      'artist', pg_catalog.jsonb_build_object(
        'handle', card.handle, 'displayName', card.display_name,
        'avatarUrl', card.avatar_url, 'profileUrl', card.canonical_profile_url
      ),
      'artworks', private.artisan_public_post_artworks(post.id),
      'commentsPage', private.artisan_post_comments_core(
        null, post.slug, 20, null, null
      )
    )
    from artisan.forum_posts as post
    join private.community_safe_public_profile_cards as card
      on card.user_id = post.owner_user_id
    where post.slug = pg_catalog.lower(p_slug)
      and post.status = 'published' and post.moderation_status = 'approved'
  ), '{}'::jsonb) else '{}'::jsonb end;
$$;
alter function public.artisan_public_post(text) owner to postgres;
revoke all privileges on function public.artisan_public_post(text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_post(text)
  to anon, authenticated, service_role;

create or replace function public.artisan_member_post(
  p_actor_user_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_post jsonb;
  v_post_id uuid;
  v_owner_user_id uuid;
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  select post.id, post.owner_user_id into v_post_id, v_owner_user_id
  from artisan.forum_posts as post
  where post.slug = pg_catalog.lower(p_slug) and post.status = 'published'
    and post.moderation_status = 'approved';
  if v_post_id is null
     or private.artisan_users_block_each_other(p_actor_user_id, v_owner_user_id) then
    return '{}'::jsonb;
  end if;
  v_post := public.artisan_public_post(p_slug);
  if v_post = '{}'::jsonb then return v_post; end if;
  return (v_post - 'commentsPage') || pg_catalog.jsonb_build_object(
    'commentsPage', private.artisan_post_comments_core(
      p_actor_user_id, p_slug, 20, null, null
    ),
    'currentActor', pg_catalog.jsonb_build_object(
      'appreciated', exists (
        select 1 from artisan.appreciations as appreciation
        where appreciation.user_id = p_actor_user_id
          and appreciation.target_type = 'post'
          and appreciation.target_id = v_post_id
      )
    )
  );
end;
$$;
alter function public.artisan_member_post(uuid, text) owner to postgres;
revoke all privileges on function public.artisan_member_post(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_post(uuid, text) to service_role;

-- Public challenge pagination uses the same deterministic two-column cursor as
-- forum, artwork, gallery, and comment streams.
create or replace function public.artisan_public_challenge_discovery(
  p_limit integer,
  p_cursor_published_at timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if ((p_cursor_published_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'artisan_challenge_cursor_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;
  with selected as (
    select challenge.* from artisan.challenges as challenge
    where challenge.published_at is not null
      and challenge.status not in ('draft','cancelled')
      and challenge.visibility = 'public'
      and (p_cursor_published_at is null
        or (challenge.published_at, challenge.id) <
          (p_cursor_published_at, p_cursor_id))
    order by challenge.published_at desc, challenge.id desc limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'challengeId', selected.id, 'slug', selected.slug, 'title', selected.title,
    'shortPrompt', selected.short_prompt, 'purpose', selected.purpose,
    'sponsorName', selected.sponsor_name, 'licenseSummary', selected.license_summary,
    'visibility', selected.visibility, 'status', selected.status,
    'opensAt', selected.opens_at, 'deadlineAt', selected.deadline_at,
    'timezone', selected.timezone,
    'maximumEntriesPerArtist', selected.maximum_entries_per_artist,
    'selectionMethod', selected.selection_method,
    'judgingRubricVersion', selected.judging_rubric_version,
    'creationMethodPolicy', selected.creation_method_policy,
    'publishedAt', selected.published_at
  ) order by selected.published_at desc, selected.id desc), '[]'::jsonb)
  into v_items from selected;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'publishedAt', v_last -> 'publishedAt', 'id', v_last -> 'challengeId'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function public.artisan_public_challenge_discovery(integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_challenge_discovery(integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_challenge_discovery(integer, timestamptz, uuid)
  to anon, authenticated, service_role;

-- Final gallery discovery contract: deterministic newest/oldest pagination,
-- all required filters, bounded presentation cards, and artist statements.
create or replace function private.artisan_gallery_discovery_core(
  p_actor_user_id uuid,
  p_kind text,
  p_challenge_slug text,
  p_year integer,
  p_creation_method text,
  p_media_kind text,
  p_artist_handle text,
  p_collection_slug text,
  p_sort_direction text,
  p_limit integer,
  p_cursor_published_at timestamptz,
  p_cursor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_items jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if p_kind not in ('winner','all_entries','featured')
     or (p_challenge_slug is not null and p_challenge_slug !~ '^[a-z0-9][a-z0-9-]{2,119}$')
     or (p_year is not null and p_year not between 2000 and 2200)
     or (p_creation_method is not null and p_creation_method not in (
       'human_created','ai_assisted','ai_generated_human_directed',
       'hybrid_mixed_process','procedural_generative'
     ))
     or (p_media_kind is not null and p_media_kind not in (
       'image','audio','video','document','animation','model_3d','interactive'
     ))
     or (p_artist_handle is not null and p_artist_handle !~
       '^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$')
     or (p_collection_slug is not null and p_collection_slug !~
       '^[a-z0-9][a-z0-9-]{2,79}$')
     or coalesce(p_sort_direction, '') not in ('newest','oldest')
     or ((p_cursor_published_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'artisan_gallery_discovery_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'items', v_items, 'nextCursor', null, 'enabled', false
    );
  end if;
  with selected as (
    select gallery.*, artwork.slug as artwork_slug, artwork.title,
      artwork.artist_statement, artwork.owner_user_id,
      card.handle, card.display_name, card.avatar_url, card.canonical_profile_url,
      challenge.slug as challenge_slug, challenge.title as challenge_title,
      award.award_type
    from artisan.gallery_entries as gallery
    join artisan.artworks as artwork on artwork.id = gallery.artwork_id
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    left join artisan.challenges as challenge on challenge.id = gallery.challenge_id
    left join artisan.challenge_awards as award on award.id = gallery.award_id
    where gallery.gallery_kind = p_kind and gallery.status = 'published'
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
      and (gallery.challenge_id is null or (
        challenge.visibility = 'public' and challenge.published_at is not null
        and challenge.status <> 'cancelled'
      ))
      and (gallery.award_id is null or award.status = 'published')
      and (p_actor_user_id is null or not private.artisan_users_block_each_other(
        p_actor_user_id, artwork.owner_user_id
      ))
      and (p_cursor_published_at is null
        or (p_sort_direction = 'newest' and
          (gallery.published_at, gallery.id) < (p_cursor_published_at, p_cursor_id))
        or (p_sort_direction = 'oldest' and
          (gallery.published_at, gallery.id) > (p_cursor_published_at, p_cursor_id)))
      and (p_challenge_slug is null or challenge.slug = p_challenge_slug)
      and (p_year is null or pg_catalog.date_part('year', gallery.published_at)::integer = p_year)
      and (p_creation_method is null or gallery.frozen_creation_method = p_creation_method)
      and (p_media_kind is null or exists (
        select 1 from artisan.media_assets as media
        join artisan.media_adapters as adapter on adapter.adapter_key = media.adapter_key
        where media.artwork_id = artwork.id and media.processing_status = 'published'
          and media.moderation_status = 'approved' and adapter.media_kind = p_media_kind
      ))
      and (p_artist_handle is null or card.handle = p_artist_handle)
      and (p_collection_slug is null or exists (
        select 1 from artisan.featured_entries as featured
        join artisan.featured_collections as collection
          on collection.slug = featured.collection_slug
        where featured.gallery_entry_id = gallery.id
          and collection.slug = p_collection_slug and collection.status = 'published'
          and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
          and (collection.ends_at is null or collection.ends_at > pg_catalog.now())
          and featured.starts_at <= pg_catalog.now()
          and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
      ))
    order by
      case when p_sort_direction = 'newest' then gallery.published_at end desc,
      case when p_sort_direction = 'newest' then gallery.id end desc,
      case when p_sort_direction = 'oldest' then gallery.published_at end,
      case when p_sort_direction = 'oldest' then gallery.id end
    limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'galleryEntryId', selected.id, 'galleryKind', selected.gallery_kind,
    'artworkId', selected.artwork_id, 'artworkSlug', selected.artwork_slug,
    'title', selected.title, 'artistStatement', selected.artist_statement,
    'creditLine', selected.frozen_credit_line,
    'creationMethod', selected.frozen_creation_method,
    'licenseCode', selected.frozen_license_code,
    'accessibleDescription', selected.accessible_description,
    'awardType', selected.award_type,
    'challenge', case when selected.challenge_id is null then null else
      pg_catalog.jsonb_build_object(
        'challengeId', selected.challenge_id,
        'slug', selected.challenge_slug, 'title', selected.challenge_title
      ) end,
    'year', pg_catalog.date_part('year', selected.published_at)::integer,
    'mediaKinds', private.artisan_public_media_kinds(selected.artwork_id),
    'mediaPreview', private.artisan_public_media_card(selected.artwork_id),
    'collectionSlugs', private.artisan_public_collection_slugs(selected.artwork_id),
    'artist', pg_catalog.jsonb_build_object(
      'handle', selected.handle, 'displayName', selected.display_name,
      'avatarUrl', selected.avatar_url,
      'profileUrl', selected.canonical_profile_url
    ),
    'publishedAt', selected.published_at
  ) order by
    case when p_sort_direction = 'newest' then selected.published_at end desc,
    case when p_sort_direction = 'newest' then selected.id end desc,
    case when p_sort_direction = 'oldest' then selected.published_at end,
    case when p_sort_direction = 'oldest' then selected.id end
  ), '[]'::jsonb)
  into v_items from selected;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'publishedAt', v_last -> 'publishedAt', 'id', v_last -> 'galleryEntryId'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items, 'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function private.artisan_gallery_discovery_core(uuid, text, text, integer, text, text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function private.artisan_gallery_discovery_core(uuid, text, text, integer, text, text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.artisan_public_gallery_discovery(
  p_kind text, p_challenge_slug text, p_year integer,
  p_creation_method text, p_media_kind text, p_artist_handle text,
  p_collection_slug text, p_sort_direction text, p_limit integer,
  p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.artisan_gallery_discovery_core(
    null, p_kind, p_challenge_slug, p_year, p_creation_method, p_media_kind,
    p_artist_handle, p_collection_slug, p_sort_direction, p_limit,
    p_cursor_published_at, p_cursor_id
  );
$$;
alter function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_gallery_discovery(text, text, integer, text, text, text, text, text, integer, timestamptz, uuid)
  to anon, authenticated, service_role;

create or replace function public.artisan_member_gallery_discovery(
  p_actor_user_id uuid, p_kind text, p_challenge_slug text, p_year integer,
  p_creation_method text, p_media_kind text, p_artist_handle text,
  p_collection_slug text, p_sort_direction text, p_limit integer,
  p_cursor_published_at timestamptz, p_cursor_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.community_caller_is_service_role()
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'artisan_verified_actor_required';
  end if;
  return private.artisan_gallery_discovery_core(
    p_actor_user_id, p_kind, p_challenge_slug, p_year,
    p_creation_method, p_media_kind, p_artist_handle,
    p_collection_slug, p_sort_direction, p_limit,
    p_cursor_published_at, p_cursor_id
  );
end;
$$;
alter function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, text, text, integer, timestamptz, uuid) owner to postgres;
revoke all privileges on function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, text, text, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_member_gallery_discovery(uuid, text, text, integer, text, text, text, text, text, integer, timestamptz, uuid)
  to service_role;

create or replace function public.artisan_public_featured_collection(
  p_slug text,
  p_limit integer,
  p_cursor_display_order integer,
  p_cursor_entry_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_collection artisan.featured_collections%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_artists jsonb := '[]'::jsonb;
  v_last jsonb;
  v_next_cursor jsonb;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
     or ((p_cursor_display_order is null) <> (p_cursor_entry_id is null))
     or (p_cursor_display_order is not null
       and p_cursor_display_order not between 0 and 10000) then
    raise exception using errcode = '22023',
      message = 'artisan_featured_collection_query_invalid';
  end if;
  if not private.community_feature_enabled('artisan_public_database_reads') then
    return pg_catalog.jsonb_build_object(
      'collection', null, 'items', v_items, 'featuredArtists', v_artists,
      'nextCursor', null, 'enabled', false
    );
  end if;
  select collection.* into v_collection
  from artisan.featured_collections as collection
  where collection.slug = p_slug and collection.status = 'published'
    and (collection.starts_at is null or collection.starts_at <= pg_catalog.now())
    and (collection.ends_at is null or collection.ends_at > pg_catalog.now());
  if v_collection.slug is null then
    return pg_catalog.jsonb_build_object(
      'collection', null, 'items', v_items, 'featuredArtists', v_artists,
      'nextCursor', null, 'enabled', true
    );
  end if;
  with selected as (
    select featured.id as featured_entry_id, featured.display_order,
      gallery.id as gallery_entry_id, gallery.gallery_kind,
      artwork.id as artwork_id, artwork.slug as artwork_slug,
      artwork.title, artwork.artist_statement, artwork.creation_method,
      gallery.frozen_credit_line, gallery.frozen_creation_method,
      gallery.frozen_license_code, gallery.accessible_description,
      artwork.alt_text,
      artwork.content_warnings, artwork.tags, artwork.published_at,
      card.handle, card.display_name, card.avatar_url, card.canonical_profile_url
    from artisan.featured_entries as featured
    join artisan.gallery_entries as gallery on gallery.id = featured.gallery_entry_id
    join artisan.artworks as artwork on artwork.id = gallery.artwork_id
    join private.community_safe_public_profile_cards as card
      on card.user_id = artwork.owner_user_id
    left join artisan.challenges as challenge on challenge.id = gallery.challenge_id
    left join artisan.challenge_awards as award on award.id = gallery.award_id
    where featured.collection_slug = v_collection.slug
      and featured.starts_at <= pg_catalog.now()
      and (featured.ends_at is null or featured.ends_at > pg_catalog.now())
      and gallery.status = 'published'
      and artwork.status = 'published' and artwork.moderation_status = 'approved'
      and (gallery.challenge_id is null or (
        challenge.visibility = 'public' and challenge.published_at is not null
        and challenge.status <> 'cancelled'
      ))
      and (gallery.award_id is null or award.status = 'published')
      and (p_cursor_display_order is null or
        (featured.display_order, featured.id) >
          (p_cursor_display_order, p_cursor_entry_id))
    order by featured.display_order, featured.id limit v_limit
  ), item_projection as (
    select selected.*, pg_catalog.jsonb_build_object(
      'featuredEntryId', selected.featured_entry_id,
      'displayOrder', selected.display_order,
      'galleryEntryId', selected.gallery_entry_id,
      'galleryKind', selected.gallery_kind,
      'artworkId', selected.artwork_id, 'artworkSlug', selected.artwork_slug,
      'title', selected.title, 'artistStatement', selected.artist_statement,
      'creationMethod', selected.frozen_creation_method,
      'creditLine', selected.frozen_credit_line,
      'licenseCode', selected.frozen_license_code,
      'accessibleDescription', selected.accessible_description,
      'altText', selected.alt_text, 'contentWarnings', selected.content_warnings,
      'tags', selected.tags,
      'mediaKinds', private.artisan_public_media_kinds(selected.artwork_id),
      'mediaPreview', private.artisan_public_media_card(selected.artwork_id),
      'artist', pg_catalog.jsonb_build_object(
        'handle', selected.handle, 'displayName', selected.display_name,
        'avatarUrl', selected.avatar_url,
        'profileUrl', selected.canonical_profile_url
      ),
      'publishedAt', selected.published_at
    ) as item
    from selected
  )
  select coalesce(pg_catalog.jsonb_agg(item_projection.item
      order by item_projection.display_order, item_projection.featured_entry_id), '[]'::jsonb),
    coalesce(pg_catalog.jsonb_agg(distinct pg_catalog.jsonb_build_object(
      'handle', item_projection.handle,
      'displayName', item_projection.display_name,
      'avatarUrl', item_projection.avatar_url,
      'profileUrl', item_projection.canonical_profile_url
    )), '[]'::jsonb)
  into v_items, v_artists
  from item_projection;
  if pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_last := v_items -> -1;
    v_next_cursor := pg_catalog.jsonb_build_object(
      'displayOrder', v_last -> 'displayOrder',
      'id', v_last -> 'featuredEntryId'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'collection', pg_catalog.jsonb_build_object(
      'slug', v_collection.slug, 'title', v_collection.title,
      'description', v_collection.description,
      'startsAt', v_collection.starts_at, 'endsAt', v_collection.ends_at,
      'publishedAt', v_collection.published_at
    ),
    'items', v_items, 'featuredArtists', v_artists,
    'nextCursor', v_next_cursor, 'enabled', true
  );
end;
$$;
alter function public.artisan_public_featured_collection(text, integer, integer, uuid) owner to postgres;
revoke all privileges on function public.artisan_public_featured_collection(text, integer, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.artisan_public_featured_collection(text, integer, integer, uuid)
  to anon, authenticated, service_role;

-- Superseded timestamp-only and pre-filter overloads remain in the historical
-- migration body for reviewability, but no browser or Worker role may invoke
-- them after the deterministic composite-cursor contracts above are installed.
revoke all privileges on function public.artisan_public_feed(text, text, integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.artisan_public_gallery(text, integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.artisan_public_challenges(integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.artisan_public_gallery_discovery(
  text, text, integer, text, text, text, integer, timestamptz, uuid
) from public, anon, authenticated, service_role;
revoke all privileges on function public.artisan_member_gallery_discovery(
  uuid, text, text, integer, text, text, text, integer, timestamptz, uuid
) from public, anon, authenticated, service_role;

-- The Artisan origin mutates exclusively through strict same-origin Worker
-- parsers and explicit-actor service RPCs. These lower-level auth.uid()
-- functions remain implementation primitives for those wrappers, but a
-- publishable Supabase key cannot invoke them directly and bypass Turnstile,
-- origin checks, edge rate limits, runtime feature flags, or request schemas.
revoke execute on function public.create_current_user_artisan_membership(uuid, text) from authenticated;
revoke execute on function public.update_current_user_artisan_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time) from authenticated;
revoke execute on function public.create_current_user_artwork(uuid, text, text, text, text, text, text, text, text, text, boolean, text, text[]) from authenticated;
revoke execute on function public.update_current_user_artwork_draft(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text[]) from authenticated;
revoke execute on function public.create_current_user_artisan_post(uuid, text, text, text, jsonb, boolean, boolean, integer, uuid[]) from authenticated;
revoke execute on function public.submit_current_user_artisan_post(uuid, uuid) from authenticated;
revoke execute on function public.delete_current_user_artisan_comment(uuid, uuid) from authenticated;
revoke execute on function public.set_current_user_artisan_appreciation(uuid, text, uuid, boolean) from authenticated;
revoke execute on function public.create_current_user_challenge_submission(uuid, uuid, uuid, uuid, text, text) from authenticated;
revoke execute on function public.submit_current_user_challenge_submission(uuid, uuid) from authenticated;
revoke execute on function public.submit_current_user_artisan_appeal(uuid, uuid, uuid, uuid, text) from authenticated;
revoke execute on function public.submit_current_user_judge_conflict_disclosure(uuid, uuid, text, boolean) from authenticated;
revoke execute on function public.submit_current_user_challenge_score(uuid, uuid, uuid, text, jsonb, text) from authenticated;
revoke execute on function public.respond_current_user_artisan_award(uuid, uuid, text, text, text, text) from authenticated;
revoke execute on function public.update_current_user_artisan_post_draft(uuid, uuid, text, text, jsonb, boolean, boolean, integer, uuid[]) from authenticated;
revoke execute on function public.set_current_user_artisan_room_controls(uuid, uuid, boolean, boolean, integer) from authenticated;
revoke execute on function public.withdraw_current_user_artisan_content(uuid, text, uuid, text) from authenticated;
revoke execute on function public.withdraw_current_user_challenge_submission(uuid, uuid, text) from authenticated;
revoke execute on function public.mark_current_user_artisan_notifications_read(uuid, uuid) from authenticated;
revoke execute on function public.set_current_user_public_profile(uuid, boolean, text) from authenticated;
revoke execute on function public.accept_current_user_community_documents(uuid, jsonb, text) from authenticated;
revoke execute on function public.request_current_user_community_lifecycle_action(uuid, text, text, text) from authenticated;
revoke execute on function public.cancel_current_user_community_deletion(uuid, uuid) from authenticated;
revoke execute on function public.revoke_current_user_guardian_relationship(uuid, uuid, text) from authenticated;
revoke execute on function public.revoke_current_user_guardian_consent(uuid, uuid, text) from authenticated;
revoke execute on function public.current_user_artisan_activity(text, integer, timestamptz, uuid) from authenticated;
revoke insert, delete on table artisan.user_blocks from authenticated;

commit;

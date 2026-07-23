-- Restore the canonical Online Commons Profiles that users explicitly
-- published through the pre-shared-identity Commons onboarding flow.
begin;

-- The canonical Online Commons Profile existed before the shared Artisan
-- identity contract. Completing the old Commons onboarding flow was an explicit
-- public-profile confirmation, but 20260718010000 initialized every new
-- cross-site public card to disabled. Preserve only those pre-cutover Online
-- confirmations here. This helper never changes the shared-card publication
-- predicate, never fabricates legal or age-assurance evidence, and yields
-- permanently as soon as the owner uses the new audited publication control.
create or replace function private.community_legacy_online_profile_is_public(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(
      p_user_id, 'commons_profile_publication'
    )
    and not private.community_has_active_restriction(
      p_user_id, 'all_public_communities'
    )
    and exists (
      select 1
      from public.profiles as profile
      join private.account_participation as participation
        on participation.user_id = profile.id
      where profile.id = p_user_id
        and profile.commons_onboarding_completed_at is not null
        and profile.commons_onboarding_completed_at
          < '2026-07-18 01:00:00+00'::timestamptz
        and participation.participation_state not in (
          'restricted', 'suspended', 'blocked',
          'deletion_pending', 'deactivated'
        )
    )
    and not exists (
      select 1
      from private.profile_publication_events as event
      where event.user_id = p_user_id
    ),
    false
  );
$$;

alter function private.community_legacy_online_profile_is_public(uuid)
  owner to postgres;
revoke all privileges
  on function private.community_legacy_online_profile_is_public(uuid)
  from public, anon, authenticated, service_role;

-- This projection is for the canonical Online profile room only. The shared
-- cross-site card remains governed exclusively by
-- private.community_safe_public_profile_cards and the newer explicit
-- publication/age/legal contract.
create or replace view private.community_safe_online_public_profile_cards
with (security_barrier = true)
as
select
  card.user_id,
  card.handle,
  case when coalesce(visibility.show_display_name, true)
    then card.display_name else null end as display_name,
  card.avatar_media_id,
  card.avatar_url,
  case
    when not coalesce(visibility.show_bio, true) then null
    when private.community_legacy_online_profile_is_public(card.user_id)
      then coalesce(
        card.short_public_bio,
        nullif(pg_catalog.left(pg_catalog.btrim(profile.bio), 280), '')
      )
    else card.short_public_bio
  end as short_public_bio,
  card.canonical_profile_url,
  card.public_profile_enabled,
  card.updated_at,
  coalesce(visibility.show_display_name, true) as show_display_name,
  coalesce(visibility.show_bio, true) as show_bio
from public.profile_public_cards as card
join public.profiles as profile on profile.id = card.user_id
left join public.profile_visibility_settings as visibility
  on visibility.user_id = card.user_id
where (
  card.public_profile_enabled
  and private.community_profile_is_public(card.user_id)
)
or private.community_legacy_online_profile_is_public(card.user_id);

alter view private.community_safe_online_public_profile_cards owner to postgres;
revoke all on private.community_safe_online_public_profile_cards
  from public, anon, authenticated, service_role;

create or replace function public.get_public_commons_profile_presentation(
  p_handle text
)
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
        'headline', nullif(
          pg_catalog.left(pg_catalog.btrim(source_profile.headline), 240), ''
        ),
        'organization', nullif(
          pg_catalog.left(pg_catalog.btrim(source_profile.organization), 240), ''
        ),
        'interests', case
          when coalesce(visibility.show_interests, true)
          then nullif(
            pg_catalog.left(pg_catalog.btrim(source_profile.interests), 2000), ''
          )
          else null
        end,
        'websiteUrl', case
          when coalesce(visibility.show_website, true)
            and pg_catalog.char_length(
              pg_catalog.btrim(source_profile.website_url)
            ) <= 2048
            and pg_catalog.btrim(source_profile.website_url)
              ~ '^https?://[^\s<>"'']+$'
          then pg_catalog.btrim(source_profile.website_url)
          else null
        end,
        'githubUrl', case
          when coalesce(visibility.show_github, true)
            and pg_catalog.char_length(
              pg_catalog.btrim(source_profile.github_url)
            ) <= 2048
            and pg_catalog.btrim(source_profile.github_url)
              ~ '^https?://[^\s<>"'']+$'
          then pg_catalog.btrim(source_profile.github_url)
          else null
        end,
        'isDeveloper', (
          coalesce(visibility.show_developer_status, true)
          and source_profile.is_developer
        ),
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
        'showStewardshipRecognition',
          coalesce(visibility.show_stewardship_recognition, true),
        'showSavedAddons', coalesce(visibility.show_saved_addons, false),
        'showSavedSources', coalesce(visibility.show_saved_sources, false),
        'showSourceCollections',
          coalesce(visibility.show_source_collections, true),
        'showCommunePosts', coalesce(visibility.show_commune_posts, true),
        'showWorkWithStatus',
          coalesce(visibility.show_work_with_status, false),
        'showDeveloperStatus',
          coalesce(visibility.show_developer_status, true),
        'showMemberTier', coalesce(visibility.show_member_tier, true)
      ),
      'customization', pg_catalog.jsonb_build_object(
        'themeMode', case when customization.theme_mode = any(array[
          'deep_grove', 'starlit_archive', 'solar_meadow',
          'moonlit_reef', 'aether_blue', 'high_contrast'
        ]::text[]) then customization.theme_mode else 'starlit_archive' end,
        'accentColor', case
          when customization.accent_color ~ '^#[0-9A-Fa-f]{6}$'
            then customization.accent_color
          else '#8ee8dc'
        end,
        'backgroundStyle', case
          when customization.background_style = any(array[
            'soft_cyber_garden', 'starfield_mantle', 'living_archive',
            'clear_lantern', 'mycelium_glow', 'watershed_mist',
            'aurora_canopy', 'solar_restoration', 'obsidian_laboratory',
            'field_notebook'
          ]::text[]) then customization.background_style
          else 'soft_cyber_garden'
        end,
        'decalSet', case when customization.decal_set = any(array[
          'none', 'leaf_glyph', 'water_ripple', 'star_map',
          'mushroom_badge', 'circuit_vine', 'pollinator', 'wetland_reed',
          'moon_crest', 'robotic_seed'
        ]::text[]) then customization.decal_set else 'none' end,
        'profileLayout', case when customization.profile_layout = any(array[
          'classic_homebase', 'compact_archive', 'garden_shelves',
          'field_notebook_layout', 'constellation_map',
          'stewardship_board'
        ]::text[]) then customization.profile_layout
          else 'classic_homebase'
        end,
        'bannerZoom',
          least(greatest(coalesce(customization.banner_zoom, 1), 0.5), 2),
        'bannerPositionX',
          least(greatest(coalesce(customization.banner_position_x, 50), 0), 100),
        'bannerPositionY',
          least(greatest(coalesce(customization.banner_position_y, 50), 0), 100)
      ),
      'media', pg_catalog.jsonb_build_object(
        'avatarMediaId', card.avatar_media_id,
        'avatarUrl', card.avatar_url,
        'bannerMediaId', banner.id,
        'bannerUrl', case when banner.id is null then null
          else '/api/public/profile-banners/' || banner.id::text end
      ),
      'isOwner', coalesce(auth.uid() = card.user_id, false),
      'publicBadges', case
        when coalesce(visibility.show_badges, true) then coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'badgeKey', badge.badge_key,
            'awardedAt', badge.awarded_at,
            'awardSource', badge.award_source,
            'visibility', badge.visibility
          ) order by badge.awarded_at desc, badge.badge_key)
          from public.user_badges as badge
          where badge.user_id = card.user_id
            and badge.visibility = 'public'
            and badge.revoked_at is null
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
      'publicLinks', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'label', link.label,
            'url', link.url,
            'kind', link.kind
          )
          order by link.ordinality
        )
        from (
          select
            pg_catalog.left(
              pg_catalog.btrim(item.value ->> 'label'), 80
            ) as label,
            pg_catalog.btrim(item.value ->> 'url') as url,
            nullif(
              pg_catalog.left(
                pg_catalog.btrim(item.value ->> 'kind'), 32
              ),
              ''
            ) as kind,
            item.ordinality
          from pg_catalog.jsonb_array_elements(
            source_profile.featured_public_links
          ) with ordinality as item(value, ordinality)
          where pg_catalog.jsonb_typeof(item.value) = 'object'
            and nullif(pg_catalog.btrim(item.value ->> 'label'), '') is not null
            and pg_catalog.char_length(
              pg_catalog.btrim(item.value ->> 'url')
            ) <= 2048
            and pg_catalog.btrim(item.value ->> 'url')
              ~ '^https?://[^\s<>"'']+$'
          order by item.ordinality
          limit 8
        ) as link
      ), '[]'::jsonb),
      'publicSourceCollections', case
        when coalesce(visibility.show_source_collections, true) then coalesce((
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
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
      'publicCommunePosts', case
        when coalesce(visibility.show_commune_posts, true) then coalesce((
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
              and coalesce(
                commune_post.visibility_state, 'published'
              ) not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
              and commune_post.hidden_at is null
              and commune_post.removed_at is null
              and commune_post.archived_at is null
              and commune_post.revoked_at is null
            order by commune_post.published_at desc, commune_post.id
            limit 6
          ) as post
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
      'publicCommuneComments', case
        when coalesce(visibility.show_commune_posts, true) then coalesce((
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
              and coalesce(
                commune_comment.visibility_state, 'published'
              ) = 'published'
              and commune_comment.hidden_at is null
              and commune_comment.removed_at is null
              and commune_comment.archived_at is null
              and parent_post.status::text = 'published'
              and parent_post.visibility::text = 'public'
              and coalesce(
                parent_post.visibility_state, 'published'
              ) not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
              and parent_post.hidden_at is null
              and parent_post.removed_at is null
              and parent_post.archived_at is null
              and parent_post.revoked_at is null
            order by commune_comment.published_at desc, commune_comment.id
            limit 6
          ) as comment
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    from private.community_safe_online_public_profile_cards as card
    join public.profiles as source_profile
      on source_profile.id = card.user_id
    join private.account_participation as participation
      on participation.user_id = card.user_id
    left join public.profile_visibility_settings as visibility
      on visibility.user_id = card.user_id
    left join public.profile_customization as customization
      on customization.user_id = card.user_id
    left join lateral (
      select media.id
      from public.profile_media as media
      where media.id = customization.banner_media_id
        and media.user_id = card.user_id
        and media.media_type = 'banner'
        and media.bucket = 'profile-banners'
        and media.status = 'active'
        and media.storage_path like card.user_id::text || '/banners/%'
        and media.storage_path !~ '(^|/)\.\.(/|$)'
        and media.storage_path !~ '[\\\\]'
      limit 1
    ) as banner on true
    where card.handle = pg_catalog.lower(
      pg_catalog.ltrim(coalesce(p_handle, ''), '@')
    )
  ), '{}'::jsonb);
$$;

alter function public.get_public_commons_profile_presentation(text)
  owner to postgres;
revoke all privileges
  on function public.get_public_commons_profile_presentation(text)
  from public, anon, authenticated, service_role;
grant execute
  on function public.get_public_commons_profile_presentation(text)
  to anon, authenticated, service_role;

create or replace function public.resolve_online_public_profile_handle(
  p_handle text
)
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
    join private.community_safe_online_public_profile_cards as card
      on card.user_id = history.profile_user_id
    where history.handle = pg_catalog.lower(
      pg_catalog.ltrim(coalesce(p_handle, ''), '@')
    )
      and history.redirect_enabled
    limit 1
  ), '{}'::jsonb);
$$;

alter function public.resolve_online_public_profile_handle(text)
  owner to postgres;
revoke all privileges
  on function public.resolve_online_public_profile_handle(text)
  from public, anon, authenticated, service_role;
grant execute
  on function public.resolve_online_public_profile_handle(text)
  to anon, authenticated, service_role;

create or replace function public.get_online_public_profile_avatar_asset(
  p_media_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.community_caller_is_service_role() then coalesce((
      select pg_catalog.jsonb_build_object(
        'mediaId', media.id,
        'storageProvider', 'supabase',
        'bucket', media.bucket,
        'objectKey', media.storage_path,
        'deliveryMode', 'private_original_requires_safe_transform'
      )
      from public.profile_media as media
      join private.community_safe_online_public_profile_cards as card
        on card.avatar_media_id = media.id
      where media.id = p_media_id
        and media.user_id = card.user_id
        and media.media_type = 'avatar'
        and media.bucket = 'profile-avatars'
        and media.status = 'active'
        and media.storage_path like media.user_id::text || '/avatars/%'
        and media.storage_path !~ '(^|/)\.\.(/|$)'
        and media.storage_path !~ '[\\\\]'
    ), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;

alter function public.get_online_public_profile_avatar_asset(uuid)
  owner to postgres;
revoke all privileges
  on function public.get_online_public_profile_avatar_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute
  on function public.get_online_public_profile_avatar_asset(uuid)
  to service_role;

create or replace function public.get_online_public_profile_banner_asset(
  p_media_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.community_caller_is_service_role() then coalesce((
      select pg_catalog.jsonb_build_object(
        'mediaId', media.id,
        'storageProvider', 'supabase',
        'bucket', media.bucket,
        'objectKey', media.storage_path,
        'deliveryMode', 'private_original_requires_safe_transform'
      )
      from public.profile_media as media
      join public.profile_customization as customization
        on customization.user_id = media.user_id
       and customization.banner_media_id = media.id
      join private.community_safe_online_public_profile_cards as card
        on card.user_id = media.user_id
      where media.id = p_media_id
        and media.media_type = 'banner'
        and media.bucket = 'profile-banners'
        and media.status = 'active'
        and media.storage_path like media.user_id::text || '/banners/%'
        and media.storage_path !~ '(^|/)\.\.(/|$)'
        and media.storage_path !~ '[\\\\]'
    ), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;

alter function public.get_online_public_profile_banner_asset(uuid)
  owner to postgres;
revoke all privileges
  on function public.get_online_public_profile_banner_asset(uuid)
  from public, anon, authenticated, service_role;
grant execute
  on function public.get_online_public_profile_banner_asset(uuid)
  to service_role;

comment on function private.community_legacy_online_profile_is_public(uuid) is
  'Compatibility predicate for explicitly confirmed pre-20260718 canonical Online Commons Profiles. It does not publish the cross-site identity card and stops after any audited new publication decision.';
comment on view private.community_safe_online_public_profile_cards is
  'Visibility-aware canonical Online Commons Profile projection. Shared cross-site cards remain governed by community_safe_public_profile_cards.';

commit;

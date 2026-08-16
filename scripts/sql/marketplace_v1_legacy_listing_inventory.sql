\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin transaction read only;
set local statement_timeout = '20s';
set local lock_timeout = '2s';

with targets(slug, name) as (
  values
    ('advanced-pdf-parser', 'Advanced PDF Parser'),
    ('ollama-local-models', 'Ollama Local Models'),
    ('searxng-research', 'SearXNG Research')
),
listing_rows as (
  select
    listing.id,
    listing.addon_id,
    listing.name,
    listing.slug,
    listing.listing_status,
    listing.risk_level,
    listing.current_version,
    listing.published_at,
    listing.revoked_at,
    listing.revocation_reason,
    listing.created_at,
    listing.updated_at,
    listing.developer_profile_id is not null as publisher_record_present,
    listing.source_submission_id is not null as source_submission_present,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', version.id,
        'version', version.version,
        'publisher', coalesce(version.manifest_json -> 'publisher' ->> 'name', version.manifest_json ->> 'publisher'),
        'review_status', version.review_status,
        'signature_status', version.signature_status,
        'compatibility_status', version.compatibility_status,
        'package_sha256', version.package_sha256,
        'published_at', version.published_at,
        'revoked_at', version.revoked_at,
        'revocation_reason', version.revocation_reason,
        'created_at', version.created_at,
        'updated_at', version.updated_at
      ) order by version.created_at)
      from public.marketplace_addon_versions version
      where version.listing_id = listing.id
    ), '[]'::jsonb) as versions,
    (select count(*) from public.marketplace_install_intents intent where to_jsonb(intent) ->> 'listing_id' = listing.id::text) as install_intent_count,
    (select count(*) from public.marketplace_revocations revocation where revocation.listing_id = listing.id) as revocation_count,
    (select count(*) from public.marketplace_publication_events event where event.listing_id = listing.id) as publication_event_count
  from public.marketplace_listings listing
  where lower(listing.slug) in (select lower(slug) from targets)
     or lower(listing.name) in (select lower(name) from targets)
),
legacy_rows as (
  select
    addon.id,
    addon.slug,
    addon.name,
    addon.status,
    addon.trust_tier,
    addon.latest_version,
    addon.category,
    addon.license,
    addon.local_only,
    addon.network_access,
    addon.created_at,
    addon.updated_at,
    addon.publisher_id is not null as publisher_record_present,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', version.id,
        'version', version.version,
        'publisher', coalesce(version.manifest -> 'publisher' ->> 'name', version.manifest ->> 'publisher'),
        'review_status', version.review_status,
        'published_at', version.published_at,
        'created_at', version.created_at
      ) order by version.created_at)
      from public.addon_versions version
      where version.addon_id = addon.id
    ), '[]'::jsonb) as versions,
    (select count(*) from public.user_saved_addons saved where to_jsonb(saved) ->> 'addon_slug' = addon.slug) as saved_record_count,
    (select count(*) from public.marketplace_install_intents intent where to_jsonb(intent) ->> 'legacy_addon_id' = addon.id::text or to_jsonb(intent) ->> 'addon_id' = addon.id::text) as install_intent_count
  from public.addons addon
  where lower(addon.slug) in (select lower(slug) from targets)
     or lower(addon.name) in (select lower(name) from targets)
),
target_counts as (
  select target.slug, target.name,
    (select count(*) from listing_rows row where lower(row.slug) = lower(target.slug) or lower(row.name) = lower(target.name)) as marketplace_listing_count,
    (select count(*) from legacy_rows row where lower(row.slug) = lower(target.slug) or lower(row.name) = lower(target.name)) as legacy_addon_count
  from targets target
)
select jsonb_pretty(jsonb_build_object(
  'inventory_contract', 'marketplace-v1-legacy-listing-read-only-1',
  'captured_at', clock_timestamp(),
  'targets', (select jsonb_agg(to_jsonb(targets) order by slug) from targets),
  'target_counts', (select jsonb_agg(to_jsonb(target_counts) order by slug) from target_counts),
  'marketplace_listings', (select coalesce(jsonb_agg(to_jsonb(listing_rows) order by slug, id), '[]'::jsonb) from listing_rows),
  'legacy_addons', (select coalesce(jsonb_agg(to_jsonb(legacy_rows) order by slug, id), '[]'::jsonb) from legacy_rows),
  'mutation_eligible', not exists (
    select 1 from target_counts where marketplace_listing_count > 1 or legacy_addon_count > 1
  ),
  'notice', 'Read-only operational inventory. No user IDs, auth records, private package paths, or credentials are included.'
));

rollback;

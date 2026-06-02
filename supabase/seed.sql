-- Lightweight seed. Frontend seedAddons.ts contains the richer demo catalog.
-- Run after schema.sql and policies.sql. This creates approved public rows plus
-- approved manifest versions so the browser client can query real Supabase data.

insert into addons (slug, name, summary, description, category, trust_tier, status, latest_version, local_only, network_access)
values
  ('advanced-pdf-parser', 'Advanced PDF Parser', 'Optional richer local PDF text extraction.', 'Prepares local pdfplumber parser support. Website does not install locally.', 'Files', 'official', 'approved', '0.1.0', true, false),
  ('searxng-research', 'SearXNG Research', 'Bounded public web research through local SearXNG.', 'Public query terms may cross the network boundary after local approval.', 'Research / Web', 'official', 'approved', '0.1.0', false, true),
  ('ollama-local-models', 'Ollama Local Models', 'Local model support catalog entry.', 'Documents local Ollama posture. The marketplace does not download models.', 'Models', 'official', 'approved', '0.1.0', true, false)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  description = excluded.description,
  category = excluded.category,
  trust_tier = excluded.trust_tier,
  status = excluded.status,
  latest_version = excluded.latest_version,
  local_only = excluded.local_only,
  network_access = excluded.network_access,
  updated_at = now();

insert into addon_versions (addon_id, version, manifest, review_status, published_at)
select
  addons.id,
  addons.latest_version,
  jsonb_build_object(
    'schema_version', '1.0',
    'id', addons.slug,
    'name', addons.name,
    'publisher', 'Elysia Marketplace Seed',
    'version', addons.latest_version,
    'category', addons.category,
    'summary', addons.summary,
    'description', addons.description,
    'trust_tier', addons.trust_tier,
    'local_only', addons.local_only,
    'network_access', addons.network_access,
    'dependencies', '[]'::jsonb,
    'actions', jsonb_build_array(jsonb_build_object(
      'action_key', 'prepare_plan',
      'action_label', 'Prepare local Elysia review plan',
      'action_kind', 'manual_instruction',
      'allowed', true,
      'risk_level', case when addons.network_access then 'moderate' else 'low' end,
      'requires_local_operator_password', true,
      'network_access', addons.network_access,
      'notes', jsonb_build_array(
        'The marketplace prepares a plan only.',
        'Local Elysia must perform any future action after password-gated review.'
      )
    )),
    'security', jsonb_build_object(
      'operator_only', true,
      'model_accessible', false,
      'chat_accessible', false,
      'memory_promotion_allowed', false,
      'outward_sharing_allowed', addons.network_access,
      'local_file_access', 'none',
      'outward_sharing_risk', case when addons.network_access then 'Public query or dependency metadata may leave local control if approved in local Elysia later.' else null end
    ),
    'tags', jsonb_build_array(addons.category, addons.trust_tier),
    'status', 'approved'
  ),
  'approved',
  now()
from addons
where addons.slug in ('advanced-pdf-parser', 'searxng-research', 'ollama-local-models')
on conflict (addon_id, version) do update set
  manifest = excluded.manifest,
  review_status = 'approved',
  published_at = coalesce(addon_versions.published_at, now());

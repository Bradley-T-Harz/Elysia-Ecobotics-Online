-- Developer Forge archive inspection metadata.
-- Stores inert static/archive inspection summaries for reviewer display only.

alter table public.addon_packages
  add column if not exists archive_inspection_json jsonb not null default '{}'::jsonb,
  add column if not exists scan_summary text;

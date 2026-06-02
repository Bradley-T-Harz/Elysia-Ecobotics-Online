-- Marketplace profile compatibility for local Elysia manual public-field sync.
-- Run after supabase/schema.sql and policies are already installed.

alter table public.profiles
  add column if not exists interests text,
  add column if not exists profile_sync_updated_at timestamptz;

comment on column public.profiles.interests is
  'Public Marketplace profile interests. May be manually synced from local Elysia public profile fields after explicit user confirmation.';

comment on column public.profiles.profile_sync_updated_at is
  'Optional timestamp for future profile-sync bookkeeping. Local Elysia does not send private fields, local files, memory, request traces, dependency inventory, or local paths.';

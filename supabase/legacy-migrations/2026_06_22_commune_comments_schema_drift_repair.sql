-- Commune comments schema drift repair.
-- Apply manually in Supabase after review. This repairs live projects where
-- commune_comments existed before the full account-mode table shape landed.
-- It does not delete rows, disable RLS, or weaken moderation policies.

create extension if not exists pgcrypto;

alter table public.commune_comments
  add column if not exists author_username text,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id),
  add column if not exists moderation_reason text;

create index if not exists commune_comments_post_idx
  on public.commune_comments(post_id, created_at);

create index if not exists commune_comments_thread_status_idx
  on public.commune_comments(thread_id, status, created_at);

create index if not exists commune_comments_parent_idx
  on public.commune_comments(parent_comment_id, created_at)
  where parent_comment_id is not null;

create index if not exists commune_comments_user_status_idx
  on public.commune_comments(user_id, status, created_at desc);

create index if not exists commune_comments_published_idx
  on public.commune_comments(published_at desc)
  where status = 'published';

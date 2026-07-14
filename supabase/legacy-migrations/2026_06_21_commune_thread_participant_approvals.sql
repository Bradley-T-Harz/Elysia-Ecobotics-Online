-- Per-thread Commune participation approvals.
-- This supports the rule: first contribution by a user on a post/thread is reviewed,
-- then that user may continue participating in that same thread unless revoked.

create table if not exists public.commune_thread_participant_approvals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.commune_threads(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  first_comment_id uuid references public.commune_comments(id) on delete set null,
  approval_source text not null default 'first_comment_approval',
  status text not null default 'approved',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint commune_thread_participant_status_check check (status in ('approved','revoked'))
);

create unique index if not exists commune_thread_participant_approvals_thread_user_unique
  on public.commune_thread_participant_approvals(thread_id, user_id);

create index if not exists commune_thread_participant_approvals_user_idx
  on public.commune_thread_participant_approvals(user_id, revoked_at);

create index if not exists commune_thread_participant_approvals_post_idx
  on public.commune_thread_participant_approvals(post_id);

alter table public.commune_thread_participant_approvals enable row level security;

drop policy if exists "users read own thread participation approvals" on public.commune_thread_participant_approvals;
create policy "users read own thread participation approvals"
  on public.commune_thread_participant_approvals
  for select to authenticated
  using (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators manage thread participation approvals" on public.commune_thread_participant_approvals;
create policy "moderators manage thread participation approvals"
  on public.commune_thread_participant_approvals
  for all to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

grant select on table public.commune_thread_participant_approvals to authenticated;
grant insert, update on table public.commune_thread_participant_approvals to authenticated;

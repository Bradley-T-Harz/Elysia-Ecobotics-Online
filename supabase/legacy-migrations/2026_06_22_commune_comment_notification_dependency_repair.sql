-- Commune published-comment notification dependency repair.
-- Apply manually in Supabase after review.
--
-- Comments/replies are core Commune participation. Notifications are accessory.
-- This migration repairs the notification/follow-thread objects used by the
-- published-comment trigger and makes that trigger fail-safe so notification
-- drift cannot roll back a successful comment insert.

create extension if not exists pgcrypto;

create table if not exists public.user_followed_commune_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  followed_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  unique(user_id, thread_id)
);

alter table public.user_followed_commune_threads
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists thread_id uuid,
  add column if not exists followed_at timestamptz not null default now(),
  add column if not exists last_read_at timestamptz,
  add column if not exists muted boolean not null default false;

alter table public.user_followed_commune_threads
  alter column muted set default false;

update public.user_followed_commune_threads
set muted = false
where muted is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_followed_commune_threads_thread_id_fkey'
      and conrelid = 'public.user_followed_commune_threads'::regclass
  ) then
    alter table public.user_followed_commune_threads
      add constraint user_followed_commune_threads_thread_id_fkey
      foreign key (thread_id) references public.commune_threads(id) on delete cascade;
  end if;
end $$;

create unique index if not exists user_followed_commune_threads_user_thread_unique
  on public.user_followed_commune_threads(user_id, thread_id);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  source_type text,
  source_id uuid,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists notification_type text,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists action_url text,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;
alter table public.user_followed_commune_threads enable row level security;

drop policy if exists "users manage own notifications" on public.user_notifications;
create policy "users manage own notifications"
  on public.user_notifications
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "commune trigger creates own notifications" on public.user_notifications;
create policy "commune trigger creates own notifications"
  on public.user_notifications
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users manage own followed commune threads" on public.user_followed_commune_threads;
create policy "users manage own followed commune threads"
  on public.user_followed_commune_threads
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on table public.user_notifications to authenticated;
grant select, insert, update, delete on table public.user_followed_commune_threads to authenticated;
revoke all on table public.user_notifications from anon;
revoke all on table public.user_followed_commune_threads from anon;

create or replace function public.notify_commune_published_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    begin
      insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
      select distinct
        target_user_id,
        'commune_thread_reply',
        'commune_comment',
        new.id,
        'New published Commune reply',
        'A followed Commune thread has a newly published reply.',
        '/commune/posts/' || coalesce(new.post_id::text, '')
      from (
        select follow.user_id as target_user_id
        from public.user_followed_commune_threads follow
        where follow.thread_id = new.thread_id
          and follow.user_id <> new.user_id
          and coalesce(follow.muted, false) = false
        union
        select post.user_id as target_user_id
        from public.commune_posts post
        where post.id = new.post_id
          and post.user_id <> new.user_id
      ) targets
      where target_user_id is not null;
    exception when others then
      raise notice 'Commune published-comment notification skipped: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists commune_notify_published_comment on public.commune_comments;
create trigger commune_notify_published_comment
after insert or update of status on public.commune_comments
for each row execute function public.notify_commune_published_comment();

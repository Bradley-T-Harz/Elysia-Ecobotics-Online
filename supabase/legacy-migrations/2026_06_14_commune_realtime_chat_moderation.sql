-- Pass 3: governed Commune realtime chat foundation.
-- Chat is plain text, signed-in for posting, reportable, and moderator controlled.

create table if not exists public.commune_realtime_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  visibility_state text not null default 'published',
  posting_mode text not null default 'open_signed_in',
  slow_mode_seconds integer not null default 15,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_realtime_rooms_visibility_check check (visibility_state in ('published','hidden','archived','removed')),
  constraint commune_realtime_rooms_posting_mode_check check (posting_mode in ('open_signed_in','members_only','read_only','moderated','disabled')),
  constraint commune_realtime_rooms_slow_mode_check check (slow_mode_seconds >= 0 and slow_mode_seconds <= 3600)
);

insert into public.commune_realtime_rooms (slug, title, description, posting_mode, slow_mode_seconds) values
  ('general', 'General Commune', 'Public community room for careful, moderated Elysia Ecobotics conversation.', 'open_signed_in', 15),
  ('developer-forge', 'Developer Forge', 'Add-on preparation, manifest, package, and review-status discussion. No code execution.', 'open_signed_in', 20),
  ('troubleshooting', 'Troubleshooting Grove', 'Plain-text troubleshooting help. Redact logs and never post tokens, credentials, or private local Elysia data.', 'open_signed_in', 20),
  ('stewardship', 'Stewardship Commons', 'Public-benefit and ecological stewardship discussion for safe-to-share community updates.', 'open_signed_in', 20),
  ('safety-and-boundaries', 'Safety and Boundaries', 'Privacy, consent, moderation, and boundary discussions. Plain text only.', 'open_signed_in', 30)
on conflict (slug) do nothing;

alter table public.commune_realtime_messages add column if not exists room_id uuid references public.commune_realtime_rooms(id) on delete cascade;
alter table public.commune_realtime_messages add column if not exists author_username text;
alter table public.commune_realtime_messages add column if not exists body_plain text;
alter table public.commune_realtime_messages add column if not exists report_count integer not null default 0;
alter table public.commune_realtime_messages add column if not exists edited_at timestamptz;
alter table public.commune_realtime_messages add column if not exists flagged_at timestamptz;
alter table public.commune_realtime_messages add column if not exists moderation_reason text;

update public.commune_realtime_messages message
set room_id = room.id
from public.commune_realtime_rooms room
where message.room_id is null and message.room_slug = room.slug;

update public.commune_realtime_messages
set body_plain = body
where body_plain is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commune_realtime_message_body_check') then
    alter table public.commune_realtime_messages add constraint commune_realtime_message_body_check check (char_length(trim(body)) between 1 and 2000 and body !~* '<\s*/?\s*script' and body !~* '<\s*iframe' and body !~* 'javascript:');
  end if;
end $$;

create index if not exists commune_realtime_messages_room_id_idx on public.commune_realtime_messages(room_id, created_at desc);
create index if not exists commune_realtime_messages_visibility_idx on public.commune_realtime_messages(visibility_state, created_at desc);

create table if not exists public.commune_realtime_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.commune_realtime_messages(id) on delete cascade,
  room_id uuid references public.commune_realtime_rooms(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  detail text,
  report_status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  constraint commune_realtime_reports_reason_check check (reason in ('spam','harassment','unsafe_code','secret_or_private_data','misinformation','copyright_or_license','malware_or_suspicious','privacy_violation','other')),
  constraint commune_realtime_reports_status_check check (report_status in ('open','under_review','action_taken','dismissed','archived'))
);

create index if not exists commune_realtime_reports_status_idx on public.commune_realtime_reports(report_status, created_at desc);
create index if not exists commune_realtime_reports_message_idx on public.commune_realtime_reports(message_id, created_at desc);

create table if not exists public.commune_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.commune_realtime_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(room_id, user_id),
  constraint commune_room_members_role_check check (member_role in ('member','moderator','owner'))
);

create table if not exists public.commune_room_moderation_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.commune_realtime_rooms(id) on delete set null,
  message_id uuid references public.commune_realtime_messages(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commune_room_moderation_events_action_check check (action in ('message_created','message_reported','message_flagged','message_hidden','message_removed','room_slow_mode_updated','room_posting_mode_updated','room_archived','room_restored'))
);

create index if not exists commune_room_moderation_events_room_idx on public.commune_room_moderation_events(room_id, created_at desc);
create index if not exists commune_room_moderation_events_message_idx on public.commune_room_moderation_events(message_id, created_at desc);

create or replace function public.can_post_commune_realtime_message(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.commune_realtime_rooms room
      where room.id = target_room_id
        and room.visibility_state = 'published'
        and (
          room.posting_mode = 'open_signed_in'
          or (
            room.posting_mode = 'members_only'
            and exists (select 1 from public.commune_room_members member where member.room_id = room.id and member.user_id = auth.uid())
          )
        )
        and not exists (
          select 1
          from public.commune_realtime_messages previous
          where previous.room_id = room.id
            and previous.author_user_id = auth.uid()
            and previous.created_at > now() - make_interval(secs => greatest(room.slow_mode_seconds, 0))
        )
    );
$$;

create or replace function public.bump_commune_realtime_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.commune_realtime_messages
  set report_count = coalesce(report_count, 0) + 1,
      visibility_state = case when coalesce(report_count, 0) + 1 >= 3 and visibility_state = 'published' then 'flagged' else visibility_state end,
      flagged_at = case when coalesce(report_count, 0) + 1 >= 3 and flagged_at is null then now() else flagged_at end
  where id = new.message_id
  returning report_count into next_count;
  return new;
end;
$$;

drop trigger if exists commune_realtime_reports_bump_count on public.commune_realtime_reports;
create trigger commune_realtime_reports_bump_count
after insert on public.commune_realtime_reports
for each row execute function public.bump_commune_realtime_report_count();

alter table public.commune_realtime_rooms enable row level security;
alter table public.commune_realtime_messages enable row level security;
alter table public.commune_realtime_reports enable row level security;
alter table public.commune_room_members enable row level security;
alter table public.commune_room_moderation_events enable row level security;

drop policy if exists "public reads published realtime rooms" on public.commune_realtime_rooms;
create policy "public reads published realtime rooms" on public.commune_realtime_rooms for select using (visibility_state = 'published' or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators manage realtime rooms" on public.commune_realtime_rooms;
create policy "moderators manage realtime rooms" on public.commune_realtime_rooms for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published commune realtime messages" on public.commune_realtime_messages;
create policy "public reads published commune realtime messages" on public.commune_realtime_messages for select using (
  visibility_state = 'published'
  and exists (select 1 from public.commune_realtime_rooms room where room.id = room_id and room.visibility_state = 'published')
);
drop policy if exists "signed in users create commune realtime messages" on public.commune_realtime_messages;
create policy "signed in users create commune realtime messages" on public.commune_realtime_messages for insert to authenticated with check (
  author_user_id = auth.uid()
  and visibility_state = 'published'
  and public.can_post_commune_realtime_message(room_id)
);
drop policy if exists "moderators manage commune realtime messages" on public.commune_realtime_messages;
create policy "moderators manage commune realtime messages" on public.commune_realtime_messages for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators read all commune realtime messages" on public.commune_realtime_messages;
create policy "moderators read all commune realtime messages" on public.commune_realtime_messages for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create realtime reports" on public.commune_realtime_reports;
create policy "users create realtime reports" on public.commune_realtime_reports for insert to authenticated with check (reporter_user_id = auth.uid());
drop policy if exists "users read own realtime reports" on public.commune_realtime_reports;
create policy "users read own realtime reports" on public.commune_realtime_reports for select to authenticated using (reporter_user_id = auth.uid());
drop policy if exists "moderators manage realtime reports" on public.commune_realtime_reports;
create policy "moderators manage realtime reports" on public.commune_realtime_reports for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read own realtime room memberships" on public.commune_room_members;
create policy "users read own realtime room memberships" on public.commune_room_members for select to authenticated using (user_id = auth.uid());
drop policy if exists "moderators manage realtime room memberships" on public.commune_room_members;
create policy "moderators manage realtime room memberships" on public.commune_room_members for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read realtime moderation events" on public.commune_room_moderation_events;
create policy "moderators read realtime moderation events" on public.commune_room_moderation_events for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own realtime message events" on public.commune_room_moderation_events;
create policy "users create own realtime message events" on public.commune_room_moderation_events for insert to authenticated with check (
  actor_user_id = auth.uid()
  and (
    action in ('message_created','message_reported')
    or public.current_user_can_review_domain('commune'::public.review_domain)
  )
);

grant select on table public.commune_realtime_rooms to anon, authenticated;
grant insert, update, delete on table public.commune_realtime_rooms to authenticated;
grant select on table public.commune_realtime_messages to anon, authenticated;
grant insert, update on table public.commune_realtime_messages to authenticated;
grant select, insert, update on table public.commune_realtime_reports to authenticated;
grant select, insert, update, delete on table public.commune_room_members to authenticated;
grant select, insert on table public.commune_room_moderation_events to authenticated;
grant execute on function public.can_post_commune_realtime_message(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.commune_realtime_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

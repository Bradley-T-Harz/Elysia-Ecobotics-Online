-- Canonicalize notification read state without changing notification content or
-- delivery behavior. `read_at` is authoritative; `is_read` remains a synchronized
-- compatibility projection for older queries and indexes.

begin;

update public.user_notifications
set read_at = coalesce(read_at, created_at, pg_catalog.now())
where is_read = true
  and read_at is null;

update public.user_notifications
set is_read = (read_at is not null)
where is_read is distinct from (read_at is not null);

create or replace function public.synchronize_user_notification_read_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.read_at is not null then
      new.is_read := true;
    elsif new.is_read then
      new.read_at := pg_catalog.now();
    else
      new.is_read := false;
    end if;
  elsif new.read_at is distinct from old.read_at then
    new.is_read := (new.read_at is not null);
  elsif new.is_read is distinct from old.is_read then
    if new.is_read then
      new.read_at := coalesce(new.read_at, pg_catalog.now());
    else
      new.read_at := null;
    end if;
  else
    new.is_read := (new.read_at is not null);
  end if;

  return new;
end;
$$;

alter function public.synchronize_user_notification_read_state() owner to postgres;
revoke all privileges on function public.synchronize_user_notification_read_state()
  from public, anon, authenticated, service_role;

drop trigger if exists synchronize_user_notification_read_state
  on public.user_notifications;
create trigger synchronize_user_notification_read_state
before insert or update of read_at, is_read
on public.user_notifications
for each row execute function public.synchronize_user_notification_read_state();

alter table public.user_notifications
  drop constraint if exists user_notifications_read_state_consistent;
alter table public.user_notifications
  add constraint user_notifications_read_state_consistent
  check (is_read = (read_at is not null)) not valid;
alter table public.user_notifications
  validate constraint user_notifications_read_state_consistent;

drop index if exists public.user_notifications_user_unread_idx;
create index user_notifications_user_unread_idx
  on public.user_notifications(user_id, created_at desc)
  where read_at is null;

revoke all privileges on table public.user_notifications
  from public, anon, authenticated;
grant select, insert, delete on table public.user_notifications to authenticated;
grant update (read_at, is_read) on table public.user_notifications to authenticated;

comment on column public.user_notifications.read_at is
  'Canonical owner-controlled read timestamp. Financial truth must never depend on notification state.';
comment on column public.user_notifications.is_read is
  'Trigger-maintained compatibility projection of read_at IS NOT NULL.';

commit;

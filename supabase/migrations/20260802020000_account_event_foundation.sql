-- Add an immutable, server-owned account-event ledger with separate Inbox,
-- Notification, preference, count, and optional delivery projections. Domain
-- source records remain authoritative and projection rows never grant access.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function private.account_event_deep_link_is_safe(p_path text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_path is not null
    and pg_catalog.char_length(p_path) between 1 and 500
    and p_path like '/%'
    and p_path not like '//%'
    and p_path !~ E'\\\\'
    and p_path !~ '[[:space:][:cntrl:]]'
    and p_path ~ '^/[[:alnum:]@/_.?&=%+#,~-]*$';
$$;

alter function private.account_event_deep_link_is_safe(text) owner to postgres;
revoke all privileges on function private.account_event_deep_link_is_safe(text)
  from public, anon, authenticated, service_role;

create or replace function private.account_event_is_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_user_id is not null
     and new.actor_user_id is null
     and (pg_catalog.to_jsonb(new) - 'actor_user_id')
       = (pg_catalog.to_jsonb(old) - 'actor_user_id') then
    return new;
  end if;
  raise exception using errcode = '55000', message = 'account_event_is_immutable';
end;
$$;

alter function private.account_event_is_immutable() owner to postgres;
revoke all privileges on function private.account_event_is_immutable()
  from public, anon, authenticated, service_role;

create table private.account_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version integer not null default 1,
  source_domain text not null,
  source_type text not null,
  source_record_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  idempotency_key text not null unique,
  delivery_class text not null,
  category text not null,
  safe_title text not null,
  safe_preview text,
  safe_payload jsonb not null default '{}'::jsonb,
  deep_link text not null,
  retention_class text not null default 'source_lifecycle',
  correlation_id uuid,
  created_at timestamptz not null default now(),
  constraint account_events_event_type_check check (
    event_type ~ '^[a-z][a-z0-9_.]{2,119}$'
  ),
  constraint account_events_event_version_check check (event_version between 1 and 1000),
  constraint account_events_source_domain_check check (
    source_domain ~ '^[a-z][a-z0-9_]{1,79}$'
  ),
  constraint account_events_source_type_check check (
    source_type ~ '^[a-z][a-z0-9_]{1,119}$'
  ),
  constraint account_events_actor_kind_check check (
    actor_kind in ('user', 'staff', 'service', 'system', 'provider', 'guardian')
  ),
  constraint account_events_idempotency_key_check check (
    pg_catalog.char_length(idempotency_key) between 8 and 255
    and idempotency_key !~ '[[:space:][:cntrl:]]'
  ),
  constraint account_events_delivery_class_check check (
    delivery_class in ('mandatory', 'suppressible')
  ),
  constraint account_events_category_check check (
    category ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint account_events_safe_title_check check (
    pg_catalog.char_length(pg_catalog.btrim(safe_title)) between 1 and 160
    and safe_title !~ '[[:cntrl:]]'
  ),
  constraint account_events_safe_preview_check check (
    safe_preview is null
    or (pg_catalog.char_length(safe_preview) <= 500 and safe_preview !~ '[[:cntrl:]]')
  ),
  constraint account_events_safe_payload_check check (
    pg_catalog.jsonb_typeof(safe_payload) = 'object'
    and pg_catalog.octet_length(safe_payload::text) <= 4000
  ),
  constraint account_events_deep_link_check check (
    private.account_event_deep_link_is_safe(deep_link)
  ),
  constraint account_events_retention_class_check check (
    retention_class in ('ephemeral', 'source_lifecycle', 'account_lifecycle', 'audit', 'legal')
  )
);

create index account_events_source_idx
  on private.account_events(source_domain, source_type, source_record_id, created_at desc);
create index account_events_actor_created_idx
  on private.account_events(actor_user_id, created_at desc)
  where actor_user_id is not null;

create trigger account_events_are_append_only
before update or delete on private.account_events
for each row execute function private.account_event_is_immutable();

create table public.account_event_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  taxonomy_version integer not null default 1,
  preference_version integer not null default 1,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  primary key (user_id, category),
  constraint account_event_preferences_category_check check (
    category in (
      'account_security', 'community_replies', 'community_mentions',
      'followed_threads', 'work_reviews', 'marketplace', 'moderation',
      'announcements', 'sandbox'
    )
  ),
  constraint account_event_preferences_taxonomy_check check (taxonomy_version = 1),
  constraint account_event_preferences_version_check check (preference_version >= 1),
  constraint account_event_preferences_quiet_hours_check check (
    (quiet_hours_start is null) = (quiet_hours_end is null)
  ),
  constraint account_event_preferences_timezone_check check (quiet_hours_timezone = 'UTC')
);

create table public.account_inbox_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.account_events(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  projection_kind text not null default 'action',
  source_domain text not null,
  source_type text not null,
  source_record_id uuid not null,
  category text not null,
  safe_title text not null,
  safe_preview text,
  deep_link text not null,
  action_kind text not null,
  priority smallint not null default 50,
  read_at timestamptz,
  archived_at timestamptz,
  completed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_user_id, event_id, projection_kind),
  constraint account_inbox_projection_kind_check check (
    projection_kind in ('action', 'required_action', 'conversation_request', 'message')
  ),
  constraint account_inbox_source_domain_check check (source_domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint account_inbox_source_type_check check (source_type ~ '^[a-z][a-z0-9_]{1,119}$'),
  constraint account_inbox_category_check check (category ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint account_inbox_safe_title_check check (
    pg_catalog.char_length(pg_catalog.btrim(safe_title)) between 1 and 160
    and safe_title !~ '[[:cntrl:]]'
  ),
  constraint account_inbox_safe_preview_check check (
    safe_preview is null
    or (pg_catalog.char_length(safe_preview) <= 500 and safe_preview !~ '[[:cntrl:]]')
  ),
  constraint account_inbox_deep_link_check check (
    private.account_event_deep_link_is_safe(deep_link)
  ),
  constraint account_inbox_action_kind_check check (
    action_kind ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint account_inbox_priority_check check (priority between 0 and 100),
  constraint account_inbox_resolution_check check (
    completed_at is null or superseded_at is null
  )
);

create index account_inbox_recipient_attention_idx
  on public.account_inbox_items(recipient_user_id, created_at desc, id desc)
  where archived_at is null and completed_at is null and superseded_at is null;
create index account_inbox_recipient_unread_idx
  on public.account_inbox_items(recipient_user_id, created_at desc, id desc)
  where read_at is null and archived_at is null;
create index account_inbox_source_idx
  on public.account_inbox_items(source_domain, source_type, source_record_id);

create table public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.account_events(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  projection_kind text not null default 'information',
  source_domain text not null,
  source_type text not null,
  source_record_id uuid not null,
  category text not null,
  delivery_class text not null,
  safe_title text not null,
  safe_preview text,
  deep_link text not null,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_user_id, event_id, projection_kind),
  constraint account_notifications_projection_kind_check check (
    projection_kind in ('information', 'outcome', 'mandatory_notice', 'legacy')
  ),
  constraint account_notifications_source_domain_check check (source_domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint account_notifications_source_type_check check (source_type ~ '^[a-z][a-z0-9_]{1,119}$'),
  constraint account_notifications_category_check check (category ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint account_notifications_delivery_class_check check (
    delivery_class in ('mandatory', 'suppressible')
  ),
  constraint account_notifications_safe_title_check check (
    pg_catalog.char_length(pg_catalog.btrim(safe_title)) between 1 and 160
    and safe_title !~ '[[:cntrl:]]'
  ),
  constraint account_notifications_safe_preview_check check (
    safe_preview is null
    or (pg_catalog.char_length(safe_preview) <= 500 and safe_preview !~ '[[:cntrl:]]')
  ),
  constraint account_notifications_deep_link_check check (
    private.account_event_deep_link_is_safe(deep_link)
  )
);

create index account_notifications_recipient_unread_idx
  on public.account_notifications(recipient_user_id, created_at desc, id desc)
  where read_at is null and archived_at is null;
create index account_notifications_recipient_created_idx
  on public.account_notifications(recipient_user_id, created_at desc, id desc);
create index account_notifications_source_idx
  on public.account_notifications(source_domain, source_type, source_record_id);

create table private.account_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.account_events(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text not null unique,
  channel text not null default 'email',
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_delivery_key_check check (
    pg_catalog.char_length(delivery_key) between 8 and 255
    and delivery_key !~ '[[:space:][:cntrl:]]'
  ),
  constraint account_delivery_channel_check check (channel = 'email'),
  constraint account_delivery_status_check check (
    status in ('pending', 'processing', 'delivered', 'failed', 'abandoned', 'suppressed')
  ),
  constraint account_delivery_attempt_check check (attempt_count between 0 and 20),
  constraint account_delivery_lease_check check (
    (status = 'processing' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_token is null and lease_expires_at is null)
  ),
  constraint account_delivery_delivered_check check (
    (status = 'delivered' and delivered_at is not null)
    or (status <> 'delivered' and delivered_at is null)
  ),
  constraint account_delivery_error_code_check check (
    last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{2,79}$'
  )
);

create index account_delivery_outbox_claim_idx
  on private.account_delivery_outbox(available_at, created_at, id)
  where status in ('pending', 'failed', 'processing');

do $account_event_table_hardening$
declare v_table text;
begin
  foreach v_table in array array[
    'account_events', 'account_delivery_outbox'
  ] loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
  foreach v_table in array array[
    'account_event_preferences', 'account_inbox_items', 'account_notifications'
  ] loop
    execute pg_catalog.format('alter table public.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table public.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table public.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$account_event_table_hardening$;

create policy "account owners read event preferences"
  on public.account_event_preferences for select to authenticated
  using (user_id = auth.uid());
create policy "account recipients read inbox projections"
  on public.account_inbox_items for select to authenticated
  using (recipient_user_id = auth.uid());
create policy "account recipients update inbox presentation state"
  on public.account_inbox_items for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
create policy "account recipients read notification projections"
  on public.account_notifications for select to authenticated
  using (recipient_user_id = auth.uid());
create policy "account recipients update notification presentation state"
  on public.account_notifications for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

grant select on public.account_event_preferences to authenticated, service_role;
grant select on public.account_inbox_items to authenticated, service_role;
grant update (read_at, archived_at)
  on public.account_inbox_items to authenticated;
grant select on public.account_notifications to authenticated, service_role;
grant update (read_at, archived_at)
  on public.account_notifications to authenticated;

create or replace function private.record_account_event(
  p_event_type text,
  p_event_version integer,
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid,
  p_actor_user_id uuid,
  p_actor_kind text,
  p_idempotency_key text,
  p_delivery_class text,
  p_category text,
  p_safe_title text,
  p_safe_preview text,
  p_safe_payload jsonb,
  p_deep_link text,
  p_retention_class text default 'source_lifecycle',
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.account_events%rowtype;
  v_event_id uuid;
  v_title text := pg_catalog.btrim(coalesce(p_safe_title, ''));
  v_payload jsonb := coalesce(p_safe_payload, '{}'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(p_idempotency_key, ''), 0)
  );
  select event.* into v_existing
  from private.account_events as event
  where event.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.event_type is distinct from p_event_type
       or v_existing.event_version is distinct from p_event_version
       or v_existing.source_domain is distinct from p_source_domain
       or v_existing.source_type is distinct from p_source_type
       or v_existing.source_record_id is distinct from p_source_record_id
       or v_existing.actor_user_id is distinct from p_actor_user_id
       or v_existing.actor_kind is distinct from p_actor_kind
       or v_existing.delivery_class is distinct from p_delivery_class
       or v_existing.category is distinct from p_category
       or v_existing.safe_title is distinct from v_title
       or v_existing.safe_preview is distinct from p_safe_preview
       or v_existing.safe_payload is distinct from v_payload
       or v_existing.deep_link is distinct from p_deep_link
       or v_existing.retention_class is distinct from p_retention_class
       or v_existing.correlation_id is distinct from p_correlation_id then
      raise exception using errcode = '23505', message = 'account_event_idempotency_conflict';
    end if;
    return v_existing.id;
  end if;
  insert into private.account_events(
    event_type, event_version, source_domain, source_type, source_record_id,
    actor_user_id, actor_kind, idempotency_key, delivery_class, category,
    safe_title, safe_preview, safe_payload, deep_link, retention_class,
    correlation_id
  ) values (
    p_event_type, p_event_version, p_source_domain, p_source_type,
    p_source_record_id, p_actor_user_id, p_actor_kind, p_idempotency_key,
    p_delivery_class, p_category, v_title, p_safe_preview, v_payload,
    p_deep_link, p_retention_class, p_correlation_id
  ) returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function private.account_event_next_delivery_at(
  p_recipient_user_id uuid,
  p_category text,
  p_delivery_class text
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_preference public.account_event_preferences%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_time time := (pg_catalog.now() at time zone 'UTC')::time;
  v_day date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  if p_delivery_class = 'mandatory' then return v_now; end if;
  select preference.* into v_preference
  from public.account_event_preferences as preference
  where preference.user_id = p_recipient_user_id
    and preference.category = p_category;
  if not found or v_preference.quiet_hours_start is null then return v_now; end if;
  if v_preference.quiet_hours_start < v_preference.quiet_hours_end then
    if v_time >= v_preference.quiet_hours_start and v_time < v_preference.quiet_hours_end then
      return (v_day + v_preference.quiet_hours_end) at time zone 'UTC';
    end if;
  elsif v_time >= v_preference.quiet_hours_start then
    return (v_day + 1 + v_preference.quiet_hours_end) at time zone 'UTC';
  elsif v_time < v_preference.quiet_hours_end then
    return (v_day + v_preference.quiet_hours_end) at time zone 'UTC';
  end if;
  return v_now;
end;
$$;

create or replace function private.enqueue_account_event_delivery(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_channel text default 'email'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.account_events%rowtype;
  v_email_enabled boolean := false;
begin
  select event.* into strict v_event
  from private.account_events as event where event.id = p_event_id;
  if p_channel <> 'email' then
    raise exception using errcode = '22023', message = 'account_delivery_channel_invalid';
  end if;
  if v_event.delivery_class = 'mandatory' then
    v_email_enabled := true;
  else
    select coalesce(preference.email_enabled, false) into v_email_enabled
    from public.account_event_preferences as preference
    where preference.user_id = p_recipient_user_id
      and preference.category = v_event.category;
    v_email_enabled := coalesce(v_email_enabled, false);
  end if;
  if not v_email_enabled then return; end if;
  insert into private.account_delivery_outbox(
    event_id, recipient_user_id, delivery_key, channel, available_at
  ) values (
    p_event_id, p_recipient_user_id,
    'account-event:' || p_event_id::text || ':' || p_recipient_user_id::text || ':' || p_channel || ':v1',
    p_channel,
    private.account_event_next_delivery_at(
      p_recipient_user_id, v_event.category, v_event.delivery_class
    )
  ) on conflict (delivery_key) do nothing;
end;
$$;

create or replace function private.project_account_event(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_inbox_kind text default null,
  p_action_kind text default null,
  p_priority integer default 50,
  p_notification_kind text default null,
  p_request_email boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.account_events%rowtype;
  v_in_app_enabled boolean := true;
  v_inbox_id uuid;
  v_notification_id uuid;
begin
  select event.* into strict v_event
  from private.account_events as event where event.id = p_event_id;
  if not exists (select 1 from auth.users where id = p_recipient_user_id) then
    raise exception using errcode = 'P0002', message = 'account_event_recipient_not_found';
  end if;
  if p_inbox_kind is not null then
    if p_action_kind is null then
      raise exception using errcode = '22023', message = 'account_inbox_action_kind_required';
    end if;
    insert into public.account_inbox_items(
      event_id, recipient_user_id, projection_kind, source_domain, source_type,
      source_record_id, category, safe_title, safe_preview, deep_link,
      action_kind, priority
    ) values (
      v_event.id, p_recipient_user_id, p_inbox_kind, v_event.source_domain,
      v_event.source_type, v_event.source_record_id, v_event.category,
      v_event.safe_title, v_event.safe_preview, v_event.deep_link,
      p_action_kind, p_priority
    ) on conflict (recipient_user_id, event_id, projection_kind) do nothing
    returning id into v_inbox_id;
    if v_inbox_id is null then
      select item.id into v_inbox_id
      from public.account_inbox_items as item
      where item.recipient_user_id = p_recipient_user_id
        and item.event_id = v_event.id
        and item.projection_kind = p_inbox_kind;
    end if;
  end if;
  if v_event.delivery_class = 'suppressible' then
    select coalesce(preference.in_app_enabled, true) into v_in_app_enabled
    from public.account_event_preferences as preference
    where preference.user_id = p_recipient_user_id
      and preference.category = v_event.category;
    v_in_app_enabled := coalesce(v_in_app_enabled, true);
  end if;
  if p_notification_kind is not null and v_in_app_enabled then
    insert into public.account_notifications(
      event_id, recipient_user_id, projection_kind, source_domain, source_type,
      source_record_id, category, delivery_class, safe_title, safe_preview,
      deep_link
    ) values (
      v_event.id, p_recipient_user_id, p_notification_kind,
      v_event.source_domain, v_event.source_type, v_event.source_record_id,
      v_event.category, v_event.delivery_class, v_event.safe_title,
      v_event.safe_preview, v_event.deep_link
    ) on conflict (recipient_user_id, event_id, projection_kind) do nothing
    returning id into v_notification_id;
    if v_notification_id is null then
      select notification.id into v_notification_id
      from public.account_notifications as notification
      where notification.recipient_user_id = p_recipient_user_id
        and notification.event_id = v_event.id
        and notification.projection_kind = p_notification_kind;
    end if;
  end if;
  if p_request_email then
    perform private.enqueue_account_event_delivery(p_event_id, p_recipient_user_id, 'email');
  end if;
  return pg_catalog.jsonb_build_object(
    'inboxItemId', v_inbox_id,
    'notificationId', v_notification_id,
    'notificationSuppressed', p_notification_kind is not null and not v_in_app_enabled
  );
end;
$$;

create or replace function private.resolve_account_inbox_items(
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid,
  p_recipient_user_id uuid,
  p_resolution text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if p_resolution not in ('completed', 'superseded') then
    raise exception using errcode = '22023', message = 'account_inbox_resolution_invalid';
  end if;
  update public.account_inbox_items
  set completed_at = case when p_resolution = 'completed' then pg_catalog.now() else completed_at end,
      superseded_at = case when p_resolution = 'superseded' then pg_catalog.now() else superseded_at end,
      updated_at = pg_catalog.now()
  where source_domain = p_source_domain
    and source_type = p_source_type
    and source_record_id = p_source_record_id
    and recipient_user_id = p_recipient_user_id
    and completed_at is null
    and superseded_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.account_event_source_available(
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_source_domain = 'commune' and p_source_type = 'code_revision_proposal' then
    return exists (
      select 1 from public.commune_code_revision_proposals
      where id = p_source_record_id
    );
  end if;
  return true;
end;
$$;

create or replace function public.current_user_inbox_items(
  p_view text default 'attention',
  p_domain text default null,
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_items jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_event_authentication_required';
  end if;
  if coalesce(p_view, 'attention') not in ('attention', 'messages', 'completed', 'archived', 'all') then
    raise exception using errcode = '22023', message = 'account_inbox_view_invalid';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'account_inbox_cursor_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', item.id,
    'kind', item.projection_kind,
    'domain', item.source_domain,
    'sourceType', item.source_type,
    'category', item.category,
    'title', item.safe_title,
    'preview', item.safe_preview,
    'deepLink', item.deep_link,
    'actionKind', item.action_kind,
    'priority', item.priority,
    'readAt', item.read_at,
    'archivedAt', item.archived_at,
    'completedAt', item.completed_at,
    'supersededAt', item.superseded_at,
    'createdAt', item.created_at,
    'sourceAvailable', private.account_event_source_available(
      item.source_domain, item.source_type, item.source_record_id
    ),
    'actor', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle,
      'displayName', card.display_name,
      'avatarUrl', card.avatar_url
    ) end
  ) order by item.created_at desc, item.id desc), '[]'::jsonb)
  into v_items
  from (
    select candidate.*
    from public.account_inbox_items as candidate
    where candidate.recipient_user_id = v_actor
      and (p_domain is null or candidate.source_domain = p_domain)
      and (
        p_before_created_at is null
        or (candidate.created_at, candidate.id) < (p_before_created_at, p_before_id)
      )
      and case coalesce(p_view, 'attention')
        when 'attention' then candidate.archived_at is null
          and candidate.completed_at is null and candidate.superseded_at is null
        when 'messages' then candidate.archived_at is null
          and candidate.projection_kind in ('conversation_request', 'message')
        when 'completed' then candidate.archived_at is null
          and (candidate.completed_at is not null or candidate.superseded_at is not null)
        when 'archived' then candidate.archived_at is not null
        else true
      end
    order by candidate.created_at desc, candidate.id desc
    limit v_limit
  ) as item
  join private.account_events as event on event.id = item.event_id
  left join private.community_safe_public_profile_cards as card
    on card.user_id = event.actor_user_id;
  return pg_catalog.jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

create or replace function public.current_user_notification_items(
  p_filter text default 'all',
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_items jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_event_authentication_required';
  end if;
  if coalesce(p_filter, 'all') not in (
    'all', 'unread', 'account_security', 'community', 'work_reviews',
    'marketplace', 'moderation', 'archived'
  ) then
    raise exception using errcode = '22023', message = 'account_notification_filter_invalid';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'account_notification_cursor_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', item.id,
    'kind', item.projection_kind,
    'domain', item.source_domain,
    'sourceType', item.source_type,
    'category', item.category,
    'mandatory', item.delivery_class = 'mandatory',
    'title', item.safe_title,
    'preview', item.safe_preview,
    'deepLink', item.deep_link,
    'readAt', item.read_at,
    'archivedAt', item.archived_at,
    'createdAt', item.created_at,
    'sourceAvailable', private.account_event_source_available(
      item.source_domain, item.source_type, item.source_record_id
    ),
    'actor', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle,
      'displayName', card.display_name,
      'avatarUrl', card.avatar_url
    ) end
  ) order by item.created_at desc, item.id desc), '[]'::jsonb)
  into v_items
  from (
    select candidate.*
    from public.account_notifications as candidate
    where candidate.recipient_user_id = v_actor
      and (
        p_before_created_at is null
        or (candidate.created_at, candidate.id) < (p_before_created_at, p_before_id)
      )
      and case coalesce(p_filter, 'all')
        when 'unread' then candidate.read_at is null and candidate.archived_at is null
        when 'account_security' then candidate.archived_at is null
          and candidate.category = 'account_security'
        when 'community' then candidate.archived_at is null
          and candidate.category in ('community_replies', 'community_mentions', 'followed_threads', 'announcements')
        when 'work_reviews' then candidate.archived_at is null
          and candidate.category in ('work_reviews', 'sandbox')
        when 'marketplace' then candidate.archived_at is null
          and candidate.category = 'marketplace'
        when 'moderation' then candidate.archived_at is null
          and candidate.category = 'moderation'
        when 'archived' then candidate.archived_at is not null
        else candidate.archived_at is null
      end
    order by candidate.created_at desc, candidate.id desc
    limit v_limit
  ) as item
  join private.account_events as event on event.id = item.event_id
  left join private.community_safe_public_profile_cards as card
    on card.user_id = event.actor_user_id;
  return pg_catalog.jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

create or replace function public.current_user_event_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_event_authentication_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'inboxNeedsAttention', (select pg_catalog.count(*) from public.account_inbox_items
      where recipient_user_id = v_actor and archived_at is null
        and completed_at is null and superseded_at is null),
    'inboxUnread', (select pg_catalog.count(*) from public.account_inbox_items
      where recipient_user_id = v_actor and archived_at is null and read_at is null),
    'messagesUnread', (select pg_catalog.count(*) from public.account_inbox_items
      where recipient_user_id = v_actor and archived_at is null and read_at is null
        and projection_kind in ('conversation_request', 'message')),
    'notificationsUnread', (select pg_catalog.count(*) from public.account_notifications
      where recipient_user_id = v_actor and archived_at is null and read_at is null)
  );
end;
$$;

create or replace function public.set_current_user_inbox_read(
  p_item_id uuid,
  p_read boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  update public.account_inbox_items
  set read_at = case when coalesce(p_read, false) then coalesce(read_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
  where id = p_item_id and recipient_user_id = v_actor;
  if not found then raise exception using errcode = 'P0002', message = 'account_inbox_item_not_found'; end if;
end;
$$;

create or replace function public.set_current_user_inbox_archived(
  p_item_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  update public.account_inbox_items
  set archived_at = case when coalesce(p_archived, false) then coalesce(archived_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
  where id = p_item_id and recipient_user_id = v_actor;
  if not found then raise exception using errcode = 'P0002', message = 'account_inbox_item_not_found'; end if;
end;
$$;

create or replace function public.set_current_user_notification_read(
  p_notification_id uuid,
  p_read boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  update public.account_notifications
  set read_at = case when coalesce(p_read, false) then coalesce(read_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
  where id = p_notification_id and recipient_user_id = v_actor;
  if not found then raise exception using errcode = 'P0002', message = 'account_notification_not_found'; end if;
end;
$$;

create or replace function public.set_current_user_notification_archived(
  p_notification_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  update public.account_notifications
  set archived_at = case when coalesce(p_archived, false) then coalesce(archived_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
  where id = p_notification_id and recipient_user_id = v_actor;
  if not found then raise exception using errcode = 'P0002', message = 'account_notification_not_found'; end if;
end;
$$;

create or replace function public.mark_all_current_user_notifications_read(
  p_category text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_count integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  update public.account_notifications
  set read_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where recipient_user_id = v_actor and read_at is null
    and (p_category is null or category = p_category);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.current_user_account_event_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_preferences jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'category', category_list.category,
    'taxonomyVersion', 1,
    'preferenceVersion', coalesce(preference.preference_version, 0),
    'inAppEnabled', coalesce(preference.in_app_enabled, true),
    'emailEnabled', coalesce(preference.email_enabled, false),
    'quietHoursStart', preference.quiet_hours_start,
    'quietHoursEnd', preference.quiet_hours_end,
    'quietHoursTimezone', coalesce(preference.quiet_hours_timezone, 'UTC')
  ) order by category_list.category)
  into v_preferences
  from (values
    ('account_security'), ('announcements'), ('community_mentions'),
    ('community_replies'), ('followed_threads'), ('marketplace'),
    ('moderation'), ('sandbox'), ('work_reviews')
  ) as category_list(category)
  left join public.account_event_preferences as preference
    on preference.user_id = v_actor and preference.category = category_list.category;
  return pg_catalog.jsonb_build_object('taxonomyVersion', 1, 'preferences', v_preferences);
end;
$$;

create or replace function public.update_current_user_account_event_preference(
  p_category text,
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_preference public.account_event_preferences%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'account_event_authentication_required'; end if;
  if p_category not in (
    'account_security', 'community_replies', 'community_mentions',
    'followed_threads', 'work_reviews', 'marketplace', 'moderation',
    'announcements', 'sandbox'
  ) or (p_quiet_hours_start is null) <> (p_quiet_hours_end is null) then
    raise exception using errcode = '22023', message = 'account_event_preference_invalid';
  end if;
  select preference.* into v_preference
  from public.account_event_preferences as preference
  where preference.user_id = v_actor and preference.category = p_category
  for update;
  if found then
    if p_expected_version is not null and p_expected_version <> v_preference.preference_version then
      raise exception using errcode = '40001', message = 'account_event_preference_version_conflict';
    end if;
    update public.account_event_preferences
    set in_app_enabled = coalesce(p_in_app_enabled, in_app_enabled),
        email_enabled = coalesce(p_email_enabled, email_enabled),
        quiet_hours_start = p_quiet_hours_start,
        quiet_hours_end = p_quiet_hours_end,
        preference_version = preference_version + 1,
        updated_at = pg_catalog.now()
    where user_id = v_actor and category = p_category
    returning * into v_preference;
  else
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'account_event_preference_version_conflict';
    end if;
    insert into public.account_event_preferences(
      user_id, category, in_app_enabled, email_enabled,
      quiet_hours_start, quiet_hours_end
    ) values (
      v_actor, p_category, coalesce(p_in_app_enabled, true),
      coalesce(p_email_enabled, false), p_quiet_hours_start, p_quiet_hours_end
    ) returning * into v_preference;
  end if;
  return pg_catalog.jsonb_build_object(
    'category', v_preference.category,
    'taxonomyVersion', v_preference.taxonomy_version,
    'preferenceVersion', v_preference.preference_version,
    'inAppEnabled', v_preference.in_app_enabled,
    'emailEnabled', v_preference.email_enabled,
    'quietHoursStart', v_preference.quiet_hours_start,
    'quietHoursEnd', v_preference.quiet_hours_end,
    'quietHoursTimezone', v_preference.quiet_hours_timezone
  );
end;
$$;

create or replace function public.claim_account_delivery_outbox(
  p_lease_token uuid,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows jsonb;
begin
  if not private.community_caller_is_service_role() or p_lease_token is null then
    raise exception using errcode = '42501', message = 'account_delivery_service_required';
  end if;
  with candidates as (
    select delivery.id
    from private.account_delivery_outbox as delivery
    where delivery.available_at <= pg_catalog.now()
      and (
        delivery.status in ('pending', 'failed')
        or (delivery.status = 'processing' and delivery.lease_expires_at <= pg_catalog.now())
      )
      and delivery.attempt_count < 20
    order by delivery.available_at, delivery.created_at, delivery.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    for update skip locked
  ), claimed as (
    update private.account_delivery_outbox as delivery
    set status = 'processing', attempt_count = delivery.attempt_count + 1,
        lease_token = p_lease_token,
        lease_expires_at = pg_catalog.now() + interval '5 minutes',
        updated_at = pg_catalog.now()
    from candidates where delivery.id = candidates.id
    returning delivery.*
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'deliveryId', claimed.id,
    'eventId', claimed.event_id,
    'recipientUserId', claimed.recipient_user_id,
    'channel', claimed.channel,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at,
    'category', event.category,
    'mandatory', event.delivery_class = 'mandatory',
    'title', event.safe_title,
    'preview', event.safe_preview,
    'deepLink', event.deep_link
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_rows
  from claimed
  join private.account_events as event on event.id = claimed.event_id;
  return pg_catalog.jsonb_build_object('deliveries', v_rows);
end;
$$;

create or replace function public.complete_account_delivery(
  p_delivery_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'account_delivery_service_required';
  end if;
  update private.account_delivery_outbox
  set status = 'delivered', delivered_at = pg_catalog.now(),
      lease_token = null, lease_expires_at = null, last_error_code = null,
      updated_at = pg_catalog.now()
  where id = p_delivery_id and status = 'processing' and lease_token = p_lease_token;
  if not found then raise exception using errcode = '55000', message = 'account_delivery_lease_invalid'; end if;
end;
$$;

create or replace function public.fail_account_delivery(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt integer;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception using errcode = '42501', message = 'account_delivery_service_required';
  end if;
  select attempt_count into v_attempt
  from private.account_delivery_outbox
  where id = p_delivery_id and status = 'processing' and lease_token = p_lease_token
  for update;
  if not found then raise exception using errcode = '55000', message = 'account_delivery_lease_invalid'; end if;
  update private.account_delivery_outbox
  set status = case when v_attempt >= 10 then 'abandoned' else 'failed' end,
      available_at = pg_catalog.now() + pg_catalog.make_interval(
        secs => least(3600, (30 * pg_catalog.power(2, v_attempt))::integer)
      ),
      lease_token = null, lease_expires_at = null,
      last_error_code = p_error_code, updated_at = pg_catalog.now()
  where id = p_delivery_id;
end;
$$;

do $account_event_function_hardening$
declare v_signature text;
begin
  foreach v_signature in array array[
    'private.record_account_event(text,integer,text,text,uuid,uuid,text,text,text,text,text,text,jsonb,text,text,uuid)',
    'private.account_event_next_delivery_at(uuid,text,text)',
    'private.enqueue_account_event_delivery(uuid,uuid,text)',
    'private.project_account_event(uuid,uuid,text,text,integer,text,boolean)',
    'private.resolve_account_inbox_items(text,text,uuid,uuid,text)',
    'private.account_event_source_available(text,text,uuid)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_signature);
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end
$account_event_function_hardening$;

alter function public.current_user_inbox_items(text, text, integer, timestamptz, uuid) owner to postgres;
alter function public.current_user_notification_items(text, integer, timestamptz, uuid) owner to postgres;
alter function public.current_user_event_counts() owner to postgres;
alter function public.set_current_user_inbox_read(uuid, boolean) owner to postgres;
alter function public.set_current_user_inbox_archived(uuid, boolean) owner to postgres;
alter function public.set_current_user_notification_read(uuid, boolean) owner to postgres;
alter function public.set_current_user_notification_archived(uuid, boolean) owner to postgres;
alter function public.mark_all_current_user_notifications_read(text) owner to postgres;
alter function public.current_user_account_event_preferences() owner to postgres;
alter function public.update_current_user_account_event_preference(text, boolean, boolean, time, time, integer) owner to postgres;
alter function public.claim_account_delivery_outbox(uuid, integer) owner to postgres;
alter function public.complete_account_delivery(uuid, uuid) owner to postgres;
alter function public.fail_account_delivery(uuid, uuid, text) owner to postgres;

revoke all privileges on function public.current_user_inbox_items(text, text, integer, timestamptz, uuid) from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_notification_items(text, integer, timestamptz, uuid) from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_event_counts() from public, anon, authenticated, service_role;
revoke all privileges on function public.set_current_user_inbox_read(uuid, boolean) from public, anon, authenticated, service_role;
revoke all privileges on function public.set_current_user_inbox_archived(uuid, boolean) from public, anon, authenticated, service_role;
revoke all privileges on function public.set_current_user_notification_read(uuid, boolean) from public, anon, authenticated, service_role;
revoke all privileges on function public.set_current_user_notification_archived(uuid, boolean) from public, anon, authenticated, service_role;
revoke all privileges on function public.mark_all_current_user_notifications_read(text) from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_account_event_preferences() from public, anon, authenticated, service_role;
revoke all privileges on function public.update_current_user_account_event_preference(text, boolean, boolean, time, time, integer) from public, anon, authenticated, service_role;
revoke all privileges on function public.claim_account_delivery_outbox(uuid, integer) from public, anon, authenticated, service_role;
revoke all privileges on function public.complete_account_delivery(uuid, uuid) from public, anon, authenticated, service_role;
revoke all privileges on function public.fail_account_delivery(uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.current_user_inbox_items(text, text, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.current_user_notification_items(text, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.current_user_event_counts() to authenticated, service_role;
grant execute on function public.set_current_user_inbox_read(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_current_user_inbox_archived(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_current_user_notification_read(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_current_user_notification_archived(uuid, boolean) to authenticated, service_role;
grant execute on function public.mark_all_current_user_notifications_read(text) to authenticated, service_role;
grant execute on function public.current_user_account_event_preferences() to authenticated, service_role;
grant execute on function public.update_current_user_account_event_preference(text, boolean, boolean, time, time, integer) to authenticated, service_role;
grant execute on function public.claim_account_delivery_outbox(uuid, integer) to service_role;
grant execute on function public.complete_account_delivery(uuid, uuid) to service_role;
grant execute on function public.fail_account_delivery(uuid, uuid, text) to service_role;

comment on table private.account_events is
  'Immutable source-event facts. Events reference authoritative domain records and never grant source authorization.';
comment on table public.account_inbox_items is
  'Recipient-scoped actionable projections. Private source bodies remain in their domain tables.';
comment on table public.account_notifications is
  'Recipient-scoped informational projections with preference-aware creation and exact unread state.';
comment on table private.account_delivery_outbox is
  'Server-owned optional delivery queue. Rows contain references and retry evidence, not private source bodies.';
comment on table public.account_event_preferences is
  'Versioned Commons event-delivery preferences. Mandatory event delivery bypasses suppressible preferences.';

commit;

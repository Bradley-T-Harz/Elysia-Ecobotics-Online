-- Governed, participant-scoped private communication for the Commons Inbox.
-- Message bodies stay in dedicated private records; immutable account events
-- contain safe metadata only and never grant source-workflow authority.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '3min';

alter table private.account_restrictions
  drop constraint account_restriction_scope_check;
alter table private.account_restrictions
  add constraint account_restriction_scope_check check (
    scope in (
      'all_public_communities', 'commons_profile_publication',
      'commune_posting', 'commune_commenting', 'private_messaging',
      'marketplace_publishing', 'job_posting',
      'artisan_membership', 'artisan_posting',
      'artisan_commenting', 'artisan_appreciation', 'artisan_uploading',
      'artisan_challenges', 'artisan_notifications'
    )
  );

alter table public.account_event_preferences
  drop constraint account_event_preferences_category_check;
alter table public.account_event_preferences
  add constraint account_event_preferences_category_check check (
    category in (
      'account_security', 'community_replies', 'community_mentions',
      'followed_threads', 'private_messages', 'work_reviews', 'marketplace',
      'moderation', 'announcements', 'sandbox'
    )
  );

create table public.account_messaging_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preference_version integer not null default 1,
  receive_direct_requests boolean not null default false,
  receive_optional_announcements boolean not null default false,
  allow_source_linked_messages boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint account_messaging_preference_version_check
    check (preference_version >= 1)
);

create table private.account_conversation_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  unique (blocker_user_id, client_request_id),
  constraint account_conversation_block_distinct_check
    check (blocker_user_id <> blocked_user_id)
);

create table private.account_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null,
  subject text not null,
  source_domain text,
  source_type text,
  source_record_id uuid,
  created_by_user_id uuid references auth.users(id) on delete set null,
  creation_client_request_id uuid,
  creation_payload_sha256 text,
  state text not null,
  reply_policy text not null,
  retention_class text not null default 'account_lifecycle',
  direct_pair_key text,
  moderation_hold boolean not null default false,
  last_message_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by_user_id, creation_client_request_id),
  constraint account_conversation_type_check check (
    conversation_type in (
      'direct', 'source_linked', 'account_support', 'admin_account',
      'admin_announcement', 'system_notice', 'required_action'
    )
  ),
  constraint account_conversation_subject_check check (
    pg_catalog.char_length(pg_catalog.btrim(subject)) between 1 and 160
    and subject !~ '[[:cntrl:]]'
    and subject !~ '<'
  ),
  constraint account_conversation_source_check check (
    (source_domain is null and source_type is null and source_record_id is null)
    or (
      source_domain ~ '^[a-z][a-z0-9_]{1,79}$'
      and source_type ~ '^[a-z][a-z0-9_]{1,119}$'
      and source_record_id is not null
    )
  ),
  constraint account_conversation_idempotency_payload_check check (
    (creation_client_request_id is null and creation_payload_sha256 is null)
    or (
      creation_client_request_id is not null
      and creation_payload_sha256 ~ '^[0-9a-f]{64}$'
    )
  ),
  constraint account_conversation_state_check check (
    state in ('requested', 'active', 'declined', 'closed', 'nonreplyable')
  ),
  constraint account_conversation_reply_policy_check check (
    reply_policy in ('participants', 'admin_and_recipient', 'none')
  ),
  constraint account_conversation_retention_check check (
    retention_class in ('ephemeral', 'source_lifecycle', 'account_lifecycle', 'audit', 'legal')
  ),
  constraint account_conversation_direct_pair_check check (
    (conversation_type = 'direct' and direct_pair_key is not null)
    or (conversation_type <> 'direct' and direct_pair_key is null)
  ),
  constraint account_conversation_closed_check check (
    (state in ('declined', 'closed', 'nonreplyable') and closed_at is not null)
    or (state in ('requested', 'active') and closed_at is null)
  )
);

create unique index account_conversations_active_direct_pair_idx
  on private.account_conversations(direct_pair_key)
  where conversation_type = 'direct' and state in ('requested', 'active');
create index account_conversations_source_idx
  on private.account_conversations(source_domain, source_type, source_record_id)
  where source_record_id is not null;
create index account_conversations_last_message_idx
  on private.account_conversations(last_message_at desc nulls last, id);

create table private.account_conversation_participants (
  conversation_id uuid not null references private.account_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null,
  participation_state text not null,
  last_read_at timestamptz,
  archived_at timestamptz,
  muted_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  constraint account_conversation_participant_role_check check (
    participant_role in (
      'requester', 'recipient', 'participant', 'support_requester',
      'support_staff', 'administrator', 'audience_recipient', 'system'
    )
  ),
  constraint account_conversation_participation_state_check check (
    participation_state in ('pending', 'accepted', 'declined', 'removed')
  )
);

create index account_conversation_participant_user_idx
  on private.account_conversation_participants(
    user_id, archived_at, updated_at desc, conversation_id
  );

create table private.account_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.account_conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_kind text not null,
  client_message_id uuid not null,
  body text not null,
  body_format text not null default 'plain_text',
  edited_at timestamptz,
  deleted_at timestamptz,
  moderation_hold boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_message_id),
  constraint account_message_sender_kind_check check (
    sender_kind in ('user', 'administrator', 'system')
  ),
  constraint account_message_sender_check check (
    (sender_kind = 'system' and sender_user_id is null)
    or sender_kind in ('user', 'administrator')
  ),
  constraint account_message_format_check check (body_format = 'plain_text'),
  constraint account_message_body_length_check check (
    pg_catalog.char_length(pg_catalog.btrim(body)) between 1 and 8000
  ),
  constraint account_message_deleted_check check (
    deleted_at is null or body = '[Message removed by sender]'
  )
);

create index account_messages_conversation_created_idx
  on private.account_messages(conversation_id, created_at desc, id desc);
create index account_messages_sender_rate_idx
  on private.account_messages(sender_user_id, created_at desc)
  where sender_user_id is not null;

create table private.account_message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references private.account_messages(id) on delete cascade,
  editor_user_id uuid references auth.users(id) on delete set null,
  prior_body text not null,
  revision_kind text not null,
  created_at timestamptz not null default now(),
  constraint account_message_revision_kind_check check (
    revision_kind in ('edit', 'sender_tombstone', 'moderation_tombstone')
  )
);

create table private.account_conversation_reports (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  reporter_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid not null references private.account_conversations(id) on delete restrict,
  message_id uuid references private.account_messages(id) on delete restrict,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason_code text not null,
  details text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_user_id, client_request_id),
  constraint account_conversation_report_reason_check check (
    reason_code in (
      'spam', 'harassment', 'threats', 'hate_or_abuse', 'sexual_content',
      'privacy_or_pii', 'fraud_or_impersonation', 'malicious_link', 'other'
    )
  ),
  constraint account_conversation_report_details_check check (
    details is null or pg_catalog.char_length(pg_catalog.btrim(details)) between 1 and 2000
  ),
  constraint account_conversation_report_status_check check (
    status in ('submitted', 'under_review', 'action_taken', 'dismissed', 'closed')
  )
);

create table private.account_conversation_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references private.account_conversation_reports(id) on delete restrict,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'unassigned',
  legal_hold boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  resolved_at timestamptz,
  resolution_code text,
  constraint account_conversation_case_status_check check (
    status in ('unassigned', 'assigned', 'investigating', 'resolved', 'closed')
  ),
  constraint account_conversation_case_resolution_check check (
    (status in ('resolved', 'closed') and resolved_at is not null and resolution_code is not null)
    or (status not in ('resolved', 'closed') and resolved_at is null and resolution_code is null)
  )
);

create table private.account_conversation_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  action text not null,
  conversation_id uuid references private.account_conversations(id) on delete set null,
  message_id uuid references private.account_messages(id) on delete set null,
  report_id uuid references private.account_conversation_reports(id) on delete set null,
  case_id uuid references private.account_conversation_moderation_cases(id) on delete set null,
  client_request_id uuid,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_conversation_audit_actor_kind_check check (
    actor_kind in ('user', 'administrator', 'moderator', 'service', 'system')
  ),
  constraint account_conversation_audit_action_check check (
    action ~ '^[a-z][a-z0-9_]{2,99}$'
  ),
  constraint account_conversation_audit_metadata_check check (
    pg_catalog.jsonb_typeof(safe_metadata) = 'object'
    and pg_catalog.octet_length(safe_metadata::text) <= 4000
  )
);

create table private.account_support_queue (
  conversation_id uuid primary key references private.account_conversations(id) on delete cascade,
  queue_status text not null default 'unassigned',
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  priority smallint not null default 50,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  closed_at timestamptz,
  constraint account_support_queue_status_check check (
    queue_status in ('unassigned', 'assigned', 'waiting_on_user', 'waiting_on_staff', 'closed')
  ),
  constraint account_support_queue_priority_check check (priority between 0 and 100)
);

create table private.account_announcement_drafts (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  created_by_user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  body text not null,
  audience_kind text not null,
  audience_handles text[],
  recipient_count integer not null,
  expires_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_announcement_audience_check check (
    audience_kind in ('explicit_opted_in_handles', 'all_opted_in_adults', 'administrators')
  ),
  constraint account_announcement_handles_check check (
    (audience_kind = 'explicit_opted_in_handles'
      and audience_handles is not null
      and pg_catalog.cardinality(audience_handles) between 1 and 100)
    or (audience_kind <> 'explicit_opted_in_handles' and audience_handles is null)
  ),
  constraint account_announcement_recipient_count_check check (
    recipient_count between 1 and 500
  ),
  constraint account_announcement_expiry_check check (expires_at > created_at)
);

create table private.account_announcement_deliveries (
  announcement_id uuid not null references private.account_announcement_drafts(id) on delete restrict,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  conversation_id uuid not null references private.account_conversations(id) on delete restrict,
  message_id uuid not null references private.account_messages(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (announcement_id, recipient_user_id)
);

do $account_conversation_table_hardening$
declare v_table text; v_backend_role text := 'service' || '_role';
begin
  foreach v_table in array array[
    'account_conversation_blocks', 'account_conversations',
    'account_conversation_participants', 'account_messages',
    'account_message_revisions', 'account_conversation_reports',
    'account_conversation_moderation_cases', 'account_conversation_audit_events',
    'account_support_queue', 'account_announcement_drafts',
    'account_announcement_deliveries'
  ] loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated',
      v_table
    );
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from %I',
      v_table, v_backend_role
    );
  end loop;
end
$account_conversation_table_hardening$;

alter table public.account_messaging_preferences owner to postgres;
alter table public.account_messaging_preferences enable row level security;
revoke all privileges on public.account_messaging_preferences
  from public, anon, authenticated;
create policy "account owners read messaging preferences"
  on public.account_messaging_preferences for select to authenticated
  using (user_id = auth.uid());
grant select on public.account_messaging_preferences to authenticated;
do $account_messaging_backend_role_grants$
declare v_backend_role text := 'service' || '_role';
begin
  execute pg_catalog.format(
    'revoke all privileges on table public.account_messaging_preferences from %I',
    v_backend_role
  );
  execute pg_catalog.format(
    'grant select on table public.account_messaging_preferences to %I',
    v_backend_role
  );
end
$account_messaging_backend_role_grants$;

create policy "conversation participants may read conversation shells"
  on private.account_conversations for select to authenticated
  using (exists (
    select 1 from private.account_conversation_participants as participant
    where participant.conversation_id = account_conversations.id
      and participant.user_id = auth.uid()
      and participant.participation_state <> 'removed'
  ));
create policy "participants may read own participation rows"
  on private.account_conversation_participants for select to authenticated
  using (user_id = auth.uid());
create policy "conversation participants may read messages"
  on private.account_messages for select to authenticated
  using (exists (
    select 1 from private.account_conversation_participants as participant
    where participant.conversation_id = account_messages.conversation_id
      and participant.user_id = auth.uid()
      and participant.participation_state <> 'removed'
  ));
create policy "reporters may read own conversation reports"
  on private.account_conversation_reports for select to authenticated
  using (reporter_user_id = auth.uid());

create or replace function private.account_message_revision_is_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.editor_user_id is not null
     and new.editor_user_id is null
     and (pg_catalog.to_jsonb(new) - 'editor_user_id')
       = (pg_catalog.to_jsonb(old) - 'editor_user_id') then
    return new;
  end if;
  raise exception using errcode = '55000', message = 'account_message_revision_is_immutable';
end;
$$;

create or replace function private.account_conversation_audit_is_immutable()
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
  raise exception using errcode = '55000', message = 'account_conversation_audit_is_immutable';
end;
$$;

create trigger account_message_revisions_are_append_only
before update or delete on private.account_message_revisions
for each row execute function private.account_message_revision_is_immutable();
create trigger account_conversation_audit_is_append_only
before update or delete on private.account_conversation_audit_events
for each row execute function private.account_conversation_audit_is_immutable();

create or replace function private.account_message_text_is_safe(
  p_text text,
  p_max_length integer
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_text is not null
    and pg_catalog.char_length(pg_catalog.btrim(p_text)) between 1 and p_max_length
    and p_text !~ E'[\\001-\\010\\013\\014\\016-\\037\\177]'
    and p_text !~* '<[[:space:]]*/?[[:space:]]*(script|style|iframe|object|embed|svg|img|link|meta|form)([[:space:]>]|$)'
    and p_text !~* '(javascript|vbscript|data)[[:space:]]*:';
$$;

create or replace function private.account_conversation_creation_fingerprint(
  p_payload jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.account_private_messaging_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'private_messaging')
    and not private.community_has_active_restriction(p_user_id, 'commune_commenting')
    and exists (
      select 1 from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state = 'adult_eligible'
        and participation.age_band = '18_plus'
        and participation.assurance_status not in ('restricted', 'blocked', 'verification_expired')
    ),
    false
  );
$$;

create or replace function private.account_message_moderator_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null and (
      public.has_role(p_user_id, 'administrator'::public.app_role)
      or public.has_role(p_user_id, 'moderator'::public.app_role)
      or public.has_role(p_user_id, 'commune_moderator'::public.app_role)
      or coalesce((select profile.is_admin from public.profiles as profile where profile.id = p_user_id), false)
    ),
    false
  );
$$;

create or replace function private.account_conversation_has_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1 from private.account_conversation_participants as participant
    where participant.conversation_id = p_conversation_id
      and participant.user_id = p_user_id
      and participant.participation_state <> 'removed'
  ), false);
$$;

create or replace function private.account_conversation_pair_blocked(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1 from private.account_conversation_blocks as block
    where (block.blocker_user_id = p_first_user_id and block.blocked_user_id = p_second_user_id)
       or (block.blocker_user_id = p_second_user_id and block.blocked_user_id = p_first_user_id)
  ), false);
$$;

create or replace function private.account_messaging_user_from_public_handle(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select card.user_id
  from private.community_safe_online_public_profile_cards as card
  where card.handle = pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_handle, '')), '@'))
  limit 1;
$$;

create or replace function private.account_admin_user_from_handle(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select card.user_id
  from public.profile_public_cards as card
  where card.handle = pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_handle, '')), '@'))
  limit 1;
$$;

create or replace function private.record_account_conversation_audit(
  p_actor_user_id uuid,
  p_actor_kind text,
  p_action text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_report_id uuid default null,
  p_case_id uuid default null,
  p_client_request_id uuid default null,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into private.account_conversation_audit_events(
    actor_user_id, actor_kind, action, conversation_id, message_id,
    report_id, case_id, client_request_id, safe_metadata
  ) values (
    p_actor_user_id, p_actor_kind, p_action, p_conversation_id, p_message_id,
    p_report_id, p_case_id, p_client_request_id,
    coalesce(p_safe_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.account_support_source_allowed(
  p_actor uuid,
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
  if p_source_domain is null and p_source_type is null and p_source_record_id is null then
    return true;
  end if;
  if p_source_domain = 'work_with' and p_source_type = 'work_with_request' then
    return exists (
      select 1 from public.work_with_requests as request
      where request.id = p_source_record_id and request.user_id = p_actor
    );
  elsif p_source_domain = 'commune' and p_source_type = 'code_revision_proposal' then
    return exists (
      select 1 from public.commune_code_revision_proposals as proposal
      where proposal.id = p_source_record_id
        and p_actor in (proposal.proposer_user_id, proposal.original_author_user_id)
    );
  elsif p_source_domain = 'moderation' and p_source_type = 'commune_report' then
    return exists (
      select 1 from public.commune_reports as report
      where report.id = p_source_record_id and report.reporter_user_id = p_actor
    );
  elsif p_source_domain = 'moderation' and p_source_type = 'content_report' then
    return exists (
      select 1 from public.content_reports as report
      where report.id = p_source_record_id and report.reporter_user_id = p_actor
    );
  end if;
  return false;
end;
$$;

create or replace function private.account_admin_source_recipient(
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid;
begin
  if p_source_domain = 'work_with' and p_source_type = 'work_with_request' then
    select request.user_id into v_user_id
    from public.work_with_requests as request where request.id = p_source_record_id;
  elsif p_source_domain = 'commune' and p_source_type = 'job_post' then
    select job.author_user_id into v_user_id
    from public.commune_job_posts as job where job.id = p_source_record_id;
  elsif p_source_domain = 'marketplace' and p_source_type = 'addon_submission' then
    select submission.submitted_by into v_user_id
    from public.addon_submissions as submission where submission.id = p_source_record_id;
  elsif p_source_domain = 'moderation' and p_source_type = 'commune_report' then
    select report.reporter_user_id into v_user_id
    from public.commune_reports as report where report.id = p_source_record_id;
  elsif p_source_domain = 'moderation' and p_source_type = 'content_report' then
    select report.reporter_user_id into v_user_id
    from public.content_reports as report where report.id = p_source_record_id;
  end if;
  return v_user_id;
end;
$$;

create or replace function private.account_source_linked_counterpart(
  p_actor uuid,
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_proposal public.commune_code_revision_proposals%rowtype;
begin
  if p_source_domain <> 'code_proposals'
     or p_source_type <> 'commune_code_revision_proposal' then
    return null;
  end if;
  select proposal.* into v_proposal
  from public.commune_code_revision_proposals as proposal
  where proposal.id = p_source_record_id;
  if not found then return null; end if;
  if p_actor = v_proposal.proposer_user_id then return v_proposal.original_author_user_id; end if;
  if p_actor = v_proposal.original_author_user_id then return v_proposal.proposer_user_id; end if;
  return null;
end;
$$;

create or replace function private.create_account_conversation_message(
  p_conversation_id uuid,
  p_sender_user_id uuid,
  p_sender_kind text,
  p_body text,
  p_client_message_id uuid,
  p_project_to_recipients boolean default true,
  p_delivery_class text default 'suppressible',
  p_notification_kind text default null,
  p_priority integer default 50
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation private.account_conversations%rowtype;
  v_existing private.account_messages%rowtype;
  v_message_id uuid;
  v_recipient record;
  v_event_id uuid;
  v_sender_kind text := coalesce(p_sender_kind, 'user');
begin
  if p_client_message_id is null
     or not private.account_message_text_is_safe(p_body, 8000) then
    raise exception using errcode = '22023', message = 'account_message_invalid';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id
  for update;

  select message.* into v_existing
  from private.account_messages as message
  where message.conversation_id = p_conversation_id
    and message.client_message_id = p_client_message_id
  for update;
  if found then
    if v_existing.sender_user_id is distinct from p_sender_user_id
       or v_existing.sender_kind is distinct from v_sender_kind
       or v_existing.body is distinct from p_body then
      raise exception using errcode = '23505', message = 'account_message_idempotency_conflict';
    end if;
    return v_existing.id;
  end if;

  if v_sender_kind = 'administrator' then
    if p_sender_user_id is null or not public.has_role(
      p_sender_user_id, 'administrator'::public.app_role
    ) and not coalesce((
      select profile.is_admin from public.profiles as profile
      where profile.id = p_sender_user_id
    ), false) then
      raise exception using errcode = '42501', message = 'account_message_admin_required';
    end if;
  elsif v_sender_kind = 'user' then
    if p_sender_user_id is null
       or not private.account_conversation_has_participant(
         p_conversation_id, p_sender_user_id
       ) then
      raise exception using errcode = '42501', message = 'account_message_participant_required';
    end if;
    if (
      v_conversation.state <> 'active'
      and not (
        not p_project_to_recipients
        and v_conversation.state = 'requested'
        and v_conversation.created_by_user_id = p_sender_user_id
      )
    ) or v_conversation.reply_policy = 'none' then
      raise exception using errcode = '55000', message = 'account_conversation_not_replyable';
    end if;
    if v_conversation.conversation_type in ('direct', 'source_linked')
       and not private.account_private_messaging_allowed(p_sender_user_id) then
      raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
    end if;
  elsif v_sender_kind <> 'system' then
    raise exception using errcode = '22023', message = 'account_message_sender_kind_invalid';
  end if;

  if p_sender_user_id is not null and (
    select pg_catalog.count(*)
    from private.account_messages as recent
    where recent.sender_user_id = p_sender_user_id
      and recent.created_at > pg_catalog.now() - interval '10 minutes'
  ) >= 30 then
    raise exception using errcode = '54000', message = 'account_message_rate_limited';
  end if;
  if p_sender_user_id is not null and (
    select pg_catalog.count(*)
    from private.account_messages as recent
    where recent.sender_user_id = p_sender_user_id
      and recent.created_at > pg_catalog.now() - interval '1 day'
  ) >= 200 then
    raise exception using errcode = '54000', message = 'account_message_daily_rate_limited';
  end if;

  if p_sender_user_id is not null and exists (
    select 1
    from private.account_conversation_participants as other_participant
    where other_participant.conversation_id = p_conversation_id
      and other_participant.user_id <> p_sender_user_id
      and private.account_conversation_pair_blocked(
        p_sender_user_id, other_participant.user_id
      )
  ) then
    raise exception using errcode = '42501', message = 'account_conversation_blocked';
  end if;

  insert into private.account_messages(
    conversation_id, sender_user_id, sender_kind, client_message_id, body
  ) values (
    p_conversation_id, p_sender_user_id, v_sender_kind,
    p_client_message_id, p_body
  ) returning id into v_message_id;

  update private.account_conversations
  set last_message_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_conversation_id;

  perform private.record_account_conversation_audit(
    p_sender_user_id,
    case when v_sender_kind = 'administrator' then 'administrator'
      when v_sender_kind = 'system' then 'system' else 'user' end,
    'message_created', p_conversation_id, v_message_id,
    null, null, p_client_message_id,
    pg_catalog.jsonb_build_object('senderKind', v_sender_kind)
  );

  if p_project_to_recipients then
    for v_recipient in
      select participant.user_id
      from private.account_conversation_participants as participant
      where participant.conversation_id = p_conversation_id
        and participant.user_id is distinct from p_sender_user_id
        and participant.participation_state = 'accepted'
    loop
      v_event_id := private.record_account_event(
        'account_message.received', 1, 'conversations', 'private_message',
        v_message_id, p_sender_user_id,
        case when v_sender_kind = 'administrator' then 'staff'
          when v_sender_kind = 'system' then 'system' else 'user' end,
        'account-message:' || v_message_id::text || ':' || v_recipient.user_id::text || ':received:v1',
        p_delivery_class, 'private_messages',
        case when v_sender_kind = 'administrator' then 'New administrator message'
          when v_sender_kind = 'system' then 'New system message'
          else 'New private message' end,
        'Open the governed Inbox conversation to read it.',
        pg_catalog.jsonb_build_object('conversationId', p_conversation_id),
        '/commons-circle/inbox?conversation=' || p_conversation_id::text,
        v_conversation.retention_class, p_client_message_id
      );
      perform private.project_account_event(
        v_event_id, v_recipient.user_id, 'message', 'open_conversation',
        p_priority, p_notification_kind,
        p_delivery_class = 'mandatory'
      );
      update private.account_conversation_participants
      set archived_at = null, updated_at = pg_catalog.now()
      where conversation_id = p_conversation_id and user_id = v_recipient.user_id;
    end loop;
  end if;
  return v_message_id;
end;
$$;

create or replace function public.current_user_messaging_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_preference public.account_messaging_preferences%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  select preference.* into v_preference
  from public.account_messaging_preferences as preference
  where preference.user_id = v_actor;
  return pg_catalog.jsonb_build_object(
    'preferenceVersion', coalesce(v_preference.preference_version, 0),
    'receiveDirectRequests', coalesce(v_preference.receive_direct_requests, false),
    'receiveOptionalAnnouncements', coalesce(v_preference.receive_optional_announcements, false),
    'allowSourceLinkedMessages', coalesce(v_preference.allow_source_linked_messages, true),
    'ordinaryMessagingEligible', private.account_private_messaging_allowed(v_actor),
    'storedInSupabase', true,
    'endToEndEncrypted', false
  );
end;
$$;

create or replace function public.update_current_user_messaging_preferences(
  p_receive_direct_requests boolean,
  p_receive_optional_announcements boolean,
  p_allow_source_linked_messages boolean,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_preference public.account_messaging_preferences%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if coalesce(p_receive_direct_requests, false)
     and not private.account_private_messaging_allowed(v_actor) then
    raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
  end if;
  select preference.* into v_preference
  from public.account_messaging_preferences as preference
  where preference.user_id = v_actor for update;
  if found then
    if p_expected_version is not null
       and p_expected_version <> v_preference.preference_version then
      raise exception using errcode = '40001', message = 'account_messaging_preference_version_conflict';
    end if;
    update public.account_messaging_preferences
    set receive_direct_requests = coalesce(p_receive_direct_requests, receive_direct_requests),
        receive_optional_announcements = coalesce(
          p_receive_optional_announcements, receive_optional_announcements
        ),
        allow_source_linked_messages = coalesce(
          p_allow_source_linked_messages, allow_source_linked_messages
        ),
        preference_version = preference_version + 1,
        updated_at = pg_catalog.now()
    where user_id = v_actor returning * into v_preference;
  else
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'account_messaging_preference_version_conflict';
    end if;
    insert into public.account_messaging_preferences(
      user_id, receive_direct_requests, receive_optional_announcements,
      allow_source_linked_messages
    ) values (
      v_actor, coalesce(p_receive_direct_requests, false),
      coalesce(p_receive_optional_announcements, false),
      coalesce(p_allow_source_linked_messages, true)
    ) returning * into v_preference;
  end if;
  return public.current_user_messaging_preferences();
end;
$$;

create or replace function public.lookup_account_messaging_recipient(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_card record;
  v_opted_in boolean := false;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if not private.account_private_messaging_allowed(v_actor) then
    return pg_catalog.jsonb_build_object('found', false, 'eligible', false);
  end if;
  v_recipient := private.account_messaging_user_from_public_handle(p_handle);
  if v_recipient is null or v_recipient = v_actor then
    return pg_catalog.jsonb_build_object('found', false, 'eligible', true);
  end if;
  select card.handle, card.display_name, card.avatar_url into v_card
  from private.community_safe_online_public_profile_cards as card
  where card.user_id = v_recipient;
  select coalesce(preference.receive_direct_requests, false) into v_opted_in
  from public.account_messaging_preferences as preference
  where preference.user_id = v_recipient;
  return pg_catalog.jsonb_build_object(
    'found', true,
    'eligible', private.account_private_messaging_allowed(v_recipient),
    'canReceiveRequest', coalesce(v_opted_in, false)
      and private.account_private_messaging_allowed(v_recipient)
      and not private.account_conversation_pair_blocked(v_actor, v_recipient),
    'profile', pg_catalog.jsonb_build_object(
      'handle', v_card.handle,
      'displayName', v_card.display_name,
      'avatarUrl', v_card.avatar_url
    )
  );
end;
$$;

create or replace function public.request_account_conversation(
  p_recipient_handle text,
  p_subject text,
  p_body text,
  p_client_request_id uuid,
  p_client_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_conversation private.account_conversations%rowtype;
  v_message_id uuid;
  v_event_id uuid;
  v_pair_key text;
  v_opted_in boolean := false;
  v_fingerprint text;
begin
  if v_actor is null or p_client_request_id is null or p_client_message_id is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if not private.account_private_messaging_allowed(v_actor)
     or not private.account_message_text_is_safe(p_subject, 160)
     or not private.account_message_text_is_safe(p_body, 8000) then
    raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
  end if;
  v_fingerprint := private.account_conversation_creation_fingerprint(
    pg_catalog.jsonb_build_object(
      'kind', 'direct',
      'recipientHandle', pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(p_recipient_handle), '@')),
      'subject', pg_catalog.btrim(p_subject),
      'body', p_body,
      'clientMessageId', p_client_message_id
    )
  );
  select conversation.* into v_conversation
  from private.account_conversations as conversation
  where conversation.created_by_user_id = v_actor
    and conversation.creation_client_request_id = p_client_request_id
  for update;
  if found then
    if v_conversation.creation_payload_sha256 is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'account_conversation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state,
      'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
    );
  end if;
  if (
    select pg_catalog.count(*) from private.account_conversations as recent
    where recent.created_by_user_id = v_actor
      and recent.conversation_type = 'direct'
      and recent.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'account_conversation_request_rate_limited';
  end if;
  v_recipient := private.account_messaging_user_from_public_handle(p_recipient_handle);
  if v_recipient is null or v_recipient = v_actor
     or not private.account_private_messaging_allowed(v_recipient)
     or private.account_conversation_pair_blocked(v_actor, v_recipient) then
    raise exception using errcode = 'P0002', message = 'account_messaging_recipient_unavailable';
  end if;
  select coalesce(preference.receive_direct_requests, false) into v_opted_in
  from public.account_messaging_preferences as preference
  where preference.user_id = v_recipient;
  if not coalesce(v_opted_in, false) then
    raise exception using errcode = 'P0002', message = 'account_messaging_recipient_unavailable';
  end if;
  v_pair_key := least(v_actor::text, v_recipient::text)
    || ':' || greatest(v_actor::text, v_recipient::text);
  if exists (
    select 1 from private.account_conversations as existing
    where existing.direct_pair_key = v_pair_key
      and existing.state in ('requested', 'active')
  ) then
    raise exception using errcode = '23505', message = 'account_conversation_already_exists';
  end if;
  insert into private.account_conversations(
    conversation_type, subject, created_by_user_id, creation_client_request_id,
    creation_payload_sha256, state, reply_policy, retention_class, direct_pair_key
  ) values (
    'direct', pg_catalog.btrim(p_subject), v_actor, p_client_request_id,
    v_fingerprint, 'requested', 'participants', 'account_lifecycle', v_pair_key
  ) returning * into v_conversation;
  insert into private.account_conversation_participants(
    conversation_id, user_id, participant_role, participation_state, last_read_at
  ) values
    (v_conversation.id, v_actor, 'requester', 'accepted', pg_catalog.now()),
    (v_conversation.id, v_recipient, 'recipient', 'pending', null);
  v_message_id := private.create_account_conversation_message(
    v_conversation.id, v_actor, 'user', p_body, p_client_message_id,
    false, 'suppressible', null, 50
  );
  v_event_id := private.record_account_event(
    'account_conversation.requested', 1, 'conversations', 'conversation_request',
    v_conversation.id, v_actor, 'user',
    'account-conversation:' || v_conversation.id::text || ':requested:v1',
    'suppressible', 'private_messages', 'New conversation request',
    'Accept or decline this request before private replies are enabled.',
    pg_catalog.jsonb_build_object('conversationId', v_conversation.id),
    '/commons-circle/inbox?conversation=' || v_conversation.id::text,
    'account_lifecycle', p_client_request_id
  );
  perform private.project_account_event(
    v_event_id, v_recipient, 'conversation_request',
    'respond_to_conversation_request', 65, null, false
  );
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'conversation_requested', v_conversation.id,
    v_message_id, null, null, p_client_request_id,
    pg_catalog.jsonb_build_object('conversationType', 'direct')
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', v_conversation.id, 'state', v_conversation.state,
    'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
  );
end;
$$;

create or replace function public.start_source_linked_account_conversation(
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid,
  p_subject text,
  p_body text,
  p_client_request_id uuid,
  p_client_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_conversation private.account_conversations%rowtype;
  v_message_id uuid;
  v_event_id uuid;
  v_recipient_allows boolean := true;
  v_fingerprint text;
begin
  if v_actor is null or p_source_record_id is null
     or p_client_request_id is null or p_client_message_id is null
     or not private.account_private_messaging_allowed(v_actor)
     or not private.account_message_text_is_safe(p_subject, 160)
     or not private.account_message_text_is_safe(p_body, 8000) then
    raise exception using errcode = '42501', message = 'account_source_conversation_not_allowed';
  end if;
  v_fingerprint := private.account_conversation_creation_fingerprint(
    pg_catalog.jsonb_build_object(
      'kind', 'source_linked', 'sourceDomain', p_source_domain,
      'sourceType', p_source_type, 'sourceRecordId', p_source_record_id,
      'subject', pg_catalog.btrim(p_subject), 'body', p_body,
      'clientMessageId', p_client_message_id
    )
  );
  select conversation.* into v_conversation
  from private.account_conversations as conversation
  where conversation.created_by_user_id = v_actor
    and conversation.creation_client_request_id = p_client_request_id
  for update;
  if found then
    if v_conversation.creation_payload_sha256 is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'account_conversation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state,
      'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
    );
  end if;
  v_recipient := private.account_source_linked_counterpart(
    v_actor, p_source_domain, p_source_type, p_source_record_id
  );
  if v_recipient is null or v_recipient = v_actor
     or not private.account_private_messaging_allowed(v_recipient)
     or private.account_conversation_pair_blocked(v_actor, v_recipient) then
    raise exception using errcode = '42501', message = 'account_source_conversation_not_allowed';
  end if;
  select coalesce(preference.allow_source_linked_messages, true)
    into v_recipient_allows
  from public.account_messaging_preferences as preference
  where preference.user_id = v_recipient;
  if not coalesce(v_recipient_allows, true) then
    raise exception using errcode = '42501', message = 'account_source_conversation_not_allowed';
  end if;
  insert into private.account_conversations(
    conversation_type, subject, source_domain, source_type, source_record_id,
    created_by_user_id, creation_client_request_id, state, reply_policy,
    retention_class, creation_payload_sha256
  ) values (
    'source_linked', pg_catalog.btrim(p_subject), p_source_domain,
    p_source_type, p_source_record_id, v_actor, p_client_request_id,
    'active', 'participants', 'source_lifecycle', v_fingerprint
  ) returning * into v_conversation;
  insert into private.account_conversation_participants(
    conversation_id, user_id, participant_role, participation_state, last_read_at
  ) values
    (v_conversation.id, v_actor, 'participant', 'accepted', pg_catalog.now()),
    (v_conversation.id, v_recipient, 'participant', 'accepted', null);
  v_message_id := private.create_account_conversation_message(
    v_conversation.id, v_actor, 'user', p_body, p_client_message_id,
    true, 'suppressible', null, 55
  );
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'source_conversation_started', v_conversation.id,
    v_message_id, null, null, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'sourceDomain', p_source_domain, 'sourceType', p_source_type
    )
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', v_conversation.id, 'state', v_conversation.state,
    'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
  );
end;
$$;

create or replace function public.start_account_support_conversation(
  p_subject text,
  p_body text,
  p_client_request_id uuid,
  p_client_message_id uuid,
  p_source_domain text default null,
  p_source_type text default null,
  p_source_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation private.account_conversations%rowtype;
  v_message_id uuid;
  v_fingerprint text;
begin
  if v_actor is null or p_client_request_id is null or p_client_message_id is null
     or not private.community_account_is_recoverable(v_actor)
     or private.community_has_active_restriction(v_actor, 'all_public_communities')
     or not private.account_message_text_is_safe(p_subject, 160)
     or not private.account_message_text_is_safe(p_body, 8000)
     or not private.account_support_source_allowed(
       v_actor, p_source_domain, p_source_type, p_source_record_id
     ) then
    raise exception using errcode = '42501', message = 'account_support_conversation_not_allowed';
  end if;
  v_fingerprint := private.account_conversation_creation_fingerprint(
    pg_catalog.jsonb_build_object(
      'kind', 'account_support', 'sourceDomain', p_source_domain,
      'sourceType', p_source_type, 'sourceRecordId', p_source_record_id,
      'subject', pg_catalog.btrim(p_subject), 'body', p_body,
      'clientMessageId', p_client_message_id
    )
  );
  select conversation.* into v_conversation
  from private.account_conversations as conversation
  where conversation.created_by_user_id = v_actor
    and conversation.creation_client_request_id = p_client_request_id
  for update;
  if found then
    if v_conversation.creation_payload_sha256 is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'account_conversation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state,
      'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
    );
  end if;
  if (
    select pg_catalog.count(*) from private.account_support_queue as queue
    join private.account_conversations as conversation
      on conversation.id = queue.conversation_id
    where conversation.created_by_user_id = v_actor
      and queue.created_at > pg_catalog.now() - interval '1 day'
  ) >= 3 then
    raise exception using errcode = '54000', message = 'account_support_rate_limited';
  end if;
  insert into private.account_conversations(
    conversation_type, subject, source_domain, source_type, source_record_id,
    created_by_user_id, creation_client_request_id, state, reply_policy,
    retention_class, creation_payload_sha256
  ) values (
    'account_support', pg_catalog.btrim(p_subject), p_source_domain,
    p_source_type, p_source_record_id, v_actor, p_client_request_id,
    'active', 'admin_and_recipient',
    case when p_source_record_id is null then 'account_lifecycle' else 'source_lifecycle' end,
    v_fingerprint
  ) returning * into v_conversation;
  insert into private.account_conversation_participants(
    conversation_id, user_id, participant_role, participation_state, last_read_at
  ) values (
    v_conversation.id, v_actor, 'support_requester', 'accepted', pg_catalog.now()
  );
  insert into private.account_support_queue(conversation_id, queue_status)
  values (v_conversation.id, 'unassigned');
  v_message_id := private.create_account_conversation_message(
    v_conversation.id, v_actor, 'user', p_body, p_client_message_id,
    false, 'suppressible', null, 50
  );
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'support_conversation_started', v_conversation.id,
    v_message_id, null, null, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'sourceLinked', p_source_record_id is not null,
      'sourceDomain', p_source_domain, 'sourceType', p_source_type
    )
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', v_conversation.id, 'state', v_conversation.state,
    'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
  );
end;
$$;

create or replace function public.respond_to_account_conversation_request(
  p_conversation_id uuid,
  p_decision text,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation private.account_conversations%rowtype;
  v_requester uuid;
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_event_id uuid;
begin
  if v_actor is null or p_client_request_id is null
     or v_decision not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'account_conversation_response_invalid';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id for update;
  select participant.user_id into v_requester
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.participant_role = 'requester';
  if v_conversation.conversation_type <> 'direct'
     or not exists (
       select 1 from private.account_conversation_participants as participant
       where participant.conversation_id = p_conversation_id
         and participant.user_id = v_actor
         and participant.participant_role = 'recipient'
     ) then
    raise exception using errcode = '42501', message = 'account_conversation_recipient_required';
  end if;
  if v_conversation.state <> 'requested' then
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state
    );
  end if;
  if v_decision = 'accept' then
    if not private.account_private_messaging_allowed(v_actor)
       or private.account_conversation_pair_blocked(v_actor, v_requester) then
      raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
    end if;
    update private.account_conversations
    set state = 'active', updated_at = pg_catalog.now()
    where id = p_conversation_id;
    update private.account_conversation_participants
    set participation_state = 'accepted', updated_at = pg_catalog.now()
    where conversation_id = p_conversation_id and user_id = v_actor;
  else
    update private.account_conversations
    set state = 'declined', closed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = p_conversation_id;
    update private.account_conversation_participants
    set participation_state = 'declined', updated_at = pg_catalog.now()
    where conversation_id = p_conversation_id and user_id = v_actor;
  end if;
  perform private.resolve_account_inbox_items(
    'conversations', 'conversation_request', p_conversation_id,
    v_actor, case when v_decision = 'accept' then 'completed' else 'superseded' end
  );
  update public.account_inbox_items
  set read_at = coalesce(read_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where recipient_user_id = v_actor
    and source_domain = 'conversations'
    and source_type = 'conversation_request'
    and source_record_id = p_conversation_id;
  v_event_id := private.record_account_event(
    'account_conversation.' || case when v_decision = 'accept' then 'accepted' else 'declined' end,
    1, 'conversations', 'conversation_request', p_conversation_id,
    v_actor, 'user',
    'account-conversation:' || p_conversation_id::text || ':' || v_decision || ':v1',
    'suppressible', 'private_messages',
    case when v_decision = 'accept' then 'Conversation request accepted'
      else 'Conversation request declined' end,
    case when v_decision = 'accept'
      then 'You can now reply in the governed Inbox conversation.'
      else 'The recipient declined this private conversation request.' end,
    pg_catalog.jsonb_build_object('conversationId', p_conversation_id),
    '/commons-circle/inbox?conversation=' || p_conversation_id::text,
    'account_lifecycle', p_client_request_id
  );
  perform private.project_account_event(
    v_event_id, v_requester, null, null, 50, 'outcome', false
  );
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'conversation_' ||
      case when v_decision = 'accept' then 'accepted' else 'declined' end,
    p_conversation_id, null, null, null, p_client_request_id, '{}'::jsonb
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', p_conversation_id,
    'state', case when v_decision = 'accept' then 'active' else 'declined' end
  );
end;
$$;

create or replace function public.send_account_conversation_message(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation private.account_conversations%rowtype;
  v_sender_kind text := 'user';
  v_message_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id;
  if not private.account_conversation_has_participant(p_conversation_id, v_actor) then
    raise exception using errcode = '42501', message = 'account_message_participant_required';
  end if;
  if exists (
    select 1 from private.account_conversation_participants as participant
    where participant.conversation_id = p_conversation_id
      and participant.user_id = v_actor
      and participant.participant_role in ('administrator', 'support_staff')
  ) then
    if not public.current_user_is_admin() then
      raise exception using errcode = '42501', message = 'account_message_admin_required';
    end if;
    v_sender_kind := 'administrator';
  elsif v_conversation.reply_policy = 'admin_and_recipient'
        and not exists (
          select 1 from private.account_conversation_participants as participant
          where participant.conversation_id = p_conversation_id
            and participant.user_id = v_actor
            and participant.participant_role = 'support_requester'
        ) then
    raise exception using errcode = '42501', message = 'account_message_participant_required';
  end if;
  v_message_id := private.create_account_conversation_message(
    p_conversation_id, v_actor, v_sender_kind, p_body, p_client_message_id,
    true,
    case when v_conversation.conversation_type in ('system_notice', 'required_action')
      then 'mandatory' else 'suppressible' end,
    null,
    case when v_conversation.conversation_type = 'required_action' then 90 else 50 end
  );
  if v_conversation.conversation_type = 'account_support' then
    update private.account_support_queue
    set queue_status = case when v_sender_kind = 'administrator'
          then 'waiting_on_user' else 'waiting_on_staff' end
    where conversation_id = p_conversation_id
      and queue_status <> 'closed';
  end if;
  return pg_catalog.jsonb_build_object(
    'messageId', v_message_id, 'conversationId', p_conversation_id
  );
end;
$$;

create or replace function public.current_user_conversations(
  p_view text default 'all',
  p_limit integer default 30,
  p_before_updated_at timestamptz default null,
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
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if coalesce(p_view, 'all') not in ('all', 'requests', 'active', 'support', 'archived')
     or (p_before_updated_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'account_conversation_list_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', row.id,
    'type', row.conversation_type,
    'subject', row.subject,
    'state', row.state,
    'replyPolicy', row.reply_policy,
    'sourceDomain', row.source_domain,
    'sourceType', row.source_type,
    'sourceAvailable', private.account_event_source_available(
      coalesce(row.source_domain, 'conversations'),
      coalesce(row.source_type, 'conversation'),
      coalesce(row.source_record_id, row.id)
    ),
    'participantRole', row.participant_role,
    'participationState', row.participation_state,
    'incomingRequest', row.state = 'requested' and row.participation_state = 'pending',
    'outgoingRequest', row.state = 'requested' and row.participant_role = 'requester',
    'canReply', row.state = 'active' and row.participation_state = 'accepted'
      and row.reply_policy <> 'none',
    'blockedByCurrentUser', row.blocked_by_current_user,
    'unreadCount', row.unread_count,
    'archivedAt', row.archived_at,
    'mutedAt', row.muted_at,
    'lastMessageAt', row.last_message_at,
    'updatedAt', row.updated_at,
    'counterpart', case when row.counterpart_handle is null then null
      else pg_catalog.jsonb_build_object(
        'handle', row.counterpart_handle,
        'displayName', row.counterpart_display_name,
        'avatarUrl', row.counterpart_avatar_url
      ) end
  ) order by row.updated_at desc, row.id desc), '[]'::jsonb)
  into v_items
  from (
    select
      conversation.*,
      self_participant.participant_role,
      self_participant.participation_state,
      self_participant.archived_at,
      self_participant.muted_at,
      (
        select pg_catalog.count(*)
        from private.account_messages as message
        where message.conversation_id = conversation.id
          and message.sender_user_id is distinct from v_actor
          and message.created_at > coalesce(self_participant.last_read_at, '-infinity'::timestamptz)
      ) as unread_count,
      exists (
        select 1
        from private.account_conversation_blocks as block
        join private.account_conversation_participants as blocked_participant
          on blocked_participant.conversation_id = conversation.id
         and blocked_participant.user_id = block.blocked_user_id
        where block.blocker_user_id = v_actor
      ) as blocked_by_current_user,
      counterpart.handle as counterpart_handle,
      counterpart.display_name as counterpart_display_name,
      counterpart.avatar_url as counterpart_avatar_url
    from private.account_conversations as conversation
    join private.account_conversation_participants as self_participant
      on self_participant.conversation_id = conversation.id
     and self_participant.user_id = v_actor
     and self_participant.participation_state <> 'removed'
    left join lateral (
      select card.handle, card.display_name, card.avatar_url
      from private.account_conversation_participants as other_participant
      join private.community_safe_online_public_profile_cards as card
        on card.user_id = other_participant.user_id
      where other_participant.conversation_id = conversation.id
        and other_participant.user_id <> v_actor
        and other_participant.participation_state <> 'removed'
      order by other_participant.joined_at
      limit 1
    ) as counterpart on true
    where (
      p_before_updated_at is null
      or (conversation.updated_at, conversation.id) < (p_before_updated_at, p_before_id)
    )
      and case coalesce(p_view, 'all')
        when 'requests' then conversation.state = 'requested'
        when 'active' then conversation.state = 'active' and self_participant.archived_at is null
        when 'support' then conversation.conversation_type = 'account_support'
          and self_participant.archived_at is null
        when 'archived' then self_participant.archived_at is not null
        else self_participant.archived_at is null
      end
    order by conversation.updated_at desc, conversation.id desc
    limit v_limit
  ) as row;
  return pg_catalog.jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

create or replace function public.current_user_conversation(
  p_conversation_id uuid,
  p_limit integer default 100,
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
  v_conversation private.account_conversations%rowtype;
  v_self private.account_conversation_participants%rowtype;
  v_messages jsonb;
  v_participants jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
begin
  if v_actor is null or (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id;
  select participant.* into strict v_self
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id = v_actor
    and participant.participation_state <> 'removed';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role', participant.participant_role,
    'state', participant.participation_state,
    'self', participant.user_id = v_actor,
    'profile', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name, 'avatarUrl', card.avatar_url
    ) end
  ) order by participant.joined_at), '[]'::jsonb)
  into v_participants
  from private.account_conversation_participants as participant
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = participant.user_id
  where participant.conversation_id = p_conversation_id
    and participant.participation_state <> 'removed';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', message.id,
    'senderKind', message.sender_kind,
    'senderSelf', message.sender_user_id = v_actor,
    'sender', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name, 'avatarUrl', card.avatar_url
    ) end,
    'body', message.body,
    'editedAt', message.edited_at,
    'deletedAt', message.deleted_at,
    'createdAt', message.created_at
  ) order by message.created_at, message.id), '[]'::jsonb)
  into v_messages
  from (
    select candidate.* from private.account_messages as candidate
    where candidate.conversation_id = p_conversation_id
      and (
        p_before_created_at is null
        or (candidate.created_at, candidate.id) < (p_before_created_at, p_before_id)
      )
    order by candidate.created_at desc, candidate.id desc
    limit v_limit
  ) as message
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = message.sender_user_id;

  return pg_catalog.jsonb_build_object(
    'conversation', pg_catalog.jsonb_build_object(
      'id', v_conversation.id,
      'type', v_conversation.conversation_type,
      'subject', v_conversation.subject,
      'state', v_conversation.state,
      'replyPolicy', v_conversation.reply_policy,
      'sourceDomain', v_conversation.source_domain,
      'sourceType', v_conversation.source_type,
      'sourceAvailable', private.account_event_source_available(
        coalesce(v_conversation.source_domain, 'conversations'),
        coalesce(v_conversation.source_type, 'conversation'),
        coalesce(v_conversation.source_record_id, v_conversation.id)
      ),
      'participantRole', v_self.participant_role,
      'participationState', v_self.participation_state,
      'incomingRequest', v_conversation.state = 'requested'
        and v_self.participation_state = 'pending',
      'canReply', v_conversation.state = 'active'
        and v_self.participation_state = 'accepted'
        and v_conversation.reply_policy <> 'none',
      'blockedByCurrentUser', exists (
        select 1
        from private.account_conversation_blocks as block
        join private.account_conversation_participants as blocked_participant
          on blocked_participant.conversation_id = v_conversation.id
         and blocked_participant.user_id = block.blocked_user_id
        where block.blocker_user_id = v_actor
      ),
      'archivedAt', v_self.archived_at,
      'mutedAt', v_self.muted_at,
      'createdAt', v_conversation.created_at,
      'updatedAt', v_conversation.updated_at
    ),
    'participants', v_participants,
    'messages', v_messages,
    'privacy', pg_catalog.jsonb_build_object(
      'storedInSupabase', true, 'endToEndEncrypted', false,
      'participantScoped', true, 'attachmentsEnabled', false
    )
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_conversation_not_found';
end;
$$;

create or replace function public.mark_current_user_conversation_read(
  p_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_count integer;
begin
  if v_actor is null or not private.account_conversation_has_participant(
    p_conversation_id, v_actor
  ) then
    raise exception using errcode = '42501', message = 'account_message_participant_required';
  end if;
  update private.account_conversation_participants
  set last_read_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where conversation_id = p_conversation_id and user_id = v_actor;
  update public.account_inbox_items as item
  set read_at = coalesce(item.read_at, pg_catalog.now()), updated_at = pg_catalog.now()
  from private.account_events as event
  join private.account_messages as message
    on event.source_domain = 'conversations'
   and event.source_type = 'private_message'
   and event.source_record_id = message.id
  where item.event_id = event.id
    and item.recipient_user_id = v_actor
    and message.conversation_id = p_conversation_id
    and item.read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_current_user_conversation_presentation(
  p_conversation_id uuid,
  p_archived boolean default null,
  p_muted boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  update private.account_conversation_participants
  set archived_at = case when p_archived is null then archived_at
        when p_archived then coalesce(archived_at, pg_catalog.now()) else null end,
      muted_at = case when p_muted is null then muted_at
        when p_muted then coalesce(muted_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
  where conversation_id = p_conversation_id and user_id = v_actor
    and participation_state <> 'removed';
  if not found then
    raise exception using errcode = 'P0002', message = 'account_conversation_not_found';
  end if;
  if p_archived is not null then
    update public.account_inbox_items as item
    set archived_at = case when p_archived then coalesce(item.archived_at, pg_catalog.now()) else null end,
        updated_at = pg_catalog.now()
    from private.account_events as event
    where item.event_id = event.id
      and item.recipient_user_id = v_actor
      and event.source_domain = 'conversations'
      and (
        (event.source_type = 'conversation_request' and event.source_record_id = p_conversation_id)
        or (
          event.source_type = 'private_message' and exists (
            select 1 from private.account_messages as message
            where message.id = event.source_record_id
              and message.conversation_id = p_conversation_id
          )
        )
      );
  end if;
end;
$$;

create or replace function public.edit_current_user_account_message(
  p_message_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_message private.account_messages%rowtype;
begin
  if v_actor is null or not private.account_message_text_is_safe(p_body, 8000) then
    raise exception using errcode = '22023', message = 'account_message_invalid';
  end if;
  select message.* into strict v_message
  from private.account_messages as message where message.id = p_message_id for update;
  if v_message.sender_user_id <> v_actor
     or v_message.deleted_at is not null
     or v_message.created_at < pg_catalog.now() - interval '15 minutes' then
    raise exception using errcode = '42501', message = 'account_message_edit_not_allowed';
  end if;
  insert into private.account_message_revisions(
    message_id, editor_user_id, prior_body, revision_kind
  ) values (p_message_id, v_actor, v_message.body, 'edit');
  update private.account_messages
  set body = p_body, edited_at = pg_catalog.now()
  where id = p_message_id;
  perform private.record_account_conversation_audit(
    v_actor, case when v_message.sender_kind = 'administrator'
      then 'administrator' else 'user' end,
    'message_edited', v_message.conversation_id, p_message_id
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_message_not_found';
end;
$$;

create or replace function public.remove_current_user_account_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_message private.account_messages%rowtype;
begin
  select message.* into strict v_message
  from private.account_messages as message where message.id = p_message_id for update;
  if v_actor is null or v_message.sender_user_id <> v_actor
     or v_message.deleted_at is not null
     or v_message.created_at < pg_catalog.now() - interval '15 minutes' then
    raise exception using errcode = '42501', message = 'account_message_remove_not_allowed';
  end if;
  insert into private.account_message_revisions(
    message_id, editor_user_id, prior_body, revision_kind
  ) values (p_message_id, v_actor, v_message.body, 'sender_tombstone');
  update private.account_messages
  set body = '[Message removed by sender]', deleted_at = pg_catalog.now(),
      edited_at = pg_catalog.now()
  where id = p_message_id;
  perform private.record_account_conversation_audit(
    v_actor, case when v_message.sender_kind = 'administrator'
      then 'administrator' else 'user' end,
    'message_tombstoned', v_message.conversation_id, p_message_id
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_message_not_found';
end;
$$;

create or replace function public.set_account_conversation_block(
  p_conversation_id uuid,
  p_blocked boolean,
  p_client_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_other_user uuid;
begin
  if v_actor is null or p_client_request_id is null
     or not private.account_conversation_has_participant(p_conversation_id, v_actor) then
    raise exception using errcode = '42501', message = 'account_message_participant_required';
  end if;
  select participant.user_id into v_other_user
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id <> v_actor
    and participant.participant_role not in ('system')
  order by participant.joined_at limit 1;
  if v_other_user is null then
    raise exception using errcode = 'P0002', message = 'account_conversation_counterpart_not_found';
  end if;
  if coalesce(p_blocked, false) then
    insert into private.account_conversation_blocks(
      blocker_user_id, blocked_user_id, client_request_id
    ) values (v_actor, v_other_user, p_client_request_id)
    on conflict (blocker_user_id, blocked_user_id) do nothing;
    update private.account_conversations as conversation
    set state = 'closed', closed_at = coalesce(conversation.closed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where conversation.conversation_type in ('direct', 'source_linked')
      and conversation.state in ('requested', 'active')
      and exists (
        select 1 from private.account_conversation_participants as first_participant
        where first_participant.conversation_id = conversation.id
          and first_participant.user_id = v_actor
      )
      and exists (
        select 1 from private.account_conversation_participants as second_participant
        where second_participant.conversation_id = conversation.id
          and second_participant.user_id = v_other_user
      );
    perform private.resolve_account_inbox_items(
      'conversations', 'conversation_request', p_conversation_id,
      v_actor, 'superseded'
    );
  else
    delete from private.account_conversation_blocks
    where blocker_user_id = v_actor and blocked_user_id = v_other_user;
  end if;
  perform private.record_account_conversation_audit(
    v_actor, 'user', case when coalesce(p_blocked, false)
      then 'account_blocked' else 'account_unblocked' end,
    p_conversation_id, null, null, null, p_client_request_id,
    pg_catalog.jsonb_build_object('conversationClosed', coalesce(p_blocked, false))
  );
end;
$$;

create or replace function public.report_account_conversation(
  p_conversation_id uuid,
  p_message_id uuid,
  p_reason_code text,
  p_details text,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_report private.account_conversation_reports%rowtype;
  v_case_id uuid;
  v_reported_user uuid;
begin
  if v_actor is null or p_client_request_id is null
     or not private.account_conversation_has_participant(p_conversation_id, v_actor)
     or p_reason_code not in (
       'spam', 'harassment', 'threats', 'hate_or_abuse', 'sexual_content',
       'privacy_or_pii', 'fraud_or_impersonation', 'malicious_link', 'other'
     ) or (p_details is not null and (
       pg_catalog.char_length(pg_catalog.btrim(p_details)) not between 1 and 2000
     )) then
    raise exception using errcode = '22023', message = 'account_conversation_report_invalid';
  end if;
  select report.* into v_report
  from private.account_conversation_reports as report
  where report.reporter_user_id = v_actor
    and report.client_request_id = p_client_request_id;
  if found then
    if v_report.conversation_id <> p_conversation_id
       or v_report.message_id is distinct from p_message_id
       or v_report.reason_code <> p_reason_code then
      raise exception using errcode = '23505', message = 'account_conversation_report_idempotency_conflict';
    end if;
    select moderation_case.id into v_case_id
    from private.account_conversation_moderation_cases as moderation_case
    where moderation_case.report_id = v_report.id;
    return pg_catalog.jsonb_build_object('reportId', v_report.id, 'caseId', v_case_id);
  end if;
  if (
    select pg_catalog.count(*) from private.account_conversation_reports as recent
    where recent.reporter_user_id = v_actor
      and recent.created_at > pg_catalog.now() - interval '1 day'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'account_conversation_report_rate_limited';
  end if;
  if p_message_id is not null and not exists (
    select 1 from private.account_messages as message
    where message.id = p_message_id and message.conversation_id = p_conversation_id
  ) then
    raise exception using errcode = 'P0002', message = 'account_message_not_found';
  end if;
  select participant.user_id into v_reported_user
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id <> v_actor
  order by participant.joined_at limit 1;
  insert into private.account_conversation_reports(
    client_request_id, reporter_user_id, conversation_id, message_id,
    reported_user_id, reason_code, details
  ) values (
    p_client_request_id, v_actor, p_conversation_id, p_message_id,
    v_reported_user, p_reason_code, p_details
  ) returning * into v_report;
  insert into private.account_conversation_moderation_cases(report_id)
  values (v_report.id) returning id into v_case_id;
  update private.account_conversations
  set moderation_hold = true where id = p_conversation_id;
  if p_message_id is not null then
    update private.account_messages set moderation_hold = true where id = p_message_id;
  end if;
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'conversation_reported', p_conversation_id,
    p_message_id, v_report.id, v_case_id, p_client_request_id,
    pg_catalog.jsonb_build_object('reasonCode', p_reason_code)
  );
  return pg_catalog.jsonb_build_object('reportId', v_report.id, 'caseId', v_case_id);
end;
$$;

create or replace function public.admin_send_account_message(
  p_recipient_handle text,
  p_subject text,
  p_body text,
  p_message_kind text,
  p_client_request_id uuid,
  p_client_message_id uuid,
  p_source_domain text default null,
  p_source_type text default null,
  p_source_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_source_recipient uuid;
  v_conversation private.account_conversations%rowtype;
  v_message_id uuid;
  v_event_id uuid;
  v_conversation_type text;
  v_delivery_class text;
  v_inbox_kind text;
  v_notification_kind text;
  v_fingerprint text;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_admin_required';
  end if;
  if p_client_request_id is null or p_client_message_id is null
     or p_message_kind not in (
       'admin_message', 'required_action', 'mandatory_notice', 'system_notice'
     ) or not private.account_message_text_is_safe(p_subject, 160)
     or not private.account_message_text_is_safe(p_body, 8000)
     or ((p_source_domain is null or p_source_type is null or p_source_record_id is null)
       and not (p_source_domain is null and p_source_type is null and p_source_record_id is null)) then
    raise exception using errcode = '22023', message = 'account_admin_message_invalid';
  end if;
  v_fingerprint := private.account_conversation_creation_fingerprint(
    pg_catalog.jsonb_build_object(
      'kind', 'administrator_message', 'messageKind', p_message_kind,
      'recipientHandle', pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(p_recipient_handle), '@')),
      'sourceDomain', p_source_domain, 'sourceType', p_source_type,
      'sourceRecordId', p_source_record_id,
      'subject', pg_catalog.btrim(p_subject), 'body', p_body,
      'clientMessageId', p_client_message_id
    )
  );
  select conversation.* into v_conversation
  from private.account_conversations as conversation
  where conversation.created_by_user_id = v_actor
    and conversation.creation_client_request_id = p_client_request_id
  for update;
  if found then
    if v_conversation.creation_payload_sha256 is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'account_conversation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state,
      'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
    );
  end if;
  v_recipient := private.account_admin_user_from_handle(p_recipient_handle);
  if v_recipient is null or v_recipient = v_actor
     or not private.community_account_is_recoverable(v_recipient) then
    raise exception using errcode = 'P0002', message = 'account_messaging_recipient_unavailable';
  end if;
  if p_source_record_id is not null then
    v_source_recipient := private.account_admin_source_recipient(
      p_source_domain, p_source_type, p_source_record_id
    );
    if v_source_recipient is distinct from v_recipient then
      raise exception using errcode = '42501', message = 'account_admin_source_recipient_mismatch';
    end if;
  end if;
  v_conversation_type := case p_message_kind
    when 'required_action' then 'required_action'
    when 'mandatory_notice' then 'system_notice'
    when 'system_notice' then 'system_notice'
    else 'admin_account' end;
  v_delivery_class := case when p_message_kind = 'admin_message'
    then 'suppressible' else 'mandatory' end;
  v_inbox_kind := case when p_message_kind = 'required_action'
    then 'required_action' else 'message' end;
  v_notification_kind := case when v_delivery_class = 'mandatory'
    then 'mandatory_notice' else null end;
  insert into private.account_conversations(
    conversation_type, subject, source_domain, source_type, source_record_id,
    created_by_user_id, creation_client_request_id, state, reply_policy,
    retention_class, closed_at, creation_payload_sha256
  ) values (
    v_conversation_type, pg_catalog.btrim(p_subject), p_source_domain,
    p_source_type, p_source_record_id, v_actor, p_client_request_id,
    case when p_message_kind in ('mandatory_notice', 'system_notice')
      then 'nonreplyable' else 'active' end,
    case when p_message_kind in ('mandatory_notice', 'system_notice')
      then 'none' else 'admin_and_recipient' end,
    case when v_delivery_class = 'mandatory' then 'audit'
      when p_source_record_id is not null then 'source_lifecycle'
      else 'account_lifecycle' end,
    case when p_message_kind in ('mandatory_notice', 'system_notice')
      then pg_catalog.now() else null end,
    v_fingerprint
  ) returning * into v_conversation;
  insert into private.account_conversation_participants(
    conversation_id, user_id, participant_role, participation_state, last_read_at
  ) values
    (v_conversation.id, v_actor, 'administrator', 'accepted', pg_catalog.now()),
    (v_conversation.id, v_recipient, 'recipient', 'accepted', null);
  v_message_id := private.create_account_conversation_message(
    v_conversation.id, v_actor, 'administrator', p_body,
    p_client_message_id, false, v_delivery_class, null,
    case when p_message_kind = 'required_action' then 95
      when v_delivery_class = 'mandatory' then 90 else 65 end
  );
  v_event_id := private.record_account_event(
    'account_admin_message.' || p_message_kind, 1,
    'conversations', 'private_message', v_message_id, v_actor, 'staff',
    'account-admin-message:' || v_message_id::text || ':delivered:v1',
    v_delivery_class,
    case when v_delivery_class = 'mandatory' then 'account_security'
      else 'private_messages' end,
    case p_message_kind
      when 'required_action' then 'Administrator action required'
      when 'mandatory_notice' then 'Important account notice'
      when 'system_notice' then 'System notice'
      else 'New administrator message' end,
    'Open the governed Inbox conversation to read the private message.',
    pg_catalog.jsonb_build_object('conversationId', v_conversation.id),
    '/commons-circle/inbox?conversation=' || v_conversation.id::text,
    v_conversation.retention_class, p_client_request_id
  );
  perform private.project_account_event(
    v_event_id, v_recipient, v_inbox_kind,
    case when p_message_kind = 'required_action'
      then 'respond_to_required_action' else 'open_conversation' end,
    case when p_message_kind = 'required_action' then 95
      when v_delivery_class = 'mandatory' then 90 else 65 end,
    v_notification_kind, v_delivery_class = 'mandatory'
  );
  perform private.record_account_conversation_audit(
    v_actor, 'administrator', 'admin_message_sent', v_conversation.id,
    v_message_id, null, null, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'messageKind', p_message_kind,
      'sourceDomain', p_source_domain,
      'sourceType', p_source_type,
      'mandatory', v_delivery_class = 'mandatory'
    )
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', v_conversation.id, 'state', v_conversation.state,
    'deepLink', '/commons-circle/inbox?conversation=' || v_conversation.id::text
  );
end;
$$;

create or replace function public.current_admin_account_support_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_items jsonb;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_admin_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'conversationId', queue.conversation_id,
    'subject', conversation.subject,
    'sourceDomain', conversation.source_domain,
    'sourceType', conversation.source_type,
    'status', queue.queue_status,
    'priority', queue.priority,
    'assignedToCurrentUser', queue.assigned_to_user_id = v_actor,
    'createdAt', queue.created_at,
    'updatedAt', conversation.updated_at,
    'requester', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name, 'avatarUrl', card.avatar_url
    ) end
  ) order by queue.priority desc, queue.created_at), '[]'::jsonb)
  into v_items
  from private.account_support_queue as queue
  join private.account_conversations as conversation
    on conversation.id = queue.conversation_id
  join private.account_conversation_participants as requester
    on requester.conversation_id = conversation.id
   and requester.participant_role = 'support_requester'
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = requester.user_id
  where queue.queue_status <> 'closed';
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'openCount', (select pg_catalog.count(*) from private.account_support_queue
      where queue_status <> 'closed')
  );
end;
$$;

create or replace function public.claim_admin_account_support_conversation(
  p_conversation_id uuid,
  p_client_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_queue private.account_support_queue%rowtype;
begin
  if v_actor is null or not public.current_user_is_admin()
     or p_client_request_id is null then
    raise exception using errcode = '42501', message = 'account_message_admin_required';
  end if;
  select queue.* into strict v_queue
  from private.account_support_queue as queue
  where queue.conversation_id = p_conversation_id for update;
  if v_queue.queue_status = 'closed' then
    raise exception using errcode = '55000', message = 'account_support_conversation_closed';
  end if;
  if v_queue.assigned_to_user_id is not null
     and v_queue.assigned_to_user_id <> v_actor then
    raise exception using errcode = '55000', message = 'account_support_conversation_already_assigned';
  end if;
  update private.account_support_queue
  set assigned_to_user_id = v_actor, queue_status = 'assigned',
      claimed_at = coalesce(claimed_at, pg_catalog.now())
  where conversation_id = p_conversation_id;
  insert into private.account_conversation_participants(
    conversation_id, user_id, participant_role, participation_state, last_read_at
  ) values (
    p_conversation_id, v_actor, 'support_staff', 'accepted', pg_catalog.now()
  ) on conflict (conversation_id, user_id) do update
    set participant_role = 'support_staff', participation_state = 'accepted',
        updated_at = pg_catalog.now();
  perform private.record_account_conversation_audit(
    v_actor, 'administrator', 'support_conversation_claimed',
    p_conversation_id, null, null, null, p_client_request_id
  );
end;
$$;

create or replace function private.account_announcement_recipients(
  p_audience_kind text,
  p_handles text[]
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct candidate.user_id
  from (
    select card.user_id
    from private.community_safe_online_public_profile_cards as card
    where p_audience_kind = 'explicit_opted_in_handles'
      and card.handle = any(coalesce(p_handles, '{}'::text[]))
    union all
    select participation.user_id
    from private.account_participation as participation
    where p_audience_kind = 'all_opted_in_adults'
      and participation.participation_state = 'adult_eligible'
      and participation.age_band = '18_plus'
    union all
    select account.id
    from auth.users as account
    where p_audience_kind = 'administrators'
      and (
        public.has_role(account.id, 'administrator'::public.app_role)
        or coalesce((
          select profile.is_admin from public.profiles as profile
          where profile.id = account.id
        ), false)
      )
  ) as candidate
  join public.account_messaging_preferences as messaging_preference
    on messaging_preference.user_id = candidate.user_id
   and messaging_preference.receive_optional_announcements
  where private.community_account_is_recoverable(candidate.user_id)
    and not private.community_has_active_restriction(
      candidate.user_id, 'private_messaging'
    );
$$;

create or replace function public.prepare_admin_account_announcement(
  p_subject text,
  p_body text,
  p_audience_kind text,
  p_handles text[],
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_draft private.account_announcement_drafts%rowtype;
  v_handles text[];
  v_count integer;
  v_confirmation text;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_admin_required';
  end if;
  if p_client_request_id is null
     or p_audience_kind not in (
       'explicit_opted_in_handles', 'all_opted_in_adults', 'administrators'
     ) or not private.account_message_text_is_safe(p_subject, 160)
     or not private.account_message_text_is_safe(p_body, 8000) then
    raise exception using errcode = '22023', message = 'account_announcement_invalid';
  end if;
  select pg_catalog.array_agg(normalized.handle order by normalized.handle)
    into v_handles
  from (
    select distinct pg_catalog.lower(
      pg_catalog.ltrim(pg_catalog.btrim(handle), '@')
    ) as handle
    from pg_catalog.unnest(coalesce(p_handles, '{}'::text[])) as handle
    where pg_catalog.btrim(handle) <> ''
  ) as normalized;
  if p_audience_kind = 'explicit_opted_in_handles'
     and (coalesce(pg_catalog.cardinality(v_handles), 0) not between 1 and 100) then
    raise exception using errcode = '22023', message = 'account_announcement_handles_invalid';
  elsif p_audience_kind <> 'explicit_opted_in_handles' then
    v_handles := null;
  end if;
  select draft.* into v_draft
  from private.account_announcement_drafts as draft
  where draft.client_request_id = p_client_request_id for update;
  if found then
    if v_draft.created_by_user_id <> v_actor
       or v_draft.subject <> pg_catalog.btrim(p_subject)
       or v_draft.body <> p_body
       or v_draft.audience_kind <> p_audience_kind
       or v_draft.audience_handles is distinct from v_handles then
      raise exception using errcode = '23505', message = 'account_announcement_idempotency_conflict';
    end if;
  else
    select pg_catalog.count(*) into v_count
    from private.account_announcement_recipients(p_audience_kind, v_handles);
    if v_count not between 1 and 500 then
      raise exception using errcode = '54000', message = 'account_announcement_recipient_count_invalid';
    end if;
    insert into private.account_announcement_drafts(
      client_request_id, created_by_user_id, subject, body, audience_kind,
      audience_handles, recipient_count, expires_at
    ) values (
      p_client_request_id, v_actor, pg_catalog.btrim(p_subject), p_body,
      p_audience_kind, v_handles, v_count, pg_catalog.now() + interval '30 minutes'
    ) returning * into v_draft;
    perform private.record_account_conversation_audit(
      v_actor, 'administrator', 'announcement_prepared', null, null,
      null, null, p_client_request_id,
      pg_catalog.jsonb_build_object(
        'audienceKind', p_audience_kind, 'recipientCount', v_count
      )
    );
  end if;
  v_confirmation := 'SEND ' || v_draft.recipient_count::text || ' '
    || pg_catalog.substring(v_draft.id::text, 1, 8);
  return pg_catalog.jsonb_build_object(
    'draftId', v_draft.id,
    'subject', v_draft.subject,
    'audienceKind', v_draft.audience_kind,
    'recipientCount', v_draft.recipient_count,
    'confirmationPhrase', v_confirmation,
    'expiresAt', v_draft.expires_at,
    'sentAt', v_draft.sent_at,
    'safePreview', 'A private administrator announcement will be available in the governed Inbox.'
  );
end;
$$;

create or replace function public.send_admin_account_announcement(
  p_draft_id uuid,
  p_expected_recipient_count integer,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_draft private.account_announcement_drafts%rowtype;
  v_recipients uuid[];
  v_recipient uuid;
  v_count integer;
  v_conversation_id uuid;
  v_message_id uuid;
  v_event_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_admin_required';
  end if;
  select draft.* into strict v_draft
  from private.account_announcement_drafts as draft
  where draft.id = p_draft_id for update;
  if v_draft.created_by_user_id <> v_actor then
    raise exception using errcode = '42501', message = 'account_announcement_owner_required';
  end if;
  if v_draft.sent_at is not null then
    return pg_catalog.jsonb_build_object(
      'draftId', v_draft.id, 'recipientCount', v_draft.recipient_count,
      'sentAt', v_draft.sent_at, 'replayed', true
    );
  end if;
  if v_draft.expires_at <= pg_catalog.now()
     or p_expected_recipient_count is distinct from v_draft.recipient_count
     or pg_catalog.btrim(coalesce(p_confirmation_text, '')) <>
       'SEND ' || v_draft.recipient_count::text || ' '
         || pg_catalog.substring(v_draft.id::text, 1, 8) then
    raise exception using errcode = '22023', message = 'account_announcement_confirmation_invalid';
  end if;
  select pg_catalog.array_agg(recipient.user_id order by recipient.user_id),
         pg_catalog.count(*)
    into v_recipients, v_count
  from private.account_announcement_recipients(
    v_draft.audience_kind, v_draft.audience_handles
  ) as recipient;
  if v_count is distinct from v_draft.recipient_count then
    raise exception using errcode = '40001', message = 'account_announcement_audience_changed';
  end if;
  foreach v_recipient in array v_recipients loop
    insert into private.account_conversations(
      conversation_type, subject, source_domain, source_type, source_record_id,
      created_by_user_id, state, reply_policy, retention_class, closed_at
    ) values (
      'admin_announcement', v_draft.subject, 'account', 'admin_announcement',
      v_draft.id, v_actor, 'nonreplyable', 'none', 'account_lifecycle',
      pg_catalog.now()
    ) returning id into v_conversation_id;
    insert into private.account_conversation_participants(
      conversation_id, user_id, participant_role, participation_state, last_read_at
    ) values
      (v_conversation_id, v_actor, 'administrator', 'accepted', pg_catalog.now()),
      (v_conversation_id, v_recipient, 'audience_recipient', 'accepted', null);
    v_message_id := private.create_account_conversation_message(
      v_conversation_id, v_actor, 'administrator', v_draft.body,
      gen_random_uuid(), false, 'suppressible', null, 50
    );
    insert into private.account_announcement_deliveries(
      announcement_id, recipient_user_id, conversation_id, message_id
    ) values (v_draft.id, v_recipient, v_conversation_id, v_message_id);
    v_event_id := private.record_account_event(
      'account_admin_announcement.sent', 1, 'account', 'admin_announcement',
      v_draft.id, v_actor, 'staff',
      'account-announcement:' || v_draft.id::text || ':' || v_recipient::text || ':sent:v1',
      'suppressible', 'announcements', 'Administrator announcement',
      'Open the governed Inbox to read this private announcement.',
      pg_catalog.jsonb_build_object('conversationId', v_conversation_id),
      '/commons-circle/inbox?conversation=' || v_conversation_id::text,
      'account_lifecycle', v_draft.client_request_id
    );
    perform private.project_account_event(
      v_event_id, v_recipient, 'message', 'open_conversation', 50,
      'information', false
    );
  end loop;
  update private.account_announcement_drafts
  set sent_at = pg_catalog.now() where id = v_draft.id
  returning sent_at into v_draft.sent_at;
  perform private.record_account_conversation_audit(
    v_actor, 'administrator', 'announcement_sent', null, null,
    null, null, v_draft.client_request_id,
    pg_catalog.jsonb_build_object(
      'announcementId', v_draft.id,
      'audienceKind', v_draft.audience_kind,
      'recipientCount', v_draft.recipient_count
    )
  );
  return pg_catalog.jsonb_build_object(
    'draftId', v_draft.id, 'recipientCount', v_draft.recipient_count,
    'sentAt', v_draft.sent_at, 'replayed', false
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_announcement_not_found';
end;
$$;

create or replace function public.current_account_message_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_items jsonb;
begin
  if not private.account_message_moderator_allowed(v_actor) then
    raise exception using errcode = '42501', message = 'account_message_moderator_required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'caseId', moderation_case.id,
    'reportId', report.id,
    'conversationId', report.conversation_id,
    'messageReported', report.message_id is not null,
    'reasonCode', report.reason_code,
    'status', moderation_case.status,
    'assignedToCurrentUser', moderation_case.assigned_to_user_id = v_actor,
    'legalHold', moderation_case.legal_hold,
    'createdAt', moderation_case.created_at,
    'reporter', case when reporter.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', reporter.handle, 'displayName', reporter.display_name, 'avatarUrl', reporter.avatar_url
    ) end
  ) order by moderation_case.created_at), '[]'::jsonb)
  into v_items
  from private.account_conversation_moderation_cases as moderation_case
  join private.account_conversation_reports as report
    on report.id = moderation_case.report_id
  left join private.community_safe_online_public_profile_cards as reporter
    on reporter.user_id = report.reporter_user_id
  where moderation_case.status not in ('resolved', 'closed');
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'openCount', (select pg_catalog.count(*)
      from private.account_conversation_moderation_cases
      where status not in ('resolved', 'closed'))
  );
end;
$$;

create or replace function public.claim_account_message_moderation_case(
  p_case_id uuid,
  p_client_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_case private.account_conversation_moderation_cases%rowtype;
begin
  if not private.account_message_moderator_allowed(v_actor)
     or p_client_request_id is null then
    raise exception using errcode = '42501', message = 'account_message_moderator_required';
  end if;
  select moderation_case.* into strict v_case
  from private.account_conversation_moderation_cases as moderation_case
  where moderation_case.id = p_case_id for update;
  if v_case.status in ('resolved', 'closed') then
    raise exception using errcode = '55000', message = 'account_message_case_closed';
  end if;
  if v_case.assigned_to_user_id is not null
     and v_case.assigned_to_user_id <> v_actor
     and not public.current_user_is_admin() then
    raise exception using errcode = '55000', message = 'account_message_case_already_assigned';
  end if;
  update private.account_conversation_moderation_cases
  set assigned_to_user_id = v_actor, status = 'assigned',
      claimed_at = coalesce(claimed_at, pg_catalog.now())
  where id = p_case_id;
  update private.account_conversation_reports
  set status = 'under_review' where id = v_case.report_id;
  perform private.record_account_conversation_audit(
    v_actor, case when public.current_user_is_admin() then 'administrator' else 'moderator' end,
    'message_case_claimed', null, null, v_case.report_id, p_case_id,
    p_client_request_id
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_message_case_not_found';
end;
$$;

create or replace function public.read_reported_account_message_evidence(p_case_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_case private.account_conversation_moderation_cases%rowtype;
  v_report private.account_conversation_reports%rowtype;
  v_message private.account_messages%rowtype;
  v_conversation private.account_conversations%rowtype;
begin
  if not private.account_message_moderator_allowed(v_actor) then
    raise exception using errcode = '42501', message = 'account_message_moderator_required';
  end if;
  select moderation_case.* into strict v_case
  from private.account_conversation_moderation_cases as moderation_case
  where moderation_case.id = p_case_id;
  if v_case.assigned_to_user_id is distinct from v_actor
     and not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_case_assignment_required';
  end if;
  select report.* into strict v_report
  from private.account_conversation_reports as report where report.id = v_case.report_id;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = v_report.conversation_id;
  if v_report.message_id is not null then
    select message.* into strict v_message
    from private.account_messages as message where message.id = v_report.message_id;
  end if;
  perform private.record_account_conversation_audit(
    v_actor, case when public.current_user_is_admin() then 'administrator' else 'moderator' end,
    'reported_message_evidence_accessed', v_report.conversation_id,
    v_report.message_id, v_report.id, p_case_id, null,
    pg_catalog.jsonb_build_object('messageScoped', v_report.message_id is not null)
  );
  return pg_catalog.jsonb_build_object(
    'caseId', v_case.id,
    'reportId', v_report.id,
    'status', v_case.status,
    'reasonCode', v_report.reason_code,
    'details', v_report.details,
    'conversation', pg_catalog.jsonb_build_object(
      'id', v_conversation.id,
      'type', v_conversation.conversation_type,
      'subject', v_conversation.subject,
      'sourceDomain', v_conversation.source_domain,
      'sourceType', v_conversation.source_type
    ),
    'reportedMessage', case when v_report.message_id is null then null
      else pg_catalog.jsonb_build_object(
        'id', v_message.id,
        'body', v_message.body,
        'senderKind', v_message.sender_kind,
        'createdAt', v_message.created_at,
        'editedAt', v_message.edited_at,
        'deletedAt', v_message.deleted_at
      ) end,
    'scopeNotice', 'Only the reported message is disclosed; unrelated conversation history is not included.'
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_message_case_not_found';
end;
$$;

create or replace function public.resolve_account_message_moderation_case(
  p_case_id uuid,
  p_resolution_code text,
  p_legal_hold boolean,
  p_client_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_case private.account_conversation_moderation_cases%rowtype;
  v_report private.account_conversation_reports%rowtype;
  v_event_id uuid;
begin
  if not private.account_message_moderator_allowed(v_actor)
     or p_client_request_id is null
     or p_resolution_code not in (
       'no_action', 'warning_issued', 'content_tombstoned',
       'account_restriction_referred', 'escalated_legal', 'duplicate'
     ) then
    raise exception using errcode = '42501', message = 'account_message_case_resolution_invalid';
  end if;
  select moderation_case.* into strict v_case
  from private.account_conversation_moderation_cases as moderation_case
  where moderation_case.id = p_case_id for update;
  if v_case.assigned_to_user_id is distinct from v_actor
     and not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'account_message_case_assignment_required';
  end if;
  if v_case.status in ('resolved', 'closed') then return; end if;
  select report.* into strict v_report
  from private.account_conversation_reports as report where report.id = v_case.report_id;
  update private.account_conversation_moderation_cases
  set status = 'resolved', resolved_at = pg_catalog.now(),
      resolution_code = p_resolution_code,
      legal_hold = coalesce(p_legal_hold, false)
  where id = p_case_id;
  update private.account_conversation_reports
  set status = case when p_resolution_code = 'no_action' then 'dismissed'
        else 'action_taken' end,
      resolved_at = pg_catalog.now()
  where id = v_report.id;
  v_event_id := private.record_account_event(
    'account_conversation_report.resolved', 1,
    'moderation', 'account_conversation_report', v_report.id,
    v_actor, 'staff',
    'account-conversation-report:' || v_report.id::text || ':resolved:v1',
    'mandatory', 'moderation', 'Private-message report reviewed',
    'A moderator completed review of your report.', '{}'::jsonb,
    '/commons-circle/notifications', 'audit', p_client_request_id
  );
  if v_report.reporter_user_id is not null then
    perform private.project_account_event(
      v_event_id, v_report.reporter_user_id,
      null, null, 70, 'mandatory_notice', true
    );
  end if;
  perform private.record_account_conversation_audit(
    v_actor, case when public.current_user_is_admin() then 'administrator' else 'moderator' end,
    'message_case_resolved', v_report.conversation_id, v_report.message_id,
    v_report.id, p_case_id, p_client_request_id,
    pg_catalog.jsonb_build_object(
      'resolutionCode', p_resolution_code,
      'legalHold', coalesce(p_legal_hold, false)
    )
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_message_case_not_found';
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
  elsif p_source_domain = 'conversations' and p_source_type = 'conversation_request' then
    return exists (
      select 1 from private.account_conversations where id = p_source_record_id
    );
  elsif p_source_domain = 'conversations' and p_source_type = 'private_message' then
    return exists (
      select 1 from private.account_messages where id = p_source_record_id
    );
  elsif p_source_domain = 'account' and p_source_type = 'admin_announcement' then
    return exists (
      select 1 from private.account_announcement_drafts where id = p_source_record_id
    );
  elsif p_source_domain = 'moderation'
        and p_source_type = 'account_conversation_report' then
    return exists (
      select 1 from private.account_conversation_reports where id = p_source_record_id
    );
  end if;
  return true;
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
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_event_authentication_required';
  end if;
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
    ('moderation'), ('private_messages'), ('sandbox'), ('work_reviews')
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
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_event_authentication_required';
  end if;
  if p_category not in (
    'account_security', 'community_replies', 'community_mentions',
    'followed_threads', 'private_messages', 'work_reviews', 'marketplace',
    'moderation', 'announcements', 'sandbox'
  ) or (p_quiet_hours_start is null) <> (p_quiet_hours_end is null) then
    raise exception using errcode = '22023', message = 'account_event_preference_invalid';
  end if;
  select preference.* into v_preference
  from public.account_event_preferences as preference
  where preference.user_id = v_actor and preference.category = p_category
  for update;
  if found then
    if p_expected_version is not null
       and p_expected_version <> v_preference.preference_version then
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
          and candidate.category in (
            'community_replies', 'community_mentions', 'followed_threads',
            'private_messages', 'announcements'
          )
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
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = event.actor_user_id;
  return pg_catalog.jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

do $account_conversation_function_hardening$
declare v_signature text; v_backend_role text := 'service' || '_role';
begin
  foreach v_signature in array array[
    'private.account_message_text_is_safe(text,integer)',
    'private.account_conversation_creation_fingerprint(jsonb)',
    'private.account_message_revision_is_immutable()',
    'private.account_conversation_audit_is_immutable()',
    'private.account_private_messaging_allowed(uuid)',
    'private.account_message_moderator_allowed(uuid)',
    'private.account_conversation_has_participant(uuid,uuid)',
    'private.account_conversation_pair_blocked(uuid,uuid)',
    'private.account_messaging_user_from_public_handle(text)',
    'private.account_admin_user_from_handle(text)',
    'private.record_account_conversation_audit(uuid,text,text,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'private.account_support_source_allowed(uuid,text,text,uuid)',
    'private.account_admin_source_recipient(text,text,uuid)',
    'private.account_source_linked_counterpart(uuid,text,text,uuid)',
    'private.create_account_conversation_message(uuid,uuid,text,text,uuid,boolean,text,text,integer)',
    'private.account_announcement_recipients(text,text[])',
    'private.account_event_source_available(text,text,uuid)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_signature);
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated',
      v_signature
    );
    execute pg_catalog.format(
      'revoke all privileges on function %s from %I',
      v_signature, v_backend_role
    );
  end loop;
end
$account_conversation_function_hardening$;

do $account_conversation_public_rpc_hardening$
declare v_signature text; v_backend_role text := 'service' || '_role';
begin
  foreach v_signature in array array[
    'public.current_user_messaging_preferences()',
    'public.update_current_user_messaging_preferences(boolean,boolean,boolean,integer)',
    'public.lookup_account_messaging_recipient(text)',
    'public.request_account_conversation(text,text,text,uuid,uuid)',
    'public.start_source_linked_account_conversation(text,text,uuid,text,text,uuid,uuid)',
    'public.start_account_support_conversation(text,text,uuid,uuid,text,text,uuid)',
    'public.respond_to_account_conversation_request(uuid,text,uuid)',
    'public.send_account_conversation_message(uuid,text,uuid)',
    'public.current_user_conversations(text,integer,timestamptz,uuid)',
    'public.current_user_conversation(uuid,integer,timestamptz,uuid)',
    'public.mark_current_user_conversation_read(uuid)',
    'public.set_current_user_conversation_presentation(uuid,boolean,boolean)',
    'public.edit_current_user_account_message(uuid,text)',
    'public.remove_current_user_account_message(uuid)',
    'public.set_account_conversation_block(uuid,boolean,uuid)',
    'public.report_account_conversation(uuid,uuid,text,text,uuid)',
    'public.admin_send_account_message(text,text,text,text,uuid,uuid,text,text,uuid)',
    'public.current_admin_account_support_queue()',
    'public.claim_admin_account_support_conversation(uuid,uuid)',
    'public.prepare_admin_account_announcement(text,text,text,text[],uuid)',
    'public.send_admin_account_announcement(uuid,integer,text)',
    'public.current_account_message_moderation_queue()',
    'public.claim_account_message_moderation_case(uuid,uuid)',
    'public.read_reported_account_message_evidence(uuid)',
    'public.resolve_account_message_moderation_case(uuid,text,boolean,uuid)',
    'public.current_user_account_event_preferences()',
    'public.update_current_user_account_event_preference(text,boolean,boolean,time,time,integer)',
    'public.current_user_notification_items(text,integer,timestamptz,uuid)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_signature);
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated',
      v_signature
    );
    execute pg_catalog.format(
      'revoke all privileges on function %s from %I',
      v_signature, v_backend_role
    );
    execute pg_catalog.format('grant execute on function %s to authenticated', v_signature);
    execute pg_catalog.format(
      'grant execute on function %s to %I', v_signature, v_backend_role
    );
  end loop;
end
$account_conversation_public_rpc_hardening$;

comment on table private.account_conversations is
  'Governed private communication shells. A conversation never grants source-workflow authority.';
comment on table private.account_messages is
  'Participant-scoped plain-text message bodies stored separately from safe account-event projections.';
comment on table private.account_conversation_moderation_cases is
  'Report-bound staff cases. Evidence access requires assignment and creates an immutable audit event.';
comment on table public.account_messaging_preferences is
  'Privacy-first Commons messaging opt-ins. Ordinary direct requests default off; mandatory account communication is separate.';

commit;

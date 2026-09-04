-- Central, privacy-minimized velocity controls for browser-direct Website
-- mutations. The limits are action-specific, use no IP/device/payment/badge
-- signal, and arm the next-window refusal on the last allowed action so the
-- counter and decision survive transaction rollback on a refused request.

begin;

create table private.online_action_rate_policies (
  policy_key text primary key,
  resource_domain text not null,
  action text not null,
  new_or_unverified_limit integer not null,
  established_verified_limit integer not null,
  window_seconds integer not null,
  decision_retention_seconds integer not null default 2592000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_action_rate_policy_key_check
    check (policy_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint online_action_rate_domain_check
    check (resource_domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint online_action_rate_action_check
    check (action ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint online_action_rate_limit_check check (
    new_or_unverified_limit between 1 and 10000
    and established_verified_limit between new_or_unverified_limit and 20000
  ),
  constraint online_action_rate_window_check
    check (window_seconds between 60 and 86400),
  constraint online_action_rate_retention_check
    check (decision_retention_seconds between 86400 and 7776000)
);

create table private.online_action_rate_counters (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  policy_key text not null references private.online_action_rate_policies(policy_key) on delete restrict,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (actor_user_id, policy_key),
  constraint online_action_rate_counter_count_check
    check (attempt_count between 1 and 20001),
  constraint online_action_rate_counter_block_check
    check (blocked_until is null or blocked_until > window_started_at)
);

create table private.online_abuse_decisions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_domain text not null,
  resource_type text not null,
  policy_key text not null references private.online_action_rate_policies(policy_key) on delete restrict,
  decision text not null default 'restricted',
  reason_class text not null default 'velocity_limit_reached',
  decided_at timestamptz not null default now(),
  expires_at timestamptz not null,
  review_state text not null default 'unreviewed',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  private_review_note text,
  window_started_at timestamptz not null,
  constraint online_abuse_decision_action_check
    check (action ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint online_abuse_decision_domain_check
    check (resource_domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint online_abuse_decision_resource_check
    check (resource_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint online_abuse_decision_value_check
    check (decision = 'restricted'),
  constraint online_abuse_decision_reason_check
    check (reason_class = 'velocity_limit_reached'),
  constraint online_abuse_decision_expiry_check
    check (expires_at > decided_at),
  constraint online_abuse_decision_review_check check (
    review_state in ('unreviewed', 'acknowledged', 'dismissed', 'escalated')
    and (
      (review_state = 'unreviewed' and reviewed_at is null and reviewed_by is null)
      or (review_state <> 'unreviewed' and reviewed_at is not null and reviewed_by is not null)
    )
  ),
  constraint online_abuse_decision_note_check check (
    private_review_note is null
    or (
      pg_catalog.char_length(private_review_note) between 1 and 500
      and private_review_note !~ '[[:cntrl:]]'
    )
  ),
  unique (actor_user_id, policy_key, window_started_at)
);

create index online_abuse_decisions_review_idx
  on private.online_abuse_decisions(review_state, decided_at desc);
create index online_abuse_decisions_expiry_idx
  on private.online_abuse_decisions(expires_at, decided_at);

alter table private.online_action_rate_policies owner to postgres;
alter table private.online_action_rate_counters owner to postgres;
alter table private.online_abuse_decisions owner to postgres;
alter table private.online_action_rate_policies enable row level security;
alter table private.online_action_rate_counters enable row level security;
alter table private.online_abuse_decisions enable row level security;
alter table private.online_action_rate_policies force row level security;
alter table private.online_action_rate_counters force row level security;
alter table private.online_abuse_decisions force row level security;
revoke all on private.online_action_rate_policies from public, anon, authenticated, service_role;
revoke all on private.online_action_rate_counters from public, anon, authenticated, service_role;
revoke all on private.online_abuse_decisions from public, anon, authenticated, service_role;

insert into private.online_action_rate_policies(
  policy_key, resource_domain, action,
  new_or_unverified_limit, established_verified_limit, window_seconds
)
values
  ('account_profile_mutation', 'identity', 'profile_mutation', 12, 40, 3600),
  ('commune_post_create', 'commune', 'post_create', 12, 36, 600),
  ('commune_comment_create', 'commune', 'comment_create', 20, 80, 600),
  ('commune_reaction_write', 'commune', 'reaction_write', 40, 160, 300),
  ('commune_vote_write', 'commune', 'vote_write', 15, 60, 600),
  ('commune_realtime_message', 'commune', 'realtime_message', 10, 30, 60),
  ('community_save_follow', 'community', 'save_or_follow', 40, 160, 600),
  ('commons_circle_invitation', 'commons_circle', 'invitation_create', 10, 40, 3600),
  ('content_report_create', 'moderation', 'report_create', 8, 24, 3600),
  ('participation_request_create', 'work', 'participation_request', 5, 15, 86400),
  ('stewardship_request_create', 'commons_circle', 'stewardship_request', 4, 12, 86400),
  ('forge_draft_write', 'developer_forge', 'draft_write', 20, 80, 600),
  ('marketplace_submission_create', 'marketplace', 'submission_create', 5, 15, 86400),
  ('profile_upload', 'identity', 'profile_upload', 10, 30, 600),
  ('private_document_upload', 'work', 'private_document_upload', 6, 20, 3600),
  ('commune_upload', 'commune', 'attachment_upload', 10, 40, 600),
  ('forge_package_upload', 'developer_forge', 'package_upload', 6, 20, 3600)
on conflict (policy_key) do nothing;

do $$
begin
  if (select pg_catalog.count(*) from private.online_action_rate_policies) <> 17
     or exists (
       select 1
       from private.online_action_rate_policies
       where established_verified_limit < new_or_unverified_limit
          or window_seconds not between 60 and 86400
          or decision_retention_seconds <> 2592000
          or not active
     ) then
    raise exception using
      errcode = '55000',
      message = 'online_action_rate_policy_catalog_drift';
  end if;
end;
$$;

create or replace function private.consume_online_action_rate(
  p_actor_user_id uuid,
  p_policy_key text,
  p_resource_type text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_policy private.online_action_rate_policies%rowtype;
  v_limit integer;
  v_window_started_at timestamptz;
  v_window_ends_at timestamptz;
  v_attempt_count integer;
  v_blocked_until timestamptz;
begin
  if p_actor_user_id is null
     or p_resource_type is null
     or p_resource_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception using errcode = '42501', message = 'online_action_rate_actor_invalid';
  end if;

  select policy.* into v_policy
  from private.online_action_rate_policies as policy
  where policy.policy_key = p_policy_key
    and policy.active;
  if not found then
    raise exception using errcode = '55000', message = 'online_action_rate_policy_missing';
  end if;

  v_limit := case when exists (
    select 1
    from auth.users as account
    where account.id = p_actor_user_id
      and account.email_confirmed_at is not null
      and account.created_at <= pg_catalog.now() - interval '7 days'
  ) then v_policy.established_verified_limit
  else v_policy.new_or_unverified_limit end;

  v_window_started_at := pg_catalog.to_timestamp(
    pg_catalog.floor(
      extract(epoch from pg_catalog.now()) / v_policy.window_seconds
    ) * v_policy.window_seconds
  );
  v_window_ends_at := v_window_started_at
    + pg_catalog.make_interval(secs => v_policy.window_seconds);

  insert into private.online_action_rate_counters(
    actor_user_id, policy_key, window_started_at, attempt_count,
    blocked_until, updated_at
  )
  values (
    p_actor_user_id, p_policy_key, v_window_started_at, 1,
    case when v_limit = 1 then v_window_ends_at else null end,
    pg_catalog.now()
  )
  on conflict (actor_user_id, policy_key) do update
  set window_started_at = excluded.window_started_at,
      attempt_count = case
        when online_action_rate_counters.window_started_at = excluded.window_started_at
          then online_action_rate_counters.attempt_count + 1
        else 1
      end,
      blocked_until = case
        when online_action_rate_counters.window_started_at = excluded.window_started_at
             and online_action_rate_counters.attempt_count + 1 >= v_limit
          then v_window_ends_at
        when online_action_rate_counters.window_started_at <> excluded.window_started_at
             and v_limit = 1
          then v_window_ends_at
        else null
      end,
      updated_at = pg_catalog.now()
  returning attempt_count, blocked_until
  into v_attempt_count, v_blocked_until;

  if v_attempt_count > v_limit then
    raise exception using
      errcode = '54000',
      message = 'online_action_rate_limited',
      hint = 'retry_after_window';
  end if;

  if v_attempt_count = v_limit then
    insert into private.online_abuse_decisions(
      actor_user_id, action, resource_domain, resource_type, policy_key,
      decision, reason_class, decided_at, expires_at, review_state,
      window_started_at
    ) values (
      p_actor_user_id, v_policy.action, v_policy.resource_domain,
      p_resource_type, p_policy_key, 'restricted',
      'velocity_limit_reached', pg_catalog.now(),
      v_window_ends_at
        + pg_catalog.make_interval(secs => v_policy.decision_retention_seconds),
      'unreviewed', v_window_started_at
    )
    on conflict (actor_user_id, policy_key, window_started_at) do nothing;
  end if;
end;
$$;

alter function private.consume_online_action_rate(uuid, text, text) owner to postgres;
revoke all on function private.consume_online_action_rate(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_online_action_rate_from_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authenticated_actor uuid := auth.uid();
  v_row_actor uuid;
begin
  if v_authenticated_actor is null then
    return new;
  end if;
  v_row_actor := case
    when tg_argv[1] = '@auth' then v_authenticated_actor
    else nullif(pg_catalog.to_jsonb(new) ->> tg_argv[1], '')::uuid
  end;
  if v_row_actor is distinct from v_authenticated_actor then
    return new;
  end if;
  perform private.consume_online_action_rate(
    v_authenticated_actor, tg_argv[0], tg_table_name
  );
  return new;
end;
$$;

alter function private.enforce_online_action_rate_from_row() owner to postgres;
revoke all on function private.enforce_online_action_rate_from_row()
  from public, anon, authenticated, service_role;

create or replace function private.enforce_online_storage_upload_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_policy_key text;
begin
  if v_actor is null
     or pg_catalog.split_part(new.name, '/', 1) <> v_actor::text then
    return new;
  end if;
  v_policy_key := case
    when new.bucket_id in ('profile-avatars', 'profile-banners')
      then 'profile_upload'
    when new.bucket_id in ('work-with-attachments', 'stewardship-receipts')
      then 'private_document_upload'
    when new.bucket_id in ('commune-media', 'commune-uploads')
      then 'commune_upload'
    when new.bucket_id in ('addon-packages', 'addon-icons', 'addon-listing-assets')
      then 'forge_package_upload'
    else null
  end;
  if v_policy_key is not null then
    perform private.consume_online_action_rate(v_actor, v_policy_key, 'storage_object');
  end if;
  return new;
end;
$$;

alter function private.enforce_online_storage_upload_rate() owner to postgres;
revoke all on function private.enforce_online_storage_upload_rate()
  from public, anon, authenticated, service_role;

-- Existing table/RPC RLS remains the authorization authority. These triggers
-- only add bounded velocity for the already-authorized browser actor.
drop trigger if exists online_rate_profile_mutation on public.profiles;
create trigger online_rate_profile_mutation
before update on public.profiles
for each row execute function private.enforce_online_action_rate_from_row(
  'account_profile_mutation', 'id'
);

drop trigger if exists online_rate_commune_post_create on public.commune_posts;
create trigger online_rate_commune_post_create
before insert on public.commune_posts
for each row execute function private.enforce_online_action_rate_from_row(
  'commune_post_create', 'user_id'
);

drop trigger if exists online_rate_commune_comment_create on public.commune_comments;
create trigger online_rate_commune_comment_create
before insert on public.commune_comments
for each row execute function private.enforce_online_action_rate_from_row(
  'commune_comment_create', 'user_id'
);

drop trigger if exists online_rate_commune_reaction_write on public.commune_content_reactions;
create trigger online_rate_commune_reaction_write
before insert or update on public.commune_content_reactions
for each row execute function private.enforce_online_action_rate_from_row(
  'commune_reaction_write', 'user_id'
);

drop trigger if exists online_rate_commune_vote_write on public.commune_vote_ballots;
create trigger online_rate_commune_vote_write
before insert or update on public.commune_vote_ballots
for each row execute function private.enforce_online_action_rate_from_row(
  'commune_vote_write', 'voter_user_id'
);

drop trigger if exists online_rate_commune_realtime_message on public.commune_realtime_messages;
create trigger online_rate_commune_realtime_message
before insert on public.commune_realtime_messages
for each row execute function private.enforce_online_action_rate_from_row(
  'commune_realtime_message', 'author_user_id'
);

drop trigger if exists online_rate_followed_thread on public.user_followed_commune_threads;
create trigger online_rate_followed_thread
before insert on public.user_followed_commune_threads
for each row execute function private.enforce_online_action_rate_from_row(
  'community_save_follow', 'user_id'
);

drop trigger if exists online_rate_saved_commune_post on public.user_saved_commune_posts;
create trigger online_rate_saved_commune_post
before insert on public.user_saved_commune_posts
for each row execute function private.enforce_online_action_rate_from_row(
  'community_save_follow', 'user_id'
);

drop trigger if exists online_rate_saved_addon on public.user_saved_addons;
create trigger online_rate_saved_addon
before insert on public.user_saved_addons
for each row execute function private.enforce_online_action_rate_from_row(
  'community_save_follow', 'user_id'
);

drop trigger if exists online_rate_circle_invitation on public.commons_circle_relationships;
create trigger online_rate_circle_invitation
before insert on public.commons_circle_relationships
for each row execute function private.enforce_online_action_rate_from_row(
  'commons_circle_invitation', 'requested_by'
);

drop trigger if exists online_rate_broken_link_report on public.broken_link_reports;
create trigger online_rate_broken_link_report
before insert on public.broken_link_reports
for each row execute function private.enforce_online_action_rate_from_row(
  'content_report_create', '@auth'
);

drop trigger if exists online_rate_commune_abuse_report on public.commune_abuse_reports;
create trigger online_rate_commune_abuse_report
before insert on public.commune_abuse_reports
for each row execute function private.enforce_online_action_rate_from_row(
  'content_report_create', '@auth'
);

drop trigger if exists online_rate_commune_report on public.commune_reports;
create trigger online_rate_commune_report
before insert on public.commune_reports
for each row execute function private.enforce_online_action_rate_from_row(
  'content_report_create', '@auth'
);

drop trigger if exists online_rate_commune_realtime_report on public.commune_realtime_reports;
create trigger online_rate_commune_realtime_report
before insert on public.commune_realtime_reports
for each row execute function private.enforce_online_action_rate_from_row(
  'content_report_create', '@auth'
);

drop trigger if exists online_rate_content_report on public.content_reports;
create trigger online_rate_content_report
before insert on public.content_reports
for each row execute function private.enforce_online_action_rate_from_row(
  'content_report_create', '@auth'
);

drop trigger if exists online_rate_participation_request on public.work_with_requests;
create trigger online_rate_participation_request
before insert on public.work_with_requests
for each row execute function private.enforce_online_action_rate_from_row(
  'participation_request_create', 'user_id'
);

drop trigger if exists online_rate_stewardship_request on public.stewardship_recognition_requests;
create trigger online_rate_stewardship_request
before insert on public.stewardship_recognition_requests
for each row execute function private.enforce_online_action_rate_from_row(
  'stewardship_request_create', 'user_id'
);

drop trigger if exists online_rate_forge_draft_write on public.addon_drafts;
create trigger online_rate_forge_draft_write
before insert or update on public.addon_drafts
for each row execute function private.enforce_online_action_rate_from_row(
  'forge_draft_write', 'owner_user_id'
);

drop trigger if exists online_rate_marketplace_submission on public.addon_submissions;
create trigger online_rate_marketplace_submission
before insert on public.addon_submissions
for each row execute function private.enforce_online_action_rate_from_row(
  'marketplace_submission_create', 'submitted_by'
);

drop trigger if exists online_rate_storage_upload on storage.objects;
create trigger online_rate_storage_upload
before insert on storage.objects
for each row execute function private.enforce_online_storage_upload_rate();

-- Work/stewardship requests predate the shared account pause/deletion gate.
-- Add restrictive owner clauses without changing reviewer reads or updates.
drop policy if exists "ordinary account gate own work with requests"
  on public.work_with_requests;
create policy "ordinary account gate own work with requests"
on public.work_with_requests as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
)
with check (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
);

drop policy if exists "ordinary account gate own work with request files"
  on public.work_with_request_files;
create policy "ordinary account gate own work with request files"
on public.work_with_request_files as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
)
with check (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
);

drop policy if exists "ordinary account gate own stewardship requests"
  on public.stewardship_recognition_requests;
create policy "ordinary account gate own stewardship requests"
on public.stewardship_recognition_requests as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
)
with check (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
);

drop policy if exists "ordinary account gate own stewardship receipt files"
  on public.stewardship_receipt_files;
create policy "ordinary account gate own stewardship receipt files"
on public.stewardship_receipt_files as restrictive for all to authenticated
using (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
)
with check (
  user_id is distinct from auth.uid()
  or private.community_account_allows_ordinary_mutation(auth.uid())
);

create or replace function public.online_abuse_decision_summary(
  p_limit integer default 100
)
returns table (
  decision_id uuid,
  actor_user_id uuid,
  action text,
  resource_domain text,
  resource_type text,
  policy_key text,
  decision text,
  reason_class text,
  decided_at timestamptz,
  expires_at timestamptz,
  review_state text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  private_review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'online_abuse_admin_required';
  end if;
  return query
  select
    item.id, item.actor_user_id, item.action, item.resource_domain,
    item.resource_type, item.policy_key, item.decision, item.reason_class,
    item.decided_at, item.expires_at, item.review_state,
    item.reviewed_at, item.reviewed_by, item.private_review_note
  from private.online_abuse_decisions as item
  order by item.decided_at desc, item.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

create or replace function public.review_online_abuse_decision(
  p_decision_id uuid,
  p_review_state text,
  p_private_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row private.online_abuse_decisions%rowtype;
  v_note text := nullif(pg_catalog.btrim(p_private_review_note), '');
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'online_abuse_admin_required';
  end if;
  if p_review_state not in ('acknowledged', 'dismissed', 'escalated')
     or (v_note is not null and (
       pg_catalog.char_length(v_note) > 500 or v_note ~ '[[:cntrl:]]'
     )) then
    raise exception using errcode = '22023', message = 'online_abuse_review_invalid';
  end if;
  update private.online_abuse_decisions
  set review_state = p_review_state,
      reviewed_at = pg_catalog.now(),
      reviewed_by = v_actor,
      private_review_note = v_note
  where id = p_decision_id
  returning * into v_row;
  if not found then
    raise exception using errcode = 'P0002', message = 'online_abuse_decision_not_found';
  end if;
  return pg_catalog.jsonb_build_object(
    'decisionId', v_row.id,
    'reviewState', v_row.review_state,
    'reviewedAt', v_row.reviewed_at
  );
end;
$$;

create or replace function public.expire_online_abuse_decisions(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'online_abuse_service_role_required';
  end if;
  with victims as (
    select decision.id
    from private.online_abuse_decisions as decision
    where decision.expires_at <= pg_catalog.now()
    order by decision.expires_at, decision.id
    limit least(greatest(coalesce(p_limit, 500), 1), 2000)
  )
  delete from private.online_abuse_decisions as decision
  using victims
  where decision.id = victims.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

alter function public.online_abuse_decision_summary(integer) owner to postgres;
alter function public.review_online_abuse_decision(uuid, text, text) owner to postgres;
alter function public.expire_online_abuse_decisions(integer) owner to postgres;
revoke all on function public.online_abuse_decision_summary(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.review_online_abuse_decision(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.expire_online_abuse_decisions(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.online_abuse_decision_summary(integer)
  to authenticated, service_role;
grant execute on function public.review_online_abuse_decision(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.expire_online_abuse_decisions(integer)
  to service_role;

comment on table private.online_abuse_decisions is
  'Content-minimized Website velocity decisions. Contains no IP/device fingerprint, request body, message text, file name, payment, badge, role, or social-rank signal; records expire through the service-only retention function.';
comment on function private.consume_online_action_rate(uuid, text, text) is
  'Atomic fixed-window Website action limiter. New/unverified means email-unconfirmed or account age under seven days; this is a transparent velocity tier, not trust, rank, payment, or governance.';
comment on function public.online_abuse_decision_summary(integer) is
  'Administrator-only bounded operational view of content-minimized action restrictions.';
comment on function public.expire_online_abuse_decisions(integer) is
  'Service-role-only bounded retention cleanup for expired minimized abuse decisions.';

commit;

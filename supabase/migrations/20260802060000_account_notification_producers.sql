-- Project recipient-relevant Online source transitions into the governed
-- account-event system. Source tables and their existing review, moderation,
-- economic, lifecycle, and sandbox contracts remain authoritative.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '10min';

-- Preserve the meaning of the legacy Commons controls while the old settings
-- remain available during compatibility observation. Existing explicit v1
-- choices always win.
insert into public.account_event_preferences(user_id, category, in_app_enabled)
select preference.user_id, mapping.category, mapping.enabled
from public.notification_preferences as preference
cross join lateral (values
  ('community_replies', preference.commune_replies),
  ('community_mentions', preference.commune_replies),
  ('followed_threads', preference.followed_threads),
  ('marketplace', preference.marketplace_updates),
  ('work_reviews', preference.review_status_updates)
) as mapping(category, enabled)
on conflict (user_id, category) do nothing;

-- Commune mentions are a bounded source fact, separate from Artisan mentions
-- and separate from the informational notification projection.
create table public.commune_comment_mentions (
  comment_id uuid not null references public.commune_comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_user_id),
  constraint commune_comment_mentions_distinct_check
    check (actor_user_id is null or actor_user_id <> mentioned_user_id)
);

create index commune_comment_mentions_recipient_created_idx
  on public.commune_comment_mentions(mentioned_user_id, created_at desc, comment_id);

alter table public.commune_comment_mentions owner to postgres;
alter table public.commune_comment_mentions enable row level security;
revoke all privileges on public.commune_comment_mentions
  from public, anon, authenticated;
grant select on public.commune_comment_mentions to authenticated;

create policy "mention recipients read their Commune mention facts"
  on public.commune_comment_mentions for select to authenticated
  using (mentioned_user_id = auth.uid());

-- Mapping survives legacy-feed row removal long enough to prove that the new
-- projection was reconciled. It contains identifiers and state only, never a
-- legacy body or private source content.
create table private.account_legacy_notification_projection_map (
  legacy_notification_id uuid primary key,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references private.account_events(id) on delete restrict,
  notification_id uuid not null references public.account_notifications(id) on delete cascade,
  reconciliation_version integer not null default 1,
  reconciled_at timestamptz not null default now(),
  constraint account_legacy_notification_reconciliation_version_check
    check (reconciliation_version = 1)
);

create index account_legacy_notification_recipient_idx
  on private.account_legacy_notification_projection_map(recipient_user_id, reconciled_at desc);

alter table private.account_legacy_notification_projection_map owner to postgres;
alter table private.account_legacy_notification_projection_map enable row level security;
revoke all privileges on private.account_legacy_notification_projection_map
  from public, anon, authenticated;

alter table private.account_delivery_outbox
  add column delivery_evidence_sha256 text;
alter table private.account_delivery_outbox
  add constraint account_delivery_evidence_sha256_check check (
    delivery_evidence_sha256 is null
    or delivery_evidence_sha256 ~ '^[0-9a-f]{64}$'
  );

create or replace function private.account_event_safe_fragment(
  p_value text,
  p_maximum integer,
  p_fallback text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.left(
    coalesce(
      nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
        coalesce(p_value, ''), '[[:cntrl:]]', ' ', 'g'
      )), ''),
      p_fallback
    ),
    least(greatest(coalesce(p_maximum, 1), 1), 500)
  );
$$;

create or replace function private.emit_account_notification_event(
  p_event_type text,
  p_source_domain text,
  p_source_type text,
  p_source_record_id uuid,
  p_actor_user_id uuid,
  p_actor_kind text,
  p_recipient_user_id uuid,
  p_idempotency_key text,
  p_delivery_class text,
  p_category text,
  p_safe_title text,
  p_safe_preview text,
  p_deep_link text,
  p_notification_kind text default 'outcome',
  p_inbox_kind text default null,
  p_action_kind text default null,
  p_priority integer default 50,
  p_request_email boolean default false,
  p_retention_class text default 'source_lifecycle'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_event_id uuid;
begin
  if p_recipient_user_id is null
     or not exists (select 1 from auth.users where id = p_recipient_user_id) then
    return null;
  end if;
  v_event_id := private.record_account_event(
    p_event_type, 1, p_source_domain, p_source_type, p_source_record_id,
    p_actor_user_id, p_actor_kind, p_idempotency_key, p_delivery_class,
    p_category, p_safe_title, p_safe_preview, '{}'::jsonb, p_deep_link,
    p_retention_class, null
  );
  perform private.project_account_event(
    v_event_id, p_recipient_user_id, p_inbox_kind, p_action_kind,
    p_priority, p_notification_kind, p_request_email
  );
  return v_event_id;
end;
$$;

create or replace function private.insert_legacy_account_notification_projection(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_notification_type text,
  p_source_type text,
  p_source_record_id uuid,
  p_safe_title text,
  p_safe_preview text,
  p_deep_link text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_id is null or p_recipient_user_id is null then return; end if;
  if exists (
    select 1 from public.user_notifications as notification
    where notification.user_id = p_recipient_user_id
      and notification.metadata ->> 'account_event_id' = p_event_id::text
  ) then return; end if;
  insert into public.user_notifications(
    user_id, notification_type, title, body, source_type, source_id,
    action_url, metadata
  ) values (
    p_recipient_user_id,
    private.account_event_safe_fragment(p_notification_type, 100, 'account_update'),
    private.account_event_safe_fragment(p_safe_title, 160, 'Account update'),
    private.account_event_safe_fragment(
      p_safe_preview, 500, 'Open the linked account surface for the current status.'
    ),
    private.account_event_safe_fragment(p_source_type, 100, 'account_event'),
    p_source_record_id,
    p_deep_link,
    pg_catalog.jsonb_build_object(
      'account_event_id', p_event_id,
      'compatibility_projection', true,
      'summary_only', true
    )
  );
end;
$$;

-- Preserve the current Signals feed while adding exact recipient projections.
-- Comment publication remains independent from optional delivery failures.
create or replace function public.notify_commune_published_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_mention record;
  v_event_id uuid;
  v_inserted integer;
  v_first_publication boolean := false;
  v_body_changed boolean := false;
begin
  v_first_publication := new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from new.status);
  v_body_changed := new.status = 'published'
    and tg_op = 'UPDATE' and old.body is distinct from new.body;

  if v_first_publication then
    begin
      for v_target in
        with candidates as (
          select parent.user_id as recipient_user_id, 'community_replies'::text as category, 1 as rank
          from public.commune_comments as parent
          where parent.id = new.parent_comment_id and parent.user_id <> new.user_id
          union all
          select post.user_id, 'community_replies', 2
          from public.commune_posts as post
          where post.id = new.post_id and post.user_id <> new.user_id
          union all
          select follow.user_id, 'followed_threads', 3
          from public.user_followed_commune_threads as follow
          where follow.thread_id = new.thread_id
            and follow.user_id <> new.user_id
            and not coalesce(follow.muted, false)
        ), ranked as (
          select candidate.*,
            pg_catalog.row_number() over (
              partition by candidate.recipient_user_id order by candidate.rank
            ) as recipient_rank
          from candidates as candidate
          where candidate.recipient_user_id is not null
        )
        select recipient_user_id, category
        from ranked where recipient_rank = 1
      loop
        v_event_id := private.emit_account_notification_event(
          case when new.parent_comment_id is null
            then 'commune.comment.published' else 'commune.comment.reply_published' end,
          'commune', 'commune_comment', new.id, new.user_id, 'user',
          v_target.recipient_user_id,
          'commune-comment:' || new.id::text || ':recipient:' ||
            v_target.recipient_user_id::text || ':published:v1',
          'suppressible', v_target.category,
          case when new.parent_comment_id is null
            then 'New Commune discussion activity' else 'New Commune reply' end,
          'Open the Commune post to read the published comment.',
          case when new.post_id is null then '/commune'
            else '/commune/posts/' || new.post_id::text end,
          'information', null, null, 50, false, 'source_lifecycle'
        );
        perform private.insert_legacy_account_notification_projection(
          v_event_id, v_target.recipient_user_id, 'commune_thread_reply',
          'commune_comment', new.id, 'New published Commune reply',
          'A followed Commune thread has a newly published reply.',
          case when new.post_id is null then '/commune'
            else '/commune/posts/' || new.post_id::text end
        );
      end loop;
    exception when others then
      raise warning 'Commune published-comment projection skipped: %', sqlstate;
    end;
  end if;

  if v_first_publication or v_body_changed then
    for v_mention in
      with parsed as (
        select pg_catalog.lower(match[2]) as handle
        from pg_catalog.regexp_matches(
          new.body,
          '(^|[^[:alnum:]_-])@([[:alnum:]][[:alnum:]_-]{2,39})',
          'g'
        ) as match
      ), bounded as (
        select distinct parsed.handle from parsed order by parsed.handle limit 10
      )
      select card.user_id
      from bounded
      join private.community_safe_online_public_profile_cards as card
        on card.handle = bounded.handle
      where card.user_id <> new.user_id
        and not private.account_conversation_pair_blocked(new.user_id, card.user_id)
    loop
      begin
        insert into public.commune_comment_mentions(
          comment_id, mentioned_user_id, actor_user_id
        ) values (new.id, v_mention.user_id, new.user_id)
        on conflict (comment_id, mentioned_user_id) do nothing;
        get diagnostics v_inserted = row_count;
        if v_inserted = 1 then
          v_event_id := private.emit_account_notification_event(
            'commune.comment.mention', 'commune', 'commune_comment', new.id,
            new.user_id, 'user', v_mention.user_id,
            'commune-comment:' || new.id::text || ':mention:' ||
              v_mention.user_id::text || ':v1',
            'suppressible', 'community_mentions', 'You were mentioned in the Commune',
            'Open the Commune post to read the published mention.',
            case when new.post_id is null then '/commune'
              else '/commune/posts/' || new.post_id::text end,
            'information', null, null, 55, false, 'source_lifecycle'
          );
          perform private.insert_legacy_account_notification_projection(
            v_event_id, v_mention.user_id, 'commune_mention', 'commune_comment',
            new.id, 'You were mentioned in the Commune',
            'Open the Commune post to read the published mention.',
            case when new.post_id is null then '/commune'
              else '/commune/posts/' || new.post_id::text end
          );
        end if;
      exception when others then
        raise warning 'Commune mention projection skipped: %', sqlstate;
      end;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists commune_notify_published_comment on public.commune_comments;
create trigger commune_notify_published_comment
after insert or update of status, body on public.commune_comments
for each row execute function public.notify_commune_published_comment();

-- One trigger function deliberately shares projection mechanics but keeps a
-- separate case for every source contract. It never changes source state.
create or replace function private.project_account_domain_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := '{}'::jsonb;
  v_source_id uuid;
  v_recipient uuid;
  v_actor uuid;
  v_actor_kind text := 'user';
  v_source_domain text;
  v_source_type text;
  v_state text;
  v_old_state text;
  v_event_type text;
  v_delivery_class text := 'suppressible';
  v_category text := 'work_reviews';
  v_title text;
  v_preview text;
  v_deep_link text;
  v_inbox_kind text;
  v_action_kind text;
  v_priority integer := 50;
  v_retention text := 'source_lifecycle';
  v_request_email boolean := false;
  v_event_id uuid;
  v_transition_key text;
begin
  if tg_op = 'UPDATE' then v_old := pg_catalog.to_jsonb(old); end if;
  v_actor := auth.uid();

  case tg_table_name
    when 'work_with_requests' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_source_domain := 'work_with'; v_source_type := 'work_with_request';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'work_with.request.submitted'
        else 'work_with.request.status_changed' end;
      v_title := case v_state
        when 'needs_information' then 'Work With request needs information'
        when 'approved' then 'Work With request approved'
        when 'rejected' then 'Work With request declined'
        when 'withdrawn' then 'Work With request withdrawn'
        when 'archived' then 'Work With request archived'
        when 'in_review' then 'Work With request is under review'
        else 'Work With request received' end;
      v_preview := 'Open Requests & Reviews for the current private request status.';
      v_deep_link := '/commons-circle/requests-reviews';
      if v_state = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'respond_work_with'; v_priority := 75;
      end if;

    when 'commune_troubleshooting_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'troubleshooting_post';
      v_state := v_new ->> 'troubleshooting_status';
      v_old_state := v_old ->> 'troubleshooting_status';
      v_event_type := case when tg_op = 'INSERT' then 'commune.troubleshooting.submitted'
        else 'commune.troubleshooting.status_changed' end;
      v_title := case v_state
        when 'needs_information' then 'Troubleshooting issue needs information'
        when 'resolved' then 'Troubleshooting issue resolved'
        when 'closed' then 'Troubleshooting issue closed'
        when 'workaround_found' then 'Troubleshooting workaround recorded'
        when 'fix_proposed' then 'Troubleshooting fix proposed'
        else 'Troubleshooting issue updated' end;
      v_preview := 'Open the Troubleshooting Grove post for the current public-safe status.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_state = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_troubleshooting_issue'; v_priority := 70;
      end if;

    when 'commune_research_notes' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'research_note';
      v_state := v_new ->> 'review_status'; v_old_state := v_old ->> 'review_status';
      v_event_type := case when tg_op = 'INSERT' then 'commune.research_note.submitted'
        else 'commune.research_note.status_changed' end;
      v_title := case v_state
        when 'needs_citation' then 'Research Note needs a citation'
        when 'needs_clarification' then 'Research Note needs clarification'
        when 'source_issue' then 'Research Note source needs attention'
        when 'overclaiming_evidence' then 'Research Note evidence claim needs attention'
        when 'published' then 'Research Note published'
        when 'corrected' then 'Research Note correction recorded'
        else 'Research Note updated' end;
      v_preview := 'Open the Research Note for its current review status.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_state in ('needs_citation','needs_clarification','source_issue','overclaiming_evidence') then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_research_note'; v_priority := 70;
      end if;

    when 'commune_repository_showcases' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'repository_showcase';
      v_state := coalesce(v_new ->> 'status', '') || ':' ||
        coalesce(v_new ->> 'sandbox_review_status', 'not_requested');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' ||
        coalesce(v_old ->> 'sandbox_review_status', 'not_requested');
      v_event_type := case when tg_op = 'INSERT' then 'commune.repository_showcase.submitted'
        else 'commune.repository_showcase.status_changed' end;
      v_title := case
        when v_new ->> 'sandbox_review_status' = 'needs_information' then 'Repository artifact review needs information'
        when v_new ->> 'sandbox_review_status' in ('approved_for_selected_artifact','rejected') then 'Repository artifact review updated'
        when v_new ->> 'status' = 'needs_information' then 'Repository Showcase needs information'
        when v_new ->> 'status' = 'approved' then 'Repository Showcase approved'
        when v_new ->> 'status' = 'rejected' then 'Repository Showcase rejected'
        else 'Repository Showcase updated' end;
      v_preview := 'Open the linked Commune post for the current showcase and selected-artifact review status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_new ->> 'status' = 'needs_information'
         or v_new ->> 'sandbox_review_status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_repository_showcase'; v_priority := 70;
      end if;

    when 'commune_iteration_showcases' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'iteration_showcase';
      v_state := coalesce(v_new ->> 'status', '') || ':' ||
        coalesce(v_new ->> 'sandbox_review_status', 'not_requested');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' ||
        coalesce(v_old ->> 'sandbox_review_status', 'not_requested');
      v_event_type := case when tg_op = 'INSERT' then 'commune.iteration_showcase.submitted'
        else 'commune.iteration_showcase.status_changed' end;
      v_title := case
        when v_new ->> 'sandbox_review_status' = 'needs_information' then 'Iteration artifact review needs information'
        when v_new ->> 'sandbox_review_status' in ('completed','failed','declined') then 'Iteration artifact review updated'
        when v_new ->> 'status' = 'needs_information' then 'Iteration Showcase needs information'
        when v_new ->> 'status' = 'approved' then 'Iteration Showcase approved'
        when v_new ->> 'status' = 'rejected' then 'Iteration Showcase rejected'
        else 'Iteration Showcase updated' end;
      v_preview := 'Open the linked Commune post for the current iteration and selected-artifact review status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_new ->> 'status' = 'needs_information'
         or v_new ->> 'sandbox_review_status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_iteration_showcase'; v_priority := 70;
      end if;

    when 'commune_job_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'job_post';
      v_state := coalesce(v_new ->> 'application_status', '') || ':' ||
        coalesce(v_new ->> 'anti_scam_review_status', '');
      v_old_state := coalesce(v_old ->> 'application_status', '') || ':' ||
        coalesce(v_old ->> 'anti_scam_review_status', '');
      v_event_type := case when tg_op = 'INSERT' then 'commune.job_post.submitted'
        else 'commune.job_post.status_changed' end;
      v_title := case
        when v_new ->> 'anti_scam_review_status' in (
          'needs_pay_clarification','needs_contact_clarification','needs_location_clarification'
        ) or v_new ->> 'application_status' = 'needs_clarification'
          then 'Job Post needs clarification'
        when v_new ->> 'anti_scam_review_status' = 'reviewed_clear' then 'Job Post review cleared'
        when v_new ->> 'anti_scam_review_status' in ('suspicious','removed') then 'Job Post moderation decision'
        when v_new ->> 'application_status' = 'filled' then 'Job Post marked filled'
        when v_new ->> 'application_status' = 'closed' then 'Job Post closed'
        else 'Job Post updated' end;
      v_preview := 'Open the Job Post for its current listing and review status. Billing remains separately authoritative.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_new ->> 'application_status' = 'needs_clarification'
         or v_new ->> 'anti_scam_review_status' in (
           'needs_pay_clarification','needs_contact_clarification','needs_location_clarification'
         ) then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_job_post'; v_priority := 75;
      elsif v_new ->> 'anti_scam_review_status' in ('suspicious','removed') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_sandbox_runs' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := nullif(v_new ->> 'requester_user_id', '')::uuid;
      v_source_domain := 'sandbox'; v_source_type := 'sandbox_run';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      if v_state not in ('completed','failed','denied','policy_blocked','sandbox_unavailable') then return new; end if;
      v_event_type := 'sandbox.run.' || v_state;
      v_category := 'sandbox';
      v_title := case v_state when 'completed' then 'Sandbox run completed'
        when 'failed' then 'Sandbox run failed'
        when 'denied' then 'Sandbox run was denied'
        when 'policy_blocked' then 'Sandbox run was blocked by policy'
        else 'Sandbox service was unavailable' end;
      v_preview := 'Open the linked source for the bounded run status. No code or runner details are included here.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;

    when 'addon_submissions' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'submitted_by')::uuid;
      v_source_domain := 'developer_forge'; v_source_type := 'addon_submission';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'forge.addon_submission.submitted'
        else 'forge.addon_submission.status_changed' end;
      v_category := 'marketplace';
      v_title := case v_state
        when 'changes_requested' then 'Add-on submission needs changes'
        when 'approved' then 'Add-on submission approved'
        when 'rejected' then 'Add-on submission rejected'
        when 'security_hold' then 'Add-on submission is on security hold'
        when 'published' then 'Add-on published to Marketplace'
        else 'Add-on submission received' end;
      v_preview := 'Open Developer Forge for the current submission status. Package and reviewer details remain private.';
      v_deep_link := '/developer-forge/submissions/' || v_source_id::text;
      if v_state = 'changes_requested' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_addon_submission'; v_priority := 75;
      elsif v_state = 'security_hold' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_request_email := true;
      end if;

    when 'marketplace_listings' then
      v_source_id := (v_new ->> 'id')::uuid;
      select profile.user_id into v_recipient
      from public.developer_profiles as profile
      where profile.id = nullif(v_new ->> 'developer_profile_id', '')::uuid;
      v_source_domain := 'marketplace'; v_source_type := 'marketplace_listing';
      v_state := coalesce(v_new ->> 'listing_status', '');
      v_old_state := coalesce(v_old ->> 'listing_status', '');
      v_event_type := case when tg_op = 'INSERT' then 'marketplace.listing.created'
        else 'marketplace.listing.status_changed' end;
      v_category := 'marketplace';
      v_title := case v_state when 'published' then 'Marketplace listing published'
        when 'revoked' then 'Marketplace listing revoked'
        when 'approved' then 'Marketplace listing approved'
        else 'Marketplace listing updated' end;
      v_preview := 'Open Marketplace or Developer Forge for the current listing state. Economic contracts remain separate.';
      v_deep_link := '/developer-forge/submissions';
      if v_state = 'revoked' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_request_email := true;
      end if;

    when 'commune_reports', 'content_reports' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := nullif(v_new ->> 'reporter_user_id', '')::uuid;
      v_source_domain := 'moderation'; v_source_type := case tg_table_name
        when 'commune_reports' then 'commune_report' else 'content_report' end;
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'moderation.report.received'
        else 'moderation.report.status_changed' end;
      v_category := 'moderation';
      v_title := case v_state when 'submitted' then 'Report received'
        when 'under_review' then 'Report is under review'
        when 'action_taken' then 'Report review completed'
        when 'dismissed' then 'Report review completed'
        else 'Report status updated' end;
      v_preview := 'Open your account notifications for the report status. Report details and reviewer notes remain private.';
      v_deep_link := '/commons-circle/notifications';

    when 'commune_comments' then
      if tg_op = 'INSERT' then return new; end if;
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_actor := coalesce(v_actor, nullif(v_new ->> 'hidden_by', '')::uuid, v_recipient);
      v_source_domain := 'commune'; v_source_type := 'commune_comment';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      if v_state in ('draft','pending_review','deleted_by_user') then return new; end if;
      v_event_type := 'commune.comment.status_changed';
      v_title := case v_state
        when 'published' then 'Commune comment published'
        when 'hidden' then 'Commune comment hidden by moderation'
        when 'removed_by_moderator' then 'Commune comment removed by moderation'
        when 'archived' then 'Commune comment archived'
        else 'Commune comment updated' end;
      v_preview := 'Open the Commune post for the comment publication or moderation status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/notifications'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_state in ('hidden','removed_by_moderator') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_media' then
      if tg_op = 'INSERT' then return new; end if;
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'owner_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'commune_media';
      v_state := v_new ->> 'visibility_state';
      v_old_state := v_old ->> 'visibility_state';
      if v_state = 'submitted' then return new; end if;
      v_event_type := 'commune.media.status_changed';
      v_title := case v_state
        when 'published' then 'Commune attachment published'
        when 'flagged' then 'Commune attachment flagged for review'
        when 'hidden' then 'Commune attachment hidden by moderation'
        when 'removed' then 'Commune attachment removed by moderation'
        when 'revoked' then 'Commune attachment access revoked'
        when 'archived' then 'Commune attachment archived'
        else 'Commune attachment updated' end;
      v_preview := 'Open the linked Commune surface for the current attachment status. File details are not included here.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_state in ('flagged','hidden','removed','revoked') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_sandbox_review_requests' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := coalesce(
        nullif(v_new ->> 'submitted_by', '')::uuid,
        nullif(v_new ->> 'user_id', '')::uuid
      );
      v_source_domain := 'sandbox'; v_source_type := 'sandbox_review_request';
      v_state := coalesce(v_new ->> 'request_status', '') || ':' ||
        coalesce(v_new ->> 'review_status', '') || ':' ||
        coalesce(v_new ->> 'handoff_status', '') || ':' ||
        coalesce(v_new ->> 'status', '');
      v_old_state := coalesce(v_old ->> 'request_status', '') || ':' ||
        coalesce(v_old ->> 'review_status', '') || ':' ||
        coalesce(v_old ->> 'handoff_status', '') || ':' ||
        coalesce(v_old ->> 'status', '');
      if tg_op = 'INSERT'
         and v_new ->> 'request_status' = 'draft'
         and v_new ->> 'review_status' = 'not_submitted' then return new; end if;
      if tg_op = 'UPDATE'
         and v_new ->> 'handoff_status' = 'exported'
         and v_new ->> 'request_status' = v_old ->> 'request_status'
         and v_new ->> 'review_status' = v_old ->> 'review_status'
         and v_new ->> 'status' = v_old ->> 'status' then return new; end if;
      v_event_type := case when tg_op = 'INSERT'
        then 'sandbox.review_request.submitted'
        else 'sandbox.review_request.status_changed' end;
      v_category := 'sandbox';
      v_title := case
        when v_new ->> 'request_status' = 'changes_requested'
          or v_new ->> 'review_status' = 'changes_requested'
          or v_new ->> 'status' = 'needs_information'
          then 'Sandbox review request needs information'
        when v_new ->> 'request_status' = 'approved_for_local_handoff'
          or v_new ->> 'review_status' = 'approved'
          or v_new ->> 'status' = 'approved_for_local_sandbox'
          then 'Selected artifact approved for local handoff'
        when v_new ->> 'request_status' = 'security_hold'
          or v_new ->> 'review_status' = 'security_hold'
          then 'Sandbox review request placed on security hold'
        when v_new ->> 'request_status' in ('rejected','revoked')
          or v_new ->> 'review_status' = 'rejected'
          or v_new ->> 'status' = 'rejected'
          then 'Sandbox review request declined or revoked'
        when v_new ->> 'request_status' = 'archived'
          or v_new ->> 'status' = 'archived'
          then 'Sandbox review request archived'
        when v_new ->> 'review_status' = 'pending_review'
          or v_new ->> 'request_status' = 'submitted'
          or v_new ->> 'status' in ('requested','in_review')
          then 'Sandbox review request received'
        else 'Sandbox review request updated' end;
      v_preview := 'Open Requests & Reviews for the selected-artifact review status. This notice does not grant execution permission.';
      v_deep_link := '/commons-circle/requests-reviews';
      if v_new ->> 'request_status' = 'changes_requested'
         or v_new ->> 'review_status' = 'changes_requested'
         or v_new ->> 'status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_sandbox_review_request';
        v_priority := 75;
      elsif v_new ->> 'request_status' in ('security_hold','revoked')
         or v_new ->> 'review_status' = 'security_hold' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 90; v_request_email := true;
      end if;

    when 'commune_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_actor := coalesce(v_actor, nullif(v_new ->> 'hidden_by', '')::uuid, v_recipient);
      v_source_domain := 'commune'; v_source_type := 'commune_post';
      v_state := coalesce(v_new ->> 'status', '') || ':' || coalesce(v_new ->> 'moderation_status', '');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' || coalesce(v_old ->> 'moderation_status', '');
      if tg_op = 'INSERT' then return new; end if;
      v_event_type := 'commune.post.status_changed';
      v_title := case v_new ->> 'status'
        when 'needs_information' then 'Commune post needs information'
        when 'published' then 'Commune post published'
        when 'approved' then 'Commune post approved'
        when 'rejected' then 'Commune post rejected'
        when 'hidden' then 'Commune post hidden by moderation'
        when 'removed_by_moderator' then 'Commune post removed by moderation'
        when 'archived' then 'Commune post archived'
        else 'Commune post updated' end;
      v_preview := 'Open the Commune post for its current publication and moderation state.';
      v_deep_link := '/commune/posts/' || v_source_id::text;
      if v_new ->> 'status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_commune_post'; v_priority := 75;
      elsif v_new ->> 'status' in ('rejected','hidden','removed_by_moderator') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_official_updates' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'admin_user_id')::uuid;
      v_actor_kind := 'staff';
      v_source_domain := 'commune'; v_source_type := 'official_update';
      v_state := coalesce(v_new ->> 'official_status', '') || ':' ||
        coalesce(v_new ->> 'correction_status', 'none');
      v_old_state := coalesce(v_old ->> 'official_status', '') || ':' ||
        coalesce(v_old ->> 'correction_status', 'none');
      v_event_type := case when tg_op = 'INSERT' then 'commune.official_update.published'
        else 'commune.official_update.status_changed' end;
      v_category := 'announcements';
      v_title := 'Official Update lifecycle recorded';
      v_preview := 'Open the Official Update for its current public lifecycle. Audience delivery requires the governed announcement workflow.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');

    else
      return new;
  end case;

  if v_recipient is null or v_source_id is null then return new; end if;
  if tg_op = 'UPDATE' and v_state is not distinct from v_old_state then return new; end if;
  if v_actor is null then
    v_actor_kind := 'system';
  elsif v_actor is distinct from v_recipient then
    v_actor_kind := 'staff';
  end if;

  v_transition_key := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    tg_table_schema || '.' || tg_table_name || ':' || v_source_id::text || ':' ||
    coalesce(v_old_state, '<insert>') || ':' || coalesce(v_state, '<none>') || ':' ||
    coalesce(v_new ->> 'updated_at', v_new ->> 'created_at', pg_catalog.now()::text),
    'UTF8'
  ), 'sha256'), 'hex');

  begin
    perform private.resolve_account_inbox_items(
      v_source_domain, v_source_type, v_source_id, v_recipient, 'completed'
    );
    v_event_id := private.emit_account_notification_event(
      v_event_type, v_source_domain, v_source_type, v_source_id, v_actor,
      v_actor_kind, v_recipient, 'account-source-transition:' || v_transition_key,
      v_delivery_class, v_category, v_title, v_preview, v_deep_link,
      case when v_delivery_class = 'mandatory' then 'mandatory_notice' else 'outcome' end,
      v_inbox_kind, v_action_kind, v_priority, v_request_email, v_retention
    );
    perform private.insert_legacy_account_notification_projection(
      v_event_id, v_recipient,
      pg_catalog.replace(v_event_type, '.', '_'), v_source_type, v_source_id,
      v_title, v_preview, v_deep_link
    );
  exception when others then
    if v_delivery_class = 'mandatory' then raise; end if;
    raise warning 'Optional account source projection skipped for %.%: %',
      tg_table_schema, tg_table_name, sqlstate;
  end;
  return new;
end;
$$;

do $account_domain_triggers$
declare v_table text; v_columns text;
begin
  for v_table, v_columns in values
    ('work_with_requests', 'status'),
    ('commune_troubleshooting_posts', 'troubleshooting_status'),
    ('commune_research_notes', 'review_status'),
    ('commune_repository_showcases', 'status, sandbox_review_status'),
    ('commune_iteration_showcases', 'status, sandbox_review_status'),
    ('commune_job_posts', 'application_status, anti_scam_review_status'),
    ('commune_sandbox_runs', 'status'),
    ('addon_submissions', 'status'),
    ('marketplace_listings', 'listing_status'),
    ('commune_reports', 'status'),
    ('content_reports', 'status'),
    ('commune_comments', 'status'),
    ('commune_media', 'visibility_state'),
    ('commune_sandbox_review_requests', 'status, request_status, review_status, handoff_status'),
    ('commune_posts', 'status, moderation_status'),
    ('commune_official_updates', 'official_status, correction_status')
  loop
    execute pg_catalog.format(
      'drop trigger if exists account_event_project_%I on public.%I', v_table, v_table
    );
    execute pg_catalog.format(
      'create trigger account_event_project_%I after insert or update of %s on public.%I for each row execute function private.project_account_domain_transition()',
      v_table, v_columns, v_table
    );
  end loop;
end
$account_domain_triggers$;

create or replace function private.project_commune_vote_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_recipient uuid; v_event_id uuid; v_actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op <> 'UPDATE' or new.vote_status is not distinct from old.vote_status
     or new.vote_status not in ('closed','accepted','declined','posted_to_official_update','archived') then
    return new;
  end if;
  for v_recipient in
    select distinct recipient.user_id from (
      select new.created_by as user_id
      union all
      select ballot.voter_user_id from public.commune_vote_ballots as ballot
      where ballot.vote_post_id = new.post_id
    ) as recipient
    where recipient.user_id is not null
  loop
    begin
      v_event_id := private.emit_account_notification_event(
        'commune.vote.' || new.vote_status, 'commune', 'community_vote',
        new.post_id, v_actor, case when v_actor is null then 'system' else 'staff' end,
        v_recipient, 'commune-vote:' || new.post_id::text || ':recipient:' ||
          v_recipient::text || ':status:' || new.vote_status || ':v1',
        'suppressible', 'announcements', 'Community vote outcome updated',
        'Open the Community Voting Room for the published aggregate outcome.',
        '/commune/posts/' || new.post_id::text, 'outcome', null, null, 50,
        false, 'source_lifecycle'
      );
      perform private.insert_legacy_account_notification_projection(
        v_event_id, v_recipient, 'commune_vote_' || new.vote_status,
        'community_vote', new.post_id, 'Community vote outcome updated',
        'Open the Community Voting Room for the published aggregate outcome.',
        '/commune/posts/' || new.post_id::text
      );
    exception when others then
      raise warning 'Optional community-vote projection skipped: %', sqlstate;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists account_event_project_commune_vote_outcome on public.commune_vote_posts;
create trigger account_event_project_commune_vote_outcome
after update of vote_status on public.commune_vote_posts
for each row execute function private.project_commune_vote_outcome();

create or replace function private.project_account_restriction_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event_id uuid; v_actor uuid; v_title text; v_key text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  v_actor := case when new.status = 'lifted' then new.lifted_by else new.imposed_by end;
  v_title := case new.status
    when 'active' then 'Account participation restriction applied'
    when 'lifted' then 'Account participation restriction lifted'
    else 'Account participation restriction updated' end;
  v_key := 'account-restriction:' || new.id::text || ':status:' || new.status || ':v1';
  v_event_id := private.emit_account_notification_event(
    'account.restriction.' || new.status, 'account', 'account_restriction', new.id,
    v_actor, 'staff', new.target_user_id, v_key, 'mandatory', 'moderation',
    v_title, 'Open your account Inbox to review the current participation notice.',
    '/commons-circle/inbox', 'mandatory_notice',
    case when new.status = 'active' then 'required_action' else null end,
    case when new.status = 'active' then 'review_account_restriction' else null end,
    95, true, 'audit'
  );
  perform private.insert_legacy_account_notification_projection(
    v_event_id, new.target_user_id, 'account_restriction_' || new.status,
    'account_restriction', new.id, v_title,
    'Open your account Inbox to review the current participation notice.',
    '/commons-circle/inbox'
  );
  return new;
end;
$$;

drop trigger if exists account_event_project_account_restriction on private.account_restrictions;
create trigger account_event_project_account_restriction
after insert or update of status on private.account_restrictions
for each row execute function private.project_account_restriction_event();

create or replace function private.project_account_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event_id uuid; v_actor uuid; v_title text; v_inbox text; v_action text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  v_actor := coalesce(new.resolved_by, new.claimed_by, new.user_id);
  v_title := case new.status
    when 'submitted' then 'Account request received'
    when 'identity_verification' then 'Account request needs identity verification'
    when 'cooling_period' then 'Account request cooling period started'
    when 'blocked_by_legal_hold' then 'Account request requires operator review'
    when 'completed' then 'Account request completed'
    when 'rejected' then 'Account request was not approved'
    when 'canceled' then 'Account request canceled'
    else 'Account request status updated' end;
  if new.status = 'identity_verification' then
    v_inbox := 'required_action'; v_action := 'review_account_lifecycle_request';
  end if;
  perform private.resolve_account_inbox_items(
    'account', 'account_lifecycle_request', new.id, new.user_id, 'completed'
  );
  v_event_id := private.emit_account_notification_event(
    'account.lifecycle.' || new.status, 'account', 'account_lifecycle_request',
    new.id, v_actor, case when v_actor = new.user_id then 'user' else 'staff' end,
    new.user_id,
    'account-lifecycle:' || new.id::text || ':status:' || new.status || ':v1',
    'mandatory', 'account_security', v_title,
    'Open your account controls for the current lifecycle-request status.',
    case new.action when 'data_export' then '/account/export' else '/account/delete' end,
    'mandatory_notice', v_inbox, v_action, 90, true, 'legal'
  );
  perform private.insert_legacy_account_notification_projection(
    v_event_id, new.user_id, 'account_lifecycle_' || new.status,
    'account_lifecycle_request', new.id, v_title,
    'Open your account controls for the current lifecycle-request status.',
    case new.action when 'data_export' then '/account/export' else '/account/delete' end
  );
  return new;
end;
$$;

drop trigger if exists account_event_project_account_lifecycle on private.account_lifecycle_requests;
create trigger account_event_project_account_lifecycle
after insert or update of status on private.account_lifecycle_requests
for each row execute function private.project_account_lifecycle_event();

-- Bridge the proven economic delivery record after its canonical legacy row is
-- created. Financial truth and retry authority stay in the economic system.
create or replace function private.project_economic_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event_id uuid; v_title text; v_preview text; v_class text; v_category text;
begin
  select notification.title, notification.body into v_title, v_preview
  from public.user_notifications as notification where notification.id = new.notification_id;
  v_class := case when new.notification_type in (
    'economic_support_updated','sandbox_credit_balance_updated',
    'support_recognition_state_updated'
  ) then 'suppressible' else 'mandatory' end;
  v_category := case when new.notification_type like 'marketplace_%'
    or new.notification_type like 'payout_%' then 'marketplace'
    else 'account_security' end;
  v_event_id := private.emit_account_notification_event(
    'economic.' || new.notification_type, 'economic', 'economic_notification',
    new.notification_id, null, 'service', new.user_id,
    'economic-delivery:' || pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(new.delivery_key, 'UTF8'), 'sha256'
    ), 'hex') || ':v1',
    v_class, v_category,
    private.account_event_safe_fragment(v_title, 160, 'Economic account update'),
    private.account_event_safe_fragment(
      v_preview, 500, 'Open Support & Billing for the current private status.'
    ),
    '/commons-circle/support-billing',
    case when v_class = 'mandatory' then 'mandatory_notice' else 'outcome' end,
    null, null, case when v_class = 'mandatory' then 85 else 50 end,
    false, case when v_class = 'mandatory' then 'legal' else 'account_lifecycle' end
  );
  return new;
end;
$$;

drop trigger if exists account_event_project_economic_delivery
  on private.economic_notification_deliveries;
create trigger account_event_project_economic_delivery
after insert on private.economic_notification_deliveries
for each row execute function private.project_economic_notification_delivery();

create or replace function public.reconcile_legacy_account_notifications(
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.user_notifications%rowtype;
  v_event_id uuid;
  v_notification_id uuid;
  v_category text;
  v_title text;
  v_deep_link text;
  v_processed integer := 0;
  v_reused integer := 0;
begin
  if not (
    private.community_caller_is_service_role()
    or (v_actor is not null and public.has_role(v_actor, 'administrator'::public.app_role))
  ) then
    raise exception using errcode = '42501', message = 'account_reconciliation_admin_required';
  end if;
  if p_limit is null or p_limit not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'account_reconciliation_limit_invalid';
  end if;

  for v_row in
    select notification.*
    from public.user_notifications as notification
    where not exists (
      select 1 from private.account_legacy_notification_projection_map as mapping
      where mapping.legacy_notification_id = notification.id
    )
    order by notification.created_at, notification.id
    limit p_limit
    for update skip locked
  loop
    v_event_id := null; v_notification_id := null;
    if v_row.source_type = 'commune_code_revision_proposal' and v_row.source_id is not null then
      select projection.event_id, projection.id
      into v_event_id, v_notification_id
      from public.account_notifications as projection
      where projection.recipient_user_id = v_row.user_id
        and projection.source_domain = 'commune'
        and projection.source_type = 'code_revision_proposal'
        and projection.source_record_id = v_row.source_id
      order by projection.created_at desc limit 1;
    end if;

    if v_notification_id is not null then
      v_reused := v_reused + 1;
    else
      v_category := case
        when v_row.notification_type ~* '(security|auth|account|guardian|lifecycle)' then 'account_security'
        when v_row.notification_type ~* '(marketplace|addon|economic|billing|payment|refund|dispute|payout|support|sponsor|waiver|assistance)' then 'marketplace'
        when v_row.notification_type ~* '(mention)' then 'community_mentions'
        when v_row.notification_type ~* '(reply|comment|thread)' then 'community_replies'
        when v_row.notification_type ~* '(moderation|report|sanction|restriction)' then 'moderation'
        when v_row.notification_type ~* '(official|announcement)' then 'announcements'
        when v_row.notification_type ~* '(sandbox)' then 'sandbox'
        else 'work_reviews' end;
      v_title := case v_category
        when 'account_security' then 'Account notice'
        when 'marketplace' then 'Marketplace or economic update'
        when 'community_mentions' then 'Community mention'
        when 'community_replies' then 'Community activity update'
        when 'moderation' then 'Moderation update'
        when 'announcements' then 'Official update'
        when 'sandbox' then 'Sandbox update'
        else 'Request or review update' end;
      v_deep_link := case when private.account_event_deep_link_is_safe(v_row.action_url)
        then v_row.action_url else '/commons-circle/notifications' end;
      v_event_id := private.record_account_event(
        'legacy.notification.reconciled', 1, 'legacy', 'legacy_notification',
        v_row.id, null, 'system',
        'legacy-notification:' || v_row.id::text || ':v1',
        'suppressible', v_category, v_title,
        'Open the linked account surface for this earlier notification.',
        pg_catalog.jsonb_build_object('legacyNotificationType',
          private.account_event_safe_fragment(v_row.notification_type, 100, 'general')),
        v_deep_link, 'account_lifecycle', null
      );
      perform private.project_account_event(
        v_event_id, v_row.user_id, null, null, 50, 'legacy', false
      );
      select projection.id into strict v_notification_id
      from public.account_notifications as projection
      where projection.recipient_user_id = v_row.user_id
        and projection.event_id = v_event_id
        and projection.projection_kind = 'legacy';
      if v_row.read_at is not null or v_row.is_read then
        update public.account_notifications
        set read_at = coalesce(v_row.read_at, v_row.created_at), updated_at = pg_catalog.now()
        where id = v_notification_id;
      end if;
    end if;

    insert into private.account_legacy_notification_projection_map(
      legacy_notification_id, recipient_user_id, event_id, notification_id
    ) values (v_row.id, v_row.user_id, v_event_id, v_notification_id)
    on conflict (legacy_notification_id) do nothing;
    v_processed := v_processed + 1;
  end loop;
  return pg_catalog.jsonb_build_object(
    'processed', v_processed,
    'reusedExistingProjection', v_reused,
    'remaining', (
      select pg_catalog.count(*) from public.user_notifications as notification
      where not exists (
        select 1 from private.account_legacy_notification_projection_map as mapping
        where mapping.legacy_notification_id = notification.id
      )
    )
  );
end;
$$;

create or replace function public.account_notification_reconciliation_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if not (
    private.community_caller_is_service_role()
    or (v_actor is not null and public.has_role(v_actor, 'administrator'::public.app_role))
  ) then
    raise exception using errcode = '42501', message = 'account_reconciliation_admin_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'legacyRows', (select pg_catalog.count(*) from public.user_notifications),
    'mappedRows', (select pg_catalog.count(*) from private.account_legacy_notification_projection_map),
    'accountEvents', (select pg_catalog.count(*) from private.account_events),
    'inboxItems', (select pg_catalog.count(*) from public.account_inbox_items),
    'notificationItems', (select pg_catalog.count(*) from public.account_notifications),
    'pendingEmailDeliveries', (
      select pg_catalog.count(*) from private.account_delivery_outbox
      where status in ('pending','processing','failed')
    )
  );
end;
$$;

create or replace function public.complete_account_delivery_v2(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_delivery_evidence_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_delivery_evidence_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'account_delivery_service_required';
  end if;
  update private.account_delivery_outbox
  set status = 'delivered', delivered_at = pg_catalog.now(),
      delivery_evidence_sha256 = p_delivery_evidence_sha256,
      lease_token = null, lease_expires_at = null, last_error_code = null,
      updated_at = pg_catalog.now()
  where id = p_delivery_id and status = 'processing' and lease_token = p_lease_token;
  if not found then
    raise exception using errcode = '55000', message = 'account_delivery_lease_invalid';
  end if;
end;
$$;

create or replace function public.fail_account_delivery_v2(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_failure_evidence_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt integer;
begin
  if not private.community_caller_is_service_role()
     or coalesce(p_error_code, '') !~ '^[a-z][a-z0-9_]{2,79}$'
     or coalesce(p_failure_evidence_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'account_delivery_service_required';
  end if;
  select attempt_count into v_attempt
  from private.account_delivery_outbox
  where id = p_delivery_id and status = 'processing' and lease_token = p_lease_token
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'account_delivery_lease_invalid';
  end if;
  update private.account_delivery_outbox
  set status = case when v_attempt >= 10 then 'abandoned' else 'failed' end,
      available_at = pg_catalog.now() + pg_catalog.make_interval(
        secs => least(3600, (30 * pg_catalog.power(2, v_attempt))::integer)
      ),
      lease_token = null, lease_expires_at = null,
      last_error_code = p_error_code,
      delivery_evidence_sha256 = p_failure_evidence_sha256,
      updated_at = pg_catalog.now()
  where id = p_delivery_id;
end;
$$;

-- Source tombstones are explicit for every new producer. Unknown domains stay
-- available for forward compatibility, as in the preceding foundation.
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
    return exists (select 1 from public.commune_code_revision_proposals where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'commune_comment' then
    return exists (select 1 from public.commune_comments where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'troubleshooting_post' then
    return exists (select 1 from public.commune_troubleshooting_posts where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'research_note' then
    return exists (select 1 from public.commune_research_notes where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'repository_showcase' then
    return exists (select 1 from public.commune_repository_showcases where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'iteration_showcase' then
    return exists (select 1 from public.commune_iteration_showcases where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'job_post' then
    return exists (select 1 from public.commune_job_posts where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'commune_post' then
    return exists (select 1 from public.commune_posts where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'commune_media' then
    return exists (select 1 from public.commune_media where id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'community_vote' then
    return exists (select 1 from public.commune_vote_posts where post_id = p_source_record_id);
  elsif p_source_domain = 'commune' and p_source_type = 'official_update' then
    return exists (select 1 from public.commune_official_updates where id = p_source_record_id);
  elsif p_source_domain = 'work_with' and p_source_type = 'work_with_request' then
    return exists (select 1 from public.work_with_requests where id = p_source_record_id);
  elsif p_source_domain = 'sandbox' and p_source_type = 'sandbox_run' then
    return exists (select 1 from public.commune_sandbox_runs where id = p_source_record_id);
  elsif p_source_domain = 'sandbox' and p_source_type = 'sandbox_review_request' then
    return exists (select 1 from public.commune_sandbox_review_requests where id = p_source_record_id);
  elsif p_source_domain = 'developer_forge' and p_source_type = 'addon_submission' then
    return exists (select 1 from public.addon_submissions where id = p_source_record_id);
  elsif p_source_domain = 'marketplace' and p_source_type = 'marketplace_listing' then
    return exists (select 1 from public.marketplace_listings where id = p_source_record_id);
  elsif p_source_domain = 'moderation' and p_source_type = 'commune_report' then
    return exists (select 1 from public.commune_reports where id = p_source_record_id);
  elsif p_source_domain = 'moderation' and p_source_type = 'content_report' then
    return exists (select 1 from public.content_reports where id = p_source_record_id);
  elsif p_source_domain = 'account' and p_source_type = 'account_restriction' then
    return exists (select 1 from private.account_restrictions where id = p_source_record_id);
  elsif p_source_domain = 'account' and p_source_type = 'account_lifecycle_request' then
    return exists (select 1 from private.account_lifecycle_requests where id = p_source_record_id);
  elsif p_source_domain = 'economic' and p_source_type = 'economic_notification' then
    return exists (select 1 from public.user_notifications where id = p_source_record_id);
  elsif p_source_domain = 'legacy' and p_source_type = 'legacy_notification' then
    return exists (select 1 from public.user_notifications where id = p_source_record_id);
  elsif p_source_domain = 'conversations' and p_source_type = 'conversation_request' then
    return exists (select 1 from private.account_conversations where id = p_source_record_id);
  elsif p_source_domain = 'conversations' and p_source_type = 'private_message' then
    return exists (select 1 from private.account_messages where id = p_source_record_id);
  elsif p_source_domain = 'account' and p_source_type = 'admin_announcement' then
    return exists (select 1 from private.account_announcement_drafts where id = p_source_record_id);
  elsif p_source_domain = 'moderation' and p_source_type = 'account_conversation_report' then
    return exists (select 1 from private.account_conversation_reports where id = p_source_record_id);
  end if;
  return true;
end;
$$;

-- Legacy rows stay readable and recipient-managed during observation, but the
-- browser can no longer forge rows or rewrite their descriptive fields.
drop policy if exists "users create own non-economic notifications" on public.user_notifications;
drop policy if exists "commune reviewers create review notifications" on public.user_notifications;
drop policy if exists "commune trigger creates own notifications" on public.user_notifications;
revoke insert, update on public.user_notifications from authenticated;
grant update (read_at, is_read) on public.user_notifications to authenticated;

do $account_producer_function_hardening$
declare v_signature text; v_backend_role text := 'service' || '_role';
begin
  foreach v_signature in array array[
    'private.account_event_safe_fragment(text,integer,text)',
    'private.emit_account_notification_event(text,text,text,uuid,uuid,text,uuid,text,text,text,text,text,text,text,text,text,integer,boolean,text)',
    'private.insert_legacy_account_notification_projection(uuid,uuid,text,text,uuid,text,text,text)',
    'public.notify_commune_published_comment()',
    'private.project_account_domain_transition()',
    'private.project_commune_vote_outcome()',
    'private.project_account_restriction_event()',
    'private.project_account_lifecycle_event()',
    'private.project_economic_notification_delivery()',
    'private.account_event_source_available(text,text,uuid)'
  ] loop
    execute pg_catalog.format('alter function %s owner to postgres', v_signature);
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated, %I',
      v_signature, v_backend_role
    );
  end loop;
end
$account_producer_function_hardening$;

alter function public.reconcile_legacy_account_notifications(integer) owner to postgres;
alter function public.account_notification_reconciliation_status() owner to postgres;
alter function public.complete_account_delivery_v2(uuid, uuid, text) owner to postgres;
alter function public.fail_account_delivery_v2(uuid, uuid, text, text) owner to postgres;

do $account_producer_rpc_grants$
declare v_backend_role text := 'service' || '_role';
begin
  revoke all privileges on function public.reconcile_legacy_account_notifications(integer)
    from public, anon, authenticated;
  revoke all privileges on function public.account_notification_reconciliation_status()
    from public, anon, authenticated;
  revoke all privileges on function public.complete_account_delivery_v2(uuid, uuid, text)
    from public, anon, authenticated;
  revoke all privileges on function public.fail_account_delivery_v2(uuid, uuid, text, text)
    from public, anon, authenticated;
  grant execute on function public.reconcile_legacy_account_notifications(integer)
    to authenticated;
  grant execute on function public.account_notification_reconciliation_status()
    to authenticated;
  execute pg_catalog.format(
    'grant execute on function public.reconcile_legacy_account_notifications(integer) to %I',
    v_backend_role
  );
  execute pg_catalog.format(
    'grant execute on function public.account_notification_reconciliation_status() to %I',
    v_backend_role
  );
  execute pg_catalog.format(
    'grant execute on function public.complete_account_delivery_v2(uuid,uuid,text) to %I',
    v_backend_role
  );
  execute pg_catalog.format(
    'grant execute on function public.fail_account_delivery_v2(uuid,uuid,text,text) to %I',
    v_backend_role
  );
end
$account_producer_rpc_grants$;

comment on table public.commune_comment_mentions is
  'Bounded Commune mention facts derived from published comment text. The comment remains authoritative; Artisan mentions remain separate.';
comment on table private.account_legacy_notification_projection_map is
  'Identifier-only reconciliation evidence from legacy Signals rows to governed notification projections.';
comment on function public.reconcile_legacy_account_notifications(integer) is
  'Bounded, idempotent admin/service reconciliation. Returns counts only and never returns legacy bodies or private source content.';

commit;

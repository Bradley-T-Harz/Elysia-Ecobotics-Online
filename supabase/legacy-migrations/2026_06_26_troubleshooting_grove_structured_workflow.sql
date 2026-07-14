-- Troubleshooting Grove structured support workflow.
-- Adds room-native troubleshooting metadata and makes shared code-revision proposals
-- room-aware for Coding Cornucopia revisions and Troubleshooting Grove proposed fixes.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'troubleshooting-grove',
  'Troubleshooting Grove',
  'Moderated troubleshooting, bug reports, install issues, known problems, redacted logs, reproduction snippets, proposed fixes, and safe diagnostic support.',
  'troubleshooting'
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    room_type = excluded.room_type,
    updated_at = now();

create table if not exists public.commune_troubleshooting_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.commune_posts(id) on delete cascade,
  thread_id uuid references public.commune_threads(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  issue_type text not null default 'other',
  affected_area text,
  environment_os text,
  environment_browser text,
  app_version text,
  environment_notes text,
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  error_message text,
  redacted_logs text,
  workaround text,
  troubleshooting_status text not null default 'open',
  accepted_comment_id uuid references public.commune_comments(id) on delete set null,
  accepted_proposal_id uuid references public.commune_code_revision_proposals(id) on delete set null,
  accepted_resolution_kind text,
  accepted_summary text,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_troubleshooting_issue_type_check check (issue_type in ('bug','install_issue','account_auth','deployment','supabase_rls','cloudflare','frontend_ui','backend_api','sandbox_runner','marketplace','commune','profile','documentation','other')),
  constraint commune_troubleshooting_status_check check (troubleshooting_status in ('open','needs_information','in_progress','workaround_found','fix_proposed','resolved','closed','archived')),
  constraint commune_troubleshooting_resolution_kind_check check (accepted_resolution_kind is null or accepted_resolution_kind in ('comment','proposal','workaround','admin_resolution','manual_note')),
  constraint commune_troubleshooting_public_text_length_check check (
    char_length(coalesce(affected_area, '')) <= 500
    and char_length(coalesce(environment_os, '')) <= 250
    and char_length(coalesce(environment_browser, '')) <= 250
    and char_length(coalesce(app_version, '')) <= 250
    and char_length(coalesce(environment_notes, '')) <= 4000
    and char_length(coalesce(steps_to_reproduce, '')) <= 12000
    and char_length(coalesce(expected_result, '')) <= 8000
    and char_length(coalesce(actual_result, '')) <= 8000
    and char_length(coalesce(error_message, '')) <= 8000
    and char_length(coalesce(redacted_logs, '')) <= 20000
    and char_length(coalesce(workaround, '')) <= 12000
    and char_length(coalesce(accepted_summary, '')) <= 4000
  )
);

alter table public.commune_troubleshooting_posts
  add column if not exists thread_id uuid references public.commune_threads(id) on delete set null,
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists issue_type text not null default 'other',
  add column if not exists affected_area text,
  add column if not exists environment_os text,
  add column if not exists environment_browser text,
  add column if not exists app_version text,
  add column if not exists environment_notes text,
  add column if not exists steps_to_reproduce text,
  add column if not exists expected_result text,
  add column if not exists actual_result text,
  add column if not exists error_message text,
  add column if not exists redacted_logs text,
  add column if not exists workaround text,
  add column if not exists troubleshooting_status text not null default 'open',
  add column if not exists accepted_comment_id uuid references public.commune_comments(id) on delete set null,
  add column if not exists accepted_proposal_id uuid references public.commune_code_revision_proposals(id) on delete set null,
  add column if not exists accepted_resolution_kind text,
  add column if not exists accepted_summary text,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists commune_troubleshooting_post_idx on public.commune_troubleshooting_posts(post_id);
create index if not exists commune_troubleshooting_author_status_idx on public.commune_troubleshooting_posts(author_user_id, troubleshooting_status, updated_at desc);
create index if not exists commune_troubleshooting_status_idx on public.commune_troubleshooting_posts(troubleshooting_status, updated_at desc);
create index if not exists commune_troubleshooting_issue_area_idx on public.commune_troubleshooting_posts(issue_type, affected_area);

alter table public.commune_troubleshooting_posts enable row level security;

drop policy if exists "public can read published troubleshooting metadata" on public.commune_troubleshooting_posts;
create policy "public can read published troubleshooting metadata"
  on public.commune_troubleshooting_posts
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "signed users create own troubleshooting metadata" on public.commune_troubleshooting_posts;
create policy "signed users create own troubleshooting metadata"
  on public.commune_troubleshooting_posts
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
        and p.post_type = 'troubleshooting'
    )
  );

drop policy if exists "authors update troubleshooting status and resolution" on public.commune_troubleshooting_posts;
create policy "authors update troubleshooting status and resolution"
  on public.commune_troubleshooting_posts
  for update
  to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists "reviewers manage troubleshooting metadata" on public.commune_troubleshooting_posts;
create policy "reviewers manage troubleshooting metadata"
  on public.commune_troubleshooting_posts
  for all
  to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

create or replace function public.touch_commune_troubleshooting_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_troubleshooting_posts_updated_at on public.commune_troubleshooting_posts;
create trigger touch_commune_troubleshooting_posts_updated_at
before update on public.commune_troubleshooting_posts
for each row execute function public.touch_commune_troubleshooting_posts_updated_at();

create or replace function public.submit_commune_code_revision_proposal(
  p_post_id uuid,
  p_code_snippet_id uuid,
  p_proposed_code_text text,
  p_language text,
  p_file_name text,
  p_change_summary text,
  p_explanation text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_proposal_id uuid;
  v_is_troubleshooting boolean := false;
  v_room_label text := 'Coding Cornucopia';
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception 'Authentication required to propose a code revision or troubleshooting fix.';
  end if;

  if char_length(coalesce(p_proposed_code_text, '')) > 100000 then
    raise exception 'Proposed code exceeds the 100000 character limit.';
  end if;

  if char_length(trim(coalesce(p_change_summary, ''))) = 0 then
    raise exception 'A change summary is required for code revision proposals and troubleshooting fixes.';
  end if;

  select
    s.id as snippet_id,
    s.post_id,
    s.code_text,
    s.language as current_language,
    s.file_name as current_file_name,
    coalesce(s.accepted_version_number, 1) as accepted_version_number,
    p.user_id as post_author_id,
    p.title as post_title,
    p.post_type
  into v_row
  from public.commune_code_snippets s
  join public.commune_posts p on p.id = s.post_id
  where s.id = p_code_snippet_id
    and s.post_id = p_post_id
    and p.status = 'published'
    and p.visibility = 'public';

  if not found or v_row.post_author_id is null then
    raise exception 'This public code snippet is not available for proposals.';
  end if;

  if v_row.post_type not in ('code_sharing', 'troubleshooting') then
    raise exception 'Only Coding Cornucopia and Troubleshooting Grove snippets accept public proposals.';
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting';
  if v_is_troubleshooting then
    v_room_label := 'Troubleshooting Grove';
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  insert into public.commune_code_revision_proposals (
    post_id,
    code_snippet_id,
    proposer_user_id,
    original_author_user_id,
    base_code_text,
    proposed_code_text,
    language,
    file_name,
    change_summary,
    explanation,
    base_snapshot_label,
    proposal_status
  )
  values (
    p_post_id,
    p_code_snippet_id,
    v_actor,
    v_row.post_author_id,
    v_row.code_text,
    p_proposed_code_text,
    nullif(trim(coalesce(p_language, v_row.current_language, 'text')), ''),
    nullif(trim(coalesce(p_file_name, v_row.current_file_name, 'snippet')), ''),
    trim(p_change_summary),
    nullif(trim(coalesce(p_explanation, '')), ''),
    'current accepted snapshot v' || v_row.accepted_version_number::text,
    'submitted'
  )
  returning id into v_proposal_id;

  if v_is_troubleshooting then
    update public.commune_troubleshooting_posts
      set troubleshooting_status = case
          when troubleshooting_status in ('resolved', 'closed', 'archived') then troubleshooting_status
          else 'fix_proposed'
        end,
        updated_at = now()
      where post_id = p_post_id;
  end if;

  if v_row.post_author_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.post_author_id,
      case when v_is_troubleshooting then 'commune_troubleshooting_fix_proposed' else 'commune_code_revision_proposed' end,
      'commune_code_revision_proposal',
      v_proposal_id,
      case when v_is_troubleshooting then 'New Troubleshooting Grove proposed fix' else 'New Coding Cornucopia revision proposal' end,
      case
        when v_is_troubleshooting then 'A community member proposed a fix for "' || coalesce(v_row.post_title, 'your Troubleshooting Grove issue') || '". The public reproduction snippet will not change unless you accept it.'
        else 'A community member proposed a revision to "' || coalesce(v_row.post_title, 'your Coding Cornucopia post') || '". The public code will not change unless you accept it.'
      end,
      v_review_path || '?proposal=' || v_proposal_id::text
    );
  end if;

  return v_proposal_id;
end;
$$;

create or replace function public.decide_commune_code_revision_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_next_version integer;
  v_status text := lower(trim(coalesce(p_decision, '')));
  v_is_troubleshooting boolean := false;
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception 'Authentication required to decide a code proposal.';
  end if;

  if v_status not in ('accepted', 'rejected', 'needs_changes', 'hidden_by_moderation') then
    raise exception 'Unsupported code proposal decision.';
  end if;

  select
    proposal.*,
    post.title as post_title,
    post.post_type,
    snippet.accepted_version_number as current_version
  into v_row
  from public.commune_code_revision_proposals proposal
  join public.commune_posts post on post.id = proposal.post_id
  join public.commune_code_snippets snippet on snippet.id = proposal.code_snippet_id
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Code proposal not found.';
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting';
  if v_is_troubleshooting then
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  if v_status = 'hidden_by_moderation' then
    if not public.current_user_can_review_domain('commune'::public.review_domain) then
      raise exception 'Moderator authority is required to hide a code proposal.';
    end if;
  elsif v_row.original_author_user_id <> v_actor then
    raise exception 'Only the original post author can accept, reject, or request changes on this proposal.';
  end if;

  if v_row.proposal_status not in ('submitted', 'needs_changes') then
    raise exception 'Only submitted proposals can be decided.';
  end if;

  if v_status = 'accepted' then
    v_next_version := coalesce(v_row.current_version, 1) + 1;

    update public.commune_code_snippets
      set code_text = v_row.proposed_code_text,
          language = v_row.language,
          file_name = v_row.file_name,
          accepted_revision_id = v_row.id,
          accepted_version_number = v_next_version,
          accepted_revision_proposer_user_id = v_row.proposer_user_id,
          accepted_revision_summary = v_row.change_summary,
          accepted_at = now(),
          updated_at = now()
      where id = v_row.code_snippet_id;

    update public.commune_code_revision_proposals
      set proposal_status = 'accepted',
          accepted_version_number = v_next_version,
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
        set troubleshooting_status = 'resolved',
            accepted_proposal_id = p_proposal_id,
            accepted_resolution_kind = 'proposal',
            accepted_summary = v_row.change_summary,
            accepted_by = v_actor,
            accepted_at = now(),
            resolved_at = now(),
            updated_at = now()
        where post_id = v_row.post_id;
    end if;
  elsif v_status = 'hidden_by_moderation' then
    update public.commune_code_revision_proposals
      set proposal_status = 'hidden_by_moderation',
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          hidden_at = now(),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;
  else
    update public.commune_code_revision_proposals
      set proposal_status = v_status,
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
        set troubleshooting_status = case when v_status = 'needs_changes' then 'needs_information' else 'in_progress' end,
            updated_at = now()
        where post_id = v_row.post_id
          and troubleshooting_status not in ('resolved', 'closed', 'archived');
    end if;
  end if;

  if v_row.proposer_user_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.proposer_user_id,
      case
        when v_is_troubleshooting then 'commune_troubleshooting_fix_' || v_status
        else 'commune_code_revision_' || v_status
      end,
      'commune_code_revision_proposal',
      p_proposal_id,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'Your Troubleshooting Grove fix was accepted'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'Changes requested on your Troubleshooting Grove fix'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A Troubleshooting Grove proposed fix was hidden by moderation'
        when v_is_troubleshooting then 'Your Troubleshooting Grove fix was rejected'
        when v_status = 'accepted' then 'Your Coding Cornucopia revision was accepted'
        when v_status = 'needs_changes' then 'Changes requested on your Coding Cornucopia revision'
        when v_status = 'hidden_by_moderation' then 'A Coding Cornucopia proposal was hidden by moderation'
        else 'Your Coding Cornucopia revision was rejected'
      end,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'The original post author accepted your proposed fix. The public reproduction snippet now points to the accepted snapshot.'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'The original post author asked for changes. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A moderator hid this proposed fix for safety review. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting then 'The original post author rejected the proposed fix. The public reproduction snippet remains unchanged.'
        when v_status = 'accepted' then 'The original post author accepted your revision. The public attached code now points to the accepted snapshot.'
        when v_status = 'needs_changes' then 'The original post author asked for changes. The public attached code remains unchanged.'
        when v_status = 'hidden_by_moderation' then 'A moderator hid this proposal for safety review. The public attached code remains unchanged.'
        else 'The original post author rejected the proposal. The public attached code remains unchanged.'
      end,
      v_review_path || '?proposal=' || p_proposal_id::text
    );
  end if;
end;
$$;

grant select on table public.commune_troubleshooting_posts to anon, authenticated;
grant insert, update on table public.commune_troubleshooting_posts to authenticated;
grant execute on function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.decide_commune_code_revision_proposal(uuid, text, text) to authenticated;

comment on table public.commune_troubleshooting_posts is 'Structured Troubleshooting Grove issue metadata linked to moderated Commune posts. Public-safe diagnostic/support context only.';

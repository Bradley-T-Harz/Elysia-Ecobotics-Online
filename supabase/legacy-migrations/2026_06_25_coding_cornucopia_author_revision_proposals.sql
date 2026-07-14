-- Coding Cornucopia author-controlled revision proposals.
-- Public code snippets remain stable until the original post author accepts a proposal.

alter table public.commune_code_snippets
  add column if not exists accepted_revision_id uuid,
  add column if not exists accepted_version_number integer not null default 1,
  add column if not exists accepted_revision_proposer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists accepted_revision_summary text,
  add column if not exists accepted_at timestamptz;

create table if not exists public.commune_code_revision_proposals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.commune_posts(id) on delete cascade,
  code_snippet_id uuid not null references public.commune_code_snippets(id) on delete cascade,
  proposer_user_id uuid not null references auth.users(id) on delete cascade,
  original_author_user_id uuid not null references auth.users(id) on delete cascade,
  base_code_text text not null,
  proposed_code_text text not null,
  language text,
  file_name text,
  change_summary text not null,
  explanation text,
  base_snapshot_label text not null default 'current accepted snapshot',
  proposal_status text not null default 'submitted',
  sandbox_summary jsonb not null default '{}'::jsonb,
  accepted_version_number integer,
  decision_by uuid references auth.users(id) on delete set null,
  decision_note text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  withdrawn_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_code_revision_status_check check (proposal_status in ('draft','submitted','needs_changes','accepted','rejected','withdrawn','hidden_by_moderation')),
  constraint commune_code_revision_summary_check check (char_length(trim(change_summary)) between 1 and 500),
  constraint commune_code_revision_code_length_check check (char_length(proposed_code_text) <= 100000 and char_length(base_code_text) <= 100000),
  constraint commune_code_revision_filename_check check (file_name is null or (file_name !~ '(\.\.|/|\\)' and file_name !~* '^[A-Z]:'))
);

alter table public.commune_code_snippets
  drop constraint if exists commune_code_snippets_accepted_revision_fk;

alter table public.commune_code_snippets
  add constraint commune_code_snippets_accepted_revision_fk
  foreign key (accepted_revision_id)
  references public.commune_code_revision_proposals(id)
  on delete set null;

create index if not exists commune_code_revision_post_idx on public.commune_code_revision_proposals(post_id, created_at desc);
create index if not exists commune_code_revision_snippet_idx on public.commune_code_revision_proposals(code_snippet_id, created_at desc);
create index if not exists commune_code_revision_author_idx on public.commune_code_revision_proposals(original_author_user_id, proposal_status, created_at desc);
create index if not exists commune_code_revision_proposer_idx on public.commune_code_revision_proposals(proposer_user_id, proposal_status, created_at desc);

alter table public.commune_code_revision_proposals enable row level security;

drop policy if exists "code proposal participants read relevant proposals" on public.commune_code_revision_proposals;
create policy "code proposal participants read relevant proposals"
  on public.commune_code_revision_proposals
  for select
  to authenticated
  using (
    proposer_user_id = auth.uid()
    or original_author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "signed users propose code revisions" on public.commune_code_revision_proposals;
create policy "signed users propose code revisions"
  on public.commune_code_revision_proposals
  for insert
  to authenticated
  with check (
    proposer_user_id = auth.uid()
    and proposal_status in ('draft', 'submitted')
    and exists (
      select 1
      from public.commune_code_snippets s
      join public.commune_posts p on p.id = s.post_id
      where s.id = code_snippet_id
        and s.post_id = post_id
        and original_author_user_id = p.user_id
        and p.status = 'published'
        and p.visibility = 'public'
    )
  );

drop policy if exists "proposers withdraw own code proposals" on public.commune_code_revision_proposals;
create policy "proposers withdraw own code proposals"
  on public.commune_code_revision_proposals
  for update
  to authenticated
  using (proposer_user_id = auth.uid() and proposal_status in ('draft', 'submitted', 'needs_changes'))
  with check (proposer_user_id = auth.uid() and proposal_status = 'withdrawn');

drop policy if exists "moderators manage code proposals" on public.commune_code_revision_proposals;
create policy "moderators manage code proposals"
  on public.commune_code_revision_proposals
  for all
  to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

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
begin
  if v_actor is null then
    raise exception 'Authentication required to propose a Coding Cornucopia revision.';
  end if;

  if char_length(coalesce(p_proposed_code_text, '')) > 100000 then
    raise exception 'Proposed code exceeds the Coding Cornucopia 100000 character limit.';
  end if;

  if char_length(trim(coalesce(p_change_summary, ''))) = 0 then
    raise exception 'A change summary is required for Coding Cornucopia revision proposals.';
  end if;

  select
    s.id as snippet_id,
    s.post_id,
    s.code_text,
    s.language as current_language,
    s.file_name as current_file_name,
    coalesce(s.accepted_version_number, 1) as accepted_version_number,
    p.user_id as post_author_id,
    p.title as post_title
  into v_row
  from public.commune_code_snippets s
  join public.commune_posts p on p.id = s.post_id
  where s.id = p_code_snippet_id
    and s.post_id = p_post_id
    and p.status = 'published'
    and p.visibility = 'public';

  if not found or v_row.post_author_id is null then
    raise exception 'This public Coding Cornucopia snippet is not available for revision proposals.';
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

  if v_row.post_author_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.post_author_id,
      'commune_code_revision_proposed',
      'commune_code_revision_proposal',
      v_proposal_id,
      'New Coding Cornucopia revision proposal',
      'A community member proposed a revision to "' || coalesce(v_row.post_title, 'your Coding Cornucopia post') || '". The public code will not change unless you accept it.',
      '/commune/coding-cornucopia/review?proposal=' || v_proposal_id::text
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
begin
  if v_actor is null then
    raise exception 'Authentication required to decide a Coding Cornucopia revision proposal.';
  end if;

  if v_status not in ('accepted', 'rejected', 'needs_changes', 'hidden_by_moderation') then
    raise exception 'Unsupported Coding Cornucopia proposal decision.';
  end if;

  select
    proposal.*,
    post.title as post_title,
    snippet.accepted_version_number as current_version
  into v_row
  from public.commune_code_revision_proposals proposal
  join public.commune_posts post on post.id = proposal.post_id
  join public.commune_code_snippets snippet on snippet.id = proposal.code_snippet_id
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Coding Cornucopia revision proposal not found.';
  end if;

  if v_status = 'hidden_by_moderation' then
    if not public.current_user_can_review_domain('commune'::public.review_domain) then
      raise exception 'Moderator authority is required to hide a Coding Cornucopia proposal.';
    end if;
  elsif v_row.original_author_user_id <> v_actor then
    raise exception 'Only the original post author can accept, reject, or request changes on this proposal.';
  end if;

  if v_row.proposal_status not in ('submitted', 'needs_changes') then
    raise exception 'Only submitted Coding Cornucopia proposals can be decided.';
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
  end if;

  if v_row.proposer_user_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.proposer_user_id,
      'commune_code_revision_' || v_status,
      'commune_code_revision_proposal',
      p_proposal_id,
      case
        when v_status = 'accepted' then 'Your Coding Cornucopia revision was accepted'
        when v_status = 'needs_changes' then 'Changes requested on your Coding Cornucopia revision'
        when v_status = 'hidden_by_moderation' then 'A Coding Cornucopia proposal was hidden by moderation'
        else 'Your Coding Cornucopia revision was rejected'
      end,
      case
        when v_status = 'accepted' then 'The original post author accepted your revision. The public attached code now points to the accepted snapshot.'
        when v_status = 'needs_changes' then 'The original post author asked for changes. The public attached code remains unchanged.'
        when v_status = 'hidden_by_moderation' then 'A moderator hid this proposal for safety review. The public attached code remains unchanged.'
        else 'The original post author rejected the proposal. The public attached code remains unchanged.'
      end,
      '/commune/coding-cornucopia/review?proposal=' || p_proposal_id::text
    );
  end if;
end;
$$;

grant select, insert, update on table public.commune_code_revision_proposals to authenticated;
revoke all on table public.commune_code_revision_proposals from anon;
grant execute on function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.decide_commune_code_revision_proposal(uuid, text, text) to authenticated;

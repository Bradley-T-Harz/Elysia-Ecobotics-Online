-- Research Notes structured evidence workflow.
-- Idempotent and additive. Apply manually in Supabase SQL Editor after review.
-- Keeps internal post_type = research_note while presenting the room publicly as Research Notes.
-- Research Notes are public evidence discussions, not Official Updates, Living Library source
-- records, private research storage, certification, or trust badges.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'research-notes',
  'Research Notes',
  'Public evidence summaries, observations, source discussions, citation notes, uncertainty, Living Library source links, and interpretation-boundary research discussion.',
  'research_note'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  room_type = excluded.room_type;

create table if not exists public.commune_research_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.commune_posts(id) on delete cascade,
  thread_id uuid references public.commune_threads(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  research_question text,
  domain text,
  evidence_strength text not null default 'unknown',
  living_library_source_link text,
  related_living_library_source_id uuid,
  citation_notes text,
  evidence_summary text,
  observation text,
  interpretation text,
  uncertainty text,
  context_discussion text,
  source_links text[] not null default '{}'::text[],
  geographic_scope text,
  ecological_subsystem text not null default 'general',
  method_type text,
  data_type text,
  ethics_note text,
  review_status text not null default 'submitted',
  correction_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  corrected_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_research_notes
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade,
  add column if not exists thread_id uuid references public.commune_threads(id) on delete set null,
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists research_question text,
  add column if not exists domain text,
  add column if not exists evidence_strength text not null default 'unknown',
  add column if not exists living_library_source_link text,
  add column if not exists related_living_library_source_id uuid,
  add column if not exists citation_notes text,
  add column if not exists evidence_summary text,
  add column if not exists observation text,
  add column if not exists interpretation text,
  add column if not exists uncertainty text,
  add column if not exists context_discussion text,
  add column if not exists source_links text[] not null default '{}'::text[],
  add column if not exists geographic_scope text,
  add column if not exists ecological_subsystem text not null default 'general',
  add column if not exists method_type text,
  add column if not exists data_type text,
  add column if not exists ethics_note text,
  add column if not exists review_status text not null default 'submitted',
  add column if not exists correction_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists corrected_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_research_notes_post_unique'
      and conrelid = 'public.commune_research_notes'::regclass
  ) then
    alter table public.commune_research_notes
      add constraint commune_research_notes_post_unique unique (post_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_research_notes_evidence_strength_check'
      and conrelid = 'public.commune_research_notes'::regclass
  ) then
    alter table public.commune_research_notes
      add constraint commune_research_notes_evidence_strength_check
      check (evidence_strength in ('preliminary','anecdotal','moderate','strong','mixed','needs_verification','unknown')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_research_notes_review_status_check'
      and conrelid = 'public.commune_research_notes'::regclass
  ) then
    alter table public.commune_research_notes
      add constraint commune_research_notes_review_status_check
      check (review_status in ('submitted','published','needs_citation','needs_clarification','source_issue','overclaiming_evidence','corrected','archived')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_research_notes_ecological_subsystem_check'
      and conrelid = 'public.commune_research_notes'::regclass
  ) then
    alter table public.commune_research_notes
      add constraint commune_research_notes_ecological_subsystem_check
      check (ecological_subsystem in ('verdante','sylphora','ecotiva','aurania','terraflux','aquaria','aetheria','general','not_applicable')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_research_notes_public_text_length_check'
      and conrelid = 'public.commune_research_notes'::regclass
  ) then
    alter table public.commune_research_notes
      add constraint commune_research_notes_public_text_length_check
      check (
        char_length(coalesce(research_question, '')) <= 1000
        and char_length(coalesce(domain, '')) <= 250
        and char_length(coalesce(living_library_source_link, '')) <= 1000
        and char_length(coalesce(citation_notes, '')) <= 8000
        and char_length(coalesce(evidence_summary, '')) <= 12000
        and char_length(coalesce(observation, '')) <= 12000
        and char_length(coalesce(interpretation, '')) <= 12000
        and char_length(coalesce(uncertainty, '')) <= 8000
        and char_length(coalesce(context_discussion, '')) <= 16000
        and char_length(coalesce(geographic_scope, '')) <= 1000
        and char_length(coalesce(method_type, '')) <= 500
        and char_length(coalesce(data_type, '')) <= 500
        and char_length(coalesce(ethics_note, '')) <= 4000
        and char_length(coalesce(correction_note, '')) <= 4000
      ) not valid;
  end if;

  begin
    alter table public.commune_research_notes validate constraint commune_research_notes_evidence_strength_check;
    alter table public.commune_research_notes validate constraint commune_research_notes_review_status_check;
    alter table public.commune_research_notes validate constraint commune_research_notes_ecological_subsystem_check;
    alter table public.commune_research_notes validate constraint commune_research_notes_public_text_length_check;
  exception when others then
    raise notice 'Research Notes constraints left not validated: %', sqlerrm;
  end;
end $$;

create index if not exists commune_research_notes_post_idx on public.commune_research_notes(post_id);
create index if not exists commune_research_notes_author_status_idx on public.commune_research_notes(author_user_id, review_status, updated_at desc);
create index if not exists commune_research_notes_review_status_idx on public.commune_research_notes(review_status, updated_at desc);
create index if not exists commune_research_notes_evidence_domain_idx on public.commune_research_notes(evidence_strength, domain);
create index if not exists commune_research_notes_source_links_idx on public.commune_research_notes using gin(source_links);
create index if not exists commune_research_notes_living_source_idx on public.commune_research_notes(living_library_source_link);

alter table public.commune_research_notes enable row level security;

drop policy if exists "public reads published research notes metadata" on public.commune_research_notes;
create policy "public reads published research notes metadata"
  on public.commune_research_notes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'research_note'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "signed users create own research notes metadata" on public.commune_research_notes;
create policy "signed users create own research notes metadata"
  on public.commune_research_notes
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
        and p.post_type = 'research_note'
    )
  );

drop policy if exists "authors maintain own unpublished research notes metadata" on public.commune_research_notes;
create policy "authors maintain own unpublished research notes metadata"
  on public.commune_research_notes
  for update
  to authenticated
  using (author_user_id = auth.uid() and review_status in ('submitted','needs_citation','needs_clarification','source_issue','overclaiming_evidence','corrected'))
  with check (author_user_id = auth.uid() and review_status in ('submitted','needs_citation','needs_clarification','source_issue','overclaiming_evidence','corrected'));

drop policy if exists "reviewers manage research notes metadata" on public.commune_research_notes;
create policy "reviewers manage research notes metadata"
  on public.commune_research_notes
  for all
  to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

create or replace function public.touch_commune_research_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_research_notes_updated_at on public.commune_research_notes;
create trigger touch_commune_research_notes_updated_at
before update on public.commune_research_notes
for each row execute function public.touch_commune_research_notes_updated_at();

grant select on table public.commune_research_notes to anon;
grant select, insert, update on table public.commune_research_notes to authenticated;

comment on table public.commune_research_notes is 'Structured Research Notes metadata. Public evidence discussion only; not Official Update authority, Living Library source canonicalization, certification, private research storage, or a trust badge.';
comment on column public.commune_research_notes.evidence_strength is 'Public evidence-strength/confidence category: preliminary, anecdotal, moderate, strong, mixed, needs_verification, or unknown. This is not a trust badge.';
comment on column public.commune_research_notes.living_library_source_link is 'Public Living Library source link/reference supplied by the author. This is a metadata link, not a foreign-key guarantee or source approval.';
comment on column public.commune_research_notes.review_status is 'Research Notes review state: submitted, published, needs_citation, needs_clarification, source_issue, overclaiming_evidence, corrected, or archived.';
comment on column public.commune_research_notes.ethics_note is 'Public safety/ethics note only. Do not store private participant data, sensitive ecological locations, credentials, local Elysia data, hidden review notes, or copyrighted full-text papers without rights.';

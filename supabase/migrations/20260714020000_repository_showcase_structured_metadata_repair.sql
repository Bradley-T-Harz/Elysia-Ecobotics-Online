-- Repository Showcase structured metadata and public detail read-policy repair.
-- Idempotent and additive. Apply only after the baseline history checkpoint.
-- This does not clone, install, build, run, trust, or approve repositories.

begin;

alter table public.commune_repository_showcases
  add column if not exists provider text,
  add column if not exists default_branch text,
  add column if not exists commit_sha text,
  add column if not exists manifest_status text not null default 'No manifest checked',
  add column if not exists elysia_compatibility text not null default 'Unknown',
  add column if not exists short_description text,
  add column if not exists readme_preview text,
  add column if not exists file_tree_preview text,
  add column if not exists screenshot_notes_or_urls text,
  add column if not exists risk_flags text[] not null default '{}'::text[],
  add column if not exists sandbox_review_status text not null default 'not_requested',
  add column if not exists sandbox_review_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  add column if not exists import_source text not null default 'manual',
  add column if not exists imported_metadata jsonb not null default '{}'::jsonb,
  add column if not exists imported_at timestamptz,
  add column if not exists redaction_notes text;

update public.commune_repository_showcases
set
  provider = coalesce(provider, repository_host),
  short_description = coalesce(short_description, project_summary),
  risk_flags = case
    when coalesce(array_length(risk_flags, 1), 0) > 0 then risk_flags
    when safety_notes is not null and btrim(safety_notes) <> '' then regexp_split_to_array(safety_notes, '\s*,\s*')
    else risk_flags
  end,
  sandbox_review_status = case
    when sandbox_review_status is not null and sandbox_review_status <> 'not_requested' then sandbox_review_status
    when sandbox_review_requested then 'requested'
    else 'not_requested'
  end
where (provider is null and repository_host is not null)
   or (short_description is null and project_summary is not null)
   or (
     coalesce(array_length(risk_flags, 1), 0) = 0
     and safety_notes is not null
     and btrim(safety_notes) <> ''
   )
   or (
     sandbox_review_status = 'not_requested'
     and sandbox_review_requested
   );

do $repository_repair$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_repository_showcases_sandbox_review_status_check'
      and conrelid = 'public.commune_repository_showcases'::regclass
  ) then
    alter table public.commune_repository_showcases
      add constraint commune_repository_showcases_sandbox_review_status_check
      check (sandbox_review_status in ('not_requested','requested','queued','in_review','approved_for_selected_artifact','rejected','needs_information','archived')) not valid;
  end if;

  alter table public.commune_repository_showcases
    validate constraint commune_repository_showcases_sandbox_review_status_check;
end
$repository_repair$;

create index if not exists commune_repository_showcases_post_idx on public.commune_repository_showcases(post_id);
create index if not exists commune_repository_showcases_owner_status_idx on public.commune_repository_showcases(user_id, status, updated_at desc);
create index if not exists commune_repository_showcases_sandbox_review_idx on public.commune_repository_showcases(sandbox_review_requested, sandbox_review_status, updated_at desc);
create index if not exists commune_repository_showcases_sandbox_request_idx on public.commune_repository_showcases(sandbox_review_request_id);

drop policy if exists "public reads published repository showcase metadata" on public.commune_repository_showcases;
create policy "public reads published repository showcase metadata" on public.commune_repository_showcases
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'repository_showcase'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

revoke all privileges on table public.commune_repository_showcases
  from public, anon, authenticated;
grant select on table public.commune_repository_showcases to anon;
grant select, insert, update on table public.commune_repository_showcases to authenticated;

comment on table public.commune_repository_showcases is 'Repository Showcase metadata. Metadata-only public room; does not clone, install, build, run, approve, or trust repositories.';
comment on column public.commune_repository_showcases.readme_preview is 'User-reviewed public README excerpt/import preview. The website does not clone/build/run repositories.';
comment on column public.commune_repository_showcases.file_tree_preview is 'User-reviewed public file tree summary/import preview. Metadata only.';
comment on column public.commune_repository_showcases.sandbox_review_status is 'Selected-artifact sandbox review status only. This is not whole-repository trust, Marketplace approval, or installability.';
comment on column public.commune_repository_showcases.imported_metadata is 'Public import metadata/manual manifest details after user review; must not include private repo credentials or secrets.';

commit;

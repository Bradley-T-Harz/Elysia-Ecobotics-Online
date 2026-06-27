-- Developer Forge immutable submission snapshots and draft locking.
-- The Forge prepares add-ons for review only. It does not execute package code,
-- run scripts, install locally, or publish without Marketplace reviewer action.

create extension if not exists pgcrypto;

alter table public.addon_validation_results
  drop constraint if exists addon_validation_results_severity_check;

alter table public.addon_validation_results
  add constraint addon_validation_results_severity_check
  check (severity in ('blocked','error','warning','needs_reviewer','info'));

alter table public.addon_drafts
  drop constraint if exists addon_drafts_validation_status_check;

alter table public.addon_drafts
  add constraint addon_drafts_validation_status_check
  check (validation_status in ('not_validated','valid','warnings','errors','blocked'));

alter table public.addon_drafts
  add column if not exists locked_at timestamptz,
  add column if not exists locked_reason text,
  add column if not exists source_submission_id uuid references public.addon_submissions(id) on delete set null,
  add column if not exists revision_of_draft_id uuid references public.addon_drafts(id) on delete set null;

create table if not exists public.addon_submission_snapshots (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.addon_submissions(id) on delete cascade,
  draft_id uuid references public.addon_drafts(id) on delete set null,
  developer_user_id uuid references auth.users(id) on delete set null,
  manifest_snapshot jsonb not null,
  permissions_snapshot jsonb not null default '[]'::jsonb,
  package_snapshot jsonb not null default '{}'::jsonb,
  validation_snapshot jsonb not null default '[]'::jsonb,
  scan_snapshot jsonb not null default '[]'::jsonb,
  marketplace_preview_snapshot jsonb not null default '{}'::jsonb,
  package_sha256 text,
  package_storage_bucket text,
  package_storage_path text,
  package_file_name text,
  package_size_bytes bigint,
  signature_status text not null default 'unsigned',
  created_at timestamptz not null default now(),
  constraint addon_submission_snapshots_signature_status_check
    check (signature_status in ('unsigned','checksum_only','pending','signed','signature_failed'))
);

create index if not exists addon_submission_snapshots_submission_idx
  on public.addon_submission_snapshots(submission_id, created_at desc);

create index if not exists addon_submission_snapshots_draft_idx
  on public.addon_submission_snapshots(draft_id, created_at desc);

create index if not exists addon_submission_snapshots_developer_idx
  on public.addon_submission_snapshots(developer_user_id, created_at desc);

alter table public.addon_submission_snapshots enable row level security;

drop policy if exists "developers read own addon submission snapshots" on public.addon_submission_snapshots;
create policy "developers read own addon submission snapshots"
  on public.addon_submission_snapshots
  for select to authenticated
  using (
    developer_user_id = auth.uid()
    or exists (
      select 1 from public.addon_submissions s
      where s.id = submission_id and s.submitted_by = auth.uid()
    )
    or public.current_user_can_review_domain('marketplace'::public.review_domain)
  );

drop policy if exists "developers create own addon submission snapshots" on public.addon_submission_snapshots;
create policy "developers create own addon submission snapshots"
  on public.addon_submission_snapshots
  for insert to authenticated
  with check (
    developer_user_id = auth.uid()
    and exists (
      select 1
      from public.addon_submissions s
      join public.addon_drafts d on d.id = s.addon_draft_id
      where s.id = submission_id
        and s.submitted_by = auth.uid()
        and d.owner_user_id = auth.uid()
    )
  );

drop policy if exists "marketplace reviewers manage addon submission snapshots" on public.addon_submission_snapshots;
create policy "marketplace reviewers manage addon submission snapshots"
  on public.addon_submission_snapshots
  for all to authenticated
  using (public.current_user_can_review_domain('marketplace'::public.review_domain))
  with check (public.current_user_can_review_domain('marketplace'::public.review_domain));

create or replace function public.prevent_locked_addon_draft_owner_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.locked_at is not null
     and old.owner_user_id = auth.uid()
     and not public.current_user_can_review_domain('marketplace'::public.review_domain) then
    raise exception 'Submitted Developer Forge drafts are locked. Duplicate the draft for a revision before editing.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_addon_draft_owner_mutation on public.addon_drafts;
create trigger prevent_locked_addon_draft_owner_mutation
  before update on public.addon_drafts
  for each row
  execute function public.prevent_locked_addon_draft_owner_mutation();

create or replace function public.prevent_locked_addon_draft_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_draft_id uuid;
begin
  if tg_op = 'DELETE' then
    target_draft_id := old.addon_draft_id;
  else
    target_draft_id := new.addon_draft_id;
  end if;

  if exists (
    select 1
    from public.addon_drafts d
    where d.id = target_draft_id
      and d.locked_at is not null
      and d.owner_user_id = auth.uid()
      and not public.current_user_can_review_domain('marketplace'::public.review_domain)
  ) then
    raise exception 'Submitted Developer Forge draft evidence is locked. Duplicate the draft for a revision before changing package, permission, validation, or compatibility records.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_addon_packages_owner_mutation on public.addon_packages;
create trigger prevent_locked_addon_packages_owner_mutation
  before insert or update or delete on public.addon_packages
  for each row
  execute function public.prevent_locked_addon_draft_child_mutation();

drop trigger if exists prevent_locked_addon_validation_owner_mutation on public.addon_validation_results;
create trigger prevent_locked_addon_validation_owner_mutation
  before insert or update or delete on public.addon_validation_results
  for each row
  execute function public.prevent_locked_addon_draft_child_mutation();

drop trigger if exists prevent_locked_addon_permissions_owner_mutation on public.addon_draft_permissions;
create trigger prevent_locked_addon_permissions_owner_mutation
  before insert or update or delete on public.addon_draft_permissions
  for each row
  execute function public.prevent_locked_addon_draft_child_mutation();

drop trigger if exists prevent_locked_addon_compatibility_owner_mutation on public.addon_compatibility_results;
create trigger prevent_locked_addon_compatibility_owner_mutation
  before insert or update or delete on public.addon_compatibility_results
  for each row
  execute function public.prevent_locked_addon_draft_child_mutation();

grant select, insert, update, delete on table public.addon_submission_snapshots to authenticated;

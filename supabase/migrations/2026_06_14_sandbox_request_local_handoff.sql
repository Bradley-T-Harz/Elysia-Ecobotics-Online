-- Sandbox request / Local Elysia handoff layer.
-- This stores metadata and review decisions only. The public website never runs,
-- installs, clones, or calls Local Elysia. Local Elysia must revalidate exported
-- bundles and ask explicit local approval before any future execution.

alter table public.commune_sandbox_review_requests add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists source_type text not null default 'manual';
alter table public.commune_sandbox_review_requests add column if not exists source_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists title text;
alter table public.commune_sandbox_review_requests add column if not exists summary text;
alter table public.commune_sandbox_review_requests add column if not exists language text;
alter table public.commune_sandbox_review_requests add column if not exists code_text text;
alter table public.commune_sandbox_review_requests add column if not exists package_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists addon_submission_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists code_document_id uuid references public.commune_code_documents(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists expected_command text;
alter table public.commune_sandbox_review_requests add column if not exists declared_dependencies text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists declared_network_policy text not null default 'disabled';
alter table public.commune_sandbox_review_requests add column if not exists declared_network_domains text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists declared_filesystem_policy text not null default 'none';
alter table public.commune_sandbox_review_requests add column if not exists declared_file_scopes text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists requested_cpu_limit text;
alter table public.commune_sandbox_review_requests add column if not exists requested_memory_limit text;
alter table public.commune_sandbox_review_requests add column if not exists requested_timeout_seconds integer;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_no_execution boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_no_secrets boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_local_elysia_final_authority boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists request_status text not null default 'draft';
alter table public.commune_sandbox_review_requests add column if not exists review_status text not null default 'not_submitted';
alter table public.commune_sandbox_review_requests add column if not exists handoff_status text not null default 'not_exported';
alter table public.commune_sandbox_review_requests add column if not exists handoff_bundle_json jsonb;
alter table public.commune_sandbox_review_requests add column if not exists handoff_exported_at timestamptz;
alter table public.commune_sandbox_review_requests add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists reviewed_at timestamptz;
alter table public.commune_sandbox_review_requests add column if not exists reviewer_public_feedback text;
alter table public.commune_sandbox_review_requests add column if not exists reviewer_private_note text;
alter table public.commune_sandbox_review_requests add column if not exists security_hold_reason text;

update public.commune_sandbox_review_requests
set submitted_by = coalesce(submitted_by, user_id),
    title = coalesce(title, request_title, 'Sandbox review request'),
    request_status = case status
      when 'requested' then 'submitted'
      when 'in_review' then 'submitted'
      when 'approved_for_local_sandbox' then 'approved_for_local_handoff'
      when 'needs_information' then 'changes_requested'
      when 'rejected' then 'rejected'
      when 'archived' then 'archived'
      else request_status
    end,
    review_status = case status
      when 'requested' then 'pending_review'
      when 'in_review' then 'pending_review'
      when 'approved_for_local_sandbox' then 'approved'
      when 'needs_information' then 'changes_requested'
      when 'rejected' then 'rejected'
      when 'archived' then 'rejected'
      else review_status
    end,
    handoff_status = case status when 'approved_for_local_sandbox' then 'export_ready' else handoff_status end
where title is null or submitted_by is null;

alter table public.commune_sandbox_review_requests alter column title set not null;

do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_source_type_check check (source_type in ('commune_post','commune_code_document','developer_forge_addon','marketplace_addon_version','manual','other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_request_status_check check (request_status in ('draft','submitted','changes_requested','approved_for_local_handoff','rejected','security_hold','archived','revoked'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_review_status_check check (review_status in ('not_submitted','pending_review','changes_requested','approved','rejected','security_hold'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_status_check check (handoff_status in ('not_exported','export_ready','exported','revoked','expired'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_network_policy_check check (declared_network_policy in ('disabled','declared_domains_only','future_review_required'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_filesystem_policy_check check (declared_filesystem_policy in ('none','temporary_workspace_only','declared_read_only_inputs','future_review_required'));
exception when duplicate_object then null; end $$;

create index if not exists commune_sandbox_handoff_owner_idx on public.commune_sandbox_review_requests(coalesce(submitted_by, user_id), created_at desc);
create index if not exists commune_sandbox_handoff_review_idx on public.commune_sandbox_review_requests(request_status, review_status, created_at desc);
create index if not exists commune_sandbox_handoff_code_document_idx on public.commune_sandbox_review_requests(code_document_id) where code_document_id is not null;

create table if not exists public.sandbox_handoff_events (
  id uuid primary key default gen_random_uuid(),
  sandbox_request_id uuid not null references public.commune_sandbox_review_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sandbox_handoff_events_action_check check (action in ('draft_created','request_submitted','changes_requested','approved_for_local_handoff','rejected','security_hold','handoff_exported','handoff_revoked','archived'))
);

create index if not exists sandbox_handoff_events_request_idx on public.sandbox_handoff_events(sandbox_request_id, created_at desc);
alter table public.sandbox_handoff_events enable row level security;

drop policy if exists "users manage own sandbox handoff requests" on public.commune_sandbox_review_requests;
create policy "users manage own sandbox handoff requests" on public.commune_sandbox_review_requests for all to authenticated
using (coalesce(submitted_by, user_id) = auth.uid())
with check (coalesce(submitted_by, user_id) = auth.uid() and request_status in ('draft','submitted','changes_requested','approved_for_local_handoff'));

drop policy if exists "reviewers manage sandbox handoff requests" on public.commune_sandbox_review_requests;
create policy "reviewers manage sandbox handoff requests" on public.commune_sandbox_review_requests for all to authenticated
using (public.current_user_can_review_domain('commune'::public.review_domain))
with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read own sandbox handoff events" on public.sandbox_handoff_events;
create policy "users read own sandbox handoff events" on public.sandbox_handoff_events for select to authenticated
using (exists (select 1 from public.commune_sandbox_review_requests r where r.id = sandbox_request_id and coalesce(r.submitted_by, r.user_id) = auth.uid()));

drop policy if exists "reviewers manage sandbox handoff events" on public.sandbox_handoff_events;
create policy "reviewers manage sandbox handoff events" on public.sandbox_handoff_events for all to authenticated
using (public.current_user_can_review_domain('commune'::public.review_domain))
with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create own sandbox handoff events" on public.sandbox_handoff_events;
create policy "users create own sandbox handoff events" on public.sandbox_handoff_events for insert to authenticated
with check (actor_user_id = auth.uid() and exists (select 1 from public.commune_sandbox_review_requests r where r.id = sandbox_request_id and coalesce(r.submitted_by, r.user_id) = auth.uid()));

grant select, insert, update on table public.commune_sandbox_review_requests to authenticated;
grant select, insert, update on table public.sandbox_handoff_events to authenticated;

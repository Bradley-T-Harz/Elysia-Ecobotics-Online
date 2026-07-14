-- Admin moderation completion pass.
-- Adds safe, idempotent queue foundations for reports, library source review,
-- work/role review, and admin audit summaries.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'submitted',
  assigned_to uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint content_reports_status_check check (status in ('submitted','under_review','action_taken','dismissed','archived'))
);

create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports(target_type, target_id);
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_user_id, created_at desc);

create table if not exists public.library_source_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  title text not null,
  official_url text,
  category text,
  notes text,
  license_notes text,
  privacy_notes text,
  status text not null default 'submitted',
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint library_source_submissions_status_check check (status in ('draft','submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists library_source_submissions_status_idx on public.library_source_submissions(status, created_at desc);
create index if not exists library_source_submissions_submitter_idx on public.library_source_submissions(submitted_by, created_at desc);

create table if not exists public.work_role_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  role_type text not null,
  display_name text,
  contact_email text,
  summary text,
  status text not null default 'submitted',
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint work_role_submissions_status_check check (status in ('draft','submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists work_role_submissions_status_idx on public.work_role_submissions(status, created_at desc);
create index if not exists work_role_submissions_submitter_idx on public.work_role_submissions(submitted_by, created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_type, target_id);

alter table public.content_reports enable row level security;
alter table public.library_source_submissions enable row level security;
alter table public.work_role_submissions enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "public creates content reports" on public.content_reports;
create policy "public creates content reports" on public.content_reports for insert to anon, authenticated
with check (reporter_user_id is null or reporter_user_id = auth.uid());

drop policy if exists "reporters read own content reports" on public.content_reports;
create policy "reporters read own content reports" on public.content_reports for select to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "reviewers manage content reports" on public.content_reports;
create policy "reviewers manage content reports" on public.content_reports for all to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
);

drop policy if exists "public reads published library source submissions" on public.library_source_submissions;
create policy "public reads published library source submissions" on public.library_source_submissions for select
using (status = 'published');

drop policy if exists "users manage own library source submissions" on public.library_source_submissions;
create policy "users manage own library source submissions" on public.library_source_submissions for all to authenticated
using (submitted_by = auth.uid())
with check (submitted_by = auth.uid() and status in ('draft','submitted'));

drop policy if exists "source reviewers manage library source submissions" on public.library_source_submissions;
create policy "source reviewers manage library source submissions" on public.library_source_submissions for all to authenticated
using (public.current_user_can_review_domain('living_library_source'::public.review_domain))
with check (public.current_user_can_review_domain('living_library_source'::public.review_domain));

drop policy if exists "users read own work role submissions" on public.work_role_submissions;
create policy "users read own work role submissions" on public.work_role_submissions for select to authenticated
using (submitted_by = auth.uid());

drop policy if exists "users create own work role submissions" on public.work_role_submissions;
create policy "users create own work role submissions" on public.work_role_submissions for insert to authenticated
with check (submitted_by = auth.uid() and status in ('draft','submitted'));

drop policy if exists "work reviewers manage work role submissions" on public.work_role_submissions;
create policy "work reviewers manage work role submissions" on public.work_role_submissions for all to authenticated
using (public.current_user_can_review_domain('work_with'::public.review_domain))
with check (public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "reviewers read admin audit log" on public.admin_audit_log;
create policy "reviewers read admin audit log" on public.admin_audit_log for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
);

drop policy if exists "reviewers create admin audit log" on public.admin_audit_log;
create policy "reviewers create admin audit log" on public.admin_audit_log for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    public.current_user_is_admin()
    or public.current_user_has_role('reviewer')
    or public.current_user_has_role('moderator')
    or public.current_user_has_role('commune_moderator')
    or public.current_user_has_role('marketplace_reviewer')
    or public.current_user_has_role('source_reviewer')
    or public.current_user_has_role('guardian_reviewer')
  )
);

grant select, insert, update on table public.content_reports to authenticated;
grant insert on table public.content_reports to anon;
grant select, insert, update on table public.library_source_submissions to authenticated;
grant select on table public.library_source_submissions to anon;
grant select, insert, update on table public.work_role_submissions to authenticated;
grant select, insert on table public.admin_audit_log to authenticated;

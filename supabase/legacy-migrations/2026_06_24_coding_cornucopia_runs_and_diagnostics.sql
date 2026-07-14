-- Coding Cornucopia sandbox run and diagnostic records.
-- Idempotent and intentionally narrow: it adds audit/history structures only.
-- Apply manually in Supabase SQL Editor after reviewing the sandbox deployment boundary.

do $$
begin
  if to_regclass('public.commune_rooms') is not null then
    if exists (select 1 from public.commune_rooms where slug = 'coding-cornucopia') then
      update public.commune_rooms
      set
        name = 'Coding Cornucopia',
        description = 'Shared code, collaborative review, safe snippets, sandboxed runs, diagnostics, and development knowledge for the Elysia ecosystem.'
      where slug = 'coding-cornucopia';

      update public.commune_rooms
      set
        name = 'Coding Cornucopia',
        description = 'Legacy Code Sharing route alias for Coding Cornucopia.'
      where slug = 'code-sharing';
    else
      update public.commune_rooms
      set
        slug = 'coding-cornucopia',
        name = 'Coding Cornucopia',
        description = 'Shared code, collaborative review, safe snippets, sandboxed runs, diagnostics, and development knowledge for the Elysia ecosystem.'
      where slug = 'code-sharing'
         or name = 'Code Sharing';
    end if;
  end if;
end $$;

create table if not exists public.commune_sandbox_runs (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.commune_posts(id) on delete set null,
  code_document_id uuid references public.commune_code_documents(id) on delete set null,
  code_version_id uuid references public.commune_code_document_versions(id) on delete set null,
  source_type text not null default 'manual',
  source_id text,
  snapshot_id text not null,
  language text not null,
  file_name text,
  status text not null default 'requested',
  sandbox_service text not null default 'coding-cornucopia-sandbox-runner',
  request_payload jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  stdout_preview text,
  stderr_preview text,
  exit_code integer,
  duration_ms integer,
  public_visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint commune_sandbox_runs_status_check check (status in ('draft','requested','queued','running','completed','failed','denied','policy_blocked','sandbox_unavailable')),
  constraint commune_sandbox_runs_visibility_check check (public_visibility in ('private','reviewer_only','public_summary'))
);

create index if not exists commune_sandbox_runs_requester_idx on public.commune_sandbox_runs(requester_user_id, created_at desc);
create index if not exists commune_sandbox_runs_document_idx on public.commune_sandbox_runs(code_document_id, created_at desc);
create index if not exists commune_sandbox_runs_post_idx on public.commune_sandbox_runs(post_id, created_at desc);
create index if not exists commune_sandbox_runs_status_idx on public.commune_sandbox_runs(status, created_at desc);

create table if not exists public.commune_code_diagnostics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.commune_sandbox_runs(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete set null,
  code_document_id uuid references public.commune_code_documents(id) on delete set null,
  code_version_id uuid references public.commune_code_document_versions(id) on delete set null,
  severity text not null,
  phase text not null,
  category text not null,
  language text not null,
  file_name text,
  line_number integer,
  column_number integer,
  message text not null,
  source text not null default 'coding-cornucopia',
  public_visibility text not null default 'private',
  created_at timestamptz not null default now(),
  constraint commune_code_diagnostics_severity_check check (severity in ('info','warning','error')),
  constraint commune_code_diagnostics_phase_check check (phase in ('static','policy','runtime','sandbox','security')),
  constraint commune_code_diagnostics_visibility_check check (public_visibility in ('private','reviewer_only','public_summary'))
);

create index if not exists commune_code_diagnostics_run_idx on public.commune_code_diagnostics(run_id, created_at);
create index if not exists commune_code_diagnostics_document_idx on public.commune_code_diagnostics(code_document_id, created_at desc);
create index if not exists commune_code_diagnostics_post_idx on public.commune_code_diagnostics(post_id, created_at desc);

create table if not exists public.commune_language_policies (
  language text primary key,
  label text not null,
  status text not null,
  sandbox_runtime text,
  notes text,
  updated_at timestamptz not null default now(),
  constraint commune_language_policies_status_check check (status in ('active_sandbox','static_diagnostics','future','disabled'))
);

insert into public.commune_language_policies(language, label, status, sandbox_runtime, notes) values
  ('javascript', 'JavaScript', 'active_sandbox', 'node:22-alpine', 'Network disabled; no package install.'),
  ('typescript', 'TypeScript', 'active_sandbox', 'node:22-alpine strip-types', 'Snapshot snippets only; no project build or npm install.'),
  ('python', 'Python', 'active_sandbox', 'python:3.12-alpine', 'Network disabled; no pip install.'),
  ('json', 'JSON', 'static_diagnostics', null, 'Static parse validation only.'),
  ('yaml', 'YAML', 'static_diagnostics', null, 'Static parse validation only.'),
  ('markdown', 'Markdown', 'static_diagnostics', null, 'Static safety validation only.'),
  ('html', 'HTML', 'static_diagnostics', null, 'Static validation only; no browser execution.'),
  ('css', 'CSS', 'static_diagnostics', null, 'Static validation only; no page injection.'),
  ('go', 'Go', 'future', null, 'Future toolchain policy required.'),
  ('rust', 'Rust', 'future', null, 'Future toolchain policy required.'),
  ('java', 'Java', 'future', null, 'Future toolchain policy required.'),
  ('cpp', 'C / C++', 'future', null, 'Future hardened native-code policy required.'),
  ('shell', 'Shell', 'disabled', null, 'Disabled by default.')
on conflict (language) do update set
  label = excluded.label,
  status = excluded.status,
  sandbox_runtime = excluded.sandbox_runtime,
  notes = excluded.notes,
  updated_at = now();

create table if not exists public.commune_sandbox_policies (
  policy_key text primary key,
  policy_value jsonb not null,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.commune_sandbox_policies(policy_key, policy_value, notes) values
  ('v1_resource_limits', '{"cpus":"0.5","memory":"256m","timeout_seconds":10,"pids_limit":64,"max_output_bytes":131072}'::jsonb, 'Coding Cornucopia V1 runner limits.'),
  ('v1_network_policy', '{"default":"disabled","allow_declared_domains":false}'::jsonb, 'Network is disabled by default.'),
  ('v1_filesystem_policy', '{"workspace":"ephemeral","host_mounts":false,"repo_mount":false,"docker_socket":false}'::jsonb, 'No private host/local Elysia filesystem access.'),
  ('v1_dependency_policy', '{"package_install":false,"repo_clone":false,"shell":false}'::jsonb, 'No arbitrary dependency install or repo clone.')
on conflict (policy_key) do update set
  policy_value = excluded.policy_value,
  notes = excluded.notes,
  updated_at = now();

alter table public.commune_sandbox_runs enable row level security;
alter table public.commune_code_diagnostics enable row level security;
alter table public.commune_language_policies enable row level security;
alter table public.commune_sandbox_policies enable row level security;

drop policy if exists "users read own coding cornucopia sandbox runs" on public.commune_sandbox_runs;
create policy "users read own coding cornucopia sandbox runs"
  on public.commune_sandbox_runs for select to authenticated
  using (requester_user_id = auth.uid() or public.current_user_is_admin() or public.current_user_can_review_domain('commune'));

drop policy if exists "users create own coding cornucopia sandbox run requests" on public.commune_sandbox_runs;
create policy "users create own coding cornucopia sandbox run requests"
  on public.commune_sandbox_runs for insert to authenticated
  with check (requester_user_id = auth.uid() and status in ('requested','sandbox_unavailable','policy_blocked'));

drop policy if exists "reviewers update coding cornucopia sandbox runs" on public.commune_sandbox_runs;
create policy "reviewers update coding cornucopia sandbox runs"
  on public.commune_sandbox_runs for update to authenticated
  using (public.current_user_is_admin() or public.current_user_can_review_domain('commune'))
  with check (public.current_user_is_admin() or public.current_user_can_review_domain('commune'));

drop policy if exists "users read own coding cornucopia diagnostics" on public.commune_code_diagnostics;
create policy "users read own coding cornucopia diagnostics"
  on public.commune_code_diagnostics for select to authenticated
  using (
    public_visibility = 'public_summary'
    or public.current_user_is_admin()
    or public.current_user_can_review_domain('commune')
    or exists (
      select 1 from public.commune_sandbox_runs run
      where run.id = commune_code_diagnostics.run_id
        and run.requester_user_id = auth.uid()
    )
  );

drop policy if exists "reviewers write coding cornucopia diagnostics" on public.commune_code_diagnostics;
create policy "reviewers write coding cornucopia diagnostics"
  on public.commune_code_diagnostics for all to authenticated
  using (public.current_user_is_admin() or public.current_user_can_review_domain('commune'))
  with check (public.current_user_is_admin() or public.current_user_can_review_domain('commune'));

drop policy if exists "public reads coding cornucopia language policies" on public.commune_language_policies;
create policy "public reads coding cornucopia language policies"
  on public.commune_language_policies for select to anon, authenticated
  using (true);

drop policy if exists "public reads coding cornucopia sandbox policies" on public.commune_sandbox_policies;
create policy "public reads coding cornucopia sandbox policies"
  on public.commune_sandbox_policies for select to anon, authenticated
  using (true);

grant select on public.commune_language_policies to anon, authenticated;
grant select on public.commune_sandbox_policies to anon, authenticated;
grant select, insert, update on public.commune_sandbox_runs to authenticated;
grant select, insert, update, delete on public.commune_code_diagnostics to authenticated;

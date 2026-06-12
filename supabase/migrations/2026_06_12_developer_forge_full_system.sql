-- Developer Forge full safe foundation.
-- The Forge prepares add-ons for review. It does not install, execute, or publish add-ons.

create table if not exists public.developer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  developer_slug text unique,
  display_name text not null,
  bio text,
  website_url text,
  github_url text,
  support_url text,
  contact_email text,
  status text not null default 'draft',
  verified_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_profiles_status_check check (status in ('draft','requested','active','trusted','suspended','revoked'))
);

create table if not exists public.addon_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  addon_slug text,
  addon_name text,
  short_summary text,
  long_description text,
  version text,
  license text,
  homepage_url text,
  source_url text,
  support_url text,
  category text,
  tags text[] default '{}',
  icon_path text,
  manifest_json jsonb not null default '{}'::jsonb,
  package_file_path text,
  compatibility_targets jsonb default '{}'::jsonb,
  permission_summary text,
  risk_level text not null default 'unknown',
  validation_status text not null default 'not_validated',
  package_status text not null default 'not_uploaded',
  submission_status text not null default 'draft',
  review_status text not null default 'not_submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  constraint addon_drafts_submission_status_check check (submission_status in ('draft','validating','ready_to_submit','submitted','changes_requested','approved','published','rejected','withdrawn','archived','security_hold')),
  constraint addon_drafts_validation_status_check check (validation_status in ('not_validated','valid','warnings','errors')),
  constraint addon_drafts_package_status_check check (package_status in ('not_uploaded','metadata_only','uploaded','scan_warning','scan_blocked')),
  constraint addon_drafts_review_status_check check (review_status in ('not_submitted','pending','changes_requested','approved','rejected','security_hold','withdrawn','published'))
);

create table if not exists public.addon_packages (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  version text,
  storage_path text,
  file_name text,
  file_size bigint,
  sha256 text,
  package_format_version text default '0.1',
  scan_status text not null default 'not_scanned',
  signature_status text not null default 'unsigned',
  created_at timestamptz not null default now(),
  constraint addon_packages_scan_status_check check (scan_status in ('not_scanned','passed','warning','blocked')),
  constraint addon_packages_signature_status_check check (signature_status in ('unsigned','pending','signed','signature_failed'))
);

create table if not exists public.addon_validation_results (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  severity text not null,
  code text not null,
  message text not null,
  field_path text,
  fix_suggestion text,
  created_at timestamptz not null default now(),
  constraint addon_validation_results_severity_check check (severity in ('error','warning','info'))
);

create table if not exists public.addon_permission_catalog (
  permission_key text primary key,
  title text not null,
  description text not null,
  risk_level text not null,
  requires_user_approval boolean not null default true,
  requires_reviewer_approval boolean not null default false,
  requires_local_runtime_gate boolean not null default true,
  allowed_scope_format text,
  examples text[] default '{}',
  blocked_examples text[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addon_permission_catalog_risk_check check (risk_level in ('low','medium','high','blocked'))
);

create table if not exists public.addon_draft_permissions (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  permission_key text not null references public.addon_permission_catalog(permission_key),
  reason text,
  scope_json jsonb default '{}'::jsonb,
  risk_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(addon_draft_id, permission_key)
);

create table if not exists public.addon_submissions (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  review_item_id uuid references public.review_items(id) on delete set null,
  review_summary text,
  reviewer_feedback text,
  updated_at timestamptz not null default now(),
  constraint addon_submissions_status_check check (status in ('pending','changes_requested','approved','rejected','security_hold','withdrawn','published'))
);

create table if not exists public.addon_compatibility_results (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid references public.addon_drafts(id) on delete cascade,
  addon_package_id uuid references public.addon_packages(id) on delete set null,
  elysia_version text,
  addon_api_version text,
  os text,
  status text not null,
  warnings text[] default '{}',
  errors text[] default '{}',
  created_at timestamptz not null default now(),
  constraint addon_compatibility_results_status_check check (status in ('compatible','warning','incompatible','unknown'))
);

create table if not exists public.addon_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists addon_drafts_owner_idx on public.addon_drafts(owner_user_id, updated_at desc);
create index if not exists addon_submissions_submitter_idx on public.addon_submissions(submitted_by, submitted_at desc);
create index if not exists addon_packages_draft_idx on public.addon_packages(addon_draft_id, created_at desc);
create index if not exists addon_validation_results_draft_idx on public.addon_validation_results(addon_draft_id, created_at desc);

insert into public.addon_permission_catalog (permission_key, title, description, risk_level, requires_user_approval, requires_reviewer_approval, requires_local_runtime_gate, allowed_scope_format, examples, blocked_examples) values
  ('theme_assets_read','Theme assets read','Read public theme or visual assets bundled with the add-on.','low',false,false,true,'bundled asset paths only',array['assets/theme.css','assets/icon.png'],array['/home/user/.ssh/id_rsa']),
  ('marketplace_metadata_read','Marketplace metadata read','Read public Marketplace catalog metadata.','low',false,false,true,'public catalog records',array['addon name','published version'],array['private draft package']),
  ('living_library_metadata_read','Living Library metadata read','Read public Living Library source metadata.','low',false,false,true,'public source records',array['source title','official URL'],array['private user collections']),
  ('public_docs_read','Public docs read','Read public Elysia Ecobotics documentation.','low',false,false,true,'public documentation paths',array['manifest reference'],array['private local logs']),
  ('network_declared_domains','Network to declared domains','Request network access only to explicitly declared domains.','medium',true,true,true,'array of HTTPS domains',array['https://api.example.org'],array['http://localhost:3000','*']),
  ('user_selected_file_read','Read user-selected file','Read a file the user explicitly picks in local Elysia.','medium',true,true,true,'local user picker grant',array['a selected CSV file'],array['silent home directory scan']),
  ('user_selected_file_write','Write user-selected file','Write only to a file/location the user explicitly picks in local Elysia.','medium',true,true,true,'local user picker grant',array['exported report.md'],array['overwrite arbitrary system file']),
  ('project_folder_read','Read approved project folder','Read a project folder after explicit local approval.','high',true,true,true,'local approved project folder',array['selected add-on project folder'],array['/home','C:\\Users']),
  ('project_folder_write','Write approved project folder','Write inside a project folder after explicit local approval.','high',true,true,true,'local approved project folder',array['selected project output folder'],array['system directories']),
  ('local_model_request','Local model request','Request local model inference through an approved local router.','high',true,true,true,'local model router scope',array['summarize selected text'],array['silent private memory access']),
  ('sandboxed_worker','Sandboxed worker','Run bounded work only inside a future reviewed local sandbox.','high',true,true,true,'reviewed sandbox profile',array['validation-only local worker'],array['shell without sandbox']),
  ('vault_access','Vault access','Blocked. Add-ons may not access private vaults.','blocked',true,true,true,'blocked',array[]::text[],array['read vault secrets']),
  ('credential_access','Credential access','Blocked. Add-ons may not access credentials or tokens.','blocked',true,true,true,'blocked',array[]::text[],array['read API keys']),
  ('private_memory_access','Private memory access','Blocked. Add-ons may not access private local Elysia memory by default.','blocked',true,true,true,'blocked',array[]::text[],array['read private memories']),
  ('silent_shell_execution','Silent shell execution','Blocked. Add-ons may not run shell commands silently.','blocked',true,true,true,'blocked',array[]::text[],array['postinstall shell script']),
  ('read_all_files','Read all files','Blocked. Broad filesystem access is not allowed.','blocked',true,true,true,'blocked',array[]::text[],array['read entire home directory']),
  ('write_arbitrary_files','Write arbitrary files','Blocked. Broad arbitrary writes are not allowed.','blocked',true,true,true,'blocked',array[]::text[],array['write to system paths']),
  ('silent_network_access','Silent network access','Blocked. Network access must be declared and locally approved.','blocked',true,true,true,'blocked',array[]::text[],array['send data to hidden endpoint']),
  ('silent_install','Silent install','Blocked. The website cannot install or enable add-ons.','blocked',true,true,true,'blocked',array[]::text[],array['install without local Elysia review'])
on conflict (permission_key) do update set
  title = excluded.title,
  description = excluded.description,
  risk_level = excluded.risk_level,
  requires_user_approval = excluded.requires_user_approval,
  requires_reviewer_approval = excluded.requires_reviewer_approval,
  requires_local_runtime_gate = excluded.requires_local_runtime_gate,
  allowed_scope_format = excluded.allowed_scope_format,
  examples = excluded.examples,
  blocked_examples = excluded.blocked_examples,
  is_active = true,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('addon-icons','addon-icons',true,5242880,array['image/png','image/jpeg','image/webp']),
  ('addon-listing-assets','addon-listing-assets',true,10485760,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/markdown']),
  ('addon-packages','addon-packages',false,52428800,array['application/octet-stream','application/zip','application/x-zip-compressed']),
  ('addon-review-attachments','addon-review-attachments',false,10485760,array['application/pdf','text/plain','text/markdown','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.developer_profiles enable row level security;
alter table public.addon_drafts enable row level security;
alter table public.addon_packages enable row level security;
alter table public.addon_validation_results enable row level security;
alter table public.addon_permission_catalog enable row level security;
alter table public.addon_draft_permissions enable row level security;
alter table public.addon_submissions enable row level security;
alter table public.addon_compatibility_results enable row level security;
alter table public.addon_audit_log enable row level security;

drop policy if exists "public reads active developer profiles" on public.developer_profiles;
create policy "public reads active developer profiles" on public.developer_profiles for select using (status in ('active','trusted'));
drop policy if exists "users create own developer profile" on public.developer_profiles;
create policy "users create own developer profile" on public.developer_profiles for insert to authenticated with check (user_id = auth.uid() and status in ('draft','requested'));
drop policy if exists "users read own developer profile" on public.developer_profiles;
create policy "users read own developer profile" on public.developer_profiles for select to authenticated using (user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users update own safe developer profile" on public.developer_profiles;
create policy "users update own safe developer profile" on public.developer_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('draft','requested'));
drop policy if exists "reviewers manage developer profiles" on public.developer_profiles;
create policy "reviewers manage developer profiles" on public.developer_profiles for all to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "public reads active permission catalog" on public.addon_permission_catalog;
create policy "public reads active permission catalog" on public.addon_permission_catalog for select using (is_active = true);
drop policy if exists "admins manage permission catalog" on public.addon_permission_catalog;
create policy "admins manage permission catalog" on public.addon_permission_catalog for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users manage own addon drafts" on public.addon_drafts;
create policy "users manage own addon drafts" on public.addon_drafts for all to authenticated using (owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "users read own addon packages" on public.addon_packages;
create policy "users read own addon packages" on public.addon_packages for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users create own addon packages" on public.addon_packages;
create policy "users create own addon packages" on public.addon_packages for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users read own validation results" on public.addon_validation_results;
create policy "users read own validation results" on public.addon_validation_results for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users write own validation results" on public.addon_validation_results;
create policy "users write own validation results" on public.addon_validation_results for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));
drop policy if exists "users delete own validation results" on public.addon_validation_results;
create policy "users delete own validation results" on public.addon_validation_results for delete to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users manage own addon permissions" on public.addon_draft_permissions;
create policy "users manage own addon permissions" on public.addon_draft_permissions for all to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain)))) with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users read own submissions" on public.addon_submissions;
create policy "users read own submissions" on public.addon_submissions for select to authenticated using (submitted_by = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users create own submissions" on public.addon_submissions;
create policy "users create own submissions" on public.addon_submissions for insert to authenticated with check (submitted_by = auth.uid() and exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));
drop policy if exists "reviewers update submissions" on public.addon_submissions;
create policy "reviewers update submissions" on public.addon_submissions for update to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "users read own compatibility" on public.addon_compatibility_results;
create policy "users read own compatibility" on public.addon_compatibility_results for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users write own compatibility" on public.addon_compatibility_results;
create policy "users write own compatibility" on public.addon_compatibility_results for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "reviewers read addon audit log" on public.addon_audit_log;
create policy "reviewers read addon audit log" on public.addon_audit_log for select to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users create own addon audit events" on public.addon_audit_log;
create policy "users create own addon audit events" on public.addon_audit_log for insert to authenticated with check (actor_user_id = auth.uid());

drop policy if exists "developers upload own addon packages" on storage.objects;
create policy "developers upload own addon packages" on storage.objects for insert to authenticated with check (bucket_id = 'addon-packages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "developers read own addon packages" on storage.objects;
create policy "developers read own addon packages" on storage.objects for select to authenticated using (bucket_id = 'addon-packages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "reviewers read addon packages" on storage.objects;
create policy "reviewers read addon packages" on storage.objects for select to authenticated using (bucket_id = 'addon-packages' and public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "developers upload own addon icons" on storage.objects;
create policy "developers upload own addon icons" on storage.objects for insert to authenticated with check (bucket_id in ('addon-icons','addon-listing-assets') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads published addon assets" on storage.objects;
create policy "public reads published addon assets" on storage.objects for select using (bucket_id in ('addon-icons','addon-listing-assets'));

grant select, insert, update on table public.developer_profiles to authenticated;
grant select on table public.developer_profiles to anon;
grant select, insert, update on table public.addon_drafts to authenticated;
grant select, insert on table public.addon_packages to authenticated;
grant select, insert, delete on table public.addon_validation_results to authenticated;
grant select on table public.addon_permission_catalog to anon, authenticated;
grant insert, update, delete on table public.addon_permission_catalog to authenticated;
grant select, insert, update, delete on table public.addon_draft_permissions to authenticated;
grant select, insert, update on table public.addon_submissions to authenticated;
grant select, insert on table public.addon_compatibility_results to authenticated;
grant select, insert on table public.addon_audit_log to authenticated;

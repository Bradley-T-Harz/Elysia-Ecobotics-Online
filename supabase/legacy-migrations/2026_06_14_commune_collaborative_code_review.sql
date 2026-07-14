-- Pass 4: collaborative code review foundation.
-- Documents are text for review only. The website does not execute code.

create table if not exists public.commune_code_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text unique,
  language text not null default 'text',
  file_name text,
  current_text text not null default '',
  summary text,
  visibility_state text not null default 'draft',
  review_status text not null default 'draft',
  linked_commune_post_id uuid references public.commune_posts(id) on delete set null,
  linked_sandbox_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  moderation_reason text,
  constraint commune_code_documents_visibility_check check (visibility_state in ('draft','submitted','published','flagged','hidden','removed','archived')),
  constraint commune_code_documents_review_status_check check (review_status in ('draft','open_for_review','changes_requested','resolved','archived','security_hold')),
  constraint commune_code_documents_title_check check (char_length(trim(title)) > 0),
  constraint commune_code_documents_text_check check (char_length(current_text) <= 100000),
  constraint commune_code_documents_filename_check check (file_name is null or (file_name !~ '(\.\.|/|\\)' and file_name !~* '^[A-Z]:'))
);

create index if not exists commune_code_documents_owner_idx on public.commune_code_documents(owner_user_id, updated_at desc);
create index if not exists commune_code_documents_visibility_idx on public.commune_code_documents(visibility_state, updated_at desc);

create table if not exists public.commune_code_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  snapshot_text text not null,
  change_summary text,
  version_number integer not null default 1,
  created_at timestamptz not null default now(),
  constraint commune_code_document_versions_text_check check (char_length(snapshot_text) <= 100000),
  unique(document_id, version_number)
);

create index if not exists commune_code_document_versions_document_idx on public.commune_code_document_versions(document_id, version_number desc);

create table if not exists public.commune_code_annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  line_start integer not null,
  line_end integer not null,
  comment text not null,
  visibility_state text not null default 'published',
  annotation_status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  moderation_reason text,
  constraint commune_code_annotations_visibility_check check (visibility_state in ('published','flagged','hidden','removed','archived')),
  constraint commune_code_annotations_status_check check (annotation_status in ('open','addressed','resolved','archived')),
  constraint commune_code_annotations_line_check check (line_start > 0 and line_end >= line_start),
  constraint commune_code_annotations_comment_check check (char_length(trim(comment)) between 1 and 2000)
);

create index if not exists commune_code_annotations_document_idx on public.commune_code_annotations(document_id, line_start, created_at);

create table if not exists public.commune_code_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  room_slug text,
  status text not null default 'open',
  active_editor_user_id uuid references auth.users(id) on delete set null,
  edit_lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_code_sessions_status_check check (status in ('open','locked','paused','closed','archived'))
);

create index if not exists commune_code_sessions_document_idx on public.commune_code_sessions(document_id, updated_at desc);

create table if not exists public.commune_code_reports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.commune_code_documents(id) on delete cascade,
  annotation_id uuid references public.commune_code_annotations(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  detail text,
  report_status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  constraint commune_code_reports_reason_check check (reason in ('spam','harassment','unsafe_code','secret_or_private_data','misinformation','copyright_or_license','malware_or_suspicious','privacy_violation','other')),
  constraint commune_code_reports_status_check check (report_status in ('open','under_review','action_taken','dismissed','archived')),
  constraint commune_code_reports_target_check check (document_id is not null or annotation_id is not null)
);

create index if not exists commune_code_reports_status_idx on public.commune_code_reports(report_status, created_at desc);

create table if not exists public.commune_code_moderation_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.commune_code_documents(id) on delete set null,
  annotation_id uuid references public.commune_code_annotations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commune_code_moderation_events_action_check check (action in ('document_created','document_updated','version_created','annotation_created','annotation_resolved','document_submitted','document_published','document_flagged','document_hidden','document_removed','document_archived','annotation_reported','document_reported','report_reviewed','edit_lock_acquired','edit_lock_released'))
);

create index if not exists commune_code_moderation_events_document_idx on public.commune_code_moderation_events(document_id, created_at desc);

alter table public.commune_code_documents enable row level security;
alter table public.commune_code_document_versions enable row level security;
alter table public.commune_code_annotations enable row level security;
alter table public.commune_code_sessions enable row level security;
alter table public.commune_code_reports enable row level security;
alter table public.commune_code_moderation_events enable row level security;

drop policy if exists "public reads published code documents" on public.commune_code_documents;
create policy "public reads published code documents" on public.commune_code_documents for select using (visibility_state = 'published' or owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own code documents" on public.commune_code_documents;
create policy "users create own code documents" on public.commune_code_documents for insert to authenticated with check (owner_user_id = auth.uid() and visibility_state = 'draft');
drop policy if exists "owners update own editable code documents" on public.commune_code_documents;
create policy "owners update own editable code documents" on public.commune_code_documents for update to authenticated using (owner_user_id = auth.uid() and visibility_state in ('draft','submitted','archived') and review_status <> 'security_hold') with check (owner_user_id = auth.uid() and visibility_state in ('draft','submitted','archived') and review_status <> 'security_hold');
drop policy if exists "moderators manage code documents" on public.commune_code_documents;
create policy "moderators manage code documents" on public.commune_code_documents for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published code versions" on public.commune_code_document_versions;
create policy "public reads published code versions" on public.commune_code_document_versions for select using (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and (doc.visibility_state = 'published' or doc.owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain))));
drop policy if exists "owners create code document versions" on public.commune_code_document_versions;
create policy "owners create code document versions" on public.commune_code_document_versions for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid() and doc.visibility_state in ('draft','submitted')));
drop policy if exists "moderators manage code document versions" on public.commune_code_document_versions;
create policy "moderators manage code document versions" on public.commune_code_document_versions for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published code annotations" on public.commune_code_annotations;
create policy "public reads published code annotations" on public.commune_code_annotations for select using (visibility_state = 'published' and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.visibility_state = 'published'));
drop policy if exists "owners and authors read code annotations" on public.commune_code_annotations;
create policy "owners and authors read code annotations" on public.commune_code_annotations for select to authenticated using (author_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create code annotations" on public.commune_code_annotations;
create policy "users create code annotations" on public.commune_code_annotations for insert to authenticated with check (author_user_id = auth.uid() and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.visibility_state in ('published','submitted') and doc.review_status in ('open_for_review','changes_requested','resolved','draft')));
drop policy if exists "authors resolve own code annotations" on public.commune_code_annotations;
create policy "authors resolve own code annotations" on public.commune_code_annotations for update to authenticated using (author_user_id = auth.uid() and visibility_state = 'published') with check (author_user_id = auth.uid() and visibility_state = 'published');
drop policy if exists "moderators manage code annotations" on public.commune_code_annotations;
create policy "moderators manage code annotations" on public.commune_code_annotations for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read relevant code sessions" on public.commune_code_sessions;
create policy "users read relevant code sessions" on public.commune_code_sessions for select using (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and (doc.visibility_state = 'published' or doc.owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain))));
drop policy if exists "owners create code sessions" on public.commune_code_sessions;
create policy "owners create code sessions" on public.commune_code_sessions for insert to authenticated with check (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()));
drop policy if exists "active editors update code sessions" on public.commune_code_sessions;
create policy "active editors update code sessions" on public.commune_code_sessions for update to authenticated using (active_editor_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain)) with check (active_editor_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create code reports" on public.commune_code_reports;
create policy "users create code reports" on public.commune_code_reports for insert to authenticated with check (reporter_user_id = auth.uid());
drop policy if exists "users read own code reports" on public.commune_code_reports;
create policy "users read own code reports" on public.commune_code_reports for select to authenticated using (reporter_user_id = auth.uid());
drop policy if exists "moderators manage code reports" on public.commune_code_reports;
create policy "moderators manage code reports" on public.commune_code_reports for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read code moderation events" on public.commune_code_moderation_events;
create policy "moderators read code moderation events" on public.commune_code_moderation_events for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own code moderation events" on public.commune_code_moderation_events;
create policy "users create own code moderation events" on public.commune_code_moderation_events for insert to authenticated with check (actor_user_id = auth.uid() and (action in ('document_created','document_updated','version_created','annotation_created','annotation_resolved','document_submitted','document_reported','annotation_reported','edit_lock_acquired','edit_lock_released') or public.current_user_can_review_domain('commune'::public.review_domain)));

grant select on table public.commune_code_documents to anon, authenticated;
grant insert, update on table public.commune_code_documents to authenticated;
grant select on table public.commune_code_document_versions to anon, authenticated;
grant insert on table public.commune_code_document_versions to authenticated;
grant select on table public.commune_code_annotations to anon, authenticated;
grant insert, update on table public.commune_code_annotations to authenticated;
grant select, insert, update on table public.commune_code_sessions to authenticated;
grant select, insert, update on table public.commune_code_reports to authenticated;
grant select, insert on table public.commune_code_moderation_events to authenticated;


-- Elysia Ecobotics Online governance spine: roles, review queues, private receipt storage.
-- Public anon clients rely on these RLS policies; no service-role key belongs in frontend code.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'administrator',
    'moderator',
    'reviewer',
    'marketplace_reviewer',
    'source_reviewer',
    'commune_moderator',
    'guardian_reviewer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_status as enum (
    'draft',
    'pending_review',
    'in_review',
    'needs_information',
    'approved',
    'rejected',
    'withdrawn',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_domain as enum (
    'commune',
    'work_with',
    'stewardship',
    'contribution',
    'living_library_source',
    'living_library_broken_link',
    'marketplace'
  );
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists commons_onboarding_completed_at timestamptz,
  add column if not exists stewardship_onboarding_skipped_at timestamptz,
  add column if not exists work_with_onboarding_skipped_at timestamptz;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists user_roles_one_active_role on public.user_roles(user_id, role) where revoked_at is null;

create or replace function public.has_role(target_user_id uuid, required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = target_user_id
      and ur.role = required_role
      and ur.revoked_at is null
  );
$$;

create or replace function public.current_user_has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), required_role);
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'administrator'::public.app_role)
    or coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_user_can_review_domain(target_domain public.review_domain)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or case target_domain
      when 'work_with' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'stewardship' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'contribution' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'commune' then public.current_user_has_role('moderator') or public.current_user_has_role('commune_moderator') or public.current_user_has_role('guardian_reviewer')
      when 'living_library_source' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'living_library_broken_link' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('moderator') or public.current_user_has_role('guardian_reviewer')
      when 'marketplace' then public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer')
      else false
    end;
$$;

create or replace function public.can_review_work_with_requests()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_review_domain('work_with'::public.review_domain);
$$;

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  domain public.review_domain not null,
  source_table text not null,
  source_id uuid not null,
  submitted_by uuid references auth.users(id),
  status public.review_status not null default 'pending_review',
  assigned_to uuid references auth.users(id),
  priority text default 'normal',
  title text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists review_items_domain_status_idx on public.review_items(domain, status, submitted_at desc);
create unique index if not exists review_items_one_source on public.review_items(source_table, source_id);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.review_items(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  from_status public.review_status,
  to_status public.review_status,
  note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists review_events_item_created_idx on public.review_events(review_item_id, created_at desc);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.review_items(id) on delete cascade,
  actor_id uuid references auth.users(id),
  body text not null,
  visibility text not null default 'internal',
  created_at timestamptz not null default now(),
  check (visibility in ('internal','submitter_visible'))
);

alter table public.work_with_requests
  add column if not exists source_context text default 'standalone';
alter table public.work_with_requests drop constraint if exists work_with_requests_status_check;
do $$ begin
  alter table public.work_with_requests
    alter column status drop default,
    alter column status type public.review_status using (
      case status
        when 'needs_redaction' then 'needs_information'
        else status
      end
    )::public.review_status,
    alter column status set default 'pending_review'::public.review_status;
exception when undefined_column then null;
end $$;
alter table public.work_with_request_files
  add column if not exists deleted_at timestamptz;

create table if not exists public.stewardship_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  official_url text not null,
  category text,
  description text,
  caution_note text,
  is_active boolean not null default true,
  display_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.stewardship_organizations (slug, name, category, official_url, description, caution_note, display_order)
values
  ('rainforest-trust', 'Rainforest Trust', 'Conservation and environmental justice', 'https://www.rainforesttrust.org/', 'Supports protection of threatened tropical habitats.', 'Relevant to biodiversity, habitat protection, and conservation stewardship. Review the organizations current programs and giving options directly before supporting.', 0),
  ('amazon-conservation-team', 'Amazon Conservation Team', 'Conservation and environmental justice', 'https://www.amazonteam.org/', 'Works with Indigenous and local communities in Amazon conservation.', 'Aligned with forest stewardship, Indigenous knowledge respect, and ecological protection. Support should be direct through the organizations own site; no partnership is implied.', 1),
  ('coral-reef-alliance', 'Coral Reef Alliance', 'Conservation and environmental justice', 'https://coral.org/', 'Focuses on coral reef conservation and resilient reef communities.', 'Relevant to reef stewardship, marine ecosystems, and climate resilience. Review current reef programs and regional work before supporting.', 2),
  ('digdeep', 'DIGDEEP Right to Water Project', 'Conservation and environmental justice', 'https://www.digdeep.org/', 'Works on water access and water justice in the United States.', 'Connects water stewardship with dignity, access, and community infrastructure. Do not share personal billing or donation records here; keep proof redacted.', 3),
  ('pure-earth', 'Pure Earth', 'Conservation and environmental justice', 'https://www.pureearth.org/', 'Works on pollution cleanup and toxic exposure reduction.', 'Relevant to soil, water, public health, and environmental justice stewardship. Review active projects and geographic focus directly on the official site.', 4),
  ('sapa', 'Sudanese American Physicians Association', 'Conflict, refugees, and humanitarian relief', 'https://sapa-usa.org/', 'Medical and humanitarian support connected to Sudanese communities.', 'Relevant to crisis relief, health dignity, and humanitarian stewardship. Humanitarian contexts are sensitive; support directly and avoid sharing private beneficiary details.', 5),
  ('pcrf', 'Palestine Children''s Relief Fund', 'Conflict, refugees, and humanitarian relief', 'https://www.pcrf.net/', 'Medical and humanitarian relief for children and families.', 'Relevant to health, crisis support, and child welfare stewardship. Support directly through official channels; do not post personal donor records publicly.', 6),
  ('razom', 'Razom for Ukraine', 'Conflict, refugees, and humanitarian relief', 'https://www.razomforukraine.org/', 'Humanitarian and civic support connected to Ukraine.', 'Relevant to crisis support, civic resilience, and humanitarian aid. Review current programs and verify donation routes on the official site.', 7),
  ('halo-trust-usa', 'The HALO Trust USA', 'Conflict, refugees, and humanitarian relief', 'https://www.halousa.org/', 'Works on landmine and explosive hazard clearance.', 'Relevant to land safety, post-conflict recovery, and human/ecological restoration. Conflict-zone work can be complex; review current operations and reporting directly.', 8),
  ('refugepoint', 'RefugePoint', 'Conflict, refugees, and humanitarian relief', 'https://www.refugepoint.org/', 'Supports refugee protection and self-reliance pathways.', 'Relevant to dignity, displacement, and humanitarian stewardship. Do not share sensitive refugee or personal data in public website contexts.', 9),
  ('fistula-foundation', 'Fistula Foundation', 'Community health, family stability, and human dignity', 'https://fistulafoundation.org/', 'Supports treatment for obstetric fistula.', 'Relevant to health dignity and repair of preventable suffering. Health support is sensitive; keep any proof redacted and non-medical.', 10),
  ('every-mother-counts', 'Every Mother Counts', 'Community health, family stability, and human dignity', 'https://everymothercounts.org/', 'Works to improve maternal health access.', 'Relevant to maternal health, family stability, and dignity. Review current programs directly; avoid sharing personal medical context here.', 11),
  ('rainbow-railroad', 'Rainbow Railroad', 'Community health, family stability, and human dignity', 'https://www.rainbowrailroad.org/', 'Supports LGBTQI+ people facing persecution.', 'Relevant to safety, dignity, and humanitarian protection. Do not expose personal identity, location, or asylum-sensitive details in public drafts.', 12),
  ('first-nations', 'First Nations Development Institute', 'Community health, family stability, and human dignity', 'https://www.firstnations.org/', 'Supports Native communities and economies.', 'Relevant to Indigenous stewardship, self-determination, and community resilience. Respect sovereignty, consent, and community context in any public discussion.', 13),
  ('indspire', 'Indspire', 'Community health, family stability, and human dignity', 'https://indspire.ca/', 'Supports Indigenous education in Canada.', 'Relevant to education, dignity, and Indigenous futures. Review regional programs and eligibility directly on the official site.', 14),
  ('camfed', 'CAMFED USA Foundation', 'Community health, family stability, and human dignity', 'https://camfed.org/us/', 'Supports girls education and young womens leadership.', 'Relevant to education, community resilience, and public-benefit stewardship. Support directly; do not imply Elysia partnership or donation processing.', 15),
  ('miraclefeet', 'MiracleFeet', 'Community health, family stability, and human dignity', 'https://www.miraclefeet.org/', 'Supports clubfoot treatment access.', 'Relevant to child health, mobility, and dignity. Health support proof should remain redacted and non-medical.', 16),
  ('family-promise', 'Family Promise', 'Community health, family stability, and human dignity', 'https://familypromise.org/', 'Works to prevent and end family homelessness.', 'Relevant to housing stability, family dignity, and local community support. Avoid sharing private housing or family details in public contexts.', 17),
  ('new-incentives', 'New Incentives', 'Community health, family stability, and human dignity', 'https://www.newincentives.org/', 'Supports childhood immunization through conditional cash transfers.', 'Relevant to public health, child welfare, and evidence-aware giving. Review current program details and evaluation information directly.', 18),
  ('women-for-women', 'Women for Women International', 'Community health, family stability, and human dignity', 'https://www.womenforwomen.org/', 'Supports women survivors of war and conflict.', 'Relevant to dignity, livelihoods, and post-conflict recovery. Do not share survivor details or sensitive conflict context publicly.', 19),
  ('nami', 'National Alliance on Mental Illness / NAMI', 'Mental health, crisis support, and family support', 'https://www.nami.org/', 'Mental health education, advocacy, and support resources.', 'Relevant to mental health literacy, family support, and crisis awareness. Do not share private mental health details or crisis information in public account pages.', 20),
  ('wikimedia-foundation', 'Wikimedia Foundation', 'Knowledge commons', 'https://wikimediafoundation.org/', 'Supports Wikipedia and Wikimedia knowledge projects.', 'Relevant to public knowledge, open references, and the wider commons. Knowledge commons support does not imply training rights for all content; licenses vary by project/content.', 21),
  ('creative-commons', 'Creative Commons', 'Knowledge commons', 'https://creativecommons.org/', 'Provides public licenses and open knowledge infrastructure.', 'Relevant to licensing literacy, attribution, reuse, and public knowledge stewardship. A Creative Commons license still has conditions; read the specific license before reuse.', 22)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  official_url = excluded.official_url,
  description = excluded.description,
  caution_note = excluded.caution_note,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.stewardship_recognition_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.stewardship_organizations(id),
  organization_name text,
  organization_url text,
  support_note text,
  amount_range text,
  donation_date date,
  receipt_file_id uuid,
  redaction_confirmed boolean not null default false,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stewardship_receipt_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.stewardship_recognition_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'stewardship-receipts',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  sha256_hash text,
  redaction_status text default 'user_attested_redacted',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(bucket, storage_path),
  check (bucket = 'stewardship-receipts'),
  check (size_bytes is null or size_bytes <= 10485760)
);

do $$ begin
  alter table public.stewardship_recognition_requests
    add constraint stewardship_receipt_file_fk foreign key (receipt_file_id) references public.stewardship_receipt_files(id) deferrable initially deferred;
exception when duplicate_object then null;
end $$;

create table if not exists public.commune_post_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commons_username text,
  post_type text not null,
  title text not null,
  summary text,
  body text not null,
  tags text[] default '{}'::text[],
  links text[] default '{}'::text[],
  code_included boolean default false,
  repository_url text,
  safety_acknowledgements jsonb default '{}'::jsonb,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.living_library_source_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  commons_username text,
  source_name text not null,
  official_url text not null,
  source_type text,
  category text,
  suggested_topics text[] default '{}'::text[],
  why_it_belongs text,
  license_notes text,
  privacy_ethics_notes text,
  submitter_notes text,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.broken_link_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  commons_username text,
  page_url text not null,
  broken_url text not null,
  source_context text,
  report_note text,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('work-with-attachments', 'work-with-attachments', false), ('stewardship-receipts', 'stewardship-receipts', false)
on conflict (id) do update set public = false;

-- Bootstrap the known admin account only if the auth user already exists. This does not create users.
insert into public.user_roles (user_id, role, reason)
select users.id, roles.role::public.app_role, 'Bootstrap Elysia Ecobotics Online governance roles for existing founder/admin account.'
from auth.users users
cross join (values
  ('administrator'), ('moderator'), ('reviewer'), ('marketplace_reviewer'), ('source_reviewer'), ('commune_moderator'), ('guardian_reviewer')
) as roles(role)
where lower(users.email) = 'elysiaecobotics@proton.me'
on conflict (user_id, role) where revoked_at is null do nothing;

alter table public.user_roles enable row level security;
alter table public.review_items enable row level security;
alter table public.review_events enable row level security;
alter table public.review_comments enable row level security;
alter table public.work_with_requests enable row level security;
alter table public.work_with_request_files enable row level security;
alter table public.stewardship_organizations enable row level security;
alter table public.stewardship_recognition_requests enable row level security;
alter table public.stewardship_receipt_files enable row level security;
alter table public.commune_post_requests enable row level security;
alter table public.living_library_source_suggestions enable row level security;
alter table public.broken_link_reports enable row level security;

-- Role policies
drop policy if exists "users read own active roles" on public.user_roles;
drop policy if exists "admins read all roles" on public.user_roles;
drop policy if exists "admins insert roles" on public.user_roles;
drop policy if exists "admins update roles" on public.user_roles;
create policy "users read own active roles" on public.user_roles for select to authenticated using (user_id = auth.uid() and revoked_at is null);
create policy "admins read all roles" on public.user_roles for select to authenticated using (public.current_user_is_admin());
create policy "admins insert roles" on public.user_roles for insert to authenticated with check (public.current_user_is_admin() and user_id <> auth.uid());
create policy "admins update roles" on public.user_roles for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Review framework policies
drop policy if exists "submitters and reviewers read review items" on public.review_items;
drop policy if exists "submitters create review items" on public.review_items;
drop policy if exists "reviewers update review items" on public.review_items;
create policy "submitters and reviewers read review items" on public.review_items for select to authenticated using (submitted_by = auth.uid() or public.current_user_can_review_domain(domain));
create policy "submitters create review items" on public.review_items for insert to authenticated with check (submitted_by = auth.uid());
create policy "reviewers update review items" on public.review_items for update to authenticated using (public.current_user_can_review_domain(domain)) with check (public.current_user_can_review_domain(domain));

drop policy if exists "submitters and reviewers read review events" on public.review_events;
drop policy if exists "submitters create submitted events" on public.review_events;
drop policy if exists "reviewers create review events" on public.review_events;
create policy "submitters and reviewers read review events" on public.review_events for select to authenticated using (
  exists (select 1 from public.review_items ri where ri.id = review_item_id and (public.current_user_can_review_domain(ri.domain) or (ri.submitted_by = auth.uid() and coalesce(metadata->>'visibility','submitter_visible') <> 'internal')))
);
create policy "submitters create submitted events" on public.review_events for insert to authenticated with check (
  actor_id = auth.uid() and event_type = 'submitted' and exists (select 1 from public.review_items ri where ri.id = review_item_id and ri.submitted_by = auth.uid())
);
create policy "reviewers create review events" on public.review_events for insert to authenticated with check (
  actor_id = auth.uid() and exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain))
);

drop policy if exists "reviewers read comments" on public.review_comments;
drop policy if exists "submitters read visible comments" on public.review_comments;
drop policy if exists "reviewers create comments" on public.review_comments;
create policy "reviewers read comments" on public.review_comments for select to authenticated using (exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain)));
create policy "submitters read visible comments" on public.review_comments for select to authenticated using (visibility = 'submitter_visible' and exists (select 1 from public.review_items ri where ri.id = review_item_id and ri.submitted_by = auth.uid()));
create policy "reviewers create comments" on public.review_comments for insert to authenticated with check (actor_id = auth.uid() and exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain)));

-- Work With policies
drop policy if exists "users insert own work with requests" on public.work_with_requests;
drop policy if exists "users read own work with requests" on public.work_with_requests;
drop policy if exists "admins read all work with requests" on public.work_with_requests;
drop policy if exists "admins update work with requests" on public.work_with_requests;
drop policy if exists "reviewers read work with requests" on public.work_with_requests;
drop policy if exists "reviewers update work with requests" on public.work_with_requests;
create policy "users insert own work with requests" on public.work_with_requests for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "users read own work with requests" on public.work_with_requests for select to authenticated using (user_id = auth.uid());
create policy "reviewers read work with requests" on public.work_with_requests for select to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain));
create policy "reviewers update work with requests" on public.work_with_requests for update to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain)) with check (public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "users insert own work with request files" on public.work_with_request_files;
drop policy if exists "users read own work with request files" on public.work_with_request_files;
drop policy if exists "admins read all work with request files" on public.work_with_request_files;
drop policy if exists "reviewers read work with request files" on public.work_with_request_files;
create policy "users insert own work with request files" on public.work_with_request_files for insert to authenticated with check (user_id = auth.uid() and bucket = 'work-with-attachments' and exists (select 1 from public.work_with_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy "users read own work with request files" on public.work_with_request_files for select to authenticated using (user_id = auth.uid());
create policy "reviewers read work with request files" on public.work_with_request_files for select to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain));

-- Stewardship policies
drop policy if exists "public reads active stewardship organizations" on public.stewardship_organizations;
drop policy if exists "admins manage stewardship organizations" on public.stewardship_organizations;
create policy "public reads active stewardship organizations" on public.stewardship_organizations for select using (is_active = true or public.current_user_is_admin());
create policy "admins manage stewardship organizations" on public.stewardship_organizations for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users insert own stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "users read own stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "reviewers read stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "reviewers update stewardship requests" on public.stewardship_recognition_requests;
create policy "users insert own stewardship requests" on public.stewardship_recognition_requests for insert to authenticated with check (user_id = auth.uid());
create policy "users read own stewardship requests" on public.stewardship_recognition_requests for select to authenticated using (user_id = auth.uid());
create policy "reviewers read stewardship requests" on public.stewardship_recognition_requests for select to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain));
create policy "reviewers update stewardship requests" on public.stewardship_recognition_requests for update to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain)) with check (public.current_user_can_review_domain('stewardship'::public.review_domain));

drop policy if exists "users insert own stewardship receipt files" on public.stewardship_receipt_files;
drop policy if exists "users read own stewardship receipt files" on public.stewardship_receipt_files;
drop policy if exists "reviewers read stewardship receipt files" on public.stewardship_receipt_files;
create policy "users insert own stewardship receipt files" on public.stewardship_receipt_files for insert to authenticated with check (user_id = auth.uid() and bucket = 'stewardship-receipts' and exists (select 1 from public.stewardship_recognition_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy "users read own stewardship receipt files" on public.stewardship_receipt_files for select to authenticated using (user_id = auth.uid());
create policy "reviewers read stewardship receipt files" on public.stewardship_receipt_files for select to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain));

-- Commune and Living Library policies
drop policy if exists "users insert own commune post requests" on public.commune_post_requests;
drop policy if exists "users read own commune post requests" on public.commune_post_requests;
drop policy if exists "moderators read commune post requests" on public.commune_post_requests;
drop policy if exists "moderators update commune post requests" on public.commune_post_requests;
create policy "users insert own commune post requests" on public.commune_post_requests for insert to authenticated with check (user_id = auth.uid());
create policy "users read own commune post requests" on public.commune_post_requests for select to authenticated using (user_id = auth.uid());
create policy "moderators read commune post requests" on public.commune_post_requests for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
create policy "moderators update commune post requests" on public.commune_post_requests for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users insert source suggestions" on public.living_library_source_suggestions;
drop policy if exists "users read own source suggestions" on public.living_library_source_suggestions;
drop policy if exists "source reviewers read source suggestions" on public.living_library_source_suggestions;
drop policy if exists "source reviewers update source suggestions" on public.living_library_source_suggestions;
create policy "users insert source suggestions" on public.living_library_source_suggestions for insert to authenticated with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));
create policy "users read own source suggestions" on public.living_library_source_suggestions for select to authenticated using (user_id = auth.uid());
create policy "source reviewers read source suggestions" on public.living_library_source_suggestions for select to authenticated using (public.current_user_can_review_domain('living_library_source'::public.review_domain));
create policy "source reviewers update source suggestions" on public.living_library_source_suggestions for update to authenticated using (public.current_user_can_review_domain('living_library_source'::public.review_domain)) with check (public.current_user_can_review_domain('living_library_source'::public.review_domain));

drop policy if exists "users insert broken link reports" on public.broken_link_reports;
drop policy if exists "users read own broken link reports" on public.broken_link_reports;
drop policy if exists "reviewers read broken link reports" on public.broken_link_reports;
drop policy if exists "reviewers update broken link reports" on public.broken_link_reports;
create policy "users insert broken link reports" on public.broken_link_reports for insert to authenticated with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));
create policy "users read own broken link reports" on public.broken_link_reports for select to authenticated using (user_id = auth.uid());
create policy "reviewers read broken link reports" on public.broken_link_reports for select to authenticated using (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain));
create policy "reviewers update broken link reports" on public.broken_link_reports for update to authenticated using (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain)) with check (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain));

-- Storage policies for private review files
drop policy if exists "users upload own work with attachments" on storage.objects;
drop policy if exists "users read own work with attachments" on storage.objects;
drop policy if exists "admins read all work with attachments" on storage.objects;
drop policy if exists "reviewers read work with attachments" on storage.objects;
create policy "users upload own work with attachments" on storage.objects for insert to authenticated with check (bucket_id = 'work-with-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own work with attachments" on storage.objects for select to authenticated using (bucket_id = 'work-with-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reviewers read work with attachments" on storage.objects for select to authenticated using (bucket_id = 'work-with-attachments' and public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "users upload own stewardship receipts" on storage.objects;
drop policy if exists "users read own stewardship receipts" on storage.objects;
drop policy if exists "reviewers read stewardship receipts" on storage.objects;
create policy "users upload own stewardship receipts" on storage.objects for insert to authenticated with check (bucket_id = 'stewardship-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own stewardship receipts" on storage.objects for select to authenticated using (bucket_id = 'stewardship-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reviewers read stewardship receipts" on storage.objects for select to authenticated using (bucket_id = 'stewardship-receipts' and public.current_user_can_review_domain('stewardship'::public.review_domain));

grant select, insert, update on table public.user_roles to authenticated;
grant select, insert, update on table public.review_items to authenticated;
grant select, insert on table public.review_events to authenticated;
grant select, insert on table public.review_comments to authenticated;
grant select, insert, update on table public.work_with_requests to authenticated;
grant select, insert on table public.work_with_request_files to authenticated;
grant select on table public.stewardship_organizations to anon, authenticated;
grant insert, update on table public.stewardship_organizations to authenticated;
grant select, insert, update on table public.stewardship_recognition_requests to authenticated;
grant select, insert on table public.stewardship_receipt_files to authenticated;
grant select, insert, update on table public.commune_post_requests to authenticated;
grant select, insert, update on table public.living_library_source_suggestions to authenticated;
grant select, insert, update on table public.broken_link_reports to authenticated;

begin;

create or replace function public.current_user_can_review_domain(target_domain public.review_domain)
returns boolean language sql stable security definer set search_path = '' as $$
 select case target_domain
   when 'work_with' then public.current_user_has_role('work_with_reviewer')
   when 'stewardship' then public.current_user_has_role('stewardship_reviewer')
   when 'marketplace' then public.current_user_has_role('marketplace_reviewer')
   else public.current_user_is_admin() or case target_domain
     when 'contribution' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
     when 'commune' then public.current_user_has_role('moderator') or public.current_user_has_role('commune_moderator') or public.current_user_has_role('guardian_reviewer')
     when 'living_library_source' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('guardian_reviewer')
     when 'living_library_broken_link' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('moderator') or public.current_user_has_role('guardian_reviewer')
     else false end
 end;
$$;

-- Separate current profile data, not a rewritten historical identity. Commons
-- retains every original value. The initial Marketplace copy records its origin.
create table public.marketplace_account_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null default '' check (length(username) <= 80),
 display_name text not null default '' check (length(display_name) <= 160),
 bio text not null default '' check (length(bio) <= 10000),
 interests text not null default '' check (length(interests) <= 4000),
 website_url text not null default '' check (length(website_url) <= 2048),
 github_url text not null default '' check (length(github_url) <= 2048),
 organization text not null default '' check (length(organization) <= 200),
 is_developer boolean not null default false,
 initialized_from_legacy_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.marketplace_account_profiles(user_id,username,display_name,bio,interests,website_url,github_url,organization,is_developer,initialized_from_legacy_at)
select id,coalesce(username,''),coalesce(display_name,''),coalesce(bio,''),coalesce(interests,''),coalesce(website_url,''),coalesce(github_url,''),coalesce(organization,''),coalesce(is_developer,false),now() from public.profiles;
alter table public.marketplace_account_profiles owner to postgres;
alter table public.marketplace_account_profiles enable row level security;
revoke all on public.marketplace_account_profiles from public,anon,authenticated,service_role;
grant select,insert,update on public.marketplace_account_profiles to authenticated;
create policy "own Marketplace profile read" on public.marketplace_account_profiles for select to authenticated using(user_id=auth.uid());
create policy "own Marketplace profile insert" on public.marketplace_account_profiles for insert to authenticated with check(user_id=auth.uid() and initialized_from_legacy_at is null and private.community_account_allows_ordinary_mutation(auth.uid()));
create policy "own Marketplace profile update" on public.marketplace_account_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and private.community_account_allows_ordinary_mutation(auth.uid()));
-- Restrict writes to the actual form's columns: no authority or migration metadata.
revoke update on public.marketplace_account_profiles from authenticated;
grant update(user_id,username,display_name,bio,interests,website_url,github_url,organization,is_developer,updated_at) on public.marketplace_account_profiles to authenticated;

alter table public.work_with_requests add column revision integer not null default 1;
alter table public.work_with_requests add column attachment_state text not null default 'not_requested'
 check(attachment_state in ('not_requested','pending','attached'));
-- Existing rows and review events are deliberately untouched.
revoke insert,update,delete on public.work_with_requests from authenticated,anon;
revoke update(status,updated_at) on public.work_with_requests from authenticated,anon;
revoke insert,update,delete on public.work_with_request_files from authenticated,anon;

-- Generic review endpoints must not bypass the atomic Work With lifecycle.
create function private.guard_work_with_review_write() returns trigger language plpgsql set search_path='' as $$
declare v_domain public.review_domain;
begin
 if tg_table_name='review_items' then
  v_domain:=new.domain;
  if tg_op='UPDATE' and old.domain='work_with' then v_domain:=old.domain;end if;
 else select domain into v_domain from public.review_items where id=new.review_item_id; end if;
 if v_domain='work_with' and current_user not in ('postgres','supabase_admin') then
  raise exception using errcode='42501',message='Use the governed Work With workflow.';
 end if;
 return new;
end; $$;
create trigger governed_work_with_review_item before insert or update on public.review_items for each row execute function private.guard_work_with_review_write();
create trigger governed_work_with_review_event before insert or update on public.review_events for each row execute function private.guard_work_with_review_write();

create function public.submit_own_work_with_request(p_request_id uuid,p_application jsonb,p_attachment_expected boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.work_with_requests%rowtype; v_review uuid;
begin
 if a is null or not private.community_account_allows_ordinary_mutation(a) then raise exception using errcode='42501',message='Work With submission unavailable.';end if;
 if p_request_id is null or jsonb_typeof(p_application)<>'object' or octet_length(p_application::text)>30000
 or p_application ?| array['status','user_id','reviewed_by','reviewed_at','assigned_to']
 or length(trim(coalesce(p_application->>'message','')))=0
 then raise exception using errcode='22023',message='Invalid Work With application.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into r from public.work_with_requests where id=p_request_id;
 if found then
  if r.user_id<>a then raise exception using errcode='42501',message='Work With submission unavailable.';end if;
  return r.id; -- An ambiguous network retry never creates a second application.
 end if;
 insert into public.work_with_requests(id,user_id,name,preferred_contact,commons_username,request_type,availability,areas_of_interest,message,skills_experience,github_url,gitlab_codeberg_url,portfolio_url,linkedin_url,acknowledgements,source_context,status,attachment_state)
 values(p_request_id,a,p_application->>'name',p_application->>'preferred_contact',p_application->>'commons_username',p_application->>'request_type',p_application->>'availability',array(select jsonb_array_elements_text(coalesce(p_application->'areas_of_interest','[]'))),p_application->>'message',p_application->>'skills_experience',p_application->>'github_url',p_application->>'gitlab_codeberg_url',p_application->>'portfolio_url',p_application->>'linkedin_url',coalesce(p_application->'acknowledgements','{}'),case when p_application->>'source_context'='commons_profile_onboarding' then 'commons_profile_onboarding' else 'standalone' end,'pending_review',case when p_attachment_expected then 'pending' else 'not_requested' end);
 insert into public.review_items(domain,source_table,source_id,submitted_by,status,title,summary)
 values('work_with','work_with_requests',p_request_id,a,'pending_review','Work With application',left(p_application->>'request_type',120)) returning id into v_review;
 insert into public.review_events(review_item_id,actor_id,event_type,to_status,metadata)
 values(v_review,a,'submitted','pending_review','{"visibility":"submitter_visible","governed_work_with":true}');
 return p_request_id;
end; $$;

create function public.work_with_request_command(p_request_id uuid,p_revision integer,p_action text,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.work_with_requests%rowtype; v_next public.review_status; v_review uuid; v_owner boolean;
begin
 if a is null or not private.community_account_allows_ordinary_mutation(a) then raise exception using errcode='42501',message='Work With action unavailable.';end if;
 select * into r from public.work_with_requests where id=p_request_id for update;
 if not found then raise exception using errcode='42501',message='Work With action unavailable.';end if;
 v_owner:=r.user_id=a;
 if not v_owner and not public.current_user_can_review_domain('work_with') then raise exception using errcode='42501',message='Work With action unavailable.';end if;
 if r.revision<>p_revision then raise exception using errcode='40001',message='This application changed. Reload before acting.';end if;
 if length(p_note)>6000 then raise exception using errcode='22023',message='Use a shorter note.';end if;
 if v_owner then
  if p_action='respond' and r.status='needs_information' and length(trim(p_note))>0 then v_next:='pending_review';
  elsif p_action='withdraw' and r.status in ('pending_review','in_review','needs_information') then v_next:='withdrawn';
  elsif p_action='continue_without_attachment' and r.status in ('pending_review','needs_information') and r.attachment_state='pending' then v_next:=r.status;
  else raise exception using errcode='42501',message='Applicant action unavailable.';end if;
 else
  if r.status not in ('pending_review','in_review','needs_information') then raise exception using errcode='22023',message='This review is already final.';end if;
  v_next:=case p_action when 'request_information' then 'needs_information'::public.review_status when 'approve' then 'approved'::public.review_status when 'decline' then 'rejected'::public.review_status when 'close' then 'archived'::public.review_status when 'begin_review' then 'in_review'::public.review_status else null end;
  if v_next is null or (p_action in ('request_information','decline','close') and length(trim(p_note))=0) then raise exception using errcode='22023',message='A valid review action and participant-facing explanation are required.';end if;
  if p_action='approve' and r.attachment_state='pending' then raise exception using errcode='22023',message='The applicant must finish or explicitly skip the pending attachment first.';end if;
 end if;
 select id into v_review from public.review_items where source_table='work_with_requests' and source_id=r.id and domain='work_with' for update;
 if not found then raise exception using errcode='23514',message='Missing review record; operator reconciliation required.';end if;
 update public.work_with_requests set status=v_next,revision=revision+1,updated_at=now(),attachment_state=case when p_action='continue_without_attachment' then 'not_requested' else attachment_state end where id=r.id;
 update public.review_items set status=v_next,updated_at=now(),assigned_to=case when p_action='begin_review' then a else assigned_to end,reviewed_by=case when not v_owner and v_next in ('approved','rejected','archived') then a else reviewed_by end,reviewed_at=case when not v_owner and v_next in ('approved','rejected','archived') then now() else reviewed_at end where id=v_review;
 insert into public.review_events(review_item_id,actor_id,event_type,from_status,to_status,note,metadata)
 values(v_review,a,'work_with_'||p_action,r.status,v_next,nullif(trim(p_note),''),jsonb_build_object('visibility','submitter_visible','capability',case when v_owner then 'applicant' else 'work_with_reviewer' end,'revision',r.revision+1));
 return jsonb_build_object('id',r.id,'status',v_next,'revision',r.revision+1);
end; $$;

create function public.attach_own_work_with_file(p_request_id uuid,p_storage_path text,p_original_filename text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.work_with_requests%rowtype; o storage.objects%rowtype; v_review uuid;
begin
 if a is null or not private.community_account_allows_ordinary_mutation(a) then raise exception using errcode='42501',message='Attachment unavailable.';end if;
 select * into r from public.work_with_requests where id=p_request_id and user_id=a for update;
 if not found then raise exception using errcode='42501',message='Attachment unavailable.';end if;
 if exists(select 1 from public.work_with_request_files where request_id=r.id and storage_path=p_storage_path and deleted_at is null) then return true;end if;
 if r.status not in ('pending_review','needs_information') or p_storage_path not like a::text||'/'||r.id::text||'/%' or p_storage_path !~ '^[^/]+/[^/]+/[^/]+$' or p_storage_path ~ '(^|/)\.\.(/|$)|[\\]' or length(p_original_filename) not between 1 and 160 then raise exception using errcode='42501',message='Attachment unavailable.';end if;
 select * into o from storage.objects where bucket_id='work-with-attachments' and name=p_storage_path;
 if not found or coalesce((o.metadata->>'size')::bigint,0) not between 1 and 10485760 then raise exception using errcode='22023',message='Private upload has not completed.';end if;
 insert into public.work_with_request_files(request_id,user_id,bucket,storage_path,original_filename,mime_type,size_bytes,file_role)
 values(r.id,a,'work-with-attachments',p_storage_path,p_original_filename,o.metadata->>'mimetype',(o.metadata->>'size')::bigint,'resume_cv');
 update public.work_with_requests set attachment_state='attached',revision=revision+1,updated_at=now() where id=r.id;
 select id into v_review from public.review_items where source_table='work_with_requests' and source_id=r.id;
 insert into public.review_events(review_item_id,actor_id,event_type,metadata) values(v_review,a,'work_with_attachment_added','{"visibility":"submitter_visible"}');
 return true;
end; $$;

-- Never grant an administrator implicit CV access through an old storage policy.
drop policy if exists "admins read all work with attachments" on storage.objects;
create policy "authorized Work With attachment downloads" on storage.objects for select to authenticated using(
 bucket_id='work-with-attachments' and exists(select 1 from public.work_with_request_files f join public.work_with_requests r on r.id=f.request_id
 where f.bucket=objects.bucket_id and f.storage_path=objects.name and f.deleted_at is null and (r.user_id=auth.uid() or public.current_user_can_review_domain('work_with')))
);
create policy "scoped Work With storage reads" on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'work-with-attachments' or exists(select 1 from public.work_with_requests r where r.id::text=split_part(objects.name,'/',2) and r.user_id::text=split_part(objects.name,'/',1) and (r.user_id=auth.uid() or public.current_user_can_review_domain('work_with')))
);

do $$declare f text;begin
 foreach f in array array['public.submit_own_work_with_request(uuid,jsonb,boolean)','public.work_with_request_command(uuid,integer,text,text)','public.attach_own_work_with_file(uuid,text,text)'] loop
  execute 'alter function '||f||' owner to postgres';
  execute 'revoke all on function '||f||' from public,anon,authenticated,service_role';
  execute 'grant execute on function '||f||' to authenticated';
 end loop;
end; $$;
revoke all on function private.guard_work_with_review_write() from public,anon,authenticated,service_role;

create or replace function private.current_user_request_review_rows(p_actor uuid)
returns table (
  item_key text,
  source_domain text,
  source_type text,
  source_record_id uuid,
  safe_title text,
  primary_status text,
  secondary_status text,
  pending boolean,
  deep_link text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    'code_proposals:' || proposal.id::text,
    'code_proposals'::text,
    'commune_code_revision_proposal'::text,
    proposal.id,
    'Revision proposal for “' || pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Commune code post'), 120
    ) || '”',
    proposal.proposal_status,
    null::text,
    proposal.proposal_status in ('submitted', 'needs_changes'),
    case when post.post_type = 'troubleshooting' then
      '/commune/troubleshooting-grove/review?proposal=' || proposal.id::text
    else
      '/commune/coding-cornucopia/review?proposal=' || proposal.id::text
    end,
    proposal.created_at,
    proposal.updated_at
  from public.commune_code_revision_proposals as proposal
  left join public.commune_posts as post on post.id = proposal.post_id
  where proposal.proposer_user_id = p_actor

  union all

  select
    'work_with:' || request.id::text,
    'work_with'::text,
    'work_with_request'::text,
    request.id,
    case when nullif(pg_catalog.btrim(request.request_type), '') is null
      then 'Work With request'
      else 'Work With request · ' || pg_catalog.left(
        pg_catalog.replace(request.request_type, '_', ' '), 100
      )
    end,
    request.status::text,
    null::text,
    request.status::text in ('pending_review', 'needs_information'),
    '/commons-circle/signals/work-with?request=' || request.id::text,
    request.created_at,
    request.updated_at
  from public.work_with_requests as request
  where request.user_id = p_actor

  union all

  select
    'troubleshooting:' || issue.id::text,
    'troubleshooting'::text,
    'commune_troubleshooting_post'::text,
    issue.id,
    coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Troubleshooting issue'),
    issue.troubleshooting_status,
    issue.accepted_resolution_kind,
    issue.troubleshooting_status in ('open', 'needs_information', 'in_progress', 'fix_proposed'),
    case when issue.post_id is null then '/commune/troubleshooting'
      else '/commune/posts/' || issue.post_id::text end,
    issue.created_at,
    issue.updated_at
  from public.commune_troubleshooting_posts as issue
  left join public.commune_posts as post on post.id = issue.post_id
  where issue.author_user_id = p_actor

  union all

  select
    'research_notes:' || note.id::text,
    'research_notes'::text,
    'commune_research_note'::text,
    note.id,
    coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Research Note'),
    note.review_status,
    note.evidence_strength,
    note.review_status in (
      'submitted', 'needs_citation', 'needs_clarification',
      'source_issue', 'overclaiming_evidence'
    ),
    case when note.post_id is null then '/commune/rooms/research-notes'
      else '/commune/posts/' || note.post_id::text end,
    note.created_at,
    note.updated_at
  from public.commune_research_notes as note
  left join public.commune_posts as post on post.id = note.post_id
  where note.author_user_id = p_actor

  union all

  select
    'repository_showcase:' || showcase.id::text,
    'repository_showcase'::text,
    'commune_repository_showcase'::text,
    showcase.id,
    coalesce(nullif(pg_catalog.btrim(showcase.project_name), ''), 'Repository Showcase'),
    showcase.status::text,
    showcase.sandbox_review_status,
    showcase.status::text in ('draft', 'pending_review', 'in_review', 'needs_information')
      or showcase.sandbox_review_status in ('requested', 'queued', 'in_review', 'needs_information'),
    case when showcase.post_id is null then '/commune/rooms/repository-showcase/new'
      else '/commune/posts/' || showcase.post_id::text end,
    showcase.created_at,
    showcase.updated_at
  from public.commune_repository_showcases as showcase
  where showcase.user_id = p_actor

  union all

  select
    'iteration_showcase:' || iteration.id::text,
    'iteration_showcase'::text,
    'commune_iteration_showcase'::text,
    iteration.id,
    case when nullif(pg_catalog.btrim(iteration.version_build_label), '') is null
      then 'Elysia Iteration Showcase'
      else 'Elysia Iteration · ' || pg_catalog.left(iteration.version_build_label, 100)
    end,
    iteration.status::text,
    iteration.sandbox_review_status,
    iteration.status::text in ('draft', 'pending_review', 'in_review', 'needs_information')
      or iteration.sandbox_review_status in ('requested', 'queued', 'in_review', 'needs_information'),
    case when iteration.post_id is null then '/commune/rooms/elysia-iteration-showcase/new'
      else '/commune/posts/' || iteration.post_id::text end,
    iteration.created_at,
    iteration.updated_at
  from public.commune_iteration_showcases as iteration
  where iteration.author_user_id = p_actor

  union all

  select
    'job_posts:' || job.id::text,
    'job_posts'::text,
    'commune_job_post'::text,
    job.id,
    coalesce(nullif(pg_catalog.btrim(job.role_title), ''), 'Job Post'),
    job.application_status,
    job.anti_scam_review_status,
    job.application_status = 'needs_clarification'
      or job.anti_scam_review_status in (
        'not_reviewed', 'needs_pay_clarification', 'needs_contact_clarification',
        'needs_location_clarification', 'suspicious'
      ),
    '/commune/posts/' || job.post_id::text,
    job.created_at,
    job.updated_at
  from public.commune_job_posts as job
  where job.author_user_id = p_actor;
$$;
create or replace function private.project_account_domain_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := '{}'::jsonb;
  v_source_id uuid;
  v_recipient uuid;
  v_actor uuid;
  v_actor_kind text := 'user';
  v_source_domain text;
  v_source_type text;
  v_state text;
  v_old_state text;
  v_event_type text;
  v_delivery_class text := 'suppressible';
  v_category text := 'work_reviews';
  v_title text;
  v_preview text;
  v_deep_link text;
  v_inbox_kind text;
  v_action_kind text;
  v_priority integer := 50;
  v_retention text := 'source_lifecycle';
  v_request_email boolean := false;
  v_event_id uuid;
  v_transition_key text;
begin
  if tg_op = 'UPDATE' then v_old := pg_catalog.to_jsonb(old); end if;
  v_actor := auth.uid();

  case tg_table_name
    when 'work_with_requests' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_source_domain := 'work_with'; v_source_type := 'work_with_request';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'work_with.request.submitted'
        else 'work_with.request.status_changed' end;
      v_title := case v_state
        when 'needs_information' then 'Work With request needs information'
        when 'approved' then 'Work With request approved'
        when 'rejected' then 'Work With request declined'
        when 'withdrawn' then 'Work With request withdrawn'
        when 'archived' then 'Work With request archived'
        when 'in_review' then 'Work With request is under review'
        else 'Work With request received' end;
      v_preview := 'Open My Work With to view your application and respond.';
      v_deep_link := '/commons-circle/signals/work-with?request=' || v_source_id::text;
      if v_state = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'respond_work_with'; v_priority := 75;
      end if;

    when 'commune_troubleshooting_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'troubleshooting_post';
      v_state := v_new ->> 'troubleshooting_status';
      v_old_state := v_old ->> 'troubleshooting_status';
      v_event_type := case when tg_op = 'INSERT' then 'commune.troubleshooting.submitted'
        else 'commune.troubleshooting.status_changed' end;
      v_title := case v_state
        when 'needs_information' then 'Troubleshooting issue needs information'
        when 'resolved' then 'Troubleshooting issue resolved'
        when 'closed' then 'Troubleshooting issue closed'
        when 'workaround_found' then 'Troubleshooting workaround recorded'
        when 'fix_proposed' then 'Troubleshooting fix proposed'
        else 'Troubleshooting issue updated' end;
      v_preview := 'Open the Troubleshooting Grove post for the current public-safe status.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_state = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_troubleshooting_issue'; v_priority := 70;
      end if;

    when 'commune_research_notes' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'research_note';
      v_state := v_new ->> 'review_status'; v_old_state := v_old ->> 'review_status';
      v_event_type := case when tg_op = 'INSERT' then 'commune.research_note.submitted'
        else 'commune.research_note.status_changed' end;
      v_title := case v_state
        when 'needs_citation' then 'Research Note needs a citation'
        when 'needs_clarification' then 'Research Note needs clarification'
        when 'source_issue' then 'Research Note source needs attention'
        when 'overclaiming_evidence' then 'Research Note evidence claim needs attention'
        when 'published' then 'Research Note published'
        when 'corrected' then 'Research Note correction recorded'
        else 'Research Note updated' end;
      v_preview := 'Open the Research Note for its current review status.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_state in ('needs_citation','needs_clarification','source_issue','overclaiming_evidence') then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_research_note'; v_priority := 70;
      end if;

    when 'commune_repository_showcases' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'repository_showcase';
      v_state := coalesce(v_new ->> 'status', '') || ':' ||
        coalesce(v_new ->> 'sandbox_review_status', 'not_requested');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' ||
        coalesce(v_old ->> 'sandbox_review_status', 'not_requested');
      v_event_type := case when tg_op = 'INSERT' then 'commune.repository_showcase.submitted'
        else 'commune.repository_showcase.status_changed' end;
      v_title := case
        when v_new ->> 'sandbox_review_status' = 'needs_information' then 'Repository artifact review needs information'
        when v_new ->> 'sandbox_review_status' in ('approved_for_selected_artifact','rejected') then 'Repository artifact review updated'
        when v_new ->> 'status' = 'needs_information' then 'Repository Showcase needs information'
        when v_new ->> 'status' = 'approved' then 'Repository Showcase approved'
        when v_new ->> 'status' = 'rejected' then 'Repository Showcase rejected'
        else 'Repository Showcase updated' end;
      v_preview := 'Open the linked Commune post for the current showcase and selected-artifact review status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_new ->> 'status' = 'needs_information'
         or v_new ->> 'sandbox_review_status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_repository_showcase'; v_priority := 70;
      end if;

    when 'commune_iteration_showcases' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'iteration_showcase';
      v_state := coalesce(v_new ->> 'status', '') || ':' ||
        coalesce(v_new ->> 'sandbox_review_status', 'not_requested');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' ||
        coalesce(v_old ->> 'sandbox_review_status', 'not_requested');
      v_event_type := case when tg_op = 'INSERT' then 'commune.iteration_showcase.submitted'
        else 'commune.iteration_showcase.status_changed' end;
      v_title := case
        when v_new ->> 'sandbox_review_status' = 'needs_information' then 'Iteration artifact review needs information'
        when v_new ->> 'sandbox_review_status' in ('completed','failed','declined') then 'Iteration artifact review updated'
        when v_new ->> 'status' = 'needs_information' then 'Iteration Showcase needs information'
        when v_new ->> 'status' = 'approved' then 'Iteration Showcase approved'
        when v_new ->> 'status' = 'rejected' then 'Iteration Showcase rejected'
        else 'Iteration Showcase updated' end;
      v_preview := 'Open the linked Commune post for the current iteration and selected-artifact review status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_new ->> 'status' = 'needs_information'
         or v_new ->> 'sandbox_review_status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_iteration_showcase'; v_priority := 70;
      end if;

    when 'commune_job_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'author_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'job_post';
      v_state := coalesce(v_new ->> 'application_status', '') || ':' ||
        coalesce(v_new ->> 'anti_scam_review_status', '');
      v_old_state := coalesce(v_old ->> 'application_status', '') || ':' ||
        coalesce(v_old ->> 'anti_scam_review_status', '');
      v_event_type := case when tg_op = 'INSERT' then 'commune.job_post.submitted'
        else 'commune.job_post.status_changed' end;
      v_title := case
        when v_new ->> 'anti_scam_review_status' in (
          'needs_pay_clarification','needs_contact_clarification','needs_location_clarification'
        ) or v_new ->> 'application_status' = 'needs_clarification'
          then 'Job Post needs clarification'
        when v_new ->> 'anti_scam_review_status' = 'reviewed_clear' then 'Job Post review cleared'
        when v_new ->> 'anti_scam_review_status' in ('suspicious','removed') then 'Job Post moderation decision'
        when v_new ->> 'application_status' = 'filled' then 'Job Post marked filled'
        when v_new ->> 'application_status' = 'closed' then 'Job Post closed'
        else 'Job Post updated' end;
      v_preview := 'Open the Job Post for its current listing and review status. Billing remains separately authoritative.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');
      if v_new ->> 'application_status' = 'needs_clarification'
         or v_new ->> 'anti_scam_review_status' in (
           'needs_pay_clarification','needs_contact_clarification','needs_location_clarification'
         ) then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_job_post'; v_priority := 75;
      elsif v_new ->> 'anti_scam_review_status' in ('suspicious','removed') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_sandbox_runs' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := nullif(v_new ->> 'requester_user_id', '')::uuid;
      v_source_domain := 'sandbox'; v_source_type := 'sandbox_run';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      if v_state not in ('completed','failed','denied','policy_blocked','sandbox_unavailable') then return new; end if;
      v_event_type := 'sandbox.run.' || v_state;
      v_category := 'sandbox';
      v_title := case v_state when 'completed' then 'Sandbox run completed'
        when 'failed' then 'Sandbox run failed'
        when 'denied' then 'Sandbox run was denied'
        when 'policy_blocked' then 'Sandbox run was blocked by policy'
        else 'Sandbox service was unavailable' end;
      v_preview := 'Open the linked source for the bounded run status. No code or runner details are included here.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;

    when 'addon_submissions' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'submitted_by')::uuid;
      v_source_domain := 'developer_forge'; v_source_type := 'addon_submission';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'forge.addon_submission.submitted'
        else 'forge.addon_submission.status_changed' end;
      v_category := 'marketplace';
      v_title := case v_state
        when 'changes_requested' then 'Add-on submission needs changes'
        when 'approved' then 'Add-on submission approved'
        when 'rejected' then 'Add-on submission rejected'
        when 'security_hold' then 'Add-on submission is on security hold'
        when 'published' then 'Add-on published to Marketplace'
        else 'Add-on submission received' end;
      v_preview := 'Open Developer Forge for the current submission status. Package and reviewer details remain private.';
      v_deep_link := '/developer-forge/submissions/' || v_source_id::text;
      if v_state = 'changes_requested' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_addon_submission'; v_priority := 75;
      elsif v_state = 'security_hold' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_request_email := true;
      end if;

    when 'marketplace_listings' then
      v_source_id := (v_new ->> 'id')::uuid;
      select profile.user_id into v_recipient
      from public.developer_profiles as profile
      where profile.id = nullif(v_new ->> 'developer_profile_id', '')::uuid;
      v_source_domain := 'marketplace'; v_source_type := 'marketplace_listing';
      v_state := coalesce(v_new ->> 'listing_status', '');
      v_old_state := coalesce(v_old ->> 'listing_status', '');
      v_event_type := case when tg_op = 'INSERT' then 'marketplace.listing.created'
        else 'marketplace.listing.status_changed' end;
      v_category := 'marketplace';
      v_title := case v_state when 'published' then 'Marketplace listing published'
        when 'revoked' then 'Marketplace listing revoked'
        when 'approved' then 'Marketplace listing approved'
        else 'Marketplace listing updated' end;
      v_preview := 'Open Marketplace or Developer Forge for the current listing state. Economic contracts remain separate.';
      v_deep_link := '/developer-forge/submissions';
      if v_state = 'revoked' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_request_email := true;
      end if;

    when 'commune_reports', 'content_reports' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := nullif(v_new ->> 'reporter_user_id', '')::uuid;
      v_source_domain := 'moderation'; v_source_type := case tg_table_name
        when 'commune_reports' then 'commune_report' else 'content_report' end;
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      v_event_type := case when tg_op = 'INSERT' then 'moderation.report.received'
        else 'moderation.report.status_changed' end;
      v_category := 'moderation';
      v_title := case v_state when 'submitted' then 'Report received'
        when 'under_review' then 'Report is under review'
        when 'action_taken' then 'Report review completed'
        when 'dismissed' then 'Report review completed'
        else 'Report status updated' end;
      v_preview := 'Open your account notifications for the report status. Report details and reviewer notes remain private.';
      v_deep_link := '/commons-circle/notifications';

    when 'commune_comments' then
      if tg_op = 'INSERT' then return new; end if;
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_actor := coalesce(v_actor, nullif(v_new ->> 'hidden_by', '')::uuid, v_recipient);
      v_source_domain := 'commune'; v_source_type := 'commune_comment';
      v_state := v_new ->> 'status'; v_old_state := v_old ->> 'status';
      if v_state in ('draft','pending_review','deleted_by_user') then return new; end if;
      v_event_type := 'commune.comment.status_changed';
      v_title := case v_state
        when 'published' then 'Commune comment published'
        when 'hidden' then 'Commune comment hidden by moderation'
        when 'removed_by_moderator' then 'Commune comment removed by moderation'
        when 'archived' then 'Commune comment archived'
        else 'Commune comment updated' end;
      v_preview := 'Open the Commune post for the comment publication or moderation status.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/notifications'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_state in ('hidden','removed_by_moderator') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_media' then
      if tg_op = 'INSERT' then return new; end if;
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'owner_user_id')::uuid;
      v_source_domain := 'commune'; v_source_type := 'commune_media';
      v_state := v_new ->> 'visibility_state';
      v_old_state := v_old ->> 'visibility_state';
      if v_state = 'submitted' then return new; end if;
      v_event_type := 'commune.media.status_changed';
      v_title := case v_state
        when 'published' then 'Commune attachment published'
        when 'flagged' then 'Commune attachment flagged for review'
        when 'hidden' then 'Commune attachment hidden by moderation'
        when 'removed' then 'Commune attachment removed by moderation'
        when 'revoked' then 'Commune attachment access revoked'
        when 'archived' then 'Commune attachment archived'
        else 'Commune attachment updated' end;
      v_preview := 'Open the linked Commune surface for the current attachment status. File details are not included here.';
      v_deep_link := case when nullif(v_new ->> 'post_id', '') is null
        then '/commons-circle/requests-reviews'
        else '/commune/posts/' || (v_new ->> 'post_id') end;
      if v_state in ('flagged','hidden','removed','revoked') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_sandbox_review_requests' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := coalesce(
        nullif(v_new ->> 'submitted_by', '')::uuid,
        nullif(v_new ->> 'user_id', '')::uuid
      );
      v_source_domain := 'sandbox'; v_source_type := 'sandbox_review_request';
      v_state := coalesce(v_new ->> 'request_status', '') || ':' ||
        coalesce(v_new ->> 'review_status', '') || ':' ||
        coalesce(v_new ->> 'handoff_status', '') || ':' ||
        coalesce(v_new ->> 'status', '');
      v_old_state := coalesce(v_old ->> 'request_status', '') || ':' ||
        coalesce(v_old ->> 'review_status', '') || ':' ||
        coalesce(v_old ->> 'handoff_status', '') || ':' ||
        coalesce(v_old ->> 'status', '');
      if tg_op = 'INSERT'
         and v_new ->> 'request_status' = 'draft'
         and v_new ->> 'review_status' = 'not_submitted' then return new; end if;
      if tg_op = 'UPDATE'
         and v_new ->> 'handoff_status' = 'exported'
         and v_new ->> 'request_status' = v_old ->> 'request_status'
         and v_new ->> 'review_status' = v_old ->> 'review_status'
         and v_new ->> 'status' = v_old ->> 'status' then return new; end if;
      v_event_type := case when tg_op = 'INSERT'
        then 'sandbox.review_request.submitted'
        else 'sandbox.review_request.status_changed' end;
      v_category := 'sandbox';
      v_title := case
        when v_new ->> 'request_status' = 'changes_requested'
          or v_new ->> 'review_status' = 'changes_requested'
          or v_new ->> 'status' = 'needs_information'
          then 'Sandbox review request needs information'
        when v_new ->> 'request_status' = 'approved_for_local_handoff'
          or v_new ->> 'review_status' = 'approved'
          or v_new ->> 'status' = 'approved_for_local_sandbox'
          then 'Selected artifact approved for local handoff'
        when v_new ->> 'request_status' = 'security_hold'
          or v_new ->> 'review_status' = 'security_hold'
          then 'Sandbox review request placed on security hold'
        when v_new ->> 'request_status' in ('rejected','revoked')
          or v_new ->> 'review_status' = 'rejected'
          or v_new ->> 'status' = 'rejected'
          then 'Sandbox review request declined or revoked'
        when v_new ->> 'request_status' = 'archived'
          or v_new ->> 'status' = 'archived'
          then 'Sandbox review request archived'
        when v_new ->> 'review_status' = 'pending_review'
          or v_new ->> 'request_status' = 'submitted'
          or v_new ->> 'status' in ('requested','in_review')
          then 'Sandbox review request received'
        else 'Sandbox review request updated' end;
      v_preview := 'Open Requests & Reviews for the selected-artifact review status. This notice does not grant execution permission.';
      v_deep_link := '/commons-circle/requests-reviews';
      if v_new ->> 'request_status' = 'changes_requested'
         or v_new ->> 'review_status' = 'changes_requested'
         or v_new ->> 'status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_sandbox_review_request';
        v_priority := 75;
      elsif v_new ->> 'request_status' in ('security_hold','revoked')
         or v_new ->> 'review_status' = 'security_hold' then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 90; v_request_email := true;
      end if;

    when 'commune_posts' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'user_id')::uuid;
      v_actor := coalesce(v_actor, nullif(v_new ->> 'hidden_by', '')::uuid, v_recipient);
      v_source_domain := 'commune'; v_source_type := 'commune_post';
      v_state := coalesce(v_new ->> 'status', '') || ':' || coalesce(v_new ->> 'moderation_status', '');
      v_old_state := coalesce(v_old ->> 'status', '') || ':' || coalesce(v_old ->> 'moderation_status', '');
      if tg_op = 'INSERT' then return new; end if;
      v_event_type := 'commune.post.status_changed';
      v_title := case v_new ->> 'status'
        when 'needs_information' then 'Commune post needs information'
        when 'published' then 'Commune post published'
        when 'approved' then 'Commune post approved'
        when 'rejected' then 'Commune post rejected'
        when 'hidden' then 'Commune post hidden by moderation'
        when 'removed_by_moderator' then 'Commune post removed by moderation'
        when 'archived' then 'Commune post archived'
        else 'Commune post updated' end;
      v_preview := 'Open the Commune post for its current publication and moderation state.';
      v_deep_link := '/commune/posts/' || v_source_id::text;
      if v_new ->> 'status' = 'needs_information' then
        v_inbox_kind := 'required_action'; v_action_kind := 'update_commune_post'; v_priority := 75;
      elsif v_new ->> 'status' in ('rejected','hidden','removed_by_moderator') then
        v_delivery_class := 'mandatory'; v_category := 'moderation';
        v_actor_kind := 'staff'; v_priority := 85; v_request_email := true;
      end if;

    when 'commune_official_updates' then
      v_source_id := (v_new ->> 'id')::uuid;
      v_recipient := (v_new ->> 'admin_user_id')::uuid;
      v_actor_kind := 'staff';
      v_source_domain := 'commune'; v_source_type := 'official_update';
      v_state := coalesce(v_new ->> 'official_status', '') || ':' ||
        coalesce(v_new ->> 'correction_status', 'none');
      v_old_state := coalesce(v_old ->> 'official_status', '') || ':' ||
        coalesce(v_old ->> 'correction_status', 'none');
      v_event_type := case when tg_op = 'INSERT' then 'commune.official_update.published'
        else 'commune.official_update.status_changed' end;
      v_category := 'announcements';
      v_title := 'Official Update lifecycle recorded';
      v_preview := 'Open the Official Update for its current public lifecycle. Audience delivery requires the governed announcement workflow.';
      v_deep_link := '/commune/posts/' || (v_new ->> 'post_id');

    else
      return new;
  end case;

  if v_recipient is null or v_source_id is null then return new; end if;
  if tg_op = 'UPDATE' and v_state is not distinct from v_old_state then return new; end if;
  if v_actor is null then
    v_actor_kind := 'system';
  elsif v_actor is distinct from v_recipient then
    v_actor_kind := 'staff';
  end if;

  v_transition_key := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    tg_table_schema || '.' || tg_table_name || ':' || v_source_id::text || ':' ||
    coalesce(v_old_state, '<insert>') || ':' || coalesce(v_state, '<none>') || ':' ||
    coalesce(v_new ->> 'updated_at', v_new ->> 'created_at', pg_catalog.now()::text),
    'UTF8'
  ), 'sha256'), 'hex');

  begin
    perform private.resolve_account_inbox_items(
      v_source_domain, v_source_type, v_source_id, v_recipient, 'completed'
    );
    v_event_id := private.emit_account_notification_event(
      v_event_type, v_source_domain, v_source_type, v_source_id, v_actor,
      v_actor_kind, v_recipient, 'account-source-transition:' || v_transition_key,
      v_delivery_class, v_category, v_title, v_preview, v_deep_link,
      case when v_delivery_class = 'mandatory' then 'mandatory_notice' else 'outcome' end,
      v_inbox_kind, v_action_kind, v_priority, v_request_email, v_retention
    );
    perform private.insert_legacy_account_notification_projection(
      v_event_id, v_recipient,
      pg_catalog.replace(v_event_type, '.', '_'), v_source_type, v_source_id,
      v_title, v_preview, v_deep_link
    );
  exception when others then
    if v_delivery_class = 'mandatory' then raise; end if;
    raise warning 'Optional account source projection skipped for %.%: %',
      tg_table_schema, tg_table_name, sqlstate;
  end;
  return new;
end;
$$;
-- Preserve the existing owner export boundary for the newly separated profile.
create or replace function public.get_community_export_snapshot(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_request_id uuid,
  p_section text,
  p_limit integer,
  p_after_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request private.account_lifecycle_requests%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_items jsonb := '[]'::jsonb;
  v_next_id uuid;
  v_saved_sub text := current_setting('request.jwt.claim.sub', true);
  v_saved_role text := current_setting('request.jwt.claim.role', true);
begin
  perform private.require_community_operator(p_actor_user_id, p_actor_aal, 'community_lifecycle_manage');
  if p_section not in (
    'profile','terms','artworks','media','posts','comments',
    'submissions','reports','appeals','notifications',
    'commune_posts','commune_comments','commune_media',
    'commune_code_documents','commune_jobs','commune_abuse_reports',
    'commune_code_reports','forge_profile','forge_drafts',
    'forge_submissions','forge_sandbox','marketplace_library',
    'online_notifications','economic_summary'
  ) then
    raise exception using errcode = '22023', message = 'community_export_section_invalid';
  end if;
  select * into strict v_request
  from private.account_lifecycle_requests
  where id = p_request_id and action = 'data_export'
    and status = 'processing' and claimed_by = p_actor_user_id;

  if p_section = 'profile' then
    select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', profile.id,
      'profile', to_jsonb(profile),
      'marketplaceAccountProfile', (select to_jsonb(marketplace) - 'user_id' from public.marketplace_account_profiles marketplace where marketplace.user_id=profile.id),
      'publicCard', (select to_jsonb(card) from public.profile_public_cards as card
        where card.user_id = profile.id),
      'participation', (select to_jsonb(participation) - 'user_id'
        from private.account_participation as participation where participation.user_id = profile.id),
      'notificationPreferences', (select to_jsonb(preference) - 'user_id'
        from private.community_notification_preferences as preference where preference.user_id = profile.id),
      'artisanMembership', (select to_jsonb(membership) - 'user_id'
        from artisan.memberships as membership where membership.user_id = profile.id)
    )) into v_items
    from public.profiles as profile where profile.id = v_request.user_id;
  elsif p_section = 'terms' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select acceptance.id, acceptance.document_key, acceptance.document_version,
        acceptance.content_sha256, acceptance.accepted_origin, acceptance.accepted_at
      from private.community_terms_acceptances as acceptance
      where acceptance.user_id = v_request.user_id
        and (p_after_id is null or acceptance.id > p_after_id)
      order by acceptance.id limit v_limit
    ) as item;
  elsif p_section = 'artworks' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select artwork.* from artisan.artworks as artwork
      where artwork.owner_user_id = v_request.user_id
        and (p_after_id is null or artwork.id > p_after_id)
      order by artwork.id limit v_limit
    ) as item;
  elsif p_section = 'media' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'storage_provider','quarantine_bucket','private_object_key',
        'approved_bucket','approved_object_key','thumbnail_bucket',
        'thumbnail_object_key','captions_object_key'
      ]::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select media.* from artisan.media_assets as media
      where media.owner_user_id = v_request.user_id
        and (p_after_id is null or media.id > p_after_id)
      order by media.id limit v_limit
    ) as item;
  elsif p_section = 'posts' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select post.* from artisan.forum_posts as post
      where post.owner_user_id = v_request.user_id
        and (p_after_id is null or post.id > p_after_id)
      order by post.id limit v_limit
    ) as item;
  elsif p_section = 'comments' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select comment.* from artisan.comments as comment
      where comment.user_id = v_request.user_id
        and (p_after_id is null or comment.id > p_after_id)
      order by comment.id limit v_limit
    ) as item;
  elsif p_section = 'submissions' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select submission.* from artisan.challenge_submissions as submission
      where submission.submitter_user_id = v_request.user_id
        and (p_after_id is null or submission.id > p_after_id)
      order by submission.id limit v_limit
    ) as item;
  elsif p_section = 'reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - 'reporter_fingerprint_sha256' order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select report.* from artisan.reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'appeals' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewer_user_id','private_reason']::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select appeal.* from artisan.appeals as appeal
      where appeal.appellant_user_id = v_request.user_id
        and (p_after_id is null or appeal.id > p_after_id)
      order by appeal.id limit v_limit
    ) as item;
  elsif p_section = 'notifications' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'claimed_by','claimed_at','lease_expires_at','last_error_code',
        'last_error_at','delivery_evidence_sha256'
      ]::text[] order by item.id
    ), '[]'::jsonb)
    into v_items from (
      select notification.* from artisan.notifications as notification
      where notification.user_id = v_request.user_id
        and (p_after_id is null or notification.id > p_after_id)
      order by notification.id limit v_limit
    ) as item;
  elsif p_section = 'commune_posts' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['hidden_by','moderation_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select post.* from public.commune_posts as post
      where post.user_id = v_request.user_id
        and (p_after_id is null or post.id > p_after_id)
      order by post.id limit v_limit
    ) as item;
  elsif p_section = 'commune_comments' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['hidden_by','moderation_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select comment.* from public.commune_comments as comment
      where comment.user_id = v_request.user_id
        and (p_after_id is null or comment.id > p_after_id)
      order by comment.id limit v_limit
    ) as item;
  elsif p_section = 'commune_media' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'storage_bucket','storage_path','hidden_by','moderation_reason'
      ]::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select media.* from public.commune_media as media
      where media.owner_user_id = v_request.user_id
        and (p_after_id is null or media.id > p_after_id)
      order by media.id limit v_limit
    ) as item;
  elsif p_section = 'commune_code_documents' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - 'moderation_reason' order by item.id
    ), '[]'::jsonb) into v_items from (
      select document.* from public.commune_code_documents as document
      where document.owner_user_id = v_request.user_id
        and (p_after_id is null or document.id > p_after_id)
      order by document.id limit v_limit
    ) as item;
  elsif p_section = 'commune_jobs' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','private_application_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select job.* from public.commune_job_posts as job
      where job.author_user_id = v_request.user_id
        and (p_after_id is null or job.id > p_after_id)
      order by job.id limit v_limit
    ) as item;
  elsif p_section = 'commune_abuse_reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','resolution_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select report.* from public.commune_abuse_reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'commune_code_reports' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['reviewed_by','reviewer_note']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select report.* from public.commune_code_reports as report
      where report.reporter_user_id = v_request.user_id
        and (p_after_id is null or report.id > p_after_id)
      order by report.id limit v_limit
    ) as item;
  elsif p_section = 'forge_profile' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select profile.* from public.developer_profiles as profile
      where profile.user_id = v_request.user_id
        and (p_after_id is null or profile.id > p_after_id)
      order by profile.id limit v_limit
    ) as item;
  elsif p_section = 'forge_drafts' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array['icon_path','package_file_path','locked_reason']::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select draft.* from public.addon_drafts as draft
      where draft.owner_user_id = v_request.user_id
        and (p_after_id is null or draft.id > p_after_id)
      order by draft.id limit v_limit
    ) as item;
  elsif p_section = 'forge_submissions' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select submission.* from public.addon_submissions as submission
      where submission.submitted_by = v_request.user_id
        and (p_after_id is null or submission.id > p_after_id)
      order by submission.id limit v_limit
    ) as item;
  elsif p_section = 'forge_sandbox' then
    select coalesce(pg_catalog.jsonb_agg(
      to_jsonb(item) - array[
        'handoff_bundle_json','reviewed_by','reviewer_private_note',
        'security_hold_reason','package_url'
      ]::text[] order by item.id
    ), '[]'::jsonb) into v_items from (
      select request.* from public.commune_sandbox_review_requests as request
      where coalesce(request.submitted_by, request.user_id) = v_request.user_id
        and (p_after_id is null or request.id > p_after_id)
      order by request.id limit v_limit
    ) as item;
  elsif p_section = 'marketplace_library' then
    select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', v_request.user_id,
      'savedAddons', coalesce((
        select pg_catalog.jsonb_agg(to_jsonb(saved) order by saved.saved_at desc)
        from (select * from public.user_saved_addons
          where user_id = v_request.user_id order by saved_at desc, addon_slug) as saved
      ), '[]'::jsonb),
      'installIntents', coalesce((
        select pg_catalog.jsonb_agg(to_jsonb(intent) order by intent.created_at desc)
        from (select * from public.marketplace_install_intents
          where user_id = v_request.user_id order by created_at desc, id) as intent
      ), '[]'::jsonb),
      'licenses', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'licenseId', license.id, 'listingId', license.listing_id,
          'addonVersionId', license.addon_version_id,
          'listingSlug', listing.slug, 'listingName', listing.name,
          'version', version.version, 'licenseKey', license.license_key,
          'licenseVersion', license.license_version,
          'acquisitionKind', license.acquisition_kind,
          'economicStatus', license.economic_status,
          'acquiredAt', license.acquired_at
        ) order by license.acquired_at desc)
        from private.marketplace_licenses as license
        join public.marketplace_listings as listing on listing.id = license.listing_id
        join public.marketplace_addon_versions as version on version.id = license.addon_version_id
        where license.buyer_user_id = v_request.user_id
      ), '[]'::jsonb)
    )) into v_items;
  elsif p_section = 'online_notifications' then
    select coalesce(pg_catalog.jsonb_agg(to_jsonb(item) order by item.id), '[]'::jsonb)
    into v_items from (
      select notification.* from public.user_notifications as notification
      where notification.user_id = v_request.user_id
        and (p_after_id is null or notification.id > p_after_id)
      order by notification.id limit v_limit
    ) as item;
  else
    -- Reuse the deliberately owner-safe economic projection; temporarily
    -- assume only the data subject, then restore the service/operator claims.
    perform pg_catalog.set_config('request.jwt.claim.sub', v_request.user_id::text, true);
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    v_items := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', v_request.user_id,
      'accountSummary', public.current_user_economic_account_summary(),
      'closureReadiness', private.economic_account_closure_obligations(v_request.user_id)
    ));
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_saved_sub, ''), true);
    perform pg_catalog.set_config('request.jwt.claim.role', coalesce(v_saved_role, 'service_role'), true);
  end if;
  if p_section not in ('profile','marketplace_library','economic_summary')
     and pg_catalog.jsonb_array_length(v_items) = v_limit then
    v_next_id := ((v_items -> -1) ->> 'id')::uuid;
  end if;
  return pg_catalog.jsonb_build_object(
    'snapshotVersion', 'community-account-export-v2',
    'requestId', v_request.id,
    'section', p_section,
    'items', v_items,
    'nextId', v_next_id
  );
end;
$$;
commit;

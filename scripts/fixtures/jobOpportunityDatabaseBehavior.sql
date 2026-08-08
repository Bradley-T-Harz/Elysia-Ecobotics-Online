\set ON_ERROR_STOP on

-- Synthetic identities and parent rows exist only in the disposable database.
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'opportunity-user@example.invalid', now(), now(), now()),
  ('d1000000-0000-4000-8000-000000000002', 'opportunity-admin@example.invalid', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name, is_admin, commons_onboarding_completed_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'opportunity-user', 'Opportunity User', false, now()),
  ('d1000000-0000-4000-8000-000000000002', 'opportunity-admin', 'Opportunity Admin', true, now())
on conflict (id) do update set is_admin = excluded.is_admin;

insert into public.commune_posts (id, user_id, post_type, title, body, status, visibility, moderation_status, visibility_state)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Legacy public opportunity', 'Legacy fixture', 'published', 'public', 'approved', 'published'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'V2 public opportunity', 'V2 fixture', 'published', 'public', 'approved', 'published'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Ordinary pending opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft'),
  ('d2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Blocked Work With opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft'),
  ('d2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000002', 'job_post', 'First-party Work With opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft');

insert into public.commune_job_posts (
  id, post_id, author_user_id, role_title, organization_project,
  role_type, paid_volunteer_status, location_mode, role_summary
) values (
  'd3000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'Legacy role', 'Legacy organization', 'other', 'must_clarify', 'unspecified', 'Legacy model fixture.'
);

do $$
begin
  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000001'
      and model_version = 1
      and opportunity_type is null
      and compensation_status is null
  ) then
    raise exception 'additive migration changed or guessed the legacy row';
  end if;
end;
$$;

insert into public.commune_job_posts (
  id, post_id, author_user_id, role_title, organization_project, role_summary,
  role_type, paid_volunteer_status, location_mode, compensation_clarity, contact_path,
  model_version, opportunity_type, compensation_status, compensation_models,
  compensation_currency, compensation_min_amount, compensation_max_amount, compensation_period,
  work_arrangement, time_basis, duration_type, poster_type, organization_website,
  experience_level, application_route_type, application_destination, future_interest_acknowledged
) values (
  'd3000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000001',
  'Ecological software engineer', 'Example Cooperative', 'Build public restoration tools.',
  'paid_role', 'paid', 'remote', 'Paid · Salary · USD 64000–82000 / year', 'https://jobs.example.org/apply',
  2, 'paid_employment', 'paid', array['salary'],
  'USD', 64000, 82000, 'year',
  'remote', 'full_time', 'ongoing', 'cooperative', 'https://example.org',
  'entry_early_career', 'official_application_webpage', 'https://jobs.example.org/apply', false
);

do $$
begin
  begin
    update public.commune_job_posts
    set compensation_status = 'future_compensation_not_established', compensation_models = array[]::text[]
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'future-TBD escaped the future-interest restriction';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set application_destination = null
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'required public application destination accepted NULL';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set application_destination = 'http://127.0.0.1/apply'
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'private application destination accepted';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set application_destination = 'https://'
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'malformed application destination accepted';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set organization_website = 'https://jobs.example.local'
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'local-only organization website accepted';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set compensation_models = array['salary', 'unpaid_volunteer']
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'contradictory paid and unpaid models accepted without Mixed status';
  exception when check_violation then null;
  end;

  begin
    update public.commune_job_posts set compensation_models = array['salary', null]::text[]
    where id = 'd3000000-0000-4000-8000-000000000002';
    raise exception 'NULL compensation-model array member accepted';
  exception when check_violation then null;
  end;

  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000002'
      and model_version = 2
      and compensation_status = 'paid'
      and compensation_models = array['salary']::text[]
      and application_destination = 'https://jobs.example.org/apply'
  ) then
    raise exception 'failed constraint probes did not roll back their row mutations';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commune_job_posts'
      and policyname = 'v2 private work with insert is first party only'
      and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'restrictive first-party Work With insert policy missing';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

insert into public.commune_job_posts (
  id, post_id, author_user_id, role_title, organization_project, role_summary,
  model_version, opportunity_type, compensation_status, compensation_models,
  work_arrangement, time_basis, duration_type, poster_type,
  application_route_type, application_destination,
  role_type, paid_volunteer_status, location_mode, compensation_clarity, contact_path
) values (
  'd3000000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000001',
  'Community documentation contributor', 'Example Community', 'Improve the public contributor guide.',
  2, 'community_open_source_contribution', 'unpaid_volunteer', array['unpaid_volunteer'],
  'remote', 'flexible_as_needed', 'ongoing', 'community_organization',
  'repository_contribution_instructions', 'https://github.com/example/project/contributing',
  'contributor_call', 'unpaid', 'remote', 'Unpaid / volunteer · Unpaid / volunteer', 'https://github.com/example/project/contributing'
);

do $$
begin
  begin
    insert into public.commune_job_posts (
      id, post_id, author_user_id, role_title, organization_project, role_summary,
      model_version, opportunity_type, compensation_status, compensation_models,
      work_arrangement, time_basis, duration_type, poster_type,
      application_route_type, application_destination,
      role_type, paid_volunteer_status, location_mode, compensation_clarity, contact_path, work_with_link_enabled
    ) values (
      'd3000000-0000-4000-8000-000000000004',
      'd2000000-0000-4000-8000-000000000004',
      'd1000000-0000-4000-8000-000000000001',
      'Unauthorized first-party route', 'Elysia Ecobotics', 'This ordinary user must not claim the private route.',
      2, 'paid_employment', 'unpaid_volunteer', array['unpaid_volunteer'],
      'remote', 'part_time', 'ongoing', 'business_company',
      'private_work_with', '/work-with-elysia-ecobotics',
      'paid_role', 'unpaid', 'remote', 'Unpaid / volunteer', '/work-with-elysia-ecobotics', true
    );
    raise exception 'ordinary user inserted first-party private Work With route';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

insert into public.commune_job_posts (
  id, post_id, author_user_id, role_title, organization_project, role_summary,
  model_version, opportunity_type, compensation_status, compensation_models,
  compensation_currency, compensation_min_amount, compensation_period,
  work_arrangement, time_basis, duration_type, poster_type,
  application_route_type, application_destination,
  role_type, paid_volunteer_status, location_mode, compensation_clarity, contact_path, work_with_link_enabled
) values (
  'd3000000-0000-4000-8000-000000000005',
  'd2000000-0000-4000-8000-000000000005',
  'd1000000-0000-4000-8000-000000000002',
  'First-party opportunity', 'Elysia Ecobotics', 'Authorized first-party private intake.',
  2, 'paid_employment', 'paid', array['hourly'],
  'USD', 32, 'hour',
  'remote', 'part_time', 'fixed_term', 'business_company',
  'private_work_with', '/work-with-elysia-ecobotics',
  'paid_role', 'paid', 'remote', 'Paid · Hourly · USD 32 / hour', '/work-with-elysia-ecobotics', true
);

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{}', false);

do $$
declare public_count integer;
begin
  select count(*) into public_count
  from public.commune_job_posts
  where id in ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002');
  if public_count <> 2 then
    raise exception 'public read policy no longer exposes both published legacy and v2 rows';
  end if;
  if exists (select 1 from public.commune_job_posts where id = 'd3000000-0000-4000-8000-000000000003') then
    raise exception 'anonymous reader saw a pending opportunity';
  end if;
end;
$$;

reset role;

select 'job_opportunity_database_behavior_ok' as result;

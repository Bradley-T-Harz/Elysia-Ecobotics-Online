\set ON_ERROR_STOP on

-- Synthetic identities and parent rows exist only in the disposable database.
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'opportunity-user@example.invalid', now(), now(), now()),
  ('d1000000-0000-4000-8000-000000000002', 'opportunity-admin@example.invalid', now(), now(), now()),
  ('d1000000-0000-4000-8000-000000000003', 'opportunity-other-member@example.invalid', now(), now(), now()),
  ('d1000000-0000-4000-8000-000000000004', 'opportunity-commune-reviewer@example.invalid', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name, is_admin, commons_onboarding_completed_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'opportunity-user', 'Opportunity User', false, now()),
  ('d1000000-0000-4000-8000-000000000002', 'opportunity-admin', 'Opportunity Admin', true, now()),
  ('d1000000-0000-4000-8000-000000000003', 'opportunity-other-member', 'Opportunity Other Member', false, now()),
  ('d1000000-0000-4000-8000-000000000004', 'opportunity-commune-reviewer', 'Opportunity Commune Reviewer', false, now())
on conflict (id) do update set is_admin = excluded.is_admin;

insert into public.user_roles (user_id, role, reason)
values (
  'd1000000-0000-4000-8000-000000000004',
  'commune_moderator',
  'Synthetic canonical Commune reviewer for disposable Job Post authority verification.'
)
on conflict (user_id, role) where revoked_at is null do nothing;

insert into public.commune_posts (id, user_id, post_type, title, body, status, visibility, moderation_status, visibility_state)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Legacy public opportunity', 'Legacy fixture', 'published', 'public', 'approved', 'published'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'V2 public opportunity', 'V2 fixture', 'published', 'public', 'approved', 'published'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Ordinary pending opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft'),
  ('d2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'job_post', 'Blocked Work With opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft'),
  ('d2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000002', 'job_post', 'First-party Work With opportunity', 'RLS fixture', 'pending_review', 'private_draft', 'pending_review', 'draft'),
  ('d2000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000003', 'job_post', 'Other member opportunity', 'Ownership isolation fixture', 'published', 'public', 'approved', 'published');

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

insert into public.commune_job_posts (
  id, post_id, author_user_id, role_title, organization_project, role_summary,
  role_type, paid_volunteer_status, location_mode, compensation_clarity, contact_path,
  model_version, opportunity_type, compensation_status, compensation_models,
  compensation_currency, compensation_min_amount, compensation_period,
  work_arrangement, time_basis, duration_type, poster_type,
  application_route_type, application_destination, future_interest_acknowledged
) values (
  'd3000000-0000-4000-8000-000000000006',
  'd2000000-0000-4000-8000-000000000006',
  'd1000000-0000-4000-8000-000000000003',
  'Other member role', 'Other Member Cooperative', 'Ownership isolation fixture.',
  'paid_role', 'paid', 'remote', 'Paid · Hourly', 'https://other.example.org/apply',
  2, 'paid_employment', 'paid', array['hourly'],
  'USD', 28, 'hour',
  'remote', 'part_time', 'fixed_term', 'cooperative',
  'official_application_webpage', 'https://other.example.org/apply', false
);

insert into public.review_items (
  id, domain, source_table, source_id, submitted_by, status, title, summary
) values (
  'd4000000-0000-4000-8000-000000000001',
  'commune', 'commune_job_posts', 'd3000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000001', 'in_review',
  'Synthetic Job Post review', 'Protected review-history boundary fixture.'
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
  'First-party opportunity', 'EcoSyneva Commons LLC — Elysia Ecobotics Online', 'Authorized first-party private intake.',
  2, 'paid_employment', 'paid', array['hourly'],
  'USD', 32, 'hour',
  'remote', 'part_time', 'fixed_term', 'business_company',
  'private_work_with', '/work-with-elysia-ecobotics',
  'paid_role', 'paid', 'remote', 'Paid · Hourly · USD 32 / hour', '/work-with-elysia-ecobotics', true
);

-- Administrators retain the canonical governed Job Post review authority.
update public.commune_job_posts
set application_status = 'reviewing',
    anti_scam_review_status = 'reviewed_clear',
    public_correction_note = 'Administrator public clarification.',
    reviewed_by = 'd1000000-0000-4000-8000-000000000002',
    reviewed_at = now()
where id = 'd3000000-0000-4000-8000-000000000002';

insert into public.review_comments (id, review_item_id, actor_id, body, visibility)
values (
  'd4100000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'SYNTHETIC_PRIVATE_ADMIN_NOTE', 'internal'
);

insert into public.review_events (
  id, review_item_id, actor_id, event_type, from_status, to_status, note, metadata
) values (
  'd4200000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'status_changed', 'pending_review', 'in_review',
  'SYNTHETIC_PRIVATE_ADMIN_HISTORY', '{"visibility":"internal"}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000002'
      and application_status = 'reviewing'
      and anti_scam_review_status = 'reviewed_clear'
  ) then
    raise exception 'administrator could not perform intended Job Post lifecycle and anti-scam review';
  end if;
end;
$$;

-- The original author can update only the narrow public lifecycle fields.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

select public.update_own_commune_job_post_application_status(
  'd3000000-0000-4000-8000-000000000002', null, 'filled',
  'Author public-safe clarification.'
);

do $$
declare
  changed_rows integer;
begin
  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000002'
      and application_status = 'filled'
      and public_correction_note = 'Author public-safe clarification.'
      and anti_scam_review_status = 'reviewed_clear'
      and compensation_status = 'paid'
  ) then
    raise exception 'author lifecycle RPC changed the wrong fields or lost the reviewer state';
  end if;

  update public.commune_job_posts
  set anti_scam_review_status = 'not_reviewed', reviewed_by = auth.uid()
  where id = 'd3000000-0000-4000-8000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'author bypassed RLS and self-certified anti-scam review';
  end if;

  begin
    perform public.update_own_commune_job_post_application_status(
      'd3000000-0000-4000-8000-000000000006', null, 'closed',
      'Unauthorized cross-account correction.'
    );
    raise exception 'author changed another author''s listing lifecycle';
  exception
    when raise_exception then
      if sqlerrm = 'author changed another author''s listing lifecycle' then raise; end if;
      if sqlerrm not like 'Only the Job Post author can update this listing status.%' then raise; end if;
  end;

  begin
    execute 'select private_application_note from public.commune_job_posts where id = ''d3000000-0000-4000-8000-000000000002''';
    raise exception 'author read the deprecated pseudo-private Job Post note';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select reviewed_by from public.commune_job_posts where id = ''d3000000-0000-4000-8000-000000000002''';
    raise exception 'author read protected review-actor metadata';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.review_comments (review_item_id, actor_id, body, visibility)
    values (
      'd4000000-0000-4000-8000-000000000001', auth.uid(),
      'UNAUTHORIZED_AUTHOR_INTERNAL_NOTE', 'internal'
    );
    raise exception 'author wrote a protected reviewer note';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.review_events (
      review_item_id, actor_id, event_type, from_status, to_status, note, metadata
    ) values (
      'd4000000-0000-4000-8000-000000000001', auth.uid(),
      'status_changed', 'in_review', 'approved',
      'UNAUTHORIZED_AUTHOR_REVIEW_HISTORY', '{"visibility":"internal"}'::jsonb
    );
    raise exception 'author wrote protected reviewer history';
  exception when insufficient_privilege then null;
  end;

  if exists (
    select 1 from public.review_comments
    where review_item_id = 'd4000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'author read a protected reviewer note';
  end if;

  if exists (
    select 1 from public.review_events
    where review_item_id = 'd4000000-0000-4000-8000-000000000001'
      and coalesce(metadata ->> 'visibility', 'submitter_visible') = 'internal'
  ) then
    raise exception 'author read protected reviewer history';
  end if;
end;
$$;

-- A different ordinary member can update only their own listing and cannot
-- mutate the first author's listing through direct state manipulation.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

select public.update_own_commune_job_post_application_status(
  'd3000000-0000-4000-8000-000000000006', null, 'reviewing',
  'Other author public-safe clarification.'
);

do $$
declare
  changed_rows integer;
begin
  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000006'
      and application_status = 'reviewing'
      and public_correction_note = 'Other author public-safe clarification.'
  ) then
    raise exception 'other author could not update their own listing lifecycle';
  end if;

  update public.commune_job_posts
  set application_status = 'closed', anti_scam_review_status = 'reviewed_clear'
  where id = 'd3000000-0000-4000-8000-000000000002';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'ordinary member directly mutated another author''s listing';
  end if;

  begin
    perform public.update_own_commune_job_post_application_status(
      'd3000000-0000-4000-8000-000000000002', null, 'closed',
      'Unauthorized member correction.'
    );
    raise exception 'ordinary member used owner RPC on another author''s listing';
  exception
    when raise_exception then
      if sqlerrm = 'ordinary member used owner RPC on another author''s listing' then raise; end if;
      if sqlerrm not like 'Only the Job Post author can update this listing status.%' then raise; end if;
  end;
end;
$$;

-- A distinct canonical Commune reviewer role (not merely an admin profile flag)
-- can update anti-scam state and read/write protected review history.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000004', false);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated"}', false);

do $$
begin
  if not public.current_user_can_review_domain('commune'::public.review_domain) then
    raise exception 'canonical commune_moderator role was not recognized';
  end if;

  update public.commune_job_posts
  set anti_scam_review_status = 'needs_contact_clarification',
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = 'd3000000-0000-4000-8000-000000000002';

  if not exists (
    select 1 from public.commune_job_posts
    where id = 'd3000000-0000-4000-8000-000000000002'
      and anti_scam_review_status = 'needs_contact_clarification'
  ) then
    raise exception 'canonical Commune reviewer could not update anti-scam state';
  end if;

  insert into public.review_comments (review_item_id, actor_id, body, visibility)
  values (
    'd4000000-0000-4000-8000-000000000001', auth.uid(),
    'SYNTHETIC_PRIVATE_REVIEWER_NOTE', 'internal'
  );

  if (select count(*) from public.review_comments where review_item_id = 'd4000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'canonical reviewer could not read protected reviewer notes';
  end if;
end;
$$;

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{}', false);

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
      'd3000000-0000-4000-8000-000000000006',
      'd2000000-0000-4000-8000-000000000004',
      'd1000000-0000-4000-8000-000000000001',
      'Anonymous route attempt', 'Elysia Ecobotics', 'Anonymous users must never claim the private intake.',
      2, 'future_role_interest_talent_pool', 'future_compensation_not_established', array[]::text[],
      'remote', 'other', 'other', 'business_company',
      'private_work_with', '/work-with-elysia-ecobotics',
      'other', 'must_clarify', 'remote', 'Future compensation not yet established', '/work-with-elysia-ecobotics', true
    );
    raise exception 'anonymous user inserted first-party private Work With route';
  exception when insufficient_privilege then null;
  end;
end;
$$;

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

  begin
    execute 'select private_application_note from public.commune_job_posts where id = ''d3000000-0000-4000-8000-000000000002''';
    raise exception 'anonymous reader accessed the deprecated pseudo-private Job Post note';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select reviewed_by from public.commune_job_posts where id = ''d3000000-0000-4000-8000-000000000002''';
    raise exception 'anonymous reader accessed protected review-actor metadata';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.update_own_commune_job_post_application_status(
      'd3000000-0000-4000-8000-000000000002', null, 'closed',
      'Anonymous mutation attempt.'
    );
    raise exception 'anonymous reader executed the owner lifecycle RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'job_opportunity_database_behavior_ok' as result;

-- Opportunity Commons v2 is additive. Existing Job Post rows remain model_version 1
-- and continue to use the legacy columns. New v2 rows dual-write both contracts.

begin;

alter table public.commune_job_posts
  add column model_version smallint not null default 1,
  add column opportunity_type text,
  add column opportunity_details text,
  add column compensation_status text,
  add column compensation_models text[],
  add column compensation_currency text,
  add column compensation_min_amount numeric(14,2),
  add column compensation_max_amount numeric(14,2),
  add column compensation_period text,
  add column compensation_details text,
  add column benefits_summary text,
  add column work_arrangement text,
  add column time_basis text,
  add column duration_type text,
  add column poster_type text,
  add column organization_website text,
  add column experience_level text,
  add column application_route_type text,
  add column application_destination text,
  add column application_instructions text,
  add column testing_privacy_note text,
  add column future_interest_acknowledged boolean not null default false;

alter table public.commune_job_posts
  add constraint commune_job_posts_model_version_check
    check (model_version in (1, 2)),
  add constraint commune_job_posts_opportunity_type_v2_check
    check (opportunity_type is null or opportunity_type = any (array[
      'paid_employment', 'contract_freelance', 'internship', 'apprenticeship_traineeship',
      'fellowship_funded_placement', 'research_opportunity', 'volunteer_community_service',
      'community_open_source_contribution', 'testing_feedback_call',
      'future_role_interest_talent_pool', 'other'
    ]::text[])),
  add constraint commune_job_posts_compensation_status_v2_check
    check (compensation_status is null or compensation_status = any (array[
      'paid', 'stipend_funded', 'unpaid_volunteer', 'reimbursement_only',
      'academic_credit_only', 'mixed_multiple', 'future_compensation_not_established', 'other'
    ]::text[])),
  add constraint commune_job_posts_compensation_models_v2_check
    check (compensation_models is null or (
      array_position(compensation_models, null) is null
      and compensation_models <@ array[
        'salary', 'hourly', 'fixed_project_fee', 'milestone_project_payment', 'stipend',
        'fellowship_funding', 'honorarium', 'commission', 'reimbursement_expenses',
        'academic_credit', 'unpaid_volunteer', 'other'
      ]::text[]
    )),
  add constraint commune_job_posts_work_arrangement_v2_check
    check (work_arrangement is null or work_arrangement = any (array[
      'onsite', 'remote', 'hybrid', 'field_based', 'multiple_locations',
      'flexible_varies', 'other'
    ]::text[])),
  add constraint commune_job_posts_time_basis_v2_check
    check (time_basis is null or time_basis = any (array[
      'full_time', 'part_time', 'flexible_as_needed', 'one_time_event', 'other'
    ]::text[])),
  add constraint commune_job_posts_duration_type_v2_check
    check (duration_type is null or duration_type = any (array[
      'temporary', 'seasonal', 'project_based', 'fixed_term', 'recurring', 'ongoing', 'other'
    ]::text[])),
  add constraint commune_job_posts_poster_type_v2_check
    check (poster_type is null or poster_type = any (array[
      'business_company', 'nonprofit_charity', 'government_public_agency',
      'education_research_institution', 'cooperative', 'community_organization',
      'open_source_project', 'independent_individual', 'informal_community_initiative', 'other'
    ]::text[])),
  add constraint commune_job_posts_experience_level_v2_check
    check (experience_level is null or experience_level = any (array[
      'no_experience_required', 'student', 'entry_early_career', 'experienced',
      'senior_lead', 'open_all_levels', 'other_requirements'
    ]::text[])),
  add constraint commune_job_posts_application_route_v2_check
    check (application_route_type is null or application_route_type = any (array[
      'official_application_webpage', 'organization_contact',
      'repository_contribution_instructions', 'private_work_with', 'other_legitimate'
    ]::text[])),
  add constraint commune_job_posts_compensation_period_v2_check
    check (compensation_period is null or compensation_period = any (array[
      'hour', 'day', 'week', 'month', 'year', 'project', 'milestone', 'event', 'other'
    ]::text[])),
  add constraint commune_job_posts_amounts_v2_check
    check (
      (compensation_min_amount is null or compensation_min_amount >= 0)
      and (compensation_max_amount is null or compensation_max_amount >= 0)
      and (compensation_min_amount is null or compensation_max_amount is null or compensation_max_amount >= compensation_min_amount)
    ),
  add constraint commune_job_posts_v2_text_lengths_check
    check (
      char_length(coalesce(opportunity_details, '')) <= 4000
      and char_length(coalesce(compensation_currency, '')) <= 3
      and char_length(coalesce(compensation_details, '')) <= 4000
      and char_length(coalesce(benefits_summary, '')) <= 4000
      and char_length(coalesce(organization_website, '')) <= 2000
      and char_length(coalesce(application_destination, '')) <= 2000
      and char_length(coalesce(application_instructions, '')) <= 4000
      and char_length(coalesce(testing_privacy_note, '')) <= 4000
    ),
  add constraint commune_job_posts_v2_complete_check
    check (
      model_version <> 2 or (
        opportunity_type is not null
        and compensation_status is not null
        and compensation_models is not null
        and work_arrangement is not null
        and time_basis is not null
        and duration_type is not null
        and poster_type is not null
        and application_route_type is not null
        and nullif(btrim(coalesce(role_title, '')), '') is not null
        and nullif(btrim(coalesce(organization_project, '')), '') is not null
        and nullif(btrim(coalesce(role_summary, '')), '') is not null
      )
    ),
  add constraint commune_job_posts_v2_conditional_truth_check
    check (
      model_version <> 2 or (
        (opportunity_type <> 'other' or char_length(btrim(coalesce(opportunity_details, ''))) >= 12)
        and (opportunity_type <> 'testing_feedback_call' or char_length(btrim(coalesce(testing_privacy_note, ''))) >= 12)
        and (opportunity_type <> 'future_role_interest_talent_pool' or future_interest_acknowledged)
        and (compensation_status <> 'future_compensation_not_established' or opportunity_type = 'future_role_interest_talent_pool')
        and (compensation_status <> 'unpaid_volunteer' or compensation_models = array['unpaid_volunteer']::text[])
        and (compensation_status <> 'reimbursement_only' or compensation_models = array['reimbursement_expenses']::text[])
        and (compensation_status <> 'academic_credit_only' or compensation_models = array['academic_credit']::text[])
        and (compensation_status <> 'future_compensation_not_established' or cardinality(compensation_models) = 0)
        and (compensation_status <> 'mixed_multiple' or cardinality(compensation_models) >= 2)
        and (compensation_status <> 'paid' or (
          compensation_models && array['salary','hourly','fixed_project_fee','milestone_project_payment','honorarium','commission','other']::text[]
          and compensation_models <@ array['salary','hourly','fixed_project_fee','milestone_project_payment','honorarium','commission','other']::text[]
        ))
        and (compensation_status <> 'stipend_funded' or (
          compensation_models && array['stipend','fellowship_funding']::text[]
          and compensation_models <@ array['stipend','fellowship_funding']::text[]
        ))
        and (
          not (compensation_models && array['salary','hourly','fixed_project_fee','milestone_project_payment','stipend','fellowship_funding','honorarium']::text[])
          or (
            compensation_min_amount is not null
            and compensation_min_amount > 0
            and compensation_currency is not null
            and compensation_currency ~ '^[A-Z]{3}$'
            and compensation_period is not null
          )
        )
        and (
          compensation_status not in ('mixed_multiple', 'other')
          and not (compensation_models && array['honorarium','commission','reimbursement_expenses','academic_credit','other']::text[])
          or char_length(btrim(coalesce(compensation_details, ''))) >= 8
        )
        and (
          application_route_type not in ('official_application_webpage', 'repository_contribution_instructions')
          or (
            application_destination is not null
            and application_destination ~* '^https?://[^[:space:]/?#]+\.[^[:space:]/?#]+'
            and application_destination !~* '^https?://(localhost|127\.|10\.|0\.0\.0\.0([:/]|$)|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
            and application_destination !~* '^https?://[^/[:space:]]+\.(local|internal|lan|home)([:/]|$)'
          )
        )
        and (
          application_route_type <> 'organization_contact'
          or (
            application_destination is not null
            and (
              application_destination ~* '^https?://[^[:space:]/?#]+\.[^[:space:]/?#]+'
              or application_destination ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
            )
            and application_destination !~* '^https?://(localhost|127\.|10\.|0\.0\.0\.0([:/]|$)|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
            and application_destination !~* '^https?://[^/[:space:]]+\.(local|internal|lan|home)([:/]|$)'
          )
        )
        and (
          application_route_type <> 'private_work_with'
          or (application_destination is not null and application_destination = '/work-with-elysia-ecobotics')
        )
        and (
          application_route_type <> 'other_legitimate'
          or char_length(btrim(coalesce(application_instructions, ''))) >= 12
        )
        and (
          organization_website is null
          or (
            organization_website ~* '^https?://[^[:space:]/?#]+\.[^[:space:]/?#]+'
            and organization_website !~* '^https?://(localhost|127\.|10\.|0\.0\.0\.0([:/]|$)|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
            and organization_website !~* '^https?://[^/[:space:]]+\.(local|internal|lan|home)([:/]|$)'
          )
        )
      )
    );

create index commune_job_posts_opportunity_discovery_idx
  on public.commune_job_posts (opportunity_type, compensation_status, work_arrangement)
  where model_version = 2;

-- Work With is a first-party private intake route, not a generic application
-- destination. Restrictive policies make this server-enforced for inserts and
-- updates while preserving the existing ownership/reviewer policies.
create policy "v2 private work with insert is first party only"
on public.commune_job_posts
as restrictive
for insert
to authenticated
with check (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and lower(btrim(organization_project)) in ('elysia ecobotics', 'ecosyneva', 'ecosyneva commons', 'ecosyneva commons llc')
    and application_destination = '/work-with-elysia-ecobotics'
  )
);

create policy "v2 private work with update is first party only"
on public.commune_job_posts
as restrictive
for update
to authenticated
using (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and lower(btrim(organization_project)) in ('elysia ecobotics', 'ecosyneva', 'ecosyneva commons', 'ecosyneva commons llc')
    and application_destination = '/work-with-elysia-ecobotics'
  )
)
with check (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and lower(btrim(organization_project)) in ('elysia ecobotics', 'ecosyneva', 'ecosyneva commons', 'ecosyneva commons llc')
    and application_destination = '/work-with-elysia-ecobotics'
  )
);

comment on column public.commune_job_posts.model_version is
  '1 = legacy Job Post contract; 2 = Opportunity Commons structured contract. Existing rows are not guessed or rewritten.';
comment on column public.commune_job_posts.compensation_status is
  'Mandatory affirmative v2 compensation declaration, independent of opportunity type.';
comment on column public.commune_job_posts.application_route_type is
  'Public application-route category. The private Work With value is server-limited to first-party admin posts.';
comment on column public.commune_job_posts.private_application_note is
  'Legacy public-row column. New clients must not write private review material here; internal review_comments is the protected reviewer-note path.';

commit;

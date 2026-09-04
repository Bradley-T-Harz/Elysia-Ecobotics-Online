-- Complete the established 24-badge producer, reconciliation, restore, and
-- private administrator-history boundary without changing any badge meaning.
-- Review-triggered recognition still requires an authorized human evidence
-- decision; ordinary content approval, payment, and hosted-compute use never
-- create badge credit implicitly.

begin;

-- The remote schema baseline intentionally contains no table data. Earlier
-- badge migrations therefore depended on Dashboard-era catalog rows. Make the
-- active migration chain self-contained without rewriting an existing catalog.
insert into public.badge_definitions (
  badge_key, name, description, badge_type, icon_path, category, rarity,
  sort_order, authority_linked, award_mode, rule_summary,
  is_manual_only, is_active
) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common', 1, false, 'automatic', 'Granted when a Website Account has a Commons Profile.', false, true),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', '/images/badges/Stewardship_Supporter.png', 'stewardship', 'uncommon', 2, false, 'review_triggered', 'Granted after 1 approved stewardship support verification.', false, true),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', '/images/badges/Water_Steward.png', 'water', 'uncommon', 3, false, 'review_triggered', 'Granted after 3 approved water stewardship credits or 1 major water contribution.', false, true),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', '/images/badges/Forest_Steward.png', 'forest', 'uncommon', 4, false, 'review_triggered', 'Granted after 3 approved forest stewardship credits or 1 major forest contribution.', false, true),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', '/images/badges/Reef_Steward.png', 'reef', 'uncommon', 5, false, 'review_triggered', 'Granted after 3 approved reef/ocean stewardship credits or 1 major reef contribution.', false, true),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', '/images/badges/Health_Steward.png', 'health', 'uncommon', 6, false, 'review_triggered', 'Granted after 3 approved health stewardship credits or 1 major health/public-dignity contribution.', false, true),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', '/images/badges/Knowledge_Commons_Supporter.png', 'knowledge', 'uncommon', 7, false, 'review_triggered', 'Granted after 2 approved knowledge support credits or 1 major knowledge contribution.', false, true),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', '/images/badges/Source_Curator.png', 'living-library', 'rare', 8, false, 'review_triggered', 'Granted after 3 accepted Living Library sources or 1 major source pack/curated collection.', false, true),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', '/images/badges/Troubleshooting_Helper.png', 'commune', 'rare', 9, false, 'review_triggered', 'Granted after 3 reviewed helpful troubleshooting resolutions across at least 2 distinct users.', false, true),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', '/images/badges/Developer_Contributor.png', 'developer', 'rare', 10, false, 'review_triggered', 'Granted after 1 substantial developer contribution or 3 smaller approved developer contributions.', false, true),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', '/images/badges/Founding_Steward.png', 'membership', 'epic', 11, false, 'manual_admin', 'Manual founding-era recognition only; never automatic.', true, true),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires roles assigned by administrators.', 'review', '/images/badges/Guardian_Reviewer.png', 'authority-linked', 'epic', 12, true, 'role_linked', 'Role-linked recognition only. The badge itself grants no permissions.', true, true),
  ('seed_sower', 'Seed Sower', 'Recognition for planting a first useful contribution in the public commons.', 'contributor', '/images/badges/Seed_Sower.png', 'contribution', 'common', 13, false, 'review_triggered', 'Granted after the first approved eligible contribution of any type.', false, true),
  ('bridge_builder', 'Bridge Builder', 'Recognition for helping people, projects, ideas, and resources find each other.', 'community', '/images/badges/Bridge_Builder.png', 'community', 'uncommon', 14, false, 'review_triggered', 'Granted after 5 reviewed bridge-building actions across at least 3 distinct users/projects.', false, true),
  ('archive_warden', 'Archive Warden', 'Recognition for preserving records, improving sources, checking links, and strengthening public memory.', 'archive', '/images/badges/Archive_Warden.png', 'archive', 'uncommon', 15, false, 'review_triggered', 'Granted after 5 archive/documentation maintenance contributions or 1 major archive project.', false, true),
  ('forge_tester', 'Forge Tester', 'Recognition for careful testing, bug reports, compatibility notes, and safe release feedback.', 'testing', '/images/badges/Forge_Tester.png', 'testing', 'rare', 16, false, 'review_triggered', 'Granted after 3 accepted test reports or 1 critical confirmed report that led to a fix.', false, true),
  ('field_witness', 'Field Witness', 'Recognition for public ecological observations, field evidence, maps, restoration notes, or environmental records.', 'ecology', '/images/badges/Field_Witness.png', 'fieldwork', 'rare', 17, false, 'review_triggered', 'Granted after 3 accepted field observations or 1 major field record.', false, true),
  ('radiant_scribe', 'Radiant Scribe', 'Recognition for clear writing, tutorials, research notes, guides, and public learning contributions.', 'writing', '/images/badges/Radiant_Scribe.png', 'writing', 'rare', 18, false, 'review_triggered', 'Granted after 2 substantial writing contributions, 5 smaller writing contributions, or 1 major guide/tutorial.', false, true),
  ('hearth_keeper', 'Hearth Keeper', 'Recognition for trusted moderation and care of the public Commune.', 'moderation', '/images/badges/Hearth_Keeper.png', 'authority-linked', 'epic', 19, true, 'role_linked', 'Role-linked community care recognition only. The badge itself grants no permissions.', true, true),
  ('ecobotics_forgewright', 'Ecobotics Forgewright', 'Recognition for robotics, hardware, ecological devices, and physical system contributions.', 'ecobotics', '/images/badges/Ecobotics_Forgewright.png', 'robotics', 'epic', 20, false, 'project_lead', 'Project-lead/manual recognition for meaningful robotics or physical-system contribution.', true, true),
  ('elysian_artwright', 'Elysian Artwright', 'Recognition for visual art, concept work, icons, and imagery that help give Elysia Ecobotics a living face.', 'art', '/images/badges/Elysian_Artwright.png', 'art', 'rare', 21, false, 'review_triggered', 'Granted after 1 substantial accepted art contribution or 3 smaller accepted art contributions.', false, true),
  ('kindred_ally', 'Kindred Ally', 'Recognition for helping allied people, friends, collaborators, and associated projects with care and usefulness.', 'community', '/images/badges/Kindred_Ally.png', 'allied-service', 'uncommon', 22, false, 'manual_admin', 'Manual allied-service recognition only; does not imply partnership, sponsorship, employment, endorsement, or authority.', true, true),
  ('open_pathmaker', 'Open Pathmaker', 'Recognition for making the Commons easier, clearer, and more accessible for more people.', 'accessibility', '/images/badges/Open_Pathmaker.png', 'accessibility', 'rare', 23, false, 'review_triggered', 'Granted after 3 accessibility/usability improvements or 1 major access improvement.', false, true),
  ('boundary_lantern', 'Boundary Lantern', 'Recognition for strengthening privacy, consent, safety, and ethical boundaries in the public commons.', 'safety', '/images/badges/Boundary_Lantern.png', 'privacy', 'rare', 24, false, 'review_triggered', 'Granted after 2 safety/privacy/boundary improvements or 1 major risk-prevention contribution.', false, true)
on conflict (badge_key) do nothing;

insert into public.badge_rules (
  badge_slug, rule_type, required_credit_type, required_count,
  required_credit_sum, requires_major, distinct_subject_min,
  eligible_credit_types, description, is_active
) values
  ('free_member', 'profile_completed', 'account_membership', 1, null, false, null, '{}', 'Verified Website Account plus completed Commons Profile.', true),
  ('stewardship_supporter', 'credit_count', 'stewardship_general', 1, null, false, null, '{}', 'One approved stewardship support verification.', true),
  ('water_steward', 'credit_count', 'stewardship_water', 3, null, true, null, '{}', 'Three water credits or one major water contribution.', true),
  ('forest_steward', 'credit_count', 'stewardship_forest', 3, null, true, null, '{}', 'Three forest credits or one major forest contribution.', true),
  ('reef_steward', 'credit_count', 'stewardship_reef', 3, null, true, null, '{}', 'Three reef/ocean credits or one major reef contribution.', true),
  ('health_steward', 'credit_count', 'stewardship_health', 3, null, true, null, '{}', 'Three health credits or one major health/public-dignity contribution.', true),
  ('knowledge_commons_supporter', 'credit_count', 'knowledge_support', 2, null, true, null, '{}', 'Two knowledge support credits or one major knowledge contribution.', true),
  ('source_curator', 'credit_count', 'source_curation', 3, null, true, null, '{}', 'Three accepted sources or one major source pack/curated collection.', true),
  ('troubleshooting_helper', 'credit_count', 'troubleshooting_resolution', 3, null, false, 2, '{}', 'Three reviewed troubleshooting resolutions across at least two distinct users.', true),
  ('developer_contributor', 'credit_count', 'developer_contribution', 3, null, true, null, '{}', 'Three smaller approved developer contributions or one substantial developer contribution.', true),
  ('founding_steward', 'manual_only', null, null, null, false, null, '{}', 'Manual founding-era recognition only.', true),
  ('guardian_reviewer', 'role_linked', null, null, null, false, null, '{}', 'Role-linked trust/review recognition only; no badge-derived authority.', true),
  ('seed_sower', 'first_eligible_credit', null, 1, null, false, null, array['stewardship_general','stewardship_water','stewardship_forest','stewardship_reef','stewardship_health','knowledge_support','source_curation','troubleshooting_resolution','developer_contribution','bridge_building','archive_maintenance','testing_feedback','field_observation','writing_teaching','art_contribution','accessibility_improvement','boundary_safety'], 'First approved eligible contribution of any type.', true),
  ('bridge_builder', 'credit_count', 'bridge_building', 5, null, false, 3, '{}', 'Five bridge-building actions across at least three distinct users/projects.', true),
  ('archive_warden', 'credit_count', 'archive_maintenance', 5, null, true, null, '{}', 'Five archive/documentation contributions or one major archive project.', true),
  ('forge_tester', 'credit_count', 'testing_feedback', 3, null, true, null, '{}', 'Three accepted test reports or one critical confirmed report that led to a fix.', true),
  ('field_witness', 'credit_count', 'field_observation', 3, null, true, null, '{}', 'Three accepted field observations or one major field record.', true),
  ('radiant_scribe', 'credit_sum', 'writing_teaching', null, 4, true, null, '{}', 'Two substantial writing contributions, five smaller writing contributions, or one major guide/tutorial.', true),
  ('hearth_keeper', 'role_linked', null, null, null, false, null, '{}', 'Role-linked moderation care recognition only; no badge-derived authority.', true),
  ('ecobotics_forgewright', 'manual_only', null, null, null, false, null, '{}', 'Project-lead/manual robotics or physical-system recognition.', true),
  ('elysian_artwright', 'credit_sum', 'art_contribution', null, 3, true, null, '{}', 'One substantial accepted art contribution or three smaller accepted art contributions.', true),
  ('kindred_ally', 'manual_only', null, null, null, false, null, '{}', 'Manual allied-service recognition only.', true),
  ('open_pathmaker', 'credit_count', 'accessibility_improvement', 3, null, true, null, '{}', 'Three access improvements or one major access improvement.', true),
  ('boundary_lantern', 'credit_count', 'boundary_safety', 2, null, true, null, '{}', 'Two boundary/safety improvements or one major risk-prevention contribution.', true)
on conflict do nothing;

do $badge_catalog_preflight$
begin
  if (
    select pg_catalog.count(*)
    from public.badge_definitions as definition
    where definition.badge_key = any(array[
      'free_member','stewardship_supporter','water_steward','forest_steward',
      'reef_steward','health_steward','knowledge_commons_supporter','source_curator',
      'troubleshooting_helper','developer_contributor','founding_steward','guardian_reviewer',
      'seed_sower','bridge_builder','archive_warden','forge_tester','field_witness',
      'radiant_scribe','hearth_keeper','ecobotics_forgewright','elysian_artwright',
      'kindred_ally','open_pathmaker','boundary_lantern'
    ]) and definition.is_active = true
  ) <> 24 or (
    select pg_catalog.count(*)
    from public.badge_definitions as definition
    where definition.award_mode = 'review_triggered'
      and definition.is_active = true
      and definition.badge_key = any(array[
        'stewardship_supporter','water_steward','forest_steward','reef_steward',
        'health_steward','knowledge_commons_supporter','source_curator',
        'troubleshooting_helper','developer_contributor','seed_sower','bridge_builder',
        'archive_warden','forge_tester','field_witness','radiant_scribe',
        'elysian_artwright','open_pathmaker','boundary_lantern'
      ])
  ) <> 18 or (
    select pg_catalog.count(*)
    from public.badge_rules as rule
    where rule.badge_slug = any(array[
      'free_member','stewardship_supporter','water_steward','forest_steward',
      'reef_steward','health_steward','knowledge_commons_supporter','source_curator',
      'troubleshooting_helper','developer_contributor','founding_steward','guardian_reviewer',
      'seed_sower','bridge_builder','archive_warden','forge_tester','field_witness',
      'radiant_scribe','hearth_keeper','ecobotics_forgewright','elysian_artwright',
      'kindred_ally','open_pathmaker','boundary_lantern'
    ]) and rule.is_active = true
  ) <> 24 then
    raise exception using
      errcode = '55000',
      message = 'badge_catalog_or_rule_semantics_drift_requires_read_only_reconciliation';
  end if;
end
$badge_catalog_preflight$;

do $badge_action_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.badge_audit_log'::regclass
      and constraint_record.conname = 'badge_audit_log_action_check'
      and constraint_record.contype = 'c'
  ) then
    raise exception using
      errcode = '55000',
      message = 'badge_audit_log_action_constraint_drift_requires_read_only_verification';
  end if;

  alter table public.badge_audit_log
    drop constraint badge_audit_log_action_check;
  alter table public.badge_audit_log
    add constraint badge_audit_log_action_check check (action in (
      'credit_created', 'credit_revoked', 'badge_granted', 'badge_revoked',
      'manual_grant', 'manual_revoke', 'free_member_granted',
      'rule_evaluated', 'rule_badge_revoked', 'suppression_created',
      'suppression_lifted', 'badge_restored'
    ));
end
$badge_action_constraint$;

do $badge_review_credit_preflight$
begin
  if exists (
    select 1
    from public.badge_credit_events as event
    where event.review_item_id is not null
      and event.revoked_at is null
    group by event.review_item_id, event.credit_type
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '55000',
      message = 'duplicate_active_badge_review_credits_require_read_only_reconciliation';
  end if;
end
$badge_review_credit_preflight$;

create unique index badge_credit_events_one_active_review_credit
  on public.badge_credit_events(review_item_id, credit_type)
  where review_item_id is not null and revoked_at is null;

create or replace function private.badge_credit_domain_allowed(
  p_credit_type text,
  p_domain public.review_domain
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_credit_type in (
      'stewardship_general', 'stewardship_water', 'stewardship_forest',
      'stewardship_reef', 'stewardship_health'
    ) then p_domain in ('stewardship'::public.review_domain, 'contribution'::public.review_domain)
    when p_credit_type in ('knowledge_support', 'source_curation')
      then p_domain in ('living_library_source'::public.review_domain, 'contribution'::public.review_domain)
    when p_credit_type = 'archive_maintenance'
      then p_domain in (
        'living_library_source'::public.review_domain,
        'living_library_broken_link'::public.review_domain,
        'contribution'::public.review_domain
      )
    when p_credit_type in ('developer_contribution', 'testing_feedback')
      then p_domain in ('marketplace'::public.review_domain, 'contribution'::public.review_domain)
    when p_credit_type in ('troubleshooting_resolution', 'bridge_building', 'writing_teaching')
      then p_domain in ('commune'::public.review_domain, 'contribution'::public.review_domain)
    when p_credit_type in (
      'field_observation', 'art_contribution', 'accessibility_improvement',
      'boundary_safety'
    ) then p_domain = 'contribution'::public.review_domain
    else false
  end;
$$;

alter function private.badge_credit_domain_allowed(text, public.review_domain)
  owner to postgres;
revoke all privileges on function private.badge_credit_domain_allowed(text, public.review_domain)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_can_create_badge_credit_type(
  p_credit_type text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when public.current_user_is_admin() then true
    when public.current_user_has_role('guardian_reviewer'::public.app_role) then true
    when public.current_user_has_role('reviewer'::public.app_role) then true
    when p_credit_type in ('knowledge_support', 'source_curation', 'archive_maintenance')
      then public.current_user_has_role('source_reviewer'::public.app_role)
    when p_credit_type in ('developer_contribution', 'testing_feedback')
      then public.current_user_has_role('marketplace_reviewer'::public.app_role)
    when p_credit_type in (
      'troubleshooting_resolution', 'bridge_building', 'writing_teaching',
      'boundary_safety'
    ) then public.current_user_has_role('moderator'::public.app_role)
      or public.current_user_has_role('commune_moderator'::public.app_role)
    else false
  end;
$$;

alter function public.current_user_can_create_badge_credit_type(text)
  owner to postgres;
revoke all privileges on function public.current_user_can_create_badge_credit_type(text)
  from public, anon, authenticated, service_role;

create or replace function private.badge_credit_rule_qualifies(
  p_target_user_id uuid,
  p_badge_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit_type text;
  v_required_count integer;
  v_required_sum integer;
  v_major_shortcut boolean;
  v_distinct_min integer;
  v_eligible_credit_types text[];
begin
  if p_badge_key = 'free_member' then
    return exists (
      select 1
      from public.profiles as profile
      where profile.id = p_target_user_id
        and profile.commons_onboarding_completed_at is not null
    );
  end if;

  if p_badge_key = 'seed_sower' then
    select rule.eligible_credit_types
    into v_eligible_credit_types
    from public.badge_rules as rule
    where rule.badge_slug = p_badge_key
      and rule.rule_type = 'first_eligible_credit'
      and rule.is_active = true
    order by rule.created_at, rule.id
    limit 1;

    return v_eligible_credit_types is not null and exists (
      select 1
      from public.badge_credit_events as event
      where event.user_id = p_target_user_id
        and event.credit_type = any(v_eligible_credit_types)
        and event.revoked_at is null
    );
  end if;

  select
    rule.required_credit_type,
    rule.required_count,
    rule.required_credit_sum,
    rule.requires_major,
    rule.distinct_subject_min
  into
    v_credit_type,
    v_required_count,
    v_required_sum,
    v_major_shortcut,
    v_distinct_min
  from public.badge_rules as rule
  where rule.badge_slug = p_badge_key
    and rule.rule_type in ('credit_count', 'credit_sum')
    and rule.is_active = true
  order by rule.created_at, rule.id
  limit 1;

  if v_credit_type is null then
    return false;
  end if;

  return (
    (
      v_required_count is not null
      and (
        select pg_catalog.count(*)
        from public.badge_credit_events as event
        where event.user_id = p_target_user_id
          and event.credit_type = v_credit_type
          and event.revoked_at is null
      ) >= v_required_count
    )
    or (
      v_required_sum is not null
      and (
        select coalesce(pg_catalog.sum(event.credit_amount), 0)
        from public.badge_credit_events as event
        where event.user_id = p_target_user_id
          and event.credit_type = v_credit_type
          and event.revoked_at is null
      ) >= v_required_sum
    )
    or (
      coalesce(v_major_shortcut, false)
      and exists (
        select 1
        from public.badge_credit_events as event
        where event.user_id = p_target_user_id
          and event.credit_type = v_credit_type
          and event.is_major = true
          and event.revoked_at is null
      )
    )
  ) and (
    v_distinct_min is null
    or (
      select pg_catalog.count(distinct event.distinct_subject_key)
      from public.badge_credit_events as event
      where event.user_id = p_target_user_id
        and event.credit_type = v_credit_type
        and event.revoked_at is null
        and event.distinct_subject_key is not null
    ) >= v_distinct_min
  );
end;
$$;

alter function private.badge_credit_rule_qualifies(uuid, text)
  owner to postgres;
revoke all privileges on function private.badge_credit_rule_qualifies(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.synchronize_free_member_badge(
  p_target_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit_id uuid;
  v_had_badge boolean;
begin
  if not private.badge_credit_rule_qualifies(p_target_user_id, 'free_member') then
    return;
  end if;

  select exists (
    select 1
    from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = 'free_member'
      and award.revoked_at is null
  ) into v_had_badge;

  insert into public.badge_credit_events (
    user_id, credit_type, credit_amount, contribution_type,
    contribution_id, awarded_by, is_major, notes
  ) values (
    p_target_user_id,
    'account_membership',
    1,
    'commons_profile',
    p_target_user_id,
    p_actor_user_id,
    false,
    'Free membership recognition for completed Commons onboarding.'
  )
  on conflict (user_id, credit_type, contribution_type, contribution_id)
    where contribution_id is not null and revoked_at is null
  do nothing
  returning id into v_credit_id;

  if v_credit_id is null then
    select event.id
    into v_credit_id
    from public.badge_credit_events as event
    where event.user_id = p_target_user_id
      and event.credit_type = 'account_membership'
      and event.contribution_type = 'commons_profile'
      and event.contribution_id = p_target_user_id
      and event.revoked_at is null
    order by event.awarded_at, event.id
    limit 1;
  end if;

  perform public.award_badge_if_missing(
    p_target_user_id,
    'free_member',
    'automatic',
    'Free membership recognition for completed Commons onboarding.',
    'commons_profile',
    p_target_user_id,
    p_actor_user_id
  );

  if not v_had_badge and exists (
    select 1
    from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = 'free_member'
      and award.revoked_at is null
  ) then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug,
      credit_event_id, evidence_type, evidence_id, metadata
    ) values (
      p_actor_user_id,
      p_target_user_id,
      'free_member_granted',
      'free_member',
      v_credit_id,
      'commons_profile',
      p_target_user_id,
      pg_catalog.jsonb_build_object(
        'award_source', 'automatic',
        'predicate', 'commons_onboarding_completed_at'
      )
    );
  end if;
end;
$$;

alter function private.synchronize_free_member_badge(uuid, uuid)
  owner to postgres;
revoke all privileges on function private.synchronize_free_member_badge(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.synchronize_free_member_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.synchronize_free_member_badge(new.id, auth.uid());
  return new;
end;
$$;

alter function private.synchronize_free_member_badge_trigger()
  owner to postgres;
revoke all privileges on function private.synchronize_free_member_badge_trigger()
  from public, anon, authenticated, service_role;

drop trigger if exists grant_free_member_after_completed_profile_insert on public.profiles;
create trigger grant_free_member_after_completed_profile_insert
after insert on public.profiles
for each row
when (new.commons_onboarding_completed_at is not null)
execute function private.synchronize_free_member_badge_trigger();

drop trigger if exists grant_free_member_after_completed_profile_update on public.profiles;
create trigger grant_free_member_after_completed_profile_update
after update of commons_onboarding_completed_at on public.profiles
for each row
when (old.commons_onboarding_completed_at is null and new.commons_onboarding_completed_at is not null)
execute function private.synchronize_free_member_badge_trigger();

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'free_member_authentication_required';
  end if;
  if v_actor <> p_target_user_id
     and not public.current_user_is_admin()
     and not public.current_user_can_create_badge_credit() then
    raise exception using errcode = '42501', message = 'free_member_grant_denied';
  end if;
  if not private.badge_credit_rule_qualifies(p_target_user_id, 'free_member') then
    raise exception using errcode = '23514', message = 'commons_onboarding_required_for_free_member';
  end if;
  if exists (
    select 1
    from public.badge_award_suppressions as suppression
    where suppression.user_id = p_target_user_id
      and suppression.badge_key = 'free_member'
      and suppression.lifted_at is null
  ) then
    raise exception using errcode = '42501', message = 'free_member_award_suppressed';
  end if;
  perform private.synchronize_free_member_badge(p_target_user_id, v_actor);
end;
$$;

alter function public.grant_free_member_for_user(uuid) owner to postgres;

create or replace function public.evaluate_badges_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_definition record;
  v_revoked_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'badge_evaluation_authentication_required';
  end if;
  if v_actor <> p_target_user_id and not public.current_user_can_create_badge_credit() then
    raise exception using errcode = '42501', message = 'badge_evaluation_denied';
  end if;

  if private.badge_credit_rule_qualifies(p_target_user_id, 'free_member') then
    perform private.synchronize_free_member_badge(p_target_user_id, v_actor);
  end if;

  for v_definition in
    select definition.badge_key, definition.rule_summary
    from public.badge_definitions as definition
    where definition.is_active = true
      and definition.award_mode = 'review_triggered'
    order by definition.sort_order, definition.badge_key
  loop
    if private.badge_credit_rule_qualifies(p_target_user_id, v_definition.badge_key) then
      perform public.award_badge_if_missing(
        p_target_user_id,
        v_definition.badge_key,
        'credit_rule',
        v_definition.rule_summary,
        'badge_rule',
        null,
        v_actor
      );
    else
      update public.user_badges
      set
        revoked_at = pg_catalog.now(),
        revoked_by = v_actor,
        revoked_reason = 'The authoritative badge-credit evidence no longer qualifies.',
        updated_at = pg_catalog.now()
      where user_id = p_target_user_id
        and badge_key = v_definition.badge_key
        and award_source = 'credit_rule'
        and revoked_at is null;
      get diagnostics v_revoked_count = row_count;

      if v_revoked_count > 0 then
        insert into public.badge_audit_log (
          actor_user_id, target_user_id, action, badge_slug, metadata
        ) values (
          v_actor,
          p_target_user_id,
          'rule_badge_revoked',
          v_definition.badge_key,
          pg_catalog.jsonb_build_object(
            'reason', 'authoritative_credit_no_longer_qualifies',
            'suppression_created', false
          )
        );
      end if;
    end if;
  end loop;

  insert into public.badge_audit_log (
    actor_user_id, target_user_id, action, metadata
  ) values (
    v_actor,
    p_target_user_id,
    'rule_evaluated',
    pg_catalog.jsonb_build_object('source', 'evaluate_badges_for_user')
  );
end;
$$;

alter function public.evaluate_badges_for_user(uuid) owner to postgres;

create or replace function public.create_badge_credit_event(
  p_target_user_id uuid,
  p_credit_type text,
  p_credit_amount integer,
  p_contribution_type text,
  p_contribution_id uuid default null,
  p_review_item_id uuid default null,
  p_is_major boolean default false,
  p_distinct_subject_key text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_created_id uuid;
  v_review public.review_items%rowtype;
  v_is_admin boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'badge_credit_authentication_required';
  end if;
  v_is_admin := public.current_user_is_admin();
  if not public.current_user_can_create_badge_credit_type(p_credit_type) then
    raise exception using errcode = '42501', message = 'badge_credit_type_authority_denied';
  end if;
  if p_target_user_id = v_actor then
    raise exception using errcode = '42501', message = 'badge_credit_self_award_denied';
  end if;
  if p_credit_type is null or p_credit_type = 'account_membership' then
    raise exception using errcode = '22023', message = 'badge_credit_type_invalid';
  end if;
  if p_credit_amount is null or p_credit_amount not between 1 and 2 then
    raise exception using errcode = '22023', message = 'badge_credit_amount_invalid';
  end if;
  if p_contribution_id is null then
    raise exception using errcode = '22023', message = 'badge_credit_evidence_id_required';
  end if;
  if p_contribution_type is null
     or p_contribution_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception using errcode = '22023', message = 'badge_credit_evidence_type_invalid';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_notes, '')), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_notes)) > 2000 then
    raise exception using errcode = '22023', message = 'badge_credit_review_note_invalid';
  end if;
  if p_distinct_subject_key is not null and (
    nullif(pg_catalog.btrim(p_distinct_subject_key), '') is null
    or pg_catalog.length(pg_catalog.btrim(p_distinct_subject_key)) > 200
  ) then
    raise exception using errcode = '22023', message = 'badge_credit_subject_key_invalid';
  end if;
  if not exists (
    select 1
    from auth.users as account
    join public.profiles as profile on profile.id = account.id
    where account.id = p_target_user_id
      and account.deleted_at is null
      and coalesce(account.is_anonymous, false) = false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
      and profile.commons_onboarding_completed_at is not null
  ) then
    raise exception using errcode = '23514', message = 'badge_credit_active_commons_profile_required';
  end if;

  if p_review_item_id is not null then
    select item.*
    into v_review
    from public.review_items as item
    where item.id = p_review_item_id;

    if not found
       or v_review.status <> 'approved'::public.review_status
       or v_review.submitted_by is distinct from p_target_user_id
       or v_review.source_id is distinct from p_contribution_id
       or v_review.source_table is distinct from p_contribution_type
       or not private.badge_credit_domain_allowed(p_credit_type, v_review.domain) then
      raise exception using errcode = '23514', message = 'badge_credit_review_evidence_invalid';
    end if;
    if not v_is_admin and not public.current_user_can_review_domain(v_review.domain) then
      raise exception using errcode = '42501', message = 'badge_credit_review_domain_denied';
    end if;
  elsif not v_is_admin then
    raise exception using errcode = '42501', message = 'badge_credit_approved_review_item_required';
  end if;

  insert into public.badge_credit_events (
    user_id, credit_type, credit_amount, contribution_type,
    contribution_id, review_item_id, awarded_by, is_major,
    distinct_subject_key, notes
  ) values (
    p_target_user_id,
    p_credit_type,
    p_credit_amount,
    p_contribution_type,
    p_contribution_id,
    p_review_item_id,
    v_actor,
    coalesce(p_is_major, false),
    nullif(pg_catalog.btrim(coalesce(p_distinct_subject_key, '')), ''),
    pg_catalog.left(pg_catalog.btrim(p_notes), 2000)
  )
  on conflict (user_id, credit_type, contribution_type, contribution_id)
    where contribution_id is not null and revoked_at is null
  do nothing
  returning id into v_created_id;

  if v_created_id is null then
    select event.id
    into v_created_id
    from public.badge_credit_events as event
    where event.user_id = p_target_user_id
      and event.credit_type = p_credit_type
      and event.contribution_type = p_contribution_type
      and event.contribution_id = p_contribution_id
      and event.revoked_at is null
    order by event.awarded_at, event.id
    limit 1;
  else
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, credit_event_id,
      evidence_type, evidence_id, metadata
    ) values (
      v_actor,
      p_target_user_id,
      'credit_created',
      v_created_id,
      p_contribution_type,
      p_contribution_id,
      pg_catalog.jsonb_build_object(
        'credit_type', p_credit_type,
        'credit_amount', p_credit_amount,
        'is_major', coalesce(p_is_major, false),
        'review_item_id', p_review_item_id
      )
    );
  end if;

  perform public.evaluate_badges_for_user(p_target_user_id);
  return v_created_id;
end;
$$;

alter function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text)
  owner to postgres;

create or replace function public.grant_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_award_reason text default null,
  p_evidence_type text default null,
  p_evidence_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_manual_grant_denied';
  end if;
  if p_target_user_id = v_actor then
    raise exception using errcode = '42501', message = 'badge_manual_self_grant_denied';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_award_reason, '')), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_award_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'badge_manual_grant_reason_invalid';
  end if;
  if p_evidence_type is not null and p_evidence_type !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception using errcode = '22023', message = 'badge_manual_evidence_type_invalid';
  end if;
  if not exists (
    select 1 from public.badge_definitions as definition
    where definition.badge_key = p_badge_key and definition.is_active = true
  ) then
    raise exception using errcode = '22023', message = 'badge_definition_inactive_or_missing';
  end if;
  if exists (
    select 1 from public.badge_award_suppressions as suppression
    where suppression.user_id = p_target_user_id
      and suppression.badge_key = p_badge_key
      and suppression.lifted_at is null
  ) then
    raise exception using errcode = '55000', message = 'badge_award_suppressed_restore_required';
  end if;
  if exists (
    select 1 from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = p_badge_key
      and award.revoked_at is null
  ) then
    raise exception using errcode = '23505', message = 'active_badge_award_already_exists';
  end if;

  perform public.award_badge_if_missing(
    p_target_user_id,
    p_badge_key,
    'manual_admin',
    pg_catalog.left(pg_catalog.btrim(p_award_reason), 2000),
    p_evidence_type,
    p_evidence_id,
    v_actor
  );

  insert into public.badge_audit_log (
    actor_user_id, target_user_id, action, badge_slug,
    evidence_type, evidence_id, metadata
  ) values (
    v_actor,
    p_target_user_id,
    'manual_grant',
    p_badge_key,
    p_evidence_type,
    p_evidence_id,
    pg_catalog.jsonb_build_object(
      'award_reason', pg_catalog.left(pg_catalog.btrim(p_award_reason), 2000)
    )
  );
end;
$$;

alter function public.grant_user_badge(uuid, text, text, text, uuid)
  owner to postgres;

create or replace function public.revoke_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_revocation_denied';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_revoked_reason, '')), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_revoked_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'badge_revocation_reason_invalid';
  end if;

  update public.user_badges
  set
    revoked_at = pg_catalog.now(),
    revoked_by = v_actor,
    revoked_reason = pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000),
    updated_at = pg_catalog.now()
  where user_id = p_target_user_id
    and badge_key = p_badge_key
    and revoked_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'active_badge_award_not_found';
  end if;

  insert into public.badge_award_suppressions (
    user_id, badge_key, suppressed_by, reason
  ) values (
    p_target_user_id,
    p_badge_key,
    v_actor,
    pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000)
  )
  on conflict (user_id, badge_key) where lifted_at is null
  do nothing;

  insert into public.badge_audit_log (
    actor_user_id, target_user_id, action, badge_slug, metadata
  ) values
  (
    v_actor,
    p_target_user_id,
    'badge_revoked',
    p_badge_key,
    pg_catalog.jsonb_build_object(
      'revoked_reason', pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000),
      'durably_suppressed', true
    )
  ),
  (
    v_actor,
    p_target_user_id,
    'suppression_created',
    p_badge_key,
    pg_catalog.jsonb_build_object(
      'reason', pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000),
      'prevents_automatic_reaward', true
    )
  );
end;
$$;

alter function public.revoke_user_badge(uuid, text, text)
  owner to postgres;

create or replace function public.revoke_badge_credit_event(
  p_credit_event_id uuid,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target_user_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_credit_revocation_denied';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_revoked_reason, '')), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_revoked_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'badge_credit_revocation_reason_invalid';
  end if;

  update public.badge_credit_events
  set
    revoked_at = pg_catalog.now(),
    revoked_by = v_actor,
    revoked_reason = pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000)
  where id = p_credit_event_id
    and revoked_at is null
  returning user_id into v_target_user_id;

  if v_target_user_id is null then
    raise exception using errcode = 'P0002', message = 'active_badge_credit_not_found';
  end if;

  insert into public.badge_audit_log (
    actor_user_id, target_user_id, action, credit_event_id, metadata
  ) values (
    v_actor,
    v_target_user_id,
    'credit_revoked',
    p_credit_event_id,
    pg_catalog.jsonb_build_object(
      'revoked_reason', pg_catalog.left(pg_catalog.btrim(p_revoked_reason), 2000)
    )
  );
  perform public.evaluate_badges_for_user(v_target_user_id);
end;
$$;

alter function public.revoke_badge_credit_event(uuid, text)
  owner to postgres;

create or replace function public.restore_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_restore_reason text,
  p_manual_override boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_manual_only boolean;
  v_restored boolean;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_restore_denied';
  end if;
  if p_target_user_id = v_actor then
    raise exception using errcode = '42501', message = 'badge_restore_self_action_denied';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_restore_reason, '')), '') is null
     or pg_catalog.length(pg_catalog.btrim(p_restore_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'badge_restore_reason_invalid';
  end if;

  select definition.is_manual_only
  into v_manual_only
  from public.badge_definitions as definition
  where definition.badge_key = p_badge_key
    and definition.is_active = true;
  if not found then
    raise exception using errcode = '22023', message = 'badge_definition_inactive_or_missing';
  end if;

  perform public.lift_user_badge_suppression(
    p_target_user_id,
    p_badge_key,
    pg_catalog.left(pg_catalog.btrim(p_restore_reason), 2000)
  );

  if v_manual_only or coalesce(p_manual_override, false) then
    perform public.award_badge_if_missing(
      p_target_user_id,
      p_badge_key,
      'manual_admin_restore',
      pg_catalog.left(pg_catalog.btrim(p_restore_reason), 2000),
      'badge_restore_review',
      null,
      v_actor
    );
  else
    perform public.evaluate_badges_for_user(p_target_user_id);
  end if;

  select exists (
    select 1
    from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = p_badge_key
      and award.revoked_at is null
  ) into v_restored;

  if v_restored then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug, metadata
    ) values (
      v_actor,
      p_target_user_id,
      'badge_restored',
      p_badge_key,
      pg_catalog.jsonb_build_object(
        'restore_reason', pg_catalog.left(pg_catalog.btrim(p_restore_reason), 2000),
        'manual_override', coalesce(p_manual_override, false),
        'manual_only_definition', v_manual_only
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'targetUserId', p_target_user_id,
    'badgeKey', p_badge_key,
    'suppressionLifted', true,
    'restored', v_restored,
    'manualOverride', coalesce(p_manual_override, false) or v_manual_only
  );
end;
$$;

alter function public.restore_user_badge(uuid, text, text, boolean)
  owner to postgres;

create or replace function public.badge_administration_timeline(
  p_target_user_id uuid,
  p_badge_key text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_timeline_denied';
  end if;
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception using errcode = '22023', message = 'badge_timeline_limit_invalid';
  end if;
  if p_badge_key is not null and p_badge_key !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception using errcode = '22023', message = 'badge_timeline_key_invalid';
  end if;

  return pg_catalog.jsonb_build_object(
    'targetUserId', p_target_user_id,
    'badgeKey', p_badge_key,
    'awards', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_record) order by row_record.awarded_at desc, row_record.id desc)
      from (
        select
          award.id, award.badge_key, award.awarded_at, award.awarded_by,
          award.award_source, award.award_reason, award.evidence_type,
          award.evidence_id, award.visibility, award.revoked_at,
          award.revoked_by, award.revoked_reason, award.created_at,
          award.updated_at
        from public.user_badges as award
        where award.user_id = p_target_user_id
          and (p_badge_key is null or award.badge_key = p_badge_key)
        order by award.awarded_at desc, award.id desc
        limit p_limit
      ) as row_record
    ), '[]'::jsonb),
    'credits', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_record) order by row_record.awarded_at desc, row_record.id desc)
      from (
        select
          event.id, event.credit_type, event.credit_amount,
          event.contribution_type, event.contribution_id,
          event.review_item_id, event.awarded_by, event.awarded_at,
          event.is_major, event.distinct_subject_key, event.notes,
          event.revoked_at, event.revoked_by, event.revoked_reason
        from public.badge_credit_events as event
        where event.user_id = p_target_user_id
          and (
            p_badge_key is null
            or (p_badge_key = 'free_member' and event.credit_type = 'account_membership')
            or (
              p_badge_key = 'seed_sower'
              and event.credit_type <> 'account_membership'
            )
            or event.credit_type in (
              select rule.required_credit_type
              from public.badge_rules as rule
              where rule.badge_slug = p_badge_key
                and rule.required_credit_type is not null
            )
          )
        order by event.awarded_at desc, event.id desc
        limit p_limit
      ) as row_record
    ), '[]'::jsonb),
    'suppressions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_record) order by row_record.suppressed_at desc, row_record.id desc)
      from (
        select
          suppression.id, suppression.badge_key, suppression.suppressed_by,
          suppression.suppressed_at, suppression.reason,
          suppression.lifted_by, suppression.lifted_at,
          suppression.lift_reason
        from public.badge_award_suppressions as suppression
        where suppression.user_id = p_target_user_id
          and (p_badge_key is null or suppression.badge_key = p_badge_key)
        order by suppression.suppressed_at desc, suppression.id desc
        limit p_limit
      ) as row_record
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(row_record) order by row_record.created_at desc, row_record.id desc)
      from (
        select
          audit.id, audit.actor_user_id, audit.action, audit.badge_slug,
          audit.credit_event_id, audit.evidence_type, audit.evidence_id,
          audit.metadata, audit.created_at
        from public.badge_audit_log as audit
        where audit.target_user_id = p_target_user_id
          and (
            p_badge_key is null
            or audit.badge_slug = p_badge_key
            or audit.credit_event_id in (
              select event.id
              from public.badge_credit_events as event
              where event.user_id = p_target_user_id
                and (
                  (p_badge_key = 'free_member' and event.credit_type = 'account_membership')
                  or (p_badge_key = 'seed_sower' and event.credit_type <> 'account_membership')
                  or event.credit_type in (
                    select rule.required_credit_type
                    from public.badge_rules as rule
                    where rule.badge_slug = p_badge_key
                      and rule.required_credit_type is not null
                  )
                )
            )
          )
        order by audit.created_at desc, audit.id desc
        limit p_limit
      ) as row_record
    ), '[]'::jsonb)
  );
end;
$$;

alter function public.badge_administration_timeline(uuid, text, integer)
  owner to postgres;

revoke all privileges on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.evaluate_badges_for_user(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.grant_free_member_for_user(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.grant_user_badge(uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.revoke_badge_credit_event(uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.revoke_user_badge(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.restore_user_badge(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.badge_administration_timeline(uuid, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text)
  to authenticated;
grant execute on function public.evaluate_badges_for_user(uuid) to authenticated;
grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.grant_user_badge(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.revoke_badge_credit_event(uuid, text) to authenticated;
grant execute on function public.revoke_user_badge(uuid, text, text) to authenticated;
grant execute on function public.restore_user_badge(uuid, text, text, boolean) to authenticated;
grant execute on function public.badge_administration_timeline(uuid, text, integer) to authenticated;

comment on function public.current_user_can_create_badge_credit_type(text) is
  'Internal type-scoped reviewer authority predicate. Badges themselves never grant this authority.';
comment on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text) is
  'Records an idempotent reviewed contribution with required evidence. Non-admin reviewers must bind an approved review item in their authorized domain.';
comment on function public.restore_user_badge(uuid, text, text, boolean) is
  'Administrator-only audited suppression lift and rule re-evaluation or explicit manual override; it grants no role or permission.';
comment on function public.badge_administration_timeline(uuid, text, integer) is
  'Administrator-only bounded private award, credit, suppression, and audit history for one target account.';

commit;

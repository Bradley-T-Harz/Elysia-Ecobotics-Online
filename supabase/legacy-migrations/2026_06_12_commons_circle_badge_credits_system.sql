-- Commons Circle badge credits and earned-only badge awards.
-- Badges are recognition, not authority. Credits are typed evidence, not currency.

create extension if not exists pgcrypto;

alter table public.badge_definitions
  add column if not exists sort_order integer,
  add column if not exists authority_linked boolean not null default false,
  add column if not exists award_mode text,
  add column if not exists rule_summary text,
  add column if not exists is_manual_only boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.badge_definitions drop constraint if exists badge_definitions_award_mode_check;
alter table public.badge_definitions
  add constraint badge_definitions_award_mode_check
  check (award_mode is null or award_mode in ('automatic','review_triggered','manual_admin','role_linked','project_lead'));

alter table public.user_badges
  add column if not exists award_source text,
  add column if not exists evidence_type text,
  add column if not exists evidence_id uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id),
  add column if not exists revoked_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_badges set visibility = 'private' where visibility = 'hidden';
alter table public.user_badges drop constraint if exists user_badges_visibility_check;
alter table public.user_badges
  add constraint user_badges_visibility_check check (visibility in ('public','private'));
alter table public.user_badges drop constraint if exists user_badges_user_id_badge_key_key;
create unique index if not exists user_badges_one_active_badge on public.user_badges(user_id, badge_key) where revoked_at is null;
create index if not exists user_badges_user_active_idx on public.user_badges(user_id, revoked_at, visibility);

create table if not exists public.badge_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_type text not null,
  credit_amount integer not null default 1,
  contribution_type text not null,
  contribution_id uuid,
  review_item_id uuid references public.review_items(id) on delete set null,
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  is_major boolean not null default false,
  distinct_subject_key text,
  notes text,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_reason text,
  check (credit_amount between 1 and 2),
  check (credit_type in (
    'account_membership',
    'stewardship_general',
    'stewardship_water',
    'stewardship_forest',
    'stewardship_reef',
    'stewardship_health',
    'knowledge_support',
    'source_curation',
    'troubleshooting_resolution',
    'developer_contribution',
    'bridge_building',
    'archive_maintenance',
    'testing_feedback',
    'field_observation',
    'writing_teaching',
    'art_contribution',
    'accessibility_improvement',
    'boundary_safety'
  ))
);

create index if not exists badge_credit_events_user_type_idx on public.badge_credit_events(user_id, credit_type, revoked_at);
create index if not exists badge_credit_events_review_idx on public.badge_credit_events(review_item_id);
create unique index if not exists badge_credit_events_one_active_contribution_credit
  on public.badge_credit_events(user_id, credit_type, contribution_type, contribution_id)
  where contribution_id is not null and revoked_at is null;

create table if not exists public.badge_rules (
  id uuid primary key default gen_random_uuid(),
  badge_slug text not null references public.badge_definitions(badge_key) on delete cascade,
  rule_type text not null,
  required_credit_type text,
  required_count integer,
  required_credit_sum integer,
  requires_major boolean not null default false,
  distinct_subject_min integer,
  eligible_credit_types text[] default '{}',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rule_type in ('profile_completed','credit_count','credit_sum','first_eligible_credit','manual_only','role_linked'))
);

create table if not exists public.badge_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  badge_slug text references public.badge_definitions(badge_key),
  credit_event_id uuid references public.badge_credit_events(id) on delete set null,
  evidence_type text,
  evidence_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (action in ('credit_created','credit_revoked','badge_granted','badge_revoked','manual_grant','manual_revoke','free_member_granted','rule_evaluated'))
);

create index if not exists badge_audit_log_target_idx on public.badge_audit_log(target_user_id, created_at desc);
create index if not exists badge_audit_log_badge_idx on public.badge_audit_log(badge_slug, created_at desc);

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common', 1, false, 'automatic', 'Granted when a verified Website Account has a Commons Profile.', false, true),
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
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  badge_type = excluded.badge_type,
  icon_path = excluded.icon_path,
  category = excluded.category,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order,
  authority_linked = excluded.authority_linked,
  award_mode = excluded.award_mode,
  rule_summary = excluded.rule_summary,
  is_manual_only = excluded.is_manual_only,
  is_active = true,
  updated_at = now();

delete from public.badge_rules where badge_slug in (
  'free_member','stewardship_supporter','water_steward','forest_steward','reef_steward','health_steward',
  'knowledge_commons_supporter','source_curator','troubleshooting_helper','developer_contributor','founding_steward',
  'guardian_reviewer','seed_sower','bridge_builder','archive_warden','forge_tester','field_witness','radiant_scribe',
  'hearth_keeper','ecobotics_forgewright','elysian_artwright','kindred_ally','open_pathmaker','boundary_lantern'
);

insert into public.badge_rules (badge_slug, rule_type, required_credit_type, required_count, required_credit_sum, requires_major, distinct_subject_min, eligible_credit_types, description, is_active) values
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
;

create unique index if not exists badge_rules_one_active_rule on public.badge_rules(badge_slug, rule_type, coalesce(required_credit_type, '')) where is_active = true;

create or replace function public.current_user_can_create_badge_credit()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_is_admin()
    or public.current_user_has_role('reviewer'::public.app_role)
    or public.current_user_has_role('guardian_reviewer'::public.app_role)
    or public.current_user_has_role('source_reviewer'::public.app_role)
    or public.current_user_has_role('marketplace_reviewer'::public.app_role)
    or public.current_user_has_role('moderator'::public.app_role)
    or public.current_user_has_role('commune_moderator'::public.app_role);
$$;

create or replace function public.award_badge_if_missing(
  p_target_user_id uuid,
  p_badge_key text,
  p_award_source text,
  p_award_reason text default null,
  p_evidence_type text default null,
  p_evidence_id uuid default null,
  p_actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.badge_definitions where badge_key = p_badge_key and is_active = true) then
    return;
  end if;

  insert into public.user_badges (user_id, badge_key, awarded_by, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, p_badge_key, p_actor_user_id, p_award_source, p_award_reason, p_evidence_type, p_evidence_id, 'public'
  where not exists (
    select 1 from public.user_badges ub
    where ub.user_id = p_target_user_id and ub.badge_key = p_badge_key and ub.revoked_at is null
  );

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (p_actor_user_id, p_target_user_id, 'badge_granted', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_source', p_award_source, 'award_reason', p_award_reason));
end;
$$;

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_is_admin() then
    raise exception 'Only the profile owner or an administrator can initialize Free Member recognition.';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Commons Profile is required before Free Member recognition.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, is_major, notes)
  select p_target_user_id, 'account_membership', 1, 'commons_profile', p_target_user_id, actor, false, 'Commons Profile completed.'
  where not exists (
    select 1 from public.badge_credit_events bce
    where bce.user_id = p_target_user_id
      and bce.credit_type = 'account_membership'
      and bce.contribution_type = 'commons_profile'
      and bce.contribution_id = p_target_user_id
      and bce.revoked_at is null
  );

  perform public.award_badge_if_missing(p_target_user_id, 'free_member', 'automatic', 'Commons Profile completed.', 'commons_profile', p_target_user_id, actor);
  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id)
  values (actor, p_target_user_id, 'free_member_granted', 'free_member', 'commons_profile', p_target_user_id);
end;
$$;

create or replace function public.evaluate_badges_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  credit record;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_can_create_badge_credit() then
    raise exception 'Badge evaluation is limited to the profile owner or authorized reviewers.';
  end if;

  if exists (select 1 from public.profiles where id = p_target_user_id) then
    perform public.award_badge_if_missing(p_target_user_id, 'free_member', 'automatic', 'Commons Profile completed.', 'commons_profile', p_target_user_id, actor);
  end if;

  if exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and revoked_at is null and credit_type <> 'account_membership') then
    perform public.award_badge_if_missing(p_target_user_id, 'seed_sower', 'credit_rule', 'First approved contribution recorded.', 'badge_rule', null, actor);
  end if;

  for credit in select * from (values
    ('stewardship_supporter','stewardship_general',1,null::integer,false,null::integer,'Approved stewardship support verification.'),
    ('water_steward','stewardship_water',3,null::integer,true,null::integer,'Approved water stewardship credits.'),
    ('forest_steward','stewardship_forest',3,null::integer,true,null::integer,'Approved forest stewardship credits.'),
    ('reef_steward','stewardship_reef',3,null::integer,true,null::integer,'Approved reef/ocean stewardship credits.'),
    ('health_steward','stewardship_health',3,null::integer,true,null::integer,'Approved health stewardship credits.'),
    ('knowledge_commons_supporter','knowledge_support',2,null::integer,true,null::integer,'Approved knowledge commons support credits.'),
    ('source_curator','source_curation',3,null::integer,true,null::integer,'Accepted Living Library source curation credits.'),
    ('troubleshooting_helper','troubleshooting_resolution',3,null::integer,false,2,'Reviewed helpful troubleshooting resolutions.'),
    ('developer_contributor','developer_contribution',3,null::integer,true,null::integer,'Approved developer contribution credits.'),
    ('bridge_builder','bridge_building',5,null::integer,false,3,'Reviewed bridge-building credits.'),
    ('archive_warden','archive_maintenance',5,null::integer,true,null::integer,'Approved archive and documentation maintenance credits.'),
    ('forge_tester','testing_feedback',3,null::integer,true,null::integer,'Accepted testing and release feedback credits.'),
    ('field_witness','field_observation',3,null::integer,true,null::integer,'Accepted field observation credits.'),
    ('radiant_scribe','writing_teaching',null::integer,4,true,null::integer,'Approved writing and teaching credits.'),
    ('elysian_artwright','art_contribution',null::integer,3,true,null::integer,'Accepted art contribution credits.'),
    ('open_pathmaker','accessibility_improvement',3,null::integer,true,null::integer,'Approved accessibility and usability improvement credits.'),
    ('boundary_lantern','boundary_safety',2,null::integer,true,null::integer,'Approved privacy, consent, safety, or boundary improvement credits.')
  ) as rule(badge_key, credit_type, required_count, required_sum, major_shortcut, distinct_min, reason) loop
    if (
      (credit.required_count is not null and (select count(*) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_count)
      or (credit.required_sum is not null and (select coalesce(sum(credit_amount), 0) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_sum)
      or (credit.major_shortcut and exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and is_major = true and revoked_at is null))
    ) and (
      credit.distinct_min is null
      or (select count(distinct distinct_subject_key) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null and distinct_subject_key is not null) >= credit.distinct_min
    ) then
      perform public.award_badge_if_missing(p_target_user_id, credit.badge_key, 'credit_rule', credit.reason, 'badge_rule', null, actor);
    end if;
  end loop;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, metadata)
  values (actor, p_target_user_id, 'rule_evaluated', jsonb_build_object('source', 'evaluate_badges_for_user'));
end;
$$;

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
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  created_id uuid;
begin
  if actor is null or not public.current_user_can_create_badge_credit() then
    raise exception 'Only authorized reviewers or administrators can create badge credits.';
  end if;
  if p_target_user_id = actor and not public.current_user_is_admin() then
    raise exception 'Reviewers cannot award badge credits to themselves.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, review_item_id, awarded_by, is_major, distinct_subject_key, notes)
  values (p_target_user_id, p_credit_type, greatest(1, least(coalesce(p_credit_amount, 1), 2)), p_contribution_type, p_contribution_id, p_review_item_id, actor, coalesce(p_is_major, false), p_distinct_subject_key, p_notes)
  returning id into created_id;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'credit_created', created_id, p_contribution_type, p_contribution_id, jsonb_build_object('credit_type', p_credit_type, 'credit_amount', p_credit_amount, 'is_major', p_is_major));

  perform public.evaluate_badges_for_user(p_target_user_id);
  return created_id;
end;
$$;

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
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can manually grant badges.';
  end if;
  if p_target_user_id = actor then
    raise exception 'Administrators should not manually grant badges to themselves through the public client.';
  end if;

  perform public.award_badge_if_missing(p_target_user_id, p_badge_key, 'manual_admin', p_award_reason, p_evidence_type, p_evidence_id, actor);
  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'manual_grant', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_reason', p_award_reason));
end;
$$;

create or replace function public.revoke_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badges.';
  end if;

  update public.user_badges
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason, updated_at = now()
  where user_id = p_target_user_id and badge_key = p_badge_key and revoked_at is null;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, metadata)
  values (actor, p_target_user_id, 'badge_revoked', p_badge_key, jsonb_build_object('revoked_reason', p_revoked_reason));
end;
$$;

create or replace function public.revoke_badge_credit_event(
  p_credit_event_id uuid,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badge credits.';
  end if;

  update public.badge_credit_events
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason
  where id = p_credit_event_id and revoked_at is null
  returning user_id into target_id;

  if target_id is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, metadata)
    values (actor, target_id, 'credit_revoked', p_credit_event_id, jsonb_build_object('revoked_reason', p_revoked_reason));
    perform public.evaluate_badges_for_user(target_id);
  end if;
end;
$$;

create or replace function public.backfill_free_member_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  granted_count integer := 0;
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    raise exception 'Only administrators can backfill Free Member badges.';
  end if;

  for profile_row in select id from public.profiles loop
    perform public.award_badge_if_missing(profile_row.id, 'free_member', 'automatic_backfill', 'Existing Commons Profile backfill.', 'commons_profile', profile_row.id, auth.uid());
    insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, notes)
    select profile_row.id, 'account_membership', 1, 'commons_profile', profile_row.id, auth.uid(), 'Existing Commons Profile backfill.'
    where not exists (
      select 1 from public.badge_credit_events bce
      where bce.user_id = profile_row.id
        and bce.credit_type = 'account_membership'
        and bce.contribution_type = 'commons_profile'
        and bce.contribution_id = profile_row.id
        and bce.revoked_at is null
    );
    granted_count := granted_count + 1;
  end loop;
  return granted_count;
end;
$$;

select public.backfill_free_member_badges();

alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;
alter table public.badge_credit_events enable row level security;
alter table public.badge_rules enable row level security;
alter table public.badge_audit_log enable row level security;

drop policy if exists "public reads active badge definitions" on public.badge_definitions;
create policy "public reads active badge definitions" on public.badge_definitions for select using (is_active = true);
drop policy if exists "admins manage badge definitions" on public.badge_definitions;
create policy "admins manage badge definitions" on public.badge_definitions for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public reads visible user badges" on public.user_badges;
create policy "public reads visible user badges" on public.user_badges for select using (visibility = 'public' and revoked_at is null);
drop policy if exists "users read own badges" on public.user_badges;
create policy "users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid() and revoked_at is null);
drop policy if exists "users update own badge visibility" on public.user_badges;
create policy "users update own badge visibility" on public.user_badges for update to authenticated using (user_id = auth.uid() and revoked_at is null) with check (user_id = auth.uid() and revoked_at is null);
drop policy if exists "admins award badges" on public.user_badges;
drop policy if exists "admins manage badges" on public.user_badges;
create policy "admins read all user badges" on public.user_badges for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());

drop policy if exists "reviewers read badge credit events" on public.badge_credit_events;
create policy "reviewers read badge credit events" on public.badge_credit_events for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());
drop policy if exists "reviewers read badge rules" on public.badge_rules;
create policy "reviewers read badge rules" on public.badge_rules for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());
drop policy if exists "admins manage badge rules" on public.badge_rules;
create policy "admins manage badge rules" on public.badge_rules for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "reviewers read badge audit log" on public.badge_audit_log;
create policy "reviewers read badge audit log" on public.badge_audit_log for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());

revoke all on table public.user_badges from anon, authenticated;
grant select on table public.user_badges to anon, authenticated;
grant update(visibility, updated_at) on table public.user_badges to authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select on table public.badge_credit_events to authenticated;
grant select on table public.badge_rules to authenticated;
grant select on table public.badge_audit_log to authenticated;

revoke all on function public.award_badge_if_missing(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.current_user_can_create_badge_credit() to authenticated;
grant execute on function public.evaluate_badges_for_user(uuid) to authenticated;
grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text) to authenticated;
grant execute on function public.grant_user_badge(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.revoke_user_badge(uuid, text, text) to authenticated;
grant execute on function public.revoke_badge_credit_event(uuid, text) to authenticated;
grant execute on function public.backfill_free_member_badges() to authenticated;

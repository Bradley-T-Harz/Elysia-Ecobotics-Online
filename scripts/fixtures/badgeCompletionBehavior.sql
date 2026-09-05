begin;

insert into auth.users (
  id, email, created_at, updated_at, email_confirmed_at,
  is_anonymous, deleted_at, banned_until
) values
  ('ee100000-0000-4000-8000-000000000001', 'badge-admin@example.invalid', now(), now(), now(), false, null, null),
  ('ee200000-0000-4000-8000-000000000002', 'badge-reviewer@example.invalid', now(), now(), now(), false, null, null),
  ('ee300000-0000-4000-8000-000000000003', 'badge-target@example.invalid', now(), now(), now(), false, null, null),
  ('ee400000-0000-4000-8000-000000000004', 'badge-onboarding@example.invalid', now(), now(), now(), false, null, null)
on conflict (id) do update set
  deleted_at = null,
  banned_until = null,
  is_anonymous = false;

insert into public.profiles (
  id, username, display_name, commons_onboarding_completed_at, is_admin
) values
  ('ee100000-0000-4000-8000-000000000001', 'badge-admin-fixture', 'Badge Admin Fixture', now(), true),
  ('ee200000-0000-4000-8000-000000000002', 'badge-reviewer-fixture', 'Badge Reviewer Fixture', now(), false),
  ('ee300000-0000-4000-8000-000000000003', 'badge-target-fixture', 'Badge Target Fixture', now(), false),
  ('ee400000-0000-4000-8000-000000000004', 'badge-onboarding-fixture', 'Badge Onboarding Fixture', null, false)
on conflict (id) do update set
  commons_onboarding_completed_at = excluded.commons_onboarding_completed_at,
  is_admin = excluded.is_admin;

insert into public.user_roles (user_id, role, granted_by, reason) values
  ('ee100000-0000-4000-8000-000000000001', 'administrator', null, 'Disposable badge administrator fixture.'),
  ('ee200000-0000-4000-8000-000000000002', 'source_reviewer', 'ee100000-0000-4000-8000-000000000001', 'Disposable badge reviewer fixture.')
on conflict do nothing;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'ee400000-0000-4000-8000-000000000004',
  false
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ee400000-0000-4000-8000-000000000004","role":"authenticated"}',
  false
);

update public.profiles
set commons_onboarding_completed_at = now()
where id = 'ee400000-0000-4000-8000-000000000004';

do $free_member_trigger_behavior$
declare
  v_awards integer;
  v_credits integer;
  v_all_awards integer;
  v_suppressions integer;
  v_definition_active boolean;
begin
  select pg_catalog.count(*) into v_awards
    from public.user_badges as award
    where award.user_id = 'ee400000-0000-4000-8000-000000000004'
      and award.badge_key = 'free_member'
      and award.revoked_at is null;
  select pg_catalog.count(*) into v_credits
    from public.badge_credit_events as event
    where event.user_id = 'ee400000-0000-4000-8000-000000000004'
      and event.credit_type = 'account_membership'
      and event.revoked_at is null;
  select pg_catalog.count(*) into v_all_awards
    from public.user_badges as award
    where award.user_id = 'ee400000-0000-4000-8000-000000000004'
      and award.badge_key = 'free_member';
  select pg_catalog.count(*) into v_suppressions
    from public.badge_award_suppressions as suppression
    where suppression.user_id = 'ee400000-0000-4000-8000-000000000004'
      and suppression.badge_key = 'free_member'
      and suppression.lifted_at is null;
  select definition.is_active into v_definition_active
    from public.badge_definitions as definition
    where definition.badge_key = 'free_member';
  if v_awards <> 1 or v_credits <> 1 then
    raise exception 'completed Commons onboarding did not create exactly one Free Member award and credit (active awards %, all awards %, credits %, suppressions %, definition active %)', v_awards, v_all_awards, v_credits, v_suppressions, v_definition_active;
  end if;

  update public.profiles
  set commons_onboarding_completed_at = commons_onboarding_completed_at
  where id = 'ee400000-0000-4000-8000-000000000004';

  if (
    select pg_catalog.count(*)
    from public.user_badges as award
    where award.user_id = 'ee400000-0000-4000-8000-000000000004'
      and award.badge_key = 'free_member'
      and award.revoked_at is null
  ) <> 1 then
    raise exception 'Free Member onboarding trigger was not idempotent';
  end if;
end
$free_member_trigger_behavior$;

insert into public.review_items (
  id, domain, source_table, source_id, submitted_by, status,
  reviewed_by, reviewed_at, title, summary
) values
  ('ee500000-0000-4000-8000-000000000001', 'living_library_source', 'living_library_source_suggestions', 'ee600000-0000-4000-8000-000000000001', 'ee300000-0000-4000-8000-000000000003', 'approved', 'ee200000-0000-4000-8000-000000000002', now(), 'Source fixture one', 'Synthetic approved source review.'),
  ('ee500000-0000-4000-8000-000000000002', 'living_library_source', 'living_library_source_suggestions', 'ee600000-0000-4000-8000-000000000002', 'ee300000-0000-4000-8000-000000000003', 'approved', 'ee200000-0000-4000-8000-000000000002', now(), 'Source fixture two', 'Synthetic approved source review.'),
  ('ee500000-0000-4000-8000-000000000003', 'living_library_source', 'living_library_source_suggestions', 'ee600000-0000-4000-8000-000000000003', 'ee300000-0000-4000-8000-000000000003', 'approved', 'ee200000-0000-4000-8000-000000000002', now(), 'Source fixture three', 'Synthetic approved source review.');

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'ee200000-0000-4000-8000-000000000002',
  false
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ee200000-0000-4000-8000-000000000002","role":"authenticated"}',
  false
);

do $reviewer_evidence_behavior$
declare
  v_first uuid;
  v_replay uuid;
  v_index integer;
begin
  for v_index in 1..3 loop
    v_first := public.create_badge_credit_event(
      'ee300000-0000-4000-8000-000000000003',
      'source_curation',
      1,
      'living_library_source_suggestions',
      ('ee600000-0000-4000-8000-' || pg_catalog.lpad(v_index::text, 12, '0'))::uuid,
      ('ee500000-0000-4000-8000-' || pg_catalog.lpad(v_index::text, 12, '0'))::uuid,
      false,
      null,
      'Accepted source contribution fixture.'
    );
    if v_index = 1 then
      v_replay := public.create_badge_credit_event(
        'ee300000-0000-4000-8000-000000000003',
        'source_curation',
        1,
        'living_library_source_suggestions',
        'ee600000-0000-4000-8000-000000000001',
        'ee500000-0000-4000-8000-000000000001',
        false,
        null,
        'Accepted source contribution fixture.'
      );
      if v_replay is distinct from v_first then
        raise exception 'badge credit idempotent retry returned a different event';
      end if;
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from public.badge_credit_events as event
    where event.user_id = 'ee300000-0000-4000-8000-000000000003'
      and event.credit_type = 'source_curation'
      and event.revoked_at is null
  ) <> 3 then
    raise exception 'review-backed badge credits were not idempotent';
  end if;
  if not exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'source_curator' and revoked_at is null
  ) or not exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'seed_sower' and revoked_at is null
  ) then
    raise exception 'authoritative source-review credits did not trigger Source Curator and Seed Sower';
  end if;

  begin
    perform public.create_badge_credit_event(
      'ee200000-0000-4000-8000-000000000002',
      'source_curation', 1, 'living_library_source_suggestions',
      'ee600000-0000-4000-8000-000000000001',
      'ee500000-0000-4000-8000-000000000001',
      false, null, 'Self-credit must fail.'
    );
    raise exception 'source reviewer self-credit was accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_credit_self_award_denied' then raise; end if;
  end;

  begin
    perform public.create_badge_credit_event(
      'ee300000-0000-4000-8000-000000000003',
      'art_contribution', 1, 'living_library_source_suggestions',
      'ee600000-0000-4000-8000-000000000001',
      'ee500000-0000-4000-8000-000000000001',
      false, null, 'Wrong specialist credit must fail.'
    );
    raise exception 'source reviewer created an art contribution credit';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_credit_type_authority_denied' then raise; end if;
  end;
end
$reviewer_evidence_behavior$;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'ee100000-0000-4000-8000-000000000001',
  false
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ee100000-0000-4000-8000-000000000001","role":"authenticated"}',
  false
);

do $all_badge_rules_and_admin_behavior$
declare
  v_credit_type text;
  v_index integer;
  v_badge_key text;
  v_credit_id uuid;
  v_result jsonb;
  v_timeline jsonb;
  v_role_count integer;
begin
  -- One reviewed major contribution satisfies every established rule with a
  -- major shortcut. Source Curator was already qualified through specialist
  -- review above and is intentionally omitted here.
  foreach v_credit_type in array array[
    'stewardship_water', 'stewardship_forest', 'stewardship_reef',
    'stewardship_health', 'knowledge_support', 'developer_contribution',
    'archive_maintenance', 'testing_feedback', 'field_observation',
    'writing_teaching', 'art_contribution', 'accessibility_improvement',
    'boundary_safety'
  ] loop
    perform public.create_badge_credit_event(
      'ee300000-0000-4000-8000-000000000003',
      v_credit_type,
      1,
      'badge_completion_fixture',
      pg_catalog.gen_random_uuid(),
      null,
      true,
      null,
      'Disposable reviewed major-contribution fixture.'
    );
  end loop;

  perform public.create_badge_credit_event(
    'ee300000-0000-4000-8000-000000000003',
    'stewardship_general', 1, 'badge_completion_fixture',
    pg_catalog.gen_random_uuid(), null, false, null,
    'Disposable reviewed stewardship fixture.'
  );

  for v_index in 1..3 loop
    perform public.create_badge_credit_event(
      'ee300000-0000-4000-8000-000000000003',
      'troubleshooting_resolution', 1, 'badge_completion_fixture',
      pg_catalog.gen_random_uuid(), null, false,
      'person-' || (((v_index - 1) % 2) + 1)::text,
      'Disposable reviewed troubleshooting fixture.'
    );
  end loop;

  for v_index in 1..5 loop
    perform public.create_badge_credit_event(
      'ee300000-0000-4000-8000-000000000003',
      'bridge_building', 1, 'badge_completion_fixture',
      pg_catalog.gen_random_uuid(), null, false,
      'project-' || (((v_index - 1) % 3) + 1)::text,
      'Disposable reviewed bridge-building fixture.'
    );
  end loop;

  if (
    select pg_catalog.count(*)
    from public.badge_definitions as definition
    where definition.award_mode = 'review_triggered'
      and definition.is_active = true
  ) <> 18 then
    raise exception 'the preserved catalog no longer contains exactly 18 review-triggered badges';
  end if;
  if (
    select pg_catalog.count(*)
    from public.user_badges as award
    join public.badge_definitions as definition on definition.badge_key = award.badge_key
    where award.user_id = 'ee300000-0000-4000-8000-000000000003'
      and definition.award_mode = 'review_triggered'
      and award.revoked_at is null
  ) <> 18 then
    raise exception 'not every review-triggered badge rule produced an active award';
  end if;
  if (
    select pg_catalog.count(*)
    from public.user_badges as award
    join public.badge_definitions as definition on definition.badge_key = award.badge_key
    where award.user_id = 'ee300000-0000-4000-8000-000000000003'
      and definition.is_manual_only = true
      and award.revoked_at is null
  ) <> 0 then
    raise exception 'reviewed evidence automatically created a manual/role-linked badge';
  end if;

  foreach v_badge_key in array array[
    'founding_steward', 'guardian_reviewer', 'hearth_keeper',
    'ecobotics_forgewright', 'kindred_ally'
  ] loop
    perform public.grant_user_badge(
      'ee300000-0000-4000-8000-000000000003',
      v_badge_key,
      'Disposable two-party administrator review fixture.',
      'badge_completion_fixture',
      pg_catalog.gen_random_uuid()
    );
  end loop;

  if (
    select pg_catalog.count(*)
    from public.user_badges as award
    where award.user_id = 'ee300000-0000-4000-8000-000000000003'
      and award.revoked_at is null
  ) <> 24 then
    raise exception 'the full preserved 24-badge catalog did not reach governed active state';
  end if;

  select pg_catalog.count(*) into v_role_count
  from public.user_roles as role_assignment
  where role_assignment.user_id = 'ee100000-0000-4000-8000-000000000001'
    and role_assignment.revoked_at is null;

  perform public.grant_user_badge(
    'ee100000-0000-4000-8000-000000000001',
    'founding_steward',
    'Disposable administrator self-recognition review.',
    'badge_completion_fixture',
    'ee700000-0000-4000-8000-000000000001'
  );
  if not exists (
    select 1
    from public.user_badges as award
    where award.user_id = 'ee100000-0000-4000-8000-000000000001'
      and award.badge_key = 'founding_steward'
      and award.awarded_by = 'ee100000-0000-4000-8000-000000000001'
      and award.award_source = 'manual_admin'
      and award.visibility = 'public'
      and award.revoked_at is null
  ) or not exists (
    select 1
    from public.badge_audit_log as audit
    where audit.actor_user_id = 'ee100000-0000-4000-8000-000000000001'
      and audit.target_user_id = 'ee100000-0000-4000-8000-000000000001'
      and audit.badge_slug = 'founding_steward'
      and audit.action = 'manual_grant'
      and audit.evidence_type = 'badge_completion_fixture'
      and audit.evidence_id = 'ee700000-0000-4000-8000-000000000001'
      and audit.metadata ->> 'award_reason' = 'Disposable administrator self-recognition review.'
  ) then
    raise exception 'administrator self-grant omitted active public recognition or durable provenance';
  end if;

  begin
    perform public.grant_user_badge(
      'ee100000-0000-4000-8000-000000000001',
      'founding_steward',
      'Duplicate active self-grant must remain bounded.',
      'badge_completion_fixture',
      'ee700000-0000-4000-8000-000000000002'
    );
    raise exception 'duplicate active administrator self-grant was accepted';
  exception when unique_violation then
    if sqlerrm <> 'active_badge_award_already_exists' then raise; end if;
  end;

  perform public.revoke_user_badge(
    'ee100000-0000-4000-8000-000000000001',
    'founding_steward',
    'Disposable administrator self-revoke review.'
  );
  if not exists (
    select 1
    from public.badge_audit_log as audit
    where audit.actor_user_id = 'ee100000-0000-4000-8000-000000000001'
      and audit.target_user_id = 'ee100000-0000-4000-8000-000000000001'
      and audit.badge_slug = 'founding_steward'
      and audit.action = 'badge_revoked'
      and audit.metadata ->> 'revoked_reason' = 'Disposable administrator self-revoke review.'
  ) then
    raise exception 'administrator self-revoke omitted durable actor, target, badge, action, reason, or time';
  end if;

  v_result := public.restore_user_badge(
    'ee100000-0000-4000-8000-000000000001',
    'founding_steward',
    'Disposable administrator self-restore review.',
    false
  );
  if v_result ->> 'restored' <> 'true'
     or not exists (
       select 1
       from public.user_badges as award
       where award.user_id = 'ee100000-0000-4000-8000-000000000001'
         and award.badge_key = 'founding_steward'
         and award.awarded_by = 'ee100000-0000-4000-8000-000000000001'
         and award.award_source = 'manual_admin_restore'
         and award.visibility = 'public'
         and award.revoked_at is null
     )
     or not exists (
       select 1
       from public.badge_audit_log as audit
       where audit.actor_user_id = 'ee100000-0000-4000-8000-000000000001'
         and audit.target_user_id = 'ee100000-0000-4000-8000-000000000001'
         and audit.badge_slug = 'founding_steward'
         and audit.action = 'badge_restored'
         and audit.metadata ->> 'restore_reason' = 'Disposable administrator self-restore review.'
     ) then
    raise exception 'administrator self-restore omitted restored recognition or durable lifecycle history';
  end if;

  if (
    select pg_catalog.count(*)
    from public.user_roles as role_assignment
    where role_assignment.user_id = 'ee100000-0000-4000-8000-000000000001'
      and role_assignment.revoked_at is null
  ) <> v_role_count then
    raise exception 'administrator badge self-management changed authority roles';
  end if;

  perform public.revoke_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'water_steward',
    'Disposable suppression behavior fixture.'
  );
  perform public.evaluate_badges_for_user('ee300000-0000-4000-8000-000000000003');
  if exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'water_steward' and revoked_at is null
  ) then
    raise exception 'durable suppression allowed immediate automatic re-award';
  end if;

  v_result := public.restore_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'water_steward',
    'Disposable qualified restore fixture.',
    false
  );
  if v_result ->> 'restored' <> 'true' or not exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'water_steward' and revoked_at is null
  ) then
    raise exception 'qualified rule-based restore did not recreate the award';
  end if;

  select event.id into v_credit_id
  from public.badge_credit_events as event
  where event.user_id = 'ee300000-0000-4000-8000-000000000003'
    and event.credit_type = 'stewardship_water'
    and event.revoked_at is null
  order by event.awarded_at, event.id
  limit 1;
  perform public.revoke_badge_credit_event(
    v_credit_id,
    'Disposable invalidated evidence fixture.'
  );
  if exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'water_steward' and revoked_at is null
  ) or not exists (
    select 1 from public.badge_audit_log
    where target_user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_slug = 'water_steward'
      and action = 'rule_badge_revoked'
  ) then
    raise exception 'revoked authoritative credit did not retract the no-longer-qualified rule award';
  end if;

  perform public.revoke_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'founding_steward',
    'Disposable manual restore fixture.'
  );
  v_result := public.restore_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'founding_steward',
    'Disposable manual definition restore fixture.',
    false
  );
  if v_result ->> 'restored' <> 'true' or not exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'founding_steward'
      and award_source = 'manual_admin_restore'
      and revoked_at is null
  ) then
    raise exception 'manual-only badge restore did not create audited restored recognition';
  end if;

  perform public.revoke_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'open_pathmaker',
    'Disposable explicit manual-override fixture.'
  );
  v_result := public.restore_user_badge(
    'ee300000-0000-4000-8000-000000000003',
    'open_pathmaker',
    'Disposable explicit manual override of a review-triggered badge.',
    true
  );
  if v_result ->> 'manualOverride' <> 'true' or not exists (
    select 1 from public.user_badges
    where user_id = 'ee300000-0000-4000-8000-000000000003'
      and badge_key = 'open_pathmaker'
      and award_source = 'manual_admin_restore'
      and revoked_at is null
  ) then
    raise exception 'explicit administrator restore override was not distinguished in award state';
  end if;

  v_timeline := public.badge_administration_timeline(
    'ee300000-0000-4000-8000-000000000003',
    'water_steward',
    100
  );
  if pg_catalog.jsonb_array_length(v_timeline -> 'awards') < 2
     or pg_catalog.jsonb_array_length(v_timeline -> 'credits') < 1
     or pg_catalog.jsonb_array_length(v_timeline -> 'suppressions') < 1
     or pg_catalog.jsonb_array_length(v_timeline -> 'auditEvents') < 1
     or v_timeline::text not like '%Disposable suppression behavior fixture.%' then
    raise exception 'bounded administrator timeline omitted award, evidence, suppression, audit, or reason history';
  end if;
end
$all_badge_rules_and_admin_behavior$;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'ee300000-0000-4000-8000-000000000003',
  false
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ee300000-0000-4000-8000-000000000003","role":"authenticated"}',
  false
);

do $ordinary_badge_authority_refusal$
begin
  if public.current_user_is_admin()
     or public.current_user_can_create_badge_credit() then
    raise exception 'recognition badges conferred administrator or badge-credit authority';
  end if;

  begin
    perform public.grant_user_badge(
      'ee300000-0000-4000-8000-000000000003',
      'founding_steward',
      'Ordinary self-grant must fail.',
      'badge_completion_fixture',
      null
    );
    raise exception 'ordinary account self-awarded a badge';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_manual_grant_denied' then raise; end if;
  end;

  begin
    perform public.grant_user_badge(
      'ee100000-0000-4000-8000-000000000001',
      'founding_steward',
      'Ordinary cross-account grant must fail.',
      'badge_completion_fixture',
      null
    );
    raise exception 'ordinary account awarded another account a badge';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_manual_grant_denied' then raise; end if;
  end;

  begin
    perform public.revoke_user_badge(
      'ee300000-0000-4000-8000-000000000003',
      'founding_steward',
      'Ordinary self-revoke must fail.'
    );
    raise exception 'ordinary account revoked a badge';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_revocation_denied' then raise; end if;
  end;
end
$ordinary_badge_authority_refusal$;

set local role anon;
do $public_badge_visibility$
begin
  if not exists (
    select 1
    from public.visible_user_badges as award
    where award.user_id = 'ee100000-0000-4000-8000-000000000001'
      and award.badge_key = 'founding_steward'
      and award.award_source = 'manual_admin_restore'
      and award.visibility = 'public'
  ) then
    raise exception 'anonymous public badge projection omitted administrator-managed recognition';
  end if;
end
$public_badge_visibility$;
reset role;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'ee400000-0000-4000-8000-000000000004',
  false
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ee400000-0000-4000-8000-000000000004","role":"authenticated"}',
  false
);

do $timeline_refusal_behavior$
begin
  begin
    perform public.badge_administration_timeline(
      'ee300000-0000-4000-8000-000000000003', null, 100
    );
    raise exception 'ordinary authenticated user read private badge timeline';
  exception when insufficient_privilege then
    if sqlerrm <> 'badge_timeline_denied' then raise; end if;
  end;
end
$timeline_refusal_behavior$;

do $badge_acl_behavior$
declare
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.create_badge_credit_event(uuid,text,integer,text,uuid,uuid,boolean,text,text)'::regprocedure,
    'public.evaluate_badges_for_user(uuid)'::regprocedure,
    'public.grant_free_member_for_user(uuid)'::regprocedure,
    'public.grant_user_badge(uuid,text,text,text,uuid)'::regprocedure,
    'public.revoke_badge_credit_event(uuid,text)'::regprocedure,
    'public.revoke_user_badge(uuid,text,text)'::regprocedure,
    'public.restore_user_badge(uuid,text,text,boolean)'::regprocedure,
    'public.badge_administration_timeline(uuid,text,integer)'::regprocedure
  ] loop
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       or not pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'badge public RPC ACL differs from the explicit authenticated-only boundary: %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.current_user_can_create_badge_credit_type(text)'::regprocedure,
    'private.badge_credit_domain_allowed(text,public.review_domain)'::regprocedure,
    'private.badge_credit_rule_qualifies(uuid,text)'::regprocedure,
    'private.synchronize_free_member_badge(uuid,uuid)'::regprocedure,
    'private.synchronize_free_member_badge_trigger()'::regprocedure
  ] loop
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'internal badge function is directly executable by an API role: %', v_signature;
    end if;
  end loop;
end
$badge_acl_behavior$;

select 'badge_completion_behavior_ok';

rollback;

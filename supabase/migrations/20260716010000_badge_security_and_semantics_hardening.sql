-- Badge mutation ACL, Free Member predicate, durable suppression, and public
-- presentation hardening. This is additive and preserves every existing award.
-- New Free Member grants now require completed Commons onboarding; no historical
-- award is revoked or rewritten by this migration.

begin;

-- The captured baseline used PostgreSQL's generated constraint name. Refuse to
-- guess across manual drift: either the expected constraint exists or the live
-- preflight must reconcile the table before this forward migration is applied.
do $badge_audit_action_constraint$
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
      'rule_evaluated', 'suppression_created', 'suppression_lifted'
    ));
end
$badge_audit_action_constraint$;

create table public.badge_award_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null references public.badge_definitions(badge_key),
  suppressed_by uuid not null references auth.users(id),
  suppressed_at timestamptz not null default now(),
  reason text,
  lifted_by uuid references auth.users(id),
  lifted_at timestamptz,
  lift_reason text,
  constraint badge_award_suppressions_lift_state_check check (
    (lifted_at is null and lifted_by is null)
    or (lifted_at is not null and lifted_by is not null)
  )
);

alter table public.badge_award_suppressions owner to postgres;
alter table public.badge_award_suppressions enable row level security;

create unique index badge_award_suppressions_one_active_idx
  on public.badge_award_suppressions(user_id, badge_key)
  where lifted_at is null;
create index badge_award_suppressions_user_idx
  on public.badge_award_suppressions(user_id, suppressed_at desc);

revoke all privileges on table public.badge_award_suppressions
  from public, anon, authenticated, service_role;
grant select on table public.badge_award_suppressions to authenticated;

create policy "badge reviewers read suppressions"
  on public.badge_award_suppressions
  for select to authenticated
  using (
    public.current_user_is_admin()
    or public.current_user_can_create_badge_credit()
  );

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
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.badge_definitions as definition
    where definition.badge_key = p_badge_key
      and definition.is_active = true
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.badge_award_suppressions as suppression
    where suppression.user_id = p_target_user_id
      and suppression.badge_key = p_badge_key
      and suppression.lifted_at is null
  ) then
    return;
  end if;

  insert into public.user_badges (
    user_id, badge_key, awarded_by, award_source, award_reason,
    evidence_type, evidence_id, visibility
  )
  select
    p_target_user_id, p_badge_key, p_actor_user_id, p_award_source,
    p_award_reason, p_evidence_type, p_evidence_id, 'public'
  where not exists (
    select 1
    from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = p_badge_key
      and award.revoked_at is null
  );

  if found then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug,
      evidence_type, evidence_id, metadata
    ) values (
      p_actor_user_id,
      p_target_user_id,
      'badge_granted',
      p_badge_key,
      p_evidence_type,
      p_evidence_id,
      pg_catalog.jsonb_build_object(
        'award_source', p_award_source,
        'award_reason', p_award_reason
      )
    );
  end if;
end;
$$;

alter function public.award_badge_if_missing(uuid, text, text, text, text, uuid, uuid)
  owner to postgres;

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_inserted_badge_id uuid;
  v_inserted_credit_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'free_member_authentication_required';
  end if;

  if v_actor <> p_target_user_id
     and not public.current_user_is_admin()
     and not public.current_user_can_create_badge_credit() then
    raise exception using errcode = '42501', message = 'free_member_grant_denied';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join auth.users as account on account.id = profile.id
    where profile.id = p_target_user_id
      and profile.commons_onboarding_completed_at is not null
  ) then
    raise exception using
      errcode = '23514',
      message = 'commons_onboarding_required_for_free_member';
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

  insert into public.badge_credit_events (
    user_id, credit_type, credit_amount, contribution_type,
    contribution_id, awarded_by, is_major, notes
  )
  select
    p_target_user_id,
    'account_membership',
    1,
    'commons_profile',
    p_target_user_id,
    v_actor,
    false,
    'Free membership recognition for completed Commons onboarding.'
  where not exists (
    select 1
    from public.badge_credit_events as credit
    where credit.user_id = p_target_user_id
      and credit.credit_type = 'account_membership'
      and credit.contribution_type = 'commons_profile'
      and credit.contribution_id = p_target_user_id
      and credit.revoked_at is null
  )
  returning id into v_inserted_credit_id;

  insert into public.user_badges (
    user_id, badge_key, awarded_by, awarded_at, award_source,
    award_reason, evidence_type, evidence_id, visibility
  )
  select
    p_target_user_id,
    'free_member',
    v_actor,
    pg_catalog.now(),
    'automatic',
    'Free membership recognition for completed Commons onboarding.',
    'commons_profile',
    p_target_user_id,
    'public'
  where not exists (
    select 1
    from public.user_badges as award
    where award.user_id = p_target_user_id
      and award.badge_key = 'free_member'
      and award.revoked_at is null
  )
  returning id into v_inserted_badge_id;

  if v_inserted_badge_id is not null then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug, credit_event_id,
      evidence_type, evidence_id, metadata
    ) values (
      v_actor,
      p_target_user_id,
      'free_member_granted',
      'free_member',
      v_inserted_credit_id,
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

alter function public.grant_free_member_for_user(uuid) owner to postgres;

create or replace function public.backfill_free_member_badges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile record;
  v_had_badge boolean;
  v_granted_count integer := 0;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'free_member_backfill_denied';
  end if;

  for v_profile in
    select profile.id
    from public.profiles as profile
    join auth.users as account on account.id = profile.id
    where profile.commons_onboarding_completed_at is not null
      and not exists (
        select 1
        from public.badge_award_suppressions as suppression
        where suppression.user_id = profile.id
          and suppression.badge_key = 'free_member'
          and suppression.lifted_at is null
      )
  loop
    select exists (
      select 1
      from public.user_badges as award
      where award.user_id = v_profile.id
        and award.badge_key = 'free_member'
        and award.revoked_at is null
    ) into v_had_badge;

    perform public.grant_free_member_for_user(v_profile.id);
    if not v_had_badge then
      v_granted_count := v_granted_count + 1;
    end if;
  end loop;

  return v_granted_count;
end;
$$;

alter function public.backfill_free_member_badges() owner to postgres;

-- Keep the established hard-coded contribution thresholds for compatibility.
-- This replacement changes only actor validation, Free Member eligibility, safe
-- search path, and durable suppression behavior.
create or replace function public.evaluate_badges_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_rule record;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'badge_evaluation_authentication_required';
  end if;

  if v_actor <> p_target_user_id and not public.current_user_can_create_badge_credit() then
    raise exception using errcode = '42501', message = 'badge_evaluation_denied';
  end if;

  if exists (
    select 1
    from public.profiles as profile
    where profile.id = p_target_user_id
      and profile.commons_onboarding_completed_at is not null
  ) then
    -- Use the same path as onboarding/backfill so Free Member can never exist
    -- without its canonical account_membership credit event.
    perform public.grant_free_member_for_user(p_target_user_id);
  end if;

  if exists (
    select 1
    from public.badge_credit_events as event
    where event.user_id = p_target_user_id
      and event.revoked_at is null
      and event.credit_type <> 'account_membership'
  ) then
    perform public.award_badge_if_missing(
      p_target_user_id, 'seed_sower', 'credit_rule',
      'First approved contribution recorded.', 'badge_rule', null, v_actor
    );
  end if;

  for v_rule in
    select * from (values
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
    ) as rule(badge_key, credit_type, required_count, required_sum, major_shortcut, distinct_min, reason)
  loop
    if (
      (
        v_rule.required_count is not null
        and (
          select pg_catalog.count(*)
          from public.badge_credit_events as event
          where event.user_id = p_target_user_id
            and event.credit_type = v_rule.credit_type
            and event.revoked_at is null
        ) >= v_rule.required_count
      )
      or (
        v_rule.required_sum is not null
        and (
          select coalesce(pg_catalog.sum(event.credit_amount), 0)
          from public.badge_credit_events as event
          where event.user_id = p_target_user_id
            and event.credit_type = v_rule.credit_type
            and event.revoked_at is null
        ) >= v_rule.required_sum
      )
      or (
        v_rule.major_shortcut
        and exists (
          select 1
          from public.badge_credit_events as event
          where event.user_id = p_target_user_id
            and event.credit_type = v_rule.credit_type
            and event.is_major = true
            and event.revoked_at is null
        )
      )
    ) and (
      v_rule.distinct_min is null
      or (
        select pg_catalog.count(distinct event.distinct_subject_key)
        from public.badge_credit_events as event
        where event.user_id = p_target_user_id
          and event.credit_type = v_rule.credit_type
          and event.revoked_at is null
          and event.distinct_subject_key is not null
      ) >= v_rule.distinct_min
    ) then
      perform public.award_badge_if_missing(
        p_target_user_id, v_rule.badge_key, 'credit_rule', v_rule.reason,
        'badge_rule', null, v_actor
      );
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
  v_suppression_id uuid;
  v_revoked_count integer := 0;
begin
  if v_actor is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'badge_revocation_denied';
  end if;

  insert into public.badge_award_suppressions (
    user_id, badge_key, suppressed_by, reason
  ) values (
    p_target_user_id,
    p_badge_key,
    v_actor,
    nullif(pg_catalog.btrim(coalesce(p_revoked_reason, '')), '')
  )
  on conflict (user_id, badge_key) where lifted_at is null
  do nothing
  returning id into v_suppression_id;

  update public.user_badges
  set
    revoked_at = pg_catalog.now(),
    revoked_by = v_actor,
    revoked_reason = p_revoked_reason,
    updated_at = pg_catalog.now()
  where user_id = p_target_user_id
    and badge_key = p_badge_key
    and revoked_at is null;
  get diagnostics v_revoked_count = row_count;

  if v_revoked_count > 0 then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug, metadata
    ) values (
      v_actor,
      p_target_user_id,
      'badge_revoked',
      p_badge_key,
      pg_catalog.jsonb_build_object(
        'revoked_reason', p_revoked_reason,
        'durably_suppressed', true
      )
    );
  end if;

  if v_suppression_id is not null then
    insert into public.badge_audit_log (
      actor_user_id, target_user_id, action, badge_slug, metadata
    ) values (
      v_actor,
      p_target_user_id,
      'suppression_created',
      p_badge_key,
      pg_catalog.jsonb_build_object(
        'reason', pg_catalog.left(coalesce(p_revoked_reason, ''), 2000),
        'prevents_automatic_reaward', true
      )
    );
  end if;
end;
$$;

alter function public.revoke_user_badge(uuid, text, text) owner to postgres;

create or replace function public.lift_user_badge_suppression(
  p_target_user_id uuid,
  p_badge_key text,
  p_lift_reason text
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
    raise exception using errcode = '42501', message = 'badge_suppression_lift_denied';
  end if;

  if nullif(pg_catalog.btrim(coalesce(p_lift_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'badge_suppression_lift_reason_required';
  end if;

  update public.badge_award_suppressions
  set
    lifted_by = v_actor,
    lifted_at = pg_catalog.now(),
    lift_reason = pg_catalog.left(pg_catalog.btrim(p_lift_reason), 2000)
  where user_id = p_target_user_id
    and badge_key = p_badge_key
    and lifted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'active_badge_suppression_not_found';
  end if;

  insert into public.badge_audit_log (
    actor_user_id, target_user_id, action, badge_slug, metadata
  ) values (
    v_actor,
    p_target_user_id,
    'suppression_lifted',
    p_badge_key,
    pg_catalog.jsonb_build_object(
      'lift_reason', pg_catalog.left(pg_catalog.btrim(p_lift_reason), 2000)
    )
  );
end;
$$;

alter function public.lift_user_badge_suppression(uuid, text, text) owner to postgres;

-- Public and cross-account badge presentation is column-minimized. Private
-- evidence remains in the base table for audited owner/admin workflows.
create or replace view public.visible_user_badges
with (security_invoker = true, security_barrier = true)
as
select
  award.id,
  award.user_id,
  award.badge_key,
  award.awarded_at,
  award.visibility,
  award.award_source,
  award.created_at,
  award.updated_at
from public.user_badges as award
where award.visibility = 'public'
  and award.revoked_at is null;

alter view public.visible_user_badges owner to postgres;

revoke all privileges on table public.visible_user_badges
  from public, anon, authenticated, service_role;
grant select on table public.visible_user_badges to anon, authenticated;

revoke all privileges on table public.user_badges
  from public, anon, authenticated;
grant select (
  id, user_id, badge_key, awarded_at, visibility, award_source,
  revoked_at, created_at, updated_at
) on public.user_badges to anon, authenticated;
grant update (visibility) on public.user_badges to authenticated;

create or replace function public.synchronize_user_badge_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

alter function public.synchronize_user_badge_updated_at() owner to postgres;
revoke all privileges on function public.synchronize_user_badge_updated_at()
  from public, anon, authenticated, service_role;

drop trigger if exists synchronize_user_badge_updated_at on public.user_badges;
create trigger synchronize_user_badge_updated_at
before update on public.user_badges
for each row execute function public.synchronize_user_badge_updated_at();

-- Revoke PostgreSQL's default PUBLIC function execution before selectively
-- restoring only the browser operations that validate an authenticated actor.
alter function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text)
  set search_path = '';
alter function public.grant_user_badge(uuid, text, text, text, uuid)
  set search_path = '';
alter function public.revoke_badge_credit_event(uuid, text)
  set search_path = '';

revoke all privileges on function public.award_badge_if_missing(uuid, text, text, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.backfill_free_member_badges()
  from public, anon, authenticated, service_role;
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
revoke all privileges on function public.lift_user_badge_suppression(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text)
  to authenticated;
grant execute on function public.evaluate_badges_for_user(uuid) to authenticated;
grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.grant_user_badge(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.revoke_badge_credit_event(uuid, text) to authenticated;
grant execute on function public.revoke_user_badge(uuid, text, text) to authenticated;
grant execute on function public.lift_user_badge_suppression(uuid, text, text) to authenticated;

comment on table public.badge_award_suppressions is
  'Durable administrative suppression. Rule evaluation cannot recreate an award until a separately audited lift.';
comment on view public.visible_user_badges is
  'Column-minimized public badge presentation; financial/private evidence must never be stored here.';
comment on function public.grant_free_member_for_user(uuid) is
  'Grants free recognition only after completed Commons onboarding. Existing awards are preserved unchanged.';

commit;

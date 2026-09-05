-- Administrator badge target-policy correction discovered during owner live QA.
begin;

-- Administrator badge management is intentionally target-neutral. An
-- administrator may manage recognition for any account, including their own,
-- while the same server-side administrator predicate continues to refuse every
-- ordinary account. Badges remain data in the recognition ledger; these
-- functions do not touch roles or any other authority-bearing table.
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
revoke all privileges on function public.grant_user_badge(uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.grant_user_badge(uuid, text, text, text, uuid)
  to authenticated;

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
revoke all privileges on function public.restore_user_badge(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_user_badge(uuid, text, text, boolean)
  to authenticated;

comment on function public.grant_user_badge(uuid, text, text, text, uuid) is
  'Administrator-only audited manual recognition grant for any target account, including the acting administrator. It grants no role or permission.';
comment on function public.restore_user_badge(uuid, text, text, boolean) is
  'Administrator-only audited suppression lift and rule re-evaluation or explicit manual override for any target account, including the acting administrator. It grants no role or permission.';

commit;

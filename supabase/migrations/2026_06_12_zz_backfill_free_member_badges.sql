-- Free Member badge repair/backfill.
-- This migration awards only Free Member recognition to existing website profiles and keeps badges separate from authority.

create extension if not exists pgcrypto;

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active)
values ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common', 1, false, 'automatic', 'Granted when a Website Account has a Commons Profile.', false, true)
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

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  inserted_badge_id uuid;
  inserted_credit_id uuid;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_is_admin() then
    raise exception 'Only the profile owner or an administrator can initialize Free Member recognition.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_target_user_id
  ) then
    raise exception 'A Website Account with a Commons Profile is required before Free Member recognition.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, is_major, notes)
  select p_target_user_id, 'account_membership', 1, 'commons_profile', p_target_user_id, actor, false, 'Free membership recognition for a completed Commons profile.'
  where to_regclass('public.badge_credit_events') is not null
    and not exists (
      select 1
      from public.badge_credit_events bce
      where bce.user_id = p_target_user_id
        and bce.credit_type = 'account_membership'
        and bce.contribution_type = 'commons_profile'
        and bce.contribution_id = p_target_user_id
        and bce.revoked_at is null
    )
  returning id into inserted_credit_id;

  insert into public.user_badges (user_id, badge_key, awarded_by, awarded_at, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, 'free_member', actor, now(), 'automatic', 'Free membership recognition for a completed Commons profile.', 'commons_profile', p_target_user_id, 'public'
  where not exists (
    select 1
    from public.user_badges ub
    where ub.user_id = p_target_user_id
      and ub.badge_key = 'free_member'
      and ub.revoked_at is null
  )
  returning id into inserted_badge_id;

  if inserted_badge_id is not null and to_regclass('public.badge_audit_log') is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, credit_event_id, evidence_type, evidence_id, metadata)
    values (actor, p_target_user_id, 'free_member_granted', 'free_member', inserted_credit_id, 'commons_profile', p_target_user_id, jsonb_build_object('award_source', 'automatic'));
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
  had_badge boolean;
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    raise exception 'Only administrators can backfill Free Member badges.';
  end if;

  for profile_row in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
  loop
    select exists (
      select 1 from public.user_badges ub
      where ub.user_id = profile_row.id
        and ub.badge_key = 'free_member'
        and ub.revoked_at is null
    ) into had_badge;

    perform public.grant_free_member_for_user(profile_row.id);

    if not had_badge then
      granted_count := granted_count + 1;
    end if;
  end loop;

  return granted_count;
end;
$$;

select public.backfill_free_member_badges();

grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.backfill_free_member_badges() to authenticated;


-- Correct the legacy Online Commons Profile cutover marker without changing
-- profile rows, shared cross-site publication, or any owner's audited choice.
begin;

-- Migration version timestamps are repository ordering identifiers, not hosted
-- deployment timestamps. The durable cutover marker is the first audited
-- profile_publication_events row. Until that exists, completion of the legacy
-- Commons onboarding remains the owner's explicit Online publication choice.
create or replace function private.community_legacy_online_profile_is_public(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(
      p_user_id, 'commons_profile_publication'
    )
    and not private.community_has_active_restriction(
      p_user_id, 'all_public_communities'
    )
    and exists (
      select 1
      from public.profiles as profile
      join private.account_participation as participation
        on participation.user_id = profile.id
      where profile.id = p_user_id
        and profile.commons_onboarding_completed_at is not null
        and participation.participation_state not in (
          'restricted', 'suspended', 'blocked',
          'deletion_pending', 'deactivated'
        )
    )
    and not exists (
      select 1
      from private.profile_publication_events as event
      where event.user_id = p_user_id
    ),
    false
  );
$$;

alter function private.community_legacy_online_profile_is_public(uuid)
  owner to postgres;
revoke all privileges
  on function private.community_legacy_online_profile_is_public(uuid)
  from public, anon, authenticated, service_role;

comment on function private.community_legacy_online_profile_is_public(uuid) is
  'Compatibility predicate for canonical Online Commons Profiles explicitly published through legacy Commons onboarding. Any audited new publication decision permanently supersedes this path.';

commit;

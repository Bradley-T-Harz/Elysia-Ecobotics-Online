\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('cc000000-0000-4000-8000-000000000001', 'circle-a@example.invalid', now(), now(), now()),
  ('cc000000-0000-4000-8000-000000000002', 'circle-b@example.invalid', now(), now(), now()),
  ('cc000000-0000-4000-8000-000000000003', 'circle-c@example.invalid', now(), now(), now()),
  ('cc000000-0000-4000-8000-000000000004', 'circle-admin@example.invalid', now(), now(), now());

insert into public.profiles(id, username, display_name, bio, commons_onboarding_completed_at)
values
  ('cc000000-0000-4000-8000-000000000001', 'circle-a', 'Circle A', 'Disposable Circle member A.', '2026-07-01 00:00:00+00'),
  ('cc000000-0000-4000-8000-000000000002', 'circle-b', 'Circle B', 'Disposable Circle member B.', '2026-07-01 00:00:00+00'),
  ('cc000000-0000-4000-8000-000000000003', 'circle-c', 'Circle C', 'Disposable Circle member C.', '2026-07-01 00:00:00+00'),
  ('cc000000-0000-4000-8000-000000000004', 'circle-admin', 'Circle Admin', 'Disposable nonparticipant admin.', '2026-07-01 00:00:00+00');

insert into private.account_participation(user_id, participation_state, age_band, assurance_status)
values
  ('cc000000-0000-4000-8000-000000000001', 'read_only', 'unknown', 'not_collected'),
  ('cc000000-0000-4000-8000-000000000002', 'read_only', 'unknown', 'not_collected'),
  ('cc000000-0000-4000-8000-000000000003', 'read_only', 'unknown', 'not_collected'),
  ('cc000000-0000-4000-8000-000000000004', 'read_only', 'unknown', 'not_collected')
on conflict (user_id) do update set participation_state = excluded.participation_state;

update public.profile_public_cards set display_name = case handle
  when 'circle-a' then 'Circle A' when 'circle-b' then 'Circle B'
  when 'circle-c' then 'Circle C' when 'circle-admin' then 'Circle Admin' end
where user_id::text like 'cc000000-0000-4000-8000-00000000000%';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000001', true);

do $circle_a_invites_b$
declare v_result jsonb;
begin
  v_result := public.invite_to_commons_circle('@circle-b');
  if v_result ->> 'state' <> 'sent' then raise exception 'A could not invite B: %', v_result; end if;
  if public.invite_to_commons_circle('circle-b') ->> 'relationshipId' <> v_result ->> 'relationshipId' then
    raise exception 'duplicate Circle invitation was not idempotent';
  end if;
  if public.commons_circle_state_for_handle('circle-b') ->> 'state' <> 'sent' then
    raise exception 'outbound Circle state was not sent';
  end if;
  begin
    perform public.invite_to_commons_circle('circle-a');
    raise exception 'self Circle invitation unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
end
$circle_a_invites_b$;

select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000002', true);
do $circle_b_accepts_a$
declare v_overview jsonb; v_id uuid;
begin
  v_overview := public.current_user_circle();
  if (v_overview #>> '{counts,incoming}')::integer <> 1
     or v_overview #>> '{incoming,0,profile,handle}' <> 'circle-a' then
    raise exception 'B did not receive the private Circle invitation: %', v_overview;
  end if;
  v_id := (v_overview #>> '{incoming,0,relationshipId}')::uuid;
  if public.respond_to_commons_circle_invitation(v_id, true) ->> 'state' <> 'accepted' then
    raise exception 'B could not accept A';
  end if;
  if (public.current_user_circle() #>> '{counts,accepted}')::integer <> 1 then
    raise exception 'accepted mutual count did not update';
  end if;
end
$circle_b_accepts_a$;

-- A cannot respond to the invitation A originally sent.
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000001', true);
do $circle_sender_cannot_respond$
declare v_id uuid;
begin
  select id into v_id from public.commons_circle_relationships
  where requested_by = 'cc000000-0000-4000-8000-000000000001' and status = 'accepted' limit 1;
  begin
    perform public.respond_to_commons_circle_invitation(v_id, false);
    raise exception 'sender responded to own invitation';
  exception when sqlstate '42501' then null;
  end;
end
$circle_sender_cannot_respond$;

-- Crossed invitations are serialized and become mutual only after both people invite.
select public.invite_to_commons_circle('circle-c');
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000003', true);
do $circle_cross_invitation$
declare v_result jsonb;
begin
  v_result := public.invite_to_commons_circle('circle-a');
  if v_result ->> 'state' <> 'accepted' then raise exception 'crossed invitation did not become mutual: %', v_result; end if;
end
$circle_cross_invitation$;

-- A nonparticipant administrator cannot enumerate another pair through RLS.
reset role;
update public.profiles set is_admin = true where id = 'cc000000-0000-4000-8000-000000000004';
insert into public.user_roles(user_id, role) values ('cc000000-0000-4000-8000-000000000004', 'administrator') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000004', true);
do $circle_admin_no_ambient_access$
declare v_count integer;
begin
  select count(*) into v_count from public.commons_circle_relationships;
  if v_count <> 0 then raise exception 'nonparticipant administrator enumerated private Circle relationships'; end if;
end
$circle_admin_no_ambient_access$;

-- An unrelated member cannot enumerate either.
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000003', true);
do $circle_participant_scope$
declare v_count integer;
begin
  select count(*) into v_count from public.commons_circle_relationships;
  if v_count <> 1 then raise exception 'C saw a relationship other than the C/A pair: %', v_count; end if;
end
$circle_participant_scope$;

-- Either accepted participant may remove; the row remains auditable and may be reinvited later.
select set_config('request.jwt.claim.sub', 'cc000000-0000-4000-8000-000000000002', true);
do $circle_remove$
declare v_id uuid;
begin
  select id into v_id from public.commons_circle_relationships
  where status = 'accepted' and requested_by = 'cc000000-0000-4000-8000-000000000001';
  perform public.remove_from_commons_circle(v_id);
  if public.commons_circle_state_for_handle('circle-a') ->> 'state' <> 'can_invite' then
    raise exception 'removed pair did not return to inviteable state';
  end if;
end
$circle_remove$;

reset role;
select 'commons_circle_mutual_behavior_ok' as result;
rollback;

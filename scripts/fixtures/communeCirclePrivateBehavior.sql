\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('ca000000-0000-4000-8000-000000000001', 'private-owner@example.invalid', now(), now(), now()),
  ('ca000000-0000-4000-8000-000000000002', 'private-participant@example.invalid', now(), now(), now()),
  ('ca000000-0000-4000-8000-000000000003', 'private-unrelated@example.invalid', now(), now(), now()),
  ('ca000000-0000-4000-8000-000000000004', 'private-admin@example.invalid', now(), now(), now()),
  ('ca000000-0000-4000-8000-000000000005', 'private-reviewer@example.invalid', now(), now(), now());

insert into public.profiles(id, username, display_name, bio, commons_onboarding_completed_at)
values
  ('ca000000-0000-4000-8000-000000000001', 'private-owner', 'Private Owner', 'Disposable private post owner.', now()),
  ('ca000000-0000-4000-8000-000000000002', 'private-participant', 'Private Participant', 'Disposable selected Circle participant.', now()),
  ('ca000000-0000-4000-8000-000000000003', 'private-unrelated', 'Private Unrelated', 'Disposable unrelated member.', now()),
  ('ca000000-0000-4000-8000-000000000004', 'private-admin', 'Private Admin', 'Disposable nonparticipant administrator.', now()),
  ('ca000000-0000-4000-8000-000000000005', 'private-reviewer', 'Private Reviewer', 'Disposable nonparticipant reviewer.', now());

insert into private.account_participation(user_id, participation_state, age_band, assurance_status)
select id, 'adult_eligible', '18_plus', 'self_attested'
from auth.users where id::text like 'ca000000-0000-4000-8000-00000000000%'
on conflict (user_id) do update set
  participation_state = excluded.participation_state,
  age_band = excluded.age_band,
  assurance_status = excluded.assurance_status;

insert into public.commons_circle_relationships(
  id, user_low_id, user_high_id, requested_by, status, responded_at, accepted_at
) values (
  'ca300000-0000-4000-8000-000000000001',
  'ca000000-0000-4000-8000-000000000001',
  'ca000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000001',
  'accepted', now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000001', true);

-- A manipulated Circle insert without the explicit privacy acknowledgement fails closed.
do $circle_ack_required$
begin
  begin
    insert into public.commune_posts(
      id, user_id, post_type, title, body, audience, visibility, status,
      moderation_status, visibility_state, circle_privacy_acknowledged, published_at
    ) values (
      'ca100000-0000-4000-8000-000000000099', auth.uid(), 'media_garden',
      'Missing privacy acknowledgement', 'Must fail.', 'circle', 'private_draft',
      'published', 'circle_private', 'published', false, now()
    );
    raise exception 'Circle post without privacy acknowledgement unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end
$circle_ack_required$;

-- Ordinary members may create Circle-private posts in the eight ordinary rooms.
insert into public.commune_posts(
  id, user_id, author_username, post_type, title, body, excerpt, tags,
  audience, visibility, status, moderation_status, visibility_state,
  circle_privacy_acknowledged, published_at
) values
  ('ca100000-0000-4000-8000-000000000001', auth.uid(), 'private-owner', 'media_garden', 'Private Media Garden', 'Private media body.', 'Private media.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000002', auth.uid(), 'private-owner', 'troubleshooting', 'Private Troubleshooting Grove', 'Private troubleshooting body.', 'Private troubleshooting.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000003', auth.uid(), 'private-owner', 'code_sharing', 'Private Coding Cornucopia', 'Private code body.', 'Private code.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000004', auth.uid(), 'private-owner', 'repository_showcase', 'Private Repository Showcase', 'Private repository body.', 'Private repository.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000005', auth.uid(), 'private-owner', 'community_network', 'Private Community Network', 'Private network body.', 'Private network.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000006', auth.uid(), 'private-owner', 'job_post', 'Private Job Post', 'Private job body.', 'Private job.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000007', auth.uid(), 'private-owner', 'research_note', 'Private Research Notes', 'Private research body.', 'Private research.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000008', auth.uid(), 'private-owner', 'elysia_iteration_showcase', 'Private Iteration Showcase', 'Private iteration body.', 'Private iteration.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now());

-- Ordinary users cannot manufacture private brand-authoritative content.
do $circle_admin_room_boundary$
begin
  begin
    insert into public.commune_posts(
      id, user_id, post_type, title, body, audience, visibility, status,
      moderation_status, visibility_state, circle_privacy_acknowledged, published_at
    ) values (
      'ca100000-0000-4000-8000-000000000098', auth.uid(), 'official_update',
      'Forged official update', 'Must fail.', 'circle', 'private_draft',
      'published', 'circle_private', 'published', true, now()
    );
    raise exception 'ordinary user created a Circle-private Official Update';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.commune_posts(
      id, user_id, post_type, title, body, audience, visibility, status,
      moderation_status, visibility_state, circle_privacy_acknowledged, published_at
    ) values (
      'ca100000-0000-4000-8000-000000000097', auth.uid(), 'community_vote',
      'Forged vote', 'Must fail.', 'circle', 'private_draft',
      'published', 'circle_private', 'published', true, now()
    );
    raise exception 'ordinary user created a Circle-private Community Vote';
  exception when sqlstate '42501' then null;
  end;
end
$circle_admin_room_boundary$;

reset role;
update public.profiles set is_admin = true
where id in ('ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000004');
insert into public.user_roles(user_id, role)
values
  ('ca000000-0000-4000-8000-000000000001', 'administrator'),
  ('ca000000-0000-4000-8000-000000000004', 'administrator'),
  ('ca000000-0000-4000-8000-000000000005', 'reviewer')
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000001', true);
insert into public.commune_posts(
  id, user_id, author_username, post_type, title, body, excerpt, tags,
  audience, visibility, status, moderation_status, visibility_state,
  circle_privacy_acknowledged, published_at
) values
  ('ca100000-0000-4000-8000-000000000009', auth.uid(), 'private-owner', 'community_vote', 'Private Community Voting Room', 'Private advisory vote.', 'Private vote.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now()),
  ('ca100000-0000-4000-8000-000000000010', auth.uid(), 'private-owner', 'official_update', 'Private Official Update', 'Private official body.', 'Private official.', array['circle'], 'circle', 'private_draft', 'published', 'circle_private', 'published', true, now());

insert into public.commune_threads(id, post_id, title, created_by, visibility, status)
select
  ('ca200000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('ca100000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Private Circle thread ' || n,
  auth.uid(), 'circle', 'open'
from generate_series(1, 10) as n;

do $circle_add_participant_all_rooms$
declare v_post uuid; v_result jsonb; v_count integer := 0;
begin
  for v_post in
    select id from public.commune_posts
    where user_id = auth.uid() and audience = 'circle'
    order by id
  loop
    v_result := public.add_commune_post_circle_participants(
      v_post, array['ca300000-0000-4000-8000-000000000001'::uuid]
    );
    if (v_result ->> 'added')::integer <> 1 then
      raise exception 'Circle participant was not added exactly once: %', v_result;
    end if;
    v_count := v_count + 1;
  end loop;
  if v_count <> 10 then raise exception 'expected ten room-native private posts, found %', v_count; end if;
end
$circle_add_participant_all_rooms$;

-- Structured room-native metadata exists for every specialized room.
reset role;
insert into public.commune_troubleshooting_posts(post_id, thread_id, author_user_id, issue_type, affected_area)
values ('ca100000-0000-4000-8000-000000000002', 'ca200000-0000-4000-8000-000000000002', 'ca000000-0000-4000-8000-000000000001', 'frontend_ui', 'Private fixture');
insert into public.commune_repository_showcases(user_id, post_id, repository_url, project_name, project_summary, status)
values ('ca000000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000004', 'https://example.invalid/private-repository', 'Private repository', 'Selected Circle only.', 'approved');
insert into public.commune_job_posts(post_id, thread_id, author_user_id, role_title, organization_project, role_type, paid_volunteer_status, location_mode, compensation_clarity)
values ('ca100000-0000-4000-8000-000000000006', 'ca200000-0000-4000-8000-000000000006', 'ca000000-0000-4000-8000-000000000001', 'Private role', 'Private project', 'other', 'must_clarify', 'remote', 'Compensation is explicitly not established.');
insert into public.commune_research_notes(post_id, thread_id, author_user_id, research_question, evidence_strength, review_status)
values ('ca100000-0000-4000-8000-000000000007', 'ca200000-0000-4000-8000-000000000007', 'ca000000-0000-4000-8000-000000000001', 'Private research question?', 'preliminary', 'published');
insert into public.commune_iteration_showcases(post_id, author_user_id, iteration_type, what_changed, status)
values ('ca100000-0000-4000-8000-000000000008', 'ca000000-0000-4000-8000-000000000001', 'prototype', 'Private fixture changed.', 'approved');
insert into public.commune_vote_posts(post_id, created_by, question, vote_status, visibility, results_visibility)
values ('ca100000-0000-4000-8000-000000000009', 'ca000000-0000-4000-8000-000000000001', 'Private guidance question?', 'open', 'circle', 'always');
insert into public.commune_vote_options(id, vote_post_id, option_label, display_order)
values
  ('ca400000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000009', 'First private choice', 1),
  ('ca400000-0000-4000-8000-000000000002', 'ca100000-0000-4000-8000-000000000009', 'Second private choice', 2);
insert into public.commune_official_updates(post_id, admin_user_id, summary, comments_enabled)
values ('ca100000-0000-4000-8000-000000000010', 'ca000000-0000-4000-8000-000000000001', 'Private official metadata.', true);

insert into storage.buckets(id, name, public)
values ('commune-media', 'commune-media', false)
on conflict (id) do nothing;
insert into public.commune_media(
  id, owner_user_id, post_id, storage_bucket, storage_path, file_name,
  mime_type, file_size, media_kind, visibility_state, warning_acknowledged
) values (
  'ca500000-0000-4000-8000-000000000001',
  'ca000000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000001',
  'commune-media', 'circle-fixture/private-note.txt', 'private-note.txt',
  'text/plain', 24, 'document', 'published', true
);
insert into storage.objects(id, bucket_id, name, owner_id)
values (
  'ca500000-0000-4000-8000-000000000002',
  'commune-media', 'circle-fixture/private-note.txt',
  'ca000000-0000-4000-8000-000000000001'
);

-- Code and sandbox sources remain inside the parent post ACL.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000001', true);
insert into public.commune_code_snippets(
  id, post_id, author_user_id, language, file_name, code_text,
  secret_scan_status, sandbox_warning_acknowledged
) values (
  'ca600000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000003', auth.uid(),
  'javascript', 'private.js', 'export const privateValue = 1;', 'passed', true
);
insert into public.commune_code_documents(
  id, owner_user_id, title, language, file_name, current_text,
  visibility_state, review_status, linked_commune_post_id
) values (
  'ca600000-0000-4000-8000-000000000002', auth.uid(), 'Private working document',
  'javascript', 'private.js', 'export const privateValue = 1;',
  'draft', 'draft', 'ca100000-0000-4000-8000-000000000003'
);
update public.commune_code_documents
set visibility_state = 'submitted', review_status = 'open_for_review'
where id = 'ca600000-0000-4000-8000-000000000002';

-- Selected participant can read, reply, react, save, follow, vote, annotate, and propose.
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000002', true);
do $circle_participant_complete_access$
declare v_count integer; v_proposal uuid;
begin
  select count(*) into v_count from public.commune_posts where audience = 'circle';
  if v_count <> 10 then raise exception 'selected participant saw % private posts instead of 10', v_count; end if;
  select count(*) into v_count from public.commune_threads where visibility = 'circle';
  if v_count <> 10 then raise exception 'selected participant saw % private threads instead of 10', v_count; end if;
  if (select count(*) from public.commune_troubleshooting_posts where post_id = 'ca100000-0000-4000-8000-000000000002') <> 1
     or (select count(*) from public.commune_repository_showcases where post_id = 'ca100000-0000-4000-8000-000000000004') <> 1
     or (select count(*) from public.commune_job_posts where post_id = 'ca100000-0000-4000-8000-000000000006') <> 1
     or (select count(*) from public.commune_research_notes where post_id = 'ca100000-0000-4000-8000-000000000007') <> 1
     or (select count(*) from public.commune_iteration_showcases where post_id = 'ca100000-0000-4000-8000-000000000008') <> 1
     or (select count(*) from public.commune_vote_posts where post_id = 'ca100000-0000-4000-8000-000000000009') <> 1
     or (select count(*) from public.commune_official_updates where post_id = 'ca100000-0000-4000-8000-000000000010') <> 1 then
    raise exception 'selected participant could not read every specialized sidecar (trouble %, repository %, job %, research %, iteration %, vote %, official %)',
      (select count(*) from public.commune_troubleshooting_posts where post_id = 'ca100000-0000-4000-8000-000000000002'),
      (select count(*) from public.commune_repository_showcases where post_id = 'ca100000-0000-4000-8000-000000000004'),
      (select count(*) from public.commune_job_posts where post_id = 'ca100000-0000-4000-8000-000000000006'),
      (select count(*) from public.commune_research_notes where post_id = 'ca100000-0000-4000-8000-000000000007'),
      (select count(*) from public.commune_iteration_showcases where post_id = 'ca100000-0000-4000-8000-000000000008'),
      (select count(*) from public.commune_vote_posts where post_id = 'ca100000-0000-4000-8000-000000000009'),
      (select count(*) from public.commune_official_updates where post_id = 'ca100000-0000-4000-8000-000000000010');
  end if;

  insert into public.commune_comments(
    id, thread_id, post_id, user_id, author_username, body, status, visibility_state, published_at
  ) values (
    'ca700000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000001', auth.uid(),
    'private-participant', 'Selected participant comment.', 'published', 'published', now()
  );
  insert into public.commune_comments(
    id, thread_id, post_id, parent_comment_id, user_id, author_username, body, status, visibility_state, published_at
  ) values (
    'ca700000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000001', auth.uid(),
    'private-participant', 'Selected participant reply.', 'published', 'published', now()
  );
  insert into public.commune_content_reactions(user_id, target_type, target_id, reaction)
  values (auth.uid(), 'post', 'ca100000-0000-4000-8000-000000000001', 'helpful');
  insert into public.user_saved_commune_posts(user_id, post_id)
  values (auth.uid(), 'ca100000-0000-4000-8000-000000000001');
  insert into public.user_followed_commune_threads(user_id, thread_id)
  values (auth.uid(), 'ca200000-0000-4000-8000-000000000001');
  insert into public.commune_vote_ballots(vote_post_id, option_id, voter_user_id)
  values ('ca100000-0000-4000-8000-000000000009', 'ca400000-0000-4000-8000-000000000001', auth.uid());
  select count(*) into v_count
  from public.commune_vote_result_summary(array['ca100000-0000-4000-8000-000000000009'::uuid]);
  if v_count <> 2 then raise exception 'private aggregate vote result unavailable: % result rows', v_count; end if;

  insert into public.commune_code_annotations(
    id, document_id, author_user_id, line_start, line_end, comment
  ) values (
    'ca600000-0000-4000-8000-000000000003',
    'ca600000-0000-4000-8000-000000000002', auth.uid(), 1, 1,
    'Selected participant annotation.'
  );
  insert into public.commune_code_sessions(id, document_id, room_slug, active_editor_user_id)
  values (
    'ca600000-0000-4000-8000-000000000004',
    'ca600000-0000-4000-8000-000000000002', 'coding-cornucopia', auth.uid()
  );
  v_proposal := public.submit_circle_code_revision_proposal_v2(
    'ca600000-0000-4000-8000-000000000005',
    'ca100000-0000-4000-8000-000000000003',
    'ca600000-0000-4000-8000-000000000001',
    'export const privateValue = 2;', 'javascript', 'private.js',
    'Change private fixture value.', 'Selected Circle collaboration.'
  );
  if v_proposal is null then raise exception 'Circle code proposal was not created'; end if;
end
$circle_participant_complete_access$;

insert into public.commune_sandbox_review_requests(
  id, user_id, submitted_by, post_id, request_title, title, summary,
  source_type, source_id, request_status, review_status,
  user_acknowledged_no_execution, user_acknowledged_no_secrets,
  user_acknowledged_local_elysia_final_authority
) values (
  'ca800000-0000-4000-8000-000000000001', auth.uid(), auth.uid(),
  'ca100000-0000-4000-8000-000000000003', 'Private sandbox collaboration',
  'Private sandbox collaboration', 'Selected Circle only.',
  'commune_post', 'ca100000-0000-4000-8000-000000000003',
  'submitted', 'pending_review', true, true, true
);

-- A participant may deliberately escalate a report. Staff can see this narrow
-- report record without receiving ambient access to the underlying private post.
insert into public.commune_reports(
  id, reporter_user_id, target_type, target_id, reason, details, status
) values (
  'ca710000-0000-4000-8000-000000000001', auth.uid(), 'post',
  'ca100000-0000-4000-8000-000000000006', 'privacy_safety',
  'Participant-supplied report context only; no private post body is copied here.',
  'submitted'
);

-- Circle membership later changing does not silently rewrite a post's stable ACL.
reset role;
update public.commons_circle_relationships
set status = 'removed', removed_at = now(), removed_by = 'ca000000-0000-4000-8000-000000000001'
where id = 'ca300000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000002', true);
do $circle_relationship_removal_preserves_post_acl$
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 10 then
    raise exception 'relationship removal silently rewrote established post ACLs';
  end if;
end
$circle_relationship_removal_preserves_post_acl$;

-- Unrelated members cannot discover or mutate Circle-private records by guessed IDs.
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000003', true);
do $circle_unrelated_hostile_requests$
declare v_count integer;
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 0 then raise exception 'unrelated member discovered private posts'; end if;
  if (select count(*) from public.commune_threads where visibility = 'circle') <> 0 then raise exception 'unrelated member discovered private threads'; end if;
  if (select count(*) from public.commune_post_circle_participants) <> 0 then raise exception 'unrelated member enumerated private participants'; end if;
  if (select count(*) from public.commune_media where id = 'ca500000-0000-4000-8000-000000000001') <> 0 then raise exception 'unrelated member discovered private attachment metadata'; end if;
  if (select count(*) from storage.objects where bucket_id = 'commune-media' and name = 'circle-fixture/private-note.txt') <> 0 then raise exception 'unrelated member discovered private attachment object'; end if;
  if (select count(*) from public.commune_comments where post_id = 'ca100000-0000-4000-8000-000000000001') <> 0 then raise exception 'unrelated member discovered private comments'; end if;
  if (select count(*) from public.commune_code_documents where id = 'ca600000-0000-4000-8000-000000000002') <> 0 then raise exception 'unrelated member discovered private code document'; end if;
  if (select count(*) from public.commune_sandbox_review_requests where id = 'ca800000-0000-4000-8000-000000000001') <> 0 then raise exception 'unrelated member discovered private sandbox request'; end if;
  if public.current_user_can_access_commune_post('ca100000-0000-4000-8000-000000000001') then raise exception 'unrelated member passed direct-post access helper'; end if;
  select count(*) into v_count
  from public.commune_vote_result_summary(array['ca100000-0000-4000-8000-000000000009'::uuid]);
  if v_count <> 0 then raise exception 'unrelated member discovered private vote results'; end if;

  begin
    insert into public.commune_comments(thread_id, post_id, user_id, body, status)
    values ('ca200000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001', auth.uid(), 'Hostile guessed comment.', 'published');
    raise exception 'unrelated member commented on private post';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.commune_content_reactions(user_id, target_type, target_id, reaction)
    values (auth.uid(), 'post', 'ca100000-0000-4000-8000-000000000001', 'helpful');
    raise exception 'unrelated member reacted to private post';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.user_saved_commune_posts(user_id, post_id)
    values (auth.uid(), 'ca100000-0000-4000-8000-000000000001');
    raise exception 'unrelated member saved private post';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.commune_vote_ballots(vote_post_id, option_id, voter_user_id)
    values ('ca100000-0000-4000-8000-000000000009', 'ca400000-0000-4000-8000-000000000002', auth.uid());
    raise exception 'unrelated member voted in private vote';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.commune_reports(reporter_user_id, target_type, target_id, reason, details)
    values (auth.uid(), 'post', 'ca100000-0000-4000-8000-000000000006', 'guessed_id', 'Must fail.');
    raise exception 'unrelated member reported a guessed private post';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.add_commune_post_circle_participants(
      'ca100000-0000-4000-8000-000000000001',
      array['ca300000-0000-4000-8000-000000000001'::uuid]
    );
    raise exception 'unrelated member changed private participants';
  exception when sqlstate '42501' then null;
  end;
end
$circle_unrelated_hostile_requests$;

-- Administrator and reviewer roles are not ambient private readers.
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000004', true);
do $circle_admin_no_ambient_content_access$
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 0 then raise exception 'nonparticipant administrator read private posts'; end if;
  if (select count(*) from public.commune_comments where post_id = 'ca100000-0000-4000-8000-000000000001') <> 0 then raise exception 'nonparticipant administrator read private comments'; end if;
  if (select count(*) from public.commune_code_revision_proposals where post_id = 'ca100000-0000-4000-8000-000000000003') <> 0 then raise exception 'nonparticipant administrator read private code proposal'; end if;
  if (select count(*) from public.commune_reports where id = 'ca710000-0000-4000-8000-000000000001') <> 1 then raise exception 'administrator could not see narrow private-content report metadata'; end if;
end
$circle_admin_no_ambient_content_access$;

select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000005', true);
do $circle_reviewer_no_ambient_content_access$
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 0 then raise exception 'nonparticipant reviewer read private posts'; end if;
  if (select count(*) from public.commune_job_posts where post_id = 'ca100000-0000-4000-8000-000000000006') <> 0 then raise exception 'nonparticipant reviewer read private Job metadata'; end if;
  if (select count(*) from public.commune_sandbox_review_requests where id = 'ca800000-0000-4000-8000-000000000001') <> 0 then raise exception 'nonparticipant reviewer read private sandbox request'; end if;
  if (select count(*) from public.commune_reports where id = 'ca710000-0000-4000-8000-000000000001') <> 0 then raise exception 'unassigned reviewer unexpectedly read private-content report metadata'; end if;
end
$circle_reviewer_no_ambient_content_access$;

reset role;
do $circle_sandbox_source_acl$
begin
  if not private.sandbox_source_is_authorized(
    'ca000000-0000-4000-8000-000000000002', 'commune_post_snippet',
    'ca600000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000003', null, null
  ) then raise exception 'selected participant was denied private sandbox source'; end if;
  if private.sandbox_source_is_authorized(
    'ca000000-0000-4000-8000-000000000003', 'commune_post_snippet',
    'ca600000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000003', null, null
  ) then raise exception 'unrelated member was authorized for private sandbox source'; end if;
  if private.sandbox_source_is_authorized(
    'ca000000-0000-4000-8000-000000000004', 'commune_post_snippet',
    'ca600000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000003', null, null
  ) then raise exception 'administrator role bypassed private sandbox source ACL'; end if;
  if private.sandbox_source_is_authorized(
    'ca000000-0000-4000-8000-000000000005', 'commune_post_snippet',
    'ca600000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000003', null, null
  ) then raise exception 'reviewer role bypassed private sandbox source ACL'; end if;
end
$circle_sandbox_source_acl$;

-- Anonymous users remain public-only.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $circle_anonymous_no_access$
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 0 then raise exception 'anonymous reader discovered private posts'; end if;
  if public.current_user_can_access_commune_post('ca100000-0000-4000-8000-000000000001') then raise exception 'anonymous reader passed direct-post access helper'; end if;
  begin
    insert into public.commune_reports(reporter_user_id, target_type, target_id, reason, details)
    values (null, 'post', 'ca100000-0000-4000-8000-000000000006', 'guessed_id', 'Must fail.');
    raise exception 'anonymous reader reported a guessed private post';
  exception when sqlstate '42501' then null;
  end;
end
$circle_anonymous_no_access$;

-- Notification copy is generic and only the selected recipient receives it.
reset role;
do $circle_notification_privacy$
declare v_count integer;
begin
  select count(*) into v_count from public.account_notifications
  where source_domain = 'commune'
    and source_type = 'commune_post'
    and source_record_id::text like 'ca100000-0000-4000-8000-%'
    and recipient_user_id = 'ca000000-0000-4000-8000-000000000002'
    and safe_preview = 'A mutual Circle member shared a private room post with you.'
    and safe_title = 'Added to a private Commune post';
  if v_count <> 10 then raise exception 'expected ten generic participant notifications, found %', v_count; end if;
  if exists (
    select 1 from public.account_notifications
    where source_domain = 'commune'
      and source_type = 'commune_post'
      and source_record_id::text like 'ca100000-0000-4000-8000-%'
      and recipient_user_id <> 'ca000000-0000-4000-8000-000000000002'
  ) then raise exception 'private post notification leaked to a nonparticipant'; end if;
end
$circle_notification_privacy$;

-- Explicit removal from one post revokes every inherited surface for that post.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000001', true);
select public.remove_commune_post_circle_participant(id)
from public.commune_post_circle_participants
where post_id = 'ca100000-0000-4000-8000-000000000001'
  and participant_user_id = 'ca000000-0000-4000-8000-000000000002'
  and removed_at is null;

select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000002', true);
do $circle_explicit_removal_revokes_access$
begin
  if (select count(*) from public.commune_posts where audience = 'circle') <> 9 then raise exception 'explicit participant removal did not revoke exactly one post'; end if;
  if (select count(*) from public.commune_comments where post_id = 'ca100000-0000-4000-8000-000000000001') <> 0 then raise exception 'removed participant retained private comment access'; end if;
  if (select count(*) from public.commune_media where post_id = 'ca100000-0000-4000-8000-000000000001') <> 0 then raise exception 'removed participant retained attachment metadata access'; end if;
  if (select count(*) from storage.objects where bucket_id = 'commune-media' and name = 'circle-fixture/private-note.txt') <> 0 then raise exception 'removed participant retained attachment object access'; end if;
end
$circle_explicit_removal_revokes_access$;

-- Public posts remain unchanged and publicly discoverable.
reset role;
insert into public.commune_posts(
  id, user_id, author_username, post_type, title, body,
  audience, visibility, status, moderation_status, visibility_state, published_at
) values (
  'ca900000-0000-4000-8000-000000000001',
  'ca000000-0000-4000-8000-000000000001', 'private-owner', 'media_garden',
  'Public compatibility fixture', 'Public behavior remains unchanged.',
  'public', 'public', 'published', 'approved', 'published', now()
);
set local role anon;
insert into public.commune_reports(
  id, reporter_user_id, target_type, target_id, reason, details, status
) values (
  'ca910000-0000-4000-8000-000000000001', null, 'post',
  'ca900000-0000-4000-8000-000000000001', 'public_compatibility',
  'Anonymous public reporting remains available.', 'submitted'
);
do $circle_public_compatibility$
begin
  if (select count(*) from public.commune_posts where id = 'ca900000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'public post compatibility regressed';
  end if;
end
$circle_public_compatibility$;

reset role;
select 'commune_circle_private_behavior_ok' as result;
rollback;

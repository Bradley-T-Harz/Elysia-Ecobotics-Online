\set ON_ERROR_STOP on

-- Synthetic identities and message bodies only. The entire fixture rolls back.
begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'message-sender@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'message-recipient@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'message-unrelated@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'message-restricted@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000005', 'message-admin@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000006', 'message-reviewer@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000007', 'message-moderator@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000008', 'message-opted-out@example.invalid', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000009', 'message-unpublished@example.invalid', now(), now(), now());

insert into public.profiles(
  id, username, display_name, commons_onboarding_completed_at, is_admin
)
values
  ('b1000000-0000-4000-8000-000000000001', 'message-sender', 'Message Sender', now(), false),
  ('b1000000-0000-4000-8000-000000000002', 'message-recipient', 'Message Recipient', now(), false),
  ('b1000000-0000-4000-8000-000000000003', 'message-unrelated', 'Message Recipient Alternate', now(), false),
  ('b1000000-0000-4000-8000-000000000004', 'message-restricted', 'Message Restricted', now(), false),
  ('b1000000-0000-4000-8000-000000000005', 'message-admin', 'Message Admin', now(), true),
  ('b1000000-0000-4000-8000-000000000006', 'message-reviewer', 'Message Reviewer', now(), false),
  ('b1000000-0000-4000-8000-000000000007', 'message-moderator', 'Message Moderator', now(), false),
  ('b1000000-0000-4000-8000-000000000008', 'message-opted-out', 'Message Opted Out', now(), false),
  ('b1000000-0000-4000-8000-000000000009', 'message-unpublished', 'Message Unpublished', null, false);

insert into private.account_participation(
  user_id, participation_state, age_band, assurance_status
)
values
  ('b1000000-0000-4000-8000-000000000001', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000002', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000003', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000004', 'restricted', '18_plus', 'restricted'),
  ('b1000000-0000-4000-8000-000000000005', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000006', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000007', 'adult_eligible', '18_plus', 'self_attested'),
  ('b1000000-0000-4000-8000-000000000008', 'adult_eligible', '18_plus', 'self_attested')
on conflict (user_id) do update
set participation_state = excluded.participation_state,
    age_band = excluded.age_band,
    assurance_status = excluded.assurance_status,
    updated_at = now();

insert into public.user_roles(user_id, role, granted_by, reason)
values
  ('b1000000-0000-4000-8000-000000000006', 'reviewer', 'b1000000-0000-4000-8000-000000000005', 'Synthetic messaging fixture role'),
  ('b1000000-0000-4000-8000-000000000007', 'moderator', 'b1000000-0000-4000-8000-000000000005', 'Synthetic messaging fixture role');

insert into public.account_messaging_preferences(
  user_id, receive_direct_requests, receive_optional_announcements,
  allow_source_linked_messages
)
values
  ('b1000000-0000-4000-8000-000000000001', false, true, true),
  ('b1000000-0000-4000-8000-000000000002', true, true, true),
  ('b1000000-0000-4000-8000-000000000003', true, false, true),
  ('b1000000-0000-4000-8000-000000000005', false, true, true),
  ('b1000000-0000-4000-8000-000000000008', false, false, true);

insert into public.commune_posts(
  id, user_id, post_type, title, body, status, visibility
) values (
  'b1010000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'code_sharing', 'Synthetic messaging source', 'Synthetic public body.',
  'published', 'public'
);
insert into public.commune_code_snippets(
  id, post_id, author_user_id, language, file_name, code_text
) values (
  'b1020000-0000-4000-8000-000000000001',
  'b1010000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'text', 'synthetic.txt', 'published synthetic text'
);
insert into public.commune_code_revision_proposals(
  id, client_request_id, post_id, code_snippet_id, proposer_user_id,
  original_author_user_id, base_code_text, proposed_code_text,
  change_summary, proposal_status
) values (
  'b1030000-0000-4000-8000-000000000001',
  'b1040000-0000-4000-8000-000000000001',
  'b1010000-0000-4000-8000-000000000001',
  'b1020000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  'published synthetic text', 'proposed synthetic text',
  'Synthetic source-linked messaging proposal.', 'submitted'
);

do $account_messaging_catalog$
begin
  if pg_catalog.has_table_privilege('authenticated', 'private.account_messages', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'private.account_messages', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'private.account_conversations', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'private.account_conversation_reports', 'SELECT') then
    raise exception 'account_messaging_private_table_grant_present';
  end if;
  if not pg_catalog.has_function_privilege(
    'authenticated', 'public.request_account_conversation(text,text,text,uuid,uuid)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated', 'public.resolve_account_messaging_destination(text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated', 'private.create_account_conversation_message(uuid,uuid,text,text,uuid,boolean,text,text,integer)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated', 'private.account_direct_request_decline_cooldown_active(uuid,text)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated', 'public.search_public_commons_message_profiles_for_actor(uuid,text,integer)', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role', 'public.search_public_commons_message_profiles_for_actor(uuid,text,integer)', 'EXECUTE'
  ) then
    raise exception 'account_messaging_rpc_grant_contract_failed';
  end if;
end
$account_messaging_catalog$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $account_messaging_sender$
declare
  v_lookup jsonb;
  v_preferences jsonb;
  v_destination jsonb;
  v_created jsonb;
  v_replay jsonb;
  v_source jsonb;
  v_source_replay jsonb;
begin
  v_preferences := public.current_user_messaging_preferences();
  if (v_preferences->>'receiveDirectRequests')::boolean is not false
     or (v_preferences->>'acceptsIncomingDirectRequests')::boolean is not false
     or (v_preferences->>'broadMessagingEligibility')::boolean is not true
     or (v_preferences->>'canInitiateDirectConversation')::boolean is not true
     or (v_preferences->>'canUseExistingConversations')::boolean is not true
     or (v_preferences->>'ordinaryMessagingEligible')::boolean is not true
     or v_preferences->>'currentPublicHandle' <> 'message-sender' then
    raise exception 'account_messaging_sender_capabilities_conflated: %', v_preferences;
  end if;
  v_destination := public.resolve_account_messaging_destination('@@MESSAGE-RECIPIENT');
  if v_destination->>'state' <> 'can_request'
     or v_destination #>> '{profile,handle}' <> 'message-recipient'
     or v_destination ? 'deepLink'
     or v_destination::text ~* '(email|userId|accountId|blocked|restricted|guardian)'
     or v_destination::text like '%b1000000-0000-4000-8000-000000000002%' then
    raise exception 'account_messaging_destination_can_request_failed_or_leaked: %', v_destination;
  end if;
  foreach v_destination in array array[
    public.resolve_account_messaging_destination('@message-sender'),
    public.resolve_account_messaging_destination('@unknown-public-handle'),
    public.resolve_account_messaging_destination('@message-opted-out'),
    public.resolve_account_messaging_destination('@message-restricted')
  ] loop
    if v_destination <> '{"state":"unavailable"}'::jsonb then
      raise exception 'account_messaging_destination_unavailable_oracle: %', v_destination;
    end if;
  end loop;
  v_lookup := public.lookup_account_messaging_recipient('@message-recipient');
  if (v_lookup->>'found')::boolean is not true
     or (v_lookup->>'canReceiveRequest')::boolean is not true
     or v_lookup #>> '{profile,handle}' <> 'message-recipient'
     or v_lookup ? 'userId'
     or v_lookup::text like '%b1000000-0000-4000-8000-000000000002%'
     or v_lookup::text ~* 'email' then
    raise exception 'account_messaging_lookup_leaked_or_failed: %', v_lookup;
  end if;
  v_created := public.request_account_conversation(
    'message-recipient', 'Synthetic professional request',
    'SYNTHETIC_PRIVATE_FIRST_MESSAGE',
    'b1100000-0000-4000-8000-000000000001',
    'b1200000-0000-4000-8000-000000000001'
  );
  v_replay := public.request_account_conversation(
    'message-recipient', 'Synthetic professional request',
    'SYNTHETIC_PRIVATE_FIRST_MESSAGE',
    'b1100000-0000-4000-8000-000000000001',
    'b1200000-0000-4000-8000-000000000001'
  );
  if v_created->>'conversationId' is distinct from v_replay->>'conversationId' then
    raise exception 'account_conversation_request_idempotency_failed';
  end if;
  v_destination := public.resolve_account_messaging_destination('@message-recipient');
  if v_destination->>'state' <> 'existing_pending_outbound'
     or v_destination->>'deepLink' <> ('/commons-circle/signals/inbox/conversations/' || (v_created->>'conversationId'))
     or v_destination::text ~* '(email|userId|accountId|blocked|restricted|guardian)' then
    raise exception 'account_messaging_destination_outbound_pending_failed_or_leaked: %', v_destination;
  end if;
  begin
    perform public.request_account_conversation(
      'message-recipient', 'Synthetic professional request',
      'CHANGED_PRIVATE_BODY_MUST_CONFLICT',
      'b1100000-0000-4000-8000-000000000001',
      'b1200000-0000-4000-8000-000000000001'
    );
    raise exception 'account_conversation_changed_replay_was_accepted';
  exception when unique_violation then
    if sqlerrm <> 'account_conversation_idempotency_conflict' then raise; end if;
  end;
  perform pg_catalog.set_config(
    'fixture.account_conversation_id', v_created->>'conversationId', true
  );
  v_source := public.start_source_linked_account_conversation(
    'code_proposals', 'commune_code_revision_proposal',
    'b1030000-0000-4000-8000-000000000001',
    'Synthetic proposal discussion', 'SYNTHETIC_PRIVATE_SOURCE_MESSAGE',
    'b1100000-0000-4000-8000-000000000003',
    'b1200000-0000-4000-8000-000000000005'
  );
  v_source_replay := public.start_source_linked_account_conversation(
    'code_proposals', 'commune_code_revision_proposal',
    'b1030000-0000-4000-8000-000000000001',
    'Synthetic proposal discussion', 'SYNTHETIC_PRIVATE_SOURCE_MESSAGE',
    'b1100000-0000-4000-8000-000000000003',
    'b1200000-0000-4000-8000-000000000005'
  );
  if v_source->>'conversationId' is distinct from v_source_replay->>'conversationId' then
    raise exception 'source_conversation_idempotency_failed';
  end if;
  perform pg_catalog.set_config(
    'fixture.account_source_conversation_id', v_source->>'conversationId', true
  );
  begin
    perform public.request_account_conversation(
      'message-recipient', 'Unsafe request', '<script>alert(1)</script>',
      'b1100000-0000-4000-8000-000000000002',
      'b1200000-0000-4000-8000-000000000002'
    );
    raise exception 'account_message_raw_html_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'account_private_messaging_not_allowed' then raise; end if;
  end;
end
$account_messaging_sender$;

reset role;
set role service_role;
do $account_messaging_profile_search$
declare
  v_empty jsonb;
  v_exact jsonb;
  v_name jsonb;
  v_restricted jsonb;
  v_unpublished jsonb;
begin
  v_empty := public.search_public_commons_message_profiles_for_actor(
    'b1000000-0000-4000-8000-000000000001', 'me', 8
  );
  if pg_catalog.jsonb_array_length(v_empty->'items') <> 0 then
    raise exception 'account_messaging_profile_search_minimum_failed: %', v_empty;
  end if;

  v_exact := public.search_public_commons_message_profiles_for_actor(
    'b1000000-0000-4000-8000-000000000001', '@MESSAGE-RECIPIENT', 99
  );
  if v_exact->>'minimumQueryLength' <> '3'
     or v_exact->>'resultLimit' <> '8'
     or pg_catalog.jsonb_array_length(v_exact->'items') < 1
     or pg_catalog.jsonb_array_length(v_exact->'items') > 8
     or v_exact #>> '{items,0,handle}' <> 'message-recipient'
     or v_exact::text ~* '(email|userId|accountId|profileId|blocked|restricted|guardian|moderation)'
     or v_exact::text like '%b1000000-0000-4000-8000-000000000002%' then
    raise exception 'account_messaging_profile_search_exact_failed_or_leaked: %', v_exact;
  end if;

  v_name := public.search_public_commons_message_profiles_for_actor(
    'b1000000-0000-4000-8000-000000000001', 'Message Recip', 8
  );
  if v_name #>> '{items,0,handle}' <> 'message-recipient'
     or v_name #>> '{items,1,handle}' <> 'message-unrelated'
     or pg_catalog.jsonb_array_length(v_name->'items') > 8 then
    raise exception 'account_messaging_profile_search_name_or_limit_failed: %', v_name;
  end if;

  v_unpublished := public.search_public_commons_message_profiles_for_actor(
    'b1000000-0000-4000-8000-000000000001', 'unpublished', 8
  );
  if pg_catalog.jsonb_array_length(v_unpublished->'items') <> 0 then
    raise exception 'unpublished_account_messaging_profile_search_leaked: %', v_unpublished;
  end if;

  v_restricted := public.search_public_commons_message_profiles_for_actor(
    'b1000000-0000-4000-8000-000000000004', 'message', 8
  );
  if pg_catalog.jsonb_array_length(v_restricted->'items') <> 0 then
    raise exception 'restricted_account_messaging_profile_search_not_blocked: %', v_restricted;
  end if;
end
$account_messaging_profile_search$;

reset role;
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

do $account_messaging_unrelated$
declare v_conversation_id uuid; v_list jsonb;
begin
  v_conversation_id := pg_catalog.current_setting(
    'fixture.account_conversation_id'
  )::uuid;
  v_list := public.current_user_conversations('all', 30, null, null);
  if pg_catalog.jsonb_array_length(v_list->'items') <> 0 then
    raise exception 'unrelated_account_listed_private_conversation';
  end if;
  begin
    perform public.current_user_conversation(v_conversation_id, 100, null, null);
    raise exception 'unrelated_account_read_private_conversation';
  exception when no_data_found then null;
  end;
  begin
    perform public.send_account_conversation_message(
      v_conversation_id, 'Unauthorized message', gen_random_uuid()
    );
    raise exception 'unrelated_account_sent_private_message';
  exception when insufficient_privilege then null;
  end;
end
$account_messaging_unrelated$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $account_messaging_decline_cooldown_create$
declare v_created jsonb;
begin
  v_created := public.request_account_conversation(
    'message-unrelated', 'Synthetic cooldown request',
    'SYNTHETIC_PRIVATE_COOLDOWN_MESSAGE',
    'b1100000-0000-4000-8000-000000000008',
    'b1200000-0000-4000-8000-000000000008'
  );
  perform pg_catalog.set_config(
    'fixture.account_cooldown_conversation_id', v_created->>'conversationId', true
  );
end
$account_messaging_decline_cooldown_create$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

select public.respond_to_account_conversation_request(
  pg_catalog.current_setting('fixture.account_cooldown_conversation_id')::uuid,
  'decline',
  'b1300000-0000-4000-8000-000000000008'
);

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $account_messaging_decline_cooldown_enforced$
declare v_destination jsonb;
begin
  v_destination := public.resolve_account_messaging_destination('@message-unrelated');
  if v_destination <> '{"state":"unavailable"}'::jsonb then
    raise exception 'account_messaging_decline_cooldown_oracle: %', v_destination;
  end if;
  begin
    perform public.request_account_conversation(
      'message-unrelated', 'Synthetic cooldown retry',
      'SYNTHETIC_PRIVATE_COOLDOWN_RETRY',
      'b1100000-0000-4000-8000-000000000009',
      'b1200000-0000-4000-8000-000000000009'
    );
    raise exception 'account_messaging_decline_cooldown_not_enforced';
  exception when no_data_found then
    if sqlerrm <> 'account_messaging_recipient_unavailable' then raise; end if;
  end;
end
$account_messaging_decline_cooldown_enforced$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}', false);

do $account_messaging_restricted$
declare v_destination jsonb;
begin
  if (public.current_user_messaging_preferences()->>'ordinaryMessagingEligible')::boolean is not false then
    raise exception 'restricted_account_was_messaging_eligible';
  end if;
  begin
    perform public.update_current_user_messaging_preferences(true, false, true, 0);
    raise exception 'restricted_account_enabled_direct_requests';
  exception when insufficient_privilege then null;
  end;
  v_destination := public.resolve_account_messaging_destination('@message-recipient');
  if v_destination <> '{"state":"unavailable"}'::jsonb then
    raise exception 'restricted_sender_messaging_destination_oracle: %', v_destination;
  end if;
end
$account_messaging_restricted$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $account_messaging_recipient$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_list jsonb;
  v_detail jsonb;
  v_counts jsonb;
  v_report jsonb;
  v_destination jsonb;
  v_source_conversation_id uuid;
  v_source_detail jsonb;
begin
  v_conversation_id := pg_catalog.current_setting(
    'fixture.account_conversation_id'
  )::uuid;
  v_source_conversation_id := pg_catalog.current_setting(
    'fixture.account_source_conversation_id'
  )::uuid;
  v_list := public.current_user_conversations('requests', 30, null, null);
  if pg_catalog.jsonb_array_length(v_list->'items') <> 1
     or (v_list #>> '{items,0,incomingRequest}')::boolean is not true then
    raise exception 'conversation_request_not_visible_to_recipient: %', v_list;
  end if;
  v_destination := public.resolve_account_messaging_destination('@message-sender');
  if v_destination->>'state' <> 'existing_pending_inbound'
     or v_destination->>'deepLink' <> ('/commons-circle/signals/inbox/conversations/' || v_conversation_id::text) then
    raise exception 'account_messaging_destination_inbound_pending_failed: %', v_destination;
  end if;
  perform public.respond_to_account_conversation_request(
    v_conversation_id, 'accept', 'b1300000-0000-4000-8000-000000000001'
  );
  v_message_id := (public.send_account_conversation_message(
    v_conversation_id, 'SYNTHETIC_PRIVATE_RECIPIENT_REPLY',
    'b1200000-0000-4000-8000-000000000003'
  )->>'messageId')::uuid;
  v_detail := public.current_user_conversation(v_conversation_id, 100, null, null);
  if v_detail #>> '{conversation,state}' <> 'active'
     or v_detail::text not like '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%'
     or v_detail::text not like '%SYNTHETIC_PRIVATE_RECIPIENT_REPLY%'
     or v_detail #> '{conversation,sourceRecordId}' is not null
     or (v_detail #>> '{privacy,endToEndEncrypted}')::boolean is not false then
    raise exception 'participant_conversation_detail_failed: %', v_detail;
  end if;
  v_destination := public.resolve_account_messaging_destination('@message-sender');
  if v_destination->>'state' <> 'existing_active' then
    raise exception 'account_messaging_destination_active_recipient_failed: %', v_destination;
  end if;
  perform public.mark_current_user_conversation_read(v_conversation_id);
  v_source_detail := public.current_user_conversation(
    v_source_conversation_id, 100, null, null
  );
  if v_source_detail #>> '{conversation,sourceDomain}' <> 'code_proposals'
     or v_source_detail #>> '{conversation,sourceType}' <> 'commune_code_revision_proposal'
     or v_source_detail::text not like '%SYNTHETIC_PRIVATE_SOURCE_MESSAGE%'
     or v_source_detail #> '{conversation,sourceRecordId}' is not null then
    raise exception 'source_linked_conversation_contract_failed: %', v_source_detail;
  end if;
  perform public.mark_current_user_conversation_read(v_source_conversation_id);
  v_report := public.report_account_conversation(
    v_conversation_id, v_message_id, 'spam', 'Synthetic report detail.',
    'b1400000-0000-4000-8000-000000000001'
  );
  if v_report->>'caseId' is null then
    raise exception 'account_conversation_report_case_missing';
  end if;
  perform pg_catalog.set_config(
    'fixture.account_message_case_id', v_report->>'caseId', true
  );
  v_counts := public.current_user_event_counts();
  if (v_counts->>'messagesUnread')::integer <> 0 then
    raise exception 'conversation_read_did_not_clear_message_projection';
  end if;
end
$account_messaging_recipient$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $account_messaging_sender_reply_and_block$
declare v_conversation_id uuid; v_counts jsonb; v_destination jsonb;
begin
  v_conversation_id := pg_catalog.current_setting(
    'fixture.account_conversation_id'
  )::uuid;
  v_counts := public.current_user_event_counts();
  if (v_counts->>'messagesUnread')::integer <> 1 then
    raise exception 'incoming_private_message_exact_count_failed: %', v_counts;
  end if;
  v_destination := public.resolve_account_messaging_destination('@message-recipient');
  if v_destination->>'state' <> 'existing_active' then
    raise exception 'account_messaging_destination_active_sender_failed: %', v_destination;
  end if;
  perform public.set_account_conversation_block(
    v_conversation_id, true, 'b1500000-0000-4000-8000-000000000001'
  );
  begin
    perform public.send_account_conversation_message(
      v_conversation_id, 'Blocked follow-up', gen_random_uuid()
    );
    raise exception 'blocked_conversation_accepted_message';
  exception when object_not_in_prerequisite_state then null;
  end;
  v_destination := public.resolve_account_messaging_destination('@message-recipient');
  if v_destination <> '{"state":"unavailable"}'::jsonb then
    raise exception 'account_messaging_destination_block_oracle: %', v_destination;
  end if;
end
$account_messaging_sender_reply_and_block$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000006', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000006","role":"authenticated"}', false);

do $account_messaging_generic_reviewer_denied$
declare v_case_id uuid;
begin
  v_case_id := pg_catalog.current_setting('fixture.account_message_case_id')::uuid;
  begin
    perform public.current_account_message_moderation_queue();
    raise exception 'generic_reviewer_inherited_message_moderation_access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.read_reported_account_message_evidence(v_case_id);
    raise exception 'generic_reviewer_read_reported_message';
  exception when insufficient_privilege then null;
  end;
end
$account_messaging_generic_reviewer_denied$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000007', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000007","role":"authenticated"}', false);

do $account_messaging_moderator_case_access$
declare v_case_id uuid; v_evidence jsonb;
begin
  v_case_id := pg_catalog.current_setting('fixture.account_message_case_id')::uuid;
  perform public.claim_account_message_moderation_case(
    v_case_id, 'b1600000-0000-4000-8000-000000000001'
  );
  v_evidence := public.read_reported_account_message_evidence(v_case_id);
  if v_evidence::text not like '%SYNTHETIC_PRIVATE_RECIPIENT_REPLY%'
     or v_evidence::text like '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%'
     or v_evidence->>'scopeNotice' is null then
    raise exception 'reported_message_case_scope_failed: %', v_evidence;
  end if;
  perform public.resolve_account_message_moderation_case(
    v_case_id, 'no_action', false,
    'b1600000-0000-4000-8000-000000000002'
  );
end
$account_messaging_moderator_case_access$;

select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000005', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000005","role":"authenticated"}', false);

do $account_messaging_admin$
declare
  v_admin_message jsonb;
  v_draft jsonb;
  v_sent jsonb;
begin
  v_admin_message := public.admin_send_account_message(
    'message-recipient', 'Synthetic account action',
    'SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY', 'required_action',
    'b1700000-0000-4000-8000-000000000001',
    'b1200000-0000-4000-8000-000000000004'
  );
  if v_admin_message->>'conversationId' is null then
    raise exception 'admin_required_action_projection_failed';
  end if;
  begin
    perform public.admin_send_account_message(
      'message-recipient', 'Synthetic account action',
      'CHANGED_ADMIN_BODY_MUST_CONFLICT', 'required_action',
      'b1700000-0000-4000-8000-000000000001',
      'b1200000-0000-4000-8000-000000000004'
    );
    raise exception 'admin_message_changed_replay_was_accepted';
  exception when unique_violation then
    if sqlerrm <> 'account_conversation_idempotency_conflict' then raise; end if;
  end;
  perform pg_catalog.set_config(
    'fixture.account_admin_conversation_id',
    v_admin_message->>'conversationId', true
  );

  v_draft := public.prepare_admin_account_announcement(
    'Synthetic opted-in announcement', 'SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY',
    'explicit_opted_in_handles', array['message-recipient'],
    'b1800000-0000-4000-8000-000000000001'
  );
  if (v_draft->>'recipientCount')::integer <> 1 then
    raise exception 'announcement_preview_count_failed: %', v_draft;
  end if;
  begin
    perform public.send_admin_account_announcement(
      (v_draft->>'draftId')::uuid, 1, 'SEND WRONG'
    );
    raise exception 'announcement_sent_without_exact_confirmation';
  exception when invalid_parameter_value then null;
  end;
  v_sent := public.send_admin_account_announcement(
    (v_draft->>'draftId')::uuid, 1, v_draft->>'confirmationPhrase'
  );
  if (v_sent->>'recipientCount')::integer <> 1 then
    raise exception 'announcement_delivery_or_privacy_failed';
  end if;
  perform pg_catalog.set_config(
    'fixture.account_announcement_id', v_draft->>'draftId', true
  );
end
$account_messaging_admin$;

reset role;

do $account_messaging_privileged_verification$
declare
  v_case_id uuid := pg_catalog.current_setting('fixture.account_message_case_id')::uuid;
  v_announcement_id uuid := pg_catalog.current_setting('fixture.account_announcement_id')::uuid;
begin
  if (select pg_catalog.count(*) from private.account_conversations
      where creation_client_request_id = 'b1100000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'account_conversation_request_idempotency_row_count_failed';
  end if;
  if exists (
    select 1 from private.account_events
    where safe_title like any(array[
      '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%',
      '%SYNTHETIC_PRIVATE_SOURCE_MESSAGE%',
      '%SYNTHETIC_PRIVATE_COOLDOWN_MESSAGE%',
      '%SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY%',
      '%SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY%'
    ]) or safe_preview like any(array[
      '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%',
      '%SYNTHETIC_PRIVATE_SOURCE_MESSAGE%',
      '%SYNTHETIC_PRIVATE_COOLDOWN_MESSAGE%',
      '%SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY%',
      '%SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY%'
    ]) or safe_payload::text like any(array[
      '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%',
      '%SYNTHETIC_PRIVATE_SOURCE_MESSAGE%',
      '%SYNTHETIC_PRIVATE_COOLDOWN_MESSAGE%',
      '%SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY%',
      '%SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY%'
    ])
  ) or exists (
    select 1 from public.account_inbox_items
    where safe_preview like any(array[
      '%SYNTHETIC_PRIVATE_FIRST_MESSAGE%',
      '%SYNTHETIC_PRIVATE_SOURCE_MESSAGE%',
      '%SYNTHETIC_PRIVATE_COOLDOWN_MESSAGE%',
      '%SYNTHETIC_PRIVATE_ADMIN_REQUIRED_BODY%',
      '%SYNTHETIC_PRIVATE_ANNOUNCEMENT_BODY%'
    ])
  ) then
    raise exception 'account_message_body_leaked_into_event_projection';
  end if;
  if not exists (
    select 1 from private.account_conversation_audit_events
    where case_id = v_case_id and action = 'reported_message_evidence_accessed'
  ) then
    raise exception 'reported_message_evidence_access_not_audited';
  end if;
  if not exists (
    select 1 from public.account_inbox_items as item
    join private.account_events as event on event.id = item.event_id
    where item.recipient_user_id = 'b1000000-0000-4000-8000-000000000002'
      and item.projection_kind = 'required_action'
      and event.delivery_class = 'mandatory'
  ) or not exists (
    select 1 from private.account_announcement_deliveries
    where announcement_id = v_announcement_id
  ) then
    raise exception 'account_admin_delivery_contract_failed';
  end if;
end
$account_messaging_privileged_verification$;

-- Recipient lifecycle removes private projections/participation while retained
-- audit and sender tombstones remain coherent.
delete from auth.users where id = 'b1000000-0000-4000-8000-000000000002';
do $account_messaging_lifecycle$
begin
  if exists (
    select 1 from private.account_conversation_participants
    where user_id = 'b1000000-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.account_inbox_items
    where recipient_user_id = 'b1000000-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.account_messaging_preferences
    where user_id = 'b1000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'account_messaging_recipient_lifecycle_cleanup_failed';
  end if;
end
$account_messaging_lifecycle$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
do $account_messaging_deleted_destination$
declare v_destination jsonb;
begin
  v_destination := public.resolve_account_messaging_destination('@message-recipient');
  if v_destination <> '{"state":"unavailable"}'::jsonb then
    raise exception 'deleted_account_messaging_destination_oracle: %', v_destination;
  end if;
end
$account_messaging_deleted_destination$;
reset role;

rollback;

select 'account_messaging_behavior_ok' as result;

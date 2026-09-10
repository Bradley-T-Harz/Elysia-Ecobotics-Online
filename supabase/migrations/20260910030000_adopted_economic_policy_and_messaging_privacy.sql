begin;
-- Append a new policy decision; historical proposals remain proposals forever.
create table private.economic_owner_policy_versions (
 version text primary key,
 adopted_at timestamptz not null default now(),
 authority_record text not null,
 policy jsonb not null
);
alter table private.economic_owner_policy_versions owner to postgres;
alter table private.economic_owner_policy_versions enable row level security;
revoke all on private.economic_owner_policy_versions from public,anon,authenticated,service_role;
create trigger economic_owner_policy_append_only before update or delete on private.economic_owner_policy_versions for each row execute function private.prevent_economic_history_mutation();
insert into private.economic_owner_policy_versions(version,authority_record,policy) values(
 '2026-09-10-owner-decisions','Owner-approved Codex EcoSyneva Owner Decisions Implementation Brief, 2026-09-10',
 '{"marketplaceFeeBps":500,"freeMarketplaceFeeBps":0,"buyerConvenienceFeeMinor":0,"commercialJobPostFeeMinor":1000,"currency":"usd","jobPostCollectionPoint":"after_content_approval_before_publication","proofRetentionDaysAfterFinalReviewOrAppeal":30,"messagingDeclineCooldownDays":30,"supportGrantsPersonalCompute":false,"foregoneFeeWaiverCashBudgetRequired":false,"providerModelPreference":"creator_as_seller_direct_charge","providerModelApproved":false,"processorFeeAllocation":"provider_dependent","taxCollectionAndRemittance":"provider_and_accounting_dependent","financialActivation":false}'
);
create function public.current_economic_owner_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select policy || jsonb_build_object('version',version) from private.economic_owner_policy_versions where version='2026-09-10-owner-decisions';
$$;
alter function public.current_economic_owner_policy() owner to postgres;
revoke all on function public.current_economic_owner_policy() from public,anon,authenticated,service_role;
grant execute on function public.current_economic_owner_policy() to anon,authenticated,service_role;

-- New economic records must follow the adopted fee. Historic offers/contracts,
-- immutable price records and creator obligations are not edited.
create function private.enforce_adopted_fee_policy() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='marketplace_commercial_term_versions' and new.commission_bps<>500 then
  raise exception using errcode='22023',message='Adopted Marketplace platform fee is 500 basis points.';
 elsif tg_table_name='marketplace_commercial_offers' and ((new.offer_kind='free' and new.commission_bps<>0) or (new.offer_kind='paid' and new.commission_bps<>500)) then
  raise exception using errcode='22023',message='Marketplace offer fee does not match adopted policy.';
 end if;
 return new;
end;$$;
-- Trigger names/tables are resolved against the existing economic kernel.
create trigger adopted_marketplace_terms_fee before insert on private.marketplace_commercial_term_versions for each row execute function private.enforce_adopted_fee_policy();
create trigger adopted_marketplace_offer_fee before insert or update of commission_bps,offer_kind on private.marketplace_commercial_offers for each row execute function private.enforce_adopted_fee_policy();
revoke all on function private.enforce_adopted_fee_policy() from public,anon,authenticated,service_role;

-- Amount tracking is distinct from cash/compute assistance spending. Existing
-- grant history retains NULL (unrecorded), not invented historical waived value.
alter table private.economic_assistance_grants add column waived_value_minor bigint check(waived_value_minor between 0 and 1000);
create function private.record_job_fee_waived_value() returns trigger language plpgsql set search_path='' as $$
declare program private.economic_assistance_programs%rowtype;
begin
 select * into strict program from private.economic_assistance_programs where id=new.program_id for update;
 if new.scope='job_post_fee' and program.assistance_kind='waiver' then
  new.waived_value_minor:=1000;
 else
  -- Actual subsidies/compute need a finite existing programme allocation. The
  -- unchanged API's per-grant compute ceiling is enforced at the database too.
  if program.max_grants is null or (select count(*) from private.economic_assistance_grants where program_id=program.id)>=program.max_grants
   or (new.scope='sandbox_credits' and new.units>1000000000) then
   raise exception using errcode='55000',message='Actual assistance requires a bounded programme budget.';
  end if;
 end if;
 return new;
end;$$;
create trigger job_fee_waived_value before insert on private.economic_assistance_grants for each row execute function private.record_job_fee_waived_value();
revoke all on function private.record_job_fee_waived_value() from public,anon,authenticated,service_role;

comment on function private.account_direct_request_decline_cooldown() is 'Owner-adopted 30-day directional sender-to-recipient cooldown. Recipient may initiate at any time. Blocks persist until explicitly removed.';

create or replace function public.respond_to_account_conversation_request(
  p_conversation_id uuid,
  p_decision text,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation private.account_conversations%rowtype;
  v_requester uuid;
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_event_id uuid;
begin
  if v_actor is null or p_client_request_id is null
     or v_decision not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'account_conversation_response_invalid';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id for update;
  select participant.user_id into v_requester
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.participant_role = 'requester';
  if v_conversation.conversation_type <> 'direct'
     or not exists (
       select 1 from private.account_conversation_participants as participant
       where participant.conversation_id = p_conversation_id
         and participant.user_id = v_actor
         and participant.participant_role = 'recipient'
     ) then
    raise exception using errcode = '42501', message = 'account_conversation_recipient_required';
  end if;
  if v_conversation.state <> 'requested' then
    return pg_catalog.jsonb_build_object(
      'conversationId', v_conversation.id, 'state', v_conversation.state
    );
  end if;
  if v_decision = 'accept' then
    if not private.account_private_messaging_allowed(v_actor)
       or private.account_conversation_pair_blocked(v_actor, v_requester) then
      raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
    end if;
    update private.account_conversations
    set state = 'active', updated_at = pg_catalog.now()
    where id = p_conversation_id;
    update private.account_conversation_participants
    set participation_state = 'accepted', updated_at = pg_catalog.now()
    where conversation_id = p_conversation_id and user_id = v_actor;
  else
    update private.account_conversations
    set state = 'declined', closed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = p_conversation_id;
    update private.account_conversation_participants
    set participation_state = 'declined', updated_at = pg_catalog.now()
    where conversation_id = p_conversation_id and user_id = v_actor;
  end if;
  perform private.resolve_account_inbox_items(
    'conversations', 'conversation_request', p_conversation_id,
    v_actor, case when v_decision = 'accept' then 'completed' else 'superseded' end
  );
  update public.account_inbox_items
  set read_at = coalesce(read_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where recipient_user_id = v_actor
    and source_domain = 'conversations'
    and source_type = 'conversation_request'
    and source_record_id = p_conversation_id;
  v_event_id := private.record_account_event(
    'account_conversation.' || case when v_decision = 'accept' then 'accepted' else 'unavailable' end,
    1, 'conversations', 'conversation_request', p_conversation_id,
    v_actor, 'user',
    'account-conversation:' || p_conversation_id::text || ':' || v_decision || ':v1',
    'suppressible', 'private_messages',
    case when v_decision = 'accept' then 'Conversation request accepted'
      else 'Private messaging is unavailable for this profile.' end,
    case when v_decision = 'accept'
      then 'You can now reply in the governed Inbox conversation.'
      else 'Private messaging is unavailable for this profile.' end,
    pg_catalog.jsonb_build_object('conversationId', p_conversation_id),
    '/commons-circle/inbox?conversation=' || p_conversation_id::text,
    'account_lifecycle', p_client_request_id
  );
  perform private.project_account_event(
    v_event_id, v_requester, null, null, 50, 'outcome', false
  );
  perform private.record_account_conversation_audit(
    v_actor, 'user', 'conversation_' ||
      case when v_decision = 'accept' then 'accepted' else 'declined' end,
    p_conversation_id, null, null, null, p_client_request_id, '{}'::jsonb
  );
  return pg_catalog.jsonb_build_object(
    'conversationId', p_conversation_id,
    'state', case when v_decision = 'accept' then 'active' else 'declined' end
  );
end;
$$;

create or replace function public.current_user_conversations(
  p_view text default 'all',
  p_limit integer default 30,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_items jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if coalesce(p_view, 'all') not in ('all', 'requests', 'active', 'support', 'archived')
     or (p_before_updated_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'account_conversation_list_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', row.id,
    'type', row.conversation_type,
    'subject', row.subject,
    'state', case when row.state='declined' and row.participant_role='requester' then 'closed' else row.state end,
    'replyPolicy', row.reply_policy,
    'sourceDomain', row.source_domain,
    'sourceType', row.source_type,
    'sourceAvailable', private.account_event_source_available(
      coalesce(row.source_domain, 'conversations'),
      coalesce(row.source_type, 'conversation'),
      coalesce(row.source_record_id, row.id)
    ),
    'participantRole', row.participant_role,
    'participationState', row.participation_state,
    'incomingRequest', row.state = 'requested' and row.participation_state = 'pending',
    'outgoingRequest', row.state = 'requested' and row.participant_role = 'requester',
    'canReply', row.state = 'active' and row.participation_state = 'accepted'
      and row.reply_policy <> 'none',
    'blockedByCurrentUser', row.blocked_by_current_user,
    'unreadCount', row.unread_count,
    'archivedAt', row.archived_at,
    'mutedAt', row.muted_at,
    'lastMessageAt', row.last_message_at,
    'updatedAt', row.updated_at,
    'counterpart', case when row.counterpart_handle is null then null
      else pg_catalog.jsonb_build_object(
        'handle', row.counterpart_handle,
        'displayName', row.counterpart_display_name,
        'avatarUrl', row.counterpart_avatar_url
      ) end
  ) order by row.updated_at desc, row.id desc), '[]'::jsonb)
  into v_items
  from (
    select
      conversation.*,
      self_participant.participant_role,
      self_participant.participation_state,
      self_participant.archived_at,
      self_participant.muted_at,
      (
        select pg_catalog.count(*)
        from private.account_messages as message
        where message.conversation_id = conversation.id
          and message.sender_user_id is distinct from v_actor
          and message.created_at > coalesce(self_participant.last_read_at, '-infinity'::timestamptz)
      ) as unread_count,
      exists (
        select 1
        from private.account_conversation_blocks as block
        join private.account_conversation_participants as blocked_participant
          on blocked_participant.conversation_id = conversation.id
         and blocked_participant.user_id = block.blocked_user_id
        where block.blocker_user_id = v_actor
      ) as blocked_by_current_user,
      counterpart.handle as counterpart_handle,
      counterpart.display_name as counterpart_display_name,
      counterpart.avatar_url as counterpart_avatar_url
    from private.account_conversations as conversation
    join private.account_conversation_participants as self_participant
      on self_participant.conversation_id = conversation.id
     and self_participant.user_id = v_actor
     and self_participant.participation_state <> 'removed'
    left join lateral (
      select card.handle, card.display_name, card.avatar_url
      from private.account_conversation_participants as other_participant
      join private.community_safe_online_public_profile_cards as card
        on card.user_id = other_participant.user_id
      where other_participant.conversation_id = conversation.id
        and other_participant.user_id <> v_actor
        and other_participant.participation_state <> 'removed'
      order by other_participant.joined_at
      limit 1
    ) as counterpart on true
    where (
      p_before_updated_at is null
      or (conversation.updated_at, conversation.id) < (p_before_updated_at, p_before_id)
    )
      and case coalesce(p_view, 'all')
        when 'requests' then conversation.state = 'requested'
        when 'active' then conversation.state = 'active' and self_participant.archived_at is null
        when 'support' then conversation.conversation_type = 'account_support'
          and self_participant.archived_at is null
        when 'archived' then self_participant.archived_at is not null
        else self_participant.archived_at is null
      end
    order by conversation.updated_at desc, conversation.id desc
    limit v_limit
  ) as row;
  return pg_catalog.jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

create or replace function public.current_user_conversation(
  p_conversation_id uuid,
  p_limit integer default 100,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation private.account_conversations%rowtype;
  v_self private.account_conversation_participants%rowtype;
  v_messages jsonb;
  v_participants jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
begin
  if v_actor is null or (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = p_conversation_id;
  select participant.* into strict v_self
  from private.account_conversation_participants as participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id = v_actor
    and participant.participation_state <> 'removed';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role', participant.participant_role,
    'state', case when v_self.participant_role='requester' and participant.participation_state='declined' then 'removed' else participant.participation_state end,
    'self', participant.user_id = v_actor,
    'profile', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name, 'avatarUrl', card.avatar_url
    ) end
  ) order by participant.joined_at), '[]'::jsonb)
  into v_participants
  from private.account_conversation_participants as participant
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = participant.user_id
  where participant.conversation_id = p_conversation_id
    and participant.participation_state <> 'removed';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', message.id,
    'senderKind', message.sender_kind,
    'senderSelf', message.sender_user_id = v_actor,
    'sender', case when card.user_id is null then null else pg_catalog.jsonb_build_object(
      'handle', card.handle, 'displayName', card.display_name, 'avatarUrl', card.avatar_url
    ) end,
    'body', message.body,
    'editedAt', message.edited_at,
    'deletedAt', message.deleted_at,
    'createdAt', message.created_at
  ) order by message.created_at, message.id), '[]'::jsonb)
  into v_messages
  from (
    select candidate.* from private.account_messages as candidate
    where candidate.conversation_id = p_conversation_id
      and (
        p_before_created_at is null
        or (candidate.created_at, candidate.id) < (p_before_created_at, p_before_id)
      )
    order by candidate.created_at desc, candidate.id desc
    limit v_limit
  ) as message
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = message.sender_user_id;

  return pg_catalog.jsonb_build_object(
    'conversation', pg_catalog.jsonb_build_object(
      'id', v_conversation.id,
      'type', v_conversation.conversation_type,
      'subject', v_conversation.subject,
      'state', case when v_conversation.state='declined' and v_self.participant_role='requester' then 'closed' else v_conversation.state end,
      'replyPolicy', v_conversation.reply_policy,
      'sourceDomain', v_conversation.source_domain,
      'sourceType', v_conversation.source_type,
      'sourceAvailable', private.account_event_source_available(
        coalesce(v_conversation.source_domain, 'conversations'),
        coalesce(v_conversation.source_type, 'conversation'),
        coalesce(v_conversation.source_record_id, v_conversation.id)
      ),
      'participantRole', v_self.participant_role,
      'participationState', v_self.participation_state,
      'incomingRequest', v_conversation.state = 'requested'
        and v_self.participation_state = 'pending',
      'canReply', v_conversation.state = 'active'
        and v_self.participation_state = 'accepted'
        and v_conversation.reply_policy <> 'none',
      'blockedByCurrentUser', exists (
        select 1
        from private.account_conversation_blocks as block
        join private.account_conversation_participants as blocked_participant
          on blocked_participant.conversation_id = v_conversation.id
         and blocked_participant.user_id = block.blocked_user_id
        where block.blocker_user_id = v_actor
      ),
      'archivedAt', v_self.archived_at,
      'mutedAt', v_self.muted_at,
      'createdAt', v_conversation.created_at,
      'updatedAt', v_conversation.updated_at
    ),
    'participants', v_participants,
    'messages', v_messages,
    'privacy', pg_catalog.jsonb_build_object(
      'storedInSupabase', true, 'endToEndEncrypted', false,
      'participantScoped', true, 'attachmentsEnabled', false
    )
  );
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'account_conversation_not_found';
end;
$$;

create or replace function private.job_post_checkout_is_eligible(p_condition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.job_post_economic_conditions as condition
    join public.commune_job_posts as job on job.id = condition.job_post_id
    join public.commune_posts as post on post.id = condition.post_id
    where condition.id = p_condition_id
      and job.post_id = post.id
      and job.author_user_id = condition.author_user_id
      and post.user_id = condition.author_user_id
      and job.anti_scam_review_status = 'reviewed_clear'
      and post.status = 'approved'::public.commune_post_status
      and not private.economic_service_is_restricted(
        condition.author_user_id, 'job_posting'
      )
  );
$$;

create or replace function public.operator_assess_job_post_fee(
  p_actor_user_id uuid,
  p_job_post_id uuid,
  p_classification text,
  p_price_code text,
  p_waiver_id uuid,
  p_subsidy_id uuid,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_condition private.job_post_economic_conditions%rowtype;
  v_price private.economic_prices%rowtype;
  v_grant private.economic_assistance_grants%rowtype;
  v_program private.economic_assistance_programs%rowtype;
  v_assistance_id uuid;
  v_expected_kind text;
  v_publication jsonb;
  v_terms_version text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'job_fee_assess');
  if p_client_request_id is null
     or p_classification not in ('community_free', 'commercial', 'waived', 'subsidized')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000
     or (p_classification = 'waived') <> (p_waiver_id is not null)
     or (p_classification = 'subsidized') <> (p_subsidy_id is not null)
     or (p_classification not in ('waived', 'subsidized') and (p_waiver_id is not null or p_subsidy_id is not null)) then
    raise exception using errcode = '22023', message = 'job_post_fee_assessment_invalid';
  end if;
  if p_classification='community_free' and exists(select 1 from public.commune_job_posts where id=p_job_post_id and poster_type='business_company') then
    raise exception using errcode='22023',message='For-profit public-interest cases require an explicit waiver or reduction.';
  end if;
  select * into v_condition
  from private.ensure_job_post_economic_condition(p_job_post_id);
  if v_condition.assessment_request_id = p_client_request_id then
    if v_condition.classification <> p_classification
       or v_condition.waiver_id is distinct from p_waiver_id
       or v_condition.subsidy_id is distinct from p_subsidy_id
       or v_condition.private_assessment_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
    end if;
    if p_classification = 'commercial' then
      select * into v_price from private.economic_prices as price
      where price.price_code = p_price_code and price.product_key = 'job_post_fee'
        and price.active = true and price.test_mode_only = true and price.retired_at is null
      and price.unit_amount_minor=1000 and price.currency='usd';
      if not found or v_condition.price_id is distinct from v_price.id then
        raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
      end if;
      select disclosure.disclosure_version into v_terms_version
      from private.economic_price_disclosures as disclosure
      where disclosure.price_id = v_price.id;
      if not found or v_condition.terms_version is distinct from v_terms_version then
        raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
      end if;
    elsif p_price_code is not null or v_condition.price_id is not null then
      raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'jobPostId', v_condition.job_post_id, 'classification', v_condition.classification,
      'economicStatus', v_condition.condition_status,
      'termsVersion', v_condition.terms_version,
      'idempotentReplay', true
    );
  end if;
  if v_condition.waiver_id is not null or v_condition.subsidy_id is not null then
    raise exception using errcode = '55000', message = 'job_post_assistance_consumption_requires_reconciliation';
  end if;
  if p_classification = 'commercial' then
    select * into v_price from private.economic_prices as price
    where price.price_code = p_price_code and price.product_key = 'job_post_fee'
      and price.active = true and price.test_mode_only = true and price.retired_at is null
      and price.unit_amount_minor=1000 and price.currency='usd';
    if not found then
      raise exception using errcode = 'P0002', message = 'job_post_test_price_not_configured';
    end if;
    select disclosure.disclosure_version into v_terms_version
    from private.economic_price_disclosures as disclosure
    where disclosure.price_id = v_price.id;
    if not found then
      raise exception using errcode = 'P0002', message = 'job_post_fee_terms_not_configured';
    end if;
  elsif p_price_code is not null then
    raise exception using errcode = '22023', message = 'job_post_fee_price_not_allowed';
  end if;
  if v_condition.order_id is not null and (
    p_classification <> 'commercial' or v_condition.price_id is distinct from v_price.id
  ) then
    raise exception using errcode = '55000', message = 'job_post_fee_attached_order_requires_reconciliation';
  end if;
  if p_classification in ('waived', 'subsidized') then
    perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
    if not private.economic_feature_enabled('economic_assistance_workflow') then
      raise exception using errcode = '55000', message = 'economic_assistance_workflow_disabled';
    end if;
    v_assistance_id := case when p_classification = 'waived' then p_waiver_id else p_subsidy_id end;
    v_expected_kind := case when p_classification = 'waived' then 'waiver' else 'subsidy' end;
    select * into v_grant
    from private.economic_assistance_grants as grant_record
    where grant_record.id = v_assistance_id
    for update of grant_record;
    if found then
      select * into v_program
      from private.economic_assistance_programs as program
      where program.id = v_grant.program_id;
    end if;
    if v_grant.id is null or v_program.id is null or v_grant.status <> 'granted'
       or v_grant.beneficiary_user_id <> v_condition.author_user_id
       or v_grant.scope <> 'job_post_fee' or v_program.scope <> 'job_post_fee'
       or v_program.assistance_kind <> v_expected_kind or v_program.status <> 'active'
       or v_program.starts_at > pg_catalog.now()
       or (v_program.ends_at is not null and v_program.ends_at <= pg_catalog.now())
       or (v_grant.expires_at is not null and v_grant.expires_at <= pg_catalog.now())
       or (v_grant.resource_id is not null and v_grant.resource_id <> p_job_post_id) then
      raise exception using errcode = '42501', message = 'job_post_assistance_grant_not_eligible';
    end if;
  end if;
  update private.job_post_economic_conditions
  set classification = p_classification,
      condition_status = case p_classification when 'community_free' then 'not_required'
        when 'commercial' then 'payment_required' when 'waived' then 'waived' else 'subsidized' end,
      price_id = case when p_classification = 'commercial' then v_price.id else null end,
      terms_version = case when p_classification = 'commercial' then v_terms_version else null end,
      order_id = case when p_classification = 'commercial' then order_id else null end,
      waiver_id = case when p_classification = 'waived' then p_waiver_id else null end,
      subsidy_id = case when p_classification = 'subsidized' then p_subsidy_id else null end,
      assessment_request_id = p_client_request_id, assessed_by = p_actor_user_id,
      private_assessment_reason = pg_catalog.btrim(p_reason), assessed_at = pg_catalog.now(),
      satisfied_at = case when p_classification in ('community_free', 'waived', 'subsidized') then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = v_condition.id returning * into v_condition;
  if v_assistance_id is not null then
    update private.economic_assistance_grants
    set status = 'consumed', consumed_at = pg_catalog.now(), consumed_resource_id = p_job_post_id
    where id = v_assistance_id and status = 'granted';
    if not found then
      raise exception using errcode = '55000', message = 'job_post_assistance_grant_already_consumed';
    end if;
  end if;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'job_post_fee_assessed',
    'job_post_economic_condition', v_condition.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'job_post_id', p_job_post_id, 'classification', p_classification,
      'condition_status', v_condition.condition_status,
      'assistance_grant_id', v_assistance_id,
      'payment_does_not_approve_content', true
    )
  );
  v_publication := private.publish_job_post_if_eligible(p_job_post_id);
  return pg_catalog.jsonb_build_object(
    'jobPostId', p_job_post_id, 'classification', v_condition.classification,
    'economicStatus', v_condition.condition_status,
    'termsVersion', v_condition.terms_version,
    'publicationStatus', v_publication ->> 'postStatus',
    'published', coalesce((v_publication ->> 'published')::boolean, false),
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.command_economic_preparation(p_actor_user_id uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<preparation_command>>
declare
  a text:=p_command->>'action'; request_id uuid; expected integer; target uuid; rev integer:=1; command_hash text; result jsonb;
  event private.economic_preparation_events%rowtype; seller private.economic_seller_accounts%rowtype;
  prep private.economic_seller_preparations%rowtype; offer private.economic_offer_preparations%rowtype;
  settlement private.economic_settlement_preparations%rowtype; waiver private.economic_owned_fee_waivers%rowtype;
  support_case private.economic_support_preparation_cases%rowtype; order_row private.economic_orders%rowtype;
  contract private.marketplace_purchase_contracts%rowtype; snapshot jsonb; state text; reason text:=p_command->>'reason';
  amount bigint; owned bigint; prior bigint; document_hash text; lane text; capability text;
begin
  perform private.require_economic_preparation_actor(p_actor_user_id);
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>16384 or a is null then raise exception using errcode='22023',message='preparation_input_invalid'; end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') then lane:='sellers';
  elsif a in ('seller_review','offer_review') then lane:='sellers'; capability:='marketplace_payout_manage';
  elsif a in ('settlement_refresh','settlement_review') then lane:='settlements'; capability:='marketplace_payout_manage';
  elsif a in ('waiver_approve','waiver_revoke') then lane:='waivers'; capability:='economic_assistance_manage';
  elsif a='support_request' then lane:='support';
  elsif a='support_review' then lane:='support'; capability:='economic_refunds_manage';
  elsif a='policy_propose' then capability:='economic_feature_flags_manage';
  else raise exception using errcode='22023',message='preparation_action_invalid'; end if;
  perform private.require_economic_preparation_actor(p_actor_user_id,lane);
  if capability is not null then perform private.require_economic_operator_capability(p_actor_user_id,capability); end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') and
    (not private.marketplace_seller_is_eligible(p_actor_user_id) or private.economic_service_is_restricted(p_actor_user_id,'marketplace_selling')) then raise exception using errcode='42501',message='preparation_seller_not_eligible'; end if;
  if reason is not null and (char_length(btrim(reason)) not between 8 and 500 or reason ~ '[[:cntrl:]]|[0-9]{9,}|(sk|rk)_(live|test)_|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}') then raise exception using errcode='22023',message='preparation_reason_invalid'; end if;
  if a not in ('seller_save','seller_terms','seller_submit','offer_save') and reason is null then raise exception using errcode='22023',message='preparation_reason_required'; end if;
  request_id:=(p_command->>'requestId')::uuid;
  if request_id is null then raise exception using errcode='22023',message='preparation_request_required'; end if;
  command_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('economic_preparation_request:'||request_id::text,0));
  select * into event from private.economic_preparation_events where economic_preparation_events.request_id=preparation_command.request_id;
  if found then
    if event.actor_user_id<>p_actor_user_id or event.request_sha256<>command_hash then raise exception using errcode='23505',message='preparation_idempotency_conflict'; end if;
    return event.result||jsonb_build_object('idempotentReplay',true);
  end if;
  if a not in ('policy_propose','waiver_approve','support_request') then
    expected:=private.preparation_minor(p_command->'expectedRevision')::integer;
    if expected>1000000 then raise exception using errcode='22023',message='preparation_revision_invalid'; end if;
  end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') then
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_seller:'||p_actor_user_id::text,0));
    select * into seller from private.economic_seller_accounts where user_id=p_actor_user_id for update;
    if seller.id is not null and seller.status in ('restricted','closed') then raise exception using errcode='42501',message='preparation_seller_restricted'; end if;
    if a='seller_save' and seller.id is null then
      insert into private.economic_seller_accounts(user_id,developer_profile_id) select p_actor_user_id,id from public.developer_profiles where user_id=p_actor_user_id returning * into seller;
    end if;
    if seller.id is null then raise exception using errcode='P0002',message='preparation_seller_required'; end if;
    select * into prep from private.economic_seller_preparations where seller_id=seller.id for update;
    if a<>'offer_save' and coalesce(prep.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if a<>'seller_save' and prep.seller_id is null then raise exception using errcode='P0002',message='preparation_application_required'; end if;
    target:=seller.id; rev:=coalesce(prep.revision,0)+1;
  end if;

  case a
  when 'seller_save' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','displayName','supportUrl','intent']);
    if char_length(coalesce(p_command->>'displayName','')) not between 2 and 80 or p_command->>'displayName' ~ '[[:cntrl:]]|[0-9]{9,}'
      or char_length(coalesce(p_command->>'supportUrl',''))>300 or (p_command->>'supportUrl'<>'' and p_command->>'supportUrl' !~ '^https://[^/@?#[:space:]]+(/[^?#[:space:]]*)?$')
      or coalesce(p_command->>'intent','') not in ('free','commercial','both') or prep.status in ('submitted','suspended') then raise exception using errcode='22023',message='preparation_application_invalid'; end if;
    insert into private.economic_seller_preparations(seller_id,display_name,support_url,intent,revision) values(seller.id,p_command->>'displayName',p_command->>'supportUrl',p_command->>'intent',rev)
    on conflict(seller_id) do update set display_name=excluded.display_name,support_url=excluded.support_url,intent=excluded.intent,status='draft',revision=excluded.revision,updated_at=now();
  when 'seller_terms' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','documentVersion','accept']);
    if p_command->'accept' is distinct from 'true'::jsonb or p_command->>'documentVersion' is distinct from '2026-09-08-readiness' or prep.status in ('submitted','suspended') then raise exception using errcode='22023',message='preparation_terms_invalid'; end if;
    select content_sha256 into document_hash from private.economic_legal_document_versions where document_key='marketplace_seller_agreement' and document_version=p_command->>'documentVersion';
    if document_hash is null then raise exception using errcode='55000',message='preparation_terms_unavailable'; end if;
    insert into private.economic_consents(user_id,document_key,document_version,source_route,client_request_id,metadata)
      values(p_actor_user_id,'marketplace_seller_agreement',p_command->>'documentVersion','/marketplace/account',request_id,jsonb_build_object('preparation_only',true,'content_sha256',document_hash,'provider_onboarding_consent',false,'commercial_policy_adopted',false));
    update private.economic_seller_preparations set terms_version=p_command->>'documentVersion',terms_sha256=document_hash,status='draft',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_link' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','publisherId','reason']);
    if prep.status in ('submitted','suspended') then raise exception using errcode='55000',message='preparation_application_locked'; end if;
    perform public.link_economic_seller_publisher(p_actor_user_id,(p_command->>'publisherId')::uuid,request_id,reason);
    update private.economic_seller_preparations set publisher_id=(p_command->>'publisherId')::uuid,status='draft',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_submit' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision']);
    if prep.status not in ('draft','changes_requested','withdrawn','rejected') or prep.terms_version is distinct from '2026-09-08-readiness'
      or not exists(select 1 from public.publishers p where p.id=prep.publisher_id and p.owner_id=p_actor_user_id and p.verified) then raise exception using errcode='55000',message='preparation_application_blocked'; end if;
    update private.economic_seller_preparations set status='submitted',review_reason=null,revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_withdraw' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','reason']);
    if prep.status in ('suspended','withdrawn') then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    update private.economic_seller_preparations set status='withdrawn',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','sellerId','decision','reason']);
    target:=(p_command->>'sellerId')::uuid;
    select * into prep from private.economic_seller_preparations where seller_id=target for update;
    select * into seller from private.economic_seller_accounts where id=target;
    if prep.seller_id is null or seller.user_id=p_actor_user_id then raise exception using errcode='42501',message='preparation_independent_review_required'; end if;
    if prep.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if state not in ('approved','changes_requested','rejected','suspended') or not ((prep.status='submitted' and state in ('approved','changes_requested','rejected')) or (prep.status='approved' and state='suspended') or (prep.status='suspended' and state='changes_requested')) then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    if state='approved' and (not private.marketplace_seller_is_eligible(seller.user_id) or seller.status in ('restricted','closed') or prep.terms_version is distinct from '2026-09-08-readiness' or not exists(select 1 from public.publishers p where p.id=prep.publisher_id and p.owner_id=seller.user_id and p.verified)) then raise exception using errcode='55000',message='preparation_application_blocked'; end if;
    rev:=prep.revision+1;
    update private.economic_seller_preparations set status=state,review_reason=reason,revision=rev,updated_at=now() where seller_id=target;
  when 'offer_save' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','offerId','addonVersionId','kind','amountMinor','currency','licenseKey','licenseVersion','feeProposalId']);
    target:=(p_command->>'offerId')::uuid;
    select * into offer from private.economic_offer_preparations where id=target for update;
    if (offer.id is not null and offer.seller_id<>seller.id) or prep.status in ('suspended','withdrawn','rejected') then raise exception using errcode='42501',message='preparation_offer_owner_required'; end if;
    if coalesce(offer.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if offer.status='retired' then raise exception using errcode='55000',message='preparation_offer_retired'; end if;
    if not exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where v.id=(p_command->>'addonVersionId')::uuid and d.user_id=p_actor_user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null) then raise exception using errcode='42501',message='preparation_reviewed_version_required'; end if;
    amount:=private.preparation_minor(p_command->'amountMinor');
    if p_command->>'currency' is distinct from 'usd' or coalesce(p_command->>'kind','') not in ('free','commercial') or char_length(coalesce(p_command->>'licenseKey','')) not between 2 and 100 or char_length(coalesce(p_command->>'licenseVersion','')) not between 1 and 120 then raise exception using errcode='22023',message='preparation_offer_invalid'; end if;
    if (p_command->>'kind'='free' and (amount<>0 or p_command->'feeProposalId'<>'null'::jsonb)) or (p_command->>'kind'='commercial' and (amount=0 or not exists(select 1 from private.economic_preparation_proposals where id=(p_command->>'feeProposalId')::uuid and kind='marketplace_fee_bps' and value=500 and not adopted))) then raise exception using errcode='22023',message='preparation_fee_proposal_required'; end if;
    rev:=coalesce(offer.revision,0)+1;
    insert into private.economic_offer_preparations(id,seller_id,addon_version_id,kind,amount_minor,currency,license_key,license_version,fee_proposal_id,revision)
    values(target,seller.id,(p_command->>'addonVersionId')::uuid,p_command->>'kind',amount,'usd',p_command->>'licenseKey',p_command->>'licenseVersion',(p_command->>'feeProposalId')::uuid,rev)
    on conflict(id) do update set addon_version_id=excluded.addon_version_id,kind=excluded.kind,amount_minor=excluded.amount_minor,license_key=excluded.license_key,license_version=excluded.license_version,fee_proposal_id=excluded.fee_proposal_id,status='draft',revision=excluded.revision,updated_at=now();
  when 'offer_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','offerId','decision','reason']);
    target:=(p_command->>'offerId')::uuid;
    select * into offer from private.economic_offer_preparations where id=target for update;
    if offer.id is null then raise exception using errcode='P0002',message='preparation_offer_required'; end if;
    if offer.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if offer.status='retired' or coalesce(state,'') not in ('prepared','changes_requested','retired') or (state='prepared' and not exists(select 1 from private.economic_seller_preparations where seller_id=offer.seller_id and status='approved')) then raise exception using errcode='55000',message='preparation_offer_blocked'; end if;
    if exists(select 1 from private.economic_seller_accounts where id=offer.seller_id and user_id=p_actor_user_id) then raise exception using errcode='42501',message='preparation_independent_review_required'; end if;
    if state='prepared' and (exists(select 1 from jsonb_array_elements_text(private.preparation_seller_blockers(offer.seller_id)) b where b not in ('commercial_policy_pending','provider_onboarding_disabled','payouts_disabled')) or not exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id join private.economic_seller_accounts a on a.user_id=d.user_id where a.id=offer.seller_id and v.id=offer.addon_version_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null)) then raise exception using errcode='55000',message='preparation_reviewed_version_required'; end if;
    rev:=offer.revision+1; update private.economic_offer_preparations set status=state,revision=rev,updated_at=now() where id=target;
  when 'policy_propose' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','kind','value','reason']);
    amount:=private.preparation_minor(p_command->'value');
    insert into private.economic_preparation_proposals(kind,value,actor_user_id,reason) values(p_command->>'kind',amount::integer,p_actor_user_id,reason) returning id into target;
  when 'settlement_refresh' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','orderId','reason']);
    target:=(p_command->>'orderId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_settlement:'||target::text,0));
    select * into settlement from private.economic_settlement_preparations where order_id=target for update;
    if coalesce(settlement.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    snapshot:=private.preparation_settlement_snapshot(target);rev:=coalesce(settlement.revision,0)+1;
    insert into private.economic_settlement_preparations(order_id,status,revision,evidence_sha256,snapshot) values(target,snapshot->>'status',rev,snapshot->>'evidenceSha256',snapshot)
      on conflict(order_id) do update set status=excluded.status,revision=excluded.revision,evidence_sha256=excluded.evidence_sha256,snapshot=excluded.snapshot,updated_at=now();
  when 'settlement_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','orderId','decision','evidenceSha256','reason']);
    target:=(p_command->>'orderId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_settlement:'||target::text,0));
    select * into settlement from private.economic_settlement_preparations where order_id=target for update;
    if settlement.order_id is null then raise exception using errcode='P0002',message='preparation_settlement_required'; end if;
    if settlement.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    snapshot:=private.preparation_settlement_snapshot(target);
    if p_command->>'evidenceSha256' is distinct from snapshot->>'evidenceSha256' or settlement.evidence_sha256<>snapshot->>'evidenceSha256' then raise exception using errcode='40001',message='preparation_stale_evidence'; end if;
    state:=case p_command->>'decision' when 'hold' then 'held' when 'prepare_handoff' then 'handoff_prepared' when 'cancel' then 'canceled' else null end;
    if state is null or settlement.status='canceled' or (state='handoff_prepared' and (settlement.status not in ('review_required','held') or snapshot->>'status'<>'review_required' or jsonb_array_length(snapshot->'blockers')<>3)) then raise exception using errcode='55000',message='preparation_settlement_blocked'; end if;
    rev:=settlement.revision+1; update private.economic_settlement_preparations set status=state,revision=rev,updated_at=now() where order_id=target;
  when 'waiver_approve' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','orderId','component','amountMinor','reason','confirmation']);
    if p_command->>'confirmation' is distinct from 'WAIVE ECOSYNEVA OWNED AMOUNT ONLY' then raise exception using errcode='22023',message='preparation_waiver_confirmation_required'; end if;
    select * into order_row from private.economic_orders where id=(p_command->>'orderId')::uuid for update;
    if order_row.id is null or order_row.status<>'pending' or order_row.provider_session_reference is not null then raise exception using errcode='55000',message='preparation_uncommitted_charge_required'; end if;
    if p_command->>'component'='ecosyneva_platform_fee' and order_row.flow='marketplace_purchase' then
      select * into contract from private.marketplace_purchase_contracts where order_id=order_row.id;
      if contract.id is null then raise exception using errcode='55000',message='preparation_charge_ownership_unverified'; end if;
      owned:=floor((contract.gross_amount_minor::numeric*contract.commission_bps_snapshot+5000)/10000)::bigint;
    elsif p_command->>'component'='ecosyneva_job_fee' and order_row.flow='job_post_fee' then owned:=order_row.total_minor;
    elsif p_command->>'component'='ecosyneva_service_fee' and order_row.flow='organization_service' then owned:=order_row.total_minor;
    else raise exception using errcode='42501',message='preparation_third_party_waiver_forbidden'; end if;
    amount:=private.preparation_minor(p_command->'amountMinor');
    select coalesce(sum(amount_minor),0) into prior from private.economic_owned_fee_waivers where order_id=order_row.id and status='approved_preparation';
    if amount<=0 or owned<=0 or amount+prior>owned then raise exception using errcode='22023',message='preparation_waiver_exceeds_owned_amount'; end if;
    insert into private.economic_owned_fee_waivers(order_id,component,amount_minor,original_owned_minor,currency,actor_user_id,reason) values(order_row.id,p_command->>'component',amount,owned,order_row.currency,p_actor_user_id,reason) returning id into target;
  when 'waiver_revoke' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','waiverId','reason']);target:=(p_command->>'waiverId')::uuid;
    select * into waiver from private.economic_owned_fee_waivers where id=target for update;
    if waiver.id is null then raise exception using errcode='P0002',message='preparation_waiver_required'; end if;
    if waiver.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if waiver.status<>'approved_preparation' then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    rev:=waiver.revision+1;update private.economic_owned_fee_waivers set status='revoked',revision=rev where id=target;
  when 'support_request' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','kind','targetId','amountMinor','reason']);
    target:=(p_command->>'targetId')::uuid;
    if p_command->>'kind'='support_cancellation' then
      if not exists(select 1 from private.economic_subscriptions s join private.economic_orders o on o.id=s.originating_order_id where s.id=target and s.user_id=p_actor_user_id and o.flow='support_recurring' and s.status not in ('canceled','ended')) then raise exception using errcode='42501',message='preparation_owned_support_subscription_required'; end if;
    elsif p_command->>'kind' in ('support_refund','acknowledgment_delivery') then
      select * into order_row from private.economic_orders where id=target;
      if order_row.user_id is distinct from p_actor_user_id or order_row.flow not in ('support_one_time','support_recurring') or not exists(select 1 from private.economic_payment_transactions where order_id=target and transaction_type='payment' and status='succeeded') then raise exception using errcode='42501',message='preparation_owned_support_payment_required'; end if;
      if p_command->>'kind'='support_refund' then
        amount:=private.preparation_minor(p_command->'amountMinor');
        select coalesce(sum(amount_minor),0) into prior from private.economic_refunds where order_id=target and status in ('pending','succeeded');
        if amount<=0 or amount>order_row.total_minor-prior then raise exception using errcode='22023',message='preparation_refund_amount_invalid'; end if;
      end if;
    else raise exception using errcode='22023',message='preparation_support_kind_invalid'; end if;
    if p_command->>'kind'<>'support_refund' and p_command->'amountMinor'<>'null'::jsonb then raise exception using errcode='22023',message='preparation_amount_not_applicable'; end if;
    insert into private.economic_support_preparation_cases(user_id,kind,target_id,amount_minor,reason) values(p_actor_user_id,p_command->>'kind',target,amount,reason) returning id into target;
  when 'support_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','caseId','decision','reason']);target:=(p_command->>'caseId')::uuid;
    select * into support_case from private.economic_support_preparation_cases where id=target for update;
    if support_case.id is null then raise exception using errcode='P0002',message='preparation_support_case_required'; end if;
    if support_case.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if state not in ('reviewing','awaiting_provider','declined') or support_case.status='declined' or (support_case.status='requested' and state='awaiting_provider') or state=support_case.status then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    rev:=support_case.revision+1;update private.economic_support_preparation_cases set status=state,revision=rev where id=target;
  else raise exception using errcode='22023',message='preparation_action_invalid';
  end case;
  result:=jsonb_build_object('mode','pre_provider','providerActionsAvailable',false,'requestId',request_id,'targetId',target,'revision',rev,'idempotentReplay',false);
  insert into private.economic_preparation_events(request_id,actor_user_id,action,target_id,request_sha256,reason,result) values(request_id,p_actor_user_id,a,target,command_hash,reason,result);
  insert into private.economic_audit_events(actor_user_id,actor_kind,action,target_type,target_id,reason,metadata) values(p_actor_user_id,case when capability is null then 'user' else 'economic_operator' end,'preparation_'||a,'economic_preparation',target,reason,jsonb_build_object('provider_action_performed',false,'revision',rev));
  return result;
end;
$$;

create or replace function public.get_economic_preparation(p_actor_user_id uuid, p_audience text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  settings_record private.economic_preparation_settings%rowtype; caps jsonb; result jsonb; collection jsonb; key text;
  can_sellers boolean; can_settlement boolean; can_waivers boolean; can_support boolean; can_records boolean; can_audit boolean;
begin
  perform private.require_economic_preparation_actor(p_actor_user_id);
  if p_audience not in ('seller','operator','account') or p_audience is null then raise exception using errcode='22023',message='preparation_audience_invalid'; end if;
  select * into settings_record from private.economic_preparation_settings where singleton;
  select coalesce(jsonb_agg(capability order by capability),'[]') into caps from (select distinct a.capability from private.economic_operator_assignments a where a.user_id=p_actor_user_id and private.economic_operator_has_capability(p_actor_user_id,a.capability)) c;
  if p_audience='operator' and jsonb_array_length(caps)=0 then raise exception using errcode='42501',message='preparation_operator_required'; end if;
  can_sellers:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'marketplace_payout_manage');
  can_settlement:=can_sellers;
  can_waivers:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_assistance_manage');
  can_support:=p_audience='operator' and (private.economic_operator_has_capability(p_actor_user_id,'economic_refunds_manage') or private.economic_operator_has_capability(p_actor_user_id,'recurring_support_manage'));
  can_records:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_payments_view');
  can_audit:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_audit_view');
  result:=jsonb_build_object('mode','pre_provider','providerActionsAvailable',false,'enabled',settings_record.enabled,'lanes',jsonb_build_object('sellers',settings_record.sellers_enabled,'settlements',settings_record.settlements_enabled,'waivers',settings_record.waivers_enabled,'support',settings_record.support_enabled),'capabilities',caps,'sellerEligible',private.marketplace_seller_is_eligible(p_actor_user_id),'termsVersion','2026-09-08-readiness','termsPath','/legal/marketplace-commerce-terms','bounded',true,'truncated',false);

  select coalesce(jsonb_agg(row order by updated_at desc,seller_id),'[]') into collection from (
    select p.seller_id,p.updated_at,jsonb_build_object('sellerId',p.seller_id,'displayName',p.display_name,'supportUrl',p.support_url,'intent',p.intent,'status',p.status,'revision',p.revision,'termsVersion',p.terms_version,'publisherId',p.publisher_id,'reviewReason',p.review_reason,'blockers',private.preparation_seller_blockers(p.seller_id),'updatedAt',p.updated_at) row
    from private.economic_seller_preparations p join private.economic_seller_accounts a on a.id=p.seller_id where can_sellers or (p_audience='seller' and a.user_id=p_actor_user_id) order by p.updated_at desc,p.seller_id limit 50
  ) q; result:=result||jsonb_build_object('sellers',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,id),'[]') into collection from (
    select o.id,o.updated_at,jsonb_build_object('offerId',o.id,'sellerId',o.seller_id,'addonVersionId',o.addon_version_id,'kind',o.kind,'amountMinor',o.amount_minor,'currency',o.currency,'licenseKey',o.license_key,'licenseVersion',o.license_version,'feeProposalId',o.fee_proposal_id,'status',o.status,'revision',o.revision,'blockers',private.preparation_seller_blockers(o.seller_id)||case when exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where v.id=o.addon_version_id and d.user_id=a.user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null) then '[]'::jsonb else '["reviewed_version_no_longer_eligible"]'::jsonb end||case when o.kind='commercial' then '["provider_commercial_model_pending","paid_offer_activation_disabled"]'::jsonb else '[]'::jsonb end,'updatedAt',o.updated_at) row
    from private.economic_offer_preparations o join private.economic_seller_accounts a on a.id=o.seller_id where can_sellers or (p_audience='seller' and a.user_id=p_actor_user_id) order by o.updated_at desc,o.id limit 50
  ) q; result:=result||jsonb_build_object('offers',collection);
  select coalesce(jsonb_agg(row order by id),'[]') into collection from (select p.id,jsonb_build_object('publisherId',p.id,'name',left(p.name,300),'verified',p.verified) row from public.publishers p where p.owner_id=p_actor_user_id and p_audience='seller' order by p.id limit 100) q;
  result:=result||jsonb_build_object('publisherOptions',collection);
  select coalesce(jsonb_agg(row order by id),'[]') into collection from (select v.id,jsonb_build_object('addonVersionId',v.id,'name',left(l.name,300),'version',left(v.version,120)) row from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where p_audience='seller' and d.user_id=p_actor_user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null order by v.id limit 100) q;
  result:=result||jsonb_build_object('versionOptions',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select p.id,p.created_at,jsonb_build_object('proposalId',p.id,'kind',p.kind,'value',p.value,'adopted',false,'createdAt',p.created_at) row from private.economic_preparation_proposals p order by p.created_at desc,p.id limit 50) q;
  result:=result||jsonb_build_object('proposals',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,order_id),'[]') into collection from (
    select p.order_id,p.updated_at,fresh.current_snapshot||jsonb_build_object('status',case when p.evidence_sha256=fresh.current_snapshot->>'evidenceSha256' then p.status else 'reconciliation_required' end,'blockers',(fresh.current_snapshot->'blockers')||case when p.evidence_sha256=fresh.current_snapshot->>'evidenceSha256' then '[]'::jsonb else '["snapshot_stale_refresh_required"]'::jsonb end,'revision',p.revision,'providerPayoutStatus','not_verified','updatedAt',p.updated_at) row
    from private.economic_settlement_preparations p join private.marketplace_purchase_contracts c on c.order_id=p.order_id join private.economic_seller_accounts a on a.id=c.seller_account_id
    cross join lateral (select private.preparation_settlement_snapshot(p.order_id) current_snapshot) fresh
    where can_settlement or (p_audience='seller' and a.user_id=p_actor_user_id) order by p.updated_at desc,p.order_id limit 50
  ) q; result:=result||jsonb_build_object('settlements',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select w.id,w.created_at,jsonb_build_object('waiverId',w.id,'orderId',w.order_id,'component',w.component,'amountMinor',w.amount_minor,'currency',w.currency,'status',w.status,'revision',w.revision,'actorId',w.actor_user_id,'reason',w.reason,'createdAt',w.created_at) row from private.economic_owned_fee_waivers w where can_waivers order by w.created_at desc,w.id limit 50) q;
  result:=result||jsonb_build_object('waivers',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select c.id,c.created_at,jsonb_build_object('caseId',c.id,'targetId',c.target_id,'kind',c.kind,'amountMinor',c.amount_minor,'status',c.status,'revision',c.revision,'reason',c.reason,'createdAt',c.created_at) row from private.economic_support_preparation_cases c where can_support or (p_audience='account' and c.user_id=p_actor_user_id) order by c.created_at desc,c.id limit 50) q;
  result:=result||jsonb_build_object('supportCases',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,id),'[]') into collection from (select s.id,s.updated_at,jsonb_build_object('subscriptionId',s.id,'status',s.status,'cancelAtPeriodEnd',s.cancel_at_period_end,'currentPeriodEnd',s.current_period_end) row from private.economic_subscriptions s join private.economic_orders o on o.id=s.originating_order_id where o.flow='support_recurring' and (can_support or (p_audience='account' and s.user_id=p_actor_user_id)) order by s.updated_at desc,s.id limit 50) q;
  result:=result||jsonb_build_object('subscriptions',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (
    select id,created_at,jsonb_build_object('recordId',id,'orderId',order_id,'kind',kind,'amountMinor',amount_minor,'currency',currency,'status',status,'deliveryStatus','not_established','evidence',evidence,'createdAt',created_at) row from (
      select t.id,t.order_id,case when o.flow='marketplace_purchase' then 'marketplace_payment' else 'support_acknowledgment' end kind,t.gross_amount_minor amount_minor,t.currency,t.status,'verified_internal_record' evidence,t.created_at
      from private.economic_payment_transactions t join private.economic_orders o on o.id=t.order_id where t.transaction_type='payment' and t.status='succeeded' and o.flow in ('support_one_time','support_recurring','marketplace_purchase') and (can_records or (p_audience='account' and o.user_id=p_actor_user_id))
      union all
      select f.id,f.order_id,'refund_record',f.amount_minor,f.currency,f.status,'verified_internal_record',f.created_at from private.economic_refunds f join private.economic_orders o on o.id=f.order_id where can_records or (p_audience='account' and o.user_id=p_actor_user_id)
      union all
      select pp.id,null::uuid,'payout_preparation',pp.amount_minor,pp.currency,pp.status,'preparation_only',pp.created_at from private.marketplace_payout_preparations pp join private.economic_seller_accounts a on a.id=pp.seller_account_id where can_settlement or (p_audience='seller' and a.user_id=p_actor_user_id)
    ) records order by created_at desc,id limit 50
  ) q; result:=result||jsonb_build_object('records',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select e.id,e.created_at,jsonb_build_object('eventId',e.id,'action',e.action,'targetId',e.target_id,'actorId',e.actor_user_id,'reason',e.reason,'createdAt',e.created_at) row from private.economic_preparation_events e where can_audit order by e.created_at desc,e.id limit 50) q;
  result:=result||jsonb_build_object('audit',collection);
  foreach key in array array['sellers','offers','proposals','settlements','waivers','supportCases','subscriptions','records','audit'] loop
    if jsonb_array_length(result->key)>=50 then result:=result||'{"truncated":true}'::jsonb; end if;
  end loop;
  if jsonb_array_length(result->'publisherOptions')>=100 or jsonb_array_length(result->'versionOptions')>=100 then result:=result||'{"truncated":true}'::jsonb; end if;
  return result;
end;
$$;
commit;

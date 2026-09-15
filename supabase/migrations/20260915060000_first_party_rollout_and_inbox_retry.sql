begin;
create function public.operator_set_first_party_lane(p_actor_user_id uuid,p_feature_key text,p_enabled boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior boolean; previous_lane text;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='economic_service_role_required';end if;
 perform private.require_economic_operator_capability(p_actor_user_id,'economic_feature_flags_manage');
 if p_feature_key not in ('support_checkout','recurring_support','job_post_fee_enforcement','organization_billing','sponsorship_checkout') or p_enabled is null or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
  raise exception using errcode='22023',message='first_party_lane_command_invalid';end if;
 select enabled into strict prior from private.economic_feature_flags where feature_key=p_feature_key for update;
 if p_enabled and not prior then
  previous_lane:=case p_feature_key when 'recurring_support' then 'support_checkout' when 'job_post_fee_enforcement' then 'recurring_support' when 'organization_billing' then 'job_post_fee_enforcement' when 'sponsorship_checkout' then 'job_post_fee_enforcement' end;
  if previous_lane is not null and not private.economic_feature_enabled(previous_lane) then raise exception using errcode='55000',message='first_party_rollout_order_required';end if;
 end if;
 update private.economic_feature_flags set enabled=p_enabled,updated_at=now() where feature_key=p_feature_key;
 if p_enabled and not private.economic_feature_enabled(p_feature_key) then raise exception using errcode='55000',message='first_party_qualification_required';end if;
 if prior is distinct from p_enabled then
  insert into private.economic_audit_events(actor_kind,actor_user_id,action,target_type,reason,metadata)
  values('economic_operator',p_actor_user_id,'first_party_lane_switch_changed','economic_feature',btrim(p_reason),jsonb_build_object('feature',p_feature_key,'enabled',p_enabled,'environment',private.economic_runtime_mode(),'third_party_money',false));
 end if;
 return jsonb_build_object('feature',p_feature_key,'enabled',p_enabled,'idempotentReplay',prior=p_enabled);
end;$$;
revoke all on function public.operator_set_first_party_lane(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.operator_set_first_party_lane(uuid,text,boolean,text) to service_role;

alter table private.economic_webhook_events add column next_retry_at timestamptz;
create function public.retry_economic_provider_inbox(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.economic_webhook_events%rowtype;r jsonb;attempted integer:=0;processed integer:=0;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='economic_service_role_required';end if;
 if p_limit not between 1 and 25 or p_limit is null then raise exception using errcode='22023',message='economic_retry_limit_invalid';end if;
 if not private.economic_feature_enabled('economic_webhooks') then raise exception using errcode='55000',message='economic_webhooks_disabled';end if;
 for e in select * from private.economic_webhook_events where processing_status='failed' and processing_attempts<20
  and coalesce(next_retry_at,received_at+interval '1 minute')<=now() order by received_at,id for update skip locked limit p_limit loop
  attempted:=attempted+1;
  r:=public.process_economic_provider_event(e.provider,e.provider_event_id,e.event_type,e.event_created_at,e.payload_sha256,e.normalized_event);
  if r->>'status' in ('processed','duplicate','ignored_out_of_order') then processed:=processed+1;end if;
  update private.economic_webhook_events set next_retry_at=now()+make_interval(secs=>least(3600,power(2,least(e.processing_attempts,12))::integer*30)) where id=e.id;
 end loop;
 return jsonb_build_object('attempted',attempted,'processed',processed,'remainingRequireReview',(select count(*) from private.economic_webhook_events where processing_status='failed' and processing_attempts>=20));
end;$$;
revoke all on function public.retry_economic_provider_inbox(integer) from public,anon,authenticated;
grant execute on function public.retry_economic_provider_inbox(integer) to service_role;
alter function public.operator_set_first_party_lane(uuid,text,boolean,text) owner to postgres;
alter function public.retry_economic_provider_inbox(integer) owner to postgres;
commit;

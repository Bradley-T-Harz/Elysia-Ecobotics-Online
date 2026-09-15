-- Governed reductions of the adopted $10 EcoSyneva fee. No publication authority.
begin;
-- Implement the adopted September 10 amount in the authoritative catalog.
-- This creates no provider object and enables no lane.
insert into private.economic_prices(price_code,product_key,currency,unit_amount_minor)
values('job_post_standard_20260915_usd','job_post_fee','usd',1000);
insert into private.economic_audit_events(actor_kind,action,target_type,metadata)
values('system','adopted_job_post_price_recorded','economic_price',jsonb_build_object('price_code','job_post_standard_20260915_usd','amount_minor',1000,'currency','usd','provider_action',false));
create table private.job_post_fee_reductions (
 request_id uuid primary key, condition_id uuid not null references private.job_post_economic_conditions(id),
 actor_user_id uuid not null references auth.users(id), amount_due_minor bigint not null check(amount_due_minor between 50 and 999),
 price_id uuid not null references private.economic_prices(id), reason text not null check(length(btrim(reason)) between 8 and 1000),
 created_at timestamptz not null default now()
);
alter table private.job_post_fee_reductions enable row level security;
revoke all on private.job_post_fee_reductions from public,anon,authenticated,service_role;
create trigger job_post_reductions_append_only before update or delete on private.job_post_fee_reductions for each row execute function private.prevent_economic_history_mutation();

create function public.operator_reduce_job_post_fee(p_actor_user_id uuid,p_job_post_id uuid,p_client_request_id uuid,p_amount_due_minor bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.job_post_economic_conditions%rowtype; prior private.job_post_fee_reductions%rowtype;
 price private.economic_prices%rowtype; new_price uuid; code text;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='economic_service_role_required'; end if;
 perform private.require_economic_operator_capability(p_actor_user_id,'job_fee_assess');
 perform private.require_economic_operator_capability(p_actor_user_id,'economic_assistance_manage');
 if p_client_request_id is null or p_amount_due_minor not between 50 and 999 or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
  raise exception using errcode='22023',message='job_post_reduction_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text,0));
 select * into c from private.job_post_economic_conditions where job_post_id=p_job_post_id for update;
 if not found or c.author_user_id=p_actor_user_id then raise exception using errcode='42501',message='job_post_reduction_independent_operator_required'; end if;
 select * into prior from private.job_post_fee_reductions where request_id=p_client_request_id;
 if found then
  if prior.condition_id<>c.id or prior.actor_user_id<>p_actor_user_id or prior.amount_due_minor<>p_amount_due_minor or prior.reason<>btrim(p_reason) then
   raise exception using errcode='23505',message='job_post_reduction_idempotency_conflict'; end if;
  return jsonb_build_object('jobPostId',p_job_post_id,'amountDueMinor',p_amount_due_minor,'idempotentReplay',true,'publicationGranted',false);
 end if;
 if c.classification<>'commercial' or c.condition_status<>'payment_required' or c.order_id is not null
  or c.waiver_id is not null or c.subsidy_id is not null then raise exception using errcode='55000',message='job_post_reduction_uncommitted_fee_required'; end if;
 select * into strict price from private.economic_prices where id=c.price_id;
 if price.product_key<>'job_post_fee' or price.currency<>'usd' or price.unit_amount_minor<>1000 then
  raise exception using errcode='55000',message='job_post_reduction_standard_fee_required'; end if;
 code:='job_post_reduced_'||replace(p_client_request_id::text,'-','')||'_usd';
 insert into private.economic_prices(price_code,product_key,currency,unit_amount_minor)
 values(code,'job_post_fee','usd',p_amount_due_minor) returning id into new_price;
 -- Retain the exact adopted disclosure; a reduction creates no new product policy.
 insert into private.economic_price_disclosures(price_id,disclosure_version,configured_by)
 select new_price,disclosure_version,p_actor_user_id from private.economic_price_disclosures where price_id=price.id;
 insert into private.job_post_fee_reductions(request_id,condition_id,actor_user_id,amount_due_minor,price_id,reason)
 values(p_client_request_id,c.id,p_actor_user_id,p_amount_due_minor,new_price,btrim(p_reason));
 update private.job_post_economic_conditions set price_id=new_price,updated_at=now() where id=c.id;
 insert into private.economic_audit_events(actor_user_id,actor_kind,action,target_type,target_id,reason,metadata)
 values(p_actor_user_id,'economic_operator','job_post_fee_reduced','job_post_economic_condition',c.id,btrim(p_reason),
 jsonb_build_object('standard_fee_minor',1000,'amount_due_minor',p_amount_due_minor,'waived_value_minor',1000-p_amount_due_minor,'publication_granted',false));
 return jsonb_build_object('jobPostId',p_job_post_id,'amountDueMinor',p_amount_due_minor,'idempotentReplay',false,'publicationGranted',false);
end;
$$;
revoke all on function public.operator_reduce_job_post_fee(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.operator_reduce_job_post_fee(uuid,uuid,uuid,bigint,text) to service_role;
alter table private.job_post_fee_reductions owner to postgres;
alter function public.operator_reduce_job_post_fee(uuid,uuid,uuid,bigint,text) owner to postgres;
commit;

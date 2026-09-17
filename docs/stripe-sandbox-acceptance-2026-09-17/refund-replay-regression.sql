-- Real sandbox provider-confirmed record; no provider calls, rollback-only.
begin;
set local request.jwt.claim.role='service_role';
do $$declare r private.economic_refund_requests%rowtype; f private.economic_refunds%rowtype; result jsonb;
begin
 if private.economic_runtime_mode()<>'test' then raise exception 'sandbox_required';end if;
 select * into strict r from private.economic_refund_requests where client_request_id='f6170000-0000-4000-8000-000000000013';
 select * into strict f from private.economic_refunds where provider_refund_reference=r.provider_refund_reference;
 result:=public.attach_economic_test_refund_result(r.approved_by,r.id,r.provider_attach_client_request_id,r.provider_refund_reference,'succeeded',f.provider_event_created_at-interval '1 second',r.provider_response_sha256,r.approval_reason);
 if result->>'idempotentReplay'<>'true' then raise exception 'refund replay failed after webhook timestamp advance';end if;
 begin
  perform public.attach_economic_test_refund_result(r.approved_by,r.id,r.provider_attach_client_request_id,r.provider_refund_reference,'succeeded',f.provider_event_created_at,repeat('0',64),r.approval_reason);
  raise exception 'conflicting fingerprint accepted';
 exception when unique_violation then null;end;
end $$;
rollback;
select 'PASSED: refund command replay after later webhook, immutable fingerprint still enforced' as result;

-- Replay previously signature-verified sandbox provider facts. No invented events.
begin;
set local request.jwt.claim.role='service_role';
do $$declare e private.economic_webhook_events%rowtype; before_payments bigint; before_status text; result jsonb;
begin
 if private.economic_runtime_mode()<>'test' then raise exception 'sandbox_required';end if;
 select event.* into strict e from private.economic_webhook_events event join private.economic_orders o on o.id=(event.normalized_event->>'orderId')::uuid where event.event_type='payment_intent.succeeded' and o.status='refunded' and o.flow='support_one_time' and event.processing_status='processed' limit 1;
 select count(*) into before_payments from private.economic_payment_transactions;
 select status into before_status from private.economic_orders where id=(e.normalized_event->>'orderId')::uuid;
 for i in 1..2 loop
  result:=public.process_economic_provider_event(e.provider,e.provider_event_id,e.event_type,e.event_created_at,e.payload_sha256,e.normalized_event);
  if result->>'status'<>'duplicate' then raise exception 'verified_event_not_deduplicated';end if;
 end loop;
 if (select count(*) from private.economic_payment_transactions)<>before_payments or (select status from private.economic_orders where id=(e.normalized_event->>'orderId')::uuid)<>before_status then raise exception 'old_paid_event_changed_refunded_truth';end if;
end $$;
commit;
select 'PASSED: two replays of a verified older payment event preserve refund truth and one payment' as result;

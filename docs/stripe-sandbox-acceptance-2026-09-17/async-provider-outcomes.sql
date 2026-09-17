-- Aggregate only previously signature-verified real Stripe TEST events.
select a.event_type,o.status as order_status,a.processing_status,
 (select count(*) from private.economic_payment_transactions t where t.order_id=o.id and t.transaction_type='payment' and t.status='succeeded') as successful_payments,
 (select count(*) from private.economic_payment_transactions t where t.order_id=o.id and t.transaction_type='failure') as failed_payments,
 exists(select 1 from private.economic_webhook_events c where c.event_type='checkout.session.completed' and c.normalized_event->>'orderId'=o.id::text and c.normalized_event->>'paymentStatus'='unpaid') as completed_was_unpaid
from private.economic_webhook_events a join private.economic_orders o on o.id=(a.normalized_event->>'orderId')::uuid
where a.event_type in ('checkout.session.async_payment_succeeded','checkout.session.async_payment_failed') and o.provider_environment='test';

begin;
set local request.jwt.claim.role='service_role';
do $$declare before_attach jsonb; after_attach jsonb; price text;
begin
 if private.economic_runtime_mode()<>'test' then raise exception 'sandbox_required';end if;
 select price_code into strict price from private.economic_prices where product_key='support_one_time' and active;
 before_attach:=public.begin_economic_checkout(null,'f6170000-0000-4000-8000-000000000090','support_one_time',500,'usd',price,'/support','2026-09-15-first-party');
 perform public.attach_economic_checkout_provider_session((before_attach->>'orderId')::uuid,'stripe','cs_test_SYNTHETIC_EXPIRY',null);
 after_attach:=public.begin_economic_checkout(null,'f6170000-0000-4000-8000-000000000090','support_one_time',500,'usd',price,'/support','2026-09-15-first-party');
 if before_attach->>'checkoutExpiresAt'<>after_attach->>'checkoutExpiresAt' or before_attach->>'idempotencyKey'<>after_attach->>'idempotencyKey' then raise exception 'provider_attachment_changed_outbound_idempotent_request';end if;
end $$;
rollback;
select 'PASSED: full prepare/attach/retry preserves provider idempotency parameters' as result;

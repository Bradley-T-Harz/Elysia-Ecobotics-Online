-- Attaching a provider Session must preserve the deadline used in its outbound
-- idempotent creation request. Moving it made Stripe reject legitimate retries.
begin;
do $$
declare definition text; needle text := 'checkout_expires_at = pg_catalog.now() + interval ''35 minutes'',';
begin
 definition := pg_get_functiondef('public.attach_economic_checkout_provider_session(uuid,text,text,text)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'checkout_expiry_patch_precondition_failed';end if;
 definition := replace(definition,needle,'checkout_expires_at = coalesce(v_order.checkout_expires_at, pg_catalog.now() + interval ''40 minutes''),');
 execute definition;
end $$;
commit;

-- A signed refund webhook can advance the projection timestamp after the
-- idempotent provider POST response was attached. Retrying that exact command
-- must compare its immutable fingerprint, not require a mutable timestamp to
-- remain equal. Do not accept a projection older than the supplied response.
begin;
do $$
declare definition text; needle text := 'or v_existing_refund.provider_event_created_at <> p_provider_event_created_at';
begin
 definition := pg_get_functiondef('public.attach_economic_test_refund_result(uuid,uuid,uuid,text,text,timestamp with time zone,text,text)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'refund_replay_patch_precondition_failed';end if;
 definition := replace(definition,needle,'or v_existing_refund.provider_event_created_at < p_provider_event_created_at');
 execute definition;
end $$;
commit;

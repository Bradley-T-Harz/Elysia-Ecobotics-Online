select jsonb_build_object(
'migrations',(select count(*) from supabase_migrations.schema_migrations),
'head',(select max(version) from supabase_migrations.schema_migrations),
'all_payments_test',not exists(select 1 from private.economic_payment_transactions where provider_environment <> 'test'),
'events_not_processed',(select count(*) from private.economic_webhook_events where processing_status <> 'processed'),
'new_function_definer',(select bool_and(prosecdef) from pg_proc where oid in ('public.attach_economic_test_refund_result(uuid,uuid,uuid,text,text,timestamp with time zone,text,text)'::regprocedure,'public.attach_economic_checkout_provider_session(uuid,text,text,text)'::regprocedure)),
'anonymous_cannot_attach',not has_function_privilege('anon','public.attach_economic_checkout_provider_session(uuid,text,text,text)','EXECUTE') and not has_function_privilege('anon','public.attach_economic_test_refund_result(uuid,uuid,uuid,text,text,timestamp with time zone,text,text)','EXECUTE'),
'financial_rls',(select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('economic_orders','economic_payment_transactions','economic_webhook_events','economic_refunds')),
'provider_account',(select account_reference from private.economic_provider_readiness where provider='stripe')) as verification;

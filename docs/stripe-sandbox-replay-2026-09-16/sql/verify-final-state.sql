-- Read-only post-validation state. No application rows or credentials returned.
select jsonb_build_object(
 'migrations',(select count(*) from supabase_migrations.schema_migrations),
 'migrationHead',(select max(version) from supabase_migrations.schema_migrations),
 'authUsers',(select count(*) from auth.users),
 'storageObjects',(select count(*) from storage.objects),
 'publicStorageBuckets',(select count(*) from storage.buckets where public),
 'plpgsqlCheckPersisted',exists(select 1 from pg_extension where extname='plpgsql_check'),
 'plpgsqlNonTriggerRoutines',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname in ('public','private') and l.lanname='plpgsql' and p.prokind='f' and p.prorettype<>'pg_catalog.trigger'::regtype),
 'runtimeMode',(select runtime_mode from private.economic_provider_readiness where provider='stripe'),
 'thirdPartyStatus',(select third_party_status from private.economic_provider_readiness where provider='stripe'),
 'orders',(select count(*) from private.economic_orders),
 'payments',(select count(*) from private.economic_payment_transactions),
 'events',(select count(*) from private.economic_webhook_events),
 'customers',(select count(*) from private.billing_customers),
 'catalog',(select count(*) from private.economic_provider_catalog),
 'subscriptions',(select count(*) from private.economic_subscriptions),
 'enabledFlags',(select jsonb_agg(feature_key order by feature_key) from private.economic_feature_flags where enabled),
 'oldLegalHash',(select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by document_key,document_version),'')) from private.economic_legal_document_versions t where document_version<>'2026-09-15-first-party'),
 'oldBundleHash',(select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by bundle_key,bundle_version),'')) from private.economic_legal_consent_bundle_versions t where bundle_version<>'2026-09-15-first-party')
) as final_state;

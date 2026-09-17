select jsonb_build_object(
'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
'ledgerColumns',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations'),
'flags',(select jsonb_agg(jsonb_build_object('key',feature_key,'enabled',enabled,'testOnly',test_mode_only) order by feature_key) from private.economic_feature_flags),
'orders',(select count(*) from private.economic_orders),'payments',(select count(*) from private.economic_payment_transactions),
'events',(select count(*) from private.economic_webhook_events),'customers',(select count(*) from private.billing_customers),
'catalog',(select count(*) from private.economic_provider_catalog),'subscriptions',(select count(*) from private.economic_subscriptions),
'oldLegalHash',(select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by document_key,document_version),'')) from private.economic_legal_document_versions t where document_version<>'2026-09-15-first-party'),
'oldBundleHash',(select md5(coalesce(string_agg(row_to_json(t)::text,'|' order by bundle_key,bundle_version),'')) from private.economic_legal_consent_bundle_versions t where bundle_version<>'2026-09-15-first-party')
) as preflight;
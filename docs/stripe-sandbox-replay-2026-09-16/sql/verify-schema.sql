-- Read-only structure, ACL and policy evidence. No customer rows or credentials.
with table_state as (
 select n.nspname as schema,c.relname as name,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,
 pg_get_userbyid(c.relowner) as owner,
 has_table_privilege('anon',c.oid,'select') as anon_select,
 has_table_privilege('anon',c.oid,'insert,update,delete') as anon_write,
 has_table_privilege('authenticated',c.oid,'select') as authenticated_select,
 has_table_privilege('authenticated',c.oid,'insert,update,delete') as authenticated_write
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind in ('r','p')
), policy_state as (
 select schemaname,tablename,policyname,permissive,roles::text,cmd,qual,with_check
 from pg_policies where schemaname in ('public','private','storage')
), function_state as (
 select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
 l.lanname as language,p.prosecdef as security_definer,p.proconfig as configuration,
 p.prorettype::regtype::text as return_type,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname in ('public','private') and p.prokind='f'
)
select jsonb_build_object(
 'database',current_database(),
 'serverVersion',current_setting('server_version'),
 'tables',(select jsonb_agg(to_jsonb(t) order by schema,name) from table_state t),
 'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from policy_state p),
 'functions',(select jsonb_agg(to_jsonb(f) order by schema,name,arguments) from function_state f),
 'views',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'options',c.reloptions) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='v'),
 'invalidIndexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and (not i.indisvalid or not i.indisready)),
 'unvalidatedConstraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private') and not c.convalidated),
 'privateSchemaAnonUsage',has_schema_privilege('anon','private','usage'),
 'privateSchemaAuthenticatedUsage',has_schema_privilege('authenticated','private','usage'),
 'privateSchemaPublicCreate',has_schema_privilege('anon','private','create'),
 'migrationLedger',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementHash',md5(array_to_string(statements,E'\n'))) order by version) from supabase_migrations.schema_migrations),
 'plpgsqlCheckAvailable',exists(select 1 from pg_available_extensions where name='plpgsql_check'),
 'authUsers',(select count(*) from auth.users),
 'storageObjects',(select count(*) from storage.objects),
 'storageBuckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id) from storage.buckets),
 'providerReadiness',(select to_jsonb(r) from private.economic_provider_readiness r where provider='stripe')
) as verification;

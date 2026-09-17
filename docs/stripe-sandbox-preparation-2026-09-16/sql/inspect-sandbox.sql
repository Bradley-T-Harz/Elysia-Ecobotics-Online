-- Read-only catalog/count inventory. No row contents or credentials.
select jsonb_build_object(
 'database',current_database(),
 'serverVersion',current_setting('server_version'),
 'publicRelations',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S')),
 'privateRelations',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind in ('r','p','v','m','S')),
 'migrationLedgerExists',to_regclass('supabase_migrations.schema_migrations') is not null,
 'authUsers',(select count(*) from auth.users),
 'storageBuckets',(select count(*) from storage.buckets),
 'storageObjects',(select count(*) from storage.objects),
 'authJwtExists',to_regprocedure('auth.jwt()') is not null,
 'storageFoldernameExists',to_regprocedure('storage.foldername(text)') is not null
) as inventory;

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '2s';

select jsonb_pretty(
  jsonb_build_object(
    'captured_at', clock_timestamp(),
    'server_version', current_setting('server_version'),
    'database', current_database(),
    'current_user', current_user,
    'schemas', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name), '[]'::jsonb)
      from (
        select n.nspname as schema_name, pg_get_userbyid(n.nspowner) as owner
        from pg_catalog.pg_namespace n
        where n.nspname in ('public', 'private', 'storage', 'auth', 'supabase_migrations')
      ) row_data
    ),
    'relations', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.relation_name), '[]'::jsonb)
      from (
        select n.nspname as schema_name,
               c.relname as relation_name,
               c.relkind as relation_kind,
               c.relrowsecurity as rls_enabled,
               c.relforcerowsecurity as rls_forced,
               pg_get_userbyid(c.relowner) as owner
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'private', 'storage')
          and c.relkind in ('r', 'p', 'v', 'm')
      ) row_data
    ),
    'columns', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.table_schema, row_data.table_name, row_data.ordinal_position), '[]'::jsonb)
      from (
        select c.table_schema,
               c.table_name,
               c.ordinal_position,
               c.column_name,
               c.data_type,
               c.udt_schema,
               c.udt_name,
               c.is_nullable,
               c.column_default,
               c.is_identity,
               c.is_generated
        from information_schema.columns c
        where c.table_schema in ('public', 'private', 'storage')
      ) row_data
    ),
    'constraints', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.constraint_name), '[]'::jsonb)
      from (
        select n.nspname as schema_name,
               c.relname as table_name,
               con.conname as constraint_name,
               con.contype as constraint_type,
               con.convalidated as validated,
               pg_get_constraintdef(con.oid, true) as definition
        from pg_catalog.pg_constraint con
        join pg_catalog.pg_class c on c.oid = con.conrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'private', 'storage')
      ) row_data
    ),
    'indexes', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schemaname, row_data.tablename, row_data.indexname), '[]'::jsonb)
      from (
        select i.schemaname, i.tablename, i.indexname, i.indexdef
        from pg_catalog.pg_indexes i
        where i.schemaname in ('public', 'private', 'storage')
      ) row_data
    ),
    'enums', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.enum_name, row_data.sort_order), '[]'::jsonb)
      from (
        select n.nspname as schema_name,
               t.typname as enum_name,
               e.enumsortorder as sort_order,
               e.enumlabel as value
        from pg_catalog.pg_type t
        join pg_catalog.pg_namespace n on n.oid = t.typnamespace
        join pg_catalog.pg_enum e on e.enumtypid = t.oid
        where n.nspname in ('public', 'private')
      ) row_data
    ),
    'policies', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schemaname, row_data.tablename, row_data.policyname), '[]'::jsonb)
      from (
        select p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
        from pg_catalog.pg_policies p
        where p.schemaname in ('public', 'private', 'storage')
      ) row_data
    ),
    'table_grants', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.table_schema, row_data.table_name, row_data.grantee, row_data.privilege_type), '[]'::jsonb)
      from (
        select g.table_schema, g.table_name, g.grantee, g.privilege_type, g.is_grantable
        from information_schema.role_table_grants g
        where g.table_schema in ('public', 'private', 'storage')
      ) row_data
    ),
    'column_grants', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.table_schema, row_data.table_name, row_data.column_name, row_data.grantee, row_data.privilege_type), '[]'::jsonb)
      from (
        select g.table_schema, g.table_name, g.column_name, g.grantee, g.privilege_type, g.is_grantable
        from information_schema.role_column_grants g
        where g.table_schema in ('public', 'private', 'storage')
      ) row_data
    ),
    'functions', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.function_name, row_data.identity_arguments), '[]'::jsonb)
      from (
        select n.nspname as schema_name,
               p.proname as function_name,
               pg_get_function_identity_arguments(p.oid) as identity_arguments,
               pg_get_userbyid(p.proowner) as owner,
               p.prosecdef as security_definer,
               p.provolatile as volatility,
               p.proconfig as configuration,
               p.proacl::text as acl,
               encode(pg_catalog.sha256(pg_catalog.convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') as definition_sha256
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private', 'storage')
      ) row_data
    ),
    'routine_grants', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.routine_schema, row_data.routine_name, row_data.grantee), '[]'::jsonb)
      from (
        select g.routine_schema, g.routine_name, g.specific_name, g.grantee, g.privilege_type, g.is_grantable
        from information_schema.role_routine_grants g
        where g.routine_schema in ('public', 'private', 'storage')
      ) row_data
    ),
    'triggers', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.schema_name, row_data.table_name, row_data.trigger_name), '[]'::jsonb)
      from (
        select n.nspname as schema_name,
               c.relname as table_name,
               t.tgname as trigger_name,
               t.tgenabled as enabled,
               pg_get_triggerdef(t.oid, true) as definition
        from pg_catalog.pg_trigger t
        join pg_catalog.pg_class c on c.oid = t.tgrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal
          and n.nspname in ('public', 'private', 'storage')
      ) row_data
    ),
    'extensions', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.extension_name), '[]'::jsonb)
      from (
        select e.extname as extension_name, e.extversion as version, n.nspname as schema_name
        from pg_catalog.pg_extension e
        join pg_catalog.pg_namespace n on n.oid = e.extnamespace
      ) row_data
    ),
    'storage_buckets', (
      select case
        when to_regclass('storage.buckets') is null then '[]'::jsonb
        else coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', b.id,
              'name', b.name,
              'public', b.public,
              'file_size_limit', b.file_size_limit,
              'allowed_mime_types', b.allowed_mime_types
            ) order by b.id
          )
          from storage.buckets b
        ), '[]'::jsonb)
      end
    ),
    'applied_migrations', (
      select case
        when to_regclass('supabase_migrations.schema_migrations') is null then '[]'::jsonb
        else coalesce((
          select jsonb_agg(to_jsonb(m) - 'statements' order by m.version)
          from supabase_migrations.schema_migrations m
        ), '[]'::jsonb)
      end
    )
  )
);

rollback;

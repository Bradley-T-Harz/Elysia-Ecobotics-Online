\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'

-- Read-only lifecycle inventory for every non-system foreign key that points
-- directly at auth.users(id). The classification is deliberately conservative:
-- only the two automatic signup rows are newly approved for CASCADE by the
-- 20260728010000 migration. Existing authored-content cascades remain governed
-- policy risks rather than being reclassified as disposable.
with dependencies as (
  select
    source_namespace.nspname as schema_name,
    source_relation.relname as table_name,
    source_constraint.conname as constraint_name,
    pg_catalog.string_agg(source_attribute.attname, ',' order by key_position.ordinality) as source_columns,
    case source_constraint.confdeltype
      when 'a' then 'NO ACTION'
      when 'r' then 'RESTRICT'
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
    end as current_on_delete,
    pg_catalog.bool_and(source_attribute.attnotnull) as all_columns_not_null,
    source_constraint.condeferrable,
    source_constraint.condeferred,
    source_constraint.convalidated,
    pg_catalog.pg_get_constraintdef(source_constraint.oid, true) as definition
  from pg_catalog.pg_constraint as source_constraint
  join pg_catalog.pg_class as source_relation
    on source_relation.oid = source_constraint.conrelid
  join pg_catalog.pg_namespace as source_namespace
    on source_namespace.oid = source_relation.relnamespace
  cross join lateral pg_catalog.unnest(source_constraint.conkey)
    with ordinality as key_position(attribute_number, ordinality)
  join pg_catalog.pg_attribute as source_attribute
    on source_attribute.attrelid = source_relation.oid
   and source_attribute.attnum = key_position.attribute_number
  where source_constraint.contype = 'f'
    and source_constraint.confrelid = 'auth.users'::pg_catalog.regclass
    and source_namespace.nspname not in (
      'auth', 'extensions', 'information_schema', 'pg_catalog',
      'pg_toast', 'realtime', 'supabase_functions', 'supabase_migrations',
      'vault'
    )
  group by
    source_namespace.nspname,
    source_relation.relname,
    source_constraint.conname,
    source_constraint.confdeltype,
    source_constraint.condeferrable,
    source_constraint.condeferred,
    source_constraint.convalidated,
    source_constraint.oid
),
classified as (
  select
    dependencies.*,
    constraint_name in (
      'account_participation_user_id_fkey',
      'community_notification_preferences_user_id_fkey'
    ) as created_automatically_during_signup,
    table_name ~ '(posts?|comments?|repl(?:y|ies)|artworks?|submissions?|credits?|showcases?|snippets?|media|uploads?)'
      as authored_or_public_content,
    case
      when constraint_name in (
        'account_participation_user_id_fkey',
        'community_notification_preferences_user_id_fkey'
      ) then 'A_CASCADE_WITH_AUTH_USER'
      when table_name ~ '(audit|event|legal|hold|consent|agreement|provenance|moderation|report|appeal|case|restriction|transaction|order|payment|refund|dispute|contract|license|award|score|terms_acceptance)'
        then 'C_RETAIN_AUDIT_OR_LEGAL_EVIDENCE'
      when table_name ~ '(posts?|comments?|repl(?:y|ies)|artworks?|submissions?|credits?|showcases?|snippets?|media|uploads?)'
        then 'D_GOVERNED_PREDELETE_DISPOSITION'
      when current_on_delete = 'SET NULL'
        then 'B_SET_NULL_OR_ANONYMIZE_AND_RETAIN'
      when current_on_delete = 'CASCADE'
        then 'A_CASCADE_WITH_AUTH_USER'
      else 'D_GOVERNED_PREDELETE_DISPOSITION'
    end as lifecycle_classification,
    case
      when constraint_name in (
        'account_participation_user_id_fkey',
        'community_notification_preferences_user_id_fkey'
      ) then 'Disposable bootstrap state; CASCADE is reviewed and migration-controlled.'
      when table_name ~ '(audit|event|legal|hold|consent|agreement|provenance|moderation|report|appeal|case|restriction|transaction|order|payment|refund|dispute|contract|license|award|score|terms_acceptance)'
        then 'Retain only for the documented safety, legal, attribution, or audit purpose; minimize identity and keep governed restrictions.'
      when table_name ~ '(posts?|comments?|repl(?:y|ies)|artworks?|submissions?|credits?|showcases?|snippets?|media|uploads?)'
        then 'Resolve deletion, retention, license, attribution, and anonymization in the governed workflow before hard Auth deletion.'
      when current_on_delete = 'SET NULL'
        then 'Existing SET NULL policy retains the record without the direct Auth identity.'
      when current_on_delete = 'CASCADE'
        then 'Existing account-owned state follows Auth deletion; no new policy change in this repair.'
      else 'Existing RESTRICT/NO ACTION remains a deliberate preflight gate pending an explicit record-level disposition.'
    end as lifecycle_decision
  from dependencies
)
select
  schema_name,
  table_name,
  source_columns,
  constraint_name,
  current_on_delete,
  all_columns_not_null,
  created_automatically_during_signup,
  authored_or_public_content,
  lifecycle_classification,
  lifecycle_decision,
  condeferrable,
  condeferred,
  convalidated,
  definition
from classified
order by schema_name, table_name, constraint_name;

-- Non-internal triggers on auth.users. DELETE behavior is visible in each
-- definition; the current application trigger is INSERT-only bootstrap.
select
  trigger_state.tgname as trigger_name,
  case trigger_state.tgenabled
    when 'O' then 'origin'
    when 'D' then 'disabled'
    when 'R' then 'replica'
    when 'A' then 'always'
  end as enabled,
  trigger_namespace.nspname || '.' || trigger_function.proname as function_name,
  pg_catalog.pg_get_triggerdef(trigger_state.oid, true) as definition
from pg_catalog.pg_trigger as trigger_state
join pg_catalog.pg_proc as trigger_function
  on trigger_function.oid = trigger_state.tgfoid
join pg_catalog.pg_namespace as trigger_namespace
  on trigger_namespace.oid = trigger_function.pronamespace
where trigger_state.tgrelid = 'auth.users'::pg_catalog.regclass
  and not trigger_state.tgisinternal
order by trigger_state.tgname;

-- Storage ownership is intentionally outside the foreign-key result above.
-- Supabase Storage objects must be removed or reassigned with the Storage API,
-- never by direct SQL deletion from storage.objects.
select
  storage_namespace.nspname as schema_name,
  storage_relation.relname as table_name,
  storage_attribute.attname as ownership_column,
  pg_catalog.format_type(storage_attribute.atttypid, storage_attribute.atttypmod) as data_type,
  storage_attribute.attnotnull as not_null,
  'E_STORAGE_API_CLEANUP_OR_OWNERSHIP_TRANSFER' as lifecycle_classification
from pg_catalog.pg_class as storage_relation
join pg_catalog.pg_namespace as storage_namespace
  on storage_namespace.oid = storage_relation.relnamespace
join pg_catalog.pg_attribute as storage_attribute
  on storage_attribute.attrelid = storage_relation.oid
 and storage_attribute.attnum > 0
 and not storage_attribute.attisdropped
where storage_namespace.nspname = 'storage'
  and storage_relation.relname = 'objects'
  and storage_attribute.attname in ('owner', 'owner_id')
order by storage_attribute.attname;

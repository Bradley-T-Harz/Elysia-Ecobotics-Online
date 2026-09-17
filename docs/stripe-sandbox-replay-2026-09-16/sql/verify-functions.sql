-- Install checker within a rolled-back validation transaction, never persist it.
begin;
create extension if not exists plpgsql_check with schema extensions;
do $check$
declare findings jsonb; checked integer;
begin
 select count(*) into checked from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang where n.nspname in ('public','private')
 and l.lanname='plpgsql' and p.prokind='f' and p.prorettype<>'pg_catalog.trigger'::regtype;
 select jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,'level',lint.level,'sqlstate',lint.sqlstate,'message',lint.message,'line',lint.lineno)) into findings
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang
 cross join lateral extensions.plpgsql_check_function_tb(p.oid, fatal_errors := false) lint
 where n.nspname in ('public','private') and l.lanname='plpgsql' and p.prokind='f'
 and p.prorettype<>'pg_catalog.trigger'::regtype and lower(coalesce(lint.level,'')) in ('error','fatal');
 if findings is not null then raise exception 'plpgsql_check_findings: %',findings;end if;
 raise notice 'sandbox_plpgsql_check_passed: % non-trigger routines',checked;
end;
$check$;
rollback;

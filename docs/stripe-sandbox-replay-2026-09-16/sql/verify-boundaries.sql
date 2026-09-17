-- Database boundary validation only. No provider calls, fixture rows or gate changes.
begin;
do $verify$
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>74
    or (select max(version) from supabase_migrations.schema_migrations)<>'20260915070000' then raise exception 'migration_ledger_mismatch';end if;
 if private.economic_runtime_mode()<>'test' then raise exception 'sandbox_database_not_test_mode';end if;
 if exists(select 1 from private.economic_feature_flags where enabled and feature_key not in ('sandbox_credit_display','sandbox_credit_enforcement')) then raise exception 'financial_gate_enabled';end if;
 if private.economic_feature_enabled('marketplace_paid_offers')
    or private.economic_feature_enabled('marketplace_seller_onboarding')
    or private.economic_feature_enabled('marketplace_payouts')
    or private.economic_feature_enabled('sandbox_credit_purchase') then raise exception 'forbidden_money_available';end if;
 if private.economic_fee_minor(199,500)<>10 or private.economic_fee_minor(10,500)<>1
    or private.economic_round_ratio(1,2)<>1 then raise exception 'money_rounding_invalid';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'public_table_without_rls';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind in ('r','p') and (has_table_privilege('anon',c.oid,'select,insert,update,delete') or has_table_privilege('authenticated',c.oid,'select,insert,update,delete'))) then raise exception 'private_table_exposed';end if;
 if has_schema_privilege('anon','private','usage') or has_schema_privilege('authenticated','private','usage') then raise exception 'private_schema_exposed';end if;
 if exists(select 1 from storage.buckets where public) then raise exception 'public_storage_bucket';end if;
end;
$verify$;
set local role anon;
do $anonymous$
declare ready jsonb;
begin
 begin
  perform count(*) from private.economic_orders;
  raise exception 'anonymous_private_read_succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
  perform private.economic_fee_minor(100,500);
  raise exception 'anonymous_money_helper_succeeded';
 exception when insufficient_privilege then null;
 end;
 ready:=public.current_first_party_provider_readiness();
 if ready->>'mode'<>'test' or ready->>'thirdPartyStatus'<>'hard_off'
   or exists(select 1 from jsonb_array_elements(ready->'lanes') lane where (lane->>'enabled')::boolean) then raise exception 'anonymous_readiness_invalid';end if;
end;
$anonymous$;
reset role;
set local role authenticated;
do $authenticated$
begin
 begin
  perform count(*) from private.economic_payment_transactions;
  raise exception 'authenticated_private_read_succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
  update private.economic_feature_flags set enabled=true where false;
  raise exception 'authenticated_gate_write_privilege_exists';
 exception when insufficient_privilege then null;
 end;
end;
$authenticated$;
reset role;
rollback;

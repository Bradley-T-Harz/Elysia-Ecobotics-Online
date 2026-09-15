begin;
do $$
declare gross bigint; fee bigint; refunded bigint; prior bigint; reversed bigint;
begin
  if private.economic_fee_minor(199,500)<>10 or private.economic_fee_minor(10,500)<>1
     or private.economic_fee_minor(1,500)<>0 or private.economic_fee_minor(999,500)<>50
     or private.economic_fee_minor(100000000000,500)<>5000000000 then
    raise exception 'Canonical half-up edge cases failed';
  end if;
  foreach gross in array array[1,10,199,999,1000,10001] loop
    foreach fee in array array[floor(gross::numeric/20)::bigint,private.economic_fee_minor(gross,500)] loop
      prior:=0;
      for refunded in 1..gross loop
        reversed:=private.economic_round_ratio(fee::numeric*refunded,gross);
        if reversed<prior or reversed-prior>1 then raise exception 'Nonconserving cumulative reversal'; end if;
        prior:=reversed;
      end loop;
      if prior<>fee then raise exception 'Original fee did not fully reverse'; end if;
    end loop;
  end loop;
  if has_function_privilege('anon','private.economic_fee_minor(bigint,integer)','execute')
    or has_function_privilege('authenticated','private.economic_round_ratio(numeric,numeric)','execute') then
    raise exception 'Private money helper exposed';
  end if;
end;
$$;
rollback;

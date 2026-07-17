-- Test-mode provider catalog references are kept beside, not inside, the
-- provider-neutral product and price model. Recording references cannot enable
-- checkout and cannot activate a live provider account.

begin;

create table private.economic_provider_catalog (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references private.economic_products(product_key) on delete restrict,
  price_code text references private.economic_prices(price_code) on delete restrict,
  provider text not null,
  provider_product_reference text not null,
  provider_price_reference text,
  test_mode boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint economic_provider_catalog_provider_check
    check (provider ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint economic_provider_catalog_product_reference_check
    check (pg_catalog.char_length(provider_product_reference) between 1 and 255),
  constraint economic_provider_catalog_price_reference_check
    check (
      provider_price_reference is null
      or pg_catalog.char_length(provider_price_reference) between 1 and 255
    ),
  constraint economic_provider_catalog_price_pair_check check (
    (price_code is null) = (provider_price_reference is null)
  ),
  constraint economic_provider_catalog_test_only_check check (test_mode = true),
  constraint economic_provider_catalog_retirement_check check (
    (active and retired_at is null) or (not active and retired_at is not null)
  )
);

create unique index economic_provider_catalog_price_code_idx
  on private.economic_provider_catalog(provider, price_code)
  where price_code is not null;
create unique index economic_provider_catalog_product_only_idx
  on private.economic_provider_catalog(provider, product_key)
  where price_code is null;
create unique index economic_provider_catalog_provider_price_idx
  on private.economic_provider_catalog(provider, provider_price_reference)
  where provider_price_reference is not null;

alter table private.economic_provider_catalog owner to postgres;
alter table private.economic_provider_catalog enable row level security;
revoke all privileges on table private.economic_provider_catalog
  from public, anon, authenticated, service_role;

create or replace function public.record_economic_test_catalog_reference(
  p_product_key text,
  p_price_code text,
  p_provider text,
  p_provider_product_id text,
  p_provider_price_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price private.economic_prices%rowtype;
  v_catalog private.economic_provider_catalog%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if coalesce(p_provider, '') !~ '^[a-z][a-z0-9_]{1,40}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_provider_product_id, ''))) not between 1 and 255
     or ((p_price_code is null) <> (nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), '') is null))
     or (
       p_provider_price_id is not null
       and pg_catalog.char_length(pg_catalog.btrim(p_provider_price_id)) not between 1 and 255
     ) then
    raise exception using errcode = '22023', message = 'economic_provider_catalog_reference_invalid';
  end if;

  if p_price_code is null then
    if p_product_key <> 'support_one_time'
       or not exists (
         select 1 from private.economic_products as product
         where product.product_key = p_product_key
           and product.active = true
           and product.test_mode_only = true
       ) then
      raise exception using errcode = 'P0002', message = 'economic_test_product_not_found';
    end if;
  else
    select * into v_price
    from private.economic_prices as price
    where price.price_code = p_price_code
      and price.product_key = p_product_key
      and price.test_mode_only = true
      and price.active = true
      and price.retired_at is null;

    if not found then
      raise exception using errcode = 'P0002', message = 'economic_test_price_not_found';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider || ':' || p_product_key || ':' || coalesce(p_price_code, 'product-only'), 0)
  );

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = p_provider
    and (
      (p_price_code is not null and catalog.price_code = p_price_code)
      or (p_price_code is null and catalog.price_code is null and catalog.product_key = p_product_key)
    )
  for update;

  if found then
    update private.economic_provider_catalog
    set
      product_key = p_product_key,
      provider_product_reference = pg_catalog.btrim(p_provider_product_id),
      provider_price_reference = nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), ''),
      test_mode = true,
      active = true,
      retired_at = null,
      updated_at = pg_catalog.now()
    where id = v_catalog.id
    returning * into v_catalog;
  else
    insert into private.economic_provider_catalog (
      product_key, price_code, provider,
      provider_product_reference, provider_price_reference,
      test_mode, active
    ) values (
      p_product_key,
      p_price_code,
      p_provider,
      pg_catalog.btrim(p_provider_product_id),
      nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), ''),
      true,
      true
    ) returning * into v_catalog;
  end if;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'system',
    'test_provider_catalog_reference_recorded',
    'economic_provider_catalog',
    v_catalog.id,
    pg_catalog.jsonb_build_object(
      'product_key', v_catalog.product_key,
      'price_code', v_catalog.price_code,
      'provider', v_catalog.provider,
      'test_mode', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'productKey', v_catalog.product_key,
    'priceCode', v_catalog.price_code,
    'provider', v_catalog.provider,
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference,
    'testMode', true
  );
end;
$$;

alter function public.record_economic_test_catalog_reference(text, text, text, text, text)
  owner to postgres;

create or replace function public.lookup_economic_test_catalog_reference(
  p_price_code text,
  p_provider text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_catalog private.economic_provider_catalog%rowtype;
  v_product_key text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  select price.product_key into v_product_key
  from private.economic_prices as price
  where price.price_code = p_price_code;

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = p_provider
    and (
      catalog.price_code = p_price_code
      or (
        catalog.price_code is null
        and v_product_key = 'support_one_time'
        and catalog.product_key = v_product_key
      )
    )
    and catalog.test_mode = true
    and catalog.active = true
    and catalog.retired_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_test_catalog_reference_not_found';
  end if;

  return pg_catalog.jsonb_build_object(
    'productKey', v_catalog.product_key,
    'priceCode', v_catalog.price_code,
    'provider', v_catalog.provider,
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference,
    'testMode', true
  );
end;
$$;

alter function public.lookup_economic_test_catalog_reference(text, text) owner to postgres;

-- Checkout remains the stable service RPC expected by the billing proxy. The
-- underlying order mutation is provider-neutral; this wrapper only binds an
-- explicitly recorded test catalog reference to the response.
create or replace function public.begin_economic_checkout(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_flow text,
  p_amount_minor bigint,
  p_currency text,
  p_price_code text,
  p_source_route text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog private.economic_provider_catalog%rowtype;
  v_result jsonb;
  v_product_key text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  select price.product_key into v_product_key
  from private.economic_prices as price
  where price.price_code = p_price_code;

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = 'stripe'
    and (
      catalog.price_code = p_price_code
      or (
        catalog.price_code is null
        and v_product_key = 'support_one_time'
        and catalog.product_key = v_product_key
      )
    )
    and catalog.test_mode = true
    and catalog.active = true
    and catalog.retired_at is null;

  if not found then
    raise exception using errcode = '55000', message = 'economic_test_catalog_not_configured';
  end if;

  v_result := private.begin_economic_checkout_core(
    p_actor_user_id,
    p_client_request_id,
    p_flow,
    p_amount_minor,
    p_currency,
    p_price_code,
    p_source_route,
    p_consent_version
  );

  return v_result || pg_catalog.jsonb_build_object(
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference
  );
end;
$$;

alter function public.begin_economic_checkout(uuid, uuid, text, bigint, text, text, text, text)
  owner to postgres;

revoke all privileges on function public.record_economic_test_catalog_reference(text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.lookup_economic_test_catalog_reference(text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.begin_economic_checkout(uuid, uuid, text, bigint, text, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.record_economic_test_catalog_reference(text, text, text, text, text)
  to service_role;
grant execute on function public.lookup_economic_test_catalog_reference(text, text)
  to service_role;
grant execute on function public.begin_economic_checkout(uuid, uuid, text, bigint, text, text, text, text)
  to service_role;

comment on table private.economic_provider_catalog is
  'Replaceable provider test references. Catalog records are private, test-only, and cannot enable a feature.';
comment on function public.begin_economic_checkout is
  'Service-only idempotent checkout preparation. Returns trusted test catalog references without exposing private economic tables.';

commit;

-- Codev pairing metadata only. Pairing conveys no workspace, file, command,
-- model-provider, publisher, reviewer, financial, or native API authority.
-- Anonymous native RPCs require separate unpredictable, single-purpose secrets.
-- Pages needs only the existing public Supabase binding, never a service-role key.
begin;

create function private.codev_public_key_valid(p_key jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(p_key) is distinct from 'object' then return false; end if;
  return coalesce((select count(*)=4 from jsonb_object_keys(p_key))
    and p_key->>'kty'='EC' and p_key->>'crv'='P-256'
    and coalesce(p_key->>'x','') ~ '^[A-Za-z0-9_-]{43}$'
    and coalesce(p_key->>'y','') ~ '^[A-Za-z0-9_-]{43}$',false);
end $$;

create table private.codev_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  online_session_id uuid not null references auth.sessions(id) on delete cascade,
  account_label text not null check (char_length(account_label) between 1 and 200),
  origin text not null check (origin in ('https://elysiaecobotics.com','https://www.elysiaecobotics.com')),
  surface text not null check (surface in ('marketplace','forge')),
  browser_session_id text not null check (browser_session_id ~ '^[A-Za-z0-9_-]{32,128}$'),
  browser_public_key jsonb not null check (private.codev_public_key_valid(browser_public_key)),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  native_secret_hash text check (native_secret_hash ~ '^[a-f0-9]{64}$'),
  native_public_key jsonb check (native_public_key is null or private.codev_public_key_valid(native_public_key)),
  status text not null default 'pending' check (status in ('pending','native_approved','paired','denied','revoked')),
  created_at timestamptz not null default now(),
  intent_expires_at timestamptz not null default now()+interval '5 minutes',
  claimed_at timestamptz,
  approved_at timestamptz,
  pairing_expires_at timestamptz,
  check ((native_secret_hash is null) = (native_public_key is null)),
  check (status not in ('native_approved','paired') or (native_public_key is not null and approved_at is not null and pairing_expires_at is not null))
);
create index codev_pairings_owner_created on private.codev_pairings(user_id,created_at);
create index codev_pairings_login on private.codev_pairings(online_session_id);
alter table private.codev_pairings enable row level security;
revoke all on private.codev_pairings from public,anon,authenticated,service_role;

create table private.codev_pairing_events (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references private.codev_pairings(id) on delete cascade,
  action text not null check (action in ('intent_created','native_claimed','native_approved','paired','denied','revoked')),
  created_at timestamptz not null default now()
);
alter table private.codev_pairing_events enable row level security;
revoke all on private.codev_pairing_events from public,anon,authenticated,service_role;

create function private.codev_account_session_active(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.community_account_allows_ordinary_mutation(p_user)
    and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()));
$$;

create function private.codev_browser_session() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare s uuid; a uuid:=auth.uid();
begin
  begin s:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then return null; end;
  if a is null or s is null or not private.codev_account_session_active(a,s) then return null; end if;
  return s;
end $$;

create function private.codev_pairing_view(p private.codev_pairings) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('pairing_id',p.id,'native_public_key',p.native_public_key,
    'intent',jsonb_build_object('contract_version','codev-pairing-1','intent_id',p.id,
      'online_account_id',p.user_id,'account_label',p.account_label,'origin',p.origin,'surface',p.surface,
      'browser_session_id',p.browser_session_id,'browser_public_key',p.browser_public_key,
      'expires_at',coalesce(p.pairing_expires_at,p.intent_expires_at),
      'status',case when p.status in ('denied','revoked') then p.status
                    when coalesce(p.pairing_expires_at,p.intent_expires_at)<=now() then 'expired' else p.status end),
    'workspace_grants','[]'::jsonb);
$$;

create function private.codev_pairing_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare event text;
begin
  if tg_op='INSERT' then event:='intent_created';
  elsif new.status is distinct from old.status then event:=new.status;
  elsif old.claimed_at is null and new.claimed_at is not null then event:='native_claimed';
  end if;
  if event is not null then insert into private.codev_pairing_events(pairing_id,action) values(new.id,event); end if;
  return new;
end $$;
create trigger codev_pairing_audit after insert or update on private.codev_pairings
  for each row execute function private.codev_pairing_audit();

create function public.codev_create_pairing_intent(p_origin text,p_surface text,p_browser_session_id text,p_browser_public_key jsonb,p_code_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); s uuid:=private.codev_browser_session(); row private.codev_pairings%rowtype; label text;
begin
  if s is null then raise exception using errcode='42501',message='codev_account_session_unavailable'; end if;
  if p_origin not in ('https://elysiaecobotics.com','https://www.elysiaecobotics.com')
    or p_surface not in ('marketplace','forge') or p_browser_session_id !~ '^[A-Za-z0-9_-]{32,128}$'
    or not private.codev_public_key_valid(p_browser_public_key) or p_code_hash !~ '^[a-f0-9]{64}$'
    or p_origin is null or p_surface is null or p_browser_session_id is null or p_code_hash is null then
    raise exception using errcode='22023',message='codev_pairing_input_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('codev-pairing:'||a::text,0));
  -- Prune this account's expired metadata older than a day on its next intent. No source is stored.
  delete from private.codev_pairings where user_id=a and created_at<now()-interval '1 day'
    and coalesce(pairing_expires_at,intent_expires_at)<now();
  if (select count(*) from private.codev_pairings where user_id=a and created_at>now()-interval '1 hour')>=10 then
    raise exception using errcode='P0001',message='codev_pairing_rate_limited';
  end if;
  update private.codev_pairings set status='revoked' where user_id=a and online_session_id=s and origin=p_origin
    and surface=p_surface and browser_session_id=p_browser_session_id and status in ('pending','native_approved','paired');
  select left(coalesce(nullif(email,''),a::text),200) into label from auth.users where id=a;
  insert into private.codev_pairings(user_id,online_session_id,account_label,origin,surface,browser_session_id,browser_public_key,code_hash)
    values(a,s,label,p_origin,p_surface,p_browser_session_id,p_browser_public_key,p_code_hash) returning * into row;
  return private.codev_pairing_view(row);
end $$;

create function public.codev_browser_pairing(p_pairing_id uuid,p_origin text,p_surface text,p_browser_session_id text,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); s uuid:=private.codev_browser_session(); row private.codev_pairings%rowtype;
begin
  if s is null or p_action not in ('status','finish','revoke') or p_action is null then return null; end if;
  select * into row from private.codev_pairings where id=p_pairing_id and user_id=a and online_session_id=s
    and origin=p_origin and surface=p_surface and browser_session_id=p_browser_session_id for update;
  if not found then return null; end if;
  if p_action='revoke' then
    update private.codev_pairings set status='revoked' where id=row.id returning * into row;
  elsif p_action='finish' then
    if row.status not in ('native_approved','paired') or row.pairing_expires_at<=now() then return null; end if;
    update private.codev_pairings set status='paired' where id=row.id returning * into row;
  end if;
  return private.codev_pairing_view(row);
end $$;

create function public.codev_claim_pairing_intent(p_code_hash text,p_native_public_key jsonb,p_native_secret_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.codev_pairings%rowtype;
begin
  if p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' or p_native_secret_hash is null
    or p_native_secret_hash !~ '^[a-f0-9]{64}$' or not private.codev_public_key_valid(p_native_public_key) then return null; end if;
  select * into row from private.codev_pairings where code_hash=p_code_hash for update;
  if not found or row.status<>'pending' or row.native_public_key is not null or row.intent_expires_at<=now()
    or not private.codev_account_session_active(row.user_id,row.online_session_id) then return null; end if;
  update private.codev_pairings set native_public_key=p_native_public_key,native_secret_hash=p_native_secret_hash,claimed_at=now()
    where id=row.id returning * into row;
  return private.codev_pairing_view(row);
end $$;

create function public.codev_native_pairing(p_pairing_id uuid,p_native_secret_hash text,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.codev_pairings%rowtype;
begin
  if p_native_secret_hash is null or p_native_secret_hash !~ '^[a-f0-9]{64}$'
    or p_action is null or p_action not in ('confirm','lease','deny','revoke') then return null; end if;
  select * into row from private.codev_pairings where id=p_pairing_id and native_secret_hash=p_native_secret_hash for update;
  if not found or not private.codev_account_session_active(row.user_id,row.online_session_id) then return null; end if;
  if p_action in ('deny','revoke') then
    update private.codev_pairings set status=case when p_action='deny' then 'denied' else 'revoked' end where id=row.id returning * into row;
  elsif p_action='confirm' then
    if row.status<>'pending' or row.intent_expires_at<=now() or row.native_public_key is null then return null; end if;
    update private.codev_pairings set status='native_approved',approved_at=now(),pairing_expires_at=now()+interval '15 minutes'
      where id=row.id returning * into row;
  else
    if row.status not in ('native_approved','paired') or row.pairing_expires_at<=now() then return null; end if;
  end if;
  return private.codev_pairing_view(row);
end $$;

alter table private.codev_pairings owner to postgres;
alter table private.codev_pairings force row level security;
alter table private.codev_pairing_events owner to postgres;
alter table private.codev_pairing_events force row level security;
alter function private.codev_public_key_valid(jsonb) owner to postgres;
alter function private.codev_account_session_active(uuid,uuid) owner to postgres;
alter function private.codev_browser_session() owner to postgres;
alter function private.codev_pairing_view(private.codev_pairings) owner to postgres;
alter function private.codev_pairing_audit() owner to postgres;
alter function public.codev_create_pairing_intent(text,text,text,jsonb,text) owner to postgres;
alter function public.codev_browser_pairing(uuid,text,text,text,text) owner to postgres;
alter function public.codev_claim_pairing_intent(text,jsonb,text) owner to postgres;
alter function public.codev_native_pairing(uuid,text,text) owner to postgres;

revoke all on function private.codev_public_key_valid(jsonb),private.codev_account_session_active(uuid,uuid),
  private.codev_browser_session(),private.codev_pairing_view(private.codev_pairings),private.codev_pairing_audit()
  from public,anon,authenticated,service_role;
revoke all on function public.codev_create_pairing_intent(text,text,text,jsonb,text),
  public.codev_browser_pairing(uuid,text,text,text,text),public.codev_claim_pairing_intent(text,jsonb,text),
  public.codev_native_pairing(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.codev_create_pairing_intent(text,text,text,jsonb,text),
  public.codev_browser_pairing(uuid,text,text,text,text) to authenticated;
grant execute on function public.codev_claim_pairing_intent(text,jsonb,text),public.codev_native_pairing(uuid,text,text) to anon;

comment on table private.codev_pairings is 'Ephemeral Codev pairing identity only. No workspace, file, command, provider, publication, or role grants. Login deletion cascades to revoke pairing.';
comment on table private.codev_pairing_events is 'Bounded pairing lifecycle metadata only; no secret values, source files, or workspace content.';
commit;

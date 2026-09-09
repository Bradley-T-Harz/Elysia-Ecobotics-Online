-- Publisher governance only. No production identities, official release seeds,
-- reviews, financial records, provider calls or activation settings are created.
begin;

-- Keep the existing publisher entity. owner_id is a legacy individual-account
-- compatibility link, never the durable owner of an organization publisher.
alter table public.publishers alter column owner_id drop not null;
alter table public.publishers drop constraint publishers_owner_id_fkey;
alter table public.publishers add constraint publishers_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete set null;
alter table public.publishers add column entity_kind text not null default 'individual' check (entity_kind in ('individual','organization'));
alter table public.publishers add column legal_name text check (length(btrim(legal_name)) between 1 and 200);
alter table public.publishers add constraint organization_publisher_is_entity check (entity_kind <> 'organization' or owner_id is null);

create table private.marketplace_publisher_managers (
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  authorized_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (publisher_id,user_id)
);
create table private.marketplace_publisher_audit (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  actor_user_id uuid, -- private historical actor identifier; must not block account deletion
  action text not null,
  authorization_basis text not null check (length(btrim(authorization_basis)) between 1 and 1000),
  prior_state jsonb not null default '{}'::jsonb,
  resulting_state jsonb not null,
  created_at timestamptz not null default now()
);
create table private.marketplace_publisher_addons (
  addon_key text primary key check (addon_key ~ '^[a-z0-9][a-z0-9._-]{1,159}$'),
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  registered_at timestamptz not null default now()
);
-- An external release reference establishes provenance, not Marketplace review,
-- publication, installation, an offering, or entitlement. It is not a catalog.
create table private.marketplace_publisher_release_references (
  id uuid primary key default gen_random_uuid(),
  addon_key text not null references private.marketplace_publisher_addons(addon_key) on delete restrict,
  version text not null check (length(version) between 1 and 80),
  creator_attribution text not null check (length(btrim(creator_attribution)) between 1 and 200),
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  publisher_display_name text not null,
  package_url text not null check (package_url ~ '^https://[^[:space:]]+$'),
  package_sha256 text not null check (package_sha256 ~ '^[a-f0-9]{64}$'),
  release_reference_url text not null check (release_reference_url ~ '^https://[^[:space:]]+$'),
  official boolean not null default false,
  distribution_kind text not null default 'free' check (distribution_kind = 'free'),
  recorded_at timestamptz not null default now(),
  unique (addon_key,version), unique (package_sha256)
);

do $$ declare t text; begin
  foreach t in array array['marketplace_publisher_managers','marketplace_publisher_audit','marketplace_publisher_addons','marketplace_publisher_release_references'] loop
    execute format('alter table private.%I owner to postgres',t);
    execute format('alter table private.%I enable row level security',t);
    execute format('alter table private.%I force row level security',t);
    execute format('revoke all on private.%I from public, anon, authenticated, service_role',t);
  end loop;
end $$;

create function private.publisher_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid := auth.uid();
begin
  if a is null or not private.community_account_is_active(a) or not private.community_account_is_recoverable(a)
    or not exists(select 1 from auth.users u where u.id=a and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())) then
    raise exception using errcode='42501',message='publisher_account_required';
  end if;
  return a;
end $$;

create function private.publisher_manages(p_actor uuid,p_publisher uuid) returns boolean language sql stable security definer set search_path='' as $$
  select p_actor is not null and private.community_account_is_active(p_actor) and private.community_account_is_recoverable(p_actor)
    and exists(select 1 from auth.users u where u.id=p_actor and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now()))
    and (exists(select 1 from private.marketplace_publisher_managers m where m.publisher_id=p_publisher and m.user_id=p_actor and m.revoked_at is null)
      or exists(select 1 from public.publishers p where p.id=p_publisher and p.entity_kind='individual' and p.owner_id=p_actor and not exists(select 1 from private.marketplace_publisher_managers m where m.publisher_id=p.id and m.user_id=p_actor)));
$$;

create function public.current_user_can_manage_publisher(p_publisher_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.publisher_manages(auth.uid(),p_publisher_id);
$$;

create function private.publisher_addon_key(p_manifest jsonb) returns text language sql immutable set search_path='' as $$
  select coalesce(nullif(p_manifest->>'addon_id',''),nullif(p_manifest->>'id',''));
$$;

create function private.publisher_assert_namespace(p_publisher uuid,p_key text,p_register boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
  if p_publisher is null or p_key is null or p_key !~ '^[a-z0-9][a-z0-9._-]{1,159}$' then raise exception using errcode='22023',message='publisher_addon_identity_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('marketplace-publisher-addon:'||p_key,0));
  select publisher_id into existing from private.marketplace_publisher_addons where addon_key=p_key;
  if existing is not null and existing<>p_publisher then raise exception using errcode='42501',message='publisher_addon_owned_elsewhere'; end if;
  if exists(select 1 from public.marketplace_listings l where l.addon_id=p_key and l.publisher_id is distinct from p_publisher) then
    raise exception using errcode='42501',message='publisher_existing_listing_requires_reconciliation';
  end if;
  if p_register and existing is null then insert into private.marketplace_publisher_addons(addon_key,publisher_id) values(p_key,p_publisher); end if;
end $$;

-- Nullable additions preserve historical records exactly; new submissions must
-- acquire authoritative provenance through the triggers below.
alter table public.addon_drafts add column publisher_id uuid references public.publishers(id) on delete restrict;
alter table public.addon_drafts add column creator_attribution text check (length(btrim(creator_attribution)) between 1 and 200);
alter table public.addon_submissions add column publisher_id uuid references public.publishers(id) on delete restrict;
alter table public.addon_submissions add column creator_attribution text;
alter table public.addon_submissions add column publisher_display_name text;
alter table public.addon_submission_snapshots add column publisher_id uuid references public.publishers(id) on delete restrict;
alter table public.addon_submission_snapshots add column creator_attribution text;
alter table public.addon_submission_snapshots add column publisher_display_name text;
alter table public.marketplace_listings add column publisher_id uuid references public.publishers(id) on delete restrict;
alter table public.marketplace_listings add column creator_attribution text;
alter table public.marketplace_listings add column publisher_display_name text;
alter table public.marketplace_addon_versions add column source_submission_id uuid references public.addon_submissions(id) on delete restrict;
alter table public.marketplace_addon_versions add column publisher_id uuid references public.publishers(id) on delete restrict;
alter table public.marketplace_addon_versions add column creator_attribution text;
alter table public.marketplace_addon_versions add column publisher_display_name text;

-- Only new governed snapshots are unique; historical rows are not rewritten.
create unique index publisher_one_snapshot_per_submission on public.addon_submission_snapshots(submission_id) where publisher_id is not null;

-- Compatibility with the existing verified account-deletion finalizer. This
-- authorizes only narrowly checked archive/withdraw/revoke transitions below.
create function private.publisher_deletion_cleanup(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.community_caller_is_service_role() and exists(
    select 1 from private.account_lifecycle_requests r
    join private.account_deletion_handoffs h on h.lifecycle_request_id=r.id
    join private.account_deletion_finalizer_jobs j on j.lifecycle_request_id=r.id
    where r.user_id=p_user and r.action='account_deletion' and r.status='storage_cleanup'
      and h.storage_cleanup_completed_at is not null and h.storage_cleanup_evidence_sha256 is not null
      and j.status='processing' and j.phase='artisan_cleanup' and j.lease_expires_at>now()
      and not private.community_deletion_has_active_account_hold(p_user)
      and coalesce((private.community_economic_deletion_readiness(p_user)->>'canComplete')::boolean,false));
$$;

-- A departing developer account must not revoke an organization's releases.
-- Reconcile only the two publisher-dependent clauses in the existing function;
-- stop if that reviewed implementation has changed. All other cleanup remains.
do $publisher_lifecycle$
declare definition text:=pg_get_functiondef('private.apply_automatic_community_deletion_anonymization(uuid)'::regprocedure);
  old_sub text:=$old$  where submitted_by = v_request.user_id
    and status not in ('withdrawn','security_hold');$old$;
  old_listing text:=$old$    and developer.user_id = v_request.user_id
    and listing.listing_status <> 'revoked';$old$;
begin
  if strpos(definition,old_sub)=0 or strpos(definition,old_listing)=0 then raise exception 'publisher_lifecycle_reconciliation_source_changed';end if;
  definition:=replace(definition,old_sub,$new$  where submitted_by = v_request.user_id
    and status not in ('withdrawn','security_hold')
    and not exists(select 1 from public.publishers p where p.id=addon_submissions.publisher_id and p.entity_kind='organization'
      and (exists(select 1 from public.marketplace_listings l where l.source_submission_id=addon_submissions.id)
        or exists(select 1 from public.marketplace_addon_versions v where v.source_submission_id=addon_submissions.id)));$new$);
  definition:=replace(definition,old_listing,$new$    and developer.user_id = v_request.user_id
    and listing.listing_status <> 'revoked'
    and not exists(select 1 from public.publishers p where p.id=listing.publisher_id and p.entity_kind='organization');$new$);
  execute definition;
end $publisher_lifecycle$;

-- Governed identity operations are SQL-owner-only, not admin, reviewer, service
-- or economic RPCs. Release operators supply independently verified account IDs.
create function private.establish_marketplace_publisher(p_slug text,p_name text,p_legal_name text,p_manager uuid,p_actor uuid,p_authorization text,p_operation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publishers%rowtype;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' or length(btrim(p_name)) not between 1 and 200 or length(btrim(p_legal_name)) not between 1 and 200
    or p_operation is null or p_actor is null or length(btrim(p_authorization)) not between 1 and 1000
    or not private.community_account_is_active(p_manager) or not exists(select 1 from auth.users where id=p_manager and deleted_at is null and not coalesce(is_anonymous,false)) then
    raise exception using errcode='22023',message='publisher_establishment_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('marketplace-publisher:'||p_slug,0));
  select * into p from public.publishers where slug=p_slug for update;
  if p.id is not null then
    if p.entity_kind<>'organization' or p.legal_name is distinct from btrim(p_legal_name) or p.name is distinct from btrim(p_name)
      or not exists(select 1 from private.marketplace_publisher_managers where publisher_id=p.id and user_id=p_manager and revoked_at is null) then
      raise exception using errcode='23505',message='publisher_establishment_conflicting_claim';
    end if;
    return p.id;
  end if;
  insert into public.publishers(owner_id,name,slug,entity_kind,legal_name) values(null,btrim(p_name),p_slug,'organization',btrim(p_legal_name)) returning * into p;
  insert into private.marketplace_publisher_managers(publisher_id,user_id) values(p.id,p_manager);
  insert into private.marketplace_publisher_audit(operation_id,publisher_id,actor_user_id,action,authorization_basis,resulting_state)
    values(p_operation,p.id,p_actor,'publisher_established',btrim(p_authorization),jsonb_build_object('publisher_id',p.id,'legal_name',p.legal_name,'manager_user_id',p_manager,'established_from',now(),'review_approval',false,'financial_authority',false));
  return p.id;
end $$;

create function private.authorize_marketplace_publisher_manager(p_publisher uuid,p_manager uuid,p_enable boolean,p_actor uuid,p_authorization text,p_operation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
  if p_actor is null or p_operation is null or p_enable is null or length(btrim(p_authorization)) not between 1 and 1000 then raise exception using errcode='22023',message='publisher_authorization_required'; end if;
  perform 1 from public.publishers where id=p_publisher for update;
  if not found then raise exception using errcode='22023',message='publisher_not_found'; end if;
  if p_enable and not private.community_account_is_active(p_manager) then raise exception using errcode='42501',message='publisher_manager_inactive'; end if;
  select to_jsonb(m) into previous from private.marketplace_publisher_managers m where publisher_id=p_publisher and user_id=p_manager;
  insert into private.marketplace_publisher_managers(publisher_id,user_id,revoked_at) values(p_publisher,p_manager,case when p_enable then null else now() end)
  on conflict(publisher_id,user_id) do update set revoked_at=excluded.revoked_at;
  insert into private.marketplace_publisher_audit(operation_id,publisher_id,actor_user_id,action,authorization_basis,prior_state,resulting_state)
    values(p_operation,p_publisher,p_actor,'publisher_manager_authorization',btrim(p_authorization),coalesce(previous,'{}'),jsonb_build_object('manager_user_id',p_manager,'enabled',p_enable));
end $$;

create function private.register_external_publisher_release(p_publisher uuid,p_addon_key text,p_version text,p_creator text,p_package_url text,p_sha256 text,p_reference_url text,p_official boolean,p_actor uuid,p_authorization text,p_operation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.marketplace_publisher_release_references%rowtype; pname text;
begin
  if p_actor is null or p_operation is null or p_official is null or length(btrim(p_authorization)) not between 1 and 1000 then raise exception using errcode='22023',message='publisher_release_authorization_required'; end if;
  select name into pname from public.publishers where id=p_publisher for update;
  if not found then raise exception using errcode='22023',message='publisher_not_found'; end if;
  perform private.publisher_assert_namespace(p_publisher,p_addon_key,true);
  if exists(select 1 from public.addon_drafts d where private.publisher_addon_key(d.manifest_json)=p_addon_key and d.publisher_id is distinct from p_publisher)
    or exists(select 1 from public.addons a where a.slug=p_addon_key and a.publisher_id is distinct from p_publisher) then
    raise exception using errcode='23505',message='publisher_release_conflicting_claim';
  end if;
  select * into r from private.marketplace_publisher_release_references where addon_key=p_addon_key and version=p_version;
  if r.id is not null then
    if r.publisher_id<>p_publisher or r.package_sha256<>p_sha256 or r.package_url<>p_package_url or r.creator_attribution<>btrim(p_creator) or r.release_reference_url<>p_reference_url or r.official<>p_official then raise exception using errcode='23505',message='publisher_release_immutable_conflict'; end if;
    return r.id;
  end if;
  insert into private.marketplace_publisher_release_references(addon_key,version,creator_attribution,publisher_id,publisher_display_name,package_url,package_sha256,release_reference_url,official)
    values(p_addon_key,p_version,btrim(p_creator),p_publisher,pname,p_package_url,p_sha256,p_reference_url,p_official) returning * into r;
  insert into private.marketplace_publisher_audit(operation_id,publisher_id,actor_user_id,action,authorization_basis,resulting_state)
    values(p_operation,p_publisher,p_actor,'external_release_referenced',btrim(p_authorization),jsonb_build_object('reference_id',r.id,'addon_key',p_addon_key,'version',p_version,'package_sha256',p_sha256,'reference_kind','external_release_only','review_approval',false,'distribution_kind','free'));
  return r.id;
end $$;

create function public.save_own_marketplace_publisher(p_display_name text,p_publisher_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=private.publisher_actor(); p uuid:=p_publisher_id; previous jsonb;
begin
  if length(btrim(p_display_name)) not between 1 and 200 or p_display_name is null then raise exception using errcode='22023',message='publisher_name_required'; end if;
  if not private.community_online_action_allowed(a,'marketplace_publishing') then raise exception using errcode='42501',message='publisher_account_restricted'; end if;
  if p is null then
    -- One individual publisher per account; organization creation/delegation is
    -- a separate governed operation. Names never confer official verification.
    perform pg_advisory_xact_lock(hashtextextended('personal-publisher:'||a::text,0));
    select id into p from public.publishers where entity_kind='individual' and owner_id=a order by created_at limit 1;
    if p is null then
      if not exists(select 1 from public.profiles where id=a) then raise exception using errcode='42501',message='publisher_commons_profile_required'; end if;
      p:=gen_random_uuid();
      insert into public.publishers(id,owner_id,name,slug,entity_kind) values(p,a,btrim(p_display_name),'publisher-'||p::text,'individual');
      insert into private.marketplace_publisher_managers(publisher_id,user_id) values(p,a);
    end if;
  end if;
  if not private.publisher_manages(a,p) then raise exception using errcode='42501',message='publisher_management_forbidden'; end if;
  select jsonb_build_object('display_name',name) into previous from public.publishers where id=p for update;
  update public.publishers set name=btrim(p_display_name) where id=p;
  insert into private.marketplace_publisher_audit(operation_id,publisher_id,actor_user_id,action,authorization_basis,prior_state,resulting_state)
    values(gen_random_uuid(),p,a,'publisher_display_saved','Authenticated account, authorized publisher management; attribution is not identity verification.',previous,jsonb_build_object('display_name',btrim(p_display_name)));
  return p;
end $$;

create function public.current_user_publisher_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.publisher_actor();
begin
  return jsonb_build_object('publishers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.name,'entityKind',p.entity_kind,'legalName',p.legal_name,'verified',p.verified) order by p.name,p.id),'[]') from public.publishers p where private.publisher_manages(a,p.id)),
    'commonsDisplayName',(select display_name from public.profile_public_cards where user_id=a),
    'releaseReferences',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'addonKey',r.addon_key,'version',r.version,'creatorAttribution',r.creator_attribution,'publisherId',r.publisher_id,'publisherDisplayName',r.publisher_display_name,'packageUrl',r.package_url,'packageSha256',r.package_sha256,'releaseReferenceUrl',r.release_reference_url,'official',r.official,'distributionKind',r.distribution_kind,'recordedAt',r.recorded_at,'kind','external_release_reference') order by r.recorded_at desc),'[]') from private.marketplace_publisher_release_references r where private.publisher_manages(a,r.publisher_id)),
    'listings',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'addonKey',l.addon_id,'slug',l.slug,'name',l.name,'version',l.current_version,'status',l.listing_status,'publisherId',l.publisher_id,'creatorAttribution',l.creator_attribution,'publisherDisplayName',l.publisher_display_name) order by l.updated_at desc),'[]') from public.marketplace_listings l where private.publisher_manages(a,l.publisher_id)));
end $$;

create function public.get_addon_publisher_provenance(p_addon_key text,p_version text,p_package_sha256 text default null) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(
    (select jsonb_build_object('publisherId',v.publisher_id,'creatorAttribution',v.creator_attribution,'publisherDisplayName',v.publisher_display_name,'version',v.version,'packageSha256',v.package_sha256,'recordedAt',v.created_at,'kind','published_version_snapshot')
      from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id
      where l.addon_id=p_addon_key and v.version=p_version and v.package_sha256 is not distinct from p_package_sha256
        and l.listing_status='published' and l.revoked_at is null and v.revoked_at is null and v.published_at is not null and v.publisher_id is not null limit 1),
    (select jsonb_build_object('publisherId',r.publisher_id,'creatorAttribution',r.creator_attribution,'publisherDisplayName',r.publisher_display_name,'version',r.version,'packageSha256',r.package_sha256,'recordedAt',r.recorded_at,'kind','external_release_reference')
      from private.marketplace_publisher_release_references r where r.addon_key=p_addon_key and r.version=p_version and r.package_sha256=p_package_sha256)
  );
$$;

-- Client-written legacy publisher ownership/verification and legacy intake are
-- closed. Historical rows remain readable under their existing policies.
revoke insert,update,delete,truncate,references,trigger,maintain on public.publishers from anon,authenticated,service_role;
revoke insert,update,delete,truncate,references,trigger,maintain on public.addons,public.addon_versions from anon,authenticated,service_role;

create index marketplace_publisher_managers_user_idx on private.marketplace_publisher_managers(user_id,publisher_id);
create index marketplace_publisher_release_publisher_idx on private.marketplace_publisher_release_references(publisher_id,recorded_at desc);

create function private.publisher_independent_reviewer(p_publisher uuid,p_submitter uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and auth.uid() is distinct from p_submitter
    and public.current_user_can_review_domain('marketplace'::public.review_domain)
    and not exists(select 1 from private.marketplace_publisher_managers where publisher_id=p_publisher and user_id=auth.uid())
    and not exists(select 1 from public.publishers where id=p_publisher and owner_id=auth.uid());
$$;

create function public.current_user_can_independently_review_addon(p_submission_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.addon_submissions s where s.id=p_submission_id and private.publisher_independent_reviewer(s.publisher_id,s.submitted_by));
$$;

create function private.publisher_guard_draft() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid; key text; review_fields text[]:=array['submission_status','review_status','risk_level','locked_at','locked_reason','published_at','updated_at'];
begin
  if tg_op='UPDATE' and private.publisher_deletion_cleanup(old.owner_user_id)
    and new.submission_status='archived' and new.review_status=(case when old.review_status='security_hold' then 'security_hold' else 'withdrawn' end)
    and (to_jsonb(new)-array['submission_status','review_status','archived_at','updated_at'])=(to_jsonb(old)-array['submission_status','review_status','archived_at','updated_at']) then return new;end if;
  a:=private.publisher_actor();
  if tg_op='DELETE' then
    if a is distinct from old.owner_user_id or old.locked_at is not null or old.source_submission_id is not null or (old.publisher_id is not null and not private.publisher_manages(a,old.publisher_id)) then raise exception using errcode='42501',message='publisher_draft_delete_forbidden'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and new.owner_user_id is distinct from old.owner_user_id then raise exception using errcode='42501',message='publisher_draft_actor_immutable'; end if;
  if a is distinct from new.owner_user_id then
    if tg_op<>'UPDATE' or not private.publisher_independent_reviewer(old.publisher_id,old.owner_user_id)
      or (to_jsonb(new)-review_fields) is distinct from (to_jsonb(old)-review_fields) then raise exception using errcode='42501',message='publisher_draft_edit_forbidden'; end if;
    return new;
  end if;
  if tg_op='UPDATE' and old.locked_at is not null then raise exception using errcode='42501',message='publisher_submitted_draft_immutable'; end if;
  if not private.publisher_manages(a,new.publisher_id) or length(btrim(new.creator_attribution)) not between 1 and 200 or new.creator_attribution is null then
    raise exception using errcode='42501',message='publisher_selection_required';
  end if;
  if new.developer_profile_id is not null and not exists(select 1 from public.developer_profiles where id=new.developer_profile_id and user_id=a and status not in ('suspended','revoked')) then
    raise exception using errcode='42501',message='publisher_developer_identity_mismatch';
  end if;
  if new.review_status not in ('not_submitted','pending') or new.submission_status not in ('draft','validating','ready_to_submit','submitted','archived') or new.published_at is not null
    or (tg_op='INSERT' and (new.review_status<>'not_submitted' or new.submission_status not in ('draft','ready_to_submit') or new.locked_at is not null or new.source_submission_id is not null or new.risk_level<>'unknown'))
    or (tg_op='UPDATE' and new.risk_level is distinct from old.risk_level) then raise exception using errcode='42501',message='publisher_cannot_self_review'; end if;
  if (new.review_status='pending' or new.submission_status='submitted' or new.source_submission_id is not null) and not exists(
    select 1 from public.addon_submissions s where s.id=new.source_submission_id and s.addon_draft_id=new.id and s.submitted_by=a and s.publisher_id=new.publisher_id and s.status='pending') then
    raise exception using errcode='42501',message='publisher_pending_submission_required';
  end if;
  if new.revision_of_draft_id is not null and not exists(select 1 from public.addon_drafts d where d.id=new.revision_of_draft_id and d.owner_user_id=a and d.publisher_id=new.publisher_id) then raise exception using errcode='42501',message='publisher_revision_source_forbidden'; end if;
  key:=private.publisher_addon_key(new.manifest_json);
  perform private.publisher_assert_namespace(new.publisher_id,key);
  new.creator_attribution:=btrim(new.creator_attribution);
  return new;
end $$;
create trigger publisher_guard_draft before insert or update or delete on public.addon_drafts for each row execute function private.publisher_guard_draft();

create function private.publisher_guard_submission() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid; d public.addon_drafts%rowtype;
begin
  if tg_op='UPDATE' and private.publisher_deletion_cleanup(old.submitted_by) and new.status='withdrawn'
    and (to_jsonb(new)-array['status','updated_at'])=(to_jsonb(old)-array['status','updated_at']) then return new;end if;
  a:=private.publisher_actor();
  select * into d from public.addon_drafts where id=new.addon_draft_id for update;
  if tg_op='INSERT' then
    if a is distinct from new.submitted_by or a is distinct from d.owner_user_id or d.locked_at is not null or new.status<>'pending'
      or not private.publisher_manages(a,d.publisher_id) or d.creator_attribution is null
      or not exists(select 1 from public.developer_profiles where id=d.developer_profile_id and user_id=a and status not in ('suspended','revoked')) then
      raise exception using errcode='42501',message='publisher_submission_forbidden';
    end if;
    perform private.publisher_assert_namespace(d.publisher_id,private.publisher_addon_key(d.manifest_json),true);
    new.publisher_id:=d.publisher_id;new.creator_attribution:=d.creator_attribution;
    select name into new.publisher_display_name from public.publishers where id=d.publisher_id;
    insert into private.marketplace_publisher_audit(operation_id,publisher_id,actor_user_id,action,authorization_basis,resulting_state)
      values(gen_random_uuid(),d.publisher_id,a,'publisher_submission_recorded','Authenticated draft owner and authorized publisher manager.',jsonb_build_object('submission_id',new.id,'draft_id',d.id,'addon_key',private.publisher_addon_key(d.manifest_json),'version',d.version,'creator_attribution',new.creator_attribution,'publisher_display_name',new.publisher_display_name));
  else
    if new.submitted_by is distinct from old.submitted_by or new.addon_draft_id is distinct from old.addon_draft_id
      or new.publisher_id is distinct from old.publisher_id or new.creator_attribution is distinct from old.creator_attribution or new.publisher_display_name is distinct from old.publisher_display_name or new.submitted_at is distinct from old.submitted_at then
      raise exception using errcode='42501',message='publisher_submission_provenance_immutable';
    end if;
    -- The existing governed review-item linker may only attach the creator's
    -- real pending item. It cannot be used to change a review outcome.
    if a=new.submitted_by and (to_jsonb(new)-array['review_item_id','updated_at'])=(to_jsonb(old)-array['review_item_id','updated_at'])
      and (old.review_item_id is null or old.review_item_id=new.review_item_id) and exists(select 1 from public.review_items where id=new.review_item_id and domain='marketplace' and source_id=new.id and source_table='addon_submissions' and submitted_by=a and status='pending_review') then return new; end if;
    if not private.publisher_independent_reviewer(old.publisher_id,old.submitted_by) then raise exception using errcode='42501',message='publisher_cannot_self_review'; end if;
  end if;
  return new;
end $$;
create trigger publisher_guard_submission before insert or update on public.addon_submissions for each row execute function private.publisher_guard_submission();

create function private.publisher_lock_submitted_draft() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.addon_drafts set submission_status='submitted',review_status='pending',source_submission_id=new.id,
    locked_at=now(),locked_reason='submitted_for_marketplace_review',submitted_at=now(),updated_at=now() where id=new.addon_draft_id;
  return new;
end $$;
create trigger publisher_lock_submitted_draft after insert on public.addon_submissions for each row execute function private.publisher_lock_submitted_draft();

create function private.publisher_guard_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.addon_submissions%rowtype; d public.addon_drafts%rowtype; a uuid:=private.publisher_actor();
begin
  if tg_op<>'INSERT' then raise exception using errcode='42501',message='publisher_snapshot_append_only'; end if;
  select * into s from public.addon_submissions where id=new.submission_id;
  select * into d from public.addon_drafts where id=s.addon_draft_id;
  if s.submitted_by is distinct from a or d.owner_user_id is distinct from a or s.publisher_id is null or not private.publisher_manages(a,s.publisher_id)
    or new.draft_id is distinct from d.id or new.developer_user_id is distinct from a or new.manifest_snapshot is distinct from d.manifest_json
    or exists(select 1 from public.addon_submission_snapshots where submission_id=s.id) then raise exception using errcode='42501',message='publisher_snapshot_source_mismatch'; end if;
  new.publisher_id:=s.publisher_id;new.creator_attribution:=s.creator_attribution;new.publisher_display_name:=s.publisher_display_name;
  return new;
end $$;
create trigger publisher_guard_snapshot before insert or update or delete on public.addon_submission_snapshots for each row execute function private.publisher_guard_snapshot();

create function private.publisher_guard_draft_evidence() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.addon_drafts%rowtype; r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; a uuid:=private.publisher_actor();
begin
  select * into d from public.addon_drafts where id=(r->>'addon_draft_id')::uuid;
  if a is distinct from d.owner_user_id or d.locked_at is not null or not private.publisher_manages(a,d.publisher_id) then raise exception using errcode='42501',message='publisher_draft_evidence_forbidden'; end if;
  if tg_op='UPDATE' and new.addon_draft_id is distinct from old.addon_draft_id then raise exception using errcode='42501',message='publisher_evidence_source_immutable'; end if;
  if tg_table_name='addon_packages' and exists(select 1 from private.marketplace_publisher_release_references where package_sha256=r->>'sha256' and publisher_id<>d.publisher_id) then raise exception using errcode='42501',message='publisher_package_owned_elsewhere'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
do $$ declare t text; begin
  foreach t in array array['addon_packages','addon_draft_permissions','addon_validation_results','addon_compatibility_results'] loop
    execute format('create trigger publisher_guard_draft_evidence before insert or update or delete on public.%I for each row execute function private.publisher_guard_draft_evidence()',t);
  end loop;
end $$;

create function private.publisher_guard_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.addon_submissions%rowtype; snap public.addon_submission_snapshots%rowtype; d public.addon_drafts%rowtype; l public.marketplace_listings%rowtype; a uuid;
begin
  if tg_table_name='marketplace_listings' and tg_op='UPDATE' then
    if private.publisher_deletion_cleanup((select user_id from public.developer_profiles where id=old.developer_profile_id))
      and new.listing_status='revoked' and new.revoked_at is not null
      and (to_jsonb(new)-array['listing_status','revoked_at','revocation_reason','updated_at'])=(to_jsonb(old)-array['listing_status','revoked_at','revocation_reason','updated_at']) then return new;end if;
  end if;
  a:=private.publisher_actor();
  if tg_table_name='marketplace_listings' then
    select * into s from public.addon_submissions where id=new.source_submission_id;
  else
    select * into l from public.marketplace_listings where id=new.listing_id;
    select * into s from public.addon_submissions where id=case when tg_op='UPDATE' then old.source_submission_id else l.source_submission_id end;
  end if;
  if not private.publisher_independent_reviewer(s.publisher_id,s.submitted_by) then raise exception using errcode='42501',message='publisher_independent_review_required'; end if;
  -- Keep old historical revocation/hiding possible without manufacturing a new
  -- provenance record for legacy publications.
  if tg_op='UPDATE' and old.publisher_id is null and ((tg_table_name='marketplace_listings' and to_jsonb(new)->>'listing_status'<>'published') or (tg_table_name='marketplace_addon_versions' and to_jsonb(new)->>'revoked_at' is not null)) then return new; end if;
  select * into d from public.addon_drafts where id=s.addon_draft_id;
  select * into snap from public.addon_submission_snapshots where submission_id=s.id order by created_at desc limit 1;
  if s.status not in ('approved','published') or s.publisher_id is null or snap.publisher_id is distinct from s.publisher_id or snap.id is null then raise exception using errcode='42501',message='publisher_approved_snapshot_required'; end if;
  new.publisher_id:=snap.publisher_id;new.creator_attribution:=snap.creator_attribution;new.publisher_display_name:=snap.publisher_display_name;
  if tg_op='UPDATE' and old.publisher_id is not null and new.publisher_id<>old.publisher_id then raise exception using errcode='42501',message='publisher_listing_owner_immutable'; end if;
  if tg_table_name='marketplace_listings' then
    if new.current_version is distinct from snap.manifest_snapshot->>'version' or new.addon_id is distinct from private.publisher_addon_key(snap.manifest_snapshot) or new.developer_profile_id is distinct from d.developer_profile_id then raise exception using errcode='42501',message='publisher_listing_source_mismatch'; end if;
    perform private.publisher_assert_namespace(new.publisher_id,new.addon_id);
  else
    new.source_submission_id:=s.id;
    if new.version is distinct from snap.manifest_snapshot->>'version' or new.manifest_json is distinct from snap.manifest_snapshot or new.package_sha256 is distinct from snap.package_sha256 then raise exception using errcode='42501',message='publisher_version_source_mismatch'; end if;
    if tg_op='UPDATE' and (new.version is distinct from old.version or new.listing_id is distinct from old.listing_id or new.manifest_json is distinct from old.manifest_json or new.package_sha256 is distinct from old.package_sha256 or new.creator_attribution is distinct from old.creator_attribution or new.publisher_display_name is distinct from old.publisher_display_name) then raise exception using errcode='42501',message='publisher_release_provenance_immutable'; end if;
  end if;
  return new;
end $$;
create trigger publisher_guard_publication before insert or update on public.marketplace_listings for each row execute function private.publisher_guard_publication();
create trigger publisher_guard_publication before insert or update on public.marketplace_addon_versions for each row execute function private.publisher_guard_publication();

create function private.publisher_guard_review() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.review_items%rowtype; s public.addon_submissions%rowtype; a uuid;
begin
  if tg_table_name='review_items' then item:=new; else select * into item from public.review_items where id=new.review_item_id; end if;
  if tg_table_name='review_items' then
    if tg_op='UPDATE' and old.domain='marketplace' and old.source_table='addon_submissions' and (new.domain is distinct from old.domain or new.source_table is distinct from old.source_table or new.source_id is distinct from old.source_id or new.submitted_by is distinct from old.submitted_by) then raise exception using errcode='42501',message='publisher_review_source_immutable'; end if;
  end if;
  if item.domain is distinct from 'marketplace'::public.review_domain or item.source_table is distinct from 'addon_submissions' then return new; end if;
  a:=private.publisher_actor();
  if tg_table_name='review_events' and (to_jsonb(new)->>'actor_id')::uuid is distinct from a then raise exception using errcode='42501',message='publisher_review_actor_mismatch'; end if;
  if tg_table_name='review_items' and item.reviewed_by is not null and item.reviewed_by is distinct from a then raise exception using errcode='42501',message='publisher_review_actor_mismatch'; end if;
  select * into s from public.addon_submissions where id=item.source_id;
  if s.id is null or item.submitted_by is distinct from s.submitted_by then raise exception using errcode='42501',message='publisher_review_source_mismatch'; end if;
  if tg_op='INSERT' and a=s.submitted_by and item.status='pending_review'
    and (tg_table_name='review_items' or (to_jsonb(new)->>'event_type'='submitted' and to_jsonb(new)->>'to_status'='pending_review')) then return new; end if;
  if not private.publisher_independent_reviewer(s.publisher_id,s.submitted_by) then raise exception using errcode='42501',message='publisher_independent_review_required'; end if;
  return new;
end $$;
create trigger publisher_guard_review before insert or update on public.review_items for each row execute function private.publisher_guard_review();
create trigger publisher_guard_review before insert or update on public.review_events for each row execute function private.publisher_guard_review();

create function private.publisher_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='42501',message='publisher_history_append_only'; end $$;
create trigger publisher_audit_append_only before update or delete on private.marketplace_publisher_audit for each row execute function private.publisher_append_only();
create trigger publisher_release_reference_append_only before update or delete on private.marketplace_publisher_release_references for each row execute function private.publisher_append_only();

-- Match publication to the existing Marketplace review domain. The triggers
-- additionally enforce independence from the publisher and immutable snapshots.
alter policy "reviewers_manage_marketplace_listings" on public.marketplace_listings using(public.current_user_can_review_domain('marketplace')) with check(public.current_user_can_review_domain('marketplace'));
alter policy "reviewers_manage_marketplace_addon_versions" on public.marketplace_addon_versions using(public.current_user_can_review_domain('marketplace')) with check(public.current_user_can_review_domain('marketplace'));
alter policy "reviewers_insert_marketplace_publication_events" on public.marketplace_publication_events with check(public.current_user_can_review_domain('marketplace'));
alter policy "reviewers_read_marketplace_publication_events" on public.marketplace_publication_events using(public.current_user_can_review_domain('marketplace'));

create function private.publisher_guard_publication_event() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.addon_submissions%rowtype; a uuid:=private.publisher_actor();
begin
  if tg_op<>'INSERT' then raise exception using errcode='42501',message='publisher_publication_history_immutable'; end if;
  if new.actor_user_id is distinct from a then raise exception using errcode='42501',message='publisher_publication_actor_mismatch'; end if;
  select * into s from public.addon_submissions where id=coalesce(
    (select source_submission_id from public.marketplace_listings where id=new.listing_id),
    nullif(new.metadata->>'addon_submission_id','')::uuid);
  if s.id is null then raise exception using errcode='42501',message='publisher_publication_source_required'; end if;
  if not private.publisher_independent_reviewer(s.publisher_id,s.submitted_by) then raise exception using errcode='42501',message='publisher_independent_review_required'; end if;
  return new;
end $$;
create trigger publisher_guard_publication_event before insert or update or delete on public.marketplace_publication_events for each row execute function private.publisher_guard_publication_event();

create policy "publisher managers read governed listings" on public.marketplace_listings for select to authenticated using(public.current_user_can_manage_publisher(publisher_id));
revoke truncate,trigger,references,maintain on public.addon_drafts,public.addon_submissions,public.addon_submission_snapshots,public.marketplace_listings,public.marketplace_addon_versions from anon,authenticated,service_role;
revoke delete on public.addon_submissions,public.addon_submission_snapshots,public.marketplace_listings,public.marketplace_addon_versions from authenticated;

do $$ declare p record; begin
  for p in select oid::regprocedure signature from pg_proc where pronamespace='private'::regnamespace and (proname like 'publisher_%' or proname in ('establish_marketplace_publisher','authorize_marketplace_publisher_manager','register_external_publisher_release')) loop
    execute format('alter function %s owner to postgres',p.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);
  end loop;
end $$;
revoke all on function public.current_user_can_independently_review_addon(uuid),public.current_user_can_manage_publisher(uuid),public.current_user_publisher_workspace(),public.save_own_marketplace_publisher(text,uuid),public.get_addon_publisher_provenance(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.current_user_can_independently_review_addon(uuid),public.current_user_can_manage_publisher(uuid),public.current_user_publisher_workspace(),public.save_own_marketplace_publisher(text,uuid) to authenticated;
grant execute on function public.get_addon_publisher_provenance(text,text,text) to anon,authenticated;
commit;

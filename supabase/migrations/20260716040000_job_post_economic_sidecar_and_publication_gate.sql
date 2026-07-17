-- Job Post economics are a private sidecar. Content approval, anti-scam review,
-- fee assessment, payment satisfaction, and publication remain distinct facts.
-- Fee enforcement is disabled by default, preserving current direct publication.

begin;

create table private.job_post_economic_conditions (
  id uuid primary key default gen_random_uuid(),
  job_post_id uuid not null unique references public.commune_job_posts(id) on delete restrict,
  post_id uuid not null unique references public.commune_posts(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  classification text not null default 'not_assessed',
  condition_status text not null default 'not_assessed',
  price_id uuid references private.economic_prices(id) on delete restrict,
  terms_version text,
  order_id uuid unique references private.economic_orders(id) on delete restrict,
  waiver_id uuid,
  subsidy_id uuid,
  assessment_request_id uuid unique,
  assessed_by uuid references auth.users(id) on delete restrict,
  private_assessment_reason text,
  assessed_at timestamptz,
  satisfied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_post_economic_classification_check check (
    classification in ('not_assessed', 'community_free', 'commercial', 'waived', 'subsidized')
  ),
  constraint job_post_economic_status_check check (
    condition_status in (
      'not_assessed', 'not_required', 'payment_required', 'payment_pending',
      'satisfied', 'waived', 'subsidized', 'refunded', 'disputed',
      'reconciliation_required'
    )
  ),
  constraint job_post_economic_classification_state_check check (
    (classification = 'not_assessed' and condition_status = 'not_assessed')
    or (classification = 'community_free' and condition_status = 'not_required')
    or (classification = 'commercial' and condition_status in (
      'payment_required', 'payment_pending', 'satisfied', 'refunded', 'disputed',
      'reconciliation_required'
    ))
    or (classification = 'waived' and condition_status = 'waived')
    or (classification = 'subsidized' and condition_status = 'subsidized')
  ),
  constraint job_post_economic_price_check check (
    (classification = 'commercial' and price_id is not null
      and pg_catalog.char_length(terms_version) between 1 and 120)
    or (classification <> 'commercial' and price_id is null and terms_version is null)
  ),
  constraint job_post_economic_waiver_check check (
    (classification = 'waived' and waiver_id is not null)
    or (classification <> 'waived' and waiver_id is null)
  ),
  constraint job_post_economic_subsidy_check check (
    (classification = 'subsidized' and subsidy_id is not null)
    or (classification <> 'subsidized' and subsidy_id is null)
  )
);

create table private.job_post_payment_holds (
  id uuid primary key default gen_random_uuid(),
  condition_id uuid not null unique
    references private.job_post_economic_conditions(id) on delete restrict,
  job_post_id uuid not null references public.commune_job_posts(id) on delete restrict,
  post_id uuid not null references public.commune_posts(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  reason_code text not null,
  status text not null default 'refund_required',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint job_post_payment_hold_reason_check
    check (reason_code in ('content_review_no_longer_eligible', 'job_posting_restricted')),
  constraint job_post_payment_hold_status_check
    check (status in ('refund_required', 'resolved')),
  constraint job_post_payment_hold_resolution_check check (
    (status = 'refund_required' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index job_post_payment_holds_status_idx
  on private.job_post_payment_holds(status, opened_at);

alter table private.job_post_payment_holds owner to postgres;
alter table private.job_post_payment_holds enable row level security;
revoke all privileges on table private.job_post_payment_holds
  from public, anon, authenticated, service_role;

create index job_post_economic_conditions_status_idx
  on private.job_post_economic_conditions(condition_status, updated_at desc);

alter table private.job_post_economic_conditions owner to postgres;
alter table private.job_post_economic_conditions enable row level security;
revoke all privileges on table private.job_post_economic_conditions
  from public, anon, authenticated, service_role;

create or replace function private.ensure_job_post_economic_condition(p_job_post_id uuid)
returns private.job_post_economic_conditions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.commune_job_posts%rowtype;
  v_condition private.job_post_economic_conditions%rowtype;
begin
  select * into v_job
  from public.commune_job_posts as job
  where job.id = p_job_post_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_post_not_found';
  end if;
  if not exists (
    select 1 from public.commune_posts as post
    where post.id = v_job.post_id and post.post_type = 'job_post'::public.commune_post_type
  ) then
    raise exception using errcode = '23503', message = 'job_post_link_invalid';
  end if;

  insert into private.job_post_economic_conditions (
    job_post_id, post_id, author_user_id
  ) values (
    v_job.id, v_job.post_id, v_job.author_user_id
  )
  on conflict (job_post_id) do update set
    post_id = excluded.post_id,
    author_user_id = excluded.author_user_id,
    updated_at = pg_catalog.now()
  returning * into v_condition;
  return v_condition;
end;
$$;

alter function private.ensure_job_post_economic_condition(uuid) owner to postgres;
revoke all privileges on function private.ensure_job_post_economic_condition(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.job_post_checkout_is_eligible(p_condition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.job_post_economic_conditions as condition
    join public.commune_job_posts as job on job.id = condition.job_post_id
    join public.commune_posts as post on post.id = condition.post_id
    where condition.id = p_condition_id
      and job.post_id = post.id
      and job.author_user_id = condition.author_user_id
      and post.user_id = condition.author_user_id
      and job.anti_scam_review_status = 'reviewed_clear'
      and post.status in (
        'approved'::public.commune_post_status,
        'published'::public.commune_post_status
      )
      and not private.economic_service_is_restricted(
        condition.author_user_id, 'job_posting'
      )
  );
$$;

alter function private.job_post_checkout_is_eligible(uuid) owner to postgres;
revoke all privileges on function private.job_post_checkout_is_eligible(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.publish_job_post_if_eligible(p_job_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.commune_job_posts%rowtype;
  v_post public.commune_posts%rowtype;
  v_condition private.job_post_economic_conditions%rowtype;
  v_fee_enabled boolean := private.economic_feature_enabled('job_post_fee_enforcement');
  v_economic_satisfied boolean;
  v_service_restricted boolean;
begin
  select * into v_job
  from public.commune_job_posts as job
  where job.id = p_job_post_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_post_not_found';
  end if;
  select * into v_post
  from public.commune_posts as post
  where post.id = v_job.post_id
  for update;
  if not found or v_post.post_type <> 'job_post'::public.commune_post_type then
    raise exception using errcode = '23503', message = 'job_post_link_invalid';
  end if;

  select * into v_condition
  from private.ensure_job_post_economic_condition(v_job.id);
  v_service_restricted := private.economic_service_is_restricted(
    v_job.author_user_id, 'job_posting'
  );
  v_economic_satisfied := not v_fee_enabled
    or v_condition.condition_status in ('not_required', 'satisfied', 'waived', 'subsidized');
  v_economic_satisfied := v_economic_satisfied and not v_service_restricted;

  if v_job.anti_scam_review_status = 'reviewed_clear'
     and v_post.status in ('approved'::public.commune_post_status, 'published'::public.commune_post_status)
     and v_economic_satisfied then
    update public.commune_posts
    set
      status = 'published',
      visibility = 'public',
      moderation_status = 'approved',
      moderation_reason = null,
      published_at = coalesce(published_at, pg_catalog.now()),
      updated_at = pg_catalog.now(),
      last_activity_at = pg_catalog.now()
    where id = v_post.id;

    update public.commune_media
    set visibility_state = 'published', updated_at = pg_catalog.now()
    where post_id = v_post.id
      and visibility_state = 'submitted';

    update public.commune_uploads
    set status = 'published'
    where post_id = v_post.id
      and status in ('pending_review', 'approved');

    update public.commune_threads
    set visibility = 'public', updated_at = pg_catalog.now()
    where post_id = v_post.id;

    insert into public.commune_thread_participant_approvals (
      thread_id, post_id, user_id, approved_by,
      approval_source, status, reason
    )
    select
      thread.id,
      v_post.id,
      v_job.author_user_id,
      v_job.reviewed_by,
      'job_post_approval',
      'approved',
      'Content review approved; economic publication condition independently satisfied.'
    from public.commune_threads as thread
    where thread.post_id = v_post.id
    on conflict (thread_id, user_id)
    do update set
      post_id = excluded.post_id,
      approved_by = excluded.approved_by,
      approval_source = excluded.approval_source,
      status = 'approved',
      reason = excluded.reason,
      revoked_at = null,
      revoked_by = null,
      updated_at = pg_catalog.now();
    return pg_catalog.jsonb_build_object(
      'published', true,
      'postStatus', 'published',
      'economicStatus', v_condition.condition_status,
      'serviceRestricted', false,
      'feeEnforcement', v_fee_enabled
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'published', v_post.status = 'published'::public.commune_post_status,
    'postStatus', v_post.status,
    'economicStatus', v_condition.condition_status,
    'serviceRestricted', v_service_restricted,
    'feeEnforcement', v_fee_enabled
  );
end;
$$;

alter function private.publish_job_post_if_eligible(uuid) owner to postgres;
revoke all privileges on function private.publish_job_post_if_eligible(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_job_post_economic_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_type = 'job_post'::public.commune_post_type
     and new.status = 'published'::public.commune_post_status
     and private.economic_feature_enabled('job_post_fee_enforcement')
     and (case
       when tg_op = 'INSERT' then true
       else old.status is distinct from 'published'::public.commune_post_status
     end)
     and not exists (
       select 1
       from public.commune_job_posts as job
       join private.job_post_economic_conditions as condition
         on condition.job_post_id = job.id
       where job.post_id = new.id
         and job.anti_scam_review_status = 'reviewed_clear'
         and not private.economic_service_is_restricted(job.author_user_id, 'job_posting')
         and condition.condition_status in ('not_required', 'satisfied', 'waived', 'subsidized')
     ) then
    raise exception using errcode = '55000', message = 'job_post_economic_publication_gate_unsatisfied';
  end if;
  return new;
end;
$$;

alter function private.enforce_job_post_economic_publication_gate() owner to postgres;
revoke all privileges on function private.enforce_job_post_economic_publication_gate()
  from public, anon, authenticated, service_role;

create trigger enforce_job_post_economic_publication_gate
before update of status on public.commune_posts
for each row execute function private.enforce_job_post_economic_publication_gate();
create trigger enforce_job_post_economic_publication_gate_on_insert
before insert on public.commune_posts
for each row execute function private.enforce_job_post_economic_publication_gate();

-- Enabling fee enforcement must not silently grandfather a published Job Post
-- whose content review and independent economic sidecar have never been
-- reconciled. This trigger also protects direct privileged updates to the
-- feature table; the service-only feature RPC cannot bypass it.
create or replace function private.job_post_fee_activation_inventory_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.commune_posts as post
    left join public.commune_job_posts as job
      on job.post_id = post.id
    left join private.job_post_economic_conditions as condition
      on condition.job_post_id = job.id
    where post.post_type = 'job_post'::public.commune_post_type
      and post.status = 'published'::public.commune_post_status
      and (
        job.id is null
        or job.anti_scam_review_status <> 'reviewed_clear'
        or condition.id is null
        or condition.condition_status not in ('not_required', 'satisfied', 'waived', 'subsidized')
        or private.economic_service_is_restricted(job.author_user_id, 'job_posting')
      )
  );
$$;

alter function private.job_post_fee_activation_inventory_ready() owner to postgres;
revoke all privileges on function private.job_post_fee_activation_inventory_ready()
  from public, anon, authenticated, service_role;

create or replace function private.enforce_job_post_fee_activation_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.feature_key = 'job_post_fee_enforcement'
     and new.enabled = true
     and old.enabled is distinct from true
     and not private.job_post_fee_activation_inventory_ready() then
    raise exception using
      errcode = '55000',
      message = 'job_post_fee_activation_inventory_unresolved';
  end if;
  return new;
end;
$$;

alter function private.enforce_job_post_fee_activation_inventory() owner to postgres;
revoke all privileges on function private.enforce_job_post_fee_activation_inventory()
  from public, anon, authenticated, service_role;

create trigger enforce_job_post_fee_activation_inventory
before update of enabled on private.economic_feature_flags
for each row execute function private.enforce_job_post_fee_activation_inventory();

do $$
begin
  if private.economic_feature_enabled('job_post_fee_enforcement')
     and not private.job_post_fee_activation_inventory_ready() then
    raise exception using
      errcode = '55000',
      message = 'job_post_fee_activation_inventory_unresolved';
  end if;
end;
$$;

create or replace function public.review_commune_job_post(
  p_job_post_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.commune_job_posts%rowtype;
  v_post public.commune_posts%rowtype;
  v_condition private.job_post_economic_conditions%rowtype;
  v_old_status text;
  v_publication jsonb;
  v_review record;
  v_review_status public.review_status;
begin
  if v_actor is null
     or not public.current_user_can_review_domain('commune'::public.review_domain) then
    raise exception using errcode = '42501', message = 'job_post_reviewer_required';
  end if;
  if p_action not in ('approve', 'reject', 'hide', 'archive', 'needs_information', 'escalate') then
    raise exception using errcode = '22023', message = 'job_post_review_action_invalid';
  end if;
  if p_action <> 'approve'
     and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception using errcode = '22023', message = 'job_post_review_reason_required';
  end if;

  select * into v_job
  from public.commune_job_posts as job
  where job.id = p_job_post_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_post_not_found';
  end if;
  select * into v_post
  from public.commune_posts as post
  where post.id = v_job.post_id
  for update;
  if not found or v_post.post_type <> 'job_post'::public.commune_post_type then
    raise exception using errcode = '23503', message = 'job_post_link_invalid';
  end if;
  v_old_status := v_post.status::text;
  select * into v_condition
  from private.ensure_job_post_economic_condition(v_job.id);

  if p_action = 'approve' then
    update public.commune_job_posts
    set
      anti_scam_review_status = 'reviewed_clear',
      application_status = 'open',
      reviewed_by = v_actor,
      reviewed_at = pg_catalog.now(),
      public_correction_note = nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''),
      updated_at = pg_catalog.now()
    where id = v_job.id;
    update public.commune_posts
    set
      status = 'approved',
      visibility = 'private_draft',
      moderation_status = 'approved',
      moderation_reason = null,
      published_at = null,
      updated_at = pg_catalog.now()
    where id = v_post.id;
    v_review_status := 'approved'::public.review_status;
    v_publication := private.publish_job_post_if_eligible(v_job.id);
  else
    update public.commune_job_posts
    set
      anti_scam_review_status = case
        when p_action in ('reject', 'hide', 'archive') then 'removed'
        when p_action = 'escalate' then 'suspicious'
        else 'needs_contact_clarification'
      end,
      application_status = case
        when p_action = 'archive' then 'archived'
        when p_action in ('reject', 'hide') then 'closed'
        else 'needs_clarification'
      end,
      reviewed_by = v_actor,
      reviewed_at = pg_catalog.now(),
      public_correction_note = pg_catalog.btrim(p_reason),
      updated_at = pg_catalog.now()
    where id = v_job.id;
    update public.commune_posts
    set
      status = case p_action
        when 'reject' then 'removed_by_moderator'::public.commune_post_status
        when 'hide' then 'hidden'::public.commune_post_status
        when 'archive' then 'archived'::public.commune_post_status
        when 'escalate' then 'in_review'::public.commune_post_status
        else 'needs_information'::public.commune_post_status
      end,
      visibility = 'private_draft',
      moderation_status = case
        when p_action = 'reject' then 'rejected'
        when p_action = 'hide' then 'hidden'
        when p_action = 'archive' then 'archived'
        when p_action = 'escalate' then 'in_review'
        else 'needs_information'
      end,
      moderation_reason = pg_catalog.btrim(p_reason),
      updated_at = pg_catalog.now()
    where id = v_post.id;
    v_review_status := case
      when p_action = 'reject' then 'rejected'::public.review_status
      when p_action = 'archive' then 'archived'::public.review_status
      when p_action = 'needs_information' then 'needs_information'::public.review_status
      else 'in_review'::public.review_status
    end;
    v_publication := pg_catalog.jsonb_build_object(
      'published', false,
      'postStatus', case p_action
        when 'reject' then 'removed_by_moderator'
        when 'hide' then 'hidden'
        when 'archive' then 'archived'
        when 'escalate' then 'in_review'
        else 'needs_information'
      end,
      'economicStatus', v_condition.condition_status,
      'feeEnforcement', private.economic_feature_enabled('job_post_fee_enforcement')
    );
  end if;

  for v_review in
    select item.id, item.status
    from public.review_items as item
    where item.domain = 'commune'::public.review_domain
      and (
        (item.source_table = 'commune_job_posts' and item.source_id = v_job.id)
        or (item.source_table = 'commune_posts' and item.source_id = v_post.id)
      )
    for update
  loop
    update public.review_items
    set
      status = v_review_status,
      reviewed_at = pg_catalog.now(),
      reviewed_by = v_actor,
      updated_at = pg_catalog.now()
    where id = v_review.id;
    insert into public.review_events (
      review_item_id, actor_id, event_type, from_status, to_status, note, metadata
    ) values (
      v_review.id, v_actor, 'commune_job_' || p_action,
      v_review.status, v_review_status, nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''),
      pg_catalog.jsonb_build_object(
        'source', 'review_commune_job_post_rpc',
        'content_approval_separate_from_economics', true
      )
    );
  end loop;

  insert into public.commune_moderation_events (
    actor_id, target_type, target_id, action,
    from_status, to_status, reason, metadata
  ) values (
    v_actor, 'job', v_job.id, p_action,
    v_old_status, v_publication ->> 'postStatus',
    nullif(pg_catalog.btrim(coalesce(p_reason, '')), ''),
    pg_catalog.jsonb_build_object(
      'source', 'review_commune_job_post_rpc',
      'post_id', v_post.id,
      'economic_status', v_publication ->> 'economicStatus',
      'fee_enforcement', (v_publication ->> 'feeEnforcement')::boolean
    )
  );

  return pg_catalog.jsonb_build_object(
    'jobPostId', v_job.id,
    'postId', v_post.id,
    'action', p_action,
    'contentApproved', p_action = 'approve',
    'contentStatus', case when p_action = 'approve' then 'approved' else v_review_status::text end,
    'economicStatus', v_publication ->> 'economicStatus',
    'publicationStatus', v_publication ->> 'postStatus',
    'published', coalesce((v_publication ->> 'published')::boolean, false),
    'feeEnforcement', coalesce((v_publication ->> 'feeEnforcement')::boolean, false)
  );
end;
$$;

alter function public.review_commune_job_post(uuid, text, text) owner to postgres;

create or replace function public.operator_assess_job_post_fee(
  p_actor_user_id uuid,
  p_job_post_id uuid,
  p_classification text,
  p_price_code text,
  p_waiver_id uuid,
  p_subsidy_id uuid,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_condition private.job_post_economic_conditions%rowtype;
  v_price private.economic_prices%rowtype;
  v_publication jsonb;
  v_terms_version text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'job_fee_assess');
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;
  if p_classification not in ('community_free', 'commercial', 'waived', 'subsidized') then
    raise exception using errcode = '22023', message = 'job_post_fee_classification_invalid';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'job_post_fee_reason_required';
  end if;
  if (p_classification = 'waived') <> (p_waiver_id is not null)
     or (p_classification = 'subsidized') <> (p_subsidy_id is not null) then
    raise exception using errcode = '22023', message = 'job_post_fee_assistance_reference_invalid';
  end if;

  select * into v_condition
  from private.ensure_job_post_economic_condition(p_job_post_id);
  if v_condition.assessment_request_id = p_client_request_id then
    return pg_catalog.jsonb_build_object(
      'jobPostId', v_condition.job_post_id,
      'classification', v_condition.classification,
      'economicStatus', v_condition.condition_status,
      'published', exists (
        select 1 from public.commune_posts
        where id = v_condition.post_id and status = 'published'::public.commune_post_status
      ),
      'idempotentReplay', true
    );
  end if;
  if private.economic_service_is_restricted(v_condition.author_user_id, 'job_posting') then
    raise exception using errcode = '42501', message = 'job_posting_economic_service_restricted';
  end if;

  if p_classification = 'commercial' then
    select * into v_price
    from private.economic_prices as price
    where price.price_code = p_price_code
      and price.product_key = 'job_post_fee'
      and price.active = true
      and price.test_mode_only = true
      and price.retired_at is null;
    if not found then
      raise exception using errcode = 'P0002', message = 'job_post_test_price_not_configured';
    end if;
    select active_bundle.bundle_version into v_terms_version
    from private.economic_active_legal_consent_bundles as active_bundle
    where active_bundle.bundle_key = 'job_post_fee_checkout_bundle';
    if v_terms_version is null then
      raise exception using errcode = '55000', message = 'job_post_fee_terms_unavailable';
    end if;
  elsif p_price_code is not null then
    raise exception using errcode = '22023', message = 'job_post_fee_price_not_allowed';
  end if;

  if v_condition.order_id is not null
     and (
       p_classification <> 'commercial'
       or v_condition.price_id is distinct from v_price.id
     ) then
    raise exception using errcode = '55000', message = 'job_post_fee_attached_order_requires_reconciliation';
  end if;

  update private.job_post_economic_conditions
  set
    classification = p_classification,
    condition_status = case p_classification
      when 'community_free' then 'not_required'
      when 'commercial' then 'payment_required'
      when 'waived' then 'waived'
      else 'subsidized'
    end,
    price_id = case when p_classification = 'commercial' then v_price.id else null end,
    terms_version = case when p_classification = 'commercial' then v_terms_version else null end,
    order_id = case when p_classification = 'commercial' then order_id else null end,
    waiver_id = case when p_classification = 'waived' then p_waiver_id else null end,
    subsidy_id = case when p_classification = 'subsidized' then p_subsidy_id else null end,
    assessment_request_id = p_client_request_id,
    assessed_by = p_actor_user_id,
    private_assessment_reason = pg_catalog.btrim(p_reason),
    assessed_at = pg_catalog.now(),
    satisfied_at = case when p_classification in ('community_free', 'waived', 'subsidized') then pg_catalog.now() else null end,
    updated_at = pg_catalog.now()
  where id = v_condition.id
  returning * into v_condition;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'job_post_fee_assessed',
    'job_post_economic_condition', v_condition.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'job_post_id', p_job_post_id,
      'classification', p_classification,
      'condition_status', v_condition.condition_status,
      'payment_does_not_approve_content', true
    )
  );

  v_publication := private.publish_job_post_if_eligible(p_job_post_id);
  return pg_catalog.jsonb_build_object(
    'jobPostId', p_job_post_id,
    'classification', v_condition.classification,
    'economicStatus', v_condition.condition_status,
    'publicationStatus', v_publication ->> 'postStatus',
    'published', coalesce((v_publication ->> 'published')::boolean, false),
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_assess_job_post_fee(
  uuid, uuid, text, text, uuid, uuid, uuid, text
) owner to postgres;

create or replace function public.prepare_job_post_economic_checkout(
  p_actor_user_id uuid,
  p_job_post_id uuid,
  p_client_request_id uuid,
  p_source_route text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_condition private.job_post_economic_conditions%rowtype;
  v_price private.economic_prices%rowtype;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  select * into v_condition
  from private.job_post_economic_conditions as condition
  where condition.job_post_id = p_job_post_id
    and condition.author_user_id = p_actor_user_id
  for update;
  if not found or v_condition.classification <> 'commercial'
     or v_condition.condition_status not in ('payment_required', 'payment_pending')
     or p_consent_version is distinct from v_condition.terms_version
     or not private.job_post_checkout_is_eligible(v_condition.id) then
    raise exception using errcode = '55000', message = 'job_post_checkout_not_available';
  end if;
  select * into v_price from private.economic_prices where id = v_condition.price_id;

  v_result := public.begin_economic_checkout(
    p_actor_user_id, p_client_request_id, 'job_post_fee',
    v_price.unit_amount_minor, v_price.currency, v_price.price_code,
    p_source_route, p_consent_version
  );

  update private.job_post_economic_conditions
  set
    order_id = (v_result ->> 'orderId')::uuid,
    condition_status = 'payment_pending',
    updated_at = pg_catalog.now()
  where id = v_condition.id
    and (order_id is null or order_id = (v_result ->> 'orderId')::uuid);
  if not found then
    raise exception using errcode = '23505', message = 'job_post_checkout_order_conflict';
  end if;

  return v_result || pg_catalog.jsonb_build_object(
    'jobPostId', p_job_post_id,
    'postId', v_condition.post_id
  );
end;
$$;

alter function public.prepare_job_post_economic_checkout(uuid, uuid, uuid, text, text)
  owner to postgres;

create or replace function private.synchronize_job_post_economic_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_condition private.job_post_economic_conditions%rowtype;
  v_hold private.job_post_payment_holds%rowtype;
  v_restriction_applies boolean;
  v_content_eligible boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select * into v_condition
  from private.job_post_economic_conditions as condition
  where condition.order_id = new.id
  for update;
  if not found then
    return new;
  end if;

  select * into v_hold
  from private.job_post_payment_holds as hold
  where hold.condition_id = v_condition.id
    and hold.status = 'refund_required'
  for update;

  if found then
    if new.status = 'refunded' then
      update private.job_post_payment_holds
      set status = 'resolved', resolved_at = pg_catalog.now(), updated_at = pg_catalog.now()
      where id = v_hold.id;
      update private.job_post_economic_conditions
      set condition_status = 'refunded', updated_at = pg_catalog.now()
      where id = v_condition.id;
      insert into private.economic_audit_events(
        actor_kind, action, target_type, target_id, metadata
      ) values (
        'provider_webhook', 'job_post_payment_hold_resolved_by_full_refund',
        'job_post_payment_hold', v_hold.id,
        pg_catalog.jsonb_build_object(
          'order_id', new.id,
          'order_status', new.status,
          'publication_granted', false,
          'moderation_punishment', false
        )
      );
    elsif new.status in ('paid', 'partially_refunded', 'disputed') then
      update private.job_post_economic_conditions
      set condition_status = 'reconciliation_required', updated_at = pg_catalog.now()
      where id = v_condition.id;
    end if;
    return new;
  end if;

  if new.status = 'paid' and not private.job_post_checkout_is_eligible(v_condition.id) then
    v_restriction_applies := private.economic_service_is_restricted(
      v_condition.author_user_id, 'job_posting'
    );
    select exists (
      select 1
      from public.commune_job_posts as job
      join public.commune_posts as post on post.id = job.post_id
      where job.id = v_condition.job_post_id
        and job.anti_scam_review_status = 'reviewed_clear'
        and post.status in (
          'approved'::public.commune_post_status,
          'published'::public.commune_post_status
        )
    ) into v_content_eligible;

    insert into private.job_post_payment_holds(
      condition_id, job_post_id, post_id, author_user_id, order_id, reason_code
    ) values (
      v_condition.id, v_condition.job_post_id, v_condition.post_id,
      v_condition.author_user_id, new.id,
      case when v_restriction_applies then 'job_posting_restricted'
        else 'content_review_no_longer_eligible' end
    )
    on conflict (condition_id) do update set
      order_id = excluded.order_id,
      reason_code = excluded.reason_code,
      status = 'refund_required',
      resolved_at = null,
      updated_at = pg_catalog.now()
    returning * into v_hold;

    update private.job_post_economic_conditions
    set condition_status = 'reconciliation_required', satisfied_at = null,
        updated_at = pg_catalog.now()
    where id = v_condition.id;

    update public.commune_posts as post
    set status = 'approved'::public.commune_post_status,
        visibility = 'private_draft',
        updated_at = pg_catalog.now()
    from public.commune_job_posts as job
    where job.id = v_condition.job_post_id
      and post.id = job.post_id
      and post.status = 'published'::public.commune_post_status;

    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'job_post_payment_quarantined',
      'job_post_payment_hold', v_hold.id,
      pg_catalog.jsonb_build_object(
        'order_id', new.id,
        'reason_code', v_hold.reason_code,
        'content_review_eligible', v_content_eligible,
        'job_posting_restricted', v_restriction_applies,
        'refund_required', true,
        'publication_granted', false,
        'moderation_punishment', false
      )
    );
    return new;
  end if;

  update private.job_post_economic_conditions
  set
    condition_status = case new.status
      when 'paid' then 'satisfied'
      when 'partially_refunded' then 'refunded'
      when 'refunded' then 'refunded'
      when 'disputed' then 'disputed'
      else condition_status
    end,
    satisfied_at = case when new.status = 'paid' then coalesce(satisfied_at, pg_catalog.now()) else satisfied_at end,
    updated_at = pg_catalog.now()
  where id = v_condition.id;

  if new.status = 'paid' then
    perform private.publish_job_post_if_eligible(v_condition.job_post_id);
  elsif new.status in ('partially_refunded', 'refunded', 'disputed') then
    update public.commune_posts as post
    set status = 'approved'::public.commune_post_status,
        visibility = 'private_draft',
        updated_at = pg_catalog.now()
    from public.commune_job_posts as job
    where job.id = v_condition.job_post_id
      and post.id = job.post_id
      and post.status = 'published'::public.commune_post_status;
    if found then
      insert into private.economic_audit_events(
        actor_kind, action, target_type, target_id, metadata
      ) values (
        'provider_webhook', 'job_post_economic_publication_hold_applied',
        'job_post_economic_condition', v_condition.id,
        pg_catalog.jsonb_build_object(
          'order_id', new.id, 'order_status', new.status,
          'content_review_unchanged', true,
          'moderation_punishment', false
        )
      );
    end if;
  end if;
  return new;
end;
$$;

alter function private.synchronize_job_post_economic_order() owner to postgres;
revoke all privileges on function private.synchronize_job_post_economic_order()
  from public, anon, authenticated, service_role;

create trigger synchronize_job_post_economic_order
after update of status on private.economic_orders
for each row execute function private.synchronize_job_post_economic_order();

create or replace function public.current_user_job_post_economic_status(p_job_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_condition private.job_post_economic_conditions%rowtype;
  v_post_status public.commune_post_status;
  v_price private.economic_prices%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  select * into v_condition
  from private.job_post_economic_conditions as condition
  where condition.job_post_id = p_job_post_id
    and condition.author_user_id = v_actor;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_post_economic_status_not_found';
  end if;
  select post.status into v_post_status
  from public.commune_posts as post
  where post.id = v_condition.post_id;
  if v_condition.price_id is not null then
    select * into v_price from private.economic_prices where id = v_condition.price_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'job_post_id', v_condition.job_post_id,
    'classification', v_condition.classification,
    'economic_status', v_condition.condition_status,
    'content_approved', exists (
      select 1 from public.commune_job_posts
      where id = v_condition.job_post_id and anti_scam_review_status = 'reviewed_clear'
    ),
    'publication_status', v_post_status,
    'published', v_post_status = 'published'::public.commune_post_status,
    'amount_minor', v_price.unit_amount_minor,
    'currency', v_price.currency,
    'terms_version', v_condition.terms_version,
    'test_mode', true
  );
end;
$$;

alter function public.current_user_job_post_economic_status(uuid) owner to postgres;

revoke all privileges on function public.review_commune_job_post(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.operator_assess_job_post_fee(
  uuid, uuid, text, text, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.prepare_job_post_economic_checkout(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_job_post_economic_status(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.review_commune_job_post(uuid, text, text)
  to authenticated;
grant execute on function public.operator_assess_job_post_fee(
  uuid, uuid, text, text, uuid, uuid, uuid, text
) to service_role;
grant execute on function public.prepare_job_post_economic_checkout(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.current_user_job_post_economic_status(uuid)
  to authenticated;

comment on table private.job_post_economic_conditions is
  'Private fee condition only. Content approval and publication remain governed by Commune review state.';
comment on function public.review_commune_job_post is
  'Atomic reviewer action for Job Posts. Fee-off preserves direct publication; fee-on stores content approval privately until an independent economic condition is satisfied.';
comment on function private.synchronize_job_post_economic_order is
  'Payment may satisfy a Job Post economic condition, but this trigger cannot create content approval and publishes only through the centralized dual-fact gate.';

commit;

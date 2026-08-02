-- Exact, recipient-owned Requests & Reviews projection for Commons accounts.
-- Source-domain rows remain authoritative; this function exposes only safe
-- labels, states, timestamps, and internal links for the signed-in owner.

begin;

create or replace function private.current_user_request_review_rows(p_actor uuid)
returns table (
  item_key text,
  source_domain text,
  source_type text,
  source_record_id uuid,
  safe_title text,
  primary_status text,
  secondary_status text,
  pending boolean,
  deep_link text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    'code_proposals:' || proposal.id::text,
    'code_proposals'::text,
    'commune_code_revision_proposal'::text,
    proposal.id,
    'Revision proposal for “' || pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Commune code post'), 120
    ) || '”',
    proposal.proposal_status,
    null::text,
    proposal.proposal_status in ('submitted', 'needs_changes'),
    case when post.post_type = 'troubleshooting' then
      '/commune/troubleshooting-grove/review?proposal=' || proposal.id::text
    else
      '/commune/coding-cornucopia/review?proposal=' || proposal.id::text
    end,
    proposal.created_at,
    proposal.updated_at
  from public.commune_code_revision_proposals as proposal
  left join public.commune_posts as post on post.id = proposal.post_id
  where proposal.proposer_user_id = p_actor

  union all

  select
    'work_with:' || request.id::text,
    'work_with'::text,
    'work_with_request'::text,
    request.id,
    case when nullif(pg_catalog.btrim(request.request_type), '') is null
      then 'Work With request'
      else 'Work With request · ' || pg_catalog.left(
        pg_catalog.replace(request.request_type, '_', ' '), 100
      )
    end,
    request.status::text,
    null::text,
    request.status::text in ('pending_review', 'needs_information'),
    '/commons-circle/requests-reviews?domain=work_with',
    request.created_at,
    request.updated_at
  from public.work_with_requests as request
  where request.user_id = p_actor

  union all

  select
    'troubleshooting:' || issue.id::text,
    'troubleshooting'::text,
    'commune_troubleshooting_post'::text,
    issue.id,
    coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Troubleshooting issue'),
    issue.troubleshooting_status,
    issue.accepted_resolution_kind,
    issue.troubleshooting_status in ('open', 'needs_information', 'in_progress', 'fix_proposed'),
    case when issue.post_id is null then '/commune/troubleshooting'
      else '/commune/posts/' || issue.post_id::text end,
    issue.created_at,
    issue.updated_at
  from public.commune_troubleshooting_posts as issue
  left join public.commune_posts as post on post.id = issue.post_id
  where issue.author_user_id = p_actor

  union all

  select
    'research_notes:' || note.id::text,
    'research_notes'::text,
    'commune_research_note'::text,
    note.id,
    coalesce(nullif(pg_catalog.btrim(post.title), ''), 'Research Note'),
    note.review_status,
    note.evidence_strength,
    note.review_status in (
      'submitted', 'needs_citation', 'needs_clarification',
      'source_issue', 'overclaiming_evidence'
    ),
    case when note.post_id is null then '/commune/rooms/research-notes'
      else '/commune/posts/' || note.post_id::text end,
    note.created_at,
    note.updated_at
  from public.commune_research_notes as note
  left join public.commune_posts as post on post.id = note.post_id
  where note.author_user_id = p_actor

  union all

  select
    'repository_showcase:' || showcase.id::text,
    'repository_showcase'::text,
    'commune_repository_showcase'::text,
    showcase.id,
    coalesce(nullif(pg_catalog.btrim(showcase.project_name), ''), 'Repository Showcase'),
    showcase.status::text,
    showcase.sandbox_review_status,
    showcase.status::text in ('draft', 'pending_review', 'in_review', 'needs_information')
      or showcase.sandbox_review_status in ('requested', 'queued', 'in_review', 'needs_information'),
    case when showcase.post_id is null then '/commune/rooms/repository-showcase/new'
      else '/commune/posts/' || showcase.post_id::text end,
    showcase.created_at,
    showcase.updated_at
  from public.commune_repository_showcases as showcase
  where showcase.user_id = p_actor

  union all

  select
    'iteration_showcase:' || iteration.id::text,
    'iteration_showcase'::text,
    'commune_iteration_showcase'::text,
    iteration.id,
    case when nullif(pg_catalog.btrim(iteration.version_build_label), '') is null
      then 'Elysia Iteration Showcase'
      else 'Elysia Iteration · ' || pg_catalog.left(iteration.version_build_label, 100)
    end,
    iteration.status::text,
    iteration.sandbox_review_status,
    iteration.status::text in ('draft', 'pending_review', 'in_review', 'needs_information')
      or iteration.sandbox_review_status in ('requested', 'queued', 'in_review', 'needs_information'),
    case when iteration.post_id is null then '/commune/rooms/elysia-iteration-showcase/new'
      else '/commune/posts/' || iteration.post_id::text end,
    iteration.created_at,
    iteration.updated_at
  from public.commune_iteration_showcases as iteration
  where iteration.author_user_id = p_actor

  union all

  select
    'job_posts:' || job.id::text,
    'job_posts'::text,
    'commune_job_post'::text,
    job.id,
    coalesce(nullif(pg_catalog.btrim(job.role_title), ''), 'Job Post'),
    job.application_status,
    job.anti_scam_review_status,
    job.application_status = 'needs_clarification'
      or job.anti_scam_review_status in (
        'not_reviewed', 'needs_pay_clarification', 'needs_contact_clarification',
        'needs_location_clarification', 'suspicious'
      ),
    '/commune/posts/' || job.post_id::text,
    job.created_at,
    job.updated_at
  from public.commune_job_posts as job
  where job.author_user_id = p_actor;
$$;

revoke all privileges on function private.current_user_request_review_rows(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_request_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_counts jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_request_authentication_required';
  end if;

  select pg_catalog.jsonb_build_object(
    'total', pg_catalog.count(*),
    'pending', pg_catalog.count(*) filter (where request.pending),
    'byDomain', coalesce((
      select pg_catalog.jsonb_object_agg(domain_count.source_domain, pg_catalog.jsonb_build_object(
        'total', domain_count.total,
        'pending', domain_count.pending
      ))
      from (
        select grouped.source_domain,
          pg_catalog.count(*) as total,
          pg_catalog.count(*) filter (where grouped.pending) as pending
        from private.current_user_request_review_rows(v_actor) as grouped
        group by grouped.source_domain
      ) as domain_count
    ), '{}'::jsonb)
  )
  into v_counts
  from private.current_user_request_review_rows(v_actor) as request;

  return v_counts;
end;
$$;

create or replace function public.current_user_requests_and_reviews(
  p_state text default 'all',
  p_domain text default null,
  p_limit integer default 40,
  p_before_updated_at timestamptz default null,
  p_before_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_items jsonb;
  v_last_updated_at timestamptz;
  v_last_key text;
  v_has_more boolean := false;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_request_authentication_required';
  end if;
  if coalesce(p_state, 'all') not in ('all', 'pending', 'resolved') then
    raise exception using errcode = '22023', message = 'account_request_state_invalid';
  end if;
  if p_domain is not null and p_domain not in (
    'code_proposals', 'work_with', 'troubleshooting', 'research_notes',
    'repository_showcase', 'iteration_showcase', 'job_posts'
  ) then
    raise exception using errcode = '22023', message = 'account_request_domain_invalid';
  end if;
  if (p_before_updated_at is null) <> (p_before_key is null) then
    raise exception using errcode = '22023', message = 'account_request_cursor_invalid';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'key', item.item_key,
    'domain', item.source_domain,
    'sourceType', item.source_type,
    'title', item.safe_title,
    'status', item.primary_status,
    'secondaryStatus', item.secondary_status,
    'pending', item.pending,
    'deepLink', item.deep_link,
    'createdAt', item.created_at,
    'updatedAt', item.updated_at
  ) order by item.updated_at desc, item.item_key desc), '[]'::jsonb)
  into v_items
  from (
    select request.*
    from private.current_user_request_review_rows(v_actor) as request
    where (p_domain is null or request.source_domain = p_domain)
      and case coalesce(p_state, 'all')
        when 'pending' then request.pending
        when 'resolved' then not request.pending
        else true
      end
      and (
        p_before_updated_at is null
        or (request.updated_at, request.item_key) < (p_before_updated_at, p_before_key)
      )
    order by request.updated_at desc, request.item_key desc
    limit v_limit
  ) as item;

  select item.updated_at, item.item_key
  into v_last_updated_at, v_last_key
  from private.current_user_request_review_rows(v_actor) as item
  where (p_domain is null or item.source_domain = p_domain)
    and case coalesce(p_state, 'all')
      when 'pending' then item.pending
      when 'resolved' then not item.pending
      else true
    end
    and (
      p_before_updated_at is null
      or (item.updated_at, item.item_key) < (p_before_updated_at, p_before_key)
    )
  order by item.updated_at desc, item.item_key desc
  offset v_limit - 1
  limit 1;

  if v_last_updated_at is not null then
    select exists (
      select 1
      from private.current_user_request_review_rows(v_actor) as candidate
      where (p_domain is null or candidate.source_domain = p_domain)
        and case coalesce(p_state, 'all')
          when 'pending' then candidate.pending
          when 'resolved' then not candidate.pending
          else true
        end
        and (candidate.updated_at, candidate.item_key) < (v_last_updated_at, v_last_key)
    ) into v_has_more;
  end if;

  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'limit', v_limit,
    'hasMore', v_has_more,
    'nextCursor', case when v_has_more then pg_catalog.jsonb_build_object(
      'updatedAt', v_last_updated_at,
      'key', v_last_key
    ) else null end
  );
end;
$$;

alter function private.current_user_request_review_rows(uuid) owner to postgres;
alter function public.current_user_request_counts() owner to postgres;
alter function public.current_user_requests_and_reviews(text,text,integer,timestamptz,text) owner to postgres;

revoke all privileges on function public.current_user_request_counts()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_requests_and_reviews(text,text,integer,timestamptz,text)
  from public, anon, authenticated, service_role;

grant execute on function public.current_user_request_counts()
  to authenticated, service_role;
grant execute on function public.current_user_requests_and_reviews(text,text,integer,timestamptz,text)
  to authenticated, service_role;

comment on function public.current_user_request_counts() is
  'Returns exact counts over signed-in account-owned source workflows; reviewer queues are excluded.';
comment on function public.current_user_requests_and_reviews(text,text,integer,timestamptz,text) is
  'Returns a bounded, cursor-paginated, safe projection of signed-in account-owned source workflows.';

commit;

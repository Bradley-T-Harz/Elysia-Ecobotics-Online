-- Keep the legacy pseudo-private Job Post note outside every public/authenticated
-- row read. RLS limits rows, not columns, so the former table-level SELECT grant
-- exposed this column whenever a published sidecar row was otherwise readable.

begin;

revoke all on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text)
  to authenticated;

revoke select on table public.commune_job_posts from public, anon, authenticated;

do $$
declare
  readable_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into readable_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'commune_job_posts'
    and column_name not in ('private_application_note', 'reviewed_by');

  if readable_columns is null then
    raise exception 'commune_job_posts readable-column grant could not be built';
  end if;

  execute format(
    'grant select (%s) on table public.commune_job_posts to anon, authenticated',
    readable_columns
  );
end
$$;

comment on column public.commune_job_posts.private_application_note is
  'Deprecated pseudo-private column. It is not readable by anon or authenticated clients and must not store new reviewer material; protected notes belong in RLS-governed review_comments.';

comment on column public.commune_job_posts.reviewed_by is
  'Protected review-actor metadata. Public readers receive the public anti-scam state and review time, while reviewer identity/history remains in the governed review system.';

commit;

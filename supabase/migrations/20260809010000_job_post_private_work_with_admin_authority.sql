-- Align the first-party Work With route with canonical administrator authority.
-- Selecting this admin-only route is the explicit first-party provenance declaration;
-- ordinary users remain denied and the canonical private destination remains fixed.

begin;

drop policy if exists "v2 private work with insert is first party only"
  on public.commune_job_posts;

create policy "v2 private work with insert is first party only"
on public.commune_job_posts
as restrictive
for insert
to authenticated
with check (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and application_destination = '/work-with-elysia-ecobotics'
  )
);

drop policy if exists "v2 private work with update is first party only"
  on public.commune_job_posts;

create policy "v2 private work with update is first party only"
on public.commune_job_posts
as restrictive
for update
to authenticated
using (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and application_destination = '/work-with-elysia-ecobotics'
  )
)
with check (
  model_version <> 2
  or application_route_type <> 'private_work_with'
  or (
    public.current_user_is_admin()
    and application_destination = '/work-with-elysia-ecobotics'
  )
);

comment on column public.commune_job_posts.application_route_type is
  'Public application-route category. private_work_with is an explicit first-party declaration restricted to current administrators and the canonical private destination.';

commit;

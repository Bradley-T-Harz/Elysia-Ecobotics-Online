-- Commune room post/admin publishing and media upload policy repair.
-- Safe to run manually in Supabase SQL Editor. This does not disable RLS,
-- does not make uploads public, and does not grant broad file access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commune-media',
  'commune-media',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.commune_posts enable row level security;
alter table public.commune_threads enable row level security;
alter table public.commune_media enable row level security;

-- Normal members keep the existing moderation path.
drop policy if exists "users create own commune drafts" on public.commune_posts;
create policy "users create own commune drafts"
on public.commune_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status in ('draft', 'pending_review')
  and post_type <> 'official_update'
);

-- Admins can publish their own room posts directly, but only as themselves and
-- only into the public/published state that the public Commune feed already expects.
drop policy if exists "admins create direct published commune posts" on public.commune_posts;
create policy "admins create direct published commune posts"
on public.commune_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.current_user_is_admin()
  and status = 'published'
  and visibility = 'public'
  and coalesce(moderation_status, 'approved') = 'approved'
);

-- Room threads are still created by the signed-in actor only.
drop policy if exists "users create own commune threads" on public.commune_threads;
create policy "users create own commune threads"
on public.commune_threads
for insert
to authenticated
with check (created_by = auth.uid());

-- Media uploads remain private moderation intake. Metadata must point at the
-- explicit Commune media bucket and use known safe media kinds.
drop policy if exists "owners read own commune media" on public.commune_media;
create policy "owners read own commune media"
on public.commune_media
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "public reads published commune media metadata" on public.commune_media;
create policy "public reads published commune media metadata"
on public.commune_media
for select
using (
  visibility_state = 'published'
  and storage_bucket = 'commune-media'
  and media_kind in ('image', 'code_text', 'document')
  and exists (
    select 1
    from public.commune_posts p
    where p.id = post_id
      and p.status = 'published'
      and p.visibility = 'public'
  )
);

drop policy if exists "users insert own commune media metadata" on public.commune_media;
create policy "users insert own commune media metadata"
on public.commune_media
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and storage_bucket = 'commune-media'
  and visibility_state in ('submitted', 'flagged')
  and media_kind in ('image', 'document', 'code_text', 'other')
);

drop policy if exists "moderators manage commune media metadata" on public.commune_media;
create policy "moderators manage commune media metadata"
on public.commune_media
for all
to authenticated
using (public.current_user_can_review_domain('commune'::public.review_domain))
with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users upload own commune media files" on storage.objects;
create policy "users upload own commune media files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'commune-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users read own commune media files" on storage.objects;
create policy "users read own commune media files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'commune-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "moderators read commune media files" on storage.objects;
create policy "moderators read commune media files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'commune-media'
  and public.current_user_can_review_domain('commune'::public.review_domain)
);

grant select, insert, update on table public.commune_posts to authenticated;
grant select, insert, update on table public.commune_threads to authenticated;
grant select, insert, update on table public.commune_media to authenticated;
grant select on table public.commune_posts to anon;
grant select on table public.commune_threads to anon;
grant select on table public.commune_media to anon;

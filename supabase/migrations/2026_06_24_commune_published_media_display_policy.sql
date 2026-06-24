-- Commune published media display policy repair.
-- Safe to run manually in Supabase SQL Editor. This keeps the commune-media
-- bucket private by default while allowing reads only for files whose metadata
-- is explicitly published and attached to a public published Commune post.

drop policy if exists "public reads published commune media files" on storage.objects;
create policy "public reads published commune media files"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'commune-media'
  and exists (
    select 1
    from public.commune_media media
    join public.commune_posts post on post.id = media.post_id
    where media.storage_bucket = 'commune-media'
      and media.storage_path = name
      and media.visibility_state = 'published'
      and media.media_kind in ('image', 'document', 'code_text')
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

-- Existing image attachments on already-public posts were created before the
-- display path existed. Promote only safe media kinds that are attached to a
-- public published post, leaving hidden/removed/archived/revoked rows alone.
update public.commune_media media
set visibility_state = 'published',
    updated_at = now()
from public.commune_posts post
where post.id = media.post_id
  and post.status = 'published'
  and post.visibility = 'public'
  and media.visibility_state in ('submitted', 'flagged')
  and media.media_kind in ('image', 'document', 'code_text')
  and media.storage_bucket = 'commune-media';

update public.commune_uploads upload
set status = 'published'
from public.commune_posts post
where post.id = upload.post_id
  and post.status = 'published'
  and post.visibility = 'public'
  and upload.status in ('pending_review', 'approved')
  and upload.bucket = 'commune-uploads';

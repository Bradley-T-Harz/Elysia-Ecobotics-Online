-- Harden browser-direct upload authority without removing any established
-- upload surface. Existing owner/reviewer reads and service-role cleanup remain
-- unchanged; new objects must follow the paths emitted by the current clients
-- and, where applicable, belong to an authoritative request or Forge draft.

begin;

-- Reassert the existing private-bucket size and media contracts. The
-- stewardship bucket previously had no provider-enforced size or MIME bound.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'work-with-attachments', 'work-with-attachments', false, 10485760,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'text/plain', 'text/markdown', 'text/x-markdown',
      'application/octet-stream'
    ]
  ),
  (
    'stewardship-receipts', 'stewardship-receipts', false, 10485760,
    array[
      'application/pdf', 'image/png', 'image/jpeg',
      'text/plain', 'text/markdown', 'text/x-markdown',
      'application/octet-stream'
    ]
  ),
  (
    'addon-packages', 'addon-packages', false, 52428800,
    array[
      'application/octet-stream', 'application/zip',
      'application/x-zip-compressed'
    ]
  ),
  (
    'commune-media', 'commune-media', false, 10485760,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
      'text/plain', 'text/markdown', 'text/csv', 'application/json'
    ]
  ),
  (
    'commune-uploads', 'commune-uploads', false, 10485760,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
      'text/plain', 'text/markdown', 'text/csv', 'application/json'
    ]
  )
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- These six older policies duplicated the governed profile-original policies.
-- PostgreSQL permissive policies combine with OR, so their broad first-folder
-- checks weakened the strict avatars/banners path contract.
drop policy if exists "users upload own profile avatars" on storage.objects;
drop policy if exists "users update own profile avatars" on storage.objects;
drop policy if exists "users delete own profile avatars" on storage.objects;
drop policy if exists "users upload own profile banners" on storage.objects;
drop policy if exists "users update own profile banners" on storage.objects;
drop policy if exists "users delete own profile banners" on storage.objects;

-- Work With resumes/CVs are stored as user/request/file. A user-named folder
-- alone is not authority to upload an object disconnected from a real request.
drop policy if exists "users upload own work with attachments" on storage.objects;
create policy "users upload own work with attachments"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'work-with-attachments'
  and pg_catalog.split_part(objects.name, '/', 1) = auth.uid()::text
  and objects.name ~ '^[^/]+/[^/]+/[^/]+$'
  and pg_catalog.char_length(objects.name) between 75 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
  and exists (
    select 1
    from public.work_with_requests as request
    where request.user_id = auth.uid()
      and request.id::text = pg_catalog.split_part(objects.name, '/', 2)
  )
);

-- Stewardship evidence uses the same user/request/file authority shape and
-- remains private administrator-review material.
drop policy if exists "users upload own stewardship receipts" on storage.objects;
create policy "users upload own stewardship receipts"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'stewardship-receipts'
  and pg_catalog.split_part(objects.name, '/', 1) = auth.uid()::text
  and objects.name ~ '^[^/]+/[^/]+/[^/]+$'
  and pg_catalog.char_length(objects.name) between 75 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
  and exists (
    select 1
    from public.stewardship_recognition_requests as request
    where request.user_id = auth.uid()
      and request.id::text = pg_catalog.split_part(objects.name, '/', 2)
  )
);

-- Private Forge packages use user/draft/file. The browser already refuses a
-- locked draft; enforce the same rule at Storage so an altered client cannot
-- attach an unreviewed replacement to an immutable submission snapshot.
drop policy if exists "developers upload own addon packages" on storage.objects;
create policy "developers upload own addon packages"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'addon-packages'
  and pg_catalog.split_part(objects.name, '/', 1) = auth.uid()::text
  and objects.name ~ '^[^/]+/[^/]+/[^/]+$'
  and pg_catalog.char_length(objects.name) between 75 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
  and exists (
    select 1
    from public.addon_drafts as draft
    where draft.owner_user_id = auth.uid()
      and draft.id::text = pg_catalog.split_part(objects.name, '/', 2)
      and draft.locked_at is null
      and draft.archived_at is null
  )
);

-- Current Commune clients emit user/file. Metadata is created immediately
-- after upload, so the Storage policy cannot require it to pre-exist; the
-- existing table RLS and moderation/publication boundaries remain authoritative.
drop policy if exists "users upload own commune files" on storage.objects;
create policy "users upload own commune files"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'commune-uploads'
  and pg_catalog.split_part(objects.name, '/', 1) = auth.uid()::text
  and objects.name ~ '^[^/]+/[^/]+$'
  and pg_catalog.char_length(objects.name) between 38 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
);

drop policy if exists "users upload own commune media files" on storage.objects;
create policy "users upload own commune media files"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id = 'commune-media'
  and pg_catalog.split_part(objects.name, '/', 1) = auth.uid()::text
  and objects.name ~ '^[^/]+/[^/]+$'
  and pg_catalog.char_length(objects.name) between 38 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
);

-- Icons/listing assets are a preserved but currently producer-dormant surface.
-- Retain its flexible owner subtree while rejecting traversal and unbounded keys.
drop policy if exists "developers upload own addon icons" on storage.objects;
create policy "developers upload own addon icons"
on storage.objects for insert to authenticated
with check (
  private.community_account_allows_ordinary_mutation(auth.uid())
  and bucket_id in ('addon-icons', 'addon-listing-assets')
  and (storage.foldername(objects.name))[1] = auth.uid()::text
  and pg_catalog.char_length(objects.name) between 38 and 500
  and objects.name !~ '(^|/)\.\.(/|$)'
  and objects.name !~ '[\\\\]'
);

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'users upload own profile avatars',
        'users update own profile avatars',
        'users delete own profile avatars',
        'users upload own profile banners',
        'users update own profile banners',
        'users delete own profile banners'
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'loose_profile_storage_policy_remains';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'INSERT'
      and policyname in (
        'profile owners upload private originals',
        'users upload own work with attachments',
        'users upload own stewardship receipts',
        'developers upload own addon packages',
        'developers upload own addon icons',
        'users upload own commune files',
        'users upload own commune media files'
      )
  ) <> 7 then
    raise exception using
      errcode = '55000',
      message = 'governed_storage_upload_policy_contract_missing';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id in (
      'work-with-attachments', 'stewardship-receipts', 'addon-packages',
      'commune-media', 'commune-uploads'
    )
      and (public or file_size_limit is null or allowed_mime_types is null)
  ) then
    raise exception using
      errcode = '55000',
      message = 'private_upload_bucket_contract_invalid';
  end if;
end;
$$;

commit;

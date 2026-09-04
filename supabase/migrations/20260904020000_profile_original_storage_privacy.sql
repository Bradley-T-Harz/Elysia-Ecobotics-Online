-- Remove two legacy Dashboard-era policies that exposed private profile image
-- originals to the PostgreSQL public role. Public profile presentation remains
-- available only through the Identity Worker safe-card lookup, magic-byte and
-- dimension validation, and bounded WebP transformation path.

begin;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id in ('profile-avatars', 'profile-banners');

do $$
begin
  if (select pg_catalog.count(*) from storage.buckets where id in ('profile-avatars', 'profile-banners')) <> 2 then
    raise exception using
      errcode = '55000',
      message = 'profile_private_bucket_contract_missing';
  end if;
end;
$$;

drop policy if exists "public reads profile avatars" on storage.objects;
drop policy if exists "public reads profile banners" on storage.objects;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('public reads profile avatars', 'public reads profile banners')
  ) then
    raise exception using
      errcode = '55000',
      message = 'profile_original_public_policy_remains';
  end if;
  if exists (
    select 1
    from storage.buckets
    where id in ('profile-avatars', 'profile-banners')
      and (
        public
        or file_size_limit is distinct from 5242880
        or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp']::text[]
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'profile_private_bucket_contract_invalid';
  end if;
end;
$$;

commit;

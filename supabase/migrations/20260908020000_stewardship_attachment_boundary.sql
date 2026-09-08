-- Reviewable forward migration; no historical proof or recognition is deleted.
begin;

-- Restrictive policy composes with existing ownership and account-state policies.
create policy "bounded new stewardship evidence metadata"
on public.stewardship_receipt_files as restrictive for insert to authenticated
with check (
  request_id is not null and user_id = auth.uid()
  and size_bytes between 1 and 10485760
  and sha256_hash ~ '^[a-f0-9]{64}$'
  and deleted_at is null and redaction_status = 'user_attested_redacted'
  and storage_path = user_id::text || '/' || request_id::text || '/' || id::text || '-' || original_filename
  and ((original_filename = 'redacted-proof.pdf' and mime_type = 'application/pdf')
    or (original_filename = 'redacted-proof.png' and mime_type = 'image/png')
    or (original_filename = 'redacted-proof.jpg' and mime_type = 'image/jpeg')
    or (original_filename = 'redacted-proof.txt' and mime_type = 'text/plain')
    or (original_filename = 'redacted-proof.md' and mime_type = 'text/markdown'))
  and exists (select 1 from public.stewardship_recognition_requests r
    where r.id = request_id and r.user_id = auth.uid()
      and r.redaction_confirmed and r.status = 'pending_review' and r.receipt_file_id is null)
);

create function public.attach_own_stewardship_receipt(p_request_id uuid, p_file_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.stewardship_recognition_requests%rowtype;
  v_file public.stewardship_receipt_files%rowtype;
begin
  if v_actor is null or not private.community_account_allows_ordinary_mutation(v_actor) then
    raise exception using errcode = '42501', message = 'stewardship_attachment_unavailable';
  end if;
  select * into v_request from public.stewardship_recognition_requests
    where id = p_request_id and user_id = v_actor for update;
  if not found then raise exception using errcode = '42501', message = 'stewardship_attachment_unavailable'; end if;
  select * into v_file from public.stewardship_receipt_files
    where id = p_file_id and request_id = p_request_id and user_id = v_actor and deleted_at is null;
  if not found or v_file.bucket <> 'stewardship-receipts'
    or pg_catalog.split_part(v_file.storage_path, '/', 1) <> v_actor::text
    or pg_catalog.split_part(v_file.storage_path, '/', 2) <> p_request_id::text
    or v_file.storage_path !~ '^[^/]+/[^/]+/[^/]+$'
    or v_file.storage_path ~ '(^|/)\.\.(/|$)|[\\]'
    or not exists (select 1 from storage.objects o where o.bucket_id = v_file.bucket and o.name = v_file.storage_path)
  then raise exception using errcode = '42501', message = 'stewardship_attachment_unavailable'; end if;
  -- A retry of the same attachment is harmless, including after a review begins.
  if v_request.receipt_file_id = p_file_id then return true; end if;
  if not v_request.redaction_confirmed or v_request.status <> 'pending_review' or v_request.receipt_file_id is not null then
    raise exception using errcode = '42501', message = 'stewardship_attachment_unavailable';
  end if;
  update public.stewardship_recognition_requests set receipt_file_id = p_file_id, updated_at = now()
    where id = p_request_id and user_id = v_actor;
  return true;
end;
$$;
alter function public.attach_own_stewardship_receipt(uuid, uuid) owner to postgres;
revoke all on function public.attach_own_stewardship_receipt(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.attach_own_stewardship_receipt(uuid, uuid) to authenticated;
comment on function public.attach_own_stewardship_receipt(uuid, uuid) is 'Owner-scoped, idempotent proof linkage only; never changes review status, recognition or economic records.';
commit;

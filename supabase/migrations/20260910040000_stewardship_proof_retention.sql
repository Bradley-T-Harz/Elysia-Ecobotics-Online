begin;
create table private.stewardship_proof_lifecycle (
 request_id uuid primary key references public.stewardship_recognition_requests(id) on delete cascade,
 final_review_at timestamptz,
 appeal_open boolean not null default false,
 appeal_closed_at timestamptz,
 hold_kind text check(hold_kind in ('legal','fraud_abuse')),
 hold_reason text,
 hold_review_at timestamptz,
 deletion_state text not null default 'retained' check(deletion_state in ('retained','deleting','deleted')),
 lease_token uuid,
 lease_expires_at timestamptz,
 deleted_at timestamptz,
 revision integer not null default 1,
 check((hold_kind is null)=(hold_reason is null) and (hold_kind is null)=(hold_review_at is null))
);
alter table private.stewardship_proof_lifecycle owner to postgres;
alter table private.stewardship_proof_lifecycle enable row level security;
revoke all on private.stewardship_proof_lifecycle from public,anon,authenticated,service_role;
-- Restored copies are identified by a private name hash, not a retained filename.
create table private.stewardship_proof_tombstones (
 file_id uuid primary key references public.stewardship_receipt_files(id) on delete cascade,
 object_name_sha256 text not null check(object_name_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table private.stewardship_proof_tombstones owner to postgres;
alter table private.stewardship_proof_tombstones enable row level security;
revoke all on private.stewardship_proof_tombstones from public,anon,authenticated,service_role;
-- Only an already-recorded, matching final review can date historical retention.
insert into private.stewardship_proof_lifecycle(request_id,final_review_at)
select r.id,case when r.status in ('approved','rejected','withdrawn','archived') and i.status=r.status and i.reviewed_by is not null then i.reviewed_at else null end
from public.stewardship_recognition_requests r left join public.review_items i on i.domain='stewardship' and i.source_table='stewardship_recognition_requests' and i.source_id=r.id;

create function private.track_stewardship_final_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.stewardship_proof_lifecycle(request_id) values(new.id) on conflict do nothing;
 if tg_op='UPDATE' and new.status is distinct from old.status and new.status in ('approved','rejected','withdrawn','archived') then
  update private.stewardship_proof_lifecycle set final_review_at=now(),revision=revision+1 where request_id=new.id and not appeal_open and deletion_state='retained';
 end if;
 return new;
end;$$;
alter function private.track_stewardship_final_review() owner to postgres;
create trigger stewardship_final_review_lifecycle after insert or update of status on public.stewardship_recognition_requests for each row execute function private.track_stewardship_final_review();
revoke all on function private.track_stewardship_final_review() from public,anon,authenticated,service_role;

-- Initial review truth cannot be supplied by the applicant.
create policy "stewardship intake starts pending" on public.stewardship_recognition_requests as restrictive for insert to authenticated with check(status='pending_review' and receipt_file_id is null);
revoke update on public.stewardship_recognition_requests from authenticated;
revoke update(status,updated_at,receipt_file_id) on public.stewardship_recognition_requests from authenticated;
create function public.review_stewardship_request(p_request_id uuid,p_status public.review_status,p_note text,p_expected_status public.review_status)
returns boolean language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();r public.stewardship_recognition_requests%rowtype;i uuid;
begin
 if a is null or not public.current_user_can_review_domain('stewardship') or not private.community_account_allows_ordinary_mutation(a) then raise exception using errcode='42501',message='Scoped stewardship review required.';end if;
 select * into r from public.stewardship_recognition_requests where id=p_request_id for update;
 if not found or r.user_id=a then raise exception using errcode='42501',message='Independent stewardship review required.';end if;
 if r.status is distinct from p_expected_status or p_status not in ('in_review','needs_information','approved','rejected','archived') or r.status not in ('pending_review','in_review','needs_information') or length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception using errcode='22023',message='Reload this review and provide an explanation.';end if;
 select id into i from public.review_items where domain='stewardship' and source_table='stewardship_recognition_requests' and source_id=r.id for update;
 if not found then raise exception using errcode='23514',message='Stewardship review record requires reconciliation.';end if;
 update public.stewardship_recognition_requests set status=p_status,updated_at=now() where id=r.id;
 update public.review_items set status=p_status,reviewed_by=a,reviewed_at=now(),updated_at=now() where id=i;
 insert into public.review_events(review_item_id,actor_id,event_type,from_status,to_status,note,metadata) values(i,a,'stewardship_review',r.status,p_status,p_note,'{"visibility":"submitter_visible","capability":"stewardship_reviewer"}');
 return true;
end;$$;

create function public.stewardship_retention_workspace(p_request_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=auth.uid();v_review boolean:=public.current_user_can_review_domain('stewardship');v_rows jsonb;
begin
 if a is null then raise exception using errcode='42501',message='Sign in to view stewardship requests.';end if;
 select coalesce(jsonb_agg(row order by created_at desc),'[]') into v_rows from (
 select r.created_at,jsonb_build_object('requestId',r.id,'organization',r.organization_name,'status',r.status,'owner',r.user_id=a,
 'revision',l.revision,'finalReviewAt',l.final_review_at,'appealOpen',l.appeal_open,'appealClosedAt',l.appeal_closed_at,
 'holdActive',l.hold_kind is not null,'holdReviewOverdue',v_review and l.hold_review_at<now(),
 'deleteAfter',case when l.hold_kind is null and not l.appeal_open then coalesce(l.appeal_closed_at,l.final_review_at)+interval '30 days' end,
 'deletionState',l.deletion_state,'deletedAt',l.deleted_at,
 'proofAttached',exists(select 1 from public.stewardship_receipt_files f where f.request_id=r.id and f.deleted_at is null)) row
 from public.stewardship_recognition_requests r join private.stewardship_proof_lifecycle l on l.request_id=r.id
 where (r.user_id=a or (v_review and p_request_id is not null)) and (p_request_id is null or r.id=p_request_id)
 order by r.created_at desc limit 100) rows;
 return jsonb_build_object('policyVersion','2026-09-10-owner-decisions','daysAfterFinal',30,'items',v_rows);
end;$$;

create function public.stewardship_retention_command(p_request_id uuid,p_revision integer,p_action text,p_note text default '',p_hold_review_at timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();r public.stewardship_recognition_requests%rowtype;l private.stewardship_proof_lifecycle%rowtype;i uuid;v_owner boolean;
begin
 if a is null or not private.community_account_allows_ordinary_mutation(a) then raise exception using errcode='42501',message='Stewardship action unavailable.';end if;
 select * into r from public.stewardship_recognition_requests where id=p_request_id for update;
 if not found then raise exception using errcode='42501',message='Stewardship action unavailable.';end if;
 v_owner:=r.user_id=a;
 if not v_owner and not public.current_user_can_review_domain('stewardship') then raise exception using errcode='42501',message='Scoped stewardship review required.';end if;
 select * into l from private.stewardship_proof_lifecycle where request_id=r.id for update;
 if not found or l.revision<>p_revision or l.deletion_state<>'retained' then raise exception using errcode='40001',message='Reload the retention state; proof deletion may already have begun.';end if;
 if length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception using errcode='22023',message='A short explanation is required.';end if;
 select id into i from public.review_items where domain='stewardship' and source_table='stewardship_recognition_requests' and source_id=r.id for update;
 if i is null then raise exception using errcode='23514',message='Review record requires reconciliation.';end if;
 if p_action='appeal' and v_owner and l.final_review_at is not null and not l.appeal_open then
  update private.stewardship_proof_lifecycle set appeal_open=true,appeal_closed_at=null,revision=revision+1 where request_id=r.id;
  update public.review_items set status='pending_review',updated_at=now() where id=i;
 elsif p_action='close_appeal' and not v_owner and l.appeal_open then
  update private.stewardship_proof_lifecycle set appeal_open=false,appeal_closed_at=now(),revision=revision+1 where request_id=r.id;
  update public.review_items set status=r.status,updated_at=now() where id=i;
 elsif p_action in ('hold_legal','hold_fraud_abuse') and not v_owner and p_hold_review_at>now() then
  update private.stewardship_proof_lifecycle set hold_kind=substring(p_action from 6),hold_reason=p_note,hold_review_at=p_hold_review_at,revision=revision+1 where request_id=r.id;
 elsif p_action='release_hold' and not v_owner and l.hold_kind is not null then
  update private.stewardship_proof_lifecycle set hold_kind=null,hold_reason=null,hold_review_at=null,revision=revision+1 where request_id=r.id;
 else raise exception using errcode='42501',message='Retention action unavailable.';end if;
 insert into public.review_events(review_item_id,actor_id,event_type,note,metadata) values(i,a,'stewardship_'||p_action,p_note,jsonb_build_object('visibility',case when p_action like 'hold_%' or p_action='release_hold' then 'internal' else 'submitter_visible' end,'policy_version','2026-09-10-owner-decisions'));
 return true;
end;$$;

-- A deletion claim is the atomic start of deletion. An appeal/hold recorded first
-- wins the same row lock; after deletion starts the UI truthfully reports that.
-- The lease supports retry, and cannot be used to mark a still-existing object gone.
create function public.claim_stewardship_proof_deletions(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l private.stewardship_proof_lifecycle%rowtype;v_token uuid;result jsonb:='[]';v_files jsonb;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='Retention worker required.';end if;
 for l in select * from private.stewardship_proof_lifecycle c
 where not c.appeal_open and c.hold_kind is null
 and coalesce(c.appeal_closed_at,c.final_review_at)+interval '30 days'<=now()
 and (c.lease_expires_at is null or c.lease_expires_at<now())
 and exists(select 1 from public.stewardship_receipt_files f where f.request_id=c.request_id and (f.deleted_at is null or exists(select 1 from storage.objects o left join private.stewardship_proof_tombstones t on t.file_id=f.id where o.bucket_id=f.bucket and (o.name=f.storage_path or encode(sha256(convert_to(o.name,'UTF8')),'hex')=t.object_name_sha256))))
 order by c.final_review_at limit least(greatest(coalesce(p_limit,10),1),10) for update skip locked loop
  v_token:=gen_random_uuid();
  select coalesce(jsonb_agg(jsonb_build_object('objectId',batch.id,'bucket',batch.bucket,'name',batch.storage_path)),'[]') into v_files
  from (select o.id,f.bucket,o.name as storage_path from public.stewardship_receipt_files f left join private.stewardship_proof_tombstones t on t.file_id=f.id join storage.objects o on o.bucket_id=f.bucket and (o.name=f.storage_path or encode(sha256(convert_to(o.name,'UTF8')),'hex')=t.object_name_sha256)
  where f.request_id=l.request_id and f.bucket='stewardship-receipts' order by o.id limit 100) batch;
  update private.stewardship_proof_lifecycle set deletion_state='deleting',lease_token=v_token,lease_expires_at=now()+interval '5 minutes',revision=revision+1 where request_id=l.request_id;
  result:=result||jsonb_build_array(jsonb_build_object('requestId',l.request_id,'leaseToken',v_token,'objects',v_files));
 end loop;
 return result;
end;$$;

create function public.complete_stewardship_proof_deletion(p_request_id uuid,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare l private.stewardship_proof_lifecycle%rowtype;i uuid;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='Retention worker required.';end if;
 select * into l from private.stewardship_proof_lifecycle where request_id=p_request_id for update;
 if not found or l.lease_token is distinct from p_lease_token then raise exception using errcode='42501',message='Retention lease unavailable.';end if;
 if l.deletion_state='deleted' then return true;end if;
 if l.deletion_state<>'deleting' or exists(select 1 from public.stewardship_receipt_files f left join private.stewardship_proof_tombstones t on t.file_id=f.id join storage.objects o on o.bucket_id=f.bucket and (o.name=f.storage_path or encode(sha256(convert_to(o.name,'UTF8')),'hex')=t.object_name_sha256) where f.request_id=p_request_id) then raise exception using errcode='55000',message='Proof deletion has not been confirmed.';end if;
 insert into private.stewardship_proof_tombstones(file_id,object_name_sha256) select id,encode(sha256(convert_to(storage_path,'UTF8')),'hex') from public.stewardship_receipt_files where request_id=p_request_id and deleted_at is null on conflict do nothing;
 update public.stewardship_receipt_files set deleted_at=now(),original_filename='Proof removed under retention policy',storage_path=user_id::text||'/'||request_id::text||'/deleted-'||id::text,mime_type=null,size_bytes=null,sha256_hash=null where request_id=p_request_id and deleted_at is null;
 update private.stewardship_proof_lifecycle set deletion_state='deleted',deleted_at=now(),lease_expires_at=null,revision=revision+1 where request_id=p_request_id;
 select id into i from public.review_items where domain='stewardship' and source_table='stewardship_recognition_requests' and source_id=p_request_id;
 if i is not null then insert into public.review_events(review_item_id,event_type,metadata) values(i,'stewardship_raw_proof_deleted','{"visibility":"submitter_visible","policy_version":"2026-09-10-owner-decisions","storage_absence_verified":true}');end if;
 return true;
end;$$;

-- Private hashed object names permit restored-copy re-deletion; no file bytes/hash,
-- original filename, amount, MIME or size remain after confirmed deletion.
create function private.stewardship_storage_access(p_path text,p_upload boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.stewardship_recognition_requests r join private.stewardship_proof_lifecycle l on l.request_id=r.id
 where r.id::text=split_part(p_path,'/',2) and r.user_id::text=split_part(p_path,'/',1) and l.deletion_state='retained'
 and case when p_upload then r.user_id=auth.uid() and r.status in ('pending_review','needs_information')
 else (r.user_id=auth.uid() or public.current_user_can_review_domain('stewardship')) and exists(select 1 from public.stewardship_receipt_files f where f.request_id=r.id and f.storage_path=p_path and f.deleted_at is null) end);
$$;
alter function private.stewardship_storage_access(text,boolean) owner to postgres;
revoke all on function private.stewardship_storage_access(text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.stewardship_storage_access(text,boolean) to authenticated;
create policy "authorized stewardship proof downloads" on storage.objects for select to authenticated using(bucket_id='stewardship-receipts' and private.stewardship_storage_access(name,false));
create policy "scoped stewardship storage reads" on storage.objects as restrictive for select to authenticated using(bucket_id<>'stewardship-receipts' or private.stewardship_storage_access(name,false));
create policy "stewardship storage retention boundary" on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'stewardship-receipts' or private.stewardship_storage_access(name,true));

do $$declare f text;begin
 foreach f in array array['public.review_stewardship_request(uuid,public.review_status,text,public.review_status)','public.stewardship_retention_workspace(uuid)','public.stewardship_retention_command(uuid,integer,text,text,timestamptz)'] loop
  execute 'alter function '||f||' owner to postgres';execute 'revoke all on function '||f||' from public,anon,authenticated,service_role';execute 'grant execute on function '||f||' to authenticated';
 end loop;
 foreach f in array array['public.claim_stewardship_proof_deletions(integer)','public.complete_stewardship_proof_deletion(uuid,uuid)'] loop
  execute 'alter function '||f||' owner to postgres';execute 'revoke all on function '||f||' from public,anon,authenticated,service_role';execute 'grant execute on function '||f||' to service_role';
 end loop;
end;$$;
-- Generic review writes cannot manufacture stewardship review outcomes.
create function private.guard_stewardship_review_write() returns trigger language plpgsql set search_path='' as $$
declare i public.review_items%rowtype;
begin
 if current_user in ('postgres','supabase_admin') then return new;end if;
 if tg_table_name='review_items' then
  if tg_op='UPDATE' then
   if (old.domain='stewardship' or new.domain='stewardship') and
    (new.domain,new.source_table,new.source_id,new.submitted_by,new.status,new.reviewed_by,new.reviewed_at) is distinct from
    (old.domain,old.source_table,old.source_id,old.submitted_by,old.status,old.reviewed_by,old.reviewed_at) then
    raise exception using errcode='42501',message='Use the governed stewardship review workflow.';
   end if;
  elsif new.domain='stewardship' and (new.status<>'pending_review' or new.reviewed_by is not null or new.reviewed_at is not null or new.source_table<>'stewardship_recognition_requests' or not exists(select 1 from public.stewardship_recognition_requests r where r.id=new.source_id and r.user_id=auth.uid() and r.status='pending_review')) then
   raise exception using errcode='42501',message='Stewardship review must match the submitted source.';
  end if;
 else
  select * into i from public.review_items where id=new.review_item_id;
  if i.domain='stewardship' and not (tg_op='INSERT' and
   ((new.event_type='submitted' and new.to_status='pending_review' and new.from_status is null and i.status='pending_review' and i.submitted_by=auth.uid()) or
    (new.event_type='assigned' and new.to_status is null and new.from_status is null and i.assigned_to=auth.uid()))) then
   raise exception using errcode='42501',message='Use the governed stewardship audit workflow.';
  end if;
 end if;
 return new;
end;$$;
create trigger governed_stewardship_review_item before insert or update on public.review_items for each row execute function private.guard_stewardship_review_write();
create trigger governed_stewardship_review_event before insert or update on public.review_events for each row execute function private.guard_stewardship_review_write();
revoke all on function private.guard_stewardship_review_write() from public,anon,authenticated;

commit;

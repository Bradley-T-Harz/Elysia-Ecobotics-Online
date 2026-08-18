-- Allow a submitter to link only the exact pending Marketplace review item that
-- was created for their own pending add-on submission. General submission
-- updates remain reviewer/admin-only under the existing RLS policy.

create or replace function public.link_own_addon_submission_review_item(
  p_submission_id uuid,
  p_review_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'A signed-in submitter is required.';
  end if;

  if not exists (
    select 1
    from public.addon_submissions submission
    join public.review_items item
      on item.id = p_review_item_id
     and item.domain = 'marketplace'::public.review_domain
     and item.source_table = 'addon_submissions'
     and item.source_id = submission.id
     and item.submitted_by = v_actor
     and item.status = 'pending_review'::public.review_status
    where submission.id = p_submission_id
      and submission.submitted_by = v_actor
      and submission.status = 'pending'
      and (submission.review_item_id is null or submission.review_item_id = p_review_item_id)
  ) then
    raise exception 'The pending submission and Marketplace review item do not match the signed-in submitter.';
  end if;

  update public.addon_submissions
  set review_item_id = p_review_item_id,
      updated_at = now()
  where id = p_submission_id
    and submitted_by = v_actor
    and status = 'pending'
    and (review_item_id is null or review_item_id = p_review_item_id);

  return found;
end;
$$;

revoke all on function public.link_own_addon_submission_review_item(uuid, uuid) from public;
grant execute on function public.link_own_addon_submission_review_item(uuid, uuid) to authenticated;

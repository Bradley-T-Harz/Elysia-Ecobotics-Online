-- REMOTE PUBLIC-SCHEMA BASELINE — HISTORY RECONCILIATION ONLY.
--
-- Generated from the linked production project's public schema with a strictly
-- read-only `supabase db dump --linked --schema public` on 2026-07-14.
-- This file represents production immediately before the Repository Showcase
-- and governed-sandbox repair migrations. It contains schema/ACL metadata only:
-- no table rows, credentials, connection strings, or private secret values.
--
-- NEVER execute this baseline against the existing production project. After
-- independent verification, an operator will mark this version as applied in
-- migration history, then apply the two later migrations in timestamp order.
-- It is executable only to recreate the captured project-owned public schema in
-- a fresh disposable Supabase Postgres environment for validation.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."abuse_report_status" AS ENUM (
    'pending_review',
    'in_review',
    'resolved_no_action',
    'action_taken',
    'dismissed',
    'escalated'
);


ALTER TYPE "public"."abuse_report_status" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'administrator',
    'moderator',
    'reviewer',
    'marketplace_reviewer',
    'source_reviewer',
    'commune_moderator',
    'guardian_reviewer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."commune_post_status" AS ENUM (
    'draft',
    'pending_review',
    'in_review',
    'needs_information',
    'approved',
    'published',
    'rejected',
    'hidden',
    'archived',
    'deleted_by_user',
    'removed_by_moderator'
);


ALTER TYPE "public"."commune_post_status" OWNER TO "postgres";


CREATE TYPE "public"."commune_post_type" AS ENUM (
    'media_garden',
    'troubleshooting',
    'code_sharing',
    'repository_showcase',
    'community_network',
    'job_post',
    'official_update',
    'research_note',
    'elysia_iteration_showcase',
    'community_vote'
);


ALTER TYPE "public"."commune_post_type" OWNER TO "postgres";


CREATE TYPE "public"."commune_visibility" AS ENUM (
    'public',
    'unlisted',
    'private_draft'
);


ALTER TYPE "public"."commune_visibility" OWNER TO "postgres";


CREATE TYPE "public"."review_domain" AS ENUM (
    'commune',
    'work_with',
    'stewardship',
    'contribution',
    'living_library_source',
    'living_library_broken_link',
    'marketplace'
);


ALTER TYPE "public"."review_domain" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'draft',
    'pending_review',
    'in_review',
    'needs_information',
    'approved',
    'rejected',
    'withdrawn',
    'archived'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."sandbox_review_status" AS ENUM (
    'requested',
    'in_review',
    'approved_for_local_sandbox',
    'rejected',
    'needs_information',
    'archived'
);


ALTER TYPE "public"."sandbox_review_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_badge_if_missing"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_source" "text", "p_award_reason" "text" DEFAULT NULL::"text", "p_evidence_type" "text" DEFAULT NULL::"text", "p_evidence_id" "uuid" DEFAULT NULL::"uuid", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from public.badge_definitions where badge_key = p_badge_key and is_active = true) then
    return;
  end if;

  insert into public.user_badges (user_id, badge_key, awarded_by, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, p_badge_key, p_actor_user_id, p_award_source, p_award_reason, p_evidence_type, p_evidence_id, 'public'
  where not exists (
    select 1 from public.user_badges ub
    where ub.user_id = p_target_user_id and ub.badge_key = p_badge_key and ub.revoked_at is null
  );

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (p_actor_user_id, p_target_user_id, 'badge_granted', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_source', p_award_source, 'award_reason', p_award_reason));
end;
$$;


ALTER FUNCTION "public"."award_badge_if_missing"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_source" "text", "p_award_reason" "text", "p_evidence_type" "text", "p_evidence_id" "uuid", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_free_member_badges"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  profile_row record;
  granted_count integer := 0;
  had_badge boolean;
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    raise exception 'Only administrators can backfill Free Member badges.';
  end if;

  for profile_row in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
  loop
    select exists (
      select 1 from public.user_badges ub
      where ub.user_id = profile_row.id
        and ub.badge_key = 'free_member'
        and ub.revoked_at is null
    ) into had_badge;

    perform public.grant_free_member_for_user(profile_row.id);

    if not had_badge then
      granted_count := granted_count + 1;
    end if;
  end loop;

  return granted_count;
end;
$$;


ALTER FUNCTION "public"."backfill_free_member_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_review_work_with_requests"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_user_can_review_domain('work_with'::public.review_domain);
$$;


ALTER FUNCTION "public"."can_review_work_with_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("vote_post_id" "uuid", "option_id" "uuid", "ballot_count" bigint, "total_ballots" bigint, "percentage" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with visible_options as (
    select o.vote_post_id, o.id as option_id
    from public.commune_vote_options o
    join public.commune_vote_posts v on v.post_id = o.vote_post_id
    join public.commune_posts p on p.id = v.post_id
    where (target_vote_post_ids is null or o.vote_post_id = any(target_vote_post_ids))
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
      and (
        public.current_user_is_admin()
        or public.current_user_can_review_domain('commune'::public.review_domain)
        or v.results_visibility = 'always'
        or (v.results_visibility = 'after_close' and v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived'))
        or (v.results_visibility = 'after_vote' and (v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived') or exists (select 1 from public.commune_vote_ballots own_ballot where own_ballot.vote_post_id = v.post_id and own_ballot.voter_user_id = auth.uid())))
      )
  ),
  counts as (
    select vo.vote_post_id, vo.option_id, count(b.id)::bigint as ballot_count
    from visible_options vo
    left join public.commune_vote_ballots b on b.vote_post_id = vo.vote_post_id and b.option_id = vo.option_id
    group by vo.vote_post_id, vo.option_id
  )
  select c.vote_post_id, c.option_id, c.ballot_count, sum(c.ballot_count) over (partition by c.vote_post_id)::bigint as total_ballots,
    case when sum(c.ballot_count) over (partition by c.vote_post_id) = 0 then 0 else round((c.ballot_count::numeric / sum(c.ballot_count) over (partition by c.vote_post_id)::numeric) * 100, 2) end as percentage
  from counts c
  order by c.vote_post_id, c.option_id;
$$;


ALTER FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[]) IS 'Aggregate-only Community Voting Room result summary. Returns counts and percentages without voter identities.';



CREATE OR REPLACE FUNCTION "public"."create_badge_credit_event"("p_target_user_id" "uuid", "p_credit_type" "text", "p_credit_amount" integer, "p_contribution_type" "text", "p_contribution_id" "uuid" DEFAULT NULL::"uuid", "p_review_item_id" "uuid" DEFAULT NULL::"uuid", "p_is_major" boolean DEFAULT false, "p_distinct_subject_key" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
  created_id uuid;
begin
  if actor is null or not public.current_user_can_create_badge_credit() then
    raise exception 'Only authorized reviewers or administrators can create badge credits.';
  end if;
  if p_target_user_id = actor and not public.current_user_is_admin() then
    raise exception 'Reviewers cannot award badge credits to themselves.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, review_item_id, awarded_by, is_major, distinct_subject_key, notes)
  values (p_target_user_id, p_credit_type, greatest(1, least(coalesce(p_credit_amount, 1), 2)), p_contribution_type, p_contribution_id, p_review_item_id, actor, coalesce(p_is_major, false), p_distinct_subject_key, p_notes)
  returning id into created_id;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'credit_created', created_id, p_contribution_type, p_contribution_id, jsonb_build_object('credit_type', p_credit_type, 'credit_amount', p_credit_amount, 'is_major', p_is_major));

  perform public.evaluate_badges_for_user(p_target_user_id);
  return created_id;
end;
$$;


ALTER FUNCTION "public"."create_badge_credit_event"("p_target_user_id" "uuid", "p_credit_type" "text", "p_credit_amount" integer, "p_contribution_type" "text", "p_contribution_id" "uuid", "p_review_item_id" "uuid", "p_is_major" boolean, "p_distinct_subject_key" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_can_create_badge_credit"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_user_is_admin()
    or public.current_user_has_role('reviewer'::public.app_role)
    or public.current_user_has_role('guardian_reviewer'::public.app_role)
    or public.current_user_has_role('source_reviewer'::public.app_role)
    or public.current_user_has_role('marketplace_reviewer'::public.app_role)
    or public.current_user_has_role('moderator'::public.app_role)
    or public.current_user_has_role('commune_moderator'::public.app_role);
$$;


ALTER FUNCTION "public"."current_user_can_create_badge_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_can_review_domain"("target_domain" "public"."review_domain") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_user_is_admin()
    or case target_domain
      when 'work_with' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'stewardship' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'contribution' then public.current_user_has_role('reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'commune' then public.current_user_has_role('moderator') or public.current_user_has_role('commune_moderator') or public.current_user_has_role('guardian_reviewer')
      when 'living_library_source' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('guardian_reviewer')
      when 'living_library_broken_link' then public.current_user_has_role('source_reviewer') or public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('moderator') or public.current_user_has_role('guardian_reviewer')
      when 'marketplace' then public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer')
      else false
    end;
$$;


ALTER FUNCTION "public"."current_user_can_review_domain"("target_domain" "public"."review_domain") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_role"("required_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.has_role(auth.uid(), required_role);
$$;


ALTER FUNCTION "public"."current_user_has_role"("required_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.has_role(auth.uid(), 'administrator'::public.app_role)
    or coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."current_user_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decide_commune_code_revision_proposal"("p_proposal_id" "uuid", "p_decision" "text", "p_decision_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_next_version integer;
  v_status text := lower(trim(coalesce(p_decision, '')));
  v_is_troubleshooting boolean := false;
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception 'Authentication required to decide a code proposal.';
  end if;

  if v_status not in ('accepted', 'rejected', 'needs_changes', 'hidden_by_moderation') then
    raise exception 'Unsupported code proposal decision.';
  end if;

  select
    proposal.*,
    post.title as post_title,
    post.post_type,
    snippet.accepted_version_number as current_version
  into v_row
  from public.commune_code_revision_proposals proposal
  join public.commune_posts post on post.id = proposal.post_id
  join public.commune_code_snippets snippet on snippet.id = proposal.code_snippet_id
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Code proposal not found.';
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting';
  if v_is_troubleshooting then
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  if v_status = 'hidden_by_moderation' then
    if not public.current_user_can_review_domain('commune'::public.review_domain) then
      raise exception 'Moderator authority is required to hide a code proposal.';
    end if;
  elsif v_row.original_author_user_id <> v_actor then
    raise exception 'Only the original post author can accept, reject, or request changes on this proposal.';
  end if;

  if v_row.proposal_status not in ('submitted', 'needs_changes') then
    raise exception 'Only submitted proposals can be decided.';
  end if;

  if v_status = 'accepted' then
    v_next_version := coalesce(v_row.current_version, 1) + 1;

    update public.commune_code_snippets
      set code_text = v_row.proposed_code_text,
          language = v_row.language,
          file_name = v_row.file_name,
          accepted_revision_id = v_row.id,
          accepted_version_number = v_next_version,
          accepted_revision_proposer_user_id = v_row.proposer_user_id,
          accepted_revision_summary = v_row.change_summary,
          accepted_at = now(),
          updated_at = now()
      where id = v_row.code_snippet_id;

    update public.commune_code_revision_proposals
      set proposal_status = 'accepted',
          accepted_version_number = v_next_version,
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
        set troubleshooting_status = 'resolved',
            accepted_proposal_id = p_proposal_id,
            accepted_resolution_kind = 'proposal',
            accepted_summary = v_row.change_summary,
            accepted_by = v_actor,
            accepted_at = now(),
            resolved_at = now(),
            updated_at = now()
        where post_id = v_row.post_id;
    end if;
  elsif v_status = 'hidden_by_moderation' then
    update public.commune_code_revision_proposals
      set proposal_status = 'hidden_by_moderation',
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          hidden_at = now(),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;
  else
    update public.commune_code_revision_proposals
      set proposal_status = v_status,
          decision_by = v_actor,
          decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
        set troubleshooting_status = case when v_status = 'needs_changes' then 'needs_information' else 'in_progress' end,
            updated_at = now()
        where post_id = v_row.post_id
          and troubleshooting_status not in ('resolved', 'closed', 'archived');
    end if;
  end if;

  if v_row.proposer_user_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.proposer_user_id,
      case
        when v_is_troubleshooting then 'commune_troubleshooting_fix_' || v_status
        else 'commune_code_revision_' || v_status
      end,
      'commune_code_revision_proposal',
      p_proposal_id,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'Your Troubleshooting Grove fix was accepted'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'Changes requested on your Troubleshooting Grove fix'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A Troubleshooting Grove proposed fix was hidden by moderation'
        when v_is_troubleshooting then 'Your Troubleshooting Grove fix was rejected'
        when v_status = 'accepted' then 'Your Coding Cornucopia revision was accepted'
        when v_status = 'needs_changes' then 'Changes requested on your Coding Cornucopia revision'
        when v_status = 'hidden_by_moderation' then 'A Coding Cornucopia proposal was hidden by moderation'
        else 'Your Coding Cornucopia revision was rejected'
      end,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'The original post author accepted your proposed fix. The public reproduction snippet now points to the accepted snapshot.'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'The original post author asked for changes. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A moderator hid this proposed fix for safety review. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting then 'The original post author rejected the proposed fix. The public reproduction snippet remains unchanged.'
        when v_status = 'accepted' then 'The original post author accepted your revision. The public attached code now points to the accepted snapshot.'
        when v_status = 'needs_changes' then 'The original post author asked for changes. The public attached code remains unchanged.'
        when v_status = 'hidden_by_moderation' then 'A moderator hid this proposal for safety review. The public attached code remains unchanged.'
        else 'The original post author rejected the proposal. The public attached code remains unchanged.'
      end,
      v_review_path || '?proposal=' || p_proposal_id::text
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."decide_commune_code_revision_proposal"("p_proposal_id" "uuid", "p_decision" "text", "p_decision_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_badges_for_user"("p_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
  credit record;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_can_create_badge_credit() then
    raise exception 'Badge evaluation is limited to the profile owner or authorized reviewers.';
  end if;

  if exists (select 1 from public.profiles where id = p_target_user_id) then
    perform public.award_badge_if_missing(p_target_user_id, 'free_member', 'automatic', 'Commons Profile completed.', 'commons_profile', p_target_user_id, actor);
  end if;

  if exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and revoked_at is null and credit_type <> 'account_membership') then
    perform public.award_badge_if_missing(p_target_user_id, 'seed_sower', 'credit_rule', 'First approved contribution recorded.', 'badge_rule', null, actor);
  end if;

  for credit in select * from (values
    ('stewardship_supporter','stewardship_general',1,null::integer,false,null::integer,'Approved stewardship support verification.'),
    ('water_steward','stewardship_water',3,null::integer,true,null::integer,'Approved water stewardship credits.'),
    ('forest_steward','stewardship_forest',3,null::integer,true,null::integer,'Approved forest stewardship credits.'),
    ('reef_steward','stewardship_reef',3,null::integer,true,null::integer,'Approved reef/ocean stewardship credits.'),
    ('health_steward','stewardship_health',3,null::integer,true,null::integer,'Approved health stewardship credits.'),
    ('knowledge_commons_supporter','knowledge_support',2,null::integer,true,null::integer,'Approved knowledge commons support credits.'),
    ('source_curator','source_curation',3,null::integer,true,null::integer,'Accepted Living Library source curation credits.'),
    ('troubleshooting_helper','troubleshooting_resolution',3,null::integer,false,2,'Reviewed helpful troubleshooting resolutions.'),
    ('developer_contributor','developer_contribution',3,null::integer,true,null::integer,'Approved developer contribution credits.'),
    ('bridge_builder','bridge_building',5,null::integer,false,3,'Reviewed bridge-building credits.'),
    ('archive_warden','archive_maintenance',5,null::integer,true,null::integer,'Approved archive and documentation maintenance credits.'),
    ('forge_tester','testing_feedback',3,null::integer,true,null::integer,'Accepted testing and release feedback credits.'),
    ('field_witness','field_observation',3,null::integer,true,null::integer,'Accepted field observation credits.'),
    ('radiant_scribe','writing_teaching',null::integer,4,true,null::integer,'Approved writing and teaching credits.'),
    ('elysian_artwright','art_contribution',null::integer,3,true,null::integer,'Accepted art contribution credits.'),
    ('open_pathmaker','accessibility_improvement',3,null::integer,true,null::integer,'Approved accessibility and usability improvement credits.'),
    ('boundary_lantern','boundary_safety',2,null::integer,true,null::integer,'Approved privacy, consent, safety, or boundary improvement credits.')
  ) as rule(badge_key, credit_type, required_count, required_sum, major_shortcut, distinct_min, reason) loop
    if (
      (credit.required_count is not null and (select count(*) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_count)
      or (credit.required_sum is not null and (select coalesce(sum(credit_amount), 0) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_sum)
      or (credit.major_shortcut and exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and is_major = true and revoked_at is null))
    ) and (
      credit.distinct_min is null
      or (select count(distinct distinct_subject_key) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null and distinct_subject_key is not null) >= credit.distinct_min
    ) then
      perform public.award_badge_if_missing(p_target_user_id, credit.badge_key, 'credit_rule', credit.reason, 'badge_rule', null, actor);
    end if;
  end loop;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, metadata)
  values (actor, p_target_user_id, 'rule_evaluated', jsonb_build_object('source', 'evaluate_badges_for_user'));
end;
$$;


ALTER FUNCTION "public"."evaluate_badges_for_user"("p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_free_member_for_user"("p_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
  inserted_badge_id uuid;
  inserted_credit_id uuid;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_is_admin() then
    raise exception 'Only the profile owner or an administrator can initialize Free Member recognition.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_target_user_id
  ) then
    raise exception 'A Website Account with a Commons Profile is required before Free Member recognition.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, is_major, notes)
  select p_target_user_id, 'account_membership', 1, 'commons_profile', p_target_user_id, actor, false, 'Free membership recognition for a completed Commons profile.'
  where to_regclass('public.badge_credit_events') is not null
    and not exists (
      select 1
      from public.badge_credit_events bce
      where bce.user_id = p_target_user_id
        and bce.credit_type = 'account_membership'
        and bce.contribution_type = 'commons_profile'
        and bce.contribution_id = p_target_user_id
        and bce.revoked_at is null
    )
  returning id into inserted_credit_id;

  insert into public.user_badges (user_id, badge_key, awarded_by, awarded_at, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, 'free_member', actor, now(), 'automatic', 'Free membership recognition for a completed Commons profile.', 'commons_profile', p_target_user_id, 'public'
  where not exists (
    select 1
    from public.user_badges ub
    where ub.user_id = p_target_user_id
      and ub.badge_key = 'free_member'
      and ub.revoked_at is null
  )
  returning id into inserted_badge_id;

  if inserted_badge_id is not null and to_regclass('public.badge_audit_log') is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, credit_event_id, evidence_type, evidence_id, metadata)
    values (actor, p_target_user_id, 'free_member_granted', 'free_member', inserted_credit_id, 'commons_profile', p_target_user_id, jsonb_build_object('award_source', 'automatic'));
  end if;
end;
$$;


ALTER FUNCTION "public"."grant_free_member_for_user"("p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_reason" "text" DEFAULT NULL::"text", "p_evidence_type" "text" DEFAULT NULL::"text", "p_evidence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can manually grant badges.';
  end if;
  if p_target_user_id = actor then
    raise exception 'Administrators should not manually grant badges to themselves through the public client.';
  end if;

  perform public.award_badge_if_missing(p_target_user_id, p_badge_key, 'manual_admin', p_award_reason, p_evidence_type, p_evidence_id, actor);
  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'manual_grant', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_reason', p_award_reason));
end;
$$;


ALTER FUNCTION "public"."grant_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_reason" "text", "p_evidence_type" "text", "p_evidence_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("target_user_id" "uuid", "required_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = target_user_id
      and ur.role = required_role
      and ur.revoked_at is null
  );
$$;


ALTER FUNCTION "public"."has_role"("target_user_id" "uuid", "required_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_marketplace_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_marketplace_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_commune_published_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    begin
      insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
      select distinct
        target_user_id,
        'commune_thread_reply',
        'commune_comment',
        new.id,
        'New published Commune reply',
        'A followed Commune thread has a newly published reply.',
        '/commune/posts/' || coalesce(new.post_id::text, '')
      from (
        select follow.user_id as target_user_id
        from public.user_followed_commune_threads follow
        where follow.thread_id = new.thread_id
          and follow.user_id <> new.user_id
          and coalesce(follow.muted, false) = false
        union
        select post.user_id as target_user_id
        from public.commune_posts post
        where post.id = new.post_id
          and post.user_id <> new.user_id
      ) targets
      where target_user_id is not null;
    exception when others then
      raise notice 'Commune published-comment notification skipped: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_commune_published_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_locked_addon_draft_child_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_draft_id uuid;
begin
  if tg_op = 'DELETE' then
    target_draft_id := old.addon_draft_id;
  else
    target_draft_id := new.addon_draft_id;
  end if;

  if exists (
    select 1
    from public.addon_drafts d
    where d.id = target_draft_id
      and d.locked_at is not null
      and d.owner_user_id = auth.uid()
      and not public.current_user_can_review_domain('marketplace'::public.review_domain)
  ) then
    raise exception 'Submitted Developer Forge draft evidence is locked. Duplicate the draft for a revision before changing package, permission, validation, or compatibility records.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_locked_addon_draft_child_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_locked_addon_draft_owner_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.locked_at is not null
     and old.owner_user_id = auth.uid()
     and not public.current_user_can_review_domain('marketplace'::public.review_domain) then
    raise exception 'Submitted Developer Forge drafts are locked. Duplicate the draft for a revision before editing.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_locked_addon_draft_owner_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_commune_sandbox_run_result"("p_snapshot_id" "text", "p_source_type" "text", "p_source_id" "text", "p_post_id" "uuid", "p_code_document_id" "uuid", "p_code_version_id" "uuid", "p_language" "text", "p_file_name" "text", "p_status" "text", "p_request_payload" "jsonb", "p_result_summary" "jsonb", "p_stdout_preview" "text", "p_stderr_preview" "text", "p_exit_code" integer, "p_duration_ms" integer, "p_diagnostics" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_run_id uuid;
  v_status text := coalesce(nullif(trim(p_status), ''), 'failed');
  v_diag jsonb;
  v_severity text;
  v_phase text;
  v_category text;
  v_line integer;
  v_column integer;
begin
  if v_actor is null then
    raise exception 'Authentication required to record a Coding Cornucopia sandbox result.';
  end if;

  if v_status not in ('draft','requested','queued','running','completed','failed','denied','policy_blocked','sandbox_unavailable') then
    v_status := 'failed';
  end if;

  insert into public.commune_sandbox_runs (
    requester_user_id,
    post_id,
    code_document_id,
    code_version_id,
    source_type,
    source_id,
    snapshot_id,
    language,
    file_name,
    status,
    request_payload,
    result_summary,
    stdout_preview,
    stderr_preview,
    exit_code,
    duration_ms,
    public_visibility,
    completed_at,
    updated_at
  )
  values (
    v_actor,
    p_post_id,
    p_code_document_id,
    p_code_version_id,
    coalesce(nullif(trim(p_source_type), ''), 'manual'),
    nullif(trim(coalesce(p_source_id, '')), ''),
    coalesce(nullif(trim(p_snapshot_id), ''), 'unknown-snapshot'),
    coalesce(nullif(trim(p_language), ''), 'text'),
    nullif(trim(coalesce(p_file_name, '')), ''),
    v_status,
    coalesce(p_request_payload, '{}'::jsonb),
    coalesce(p_result_summary, '{}'::jsonb),
    left(coalesce(p_stdout_preview, ''), 4000),
    left(coalesce(p_stderr_preview, ''), 4000),
    p_exit_code,
    p_duration_ms,
    'private',
    case when v_status in ('completed','failed','denied','policy_blocked','sandbox_unavailable') then now() else null end,
    now()
  )
  returning id into v_run_id;

  if jsonb_typeof(coalesce(p_diagnostics, '[]'::jsonb)) = 'array' then
    for v_diag in select value from jsonb_array_elements(p_diagnostics) limit 80 loop
      v_severity := coalesce(v_diag ->> 'severity', 'info');
      if v_severity not in ('info','warning','error') then v_severity := 'info'; end if;

      v_phase := coalesce(v_diag ->> 'phase', 'sandbox');
      if v_phase not in ('static','policy','runtime','sandbox','security') then v_phase := 'sandbox'; end if;

      v_category := coalesce(v_diag ->> 'category', 'policy_info');
      v_line := case when coalesce(v_diag ->> 'line', '') ~ '^[0-9]+$' then (v_diag ->> 'line')::integer else null end;
      v_column := case when coalesce(v_diag ->> 'column', '') ~ '^[0-9]+$' then (v_diag ->> 'column')::integer else null end;

      insert into public.commune_code_diagnostics (
        run_id,
        post_id,
        code_document_id,
        code_version_id,
        severity,
        phase,
        category,
        language,
        file_name,
        line_number,
        column_number,
        message,
        source,
        public_visibility
      )
      values (
        v_run_id,
        p_post_id,
        p_code_document_id,
        p_code_version_id,
        v_severity,
        v_phase,
        left(v_category, 80),
        coalesce(nullif(trim(p_language), ''), v_diag ->> 'language', 'text'),
        nullif(trim(coalesce(p_file_name, v_diag ->> 'file', '')), ''),
        v_line,
        v_column,
        left(coalesce(v_diag ->> 'message', 'Sandbox diagnostic.'), 2000),
        left(coalesce(v_diag ->> 'source', 'Coding Cornucopia sandbox'), 160),
        'private'
      );
    end loop;
  end if;

  return v_run_id;
end;
$_$;


ALTER FUNCTION "public"."record_commune_sandbox_run_result"("p_snapshot_id" "text", "p_source_type" "text", "p_source_id" "text", "p_post_id" "uuid", "p_code_document_id" "uuid", "p_code_version_id" "uuid", "p_language" "text", "p_file_name" "text", "p_status" "text", "p_request_payload" "jsonb", "p_result_summary" "jsonb", "p_stdout_preview" "text", "p_stderr_preview" "text", "p_exit_code" integer, "p_duration_ms" integer, "p_diagnostics" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_badge_credit_event"("p_credit_event_id" "uuid", "p_revoked_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badge credits.';
  end if;

  update public.badge_credit_events
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason
  where id = p_credit_event_id and revoked_at is null
  returning user_id into target_id;

  if target_id is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, metadata)
    values (actor, target_id, 'credit_revoked', p_credit_event_id, jsonb_build_object('revoked_reason', p_revoked_reason));
    perform public.evaluate_badges_for_user(target_id);
  end if;
end;
$$;


ALTER FUNCTION "public"."revoke_badge_credit_event"("p_credit_event_id" "uuid", "p_revoked_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_revoked_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badges.';
  end if;

  update public.user_badges
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason, updated_at = now()
  where user_id = p_target_user_id and badge_key = p_badge_key and revoked_at is null;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, metadata)
  values (actor, p_target_user_id, 'badge_revoked', p_badge_key, jsonb_build_object('revoked_reason', p_revoked_reason));
end;
$$;


ALTER FUNCTION "public"."revoke_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_revoked_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_commune_post"("target_post_id" "uuid", "moderation_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_target_post_id uuid := target_post_id;
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_post record;
  v_post_type text;
  v_saved_rows integer := 0;
  v_legacy_saved_rows integer := 0;
  v_notification_rows integer := 0;
  v_followed_rows integer := 0;
  v_reaction_rows integer := 0;
  v_comment_rows integer := 0;
  v_media_rows integer := 0;
  v_upload_rows integer := 0;
  v_code_proposal_rows integer := 0;
  v_troubleshooting_rows integer := 0;
  v_research_rows integer := 0;
  v_job_rows integer := 0;
  v_repository_rows integer := 0;
  v_iteration_rows integer := 0;
  v_official_rows integer := 0;
  v_official_code_rows integer := 0;
  v_vote_rows integer := 0;
begin
  if v_actor is null then
    raise exception 'Sign in before deleting Commune posts.' using errcode = '28000';
  end if;

  if not public.current_user_can_review_domain('commune'::public.review_domain) then
    raise exception 'Commune soft-delete cleanup requires a Commune moderator/admin role.' using errcode = '42501';
  end if;

  select p.id, p.status, p.post_type
    into v_post
    from public.commune_posts p
    where p.id = v_target_post_id
    for update;

  if not found then
    raise exception 'Commune post % was not found for soft-delete cleanup.', v_target_post_id using errcode = 'P0002';
  end if;

  v_post_type := v_post.post_type::text;

  update public.commune_posts
     set status = 'removed_by_moderator',
         visibility = 'private_draft',
         visibility_state = 'removed',
         moderation_status = 'soft_deleted_by_moderator',
         moderation_reason = moderation_note,
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         removed_at = coalesce(removed_at, v_now),
         updated_at = v_now,
         last_activity_at = v_now
   where id = v_target_post_id;

  delete from public.user_saved_commune_posts
   where post_id = v_target_post_id;
  get diagnostics v_saved_rows = row_count;

  delete from public.commune_saved_posts
   where post_id = v_target_post_id;
  get diagnostics v_legacy_saved_rows = row_count;

  delete from public.user_followed_commune_threads followed
  using public.commune_threads thread
   where followed.thread_id = thread.id
     and thread.post_id = v_target_post_id;
  get diagnostics v_followed_rows = row_count;

  delete from public.commune_content_reactions reaction
   where (reaction.target_type = 'post' and reaction.target_id = v_target_post_id)
      or (
        reaction.target_type = 'comment'
        and exists (
          select 1
          from public.commune_comments comment
          where comment.id = reaction.target_id
            and comment.post_id = v_target_post_id
        )
      );
  get diagnostics v_reaction_rows = row_count;

  update public.commune_comments
     set status = case when status in ('removed_by_moderator', 'deleted_by_user', 'archived') then status else 'removed_by_moderator' end,
         visibility_state = 'removed',
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         removed_at = coalesce(removed_at, v_now),
         updated_at = v_now,
         moderation_reason = coalesce(moderation_reason, moderation_note)
   where post_id = v_target_post_id
     and (visibility_state is distinct from 'removed' or status not in ('removed_by_moderator', 'deleted_by_user', 'archived'));
  get diagnostics v_comment_rows = row_count;

  update public.commune_media
     set visibility_state = 'removed',
         updated_at = v_now
   where post_id = v_target_post_id
     and visibility_state in ('submitted', 'published', 'flagged', 'hidden');
  get diagnostics v_media_rows = row_count;

  update public.commune_uploads
     set status = 'removed_by_moderator',
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         moderation_reason = coalesce(moderation_reason, moderation_note)
   where post_id = v_target_post_id
     and status in ('pending_review', 'approved', 'published', 'hidden', 'archived');
  get diagnostics v_upload_rows = row_count;

  if v_post_type in ('code_sharing', 'troubleshooting') then
    update public.commune_code_revision_proposals
       set proposal_status = 'hidden_by_moderation',
           hidden_at = coalesce(hidden_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and proposal_status <> 'hidden_by_moderation';
    get diagnostics v_code_proposal_rows = row_count;
  end if;

  if v_post_type = 'troubleshooting' then
    update public.commune_troubleshooting_posts
       set troubleshooting_status = 'archived',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and troubleshooting_status <> 'archived';
    get diagnostics v_troubleshooting_rows = row_count;
  end if;

  if v_post_type = 'research_note' then
    update public.commune_research_notes
       set review_status = 'archived',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and review_status <> 'archived';
    get diagnostics v_research_rows = row_count;
  end if;

  if v_post_type = 'job_post' then
    update public.commune_job_posts
       set application_status = 'archived',
           anti_scam_review_status = 'removed',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and (application_status <> 'archived' or anti_scam_review_status <> 'removed');
    get diagnostics v_job_rows = row_count;
  end if;

  if v_post_type = 'repository_showcase' then
    -- status and updated_at are the canonical repository-sidecar columns.
    update public.commune_repository_showcases
       set status = 'rejected',
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_repository_rows = row_count;
  end if;

  if v_post_type = 'elysia_iteration_showcase' then
    update public.commune_iteration_showcases
       set status = 'rejected',
           sandbox_review_status = case when sandbox_review_status is null or sandbox_review_status = 'not_requested' then sandbox_review_status else 'archived' end,
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_iteration_rows = row_count;
  end if;

  if v_post_type = 'official_update' then
    update public.commune_official_updates
       set official_status = 'archived',
           correction_status = 'retracted',
           archived_at = coalesce(archived_at, v_now),
           retracted_at = coalesce(retracted_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_official_rows = row_count;

    update public.commune_official_update_code_snippets
       set public_visible = false,
           edited_by = v_actor,
           edited_at = coalesce(edited_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and public_visible = true;
    get diagnostics v_official_code_rows = row_count;
  end if;

  if v_post_type = 'community_vote' then
    update public.commune_vote_posts
       set vote_status = 'archived',
           updated_at = v_now
     where post_id = v_target_post_id
       and vote_status <> 'archived';
    get diagnostics v_vote_rows = row_count;
  end if;

  delete from public.user_notifications notification
   where notification.action_url like '%/commune/posts/' || v_target_post_id::text || '%'
      or (
        notification.source_id = v_target_post_id
        and lower(coalesce(notification.source_type, '')) in (
          'commune_post',
          'commune_posts',
          'post',
          'community_vote',
          'commune_vote_post',
          'commune_vote_posts'
        )
      )
      or (
        exists (select 1 from public.commune_comments comment where comment.id = notification.source_id and comment.post_id = v_target_post_id)
        and lower(coalesce(notification.source_type, '')) in ('commune_comment', 'commune_comments', 'comment')
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_troubleshooting_post', 'commune_troubleshooting_posts', 'troubleshooting', 'troubleshooting_grove')
        and exists (select 1 from public.commune_troubleshooting_posts sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_research_note', 'commune_research_notes', 'research_note', 'research_notes')
        and exists (select 1 from public.commune_research_notes sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_job_post', 'commune_job_posts', 'job_post', 'job_posts')
        and exists (select 1 from public.commune_job_posts sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_repository_showcase', 'commune_repository_showcases', 'repository_showcase')
        and exists (select 1 from public.commune_repository_showcases sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_iteration_showcase', 'commune_iteration_showcases', 'elysia_iteration_showcase')
        and exists (select 1 from public.commune_iteration_showcases sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_official_update', 'commune_official_updates', 'official_update')
        and exists (select 1 from public.commune_official_updates sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_code_revision_proposal', 'commune_code_revision_proposals', 'code_revision_proposal')
        and exists (select 1 from public.commune_code_revision_proposals sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      );
  get diagnostics v_notification_rows = row_count;

  insert into public.commune_moderation_events (
    actor_id,
    target_type,
    target_id,
    action,
    from_status,
    to_status,
    reason,
    metadata
  )
  values (
    v_actor,
    'post',
    v_target_post_id,
    'soft_delete_from_public',
    v_post.status::text,
    'removed_by_moderator',
    moderation_note,
    jsonb_build_object(
      'source', 'soft_delete_commune_post',
      'public_content_removed', true,
      'hard_delete', false,
      'post_type', v_post_type,
      'saved_rows_deleted', v_saved_rows,
      'legacy_saved_rows_deleted', v_legacy_saved_rows,
      'notifications_deleted', v_notification_rows,
      'followed_thread_rows_deleted', v_followed_rows,
      'reaction_rows_deleted', v_reaction_rows,
      'comment_rows_removed', v_comment_rows,
      'media_rows_removed', v_media_rows,
      'upload_rows_removed', v_upload_rows,
      'code_proposal_rows_hidden', v_code_proposal_rows,
      'troubleshooting_rows_archived', v_troubleshooting_rows,
      'research_rows_archived', v_research_rows,
      'job_rows_archived', v_job_rows,
      'repository_rows_rejected', v_repository_rows,
      'iteration_rows_rejected', v_iteration_rows,
      'official_rows_archived', v_official_rows,
      'official_code_rows_hidden', v_official_code_rows,
      'vote_rows_archived', v_vote_rows,
      'audit_preserved', jsonb_build_array('commune_reports', 'commune_abuse_reports', 'commune_moderation_events', 'review_items', 'review_events', 'commune_vote_options', 'commune_vote_ballots', 'commune_vote_events')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'post_id', v_target_post_id,
    'status', 'removed_by_moderator',
    'saved_rows_deleted', v_saved_rows,
    'legacy_saved_rows_deleted', v_legacy_saved_rows,
    'notifications_deleted', v_notification_rows,
    'followed_thread_rows_deleted', v_followed_rows,
    'reaction_rows_deleted', v_reaction_rows,
    'comment_rows_removed', v_comment_rows,
    'media_rows_removed', v_media_rows,
    'upload_rows_removed', v_upload_rows,
    'code_proposal_rows_hidden', v_code_proposal_rows,
    'sidecars_removed_from_public', jsonb_build_object(
      'troubleshooting', v_troubleshooting_rows,
      'research_notes', v_research_rows,
      'job_posts', v_job_rows,
      'repository_showcase', v_repository_rows,
      'elysia_iteration_showcase', v_iteration_rows,
      'official_update', v_official_rows,
      'community_vote', v_vote_rows
    )
  );
end;
$$;


ALTER FUNCTION "public"."soft_delete_commune_post"("target_post_id" "uuid", "moderation_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."soft_delete_commune_post"("target_post_id" "uuid", "moderation_note" "text") IS 'Atomically soft-deletes one Commune parent post, scopes sidecar suppression to that post type, removes normal user-facing pointers, and preserves moderation and vote audit history.';



CREATE OR REPLACE FUNCTION "public"."submit_commune_code_revision_proposal"("p_post_id" "uuid", "p_code_snippet_id" "uuid", "p_proposed_code_text" "text", "p_language" "text", "p_file_name" "text", "p_change_summary" "text", "p_explanation" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_proposal_id uuid;
  v_is_troubleshooting boolean := false;
  v_room_label text := 'Coding Cornucopia';
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception 'Authentication required to propose a code revision or troubleshooting fix.';
  end if;

  if char_length(coalesce(p_proposed_code_text, '')) > 100000 then
    raise exception 'Proposed code exceeds the 100000 character limit.';
  end if;

  if char_length(trim(coalesce(p_change_summary, ''))) = 0 then
    raise exception 'A change summary is required for code revision proposals and troubleshooting fixes.';
  end if;

  select
    s.id as snippet_id,
    s.post_id,
    s.code_text,
    s.language as current_language,
    s.file_name as current_file_name,
    coalesce(s.accepted_version_number, 1) as accepted_version_number,
    p.user_id as post_author_id,
    p.title as post_title,
    p.post_type
  into v_row
  from public.commune_code_snippets s
  join public.commune_posts p on p.id = s.post_id
  where s.id = p_code_snippet_id
    and s.post_id = p_post_id
    and p.status = 'published'
    and p.visibility = 'public';

  if not found or v_row.post_author_id is null then
    raise exception 'This public code snippet is not available for proposals.';
  end if;

  if v_row.post_type not in ('code_sharing', 'troubleshooting') then
    raise exception 'Only Coding Cornucopia and Troubleshooting Grove snippets accept public proposals.';
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting';
  if v_is_troubleshooting then
    v_room_label := 'Troubleshooting Grove';
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  insert into public.commune_code_revision_proposals (
    post_id,
    code_snippet_id,
    proposer_user_id,
    original_author_user_id,
    base_code_text,
    proposed_code_text,
    language,
    file_name,
    change_summary,
    explanation,
    base_snapshot_label,
    proposal_status
  )
  values (
    p_post_id,
    p_code_snippet_id,
    v_actor,
    v_row.post_author_id,
    v_row.code_text,
    p_proposed_code_text,
    nullif(trim(coalesce(p_language, v_row.current_language, 'text')), ''),
    nullif(trim(coalesce(p_file_name, v_row.current_file_name, 'snippet')), ''),
    trim(p_change_summary),
    nullif(trim(coalesce(p_explanation, '')), ''),
    'current accepted snapshot v' || v_row.accepted_version_number::text,
    'submitted'
  )
  returning id into v_proposal_id;

  if v_is_troubleshooting then
    update public.commune_troubleshooting_posts
      set troubleshooting_status = case
          when troubleshooting_status in ('resolved', 'closed', 'archived') then troubleshooting_status
          else 'fix_proposed'
        end,
        updated_at = now()
      where post_id = p_post_id;
  end if;

  if v_row.post_author_id <> v_actor then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    values (
      v_row.post_author_id,
      case when v_is_troubleshooting then 'commune_troubleshooting_fix_proposed' else 'commune_code_revision_proposed' end,
      'commune_code_revision_proposal',
      v_proposal_id,
      case when v_is_troubleshooting then 'New Troubleshooting Grove proposed fix' else 'New Coding Cornucopia revision proposal' end,
      case
        when v_is_troubleshooting then 'A community member proposed a fix for "' || coalesce(v_row.post_title, 'your Troubleshooting Grove issue') || '". The public reproduction snippet will not change unless you accept it.'
        else 'A community member proposed a revision to "' || coalesce(v_row.post_title, 'your Coding Cornucopia post') || '". The public code will not change unless you accept it.'
      end,
      v_review_path || '?proposal=' || v_proposal_id::text
    );
  end if;

  return v_proposal_id;
end;
$$;


ALTER FUNCTION "public"."submit_commune_code_revision_proposal"("p_post_id" "uuid", "p_code_snippet_id" "uuid", "p_proposed_code_text" "text", "p_language" "text", "p_file_name" "text", "p_change_summary" "text", "p_explanation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_job_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_job_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_research_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_research_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_troubleshooting_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_troubleshooting_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_vote_ballots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_vote_ballots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_vote_options_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_vote_options_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_commune_vote_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_commune_vote_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_own_commune_job_post_application_status"("p_job_post_id" "uuid" DEFAULT NULL::"uuid", "p_post_id" "uuid" DEFAULT NULL::"uuid", "p_application_status" "text" DEFAULT 'open'::"text", "p_public_correction_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_status text := lower(regexp_replace(coalesce(p_application_status, 'open'), '[\s/-]+', '_', 'g'));
  v_now timestamptz := now();
begin
  if v_actor is null then
    raise exception 'Authentication required to update a Job Post listing status.';
  end if;

  if v_status not in ('open','reviewing','filled','closed','archived','needs_clarification') then
    raise exception 'Unsupported Job Post listing status: %', p_application_status;
  end if;

  select *
  into v_row
  from public.commune_job_posts
  where (p_job_post_id is not null and id = p_job_post_id)
     or (p_job_post_id is null and p_post_id is not null and post_id = p_post_id)
  limit 1;

  if not found or v_row.author_user_id <> v_actor then
    raise exception 'Only the Job Post author can update this listing status.';
  end if;

  update public.commune_job_posts
  set
    application_status = v_status,
    public_correction_note = p_public_correction_note,
    filled_at = case when v_status = 'filled' then v_now else filled_at end,
    closed_at = case when v_status = 'closed' then v_now else closed_at end,
    archived_at = case when v_status = 'archived' then v_now else archived_at end,
    updated_at = v_now
  where id = v_row.id;
end;
$$;


ALTER FUNCTION "public"."update_own_commune_job_post_application_status"("p_job_post_id" "uuid", "p_post_id" "uuid", "p_application_status" "text", "p_public_correction_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_own_commune_job_post_application_status"("p_job_post_id" "uuid", "p_post_id" "uuid", "p_application_status" "text", "p_public_correction_note" "text") IS 'Author-only status RPC for Job Post lifecycle fields. It does not update anti-scam review state or hidden reviewer notes.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addon_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_version_id" "uuid" NOT NULL,
    "action_key" "text" NOT NULL,
    "action_label" "text" NOT NULL,
    "action_kind" "text" NOT NULL,
    "allowed" boolean DEFAULT false NOT NULL,
    "risk_level" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "requires_local_operator_password" boolean DEFAULT true NOT NULL,
    "manifest_fragment" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."addon_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "action" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."addon_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_compatibility_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_draft_id" "uuid",
    "addon_package_id" "uuid",
    "elysia_version" "text",
    "addon_api_version" "text",
    "os" "text",
    "status" "text" NOT NULL,
    "warnings" "text"[] DEFAULT '{}'::"text"[],
    "errors" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_compatibility_results_status_check" CHECK (("status" = ANY (ARRAY['compatible'::"text", 'warning'::"text", 'incompatible'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."addon_compatibility_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_version_id" "uuid" NOT NULL,
    "ecosystem" "text" NOT NULL,
    "package_name" "text" NOT NULL,
    "version_constraint" "text",
    "required" boolean DEFAULT true NOT NULL,
    "source" "text"
);


ALTER TABLE "public"."addon_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_draft_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_draft_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "reason" "text",
    "scope_json" "jsonb" DEFAULT '{}'::"jsonb",
    "risk_acknowledged" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."addon_draft_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "developer_profile_id" "uuid",
    "addon_slug" "text",
    "addon_name" "text",
    "short_summary" "text",
    "long_description" "text",
    "version" "text",
    "license" "text",
    "homepage_url" "text",
    "source_url" "text",
    "support_url" "text",
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "icon_path" "text",
    "manifest_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "package_file_path" "text",
    "compatibility_targets" "jsonb" DEFAULT '{}'::"jsonb",
    "permission_summary" "text",
    "risk_level" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "validation_status" "text" DEFAULT 'not_validated'::"text" NOT NULL,
    "package_status" "text" DEFAULT 'not_uploaded'::"text" NOT NULL,
    "submission_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'not_submitted'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "locked_reason" "text",
    "source_submission_id" "uuid",
    "revision_of_draft_id" "uuid",
    CONSTRAINT "addon_drafts_package_status_check" CHECK (("package_status" = ANY (ARRAY['not_uploaded'::"text", 'metadata_only'::"text", 'uploaded'::"text", 'scan_warning'::"text", 'scan_blocked'::"text"]))),
    CONSTRAINT "addon_drafts_review_status_check" CHECK (("review_status" = ANY (ARRAY['not_submitted'::"text", 'pending'::"text", 'changes_requested'::"text", 'approved'::"text", 'rejected'::"text", 'security_hold'::"text", 'withdrawn'::"text", 'published'::"text"]))),
    CONSTRAINT "addon_drafts_submission_status_check" CHECK (("submission_status" = ANY (ARRAY['draft'::"text", 'validating'::"text", 'ready_to_submit'::"text", 'submitted'::"text", 'changes_requested'::"text", 'approved'::"text", 'published'::"text", 'rejected'::"text", 'withdrawn'::"text", 'archived'::"text", 'security_hold'::"text"]))),
    CONSTRAINT "addon_drafts_validation_status_check" CHECK (("validation_status" = ANY (ARRAY['not_validated'::"text", 'valid'::"text", 'warnings'::"text", 'errors'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."addon_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_draft_id" "uuid" NOT NULL,
    "version" "text",
    "storage_path" "text",
    "file_name" "text",
    "file_size" bigint,
    "sha256" "text",
    "package_format_version" "text" DEFAULT '0.1'::"text",
    "scan_status" "text" DEFAULT 'not_scanned'::"text" NOT NULL,
    "signature_status" "text" DEFAULT 'unsigned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive_inspection_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scan_summary" "text",
    CONSTRAINT "addon_packages_scan_status_check" CHECK (("scan_status" = ANY (ARRAY['not_scanned'::"text", 'passed'::"text", 'warning'::"text", 'blocked'::"text"]))),
    CONSTRAINT "addon_packages_signature_status_check" CHECK (("signature_status" = ANY (ARRAY['unsigned'::"text", 'pending'::"text", 'signed'::"text", 'signature_failed'::"text"])))
);


ALTER TABLE "public"."addon_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_permission_catalog" (
    "permission_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "risk_level" "text" NOT NULL,
    "requires_user_approval" boolean DEFAULT true NOT NULL,
    "requires_reviewer_approval" boolean DEFAULT false NOT NULL,
    "requires_local_runtime_gate" boolean DEFAULT true NOT NULL,
    "allowed_scope_format" "text",
    "examples" "text"[] DEFAULT '{}'::"text"[],
    "blocked_examples" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_permission_catalog_risk_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."addon_permission_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_version_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."addon_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_submission_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "draft_id" "uuid",
    "developer_user_id" "uuid",
    "manifest_snapshot" "jsonb" NOT NULL,
    "permissions_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "package_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "validation_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "scan_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "marketplace_preview_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "package_sha256" "text",
    "package_storage_bucket" "text",
    "package_storage_path" "text",
    "package_file_name" "text",
    "package_size_bytes" bigint,
    "signature_status" "text" DEFAULT 'unsigned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_submission_snapshots_signature_status_check" CHECK (("signature_status" = ANY (ARRAY['unsigned'::"text", 'checksum_only'::"text", 'pending'::"text", 'signed'::"text", 'signature_failed'::"text"])))
);


ALTER TABLE "public"."addon_submission_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_draft_id" "uuid" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "review_item_id" "uuid",
    "review_summary" "text",
    "reviewer_feedback" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'changes_requested'::"text", 'approved'::"text", 'rejected'::"text", 'security_hold'::"text", 'withdrawn'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."addon_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_validation_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_draft_id" "uuid" NOT NULL,
    "severity" "text" NOT NULL,
    "code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "field_path" "text",
    "fix_suggestion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_validation_results_severity_check" CHECK (("severity" = ANY (ARRAY['blocked'::"text", 'error'::"text", 'warning'::"text", 'needs_reviewer'::"text", 'info'::"text"])))
);


ALTER TABLE "public"."addon_validation_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_id" "uuid",
    "version" "text" NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "review_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "review_notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    CONSTRAINT "addon_versions_review_status_check" CHECK (("review_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_changes'::"text", 'approved'::"text", 'rejected'::"text", 'deprecated'::"text", 'security_hold'::"text"])))
);


ALTER TABLE "public"."addon_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publisher_id" "uuid",
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "trust_tier" "text" DEFAULT 'unreviewed'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "latest_version" "text",
    "homepage_url" "text",
    "source_url" "text",
    "license" "text",
    "local_only" boolean DEFAULT true NOT NULL,
    "network_access" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addons_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_changes'::"text", 'approved'::"text", 'rejected'::"text", 'deprecated'::"text", 'security_hold'::"text"]))),
    CONSTRAINT "addons_trust_tier_check" CHECK (("trust_tier" = ANY (ARRAY['official'::"text", 'reviewed'::"text", 'community'::"text", 'unreviewed'::"text", 'deprecated'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badge_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "badge_slug" "text",
    "credit_event_id" "uuid",
    "evidence_type" "text",
    "evidence_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "badge_audit_log_action_check" CHECK (("action" = ANY (ARRAY['credit_created'::"text", 'credit_revoked'::"text", 'badge_granted'::"text", 'badge_revoked'::"text", 'manual_grant'::"text", 'manual_revoke'::"text", 'free_member_granted'::"text", 'rule_evaluated'::"text"])))
);


ALTER TABLE "public"."badge_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badge_credit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_type" "text" NOT NULL,
    "credit_amount" integer DEFAULT 1 NOT NULL,
    "contribution_type" "text" NOT NULL,
    "contribution_id" "uuid",
    "review_item_id" "uuid",
    "awarded_by" "uuid",
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_major" boolean DEFAULT false NOT NULL,
    "distinct_subject_key" "text",
    "notes" "text",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoked_reason" "text",
    CONSTRAINT "badge_credit_events_credit_amount_check" CHECK ((("credit_amount" >= 1) AND ("credit_amount" <= 2))),
    CONSTRAINT "badge_credit_events_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['account_membership'::"text", 'stewardship_general'::"text", 'stewardship_water'::"text", 'stewardship_forest'::"text", 'stewardship_reef'::"text", 'stewardship_health'::"text", 'knowledge_support'::"text", 'source_curation'::"text", 'troubleshooting_resolution'::"text", 'developer_contribution'::"text", 'bridge_building'::"text", 'archive_maintenance'::"text", 'testing_feedback'::"text", 'field_observation'::"text", 'writing_teaching'::"text", 'art_contribution'::"text", 'accessibility_improvement'::"text", 'boundary_safety'::"text"])))
);


ALTER TABLE "public"."badge_credit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badge_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "badge_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "badge_type" "text" NOT NULL,
    "icon_path" "text",
    "category" "text",
    "rarity" "text" DEFAULT 'common'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer,
    "authority_linked" boolean DEFAULT false NOT NULL,
    "award_mode" "text",
    "rule_summary" "text",
    "is_manual_only" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "badge_definitions_award_mode_check" CHECK ((("award_mode" IS NULL) OR ("award_mode" = ANY (ARRAY['automatic'::"text", 'review_triggered'::"text", 'manual_admin'::"text", 'role_linked'::"text", 'project_lead'::"text"]))))
);


ALTER TABLE "public"."badge_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badge_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "badge_slug" "text" NOT NULL,
    "rule_type" "text" NOT NULL,
    "required_credit_type" "text",
    "required_count" integer,
    "required_credit_sum" integer,
    "requires_major" boolean DEFAULT false NOT NULL,
    "distinct_subject_min" integer,
    "eligible_credit_types" "text"[] DEFAULT '{}'::"text"[],
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "badge_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['profile_completed'::"text", 'credit_count'::"text", 'credit_sum'::"text", 'first_eligible_credit'::"text", 'manual_only'::"text", 'role_linked'::"text"])))
);


ALTER TABLE "public"."badge_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broken_link_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "commons_username" "text",
    "page_url" "text" NOT NULL,
    "broken_url" "text" NOT NULL,
    "source_context" "text",
    "report_note" "text",
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."broken_link_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_abuse_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid",
    "reported_user_id" "uuid",
    "post_id" "uuid",
    "comment_id" "uuid",
    "upload_id" "uuid",
    "public_profile_username" "text",
    "report_type" "text" NOT NULL,
    "report_reason" "text" NOT NULL,
    "status" "public"."abuse_report_status" DEFAULT 'pending_review'::"public"."abuse_report_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "resolution_note" "text"
);


ALTER TABLE "public"."commune_abuse_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."commune_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."commune_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "line_start" integer NOT NULL,
    "line_end" integer NOT NULL,
    "comment" "text" NOT NULL,
    "visibility_state" "text" DEFAULT 'published'::"text" NOT NULL,
    "annotation_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "moderation_reason" "text",
    CONSTRAINT "commune_code_annotations_comment_check" CHECK ((("char_length"(TRIM(BOTH FROM "comment")) >= 1) AND ("char_length"(TRIM(BOTH FROM "comment")) <= 2000))),
    CONSTRAINT "commune_code_annotations_line_check" CHECK ((("line_start" > 0) AND ("line_end" >= "line_start"))),
    CONSTRAINT "commune_code_annotations_status_check" CHECK (("annotation_status" = ANY (ARRAY['open'::"text", 'addressed'::"text", 'resolved'::"text", 'archived'::"text"]))),
    CONSTRAINT "commune_code_annotations_visibility_check" CHECK (("visibility_state" = ANY (ARRAY['published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_code_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_diagnostics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "post_id" "uuid",
    "code_document_id" "uuid",
    "code_version_id" "uuid",
    "severity" "text" NOT NULL,
    "phase" "text" NOT NULL,
    "category" "text" NOT NULL,
    "language" "text" NOT NULL,
    "file_name" "text",
    "line_number" integer,
    "column_number" integer,
    "message" "text" NOT NULL,
    "source" "text" DEFAULT 'coding-cornucopia'::"text" NOT NULL,
    "public_visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_code_diagnostics_phase_check" CHECK (("phase" = ANY (ARRAY['static'::"text", 'policy'::"text", 'runtime'::"text", 'sandbox'::"text", 'security'::"text"]))),
    CONSTRAINT "commune_code_diagnostics_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text"]))),
    CONSTRAINT "commune_code_diagnostics_visibility_check" CHECK (("public_visibility" = ANY (ARRAY['private'::"text", 'reviewer_only'::"text", 'public_summary'::"text"])))
);


ALTER TABLE "public"."commune_code_diagnostics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "snapshot_text" "text" NOT NULL,
    "change_summary" "text",
    "version_number" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_code_document_versions_text_check" CHECK (("char_length"("snapshot_text") <= 100000))
);


ALTER TABLE "public"."commune_code_document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text",
    "language" "text" DEFAULT 'text'::"text" NOT NULL,
    "file_name" "text",
    "current_text" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text",
    "visibility_state" "text" DEFAULT 'draft'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "linked_commune_post_id" "uuid",
    "linked_sandbox_request_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "moderation_reason" "text",
    CONSTRAINT "commune_code_documents_filename_check" CHECK ((("file_name" IS NULL) OR (("file_name" !~ '(\.\.|/|\\)'::"text") AND ("file_name" !~* '^[A-Z]:'::"text")))),
    CONSTRAINT "commune_code_documents_review_status_check" CHECK (("review_status" = ANY (ARRAY['draft'::"text", 'open_for_review'::"text", 'changes_requested'::"text", 'resolved'::"text", 'archived'::"text", 'security_hold'::"text"]))),
    CONSTRAINT "commune_code_documents_text_check" CHECK (("char_length"("current_text") <= 100000)),
    CONSTRAINT "commune_code_documents_title_check" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "commune_code_documents_visibility_check" CHECK (("visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_code_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_moderation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid",
    "annotation_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_code_moderation_events_action_check" CHECK (("action" = ANY (ARRAY['document_created'::"text", 'document_updated'::"text", 'version_created'::"text", 'annotation_created'::"text", 'annotation_resolved'::"text", 'document_submitted'::"text", 'document_published'::"text", 'document_flagged'::"text", 'document_hidden'::"text", 'document_removed'::"text", 'document_archived'::"text", 'annotation_reported'::"text", 'document_reported'::"text", 'report_reviewed'::"text", 'edit_lock_acquired'::"text", 'edit_lock_released'::"text"])))
);


ALTER TABLE "public"."commune_code_moderation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid",
    "annotation_id" "uuid",
    "reporter_user_id" "uuid",
    "reason" "text" NOT NULL,
    "detail" "text",
    "report_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewer_note" "text",
    CONSTRAINT "commune_code_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'unsafe_code'::"text", 'secret_or_private_data'::"text", 'misinformation'::"text", 'copyright_or_license'::"text", 'malware_or_suspicious'::"text", 'privacy_violation'::"text", 'other'::"text"]))),
    CONSTRAINT "commune_code_reports_status_check" CHECK (("report_status" = ANY (ARRAY['open'::"text", 'under_review'::"text", 'action_taken'::"text", 'dismissed'::"text", 'archived'::"text"]))),
    CONSTRAINT "commune_code_reports_target_check" CHECK ((("document_id" IS NOT NULL) OR ("annotation_id" IS NOT NULL)))
);


ALTER TABLE "public"."commune_code_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_revision_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "code_snippet_id" "uuid" NOT NULL,
    "proposer_user_id" "uuid" NOT NULL,
    "original_author_user_id" "uuid" NOT NULL,
    "base_code_text" "text" NOT NULL,
    "proposed_code_text" "text" NOT NULL,
    "language" "text",
    "file_name" "text",
    "change_summary" "text" NOT NULL,
    "explanation" "text",
    "base_snapshot_label" "text" DEFAULT 'current accepted snapshot'::"text" NOT NULL,
    "proposal_status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "sandbox_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "accepted_version_number" integer,
    "decision_by" "uuid",
    "decision_note" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_code_revision_code_length_check" CHECK ((("char_length"("proposed_code_text") <= 100000) AND ("char_length"("base_code_text") <= 100000))),
    CONSTRAINT "commune_code_revision_filename_check" CHECK ((("file_name" IS NULL) OR (("file_name" !~ '(\.\.|/|\\)'::"text") AND ("file_name" !~* '^[A-Z]:'::"text")))),
    CONSTRAINT "commune_code_revision_status_check" CHECK (("proposal_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_changes'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text", 'hidden_by_moderation'::"text"]))),
    CONSTRAINT "commune_code_revision_summary_check" CHECK ((("char_length"(TRIM(BOTH FROM "change_summary")) >= 1) AND ("char_length"(TRIM(BOTH FROM "change_summary")) <= 500)))
);


ALTER TABLE "public"."commune_code_revision_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "room_slug" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "active_editor_user_id" "uuid",
    "edit_lock_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_code_sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'locked'::"text", 'paused'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_code_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_code_snippets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "language" "text",
    "file_name" "text",
    "code_text" "text" NOT NULL,
    "secret_scan_status" "text" DEFAULT 'not_scanned'::"text",
    "sandbox_warning_acknowledged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_revision_id" "uuid",
    "accepted_version_number" integer DEFAULT 1 NOT NULL,
    "accepted_revision_proposer_user_id" "uuid",
    "accepted_revision_summary" "text",
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."commune_code_snippets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "parent_comment_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "author_username" "text",
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    "moderation_reason" "text",
    "body_format" "text" DEFAULT 'markdown'::"text",
    "visibility_state" "text" DEFAULT 'published'::"text",
    "report_count" integer DEFAULT 0,
    "removed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    CONSTRAINT "commune_comments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'published'::"text", 'hidden'::"text", 'removed_by_moderator'::"text", 'deleted_by_user'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_content_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_content_reactions_reaction_check" CHECK (("reaction" = ANY (ARRAY['helpful'::"text", 'caution'::"text"]))),
    CONSTRAINT "commune_content_reactions_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."commune_content_reactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."commune_content_reaction_counts" AS
 SELECT "target_type",
    "target_id",
    ("count"(*) FILTER (WHERE ("reaction" = 'helpful'::"text")))::integer AS "helpful_count",
    ("count"(*) FILTER (WHERE ("reaction" = 'caution'::"text")))::integer AS "caution_count"
   FROM "public"."commune_content_reactions"
  GROUP BY "target_type", "target_id";


ALTER VIEW "public"."commune_content_reaction_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_iteration_showcases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "author_user_id" "uuid" NOT NULL,
    "iteration_type" "text",
    "version_build_label" "text",
    "what_changed" "text",
    "why_it_matters" "text",
    "known_limitations" "text",
    "next_step" "text",
    "related_repo_url" "text",
    "provider" "text",
    "branch" "text",
    "commit_sha" "text",
    "release_tag" "text",
    "pull_request_url" "text",
    "developer_forge_link" "text",
    "marketplace_link" "text",
    "testing_status" "text" DEFAULT 'not_tested'::"text" NOT NULL,
    "compatibility_note" "text",
    "sandbox_review_requested" boolean DEFAULT false NOT NULL,
    "sandbox_review_status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "sandbox_review_request_id" "uuid",
    "risk_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "import_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "imported_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "imported_at" timestamp with time zone,
    "redaction_notes" "text",
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_iteration_showcases_sandbox_review_status_check" CHECK (("sandbox_review_status" = ANY (ARRAY['not_requested'::"text", 'requested'::"text", 'queued'::"text", 'in_review'::"text", 'completed'::"text", 'failed'::"text", 'declined'::"text", 'needs_information'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_iteration_showcases" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_iteration_showcases" IS 'Elysia Iteration Showcase metadata. Public demos/progress/build notes only; not official release, trust, security, compatibility, Developer Forge, or Marketplace approval.';



COMMENT ON COLUMN "public"."commune_iteration_showcases"."related_repo_url" IS 'Optional public related source URL. Metadata only; the website does not clone, build, install, or run repositories from this room.';



COMMENT ON COLUMN "public"."commune_iteration_showcases"."sandbox_review_status" IS 'Selected-artifact sandbox review status only. This is evidence, not full-repository review, security approval, Marketplace readiness, or compatibility certification.';



COMMENT ON COLUMN "public"."commune_iteration_showcases"."imported_metadata" IS 'Public GitHub/import manifest metadata after user review; must not include secrets, private repo data, local paths, prompts, logs, or sealed memory.';



CREATE TABLE IF NOT EXISTS "public"."commune_job_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "author_user_id" "uuid" NOT NULL,
    "role_title" "text",
    "organization_project" "text",
    "role_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "paid_volunteer_status" "text" DEFAULT 'must_clarify'::"text" NOT NULL,
    "location_mode" "text" DEFAULT 'unspecified'::"text" NOT NULL,
    "location_text" "text",
    "time_commitment" "text",
    "deadline" "text",
    "compensation_clarity" "text",
    "contact_path" "text",
    "requirements_skills" "text",
    "safety_notes" "text",
    "role_summary" "text",
    "application_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "anti_scam_review_status" "text" DEFAULT 'not_reviewed'::"text" NOT NULL,
    "work_with_link_enabled" boolean DEFAULT true NOT NULL,
    "private_application_note" "text",
    "public_correction_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "filled_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_job_posts_anti_scam_review_status_check" CHECK (("anti_scam_review_status" = ANY (ARRAY['not_reviewed'::"text", 'reviewed_clear'::"text", 'needs_pay_clarification'::"text", 'needs_contact_clarification'::"text", 'needs_location_clarification'::"text", 'suspicious'::"text", 'removed'::"text"]))),
    CONSTRAINT "commune_job_posts_application_status_check" CHECK (("application_status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'filled'::"text", 'closed'::"text", 'archived'::"text", 'needs_clarification'::"text"]))),
    CONSTRAINT "commune_job_posts_location_mode_check" CHECK (("location_mode" = ANY (ARRAY['remote'::"text", 'hybrid'::"text", 'local'::"text", 'field_based'::"text", 'unspecified'::"text"]))),
    CONSTRAINT "commune_job_posts_paid_volunteer_status_check" CHECK (("paid_volunteer_status" = ANY (ARRAY['paid'::"text", 'volunteer'::"text", 'stipend'::"text", 'unpaid'::"text", 'mixed'::"text", 'must_clarify'::"text"]))),
    CONSTRAINT "commune_job_posts_public_text_length_check" CHECK ((("char_length"(COALESCE("role_title", ''::"text")) <= 500) AND ("char_length"(COALESCE("organization_project", ''::"text")) <= 500) AND ("char_length"(COALESCE("location_text", ''::"text")) <= 1000) AND ("char_length"(COALESCE("time_commitment", ''::"text")) <= 1000) AND ("char_length"(COALESCE("deadline", ''::"text")) <= 250) AND ("char_length"(COALESCE("compensation_clarity", ''::"text")) <= 4000) AND ("char_length"(COALESCE("contact_path", ''::"text")) <= 2000) AND ("char_length"(COALESCE("requirements_skills", ''::"text")) <= 8000) AND ("char_length"(COALESCE("safety_notes", ''::"text")) <= 4000) AND ("char_length"(COALESCE("role_summary", ''::"text")) <= 12000) AND ("char_length"(COALESCE("private_application_note", ''::"text")) <= 2000) AND ("char_length"(COALESCE("public_correction_note", ''::"text")) <= 4000))),
    CONSTRAINT "commune_job_posts_role_type_check" CHECK (("role_type" = ANY (ARRAY['paid_role'::"text", 'volunteer_call'::"text", 'stipend_role'::"text", 'contract'::"text", 'internship'::"text", 'research_role'::"text", 'collaboration_role'::"text", 'contributor_call'::"text", 'reviewer_moderator_need'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."commune_job_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_job_posts" IS 'Structured Job Post metadata for public opportunity listings. Normal-user rows remain pending until admin approval through the linked commune_posts row.';



COMMENT ON COLUMN "public"."commune_job_posts"."anti_scam_review_status" IS 'Reviewer/admin anti-scam state. Public users must not self-assign reviewed_clear or trust/safety claims.';



COMMENT ON COLUMN "public"."commune_job_posts"."work_with_link_enabled" IS 'Public bridge flag to Work With Elysia Ecobotics. Work With remains private intake; Job Post remains public listing discussion.';



COMMENT ON COLUMN "public"."commune_job_posts"."private_application_note" IS 'Optional admin/reviewer public-safe clarification only. The permanent Work With/private application warning is system-owned UI copy, not author-editable metadata.';



CREATE TABLE IF NOT EXISTS "public"."commune_language_policies" (
    "language" "text" NOT NULL,
    "label" "text" NOT NULL,
    "status" "text" NOT NULL,
    "sandbox_runtime" "text",
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_language_policies_status_check" CHECK (("status" = ANY (ARRAY['active_sandbox'::"text", 'static_diagnostics'::"text", 'future'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."commune_language_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "media_kind" "text",
    "visibility_state" "text" DEFAULT 'submitted'::"text",
    "scan_status" "text" DEFAULT 'not_scanned'::"text",
    "warning_acknowledged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "commune_media_kind_check" CHECK (("media_kind" = ANY (ARRAY['image'::"text", 'document'::"text", 'archive'::"text", 'code_text'::"text", 'other'::"text"]))),
    CONSTRAINT "commune_media_visibility_check" CHECK (("visibility_state" = ANY (ARRAY['submitted'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."commune_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_moderation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "action" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_moderation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_official_update_code_snippets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "official_update_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "language" "text" DEFAULT 'text'::"text" NOT NULL,
    "file_name" "text",
    "code_text" "text" NOT NULL,
    "context_note" "text",
    "correction_note" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "public_visible" boolean DEFAULT true NOT NULL,
    "edited_by" "uuid",
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_official_update_code_snippets" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_official_update_code_snippets" IS 'Read-only official code examples attached to Official Updates. No public workbench, sandbox run, proposal flow, install, or execution path.';



CREATE TABLE IF NOT EXISTS "public"."commune_official_update_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "official_update_id" "uuid",
    "post_id" "uuid",
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "public_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_official_update_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_official_update_events" IS 'Admin/reviewer-visible audit events for Official Update lifecycle changes, code edits, comment locks, corrections, retractions, and archives.';



CREATE TABLE IF NOT EXISTS "public"."commune_official_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "brand_author_name" "text" DEFAULT 'Elysia Ecobotics Official'::"text" NOT NULL,
    "update_type" "text" DEFAULT 'official_statement'::"text" NOT NULL,
    "official_status" "text" DEFAULT 'published'::"text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "audience" "text",
    "summary" "text",
    "effective_date" "date",
    "release_version" "text",
    "affected_systems" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "related_room_slug" "text",
    "related_repo_url" "text",
    "related_migration" "text",
    "related_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "known_limitations" "text",
    "migration_required" boolean DEFAULT false NOT NULL,
    "user_action_required" "text",
    "pinned" boolean DEFAULT false NOT NULL,
    "important" boolean DEFAULT false NOT NULL,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    "correction_note" "text",
    "correction_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "supersedes_update_id" "uuid",
    "superseded_by_update_id" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "corrected_at" timestamp with time zone,
    "retracted_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_official_updates_correction_status_check" CHECK (("correction_status" = ANY (ARRAY['none'::"text", 'corrected'::"text", 'retracted'::"text", 'superseded'::"text"]))),
    CONSTRAINT "commune_official_updates_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'notice'::"text", 'important'::"text", 'urgent'::"text", 'critical'::"text"]))),
    CONSTRAINT "commune_official_updates_status_check" CHECK (("official_status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'updated'::"text", 'corrected'::"text", 'retracted'::"text", 'archived'::"text", 'resolved'::"text", 'monitoring'::"text"]))),
    CONSTRAINT "commune_official_updates_type_check" CHECK (("update_type" = ANY (ARRAY['release_note'::"text", 'roadmap_update'::"text", 'governance_update'::"text", 'security_notice'::"text", 'maintenance_notice'::"text", 'incident_update'::"text", 'community_notice'::"text", 'developer_notice'::"text", 'marketplace_notice'::"text", 'policy_update'::"text", 'migration_notice'::"text", 'official_statement'::"text"])))
);


ALTER TABLE "public"."commune_official_updates" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_official_updates" IS 'Structured Official Update metadata. Admin-only brand-authoritative public notices; community users cannot self-assign official authority.';



COMMENT ON COLUMN "public"."commune_official_updates"."update_type" IS 'Official notice category: release, roadmap, governance, security, maintenance, incident, policy, developer, marketplace, community, migration, or official statement.';



COMMENT ON COLUMN "public"."commune_official_updates"."comments_enabled" IS 'Controls whether non-reviewer community comments may be added to the official notice thread.';



COMMENT ON COLUMN "public"."commune_official_updates"."correction_status" IS 'Correction/retraction/supersession state for audit-aware public notice lifecycle.';



CREATE TABLE IF NOT EXISTS "public"."commune_post_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "commons_username" "text",
    "post_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "body" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "links" "text"[] DEFAULT '{}'::"text"[],
    "code_included" boolean DEFAULT false,
    "repository_url" "text",
    "safety_acknowledgements" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "post_id" "uuid",
    "upload_included" boolean DEFAULT false,
    "sandbox_review_requested" boolean DEFAULT false
);


ALTER TABLE "public"."commune_post_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_username" "text",
    "post_type" "public"."commune_post_type" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "excerpt" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "links" "text"[] DEFAULT '{}'::"text"[],
    "repository_url" "text",
    "visibility" "public"."commune_visibility" DEFAULT 'public'::"public"."commune_visibility" NOT NULL,
    "status" "public"."commune_post_status" DEFAULT 'draft'::"public"."commune_post_status" NOT NULL,
    "moderation_status" "text" DEFAULT 'not_submitted'::"text",
    "safety_acknowledgements" "jsonb" DEFAULT '{}'::"jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    "moderation_reason" "text",
    "category_id" "uuid",
    "slug" "text",
    "summary" "text",
    "body_format" "text" DEFAULT 'markdown'::"text",
    "visibility_state" "text" DEFAULT 'draft'::"text",
    "repo_showcase_id" "uuid",
    "media_policy_acknowledged" boolean DEFAULT false,
    "secret_warning_acknowledged" boolean DEFAULT false,
    "sandbox_warning_acknowledged" boolean DEFAULT false,
    "allow_comments" boolean DEFAULT true,
    "comment_count" integer DEFAULT 0,
    "saved_count" integer DEFAULT 0,
    "report_count" integer DEFAULT 0,
    "flagged_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."commune_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_realtime_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_slug" "text" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "visibility_state" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hidden_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "room_id" "uuid",
    "body_plain" "text",
    "report_count" integer DEFAULT 0 NOT NULL,
    "edited_at" timestamp with time zone,
    "flagged_at" timestamp with time zone,
    "moderation_reason" "text",
    CONSTRAINT "commune_realtime_messages_visibility_check" CHECK (("visibility_state" = ANY (ARRAY['published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_realtime_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_realtime_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "room_id" "uuid",
    "reporter_user_id" "uuid",
    "reason" "text" NOT NULL,
    "detail" "text",
    "report_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewer_note" "text"
);


ALTER TABLE "public"."commune_realtime_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_realtime_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "visibility_state" "text" DEFAULT 'published'::"text" NOT NULL,
    "posting_mode" "text" DEFAULT 'open_signed_in'::"text" NOT NULL,
    "slow_mode_seconds" integer DEFAULT 15 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_realtime_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_repo_showcases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "repo_url" "text" NOT NULL,
    "source_host" "text",
    "summary" "text",
    "license" "text",
    "primary_language" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "safety_notes" "text",
    "install_or_run_warning" "text",
    "visibility_state" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    CONSTRAINT "commune_repo_showcases_visibility_check" CHECK (("visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."commune_repo_showcases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'submitted'::"text",
    "assigned_to" "uuid",
    "reviewed_by" "uuid",
    "reviewer_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "commune_reports_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'action_taken'::"text", 'dismissed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_repository_showcases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "repository_url" "text" NOT NULL,
    "repository_host" "text",
    "project_name" "text",
    "project_summary" "text",
    "license" "text",
    "language_tags" "text"[] DEFAULT '{}'::"text"[],
    "safety_notes" "text",
    "run_instructions" "text",
    "sandbox_review_requested" boolean DEFAULT false NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_repository_showcases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_research_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "author_user_id" "uuid" NOT NULL,
    "research_question" "text",
    "domain" "text",
    "evidence_strength" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "living_library_source_link" "text",
    "related_living_library_source_id" "uuid",
    "citation_notes" "text",
    "evidence_summary" "text",
    "observation" "text",
    "interpretation" "text",
    "uncertainty" "text",
    "context_discussion" "text",
    "source_links" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "geographic_scope" "text",
    "ecological_subsystem" "text" DEFAULT 'general'::"text" NOT NULL,
    "method_type" "text",
    "data_type" "text",
    "ethics_note" "text",
    "review_status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "correction_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "corrected_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_research_notes_ecological_subsystem_check" CHECK (("ecological_subsystem" = ANY (ARRAY['verdante'::"text", 'sylphora'::"text", 'ecotiva'::"text", 'aurania'::"text", 'terraflux'::"text", 'aquaria'::"text", 'aetheria'::"text", 'general'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "commune_research_notes_evidence_strength_check" CHECK (("evidence_strength" = ANY (ARRAY['preliminary'::"text", 'anecdotal'::"text", 'moderate'::"text", 'strong'::"text", 'mixed'::"text", 'needs_verification'::"text", 'unknown'::"text"]))),
    CONSTRAINT "commune_research_notes_public_text_length_check" CHECK ((("char_length"(COALESCE("research_question", ''::"text")) <= 1000) AND ("char_length"(COALESCE("domain", ''::"text")) <= 250) AND ("char_length"(COALESCE("living_library_source_link", ''::"text")) <= 1000) AND ("char_length"(COALESCE("citation_notes", ''::"text")) <= 8000) AND ("char_length"(COALESCE("evidence_summary", ''::"text")) <= 12000) AND ("char_length"(COALESCE("observation", ''::"text")) <= 12000) AND ("char_length"(COALESCE("interpretation", ''::"text")) <= 12000) AND ("char_length"(COALESCE("uncertainty", ''::"text")) <= 8000) AND ("char_length"(COALESCE("context_discussion", ''::"text")) <= 16000) AND ("char_length"(COALESCE("geographic_scope", ''::"text")) <= 1000) AND ("char_length"(COALESCE("method_type", ''::"text")) <= 500) AND ("char_length"(COALESCE("data_type", ''::"text")) <= 500) AND ("char_length"(COALESCE("ethics_note", ''::"text")) <= 4000) AND ("char_length"(COALESCE("correction_note", ''::"text")) <= 4000))),
    CONSTRAINT "commune_research_notes_review_status_check" CHECK (("review_status" = ANY (ARRAY['submitted'::"text", 'published'::"text", 'needs_citation'::"text", 'needs_clarification'::"text", 'source_issue'::"text", 'overclaiming_evidence'::"text", 'corrected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_research_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_research_notes" IS 'Structured Research Notes metadata. Public evidence discussion only; not Official Update authority, Living Library source canonicalization, certification, private research storage, or a trust badge.';



COMMENT ON COLUMN "public"."commune_research_notes"."evidence_strength" IS 'Public evidence-strength/confidence category: preliminary, anecdotal, moderate, strong, mixed, needs_verification, or unknown. This is not a trust badge.';



COMMENT ON COLUMN "public"."commune_research_notes"."living_library_source_link" IS 'Public Living Library source link/reference supplied by the author. This is a metadata link, not a foreign-key guarantee or source approval.';



COMMENT ON COLUMN "public"."commune_research_notes"."ethics_note" IS 'Public safety/ethics note only. Do not store private participant data, sensitive ecological locations, credentials, local Elysia data, hidden review notes, or copyrighted full-text papers without rights.';



COMMENT ON COLUMN "public"."commune_research_notes"."review_status" IS 'Research Notes review state: submitted, published, needs_citation, needs_clarification, source_issue, overclaiming_evidence, corrected, or archived.';



CREATE TABLE IF NOT EXISTS "public"."commune_room_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "member_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_room_moderation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "message_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_room_moderation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "room_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "requires_moderation" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_sandbox_policies" (
    "policy_key" "text" NOT NULL,
    "policy_value" "jsonb" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_sandbox_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_sandbox_review_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "repository_showcase_id" "uuid",
    "request_title" "text" NOT NULL,
    "repository_url" "text",
    "package_url" "text",
    "requested_review_scope" "text",
    "risk_notes" "text",
    "declared_permissions" "text"[] DEFAULT '{}'::"text"[],
    "status" "public"."sandbox_review_status" DEFAULT 'requested'::"public"."sandbox_review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid",
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "language" "text",
    "code_text" "text",
    "package_id" "uuid",
    "addon_submission_id" "uuid",
    "code_document_id" "uuid",
    "expected_command" "text",
    "declared_dependencies" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "declared_network_policy" "text" DEFAULT 'disabled'::"text" NOT NULL,
    "declared_network_domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "declared_filesystem_policy" "text" DEFAULT 'none'::"text" NOT NULL,
    "declared_file_scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "requested_cpu_limit" "text",
    "requested_memory_limit" "text",
    "requested_timeout_seconds" integer,
    "user_acknowledged_no_execution" boolean DEFAULT false NOT NULL,
    "user_acknowledged_no_secrets" boolean DEFAULT false NOT NULL,
    "user_acknowledged_local_elysia_final_authority" boolean DEFAULT false NOT NULL,
    "request_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'not_submitted'::"text" NOT NULL,
    "handoff_status" "text" DEFAULT 'not_exported'::"text" NOT NULL,
    "handoff_bundle_json" "jsonb",
    "handoff_exported_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "reviewer_public_feedback" "text",
    "reviewer_private_note" "text",
    "security_hold_reason" "text",
    CONSTRAINT "commune_sandbox_handoff_filesystem_policy_check" CHECK (("declared_filesystem_policy" = ANY (ARRAY['none'::"text", 'temporary_workspace_only'::"text", 'declared_read_only_inputs'::"text", 'future_review_required'::"text"]))),
    CONSTRAINT "commune_sandbox_handoff_network_policy_check" CHECK (("declared_network_policy" = ANY (ARRAY['disabled'::"text", 'declared_domains_only'::"text", 'future_review_required'::"text"]))),
    CONSTRAINT "commune_sandbox_handoff_request_status_check" CHECK (("request_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'changes_requested'::"text", 'approved_for_local_handoff'::"text", 'rejected'::"text", 'security_hold'::"text", 'archived'::"text", 'revoked'::"text"]))),
    CONSTRAINT "commune_sandbox_handoff_review_status_check" CHECK (("review_status" = ANY (ARRAY['not_submitted'::"text", 'pending_review'::"text", 'changes_requested'::"text", 'approved'::"text", 'rejected'::"text", 'security_hold'::"text"]))),
    CONSTRAINT "commune_sandbox_handoff_source_type_check" CHECK (("source_type" = ANY (ARRAY['commune_post'::"text", 'commune_code_document'::"text", 'developer_forge_addon'::"text", 'marketplace_addon_version'::"text", 'manual'::"text", 'other'::"text"]))),
    CONSTRAINT "commune_sandbox_handoff_status_check" CHECK (("handoff_status" = ANY (ARRAY['not_exported'::"text", 'export_ready'::"text", 'exported'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."commune_sandbox_review_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_sandbox_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submitted_by" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "code_snippet_id" "uuid",
    "repo_showcase_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "risk_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "commune_sandbox_reviews_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'approved_for_local_testing'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_sandbox_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_sandbox_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_user_id" "uuid",
    "post_id" "uuid",
    "code_document_id" "uuid",
    "code_version_id" "uuid",
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "text",
    "snapshot_id" "text" NOT NULL,
    "language" "text" NOT NULL,
    "file_name" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "sandbox_service" "text" DEFAULT 'coding-cornucopia-sandbox-runner'::"text" NOT NULL,
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stdout_preview" "text",
    "stderr_preview" "text",
    "exit_code" integer,
    "duration_ms" integer,
    "public_visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "commune_sandbox_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'requested'::"text", 'queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'denied'::"text", 'policy_blocked'::"text", 'sandbox_unavailable'::"text"]))),
    CONSTRAINT "commune_sandbox_runs_visibility_check" CHECK (("public_visibility" = ANY (ARRAY['private'::"text", 'reviewer_only'::"text", 'public_summary'::"text"])))
);


ALTER TABLE "public"."commune_sandbox_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_saved_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."commune_saved_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_thread_participant_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "approved_by" "uuid",
    "first_comment_id" "uuid",
    "approval_source" "text" DEFAULT 'first_comment_approval'::"text" NOT NULL,
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    CONSTRAINT "commune_thread_participant_status_check" CHECK (("status" = ANY (ARRAY['approved'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."commune_thread_participant_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "room_id" "uuid",
    "title" "text" NOT NULL,
    "created_by" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_reply_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "lock_reason" "text"
);


ALTER TABLE "public"."commune_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_troubleshooting_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "author_user_id" "uuid" NOT NULL,
    "issue_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "affected_area" "text",
    "environment_os" "text",
    "environment_browser" "text",
    "app_version" "text",
    "environment_notes" "text",
    "steps_to_reproduce" "text",
    "expected_result" "text",
    "actual_result" "text",
    "error_message" "text",
    "redacted_logs" "text",
    "workaround" "text",
    "troubleshooting_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "accepted_comment_id" "uuid",
    "accepted_proposal_id" "uuid",
    "accepted_resolution_kind" "text",
    "accepted_summary" "text",
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_troubleshooting_issue_type_check" CHECK (("issue_type" = ANY (ARRAY['bug'::"text", 'install_issue'::"text", 'account_auth'::"text", 'deployment'::"text", 'supabase_rls'::"text", 'cloudflare'::"text", 'frontend_ui'::"text", 'backend_api'::"text", 'sandbox_runner'::"text", 'marketplace'::"text", 'commune'::"text", 'profile'::"text", 'documentation'::"text", 'other'::"text"]))),
    CONSTRAINT "commune_troubleshooting_public_text_length_check" CHECK ((("char_length"(COALESCE("affected_area", ''::"text")) <= 500) AND ("char_length"(COALESCE("environment_os", ''::"text")) <= 250) AND ("char_length"(COALESCE("environment_browser", ''::"text")) <= 250) AND ("char_length"(COALESCE("app_version", ''::"text")) <= 250) AND ("char_length"(COALESCE("environment_notes", ''::"text")) <= 4000) AND ("char_length"(COALESCE("steps_to_reproduce", ''::"text")) <= 12000) AND ("char_length"(COALESCE("expected_result", ''::"text")) <= 8000) AND ("char_length"(COALESCE("actual_result", ''::"text")) <= 8000) AND ("char_length"(COALESCE("error_message", ''::"text")) <= 8000) AND ("char_length"(COALESCE("redacted_logs", ''::"text")) <= 20000) AND ("char_length"(COALESCE("workaround", ''::"text")) <= 12000) AND ("char_length"(COALESCE("accepted_summary", ''::"text")) <= 4000))),
    CONSTRAINT "commune_troubleshooting_resolution_kind_check" CHECK ((("accepted_resolution_kind" IS NULL) OR ("accepted_resolution_kind" = ANY (ARRAY['comment'::"text", 'proposal'::"text", 'workaround'::"text", 'admin_resolution'::"text", 'manual_note'::"text"])))),
    CONSTRAINT "commune_troubleshooting_status_check" CHECK (("troubleshooting_status" = ANY (ARRAY['open'::"text", 'needs_information'::"text", 'in_progress'::"text", 'workaround_found'::"text", 'fix_proposed'::"text", 'resolved'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_troubleshooting_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_troubleshooting_posts" IS 'Structured Troubleshooting Grove issue metadata linked to moderated Commune posts. Public-safe diagnostic/support context only.';



CREATE TABLE IF NOT EXISTS "public"."commune_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "repository_showcase_id" "uuid",
    "bucket" "text" DEFAULT 'commune-uploads'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "upload_role" "text" DEFAULT 'attachment'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    "moderation_reason" "text",
    CONSTRAINT "commune_uploads_bucket_check" CHECK (("bucket" = 'commune-uploads'::"text")),
    CONSTRAINT "commune_uploads_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'approved'::"text", 'published'::"text", 'hidden'::"text", 'removed_by_moderator'::"text", 'deleted_by_user'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."commune_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commune_vote_ballots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_post_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "voter_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commune_vote_ballots" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_vote_ballots" IS 'Authenticated member ballots. Public result paths must use aggregate counts only and never expose voter_user_id.';



CREATE TABLE IF NOT EXISTS "public"."commune_vote_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_post_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_note" "text",
    "event_visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_vote_events_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'scheduled'::"text", 'opened'::"text", 'closed'::"text", 'reopened'::"text", 'accepted'::"text", 'declined'::"text", 'posted_to_official_update'::"text", 'archived'::"text", 'outcome_updated'::"text", 'comments_enabled'::"text", 'comments_disabled'::"text"]))),
    CONSTRAINT "commune_vote_events_visibility_check" CHECK (("event_visibility" = ANY (ARRAY['public'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."commune_vote_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_vote_events" IS 'Community Voting Room lifecycle/audit events. Public events are safe summaries; staff events are admin/reviewer visible.';



CREATE TABLE IF NOT EXISTS "public"."commune_vote_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vote_post_id" "uuid" NOT NULL,
    "option_label" "text" NOT NULL,
    "option_description" "text",
    "display_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_vote_options_label_check" CHECK (("length"(TRIM(BOTH FROM "option_label")) > 0))
);


ALTER TABLE "public"."commune_vote_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_vote_options" IS 'Single-choice advisory vote options. Composite constraints keep ballots tied to options from the same vote.';



CREATE TABLE IF NOT EXISTS "public"."commune_vote_posts" (
    "post_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "question" "text" NOT NULL,
    "context" "text",
    "decision_type" "text" DEFAULT 'single_choice_guidance'::"text" NOT NULL,
    "vote_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "opens_at" timestamp with time zone,
    "closes_at" timestamp with time zone,
    "results_visibility" "text" DEFAULT 'after_vote'::"text" NOT NULL,
    "allow_comments" boolean DEFAULT true NOT NULL,
    "admin_outcome_summary" "text",
    "official_update_post_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commune_vote_posts_decision_type_check" CHECK (("decision_type" = 'single_choice_guidance'::"text")),
    CONSTRAINT "commune_vote_posts_results_visibility_check" CHECK (("results_visibility" = ANY (ARRAY['always'::"text", 'after_vote'::"text", 'after_close'::"text", 'staff_only'::"text"]))),
    CONSTRAINT "commune_vote_posts_status_check" CHECK (("vote_status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'open'::"text", 'closed'::"text", 'accepted'::"text", 'declined'::"text", 'posted_to_official_update'::"text", 'archived'::"text"]))),
    CONSTRAINT "commune_vote_posts_time_window_check" CHECK ((("closes_at" IS NULL) OR ("opens_at" IS NULL) OR ("closes_at" > "opens_at"))),
    CONSTRAINT "commune_vote_posts_visibility_check" CHECK (("visibility" = 'public'::"text"))
);


ALTER TABLE "public"."commune_vote_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."commune_vote_posts" IS 'Community Voting Room sidecar metadata. Votes guide stewardship decisions and do not automatically change Elysia behavior, policy, legal/safety posture, Marketplace, Developer Forge, or Official Updates.';



CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "assigned_to" "uuid",
    "reviewed_by" "uuid",
    "reviewer_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'action_taken'::"text", 'dismissed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."developer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "developer_slug" "text",
    "display_name" "text" NOT NULL,
    "bio" "text",
    "website_url" "text",
    "github_url" "text",
    "support_url" "text",
    "contact_email" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "suspended_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "developer_profiles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'requested'::"text", 'active'::"text", 'trusted'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."developer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."library_source_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submitted_by" "uuid",
    "title" "text" NOT NULL,
    "official_url" "text",
    "category" "text",
    "notes" "text",
    "license_notes" "text",
    "privacy_notes" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "reviewer_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "library_source_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."library_source_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."living_library_source_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "commons_username" "text",
    "source_name" "text" NOT NULL,
    "official_url" "text" NOT NULL,
    "source_type" "text",
    "category" "text",
    "suggested_topics" "text"[] DEFAULT '{}'::"text"[],
    "why_it_belongs" "text",
    "license_notes" "text",
    "privacy_ethics_notes" "text",
    "submitter_notes" "text",
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."living_library_source_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_addon_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "manifest_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "package_id" "uuid",
    "package_sha256" "text",
    "package_size" bigint,
    "signature_status" "text" DEFAULT 'unsigned'::"text" NOT NULL,
    "compatibility_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_addon_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_install_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "listing_id" "uuid",
    "addon_version_id" "uuid",
    "intent_status" "text" DEFAULT 'created'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_install_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "addon_id" "text" NOT NULL,
    "developer_profile_id" "uuid",
    "source_submission_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "summary" "text",
    "description" "text",
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "icon_url" "text",
    "current_version" "text",
    "listing_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "risk_level" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "permission_summary" "text",
    "compatibility_summary" "text",
    "published_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_publication_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "addon_version_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_publication_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_revocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "addon_version_id" "uuid",
    "revoked_by" "uuid",
    "reason" "text" DEFAULT 'other'::"text" NOT NULL,
    "public_notice" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."marketplace_revocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "commune_replies" boolean DEFAULT true NOT NULL,
    "followed_threads" boolean DEFAULT true NOT NULL,
    "marketplace_updates" boolean DEFAULT true NOT NULL,
    "living_library_updates" boolean DEFAULT true NOT NULL,
    "review_status_updates" boolean DEFAULT true NOT NULL,
    "admin_queue_alerts" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_customization" (
    "user_id" "uuid" NOT NULL,
    "theme_mode" "text" DEFAULT 'starlit_archive'::"text" NOT NULL,
    "accent_color" "text" DEFAULT '#8ee8dc'::"text",
    "background_style" "text" DEFAULT 'soft_cyber_garden'::"text",
    "banner_media_id" "uuid",
    "avatar_media_id" "uuid",
    "decal_set" "text" DEFAULT 'none'::"text",
    "selected_decals" "text"[] DEFAULT '{}'::"text"[],
    "profile_layout" "text" DEFAULT 'classic_homebase'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "banner_zoom" numeric DEFAULT 1 NOT NULL,
    "banner_position_x" numeric DEFAULT 50 NOT NULL,
    "banner_position_y" numeric DEFAULT 50 NOT NULL,
    CONSTRAINT "profile_customization_banner_position_x_range" CHECK ((("banner_position_x" >= (0)::numeric) AND ("banner_position_x" <= (100)::numeric))),
    CONSTRAINT "profile_customization_banner_position_y_range" CHECK ((("banner_position_y" >= (0)::numeric) AND ("banner_position_y" <= (100)::numeric))),
    CONSTRAINT "profile_customization_banner_zoom_range" CHECK ((("banner_zoom" >= 0.5) AND ("banner_zoom" <= 2.0))),
    CONSTRAINT "profile_customization_theme_mode_check" CHECK (("theme_mode" = ANY (ARRAY['deep_grove'::"text", 'starlit_archive'::"text", 'solar_meadow'::"text", 'moonlit_reef'::"text", 'aether_blue'::"text", 'high_contrast'::"text"])))
);


ALTER TABLE "public"."profile_customization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_media_bucket_check" CHECK (("bucket" = ANY (ARRAY['profile-avatars'::"text", 'profile-banners'::"text"]))),
    CONSTRAINT "profile_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['avatar'::"text", 'banner'::"text"]))),
    CONSTRAINT "profile_media_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'hidden'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."profile_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_visibility_settings" (
    "user_id" "uuid" NOT NULL,
    "show_display_name" boolean DEFAULT true NOT NULL,
    "show_bio" boolean DEFAULT true NOT NULL,
    "show_interests" boolean DEFAULT true NOT NULL,
    "show_website" boolean DEFAULT true NOT NULL,
    "show_github" boolean DEFAULT true NOT NULL,
    "show_badges" boolean DEFAULT true NOT NULL,
    "show_stewardship_recognition" boolean DEFAULT true NOT NULL,
    "show_saved_addons" boolean DEFAULT false NOT NULL,
    "show_saved_sources" boolean DEFAULT false NOT NULL,
    "show_source_collections" boolean DEFAULT true NOT NULL,
    "show_commune_posts" boolean DEFAULT true NOT NULL,
    "show_work_with_status" boolean DEFAULT false NOT NULL,
    "show_developer_status" boolean DEFAULT true NOT NULL,
    "show_member_tier" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_visibility_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text",
    "bio" "text",
    "website_url" "text",
    "github_url" "text",
    "avatar_url" "text",
    "is_developer" boolean DEFAULT false NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "interests" "text",
    "profile_sync_updated_at" timestamp with time zone,
    "commons_onboarding_completed_at" timestamp with time zone,
    "stewardship_onboarding_skipped_at" timestamp with time zone,
    "work_with_onboarding_skipped_at" timestamp with time zone,
    "organization" "text",
    "headline" "text",
    "featured_public_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "profiles_featured_public_links_array_check" CHECK (("jsonb_typeof"("featured_public_links") = 'array'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."interests" IS 'Public Marketplace profile interests. May be manually synced from local Elysia public profile fields after explicit user confirmation.';



COMMENT ON COLUMN "public"."profiles"."profile_sync_updated_at" IS 'Optional timestamp for future profile-sync bookkeeping. Local Elysia does not send private fields, local files, memory, request traces, dependency inventory, or local paths.';



COMMENT ON COLUMN "public"."profiles"."organization" IS 'Optional public organization/affiliation text entered by the Commons Profile owner.';



COMMENT ON COLUMN "public"."profiles"."headline" IS 'Optional public Commons Profile headline entered by the profile owner.';



COMMENT ON COLUMN "public"."profiles"."featured_public_links" IS 'Optional public links entered by the profile owner. Expected item shape: {"label": "...", "url": "https://...", "kind": "website"}.';



CREATE TABLE IF NOT EXISTS "public"."publishers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "website_url" "text",
    "github_url" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."publishers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_item_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "body" "text" NOT NULL,
    "visibility" "text" DEFAULT 'internal'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_comments_visibility_check" CHECK (("visibility" = ANY (ARRAY['internal'::"text", 'submitter_visible'::"text"])))
);


ALTER TABLE "public"."review_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_item_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "from_status" "public"."review_status",
    "to_status" "public"."review_status",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain" "public"."review_domain" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "submitted_by" "uuid",
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "assigned_to" "uuid",
    "priority" "text" DEFAULT 'normal'::"text",
    "title" "text",
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid"
);


ALTER TABLE "public"."review_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_handoff_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sandbox_request_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sandbox_handoff_events_action_check" CHECK (("action" = ANY (ARRAY['draft_created'::"text", 'request_submitted'::"text", 'changes_requested'::"text", 'approved_for_local_handoff'::"text", 'rejected'::"text", 'security_hold'::"text", 'handoff_exported'::"text", 'handoff_revoked'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."sandbox_handoff_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stewardship_organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "official_url" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "caution_note" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stewardship_organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stewardship_receipt_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'stewardship-receipts'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "sha256_hash" "text",
    "redaction_status" "text" DEFAULT 'user_attested_redacted'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "stewardship_receipt_files_bucket_check" CHECK (("bucket" = 'stewardship-receipts'::"text")),
    CONSTRAINT "stewardship_receipt_files_size_bytes_check" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" <= 10485760)))
);


ALTER TABLE "public"."stewardship_receipt_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stewardship_recognition_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "organization_name" "text",
    "organization_url" "text",
    "support_note" "text",
    "amount_range" "text",
    "donation_date" "date",
    "receipt_file_id" "uuid",
    "redaction_confirmed" boolean DEFAULT false NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stewardship_recognition_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_key" "text" NOT NULL,
    "awarded_by" "uuid",
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "award_reason" "text",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "award_source" "text",
    "evidence_type" "text",
    "evidence_id" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoked_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_badges_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_followed_commune_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "followed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "muted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_followed_commune_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "target_type" "text",
    "target_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "action_url" "text"
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_addons" (
    "user_id" "uuid" NOT NULL,
    "addon_slug" "text" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_saved_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_citations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_id" "text" NOT NULL,
    "citation_text" "text" NOT NULL,
    "citation_format" "text" DEFAULT 'plain'::"text",
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_saved_citations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_commune_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_saved_commune_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_living_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_id" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text",
    "category" "text",
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."user_saved_living_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_source_collection_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "source_id" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_source_collection_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_source_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_source_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_role_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submitted_by" "uuid",
    "role_type" "text" NOT NULL,
    "display_name" "text",
    "contact_email" "text",
    "summary" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "reviewer_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "work_role_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."work_role_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_with_request_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'work-with-attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "file_role" "text" DEFAULT 'resume_cv'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "work_with_request_files_bucket_check" CHECK (("bucket" = 'work-with-attachments'::"text")),
    CONSTRAINT "work_with_request_files_file_role_check" CHECK (("file_role" = 'resume_cv'::"text")),
    CONSTRAINT "work_with_request_files_size_bytes_check" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" <= 10485760)))
);


ALTER TABLE "public"."work_with_request_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_with_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "preferred_contact" "text",
    "commons_username" "text",
    "request_type" "text",
    "availability" "text",
    "areas_of_interest" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "message" "text",
    "skills_experience" "text",
    "github_url" "text",
    "gitlab_codeberg_url" "text",
    "portfolio_url" "text",
    "linkedin_url" "text",
    "acknowledgements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending_review'::"public"."review_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_context" "text" DEFAULT 'standalone'::"text"
);


ALTER TABLE "public"."work_with_requests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addon_actions"
    ADD CONSTRAINT "addon_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_audit_log"
    ADD CONSTRAINT "addon_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_compatibility_results"
    ADD CONSTRAINT "addon_compatibility_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_dependencies"
    ADD CONSTRAINT "addon_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_draft_permissions"
    ADD CONSTRAINT "addon_draft_permissions_addon_draft_id_permission_key_key" UNIQUE ("addon_draft_id", "permission_key");



ALTER TABLE ONLY "public"."addon_draft_permissions"
    ADD CONSTRAINT "addon_draft_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_drafts"
    ADD CONSTRAINT "addon_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_packages"
    ADD CONSTRAINT "addon_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_permission_catalog"
    ADD CONSTRAINT "addon_permission_catalog_pkey" PRIMARY KEY ("permission_key");



ALTER TABLE ONLY "public"."addon_reviews"
    ADD CONSTRAINT "addon_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_submission_snapshots"
    ADD CONSTRAINT "addon_submission_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_submissions"
    ADD CONSTRAINT "addon_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_validation_results"
    ADD CONSTRAINT "addon_validation_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_versions"
    ADD CONSTRAINT "addon_versions_addon_id_version_key" UNIQUE ("addon_id", "version");



ALTER TABLE ONLY "public"."addon_versions"
    ADD CONSTRAINT "addon_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badge_audit_log"
    ADD CONSTRAINT "badge_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badge_credit_events"
    ADD CONSTRAINT "badge_credit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badge_definitions"
    ADD CONSTRAINT "badge_definitions_badge_key_key" UNIQUE ("badge_key");



ALTER TABLE ONLY "public"."badge_definitions"
    ADD CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badge_rules"
    ADD CONSTRAINT "badge_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broken_link_reports"
    ADD CONSTRAINT "broken_link_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_audit_log"
    ADD CONSTRAINT "commune_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_categories"
    ADD CONSTRAINT "commune_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_categories"
    ADD CONSTRAINT "commune_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."commune_code_annotations"
    ADD CONSTRAINT "commune_code_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_diagnostics"
    ADD CONSTRAINT "commune_code_diagnostics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_document_versions"
    ADD CONSTRAINT "commune_code_document_versions_document_id_version_number_key" UNIQUE ("document_id", "version_number");



ALTER TABLE ONLY "public"."commune_code_document_versions"
    ADD CONSTRAINT "commune_code_document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_documents"
    ADD CONSTRAINT "commune_code_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_documents"
    ADD CONSTRAINT "commune_code_documents_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."commune_code_moderation_events"
    ADD CONSTRAINT "commune_code_moderation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_reports"
    ADD CONSTRAINT "commune_code_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_sessions"
    ADD CONSTRAINT "commune_code_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_code_snippets"
    ADD CONSTRAINT "commune_code_snippets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_content_reactions"
    ADD CONSTRAINT "commune_content_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_content_reactions"
    ADD CONSTRAINT "commune_content_reactions_user_id_target_type_target_id_key" UNIQUE ("user_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."commune_iteration_showcases"
    ADD CONSTRAINT "commune_iteration_showcases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_post_id_key" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_post_unique" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_language_policies"
    ADD CONSTRAINT "commune_language_policies_pkey" PRIMARY KEY ("language");



ALTER TABLE ONLY "public"."commune_media"
    ADD CONSTRAINT "commune_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_moderation_events"
    ADD CONSTRAINT "commune_moderation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_official_update_code_snippets"
    ADD CONSTRAINT "commune_official_update_code_snippets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_official_update_events"
    ADD CONSTRAINT "commune_official_update_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_post_id_key" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_post_unique" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_post_requests"
    ADD CONSTRAINT "commune_post_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_posts"
    ADD CONSTRAINT "commune_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_realtime_messages"
    ADD CONSTRAINT "commune_realtime_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_realtime_reports"
    ADD CONSTRAINT "commune_realtime_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_realtime_rooms"
    ADD CONSTRAINT "commune_realtime_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_realtime_rooms"
    ADD CONSTRAINT "commune_realtime_rooms_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."commune_repo_showcases"
    ADD CONSTRAINT "commune_repo_showcases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_reports"
    ADD CONSTRAINT "commune_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_repository_showcases"
    ADD CONSTRAINT "commune_repository_showcases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_post_id_key" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_post_unique" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_room_members"
    ADD CONSTRAINT "commune_room_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_room_members"
    ADD CONSTRAINT "commune_room_members_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."commune_room_moderation_events"
    ADD CONSTRAINT "commune_room_moderation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_rooms"
    ADD CONSTRAINT "commune_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_rooms"
    ADD CONSTRAINT "commune_rooms_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."commune_sandbox_policies"
    ADD CONSTRAINT "commune_sandbox_policies_pkey" PRIMARY KEY ("policy_key");



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_sandbox_reviews"
    ADD CONSTRAINT "commune_sandbox_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_sandbox_runs"
    ADD CONSTRAINT "commune_sandbox_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_saved_posts"
    ADD CONSTRAINT "commune_saved_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_saved_posts"
    ADD CONSTRAINT "commune_saved_posts_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_threads"
    ADD CONSTRAINT "commune_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_post_id_key" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_vote_ballots"
    ADD CONSTRAINT "commune_vote_ballots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_vote_ballots"
    ADD CONSTRAINT "commune_vote_ballots_vote_voter_unique" UNIQUE ("vote_post_id", "voter_user_id");



ALTER TABLE ONLY "public"."commune_vote_events"
    ADD CONSTRAINT "commune_vote_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_vote_options"
    ADD CONSTRAINT "commune_vote_options_id_vote_unique" UNIQUE ("id", "vote_post_id");



ALTER TABLE ONLY "public"."commune_vote_options"
    ADD CONSTRAINT "commune_vote_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commune_vote_posts"
    ADD CONSTRAINT "commune_vote_posts_pkey" PRIMARY KEY ("post_id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."developer_profiles"
    ADD CONSTRAINT "developer_profiles_developer_slug_key" UNIQUE ("developer_slug");



ALTER TABLE ONLY "public"."developer_profiles"
    ADD CONSTRAINT "developer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."developer_profiles"
    ADD CONSTRAINT "developer_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."library_source_submissions"
    ADD CONSTRAINT "library_source_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."living_library_source_suggestions"
    ADD CONSTRAINT "living_library_source_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_addon_versions"
    ADD CONSTRAINT "marketplace_addon_versions_listing_id_version_key" UNIQUE ("listing_id", "version");



ALTER TABLE ONLY "public"."marketplace_addon_versions"
    ADD CONSTRAINT "marketplace_addon_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_install_intents"
    ADD CONSTRAINT "marketplace_install_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_addon_id_key" UNIQUE ("addon_id");



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."marketplace_publication_events"
    ADD CONSTRAINT "marketplace_publication_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_revocations"
    ADD CONSTRAINT "marketplace_revocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profile_customization"
    ADD CONSTRAINT "profile_customization_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profile_media"
    ADD CONSTRAINT "profile_media_bucket_storage_path_key" UNIQUE ("bucket", "storage_path");



ALTER TABLE ONLY "public"."profile_media"
    ADD CONSTRAINT "profile_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_visibility_settings"
    ADD CONSTRAINT "profile_visibility_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."publishers"
    ADD CONSTRAINT "publishers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishers"
    ADD CONSTRAINT "publishers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_events"
    ADD CONSTRAINT "review_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_items"
    ADD CONSTRAINT "review_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_handoff_events"
    ADD CONSTRAINT "sandbox_handoff_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stewardship_organizations"
    ADD CONSTRAINT "stewardship_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stewardship_organizations"
    ADD CONSTRAINT "stewardship_organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stewardship_receipt_files"
    ADD CONSTRAINT "stewardship_receipt_files_bucket_storage_path_key" UNIQUE ("bucket", "storage_path");



ALTER TABLE ONLY "public"."stewardship_receipt_files"
    ADD CONSTRAINT "stewardship_receipt_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stewardship_recognition_requests"
    ADD CONSTRAINT "stewardship_recognition_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_followed_commune_threads"
    ADD CONSTRAINT "user_followed_commune_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_followed_commune_threads"
    ADD CONSTRAINT "user_followed_commune_threads_user_id_thread_id_key" UNIQUE ("user_id", "thread_id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_addons"
    ADD CONSTRAINT "user_saved_addons_pkey" PRIMARY KEY ("user_id", "addon_slug");



ALTER TABLE ONLY "public"."user_saved_citations"
    ADD CONSTRAINT "user_saved_citations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_commune_posts"
    ADD CONSTRAINT "user_saved_commune_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_commune_posts"
    ADD CONSTRAINT "user_saved_commune_posts_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."user_saved_living_sources"
    ADD CONSTRAINT "user_saved_living_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_living_sources"
    ADD CONSTRAINT "user_saved_living_sources_user_id_source_id_key" UNIQUE ("user_id", "source_id");



ALTER TABLE ONLY "public"."user_source_collection_items"
    ADD CONSTRAINT "user_source_collection_items_collection_id_source_id_key" UNIQUE ("collection_id", "source_id");



ALTER TABLE ONLY "public"."user_source_collection_items"
    ADD CONSTRAINT "user_source_collection_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_source_collections"
    ADD CONSTRAINT "user_source_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_role_submissions"
    ADD CONSTRAINT "work_role_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_with_request_files"
    ADD CONSTRAINT "work_with_request_files_bucket_storage_path_key" UNIQUE ("bucket", "storage_path");



ALTER TABLE ONLY "public"."work_with_request_files"
    ADD CONSTRAINT "work_with_request_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_with_requests"
    ADD CONSTRAINT "work_with_requests_pkey" PRIMARY KEY ("id");



CREATE INDEX "addon_drafts_owner_idx" ON "public"."addon_drafts" USING "btree" ("owner_user_id", "updated_at" DESC);



CREATE INDEX "addon_packages_draft_idx" ON "public"."addon_packages" USING "btree" ("addon_draft_id", "created_at" DESC);



CREATE INDEX "addon_submission_snapshots_developer_idx" ON "public"."addon_submission_snapshots" USING "btree" ("developer_user_id", "created_at" DESC);



CREATE INDEX "addon_submission_snapshots_draft_idx" ON "public"."addon_submission_snapshots" USING "btree" ("draft_id", "created_at" DESC);



CREATE INDEX "addon_submission_snapshots_submission_idx" ON "public"."addon_submission_snapshots" USING "btree" ("submission_id", "created_at" DESC);



CREATE INDEX "addon_submissions_submitter_idx" ON "public"."addon_submissions" USING "btree" ("submitted_by", "submitted_at" DESC);



CREATE INDEX "addon_validation_results_draft_idx" ON "public"."addon_validation_results" USING "btree" ("addon_draft_id", "created_at" DESC);



CREATE INDEX "admin_audit_log_created_idx" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_log_target_idx" ON "public"."admin_audit_log" USING "btree" ("target_type", "target_id");



CREATE INDEX "badge_audit_log_badge_idx" ON "public"."badge_audit_log" USING "btree" ("badge_slug", "created_at" DESC);



CREATE INDEX "badge_audit_log_target_idx" ON "public"."badge_audit_log" USING "btree" ("target_user_id", "created_at" DESC);



CREATE UNIQUE INDEX "badge_credit_events_one_active_contribution_credit" ON "public"."badge_credit_events" USING "btree" ("user_id", "credit_type", "contribution_type", "contribution_id") WHERE (("contribution_id" IS NOT NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "badge_credit_events_review_idx" ON "public"."badge_credit_events" USING "btree" ("review_item_id");



CREATE INDEX "badge_credit_events_user_type_idx" ON "public"."badge_credit_events" USING "btree" ("user_id", "credit_type", "revoked_at");



CREATE UNIQUE INDEX "badge_rules_one_active_rule" ON "public"."badge_rules" USING "btree" ("badge_slug", "rule_type", COALESCE("required_credit_type", ''::"text")) WHERE ("is_active" = true);



CREATE INDEX "commune_audit_log_created_idx" ON "public"."commune_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "commune_audit_log_target_idx" ON "public"."commune_audit_log" USING "btree" ("target_type", "target_id");



CREATE INDEX "commune_code_annotations_document_idx" ON "public"."commune_code_annotations" USING "btree" ("document_id", "line_start", "created_at");



CREATE INDEX "commune_code_diagnostics_document_idx" ON "public"."commune_code_diagnostics" USING "btree" ("code_document_id", "created_at" DESC);



CREATE INDEX "commune_code_diagnostics_post_idx" ON "public"."commune_code_diagnostics" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "commune_code_diagnostics_run_idx" ON "public"."commune_code_diagnostics" USING "btree" ("run_id", "created_at");



CREATE INDEX "commune_code_document_versions_document_idx" ON "public"."commune_code_document_versions" USING "btree" ("document_id", "version_number" DESC);



CREATE INDEX "commune_code_documents_owner_idx" ON "public"."commune_code_documents" USING "btree" ("owner_user_id", "updated_at" DESC);



CREATE INDEX "commune_code_documents_visibility_idx" ON "public"."commune_code_documents" USING "btree" ("visibility_state", "updated_at" DESC);



CREATE INDEX "commune_code_moderation_events_document_idx" ON "public"."commune_code_moderation_events" USING "btree" ("document_id", "created_at" DESC);



CREATE INDEX "commune_code_reports_status_idx" ON "public"."commune_code_reports" USING "btree" ("report_status", "created_at" DESC);



CREATE INDEX "commune_code_revision_author_idx" ON "public"."commune_code_revision_proposals" USING "btree" ("original_author_user_id", "proposal_status", "created_at" DESC);



CREATE INDEX "commune_code_revision_post_idx" ON "public"."commune_code_revision_proposals" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "commune_code_revision_proposer_idx" ON "public"."commune_code_revision_proposals" USING "btree" ("proposer_user_id", "proposal_status", "created_at" DESC);



CREATE INDEX "commune_code_revision_snippet_idx" ON "public"."commune_code_revision_proposals" USING "btree" ("code_snippet_id", "created_at" DESC);



CREATE INDEX "commune_code_sessions_document_idx" ON "public"."commune_code_sessions" USING "btree" ("document_id", "updated_at" DESC);



CREATE INDEX "commune_code_snippets_post_idx" ON "public"."commune_code_snippets" USING "btree" ("post_id", "created_at");



CREATE INDEX "commune_comments_parent_idx" ON "public"."commune_comments" USING "btree" ("parent_comment_id", "created_at") WHERE ("parent_comment_id" IS NOT NULL);



CREATE INDEX "commune_comments_post_idx" ON "public"."commune_comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "commune_comments_published_idx" ON "public"."commune_comments" USING "btree" ("published_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "commune_comments_thread_status_idx" ON "public"."commune_comments" USING "btree" ("thread_id", "status", "created_at");



CREATE INDEX "commune_comments_user_status_idx" ON "public"."commune_comments" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "commune_comments_visibility_post_idx" ON "public"."commune_comments" USING "btree" ("post_id", "visibility_state", "created_at");



CREATE INDEX "commune_content_reactions_reaction_idx" ON "public"."commune_content_reactions" USING "btree" ("reaction");



CREATE INDEX "commune_content_reactions_target_cleanup_idx" ON "public"."commune_content_reactions" USING "btree" ("target_type", "target_id");



CREATE INDEX "commune_content_reactions_target_idx" ON "public"."commune_content_reactions" USING "btree" ("target_type", "target_id");



CREATE INDEX "commune_iteration_showcases_owner_status_idx" ON "public"."commune_iteration_showcases" USING "btree" ("author_user_id", "status", "updated_at" DESC);



CREATE INDEX "commune_iteration_showcases_post_idx" ON "public"."commune_iteration_showcases" USING "btree" ("post_id");



CREATE INDEX "commune_iteration_showcases_related_repo_idx" ON "public"."commune_iteration_showcases" USING "btree" ("related_repo_url");



CREATE INDEX "commune_iteration_showcases_sandbox_request_idx" ON "public"."commune_iteration_showcases" USING "btree" ("sandbox_review_request_id");



CREATE INDEX "commune_iteration_showcases_sandbox_review_idx" ON "public"."commune_iteration_showcases" USING "btree" ("sandbox_review_requested", "sandbox_review_status", "updated_at" DESC);



CREATE INDEX "commune_job_posts_author_status_idx" ON "public"."commune_job_posts" USING "btree" ("author_user_id", "application_status", "updated_at" DESC);



CREATE INDEX "commune_job_posts_deadline_idx" ON "public"."commune_job_posts" USING "btree" ("deadline");



CREATE INDEX "commune_job_posts_post_idx" ON "public"."commune_job_posts" USING "btree" ("post_id");



CREATE INDEX "commune_job_posts_review_idx" ON "public"."commune_job_posts" USING "btree" ("anti_scam_review_status", "updated_at" DESC);



CREATE INDEX "commune_job_posts_role_idx" ON "public"."commune_job_posts" USING "btree" ("role_type", "paid_volunteer_status", "location_mode");



CREATE INDEX "commune_media_owner_idx" ON "public"."commune_media" USING "btree" ("owner_user_id", "created_at" DESC);



CREATE INDEX "commune_media_post_idx" ON "public"."commune_media" USING "btree" ("post_id", "visibility_state");



CREATE INDEX "commune_official_code_post_idx" ON "public"."commune_official_update_code_snippets" USING "btree" ("post_id");



CREATE INDEX "commune_official_code_update_idx" ON "public"."commune_official_update_code_snippets" USING "btree" ("official_update_id", "sort_order", "created_at");



CREATE INDEX "commune_official_events_post_idx" ON "public"."commune_official_update_events" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "commune_official_events_update_idx" ON "public"."commune_official_update_events" USING "btree" ("official_update_id", "created_at" DESC);



CREATE INDEX "commune_official_updates_admin_status_idx" ON "public"."commune_official_updates" USING "btree" ("admin_user_id", "official_status", "updated_at" DESC);



CREATE INDEX "commune_official_updates_post_idx" ON "public"."commune_official_updates" USING "btree" ("post_id");



CREATE INDEX "commune_official_updates_priority_idx" ON "public"."commune_official_updates" USING "btree" ("pinned" DESC, "important" DESC, "severity", "published_at" DESC);



CREATE INDEX "commune_official_updates_type_status_idx" ON "public"."commune_official_updates" USING "btree" ("update_type", "official_status", "published_at" DESC);



CREATE INDEX "commune_posts_category_status_idx" ON "public"."commune_posts" USING "btree" ("category_id", "status", "published_at" DESC);



CREATE INDEX "commune_posts_visibility_state_idx" ON "public"."commune_posts" USING "btree" ("visibility_state", "updated_at" DESC);



CREATE INDEX "commune_realtime_room_idx" ON "public"."commune_realtime_messages" USING "btree" ("room_slug", "created_at" DESC);



CREATE INDEX "commune_repo_showcases_owner_idx" ON "public"."commune_repo_showcases" USING "btree" ("owner_user_id", "created_at" DESC);



CREATE INDEX "commune_repo_showcases_visibility_idx" ON "public"."commune_repo_showcases" USING "btree" ("visibility_state", "created_at" DESC);



CREATE INDEX "commune_reports_status_idx" ON "public"."commune_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "commune_reports_target_idx" ON "public"."commune_reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "commune_research_notes_author_status_idx" ON "public"."commune_research_notes" USING "btree" ("author_user_id", "review_status", "updated_at" DESC);



CREATE INDEX "commune_research_notes_evidence_domain_idx" ON "public"."commune_research_notes" USING "btree" ("evidence_strength", "domain");



CREATE INDEX "commune_research_notes_living_source_idx" ON "public"."commune_research_notes" USING "btree" ("living_library_source_link");



CREATE INDEX "commune_research_notes_post_idx" ON "public"."commune_research_notes" USING "btree" ("post_id");



CREATE INDEX "commune_research_notes_review_status_idx" ON "public"."commune_research_notes" USING "btree" ("review_status", "updated_at" DESC);



CREATE INDEX "commune_research_notes_source_links_idx" ON "public"."commune_research_notes" USING "gin" ("source_links");



CREATE INDEX "commune_sandbox_handoff_code_document_idx" ON "public"."commune_sandbox_review_requests" USING "btree" ("code_document_id") WHERE ("code_document_id" IS NOT NULL);



CREATE INDEX "commune_sandbox_handoff_owner_idx" ON "public"."commune_sandbox_review_requests" USING "btree" (COALESCE("submitted_by", "user_id"), "created_at" DESC);



CREATE INDEX "commune_sandbox_handoff_review_idx" ON "public"."commune_sandbox_review_requests" USING "btree" ("request_status", "review_status", "created_at" DESC);



CREATE INDEX "commune_sandbox_reviews_status_idx" ON "public"."commune_sandbox_reviews" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "commune_sandbox_reviews_submitter_idx" ON "public"."commune_sandbox_reviews" USING "btree" ("submitted_by", "created_at" DESC);



CREATE INDEX "commune_sandbox_runs_document_idx" ON "public"."commune_sandbox_runs" USING "btree" ("code_document_id", "created_at" DESC);



CREATE INDEX "commune_sandbox_runs_post_idx" ON "public"."commune_sandbox_runs" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "commune_sandbox_runs_requester_idx" ON "public"."commune_sandbox_runs" USING "btree" ("requester_user_id", "created_at" DESC);



CREATE INDEX "commune_sandbox_runs_status_idx" ON "public"."commune_sandbox_runs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "commune_saved_posts_post_cleanup_idx" ON "public"."commune_saved_posts" USING "btree" ("post_id");



CREATE INDEX "commune_thread_participant_approvals_post_idx" ON "public"."commune_thread_participant_approvals" USING "btree" ("post_id");



CREATE UNIQUE INDEX "commune_thread_participant_approvals_thread_user_unique" ON "public"."commune_thread_participant_approvals" USING "btree" ("thread_id", "user_id");



CREATE INDEX "commune_thread_participant_approvals_user_idx" ON "public"."commune_thread_participant_approvals" USING "btree" ("user_id", "revoked_at");



CREATE INDEX "commune_threads_post_cleanup_idx" ON "public"."commune_threads" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);



CREATE INDEX "commune_troubleshooting_author_status_idx" ON "public"."commune_troubleshooting_posts" USING "btree" ("author_user_id", "troubleshooting_status", "updated_at" DESC);



CREATE INDEX "commune_troubleshooting_issue_area_idx" ON "public"."commune_troubleshooting_posts" USING "btree" ("issue_type", "affected_area");



CREATE INDEX "commune_troubleshooting_post_idx" ON "public"."commune_troubleshooting_posts" USING "btree" ("post_id");



CREATE INDEX "commune_troubleshooting_status_idx" ON "public"."commune_troubleshooting_posts" USING "btree" ("troubleshooting_status", "updated_at" DESC);



CREATE INDEX "commune_vote_ballots_option_idx" ON "public"."commune_vote_ballots" USING "btree" ("vote_post_id", "option_id");



CREATE INDEX "commune_vote_ballots_vote_idx" ON "public"."commune_vote_ballots" USING "btree" ("vote_post_id");



CREATE INDEX "commune_vote_ballots_voter_idx" ON "public"."commune_vote_ballots" USING "btree" ("voter_user_id", "updated_at" DESC);



CREATE INDEX "commune_vote_events_visibility_idx" ON "public"."commune_vote_events" USING "btree" ("event_visibility", "created_at" DESC);



CREATE INDEX "commune_vote_events_vote_time_idx" ON "public"."commune_vote_events" USING "btree" ("vote_post_id", "created_at" DESC);



CREATE INDEX "commune_vote_options_order_idx" ON "public"."commune_vote_options" USING "btree" ("vote_post_id", "display_order");



CREATE INDEX "commune_vote_options_vote_idx" ON "public"."commune_vote_options" USING "btree" ("vote_post_id");



CREATE INDEX "commune_vote_posts_created_by_idx" ON "public"."commune_vote_posts" USING "btree" ("created_by", "updated_at" DESC);



CREATE INDEX "commune_vote_posts_official_update_idx" ON "public"."commune_vote_posts" USING "btree" ("official_update_post_id");



CREATE INDEX "commune_vote_posts_status_window_idx" ON "public"."commune_vote_posts" USING "btree" ("vote_status", "opens_at", "closes_at");



CREATE INDEX "content_reports_reporter_idx" ON "public"."content_reports" USING "btree" ("reporter_user_id", "created_at" DESC);



CREATE INDEX "content_reports_status_created_idx" ON "public"."content_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "content_reports_target_idx" ON "public"."content_reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "library_source_submissions_status_idx" ON "public"."library_source_submissions" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "library_source_submissions_submitter_idx" ON "public"."library_source_submissions" USING "btree" ("submitted_by", "created_at" DESC);



CREATE INDEX "review_events_item_created_idx" ON "public"."review_events" USING "btree" ("review_item_id", "created_at" DESC);



CREATE INDEX "review_items_domain_status_idx" ON "public"."review_items" USING "btree" ("domain", "status", "submitted_at" DESC);



CREATE UNIQUE INDEX "review_items_one_source" ON "public"."review_items" USING "btree" ("source_table", "source_id");



CREATE INDEX "sandbox_handoff_events_request_idx" ON "public"."sandbox_handoff_events" USING "btree" ("sandbox_request_id", "created_at" DESC);



CREATE UNIQUE INDEX "user_badges_one_active_badge" ON "public"."user_badges" USING "btree" ("user_id", "badge_key") WHERE ("revoked_at" IS NULL);



CREATE INDEX "user_badges_user_active_idx" ON "public"."user_badges" USING "btree" ("user_id", "revoked_at", "visibility");



CREATE UNIQUE INDEX "user_followed_commune_threads_user_thread_unique" ON "public"."user_followed_commune_threads" USING "btree" ("user_id", "thread_id");



CREATE INDEX "user_notifications_action_url_cleanup_idx" ON "public"."user_notifications" USING "btree" ("action_url") WHERE ("action_url" IS NOT NULL);



CREATE INDEX "user_notifications_source_cleanup_idx" ON "public"."user_notifications" USING "btree" ("source_id") WHERE ("source_id" IS NOT NULL);



CREATE INDEX "user_notifications_user_created_idx" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "user_notifications_user_unread_idx" ON "public"."user_notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE UNIQUE INDEX "user_roles_one_active_role" ON "public"."user_roles" USING "btree" ("user_id", "role") WHERE ("revoked_at" IS NULL);



CREATE UNIQUE INDEX "user_saved_addons_user_slug_unique" ON "public"."user_saved_addons" USING "btree" ("user_id", "addon_slug") WHERE ("addon_slug" IS NOT NULL);



CREATE INDEX "user_saved_commune_posts_post_cleanup_idx" ON "public"."user_saved_commune_posts" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);



CREATE UNIQUE INDEX "user_saved_commune_posts_user_post_unique" ON "public"."user_saved_commune_posts" USING "btree" ("user_id", "post_id") WHERE ("post_id" IS NOT NULL);



CREATE INDEX "work_role_submissions_status_idx" ON "public"."work_role_submissions" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "work_role_submissions_submitter_idx" ON "public"."work_role_submissions" USING "btree" ("submitted_by", "created_at" DESC);



CREATE OR REPLACE TRIGGER "commune_notify_published_comment" AFTER INSERT OR UPDATE OF "status" ON "public"."commune_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_commune_published_comment"();



CREATE OR REPLACE TRIGGER "prevent_locked_addon_compatibility_owner_mutation" BEFORE INSERT OR DELETE OR UPDATE ON "public"."addon_compatibility_results" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_addon_draft_child_mutation"();



CREATE OR REPLACE TRIGGER "prevent_locked_addon_draft_owner_mutation" BEFORE UPDATE ON "public"."addon_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_addon_draft_owner_mutation"();



CREATE OR REPLACE TRIGGER "prevent_locked_addon_packages_owner_mutation" BEFORE INSERT OR DELETE OR UPDATE ON "public"."addon_packages" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_addon_draft_child_mutation"();



CREATE OR REPLACE TRIGGER "prevent_locked_addon_permissions_owner_mutation" BEFORE INSERT OR DELETE OR UPDATE ON "public"."addon_draft_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_addon_draft_child_mutation"();



CREATE OR REPLACE TRIGGER "prevent_locked_addon_validation_owner_mutation" BEFORE INSERT OR DELETE OR UPDATE ON "public"."addon_validation_results" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_locked_addon_draft_child_mutation"();



CREATE OR REPLACE TRIGGER "touch_commune_job_posts_updated_at" BEFORE UPDATE ON "public"."commune_job_posts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_job_posts_updated_at"();



CREATE OR REPLACE TRIGGER "touch_commune_research_notes_updated_at" BEFORE UPDATE ON "public"."commune_research_notes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_research_notes_updated_at"();



CREATE OR REPLACE TRIGGER "touch_commune_troubleshooting_posts_updated_at" BEFORE UPDATE ON "public"."commune_troubleshooting_posts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_troubleshooting_posts_updated_at"();



CREATE OR REPLACE TRIGGER "touch_commune_vote_ballots_updated_at" BEFORE UPDATE ON "public"."commune_vote_ballots" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_vote_ballots_updated_at"();



CREATE OR REPLACE TRIGGER "touch_commune_vote_options_updated_at" BEFORE UPDATE ON "public"."commune_vote_options" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_vote_options_updated_at"();



CREATE OR REPLACE TRIGGER "touch_commune_vote_posts_updated_at" BEFORE UPDATE ON "public"."commune_vote_posts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_commune_vote_posts_updated_at"();



ALTER TABLE ONLY "public"."addon_actions"
    ADD CONSTRAINT "addon_actions_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_audit_log"
    ADD CONSTRAINT "addon_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_compatibility_results"
    ADD CONSTRAINT "addon_compatibility_results_addon_draft_id_fkey" FOREIGN KEY ("addon_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_compatibility_results"
    ADD CONSTRAINT "addon_compatibility_results_addon_package_id_fkey" FOREIGN KEY ("addon_package_id") REFERENCES "public"."addon_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_dependencies"
    ADD CONSTRAINT "addon_dependencies_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_draft_permissions"
    ADD CONSTRAINT "addon_draft_permissions_addon_draft_id_fkey" FOREIGN KEY ("addon_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_draft_permissions"
    ADD CONSTRAINT "addon_draft_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."addon_permission_catalog"("permission_key");



ALTER TABLE ONLY "public"."addon_drafts"
    ADD CONSTRAINT "addon_drafts_developer_profile_id_fkey" FOREIGN KEY ("developer_profile_id") REFERENCES "public"."developer_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_drafts"
    ADD CONSTRAINT "addon_drafts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_drafts"
    ADD CONSTRAINT "addon_drafts_revision_of_draft_id_fkey" FOREIGN KEY ("revision_of_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_drafts"
    ADD CONSTRAINT "addon_drafts_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."addon_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_packages"
    ADD CONSTRAINT "addon_packages_addon_draft_id_fkey" FOREIGN KEY ("addon_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_reviews"
    ADD CONSTRAINT "addon_reviews_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_reviews"
    ADD CONSTRAINT "addon_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."addon_submission_snapshots"
    ADD CONSTRAINT "addon_submission_snapshots_developer_user_id_fkey" FOREIGN KEY ("developer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_submission_snapshots"
    ADD CONSTRAINT "addon_submission_snapshots_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_submission_snapshots"
    ADD CONSTRAINT "addon_submission_snapshots_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."addon_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_submissions"
    ADD CONSTRAINT "addon_submissions_addon_draft_id_fkey" FOREIGN KEY ("addon_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_submissions"
    ADD CONSTRAINT "addon_submissions_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addon_submissions"
    ADD CONSTRAINT "addon_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_validation_results"
    ADD CONSTRAINT "addon_validation_results_addon_draft_id_fkey" FOREIGN KEY ("addon_draft_id") REFERENCES "public"."addon_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_versions"
    ADD CONSTRAINT "addon_versions_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_versions"
    ADD CONSTRAINT "addon_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."badge_audit_log"
    ADD CONSTRAINT "badge_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."badge_audit_log"
    ADD CONSTRAINT "badge_audit_log_badge_slug_fkey" FOREIGN KEY ("badge_slug") REFERENCES "public"."badge_definitions"("badge_key");



ALTER TABLE ONLY "public"."badge_audit_log"
    ADD CONSTRAINT "badge_audit_log_credit_event_id_fkey" FOREIGN KEY ("credit_event_id") REFERENCES "public"."badge_credit_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."badge_audit_log"
    ADD CONSTRAINT "badge_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."badge_credit_events"
    ADD CONSTRAINT "badge_credit_events_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."badge_credit_events"
    ADD CONSTRAINT "badge_credit_events_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."badge_credit_events"
    ADD CONSTRAINT "badge_credit_events_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."badge_credit_events"
    ADD CONSTRAINT "badge_credit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."badge_rules"
    ADD CONSTRAINT "badge_rules_badge_slug_fkey" FOREIGN KEY ("badge_slug") REFERENCES "public"."badge_definitions"("badge_key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broken_link_reports"
    ADD CONSTRAINT "broken_link_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_abuse_reports"
    ADD CONSTRAINT "commune_abuse_reports_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "public"."commune_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_audit_log"
    ADD CONSTRAINT "commune_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_annotations"
    ADD CONSTRAINT "commune_code_annotations_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_annotations"
    ADD CONSTRAINT "commune_code_annotations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_diagnostics"
    ADD CONSTRAINT "commune_code_diagnostics_code_document_id_fkey" FOREIGN KEY ("code_document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_diagnostics"
    ADD CONSTRAINT "commune_code_diagnostics_code_version_id_fkey" FOREIGN KEY ("code_version_id") REFERENCES "public"."commune_code_document_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_diagnostics"
    ADD CONSTRAINT "commune_code_diagnostics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_diagnostics"
    ADD CONSTRAINT "commune_code_diagnostics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."commune_sandbox_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_document_versions"
    ADD CONSTRAINT "commune_code_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_document_versions"
    ADD CONSTRAINT "commune_code_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_documents"
    ADD CONSTRAINT "commune_code_documents_linked_commune_post_id_fkey" FOREIGN KEY ("linked_commune_post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_documents"
    ADD CONSTRAINT "commune_code_documents_linked_sandbox_request_id_fkey" FOREIGN KEY ("linked_sandbox_request_id") REFERENCES "public"."commune_sandbox_review_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_documents"
    ADD CONSTRAINT "commune_code_documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_moderation_events"
    ADD CONSTRAINT "commune_code_moderation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_moderation_events"
    ADD CONSTRAINT "commune_code_moderation_events_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."commune_code_annotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_moderation_events"
    ADD CONSTRAINT "commune_code_moderation_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_reports"
    ADD CONSTRAINT "commune_code_reports_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."commune_code_annotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_reports"
    ADD CONSTRAINT "commune_code_reports_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_reports"
    ADD CONSTRAINT "commune_code_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_reports"
    ADD CONSTRAINT "commune_code_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_code_snippet_id_fkey" FOREIGN KEY ("code_snippet_id") REFERENCES "public"."commune_code_snippets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_original_author_user_id_fkey" FOREIGN KEY ("original_author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_revision_proposals"
    ADD CONSTRAINT "commune_code_revision_proposals_proposer_user_id_fkey" FOREIGN KEY ("proposer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_sessions"
    ADD CONSTRAINT "commune_code_sessions_active_editor_user_id_fkey" FOREIGN KEY ("active_editor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_sessions"
    ADD CONSTRAINT "commune_code_sessions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_snippets"
    ADD CONSTRAINT "commune_code_snippets_accepted_revision_fk" FOREIGN KEY ("accepted_revision_id") REFERENCES "public"."commune_code_revision_proposals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_snippets"
    ADD CONSTRAINT "commune_code_snippets_accepted_revision_proposer_user_id_fkey" FOREIGN KEY ("accepted_revision_proposer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_code_snippets"
    ADD CONSTRAINT "commune_code_snippets_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_code_snippets"
    ADD CONSTRAINT "commune_code_snippets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_comments"
    ADD CONSTRAINT "commune_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_content_reactions"
    ADD CONSTRAINT "commune_content_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_iteration_showcases"
    ADD CONSTRAINT "commune_iteration_showcases_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_iteration_showcases"
    ADD CONSTRAINT "commune_iteration_showcases_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_iteration_showcases"
    ADD CONSTRAINT "commune_iteration_showcases_sandbox_review_request_id_fkey" FOREIGN KEY ("sandbox_review_request_id") REFERENCES "public"."commune_sandbox_review_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_job_posts"
    ADD CONSTRAINT "commune_job_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_media"
    ADD CONSTRAINT "commune_media_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_media"
    ADD CONSTRAINT "commune_media_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_media"
    ADD CONSTRAINT "commune_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_moderation_events"
    ADD CONSTRAINT "commune_moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_official_update_code_snippets"
    ADD CONSTRAINT "commune_official_update_code_snippets_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commune_official_update_code_snippets"
    ADD CONSTRAINT "commune_official_update_code_snippets_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_official_update_code_snippets"
    ADD CONSTRAINT "commune_official_update_code_snippets_official_update_id_fkey" FOREIGN KEY ("official_update_id") REFERENCES "public"."commune_official_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_official_update_code_snippets"
    ADD CONSTRAINT "commune_official_update_code_snippets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_official_update_events"
    ADD CONSTRAINT "commune_official_update_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_official_update_events"
    ADD CONSTRAINT "commune_official_update_events_official_update_id_fkey" FOREIGN KEY ("official_update_id") REFERENCES "public"."commune_official_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_official_update_events"
    ADD CONSTRAINT "commune_official_update_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_superseded_by_update_id_fkey" FOREIGN KEY ("superseded_by_update_id") REFERENCES "public"."commune_official_updates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_official_updates"
    ADD CONSTRAINT "commune_official_updates_supersedes_update_id_fkey" FOREIGN KEY ("supersedes_update_id") REFERENCES "public"."commune_official_updates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_post_requests"
    ADD CONSTRAINT "commune_post_requests_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_post_requests"
    ADD CONSTRAINT "commune_post_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_posts"
    ADD CONSTRAINT "commune_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."commune_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_posts"
    ADD CONSTRAINT "commune_posts_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_posts"
    ADD CONSTRAINT "commune_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_realtime_messages"
    ADD CONSTRAINT "commune_realtime_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_realtime_messages"
    ADD CONSTRAINT "commune_realtime_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."commune_realtime_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_realtime_reports"
    ADD CONSTRAINT "commune_realtime_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."commune_realtime_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_realtime_reports"
    ADD CONSTRAINT "commune_realtime_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_realtime_reports"
    ADD CONSTRAINT "commune_realtime_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_realtime_reports"
    ADD CONSTRAINT "commune_realtime_reports_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."commune_realtime_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_realtime_rooms"
    ADD CONSTRAINT "commune_realtime_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_repo_showcases"
    ADD CONSTRAINT "commune_repo_showcases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_reports"
    ADD CONSTRAINT "commune_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_reports"
    ADD CONSTRAINT "commune_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_reports"
    ADD CONSTRAINT "commune_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_repository_showcases"
    ADD CONSTRAINT "commune_repository_showcases_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_repository_showcases"
    ADD CONSTRAINT "commune_repository_showcases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_research_notes"
    ADD CONSTRAINT "commune_research_notes_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_room_members"
    ADD CONSTRAINT "commune_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."commune_realtime_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_room_members"
    ADD CONSTRAINT "commune_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_room_moderation_events"
    ADD CONSTRAINT "commune_room_moderation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_room_moderation_events"
    ADD CONSTRAINT "commune_room_moderation_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."commune_realtime_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_room_moderation_events"
    ADD CONSTRAINT "commune_room_moderation_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."commune_realtime_rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_rooms"
    ADD CONSTRAINT "commune_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_code_document_id_fkey" FOREIGN KEY ("code_document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_repository_showcase_id_fkey" FOREIGN KEY ("repository_showcase_id") REFERENCES "public"."commune_repository_showcases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_review_requests"
    ADD CONSTRAINT "commune_sandbox_review_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_sandbox_reviews"
    ADD CONSTRAINT "commune_sandbox_reviews_code_snippet_id_fkey" FOREIGN KEY ("code_snippet_id") REFERENCES "public"."commune_code_snippets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_reviews"
    ADD CONSTRAINT "commune_sandbox_reviews_repo_showcase_id_fkey" FOREIGN KEY ("repo_showcase_id") REFERENCES "public"."commune_repo_showcases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_reviews"
    ADD CONSTRAINT "commune_sandbox_reviews_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_runs"
    ADD CONSTRAINT "commune_sandbox_runs_code_document_id_fkey" FOREIGN KEY ("code_document_id") REFERENCES "public"."commune_code_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_runs"
    ADD CONSTRAINT "commune_sandbox_runs_code_version_id_fkey" FOREIGN KEY ("code_version_id") REFERENCES "public"."commune_code_document_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_runs"
    ADD CONSTRAINT "commune_sandbox_runs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_sandbox_runs"
    ADD CONSTRAINT "commune_sandbox_runs_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_saved_posts"
    ADD CONSTRAINT "commune_saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_saved_posts"
    ADD CONSTRAINT "commune_saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_first_comment_id_fkey" FOREIGN KEY ("first_comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_thread_participant_approvals"
    ADD CONSTRAINT "commune_thread_participant_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_threads"
    ADD CONSTRAINT "commune_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_threads"
    ADD CONSTRAINT "commune_threads_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_threads"
    ADD CONSTRAINT "commune_threads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_threads"
    ADD CONSTRAINT "commune_threads_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."commune_rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_accepted_comment_id_fkey" FOREIGN KEY ("accepted_comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_accepted_proposal_id_fkey" FOREIGN KEY ("accepted_proposal_id") REFERENCES "public"."commune_code_revision_proposals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_troubleshooting_posts"
    ADD CONSTRAINT "commune_troubleshooting_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."commune_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_repository_showcase_id_fkey" FOREIGN KEY ("repository_showcase_id") REFERENCES "public"."commune_repository_showcases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_uploads"
    ADD CONSTRAINT "commune_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_ballots"
    ADD CONSTRAINT "commune_vote_ballots_option_same_vote_fk" FOREIGN KEY ("option_id", "vote_post_id") REFERENCES "public"."commune_vote_options"("id", "vote_post_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_ballots"
    ADD CONSTRAINT "commune_vote_ballots_vote_post_id_fkey" FOREIGN KEY ("vote_post_id") REFERENCES "public"."commune_vote_posts"("post_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_ballots"
    ADD CONSTRAINT "commune_vote_ballots_voter_user_id_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_events"
    ADD CONSTRAINT "commune_vote_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_vote_events"
    ADD CONSTRAINT "commune_vote_events_vote_post_id_fkey" FOREIGN KEY ("vote_post_id") REFERENCES "public"."commune_vote_posts"("post_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_options"
    ADD CONSTRAINT "commune_vote_options_vote_post_id_fkey" FOREIGN KEY ("vote_post_id") REFERENCES "public"."commune_vote_posts"("post_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commune_vote_posts"
    ADD CONSTRAINT "commune_vote_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_vote_posts"
    ADD CONSTRAINT "commune_vote_posts_official_update_post_id_fkey" FOREIGN KEY ("official_update_post_id") REFERENCES "public"."commune_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commune_vote_posts"
    ADD CONSTRAINT "commune_vote_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."commune_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."developer_profiles"
    ADD CONSTRAINT "developer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."library_source_submissions"
    ADD CONSTRAINT "library_source_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."library_source_submissions"
    ADD CONSTRAINT "library_source_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."living_library_source_suggestions"
    ADD CONSTRAINT "living_library_source_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_addon_versions"
    ADD CONSTRAINT "marketplace_addon_versions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_addon_versions"
    ADD CONSTRAINT "marketplace_addon_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."addon_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_install_intents"
    ADD CONSTRAINT "marketplace_install_intents_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."marketplace_addon_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_install_intents"
    ADD CONSTRAINT "marketplace_install_intents_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_install_intents"
    ADD CONSTRAINT "marketplace_install_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_developer_profile_id_fkey" FOREIGN KEY ("developer_profile_id") REFERENCES "public"."developer_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."addon_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_publication_events"
    ADD CONSTRAINT "marketplace_publication_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_publication_events"
    ADD CONSTRAINT "marketplace_publication_events_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."marketplace_addon_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_publication_events"
    ADD CONSTRAINT "marketplace_publication_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_revocations"
    ADD CONSTRAINT "marketplace_revocations_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "public"."marketplace_addon_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_revocations"
    ADD CONSTRAINT "marketplace_revocations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_revocations"
    ADD CONSTRAINT "marketplace_revocations_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_customization"
    ADD CONSTRAINT "profile_customization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_media"
    ADD CONSTRAINT "profile_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_visibility_settings"
    ADD CONSTRAINT "profile_visibility_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publishers"
    ADD CONSTRAINT "publishers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_events"
    ADD CONSTRAINT "review_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."review_events"
    ADD CONSTRAINT "review_events_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_items"
    ADD CONSTRAINT "review_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."review_items"
    ADD CONSTRAINT "review_items_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."review_items"
    ADD CONSTRAINT "review_items_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sandbox_handoff_events"
    ADD CONSTRAINT "sandbox_handoff_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sandbox_handoff_events"
    ADD CONSTRAINT "sandbox_handoff_events_sandbox_request_id_fkey" FOREIGN KEY ("sandbox_request_id") REFERENCES "public"."commune_sandbox_review_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stewardship_recognition_requests"
    ADD CONSTRAINT "stewardship_receipt_file_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."stewardship_receipt_files"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."stewardship_receipt_files"
    ADD CONSTRAINT "stewardship_receipt_files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."stewardship_recognition_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stewardship_receipt_files"
    ADD CONSTRAINT "stewardship_receipt_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stewardship_recognition_requests"
    ADD CONSTRAINT "stewardship_recognition_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."stewardship_organizations"("id");



ALTER TABLE ONLY "public"."stewardship_recognition_requests"
    ADD CONSTRAINT "stewardship_recognition_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_key_fkey" FOREIGN KEY ("badge_key") REFERENCES "public"."badge_definitions"("badge_key");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_followed_commune_threads"
    ADD CONSTRAINT "user_followed_commune_threads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."commune_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_followed_commune_threads"
    ADD CONSTRAINT "user_followed_commune_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_addons"
    ADD CONSTRAINT "user_saved_addons_addon_slug_fkey" FOREIGN KEY ("addon_slug") REFERENCES "public"."addons"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_addons"
    ADD CONSTRAINT "user_saved_addons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_citations"
    ADD CONSTRAINT "user_saved_citations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_commune_posts"
    ADD CONSTRAINT "user_saved_commune_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_living_sources"
    ADD CONSTRAINT "user_saved_living_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_source_collection_items"
    ADD CONSTRAINT "user_source_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."user_source_collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_source_collections"
    ADD CONSTRAINT "user_source_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_role_submissions"
    ADD CONSTRAINT "work_role_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_role_submissions"
    ADD CONSTRAINT "work_role_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_with_request_files"
    ADD CONSTRAINT "work_with_request_files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."work_with_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_with_request_files"
    ADD CONSTRAINT "work_with_request_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_with_requests"
    ADD CONSTRAINT "work_with_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "active editors update code sessions" ON "public"."commune_code_sessions" FOR UPDATE TO "authenticated" USING ((("active_editor_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_sessions"."document_id") AND ("doc"."owner_user_id" = "auth"."uid"())))) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))) WITH CHECK ((("active_editor_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_sessions"."document_id") AND ("doc"."owner_user_id" = "auth"."uid"())))) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



ALTER TABLE "public"."addon_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_compatibility_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_draft_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_permission_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_submission_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_validation_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins create direct published commune posts" ON "public"."commune_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."current_user_is_admin"() AND ("status" = 'published'::"public"."commune_post_status") AND ("visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("moderation_status", 'approved'::"text") = 'approved'::"text")));



CREATE POLICY "admins create official update events" ON "public"."commune_official_update_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() AND (("actor_id" IS NULL) OR ("actor_id" = "auth"."uid"()))));



CREATE POLICY "admins create vote events" ON "public"."commune_vote_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() AND (("actor_user_id" IS NULL) OR ("actor_user_id" = "auth"."uid"()))));



CREATE POLICY "admins insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "admins manage addons" ON "public"."addons" USING ("public"."is_marketplace_admin"()) WITH CHECK ("public"."is_marketplace_admin"());



CREATE POLICY "admins manage badge definitions" ON "public"."badge_definitions" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage badge rules" ON "public"."badge_rules" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage commune categories" ON "public"."commune_categories" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage official update code" ON "public"."commune_official_update_code_snippets" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage official update metadata" ON "public"."commune_official_updates" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage permission catalog" ON "public"."addon_permission_catalog" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage reviews" ON "public"."addon_reviews" USING ("public"."is_marketplace_admin"()) WITH CHECK ("public"."is_marketplace_admin"());



CREATE POLICY "admins manage stewardship organizations" ON "public"."stewardship_organizations" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage vote ballots" ON "public"."commune_vote_ballots" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage vote metadata" ON "public"."commune_vote_posts" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins manage vote options" ON "public"."commune_vote_options" TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins read all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."current_user_is_admin"());



CREATE POLICY "admins read all user badges" ON "public"."user_badges" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_create_badge_credit"()));



CREATE POLICY "admins read review versions" ON "public"."addon_versions" FOR SELECT USING ("public"."is_marketplace_admin"());



CREATE POLICY "admins update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_marketplace_admin"()) WITH CHECK ("public"."is_marketplace_admin"());



CREATE POLICY "admins update review versions" ON "public"."addon_versions" FOR UPDATE USING ("public"."is_marketplace_admin"()) WITH CHECK ("public"."is_marketplace_admin"());



CREATE POLICY "admins update roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "admins update vote events" ON "public"."commune_vote_events" FOR UPDATE TO "authenticated" USING ("public"."current_user_is_admin"()) WITH CHECK ("public"."current_user_is_admin"());



CREATE POLICY "authors maintain own unpublished research notes metadata" ON "public"."commune_research_notes" FOR UPDATE TO "authenticated" USING ((("author_user_id" = "auth"."uid"()) AND ("review_status" = ANY (ARRAY['submitted'::"text", 'needs_citation'::"text", 'needs_clarification'::"text", 'source_issue'::"text", 'overclaiming_evidence'::"text", 'corrected'::"text"])))) WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("review_status" = ANY (ARRAY['submitted'::"text", 'needs_citation'::"text", 'needs_clarification'::"text", 'source_issue'::"text", 'overclaiming_evidence'::"text", 'corrected'::"text"]))));



CREATE POLICY "authors resolve own code annotations" ON "public"."commune_code_annotations" FOR UPDATE TO "authenticated" USING ((("author_user_id" = "auth"."uid"()) AND ("visibility_state" = 'published'::"text"))) WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("visibility_state" = 'published'::"text")));



CREATE POLICY "authors update troubleshooting status and resolution" ON "public"."commune_troubleshooting_posts" FOR UPDATE TO "authenticated" USING (("author_user_id" = "auth"."uid"())) WITH CHECK (("author_user_id" = "auth"."uid"()));



ALTER TABLE "public"."badge_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badge_credit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badge_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badge_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broken_link_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "code proposal participants read relevant proposals" ON "public"."commune_code_revision_proposals" FOR SELECT TO "authenticated" USING ((("proposer_user_id" = "auth"."uid"()) OR ("original_author_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "commune reviewers create review notifications" ON "public"."user_notifications" FOR INSERT TO "authenticated" WITH CHECK ((("notification_type" ~~ 'commune_%'::"text") AND "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "commune trigger creates own notifications" ON "public"."user_notifications" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



ALTER TABLE "public"."commune_abuse_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_diagnostics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_moderation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_revision_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_code_snippets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_content_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_iteration_showcases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_job_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_language_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_moderation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_official_update_code_snippets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_official_update_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_official_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_post_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_realtime_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_realtime_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_realtime_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_repo_showcases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_repository_showcases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_research_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_room_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_room_moderation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_sandbox_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_sandbox_review_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_sandbox_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_sandbox_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_saved_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_thread_participant_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_troubleshooting_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_vote_ballots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_vote_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_vote_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commune_vote_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "creators insert versions" ON "public"."addon_versions" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "creators read own versions" ON "public"."addon_versions" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "creators update draft versions" ON "public"."addon_versions" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND ("review_status" = ANY (ARRAY['draft'::"text", 'needs_changes'::"text"]))));



ALTER TABLE "public"."developer_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "developers create own addon submission snapshots" ON "public"."addon_submission_snapshots" FOR INSERT TO "authenticated" WITH CHECK ((("developer_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."addon_submissions" "s"
     JOIN "public"."addon_drafts" "d" ON (("d"."id" = "s"."addon_draft_id")))
  WHERE (("s"."id" = "addon_submission_snapshots"."submission_id") AND ("s"."submitted_by" = "auth"."uid"()) AND ("d"."owner_user_id" = "auth"."uid"()))))));



CREATE POLICY "developers read own addon submission snapshots" ON "public"."addon_submission_snapshots" FOR SELECT TO "authenticated" USING ((("developer_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."addon_submissions" "s"
  WHERE (("s"."id" = "addon_submission_snapshots"."submission_id") AND ("s"."submitted_by" = "auth"."uid"())))) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")));



ALTER TABLE "public"."library_source_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."living_library_source_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace reviewers manage addon submission snapshots" ON "public"."addon_submission_snapshots" TO "authenticated" USING ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"));



ALTER TABLE "public"."marketplace_addon_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_install_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_publication_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_revocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "moderators create commune audit log" ON "public"."commune_audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) AND "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "moderators create commune moderation events" ON "public"."commune_moderation_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_id" = "auth"."uid"()) AND "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "moderators manage code annotations" ON "public"."commune_code_annotations" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage code document versions" ON "public"."commune_code_document_versions" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage code documents" ON "public"."commune_code_documents" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage code proposals" ON "public"."commune_code_revision_proposals" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage code reports" ON "public"."commune_code_reports" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune comments" ON "public"."commune_comments" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune media metadata" ON "public"."commune_media" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune posts" ON "public"."commune_posts" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune realtime messages" ON "public"."commune_realtime_messages" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune repo showcases" ON "public"."commune_repo_showcases" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune reports" ON "public"."commune_reports" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune sandbox reviews" ON "public"."commune_sandbox_reviews" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage commune threads" ON "public"."commune_threads" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage iteration showcase metadata" ON "public"."commune_iteration_showcases" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators manage thread participation approvals" ON "public"."commune_thread_participant_approvals" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read code moderation events" ON "public"."commune_code_moderation_events" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read commune audit log" ON "public"."commune_audit_log" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read commune code snippets" ON "public"."commune_code_snippets" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read commune moderation events" ON "public"."commune_moderation_events" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read commune post requests" ON "public"."commune_post_requests" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators read commune reactions" ON "public"."commune_content_reactions" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators update commune abuse reports" ON "public"."commune_abuse_reports" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators update commune post requests" ON "public"."commune_post_requests" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "moderators update commune uploads" ON "public"."commune_uploads" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners and authors read code annotations" ON "public"."commune_code_annotations" FOR SELECT TO "authenticated" USING ((("author_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_annotations"."document_id") AND ("doc"."owner_user_id" = "auth"."uid"())))) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "owners create code document versions" ON "public"."commune_code_document_versions" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_document_versions"."document_id") AND ("doc"."owner_user_id" = "auth"."uid"()) AND ("doc"."visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text"])))))));



CREATE POLICY "owners create code sessions" ON "public"."commune_code_sessions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_sessions"."document_id") AND ("doc"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "owners create publishers" ON "public"."publishers" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "owners read own commune media" ON "public"."commune_media" FOR SELECT TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "owners update own editable code documents" ON "public"."commune_code_documents" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) AND ("visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'archived'::"text"])) AND ("review_status" <> 'security_hold'::"text"))) WITH CHECK ((("owner_user_id" = "auth"."uid"()) AND ("visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'archived'::"text"])) AND ("review_status" <> 'security_hold'::"text")));



CREATE POLICY "owners update own unpublished iteration showcase metadata" ON "public"."commune_iteration_showcases" FOR UPDATE TO "authenticated" USING ((("author_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."review_status", 'pending_review'::"public"."review_status", 'needs_information'::"public"."review_status"])))) WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."review_status", 'pending_review'::"public"."review_status", 'needs_information'::"public"."review_status"]))));



CREATE POLICY "owners update publishers" ON "public"."publishers" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "post authors create own thread participation approvals" ON "public"."commune_thread_participant_approvals" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("approved_by" = "auth"."uid"()) AND ("status" = 'approved'::"text") AND ("approval_source" = 'approved_post_author'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."commune_threads" "t"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = COALESCE("commune_thread_participant_approvals"."post_id", "t"."post_id"))))
  WHERE (("t"."id" = "commune_thread_participant_approvals"."thread_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility"))))));



ALTER TABLE "public"."profile_customization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_visibility_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposers withdraw own code proposals" ON "public"."commune_code_revision_proposals" FOR UPDATE TO "authenticated" USING ((("proposer_user_id" = "auth"."uid"()) AND ("proposal_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_changes'::"text"])))) WITH CHECK ((("proposer_user_id" = "auth"."uid"()) AND ("proposal_status" = 'withdrawn'::"text")));



CREATE POLICY "public action rows for approved versions" ON "public"."addon_actions" FOR SELECT USING (("addon_version_id" IN ( SELECT "addon_versions"."id"
   FROM "public"."addon_versions"
  WHERE ("addon_versions"."review_status" = 'approved'::"text"))));



CREATE POLICY "public approved addons readable" ON "public"."addons" FOR SELECT USING (("status" = ANY (ARRAY['approved'::"text", 'deprecated'::"text"])));



CREATE POLICY "public approved versions readable" ON "public"."addon_versions" FOR SELECT USING (("review_status" = 'approved'::"text"));



CREATE POLICY "public can read published troubleshooting metadata" ON "public"."commune_troubleshooting_posts" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_troubleshooting_posts"."post_id") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))) OR ("author_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public creates content reports" ON "public"."content_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("reporter_user_id" IS NULL) OR ("reporter_user_id" = "auth"."uid"())));



CREATE POLICY "public dependency rows for approved versions" ON "public"."addon_dependencies" FOR SELECT USING (("addon_version_id" IN ( SELECT "addon_versions"."id"
   FROM "public"."addon_versions"
  WHERE ("addon_versions"."review_status" = 'approved'::"text"))));



CREATE POLICY "public profiles are readable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "public reads active badge definitions" ON "public"."badge_definitions" FOR SELECT USING (("is_active" = true));



CREATE POLICY "public reads active commune categories" ON "public"."commune_categories" FOR SELECT USING ((("is_active" = true) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads active developer profiles" ON "public"."developer_profiles" FOR SELECT USING (("status" = ANY (ARRAY['active'::"text", 'trusted'::"text"])));



CREATE POLICY "public reads active permission catalog" ON "public"."addon_permission_catalog" FOR SELECT USING (("is_active" = true));



CREATE POLICY "public reads active profile media" ON "public"."profile_media" FOR SELECT USING ((("status" = 'active'::"text") AND ("bucket" = ANY (ARRAY['profile-avatars'::"text", 'profile-banners'::"text"]))));



CREATE POLICY "public reads active stewardship organizations" ON "public"."stewardship_organizations" FOR SELECT USING ((("is_active" = true) OR "public"."current_user_is_admin"()));



CREATE POLICY "public reads coding cornucopia language policies" ON "public"."commune_language_policies" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public reads coding cornucopia sandbox policies" ON "public"."commune_sandbox_policies" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public reads profile customization" ON "public"."profile_customization" FOR SELECT USING (true);



CREATE POLICY "public reads public commune rooms" ON "public"."commune_rooms" FOR SELECT USING ((("is_public" = true) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads public commune threads" ON "public"."commune_threads" FOR SELECT USING (((("visibility" = 'public'::"text") AND (("post_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_threads"."post_id") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))))) OR ("created_by" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads public source collection items" ON "public"."user_source_collection_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_source_collections" "c"
  WHERE (("c"."id" = "user_source_collection_items"."collection_id") AND ("c"."visibility" = 'public'::"text")))));



CREATE POLICY "public reads public source collections" ON "public"."user_source_collections" FOR SELECT USING (("visibility" = 'public'::"text"));



CREATE POLICY "public reads public vote events" ON "public"."commune_vote_events" FOR SELECT TO "authenticated", "anon" USING (((("event_visibility" = 'public'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."commune_vote_posts" "v"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "v"."post_id")))
  WHERE (("v"."post_id" = "commune_vote_events"."vote_post_id") AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL))))) OR "public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published code annotations" ON "public"."commune_code_annotations" FOR SELECT USING ((("visibility_state" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_annotations"."document_id") AND ("doc"."visibility_state" = 'published'::"text"))))));



CREATE POLICY "public reads published code documents" ON "public"."commune_code_documents" FOR SELECT USING ((("visibility_state" = 'published'::"text") OR ("owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published code versions" ON "public"."commune_code_document_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_document_versions"."document_id") AND (("doc"."visibility_state" = 'published'::"text") OR ("doc"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))))));



CREATE POLICY "public reads published commune code snippets" ON "public"."commune_code_snippets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_code_snippets"."post_id") AND ("p"."status" = 'published'::"public"."commune_post_status")))));



CREATE POLICY "public reads published commune comments" ON "public"."commune_comments" FOR SELECT USING (((("status" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."commune_threads" "t"
     LEFT JOIN "public"."commune_posts" "p" ON (("p"."id" = "t"."post_id")))
  WHERE (("t"."id" = "commune_comments"."thread_id") AND ("t"."visibility" = 'public'::"text") AND (("p"."id" IS NULL) OR (("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility"))))))) OR ("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published commune media metadata" ON "public"."commune_media" FOR SELECT USING ((("visibility_state" = 'published'::"text") AND ("storage_bucket" = 'commune-media'::"text") AND ("media_kind" = ANY (ARRAY['image'::"text", 'code_text'::"text", 'document'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_media"."post_id") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility"))))));



CREATE POLICY "public reads published commune posts" ON "public"."commune_posts" FOR SELECT USING (((("status" = 'published'::"public"."commune_post_status") AND ("visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("hidden_at" IS NULL) AND ("removed_at" IS NULL) AND ("archived_at" IS NULL)) OR ("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published commune realtime messages" ON "public"."commune_realtime_messages" FOR SELECT USING (("visibility_state" = 'published'::"text"));



CREATE POLICY "public reads published commune repo showcases" ON "public"."commune_repo_showcases" FOR SELECT USING (("visibility_state" = 'published'::"text"));



CREATE POLICY "public reads published iteration showcase metadata" ON "public"."commune_iteration_showcases" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_iteration_showcases"."post_id") AND ("p"."post_type" = 'elysia_iteration_showcase'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))) OR ("author_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published job post metadata" ON "public"."commune_job_posts" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_job_posts"."post_id") AND ("p"."post_type" = 'job_post'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))) OR ("author_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published library source submissions" ON "public"."library_source_submissions" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "public reads published official update metadata" ON "public"."commune_official_updates" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_official_updates"."post_id") AND ("p"."post_type" = 'official_update'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))) OR ("admin_user_id" = "auth"."uid"()) OR "public"."current_user_is_admin"()));



CREATE POLICY "public reads published public vote metadata" ON "public"."commune_vote_posts" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_vote_posts"."post_id") AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL)))) OR ("created_by" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published research notes metadata" ON "public"."commune_research_notes" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_research_notes"."post_id") AND ("p"."post_type" = 'research_note'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))) OR ("author_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads published vote options" ON "public"."commune_vote_options" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM ("public"."commune_vote_posts" "v"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "v"."post_id")))
  WHERE (("v"."post_id" = "commune_vote_options"."vote_post_id") AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL)))) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "public reads visibility settings" ON "public"."profile_visibility_settings" FOR SELECT USING (true);



CREATE POLICY "public reads visible official update code" ON "public"."commune_official_update_code_snippets" FOR SELECT TO "authenticated", "anon" USING ((("public_visible" = true) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_official_update_code_snippets"."post_id") AND ("p"."post_type" = 'official_update'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility"))))));



CREATE POLICY "public reads visible user badges" ON "public"."user_badges" FOR SELECT USING ((("visibility" = 'public'::"text") AND ("revoked_at" IS NULL)));



CREATE POLICY "public verified publishers readable" ON "public"."publishers" FOR SELECT USING ((("verified" = true) OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "public_read_active_marketplace_revocations" ON "public"."marketplace_revocations" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "public_read_published_commune_realtime_messages" ON "public"."commune_realtime_messages" FOR SELECT TO "authenticated", "anon" USING ((("visibility_state" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."commune_realtime_rooms" "r"
  WHERE (("r"."visibility_state" = 'published'::"text") AND (("r"."id" = "commune_realtime_messages"."room_id") OR ("r"."slug" = "commune_realtime_messages"."room_slug")))))));



CREATE POLICY "public_read_published_commune_realtime_rooms" ON "public"."commune_realtime_rooms" FOR SELECT TO "authenticated", "anon" USING (("visibility_state" = 'published'::"text"));



CREATE POLICY "public_read_published_marketplace_addon_versions" ON "public"."marketplace_addon_versions" FOR SELECT TO "authenticated", "anon" USING ((("revoked_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."marketplace_listings" "ml"
  WHERE (("ml"."id" = "marketplace_addon_versions"."listing_id") AND ("ml"."listing_status" = 'published'::"text") AND ("ml"."revoked_at" IS NULL))))));



CREATE POLICY "public_read_published_marketplace_listings" ON "public"."marketplace_listings" FOR SELECT TO "authenticated", "anon" USING ((("listing_status" = 'published'::"text") AND ("revoked_at" IS NULL)));



CREATE POLICY "publisher owners insert addons" ON "public"."addons" FOR INSERT WITH CHECK (("publisher_id" IN ( SELECT "publishers"."id"
   FROM "public"."publishers"
  WHERE ("publishers"."owner_id" = "auth"."uid"()))));



CREATE POLICY "publisher owners see drafts" ON "public"."addons" FOR SELECT USING (("publisher_id" IN ( SELECT "publishers"."id"
   FROM "public"."publishers"
  WHERE ("publishers"."owner_id" = "auth"."uid"()))));



CREATE POLICY "publisher owners update addons" ON "public"."addons" FOR UPDATE USING (("publisher_id" IN ( SELECT "publishers"."id"
   FROM "public"."publishers"
  WHERE ("publishers"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."publishers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reporters read own commune reports" ON "public"."commune_reports" FOR SELECT TO "authenticated" USING (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "reporters read own content reports" ON "public"."content_reports" FOR SELECT TO "authenticated" USING (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "review rows visible to related creators" ON "public"."addon_reviews" FOR SELECT USING (("addon_version_id" IN ( SELECT "addon_versions"."id"
   FROM "public"."addon_versions"
  WHERE ("addon_versions"."created_by" = "auth"."uid"()))));



ALTER TABLE "public"."review_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviewers create admin audit log" ON "public"."admin_audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) AND ("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role") OR "public"."current_user_has_role"('commune_moderator'::"public"."app_role") OR "public"."current_user_has_role"('marketplace_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('source_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('guardian_reviewer'::"public"."app_role"))));



CREATE POLICY "reviewers create comments" ON "public"."review_comments" FOR INSERT TO "authenticated" WITH CHECK ((("actor_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_comments"."review_item_id") AND "public"."current_user_can_review_domain"("ri"."domain"))))));



CREATE POLICY "reviewers create review events" ON "public"."review_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_events"."review_item_id") AND "public"."current_user_can_review_domain"("ri"."domain"))))));



CREATE POLICY "reviewers manage content reports" ON "public"."content_reports" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role") OR "public"."current_user_has_role"('commune_moderator'::"public"."app_role") OR "public"."current_user_has_role"('marketplace_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('source_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('guardian_reviewer'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role") OR "public"."current_user_has_role"('commune_moderator'::"public"."app_role") OR "public"."current_user_has_role"('marketplace_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('source_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('guardian_reviewer'::"public"."app_role")));



CREATE POLICY "reviewers manage developer profiles" ON "public"."developer_profiles" TO "authenticated" USING ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"));



CREATE POLICY "reviewers manage job post metadata" ON "public"."commune_job_posts" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "reviewers manage research notes metadata" ON "public"."commune_research_notes" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "reviewers manage sandbox handoff events" ON "public"."sandbox_handoff_events" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "reviewers manage sandbox handoff requests" ON "public"."commune_sandbox_review_requests" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "reviewers manage troubleshooting metadata" ON "public"."commune_troubleshooting_posts" TO "authenticated" USING ("public"."current_user_can_review_domain"('commune'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('commune'::"public"."review_domain"));



CREATE POLICY "reviewers read addon audit log" ON "public"."addon_audit_log" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"));



CREATE POLICY "reviewers read admin audit log" ON "public"."admin_audit_log" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role") OR "public"."current_user_has_role"('commune_moderator'::"public"."app_role") OR "public"."current_user_has_role"('marketplace_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('source_reviewer'::"public"."app_role") OR "public"."current_user_has_role"('guardian_reviewer'::"public"."app_role")));



CREATE POLICY "reviewers read badge audit log" ON "public"."badge_audit_log" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_create_badge_credit"()));



CREATE POLICY "reviewers read badge credit events" ON "public"."badge_credit_events" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_create_badge_credit"()));



CREATE POLICY "reviewers read badge rules" ON "public"."badge_rules" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_create_badge_credit"()));



CREATE POLICY "reviewers read broken link reports" ON "public"."broken_link_reports" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('living_library_broken_link'::"public"."review_domain"));



CREATE POLICY "reviewers read comments" ON "public"."review_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_comments"."review_item_id") AND "public"."current_user_can_review_domain"("ri"."domain")))));



CREATE POLICY "reviewers read official update events" ON "public"."commune_official_update_events" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "reviewers read stewardship receipt files" ON "public"."stewardship_receipt_files" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('stewardship'::"public"."review_domain"));



CREATE POLICY "reviewers read stewardship requests" ON "public"."stewardship_recognition_requests" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('stewardship'::"public"."review_domain"));



CREATE POLICY "reviewers read work with request files" ON "public"."work_with_request_files" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain"));



CREATE POLICY "reviewers read work with requests" ON "public"."work_with_requests" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain"));



CREATE POLICY "reviewers update broken link reports" ON "public"."broken_link_reports" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('living_library_broken_link'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('living_library_broken_link'::"public"."review_domain"));



CREATE POLICY "reviewers update coding cornucopia sandbox runs" ON "public"."commune_sandbox_runs" FOR UPDATE TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "reviewers update review items" ON "public"."review_items" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"("domain")) WITH CHECK ("public"."current_user_can_review_domain"("domain"));



CREATE POLICY "reviewers update stewardship requests" ON "public"."stewardship_recognition_requests" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('stewardship'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('stewardship'::"public"."review_domain"));



CREATE POLICY "reviewers update submissions" ON "public"."addon_submissions" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"));



CREATE POLICY "reviewers update work with requests" ON "public"."work_with_requests" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain"));



CREATE POLICY "reviewers write coding cornucopia diagnostics" ON "public"."commune_code_diagnostics" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "reviewers_insert_commune_room_moderation_events" ON "public"."commune_room_moderation_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_insert_marketplace_publication_events" ON "public"."marketplace_publication_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_commune_realtime_messages" ON "public"."commune_realtime_messages" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_commune_realtime_reports" ON "public"."commune_realtime_reports" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_commune_realtime_rooms" ON "public"."commune_realtime_rooms" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_commune_room_memberships" ON "public"."commune_room_members" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_marketplace_addon_versions" ON "public"."marketplace_addon_versions" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_marketplace_listings" ON "public"."marketplace_listings" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_manage_marketplace_revocations" ON "public"."marketplace_revocations" TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_read_commune_room_moderation_events" ON "public"."commune_room_moderation_events" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



CREATE POLICY "reviewers_read_marketplace_publication_events" ON "public"."marketplace_publication_events" FOR SELECT TO "authenticated" USING (("public"."current_user_is_admin"() OR "public"."current_user_has_role"('reviewer'::"public"."app_role") OR "public"."current_user_has_role"('moderator'::"public"."app_role")));



ALTER TABLE "public"."sandbox_handoff_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "signed in users create commune realtime messages" ON "public"."commune_realtime_messages" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("visibility_state" = 'published'::"text")));



CREATE POLICY "signed users create own job post metadata" ON "public"."commune_job_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_job_posts"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."post_type" = 'job_post'::"public"."commune_post_type") AND ("p"."status" = ANY (ARRAY['pending_review'::"public"."commune_post_status", 'published'::"public"."commune_post_status"])) AND (("p"."status" <> 'published'::"public"."commune_post_status") OR "public"."current_user_is_admin"()))))));



CREATE POLICY "signed users create own research notes metadata" ON "public"."commune_research_notes" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_research_notes"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."post_type" = 'research_note'::"public"."commune_post_type"))))));



CREATE POLICY "signed users create own troubleshooting metadata" ON "public"."commune_troubleshooting_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_troubleshooting_posts"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."post_type" = 'troubleshooting'::"public"."commune_post_type"))))));



CREATE POLICY "signed users propose code revisions" ON "public"."commune_code_revision_proposals" FOR INSERT TO "authenticated" WITH CHECK ((("proposer_user_id" = "auth"."uid"()) AND ("proposal_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."commune_code_snippets" "s"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "s"."post_id")))
  WHERE (("s"."id" = "commune_code_revision_proposals"."code_snippet_id") AND ("s"."post_id" = "s"."post_id") AND ("commune_code_revision_proposals"."original_author_user_id" = "p"."user_id") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility"))))));



CREATE POLICY "source reviewers manage library source submissions" ON "public"."library_source_submissions" TO "authenticated" USING ("public"."current_user_can_review_domain"('living_library_source'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('living_library_source'::"public"."review_domain"));



CREATE POLICY "source reviewers read source suggestions" ON "public"."living_library_source_suggestions" FOR SELECT TO "authenticated" USING ("public"."current_user_can_review_domain"('living_library_source'::"public"."review_domain"));



CREATE POLICY "source reviewers update source suggestions" ON "public"."living_library_source_suggestions" FOR UPDATE TO "authenticated" USING ("public"."current_user_can_review_domain"('living_library_source'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('living_library_source'::"public"."review_domain"));



ALTER TABLE "public"."stewardship_organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stewardship_receipt_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stewardship_recognition_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submitters and reviewers read review events" ON "public"."review_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_events"."review_item_id") AND ("public"."current_user_can_review_domain"("ri"."domain") OR (("ri"."submitted_by" = "auth"."uid"()) AND (COALESCE(("review_events"."metadata" ->> 'visibility'::"text"), 'submitter_visible'::"text") <> 'internal'::"text")))))));



CREATE POLICY "submitters and reviewers read review items" ON "public"."review_items" FOR SELECT TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) OR "public"."current_user_can_review_domain"("domain")));



CREATE POLICY "submitters create own direct commune history events" ON "public"."review_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_id" = "auth"."uid"()) AND ("event_type" = ANY (ARRAY['admin_comment_direct_published'::"text", 'moderator_comment_direct_published'::"text", 'approved_participant_comment_direct_published'::"text"])) AND (COALESCE(("metadata" ->> 'history_only'::"text"), 'false'::"text") = 'true'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_events"."review_item_id") AND ("ri"."domain" = 'commune'::"public"."review_domain") AND ("ri"."source_table" = 'commune_comments'::"text") AND ("ri"."source_id" IS NOT NULL) AND ("ri"."submitted_by" = "auth"."uid"()) AND ("ri"."status" = 'approved'::"public"."review_status"))))));



CREATE POLICY "submitters create review items" ON "public"."review_items" FOR INSERT TO "authenticated" WITH CHECK (("submitted_by" = "auth"."uid"()));



CREATE POLICY "submitters create submitted events" ON "public"."review_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_id" = "auth"."uid"()) AND ("event_type" = 'submitted'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_events"."review_item_id") AND ("ri"."submitted_by" = "auth"."uid"()))))));



CREATE POLICY "submitters read visible comments" ON "public"."review_comments" FOR SELECT TO "authenticated" USING ((("visibility" = 'submitter_visible'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."review_items" "ri"
  WHERE (("ri"."id" = "review_comments"."review_item_id") AND ("ri"."submitted_by" = "auth"."uid"()))))));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_followed_commune_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_citations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_commune_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_living_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_source_collection_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_source_collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users create code annotations" ON "public"."commune_code_annotations" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_annotations"."document_id") AND ("doc"."visibility_state" = ANY (ARRAY['published'::"text", 'submitted'::"text"])) AND ("doc"."review_status" = ANY (ARRAY['open_for_review'::"text", 'changes_requested'::"text", 'resolved'::"text", 'draft'::"text"])))))));



CREATE POLICY "users create code reports" ON "public"."commune_code_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "users create commune abuse reports" ON "public"."commune_abuse_reports" FOR INSERT TO "authenticated" WITH CHECK ((("reporter_user_id" = "auth"."uid"()) OR ("reporter_user_id" IS NULL)));



CREATE POLICY "users create commune reports" ON "public"."commune_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("reporter_user_id" IS NULL) OR ("reporter_user_id" = "auth"."uid"())));



CREATE POLICY "users create own addon audit events" ON "public"."addon_audit_log" FOR INSERT TO "authenticated" WITH CHECK (("actor_user_id" = "auth"."uid"()));



CREATE POLICY "users create own addon packages" ON "public"."addon_packages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_packages"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "users create own code documents" ON "public"."commune_code_documents" FOR INSERT TO "authenticated" WITH CHECK ((("owner_user_id" = "auth"."uid"()) AND ("visibility_state" = 'draft'::"text")));



CREATE POLICY "users create own code moderation events" ON "public"."commune_code_moderation_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) AND (("action" = ANY (ARRAY['document_created'::"text", 'document_updated'::"text", 'version_created'::"text", 'annotation_created'::"text", 'annotation_resolved'::"text", 'document_submitted'::"text", 'document_reported'::"text", 'annotation_reported'::"text", 'edit_lock_acquired'::"text", 'edit_lock_released'::"text"])) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))));



CREATE POLICY "users create own coding cornucopia sandbox run requests" ON "public"."commune_sandbox_runs" FOR INSERT TO "authenticated" WITH CHECK ((("requester_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['requested'::"text", 'sandbox_unavailable'::"text", 'policy_blocked'::"text"]))));



CREATE POLICY "users create own commune comments with thread approval" ON "public"."commune_comments" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("public"."current_user_can_review_domain"('commune'::"public"."review_domain") OR ((NOT (EXISTS ( SELECT 1
   FROM "public"."commune_official_updates" "ou"
  WHERE (("ou"."post_id" = "commune_comments"."post_id") AND ("ou"."comments_enabled" = false))))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."commune_vote_posts" "vp"
  WHERE (("vp"."post_id" = "commune_comments"."post_id") AND ("vp"."allow_comments" = false))))))) AND (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text"])) OR (("status" = 'published'::"text") AND ("public"."current_user_can_review_domain"('commune'::"public"."review_domain") OR (EXISTS ( SELECT 1
   FROM "public"."commune_thread_participant_approvals" "approval"
  WHERE (("approval"."thread_id" = "commune_comments"."thread_id") AND ("approval"."user_id" = "auth"."uid"()) AND ("approval"."status" = 'approved'::"text") AND ("approval"."revoked_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "p"
  WHERE (("p"."id" = "commune_comments"."post_id") AND ("p"."user_id" = "auth"."uid"()) AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility")))))))));



CREATE POLICY "users create own commune drafts" ON "public"."commune_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."commune_post_status", 'pending_review'::"public"."commune_post_status"])) AND ("post_type" <> 'official_update'::"public"."commune_post_type")));



CREATE POLICY "users create own commune reactions" ON "public"."commune_content_reactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users create own commune threads" ON "public"."commune_threads" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "users create own developer profile" ON "public"."developer_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'requested'::"text"]))));



CREATE POLICY "users create own iteration showcase metadata" ON "public"."commune_iteration_showcases" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."review_status", 'pending_review'::"public"."review_status", 'approved'::"public"."review_status"]))));



CREATE POLICY "users create own notifications" ON "public"."user_notifications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users create own sandbox handoff events" ON "public"."sandbox_handoff_events" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_sandbox_review_requests" "r"
  WHERE (("r"."id" = "sandbox_handoff_events"."sandbox_request_id") AND (COALESCE("r"."submitted_by", "r"."user_id") = "auth"."uid"()))))));



CREATE POLICY "users create own submissions" ON "public"."addon_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("submitted_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_submissions"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"()))))));



CREATE POLICY "users create own work role submissions" ON "public"."work_role_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))));



CREATE POLICY "users delete own commune reactions" ON "public"."commune_content_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users delete own legacy commune saved posts" ON "public"."commune_saved_posts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users delete own saved commune posts" ON "public"."user_saved_commune_posts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users delete own validation results" ON "public"."addon_validation_results" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_validation_results"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "users insert broken link reports" ON "public"."broken_link_reports" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR ("user_id" IS NULL))));



CREATE POLICY "users insert own active legacy commune saved posts" ON "public"."commune_saved_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "post"
  WHERE (("post"."id" = "commune_saved_posts"."post_id") AND ("post"."status" = 'published'::"public"."commune_post_status") AND ("post"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("post"."visibility_state", 'published'::"text") = ANY (ARRAY['published'::"text", 'public'::"text"])) AND ("post"."hidden_at" IS NULL) AND ("post"."removed_at" IS NULL) AND ("post"."archived_at" IS NULL))))));



CREATE POLICY "users insert own active saved commune posts" ON "public"."user_saved_commune_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("post_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "post"
  WHERE (("post"."id" = "user_saved_commune_posts"."post_id") AND ("post"."status" = 'published'::"public"."commune_post_status") AND ("post"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("post"."visibility_state", 'published'::"text") = ANY (ARRAY['published'::"text", 'public'::"text"])) AND ("post"."hidden_at" IS NULL) AND ("post"."removed_at" IS NULL) AND ("post"."archived_at" IS NULL)))))));



CREATE POLICY "users insert own commune media metadata" ON "public"."commune_media" FOR INSERT TO "authenticated" WITH CHECK ((("owner_user_id" = "auth"."uid"()) AND ("storage_bucket" = 'commune-media'::"text") AND ("visibility_state" = ANY (ARRAY['submitted'::"text", 'flagged'::"text"])) AND ("media_kind" = ANY (ARRAY['image'::"text", 'document'::"text", 'code_text'::"text", 'other'::"text"]))));



CREATE POLICY "users insert own commune post requests" ON "public"."commune_post_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users insert own commune uploads" ON "public"."commune_uploads" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("bucket" = 'commune-uploads'::"text")));



CREATE POLICY "users insert own open vote ballots" ON "public"."commune_vote_ballots" FOR INSERT TO "authenticated" WITH CHECK ((("voter_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."commune_vote_posts" "v"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "v"."post_id")))
     JOIN "public"."commune_vote_options" "o" ON ((("o"."vote_post_id" = "v"."post_id") AND ("o"."id" = "commune_vote_ballots"."option_id"))))
  WHERE (("v"."post_id" = "commune_vote_ballots"."vote_post_id") AND ("v"."vote_status" = 'open'::"text") AND (("v"."opens_at" IS NULL) OR ("now"() >= "v"."opens_at")) AND (("v"."closes_at" IS NULL) OR ("now"() <= "v"."closes_at")) AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL))))));



CREATE POLICY "users insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") AND ("is_admin" = false)));



CREATE POLICY "users insert own stewardship receipt files" ON "public"."stewardship_receipt_files" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("bucket" = 'stewardship-receipts'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."stewardship_recognition_requests" "r"
  WHERE (("r"."id" = "stewardship_receipt_files"."request_id") AND ("r"."user_id" = "auth"."uid"()))))));



CREATE POLICY "users insert own stewardship requests" ON "public"."stewardship_recognition_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users insert own work with request files" ON "public"."work_with_request_files" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("bucket" = 'work-with-attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."work_with_requests" "r"
  WHERE (("r"."id" = "work_with_request_files"."request_id") AND ("r"."user_id" = "auth"."uid"()))))));



CREATE POLICY "users insert own work with requests" ON "public"."work_with_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "users insert source suggestions" ON "public"."living_library_source_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR ("user_id" IS NULL))));



CREATE POLICY "users manage own addon drafts" ON "public"."addon_drafts" TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"))) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")));



CREATE POLICY "users manage own addon permissions" ON "public"."addon_draft_permissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_draft_permissions"."addon_draft_id") AND (("d"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_draft_permissions"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "users manage own commune code snippets" ON "public"."commune_code_snippets" TO "authenticated" USING (("author_user_id" = "auth"."uid"())) WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "users manage own commune repo showcases" ON "public"."commune_repo_showcases" TO "authenticated" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK ((("owner_user_id" = "auth"."uid"()) AND ("visibility_state" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))));



CREATE POLICY "users manage own commune sandbox reviews" ON "public"."commune_sandbox_reviews" TO "authenticated" USING (("submitted_by" = "auth"."uid"())) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))));



CREATE POLICY "users manage own followed commune threads" ON "public"."user_followed_commune_threads" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own library source submissions" ON "public"."library_source_submissions" TO "authenticated" USING (("submitted_by" = "auth"."uid"())) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))));



CREATE POLICY "users manage own notification preferences" ON "public"."notification_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own notifications" ON "public"."user_notifications" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own profile customization" ON "public"."profile_customization" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own profile media" ON "public"."profile_media" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("bucket" = ANY (ARRAY['profile-avatars'::"text", 'profile-banners'::"text"]))));



CREATE POLICY "users manage own repo showcases" ON "public"."commune_repository_showcases" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users manage own sandbox handoff requests" ON "public"."commune_sandbox_review_requests" TO "authenticated" USING ((COALESCE("submitted_by", "user_id") = "auth"."uid"())) WITH CHECK (((COALESCE("submitted_by", "user_id") = "auth"."uid"()) AND ("request_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'changes_requested'::"text", 'approved_for_local_handoff'::"text"]))));



CREATE POLICY "users manage own sandbox review requests" ON "public"."commune_sandbox_review_requests" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users manage own saved addons" ON "public"."user_saved_addons" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own saved citations" ON "public"."user_saved_citations" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own saved living sources" ON "public"."user_saved_living_sources" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own source collection items" ON "public"."user_source_collection_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_source_collections" "c"
  WHERE (("c"."id" = "user_source_collection_items"."collection_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_source_collections" "c"
  WHERE (("c"."id" = "user_source_collection_items"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "users manage own source collections" ON "public"."user_source_collections" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users manage own visibility settings" ON "public"."profile_visibility_settings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own active roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("revoked_at" IS NULL)));



CREATE POLICY "users read own addon packages" ON "public"."addon_packages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_packages"."addon_draft_id") AND (("d"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"))))));



CREATE POLICY "users read own badges" ON "public"."user_badges" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("revoked_at" IS NULL)));



CREATE POLICY "users read own broken link reports" ON "public"."broken_link_reports" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own code reports" ON "public"."commune_code_reports" FOR SELECT TO "authenticated" USING (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "users read own coding cornucopia diagnostics" ON "public"."commune_code_diagnostics" FOR SELECT TO "authenticated" USING ((("public_visibility" = 'public_summary'::"text") OR "public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain") OR (EXISTS ( SELECT 1
   FROM "public"."commune_sandbox_runs" "run"
  WHERE (("run"."id" = "commune_code_diagnostics"."run_id") AND ("run"."requester_user_id" = "auth"."uid"()))))));



CREATE POLICY "users read own coding cornucopia sandbox runs" ON "public"."commune_sandbox_runs" FOR SELECT TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR "public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users read own commune abuse reports" ON "public"."commune_abuse_reports" FOR SELECT TO "authenticated" USING ((("reporter_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users read own commune post requests" ON "public"."commune_post_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own commune reactions" ON "public"."commune_content_reactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own commune uploads" ON "public"."commune_uploads" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users read own compatibility" ON "public"."addon_compatibility_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_compatibility_results"."addon_draft_id") AND (("d"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"))))));



CREATE POLICY "users read own developer profile" ON "public"."developer_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")));



CREATE POLICY "users read own notifications" ON "public"."user_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own sandbox handoff events" ON "public"."sandbox_handoff_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."commune_sandbox_review_requests" "r"
  WHERE (("r"."id" = "sandbox_handoff_events"."sandbox_request_id") AND (COALESCE("r"."submitted_by", "r"."user_id") = "auth"."uid"())))));



CREATE POLICY "users read own source suggestions" ON "public"."living_library_source_suggestions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own stewardship receipt files" ON "public"."stewardship_receipt_files" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own stewardship requests" ON "public"."stewardship_recognition_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own submissions" ON "public"."addon_submissions" FOR SELECT TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain")));



CREATE POLICY "users read own thread participation approvals" ON "public"."commune_thread_participant_approvals" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users read own validation results" ON "public"."addon_validation_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_validation_results"."addon_draft_id") AND (("d"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('marketplace'::"public"."review_domain"))))));



CREATE POLICY "users read own vote ballots" ON "public"."commune_vote_ballots" FOR SELECT TO "authenticated" USING (((("voter_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."commune_vote_posts" "v"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "v"."post_id")))
  WHERE (("v"."post_id" = "commune_vote_ballots"."vote_post_id") AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL))))) OR "public"."current_user_is_admin"() OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain")));



CREATE POLICY "users read own work role submissions" ON "public"."work_role_submissions" FOR SELECT TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "users read own work with request files" ON "public"."work_with_request_files" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read own work with requests" ON "public"."work_with_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users read relevant code sessions" ON "public"."commune_code_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."commune_code_documents" "doc"
  WHERE (("doc"."id" = "commune_code_sessions"."document_id") AND (("doc"."visibility_state" = 'published'::"text") OR ("doc"."owner_user_id" = "auth"."uid"()) OR "public"."current_user_can_review_domain"('commune'::"public"."review_domain"))))));



CREATE POLICY "users select own active legacy commune saved posts" ON "public"."commune_saved_posts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "post"
  WHERE (("post"."id" = "commune_saved_posts"."post_id") AND ("post"."status" = 'published'::"public"."commune_post_status") AND ("post"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("post"."visibility_state", 'published'::"text") = ANY (ARRAY['published'::"text", 'public'::"text"])) AND ("post"."hidden_at" IS NULL) AND ("post"."removed_at" IS NULL) AND ("post"."archived_at" IS NULL))))));



CREATE POLICY "users select own active saved commune posts" ON "public"."user_saved_commune_posts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (("post_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "post"
  WHERE (("post"."id" = "user_saved_commune_posts"."post_id") AND ("post"."status" = 'published'::"public"."commune_post_status") AND ("post"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("post"."visibility_state", 'published'::"text") = ANY (ARRAY['published'::"text", 'public'::"text"])) AND ("post"."hidden_at" IS NULL) AND ("post"."removed_at" IS NULL) AND ("post"."archived_at" IS NULL)))))));



CREATE POLICY "users update own active saved commune posts" ON "public"."user_saved_commune_posts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (("post_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."commune_posts" "post"
  WHERE (("post"."id" = "user_saved_commune_posts"."post_id") AND ("post"."status" = 'published'::"public"."commune_post_status") AND ("post"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("post"."visibility_state", 'published'::"text") = ANY (ARRAY['published'::"text", 'public'::"text"])) AND ("post"."hidden_at" IS NULL) AND ("post"."removed_at" IS NULL) AND ("post"."archived_at" IS NULL)))))));



CREATE POLICY "users update own badge visibility" ON "public"."user_badges" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("revoked_at" IS NULL))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("revoked_at" IS NULL)));



CREATE POLICY "users update own commune reactions" ON "public"."commune_content_reactions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users update own notifications" ON "public"."user_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users update own open vote ballots" ON "public"."commune_vote_ballots" FOR UPDATE TO "authenticated" USING (("voter_user_id" = "auth"."uid"())) WITH CHECK ((("voter_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."commune_vote_posts" "v"
     JOIN "public"."commune_posts" "p" ON (("p"."id" = "v"."post_id")))
     JOIN "public"."commune_vote_options" "o" ON ((("o"."vote_post_id" = "v"."post_id") AND ("o"."id" = "commune_vote_ballots"."option_id"))))
  WHERE (("v"."post_id" = "commune_vote_ballots"."vote_post_id") AND ("v"."vote_status" = 'open'::"text") AND (("v"."opens_at" IS NULL) OR ("now"() >= "v"."opens_at")) AND (("v"."closes_at" IS NULL) OR ("now"() <= "v"."closes_at")) AND ("p"."post_type" = 'community_vote'::"public"."commune_post_type") AND ("p"."status" = 'published'::"public"."commune_post_status") AND ("p"."visibility" = 'public'::"public"."commune_visibility") AND (COALESCE("p"."visibility_state", 'published'::"text") <> ALL (ARRAY['flagged'::"text", 'hidden'::"text", 'removed'::"text", 'archived'::"text", 'revoked'::"text"])) AND ("p"."hidden_at" IS NULL) AND ("p"."removed_at" IS NULL) AND ("p"."archived_at" IS NULL))))));



CREATE POLICY "users update own profile without admin promotion" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("is_admin" = "public"."is_marketplace_admin"())));



CREATE POLICY "users update own safe developer profile" ON "public"."developer_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'requested'::"text"]))));



CREATE POLICY "users update own unpublished commune comments" ON "public"."commune_comments" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text"])))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'deleted_by_user'::"text"]))));



CREATE POLICY "users update own unpublished commune posts" ON "public"."commune_posts" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."commune_post_status", 'pending_review'::"public"."commune_post_status", 'needs_information'::"public"."commune_post_status"])))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."commune_post_status", 'pending_review'::"public"."commune_post_status", 'needs_information'::"public"."commune_post_status"]))));



CREATE POLICY "users write own compatibility" ON "public"."addon_compatibility_results" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_compatibility_results"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "users write own validation results" ON "public"."addon_validation_results" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."addon_drafts" "d"
  WHERE (("d"."id" = "addon_validation_results"."addon_draft_id") AND ("d"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "users_insert_commune_realtime_reports" ON "public"."commune_realtime_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "users_insert_own_commune_realtime_messages" ON "public"."commune_realtime_messages" FOR INSERT TO "authenticated" WITH CHECK ((("author_user_id" = "auth"."uid"()) AND ("visibility_state" = 'published'::"text") AND (("char_length"("body") >= 1) AND ("char_length"("body") <= 2000)) AND (EXISTS ( SELECT 1
   FROM "public"."commune_realtime_rooms" "r"
  WHERE (("r"."id" = "commune_realtime_messages"."room_id") AND ("r"."visibility_state" = 'published'::"text") AND ("r"."posting_mode" = ANY (ARRAY['open_signed_in'::"text", 'moderated'::"text"])))))));



CREATE POLICY "users_read_own_commune_realtime_reports" ON "public"."commune_realtime_reports" FOR SELECT TO "authenticated" USING (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_commune_room_memberships" ON "public"."commune_room_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_install_intents" ON "public"."marketplace_install_intents" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "work reviewers manage work role submissions" ON "public"."work_role_submissions" TO "authenticated" USING ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain")) WITH CHECK ("public"."current_user_can_review_domain"('work_with'::"public"."review_domain"));



ALTER TABLE "public"."work_role_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_with_request_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_with_requests" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_badge_if_missing"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_source" "text", "p_award_reason" "text", "p_evidence_type" "text", "p_evidence_id" "uuid", "p_actor_user_id" "uuid") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."backfill_free_member_badges"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."commune_vote_result_summary"("target_vote_post_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_badge_credit_event"("p_target_user_id" "uuid", "p_credit_type" "text", "p_credit_amount" integer, "p_contribution_type" "text", "p_contribution_id" "uuid", "p_review_item_id" "uuid", "p_is_major" boolean, "p_distinct_subject_key" "text", "p_notes" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."current_user_can_create_badge_credit"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."decide_commune_code_revision_proposal"("p_proposal_id" "uuid", "p_decision" "text", "p_decision_note" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."evaluate_badges_for_user"("p_target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."grant_free_member_for_user"("p_target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."grant_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_award_reason" "text", "p_evidence_type" "text", "p_evidence_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."record_commune_sandbox_run_result"("p_snapshot_id" "text", "p_source_type" "text", "p_source_id" "text", "p_post_id" "uuid", "p_code_document_id" "uuid", "p_code_version_id" "uuid", "p_language" "text", "p_file_name" "text", "p_status" "text", "p_request_payload" "jsonb", "p_result_summary" "jsonb", "p_stdout_preview" "text", "p_stderr_preview" "text", "p_exit_code" integer, "p_duration_ms" integer, "p_diagnostics" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."revoke_badge_credit_event"("p_credit_event_id" "uuid", "p_revoked_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."revoke_user_badge"("p_target_user_id" "uuid", "p_badge_key" "text", "p_revoked_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."soft_delete_commune_post"("target_post_id" "uuid", "moderation_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_commune_post"("target_post_id" "uuid", "moderation_note" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."submit_commune_code_revision_proposal"("p_post_id" "uuid", "p_code_snippet_id" "uuid", "p_proposed_code_text" "text", "p_language" "text", "p_file_name" "text", "p_change_summary" "text", "p_explanation" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_own_commune_job_post_application_status"("p_job_post_id" "uuid", "p_post_id" "uuid", "p_application_status" "text", "p_public_correction_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_own_commune_job_post_application_status"("p_job_post_id" "uuid", "p_post_id" "uuid", "p_application_status" "text", "p_public_correction_note" "text") TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_actions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_actions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_actions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_audit_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_audit_log" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_audit_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_compatibility_results" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_compatibility_results" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_compatibility_results" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_dependencies" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_dependencies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_dependencies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_draft_permissions" TO "anon";
GRANT ALL ON TABLE "public"."addon_draft_permissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_draft_permissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_drafts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_drafts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_drafts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_packages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_packages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_packages" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_permission_catalog" TO "anon";
GRANT ALL ON TABLE "public"."addon_permission_catalog" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_permission_catalog" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_reviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_reviews" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_reviews" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_submission_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."addon_submission_snapshots" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_submission_snapshots" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_submissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_submissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_validation_results" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_validation_results" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_validation_results" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_versions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addon_versions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addon_versions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addons" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addons" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addons" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_audit_log" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_audit_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_credit_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_credit_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_credit_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_definitions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_definitions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_definitions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_rules" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_rules" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."badge_rules" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."broken_link_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."broken_link_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."broken_link_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_abuse_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_abuse_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_abuse_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_audit_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_audit_log" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_audit_log" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_categories" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_categories" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_annotations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_annotations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_annotations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_diagnostics" TO "anon";
GRANT ALL ON TABLE "public"."commune_code_diagnostics" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_diagnostics" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_document_versions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_document_versions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_document_versions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_documents" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_moderation_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_moderation_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_moderation_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_reports" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_revision_proposals" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_revision_proposals" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_sessions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_sessions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_sessions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_snippets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_code_snippets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_code_snippets" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_comments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_content_reactions" TO "anon";
GRANT ALL ON TABLE "public"."commune_content_reactions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_content_reactions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_content_reaction_counts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_content_reaction_counts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_content_reaction_counts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_iteration_showcases" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_iteration_showcases" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_iteration_showcases" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_job_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_job_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_job_posts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_language_policies" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_language_policies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_language_policies" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_media" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_media" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_media" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_moderation_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_moderation_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_moderation_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_update_code_snippets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_official_update_code_snippets" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_update_code_snippets" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_update_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_update_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_update_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_updates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_official_updates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_official_updates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_post_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_post_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_post_requests" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_posts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_realtime_messages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_realtime_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_reports" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_rooms" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_realtime_rooms" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_realtime_rooms" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_repo_showcases" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_repo_showcases" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_repo_showcases" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_repository_showcases" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_repository_showcases" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_repository_showcases" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_research_notes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_research_notes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_research_notes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_room_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_room_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_room_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_room_moderation_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_room_moderation_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_room_moderation_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_rooms" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_rooms" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_rooms" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_policies" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_policies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_policies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_review_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_sandbox_review_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_review_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_reviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_sandbox_reviews" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_reviews" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_runs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_sandbox_runs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_sandbox_runs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_saved_posts" TO "anon";
GRANT ALL ON TABLE "public"."commune_saved_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_saved_posts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_thread_participant_approvals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_thread_participant_approvals" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_thread_participant_approvals" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_threads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_threads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_threads" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_troubleshooting_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_troubleshooting_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_troubleshooting_posts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_uploads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_uploads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_uploads" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_ballots" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_vote_ballots" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_ballots" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_vote_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_options" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_vote_options" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_options" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."commune_vote_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."commune_vote_posts" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."content_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."content_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."content_reports" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."developer_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."developer_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."developer_profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."library_source_submissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."library_source_submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."library_source_submissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."living_library_source_suggestions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."living_library_source_suggestions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."living_library_source_suggestions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_addon_versions" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_addon_versions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_addon_versions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_install_intents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."marketplace_install_intents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_install_intents" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_listings" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_listings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_listings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_publication_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_publication_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_publication_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_revocations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."marketplace_revocations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."marketplace_revocations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_customization" TO "anon";
GRANT ALL ON TABLE "public"."profile_customization" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_customization" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_media" TO "anon";
GRANT ALL ON TABLE "public"."profile_media" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_media" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_visibility_settings" TO "anon";
GRANT ALL ON TABLE "public"."profile_visibility_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_visibility_settings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."publishers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."publishers" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."publishers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_comments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."review_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."review_items" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sandbox_handoff_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."sandbox_handoff_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sandbox_handoff_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_organizations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."stewardship_organizations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_organizations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_receipt_files" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_receipt_files" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_receipt_files" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_recognition_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."stewardship_recognition_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stewardship_recognition_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_badges" TO "service_role";
GRANT SELECT ON TABLE "public"."user_badges" TO "anon";
GRANT SELECT ON TABLE "public"."user_badges" TO "authenticated";



GRANT UPDATE("visibility") ON TABLE "public"."user_badges" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."user_badges" TO "authenticated";



GRANT ALL ON TABLE "public"."user_followed_commune_threads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_followed_commune_threads" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_addons" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_saved_addons" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_citations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_saved_citations" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_commune_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_saved_commune_posts" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_living_sources" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_saved_living_sources" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_source_collection_items" TO "anon";
GRANT ALL ON TABLE "public"."user_source_collection_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_source_collection_items" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_source_collections" TO "anon";
GRANT ALL ON TABLE "public"."user_source_collections" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_source_collections" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_role_submissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."work_role_submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_role_submissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_with_request_files" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_with_request_files" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_with_request_files" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_with_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."work_with_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_with_requests" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."work_with_requests" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."work_with_requests" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";

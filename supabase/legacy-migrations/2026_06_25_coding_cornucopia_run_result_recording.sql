-- Coding Cornucopia sandbox run result recording.
-- The browser never executes code; this only records results returned by the isolated sandbox runner.

create or replace function public.record_commune_sandbox_run_result(
  p_snapshot_id text,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid,
  p_language text,
  p_file_name text,
  p_status text,
  p_request_payload jsonb,
  p_result_summary jsonb,
  p_stdout_preview text,
  p_stderr_preview text,
  p_exit_code integer,
  p_duration_ms integer,
  p_diagnostics jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.record_commune_sandbox_run_result(text, text, text, uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, text, integer, integer, jsonb) to authenticated;

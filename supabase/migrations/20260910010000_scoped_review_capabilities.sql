-- Owner decision 2026-09-10. Adding capabilities never assigns them to anyone.
-- Separate migration: PostgreSQL enum values must commit before first use.
alter type public.app_role add value if not exists 'work_with_reviewer';
alter type public.app_role add value if not exists 'stewardship_reviewer';

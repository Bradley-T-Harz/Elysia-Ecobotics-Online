alter table public.profiles
  add column if not exists commons_onboarding_completed_at timestamptz,
  add column if not exists stewardship_onboarding_skipped_at timestamptz,
  add column if not exists work_with_onboarding_skipped_at timestamptz;

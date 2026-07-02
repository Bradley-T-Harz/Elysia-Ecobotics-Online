alter table public.profile_customization
  add column if not exists banner_zoom numeric not null default 1,
  add column if not exists banner_position_x numeric not null default 50,
  add column if not exists banner_position_y numeric not null default 50;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_customization_banner_zoom_range'
      and conrelid = 'public.profile_customization'::regclass
  ) then
    alter table public.profile_customization
      add constraint profile_customization_banner_zoom_range
      check (banner_zoom >= 0.5 and banner_zoom <= 2.0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_customization_banner_position_x_range'
      and conrelid = 'public.profile_customization'::regclass
  ) then
    alter table public.profile_customization
      add constraint profile_customization_banner_position_x_range
      check (banner_position_x >= 0 and banner_position_x <= 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_customization_banner_position_y_range'
      and conrelid = 'public.profile_customization'::regclass
  ) then
    alter table public.profile_customization
      add constraint profile_customization_banner_position_y_range
      check (banner_position_y >= 0 and banner_position_y <= 100);
  end if;
end $$;

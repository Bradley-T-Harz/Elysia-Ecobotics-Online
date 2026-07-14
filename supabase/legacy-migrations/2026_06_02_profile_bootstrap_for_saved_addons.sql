-- Bootstrap minimal Marketplace profiles so authenticated users can save add-ons.
-- Saved add-ons reference public.profiles(id), while auth sessions live in auth.users.

insert into public.profiles (id, username, display_name)
select
  users.id,
  ('user_' || replace(left(users.id::text, 12), '-', '')) as username,
  nullif(split_part(coalesce(users.email, ''), '@', 1), '') as display_name
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

create or replace function public.bootstrap_marketplace_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || replace(left(new.id::text, 12), '-', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists marketplace_profile_after_auth_user_created on auth.users;
create trigger marketplace_profile_after_auth_user_created
  after insert on auth.users
  for each row
  execute function public.bootstrap_marketplace_profile_for_auth_user();

comment on function public.bootstrap_marketplace_profile_for_auth_user() is
  'Creates a minimal public Marketplace profile row for saving add-ons. Does not assign admin/developer status or store local Elysia data.';

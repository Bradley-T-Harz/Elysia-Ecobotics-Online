-- Legacy Marketplace publication boundary.
--
-- Deprecated legacy rows are retained for referential history and reviewer
-- access, but they are not public catalog entries. Exact row retirement remains
-- a separately audited administrative operation.

drop policy if exists "public approved addons readable" on public.addons;
create policy "public approved addons readable"
on public.addons
for select
to anon, authenticated
using (status = 'approved');

-- Allow admins to delete accepted/admin-created reservations from the Reserved Book Reviews List.
alter table if exists public.book_reservations enable row level security;

drop policy if exists book_reservations_admin_delete on public.book_reservations;
create policy book_reservations_admin_delete
on public.book_reservations
for delete
to authenticated
using (public.is_admin());

-- No other reservation rows are changed by this migration.

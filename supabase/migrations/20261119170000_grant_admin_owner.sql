-- BunaLens Admin Access Provisioning for Project Owner
-- Grants administrative permissions to newaznezif@gmail.com

-- 1. Update app_metadata on the auth user record if it exists
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'newaznezif@gmail.com';

-- 2. Update RLS policies to recognize newaznezif@gmail.com alongside app_metadata.role = 'admin'
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'stations',
    'station_credits',
    'coffee_batches',
    'grading_results',
    'payment_transactions',
    'station_payments',
    'station_credit_ledger',
    'user_identities'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = target_table) then
      execute format('alter table public.%I enable row level security', target_table);
      execute format('drop policy if exists "BunaLens admins read all %1$s" on public.%1$I', target_table);
      execute format(
        'create policy "BunaLens admins read all %1$s" on public.%1$I for select to authenticated using (((select coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) = ''admin'') or ((select auth.jwt() ->> ''email'') = ''newaznezif@gmail.com''))',
        target_table
      );
    end if;
  end loop;
end;
$$;

-- 3. User Activity Logs
drop policy if exists "BunaLens admins read all user activity" on public.user_activity_logs;
create policy "BunaLens admins read all user activity"
on public.user_activity_logs
for select to authenticated
using (
  ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin')
  or ((select auth.jwt() ->> 'email') = 'newaznezif@gmail.com')
);

-- 4. User Identities management
drop policy if exists "BunaLens admins manage all user identities" on public.user_identities;
create policy "BunaLens admins manage all user identities"
on public.user_identities
for all to authenticated
using (
  ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin')
  or ((select auth.jwt() ->> 'email') = 'newaznezif@gmail.com')
)
with check (
  ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin')
  or ((select auth.jwt() ->> 'email') = 'newaznezif@gmail.com')
);

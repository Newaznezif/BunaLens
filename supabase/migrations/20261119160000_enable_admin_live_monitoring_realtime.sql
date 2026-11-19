-- Enable database change events for the BunaLens admin live-monitoring workspace.
-- Realtime still enforces the existing table RLS policies for authenticated admins.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['coffee_batches', 'user_activity_logs', 'stations', 'station_payments']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

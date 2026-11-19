-- Allow authenticated BunaLens admins to inspect private coffee sample images.
-- Also stream detailed grading result changes to the admin Batch Management workspace.
create policy "BunaLens admins read coffee samples"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'coffee-samples'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'grading_results'
  ) then
    alter publication supabase_realtime add table public.grading_results;
  end if;
end $$;

create table if not exists public.grading_rule_sets (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  name text not null check (length(btrim(name)) between 2 and 100),
  description text not null default '',
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint grading_rule_sets_active_timestamp check (status <> 'active' or activated_at is not null)
);

create unique index if not exists grading_rule_sets_one_active_idx
  on public.grading_rule_sets ((status)) where status = 'active';

alter table public.grading_rule_sets enable row level security;

create policy "BunaLens admins read grading rule sets"
  on public.grading_rule_sets for select to authenticated
  using ((select coalesce(auth.jwt()->'app_metadata'->>'role','')) = 'admin');

create policy "BunaLens admins create grading rule sets"
  on public.grading_rule_sets for insert to authenticated
  with check (
    (select coalesce(auth.jwt()->'app_metadata'->>'role','')) = 'admin'
    and (created_by is null or created_by = (select auth.uid()))
    and status = 'draft'
  );

create policy "BunaLens admins update grading rule sets"
  on public.grading_rule_sets for update to authenticated
  using ((select coalesce(auth.jwt()->'app_metadata'->>'role','')) = 'admin')
  with check ((select coalesce(auth.jwt()->'app_metadata'->>'role','')) = 'admin');

grant select, insert, update on public.grading_rule_sets to authenticated;

create or replace function public.guard_grading_rule_set_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('active','archived') and (
    new.version is distinct from old.version
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.rules is distinct from old.rules
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Activated grading rule sets are immutable. Create a new version.';
  end if;
  if old.status = 'archived' and new.status is distinct from old.status then
    raise exception 'Archived grading rule sets cannot be reactivated.';
  end if;
  if new.status not in ('draft','active','archived') then
    raise exception 'Invalid grading rule set status.';
  end if;
  if old.status = 'draft' and new.status = 'active' and new.activated_at is null then
    new.activated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists grading_rule_sets_guard_update on public.grading_rule_sets;
create trigger grading_rule_sets_guard_update
before update on public.grading_rule_sets
for each row execute function public.guard_grading_rule_set_update();

create or replace function public.activate_grading_rule_set(p_rule_set_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.grading_rule_sets where id = p_rule_set_id and status = 'draft') then
    raise exception 'Only a draft grading rule set can be activated.';
  end if;
  update public.grading_rule_sets set status = 'archived' where status = 'active';
  update public.grading_rule_sets set status = 'active', activated_at = now()
   where id = p_rule_set_id and status = 'draft';
end;
$$;

revoke all on function public.activate_grading_rule_set(uuid) from public, anon;
grant execute on function public.activate_grading_rule_set(uuid) to authenticated;

insert into public.grading_rule_sets(version,name,description,rules,status,activated_at)
values (1,'Baseline — unclassified',
'Initial platform baseline. No score-to-grade thresholds are configured. Existing AI visual estimates remain unclassified unless the assessment pipeline explicitly records a validated mapping.',
'[]'::jsonb,'active',now())
on conflict (version) do nothing;

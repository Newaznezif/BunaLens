create table if not exists public.certificate_templates (
 id uuid primary key default gen_random_uuid(),
 version integer not null unique check(version>0),
 name text not null check(length(btrim(name)) between 2 and 100),
 organization_name text not null default 'BunaLens',
 certificate_title text not null default 'BUNALENS DIGITAL COFFEE QUALITY CERTIFICATE',
 region_line text not null default 'JIMMA ZONE · OROMIA · ETHIOPIA',
 disclaimer text not null default 'AI-assisted visual assessment only. Not an official Ethiopian Commodity Exchange certificate or laboratory quality report.',
 footer_note text not null default 'Verify this record using the QR code or verification ID.',
 accent_color text not null default '#7F1D1D' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
 border_color text not null default '#2C1810' check(border_color ~ '^#[0-9A-Fa-f]{6}$'),
 status text not null default 'draft' check(status in ('draft','active','archived')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 activated_at timestamptz,
 constraint certificate_templates_active_timestamp check(status<>'active' or activated_at is not null)
);
create unique index if not exists certificate_templates_one_active_idx on public.certificate_templates((status)) where status='active';
alter table public.certificate_templates enable row level security;
create policy "Admins read all certificate templates" on public.certificate_templates for select to authenticated using((select coalesce(auth.jwt()->'app_metadata'->>'role',''))='admin');
create policy "Authenticated users read active certificate template" on public.certificate_templates for select to authenticated using(status='active');
create policy "Admins create certificate template drafts" on public.certificate_templates for insert to authenticated with check((select coalesce(auth.jwt()->'app_metadata'->>'role',''))='admin' and (created_by is null or created_by=(select auth.uid())) and status='draft');
create policy "Admins update certificate templates" on public.certificate_templates for update to authenticated using((select coalesce(auth.jwt()->'app_metadata'->>'role',''))='admin') with check((select coalesce(auth.jwt()->'app_metadata'->>'role',''))='admin');
grant select,insert,update on public.certificate_templates to authenticated;
create or replace function public.guard_certificate_template_update() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if old.status in ('active','archived') and (
  new.version is distinct from old.version or new.name is distinct from old.name or
  new.organization_name is distinct from old.organization_name or new.certificate_title is distinct from old.certificate_title or
  new.region_line is distinct from old.region_line or new.disclaimer is distinct from old.disclaimer or
  new.footer_note is distinct from old.footer_note or new.accent_color is distinct from old.accent_color or
  new.border_color is distinct from old.border_color or new.created_by is distinct from old.created_by or
  new.created_at is distinct from old.created_at
 ) then raise exception 'Activated certificate templates are immutable. Create a new version.'; end if;
 if old.status='archived' and new.status is distinct from old.status then raise exception 'Archived certificate templates cannot be reactivated.'; end if;
 if new.status not in ('draft','active','archived') then raise exception 'Invalid certificate template status.'; end if;
 if old.status='draft' and new.status='active' and new.activated_at is null then new.activated_at:=now(); end if;
 return new;
end; $$;
drop trigger if exists certificate_templates_guard_update on public.certificate_templates;
create trigger certificate_templates_guard_update before update on public.certificate_templates for each row execute function public.guard_certificate_template_update();
create or replace function public.activate_certificate_template(p_template_id uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
 if not exists(select 1 from public.certificate_templates where id=p_template_id and status='draft') then raise exception 'Only a draft certificate template can be activated.'; end if;
 update public.certificate_templates set status='archived' where status='active';
 update public.certificate_templates set status='active',activated_at=now() where id=p_template_id and status='draft';
end; $$;
revoke all on function public.activate_certificate_template(uuid) from public,anon;
grant execute on function public.activate_certificate_template(uuid) to authenticated;
insert into public.certificate_templates(version,name,organization_name,certificate_title,region_line,disclaimer,footer_note,accent_color,border_color,status,activated_at)
values(1,'BunaLens default certificate','BunaLens','BUNALENS DIGITAL COFFEE QUALITY CERTIFICATE','JIMMA ZONE · OROMIA · ETHIOPIA','AI-assisted visual assessment only. Not an official Ethiopian Commodity Exchange certificate or laboratory quality report.','Verify this record using the QR code or verification ID.','#7F1D1D','#2C1810','active',now())
on conflict(version) do nothing;

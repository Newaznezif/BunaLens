-- Record explicit seller consent before any real coffee lot becomes public.
create table if not exists public.marketplace_publication_consents (
  batch_id text primary key references public.coffee_batches(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  agreed boolean not null default false,
  price_per_kg_etb numeric(12,2) not null check (price_per_kg_etb > 0 and price_per_kg_etb <= 100000),
  available_kg numeric(12,2) not null check (available_kg > 0),
  agreed_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_publication_consents_owner_idx
  on public.marketplace_publication_consents(owner_id, updated_at desc);
create index if not exists marketplace_publication_consents_station_idx
  on public.marketplace_publication_consents(station_id, agreed);

alter table public.marketplace_publication_consents enable row level security;
revoke all on public.marketplace_publication_consents from anon, authenticated;
grant select on public.marketplace_publication_consents to authenticated;

drop policy if exists "Owners and administrators read publication consent" on public.marketplace_publication_consents;
create policy "Owners and administrators read publication consent"
  on public.marketplace_publication_consents
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.bunalens_is_reviewer()
    or public.bunalens_jwt_role() = 'admin'
  );

create or replace function public.bunalens_record_marketplace_publication_consent(
  p_batch_id text,
  p_agreed boolean,
  p_available_kg numeric default null,
  p_price_per_kg_etb numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_station_id uuid := public.bunalens_my_station_id();
  v_owner_id uuid;
  v_seller_status text;
  v_lot public.coffee_batches%rowtype;
  v_listing jsonb;
  v_status text;
begin
  if (select auth.uid()) is null or v_station_id is null then
    raise exception 'Sign in with your registered station account.' using errcode = '42501';
  end if;

  select * into v_lot
    from public.coffee_batches b
   where b.id = p_batch_id and b.station_id = v_station_id
   for update;
  if not found then
    raise exception 'This coffee lot does not belong to your station.' using errcode = '42501';
  end if;
  if v_lot.is_demo then
    raise exception 'Demonstration lots cannot be published to the public marketplace.' using errcode = '22023';
  end if;

  select s.owner_id, s.marketplace_seller_status
    into v_owner_id, v_seller_status
    from public.stations s where s.id = v_station_id;
  if v_owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the station owner can give marketplace publication consent.' using errcode = '42501';
  end if;

  if p_agreed is not true then
    update public.marketplace_publication_consents
       set agreed = false, revoked_at = now(), updated_at = now()
     where batch_id = p_batch_id and owner_id = (select auth.uid());
    update public.marketplace_listings
       set status = 'withdrawn', updated_at = now()
     where batch_id = p_batch_id and status = 'published' and not is_demo;
    return jsonb_build_object('consent_recorded', false, 'listing_status', 'withdrawn');
  end if;

  if v_seller_status <> 'approved' then
    raise exception 'Your station must first be approved as a marketplace seller.' using errcode = '42501';
  end if;
  if p_available_kg is null or p_available_kg <= 0 or p_available_kg <> round(p_available_kg, 2)
     or p_available_kg > v_lot.lot_weight_kg then
    raise exception 'Available kilograms must be above 0 and no greater than the registered lot weight (% kg).', v_lot.lot_weight_kg using errcode = '22023';
  end if;
  if p_price_per_kg_etb is null or p_price_per_kg_etb <= 0 or p_price_per_kg_etb > 100000
     or p_price_per_kg_etb <> round(p_price_per_kg_etb, 2) then
    raise exception 'Enter a valid seller-approved asking price per kg in ETB.' using errcode = '22023';
  end if;

  insert into public.marketplace_publication_consents(
    batch_id, station_id, owner_id, agreed, price_per_kg_etb, available_kg, agreed_at, revoked_at, updated_at
  ) values (
    p_batch_id, v_station_id, (select auth.uid()), true,
    p_price_per_kg_etb, p_available_kg, now(), null, now()
  )
  on conflict (batch_id) do update set
    station_id = excluded.station_id,
    owner_id = excluded.owner_id,
    agreed = true,
    price_per_kg_etb = excluded.price_per_kg_etb,
    available_kg = excluded.available_kg,
    agreed_at = now(),
    revoked_at = null,
    updated_at = now();

  v_status := case
    when v_lot.certification_status = 'certified' and v_lot.eligibility_status = 'eligible'
      then 'published'
    else 'draft'
  end;

  v_listing := public.bunalens_save_listing(
    p_batch_id, p_available_kg, p_price_per_kg_etb, v_status
  );

  update public.marketplace_listings
     set evidence_summary = coalesce(evidence_summary, '{}'::jsonb) ||
       jsonb_build_object('seller_publication_consent', jsonb_build_object(
         'agreed', true, 'agreed_at', now(), 'agreed_by', (select auth.uid()),
         'price_per_kg_etb', p_price_per_kg_etb, 'available_kg', p_available_kg
       )),
         updated_at = now()
   where batch_id = p_batch_id;

  return jsonb_build_object(
    'consent_recorded', true,
    'published', v_status = 'published',
    'listing', v_listing,
    'message', case when v_status = 'published'
      then 'Your lot is now published on the public marketplace.'
      else 'Your consent is saved. The lot will be published automatically after administrator certification.'
    end
  );
end;
$function$;

revoke all on function public.bunalens_record_marketplace_publication_consent(text, boolean, numeric, numeric) from public, anon;
grant execute on function public.bunalens_record_marketplace_publication_consent(text, boolean, numeric, numeric) to authenticated;

-- The seller's recorded terms always win. Admin-side publication attempts without consent
-- are converted to drafts rather than exposed to the public.
create or replace function public.bunalens_guard_marketplace_publication_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consent public.marketplace_publication_consents%rowtype;
begin
  if new.status = 'published' and not new.is_demo then
    select * into v_consent
      from public.marketplace_publication_consents c
     where c.batch_id = new.batch_id and c.agreed = true;
    if not found then
      new.status := 'draft';
      new.published_at := null;
    else
      new.price_per_kg_etb := v_consent.price_per_kg_etb;
      new.available_kg := v_consent.available_kg;
      new.published_at := coalesce(new.published_at, now());
      new.evidence_summary := coalesce(new.evidence_summary, '{}'::jsonb) ||
        jsonb_build_object('seller_publication_consent', jsonb_build_object(
          'agreed', true, 'agreed_at', v_consent.agreed_at,
          'agreed_by', v_consent.owner_id,
          'price_per_kg_etb', v_consent.price_per_kg_etb,
          'available_kg', v_consent.available_kg
        ));
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.bunalens_guard_marketplace_publication_consent() from public, anon, authenticated;

drop trigger if exists guard_marketplace_publication_consent on public.marketplace_listings;
create trigger guard_marketplace_publication_consent
  before insert or update of status on public.marketplace_listings
  for each row execute function public.bunalens_guard_marketplace_publication_consent();

-- A lot with advance seller consent is published as soon as an administrator certifies it.
create or replace function public.bunalens_publish_consented_lot_after_certification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consent public.marketplace_publication_consents%rowtype;
  v_seller_status text;
begin
  if new.certification_status = 'certified'
     and old.certification_status is distinct from new.certification_status
     and new.eligibility_status = 'eligible'
     and not new.is_demo then
    select * into v_consent
      from public.marketplace_publication_consents c
     where c.batch_id = new.id and c.agreed = true;
    if found then
      select s.marketplace_seller_status into v_seller_status
        from public.stations s where s.id = new.station_id;
      if v_seller_status = 'approved' then
        update public.marketplace_listings
           set status = 'published',
               available_kg = v_consent.available_kg,
               price_per_kg_etb = v_consent.price_per_kg_etb,
               published_at = coalesce(published_at, now()),
               updated_at = now(),
               evidence_summary = coalesce(evidence_summary, '{}'::jsonb) ||
                 jsonb_build_object('seller_publication_consent', jsonb_build_object(
                   'agreed', true, 'agreed_at', v_consent.agreed_at,
                   'agreed_by', v_consent.owner_id,
                   'price_per_kg_etb', v_consent.price_per_kg_etb,
                   'available_kg', v_consent.available_kg
                 ))
         where batch_id = new.id and status in ('draft','paused');
      end if;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.bunalens_publish_consented_lot_after_certification() from public, anon, authenticated;

drop trigger if exists publish_consented_lot_after_certification on public.coffee_batches;
create trigger publish_consented_lot_after_certification
  after update of certification_status on public.coffee_batches
  for each row execute function public.bunalens_publish_consented_lot_after_certification();

comment on table public.marketplace_publication_consents is
  'Private audit record of explicit station-owner consent and seller-approved terms for public marketplace publication.';

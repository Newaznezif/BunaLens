-- BunaLens Coffee Marketplace: Phase 1 database and security foundation.
-- Adds inquiry-based listings backed by completed cloud assessments.
-- No payment, reservation, shipping, or transaction execution is included.

begin;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null unique references public.coffee_batches(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  station_id uuid not null references public.stations(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  coffee_type text not null check (coffee_type in ('red_cherry', 'green_bean')),
  coffee_variety text check (coffee_variety is null or char_length(coffee_variety) <= 120),
  processing_method text not null default 'unknown'
    check (processing_method in ('washed', 'natural', 'honey', 'other', 'unknown')),
  harvest_season text check (harvest_season is null or char_length(harvest_season) <= 80),
  quantity_available_kg numeric(14,3) not null check (quantity_available_kg > 0),
  minimum_order_kg numeric(14,3) not null default 1
    check (minimum_order_kg > 0 and minimum_order_kg <= quantity_available_kg),
  price_type text not null default 'negotiable'
    check (price_type in ('fixed', 'negotiable')),
  price_per_kg_etb numeric(14,2),
  currency text not null default 'ETB' check (currency = 'ETB'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'sold_out', 'archived', 'suspended')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listing_price_consistency check (
    (price_type = 'fixed' and price_per_kg_etb is not null and price_per_kg_etb > 0)
    or
    (price_type = 'negotiable' and price_per_kg_etb is null)
  )
);

create index if not exists marketplace_listings_status_created_idx
  on public.marketplace_listings(status, created_at desc);
create index if not exists marketplace_listings_score_lookup_idx
  on public.marketplace_listings(batch_id, status);
create index if not exists marketplace_listings_seller_idx
  on public.marketplace_listings(seller_id, status, created_at desc);
create index if not exists marketplace_listings_origin_idx
  on public.marketplace_listings(station_id, status);

create table if not exists public.marketplace_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_path text not null unique,
  alt_text text check (alt_text is null or char_length(alt_text) <= 240),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_listing_images_listing_idx
  on public.marketplace_listing_images(listing_id, sort_order);
create unique index if not exists marketplace_listing_images_one_primary_idx
  on public.marketplace_listing_images(listing_id)
  where is_primary;

create table if not exists public.marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  requested_quantity_kg numeric(14,3) not null check (requested_quantity_kg > 0),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed')),
  seller_response text check (seller_response is null or char_length(seller_response) <= 2000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_inquiries_buyer_idx
  on public.marketplace_inquiries(buyer_id, created_at desc);
create index if not exists marketplace_inquiries_listing_idx
  on public.marketplace_inquiries(listing_id, status, created_at desc);

-- Admin status comes only from trusted app_metadata, never user_metadata.
create or replace function public.marketplace_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.marketplace_is_admin() from public, anon;
grant execute on function public.marketplace_is_admin() to authenticated;

-- SECURITY DEFINER predicates let RLS and Storage policies check listing ownership
-- without granting buyers direct access to seller_id or station_id columns.
create or replace function public.marketplace_is_listing_owner(p_listing_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $
  select exists (
    select 1 from public.marketplace_listings l
    where l.id::text = p_listing_id and l.seller_id = auth.uid()
  );
$;

create or replace function public.marketplace_is_published_listing(p_listing_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $
  select exists (
    select 1 from public.marketplace_listings l
    where l.id::text = p_listing_id and l.status = 'published'
  );
$;

create or replace function public.marketplace_can_manage_listing_images(p_listing_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $
  select exists (
    select 1 from public.marketplace_listings l
    where l.id::text = p_listing_id
      and l.seller_id = auth.uid()
      and l.status in ('draft', 'published', 'paused')
  );
$;

revoke all on function public.marketplace_is_listing_owner(text) from public, anon;
revoke all on function public.marketplace_is_published_listing(text) from public, anon;
revoke all on function public.marketplace_can_manage_listing_images(text) from public, anon;
grant execute on function public.marketplace_is_listing_owner(text) to authenticated;
grant execute on function public.marketplace_is_published_listing(text) to authenticated;
grant execute on function public.marketplace_can_manage_listing_images(text) to authenticated;

-- Derive seller/station from the selected batch. Never trust client-supplied ownership.
create or replace function public.marketplace_validate_listing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_station_id uuid;
  v_owner_id uuid;
  v_is_admin boolean := public.marketplace_is_admin();
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authentication is required to create a marketplace listing'
        using errcode = '42501';
    end if;

    select b.station_id, s.owner_id
      into v_station_id, v_owner_id
    from public.coffee_batches b
    join public.stations s on s.id = b.station_id
    join public.grading_results gr on gr.batch_id = b.id
    where b.id = new.batch_id
      and b.grading_status = 'completed'
      and b.is_demo = false
      and b.quality_score is not null
      and nullif(btrim(b.image_path), '') is not null;

    if v_station_id is null or v_owner_id is distinct from auth.uid() then
      raise exception 'The selected batch is not an eligible completed assessment owned by this account'
        using errcode = '42501';
    end if;

    new.seller_id := v_owner_id;
    new.station_id := v_station_id;
    new.status := 'draft';
    new.published_at := null;
  else
    if new.batch_id is distinct from old.batch_id
       or new.seller_id is distinct from old.seller_id
       or new.station_id is distinct from old.station_id then
      raise exception 'The assessment and listing ownership references are immutable';
    end if;

    if not v_is_admin then
      if old.seller_id is distinct from auth.uid() then
        raise exception 'Only the listing owner can update this listing'
          using errcode = '42501';
      end if;
      if old.status = 'suspended' or new.status = 'suspended' then
        raise exception 'Only an administrator can manage suspended listings'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status = 'published' then
    perform 1
    from public.coffee_batches b
    join public.grading_results gr on gr.batch_id = b.id
    where b.id = new.batch_id
      and b.grading_status = 'completed'
      and b.is_demo = false
      and b.quality_score is not null
      and nullif(btrim(b.image_path), '') is not null;

    if not found then
      raise exception 'Only eligible completed assessments can be published';
    end if;

    if new.published_at is null then
      new.published_at := now();
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'published' then
    -- Preserve original publication timestamp when pausing or changing listing details.
    new.published_at := old.published_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketplace_listings_validate on public.marketplace_listings;
create trigger marketplace_listings_validate
before insert or update on public.marketplace_listings
for each row execute function public.marketplace_validate_listing();

create or replace function public.marketplace_validate_listing_image()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_seller_id uuid;
  v_status text;
begin
  select seller_id, status into v_seller_id, v_status
  from public.marketplace_listings
  where id = new.listing_id;

  if v_seller_id is null then
    raise exception 'Marketplace listing does not exist';
  end if;

  if not public.marketplace_is_admin() then
    if v_seller_id is distinct from auth.uid()
       or v_status in ('archived', 'suspended', 'sold_out') then
      raise exception 'You cannot manage images for this listing'
        using errcode = '42501';
    end if;
  end if;

  if split_part(new.storage_path, '/', 1) <> v_seller_id::text
     or split_part(new.storage_path, '/', 2) <> new.listing_id::text
     or split_part(new.storage_path, '/', 3) = '' then
    raise exception 'Image storage path must be seller_id/listing_id/filename';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_listing_images_validate on public.marketplace_listing_images;
create trigger marketplace_listing_images_validate
before insert or update on public.marketplace_listing_images
for each row execute function public.marketplace_validate_listing_image();

create or replace function public.marketplace_validate_inquiry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_seller_id uuid;
  v_listing_status text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authentication is required to submit an inquiry'
        using errcode = '42501';
    end if;

    select seller_id, status into v_seller_id, v_listing_status
    from public.marketplace_listings
    where id = new.listing_id;

    if v_seller_id is null
       or v_listing_status <> 'published'
       or v_seller_id = auth.uid() then
      raise exception 'This listing is not available for inquiry'
        using errcode = '42501';
    end if;

    new.buyer_id := auth.uid();
    new.status := 'pending';
    new.seller_response := null;
    new.responded_at := null;
  else
    if public.marketplace_is_admin() then
      new.updated_at := now();
      return new;
    end if;

    if new.listing_id is distinct from old.listing_id
       or new.buyer_id is distinct from old.buyer_id
       or new.requested_quantity_kg is distinct from old.requested_quantity_kg
       or new.message is distinct from old.message then
      raise exception 'Buyer inquiry details are immutable';
    end if;

    select seller_id into v_seller_id
    from public.marketplace_listings
    where id = old.listing_id;

    if v_seller_id is distinct from auth.uid() then
      raise exception 'Only the listing owner can respond to this inquiry'
        using errcode = '42501';
    end if;

    if old.status = 'closed' then
      raise exception 'Closed inquiries cannot be changed';
    end if;

    if new.status not in ('responded', 'closed') then
      raise exception 'Seller can only respond to or close an inquiry';
    end if;

    if new.status = 'responded' and nullif(btrim(new.seller_response), '') is null then
      raise exception 'A response is required before marking an inquiry responded';
    end if;

    if new.status = 'responded' then
      new.responded_at := coalesce(old.responded_at, now());
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_inquiries_validate on public.marketplace_inquiries;
create trigger marketplace_inquiries_validate
before insert or update on public.marketplace_inquiries
for each row execute function public.marketplace_validate_inquiry();

-- RLS: buyers may discover published listings; sellers manage only their own.
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_images enable row level security;
alter table public.marketplace_inquiries enable row level security;

drop policy if exists "marketplace listings visible to owners buyers and admins" on public.marketplace_listings;
create policy "marketplace listings visible to owners buyers and admins"
on public.marketplace_listings for select to authenticated
using (
  seller_id = (select auth.uid())
  or status = 'published'
  or (select public.marketplace_is_admin())
);

drop policy if exists "marketplace owners create own drafts" on public.marketplace_listings;
create policy "marketplace owners create own drafts"
on public.marketplace_listings for insert to authenticated
with check (seller_id = (select auth.uid()) and status = 'draft');

drop policy if exists "marketplace owners and admins update listings" on public.marketplace_listings;
create policy "marketplace owners and admins update listings"
on public.marketplace_listings for update to authenticated
using (seller_id = (select auth.uid()) or (select public.marketplace_is_admin()))
with check (seller_id = (select auth.uid()) or (select public.marketplace_is_admin()));

drop policy if exists "marketplace images visible to owners buyers and admins" on public.marketplace_listing_images;
create policy "marketplace images visible to owners buyers and admins"
on public.marketplace_listing_images for select to authenticated
using (
  exists (
    select 1
    where public.marketplace_is_listing_owner(listing_id::text)
       or public.marketplace_is_published_listing(listing_id::text)
       or (select public.marketplace_is_admin())
  )
);

drop policy if exists "marketplace owners manage listing images" on public.marketplace_listing_images;
create policy "marketplace owners manage listing images"
on public.marketplace_listing_images for all to authenticated
using (
  exists (
    select 1
    where public.marketplace_is_listing_owner(listing_id::text)
       or (select public.marketplace_is_admin())
  )
)
with check (
  exists (
    select 1 from public.marketplace_listings l
    where l.id = listing_id
      and (l.seller_id = (select auth.uid()) or (select public.marketplace_is_admin()))
  )
);

drop policy if exists "marketplace inquiry participants and admins read" on public.marketplace_inquiries;
create policy "marketplace inquiry participants and admins read"
on public.marketplace_inquiries for select to authenticated
using (
  buyer_id = (select auth.uid())
  or public.marketplace_is_listing_owner(listing_id::text)
  or (select public.marketplace_is_admin())
);

drop policy if exists "buyers create inquiries on others published listings" on public.marketplace_inquiries;
create policy "buyers create inquiries on others published listings"
on public.marketplace_inquiries for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and public.marketplace_is_published_listing(listing_id::text)
  and not public.marketplace_is_listing_owner(listing_id::text)
);

drop policy if exists "listing owners respond to inquiries" on public.marketplace_inquiries;
create policy "listing owners respond to inquiries"
on public.marketplace_inquiries for update to authenticated
using (
  public.marketplace_is_listing_owner(listing_id::text)
)
with check (
  exists (
    select 1 from public.marketplace_listings l
    where l.id = listing_id and l.seller_id = (select auth.uid())
  )
);

-- Explicit table/column grants keep private ownership and contact fields out of direct buyer reads.
revoke all on public.marketplace_listings from public, anon, authenticated;
grant select (
  id, batch_id, title, description, coffee_type, coffee_variety,
  processing_method, harvest_season, quantity_available_kg, minimum_order_kg,
  price_type, price_per_kg_etb, currency, status, published_at, created_at, updated_at
) on public.marketplace_listings to authenticated;
grant insert (
  batch_id, title, description, coffee_type, coffee_variety, processing_method,
  harvest_season, quantity_available_kg, minimum_order_kg, price_type, price_per_kg_etb
) on public.marketplace_listings to authenticated;
grant update (
  title, description, coffee_type, coffee_variety, processing_method, harvest_season,
  quantity_available_kg, minimum_order_kg, price_type, price_per_kg_etb, status
) on public.marketplace_listings to authenticated;

revoke all on public.marketplace_listing_images from public, anon, authenticated;
grant select on public.marketplace_listing_images to authenticated;
grant insert (listing_id, storage_path, alt_text, sort_order, is_primary)
  on public.marketplace_listing_images to authenticated;
grant update (alt_text, sort_order, is_primary)
  on public.marketplace_listing_images to authenticated;
grant delete on public.marketplace_listing_images to authenticated;

revoke all on public.marketplace_inquiries from public, anon, authenticated;
grant select on public.marketplace_inquiries to authenticated;
grant insert (listing_id, requested_quantity_kg, message)
  on public.marketplace_inquiries to authenticated;
grant update (seller_response, status, responded_at)
  on public.marketplace_inquiries to authenticated;

-- Private marketplace product-photo bucket. Original assessment photos remain in coffee-samples.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-images',
  'marketplace-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketplace seller uploads own listing images" on storage.objects;
create policy "marketplace seller uploads own listing images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.marketplace_can_manage_listing_images((storage.foldername(name))[2])
);

drop policy if exists "marketplace images readable by owner buyers and admins" on storage.objects;
create policy "marketplace images readable by owner buyers and admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-images'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.marketplace_is_published_listing((storage.foldername(name))[2])
    or (select public.marketplace_is_admin())
  )
);

drop policy if exists "marketplace seller updates own listing images" on storage.objects;
create policy "marketplace seller updates own listing images"
on storage.objects for update to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.marketplace_can_manage_listing_images((storage.foldername(name))[2])
)
with check (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.marketplace_can_manage_listing_images((storage.foldername(name))[2])
);

drop policy if exists "marketplace seller deletes own listing images" on storage.objects;
create policy "marketplace seller deletes own listing images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.marketplace_can_manage_listing_images((storage.foldername(name))[2])
);

-- Allow authenticated buyers to read the original assessment image only while its listing is published.
create or replace function public.marketplace_can_read_assessment_image(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.marketplace_listings l
    join public.coffee_batches b on b.id = l.batch_id
    where l.status = 'published'
      and b.image_path = p_object_name
  );
$$;

revoke all on function public.marketplace_can_read_assessment_image(text) from public, anon;
grant execute on function public.marketplace_can_read_assessment_image(text) to authenticated;

drop policy if exists "marketplace buyers read published assessment images" on storage.objects;
create policy "marketplace buyers read published assessment images"
on storage.objects for select to authenticated
using (
  bucket_id = 'coffee-samples'
  and public.marketplace_can_read_assessment_image(name)
);

-- Buyer-facing projection: deliberately excludes seller email/phone, account IDs and GPS.
create or replace view public.marketplace_public_listings
with (security_barrier = true)
as
select
  l.id as listing_id,
  l.title,
  l.description,
  l.coffee_type,
  l.coffee_variety,
  l.processing_method,
  l.harvest_season,
  l.quantity_available_kg,
  l.minimum_order_kg,
  l.price_type,
  l.price_per_kg_etb,
  l.currency,
  l.published_at,
  l.created_at as listing_created_at,
  coalesce(nullif(s.station_name, ''), nullif(s.name, ''), 'Registered coffee station') as seller_display_name,
  s.zone,
  b.woreda,
  b.batch_code,
  b.sample_type,
  b.quality_score as assessment_score,
  b.confidence_score as assessment_confidence,
  gr.breakdown as assessment_breakdown,
  gr.export_readiness,
  gr.assessment_limitations,
  gr.assessment_method,
  gr.model_version,
  gr.created_at as assessed_at,
  b.image_path as assessment_image_path,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'path', li.storage_path,
        'alt_text', li.alt_text,
        'sort_order', li.sort_order,
        'is_primary', li.is_primary
      ) order by li.sort_order, li.created_at
    )
    from public.marketplace_listing_images li
    where li.listing_id = l.id
  ), '[]'::jsonb) as product_images
from public.marketplace_listings l
join public.coffee_batches b on b.id = l.batch_id
join public.grading_results gr on gr.batch_id = b.id
join public.stations s on s.id = l.station_id
where l.status = 'published';

revoke all on public.marketplace_public_listings from public, anon;
grant select on public.marketplace_public_listings to authenticated;

-- Admin-only projection for future moderation screens.
create or replace view public.marketplace_admin_listings
with (security_barrier = true)
as
select
  l.id as listing_id,
  l.batch_id,
  l.seller_id,
  l.station_id,
  l.title,
  l.status,
  l.quantity_available_kg,
  l.price_type,
  l.price_per_kg_etb,
  l.created_at,
  l.published_at,
  l.updated_at
from public.marketplace_listings l
where public.marketplace_is_admin();

revoke all on public.marketplace_admin_listings from public, anon;
grant select on public.marketplace_admin_listings to authenticated;

comment on table public.marketplace_listings is
  'Farmer listings linked to a completed BunaLens cloud assessment; quality data remains in source assessment tables.';
comment on table public.marketplace_listing_images is
  'Additional private product photographs for a marketplace listing.';
comment on table public.marketplace_inquiries is
  'Buyer-to-farmer purchase inquiries; this table does not reserve stock or process payments.';

commit;

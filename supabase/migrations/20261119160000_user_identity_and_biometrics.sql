-- BunaLens User Registration, Identity Verification, and Biometric Data Management
-- Supports Coffee Provider and Coffee Seller profiles, National ID/Passport scans,
-- facial recognition, and cryptographic fingerprint biometrics.

create table if not exists public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  profile_type text not null check (profile_type in ('coffee_provider', 'coffee_seller')),
  full_name text not null,
  phone text not null,
  email text,
  woreda text not null,
  kebele text,
  farm_or_business_name text,
  document_type text not null check (document_type in ('national_id', 'passport', 'kebele_id')),
  document_number text not null,
  document_image_url text,
  document_extracted_data jsonb not null default '{}'::jsonb,
  facial_photo_url text,
  facial_recognition_score numeric(5,2),
  facial_liveness_verified boolean not null default false,
  fingerprint_hash text,
  fingerprint_quality_score integer,
  biometric_metadata jsonb not null default '{}'::jsonb,
  verification_status text not null default 'verified' check (verification_status in ('pending', 'verified', 'rejected')),
  registered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance and query indexes
create index if not exists user_identities_profile_type_idx
  on public.user_identities(profile_type, created_at desc);

create index if not exists user_identities_document_num_idx
  on public.user_identities(document_number);

create index if not exists user_identities_phone_idx
  on public.user_identities(phone);

create index if not exists user_identities_user_id_idx
  on public.user_identities(user_id);

create index if not exists user_identities_registered_by_idx
  on public.user_identities(registered_by);

-- Enable Row Level Security (RLS)
alter table public.user_identities enable row level security;

-- Policies
-- 1. BunaLens Admins have full access to inspect and register unlimited users
drop policy if exists "BunaLens admins manage all user identities" on public.user_identities;
create policy "BunaLens admins manage all user identities"
on public.user_identities
for all
to authenticated
using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin')
with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin');

-- 2. Authenticated users can view their own identity record
drop policy if exists "Users view their own identity" on public.user_identities;
create policy "Users view their own identity"
on public.user_identities
for select
to authenticated
using (user_id = (select auth.uid()));

-- 3. Authenticated users can self-register their identity record upon sign-up
drop policy if exists "Users create their own identity" on public.user_identities;
create policy "Users create their own identity"
on public.user_identities
for insert
to authenticated
with check (user_id = (select auth.uid()));

-- Grants
grant select, insert, update on public.user_identities to authenticated;

-- Private Storage Bucket for Scanned Documents and Biometric Photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-documents',
  'identity-documents',
  false,
  10485760, -- 10 MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: Admins have full read/write access; users can upload/view their own folder
create policy if not exists "Admins have full access to identity documents"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'identity-documents' and
  (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
)
with check (
  bucket_id = 'identity-documents' and
  (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
);

create policy if not exists "Users can access their own identity files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'identity-documents' and
  (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'identity-documents' and
  (storage.foldername(name))[1] = auth.uid()::text
);

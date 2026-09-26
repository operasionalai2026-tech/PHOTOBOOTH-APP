-- =====================================================================
-- Photobooth — setup Supabase (jalankan di Dashboard → SQL Editor).
-- Aman dijalankan ulang (idempotent).
--
-- Setelah menjalankan file ini, daftarkan slug event kamu (sama dengan
-- NEXT_PUBLIC_EVENT_SLUG) supaya booth boleh upload:
--
--   insert into booth_events (slug) values ('nama-event') on conflict do nothing;
--
-- Menonaktifkan event (booth tidak bisa upload lagi, foto lama tetap ada):
--   update booth_events set active = false where slug = 'nama-event';
-- =====================================================================

-- ---------- 1. Daftar event yang boleh upload ----------
create table if not exists booth_events (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table booth_events enable row level security;
drop policy if exists "admin all" on booth_events;
create policy "admin all" on booth_events for all to authenticated using (true) with check (true);

-- Dipakai policy di bawah. Ditaruh di schema `private` (tidak diekspos lewat REST API)
-- dan security definer supaya anon tidak perlu akses baca ke booth_events.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_active_event(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.booth_events where slug = p_slug and active);
$$;
revoke all on function private.is_active_event(text) from public;
grant execute on function private.is_active_event(text) to anon, authenticated;

insert into booth_events (slug) values ('demo') on conflict do nothing;

-- ---------- 2. Tabel photo_sessions ----------
create table if not exists photo_sessions (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  layout text not null,
  frame text,
  filter text,
  image_path text not null,
  size_bytes int,
  printed boolean default false,
  created_at timestamptz default now()
);
create index if not exists photo_sessions_event_created_idx
  on photo_sessions (event_slug, created_at desc);

alter table photo_sessions enable row level security;

drop policy if exists "anon insert" on photo_sessions;
drop policy if exists "anon read by id" on photo_sessions;
drop policy if exists "admin all" on photo_sessions;

-- Anon hanya boleh insert untuk event aktif, dengan path file yang sesuai id-nya.
create policy "anon insert" on photo_sessions for insert to anon
  with check (
    private.is_active_event(event_slug)
    and image_path = event_slug || '/' || id::text || '.jpg'
  );
create policy "anon read by id" on photo_sessions for select to anon using (true);
create policy "admin all" on photo_sessions for all to authenticated using (true) with check (true);

-- Tandai foto sudah dicetak. Anon tidak punya izin UPDATE, jadi lewat fungsi
-- sempit ini yang hanya bisa mengubah kolom printed → true.
-- (Security advisor akan memberi WARN untuk fungsi ini — memang disengaja.)
create or replace function public.mark_printed(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update photo_sessions set printed = true where id = p_id;
$$;
revoke all on function public.mark_printed(uuid) from public;
grant execute on function public.mark_printed(uuid) to anon, authenticated;

-- ---------- 3. Bucket storage `photos` ----------
-- public read, maks 1 MB, hanya image/jpeg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 4. Policy storage ----------
drop policy if exists "photos anon upload to event folder" on storage.objects;
drop policy if exists "photos admin all" on storage.objects;

-- Anon hanya boleh upload file .jpg langsung di dalam folder {event_slug}/ milik event aktif
-- (tidak bisa update/overwrite/hapus, tidak bisa list).
create policy "photos anon upload to event folder" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'photos'
    and array_length(storage.foldername(name), 1) = 1
    and private.is_active_event((storage.foldername(name))[1])
    and lower(storage.extension(name)) = 'jpg'
  );

-- Admin (user login magic link) boleh lihat & hapus semua file di bucket photos.
create policy "photos admin all" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

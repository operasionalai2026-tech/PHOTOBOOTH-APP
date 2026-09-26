-- =====================================================================
-- Photobooth — setup Supabase (jalankan di Dashboard → SQL Editor).
-- Aman dijalankan ulang (idempotent).
--
-- ⚠️ GANTI 'nama-event' di bagian 3 dengan NEXT_PUBLIC_EVENT_SLUG kamu.
--    Untuk beberapa event: array['event-a', 'event-b'].
-- =====================================================================

-- ---------- 1. Tabel photo_sessions ----------
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

create policy "anon insert" on photo_sessions for insert to anon with check (true);
create policy "anon read by id" on photo_sessions for select to anon using (true);
create policy "admin all" on photo_sessions for all to authenticated using (true);

-- Tandai foto sudah dicetak. Anon tidak punya izin UPDATE, jadi lewat fungsi
-- sempit ini yang hanya bisa mengubah kolom printed → true.
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

-- ---------- 2. Bucket storage `photos` ----------
-- public read, maks 1 MB, hanya image/jpeg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3. Policy storage ----------
drop policy if exists "photos anon upload to event folder" on storage.objects;
drop policy if exists "photos admin all" on storage.objects;

-- Anon hanya boleh upload file .jpg langsung di dalam folder {event_slug}/
-- (tidak bisa update/overwrite/hapus, tidak bisa list).
create policy "photos anon upload to event folder" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'photos'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = any (array['nama-event'])  -- ⚠️ ganti
    and lower(storage.extension(name)) = 'jpg'
  );

-- Admin (user login magic link) boleh lihat & hapus semua file di bucket photos.
create policy "photos admin all" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

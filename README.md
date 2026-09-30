# 📸 Photobooth App — 100% gratis

Photobooth berbasis web untuk event: kamera → hitung mundur → pilih frame & filter → **cetak**,
**scan QR untuk unduh**, dan **simpan ke Perangkat / Google Drive**. Tetap jalan saat offline.

| Bagian | Teknologi (semua gratis) |
|---|---|
| Frontend | Next.js 14 `output: 'export'` (static, tanpa server), Tailwind CSS, Framer Motion, Zustand |
| Hosting | Cloudflare Pages (free, boleh komersial) |
| Backend | Supabase Free — Postgres + Storage + Auth, diakses langsung dari browser (anon key + RLS) |
| Cron | GitHub Actions — keep-alive & hapus foto > 30 hari |
| Simpan ke Drive | Google Identity Services + Drive API (scope `drive.file`) langsung dari browser |
| Library | qrcode, browser-image-compression, jszip (MIT) · font Google Fonts · frame & suara dibuat sendiri (Canvas / Web Audio) |

## Fitur

- **Booth** (`/`): 6 gaya frame **Remisya – One Story**:

  | Gaya | Foto | Ukuran cetak |
  |---|---|---|
  | Bingkai Unik (jendela bergelombang) | 4 | 8x10 in |
  | Grid | 4 | 8x10 in |
  | Satu Foto | 1 | 8x10 in |
  | Strip Kolase | 3 | 2x6 in — 2 strip per kertas 4x6 |
  | Strip | 3 | 2x6 in — 2 strip per kertas 4x6 |
  | Strip Keffiyeh | 3 | 2x6 in — 2 strip per kertas 4x6 |

  Frame = gambar desain di `public/frames/*.webp` dengan jendela foto transparan; foto diletakkan di
  bawahnya. Tiap jepretan dua tahap: **3 detik siap-siap** lalu **hitung mundur 3-2-1** + suara shutter + flash.
  Kamera menampilkan **panduan bingkai** (area yang masuk ke foto). Setelah semua foto terambil ada layar
  review dengan **Retake per foto**. Filter: **Asli, Retro** (film pudar + halftone), **Hitam Putih**,
  **Cantik** (kulit dihaluskan & dicerahkan). Di layar hasil: **Foto Ulang** atau **Selesai**.
  Durasi & teks siap-siap diatur di `config/event.ts`; gaya/frame di `config/layouts.ts`;
  filter di `config/filters.ts` + `lib/imageFilters.ts`. Cara menambah frame: `public/frames/README.md`.
- **Mode GIF** (gaya dengan lebih dari 1 foto, pilih **Foto / GIF** di layar kamera): sekali siap-siap + 3-2-1,
  lalu kamera **jepret beruntun tiap ±1,5 detik** sambil tamu ganti gaya. Hasilnya foto cetak biasa **plus GIF
  “kolase berputar”**: desain frame tetap, foto berpindah jendela tiap frame GIF sehingga tiap jendela jadi
  animasi kecil. GIF (±490 px lebar untuk 8x10, maks. 900 KB) ikut diunggah, bisa disimpan ke Perangkat/Drive,
  dan muncul di halaman unduh tamu (tab Foto / GIF). Jeda & kecepatan animasi: `gifIntervalMs` / `gifFrameMs`
  di `config/event.ts`. Encoder: [gifenc](https://github.com/mattdesl/gifenc) (MIT).
- **Simpan: Perangkat / Google Drive** — muncul di layar hasil booth, halaman unduh tamu, dan galeri admin.
  - *Perangkat*: di HP membuka share sheet (bisa “Simpan Gambar” ke galeri), di laptop/kiosk jadi download.
  - *Google Drive*: login Google sekali, foto masuk ke folder `Photobooth - <nama event>`.
    Operator bisa menyalakan **Auto-simpan ke Drive** di ⚙️ Pengaturan (semua foto otomatis ter-backup full-res).
- **Cetak**: ukuran 4x6 tanpa margin; layout strip otomatis digandakan 2 strip per kertas.
- **QR code** → `/p?id=…` (halaman unduh tamu, info “Foto tersedia 30 hari”).
- **Offline-first**: foto selalu masuk IndexedDB dulu lalu diunggah di background; kalau offline /
  kuota penuh / error, foto tetap bisa dicetak & disimpan, dan dicoba ulang otomatis (tiap 20 detik + saat online).
  QR tetap valid karena ID dibuat di browser — halaman tamu menunggu sampai foto masuk.
- **Admin** (`/admin`): login magic link, statistik kuota (estimasi storage = jumlah foto × rata-rata ukuran,
  peringatan > 80%), galeri per event, unduh ZIP, simpan massal ke Drive, hapus.

## Aturan free tier yang sudah diterapkan

- Tanpa server code: upload langsung ke Supabase Storage, halaman unduh pakai query param, admin via Supabase Auth.
- Foto dikompres sebelum upload: maks ±500 KB, sisi terpanjang 1800px, JPEG ~0.8.
  **Full-res tidak di-upload ke Supabase** — hanya untuk cetak, simpan ke perangkat, dan Google Drive (kuota Drive milik pengguna).
- Bucket `photos`: public read, maks 1 MB, hanya `image/jpeg`, anon hanya boleh upload ke folder `{event_slug}/`.
- Foto dihapus otomatis setelah 30 hari, keep-alive tiap 3 hari (GitHub Actions).
- Service role key **hanya** di GitHub Secrets.

---

## Setup

### 1. Supabase

1. Buat project di [supabase.com](https://supabase.com) (Free).
2. Jalankan seluruh isi `supabase/schema.sql` di **SQL Editor**. Ini membuat tabel `photo_sessions` + RLS,
   tabel `booth_events` (daftar event yang boleh upload), fungsi `mark_printed`, bucket `photos`
   (public, 1 MB, JPEG + GIF), dan policy storage. File ini aman dijalankan ulang — **project lama (sebelum
   ada mode GIF) cukup jalankan ulang sekali** supaya kolom `gif_path` dan izin upload GIF ditambahkan.
   Lalu daftarkan slug event kamu (sama dengan `NEXT_PUBLIC_EVENT_SLUG`):
   ```sql
   insert into booth_events (slug) values ('nama-event') on conflict do nothing;
   ```
   Booth hanya bisa upload ke folder event yang terdaftar & aktif.
3. **Authentication → Sign In / Providers → Email**: pastikan Email aktif, lalu **matikan “Allow new users to sign up”**.
   Ini penting: policy `admin all` memberi akses penuh ke semua user login, jadi hanya admin yang boleh punya akun.
4. **Authentication → Users → Add user → Send invitation**: undang email admin, lalu admin **wajib klik link
   di email undangan** sekali (sebaiknya setelah langkah 5 supaya redirect-nya benar). Selama undangan belum
   diterima, login magic link ditolak dengan pesan "Akun admin ini belum aktif".
   Alternatif: aktifkan langsung lewat SQL Editor —
   `update auth.users set email_confirmed_at = now() where email = 'admin@contoh.com';`
5. **Authentication → URL Configuration**:
   - Site URL: `https://<nama-project>.pages.dev`
   - Redirect URLs: tambahkan `https://<nama-project>.pages.dev/admin` (dan `http://localhost:3000/admin` untuk dev).
6. Catat **Project URL**, **anon key**, dan **service_role key** (Settings → API).

### 2. Google Drive (opsional, untuk tombol “Google Drive”)

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project.
2. **APIs & Services → Library** → aktifkan **Google Drive API**.
3. **OAuth consent screen**: tipe *External*, isi nama aplikasi & email, tambahkan scope
   `.../auth/drive.file`. Selama status *Testing*, tambahkan email yang boleh login di *Test users*
   (maks 100). Untuk tamu umum, klik *Publish app* — scope `drive.file` tidak butuh verifikasi ketat.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   *Authorized JavaScript origins*: `https://<nama-project>.pages.dev` dan `http://localhost:3000`.
   (Tidak perlu redirect URI.)
5. Salin Client ID ke `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Tanpa Client ID aplikasi tetap jalan; tombol Drive tampil nonaktif (“Belum diatur admin”).

### 3. Jalankan lokal

```bash
cp .env.example .env.local   # isi nilainya
npm install
npm run dev                  # http://localhost:3000 (kamera butuh localhost/HTTPS)
```

### 4. Deploy ke Cloudflare Pages

1. Push repo ini ke GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pilih repo.
3. Framework preset: *Next.js (Static HTML Export)* atau manual:
   - Build command: `npm run build`
   - Build output directory: `out`
4. **Environment variables** (Production & Preview):

   | Nama | Isi |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `NEXT_PUBLIC_EVENT_SLUG` | mis. `wedding-rina` (harus terdaftar di tabel `booth_events`) |
   | `NEXT_PUBLIC_BASE_URL` | `https://<nama-project>.pages.dev` |
   | `NEXT_PUBLIC_EVENT_NAME` | (opsional) teks di frame, mis. `Rina & Dimas` |
   | `NEXT_PUBLIC_EVENT_TAGLINE` | (opsional) mis. `12 . 10 . 2026` |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | (opsional) OAuth Client ID Google |
   | `NODE_VERSION` | `20` |

5. Deploy. Karena env `NEXT_PUBLIC_*` di-inline saat build, **deploy ulang setiap kali env diubah**.

### 5. GitHub Actions (keep-alive & cleanup)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Isi |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon key (untuk keep-alive) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (untuk cleanup — **jangan** taruh di Cloudflare/frontend) |

Workflow `.github/workflows/maintenance.yml` jalan tiap 3 hari; bisa juga dijalankan manual
(Actions → Maintenance → Run workflow, centang *dry run* untuk uji tanpa menghapus).

> ⚠️ GitHub menonaktifkan scheduled workflow di repo publik yang tidak ada aktivitas 60 hari.
> Kalau itu terjadi, buka tab Actions dan klik **Enable workflow**.

---

## Pemakaian di hari-H

1. Buka situs di laptop/tablet kiosk (Chrome disarankan) → izinkan kamera.
2. ⚙️ (pojok kanan atas layar awal): pilih kamera, **Sambungkan Google Drive** operator dan nyalakan
   *Auto-simpan* bila ingin backup semua foto, **Layar penuh**.
3. Printer: ukuran kertas otomatis per gaya (8x10, atau 4x6 untuk strip); pastikan printer punya kertas
   ukuran itu dan margin *None* di dialog print.
   Di Chrome kiosk bisa pakai flag `--kiosk-printing` agar langsung cetak tanpa dialog.
4. Pantau kuota di `/admin`. Kalau storage > 80%, unduh ZIP / simpan ke Drive lalu hapus foto lama.

## Kustomisasi

| File | Isi |
|---|---|
| `config/event.ts` | countdown, mirror kamera, auto-reset, suara, batas kuota & kompresi |
| `config/layouts.ts`, `public/frames/` | gaya foto: gambar frame, posisi jendela foto, ukuran cetak |
| `config/filters.ts`, `lib/imageFilters.ts` | filter foto (per pixel) |
| `app/globals.css` | warna aksen UI (`--accent`) |

## Struktur

```
app/
  page.tsx            # flow booth
  p/page.tsx          # halaman download (?id=)
  admin/page.tsx      # login magic link + galeri + statistik kuota
components/booth/     # layar booth + SaveOptions (Perangkat / Google Drive)
components/admin/     # dashboard admin
lib/  camera.ts  compose.ts  supabase.ts  offlineQueue.ts  compress.ts  googleDrive.ts  saveDevice.ts  sound.ts
config/  frames.ts  event.ts  layouts.ts  filters.ts
scripts/cleanup.mjs
supabase/schema.sql
.github/workflows/maintenance.yml
public/frames/  public/sounds/
```

## Catatan keamanan

- Policy `anon read by id` (sesuai spesifikasi) membuat metadata foto bisa dibaca siapa pun yang punya anon key.
  ID berupa UUID acak jadi tidak bisa ditebak, tapi daftar baris tetap bisa di-query. Kalau ingin lebih ketat,
  ganti dengan fungsi RPC `get_photo(id)` yang `security definer` dan hapus policy select anon.
- Login Google di kiosk (auto-simpan Drive) memakai akun **operator**; tamu menyimpan ke Drive masing-masing
  lewat QR di HP mereka sendiri. Token Google hanya disimpan di memori/sessionStorage dan hangus ±1 jam.

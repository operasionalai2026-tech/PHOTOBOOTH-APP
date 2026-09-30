#!/usr/bin/env node
// Hapus foto (file storage + baris DB) yang lebih tua dari RETENTION_DAYS (default 30).
// Dijalankan oleh GitHub Actions. Butuh SUPABASE_SERVICE_ROLE_KEY (secret key `sb_secret_...` atau
// service_role lama) — HANYA dari GitHub Secrets,
// jangan pernah dipakai di frontend.
//
// Tanpa dependency: pakai fetch bawaan Node 18+.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup.mjs
//   DRY_RUN=1 → hanya tampilkan apa yang akan dihapus.

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const retentionDays = Number(process.env.RETENTION_DAYS || 30);
const bucket = process.env.STORAGE_BUCKET || 'photos';
const dryRun = process.env.DRY_RUN === '1';
const BATCH = 100;

if (!url || !key) {
  console.error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  process.exit(1);
}

// Key baru (sb_secret_...) cukup di header `apikey` — Supabase menolaknya di `Authorization: Bearer`.
// Key lama (service_role, JWT "eyJ...") dikirim di keduanya.
const headers = {
  apikey: key,
  ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
  'Content-Type': 'application/json',
};

async function api(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
console.log(`Cleanup foto sebelum ${cutoff} (retensi ${retentionDays} hari)${dryRun ? ' [DRY RUN]' : ''}`);

let totalRows = 0;
let totalBytes = 0;
let lastId = null;

for (;;) {
  const params = new URLSearchParams({
    select: 'id,image_path,gif_path,size_bytes',
    created_at: `lt.${cutoff}`,
    order: 'id.asc',
    limit: String(BATCH),
  });
  // Saat DRY_RUN baris tidak dihapus, jadi paginasi pakai id supaya tidak loop selamanya.
  if (dryRun && lastId) params.append('id', `gt.${lastId}`);
  const rows = await api(`/rest/v1/photo_sessions?${params}`);
  if (!rows.length) break;
  lastId = rows[rows.length - 1].id;

  const paths = rows.flatMap((r) => [r.image_path, r.gif_path]).filter(Boolean);
  const bytes = rows.reduce((s, r) => s + (r.size_bytes || 0), 0);

  if (!dryRun) {
    // 1) hapus file di storage (file yang sudah tidak ada diabaikan oleh API)
    if (paths.length) {
      await api(`/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        body: JSON.stringify({ prefixes: paths }),
      });
    }
    // 2) hapus barisnya
    const ids = rows.map((r) => r.id).join(',');
    await api(`/rest/v1/photo_sessions?id=in.(${ids})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }

  totalRows += rows.length;
  totalBytes += bytes;
  console.log(`  ${dryRun ? 'akan dihapus' : 'dihapus'}: ${rows.length} foto (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  if (rows.length < BATCH) break;
}

console.log(`Selesai: ${totalRows} foto, ${(totalBytes / 1024 / 1024).toFixed(1)} MB ${dryRun ? 'akan' : 'sudah'} dibersihkan.`);

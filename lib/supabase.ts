// Supabase client — diakses langsung dari browser dengan anon key + RLS.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EVENT, STORAGE_BUCKET } from '@/config/event';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export type PhotoSession = {
  id: string;
  event_slug: string;
  layout: string;
  frame: string | null;
  filter: string | null;
  image_path: string;
  /** GIF kolase berputar (mode GIF); null untuk foto biasa. */
  gif_path: string | null;
  /** Total ukuran file di storage (foto + GIF). */
  size_bytes: number | null;
  printed: boolean;
  created_at: string;
};

export type NewPhotoSession = Pick<PhotoSession, 'id' | 'layout' | 'frame' | 'filter' | 'size_bytes'> & {
  printed?: boolean;
};

export function imagePathFor(id: string, eventSlug = EVENT.slug, ext: 'jpg' | 'gif' = 'jpg') {
  return `${eventSlug}/${id}.${ext}`;
}

export function publicImageUrl(path: string): string {
  const sb = getSupabase();
  if (!sb) return '';
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly kind: 'offline' | 'quota' | 'config' | 'other',
  ) {
    super(message);
  }
}

/**
 * Upload foto terkompresi (+ GIF kalau ada) lalu catat barisnya di photo_sessions. Idempoten per id.
 * GIF bersifat tambahan: kalau project Supabase belum mengizinkan GIF (schema.sql lama), foto tetap terunggah.
 */
export async function uploadPhoto(blob: Blob, meta: NewPhotoSession, gif?: Blob | null): Promise<PhotoSession> {
  const sb = getSupabase();
  if (!sb) throw new UploadError('Supabase belum dikonfigurasi', 'config');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new UploadError('Offline', 'offline');

  const path = imagePathFor(meta.id);
  await uploadFile(sb, path, blob, 'image/jpeg');

  let gifPath: string | null = null;
  if (gif) {
    gifPath = imagePathFor(meta.id, EVENT.slug, 'gif');
    try {
      await uploadFile(sb, gifPath, gif, 'image/gif');
    } catch (e) {
      if (!(e instanceof GifNotAllowed)) throw e;
      console.warn('GIF tidak diunggah (bucket/policy belum mengizinkan GIF — jalankan ulang supabase/schema.sql).', e);
      gifPath = null;
    }
  }

  const row = {
    id: meta.id,
    event_slug: EVENT.slug,
    layout: meta.layout,
    frame: meta.frame,
    filter: meta.filter,
    image_path: path,
    size_bytes: blob.size + (gifPath && gif ? gif.size : 0),
    printed: meta.printed ?? false,
    ...(gifPath ? { gif_path: gifPath } : {}),
  };
  let { error: insErr } = await sb.from('photo_sessions').insert(row);
  // Kolom gif_path belum ada (schema lama) → simpan fotonya saja.
  if (insErr && gifPath && (insErr.code === 'PGRST204' || /gif_path/.test(insErr.message))) {
    const { gif_path: _unused, ...withoutGif } = row as typeof row & { gif_path?: string };
    ({ error: insErr } = await sb.from('photo_sessions').insert(withoutGif));
  }
  if (insErr && insErr.code !== '23505') throw classify(insErr);

  return { gif_path: null, ...row, created_at: new Date().toISOString() } as PhotoSession;
}

class GifNotAllowed extends Error {}

async function uploadFile(sb: SupabaseClient, path: string, blob: Blob, contentType: string) {
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  // Retry setelah upload sukses tapi insert gagal → file sudah ada, lanjut.
  if (!error || isDuplicate(error)) return;
  const msg = (error.message || '').toLowerCase();
  if (contentType === 'image/gif' && (msg.includes('mime') || msg.includes('row-level security') || msg.includes('policy'))) {
    throw new GifNotAllowed(error.message);
  }
  throw classify(error);
}

export async function markPrinted(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc('mark_printed', { p_id: id });
}

export async function fetchPhotoSession(id: string): Promise<PhotoSession | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('photo_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as PhotoSession | null;
}

function isDuplicate(err: { message?: string; statusCode?: string | number }) {
  const msg = (err.message || '').toLowerCase();
  return String(err.statusCode) === '409' || msg.includes('already exists') || msg.includes('duplicate');
}

function classify(err: { message?: string; statusCode?: string | number; status?: number }): UploadError {
  const msg = err.message || 'Upload gagal';
  const low = msg.toLowerCase();
  const code = String(err.statusCode ?? err.status ?? '');
  if (code === '413' || low.includes('quota') || low.includes('exceed') || low.includes('limit')) {
    return new UploadError(msg, 'quota');
  }
  if (low.includes('fetch') || low.includes('network')) return new UploadError(msg, 'offline');
  return new UploadError(msg, 'other');
}

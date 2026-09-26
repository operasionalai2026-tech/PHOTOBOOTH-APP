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
  size_bytes: number | null;
  printed: boolean;
  created_at: string;
};

export type NewPhotoSession = Pick<PhotoSession, 'id' | 'layout' | 'frame' | 'filter' | 'size_bytes'> & {
  printed?: boolean;
};

export function imagePathFor(id: string, eventSlug = EVENT.slug) {
  return `${eventSlug}/${id}.jpg`;
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

/** Upload foto terkompresi lalu catat barisnya di photo_sessions. Idempoten per id. */
export async function uploadPhoto(blob: Blob, meta: NewPhotoSession): Promise<PhotoSession> {
  const sb = getSupabase();
  if (!sb) throw new UploadError('Supabase belum dikonfigurasi', 'config');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new UploadError('Offline', 'offline');

  const path = imagePathFor(meta.id);
  const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  // Retry setelah upload sukses tapi insert gagal → file sudah ada, lanjut insert.
  if (upErr && !isDuplicate(upErr)) throw classify(upErr);

  const row = {
    id: meta.id,
    event_slug: EVENT.slug,
    layout: meta.layout,
    frame: meta.frame,
    filter: meta.filter,
    image_path: path,
    size_bytes: meta.size_bytes,
    printed: meta.printed ?? false,
  };
  const { error: insErr } = await sb.from('photo_sessions').insert(row);
  if (insErr && insErr.code !== '23505') throw classify(insErr);

  return { ...row, created_at: new Date().toISOString() } as PhotoSession;
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

// Konfigurasi event. Nilai dari env (NEXT_PUBLIC_*) di-inline saat build.

export const EVENT = {
  slug: process.env.NEXT_PUBLIC_EVENT_SLUG || 'demo',
  name: process.env.NEXT_PUBLIC_EVENT_NAME || 'Photobooth',
  tagline: process.env.NEXT_PUBLIC_EVENT_TAGLINE || '',
  baseUrl: (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  /** Detik hitung mundur sebelum tiap jepretan. */
  countdownSeconds: 3,
  /** Jeda antar jepretan (ms) supaya tamu sempat ganti gaya. */
  betweenShotsMs: 1200,
  /** Mirror kamera depan (lebih natural untuk selfie). */
  mirror: true,
  /** Kembali otomatis ke layar awal kalau layar hasil didiamkan (ms). 0 = mati. */
  idleResetMs: 120_000,

  /**
   * Opsional: URL suara shutter (mis. file dari Pixabay/Mixkit yang ditaruh di
   * public/sounds/shutter.mp3). Kalau kosong, suara shutter disintesis via Web Audio.
   */
  shutterSoundUrl: '',
};

/** Aturan free tier Supabase + retensi foto. */
export const LIMITS = {
  retentionDays: 30,
  storageQuotaBytes: 1024 * 1024 * 1024, // 1 GB
  bandwidthQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB / bulan
  storageWarnRatio: 0.8,
  /** Target ukuran upload (kompresi). */
  uploadMaxBytes: 500 * 1024,
  uploadMaxSide: 1800,
  uploadQuality: 0.8,
  /** Batas keras bucket. */
  bucketMaxBytes: 1024 * 1024,
} as const;

export const STORAGE_BUCKET = 'photos';

export function downloadUrl(id: string): string {
  const base = EVENT.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/p?id=${encodeURIComponent(id)}`;
}

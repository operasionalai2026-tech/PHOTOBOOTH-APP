// Konfigurasi event. Nilai dari env (NEXT_PUBLIC_*) di-inline saat build.

export const EVENT = {
  slug: process.env.NEXT_PUBLIC_EVENT_SLUG || 'demo',
  name: process.env.NEXT_PUBLIC_EVENT_NAME || 'Photobooth',
  tagline: process.env.NEXT_PUBLIC_EVENT_TAGLINE || '',
  baseUrl: (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  /** Detik "siap-siap" (tahap 1) sebelum hitung mundur tiap jepretan — waktu tamu atur gaya. */
  prepareSeconds: 3,
  /** Detik hitung mundur 3-2-1 (tahap 2) sebelum jepret. */
  countdownSeconds: 3,
  /** Mode GIF: jeda antar jepretan beruntun (ms) — waktu tamu ganti gaya. */
  gifIntervalMs: 1500,
  /** Lama tiap frame animasi GIF (ms). */
  gifFrameMs: 700,
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

/** Teks layar "siap-siap" sebelum hitung mundur. Ubah di sini untuk gaya bahasa event lain. */
export const PREPARE_TEXT = {
  first: (seconds: number) => `Oke, siap-siap dijepret ya! Gw kasih ${seconds} detik buat siap 😎`,
  next: (n: number, total: number) => `Foto ke-${n} dari ${total}, ganti gaya!`,
  retake: (n: number) => `Ulang foto ke-${n}, siap-siap ya!`,
  gif: (total: number) => `Mode GIF! ${total} foto beruntun, ganti gaya tiap jepret ya 😎`,
  burst: 'Ganti gaya!',
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
  /** GIF: ± jumlah piksel per frame (mis. 490x612 untuk 8x10) dan batas ukuran file (di bawah batas bucket). */
  gifPixels: 300_000,
  gifMaxBytes: 900 * 1024,
} as const;

export const STORAGE_BUCKET = 'photos';

export function downloadUrl(id: string): string {
  const base = EVENT.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/p?id=${encodeURIComponent(id)}`;
}

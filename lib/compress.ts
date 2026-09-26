// Kompres foto sebelum upload: maks ~500 KB, sisi terpanjang 1800px, JPEG ~0.8.
// Versi full-res TIDAK di-upload ke Supabase (hanya untuk print / simpan lokal / Drive).
// useWebWorker: false — mode worker memuat script dari CDN, padahal booth harus tetap jalan offline.

import imageCompression from 'browser-image-compression';
import { LIMITS } from '@/config/event';

export async function compressForUpload(full: Blob): Promise<Blob> {
  const file = new File([full], 'photo.jpg', { type: full.type || 'image/jpeg' });
  let out: Blob = await imageCompression(file, {
    maxSizeMB: LIMITS.uploadMaxBytes / (1024 * 1024),
    maxWidthOrHeight: LIMITS.uploadMaxSide,
    initialQuality: LIMITS.uploadQuality,
    fileType: 'image/jpeg',
    useWebWorker: false,
  });

  // Jaga-jaga: bucket menolak > 1 MB. Turunkan kualitas sampai aman.
  let quality = LIMITS.uploadQuality;
  while (out.size > LIMITS.uploadMaxBytes && quality > 0.4) {
    quality -= 0.1;
    out = await imageCompression(file, {
      maxSizeMB: LIMITS.uploadMaxBytes / (1024 * 1024),
      maxWidthOrHeight: LIMITS.uploadMaxSide,
      initialQuality: quality,
      fileType: 'image/jpeg',
      useWebWorker: false,
    });
  }
  if (out.size > LIMITS.bucketMaxBytes) {
    throw new Error('Foto terlalu besar setelah kompresi');
  }
  return out;
}

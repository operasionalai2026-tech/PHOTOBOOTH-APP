// Simpan foto ke perangkat: di HP pakai share sheet (bisa "Simpan Gambar" ke galeri),
// di desktop/kiosk pakai download biasa.

import { EVENT } from '@/config/event';

export function photoFileName(id: string, createdAt: Date | string = new Date()): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${EVENT.slug}-${stamp}-${id.slice(0, 6)}.jpg`;
}

function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}

export async function saveBlobToDevice(blob: Blob, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: EVENT.name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') throw e;
      // share gagal → jatuh ke download biasa
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

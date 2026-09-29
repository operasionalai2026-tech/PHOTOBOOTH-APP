// Menyusun foto akhir (full-res): warna dasar → foto per slot (+ filter) → gambar frame di atasnya.

import type { Filter } from '@/config/filters';
import { LAYOUTS, type Layout } from '@/config/layouts';

export type ComposeInput = {
  shots: HTMLCanvasElement[];
  layout: Layout;
  filter: Filter;
  /** Skala output; 1 = ukuran cetak penuh, <1 untuk preview cepat. */
  scale?: number;
};

const artCache = new Map<string, Promise<HTMLImageElement>>();

/** Muat gambar frame (sekali, lalu disimpan di memori supaya tetap jalan saat offline). */
export function loadArt(src: string): Promise<HTMLImageElement> {
  let p = artCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        artCache.delete(src);
        reject(new Error(`Gagal memuat frame ${src}`));
      };
      img.src = src;
    });
    artCache.set(src, p);
  }
  return p;
}

/** Muat semua frame di awal (booth dibuka) supaya siap walau koneksi putus di tengah acara. */
export function preloadAllArt() {
  LAYOUTS.forEach((l) => void loadArt(l.art.src).catch(() => undefined));
}

export async function composePhoto(input: ComposeInput): Promise<HTMLCanvasElement> {
  const { shots, layout, filter, scale = 1 } = input;
  const art = await loadArt(layout.art.src);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = layout.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);

  layout.slots.forEach((slot, i) => {
    const shot = shots[i] ?? shots[shots.length - 1];
    if (!shot) return;
    const photo = renderSlotPhoto(shot, slot.w / slot.h, Math.round(slot.w * scale), Math.round(slot.h * scale), filter);
    ctx.drawImage(photo, slot.x, slot.y, slot.w, slot.h);
  });

  const a = layout.art;
  ctx.drawImage(art, a.x, a.y, a.w, a.h);
  return canvas;
}

/** Strip 2x6 digandakan jadi satu kertas 4x6 (dua strip berdampingan, tinggal digunting). */
export function toPrintSheet(photo: HTMLCanvasElement, layout: Layout): HTMLCanvasElement {
  if (layout.print.copies === 1) return photo;
  const sheet = document.createElement('canvas');
  sheet.width = photo.width * 2;
  sheet.height = photo.height;
  const ctx = sheet.getContext('2d')!;
  ctx.drawImage(photo, 0, 0);
  ctx.drawImage(photo, photo.width, 0);
  return sheet;
}

/** Thumbnail persegi dengan filter (untuk pemilih filter). */
export function filterThumbnail(src: HTMLCanvasElement, filter: Filter, size: number): HTMLCanvasElement {
  return renderSlotPhoto(src, 1, size, size, filter);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))), type, quality);
  });
}

// ---------- internal ----------

/**
 * Potong sumber sesuai rasio slot (object-fit: cover, di tengah), ubah ke ukuran target,
 * lalu terapkan filter. Filter dijalankan setelah dipotong supaya cepat & resolusinya penuh.
 */
function renderSlotPhoto(src: HTMLCanvasElement, ratio: number, w: number, h: number, filter: Filter): HTMLCanvasElement {
  let sw = src.width;
  let sh = src.height;
  if (sw / sh > ratio) sw = sh * ratio;
  else sh = sw / ratio;
  const sx = (src.width - sw) / 2;
  const sy = (src.height - sh) / 2;

  const out = document.createElement('canvas');
  out.width = Math.max(1, w);
  out.height = Math.max(1, h);
  const ctx = out.getContext('2d', { willReadFrequently: !!filter.apply })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
  if (filter.apply) {
    const img = ctx.getImageData(0, 0, out.width, out.height);
    filter.apply(img);
    ctx.putImageData(img, 0, 0);
  }
  return out;
}

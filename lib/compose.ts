// Menyusun foto akhir (full-res) dari jepretan + layout + frame + filter.

import type { Filter } from '@/config/filters';
import type { Frame } from '@/config/frames';
import type { Layout, Rect } from '@/config/layouts';

export type ComposeInput = {
  shots: HTMLCanvasElement[];
  layout: Layout;
  frame: Frame;
  filter: Filter;
  title: string;
  tagline: string;
  /** Skala output; 1 = ukuran cetak penuh, <1 untuk preview cepat. */
  scale?: number;
};

const loadedFonts = new Set<string>();

export async function ensureFonts(fonts: string[]) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const pending = fonts.filter((f) => !loadedFonts.has(f));
  if (!pending.length) return;
  const all = Promise.all(
    pending.map((f) =>
      document.fonts
        .load(f)
        .then(() => loadedFonts.add(f))
        .catch(() => undefined),
    ),
  );
  // Jangan biarkan koneksi lambat/offline menahan booth: lewat 2,5 detik pakai font cadangan.
  await Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
}

export async function composePhoto(input: ComposeInput): Promise<HTMLCanvasElement> {
  const { shots, layout, frame, filter, title, tagline, scale = 1 } = input;
  await ensureFonts(frame.fonts);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';

  const fctx = { ctx, layout, title, tagline };
  frame.background(fctx);

  layout.slots.forEach((slot, i) => {
    const shot = shots[i] ?? shots[shots.length - 1];
    if (!shot) return;
    const photo = renderSlotPhoto(shot, slot.w / slot.h, Math.round(slot.w * scale), Math.round(slot.h * scale), filter);
    ctx.save();
    roundRectPath(ctx, slot, frame.photoRadius);
    ctx.clip();
    ctx.drawImage(photo, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
    if (frame.photoStroke) {
      ctx.save();
      ctx.strokeStyle = frame.photoStroke.color;
      ctx.lineWidth = frame.photoStroke.width;
      roundRectPath(ctx, slot, frame.photoRadius);
      ctx.stroke();
      ctx.restore();
    }
  });

  frame.overlay(fctx);
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

function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  if (radius > 0 && typeof ctx.roundRect === 'function') {
    ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
}

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

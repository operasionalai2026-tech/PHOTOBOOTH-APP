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
  await Promise.all(
    pending.map((f) =>
      document.fonts
        .load(f)
        .then(() => loadedFonts.add(f))
        .catch(() => undefined),
    ),
  );
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
    const filtered = applyFilter(shot, filter, Math.max(slot.w, slot.h) * scale);
    drawCover(ctx, filtered, slot, frame.photoRadius);
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

/** Gandakan strip 2x6 jadi satu kertas 4x6 (dua strip berdampingan, tinggal digunting). */
export function toPrintSheet(photo: HTMLCanvasElement, layout: Layout): HTMLCanvasElement {
  if (layout.id !== 'strip') return photo;
  const sheet = document.createElement('canvas');
  sheet.width = photo.width * 2;
  sheet.height = photo.height;
  const ctx = sheet.getContext('2d')!;
  ctx.drawImage(photo, 0, 0);
  ctx.drawImage(photo, photo.width, 0);
  return sheet;
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

/** Gambar sumber memenuhi slot (object-fit: cover), dipotong di tengah. */
function drawCover(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, slot: Rect, radius: number) {
  const srcRatio = src.width / src.height;
  const slotRatio = slot.w / slot.h;
  let sw = src.width;
  let sh = src.height;
  if (srcRatio > slotRatio) sw = sh * slotRatio;
  else sh = sw / slotRatio;
  const sx = (src.width - sw) / 2;
  const sy = (src.height - sh) / 2;
  ctx.save();
  roundRectPath(ctx, slot, radius);
  ctx.clip();
  ctx.drawImage(src, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

/**
 * Terapkan color matrix per pixel. Sumber diperkecil dulu seperlunya (maxSide)
 * supaya cepat — tidak ada gunanya memfilter 4K kalau slot cuma 1080px.
 */
function applyFilter(src: HTMLCanvasElement, filter: Filter, maxSide: number): HTMLCanvasElement {
  const ratio = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * ratio));
  const h = Math.max(1, Math.round(src.height * ratio));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: !!filter.matrix })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const m = filter.matrix;
  if (!m) return out;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[4];
    d[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[9];
    d[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[14];
    // Uint8ClampedArray otomatis clamp 0..255
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

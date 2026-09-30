// GIF "kolase berputar": desain frame tetap, foto-foto berpindah ke jendela sebelahnya tiap frame GIF
// (strip: naik satu jendela; grid 2x2: berputar melingkar), jadi setiap jendela jadi animasi kecil
// dan kolasenya selalu penuh. Frame pertama = susunan foto cetak. Hanya untuk gaya dengan lebih dari 1 foto.

import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';
import { EVENT, LIMITS } from '@/config/event';
import type { Filter } from '@/config/filters';
import type { Layout, Rect } from '@/config/layouts';
import { composePhoto } from './compose';

export function supportsGif(layout: Layout): boolean {
  return layout.slots.length > 1;
}

/**
 * Urutan jendela melingkar: strip (satu kolom/baris) diurutkan atas → bawah / kiri → kanan,
 * selain itu diurutkan menurut sudut dari titik tengah (searah jarum jam) supaya foto
 * hanya pindah ke jendela tetangga, tidak melompat diagonal.
 */
function ringOrder(slots: Rect[]): number[] {
  const c = slots.map((s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 }));
  const idx = slots.map((_, i) => i);
  const spread = (k: 'x' | 'y') => Math.max(...c.map((p) => p[k])) - Math.min(...c.map((p) => p[k]));
  if (spread('x') < spread('y') * 0.2) return idx.sort((a, b) => c[a].y - c[b].y);
  if (spread('y') < spread('x') * 0.2) return idx.sort((a, b) => c[a].x - c[b].x);
  const cx = c.reduce((sum, p) => sum + p.x, 0) / c.length;
  const cy = c.reduce((sum, p) => sum + p.y, 0) / c.length;
  const angle = (i: number) => Math.atan2(c[i].y - cy, c[i].x - cx);
  return idx.sort((a, b) => angle(a) - angle(b));
}

/** Foto untuk tiap jendela di frame GIF ke-k (k = 0 → susunan asli). */
export function carouselOrder(layout: Layout, k: number): number[] {
  const ring = ringOrder(layout.slots);
  const order: number[] = [];
  ring.forEach((slot, j) => {
    order[slot] = ring[(j + k) % ring.length];
  });
  return order;
}

type GifInput = { shots: HTMLCanvasElement[]; layout: Layout; filter: Filter };

/** Buat GIF (≤ LIMITS.gifMaxBytes supaya muat di bucket; resolusi diturunkan kalau perlu). */
export async function makeCarouselGif({ shots, layout, filter }: GifInput): Promise<Blob> {
  const n = layout.slots.length;
  let scale = Math.sqrt(LIMITS.gifPixels / (layout.width * layout.height));
  for (let attempt = 0; ; attempt++) {
    const frames: HTMLCanvasElement[] = [];
    for (let k = 0; k < n; k++) {
      const order = carouselOrder(layout, k);
      frames.push(await composePhoto({ shots: order.map((j) => shots[j] ?? shots[0]), layout, filter, scale }));
      await nextTick(); // beri napas ke UI (spinner tetap berputar)
    }
    const bytes = encode(frames, EVENT.gifFrameMs);
    if (bytes.length <= LIMITS.gifMaxBytes || attempt >= 4) {
      return new Blob([bytes], { type: 'image/gif' });
    }
    scale *= 0.85;
  }
}

/**
 * Satu palet untuk semua frame (isinya foto yang sama, hanya pindah jendela), diambil dari frame pertama.
 * Frame berikutnya hanya menyimpan piksel yang berubah; sisanya (desain frame) transparan → file jauh lebih kecil.
 */
function encode(frames: HTMLCanvasElement[], delay: number): Uint8Array<ArrayBuffer> {
  const { width, height } = frames[0];
  const pixels = frames.map((c) => c.getContext('2d')!.getImageData(0, 0, width, height).data);

  const colors = quantize(pixels[0], 255);
  const transparentIndex = colors.length;
  const palette: Palette = [...colors, [0, 0, 0]];

  const gif = GIFEncoder();
  let prev: Uint8Array | null = null;
  pixels.forEach((rgba) => {
    const index = applyPalette(rgba, colors);
    if (!prev) {
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0, dispose: 1 });
    } else {
      const diff = new Uint8Array(index);
      for (let p = 0; p < diff.length; p++) if (index[p] === prev[p]) diff[p] = transparentIndex;
      gif.writeFrame(diff, width, height, { delay, transparent: true, transparentIndex, dispose: 1 });
    }
    prev = index;
  });
  gif.finish();
  return gif.bytes();
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));

// Frame digambar sendiri via Canvas 2D (tanpa aset gambar berlisensi).
// Urutan gambar: background() → foto (compose.ts) → overlay() termasuk teks & dekorasi.

import type { Layout, Rect } from './layouts';

export type FrameContext = {
  ctx: CanvasRenderingContext2D;
  layout: Layout;
  title: string;
  tagline: string;
};

export type Frame = {
  id: string;
  /** Font yang harus dimuat sebelum menggambar (dipakai compose.ts). */
  fonts: string[];
  photoRadius: number;
  photoStroke?: { color: string; width: number };
  background: (f: FrameContext) => void;
  overlay: (f: FrameContext) => void;
};

// ---------- helper menggambar ----------

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function fillAll(ctx: CanvasRenderingContext2D, style: string | CanvasGradient) {
  // Reset transform: ctx bisa sedang di-scale (preview), sedangkan canvas.width dalam piksel asli.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Tulis teks, perkecil otomatis sampai muat di maxWidth. */
function fitText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: (size: number) => string,
  startSize: number,
  color: string,
  opts: { align?: CanvasTextAlign; letterSpacing?: number } = {},
) {
  if (!text) return;
  const spacing = opts.letterSpacing ?? 0;
  let size = startSize;
  ctx.font = font(size);
  const measure = () => ctx.measureText(text).width + spacing * size * text.length;
  while (measure() > maxWidth && size > 10) {
    size -= 2;
    ctx.font = font(size);
  }
  ctx.fillStyle = color;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx && spacing) ctx.letterSpacing = `${spacing * size}px`;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Potong teks dengan "…" supaya muat. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Bayangan ke dalam di tepi jendela foto, seperti kertas foto yang ditempel ke frame. */
function insetShadow(ctx: CanvasRenderingContext2D, r: Rect, depth: number, strength = 0.35) {
  ctx.save();
  const top = ctx.createLinearGradient(0, r.y, 0, r.y + depth);
  top.addColorStop(0, `rgba(0,0,0,${strength})`);
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(r.x, r.y, r.w, depth);
  const left = ctx.createLinearGradient(r.x, 0, r.x + depth * 0.6, 0);
  left.addColorStop(0, `rgba(0,0,0,${strength * 0.6})`);
  left.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = left;
  ctx.fillRect(r.x, r.y, depth * 0.6, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(1, depth * 0.15);
  ctx.beginPath();
  ctx.moveTo(r.x + r.w, r.y);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.stroke();
  ctx.restore();
}

/** Ikon 24x24 (path SVG) digambar di (x,y) = pusat ikon. */
function icon(
  ctx: CanvasRenderingContext2D,
  d: string,
  x: number,
  y: number,
  size: number,
  opts: { fill?: string; stroke?: string; lineWidth?: number },
) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  const p = new Path2D(d);
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill(p);
  }
  if (opts.stroke) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth ?? 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(p);
  }
  ctx.restore();
}

/** Pita satin pink (vektor). size ≈ lebar pita dalam px. */
function bow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number) {
  const s = size / 110; // desain dalam kotak ±55 unit
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(160, 70, 95, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  const satin = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#fbd9e0');
    g.addColorStop(0.45, '#f2b0c0');
    g.addColorStop(1, '#df8499');
    return g;
  };
  const shape = (d: string, fill: CanvasGradient | string) => {
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(d));
  };

  // Ekor pita (di belakang)
  shape('M-5 4 C-12 22 -20 40 -30 58 L-21 54 L-17 66 C-9 46 -2 26 5 7 Z', satin(-30, 0, 0, 66));
  shape('M5 4 C14 20 24 36 38 52 L28 53 L30 65 C18 46 9 26 -3 7 Z', satin(0, 0, 38, 65));
  // Kelopak kiri & kanan
  shape('M-3 -1 C-22 -30 -54 -36 -54 -12 C-54 9 -26 11 -3 4 Z', satin(-54, -34, -3, 8));
  shape('M3 -1 C22 -30 54 -36 54 -12 C54 9 26 11 3 4 Z', satin(54, -34, 3, 8));

  ctx.shadowColor = 'transparent';
  // Lipatan & kilap satin
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(190, 88, 112, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke(new Path2D('M-8 1 C-22 -10 -36 -14 -46 -10'));
  ctx.stroke(new Path2D('M8 1 C22 -10 36 -14 46 -10'));
  ctx.stroke(new Path2D('M-8 10 C-13 26 -18 38 -23 50'));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2.2;
  ctx.stroke(new Path2D('M-14 -17 C-26 -26 -40 -27 -47 -19'));
  ctx.stroke(new Path2D('M14 -17 C26 -26 40 -27 47 -19'));
  ctx.stroke(new Path2D('M10 12 C16 26 22 36 29 46'));

  // Simpul tengah
  const knot = ctx.createRadialGradient(-2, -2, 1, 0, 1, 12);
  knot.addColorStop(0, '#f6c2cf');
  knot.addColorStop(1, '#d97891');
  ctx.fillStyle = knot;
  ctx.beginPath();
  ctx.ellipse(0, 1, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function handleFrom(title: string) {
  const h = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return h || 'photobooth';
}

function hashNumber(text: string, min: number, max: number) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return min + (Math.abs(h) % (max - min));
}

const ICONS = {
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  comment: 'M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z',
  send: 'M22 3 9.218 10.083M11.698 20.334 22 3.001H2l7.218 7.083 2.48 10.25z',
  bookmark: 'M20 21 12 13.44 4 21V3h16v18z',
};

// ---------- daftar frame ----------

export const FRAMES: Frame[] = [
  // Polaroid putih: jendela persegi, bingkai bawah lebar untuk tulisan tangan.
  {
    id: 'polaroid',
    fonts: ['700 80px Caveat', '500 40px Caveat'],
    photoRadius: 0,
    background: ({ ctx, layout }) => {
      const g = ctx.createLinearGradient(0, 0, 0, layout.height);
      g.addColorStop(0, '#f7f7f6');
      g.addColorStop(0.7, '#efefee');
      g.addColorStop(1, '#e6e6e5');
      fillAll(ctx, g);
      // kilap lembut di bingkai bawah
      const f = layout.footer;
      const sheen = ctx.createRadialGradient(f.x + f.w / 2, f.y + f.h * 0.35, 0, f.x + f.w / 2, f.y + f.h * 0.35, f.w * 0.55);
      sheen.addColorStop(0, 'rgba(255,255,255,0.85)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(f.x, f.y, f.w, f.h);
    },
    overlay: ({ ctx, layout, title, tagline }) => {
      layout.slots.forEach((r) => insetShadow(ctx, r, 18, 0.4));
      const f = layout.footer;
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h * 0.42;
      fitText(ctx, title, cx, tagline ? cy - 40 : cy, f.w * 0.8, (z) => `700 ${z}px Caveat`, 190, '#2f2f33');
      fitText(ctx, tagline, cx, cy + 95, f.w * 0.7, (z) => `500 ${z}px Caveat`, 90, '#77767b');
    },
  },

  // Postingan Instagram: kartu putih, header akun, ikon suka/komentar/kirim/simpan.
  {
    id: 'instagram',
    fonts: ['600 40px Poppins', '400 40px Poppins'],
    photoRadius: 0,
    background: ({ ctx, layout }) => {
      const bg = ctx.createLinearGradient(0, 0, layout.width, layout.height);
      bg.addColorStop(0, '#f3f0f7');
      bg.addColorStop(1, '#e9edf3');
      fillAll(ctx, bg);
      const card = { x: 70, y: 70, w: layout.width - 140, h: layout.height - 140 };
      ctx.save();
      ctx.shadowColor = 'rgba(30, 20, 60, 0.16)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 52);
      ctx.fill();
      ctx.restore();
    },
    overlay: ({ ctx, layout, title, tagline }) => {
      const card = { x: 70, y: 70, w: layout.width - 140 };
      const handle = handleFrom(title);

      // Header: avatar dengan cincin story + username + •••
      const ax = card.x + 95;
      const ay = card.y + 85;
      const ring = ctx.createLinearGradient(ax - 50, ay + 50, ax + 50, ay - 50);
      ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'].forEach((c, i) => ring.addColorStop(i / 4, c));
      ctx.lineWidth = 7;
      ctx.strokeStyle = ring;
      ctx.beginPath();
      ctx.arc(ax, ay, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#dbdbdb';
      ctx.beginPath();
      ctx.arc(ax, ay, 41, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, 41, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ax, ay - 8, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ax, ay + 32, 28, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.font = '600 44px Poppins';
      ctx.fillStyle = '#262626';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ellipsize(ctx, handle, card.w - 330), ax + 80, ay);
      ctx.fillStyle = '#262626';
      [-22, 0, 22].forEach((dx) => {
        ctx.beginPath();
        ctx.arc(card.x + card.w - 70 + dx, ay, 6.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Baris ikon
      const f = layout.footer;
      const iy = f.y + 75;
      icon(ctx, ICONS.heart, f.x + 72, iy, 72, { fill: '#ff3040' });
      icon(ctx, ICONS.comment, f.x + 172, iy, 66, { stroke: '#262626', lineWidth: 2 });
      icon(ctx, ICONS.send, f.x + 270, iy, 66, { stroke: '#262626', lineWidth: 2 });
      icon(ctx, ICONS.bookmark, f.x + f.w - 70, iy, 66, { stroke: '#262626', lineWidth: 2 });
      ['#c7c7c7', '#0095f6', '#c7c7c7'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(f.x + f.w / 2 + (i - 1) * 26, iy, 7.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Suka, caption, komentar, waktu
      const tx = f.x + 42;
      const maxW = f.w - 84;
      const likes = hashNumber(title, 1200, 9999).toLocaleString('id-ID');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#262626';
      ctx.font = '600 40px Poppins';
      ctx.fillText(`${likes} suka`, tx, f.y + 175);

      const caption = `${tagline || `Seru-seruan di ${title}`} #photobooth`;
      ctx.font = '600 38px Poppins';
      const hw = ctx.measureText(`${handle} `).width;
      ctx.fillText(`${handle} `, tx, f.y + 240);
      ctx.font = '400 38px Poppins';
      ctx.fillText(ellipsize(ctx, caption, maxW - hw), tx + hw, f.y + 240);

      ctx.fillStyle = '#8e8e8e';
      ctx.font = '400 36px Poppins';
      ctx.fillText(`Lihat semua ${hashNumber(`${title}c`, 24, 480)} komentar`, tx, f.y + 305);
      fitText(ctx as Ctx, 'BARU SAJA', tx, f.y + 365, maxW, (z) => `500 ${z}px Poppins`, 26, '#a8a8a8', {
        align: 'left',
        letterSpacing: 0.08,
      });
    },
  },

  // Strip pita pink: kertas putih bertepi pink, 3 jendela, pita satin di dua sudut.
  {
    id: 'bow',
    fonts: ['700 60px Caveat'],
    photoRadius: 0,
    photoStroke: { color: '#d8d4d6', width: 3 },
    background: ({ ctx, layout }) => {
      fillAll(ctx, '#fffdfd');
      ctx.strokeStyle = '#f3c3cf';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, layout.width - 10, layout.height - 10);
      ctx.strokeStyle = 'rgba(243, 195, 207, 0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(22, 22, layout.width - 44, layout.height - 44);
    },
    overlay: ({ ctx, layout, title }) => {
      layout.slots.forEach((r) => insetShadow(ctx, r, 12, 0.28));
      const f = layout.footer;
      fitText(ctx, title, f.x + f.w * 0.42, f.y + f.h * 0.45, f.w * 0.62, (z) => `700 ${z}px Caveat`, 64, '#c97d90');
      bow(ctx, 92, 92, 175, -0.42);
      bow(ctx, layout.width - 78, layout.height - 88, 165, 0.32);
    },
  },

  // Strip klasik: bingkai putih, 4 foto landscape, nama event tebal di bawah.
  {
    id: 'classic-strip',
    fonts: ['400 80px "Bebas Neue"', '500 30px Poppins'],
    photoRadius: 0,
    background: ({ ctx }) => fillAll(ctx, '#ffffff'),
    overlay: ({ ctx, layout, title, tagline }) => {
      const f = layout.footer;
      const cx = f.x + f.w / 2;
      fitText(ctx, title.toUpperCase(), cx, f.y + 92, f.w * 0.84, (z) => `400 ${z}px "Bebas Neue"`, 92, '#111111', {
        letterSpacing: 0.04,
      });
      ctx.fillStyle = '#111111';
      ctx.fillRect(cx - 150, f.y + 150, 300, 3);
      fitText(ctx, tagline.toUpperCase(), cx, f.y + 190, f.w * 0.8, (z) => `500 ${z}px Poppins`, 24, '#555555', {
        letterSpacing: 0.25,
      });
    },
  },
];

export function getFrame(id: string | null | undefined): Frame {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

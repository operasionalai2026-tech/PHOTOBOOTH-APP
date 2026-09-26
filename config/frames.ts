// Frame dibuat sendiri via Canvas 2D (tanpa aset berlisensi).
// Setiap frame menggambar: background → (foto oleh compose.ts) → overlay + teks footer.

import type { Layout, Rect } from './layouts';

export type FrameContext = {
  ctx: CanvasRenderingContext2D;
  layout: Layout;
  title: string;
  tagline: string;
};

export type Frame = {
  id: string;
  name: string;
  /** Warna/gradien CSS untuk thumbnail di pemilih frame. */
  swatch: string;
  /** Font yang harus dimuat sebelum menggambar (dipakai compose.ts). */
  fonts: string[];
  photoRadius: number;
  photoStroke?: { color: string; width: number };
  background: (f: FrameContext) => void;
  overlay: (f: FrameContext) => void;
};

// ---------- helper menggambar ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillAll(ctx: CanvasRenderingContext2D, color: string) {
  // Reset transform: ctx bisa sedang di-scale (preview), sedangkan canvas.width dalam piksel asli.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Tulis teks di tengah, perkecil otomatis sampai muat. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  font: (size: number) => string,
  startSize: number,
  color: string,
  letterSpacing = 0,
) {
  if (!text) return;
  let size = startSize;
  ctx.font = font(size);
  const measure = () => ctx.measureText(text).width + letterSpacing * size * text.length;
  while (measure() > maxWidth && size > 12) {
    size -= 2;
    ctx.font = font(size);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx && letterSpacing) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing * size}px`;
  }
  ctx.fillText(text, cx, cy);
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }
}

function footerCenter(r: Rect) {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/** Skala relatif terhadap lebar kanvas 1200 (strip = 600 → 0.5). */
function scale(layout: Layout) {
  return layout.width / 1200;
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, center: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.28, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.28, 0, 0);
  ctx.fill();
  ctx.restore();
}

// ---------- daftar frame ----------

export const FRAMES: Frame[] = [
  {
    id: 'classic',
    name: 'Classic',
    swatch: 'linear-gradient(135deg,#fbf8f3,#efe7da)',
    fonts: ['italic 600 80px "Playfair Display"', '500 40px Poppins'],
    photoRadius: 10,
    background: ({ ctx }) => fillAll(ctx, '#fbf8f3'),
    overlay: ({ ctx, layout, title, tagline }) => {
      const s = scale(layout);
      const { cx, cy } = footerCenter(layout.footer);
      const dy = tagline ? -30 * s : 0;
      fitText(ctx, title, cx, cy + dy, layout.width * 0.84, (z) => `italic 600 ${z}px "Playfair Display"`, 110 * s, '#1f1b16');
      ctx.strokeStyle = '#c9b89c';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 90 * s, cy + dy + 70 * s);
      ctx.lineTo(cx + 90 * s, cy + dy + 70 * s);
      ctx.stroke();
      fitText(ctx, tagline.toUpperCase(), cx, cy + dy + 115 * s, layout.width * 0.8, (z) => `500 ${z}px Poppins`, 34 * s, '#7a6a55', 0.25);
    },
  },
  {
    id: 'noir',
    name: 'Noir Gold',
    swatch: 'linear-gradient(135deg,#0e0d12,#2a2330)',
    fonts: ['600 80px "Playfair Display"', '500 40px Poppins'],
    photoRadius: 0,
    photoStroke: { color: '#d4b16a', width: 4 },
    background: ({ ctx, layout }) => {
      fillAll(ctx, '#0e0d12');
      const s = scale(layout);
      const g = ctx.createRadialGradient(layout.width / 2, layout.height, 0, layout.width / 2, layout.height, layout.height * 0.6);
      g.addColorStop(0, 'rgba(212,177,106,0.18)');
      g.addColorStop(1, 'rgba(212,177,106,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, layout.width, layout.height);
      ctx.strokeStyle = 'rgba(212,177,106,0.55)';
      ctx.lineWidth = 2 * s;
      ctx.strokeRect(18 * s, 18 * s, layout.width - 36 * s, layout.height - 36 * s);
    },
    overlay: ({ ctx, layout, title, tagline }) => {
      const s = scale(layout);
      const { cx, cy } = footerCenter(layout.footer);
      const rand = mulberry32(7);
      ctx.fillStyle = '#e8cf93';
      for (let i = 0; i < 14; i++) {
        const x = layout.footer.x + 40 * s + rand() * (layout.footer.w - 80 * s);
        const y = layout.footer.y + 30 * s + rand() * (layout.footer.h - 60 * s);
        if (Math.abs(y - cy) < 90 * s && Math.abs(x - cx) < layout.width * 0.38) continue;
        sparkle(ctx, x, y, (6 + rand() * 14) * s);
      }
      const dy = tagline ? -26 * s : 0;
      fitText(ctx, title, cx, cy + dy, layout.width * 0.8, (z) => `600 ${z}px "Playfair Display"`, 100 * s, '#e8cf93');
      fitText(ctx, tagline.toUpperCase(), cx, cy + dy + 90 * s, layout.width * 0.76, (z) => `500 ${z}px Poppins`, 30 * s, '#b99a5c', 0.3);
    },
  },
  {
    id: 'confetti',
    name: 'Confetti',
    swatch: 'radial-gradient(circle at 30% 30%,#ff8fab 0 12%,transparent 13%),radial-gradient(circle at 70% 60%,#7bdff2 0 10%,transparent 11%),#fff4ec',
    fonts: ['400 80px Pacifico', '500 40px Poppins'],
    photoRadius: 28,
    background: ({ ctx, layout }) => {
      fillAll(ctx, '#fff4ec');
      const s = scale(layout);
      const rand = mulberry32(42);
      const colors = ['#ff5a7a', '#ffb703', '#7bdff2', '#8ac926', '#b388eb', '#ff8fab'];
      const count = Math.round(170 * (layout.width * layout.height) / (1200 * 1800));
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.globalAlpha = 0.85;
        ctx.translate(rand() * layout.width, rand() * layout.height);
        ctx.rotate(rand() * Math.PI);
        if (rand() > 0.5) {
          ctx.fillRect(-9 * s, -4 * s, 18 * s, 8 * s);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, (4 + rand() * 6) * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      // panel footer supaya teks terbaca
      const f = layout.footer;
      ctx.fillStyle = 'rgba(255,244,236,0.9)';
      ctx.beginPath();
      ctx.roundRect(f.x + 60 * s, f.y + 50 * s, f.w - 120 * s, f.h - 100 * s, 40 * s);
      ctx.fill();
    },
    overlay: ({ ctx, layout, title, tagline }) => {
      const s = scale(layout);
      const { cx, cy } = footerCenter(layout.footer);
      const dy = tagline ? -28 * s : 0;
      fitText(ctx, title, cx, cy + dy, layout.width * 0.74, (z) => `400 ${z}px Pacifico`, 96 * s, '#ff5a7a');
      fitText(ctx, tagline, cx, cy + dy + 88 * s, layout.width * 0.7, (z) => `600 ${z}px Poppins`, 32 * s, '#6c5b7b');
    },
  },
  {
    id: 'retro',
    name: 'Retro 70s',
    swatch: 'linear-gradient(180deg,#f6e7c8 0 55%,#f28c28 55% 70%,#d9480f 70% 85%,#7a3b1d 85%)',
    fonts: ['400 80px "Bebas Neue"', '500 40px Poppins'],
    photoRadius: 0,
    photoStroke: { color: '#3b2314', width: 3 },
    background: ({ ctx, layout }) => {
      fillAll(ctx, '#f6e7c8');
      const s = scale(layout);
      const f = layout.footer;
      const colors = ['#f28c28', '#d9480f', '#7a3b1d'];
      const band = 22 * s;
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, f.y + f.h - 60 * s - (colors.length - i) * band, layout.width, band);
      });
    },
    overlay: ({ ctx, layout, title, tagline }) => {
      const s = scale(layout);
      const f = layout.footer;
      const cx = f.x + f.w / 2;
      const cy = f.y + (f.h - 60 * s - 3 * 22 * s) / 2 + 10 * s;
      const dy = tagline ? -22 * s : 0;
      fitText(ctx, title.toUpperCase(), cx, cy + dy, layout.width * 0.86, (z) => `400 ${z}px "Bebas Neue"`, 150 * s, '#3b2314', 0.04);
      fitText(ctx, tagline.toUpperCase(), cx, cy + dy + 90 * s, layout.width * 0.8, (z) => `600 ${z}px Poppins`, 30 * s, '#7a3b1d', 0.2);
    },
  },
  {
    id: 'bloom',
    name: 'Bloom',
    swatch: 'radial-gradient(circle at 25% 75%,#f4a7b9 0 14%,transparent 15%),radial-gradient(circle at 75% 25%,#f9d5a7 0 12%,transparent 13%),#eef1ea',
    fonts: ['italic 500 80px "Playfair Display"', '500 40px Poppins'],
    photoRadius: 18,
    background: ({ ctx }) => fillAll(ctx, '#eef1ea'),
    overlay: ({ ctx, layout, title, tagline }) => {
      const s = scale(layout);
      const W = layout.width;
      const H = layout.height;
      const cluster = (x: number, y: number, flip: number) => {
        leaf(ctx, x, y, 110 * s, flip * 0.6 - Math.PI / 2, '#8aa37f');
        leaf(ctx, x, y, 90 * s, flip * 1.5 - Math.PI / 2, '#a9bf9d');
        flower(ctx, x, y, 60 * s, '#f4a7b9', '#f9d5a7');
        flower(ctx, x + flip * 58 * s, y + 38 * s, 38 * s, '#f9d5a7', '#e88aa0');
      };
      cluster(30 * s, 30 * s, 1);
      cluster(W - 30 * s, H - 30 * s, -1);
      flower(ctx, W - 40 * s, 44 * s, 30 * s, '#e88aa0', '#fff3d6');
      flower(ctx, 44 * s, H - 44 * s, 30 * s, '#e88aa0', '#fff3d6');
      const { cx, cy } = footerCenter(layout.footer);
      const dy = tagline ? -28 * s : 0;
      fitText(ctx, title, cx, cy + dy, W * 0.72, (z) => `italic 500 ${z}px "Playfair Display"`, 100 * s, '#3f5238');
      fitText(ctx, tagline, cx, cy + dy + 86 * s, W * 0.68, (z) => `500 ${z}px Poppins`, 30 * s, '#6b7f62', 0.12);
    },
  },
];

export function getFrame(id: string | null | undefined): Frame {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

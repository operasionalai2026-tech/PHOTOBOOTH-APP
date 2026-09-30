'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { getFilter } from '@/config/filters';
import { LAYOUTS, type Layout } from '@/config/layouts';
import { composePhoto } from '@/lib/compose';
import { supportsGif } from '@/lib/gif';
import { useBooth } from '@/lib/store';

export function LayoutPicker() {
  const chooseLayout = useBooth((s) => s.chooseLayout);
  const reset = useBooth((s) => s.reset);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={reset}>
          <Icon name="arrow-left" /> Kembali
        </Button>
        <StepDots active={0} />
        <div className="w-24" />
      </header>

      <div className="mt-4 text-center">
        <h2 className="font-display text-4xl font-semibold sm:text-5xl">Pilih gaya foto</h2>
        <p className="mt-2 text-white/55">Filter bisa dipilih setelah foto diambil</p>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-7xl flex-1 grid-cols-2 content-center gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-6">
        {LAYOUTS.map((layout, i) => (
          <motion.button
            key={layout.id}
            type="button"
            onClick={() => chooseLayout(layout)}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 * i, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex flex-col items-center gap-4 rounded-3xl bg-white/[0.06] p-4 text-center ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-accent/60 sm:p-6"
          >
            <LayoutThumb layout={layout} />
            <div>
              <div className="text-xl font-semibold sm:text-2xl">{layout.name}</div>
              <div className="mt-1 text-sm text-white/55">
                {layout.description} · {layout.sizeLabel}
              </div>
            </div>
            {supportsGif(layout) && (
              <span
                title="Bisa mode GIF"
                className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/30"
              >
                <Icon name="burst" className="h-3.5 w-3.5" /> GIF
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ---------- pratinjau frame asli dengan foto contoh ----------

const thumbCache = new Map<string, string>();

/** Foto contoh (siluet) untuk mengisi slot pratinjau. */
function placeholderShot(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 640, 480);
  g.addColorStop(0, '#c9c2dc');
  g.addColorStop(1, '#f0cfdc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(320, 200, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(320, 430, 150, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function LayoutThumb({ layout }: { layout: Layout }) {
  const [src, setSrc] = useState(() => thumbCache.get(layout.id) ?? null);

  useEffect(() => {
    if (thumbCache.has(layout.id)) return;
    let alive = true;
    const shot = placeholderShot();
    composePhoto({
      shots: layout.slots.map(() => shot),
      layout,
      filter: getFilter('none'),
      scale: 520 / layout.height,
    }).then((canvas) => {
      const url = canvas.toDataURL('image/png');
      thumbCache.set(layout.id, url);
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [layout]);

  return (
    <div className="flex h-52 w-full items-center justify-center sm:h-64">
      {src ? (
        <img src={src} alt={`Contoh ${layout.name}`} className="h-full w-auto max-w-full rounded-md object-contain drop-shadow-xl" />
      ) : (
        <div className="h-full w-2/3 animate-pulse rounded-md bg-white/10" />
      )}
    </div>
  );
}

export function StepDots({ active }: { active: number }) {
  const labels = ['Gaya', 'Foto', 'Hias', 'Hasil'];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div
            className={`h-2 rounded-full transition-all ${
              i === active ? 'w-8 bg-accent' : i < active ? 'w-2 bg-accent/60' : 'w-2 bg-white/20'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

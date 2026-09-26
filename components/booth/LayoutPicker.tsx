'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LAYOUTS, type Layout } from '@/config/layouts';
import { useBooth } from '@/lib/store';

export function LayoutPicker() {
  const chooseLayout = useBooth((s) => s.chooseLayout);
  const reset = useBooth((s) => s.reset);

  return (
    <div className="flex flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={reset}>
          <Icon name="arrow-left" /> Kembali
        </Button>
        <StepDots active={0} />
        <div className="w-24" />
      </header>

      <div className="mt-6 text-center">
        <h2 className="font-display text-4xl font-semibold sm:text-5xl">Pilih gaya foto</h2>
        <p className="mt-2 text-white/55">Kamu bisa ganti frame & filter setelah foto diambil</p>
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-5xl flex-1 grid-cols-1 content-center gap-5 sm:grid-cols-3 sm:gap-7">
        {LAYOUTS.map((layout, i) => (
          <motion.button
            key={layout.id}
            type="button"
            onClick={() => chooseLayout(layout)}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-5 rounded-3xl bg-white/[0.06] p-5 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-accent/60 sm:flex-col sm:p-7 sm:text-center"
          >
            <LayoutThumb layout={layout} />
            <div>
              <div className="text-2xl font-semibold">{layout.name}</div>
              <div className="mt-1 text-white/55">{layout.description}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function LayoutThumb({ layout, className = 'h-32 sm:h-52' }: { layout: Layout; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={`${className} shrink-0 drop-shadow-xl transition group-hover:drop-shadow-2xl`}
      aria-hidden="true"
    >
      <rect width={layout.width} height={layout.height} rx={24} fill="#fbf8f3" />
      {layout.slots.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={10} className="fill-accent/70" />
      ))}
      <rect
        x={layout.width * 0.25}
        y={layout.footer.y + layout.footer.h * 0.42}
        width={layout.width * 0.5}
        height={Math.max(24, layout.footer.h * 0.12)}
        rx={12}
        fill="#d9cfc0"
      />
    </svg>
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

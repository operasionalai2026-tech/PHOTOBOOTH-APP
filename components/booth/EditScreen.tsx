'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT } from '@/config/event';
import { FILTERS, getFilter } from '@/config/filters';
import { FRAMES, getFrame } from '@/config/frames';
import { canvasToBlob, composePhoto } from '@/lib/compose';
import { useSticky } from '@/lib/useSticky';
import { useBooth } from '@/lib/store';
import { uuid } from '@/lib/uuid';
import { StepDots } from './LayoutPicker';
import { Spinner } from './SaveOptions';

export function EditScreen() {
  const layout = useSticky(useBooth((s) => s.layout))!;
  const shots = useBooth((s) => s.shots);
  const frameId = useBooth((s) => s.frameId);
  const filterId = useBooth((s) => s.filterId);
  const setFrame = useBooth((s) => s.setFrame);
  const setFilter = useBooth((s) => s.setFilter);
  const setResult = useBooth((s) => s.setResult);
  const go = useBooth((s) => s.go);

  const [preview, setPreview] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const renderId = useRef(0);

  // Preview cepat (skala kecil); dirender ulang setiap frame/filter berubah.
  useEffect(() => {
    const id = ++renderId.current;
    const t = setTimeout(async () => {
      const canvas = await composePhoto({
        shots,
        layout,
        frame: getFrame(frameId),
        filter: getFilter(filterId),
        title: EVENT.name,
        tagline: EVENT.tagline,
        scale: 0.4,
      });
      if (id === renderId.current) setPreview(canvas.toDataURL('image/jpeg', 0.85));
    }, 40);
    return () => clearTimeout(t);
  }, [shots, layout, frameId, filterId]);

  const filterThumb = useMemo(() => {
    const src = shots[0];
    if (!src) return '';
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const s = Math.min(src.width, src.height);
    c.getContext('2d')!.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 160, 160);
    return c.toDataURL('image/jpeg', 0.8);
  }, [shots]);

  const finish = async () => {
    setFinishing(true);
    try {
      const full = await composePhoto({
        shots,
        layout,
        frame: getFrame(frameId),
        filter: getFilter(filterId),
        title: EVENT.name,
        tagline: EVENT.tagline,
      });
      const fullBlob = await canvasToBlob(full, 'image/jpeg', 0.95);
      setResult({
        id: uuid(),
        fullBlob,
        fullUrl: URL.createObjectURL(fullBlob),
        createdAt: new Date().toISOString(),
      });
    } catch {
      setFinishing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => go('capture')} disabled={finishing}>
          <Icon name="arrow-left" /> Ubah foto
        </Button>
        <StepDots active={2} />
        <Button onClick={finish} disabled={finishing || !preview}>
          {finishing ? <Spinner className="h-5 w-5" /> : <Icon name="check" />}
          Selesai
        </Button>
      </header>

      <div className="mt-4 grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Preview */}
        <div className="flex min-h-0 items-center justify-center">
          {preview ? (
            <motion.img
              key={preview.length}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              src={preview}
              alt="Preview foto"
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/60"
              style={{ maxHeight: 'calc(100dvh - 180px)' }}
            />
          ) : (
            <Spinner className="h-10 w-10 text-white/50" />
          )}
        </div>

        {/* Kontrol */}
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto scrollbar-none pb-4">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">Frame</h3>
            <div className="grid grid-cols-5 gap-3 lg:grid-cols-3">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrame(f.id)}
                  className={`group flex flex-col items-center gap-2 rounded-2xl p-2 transition ${
                    f.id === frameId ? 'bg-white/10 ring-2 ring-accent' : 'ring-1 ring-white/10 hover:bg-white/5'
                  }`}
                >
                  <span className="aspect-[2/3] w-full rounded-lg ring-1 ring-black/10" style={{ background: f.swatch }} />
                  <span className="text-xs font-medium text-white/80">{f.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">Filter</h3>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-7 lg:grid-cols-3">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-2 transition ${
                    f.id === filterId ? 'bg-white/10 ring-2 ring-accent' : 'ring-1 ring-white/10 hover:bg-white/5'
                  }`}
                >
                  {filterThumb && (
                    <img
                      src={filterThumb}
                      alt=""
                      className="aspect-square w-full rounded-lg object-cover"
                      style={{ filter: f.css }}
                    />
                  )}
                  <span className="text-xs font-medium text-white/80">{f.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

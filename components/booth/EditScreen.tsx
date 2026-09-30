'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { FILTERS, getFilter } from '@/config/filters';
import { canvasToBlob, composePhoto, filterThumbnail } from '@/lib/compose';
import { makeCarouselGif, supportsGif } from '@/lib/gif';
import { useSticky } from '@/lib/useSticky';
import { useBooth } from '@/lib/store';
import { uuid } from '@/lib/uuid';
import { StepDots } from './LayoutPicker';
import { ViewTabs } from './ViewTabs';
import { Spinner } from './SaveOptions';

export function EditScreen() {
  const layout = useSticky(useBooth((s) => s.layout))!;
  const shots = useBooth((s) => s.shots);
  const filterId = useBooth((s) => s.filterId);
  const setFilter = useBooth((s) => s.setFilter);
  const setResult = useBooth((s) => s.setResult);
  const go = useBooth((s) => s.go);
  const gifMode = useBooth((s) => s.captureMode) === 'gif' && supportsGif(layout);

  const [preview, setPreview] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [view, setView] = useState<'photo' | 'gif'>(gifMode ? 'gif' : 'photo');
  const [gifPreview, setGifPreview] = useState<{ filterId: string; url: string } | null>(null);
  const renderId = useRef(0);
  const gifPreviewUrl = useRef<string | null>(null);

  // GIF per filter, dibuat sekali lalu dipakai ulang untuk preview & hasil akhir.
  const getGif = useMemo(() => {
    const cache = new Map<string, Promise<Blob>>();
    return (id: string) => {
      let p = cache.get(id);
      if (!p) {
        p = makeCarouselGif({ shots, layout, filter: getFilter(id) });
        p.catch(() => cache.delete(id));
        cache.set(id, p);
      }
      return p;
    };
  }, [shots, layout]);

  // Preview cepat (skala kecil); dirender ulang setiap frame/filter berubah.
  useEffect(() => {
    const id = ++renderId.current;
    const t = setTimeout(async () => {
      const canvas = await composePhoto({
        shots,
        layout,
        filter: getFilter(filterId),
        scale: 0.4,
      });
      if (id === renderId.current) setPreview(canvas.toDataURL('image/jpeg', 0.85));
    }, 40);
    return () => clearTimeout(t);
  }, [shots, layout, filterId]);

  // Preview GIF (animasi asli, sama persis dengan file yang disimpan) untuk filter yang dipilih.
  useEffect(() => {
    if (!gifMode || view !== 'gif') return;
    let alive = true;
    const t = setTimeout(() => {
      getGif(filterId)
        .then((blob) => {
          if (!alive) return;
          if (gifPreviewUrl.current) URL.revokeObjectURL(gifPreviewUrl.current);
          const url = (gifPreviewUrl.current = URL.createObjectURL(blob));
          setGifPreview({ filterId, url });
        })
        .catch(() => undefined);
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [gifMode, view, filterId, getGif]);

  useEffect(
    () => () => {
      if (gifPreviewUrl.current) URL.revokeObjectURL(gifPreviewUrl.current);
    },
    [],
  );

  // Thumbnail tiap filter dirender dengan filter sungguhan dari foto pertama.
  const filterThumbs = useMemo(() => {
    const src = shots[0];
    if (!src) return {} as Record<string, string>;
    return Object.fromEntries(FILTERS.map((f) => [f.id, filterThumbnail(src, f, 220).toDataURL('image/jpeg', 0.85)]));
  }, [shots]);

  const finish = async () => {
    setFinishing(true);
    try {
      const full = await composePhoto({
        shots,
        layout,
        filter: getFilter(filterId),
      });
      const fullBlob = await canvasToBlob(full, 'image/jpeg', 0.95);
      const gifBlob = gifMode ? await getGif(filterId).catch(() => undefined) : undefined;
      setResult({
        id: uuid(),
        fullBlob,
        fullUrl: URL.createObjectURL(fullBlob),
        gifBlob,
        gifUrl: gifBlob ? URL.createObjectURL(gifBlob) : undefined,
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
        <div className="relative flex min-h-0 flex-col items-center justify-center gap-3">
          {gifMode && <ViewTabs value={view} onChange={setView} />}
          {view === 'gif' ? (
            gifPreview?.filterId === filterId ? (
              <img
                src={gifPreview.url}
                alt="Preview GIF"
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/60"
                style={{ maxHeight: 'calc(100dvh - 230px)' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <Spinner className="h-10 w-10 text-white/50" />
                Membuat GIF…
              </div>
            )
          ) : preview ? (
            <motion.img
              key={preview.length}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              src={preview}
              alt="Preview foto"
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/60"
              style={{ maxHeight: gifMode ? 'calc(100dvh - 230px)' : 'calc(100dvh - 180px)' }}
            />
          ) : (
            <Spinner className="h-10 w-10 text-white/50" />
          )}
        </div>

        {/* Kontrol */}
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto scrollbar-none pb-4">
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-widest text-white/45">Gaya</div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-lg font-semibold">{layout.name}</span>
              <span className="text-sm text-white/55">
                {layout.description} · {layout.sizeLabel}
              </span>
            </div>
            {gifMode && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-200/90">
                <Icon name="burst" className="h-4 w-4" /> Mode GIF: hasil berupa foto cetak + GIF kolase berputar
              </div>
            )}
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">Filter</h3>
            <div className="grid grid-cols-4 gap-3 lg:grid-cols-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-2 transition ${
                    f.id === filterId ? 'bg-white/10 ring-2 ring-accent' : 'ring-1 ring-white/10 hover:bg-white/5'
                  }`}
                >
                  {filterThumbs[f.id] && (
                    <img src={filterThumbs[f.id]} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  )}
                  <span className="text-sm font-semibold text-white/90">{f.name}</span>
                  <span className="-mt-1.5 hidden text-center text-[11px] leading-tight text-white/45 sm:block">
                    {f.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

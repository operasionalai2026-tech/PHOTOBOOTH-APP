'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Backdrop } from '@/components/ui/Backdrop';
import { preloadAllArt } from '@/lib/compose';
import { getAll, startAutoRetry, subscribe } from '@/lib/offlineQueue';
import { loadSettings, useBooth } from '@/lib/store';
import { CaptureScreen } from './CaptureScreen';
import { EditScreen } from './EditScreen';
import { LayoutPicker } from './LayoutPicker';
import { ResultScreen } from './ResultScreen';
import { StartScreen } from './StartScreen';

export function BoothApp() {
  const step = useBooth((s) => s.step);
  const setQueueCount = useBooth((s) => s.setQueueCount);
  const updateSettings = useBooth((s) => s.updateSettings);

  // Pengaturan operator (kamera, suara, auto-Drive) dari localStorage.
  useEffect(() => {
    updateSettings(loadSettings());
    preloadAllArt();
  }, [updateSettings]);

  // Retry upload otomatis + hitung antrian.
  useEffect(() => {
    const refresh = () =>
      getAll()
        .then((items) => setQueueCount(items.length))
        .catch(() => undefined);
    refresh();
    const unsub = subscribe((e) => e.type === 'changed' && refresh());
    const stop = startAutoRetry();
    return () => {
      unsub();
      stop();
    };
  }, [setQueueCount]);

  return (
    <main className="booth relative flex h-[100dvh] w-full flex-col overflow-hidden">
      <Backdrop />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, y: 24, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.99 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 'start' && <StartScreen />}
          {step === 'layout' && <LayoutPicker />}
          {step === 'capture' && <CaptureScreen />}
          {step === 'edit' && <EditScreen />}
          {step === 'result' && <ResultScreen />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

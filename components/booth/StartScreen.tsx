'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT } from '@/config/event';
import { unlockAudio } from '@/lib/sound';
import { useBooth } from '@/lib/store';
import { SettingsPanel } from './SettingsPanel';

export function StartScreen() {
  const go = useBooth((s) => s.go);
  const queueCount = useBooth((s) => s.queueCount);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        {queueCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-300/30">
            <Icon name="cloud-off" className="h-4 w-4" />
            {queueCount} foto menunggu upload
          </span>
        )}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Pengaturan"
        >
          <Icon name="settings" className="h-5 w-5" />
        </button>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 160, damping: 16 }}
        className="relative mb-10"
      >
        <div className="absolute inset-0 animate-ping rounded-full bg-accent/20 [animation-duration:2.6s]" />
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-accent to-fuchsia-500 shadow-glow sm:h-32 sm:w-32">
          <Icon name="camera" className="h-14 w-14 text-white sm:h-16 sm:w-16" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-3 text-sm font-medium uppercase tracking-[0.35em] text-accent-soft"
      >
        Photobooth
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-7xl"
      >
        {EVENT.name}
      </motion.h1>
      {EVENT.tagline && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36 }}
          className="mt-4 text-lg text-white/60"
        >
          {EVENT.tagline}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-14"
      >
        <Button
          size="xl"
          onClick={() => {
            unlockAudio();
            go('layout');
          }}
        >
          Mulai Foto
          <Icon name="arrow-right" className="h-7 w-7" />
        </Button>
        <p className="mt-5 text-sm text-white/40">Sentuh untuk mulai · gratis · foto bisa diunduh lewat QR</p>
      </motion.div>

      <AnimatePresence>{settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
    </div>
  );
}

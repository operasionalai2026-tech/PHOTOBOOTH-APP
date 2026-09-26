'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT } from '@/config/event';
import { captureFrame, cameraErrorMessage, startCamera, stopCamera, type CameraError } from '@/lib/camera';
import { playBeep, playShutter } from '@/lib/sound';
import { useBooth } from '@/lib/store';
import { StepDots } from './LayoutPicker';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CaptureScreen() {
  const layout = useBooth((s) => s.layout)!;
  const setShots = useBooth((s) => s.setShots);
  const go = useBooth((s) => s.go);
  const cameraId = useBooth((s) => s.settings.cameraId);
  const soundOn = useBooth((s) => s.settings.sound);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [taken, setTaken] = useState<string[]>([]);

  const total = layout.slots.length;

  const openCamera = useCallback(async () => {
    setError(null);
    setReady(false);
    stopCamera(streamRef.current);
    try {
      streamRef.current = await startCamera(videoRef.current!, cameraId ?? undefined);
      setReady(true);
    } catch (e) {
      setError(cameraErrorMessage(((e as { code?: CameraError }).code ?? 'unknown') as CameraError));
    }
  }, [cameraId]);

  useEffect(() => {
    cancelled.current = false;
    void openCamera();
    return () => {
      cancelled.current = true;
      stopCamera(streamRef.current);
    };
  }, [openCamera]);

  const run = async () => {
    if (!videoRef.current || running) return;
    setRunning(true);
    const shots: HTMLCanvasElement[] = [];
    const thumbs: string[] = [];
    for (let i = 0; i < total; i++) {
      for (let n = EVENT.countdownSeconds; n > 0; n--) {
        if (cancelled.current) return;
        setCount(n);
        if (soundOn) playBeep(n === 1);
        await wait(1000);
      }
      if (cancelled.current) return;
      setCount(null);
      if (soundOn) playShutter();
      setFlash((f) => f + 1);
      const shot = captureFrame(videoRef.current, EVENT.mirror);
      shots.push(shot);
      thumbs.push(thumbnail(shot));
      setTaken([...thumbs]);
      if (i < total - 1) await wait(EVENT.betweenShotsMs);
    }
    await wait(500);
    if (!cancelled.current) setShots(shots);
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => go('layout')} disabled={running}>
          <Icon name="arrow-left" /> Ganti gaya
        </Button>
        <StepDots active={1} />
        <div className="w-28 text-right text-sm font-medium text-white/60">
          {taken.length}/{total} foto
        </div>
      </header>

      <div className="relative mx-auto mt-4 flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
        <div className="relative aspect-[4/3] max-h-full w-full overflow-hidden rounded-[2rem] bg-ink-800 ring-1 ring-white/10 sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            style={{ transform: EVENT.mirror ? 'scaleX(-1)' : undefined }}
            playsInline
            muted
            autoPlay
          />

          {/* Countdown */}
          <AnimatePresence>
            {count !== null && (
              <motion.div
                key={count}
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="absolute inset-0 grid place-items-center"
              >
                <span className="font-display text-[28vmin] font-semibold leading-none text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                  {count}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flash */}
          <AnimatePresence>
            {flash > 0 && (
              <motion.div
                key={flash}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="pointer-events-none absolute inset-0 bg-white"
              />
            )}
          </AnimatePresence>

          {/* Status kamera */}
          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center text-white/60">Membuka kamera…</div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div className="max-w-md">
                <Icon name="camera" className="mx-auto h-12 w-12 text-white/40" />
                <p className="mt-4 text-lg">{error}</p>
                <Button className="mt-6" variant="secondary" onClick={openCamera}>
                  <Icon name="refresh" /> Coba lagi
                </Button>
              </div>
            </div>
          )}

          {/* Tombol mulai */}
          {ready && !running && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent pb-8 pt-24">
              <p className="text-white/80">
                {total > 1 ? `${total} jepretan, masing-masing hitung mundur ${EVENT.countdownSeconds} detik` : 'Siap-siap gaya terbaikmu!'}
              </p>
              <Button size="xl" onClick={run}>
                <Icon name="camera" className="h-7 w-7" /> Jepret!
              </Button>
            </div>
          )}

          {/* Petunjuk jepretan ke-berapa */}
          {running && count !== null && total > 1 && (
            <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm font-medium backdrop-blur">
              Foto {taken.length + 1} dari {total}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail hasil */}
      <div className="mx-auto mt-4 flex h-20 items-center gap-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="relative h-16 w-24 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 sm:h-20 sm:w-28"
          >
            <AnimatePresence>
              {taken[i] && (
                <motion.img
                  src={taken[i]}
                  alt=""
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-full w-full object-cover"
                />
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function thumbnail(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  const w = 240;
  c.width = w;
  c.height = Math.round((src.height / src.width) * w);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

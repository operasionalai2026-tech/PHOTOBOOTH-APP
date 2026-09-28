'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT, PREPARE_TEXT } from '@/config/event';
import { captureFrame, cameraErrorMessage, startCamera, stopCamera, type CameraError } from '@/lib/camera';
import { playBeep, playShutter } from '@/lib/sound';
import { useSticky } from '@/lib/useSticky';
import { useBooth } from '@/lib/store';
import { StepDots } from './LayoutPicker';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * idle      → tombol "Jepret!"
 * prepare   → tahap 1: "siap-siap" (EVENT.prepareSeconds)
 * countdown → tahap 2: hitung mundur 3-2-1 lalu jepret
 * review    → semua foto terambil; Retake per foto atau Lanjut
 */
type Phase = 'idle' | 'prepare' | 'countdown' | 'review';

type Slot<T> = (T | null)[];

function replaceAt<T>(list: Slot<T>, index: number, value: T): Slot<T> {
  const next = list.slice();
  next[index] = value;
  return next;
}

export function CaptureScreen() {
  const layout = useSticky(useBooth((s) => s.layout))!;
  const setStoreShots = useBooth((s) => s.setShots);
  const go = useBooth((s) => s.go);
  const cameraId = useBooth((s) => s.settings.cameraId);
  const soundOn = useBooth((s) => s.settings.sound);

  const total = layout.slots.length;

  // Kembali dari layar Hias ("Ubah foto") → langsung ke review dengan foto yang sudah ada.
  const [initial] = useState(() => {
    const existing = useBooth.getState().shots;
    return existing.length === total ? existing : null;
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);
  const shotsRef = useRef<Slot<HTMLCanvasElement>>(initial ?? Array(total).fill(null));

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(initial ? 'review' : 'idle');
  const [active, setActive] = useState<number | null>(null);
  const [prepMessage, setPrepMessage] = useState('');
  const [prepLeft, setPrepLeft] = useState(EVENT.prepareSeconds);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [thumbs, setThumbs] = useState<Slot<string>>(() => (initial ? initial.map(thumbnail) : Array(total).fill(null)));

  const busy = phase === 'prepare' || phase === 'countdown';
  const takenCount = thumbs.filter(Boolean).length;

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

  /** Satu jepretan: siap-siap → 3-2-1 → jepret. Return false kalau dibatalkan (layar ditinggal). */
  const shootOne = async (index: number, message: string): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;
    setActive(index);

    // Tahap 1: siap-siap
    setPrepMessage(message);
    setPrepLeft(EVENT.prepareSeconds);
    setPhase('prepare');
    for (let s = EVENT.prepareSeconds; s > 0; s--) {
      if (cancelled.current) return false;
      setPrepLeft(s);
      await wait(1000);
    }

    // Tahap 2: hitung mundur
    setPhase('countdown');
    for (let n = EVENT.countdownSeconds; n > 0; n--) {
      if (cancelled.current) return false;
      setCount(n);
      if (soundOn) playBeep(n === 1);
      await wait(1000);
    }
    if (cancelled.current) return false;

    setCount(null);
    if (soundOn) playShutter();
    setFlash((f) => f + 1);
    const shot = captureFrame(video, EVENT.mirror);
    shotsRef.current = replaceAt(shotsRef.current, index, shot);
    setThumbs((t) => replaceAt(t, index, thumbnail(shot)));
    await wait(700); // beri waktu flash & thumbnail muncul
    return !cancelled.current;
  };

  const runAll = async () => {
    if (busy || !ready) return;
    shotsRef.current = Array(total).fill(null);
    setThumbs(Array(total).fill(null));
    for (let i = 0; i < total; i++) {
      const message = i === 0 ? PREPARE_TEXT.first(EVENT.prepareSeconds) : PREPARE_TEXT.next(i + 1, total);
      if (!(await shootOne(i, message))) return;
    }
    setActive(null);
    setPhase('review');
  };

  const retake = async (index: number) => {
    if (busy || !ready) return;
    if (!(await shootOne(index, PREPARE_TEXT.retake(index + 1)))) return;
    setActive(null);
    setPhase('review');
  };

  const proceed = () => {
    const shots = shotsRef.current;
    if (shots.every(Boolean)) setStoreShots(shots as HTMLCanvasElement[]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => go('layout')} disabled={busy}>
          <Icon name="arrow-left" /> Ganti gaya
        </Button>
        <StepDots active={1} />
        <div className="w-28 text-right text-sm font-medium text-white/60">
          {takenCount}/{total} foto
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

          {/* Tahap 1: siap-siap */}
          <AnimatePresence>
            {phase === 'prepare' && (
              <motion.div
                key={`prep-${active}-${prepMessage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 grid place-items-center bg-black/45 p-6 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ scale: 0.85, y: 24 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="flex max-w-2xl flex-col items-center text-center"
                >
                  <PrepareRing seconds={EVENT.prepareSeconds} left={prepLeft} />
                  <p className="mt-6 font-display text-3xl font-semibold leading-tight text-white drop-shadow-lg sm:text-5xl">
                    {prepMessage}
                  </p>
                  <p className="mt-3 text-sm text-white/70 sm:text-base">Hitung mundur mulai sebentar lagi…</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tahap 2: hitung mundur */}
          <AnimatePresence>
            {phase === 'countdown' && count !== null && (
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
            <div className="absolute inset-0 grid place-items-center bg-ink-900/80 p-8 text-center">
              <div className="max-w-md">
                <Icon name="camera" className="mx-auto h-12 w-12 text-white/40" />
                <p className="mt-4 text-lg">{error}</p>
                <Button className="mt-6" variant="secondary" onClick={openCamera}>
                  <Icon name="refresh" /> Coba lagi
                </Button>
              </div>
            </div>
          )}

          {/* Pill jepretan ke-berapa */}
          {busy && active !== null && total > 1 && (
            <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-sm font-medium backdrop-blur">
              Foto {active + 1} dari {total}
            </div>
          )}

          {/* Tombol mulai */}
          {ready && phase === 'idle' && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pb-8 pt-24 text-center">
              <p className="text-white/85">
                {total > 1 ? `${total} foto · ` : ''}tiap foto: {EVENT.prepareSeconds} detik siap-siap, lalu hitung mundur{' '}
                {EVENT.countdownSeconds} detik
              </p>
              <Button size="xl" onClick={runAll}>
                <Icon name="camera" className="h-7 w-7" /> Jepret!
              </Button>
            </div>
          )}

          {/* Review */}
          {phase === 'review' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-8 pt-24 text-center"
            >
              <p className="text-lg font-medium text-white">
                Cek dulu fotonya. Kurang pas? Tekan <b>Retake</b> di foto itu.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="secondary" size="lg" onClick={runAll} disabled={!ready}>
                  <Icon name="refresh" /> Ulang semua
                </Button>
                <Button size="xl" onClick={proceed}>
                  Lanjut <Icon name="arrow-right" className="h-7 w-7" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Thumbnail per frame + Retake */}
      <div className="mx-auto mt-4 flex items-end justify-center gap-3">
        {thumbs.map((src, i) => {
          const isActive = busy && active === i;
          const reviewing = phase === 'review';
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div
                className={`relative overflow-hidden rounded-xl bg-white/5 ring-1 transition-all ${
                  reviewing ? 'h-24 w-32 sm:h-28 sm:w-40' : 'h-16 w-24 sm:h-20 sm:w-28'
                } ${isActive ? 'ring-2 ring-accent shadow-glow' : 'ring-white/10'}`}
              >
                <AnimatePresence mode="popLayout">
                  {src && (
                    <motion.img
                      key={src}
                      src={src}
                      alt={`Foto ${i + 1}`}
                      initial={{ scale: 1.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="h-full w-full object-cover"
                    />
                  )}
                </AnimatePresence>
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold">
                  {i + 1}
                </span>
                {isActive && <span className="absolute inset-0 animate-pulse bg-accent/15" />}
              </div>
              {reviewing && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => retake(i)}
                  disabled={!ready}
                  aria-label={`Retake foto ${i + 1}`}
                >
                  <Icon name="refresh" className="h-4 w-4" /> Retake
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cincin progres tahap siap-siap: penuh → kosong selama `seconds`, angka sisa detik di tengah. */
function PrepareRing({ seconds, left }: { seconds: number; left: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 sm:h-36 sm:w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: c }}
          transition={{ duration: seconds, ease: 'linear' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-4xl font-semibold text-amber-300 sm:text-5xl">{left}</span>
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

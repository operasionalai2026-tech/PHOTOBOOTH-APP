'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT, PREPARE_TEXT } from '@/config/event';
import { captureFrame, cameraErrorMessage, startCamera, stopCamera, type CameraError } from '@/lib/camera';
import { supportsGif } from '@/lib/gif';
import { playBeep, playShutter } from '@/lib/sound';
import { useSticky } from '@/lib/useSticky';
import { useBooth, type CaptureMode } from '@/lib/store';
import { StepDots } from './LayoutPicker';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * idle      → pilih mode Foto/GIF + tombol "Jepret!"
 * prepare   → tahap 1: "siap-siap" (EVENT.prepareSeconds)
 * countdown → tahap 2: hitung mundur 3-2-1 lalu jepret
 * burst     → mode GIF: jeda singkat antar jepretan beruntun (EVENT.gifIntervalMs), tamu ganti gaya
 * review    → semua foto terambil; Retake per foto atau Lanjut
 *
 * Mode Foto: siap-siap → 3-2-1 → jepret, diulang untuk tiap foto.
 * Mode GIF:  siap-siap → 3-2-1 → jepret, lalu jepret lagi tiap ±1,5 detik sampai semua jendela terisi.
 */
type Phase = 'idle' | 'prepare' | 'countdown' | 'burst' | 'review';

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
  const captureMode = useBooth((s) => s.captureMode);
  const setCaptureMode = useBooth((s) => s.setCaptureMode);

  const total = layout.slots.length;
  const canGif = supportsGif(layout);
  const gifMode = canGif && captureMode === 'gif';
  const slotAspect = layout.slots[0].w / layout.slots[0].h;

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
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(initial ? 'review' : 'idle');
  const [active, setActive] = useState<number | null>(null);
  const [prepMessage, setPrepMessage] = useState('');
  const [prepLeft, setPrepLeft] = useState(EVENT.prepareSeconds);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [thumbs, setThumbs] = useState<Slot<string>>(() => (initial ? initial.map(thumbnail) : Array(total).fill(null)));

  const busy = phase === 'prepare' || phase === 'countdown' || phase === 'burst';
  const takenCount = thumbs.filter(Boolean).length;

  const openCamera = useCallback(async () => {
    setError(null);
    setReady(false);
    stopCamera(streamRef.current);
    try {
      const video = videoRef.current!;
      streamRef.current = await startCamera(video, cameraId ?? undefined);
      if (video.videoWidth && video.videoHeight) setVideoAspect(video.videoWidth / video.videoHeight);
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

  /** Tahap siap-siap lalu hitung mundur 3-2-1. Return false kalau dibatalkan (layar ditinggal). */
  const getReady = async (index: number, message: string): Promise<boolean> => {
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
    return !cancelled.current;
  };

  /** Ambil gambar dari kamera untuk jendela ke-`index` (dengan flash & suara shutter). */
  const snap = (index: number): boolean => {
    const video = videoRef.current;
    if (!video || cancelled.current) return false;
    setCount(null);
    if (soundOn) playShutter();
    setFlash((f) => f + 1);
    const shot = captureFrame(video, EVENT.mirror);
    shotsRef.current = replaceAt(shotsRef.current, index, shot);
    setThumbs((t) => replaceAt(t, index, thumbnail(shot)));
    return true;
  };

  /** Satu jepretan lengkap: siap-siap → 3-2-1 → jepret. */
  const shootOne = async (index: number, message: string): Promise<boolean> => {
    if (!(await getReady(index, message)) || !snap(index)) return false;
    await wait(700); // beri waktu flash & thumbnail muncul
    return !cancelled.current;
  };

  /** Mode GIF: sekali siap-siap + 3-2-1, lalu jepret beruntun tiap EVENT.gifIntervalMs. */
  const shootBurst = async (): Promise<boolean> => {
    if (!(await getReady(0, PREPARE_TEXT.gif(total))) || !snap(0)) return false;
    for (let i = 1; i < total; i++) {
      setActive(i);
      setPhase('burst');
      await wait(EVENT.gifIntervalMs);
      if (!snap(i)) return false;
    }
    await wait(700);
    return !cancelled.current;
  };

  const runAll = async () => {
    if (busy || !ready) return;
    shotsRef.current = Array(total).fill(null);
    setThumbs(Array(total).fill(null));
    if (gifMode) {
      if (!(await shootBurst())) return;
    } else {
      for (let i = 0; i < total; i++) {
        const message = i === 0 ? PREPARE_TEXT.first(EVENT.prepareSeconds) : PREPARE_TEXT.next(i + 1, total);
        if (!(await shootOne(i, message))) return;
      }
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

      <div
        className="relative mx-auto mt-4 flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center"
        style={{ containerType: 'size' }}
      >
        {/* Kotak video mengikuti rasio kamera asli supaya panduan bingkai akurat */}
        <div
          className="relative overflow-hidden rounded-[2rem] bg-ink-800 ring-1 ring-white/10"
          style={{
            width: `min(100cqw, calc(100cqh * ${videoAspect}))`,
            height: `min(100cqh, calc(100cqw / ${videoAspect}))`,
            containerType: 'size',
          }}
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            style={{ transform: EVENT.mirror ? 'scaleX(-1)' : undefined }}
            playsInline
            muted
            autoPlay
          />

          {/* Panduan bingkai: area di luar kotak tidak masuk ke foto */}
          {ready && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-dashed border-white/70"
              style={{
                width: `min(100cqw, calc(100cqh * ${slotAspect}))`,
                height: `min(100cqh, calc(100cqw / ${slotAspect}))`,
                boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.4)',
              }}
            />
          )}

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

          {/* Mode GIF: jeda singkat antar jepretan beruntun */}
          <AnimatePresence>
            {phase === 'burst' && active !== null && (
              <motion.div
                key={`burst-${active}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0"
              >
                <motion.div
                  initial={{ scale: 0.7, y: -10 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 16 }}
                  className="absolute inset-x-0 top-6 flex flex-col items-center text-center"
                >
                  <span className="rounded-3xl bg-black/55 px-6 py-3 font-display text-4xl font-semibold text-amber-300 backdrop-blur sm:text-6xl">
                    {PREPARE_TEXT.burst}
                  </span>
                  <span className="mt-2 rounded-full bg-black/55 px-4 py-1 text-sm font-medium text-white backdrop-blur">
                    GIF · foto {active + 1} dari {total}
                  </span>
                </motion.div>
                <div className="absolute inset-x-10 bottom-8 h-2.5 overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: EVENT.gifIntervalMs / 1000, ease: 'linear' }}
                    className="h-full rounded-full bg-amber-300"
                  />
                </div>
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
          {(phase === 'prepare' || phase === 'countdown') && active !== null && total > 1 && (
            <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-sm font-medium backdrop-blur">
              {gifMode && phase !== 'prepare' ? 'GIF · ' : ''}Foto {active + 1} dari {total}
            </div>
          )}

          {/* Tombol mulai */}
          {ready && phase === 'idle' && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pb-8 pt-24 text-center">
              {canGif && <ModeSwitch value={captureMode} onChange={setCaptureMode} />}
              <p className="max-w-xl text-white/85">
                {gifMode ? (
                  <>
                    {total} foto beruntun tiap {(EVENT.gifIntervalMs / 1000).toLocaleString('id-ID')} detik, ganti gaya tiap
                    jepret! Hasilnya foto + GIF.
                  </>
                ) : (
                  <>
                    {total > 1 ? `${total} foto · ` : ''}tiap foto: {EVENT.prepareSeconds} detik siap-siap, lalu hitung mundur{' '}
                    {EVENT.countdownSeconds} detik
                  </>
                )}
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

/** Pilihan mode: Foto (jepret satu-satu) atau GIF (jepret beruntun). */
function ModeSwitch({ value, onChange }: { value: CaptureMode; onChange: (m: CaptureMode) => void }) {
  const options: { id: CaptureMode; label: string; icon: 'camera' | 'burst' }[] = [
    { id: 'photo', label: 'Foto', icon: 'camera' },
    { id: 'gif', label: 'GIF', icon: 'burst' },
  ];
  return (
    <div role="radiogroup" aria-label="Mode foto" className="flex rounded-2xl bg-black/55 p-1 ring-1 ring-white/15 backdrop-blur">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold transition ${
              on ? 'bg-white text-ink-900' : 'text-white/75 hover:text-white'
            }`}
          >
            <Icon name={o.icon} className="h-5 w-5" /> {o.label}
          </button>
        );
      })}
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

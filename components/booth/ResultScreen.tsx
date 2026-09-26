'use client';

import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { downloadUrl, EVENT, LIMITS } from '@/config/event';
import { getFilter } from '@/config/filters';
import { compressForUpload } from '@/lib/compress';
import { enqueue, patchMeta, processQueue, subscribe } from '@/lib/offlineQueue';
import { photoFileName } from '@/lib/saveDevice';
import { useBooth, type UploadStatus } from '@/lib/store';
import { isSupabaseConfigured, markPrinted } from '@/lib/supabase';
import { StepDots } from './LayoutPicker';
import { PrintArea, printImage } from './PrintArea';
import { SaveOptions, Spinner } from './SaveOptions';

export function ResultScreen() {
  const result = useBooth((s) => s.result)!;
  const layout = useBooth((s) => s.layout)!;
  const frameId = useBooth((s) => s.frameId);
  const filterId = useBooth((s) => s.filterId);
  const uploadStatus = useBooth((s) => s.uploadStatus);
  const uploadError = useBooth((s) => s.uploadError);
  const setUpload = useBooth((s) => s.setUpload);
  const autoDrive = useBooth((s) => s.settings.autoDrive);
  const reset = useBooth((s) => s.reset);

  const [qr, setQr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const started = useRef(false);

  const url = downloadUrl(result.id);

  // 1) Kompres → simpan di IndexedDB → upload di background.
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === 'uploaded' && e.id === result.id) setUpload('uploaded');
        if (e.type === 'failed' && e.id === result.id) {
          setUpload(e.kind === 'offline' ? 'offline' : e.kind === 'config' ? 'disabled' : 'error', e.message);
        }
      }),
    [result.id, setUpload],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const small = await compressForUpload(result.fullBlob);
        await enqueue(small, {
          id: result.id,
          layout: layout.id,
          frame: frameId,
          filter: getFilter(filterId).id,
          size_bytes: small.size,
        });
        if (!isSupabaseConfigured) return setUpload('disabled');
        // Offline: foto aman di IndexedDB, startAutoRetry() mengunggahnya saat online lagi.
        if (!navigator.onLine) return setUpload('offline');
        setUpload('uploading');
        await processQueue(true);
      } catch (e) {
        setUpload('error', e instanceof Error ? e.message : 'Gagal menyiapkan upload');
      }
    })();
  }, [result, layout.id, frameId, filterId, setUpload]);

  // 2) QR code ke halaman download.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#13111c', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  // 3) Kembali ke awal otomatis kalau didiamkan.
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!EVENT.idleResetMs) return;
    const bump = () => (lastActivity.current = Date.now());
    window.addEventListener('pointerdown', bump);
    const t = setInterval(() => {
      const left = EVENT.idleResetMs - (Date.now() - lastActivity.current);
      if (left <= 0) reset();
      setIdleLeft(left <= 15_000 ? Math.ceil(left / 1000) : null);
    }, 1000);
    return () => {
      window.removeEventListener('pointerdown', bump);
      clearInterval(t);
    };
  }, [reset]);

  const getBlob = useCallback(async () => result.fullBlob, [result]);

  const print = async () => {
    setPrinting(true);
    try {
      const sheetUrl = await printImage(result.fullUrl, layout);
      setPrintUrl(sheetUrl);
      // tunggu <img> print dimuat baru panggil print()
      await new Promise((r) => setTimeout(r, 250));
      window.print();
      // Tandai printed di dua tempat: metadata antrian (kalau belum terupload) dan RPC (kalau sudah).
      await patchMeta(result.id, { printed: true }).catch(() => false);
      void markPrinted(result.id).catch(() => undefined);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6">
      <header className="flex items-center justify-between">
        <div className="w-32" />
        <StepDots active={3} />
        <Button variant="secondary" onClick={reset}>
          Selesai <Icon name="check" />
        </Button>
      </header>

      <div className="mx-auto mt-4 grid min-h-0 w-full max-w-6xl flex-1 items-center gap-8 lg:grid-cols-[1fr_420px]">
        <motion.div
          initial={{ rotate: -3, y: 40, opacity: 0 }}
          animate={{ rotate: 0, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          className="flex min-h-0 items-center justify-center"
        >
          <img
            src={result.fullUrl}
            alt="Hasil foto"
            className="max-w-full rounded-lg object-contain shadow-2xl shadow-black/70"
            style={{ maxHeight: 'calc(100dvh - 150px)' }}
          />
        </motion.div>

        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-display text-4xl font-semibold">Keren banget! ✨</h2>
            <p className="mt-1 text-white/55">Simpan, cetak, atau scan QR untuk unduh di HP.</p>
          </div>

          {/* QR */}
          <div className="flex items-center gap-5 rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <div className="grid h-36 w-36 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white">
              {qr ? (
                <img src={qr} alt="QR code unduh foto" className="h-full w-full" />
              ) : (
                <Icon name={isSupabaseConfigured ? 'cloud' : 'cloud-off'} className="h-10 w-10 text-ink-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold">Scan untuk unduh</div>
              <p className="mt-1 text-sm text-white/55">
                {isSupabaseConfigured
                  ? `Foto tersedia ${LIMITS.retentionDays} hari. Bisa disimpan ke galeri atau Google Drive.`
                  : 'Mode lokal — QR aktif setelah Supabase diatur.'}
              </p>
              <UploadBadge status={uploadStatus} error={uploadError} />
            </div>
          </div>

          {/* Simpan */}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-white/50">Simpan ke</h3>
            <SaveOptions
              getBlob={getBlob}
              fileName={photoFileName(result.id, result.createdAt)}
              driveFolder={`Photobooth - ${EVENT.name}`}
              autoDrive={autoDrive}
            />
          </div>

          <Button size="lg" variant="secondary" onClick={print} disabled={printing}>
            {printing ? <Spinner className="h-5 w-5" /> : <Icon name="printer" />}
            Cetak foto
          </Button>

          <AnimatePresence>
            {idleLeft !== null && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-sm text-white/45"
              >
                Kembali ke awal dalam {idleLeft} detik — sentuh layar untuk tetap di sini
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <PrintArea src={printUrl} />
    </div>
  );
}

function UploadBadge({ status, error }: { status: UploadStatus; error: string | null }) {
  const map: Record<UploadStatus, { label: string; cls: string; icon?: 'cloud' | 'cloud-off' | 'check' }> = {
    idle: { label: 'Menyiapkan…', cls: 'text-white/50' },
    queued: { label: 'Menyiapkan…', cls: 'text-white/50' },
    uploading: { label: 'Mengunggah…', cls: 'text-sky-200' },
    uploaded: { label: 'Terunggah — QR siap dipakai', cls: 'text-emerald-300', icon: 'check' },
    offline: { label: 'Offline — tersimpan lokal, diunggah otomatis', cls: 'text-amber-200', icon: 'cloud-off' },
    error: { label: 'Tertunda — dicoba ulang otomatis', cls: 'text-amber-200', icon: 'cloud-off' },
    disabled: { label: 'Tersimpan lokal', cls: 'text-white/50', icon: 'cloud-off' },
  };
  const m = map[status];
  return (
    <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${m.cls}`} title={error ?? undefined}>
      {status === 'uploading' || status === 'queued' || status === 'idle' ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        m.icon && <Icon name={m.icon} className="h-4 w-4" />
      )}
      {m.label}
    </div>
  );
}

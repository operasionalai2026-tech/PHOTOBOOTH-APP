'use client';

// Halaman download tamu: /p?id=xxx (query param, bukan dynamic route — kompatibel static export).

import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { SaveOptions, Spinner } from '@/components/booth/SaveOptions';
import { Backdrop } from '@/components/ui/Backdrop';
import { Icon } from '@/components/ui/Icon';
import { EVENT, LIMITS } from '@/config/event';
import { photoFileName } from '@/lib/saveDevice';
import { fetchPhotoSession, isSupabaseConfigured, publicImageUrl, type PhotoSession } from '@/lib/supabase';

export default function DownloadPage() {
  return (
    <main className="relative min-h-[100dvh] px-4 py-8">
      <Backdrop />
      <Suspense fallback={<Center><Spinner className="h-8 w-8" /></Center>}>
        <DownloadView />
      </Suspense>
    </main>
  );
}

type State =
  | { kind: 'loading' }
  | { kind: 'pending'; tries: number }
  | { kind: 'ready'; row: PhotoSession; url: string }
  | { kind: 'error'; message: string };

const POLL_MS = 8000;
const MAX_TRIES = 30; // ± 4 menit menunggu booth yang sedang offline

function DownloadView() {
  const id = useSearchParams().get('id') || '';
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(
    async (tries = 0) => {
      if (!isSupabaseConfigured) return setState({ kind: 'error', message: 'Layanan belum dikonfigurasi.' });
      if (!/^[0-9a-f-]{36}$/i.test(id)) return setState({ kind: 'error', message: 'Link foto tidak valid.' });
      try {
        const row = await fetchPhotoSession(id);
        if (row) setState({ kind: 'ready', row, url: publicImageUrl(row.image_path) });
        else setState({ kind: 'pending', tries });
      } catch {
        setState({ kind: 'error', message: 'Tidak bisa memuat foto. Cek koneksi internet lalu coba lagi.' });
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Foto belum ada → mungkin booth masih mengunggah (offline). Cek ulang berkala.
  useEffect(() => {
    if (state.kind !== 'pending' || state.tries >= MAX_TRIES) return;
    const t = setTimeout(() => void load(state.tries + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [state, load]);

  if (state.kind === 'loading') {
    return (
      <Center>
        <Spinner className="h-8 w-8" />
      </Center>
    );
  }

  if (state.kind === 'error' || (state.kind === 'pending' && state.tries >= MAX_TRIES)) {
    return (
      <Center>
        <Icon name="cloud-off" className="mx-auto h-12 w-12 text-white/40" />
        <h1 className="mt-4 text-2xl font-semibold">Foto tidak ditemukan</h1>
        <p className="mt-2 text-white/60">
          {state.kind === 'error'
            ? state.message
            : `Foto mungkin sudah dihapus (disimpan maksimal ${LIMITS.retentionDays} hari) atau belum terunggah.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            void load();
          }}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-5 font-semibold ring-1 ring-white/15"
        >
          <Icon name="refresh" className="h-4 w-4" /> Coba lagi
        </button>
      </Center>
    );
  }

  if (state.kind === 'pending') {
    return (
      <Center>
        <Spinner className="mx-auto h-10 w-10 text-accent" />
        <h1 className="mt-5 text-2xl font-semibold">Foto sedang diproses…</h1>
        <p className="mt-2 text-white/60">
          Booth sedang mengunggah fotomu. Halaman ini akan muncul otomatis, jangan ditutup ya.
        </p>
      </Center>
    );
  }

  return <Ready row={state.row} url={state.url} />;
}

function Ready({ row, url }: { row: PhotoSession; url: string }) {
  const expires = new Date(new Date(row.created_at).getTime() + LIMITS.retentionDays * 86_400_000);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));

  const getBlob = useCallback(async () => {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Gagal mengambil foto');
    return res.blob();
  }, [url]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <p className="text-xs font-medium uppercase tracking-[0.35em] text-accent-soft">Photobooth</p>
      <h1 className="mt-2 text-center font-display text-4xl font-semibold">{EVENT.name}</h1>

      <motion.img
        initial={{ opacity: 0, y: 20, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        src={url}
        alt="Foto photobooth kamu"
        className="mt-6 w-full rounded-xl shadow-2xl shadow-black/70"
      />

      <div className="mt-6 w-full">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-white/50">Simpan ke</h2>
        <SaveOptions getBlob={getBlob} fileName={photoFileName(row.id, row.created_at)} driveFolder={`Photobooth - ${EVENT.name}`} />
      </div>

      <div className="mt-5 flex w-full items-start gap-3 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100 ring-1 ring-amber-300/25">
        <Icon name="cloud" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="font-semibold">Foto tersedia {LIMITS.retentionDays} hari</div>
          <div className="text-amber-100/70">
            Sisa {daysLeft} hari (sampai{' '}
            {expires.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}). Simpan sekarang
            supaya tidak hilang.
          </div>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center text-center">{children}</div>;
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  connectDrive,
  DriveError,
  isDriveConfigured,
  isDriveConnected,
  preloadDrive,
  uploadToDrive,
  type DriveFile,
} from '@/lib/googleDrive';
import { saveBlobToDevice } from '@/lib/saveDevice';

type State = { status: 'idle' | 'busy' | 'done' | 'error'; message?: string; link?: string };

type Props = {
  /** Ambil file yang akan disimpan (boleh async, mis. fetch dari Supabase). */
  getBlob: () => Promise<Blob>;
  fileName: string;
  /** Nama folder di Google Drive. */
  driveFolder: string;
  /** Upload ke Drive otomatis kalau sudah tersambung (mode operator booth). */
  autoDrive?: boolean;
  /** Tampilan lebih ringkas untuk kartu/galeri. */
  compact?: boolean;
  onDriveSaved?: (file: DriveFile) => void;
};

/**
 * Pilihan simpan: Perangkat / Google Drive.
 * Dipakai di layar hasil booth, halaman download tamu (/p), dan admin.
 */
export function SaveOptions({ getBlob, fileName, driveFolder, autoDrive, compact, onDriveSaved }: Props) {
  const [device, setDevice] = useState<State>({ status: 'idle' });
  const [drive, setDrive] = useState<State>({ status: 'idle' });
  const autoTried = useRef(false);

  useEffect(() => {
    if (isDriveConfigured) preloadDrive().catch(() => undefined);
  }, []);

  const saveDevice = useCallback(async () => {
    setDevice({ status: 'busy' });
    try {
      const mode = await saveBlobToDevice(await getBlob(), fileName);
      setDevice({ status: 'done', message: mode === 'shared' ? 'Dibagikan' : 'Tersimpan' });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return setDevice({ status: 'idle' });
      setDevice({ status: 'error', message: 'Gagal menyimpan' });
    }
  }, [getBlob, fileName]);

  const saveDrive = useCallback(async () => {
    setDrive({ status: 'busy', message: isDriveConnected() ? 'Mengunggah…' : 'Masuk Google…' });
    try {
      // Login dulu (popup harus dibuka langsung dari klik), baru ambil file.
      if (!isDriveConnected()) await connectDrive();
      setDrive({ status: 'busy', message: 'Mengunggah…' });
      const blob = await getBlob();
      const file = await uploadToDrive(blob, fileName, driveFolder);
      setDrive({ status: 'done', message: 'Tersimpan di Drive', link: file.webViewLink });
      onDriveSaved?.(file);
    } catch (e) {
      const err = e instanceof DriveError ? e : null;
      if (err?.kind === 'cancelled') return setDrive({ status: 'idle' });
      setDrive({ status: 'error', message: err?.message || 'Gagal menyimpan ke Drive' });
    }
  }, [getBlob, fileName, driveFolder, onDriveSaved]);

  useEffect(() => {
    if (autoDrive && !autoTried.current && isDriveConfigured && isDriveConnected()) {
      autoTried.current = true;
      void saveDrive();
    }
  }, [autoDrive, saveDrive]);

  return (
    <div className={compact ? 'flex gap-2' : 'grid grid-cols-2 gap-3'}>
      <SaveButton
        compact={compact}
        icon="phone"
        label="Perangkat"
        hint="Simpan ke galeri / folder unduhan"
        state={device}
        onClick={saveDevice}
      />
      <SaveButton
        compact={compact}
        icon="drive"
        label="Google Drive"
        hint={isDriveConfigured ? `Folder “${driveFolder}”` : 'Belum diatur admin'}
        state={drive}
        disabled={!isDriveConfigured}
        onClick={saveDrive}
      />
    </div>
  );
}

function SaveButton({
  icon,
  label,
  hint,
  state,
  onClick,
  disabled,
  compact,
}: {
  icon: 'phone' | 'drive';
  label: string;
  hint: string;
  state: State;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const busy = state.status === 'busy';
  const done = state.status === 'done';
  const error = state.status === 'error';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        title={`${label}${state.message ? ` — ${state.message}` : ''}`}
        className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition disabled:opacity-40 ${
          done
            ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
            : error
              ? 'bg-red-500/15 text-red-200 ring-red-400/30'
              : 'bg-white/5 text-white/85 ring-white/10 hover:bg-white/10'
        }`}
      >
        {busy ? <Spinner /> : <Icon name={done ? 'check' : icon} className="h-4 w-4" />}
        {label}
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={disabled || busy ? undefined : { scale: 0.97 }}
      onClick={done && state.link ? () => window.open(state.link, '_blank', 'noopener') : onClick}
      disabled={disabled || busy}
      className={`group relative flex min-h-[92px] flex-col items-start justify-between overflow-hidden rounded-2xl p-4 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        done
          ? 'bg-emerald-500/15 ring-emerald-400/40'
          : error
            ? 'bg-red-500/10 ring-red-400/40'
            : 'bg-white/[0.06] ring-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            done ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white'
          }`}
        >
          {busy ? <Spinner /> : <Icon name={done ? 'check' : icon} className="h-5 w-5" />}
        </span>
        {done && state.link && <Icon name="external" className="h-4 w-4 text-emerald-200/80" />}
      </div>
      <div className="mt-3">
        <div className="text-[15px] font-semibold leading-tight">{label}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.message || hint}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mt-0.5 line-clamp-2 text-xs ${
              done ? 'text-emerald-200' : error ? 'text-red-200' : 'text-white/55'
            }`}
          >
            {done && state.link ? `${state.message} · Buka` : state.message || hint}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT } from '@/config/event';
import { listCameras } from '@/lib/camera';
import { connectDrive, disconnectDrive, isDriveConfigured, isDriveConnected, preloadDrive } from '@/lib/googleDrive';
import { processQueue } from '@/lib/offlineQueue';
import { useBooth } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Spinner } from './SaveOptions';

/** Panel operator: kamera, suara, Google Drive, antrian upload. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useBooth((s) => s.settings);
  const update = useBooth((s) => s.updateSettings);
  const queueCount = useBooth((s) => s.queueCount);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [driveOn, setDriveOn] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    listCameras().then(setCameras).catch(() => undefined);
    setDriveOn(isDriveConnected());
    if (isDriveConfigured) preloadDrive().catch(() => undefined);
  }, []);

  const toggleDrive = async () => {
    setDriveBusy(true);
    setDriveMsg(null);
    try {
      if (driveOn) {
        await disconnectDrive();
        setDriveOn(false);
        update({ autoDrive: false });
      } else {
        await connectDrive();
        setDriveOn(true);
      }
    } catch (e) {
      setDriveMsg(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setDriveBusy(false);
    }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto bg-ink-900/95 p-6 text-left ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Pengaturan operator</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>

        <Row label="Kamera">
          <select
            value={settings.cameraId ?? ''}
            onChange={(e) => update({ cameraId: e.target.value || null })}
            className="h-11 w-full rounded-xl bg-white/10 px-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-accent"
          >
            <option value="">Otomatis (kamera depan)</option>
            {cameras.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {c.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        </Row>

        <Toggle label="Suara countdown & shutter" checked={settings.sound} onChange={(v) => update({ sound: v })} />

        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <Icon name="drive" />
            </span>
            <div className="flex-1">
              <div className="font-semibold">Google Drive operator</div>
              <div className="text-xs text-white/55">
                {!isDriveConfigured
                  ? 'Isi NEXT_PUBLIC_GOOGLE_CLIENT_ID untuk mengaktifkan'
                  : driveOn
                    ? `Tersambung · folder “Photobooth - ${EVENT.name}”`
                    : 'Belum tersambung'}
              </div>
            </div>
            <Button size="sm" variant={driveOn ? 'danger' : 'secondary'} onClick={toggleDrive} disabled={!isDriveConfigured || driveBusy}>
              {driveBusy ? <Spinner /> : driveOn ? 'Putuskan' : 'Sambungkan'}
            </Button>
          </div>
          {driveMsg && <p className="mt-2 text-xs text-red-300">{driveMsg}</p>}
          <div className="mt-4">
            <Toggle
              label="Auto-simpan setiap foto ke Drive"
              hint="Berlaku selama sesi login Google aktif (±1 jam), sambungkan ulang bila habis."
              checked={settings.autoDrive}
              disabled={!driveOn}
              onChange={(v) => update({ autoDrive: v })}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Antrian upload</div>
              <div className="text-xs text-white/55">
                {!isSupabaseConfigured
                  ? 'Supabase belum diatur — foto disimpan lokal saja'
                  : queueCount
                    ? `${queueCount} foto tersimpan lokal, diunggah otomatis saat online`
                    : 'Semua foto sudah terunggah'}
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!queueCount || retrying || !isSupabaseConfigured}
              onClick={async () => {
                setRetrying(true);
                await processQueue(true);
                setRetrying(false);
              }}
            >
              {retrying ? <Spinner /> : <Icon name="refresh" className="h-4 w-4" />} Coba
            </Button>
          </div>
        </div>

        <div className="mt-auto flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={fullscreen}>
            <Icon name="expand" /> Layar penuh
          </Button>
          <a
            href="/admin"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 font-semibold ring-1 ring-white/15 hover:bg-white/15"
          >
            Admin <Icon name="external" className="h-4 w-4" />
          </a>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-40"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-white/50">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-white/15'}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  );
}

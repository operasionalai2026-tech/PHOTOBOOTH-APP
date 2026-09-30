// State alur booth (zustand).

import { create } from 'zustand';
import type { Layout } from '@/config/layouts';

export type Step = 'start' | 'layout' | 'capture' | 'edit' | 'result';

/** photo = jepret satu-satu (siap-siap + 3-2-1 per foto); gif = jepret beruntun → foto + GIF. */
export type CaptureMode = 'photo' | 'gif';

export type UploadStatus = 'idle' | 'queued' | 'uploading' | 'uploaded' | 'offline' | 'error' | 'disabled';

export type BoothResult = {
  id: string;
  fullBlob: Blob;
  fullUrl: string;
  /** GIF kolase berputar (mode GIF). */
  gifBlob?: Blob;
  gifUrl?: string;
  createdAt: string;
};

type Settings = {
  cameraId: string | null;
  autoDrive: boolean;
  sound: boolean;
};

type BoothState = {
  step: Step;
  layout: Layout | null;
  captureMode: CaptureMode;
  shots: HTMLCanvasElement[];
  filterId: string;
  result: BoothResult | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  queueCount: number;
  settings: Settings;

  go: (step: Step) => void;
  chooseLayout: (layout: Layout) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setShots: (shots: HTMLCanvasElement[]) => void;
  setFilter: (id: string) => void;
  setResult: (r: BoothResult) => void;
  setUpload: (status: UploadStatus, error?: string | null) => void;
  setQueueCount: (n: number) => void;
  updateSettings: (s: Partial<Settings>) => void;
  /** Kembali ke layar awal (tamu berikutnya). */
  reset: () => void;
  /** "Foto Ulang": tamu yang sama foto lagi, mulai dari pilih gaya. */
  restart: () => void;
};

const SETTINGS_KEY = 'pb.settings';

/** Bebaskan object URL setelah animasi keluar selesai (gambar masih tampil selama transisi). */
function revokeLater(result: BoothResult | null) {
  if (!result) return;
  setTimeout(() => {
    URL.revokeObjectURL(result.fullUrl);
    if (result.gifUrl) URL.revokeObjectURL(result.gifUrl);
  }, 3000);
}

const DEFAULT_SETTINGS: Settings = { cameraId: null, autoDrive: false, sound: true };

/** Dibaca setelah mount (bukan saat modul dimuat) supaya tidak bentrok dengan HTML statis. */
export function loadSettings(): Settings {
  const fallback = DEFAULT_SETTINGS;
  if (typeof window === 'undefined') return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return fallback;
  }
}

export const useBooth = create<BoothState>((set, get) => ({
  step: 'start',
  layout: null,
  captureMode: 'photo',
  shots: [],
  filterId: 'none',
  result: null,
  uploadStatus: 'idle',
  uploadError: null,
  queueCount: 0,
  settings: DEFAULT_SETTINGS,

  go: (step) => set({ step }),
  chooseLayout: (layout) => set({ layout, shots: [], step: 'capture' }),
  setCaptureMode: (captureMode) => set({ captureMode }),
  setShots: (shots) => set({ shots, step: 'edit' }),
  setFilter: (filterId) => set({ filterId }),
  setResult: (result) => {
    const prev = get().result;
    if (prev && prev.fullUrl !== result.fullUrl) revokeLater(prev);
    set({ result, step: 'result', uploadStatus: 'queued', uploadError: null });
  },
  setUpload: (uploadStatus, uploadError = null) => set({ uploadStatus, uploadError }),
  setQueueCount: (queueCount) => set({ queueCount }),
  updateSettings: (s) => {
    const settings = { ...get().settings, ...s };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* abaikan */
    }
    set({ settings });
  },
  reset: () => {
    revokeLater(get().result);
    set({
      step: 'start',
      layout: null,
      captureMode: 'photo',
      shots: [],
      result: null,
      uploadStatus: 'idle',
      uploadError: null,
      filterId: 'none',
    });
  },
  // Mode Foto/GIF tetap seperti pilihan tamu sebelumnya.
  restart: () => {
    revokeLater(get().result);
    set({ step: 'layout', layout: null, shots: [], result: null, uploadStatus: 'idle', uploadError: null, filterId: 'none' });
  },
}));

// State alur booth (zustand).

import { create } from 'zustand';
import type { Layout } from '@/config/layouts';

export type Step = 'start' | 'layout' | 'capture' | 'edit' | 'result';

export type UploadStatus = 'idle' | 'queued' | 'uploading' | 'uploaded' | 'offline' | 'error' | 'disabled';

export type BoothResult = {
  id: string;
  fullBlob: Blob;
  fullUrl: string;
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
  shots: HTMLCanvasElement[];
  frameId: string;
  filterId: string;
  result: BoothResult | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  queueCount: number;
  settings: Settings;

  go: (step: Step) => void;
  chooseLayout: (layout: Layout) => void;
  setShots: (shots: HTMLCanvasElement[]) => void;
  setFrame: (id: string) => void;
  setFilter: (id: string) => void;
  setResult: (r: BoothResult) => void;
  setUpload: (status: UploadStatus, error?: string | null) => void;
  setQueueCount: (n: number) => void;
  updateSettings: (s: Partial<Settings>) => void;
  reset: () => void;
};

const SETTINGS_KEY = 'pb.settings';

/** Bebaskan object URL setelah animasi keluar selesai (gambar masih tampil selama transisi). */
function revokeLater(url: string) {
  setTimeout(() => URL.revokeObjectURL(url), 3000);
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
  shots: [],
  frameId: 'classic',
  filterId: 'none',
  result: null,
  uploadStatus: 'idle',
  uploadError: null,
  queueCount: 0,
  settings: DEFAULT_SETTINGS,

  go: (step) => set({ step }),
  chooseLayout: (layout) => set({ layout, shots: [], step: 'capture' }),
  setShots: (shots) => set({ shots, step: 'edit' }),
  setFrame: (frameId) => set({ frameId }),
  setFilter: (filterId) => set({ filterId }),
  setResult: (result) => {
    const prev = get().result;
    if (prev && prev.fullUrl !== result.fullUrl) revokeLater(prev.fullUrl);
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
    const prev = get().result;
    if (prev) revokeLater(prev.fullUrl);
    set({ step: 'start', layout: null, shots: [], result: null, uploadStatus: 'idle', uploadError: null, filterId: 'none' });
  },
}));

// Antrian upload offline-first di IndexedDB.
// Foto selalu masuk antrian dulu → diupload di background → dihapus dari antrian saat sukses.
// Kalau offline / kuota penuh / error, foto tetap aman di IndexedDB dan dicoba lagi otomatis.

import { uploadPhoto, UploadError, type NewPhotoSession } from './supabase';

export type QueueItem = {
  id: string;
  blob: Blob;
  meta: NewPhotoSession;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  lastErrorKind?: UploadError['kind'];
};

const DB_NAME = 'photobooth';
const STORE = 'upload-queue';
const RETRY_INTERVAL_MS = 20_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function enqueue(blob: Blob, meta: NewPhotoSession): Promise<void> {
  const item: QueueItem = { id: meta.id, blob, meta, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 };
  await tx('readwrite', (s) => s.put(item));
  emit();
}

export function getAll(): Promise<QueueItem[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<QueueItem[]>);
}

export function getItem(id: string): Promise<QueueItem | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<QueueItem | undefined>);
}

export async function remove(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  emit();
}

/** Ubah metadata item yang masih antre (mis. printed = true sebelum sempat terupload). */
export async function patchMeta(id: string, patch: Partial<NewPhotoSession>): Promise<boolean> {
  const item = await getItem(id);
  if (!item) return false;
  item.meta = { ...item.meta, ...patch };
  await tx('readwrite', (s) => s.put(item));
  return true;
}

// ---------- event status antrian ----------

export type QueueEvent =
  | { type: 'changed' }
  | { type: 'uploaded'; id: string }
  | { type: 'failed'; id: string; kind: UploadError['kind']; message: string };

const listeners = new Set<(e: QueueEvent) => void>();

export function subscribe(fn: (e: QueueEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(e: QueueEvent = { type: 'changed' }) {
  listeners.forEach((fn) => fn(e));
}

// ---------- prosesor ----------

let running = false;

/** Upload semua item yang sudah waktunya. Aman dipanggil berkali-kali. */
export async function processQueue(force = false): Promise<void> {
  if (running) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  running = true;
  try {
    const items = (await getAll()).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      if (!force && item.nextAttemptAt > Date.now()) continue;
      try {
        await uploadPhoto(item.blob, { ...item.meta, size_bytes: item.blob.size });
        await remove(item.id);
        emit({ type: 'uploaded', id: item.id });
      } catch (err) {
        const kind = err instanceof UploadError ? err.kind : 'other';
        const message = err instanceof Error ? err.message : String(err);
        item.attempts += 1;
        item.lastError = message;
        item.lastErrorKind = kind;
        item.nextAttemptAt = Date.now() + backoff(item.attempts, kind);
        await tx('readwrite', (s) => s.put(item));
        emit({ type: 'failed', id: item.id, kind, message });
        if (kind === 'config') break; // tidak ada gunanya lanjut
        if (kind === 'offline' || kind === 'quota') break; // item lain pasti gagal juga
      }
    }
  } finally {
    running = false;
    emit();
  }
}

function backoff(attempts: number, kind: UploadError['kind']) {
  if (kind === 'quota') return 15 * 60_000;
  if (kind === 'config') return 60 * 60_000;
  return Math.min(5 * 60_000, 10_000 * 2 ** Math.min(attempts - 1, 5));
}

let started = false;

/** Jalankan retry otomatis: tiap 20 detik, saat online kembali, dan saat tab aktif lagi. */
export function startAutoRetry(): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  const tick = () => void processQueue();
  const onOnline = () => void processQueue(true);
  const onVisible = () => document.visibilityState === 'visible' && tick();
  const timer = window.setInterval(tick, RETRY_INTERVAL_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  tick();
  return () => {
    started = false;
    window.clearInterval(timer);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

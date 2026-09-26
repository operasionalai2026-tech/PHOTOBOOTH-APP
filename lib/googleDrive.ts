// Simpan foto ke Google Drive langsung dari browser (tanpa server).
// Memakai Google Identity Services (token client) + Drive API v3, scope `drive.file`:
// aplikasi hanya bisa melihat/mengubah file yang dibuatnya sendiri, bukan seluruh Drive.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'pb.drive.token';

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export const isDriveConfigured = Boolean(GOOGLE_CLIENT_ID);

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type GoogleOAuth2 = {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export type DriveFile = { id: string; name: string; webViewLink?: string };

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly kind: 'config' | 'cancelled' | 'auth' | 'quota' | 'network' | 'other',
  ) {
    super(message);
  }
}

// ---------- load script GIS ----------

let gisPromise: Promise<GoogleOAuth2> | null = null;

/** Muat script Google lebih awal (panggil saat komponen mount) supaya popup login tidak diblokir. */
export function preloadDrive(): Promise<GoogleOAuth2> {
  if (!isDriveConfigured) return Promise.reject(new DriveError('Google Drive belum dikonfigurasi', 'config'));
  if (typeof window === 'undefined') return Promise.reject(new DriveError('SSR', 'other'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () =>
        window.google?.accounts?.oauth2
          ? resolve(window.google.accounts.oauth2)
          : reject(new DriveError('Google Identity tidak tersedia', 'network'));
      s.onerror = () => {
        gisPromise = null;
        reject(new DriveError('Gagal memuat Google. Cek koneksi internet.', 'network'));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// ---------- token ----------

type StoredToken = { token: string; expiresAt: number };
let memToken: StoredToken | null = null;

function readToken(): StoredToken | null {
  if (memToken && memToken.expiresAt > Date.now() + 60_000) return memToken;
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (raw) {
      const t = JSON.parse(raw) as StoredToken;
      if (t.expiresAt > Date.now() + 60_000) return (memToken = t);
    }
  } catch {
    /* sessionStorage bisa diblokir — cukup pakai memori */
  }
  return null;
}

function writeToken(t: StoredToken | null) {
  memToken = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* abaikan */
  }
}

export function isDriveConnected(): boolean {
  return readToken() !== null;
}

/** Minta token. Harus dipanggil dari aksi klik pengguna (membuka popup Google). */
export async function connectDrive(forceConsent = false): Promise<string> {
  const oauth2 = await preloadDrive();
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new DriveError(r.error_description || r.error || 'Login Google gagal', 'auth'));
          return;
        }
        writeToken({ token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 });
        resolve(r.access_token);
      },
      error_callback: (e) => {
        const cancelled = e.type === 'popup_closed' || e.type === 'popup_failed_to_open';
        reject(
          new DriveError(
            e.type === 'popup_failed_to_open'
              ? 'Popup Google diblokir browser. Izinkan popup lalu coba lagi.'
              : cancelled
                ? 'Login Google dibatalkan'
                : e.message || 'Login Google gagal',
            cancelled ? 'cancelled' : 'auth',
          ),
        );
      },
    });
    client.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
  });
}

export async function disconnectDrive(): Promise<void> {
  const t = readToken();
  writeToken(null);
  folderCache.clear();
  if (t && window.google?.accounts?.oauth2) {
    await new Promise<void>((r) => window.google!.accounts!.oauth2!.revoke(t.token, () => r()));
  }
}

async function getToken(): Promise<string> {
  return readToken()?.token ?? connectDrive();
}

// ---------- Drive API ----------

const folderCache = new Map<string, string>();

async function driveFetch(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError('Tidak ada koneksi internet', 'network');
  }
  if (res.status === 401 && !retried) {
    writeToken(null);
    return driveFetch(url, init, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason: string = body?.error?.errors?.[0]?.reason || '';
    const msg: string = body?.error?.message || `Drive error ${res.status}`;
    if (reason === 'storageQuotaExceeded') throw new DriveError('Penyimpanan Google Drive penuh', 'quota');
    if (res.status === 401 || res.status === 403) throw new DriveError(msg, 'auth');
    throw new DriveError(msg, 'other');
  }
  return res;
}

/** Cari (atau buat) folder milik aplikasi di root Drive. */
export async function ensureFolder(name: string): Promise<string> {
  const cached = folderCache.get(name);
  if (cached) return cached;
  const q = [
    `name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ].join(' and ');
  const list = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&spaces=drive`,
  ).then((r) => r.json() as Promise<{ files: { id: string }[] }>);
  let id = list.files?.[0]?.id;
  if (!id) {
    const created = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
    }).then((r) => r.json() as Promise<{ id: string }>);
    id = created.id;
  }
  folderCache.set(name, id);
  return id;
}

/** Upload satu file ke Drive (multipart). */
export async function uploadToDrive(blob: Blob, fileName: string, folderName?: string): Promise<DriveFile> {
  const parents = folderName ? [await ensureFolder(folderName)] : undefined;
  const boundary = `pb${Math.random().toString(36).slice(2)}`;
  const metadata = { name: fileName, mimeType: blob.type || 'image/jpeg', ...(parents ? { parents } : {}) };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  const res = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
  );
  return (await res.json()) as DriveFile;
}

export function driveFolderLink(): string {
  return 'https://drive.google.com/drive/my-drive';
}

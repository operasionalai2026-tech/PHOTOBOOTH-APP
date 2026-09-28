// Muat ulang halaman otomatis setelah error, dengan pengaman supaya tidak reload terus-menerus.

const KEY = 'pb.errorReloads';
const DELAY_S = 4;
const MAX_RELOADS = 3; // dalam 2 menit
const WINDOW_MS = 120_000;

export function autoRecover(onTick: (secondsLeft: number | null) => void): () => void {
  let recent: number[] = [];
  try {
    recent = (JSON.parse(sessionStorage.getItem(KEY) || '[]') as number[]).filter((t) => Date.now() - t < WINDOW_MS);
  } catch {
    /* abaikan */
  }
  if (recent.length >= MAX_RELOADS) {
    onTick(null); // terlalu sering error → berhenti auto-reload, tampilkan tombol saja
    return () => undefined;
  }

  let left = DELAY_S;
  onTick(left);
  const timer = window.setInterval(() => {
    left -= 1;
    onTick(Math.max(left, 0));
    if (left <= 0) {
      window.clearInterval(timer);
      try {
        sessionStorage.setItem(KEY, JSON.stringify([...recent, Date.now()]));
      } catch {
        /* abaikan */
      }
      window.location.reload();
    }
  }, 1000);
  return () => window.clearInterval(timer);
}

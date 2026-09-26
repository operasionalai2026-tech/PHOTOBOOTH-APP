'use client';

import type { Session } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SaveOptions, Spinner } from '@/components/booth/SaveOptions';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT, LIMITS, STORAGE_BUCKET } from '@/config/event';
import { connectDrive, isDriveConfigured, isDriveConnected, uploadToDrive } from '@/lib/googleDrive';
import { downloadBlob, photoFileName } from '@/lib/saveDevice';
import { getSupabase, publicImageUrl, type PhotoSession } from '@/lib/supabase';

type StatRow = Pick<PhotoSession, 'id' | 'event_slug' | 'size_bytes' | 'created_at' | 'printed'>;

const PAGE_SIZE = 48;

export function AdminDashboard({ session }: { session: Session }) {
  const sb = getSupabase()!;
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [eventSlug, setEventSlug] = useState<string>(EVENT.slug);
  const [page, setPage] = useState(0);
  const [photos, setPhotos] = useState<PhotoSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ label: string; done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Statistik: ambil kolom ringan untuk semua foto (cukup murah untuk ribuan baris).
  const loadStats = useCallback(async () => {
    const all: StatRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('photo_sessions')
        .select('id,event_slug,size_bytes,created_at,printed')
        .range(from, from + 999);
      if (error) break;
      all.push(...(data as StatRow[]));
      if (!data || data.length < 1000) break;
    }
    setStats(all);
  }, [sb]);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const q = sb
      .from('photo_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, count } = await (eventSlug ? q.eq('event_slug', eventSlug) : q);
    setPhotos((data as PhotoSession[]) ?? []);
    setTotal(count ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [sb, page, eventSlug]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);
  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const events = useMemo(() => {
    const map = new Map<string, number>();
    stats?.forEach((r) => map.set(r.event_slug, (map.get(r.event_slug) ?? 0) + 1));
    if (!map.has(EVENT.slug)) map.set(EVENT.slug, 0);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const chosen = photos.filter((p) => selected.has(p.id));
  const targets = chosen.length ? chosen : photos;

  const fetchBlob = async (p: PhotoSession) => {
    const res = await fetch(publicImageUrl(p.image_path));
    if (!res.ok) throw new Error(`Gagal mengambil ${p.id}`);
    return res.blob();
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    setBulk({ label: 'Menyiapkan ZIP', done: 0, total: targets.length });
    try {
      for (const [i, p] of targets.entries()) {
        zip.file(photoFileName(p.id, p.created_at), await fetchBlob(p));
        setBulk({ label: 'Menyiapkan ZIP', done: i + 1, total: targets.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${eventSlug || 'photobooth'}-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal membuat ZIP');
    } finally {
      setBulk(null);
    }
  };

  const saveAllToDrive = async () => {
    try {
      if (!isDriveConnected()) await connectDrive(); // popup login harus langsung dari klik
      setBulk({ label: 'Menyimpan ke Drive', done: 0, total: targets.length });
      for (const [i, p] of targets.entries()) {
        await uploadToDrive(await fetchBlob(p), photoFileName(p.id, p.created_at), `Photobooth - ${p.event_slug}`);
        setBulk({ label: 'Menyimpan ke Drive', done: i + 1, total: targets.length });
      }
      setMessage(`${targets.length} foto tersimpan di Google Drive.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal menyimpan ke Drive');
    } finally {
      setBulk(null);
    }
  };

  const deleteSelected = async () => {
    if (!chosen.length) return;
    if (!confirm(`Hapus ${chosen.length} foto secara permanen? Link QR-nya akan mati.`)) return;
    setBulk({ label: 'Menghapus', done: 0, total: chosen.length });
    const { error: stErr } = await sb.storage.from(STORAGE_BUCKET).remove(chosen.map((p) => p.image_path));
    const { error: dbErr } = await sb.from('photo_sessions').delete().in('id', chosen.map((p) => p.id));
    setBulk(null);
    setMessage(stErr || dbErr ? `Gagal menghapus: ${(stErr || dbErr)!.message}` : `${chosen.length} foto dihapus.`);
    void loadPhotos();
    void loadStats();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent-soft">Admin</p>
          <h1 className="font-display text-3xl font-semibold">{EVENT.name}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span className="hidden sm:inline">{session.user.email}</span>
          <a href="/" className="rounded-xl px-3 py-2 hover:bg-white/10">
            Booth
          </a>
          <Button size="sm" variant="secondary" onClick={() => sb.auth.signOut()}>
            Keluar
          </Button>
        </div>
      </header>

      <QuotaStats stats={stats} />

      {/* Toolbar galeri */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-xl font-semibold">Galeri</h2>
        <select
          value={eventSlug}
          onChange={(e) => {
            setEventSlug(e.target.value);
            setPage(0);
          }}
          className="h-10 rounded-xl bg-white/10 px-3 text-sm ring-1 ring-white/10 focus:outline-none"
        >
          <option value="">Semua event</option>
          {events.map(([slug, n]) => (
            <option key={slug} value={slug}>
              {slug} ({n})
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={downloadZip} disabled={!photos.length || !!bulk}>
          <Icon name="zip" className="h-4 w-4" /> ZIP {chosen.length ? `(${chosen.length})` : 'halaman ini'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={saveAllToDrive}
          disabled={!photos.length || !!bulk || !isDriveConfigured}
          title={isDriveConfigured ? undefined : 'Isi NEXT_PUBLIC_GOOGLE_CLIENT_ID'}
        >
          <Icon name="drive" className="h-4 w-4" /> Drive {chosen.length ? `(${chosen.length})` : 'halaman ini'}
        </Button>
        <Button size="sm" variant="danger" onClick={deleteSelected} disabled={!chosen.length || !!bulk}>
          <Icon name="trash" className="h-4 w-4" /> Hapus
        </Button>
      </div>

      {bulk && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
          <Spinner />
          {bulk.label} {bulk.done}/{bulk.total}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${(bulk.done / Math.max(1, bulk.total)) * 100}%` }} />
          </div>
        </div>
      )}
      {message && (
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="mt-4 w-full rounded-2xl bg-white/5 p-3 text-left text-sm text-white/80 ring-1 ring-white/10"
        >
          {message}
        </button>
      )}

      {loading ? (
        <div className="grid h-60 place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : photos.length === 0 ? (
        <p className="mt-10 text-center text-white/50">Belum ada foto untuk event ini.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              selected={selected.has(p.id)}
              onToggle={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(p.id)) n.delete(p.id);
                  else n.add(p.id);
                  return n;
                })
              }
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <Icon name="arrow-left" className="h-4 w-4" />
          </Button>
          <span className="text-sm text-white/60">
            {page + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            <Icon name="arrow-right" className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ photo, selected, onToggle }: { photo: PhotoSession; selected: boolean; onToggle: () => void }) {
  const url = publicImageUrl(photo.image_path);
  const getBlob = useCallback(async () => (await fetch(url)).blob(), [url]);
  return (
    <div className={`overflow-hidden rounded-2xl bg-white/5 ring-1 transition ${selected ? 'ring-2 ring-accent' : 'ring-white/10'}`}>
      <button type="button" onClick={onToggle} className="relative block w-full">
        <img src={url} alt="" loading="lazy" className="aspect-[2/3] w-full bg-ink-800 object-cover" />
        <span
          className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full ring-2 ${
            selected ? 'bg-accent ring-accent' : 'bg-black/40 ring-white/60'
          }`}
        >
          {selected && <Icon name="check" className="h-4 w-4" />}
        </span>
        {photo.printed && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">
            Dicetak
          </span>
        )}
      </button>
      <div className="p-2">
        <div className="mb-2 flex items-center justify-between text-[11px] text-white/50">
          <span>{new Date(photo.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span>{formatBytes(photo.size_bytes ?? 0)}</span>
        </div>
        <SaveOptions
          compact
          getBlob={getBlob}
          fileName={photoFileName(photo.id, photo.created_at)}
          driveFolder={`Photobooth - ${photo.event_slug}`}
        />
      </div>
    </div>
  );
}

function QuotaStats({ stats }: { stats: StatRow[] | null }) {
  if (!stats) {
    return (
      <div className="mt-8 grid h-32 place-items-center rounded-3xl bg-white/5 ring-1 ring-white/10">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const count = stats.length;
  const sized = stats.filter((r) => r.size_bytes);
  const actual = sized.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  const avg = sized.length ? actual / sized.length : LIMITS.uploadMaxBytes * 0.7;
  const estimate = count * avg; // estimasi = jumlah foto × rata-rata ukuran
  const ratio = estimate / LIMITS.storageQuotaBytes;
  const warn = ratio >= LIMITS.storageWarnRatio;
  const printed = stats.filter((r) => r.printed).length;
  const today = stats.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length;
  const expiringSoon = stats.filter(
    (r) => Date.now() - new Date(r.created_at).getTime() > (LIMITS.retentionDays - 3) * 86_400_000,
  ).length;
  const remainingPhotos = Math.max(0, Math.floor((LIMITS.storageQuotaBytes - estimate) / avg));

  return (
    <section className="mt-8">
      {warn && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-500/15 p-4 text-sm text-red-100 ring-1 ring-red-400/40">
          <Icon name="cloud-off" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b>Storage hampir penuh ({Math.round(ratio * 100)}%).</b> Unduh ZIP / simpan ke Drive lalu hapus foto lama, atau
            tunggu cleanup otomatis ({LIMITS.retentionDays} hari). Saat penuh, booth tetap jalan & foto disimpan lokal.
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/60">Estimasi storage terpakai</span>
            <span className="text-xs text-white/40">Supabase free: {formatBytes(LIMITS.storageQuotaBytes)}</span>
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {formatBytes(estimate)} <span className="text-base font-normal text-white/50">({(ratio * 100).toFixed(1)}%)</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${warn ? 'bg-red-400' : ratio > 0.5 ? 'bg-amber-300' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-white/45">
            {count} foto × rata-rata {formatBytes(avg)} · muat ±{remainingPhotos.toLocaleString('id-ID')} foto lagi
          </div>
        </div>
        <Stat label="Total foto" value={count.toLocaleString('id-ID')} sub={`${today} hari ini`} />
        <Stat label="Dicetak" value={printed.toLocaleString('id-ID')} sub={count ? `${Math.round((printed / count) * 100)}% dari total` : '—'} />
        <Stat
          label="Segera terhapus"
          value={expiringSoon.toLocaleString('id-ID')}
          sub={`umur > ${LIMITS.retentionDays - 3} hari`}
        />
      </div>
      <p className="mt-3 text-xs text-white/40">
        Bandwidth free {formatBytes(LIMITS.bandwidthQuotaBytes)}/bulan ≈ {Math.floor(LIMITS.bandwidthQuotaBytes / avg).toLocaleString('id-ID')} kali
        unduh foto. Galeri admin juga memakai bandwidth.
      </p>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/45">{sub}</div>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

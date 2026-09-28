'use client';

// Jaring pengaman: kalau ada error tak terduga, jangan biarkan kiosk tertahan di layar error.
// Halaman dimuat ulang otomatis (foto yang belum terunggah aman di IndexedDB).

import { useEffect, useState } from 'react';
import { autoRecover } from '@/lib/recover';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    console.error(error);
    return autoRecover(setLeft);
  }, [error]);

  return (
    <main
      translate="no"
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0b0a10', color: '#f5f3fa', padding: 24 }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420, fontFamily: 'Poppins, system-ui, sans-serif' }}>
        <p style={{ fontSize: 22, fontWeight: 600 }}>Ups, ada gangguan sebentar</p>
        <p style={{ marginTop: 8, opacity: 0.6 }}>
          {left !== null ? `Kembali ke layar awal dalam ${left} detik…` : 'Muat ulang halaman untuk melanjutkan.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 20, height: 48, padding: '0 24px', borderRadius: 16, background: 'rgb(255 90 122)', color: '#fff', fontWeight: 600, border: 0 }}
        >
          Kembali sekarang
        </button>
        <p style={{ marginTop: 16, fontSize: 11, opacity: 0.3 }}>{error.message?.slice(0, 160)}</p>
      </div>
    </main>
  );
}

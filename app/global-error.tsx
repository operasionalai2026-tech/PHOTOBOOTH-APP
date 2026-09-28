'use client';

// Error di level layout (jarang). Sama seperti app/error.tsx: pulihkan otomatis.

import { useEffect, useState } from 'react';
import { autoRecover } from '@/lib/recover';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    console.error(error);
    return autoRecover(setLeft);
  }, [error]);

  return (
    <html lang="id" translate="no">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0b0a10', color: '#f5f3fa', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 22, fontWeight: 600 }}>Ups, ada gangguan sebentar</p>
          <p style={{ opacity: 0.6 }}>{left !== null ? `Kembali ke layar awal dalam ${left} detik…` : 'Muat ulang halaman.'}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, height: 44, padding: '0 20px', borderRadius: 14, border: 0 }}>
            Kembali sekarang
          </button>
        </div>
      </body>
    </html>
  );
}

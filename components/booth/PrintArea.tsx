'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Layout } from '@/config/layouts';
import { canvasToBlob, toPrintSheet } from '@/lib/compose';

/**
 * Elemen yang hanya muncul saat print (lihat globals.css).
 * Dirender lewat portal langsung di <body> supaya aturan @media print bisa menyembunyikan sisanya.
 */
export function PrintArea({ src }: { src: string | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !src) return null;
  return createPortal(
    <div id="print-area">
      <img src={src} alt="" />
    </div>,
    document.body,
  );
}

let lastSheetUrl: string | null = null;

/** Siapkan gambar cetak full-res (strip digandakan jadi 4x6). Return object URL. */
export async function printImage(fullUrl: string, layout: Layout): Promise<string> {
  if (layout.id !== 'strip') return fullUrl;
  const img = new Image();
  img.src = fullUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  const sheet = toPrintSheet(c, layout);
  const blob = await canvasToBlob(sheet, 'image/jpeg', 0.95);
  if (lastSheetUrl) URL.revokeObjectURL(lastSheetUrl);
  lastSheetUrl = URL.createObjectURL(blob);
  return lastSheetUrl;
}

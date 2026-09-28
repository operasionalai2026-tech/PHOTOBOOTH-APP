'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Layout } from '@/config/layouts';
import { canvasToBlob, toPrintSheet } from '@/lib/compose';

export type PrintJob = { src: string; widthIn: number; heightIn: number };

/**
 * Elemen yang hanya muncul saat print (lihat globals.css), plus ukuran kertas per gaya
 * (Polaroid 6x8, Instagram 5x7, strip 2x6 → dua strip di kertas 4x6).
 * Dirender lewat portal langsung di <body> supaya aturan @media print bisa menyembunyikan sisanya.
 */
export function PrintArea({ job }: { job: PrintJob | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !job) return null;
  return createPortal(
    <div id="print-area">
      <style>{`@media print { @page { size: ${job.widthIn}in ${job.heightIn}in; margin: 0; } }`}</style>
      <img src={job.src} alt="" />
    </div>,
    document.body,
  );
}

let lastSheetUrl: string | null = null;

/** Siapkan gambar cetak full-res untuk gaya ini (strip digandakan jadi satu kertas 4x6). */
export async function printImage(fullUrl: string, layout: Layout): Promise<PrintJob> {
  const { widthIn, heightIn, copies } = layout.print;
  if (copies === 1) return { src: fullUrl, widthIn, heightIn };
  const img = new Image();
  img.src = fullUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  const blob = await canvasToBlob(toPrintSheet(c, layout), 'image/jpeg', 0.95);
  if (lastSheetUrl) URL.revokeObjectURL(lastSheetUrl);
  lastSheetUrl = URL.createObjectURL(blob);
  return { src: lastSheetUrl, widthIn, heightIn };
}

import type { Metadata, Viewport } from 'next';
import { EVENT } from '@/config/event';
import './globals.css';

export const metadata: Metadata = {
  title: EVENT.name,
  description: `Photobooth ${EVENT.name}`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0b0a10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // translate="no": Google Translate mengubah DOM dan membuat React crash saat pindah layar.
    <html lang="id" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Poppins:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}

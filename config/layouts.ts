// Gaya foto. Setiap gaya punya frame sendiri dan ukuran cetak sendiri.
// Ukuran kanvas dalam piksel pada 300 dpi (1 inci = 300 px).

export type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  id: 'polaroid' | 'instagram' | 'strip-bow' | 'strip-classic';
  name: string;
  description: string;
  /** Label ukuran cetak untuk UI, mis. "6x8 in". */
  sizeLabel: string;
  width: number;
  height: number;
  slots: Rect[];
  /** Area teks/dekorasi di luar foto. */
  footer: Rect;
  /** Frame (config/frames.ts) yang melekat ke gaya ini. */
  frameId: string;
  /** Ukuran kertas cetak. copies: 2 → dua strip berdampingan di satu kertas (tinggal digunting). */
  print: { widthIn: number; heightIn: number; copies: 1 | 2 };
};

const DPI = 300;

/** Posisikan `count` slot vertikal berurutan. */
function column(count: number, x: number, top: number, w: number, h: number, gap: number): Rect[] {
  return Array.from({ length: count }, (_, i) => ({ x, y: top + i * (h + gap), w, h }));
}

export const LAYOUTS: Layout[] = [
  {
    id: 'polaroid',
    name: 'Polaroid',
    description: '1 foto',
    sizeLabel: '6x8 in',
    width: 6 * DPI, // 1800
    height: 8 * DPI, // 2400
    slots: [{ x: 110, y: 110, w: 1580, h: 1580 }],
    footer: { x: 0, y: 1690, w: 1800, h: 710 },
    frameId: 'polaroid',
    print: { widthIn: 6, heightIn: 8, copies: 1 },
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: '1 foto',
    sizeLabel: '5x7 in',
    width: 5 * DPI, // 1500
    height: 7 * DPI, // 2100
    // Kartu postingan: inset 70px, header 170px, foto persegi selebar kartu.
    slots: [{ x: 70, y: 240, w: 1360, h: 1360 }],
    footer: { x: 70, y: 1600, w: 1360, h: 430 },
    frameId: 'instagram',
    print: { widthIn: 5, heightIn: 7, copies: 1 },
  },
  {
    id: 'strip-bow',
    name: 'Strip Pita',
    description: '3 foto',
    sizeLabel: '2x6 in',
    width: 2 * DPI, // 600
    height: 6 * DPI, // 1800
    slots: column(3, 60, 120, 480, 470, 36),
    footer: { x: 0, y: 1602, w: 600, h: 198 },
    frameId: 'bow',
    print: { widthIn: 4, heightIn: 6, copies: 2 },
  },
  {
    id: 'strip-classic',
    name: 'Strip Klasik',
    description: '4 foto',
    sizeLabel: '2x6 in',
    width: 2 * DPI, // 600
    height: 6 * DPI, // 1800
    slots: column(4, 36, 36, 528, 364, 24),
    footer: { x: 0, y: 1564, w: 600, h: 236 },
    frameId: 'classic-strip',
    print: { widthIn: 4, heightIn: 6, copies: 2 },
  },
];

export function getLayout(id: string): Layout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

// Gaya foto. Setiap gaya = satu desain frame (gambar di public/frames/, jendela foto transparan)
// + posisi slot foto + ukuran cetak. Ukuran kanvas dalam piksel pada 300 dpi (1 inci = 300 px).
//
// Menambah frame baru: siapkan desain dengan jendela foto transparan (PNG/WebP), taruh di
// public/frames/, lalu tambahkan gaya di LAYOUTS dengan koordinat jendela dalam piksel gambar
// aslinya (lihat public/frames/README.md).

export type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  id: string;
  name: string;
  description: string;
  /** Label ukuran cetak untuk UI, mis. "8x10 in". */
  sizeLabel: string;
  width: number;
  height: number;
  /** Posisi foto di kanvas (sudah termasuk sedikit "bleed" di bawah bingkai). */
  slots: Rect[];
  /** Gambar frame dan posisinya di kanvas; digambar DI ATAS foto. */
  art: Rect & { src: string };
  /** Warna dasar kanvas (terlihat di sisi strip yang lebih ramping dari 2x6). */
  paper: string;
  /** Ukuran kertas cetak. copies: 2 → dua strip berdampingan di satu kertas (tinggal digunting). */
  print: { widthIn: number; heightIn: number; copies: 1 | 2 };
};

const DPI = 300;
const BLEED = 6; // px: foto sedikit lebih besar dari jendela supaya tepinya tertutup bingkai

type ArtSpec = {
  src: string;
  /** Ukuran gambar frame asli (px). */
  artW: number;
  artH: number;
  /** Jendela foto dalam piksel gambar asli (atas → bawah, kiri → kanan). */
  windows: [number, number, number, number][];
};

/** Tempatkan gambar frame di kanvas (tinggi penuh, di tengah) dan hitung posisi slot. */
function place(width: number, height: number, spec: ArtSpec) {
  const s = height / spec.artH;
  const w = spec.artW * s;
  const x = (width - w) / 2;
  return {
    art: { src: spec.src, x, y: 0, w, h: height },
    slots: spec.windows.map(([wx, wy, ww, wh]) => ({
      x: x + wx * s - BLEED,
      y: wy * s - BLEED,
      w: ww * s + BLEED * 2,
      h: wh * s + BLEED * 2,
    })),
  };
}

const PORTRAIT_8x10 = { width: 8 * DPI, height: 10 * DPI }; // 2400 x 3000 (rasio 4:5 = desain)
const STRIP_2x6 = { width: 2 * DPI, height: 6 * DPI }; // 600 x 1800

export const LAYOUTS: Layout[] = [
  {
    id: 'remisya-bubble',
    name: 'Bingkai Unik',
    description: '4 foto',
    sizeLabel: '8x10 in',
    ...PORTRAIT_8x10,
    ...place(PORTRAIT_8x10.width, PORTRAIT_8x10.height, {
      src: '/frames/remisya-bubble.webp',
      artW: 1122,
      artH: 1402,
      windows: [
        [124, 302, 425, 395],
        [584, 312, 428, 387],
        [134, 713, 437, 403],
        [599, 735, 409, 383],
      ],
    }),
    paper: '#f0e4d8',
    print: { widthIn: 8, heightIn: 10, copies: 1 },
  },
  {
    id: 'remisya-grid',
    name: 'Grid',
    description: '4 foto',
    sizeLabel: '8x10 in',
    ...PORTRAIT_8x10,
    ...place(PORTRAIT_8x10.width, PORTRAIT_8x10.height, {
      src: '/frames/remisya-grid.webp',
      artW: 1122,
      artH: 1402,
      windows: [
        [159, 276, 382, 412],
        [581, 276, 383, 412],
        [159, 722, 382, 409],
        [581, 721, 383, 411],
      ],
    }),
    paper: '#f0e4d8',
    print: { widthIn: 8, heightIn: 10, copies: 1 },
  },
  {
    id: 'remisya-single',
    name: 'Satu Foto',
    description: '1 foto',
    sizeLabel: '8x10 in',
    ...PORTRAIT_8x10,
    ...place(PORTRAIT_8x10.width, PORTRAIT_8x10.height, {
      src: '/frames/remisya-single.webp',
      artW: 1122,
      artH: 1402,
      windows: [[172, 283, 778, 918]],
    }),
    paper: '#f0e4d8',
    print: { widthIn: 8, heightIn: 10, copies: 1 },
  },
  {
    id: 'remisya-strip-collage',
    name: 'Strip Kolase',
    description: '3 foto',
    sizeLabel: '2x6 in',
    ...STRIP_2x6,
    ...place(STRIP_2x6.width, STRIP_2x6.height, {
      src: '/frames/remisya-strip-collage.webp',
      artW: 449,
      artH: 1536,
      windows: [
        [72, 389, 308, 262],
        [72, 698, 308, 260],
        [72, 1003, 308, 253],
      ],
    }),
    paper: '#f0e8d8',
    print: { widthIn: 4, heightIn: 6, copies: 2 },
  },
  {
    id: 'remisya-strip',
    name: 'Strip',
    description: '3 foto',
    sizeLabel: '2x6 in',
    ...STRIP_2x6,
    ...place(STRIP_2x6.width, STRIP_2x6.height, {
      src: '/frames/remisya-strip.webp',
      artW: 438,
      artH: 1536,
      windows: [
        [49, 313, 340, 286],
        [49, 630, 340, 276],
        [49, 937, 340, 285],
      ],
    }),
    paper: '#f0e8dc',
    print: { widthIn: 4, heightIn: 6, copies: 2 },
  },
  {
    id: 'remisya-strip-keffiyeh',
    name: 'Strip Keffiyeh',
    description: '3 foto',
    sizeLabel: '2x6 in',
    ...STRIP_2x6,
    ...place(STRIP_2x6.width, STRIP_2x6.height, {
      src: '/frames/remisya-strip-keffiyeh.webp',
      artW: 451,
      artH: 1536,
      windows: [
        [72, 334, 309, 288],
        [72, 653, 308, 282],
        [72, 963, 307, 280],
      ],
    }),
    paper: '#f0e8dc',
    print: { widthIn: 4, heightIn: 6, copies: 2 },
  },
];

export function getLayout(id: string): Layout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

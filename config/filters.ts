// Filter warna. `matrix` dipakai saat compose di canvas (per-pixel, jalan di
// semua browser termasuk Safari), `css` dipakai untuk preview live di <video>.

export type Filter = {
  id: string;
  name: string;
  css: string;
  /** 4x5 color matrix (baris R,G,B,A; kolom r,g,b,a,offset[0..255]). null = tanpa filter. */
  matrix: number[] | null;
};

const grayscale = [
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0, 0, 0, 1, 0,
];

export const FILTERS: Filter[] = [
  { id: 'none', name: 'Natural', css: 'none', matrix: null },
  {
    id: 'bw',
    name: 'Hitam Putih',
    css: 'grayscale(1) contrast(1.1)',
    // grayscale + kontras 1.1 (skala 1.1, geser -12.8 supaya titik tengah tetap)
    matrix: grayscale.map((v, i) => (i >= 15 ? v : i % 5 === 4 ? -12.8 : v * 1.1)),
  },
  {
    id: 'sepia',
    name: 'Sepia',
    css: 'sepia(0.85)',
    matrix: [
      0.393, 0.769, 0.189, 0, 0,
      0.349, 0.686, 0.168, 0, 0,
      0.272, 0.534, 0.131, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'warm',
    name: 'Hangat',
    css: 'sepia(0.2) saturate(1.25) brightness(1.04)',
    matrix: [
      1.12, 0.05, 0, 0, 8,
      0.02, 1.04, 0, 0, 4,
      0, 0, 0.9, 0, -4,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'cool',
    name: 'Sejuk',
    css: 'saturate(1.1) hue-rotate(-8deg) brightness(1.03)',
    matrix: [
      0.92, 0, 0, 0, -2,
      0, 1.02, 0.04, 0, 2,
      0, 0.05, 1.15, 0, 10,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'vintage',
    name: 'Vintage',
    css: 'sepia(0.35) contrast(0.9) brightness(1.08) saturate(0.85)',
    matrix: [
      0.9, 0.12, 0.05, 0, 22,
      0.07, 0.86, 0.08, 0, 14,
      0.05, 0.1, 0.72, 0, 18,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'vivid',
    name: 'Vivid',
    css: 'saturate(1.45) contrast(1.08)',
    matrix: [
      1.36, -0.29, -0.07, 0, -6,
      -0.14, 1.22, -0.07, 0, -6,
      -0.14, -0.29, 1.43, 0, -6,
      0, 0, 0, 1, 0,
    ],
  },
];

export function getFilter(id: string | null | undefined): Filter {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

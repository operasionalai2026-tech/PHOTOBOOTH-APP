// Tata letak foto. Ukuran kanvas dalam piksel pada ~300 dpi:
// 4x6 inci = 1200x1800, strip 2x6 inci = 600x1800.

export type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  id: 'single' | 'strip' | 'grid';
  name: string;
  description: string;
  width: number;
  height: number;
  slots: Rect[];
  /** Area bawah untuk nama event / dekorasi frame. */
  footer: Rect;
};

export const LAYOUTS: Layout[] = [
  {
    id: 'single',
    name: 'Klasik',
    description: '1 foto besar',
    width: 1200,
    height: 1800,
    slots: [{ x: 60, y: 60, w: 1080, h: 1350 }],
    footer: { x: 0, y: 1410, w: 1200, h: 390 },
  },
  {
    id: 'strip',
    name: 'Strip',
    description: '3 foto memanjang',
    width: 600,
    height: 1800,
    slots: [0, 1, 2].map((i) => ({ x: 40, y: 40 + i * 450, w: 520, h: 430 })),
    footer: { x: 0, y: 1370, w: 600, h: 430 },
  },
  {
    id: 'grid',
    name: 'Grid',
    description: '4 foto kotak',
    width: 1200,
    height: 1800,
    slots: [0, 1, 2, 3].map((i) => ({
      x: 50 + (i % 2) * 560,
      y: 50 + Math.floor(i / 2) * 670,
      w: 540,
      h: 650,
    })),
    footer: { x: 0, y: 1390, w: 1200, h: 410 },
  },
];

export function getLayout(id: string): Layout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

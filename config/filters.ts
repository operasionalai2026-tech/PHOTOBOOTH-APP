// Filter foto. `apply` mengubah ImageData di tempat (lihat lib/imageFilters.ts).

import { beauty, blackWhite, retro } from '@/lib/imageFilters';

export type Filter = {
  id: string;
  name: string;
  description: string;
  apply: ((img: ImageData) => void) | null;
};

export const FILTERS: Filter[] = [
  { id: 'none', name: 'Asli', description: 'Tanpa filter', apply: null },
  { id: 'retro', name: 'Retro', description: 'Film pudar + titik halftone', apply: retro },
  { id: 'bw', name: 'Hitam Putih', description: 'Klasik monokrom', apply: blackWhite },
  { id: 'beauty', name: 'Cantik', description: 'Kulit halus & cerah', apply: beauty },
];

export function getFilter(id: string | null | undefined): Filter {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

import { useRef } from 'react';

/**
 * Pertahankan nilai terakhir yang tidak null.
 * Layar booth masih dirender selama animasi keluar (AnimatePresence) setelah state
 * di-reset; tanpa ini, `result`/`layout` jadi null dan halaman crash.
 */
export function useSticky<T>(value: T | null): T | null {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return ref.current;
}

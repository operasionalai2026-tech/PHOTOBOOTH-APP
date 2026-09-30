'use client';

import { Icon } from '@/components/ui/Icon';

export type View = 'photo' | 'gif';

/** Tab pratinjau Foto / GIF (layar Hias, layar hasil, halaman unduh tamu). */
export function ViewTabs({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const tabs = [
    { id: 'photo' as const, label: 'Foto', icon: 'camera' as const },
    { id: 'gif' as const, label: 'GIF', icon: 'burst' as const },
  ];
  return (
    <div role="tablist" aria-label="Pratinjau" className="flex shrink-0 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition ${
            value === t.id ? 'bg-white text-ink-900' : 'text-white/70 hover:text-white'
          }`}
        >
          <Icon name={t.icon} className="h-4 w-4" /> {t.label}
        </button>
      ))}
    </div>
  );
}

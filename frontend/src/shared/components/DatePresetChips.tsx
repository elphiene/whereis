import { cn } from '@/shared/lib/utils';

export type DatePreset = 'today' | 'yesterday' | '7days';

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days',     label: 'Last 7 days' },
];

interface DatePresetChipsProps {
  value: DatePreset;
  onChange: (v: DatePreset) => void;
  className?: string;
}

export function DatePresetChips({ value, onChange, className }: DatePresetChipsProps) {
  return (
    <div className={cn('flex gap-1.5', className)}>
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            'rounded-[7px] border px-3 py-1 font-mono text-[11px] font-medium transition-colors',
            value === p.value
              ? 'border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] text-[#ec4899]'
              : 'border-white/[0.07] bg-transparent text-[#a0a0a0] hover:border-white/[0.12] hover:text-white',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    return { from: today.toISOString(), to: now.toISOString() };
  }
  if (preset === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yestEnd = new Date(today.getTime() - 1);
    return { from: yest.toISOString(), to: yestEnd.toISOString() };
  }
  // 7days
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  return { from: week.toISOString(), to: now.toISOString() };
}

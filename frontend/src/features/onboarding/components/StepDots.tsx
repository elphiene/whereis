import { cn } from '@/shared/lib/utils';

interface StepDotsProps {
  current: number;
  total: number;
  className?: string;
}

export function StepDots({ current, total, className }: StepDotsProps) {
  return (
    <div className={cn('flex justify-center gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => {
        const dot = i + 1;
        const isDone = dot < current;
        const isActive = dot === current;
        return (
          <div
            key={i}
            className={cn(
              'h-[7px] w-[7px] rounded-full transition-colors',
              isActive
                ? 'bg-[#ec4899]'
                : isDone
                  ? 'bg-[rgba(236,72,153,0.35)]'
                  : 'bg-white/[0.12]',
            )}
          />
        );
      })}
    </div>
  );
}

import { cn } from '@/shared/lib/utils';
import { mapInstance } from '../hooks/useMapInstance';
import { useMapStore } from '../store';
import { useAuth } from '@/shared/hooks/useAuth';

export function FABs({ className }: { className?: string }) {
  const { user } = useAuth();
  const positions = useMapStore((s) => s.positions);

  function flyToSelf() {
    if (!user || !mapInstance.current) return;
    const pos = positions[user.id];
    if (!pos) return;
    mapInstance.current.flyTo({
      center: [pos.longitude, pos.latitude],
      zoom: 15,
      duration: 1200,
    });
  }

  return (
    <div
      className={cn(
        // Mobile: raise above the bottom-sheet peek (~96px) + gap
        // Desktop: standard bottom-5
        'absolute right-4 z-10 flex flex-col gap-1.5',
        'bottom-[110px] md:bottom-5',
        className,
      )}
    >
      <button
        onClick={flyToSelf}
        title="Zoom to my location"
        className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] text-[18px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md transition-colors hover:bg-[rgba(236,72,153,0.2)]"
      >
        ⊕
      </button>
      <button
        title="Toggle map style"
        className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-white/[0.12] bg-black/90 text-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md transition-colors hover:border-white/20"
      >
        🗺
      </button>
    </div>
  );
}

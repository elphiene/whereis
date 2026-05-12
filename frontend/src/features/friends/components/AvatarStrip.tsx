import { useFriendsStore, getMemberStatus } from '../store';
import { useMapStore } from '@/features/map/store';
import { mapInstance } from '@/features/map/hooks/useMapInstance';
import { cn } from '@/shared/lib/utils';

export function AvatarStrip({ className }: { className?: string }) {
  const members = useFriendsStore((s) => s.members);
  const { selectedFriendId, setSelectedFriendId, positions } = useMapStore();

  return (
    <div className={cn('absolute right-2.5 top-2.5 z-10 flex flex-col gap-1.5', className)}>
      {members.map((m) => {
        const status = getMemberStatus(m);
        const isSelected = selectedFriendId === m.userId;
        const pos = positions[m.userId];
        const isOffline = status === 'offline';

        function handleClick() {
          setSelectedFriendId(m.userId);
          if (pos && mapInstance.current) {
            mapInstance.current.flyTo({
              center: [pos.longitude, pos.latitude],
              zoom: 15,
              duration: 1500,
            });
          }
        }

        return (
          <button
            key={m.userId}
            onClick={handleClick}
            title={m.name}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition-all',
              isOffline && 'opacity-50',
            )}
            style={{
              background: `linear-gradient(135deg, ${m.colour}, ${m.colour}88)`,
              border: `2px solid ${isSelected ? m.colour : isOffline ? '#888' : m.colour}`,
              boxShadow: isSelected
                ? `0 0 0 2px ${m.colour}44`
                : isOffline
                  ? 'none'
                  : `0 0 0 2px ${m.colour}26`,
            }}
          >
            {m.name.slice(0, 1).toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

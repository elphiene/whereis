import { type Member, getMemberStatus } from '../store';
import { useMapStore } from '@/features/map/store';
import { useAuth } from '@/shared/hooks/useAuth';
import { mapInstance } from '@/features/map/hooks/useMapInstance';
import { cn } from '@/shared/lib/utils';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

interface FriendCardProps {
  member: Member;
  onPauseToggle?: (userId: number, pause: boolean) => void;
}

export function FriendCard({ member, onPauseToggle }: FriendCardProps) {
  const { user } = useAuth();
  const { selectedFriendId, setSelectedFriendId, positions } = useMapStore();
  const pos = positions[member.userId];

  const isOwn = user?.id === member.userId;
  const isSelected = selectedFriendId === member.userId;
  const status = getMemberStatus(member);

  const statusDot =
    status === 'moving'
      ? 'bg-[#ec4899] shadow-[0_0_4px_#ec4899]'
      : status === 'stationary'
        ? 'bg-[#22c55e] shadow-[0_0_4px_#22c55e]'
        : 'bg-[#888]';

  const initials = member.name.slice(0, 2).toUpperCase();
  const isOffline = status === 'offline';

  function handleClick() {
    setSelectedFriendId(member.userId);
    if (pos && mapInstance.current) {
      mapInstance.current.flyTo({
        center: [pos.longitude, pos.latitude],
        zoom: 15,
        duration: 1500,
      });
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 transition-all',
        isSelected
          ? 'border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)]'
          : 'border-white/[0.07] bg-[#161616] hover:border-white/[0.12] hover:bg-[#1a1a1a]',
        isOffline && 'opacity-50',
      )}
    >
      {/* Avatar */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          background: `linear-gradient(135deg, ${member.colour}, ${member.colour}88)`,
          border: `2px solid ${member.colour}`,
          boxShadow: `0 0 0 2px ${member.colour}26`,
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-sm font-semibold text-white">{member.name}</div>
        <div className="truncate font-mono text-xs text-[#a0a0a0]">
          {status === 'moving' && pos ? (
            <>
              <span className="text-[#ec4899]">{Math.round(pos.speed)} km/h</span>
              {pos.address ? ` · ${pos.address.split(',')[0]}` : ''}
            </>
          ) : status === 'paused' ? (
            'paused'
          ) : status === 'offline' ? (
            `offline · ${relativeTime(member.lastUpdate)}`
          ) : pos?.address ? (
            `${pos.address.split(',')[0]} · ${relativeTime(member.lastUpdate)}`
          ) : (
            relativeTime(member.lastUpdate)
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <div className={cn('h-2 w-2 rounded-full', statusDot)} />

        {isOwn && onPauseToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPauseToggle(member.userId, !member.deviceDisabled);
            }}
            className="rounded border border-white/[0.12] bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-[#a0a0a0] transition-colors hover:border-white/20 hover:text-white"
          >
            {member.deviceDisabled ? 'resume' : 'pause'}
          </button>
        )}
      </div>
    </div>
  );
}

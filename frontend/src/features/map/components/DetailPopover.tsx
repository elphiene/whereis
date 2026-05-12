import { useNavigate } from 'react-router-dom';
import { useMapStore } from '../store';
import { useFriendsStore, getMemberStatus } from '@/features/friends/store';

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function DetailPopover() {
  const navigate = useNavigate();
  const { selectedFriendId, positions, setSelectedFriendId } = useMapStore();
  const members = useFriendsStore((s) => s.members);

  if (selectedFriendId == null) return null;

  const member = members.find((m) => m.userId === selectedFriendId);
  const pos = positions[selectedFriendId];
  if (!member) return null;

  const status = getMemberStatus(member);
  const statusLabel =
    status === 'moving'
      ? 'moving'
      : status === 'paused'
        ? 'paused'
        : status === 'offline'
          ? 'offline'
          : 'online';

  const statusColour =
    status === 'moving'
      ? '#ec4899'
      : status === 'offline' || status === 'paused'
        ? '#888'
        : '#22c55e';

  const initials = member.name.slice(0, 2).toUpperCase();

  return (
    <div
      className="absolute left-1/2 top-[62px] z-20 w-[240px] -translate-x-1/2 rounded-[10px] border border-white/[0.12] bg-black/95 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${member.colour}, ${member.colour}88)`,
            border: `2px solid ${member.colour}`,
          }}
        >
          {initials}
        </div>
        <span className="flex-1 text-[15px] font-bold text-white">{member.name}</span>
        <span
          className="rounded-[5px] border px-2 py-0.5 font-mono text-[10px] font-medium"
          style={{ color: statusColour, borderColor: `${statusColour}55`, background: `${statusColour}18` }}
        >
          {statusLabel}
        </span>
        <button
          onClick={() => setSelectedFriendId(null)}
          className="ml-1 text-[#888] transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.07]">
        {pos?.address && (
          <PopupRow label="location" value={pos.address} />
        )}
        {pos && status === 'moving' && (
          <PopupRow label="speed" value={`${Math.round(pos.speed)} km/h`} highlight />
        )}
        {pos?.battery != null && (
          <PopupRow label="battery" value={`${pos.battery}%`} />
        )}
        <PopupRow label="updated" value={relativeTime(member.lastUpdate)} />
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-1.5">
        <button
          onClick={() => navigate(`/history?userId=${selectedFriendId}`)}
          className="flex-1 rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] py-1.5 font-mono text-[11px] text-[#ec4899] transition-colors hover:bg-[rgba(236,72,153,0.2)]"
        >
          history
        </button>
        {pos && (
          <a
            href={`https://maps.google.com/maps?q=${pos.latitude},${pos.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-[7px] border border-white/[0.12] bg-transparent py-1.5 text-center font-mono text-[11px] text-[#a0a0a0] transition-colors hover:border-white/20 hover:text-white"
          >
            directions
          </a>
        )}
      </div>
    </div>
  );
}

function PopupRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-[5px]">
      <span className="font-mono text-xs text-[#a0a0a0]">{label}</span>
      <span
        className={`text-xs font-medium ${highlight ? 'text-[#ec4899]' : 'text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}

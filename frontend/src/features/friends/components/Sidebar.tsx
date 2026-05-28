import { Link } from 'react-router-dom';
import { useFriendsStore, sortMembers } from '../store';
import { FriendCard } from './FriendCard';
import { getMemberStatus } from '../store';

function onlineCount(members: ReturnType<typeof useFriendsStore.getState>['members']) {
  return members.filter((m) => {
    const s = getMemberStatus(m);
    return s === 'moving' || s === 'stationary';
  }).length;
}

interface SidebarProps {
  onPauseToggle: (userId: number, pause: boolean) => void;
  className?: string;
}

export function Sidebar({ onPauseToggle, className }: SidebarProps) {
  const members = useFriendsStore((s) => sortMembers(s.members));
  const online = onlineCount(members);

  return (
    <aside
      className={`flex w-[280px] min-w-[280px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#111111] ${className ?? ''}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        {/* WhereIs? logo — white variant */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 125 568 310"
          height="22"
          className="block"
        >
          <text
            style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '94.3px', fontWeight: 800 }}
            transform="translate(63.43 262.72)"
          >
            <tspan fill="#ec4899" letterSpacing="-0.03em">W</tspan>
            <tspan fill="#ffffff">here</tspan>
            <tspan fill="#ec4899">Is</tspan>
          </text>
          <rect fill="#2a2a2a" x="394.56" y="382.46" width="44.89" height="44.89" />
          <path
            fill="#ec4899"
            d="M523.49,134.95H40.9c-22.59,0-40.9,18.31-40.9,40.9h0v101.05c24.79,0,44.89-20.1,44.89-44.89v-56.16h478.6v115.88h-88.03c-22.59,0-40.9,18.31-40.9,40.9v44.89h44.89v-44.89h88.03c22.59,0,40.9-18.31,40.9-40.9v-111.89c0-24.79-20.1-44.89-44.89-44.89Z"
          />
        </svg>
        <span className="rounded-[5px] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-2 py-0.5 font-mono text-[11px] text-[#22c55e]">
          {online} online
        </span>
      </div>

      {/* Friend list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        <div className="px-1 pb-1 pt-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-[#888]">
          friends
        </div>
        {members.map((m) => (
          <FriendCard key={m.userId} member={m} onPauseToggle={onPauseToggle} />
        ))}
      </div>

      {/* Bottom nav */}
      <nav className="flex gap-1.5 border-t border-white/[0.07] p-2.5">
        {[
          { label: '🗺 map', to: '/map' },
          { label: '📊 stats', to: '/stats' },
          { label: '⬡ zones', to: '/geofences' },
          { label: '⚙', to: '/settings' },
        ].map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className="flex-1 rounded-[7px] border border-white/[0.07] py-2 text-center font-mono text-[11px] font-medium text-[#a0a0a0] transition-all hover:border-white/[0.12] hover:text-white aria-[current=page]:border-[rgba(236,72,153,0.3)] aria-[current=page]:bg-[rgba(236,72,153,0.12)] aria-[current=page]:text-[#ec4899]"
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

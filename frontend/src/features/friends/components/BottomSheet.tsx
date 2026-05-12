import { useState } from 'react';
import { Drawer } from 'vaul';
import { useFriendsStore, sortMembers, getMemberStatus } from '../store';
import { useMapStore } from '@/features/map/store';
import { FriendCard } from './FriendCard';
import { useAuthStore } from '@/stores/auth.store';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

interface BottomSheetProps {
  onPauseToggle: (userId: number, pause: boolean) => void;
}

export function BottomSheet({ onPauseToggle }: BottomSheetProps) {
  const { user } = useAuthStore();
  const [snap, setSnap] = useState<number | string | null>(0.12);

  const members = useFriendsStore((s) => sortMembers(s.members));
  const { selectedFriendId, positions } = useMapStore();

  // Show selected friend in peek, fall back to own member
  const activeMember =
    members.find((m) => m.userId === selectedFriendId) ??
    members.find((m) => m.userId === user?.id) ??
    members[0];

  const activePos = activeMember ? positions[activeMember.userId] : null;
  const activeStatus = activeMember ? getMemberStatus(activeMember) : null;

  const isExpanded = snap !== 0.12;

  return (
    <Drawer.Root
      snapPoints={[0.12, 0.5, 0.95]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
      open
      onOpenChange={(open) => { if (!open) setSnap(0.12); }}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-[14px] border-t border-white/[0.07] bg-[#101010] outline-none"
          style={{ height: '95dvh' }}
        >
          {/* Handle */}
          <div className="flex justify-center pb-1 pt-2">
            <div className="h-[3px] w-8 rounded-full bg-white/[0.12]" />
          </div>

          {/* Peek content: active friend */}
          {activeMember && (
            <div className="flex items-center gap-3 px-3.5 pb-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${activeMember.colour}, ${activeMember.colour}88)`,
                  border: `2px solid ${activeMember.colour}`,
                }}
              >
                {activeMember.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-white">{activeMember.name}</div>
                <div className="truncate font-mono text-xs text-[#a0a0a0]">
                  {activeStatus === 'moving' && activePos ? (
                    <>
                      <span className="text-[#ec4899]">{Math.round(activePos.speed)} km/h</span>
                      {activePos.address ? ` · ${activePos.address.split(',')[0]}` : ''}
                    </>
                  ) : activeStatus === 'paused' ? (
                    'paused'
                  ) : activeStatus === 'offline' ? (
                    `offline · ${relativeTime(activeMember.lastUpdate)}`
                  ) : activePos?.address ? (
                    activePos.address.split(',')[0]
                  ) : (
                    relativeTime(activeMember.lastUpdate)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expanded content: detail rows + full friend list */}
          {isExpanded && (
            <div className="flex-1 overflow-y-auto px-3.5 pb-4">
              {/* Active friend detail rows */}
              {activeMember && activePos && (
                <div className="mb-4 divide-y divide-white/[0.07] rounded-[10px] border border-white/[0.07] bg-[#161616] px-3">
                  {activePos.address && (
                    <DetailRow label="location" value={activePos.address} />
                  )}
                  {activePos.battery != null && (
                    <DetailRow label="battery" value={`${activePos.battery}%`} />
                  )}
                  {activePos.course != null && (
                    <DetailRow label="heading" value={`${Math.round(activePos.course)}°`} />
                  )}
                  <DetailRow label="updated" value={relativeTime(activeMember.lastUpdate)} />
                </div>
              )}

              {/* All friend cards */}
              <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-[#888]">
                all friends
              </div>
              <div className="flex flex-col gap-1.5">
                {members.map((m) => (
                  <FriendCard key={m.userId} member={m} onPauseToggle={onPauseToggle} />
                ))}
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="font-mono text-xs text-[#a0a0a0]">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}

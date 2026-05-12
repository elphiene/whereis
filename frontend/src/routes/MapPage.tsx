import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapView } from '@/features/map/components/MapView';
import { DetailPopover } from '@/features/map/components/DetailPopover';
import { FABs } from '@/features/map/components/FABs';
import { Sidebar } from '@/features/friends/components/Sidebar';
import { BottomSheet } from '@/features/friends/components/BottomSheet';
import { AvatarStrip } from '@/features/friends/components/AvatarStrip';
import { useFriendsStore } from '@/features/friends/store';
import { useTraccarSocket } from '@/shared/hooks/useTraccarSocket';

function SetupBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [deviceId, setDeviceId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('onboarding_state');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s.deviceConfigured && s.traccarDeviceId) {
        setVisible(true);
        setDeviceId(s.traccarDeviceId);
      }
    } catch { /* ignore */ }
  }, []);

  // Poll positions until device reports, then hide
  useEffect(() => {
    if (!visible || !deviceId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/positions', { credentials: 'include' });
        if (!res.ok) return;
        const positions: { deviceId: number; fixTime: string }[] = await res.json();
        const now = Date.now();
        const found = positions.find(
          (p) => p.deviceId === deviceId && now - new Date(p.fixTime).getTime() < 5 * 60 * 1000,
        );
        if (found) {
          // Device reported — mark complete and hide banner
          try {
            const raw = localStorage.getItem('onboarding_state');
            if (raw) {
              const s = JSON.parse(raw);
              localStorage.setItem('onboarding_state', JSON.stringify({ ...s, deviceConfigured: true }));
            }
          } catch { /* ignore */ }
          setVisible(false);
        }
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [visible, deviceId]);

  if (!visible) return null;

  return (
    <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between bg-[rgba(236,72,153,0.12)] px-4 py-2.5 backdrop-blur-sm">
      <span className="font-mono text-xs text-[#ec4899]">
        ⚠ Your device isn't sharing yet
      </span>
      <button
        onClick={() => navigate('/settings#device')}
        className="font-mono text-xs font-medium text-[#ec4899] underline hover:no-underline"
      >
        Finish setup →
      </button>
    </div>
  );
}

export function MapPage() {
  const loadMembers = useFriendsStore((s) => s.loadMembers);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useTraccarSocket();

  async function handlePauseToggle(userId: number, pause: boolean) {
    useFriendsStore.getState().setMemberDisabled(userId, pause); // optimistic
    try {
      const res = await fetch(`/backend/${pause ? 'pause' : 'resume'}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) useFriendsStore.getState().setMemberDisabled(userId, !pause);
    } catch {
      useFriendsStore.getState().setMemberDisabled(userId, !pause);
    }
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#080808]">
      {/* Setup banner — shown when device setup was skipped */}
      <SetupBanner />

      {/* Single MapLibre instance — fills full screen on both breakpoints */}
      <MapView />

      {/* Detail popover — absolute top-center of map area */}
      <DetailPopover />

      {/* FABs — responsive bottom offset (raised on mobile to clear bottom sheet peek) */}
      <FABs />

      {/* Desktop: sidebar overlaid on the left */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden md:block">
        <Sidebar
          onPauseToggle={handlePauseToggle}
          className="pointer-events-auto h-full"
        />
      </div>

      {/* Mobile: avatar strip (top-right) + bottom sheet */}
      <AvatarStrip className="z-10 md:hidden" />
      <div className="md:hidden">
        <BottomSheet onPauseToggle={handlePauseToggle} />
      </div>
    </div>
  );
}

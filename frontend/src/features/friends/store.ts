import { create } from 'zustand';
import { api } from '@/shared/lib/traccar';

export interface Member {
  userId: number;
  traccarDeviceId: number;
  name: string;
  colour: string;
  role: 'admin' | 'member';
  lastUpdate: string;
  deviceDisabled: boolean;
  speed: number;
}

export type MemberStatus = 'moving' | 'stationary' | 'paused' | 'offline';

export function getMemberStatus(m: Pick<Member, 'deviceDisabled' | 'lastUpdate' | 'speed'>): MemberStatus {
  if (m.deviceDisabled) return 'paused';
  const isOnline = Date.now() - new Date(m.lastUpdate).getTime() < 30 * 60 * 1000;
  if (!isOnline) return 'offline';
  return m.speed > 5 ? 'moving' : 'stationary';
}

const STATUS_SORT: Record<MemberStatus, number> = {
  moving: 0,
  stationary: 1,
  paused: 2,
  offline: 3,
};

export function sortMembers(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) => STATUS_SORT[getMemberStatus(a)] - STATUS_SORT[getMemberStatus(b)],
  );
}

interface FriendsState {
  members: Member[];
  loading: boolean;
  loadMembers: () => Promise<void>;
  updateFromDevice: (deviceId: number, disabled: boolean, lastUpdate: string) => void;
  setMemberDisabled: (userId: number, disabled: boolean) => void;
  setMemberSpeed: (deviceId: number, speed: number, lastUpdate: string) => void;
}

interface BackendMember {
  userId: number;
  traccarUserId: number;
  traccarDeviceId: number | null;
  role: 'admin' | 'member';
  name: string;
  colour: string | null;
  lastPosition: { deviceId: number; speed: number } | null;
}

interface TraccarDevice {
  id: number;
  name: string;
  disabled: boolean;
  lastUpdate: string;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  members: [],
  loading: false,

  loadMembers: async () => {
    set({ loading: true });
    try {
      const [membersRes, devicesRes] = await Promise.all([
        api('/backend/members'),
        api('/api/devices'),
      ]);
      if (!membersRes.ok || !devicesRes.ok) return;

      const backendMembers: BackendMember[] = await membersRes.json();
      const traccarDevices: TraccarDevice[] = await devicesRes.json();
      const deviceMap = new Map(traccarDevices.map((d) => [d.id, d]));

      const members: Member[] = backendMembers.map((bm) => {
        const device = deviceMap.get(bm.traccarDeviceId ?? bm.userId) ?? null;
        return {
          userId: bm.userId,
          traccarDeviceId: bm.traccarDeviceId ?? bm.userId,
          name: bm.name,
          colour: bm.colour ?? '#ec4899',
          role: bm.role,
          lastUpdate: device?.lastUpdate ?? new Date(0).toISOString(),
          deviceDisabled: device?.disabled ?? false,
          speed: bm.lastPosition?.speed ?? 0,
        };
      });

      set({ members: sortMembers(members), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateFromDevice: (deviceId, disabled, lastUpdate) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.traccarDeviceId === deviceId ? { ...m, deviceDisabled: disabled, lastUpdate } : m,
      ),
    })),

  setMemberDisabled: (userId, disabled) =>
    set((s) => ({
      members: s.members.map((m) => (m.userId === userId ? { ...m, deviceDisabled: disabled } : m)),
    })),

  setMemberSpeed: (deviceId, speed, lastUpdate) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.traccarDeviceId === deviceId ? { ...m, speed, lastUpdate } : m,
      ),
    })),
}));

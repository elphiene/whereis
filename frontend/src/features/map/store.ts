import { create } from 'zustand';

export interface MapPosition {
  userId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address: string | null;
  battery: number | null;
  fixTime: string;
}

interface MapState {
  positions: Record<number, MapPosition>;
  selectedFriendId: number | null;
  setPosition: (pos: MapPosition) => void;
  setPositions: (positions: MapPosition[]) => void;
  setSelectedFriendId: (id: number | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  positions: {},
  selectedFriendId: null,

  setPosition: (pos) =>
    set((s) => ({ positions: { ...s.positions, [pos.userId]: pos } })),

  setPositions: (positions) =>
    set({ positions: Object.fromEntries(positions.map((p) => [p.userId, p])) }),

  setSelectedFriendId: (id) => set({ selectedFriendId: id }),
}));

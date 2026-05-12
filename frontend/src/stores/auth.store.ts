import { create } from 'zustand';
import { api } from '@/shared/lib/traccar';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
  colour: string | null;
  role: 'admin' | 'member';
  ntfyEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api('/backend/users/me');
      if (res.status === 401) {
        set({ user: null, loading: false });
        return;
      }
      if (!res.ok) {
        set({ user: null, loading: false, error: 'Server error during session check' });
        return;
      }
      const user: AuthUser = await res.json();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false, error: 'Could not reach server' });
    }
  },

  clear: () => set({ user: null, loading: false, error: null }),
}));

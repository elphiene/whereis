import { useEffect, useRef, useState } from 'react';
import { api } from '@/shared/lib/traccar';

const POLL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 12; // 2 minutes

interface PollerOptions {
  traccarDeviceId: number | null;
  enabled: boolean;
  onSuccess: () => void;
  onTimeout: () => void;
}

export function useDevicePoller({ traccarDeviceId, enabled, onSuccess, onTimeout }: PollerOptions) {
  const [attempts, setAttempts] = useState(0);
  const [pollerStatus, setPollerStatus] = useState<'waiting' | 'success' | 'timeout'>('waiting');
  const callbacksRef = useRef({ onSuccess, onTimeout });

  useEffect(() => {
    callbacksRef.current = { onSuccess, onTimeout };
  }, [onSuccess, onTimeout]);

  useEffect(() => {
    if (!enabled || !traccarDeviceId || pollerStatus !== 'waiting') return;

    if (attempts >= MAX_ATTEMPTS) {
      setPollerStatus('timeout');
      callbacksRef.current.onTimeout();
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await api('/api/positions');
        if (!res.ok || cancelled) return;

        const positions: Array<{ deviceId: number; fixTime: string }> = await res.json();
        const now = Date.now();
        const found = positions.find(
          (p) =>
            p.deviceId === traccarDeviceId &&
            now - new Date(p.fixTime).getTime() < 5 * 60 * 1000,
        );

        if (cancelled) return;

        if (found) {
          setPollerStatus('success');
          callbacksRef.current.onSuccess();
        } else {
          setAttempts((a) => a + 1);
        }
      } catch {
        if (!cancelled) setAttempts((a) => a + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempts, enabled, traccarDeviceId, pollerStatus]);

  function resetPoller() {
    setAttempts(0);
    setPollerStatus('waiting');
  }

  return { pollerStatus, attempts, resetPoller };
}

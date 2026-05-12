import { useEffect, useRef } from 'react';
import { useSocketStore } from '@/stores/socket.store';
import { useMapStore, type MapPosition } from '@/features/map/store';
import { useFriendsStore } from '@/features/friends/store';

interface TraccarSocketMessage {
  positions?: Array<{
    id: number;
    deviceId: number;
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    address: string | null;
    fixTime: string;
    deviceTime: string;
    attributes?: { batteryLevel?: number };
  }>;
  devices?: Array<{
    id: number;
    disabled: boolean;
    lastUpdate: string;
  }>;
}

const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;

export function useTraccarSocket() {
  const setConnected = useSocketStore((s) => s.setConnected);
  const setPosition = useMapStore((s) => s.setPosition);
  const members = useFriendsStore((s) => s.members);
  const updateFromDevice = useFriendsStore((s) => s.updateFromDevice);
  const setMemberSpeed = useFriendsStore((s) => s.setMemberSpeed);

  // Keep members ref fresh so the socket message handler sees latest deviceId→userId mapping
  const membersRef = useRef(members);
  useEffect(() => { membersRef.current = members; }, [members]);

  const wsRef = useRef<WebSocket | null>(null);
  const delayRef = useRef(BASE_DELAY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/socket`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        delayRef.current = BASE_DELAY;
        setConnected(true);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        const delay = delayRef.current;
        delayRef.current = Math.min(delay * 2, MAX_DELAY);
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: TraccarSocketMessage;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.positions) {
          for (const pos of msg.positions) {
            const member = membersRef.current.find((m) => m.traccarDeviceId === pos.deviceId);
            if (!member) continue;

            const mapPos: MapPosition = {
              userId: member.userId,
              latitude: pos.latitude,
              longitude: pos.longitude,
              speed: pos.speed,
              course: pos.course,
              address: pos.address,
              battery: pos.attributes?.batteryLevel ?? null,
              fixTime: pos.fixTime,
            };
            setPosition(mapPos);
            setMemberSpeed(pos.deviceId, pos.speed, pos.deviceTime);
          }
        }

        if (msg.devices) {
          for (const dev of msg.devices) {
            updateFromDevice(dev.id, dev.disabled, dev.lastUpdate);
          }
        }
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

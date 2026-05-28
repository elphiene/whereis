import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapInstance } from '../hooks/useMapInstance';
import { useMapStore } from '../store';
import { useFriendsStore, getMemberStatus, type Member } from '@/features/friends/store';

const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER: [number, number] = [144.9631, -37.8136];
const DEFAULT_ZOOM = 12;

// ── Marker HTML helpers ──────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function markerInnerHTML(member: Member, _latitude: number, _longitude: number, speed: number, course: number): string {
  const initials = member.name.slice(0, 2).toUpperCase();
  const colour = member.colour;
  const soft = hexToRgba(colour, 0.15);
  const isMoving = getMemberStatus(member) === 'moving';

  if (isMoving) {
    return `
      <div style="
        width:38px;height:38px;border-radius:50%;
        border:2.5px solid ${colour};background:#101010;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 12px rgba(0,0,0,0.5),0 0 0 3px ${soft};
        transform:rotate(${course}deg);
      ">
        <span style="
          font-size:13px;font-weight:700;color:${colour};font-family:Inter,sans-serif;
          transform:rotate(${-course}deg);display:block;
        ">${initials}</span>
      </div>
      <div style="
        margin-top:5px;font-size:10px;font-weight:600;color:${colour};
        background:rgba(8,8,8,0.88);padding:1px 7px;border-radius:4px;
        font-family:'DM Mono',monospace;white-space:nowrap;
        border:1px solid rgba(255,255,255,0.07);
      ">${Math.round(speed)} km/h</div>
    `;
  }

  return `
    <div style="
      position:relative;
      width:38px;height:38px;border-radius:50%;
      border:2.5px solid ${colour};background:#101010;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 12px rgba(0,0,0,0.5),0 0 0 3px ${soft};
    ">
      <span style="
        font-size:15px;font-weight:700;color:white;font-family:Inter,sans-serif;
      ">${initials}</span>
      <div style="
        position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:5px solid transparent;border-right:5px solid transparent;
        border-top:7px solid ${colour};
      "></div>
    </div>
  `;
}

// ── MapView ──────────────────────────────────────────────────────────────────

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markerMap = useRef<Map<number, maplibregl.Marker>>(new Map());

  const { positions, setSelectedFriendId } = useMapStore();
  const members = useFriendsStore((s) => s.members);

  // ── Initialise map ──
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: LIBERTY_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    mapInstance.current = map;

    map.on('load', () => setMapLoaded(true));

    // Click on map background → deselect
    map.on('click', () => setSelectedFriendId(null));

    // Keep canvas sized correctly on container resize
    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapInstance.current = null;
      setMapLoaded(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync markers ──
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;

    const activeMemberIds = new Set(members.map((m) => m.userId));

    // Remove stale markers
    for (const [userId, marker] of markerMap.current) {
      if (!activeMemberIds.has(userId)) {
        marker.remove();
        markerMap.current.delete(userId);
      }
    }

    for (const member of members) {
      const pos = positions[member.userId];
      const status = getMemberStatus(member);

      // Offline members without a known position → no marker
      if (status === 'offline' && !pos) {
        const existing = markerMap.current.get(member.userId);
        if (existing) { existing.remove(); markerMap.current.delete(member.userId); }
        continue;
      }

      if (!pos) continue;

      const existing = markerMap.current.get(member.userId);
      const html = markerInnerHTML(member, pos.latitude, pos.longitude, pos.speed, pos.course);

      if (existing) {
        existing.setLngLat([pos.longitude, pos.latitude]);
        existing.getElement().innerHTML = html;
      } else {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
        el.innerHTML = html;

        const userId = member.userId;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedFriendId(userId);
          map.flyTo({ center: [pos.longitude, pos.latitude], zoom: 15, duration: 1500 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pos.longitude, pos.latitude])
          .addTo(map);

        markerMap.current.set(userId, marker);
      }
    }
  }, [members, positions, mapLoaded, setSelectedFriendId]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

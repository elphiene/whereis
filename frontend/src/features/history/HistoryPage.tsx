import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { DatePresetChips, getDateRange, type DatePreset } from '@/shared/components/DatePresetChips';
import { useFriendsStore } from '@/features/friends/store';

const LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';

interface Trip {
  deviceId: number;
  startTime: string;
  endTime: string;
  distance: number;    // meters
  duration: number;    // ms
  averageSpeed: number;
  maxSpeed: number;
  startAddress: string | null;
  endAddress: string | null;
}

interface Position { latitude: number; longitude: number; fixTime: string }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function HistoryPage() {
  const navigate  = useNavigate();
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const members   = useFriendsStore((s) => s.members);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => members[0]?.userId ?? null);
  const [preset,   setPreset]   = useState<DatePreset>('yesterday');
  const [trips,    setTrips]    = useState<Trip[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: LIBERTY,
      center: [144.9631, -37.8136],
      zoom: 11,
      attributionControl: false,
    });
    mapInst.current = map;
    map.on('load', () => setMapReady(true));
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // Load trips when member or date changes
  useEffect(() => {
    if (!selectedMemberId) return;
    const member = members.find((m) => m.userId === selectedMemberId);
    if (!member) return;
    const { from, to } = getDateRange(preset);
    setLoading(true); setTrips([]); setActiveTrip(null);
    fetch(`/api/reports/trips?deviceId=${member.traccarDeviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMemberId, preset, members]);

  // Render route on trip click (lazy)
  async function handleTripClick(trip: Trip) {
    setActiveTrip(trip);
    const map = mapInst.current;
    if (!map || !mapReady) return;

    const member = members.find((m) => m.userId === selectedMemberId);
    if (!member) return;
    const colour = member.colour;

    const from = new Date(trip.startTime).toISOString();
    const to   = new Date(trip.endTime).toISOString();
    const res  = await fetch(`/api/reports/route?deviceId=${member.traccarDeviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: 'include' });
    if (!res.ok) return;
    const positions: Position[] = await res.json();
    const coords = positions.map((p) => [p.longitude, p.latitude] as [number, number]);
    if (coords.length === 0) return;

    // Remove previous route layers
    ['route-line', 'route-start', 'route-end'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    map.addSource('route-line', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} },
    });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route-line',
      paint: { 'line-color': colour, 'line-width': 3, 'line-opacity': 0.9 } });

    // Start pin
    map.addSource('route-start', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: {} } });
    map.addLayer({ id: 'route-start', type: 'circle', source: 'route-start',
      paint: { 'circle-radius': 7, 'circle-color': '#22c55e', 'circle-stroke-width': 2, 'circle-stroke-color': '#080808' } });

    // End pin
    const last = coords[coords.length - 1];
    map.addSource('route-end', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: last }, properties: {} } });
    map.addLayer({ id: 'route-end', type: 'circle', source: 'route-end',
      paint: { 'circle-radius': 7, 'circle-color': colour, 'circle-stroke-width': 2, 'circle-stroke-color': '#080808' } });

    // Fit bounds
    const bounds = coords.reduce(
      (b, c) => b.extend(c as maplibregl.LngLatLike),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 60, duration: 1000 });
  }

  const totalDist  = trips.reduce((s, t) => s + t.distance, 0) / 1000;
  const totalDur   = trips.reduce((s, t) => s + t.duration, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Sidebar */}
      <aside className="flex w-[280px] min-w-[280px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#111111]">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#888]">
            location history
          </p>
        </div>
        <div className="flex flex-col gap-2 border-b border-white/[0.07] px-4 py-3">
          <select
            value={selectedMemberId ?? ''}
            onChange={(e) => setSelectedMemberId(Number(e.target.value))}
            className="w-full rounded-lg border border-white/[0.12] bg-[#161616] px-3 py-2 text-sm text-white outline-none focus:border-[rgba(236,72,153,0.3)]"
          >
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
          <DatePresetChips value={preset} onChange={setPreset} />
        </div>

        {/* Trip list */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
          {loading && <p className="px-2 py-1 font-mono text-xs text-[#666]">Loading…</p>}
          {!loading && trips.length === 0 && <p className="px-2 py-1 font-mono text-xs text-[#666]">No trips found</p>}
          {trips.map((t, i) => {
            const isActive = activeTrip === t;
            return (
              <button key={i} onClick={() => handleTripClick(t)} type="button"
                className={`rounded-[8px] border px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? 'border-l-[3px] border-[rgba(255,255,255,0.12)] border-l-[#ec4899] bg-[rgba(236,72,153,0.12)]'
                    : 'border-white/[0.07] bg-[#161616] hover:bg-[#1a1a1a]'
                }`}>
                <div className="mb-1 font-mono text-[12px] font-medium text-[#a0a0a0]">
                  {fmtTime(t.startTime)} → {fmtTime(t.endTime)}
                </div>
                <div className="flex gap-2.5 text-[13px] font-semibold">
                  <span className="text-[#ec4899]">{(t.distance / 1000).toFixed(1)} km</span>
                  <span className="text-white">{fmtDuration(t.duration)}</span>
                  <span className="text-white">{Math.round(t.averageSpeed)} avg</span>
                </div>
                {(t.startAddress || t.endAddress) && (
                  <div className="mt-1 truncate font-mono text-[11px] text-[#666]">
                    {[t.startAddress, t.endAddress].filter(Boolean).join(' → ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        {trips.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2.5">
            <span className="font-mono text-xs text-[#a0a0a0]">{trips.length} trips</span>
            <span className="font-mono text-xs font-semibold text-[#ec4899]">{totalDist.toFixed(1)} km</span>
            <span className="font-mono text-xs text-[#a0a0a0]">{fmtDuration(totalDur)}</span>
          </div>
        )}
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Trip detail popup */}
        {activeTrip && (
          <div className="absolute left-4 top-4 z-10 min-w-[200px] rounded-[10px] border border-white/[0.12] bg-black/95 px-4 py-3 shadow-xl backdrop-blur-xl">
            <p className="mb-2.5 text-[13px] font-bold text-white">
              trip · {new Date(activeTrip.startTime).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            {[
              ['time',      `${fmtTime(activeTrip.startTime)} → ${fmtTime(activeTrip.endTime)}`],
              ['duration',  fmtDuration(activeTrip.duration)],
              ['distance',  `${(activeTrip.distance / 1000).toFixed(1)} km`],
              ['avg speed', `${Math.round(activeTrip.averageSpeed)} km/h`],
              ['max speed', `${Math.round(activeTrip.maxSpeed)} km/h`],
              ...(activeTrip.startAddress ? [['from', activeTrip.startAddress]] : []),
              ...(activeTrip.endAddress   ? [['to',   activeTrip.endAddress]]   : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-t border-white/[0.07] py-[5px]">
                <span className="font-mono text-xs text-[#a0a0a0]">{k}</span>
                <span className={`text-xs font-medium ${k === 'distance' ? 'text-[#ec4899]' : 'text-white'}`}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => navigate('/map')}
          className="absolute bottom-5 left-4 z-10 rounded-[9px] border border-white/[0.12] bg-black/90 px-3.5 py-2 font-mono text-xs text-[#a0a0a0] shadow-lg backdrop-blur-md hover:text-white">
          ← Back to live
        </button>
      </div>
    </div>
  );
}

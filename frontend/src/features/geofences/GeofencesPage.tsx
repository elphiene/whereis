import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { api } from '@/shared/lib/traccar';

const LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';

interface Geofence {
  id: number;
  name: string;
  area: string;
  description?: string;
}

interface DrawState {
  lat: number;
  lng: number;
  radius: number;
  name: string;
  alertType: 'enter' | 'exit' | 'both';
}

function parseCircle(area: string): { lat: number; lng: number; radius: number } | null {
  const m = area.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), radius: parseFloat(m[3]) };
}

function circleCoords(lat: number, lng: number, radiusM: number): [number, number][] {
  const pts = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * 2 * Math.PI;
    coords.push([
      lng + (radiusM * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)),
      lat + (radiusM * Math.sin(a)) / 111320,
    ]);
  }
  return coords;
}

function addGeofenceLayer(map: maplibregl.Map, gf: Geofence) {
  const circle = parseCircle(gf.area);
  if (!circle) return;
  const sourceId = `gf-${gf.id}`;
  const coords = circleCoords(circle.lat, circle.lng, circle.radius);
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { id: gf.id, name: gf.name } },
  });
  map.addLayer({ id: `${sourceId}-fill`, type: 'fill', source: sourceId,
    paint: { 'fill-color': '#ec4899', 'fill-opacity': 0.06 } });
  map.addLayer({ id: `${sourceId}-line`, type: 'line', source: sourceId,
    paint: { 'line-color': '#ec4899', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.4 } });
}

function removeGeofenceLayer(map: maplibregl.Map, gfId: number) {
  const sourceId = `gf-${gfId}`;
  [`${sourceId}-fill`, `${sourceId}-line`].forEach((l) => { if (map.getLayer(l)) map.removeLayer(l); });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function GeofencesPage() {
  const navigate = useNavigate();
  const mapRef   = useRef<HTMLDivElement>(null);
  const mapInst  = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [geofences,  setGeofences]  = useState<Geofence[]>([]);
  const [drawMode,   setDrawMode]   = useState(false);
  const [draw,       setDraw]       = useState<DrawState | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [editName,   setEditName]   = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: LIBERTY,
      center: [144.9631, -37.8136],
      zoom: 12,
      attributionControl: false,
    });
    mapInst.current = map;
    map.on('load', () => {
      setMapReady(true);
      // Load geofences after map is ready
    });
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // Load + render geofences on map ready
  useEffect(() => {
    if (!mapReady) return;
    api('/api/geofences')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Geofence[]) => {
        setGeofences(data);
        data.forEach((gf) => mapInst.current && addGeofenceLayer(mapInst.current, gf));
      })
      .catch(() => {});
  }, [mapReady]);

  // Map click in draw mode
  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    if (drawMode) {
      map.getCanvas().style.cursor = 'crosshair';
      const onClick = (e: maplibregl.MapMouseEvent) => {
        setDraw((prev) => ({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          radius: prev?.radius ?? 500,
          name: prev?.name ?? '',
          alertType: prev?.alertType ?? 'both',
        }));
      };
      map.on('click', onClick);
      return () => { map.off('click', onClick); map.getCanvas().style.cursor = ''; };
    } else {
      map.getCanvas().style.cursor = '';
    }
  }, [drawMode, mapReady]);

  // Preview circle while drawing
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !mapReady) return;
    ['preview-fill', 'preview-line'].forEach((l) => { if (map.getLayer(l)) map.removeLayer(l); });
    if (map.getSource('preview')) map.removeSource('preview');
    if (!draw) return;
    const coords = circleCoords(draw.lat, draw.lng, draw.radius);
    map.addSource('preview', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} },
    });
    map.addLayer({ id: 'preview-fill', type: 'fill', source: 'preview', paint: { 'fill-color': '#ec4899', 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'preview-line', type: 'line', source: 'preview', paint: { 'line-color': '#ec4899', 'line-width': 2, 'line-opacity': 0.7 } });
  }, [draw, mapReady]);

  async function saveGeofence() {
    if (!draw || !draw.name) return;
    setSaving(true); setError(null);
    const area = `CIRCLE (${draw.lat} ${draw.lng}, ${draw.radius})`;
    try {
      const res = await api('/api/geofences', {
        method: 'POST',
        body: JSON.stringify({ name: draw.name, area }),
      });
      if (!res.ok) { setError('Save failed.'); return; }
      const gf: Geofence = await res.json();
      // Add notification
      const alertTypes = draw.alertType === 'both' ? ['geofenceEnter', 'geofenceExit']
        : draw.alertType === 'enter' ? ['geofenceEnter'] : ['geofenceExit'];
      await Promise.all(alertTypes.map((type) =>
        api('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({ type, geofenceId: gf.id }),
        }),
      ));
      setGeofences((prev) => [...prev, gf]);
      mapInst.current && addGeofenceLayer(mapInst.current, gf);
      setDraw(null); setDrawMode(false);
      // Clear preview
      const map = mapInst.current;
      if (map) {
        ['preview-fill', 'preview-line'].forEach((l) => { if (map.getLayer(l)) map.removeLayer(l); });
        if (map.getSource('preview')) map.removeSource('preview');
      }
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function updateName(id: number) {
    const res = await api(`/api/geofences/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id, name: editName }),
    });
    if (res.ok) setGeofences((prev) => prev.map((g) => g.id === id ? { ...g, name: editName } : g));
    setEditId(null);
  }

  async function deleteGeofence(id: number) {
    const res = await api(`/api/geofences/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setGeofences((prev) => prev.filter((g) => g.id !== id));
      mapInst.current && removeGeofenceLayer(mapInst.current, id);
    }
    setConfirmDel(null);
  }

  function flyToGeofence(gf: Geofence) {
    const c = parseCircle(gf.area);
    if (!c || !mapInst.current) return;
    mapInst.current.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 1000 });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Sidebar */}
      <aside className="flex w-[280px] min-w-[280px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#111111]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#888]">Geofences</p>
          <button onClick={() => setDrawMode((v) => !v)}
            className={`rounded-[7px] border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              drawMode
                ? 'border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] text-[#ec4899]'
                : 'border-white/[0.07] text-[#a0a0a0] hover:text-white'
            }`}>
            {drawMode ? '✕ Cancel' : '+ Draw'}
          </button>
        </div>

        {/* Draw UI */}
        {drawMode && (
          <div className="flex flex-col gap-2.5 border-b border-white/[0.07] px-4 py-3">
            <p className="font-mono text-[11px] text-[#a0a0a0]">
              {draw ? 'Set radius and name, then save' : 'Click the map to place centre'}
            </p>
            {draw && (
              <>
                <div>
                  <label className="mb-1 block font-mono text-[10px] text-[#666]">Radius (m)</label>
                  <input type="range" min={50} max={5000} step={50} value={draw.radius}
                    onChange={(e) => setDraw((d) => d && ({ ...d, radius: Number(e.target.value) }))}
                    className="w-full accent-[#ec4899]" />
                  <div className="mt-1 flex gap-1.5">
                    <input type="number" min={50} max={10000} value={draw.radius}
                      onChange={(e) => setDraw((d) => d && ({ ...d, radius: Number(e.target.value) }))}
                      className="w-24 rounded border border-white/[0.12] bg-[#161616] px-2 py-1 font-mono text-[11px] text-white" />
                    <span className="self-center font-mono text-[11px] text-[#666]">m</span>
                  </div>
                </div>
                <input placeholder="Name (e.g. Home)" value={draw.name}
                  onChange={(e) => setDraw((d) => d && ({ ...d, name: e.target.value }))}
                  className="rounded-lg border border-white/[0.12] bg-[#161616] px-3 py-2 text-sm text-white placeholder:text-[#555] focus:border-[rgba(236,72,153,0.3)] outline-none" />
                <select value={draw.alertType}
                  onChange={(e) => setDraw((d) => d && ({ ...d, alertType: e.target.value as DrawState['alertType'] }))}
                  className="rounded-lg border border-white/[0.12] bg-[#161616] px-3 py-2 text-sm text-white outline-none focus:border-[rgba(236,72,153,0.3)]">
                  <option value="enter">Alert on Enter</option>
                  <option value="exit">Alert on Exit</option>
                  <option value="both">Alert on Enter & Exit</option>
                </select>
                {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}
                <button onClick={saveGeofence} disabled={saving || !draw.name}
                  className="rounded-lg bg-[#ec4899] py-2 font-mono text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Geofence'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Geofence list */}
        <div className="flex-1 overflow-y-auto p-2.5">
          {geofences.length === 0 && <p className="px-2 py-1 font-mono text-xs text-[#666]">No geofences yet</p>}
          {geofences.map((gf) => (
            <div key={gf.id}
              className="mb-1.5 flex items-center gap-2 rounded-[8px] border border-white/[0.07] bg-[#161616] px-3 py-2.5 hover:bg-[#1a1a1a]">
              {editId === gf.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => updateName(gf.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') updateName(gf.id); if (e.key === 'Escape') setEditId(null); }}
                  className="flex-1 border-b border-[rgba(236,72,153,0.5)] bg-transparent font-mono text-xs text-white outline-none" />
              ) : (
                <button onClick={() => flyToGeofence(gf)}
                  className="flex-1 text-left text-sm text-white hover:text-[#ec4899]">
                  {gf.name}
                </button>
              )}
              <button onClick={() => { setEditId(gf.id); setEditName(gf.name); }}
                className="font-mono text-[11px] text-[#666] hover:text-[#a0a0a0]">✎</button>
              <button onClick={() => setConfirmDel(gf.id)}
                className="font-mono text-[11px] text-[#666] hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />
        <button onClick={() => navigate('/map')}
          className="absolute bottom-5 left-4 z-10 rounded-[9px] border border-white/[0.12] bg-black/90 px-3.5 py-2 font-mono text-xs text-[#a0a0a0] shadow-lg backdrop-blur-md hover:text-white">
          ← Back to live
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDel != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="mx-4 w-full max-w-[300px] rounded-[14px] border border-white/[0.12] bg-[#101010] p-5">
            <p className="mb-3 text-sm font-bold text-white">Delete geofence?</p>
            <p className="mb-4 font-mono text-xs text-[#a0a0a0]">This also removes its alert notifications.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 rounded-[7px] border border-white/[0.12] py-2 font-mono text-xs text-[#a0a0a0] hover:text-white">
                Cancel
              </button>
              <button onClick={() => deleteGeofence(confirmDel)}
                className="flex-1 rounded-[7px] border border-red-500/30 bg-red-500/10 py-2 font-mono text-xs text-red-400 hover:bg-red-500/20">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

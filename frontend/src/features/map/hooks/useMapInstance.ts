import type maplibregl from 'maplibre-gl';

// Module-level singleton ref shared across map, history, and geofences features.
// Set by MapView on init; read by history and geofences layers.
// Do not create a second MapLibre instance anywhere — use this ref instead.
export const mapInstance: { current: maplibregl.Map | null } = { current: null };

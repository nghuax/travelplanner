// Vietnam map center and bounds
export const VIETNAM_CENTER: [number, number] = [16.047, 108.2022];

export const VIETNAM_BOUNDS: [[number, number], [number, number]] = [
  [8.4, 102.1],   // Southwest
  [23.4, 109.5],  // Northeast
];

// Colors for each day route (cycling) — earthy tones
export const DAY_COLORS = [
  '#C8C0A0', // warm cream
  '#A8B88C', // sage green
  '#D4A76A', // amber/gold
  '#8BA07A', // olive green
  '#B8A08C', // warm tan
  '#7C9A6C', // forest green
  '#C4A882', // sand
  '#6B8B5E', // deep sage
];

export function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

// Earth-toned Leaflet tile URL — using CartoDB Voyager with custom look
// Options: CartoDB dark_all, dark_nolabels, voyager, positron
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Decode a Google-compatible encoded polyline into lat/lng array
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export function formatDistance(km: number | null): string {
  if (!km) return '\u2014';
  return `${Math.round(km)}km`;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return '\u2014';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

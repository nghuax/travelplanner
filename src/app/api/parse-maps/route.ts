import { NextRequest, NextResponse } from 'next/server';

/**
 * Resolve short Google Maps URLs by following redirects.
 */
async function expandShortUrl(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    const isShort =
      parsed.hostname === 'maps.app.goo.gl' ||
      parsed.hostname === 'goo.gl' ||
      parsed.hostname === 'g.co';

    if (!isShort) return url;

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TravelPlannerBot/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.url && res.url !== url) return res.url;

    const html = await res.text();
    const metaRedirect = html.match(/<meta[^>]+content=["']\d+;\s*url=([^"']+)["']/i);
    if (metaRedirect) return metaRedirect[1];

    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    if (canonical) return canonical[1];

    return res.url || url;
  } catch (err) {
    console.error('[expandShortUrl]', err);
    return url;
  }
}

/**
 * Parse Google Maps URL formats to extract origin/destination names.
 */
function extractCitiesFromUrl(url: string): { origin: string; destination: string } | null {
  try {
    const parsed = new URL(url);

    if (parsed.pathname.includes('/dir/')) {
      const after = parsed.pathname.split('/dir/')[1];
      if (after) {
        const parts = after
          .split('/')
          .filter(Boolean)
          .map(p => decodeURIComponent(p.replace(/\+/g, ' ')))
          .filter(p => !p.startsWith('@') && !p.startsWith('data='));

        if (parts.length >= 2) {
          return { origin: parts[0], destination: parts[parts.length - 1] };
        }
        if (parts.length === 1) {
          const dest = parsed.searchParams.get('destination') || parsed.searchParams.get('daddr');
          if (dest) return { origin: parts[0], destination: dest };
        }
      }
    }

    const origin = parsed.searchParams.get('origin') || parsed.searchParams.get('saddr');
    const destination = parsed.searchParams.get('destination') || parsed.searchParams.get('daddr');
    if (origin && destination) return { origin, destination };

    const q = parsed.searchParams.get('q');
    if (q && q.includes(' to ')) {
      const [o, d] = q.split(' to ');
      return { origin: o.trim(), destination: d.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract embedded coordinates from Google Maps expanded URL.
 * Google Maps URLs contain !2d{lng}!2d{lat} or !2d{lng}!3d{lat} patterns.
 */
function extractCoordsFromUrl(url: string): { originLat: number; originLng: number; destLat: number; destLng: number } | null {
  try {
    // Google Maps embeds coordinates as !1d{lng}!2d{lat} pairs
    const coordPairs: { lat: number; lng: number }[] = [];

    // Match !1d{lng}!2d{lat} patterns
    const regex = /!1d(-?[\d.]+)!2d(-?[\d.]+)/g;
    let match;
    while ((match = regex.exec(url)) !== null) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        coordPairs.push({ lat, lng });
      }
    }

    if (coordPairs.length >= 2) {
      return {
        originLat: coordPairs[0].lat,
        originLng: coordPairs[0].lng,
        destLat: coordPairs[coordPairs.length - 1].lat,
        destLng: coordPairs[coordPairs.length - 1].lng,
      };
    }

    // Fallback: try @lat,lng pattern from the URL path
    const atMatch = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (atMatch) {
      // This is the map center, not specific endpoints — less useful, skip
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Extract waypoints from URL.
 */
function extractWaypoints(url: string): string[] {
  try {
    const parsed = new URL(url);
    const waypoints = parsed.searchParams.get('waypoints');
    if (waypoints) {
      return waypoints.split('|').map(w => w.replace('via:', '').trim()).filter(Boolean);
    }

    if (parsed.pathname.includes('/dir/')) {
      const after = parsed.pathname.split('/dir/')[1];
      if (after) {
        const parts = after
          .split('/')
          .filter(Boolean)
          .map(p => decodeURIComponent(p.replace(/\+/g, ' ')))
          .filter(p => !p.startsWith('@') && !p.startsWith('data='));

        if (parts.length > 2) return parts.slice(1, -1);
      }
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * Geocode a place name using Nominatim (OpenStreetMap). Fallback only.
 */
async function geocode(place: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(place)}&format=json&limit=1&addressdetails=1`,
      {
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
  } catch (err) {
    console.error('[geocode]', place, err);
  }
  return null;
}

/**
 * Get route from OSRM — completely free, no API key.
 */
async function getOSRMRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<{ distanceKm: number; durationMinutes: number; encodedPolyline: string } | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/` +
      `${originLng},${originLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson`,
      {
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
        signal: AbortSignal.timeout(10000),
      }
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      return {
        distanceKm: route.distance / 1000,
        durationMinutes: Math.round(route.duration / 60),
        encodedPolyline: encodePolyline(geometry),
      };
    }
  } catch (err) {
    console.error('[osrm]', err);
  }
  return null;
}

/**
 * Encode lat/lng array to Google-compatible polyline string.
 */
function encodePolyline(points: [number, number][]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const dLat = Math.round(lat * 1e5) - prevLat;
    const dLng = Math.round(lng * 1e5) - prevLng;
    prevLat += dLat;
    prevLng += dLng;
    encoded += encodeSignedNumber(dLat);
    encoded += encodeSignedNumber(dLng);
  }
  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  return encodeNumber(sgn);
}

function encodeNumber(num: number): string {
  let encoded = '';
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encoded += String.fromCharCode(num + 63);
  return encoded;
}

// ─── Main API handler ───

export async function POST(request: NextRequest) {
  try {
    const { url: rawUrl } = await request.json();
    if (!rawUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Step 1: Expand short URLs
    const url = await expandShortUrl(rawUrl.trim());

    // Step 2: Extract cities from URL
    const cities = extractCitiesFromUrl(url);
    if (!cities) {
      return NextResponse.json(
        { error: 'Could not parse origin/destination from this URL. Try pasting the full directions URL.' },
        { status: 422 }
      );
    }

    const { origin, destination } = cities;
    const waypoints = extractWaypoints(url);

    // Step 3: Try to extract coordinates directly from the expanded URL
    const embeddedCoords = extractCoordsFromUrl(url);

    let originLat = embeddedCoords?.originLat ?? null;
    let originLng = embeddedCoords?.originLng ?? null;
    let destLat = embeddedCoords?.destLat ?? null;
    let destLng = embeddedCoords?.destLng ?? null;
    let originName = origin;
    let destName = destination;

    // Step 4: If no embedded coords, fall back to Nominatim geocoding
    if (!originLat || !destLat) {
      const [originGeo, destGeo] = await Promise.all([
        geocode(origin),
        geocode(destination),
      ]);
      if (originGeo) {
        originLat = originGeo.lat;
        originLng = originGeo.lng;
        if (originGeo.displayName) originName = originGeo.displayName;
      }
      if (destGeo) {
        destLat = destGeo.lat;
        destLng = destGeo.lng;
        if (destGeo.displayName) destName = destGeo.displayName;
      }
    }

    // Step 5: Get OSRM route if we have coordinates
    let route = null;
    if (originLat && originLng && destLat && destLng) {
      route = await getOSRMRoute(originLat, originLng, destLat, destLng);
    }

    // Step 6: Geocode waypoints
    const waypointDetails = [];
    for (const wp of waypoints) {
      const geo = await geocode(wp);
      waypointDetails.push({
        name: wp,
        address: geo?.displayName || wp,
        lat: geo?.lat || null,
        lng: geo?.lng || null,
      });
    }

    return NextResponse.json({
      origin: originName,
      destination: destName,
      distanceKm: route?.distanceKm || null,
      durationMinutes: route?.durationMinutes || null,
      encodedPolyline: route?.encodedPolyline || null,
      originLat,
      originLng,
      destinationLat: destLat,
      destinationLng: destLng,
      waypoints: waypointDetails,
      expandedUrl: url,
    });
  } catch (err) {
    console.error('[parse-maps]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
 * Geocode a place name using Nominatim.
 */
async function geocode(place: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&addressdetails=1`,
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
 * Reverse geocode coordinates to get an address.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Extract place info from a Google Maps URL.
 */
function extractPlaceFromUrl(url: string): { name: string | null; lat: number | null; lng: number | null } {
  try {
    const parsed = new URL(url);

    // Format: /maps/place/PLACE_NAME/@lat,lng,...
    if (parsed.pathname.includes('/place/')) {
      const after = parsed.pathname.split('/place/')[1];
      if (after) {
        const parts = after.split('/').filter(Boolean);
        const rawName = parts[0];
        const name = rawName ? decodeURIComponent(rawName.replace(/\+/g, ' ')) : null;

        // Extract @lat,lng
        let lat: number | null = null;
        let lng: number | null = null;
        const atPart = parts.find(p => p.startsWith('@'));
        if (atPart) {
          const coords = atPart.substring(1).split(',');
          if (coords.length >= 2) {
            lat = parseFloat(coords[0]);
            lng = parseFloat(coords[1]);
            if (isNaN(lat) || isNaN(lng)) { lat = null; lng = null; }
          }
        }

        // Also try data params for more precise coords
        // !3d{lat}!4d{lng} pattern
        const lat3d = url.match(/!3d(-?[\d.]+)/);
        const lng4d = url.match(/!4d(-?[\d.]+)/);
        if (lat3d && lng4d) {
          const pLat = parseFloat(lat3d[1]);
          const pLng = parseFloat(lng4d[1]);
          if (!isNaN(pLat) && !isNaN(pLng) && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180) {
            lat = pLat;
            lng = pLng;
          }
        }

        return { name, lat, lng };
      }
    }

    // Format: /maps/@lat,lng,zoom
    const atMatch = parsed.pathname.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (atMatch) {
      return {
        name: null,
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
      };
    }

    // Query format: ?q=PLACE_NAME or ?q=lat,lng
    const q = parsed.searchParams.get('q');
    if (q) {
      const coordMatch = q.match(/^(-?[\d.]+),\s*(-?[\d.]+)$/);
      if (coordMatch) {
        return { name: null, lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
      }
      return { name: q, lat: null, lng: null };
    }

    // Search format: /maps/search/QUERY/
    if (parsed.pathname.includes('/search/')) {
      const after = parsed.pathname.split('/search/')[1];
      if (after) {
        const searchTerm = after.split('/')[0];
        return { name: decodeURIComponent(searchTerm.replace(/\+/g, ' ')), lat: null, lng: null };
      }
    }
  } catch {
    // ignore parse errors
  }

  return { name: null, lat: null, lng: null };
}

export async function POST(request: NextRequest) {
  try {
    const { url: rawUrl } = await request.json();
    if (!rawUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Step 1: Expand short URLs
    const url = await expandShortUrl(rawUrl.trim());

    // Step 2: Extract place info
    const place = extractPlaceFromUrl(url);

    let { name, lat, lng } = place;
    let address: string | null = null;

    // Step 3: If we have a name but no coords, geocode
    if (name && (!lat || !lng)) {
      const geo = await geocode(name);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        address = geo.displayName;
      }
    }

    // Step 4: If we have coords but no name, reverse geocode
    if (lat && lng && !name) {
      const revAddress = await reverseGeocode(lat, lng);
      if (revAddress) {
        // Use first part as name
        name = revAddress.split(',')[0].trim();
        address = revAddress;
      }
    }

    // Step 5: Get address if we have coords but no address yet
    if (lat && lng && !address) {
      address = await reverseGeocode(lat, lng);
    }

    // Clean up name — remove coordinates if they're the name
    if (name && /^-?[\d.]+,\s*-?[\d.]+$/.test(name)) {
      name = null;
    }

    if (!name && !lat) {
      return NextResponse.json(
        { error: 'Could not extract place information from this URL. Try a Google Maps place link.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      name: name || null,
      lat: lat || null,
      lng: lng || null,
      address: address || null,
      expandedUrl: url,
    });
  } catch (err) {
    console.error('[parse-place]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

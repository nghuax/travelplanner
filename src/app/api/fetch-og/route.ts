import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract a meta tag value by property or name.
 */
function extractMeta(html: string, property: string): string | null {
  // property="..." content="..."
  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  // content="..." property="..."
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  return html.match(r1)?.[1] || html.match(r2)?.[1] || null;
}

/**
 * Try to extract structured data (JSON-LD) from the page.
 */
function extractJsonLd(html: string): Record<string, unknown> | null {
  try {
    const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    // Could be an array
    if (Array.isArray(data)) {
      return data.find(d => d['@type'] === 'Hotel' || d['@type'] === 'LodgingBusiness' || d['@type'] === 'Product' || d['@type'] === 'Place') || data[0];
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Extract multiple images from the page.
 */
function extractImages(html: string): string[] {
  const images: string[] = [];

  // og:image
  const ogImg = extractMeta(html, 'og:image');
  if (ogImg) images.push(ogImg);

  // Additional og:image tags
  const ogImgRegex = /<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/gi;
  let match;
  while ((match = ogImgRegex.exec(html)) !== null) {
    if (!images.includes(match[1])) images.push(match[1]);
  }

  // twitter:image
  const twitterImg = extractMeta(html, 'twitter:image');
  if (twitterImg && !images.includes(twitterImg)) images.push(twitterImg);

  return images;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  try {
    // Use a realistic browser User-Agent for better results with booking sites
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 422 });

    const html = await res.text();

    // ── Extract OG / meta tags ──
    const title =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'twitter:title') ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null;

    const description =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'description') ||
      extractMeta(html, 'twitter:description') ||
      null;

    const siteName = extractMeta(html, 'og:site_name') || null;

    const images = extractImages(html);

    // ── Extract structured data (JSON-LD) ──
    const jsonLd = extractJsonLd(html);

    let address: string | null = null;
    let rating: string | null = null;
    let ratingCount: string | null = null;
    let priceRange: string | null = null;
    let checkIn: string | null = null;
    let checkOut: string | null = null;

    if (jsonLd) {
      // Address
      const addr = jsonLd.address as Record<string, string> | string | undefined;
      if (typeof addr === 'string') {
        address = addr;
      } else if (addr && typeof addr === 'object') {
        const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
        if (parts.length) address = parts.join(', ');
      }

      // Rating
      const agg = jsonLd.aggregateRating as Record<string, unknown> | undefined;
      if (agg) {
        rating = String(agg.ratingValue || '');
        ratingCount = String(agg.reviewCount || agg.ratingCount || '');
      }

      // Price
      if (jsonLd.priceRange) priceRange = String(jsonLd.priceRange);
      const offers = jsonLd.offers as Record<string, unknown> | undefined;
      if (!priceRange && offers) {
        const price = offers.price || offers.lowPrice;
        const currency = offers.priceCurrency || '';
        if (price) priceRange = `${currency} ${price}`.trim();
      }

      // Check-in/out
      if (jsonLd.checkinTime) checkIn = String(jsonLd.checkinTime);
      if (jsonLd.checkoutTime) checkOut = String(jsonLd.checkoutTime);

      // Additional images from JSON-LD
      if (jsonLd.image) {
        const ldImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
        for (const img of ldImages) {
          const src = typeof img === 'string' ? img : (img as Record<string, string>)?.url;
          if (src && !images.includes(src)) images.push(src);
        }
      }
    }

    // Clean up title — remove site name suffix
    let cleanTitle = title;
    if (cleanTitle && siteName) {
      cleanTitle = cleanTitle.replace(new RegExp(`\\s*[\\-|–—]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim();
    }
    // Generic cleanup
    if (cleanTitle) {
      cleanTitle = cleanTitle.replace(/\s*[-|–—]\s*(Booking\.com|Agoda|Hotels\.com|Expedia|Airbnb|Trip\.com|Trivago).*$/i, '').trim();
    }

    return NextResponse.json({
      title: cleanTitle || null,
      description: description?.substring(0, 300) || null,
      imageUrl: images[0] || null,
      images: images.slice(0, 5),
      siteName,
      address,
      rating: rating || null,
      ratingCount: ratingCount || null,
      priceRange: priceRange || null,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
    });
  } catch (err) {
    console.error('[fetch-og]', err);
    return NextResponse.json({ error: 'Failed to fetch OG data' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; TravelPlannerBot/1.0; +https://github.com/nghuax/travelplanner)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 422 });

    const html = await res.text();

    // Extract og:image
    const imgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    // Extract og:title
    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      html.match(/<title>([^<]+)<\/title>/i);

    return NextResponse.json({
      imageUrl: imgMatch?.[1] ?? null,
      title:    titleMatch?.[1]?.trim() ?? null,
    });
  } catch (err) {
    console.error('[fetch-og]', err);
    return NextResponse.json({ error: 'Failed to fetch OG data' }, { status: 500 });
  }
}

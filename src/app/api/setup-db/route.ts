import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SCHEMA_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  `CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS public.trip_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    date DATE,
    origin_city TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    duration_minutes INTEGER,
    google_maps_url TEXT,
    route_polyline TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_day_per_trip UNIQUE (trip_id, day_number)
  )`,

  `CREATE TABLE IF NOT EXISTS public.stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_day_id UUID NOT NULL REFERENCES public.trip_days(id) ON DELETE CASCADE,
    name TEXT,
    booking_url TEXT,
    image_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Migration: add new columns to stays (idempotent)
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS category TEXT`,
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS address TEXT`,
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS google_maps_url TEXT`,
  `ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS sort_order INTEGER`,

  `ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='Allow all trips') THEN
      CREATE POLICY "Allow all trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trip_days' AND policyname='Allow all trip_days') THEN
      CREATE POLICY "Allow all trip_days" ON public.trip_days FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stays' AND policyname='Allow all stays') THEN
      CREATE POLICY "Allow all stays" ON public.stays FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  `CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql`,

  `DO $$ BEGIN
    DROP TRIGGER IF EXISTS trips_updated_at ON public.trips;
    CREATE TRIGGER trips_updated_at
      BEFORE UPDATE ON public.trips
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END $$`,
];

async function execSQL(serviceKey: string, query: string) {
  // Try the Management API
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query }),
  });
  return res;
}

async function execSQLDirect(serviceKey: string, query: string) {
  // Try via the PostgREST RPC with a raw query wrapper
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sql: query }),
  });
  return res;
}

export async function POST(request: NextRequest) {
  try {
    const { serviceKey } = await request.json();
    if (!serviceKey) return NextResponse.json({ error: 'Service key required' }, { status: 400 });

    const errors: string[] = [];
    let successCount = 0;
    let method = 'management';

    // Try Management API first
    const testRes = await execSQL(serviceKey, 'SELECT 1 as test');
    if (!testRes.ok) {
      const body = await testRes.text();
      return NextResponse.json(
        { error: `Auth failed (${testRes.status}): ${body.slice(0, 200)}. Make sure you're using the Service Role key (sb_secret_... or the JWT from Settings > API > Secret).` },
        { status: 401 }
      );
    }

    // Run each statement
    for (const stmt of SCHEMA_STATEMENTS) {
      const res = await execSQL(serviceKey, stmt);
      if (res.ok) {
        successCount++;
      } else {
        const body = await res.text();
        // Ignore "already exists" type errors
        if (!body.includes('already exists') && !body.includes('duplicate')) {
          errors.push(`Statement failed: ${body.slice(0, 150)}`);
        } else {
          successCount++;
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('\n'), successCount, method });
    }

    return NextResponse.json({ ok: true, successCount, method });
  } catch (err) {
    console.error('[setup-db]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

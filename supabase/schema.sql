-- ===========================
-- Travel Planner Schema
-- Run this in Supabase SQL Editor
-- ===========================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trips
CREATE TABLE IF NOT EXISTS public.trips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  cover_image_url TEXT,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Days
CREATE TABLE IF NOT EXISTS public.trip_days (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number        INTEGER NOT NULL,
  date              DATE,
  origin_city       TEXT NOT NULL,
  destination_city  TEXT NOT NULL,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  destination_lat   DOUBLE PRECISION,
  destination_lng   DOUBLE PRECISION,
  distance_km       DOUBLE PRECISION,
  duration_minutes  INTEGER,
  google_maps_url   TEXT,
  route_polyline    TEXT,
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_day_per_trip UNIQUE (trip_id, day_number)
);

-- Stays (Accommodation per day)
CREATE TABLE IF NOT EXISTS public.stays (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_day_id   UUID NOT NULL REFERENCES public.trip_days(id) ON DELETE CASCADE,
  name          TEXT,
  booking_url   TEXT,
  image_url     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (open policies — add auth later)
ALTER TABLE public.trips    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stays    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all trips"     ON public.trips     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all trip_days" ON public.trip_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stays"     ON public.stays     FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

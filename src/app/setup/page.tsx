'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Copy, ExternalLink, Database, Key, Loader2 } from 'lucide-react';

const SCHEMA_SQL = `-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/iqdsnxlnsatpvvzyrpem/sql/new

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS public.stays (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_day_id   UUID NOT NULL REFERENCES public.trip_days(id) ON DELETE CASCADE,
  name          TEXT,
  booking_url   TEXT,
  image_url     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trips    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stays    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'Allow all trips') THEN
    CREATE POLICY "Allow all trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_days' AND policyname = 'Allow all trip_days') THEN
    CREATE POLICY "Allow all trip_days" ON public.trip_days FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stays' AND policyname = 'Allow all stays') THEN
    CREATE POLICY "Allow all stays" ON public.stays FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_updated_at ON public.trips;
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();`;

type StepStatus = 'idle' | 'loading' | 'ok' | 'error';

export default function SetupPage() {
  const [serviceKey, setServiceKey]   = useState('');
  const [status, setStatus]           = useState<StepStatus>('idle');
  const [message, setMessage]         = useState('');
  const [copied, setCopied]           = useState(false);

  async function runSetup() {
    if (!serviceKey.trim()) { setMessage('Paste your service role key first.'); setStatus('error'); return; }
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/setup-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceKey: serviceKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus('error');
        setMessage(data.error || 'Setup failed');
      } else {
        setStatus('ok');
        setMessage('All tables created successfully!');
      }
    } catch (e) {
      setStatus('error');
      setMessage(String(e));
    }
  }

  function copySQL() {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
            <Database className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Database Setup</h1>
          <p className="text-slate-400 text-sm">Create the required Supabase tables for TravelPlanner.</p>
        </div>

        {/* Option 1: Auto setup */}
        <div className="rounded-2xl border border-navy-700 bg-navy-800 p-5 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-400" />
            Option A — Auto setup with service role key
          </h2>
          <p className="text-sm text-slate-400">
            Get it from{' '}
            <a
              href="https://supabase.com/dashboard/project/iqdsnxlnsatpvvzyrpem/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
            >
              Supabase → Settings → API <ExternalLink className="w-3 h-3" />
            </a>{' '}
            under <strong className="text-white">Secret key</strong>.
          </p>
          <input
            type="password"
            value={serviceKey}
            onChange={e => setServiceKey(e.target.value)}
            placeholder="sb_secret_... or eyJ..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-white placeholder-slate-500 text-sm focus:border-sky-500 transition-colors font-mono"
          />
          <button
            onClick={runSetup}
            disabled={status === 'loading'}
            className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Initialize Database
          </button>

          {status === 'ok' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {message}
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {message}
            </div>
          )}
        </div>

        {/* Option 2: Manual */}
        <div className="rounded-2xl border border-navy-700 bg-navy-800 p-5 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-gold-400" />
            Option B — Paste SQL manually
          </h2>
          <p className="text-sm text-slate-400">
            Copy the SQL below and run it in the{' '}
            <a
              href="https://supabase.com/dashboard/project/iqdsnxlnsatpvvzyrpem/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
            >
              Supabase SQL Editor <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
          <div className="relative">
            <pre className="bg-navy-900 rounded-xl p-4 text-xs text-slate-300 overflow-auto max-h-64 border border-navy-700 font-mono leading-relaxed">
              {SCHEMA_SQL}
            </pre>
            <button
              onClick={copySQL}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-800 border border-navy-600 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* After setup */}
        {status === 'ok' && (
          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors"
            >
              Go to App →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

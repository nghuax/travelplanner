'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Route, Link2, MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { TripDay, Stay } from '@/types';

interface EditDayModalProps {
  day: TripDay & { stays?: Stay[] };
  tripStartDate: string | null;
  onClose: () => void;
  onSuccess: (day: TripDay & { stays: Stay[] }) => void;
}

interface RouteResult {
  origin: string;
  destination: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  encodedPolyline: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  waypoints?: { name: string; address: string; lat: number; lng: number }[];
  expandedUrl?: string;
}

export function EditDayModal({ day, tripStartDate, onClose, onSuccess }: EditDayModalProps) {
  const supabase = createClient();

  const [originCity, setOriginCity]     = useState(day.origin_city);
  const [destinationCity, setDestCity]  = useState(day.destination_city);
  const [mapsUrl, setMapsUrl]           = useState(day.google_maps_url || '');
  const [routeResult, setRouteResult]   = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError]     = useState('');
  const [autoFilled, setAutoFilled]     = useState(false);

  const [date, setDate]                 = useState(day.date || '');
  const [description, setDesc]          = useState(day.description || '');

  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUrlRef = useRef(day.google_maps_url || '');

  // Re-parse Google Maps URL only if it changes from the original
  useEffect(() => {
    if (!mapsUrl.trim() || mapsUrl.trim() === initialUrlRef.current) {
      setRouteResult(null);
      setRouteError('');
      setAutoFilled(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setRouteLoading(true);
      setRouteError('');
      setAutoFilled(false);
      try {
        const res = await fetch('/api/parse-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mapsUrl.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setRouteError(data.error || 'Could not parse route');
          setRouteResult(null);
        } else {
          setRouteResult(data);
          if (data.origin) setOriginCity(data.origin);
          if (data.destination) setDestCity(data.destination);
          setAutoFilled(true);
        }
      } catch {
        setRouteError('Failed to fetch route info');
      } finally {
        setRouteLoading(false);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!originCity.trim() || !destinationCity.trim()) {
      setError('Origin and destination are required');
      return;
    }
    setError('');
    setLoading(true);

    const updates: Record<string, unknown> = {
      origin_city:      originCity.trim(),
      destination_city: destinationCity.trim(),
      date:             date || null,
      description:      description.trim() || null,
      google_maps_url:  mapsUrl.trim() || null,
    };

    // If route was re-parsed, include new route data
    if (routeResult) {
      updates.distance_km      = routeResult.distanceKm;
      updates.duration_minutes = routeResult.durationMinutes;
      updates.route_polyline   = routeResult.encodedPolyline;
      updates.origin_lat       = routeResult.originLat;
      updates.origin_lng       = routeResult.originLng;
      updates.destination_lat  = routeResult.destinationLat;
      updates.destination_lng  = routeResult.destinationLng;
    }

    const { data: dayData, error: dayErr } = await supabase
      .from('trip_days')
      .update(updates)
      .eq('id', day.id)
      .select()
      .single();

    if (dayErr || !dayData) {
      setError(dayErr?.message || 'Failed to update day');
      setLoading(false);
      return;
    }

    // If route re-parsed with new waypoints, add them as rest stops
    if (routeResult?.waypoints && routeResult.waypoints.length > 0) {
      const staysToInsert = routeResult.waypoints.map(wp => ({
        trip_day_id: day.id,
        name:        wp.name || wp.address,
        booking_url: null,
        image_url:   null,
        notes:       `Rest stop — ${wp.address}`,
      }));
      await supabase.from('stays').insert(staysToInsert);
    }

    // Fetch updated stays
    const { data: staysData } = await supabase
      .from('stays')
      .select('*')
      .eq('trip_day_id', day.id);

    setLoading(false);
    onSuccess({ ...dayData, stays: (staysData || []) as Stay[] } as TripDay & { stays: Stay[] });
    onClose();
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-olive-800 border text-cream-200 placeholder-cream-600 text-sm transition-colors";
  const inputStyle = { borderColor: 'rgba(200, 195, 175, 0.2)' };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Edit Day {day.day_number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="edit-day-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Google Maps Link */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> Google Maps Link
              </h3>
              <div className="relative">
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={e => setMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... or full Google Maps URL"
                  className={`${inputClass} pr-10`}
                  style={{
                    borderColor: autoFilled ? 'rgba(139, 154, 110, 0.6)' : 'rgba(200, 195, 175, 0.2)',
                  }}
                />
                {routeLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400 animate-spin" />
                )}
                {autoFilled && !routeLoading && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                )}
              </div>
              {routeError && <p className="text-red-300 text-xs">{routeError}</p>}

              {autoFilled && routeResult && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(139, 154, 110, 0.2)', border: '1px solid rgba(139, 154, 110, 0.3)' }}>
                  <div className="flex items-center gap-2 text-cream-200 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-cream-400 flex-shrink-0" />
                    <span className="truncate">{routeResult.origin}</span>
                    <ArrowRight className="w-4 h-4 text-cream-500 flex-shrink-0" />
                    <span className="truncate">{routeResult.destination}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {routeResult.distanceKm != null && (
                      <span className="rest-stop-badge">
                        <Route className="w-3.5 h-3.5" /> {Math.round(routeResult.distanceKm)} km
                      </span>
                    )}
                    {routeResult.durationMinutes != null && (
                      <span className="rest-stop-badge">
                        {Math.floor(routeResult.durationMinutes / 60)}h {routeResult.durationMinutes % 60}min
                      </span>
                    )}
                  </div>
                  <p className="text-cream-600 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" /> Route updated from new link
                  </p>
                </div>
              )}
            </div>

            {/* Route fields */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500 flex items-center gap-2">
                <Route className="w-3.5 h-3.5" /> Route
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream-400 mb-1">From <span className="text-red-300">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500" />
                    <input type="text" value={originCity} onChange={e => setOriginCity(e.target.value)} placeholder="Ho Chi Minh City" className={`${inputClass} pl-9`} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-cream-400 mb-1">To <span className="text-red-300">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500" />
                    <input type="text" value={destinationCity} onChange={e => setDestCity(e.target.value)} placeholder="Nha Trang" className={`${inputClass} pl-9`} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* Date & Notes */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500">Details</h3>
              <div>
                <label className="block text-xs text-cream-400 mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputClass} [color-scheme:dark]`} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs text-cream-400 mb-1">Notes</label>
                <textarea value={description} onChange={e => setDesc(e.target.value)} placeholder="Plan for this day..." rows={2} className={`${inputClass} resize-none`} style={inputStyle} />
              </div>
            </div>

            {error && (
              <p className="text-red-300 text-sm bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border text-cream-400 hover:text-cream-200 transition-colors text-sm font-medium" style={{ borderColor: 'rgba(200, 195, 175, 0.25)' }}>
            Cancel
          </button>
          <button type="submit" form="edit-day-form" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl text-olive-900 font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: '#c5bca3' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

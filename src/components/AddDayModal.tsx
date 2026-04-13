'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Route, Link2, MapPin, Hotel, ChevronDown, ChevronUp, CheckCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { TripDay, Stay } from '@/types';

interface AddDayModalProps {
  tripId: string;
  nextDayNumber: number;
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

export function AddDayModal({ tripId, nextDayNumber, tripStartDate, onClose, onSuccess }: AddDayModalProps) {
  const supabase = createClient();

  const [originCity, setOriginCity]           = useState('');
  const [destinationCity, setDestCity]        = useState('');
  const [mapsUrl, setMapsUrl]                 = useState('');
  const [routeResult, setRouteResult]         = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading]       = useState(false);
  const [routeError, setRouteError]           = useState('');
  const [autoFilled, setAutoFilled]           = useState(false);

  const [date, setDate]                       = useState('');
  const [description, setDesc]               = useState('');

  const [showStay, setShowStay]               = useState(true);
  const [stayName, setStayName]               = useState('');
  const [stayUrl, setStayUrl]                 = useState('');
  const [stayImage, setStayImage]             = useState('');
  const [stayNotes, setStayNotes]             = useState('');
  const [ogLoading, setOgLoading]             = useState(false);

  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-parse Google Maps URL (including short links)
  useEffect(() => {
    if (!mapsUrl.trim()) { setRouteResult(null); setRouteError(''); setAutoFilled(false); return; }

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
          // Auto-fill city names from parsed URL
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

  // Auto-fetch OG image from booking URL
  useEffect(() => {
    if (!stayUrl.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setOgLoading(true);
      try {
        const res = await fetch(`/api/fetch-og?url=${encodeURIComponent(stayUrl)}`);
        const data = await res.json();
        if (data.imageUrl) setStayImage(data.imageUrl);
        if (data.title && !stayName) setStayName(data.title.replace(/\s*[-|].*$/, '').trim());
      } catch {
        // silently fail
      } finally {
        setOgLoading(false);
      }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!originCity.trim() || !destinationCity.trim()) {
      setError('Origin and destination are required');
      return;
    }
    setError('');
    setLoading(true);

    const dayPayload = {
      trip_id:          tripId,
      day_number:       nextDayNumber,
      date:             date || null,
      origin_city:      originCity.trim(),
      destination_city: destinationCity.trim(),
      google_maps_url:  mapsUrl.trim() || null,
      description:      description.trim() || null,
      ...(routeResult ? {
        distance_km:       routeResult.distanceKm,
        duration_minutes:  routeResult.durationMinutes,
        route_polyline:    routeResult.encodedPolyline,
        origin_lat:        routeResult.originLat,
        origin_lng:        routeResult.originLng,
        destination_lat:   routeResult.destinationLat,
        destination_lng:   routeResult.destinationLng,
      } : {}),
    };

    const { data: dayData, error: dayErr } = await supabase
      .from('trip_days')
      .insert(dayPayload)
      .select()
      .single();

    if (dayErr || !dayData) {
      setError(dayErr?.message || 'Failed to create day');
      setLoading(false);
      return;
    }

    // Insert stays — both from accommodation form and from waypoints (as rest stops)
    const staysToInsert: { trip_day_id: string; name: string | null; booking_url: string | null; image_url: string | null; notes: string | null }[] = [];

    // Waypoints as rest stops
    if (routeResult?.waypoints && routeResult.waypoints.length > 0) {
      for (const wp of routeResult.waypoints) {
        staysToInsert.push({
          trip_day_id: dayData.id,
          name:        wp.name || wp.address,
          booking_url: null,
          image_url:   null,
          notes:       `Rest stop — ${wp.address}`,
        });
      }
    }

    // User-specified accommodation
    if (showStay && (stayName.trim() || stayUrl.trim())) {
      staysToInsert.push({
        trip_day_id: dayData.id,
        name:        stayName.trim() || null,
        booking_url: stayUrl.trim()  || null,
        image_url:   stayImage       || null,
        notes:       stayNotes.trim() || null,
      });
    }

    let stays: Stay[] = [];
    if (staysToInsert.length > 0) {
      const { data: stayData } = await supabase
        .from('stays')
        .insert(staysToInsert)
        .select();
      if (stayData) stays = stayData as Stay[];
    }

    setLoading(false);
    onSuccess({ ...dayData, stays } as TripDay & { stays: Stay[] });
    onClose();
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-olive-800 border text-cream-200 placeholder-cream-600 text-sm transition-colors";
  const inputStyle = { borderColor: 'rgba(200, 195, 175, 0.2)' };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Add Day {nextDayNumber}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="add-day-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* ── Google Maps Link (PRIMARY input) ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> Paste Google Maps Link
              </h3>
              <p className="text-cream-600 text-xs -mt-1">
                Paste any Google Maps link (including short links like maps.app.goo.gl/...) to auto-fill everything.
              </p>
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

              {/* Auto-filled route summary */}
              {autoFilled && routeResult && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(139, 154, 110, 0.2)', border: '1px solid rgba(139, 154, 110, 0.3)' }}>
                  {/* Origin → Destination */}
                  <div className="flex items-center gap-2 text-cream-200 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-cream-400 flex-shrink-0" />
                    <span className="truncate">{routeResult.origin}</span>
                    <ArrowRight className="w-4 h-4 text-cream-500 flex-shrink-0" />
                    <span className="truncate">{routeResult.destination}</span>
                  </div>

                  {/* Distance & Duration badges */}
                  <div className="flex flex-wrap gap-2">
                    {routeResult.distanceKm != null && (
                      <span className="rest-stop-badge">
                        <Route className="w-3.5 h-3.5" />
                        {Math.round(routeResult.distanceKm)} km
                      </span>
                    )}
                    {routeResult.durationMinutes != null && (
                      <span className="rest-stop-badge">
                        {Math.floor(routeResult.durationMinutes / 60)}h {routeResult.durationMinutes % 60}min
                      </span>
                    )}
                  </div>

                  {/* Waypoints / Rest stops */}
                  {routeResult.waypoints && routeResult.waypoints.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-cream-500 text-xs uppercase tracking-wide-custom">Rest stops detected:</p>
                      {routeResult.waypoints.map((wp, i) => (
                        <div key={i} className="flex items-center gap-2 text-cream-300 text-xs">
                          <span className="text-amber-400">&#x1F4CD;</span>
                          {wp.name || wp.address}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-cream-600 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Route auto-filled from Google Maps
                  </p>
                </div>
              )}
            </div>

            {/* ── Route section (manual override) ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500 flex items-center gap-2">
                <Route className="w-3.5 h-3.5" /> Route {autoFilled && <span className="text-cream-600 normal-case tracking-normal">(auto-filled, edit if needed)</span>}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream-400 mb-1">From <span className="text-red-300">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500" />
                    <input
                      type="text"
                      value={originCity}
                      onChange={e => setOriginCity(e.target.value)}
                      placeholder="Ho Chi Minh City"
                      className={`${inputClass} pl-9`}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-cream-400 mb-1">To <span className="text-red-300">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500" />
                    <input
                      type="text"
                      value={destinationCity}
                      onChange={e => setDestCity(e.target.value)}
                      placeholder="Nha Trang"
                      className={`${inputClass} pl-9`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Date & Notes ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide-custom text-cream-500">Details</h3>
              <div>
                <label className="block text-xs text-cream-400 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs text-cream-400 mb-1">Notes</label>
                <textarea
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Plan for this day..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* ── Stay section (collapsible) ── */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}>
              <button
                type="button"
                onClick={() => setShowStay(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(200,195,175,0.08)] transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-cream-300">
                  <Hotel className="w-4 h-4 text-cream-500" /> Accommodation (optional)
                </span>
                {showStay ? <ChevronUp className="w-4 h-4 text-cream-500" /> : <ChevronDown className="w-4 h-4 text-cream-500" />}
              </button>

              {showStay && (
                <div className="px-4 pb-4 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
                  <div>
                    <label className="block text-xs text-cream-400 mb-1">Stay Name</label>
                    <input
                      type="text"
                      value={stayName}
                      onChange={e => setStayName(e.target.value)}
                      placeholder="Hotel / Airbnb / Hostel name"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-400 mb-1 flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5" />
                      Booking Link
                      <span className="text-cream-600 font-normal">(Booking.com, Airbnb, etc.)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={stayUrl}
                        onChange={e => setStayUrl(e.target.value)}
                        placeholder="https://booking.com/..."
                        className={`${inputClass} pr-10`}
                        style={inputStyle}
                      />
                      {ogLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400 animate-spin" />
                      )}
                    </div>
                    {stayImage && (
                      <div className="mt-2 relative h-20 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={stayImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-400 mb-1">Notes</label>
                    <textarea
                      value={stayNotes}
                      onChange={e => setStayNotes(e.target.value)}
                      placeholder="Check-in time, special notes..."
                      rows={2}
                      className={`${inputClass} resize-none`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-300 text-sm bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border text-cream-400 hover:text-cream-200 transition-colors text-sm font-medium"
            style={{ borderColor: 'rgba(200, 195, 175, 0.25)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-day-form"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-olive-900 font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#c5bca3' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Add Day
          </button>
        </div>
      </div>
    </div>
  );
}

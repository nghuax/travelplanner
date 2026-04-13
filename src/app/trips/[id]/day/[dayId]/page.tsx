'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import lazyLoad from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { NavBar } from '@/components/NavBar';
import { createClient } from '@/utils/supabase/client';
import { TripDay, Stay, Trip } from '@/types';
import { formatDistance } from '@/lib/maps';
import { ArrowLeft, Trash2, Loader2, X, MapPin, Bed } from 'lucide-react';

const DayMapView = lazyLoad(
  () => import('@/components/DayMapView').then(m => ({ default: m.DayMapView })),
  { ssr: false, loading: () => <div className="w-full h-full bg-olive-700 flex items-center justify-center"><div className="w-8 h-8 border-2 border-cream-400/30 border-t-cream-400 rounded-full animate-spin" /></div> }
);

export default function DayDetailPage() {
  const { id, dayId } = useParams<{ id: string; dayId: string }>();
  const supabase = createClient();

  const [day, setDay]       = useState<TripDay | null>(null);
  const [stays, setStays]   = useState<Stay[]>([]);
  const [trip, setTrip]     = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showRestStopModal, setShowRestStopModal] = useState(false);
  const [showAccomModal, setShowAccomModal]       = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: dayData }, { data: tripData }] = await Promise.all([
      supabase.from('trip_days').select('*, stays(*)').eq('id', dayId).single(),
      supabase.from('trips').select('name, start_date').eq('id', id).single(),
    ]);

    if (dayData) {
      const { stays: s, ...d } = dayData as TripDay & { stays: Stay[] };
      setDay(d);
      setStays(s || []);
    }
    if (tripData) setTrip(tripData as Trip);
    setLoading(false);
  }, [dayId, id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDeleteStay(stayId: string) {
    await supabase.from('stays').delete().eq('id', stayId);
    setStays(prev => prev.filter(s => s.id !== stayId));
  }

  function handleStayAdded(stay: Stay) {
    setStays(prev => [...prev, stay]);
  }

  // Separate rest stops from accommodation
  const restStops = stays.filter(s => !s.booking_url && !s.image_url);
  const accommodations = stays.filter(s => s.booking_url || s.image_url);

  if (loading) {
    return (
      <div className="min-h-screen bg-olive-600 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cream-400 animate-spin" />
      </div>
    );
  }

  if (!day) {
    return (
      <div className="min-h-screen bg-olive-600 flex flex-col items-center justify-center gap-4">
        <p className="text-cream-400">Day not found.</p>
        <Link href={`/trips/${id}`} className="text-cream-300 hover:underline text-sm">&larr; Back to trip</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-olive-600 flex flex-col">
      <NavBar tripName={trip?.name || 'Trip'} />

      {/* Main: map + sidebar */}
      <div className="flex flex-1 overflow-hidden px-4 gap-4" style={{ height: 'calc(100vh - 68px)' }}>
        {/* Map */}
        <div className="flex-1 relative map-container">
          <DayMapView day={day} />
        </div>

        {/* Sidebar */}
        <aside className="w-[420px] xl:w-[460px] flex-shrink-0 overflow-y-auto pb-4">
          <div className="glass-card-strong p-6 space-y-6">
            {/* Back link */}
            <Link
              href={`/trips/${id}`}
              className="inline-flex items-center gap-2 text-cream-400 hover:text-cream-200 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to trip
            </Link>

            {/* Day heading */}
            <div className="text-center">
              <h1 className="font-serif text-4xl font-semibold text-cream-100 mb-2">
                Day {day.day_number}
              </h1>
              <p className="text-cream-200 text-sm font-medium">
                {day.origin_city} &rarr; {day.destination_city}
              </p>
              {day.distance_km != null && day.distance_km > 0 && (
                <p className="text-cream-400 text-sm">
                  Total Distance ~ {formatDistance(day.distance_km)}
                </p>
              )}
            </div>

            {/* Description */}
            {day.description && (
              <p className="text-cream-300 text-sm leading-relaxed text-center italic px-4">
                {day.description}
              </p>
            )}

            {/* Rest Stops */}
            <div>
              <h3 className="text-cream-500 text-xs font-medium uppercase tracking-wide-custom mb-3">
                Rest Stops
              </h3>
              {restStops.length > 0 ? (
                <div className="space-y-2">
                  {restStops.map(stay => (
                    <div
                      key={stay.id}
                      className="flex items-center justify-between rounded-lg px-4 py-2.5"
                      style={{ background: 'rgba(139, 154, 110, 0.25)', border: '1px solid rgba(139, 154, 110, 0.35)' }}
                    >
                      <span className="flex items-center gap-2 text-cream-200 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        {stay.name || 'Rest Stop'}
                      </span>
                      <button
                        onClick={() => handleDeleteStay(stay.id)}
                        className="text-cream-600/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-cream-500 text-sm">No rest stops added.</p>
              )}
              <button
                onClick={() => setShowRestStopModal(true)}
                className="text-cream-400 text-sm mt-2 hover:text-cream-200 transition-colors"
              >
                + Add rest stop
              </button>
            </div>

            {/* Accommodation */}
            <div>
              <h3 className="text-cream-500 text-xs font-medium uppercase tracking-wide-custom mb-3">
                Accommodation
              </h3>
              {accommodations.length > 0 && (
                <div className="space-y-3">
                  {accommodations.map(stay => (
                    <AccommodationCard key={stay.id} stay={stay} onDelete={handleDeleteStay} />
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowAccomModal(true)}
                className="dashed-button py-4 w-full flex items-center justify-center gap-2 mt-3"
              >
                <span className="text-cream-400 text-lg font-light">+</span>
                <span className="text-cream-400 text-sm">Add Accommodation</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Settings footer */}
      <div className="px-8 py-3 flex justify-end">
        <button className="text-cream-200/60 hover:text-cream-200/80 text-xs uppercase tracking-wide-custom transition-colors">
          Settings
        </button>
      </div>

      {/* Rest Stop Modal */}
      {showRestStopModal && (
        <AddRestStopModal
          dayId={dayId}
          onClose={() => setShowRestStopModal(false)}
          onSuccess={handleStayAdded}
        />
      )}

      {/* Accommodation Modal */}
      {showAccomModal && (
        <AddAccommodationModal
          dayId={dayId}
          onClose={() => setShowAccomModal(false)}
          onSuccess={handleStayAdded}
        />
      )}
    </div>
  );
}

// ─── Accommodation Card ───

function AccommodationCard({ stay, onDelete }: { stay: Stay; onDelete: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden group relative">
      {stay.image_url && !imgError ? (
        <div className="relative h-44">
          <Image
            src={stay.image_url}
            alt={stay.name || 'Accommodation'}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-32 bg-olive-700 flex items-center justify-center">
          <Bed className="w-8 h-8 text-cream-500/40" />
        </div>
      )}
      <div className="p-3 bg-[rgba(200,195,175,0.1)]">
        <p className="text-cream-200 text-sm font-medium">{stay.name || 'Accommodation'}</p>
        {stay.notes && <p className="text-cream-500 text-xs mt-0.5">{stay.notes}</p>}
        {stay.booking_url && (
          <a
            href={stay.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cream-400 text-xs hover:text-cream-200 transition-colors"
          >
            View booking &rarr;
          </a>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(stay.id); }}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-cream-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Add Rest Stop Modal ───

function AddRestStopModal({
  dayId,
  onClose,
  onSuccess,
}: {
  dayId: string;
  onClose: () => void;
  onSuccess: (stay: Stay) => void;
}) {
  const supabase = createClient();
  const [name, setName]     = useState('');
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    const { data, error: err } = await supabase
      .from('stays')
      .insert({
        trip_day_id: dayId,
        name: name.trim(),
        notes: notes.trim() || null,
        booking_url: null,
        image_url: null,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message || 'Failed to add rest stop');
      setSaving(false);
      return;
    }

    onSuccess(data as Stay);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Add Rest Stop</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              <MapPin className="w-3 h-3 inline mr-1" /> Stop Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bảo Lộc Coffee Village"
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm"
              style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Lunch break, photo spot, etc."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm resize-none"
              style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-cream-300 text-sm font-medium" style={{ background: 'rgba(200, 195, 175, 0.1)', border: '1px solid rgba(200, 195, 175, 0.15)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-olive-900 text-sm font-semibold bg-cream-200 hover:bg-cream-100 transition-colors disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Stop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Accommodation Modal ───

function AddAccommodationModal({
  dayId,
  onClose,
  onSuccess,
}: {
  dayId: string;
  onClose: () => void;
  onSuccess: (stay: Stay) => void;
}) {
  const supabase = createClient();
  const [name, setName]           = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [ogLoading, setOgLoading] = useState(false);

  // Auto-fetch OG image from booking URL
  useEffect(() => {
    if (!bookingUrl.trim()) return;
    const timeout = setTimeout(async () => {
      setOgLoading(true);
      try {
        const res = await fetch(`/api/fetch-og?url=${encodeURIComponent(bookingUrl)}`);
        const data = await res.json();
        if (data.imageUrl && !imageUrl) setImageUrl(data.imageUrl);
        if (data.title && !name) setName(data.title.replace(/\s*[-|].*$/, '').trim());
      } catch {
        // silently fail
      } finally {
        setOgLoading(false);
      }
    }, 800);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !bookingUrl.trim()) { setError('Name or booking URL is required'); return; }
    setSaving(true);
    setError('');

    const { data, error: err } = await supabase
      .from('stays')
      .insert({
        trip_day_id: dayId,
        name: name.trim() || null,
        booking_url: bookingUrl.trim() || null,
        image_url: imageUrl.trim() || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message || 'Failed to add accommodation');
      setSaving(false);
      return;
    }

    onSuccess(data as Stay);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Add Accommodation</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              <Bed className="w-3 h-3 inline mr-1" /> Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Hotel / Airbnb / Hostel name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm"
              style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              Booking URL
            </label>
            <div className="relative">
              <input
                value={bookingUrl}
                onChange={e => setBookingUrl(e.target.value)}
                placeholder="https://booking.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm"
                style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
              />
              {ogLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-cream-400 animate-spin" />
                </div>
              )}
            </div>
            <p className="text-cream-600 text-xs mt-1">Paste a booking link to auto-fetch image &amp; name</p>
          </div>
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              Image URL
            </label>
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm"
              style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden h-28 relative">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Check-in time, special instructions..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm resize-none"
              style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-cream-300 text-sm font-medium" style={{ background: 'rgba(200, 195, 175, 0.1)', border: '1px solid rgba(200, 195, 175, 0.15)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-olive-900 text-sm font-semibold bg-cream-200 hover:bg-cream-100 transition-colors disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Accommodation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

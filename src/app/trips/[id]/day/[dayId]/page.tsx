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
import { ArrowLeft, Trash2, Loader2, X, MapPin, Bed, Star, CheckCircle, ExternalLink, Share2, Check, Link2 } from 'lucide-react';

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
            {/* Back link + Share */}
            <div className="flex items-center justify-between">
              <Link
                href={`/trips/${id}`}
                className="inline-flex items-center gap-2 text-cream-400 hover:text-cream-200 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to trip
              </Link>
              <ShareButton label={`Day ${day.day_number}: ${day.origin_city} → ${day.destination_city}`} />
            </div>

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

// ─── Share Button ───

function ShareButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: label, text: `Check out: ${label}`, url });
        return;
      } catch { /* fall through */ }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-[rgba(200,195,175,0.15)] transition-all text-xs uppercase tracking-wide-custom"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Share'}
      </button>
      {copied && (
        <div className="absolute top-full right-0 mt-1.5 px-3 py-1.5 rounded-lg text-[11px] text-cream-100 whitespace-nowrap flex items-center gap-1.5"
          style={{ background: 'rgba(61, 73, 53, 0.95)', border: '1px solid rgba(200, 195, 175, 0.25)' }}>
          <Link2 className="w-3 h-3 text-green-400" />
          Link copied
        </div>
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

interface OgData {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  images: string[];
  siteName: string | null;
  address: string | null;
  rating: string | null;
  ratingCount: string | null;
  priceRange: string | null;
  checkIn: string | null;
  checkOut: string | null;
}

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
  const [bookingUrl, setBookingUrl] = useState('');
  const [name, setName]           = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [ogLoading, setOgLoading] = useState(false);
  const [ogData, setOgData]       = useState<OgData | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  const [ogFailed, setOgFailed] = useState(false);

  // Auto-fetch details from booking URL
  useEffect(() => {
    if (!bookingUrl.trim()) { setOgData(null); setAutoFilled(false); setOgFailed(false); return; }
    // Only fetch if it looks like a URL
    if (!bookingUrl.trim().startsWith('http')) return;
    const timeout = setTimeout(async () => {
      setOgLoading(true);
      setAutoFilled(false);
      setOgFailed(false);
      try {
        const res = await fetch(`/api/fetch-og?url=${encodeURIComponent(bookingUrl.trim())}`);
        const data: OgData = await res.json();
        setOgData(data);

        // Check if we actually got useful data back
        const hasData = !!(data.title || data.imageUrl || data.address || data.rating);

        if (hasData) {
          // Auto-fill fields if empty
          if (data.title && !name) setName(data.title);
          if (data.imageUrl && !imageUrl) setImageUrl(data.imageUrl);

          // Build notes from extracted details
          if (!notes) {
            const noteParts: string[] = [];
            if (data.address) noteParts.push(data.address);
            if (data.rating) noteParts.push(`Rating: ${data.rating}${data.ratingCount ? ` (${data.ratingCount} reviews)` : ''}`);
            if (data.priceRange) noteParts.push(`Price: ${data.priceRange}`);
            if (data.checkIn || data.checkOut) {
              const times = [data.checkIn ? `Check-in: ${data.checkIn}` : '', data.checkOut ? `Check-out: ${data.checkOut}` : ''].filter(Boolean);
              if (times.length) noteParts.push(times.join(' / '));
            }
            if (noteParts.length) setNotes(noteParts.join('\n'));
          }

          setAutoFilled(true);
        } else {
          // No useful data — site likely blocks scraping
          setOgFailed(true);
        }
      } catch {
        setOgFailed(true);
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

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm";
  const inputStyle = { border: '1px solid rgba(200, 195, 175, 0.2)' };
  const labelClass = "block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Add Accommodation</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Booking URL — primary input */}
            <div>
              <label className={labelClass}>
                <ExternalLink className="w-3 h-3 inline mr-1" /> Booking URL
              </label>
              <div className="relative">
                <input
                  value={bookingUrl}
                  onChange={e => setBookingUrl(e.target.value)}
                  placeholder="https://booking.com/... or any hotel link"
                  className={inputClass}
                  style={inputStyle}
                  autoFocus
                />
                {ogLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-cream-400 animate-spin" />
                  </div>
                )}
                {autoFilled && !ogLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                )}
                {ogFailed && !ogLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">
                    ⚠
                  </div>
                )}
              </div>
              {ogFailed ? (
                <p className="text-amber-400/80 text-xs mt-1 flex items-center gap-1">
                  <span>⚠</span> This site doesn&apos;t support auto-fill. Please enter details manually below.
                </p>
              ) : (
                <p className="text-cream-600 text-xs mt-1">Paste any hotel/Airbnb link to auto-fill details</p>
              )}
            </div>

            {/* Auto-fill preview card */}
            {autoFilled && ogData && (imageUrl || name) && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(200, 195, 175, 0.1)', border: '1px solid rgba(200, 195, 175, 0.15)' }}>
                {imageUrl && (
                  <div className="relative h-36">
                    <img src={imageUrl} alt={name || 'Preview'} className="w-full h-full object-cover" />
                    {ogData.siteName && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/50 text-cream-200 backdrop-blur-sm">
                        {ogData.siteName}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <p className="text-cream-100 text-sm font-medium">{name}</p>
                  {ogData.address && (
                    <p className="text-cream-500 text-xs flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {ogData.address}
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {ogData.rating && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        {ogData.rating}
                        {ogData.ratingCount && <span className="text-cream-500">({ogData.ratingCount})</span>}
                      </span>
                    )}
                    {ogData.priceRange && (
                      <span className="text-cream-400 text-xs">{ogData.priceRange}</span>
                    )}
                  </div>
                  {ogData.description && (
                    <p className="text-cream-500 text-xs line-clamp-2">{ogData.description}</p>
                  )}
                  <p className="text-green-400/80 text-[10px] flex items-center gap-1 pt-1">
                    <CheckCircle className="w-3 h-3" /> Details auto-filled from link
                  </p>
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className={labelClass}>
                <Bed className="w-3 h-3 inline mr-1" /> Name {autoFilled && <span className="text-cream-600 normal-case tracking-normal">(auto-filled)</span>}
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Hotel / Airbnb / Hostel name"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Image URL (hidden if already auto-filled, can expand) */}
            <div>
              <label className={labelClass}>
                Image URL {autoFilled && imageUrl && <span className="text-cream-600 normal-case tracking-normal">(auto-filled)</span>}
              </label>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>
                Notes {autoFilled && notes && <span className="text-cream-600 normal-case tracking-normal">(auto-filled)</span>}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Check-in time, address, special instructions..."
                rows={3}
                className={`${inputClass} resize-none`}
                style={inputStyle}
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
    </div>
  );
}

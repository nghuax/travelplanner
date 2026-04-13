'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import lazyLoad from 'next/dynamic';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { DayCard } from '@/components/DayCard';
import { AddDayModal } from '@/components/AddDayModal';
import { createClient } from '@/utils/supabase/client';
import { Trip, TripDay, Stay } from '@/types';
import { formatDistance, formatDate } from '@/lib/maps';
import { Loader2, Share2, Check, Link2 } from 'lucide-react';

const MapView = lazyLoad(
  () => import('@/components/MapView').then(m => ({ default: m.MapView })),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function MapSkeleton() {
  return (
    <div className="w-full h-full bg-olive-700 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cream-400/30 border-t-cream-400 rounded-full animate-spin" />
    </div>
  );
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip]           = useState<Trip | null>(null);
  const [days, setDays]           = useState<(TripDay & { stays: Stay[] })[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | undefined>();

  const fetchTrip = useCallback(async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();
    if (data) setTrip(data as Trip);

    const { data: daysData } = await supabase
      .from('trip_days')
      .select('*, stays(*)')
      .eq('trip_id', id)
      .order('day_number', { ascending: true });
    setDays((daysData as (TripDay & { stays: Stay[] })[]) || []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  function handleDayAdded(day: TripDay & { stays: Stay[] }) {
    setDays(prev => [...prev, day].sort((a, b) => a.day_number - b.day_number));
  }

  function handleDayDeleted(dayId: string) {
    setDays(prev => prev.filter(d => d.id !== dayId));
  }

  const totalDistance = days.reduce((s, d) => s + (d.distance_km ?? 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-olive-600 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cream-400 animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-olive-600 flex flex-col items-center justify-center gap-4">
        <p className="text-cream-400">Trip not found.</p>
        <Link href="/" className="text-cream-300 hover:underline text-sm">&larr; Back to trips</Link>
      </div>
    );
  }

  // Format date range
  const dateRange = trip.start_date && trip.end_date
    ? `${new Date(trip.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} \u2013 ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : trip.start_date
      ? new Date(trip.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

  return (
    <div className="min-h-screen bg-olive-600 flex flex-col">
      <NavBar tripName={trip.name} />

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 overflow-hidden px-4 gap-4" style={{ height: 'calc(100vh - 68px)' }}>
        {/* Map */}
        <div className="flex-1 relative map-container">
          <MapView tripDays={days} activeDayId={activeDayId} />
        </div>

        {/* Sidebar */}
        <aside className="w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col overflow-y-auto space-y-4 pb-4">
          {/* Trip Overview card */}
          <div className="glass-card-strong p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-serif text-3xl font-semibold text-cream-100 mb-2">
                Trip Overview
              </h2>
              <ShareButton tripName={trip.name} />
            </div>
            {totalDistance > 0 && (
              <p className="text-cream-400 text-sm">
                Total Distance: {formatDistance(totalDistance)}
              </p>
            )}
            {dateRange && (
              <p className="text-cream-400 text-sm">
                Date: {dateRange}
              </p>
            )}
          </div>

          {/* Day cards */}
          {days.map(day => (
            <DayCard
              key={day.id}
              day={day}
              tripId={id}
              isActive={day.id === activeDayId}
              onClick={() => setActiveDayId(prev => prev === day.id ? undefined : day.id)}
              onDelete={handleDayDeleted}
            />
          ))}

          {/* Add day button */}
          <button
            onClick={() => setShowModal(true)}
            className="dashed-button py-4 flex items-center justify-center gap-2"
          >
            <span className="text-cream-400 text-lg font-light">+</span>
            <span className="text-cream-400 text-sm">Add Day</span>
          </button>
        </aside>
      </div>

      {/* Settings footer */}
      <div className="px-8 py-3 flex justify-end">
        <button className="text-cream-200/60 hover:text-cream-200/80 text-xs uppercase tracking-wide-custom transition-colors">
          Settings
        </button>
      </div>

      {showModal && (
        <AddDayModal
          tripId={id}
          nextDayNumber={days.length + 1}
          tripStartDate={trip.start_date}
          onClose={() => setShowModal(false)}
          onSuccess={handleDayAdded}
        />
      )}
    </div>
  );
}

// ─── Share Button ───

function ShareButton({ tripName }: { tripName: string }) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    const title = `${tripName} — Vietnam Travel Planner`;
    const text = `Check out my trip: ${tripName}`;

    // Try Web Share API first (mobile + some desktop)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or API not available — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowTooltip(true);
      setTimeout(() => { setCopied(false); setShowTooltip(false); }, 2500);
    } catch {
      // Final fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setShowTooltip(true);
      setTimeout(() => { setCopied(false); setShowTooltip(false); }, 2500);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-[rgba(200,195,175,0.15)] transition-all text-xs uppercase tracking-wide-custom"
        title="Share this trip"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Share'}
      </button>

      {/* Toast notification */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-xs text-cream-100 whitespace-nowrap animate-fade-in flex items-center gap-1.5"
          style={{ background: 'rgba(61, 73, 53, 0.95)', border: '1px solid rgba(200, 195, 175, 0.25)' }}>
          <Link2 className="w-3 h-3 text-green-400" />
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}

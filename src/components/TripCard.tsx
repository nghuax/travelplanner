'use client';

import Link from 'next/link';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Trip } from '@/types';
import { formatDistance } from '@/lib/maps';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

interface TripCardProps {
  trip: Trip;
  onDelete?: (id: string) => void;
}

export function TripCard({ trip, onDelete }: TripCardProps) {
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  const totalDays = trip.trip_days?.length ?? 0;
  const totalDistance = trip.trip_days?.reduce((s, d) => s + (d.distance_km ?? 0), 0) ?? 0;

  // Build route summary: first origin -> last destination
  const routeSummary =
    trip.trip_days && trip.trip_days.length > 0
      ? `${trip.trip_days[0].origin_city} \u2192 ${trip.trip_days[trip.trip_days.length - 1].destination_city}`
      : null;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${trip.name}"? This will remove all days and stays.`)) return;
    setDeleting(true);
    await supabase.from('trips').delete().eq('id', trip.id);
    onDelete?.(trip.id);
  }

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <div className="relative glass-card-strong p-6 pr-12 transition-all duration-300 hover:bg-[rgba(200,195,175,0.28)]">
        {/* Title */}
        <h3 className="font-serif text-2xl font-medium text-cream-100 mb-2 leading-snug">
          {trip.name}
        </h3>

        {/* Stats */}
        {totalDistance > 0 && (
          <p className="text-cream-500 text-sm mb-1">
            Total Distance: {formatDistance(totalDistance)}
          </p>
        )}

        {/* Days + Route */}
        <p className="text-cream-500 text-sm">
          {totalDays > 0 && <>{totalDays} {totalDays === 1 ? 'day' : 'days'}</>}
          {routeSummary && <>{totalDays > 0 ? ' \u00B7 ' : ''}{routeSummary}</>}
        </p>

        {/* Chevron */}
        <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-500 group-hover:text-cream-300 transition-colors" />

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-cream-600/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete trip"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Link>
  );
}

export function AddTripCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full dashed-button py-5 flex items-center justify-center gap-2 group"
    >
      <span className="text-cream-400 text-lg font-light">+</span>
      <span className="text-cream-400 text-sm">Add Another Trip</span>
    </button>
  );
}

'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { TripDay } from '@/types';
import { formatDistance } from '@/lib/maps';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

interface DayCardProps {
  day: TripDay;
  tripId: string;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (id: string) => void;
}

export function DayCard({ day, tripId, isActive, onClick, onDelete }: DayCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showAccom, setShowAccom] = useState(false);
  const supabase = createClient();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete Day ${day.day_number}?`)) return;
    setDeleting(true);
    await supabase.from('trip_days').delete().eq('id', day.id);
    onDelete?.(day.id);
  }

  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 group relative cursor-pointer transition-all duration-300 ${
        isActive
          ? 'ring-2 ring-cream-200/50 bg-[rgba(200,195,175,0.25)] scale-[1.01]'
          : 'hover:bg-[rgba(200,195,175,0.2)]'
      }`}
    >
      {/* Day heading */}
      <h3 className="font-serif text-2xl font-semibold text-cream-100 mb-2">
        Day {day.day_number}
      </h3>

      {/* Route */}
      <p className="text-cream-200 text-sm font-medium mb-1">
        {day.origin_city} to {day.destination_city}
      </p>

      {/* Distance */}
      {day.distance_km != null && day.distance_km > 0 && (
        <p className="text-cream-500 text-sm mb-3">
          Total Distance ~ {formatDistance(day.distance_km)}
        </p>
      )}

      {/* Action links */}
      <div className="space-y-1 mb-3">
        <Link
          href={`/trips/${tripId}/day/${day.id}`}
          className="block text-cream-300 text-sm hover:text-cream-100 transition-colors"
        >
          &lt; Open map &gt;
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); setShowAccom(!showAccom); }}
          className="text-cream-300 text-sm hover:text-cream-100 transition-colors font-medium"
        >
          &lt; Show accommodation &gt;
        </button>
      </div>

      {/* Accommodation preview (toggled) */}
      {showAccom && day.stays && day.stays.length > 0 && (
        <div className="mt-2 space-y-1">
          {day.stays.map(stay => (
            <p key={stay.id} className="text-cream-400 text-xs">
              {stay.name || 'Accommodation'}
            </p>
          ))}
        </div>
      )}

      {/* Rest stops (from description or stays) */}
      {day.stays && day.stays.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {day.stays.map(stay => (
            <span key={stay.id} className="rest-stop-badge">
              <span className="text-amber-400 text-xs">&#x1F4CD;</span>
              {stay.name || 'Stop'}
            </span>
          ))}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-3 right-3 p-1.5 rounded text-cream-600/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

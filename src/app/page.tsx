'use client';

import { useEffect, useState } from 'react';
import { NavBar } from '@/components/NavBar';
import { TripCard, AddTripCard } from '@/components/TripCard';
import { AddTripModal } from '@/components/AddTripModal';
import { createClient } from '@/utils/supabase/client';
import { Trip } from '@/types';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const supabase = createClient();
  const [trips, setTrips]         = useState<Trip[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function fetchTrips() {
      const { data } = await supabase
        .from('trips')
        .select('*, trip_days(*, stays(*))')
        .order('created_at', { ascending: false });
      setTrips((data as Trip[]) || []);
      setLoading(false);
    }
    fetchTrips();
  }, [supabase]);

  function handleTripCreated(trip: Trip) {
    setTrips(prev => [{ ...trip, trip_days: [] }, ...prev]);
  }

  function handleTripDeleted(id: string) {
    setTrips(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-olive-600 flex flex-col">
      <NavBar onAddTrip={() => setShowModal(true)} />

      {/* Trips */}
      <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cream-400 animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDelete={handleTripDeleted}
              />
            ))}
            <AddTripCard onClick={() => setShowModal(true)} />

            {trips.length === 0 && (
              <div className="text-center py-12">
                <p className="text-cream-500 text-sm">No trips yet. Create your first Vietnam road trip.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings footer */}
      <div className="px-8 py-4 flex justify-end">
        <button className="text-cream-200/60 hover:text-cream-200/80 text-xs uppercase tracking-wide-custom transition-colors">
          Settings
        </button>
      </div>

      {showModal && (
        <AddTripModal
          onClose={() => setShowModal(false)}
          onSuccess={handleTripCreated}
        />
      )}
    </div>
  );
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  trip_days?: TripDay[];
}

export interface TripDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string | null;
  origin_city: string;
  destination_city: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  google_maps_url: string | null;
  route_polyline: string | null;
  description: string | null;
  created_at: string;
  stays?: Stay[];
}

export type LocationCategory =
  | 'food'
  | 'sightseeing'
  | 'entertainment'
  | 'shopping'
  | 'accommodation'
  | 'rest_stop'
  | 'other';

export interface Stay {
  id: string;
  trip_day_id: string;
  name: string | null;
  booking_url: string | null;
  image_url: string | null;
  notes: string | null;
  category: LocationCategory | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  google_maps_url: string | null;
  sort_order: number | null;
  created_at: string;
}

export const CATEGORY_CONFIG: Record<LocationCategory, { label: string; emoji: string; color: string }> = {
  food:          { label: 'Food & Drink',    emoji: '🍽️', color: '#F59E0B' },
  sightseeing:   { label: 'Sightseeing',     emoji: '🏛️', color: '#3B82F6' },
  entertainment: { label: 'Entertainment',   emoji: '🎭', color: '#8B5CF6' },
  shopping:      { label: 'Shopping',        emoji: '🛍️', color: '#EC4899' },
  accommodation: { label: 'Accommodation',   emoji: '🏨', color: '#10B981' },
  rest_stop:     { label: 'Rest Stop',       emoji: '☕', color: '#D97706' },
  other:         { label: 'Other',           emoji: '📍', color: '#9CA3AF' },
};

export const ALL_CATEGORIES: LocationCategory[] = [
  'food', 'sightseeing', 'entertainment', 'shopping', 'accommodation', 'rest_stop', 'other',
];

/** Infer category from legacy stay data (before category column existed). */
export function inferCategory(stay: Stay): LocationCategory {
  if (stay.category) return stay.category;
  if (stay.booking_url || stay.image_url) return 'accommodation';
  if (stay.notes?.toLowerCase().includes('rest stop')) return 'rest_stop';
  return 'other';
}

export interface RouteInfo {
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  encodedPolyline: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}

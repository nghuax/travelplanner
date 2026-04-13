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

export interface Stay {
  id: string;
  trip_day_id: string;
  name: string | null;
  booking_url: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
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

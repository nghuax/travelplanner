'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TripDay } from '@/types';
import { TILE_URL, TILE_ATTRIBUTION, decodePolyline } from '@/lib/maps';

interface DayMapViewProps {
  day: TripDay;
}

export function DayMapView({ day }: DayMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy previous map if exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center: [number, number] =
      day.origin_lat && day.origin_lng
        ? [day.origin_lat, day.origin_lng]
        : [16.047, 108.2022];

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
    });

    map.zoomControl.setPosition('topleft');

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    // Olive/earth tint on tiles
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = 'sepia(30%) hue-rotate(50deg) saturate(60%) brightness(85%)';
    }

    mapRef.current = map;

    // Draw route
    const bounds = L.latLngBounds([]);
    let hasBounds = false;

    const polylinePath = day.route_polyline ? decodePolyline(day.route_polyline) : null;

    if (polylinePath && polylinePath.length > 0) {
      // Glow
      L.polyline(polylinePath, {
        color: '#F2EDE4',
        weight: 10,
        opacity: 0.15,
      }).addTo(map);

      // Main line
      L.polyline(polylinePath, {
        color: '#F2EDE4',
        weight: 3,
        opacity: 0.85,
      }).addTo(map);

      polylinePath.forEach(p => { bounds.extend(p); hasBounds = true; });
    }

    // Fallback straight line
    if (!polylinePath && day.origin_lat && day.origin_lng && day.destination_lat && day.destination_lng) {
      L.polyline(
        [[day.origin_lat, day.origin_lng], [day.destination_lat, day.destination_lng]],
        { color: '#F2EDE4', weight: 3, opacity: 0.6 }
      ).addTo(map);
    }

    // Origin marker — hollow circle
    if (day.origin_lat && day.origin_lng) {
      L.circleMarker([day.origin_lat, day.origin_lng], {
        radius: 8,
        fillColor: 'transparent',
        fillOpacity: 0,
        color: '#F2EDE4',
        weight: 2.5,
      })
        .bindTooltip(day.origin_city, { direction: 'top', offset: [0, -10], permanent: true, className: 'map-label' })
        .addTo(map);
      bounds.extend([day.origin_lat, day.origin_lng]);
      hasBounds = true;
    }

    // Destination marker — hollow circle
    if (day.destination_lat && day.destination_lng) {
      L.circleMarker([day.destination_lat, day.destination_lng], {
        radius: 8,
        fillColor: 'transparent',
        fillOpacity: 0,
        color: '#F2EDE4',
        weight: 2.5,
      })
        .bindTooltip(day.destination_city, { direction: 'top', offset: [0, -10], permanent: true, className: 'map-label' })
        .addTo(map);
      bounds.extend([day.destination_lat, day.destination_lng]);
      hasBounds = true;
    }

    // Rest stop markers (from stays)
    if (day.stays && day.stays.length > 0 && day.origin_lat && day.destination_lat) {
      day.stays.forEach((stay, i) => {
        const frac = (i + 1) / ((day.stays?.length ?? 0) + 1);
        const lat = day.origin_lat! + (day.destination_lat! - day.origin_lat!) * frac;
        const lng = (day.origin_lng ?? 0) + ((day.destination_lng ?? 0) - (day.origin_lng ?? 0)) * frac;

        L.circleMarker([lat, lng], {
          radius: 5,
          fillColor: '#D4A76A',
          fillOpacity: 1,
          color: '#59684B',
          weight: 1.5,
        })
          .bindTooltip(stay.name || 'Rest Stop', { direction: 'top', offset: [0, -6] })
          .addTo(map);
      });
    }

    if (hasBounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [day]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#3d4935' }} />
  );
}

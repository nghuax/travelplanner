'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TripDay } from '@/types';
import { VIETNAM_CENTER, TILE_URL, TILE_ATTRIBUTION, decodePolyline } from '@/lib/maps';

interface MapViewProps {
  tripDays: TripDay[];
  activeDayId?: string;
}

export function MapView({ tripDays, activeDayId }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: VIETNAM_CENTER,
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });

    // Position zoom control top-left
    map.zoomControl.setPosition('topleft');

    // Add tile layer — dark earth-toned tiles
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    // Custom CSS filter to give the tiles an olive/earth tint
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = 'sepia(30%) hue-rotate(50deg) saturate(60%) brightness(85%)';
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers and polylines when tripDays change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing layers (keep tile layer)
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) return;
      map.removeLayer(layer);
    });

    const allBounds = L.latLngBounds([]);
    let hasAllBounds = false;

    tripDays.forEach((day) => {
      const isActive = day.id === activeDayId;
      const dimmed = activeDayId && !isActive;
      const polylinePath = day.route_polyline ? decodePolyline(day.route_polyline) : null;

      // Draw polyline
      if (polylinePath && polylinePath.length > 0) {
        // Glow effect
        L.polyline(polylinePath, {
          color: isActive ? '#A8B88C' : '#FFFFFF',
          weight: isActive ? 12 : 6,
          opacity: isActive ? 0.25 : dimmed ? 0.03 : 0.08,
        }).addTo(map);

        // Main line
        L.polyline(polylinePath, {
          color: isActive ? '#F2EDE4' : dimmed ? 'rgba(200,195,175,0.35)' : '#F2EDE4',
          weight: isActive ? 4.5 : dimmed ? 1.5 : 2.5,
          opacity: isActive ? 1 : dimmed ? 0.4 : 0.6,
          dashArray: isActive ? undefined : '8, 6',
        }).addTo(map);

        polylinePath.forEach(p => { allBounds.extend(p); hasAllBounds = true; });
      }

      // Origin marker
      if (day.origin_lat && day.origin_lng) {
        const marker = L.circleMarker([day.origin_lat, day.origin_lng], {
          radius: isActive ? 9 : dimmed ? 4 : 6,
          fillColor: isActive ? '#F2EDE4' : dimmed ? 'rgba(200,195,175,0.4)' : '#F2EDE4',
          fillOpacity: 1,
          color: isActive ? '#8B9A6E' : '#59684B',
          weight: isActive ? 3 : 2,
        }).addTo(map);

        if (isActive) {
          marker.bindTooltip(`Day ${day.day_number}: ${day.origin_city}`, {
            direction: 'top', offset: [0, -10], permanent: true, className: 'map-label'
          });
        } else {
          marker.bindTooltip(`Day ${day.day_number}: ${day.origin_city}`, {
            direction: 'top', offset: [0, -8]
          });
        }

        allBounds.extend([day.origin_lat, day.origin_lng]);
        hasAllBounds = true;
      }

      // Destination marker
      if (day.destination_lat && day.destination_lng) {
        const marker = L.circleMarker([day.destination_lat, day.destination_lng], {
          radius: isActive ? 10 : dimmed ? 5 : 7,
          fillColor: isActive ? '#F2EDE4' : dimmed ? 'rgba(200,195,175,0.4)' : '#F2EDE4',
          fillOpacity: 1,
          color: isActive ? '#8B9A6E' : '#59684B',
          weight: isActive ? 3 : 2.5,
        }).addTo(map);

        if (isActive) {
          marker.bindTooltip(`Day ${day.day_number}: ${day.destination_city}`, {
            direction: 'top', offset: [0, -10], permanent: true, className: 'map-label'
          });
        } else {
          marker.bindTooltip(`Day ${day.day_number}: ${day.destination_city}`, {
            direction: 'top', offset: [0, -8]
          });
        }

        allBounds.extend([day.destination_lat, day.destination_lng]);
        hasAllBounds = true;
      }

      // Fallback straight line
      if (!polylinePath && day.origin_lat && day.origin_lng && day.destination_lat && day.destination_lng) {
        L.polyline(
          [[day.origin_lat, day.origin_lng], [day.destination_lat, day.destination_lng]],
          {
            color: dimmed ? 'rgba(200,195,175,0.2)' : '#F2EDE4',
            weight: isActive ? 3 : dimmed ? 1 : 2,
            opacity: isActive ? 0.8 : dimmed ? 0.3 : 0.4,
            dashArray: '6, 8',
          }
        ).addTo(map);
      }
    });

    // Zoom behavior: fly to active day, or fit all bounds
    if (activeDayId) {
      const activeDay = tripDays.find(d => d.id === activeDayId);
      if (activeDay) {
        const dayBounds = L.latLngBounds([]);
        let hasDayBounds = false;

        const polylinePath = activeDay.route_polyline ? decodePolyline(activeDay.route_polyline) : null;
        if (polylinePath && polylinePath.length > 0) {
          polylinePath.forEach(p => { dayBounds.extend(p); hasDayBounds = true; });
        }
        if (activeDay.origin_lat && activeDay.origin_lng) {
          dayBounds.extend([activeDay.origin_lat, activeDay.origin_lng]);
          hasDayBounds = true;
        }
        if (activeDay.destination_lat && activeDay.destination_lng) {
          dayBounds.extend([activeDay.destination_lat, activeDay.destination_lng]);
          hasDayBounds = true;
        }

        if (hasDayBounds && dayBounds.isValid()) {
          map.flyToBounds(dayBounds, { padding: [60, 60], duration: 1.2, maxZoom: 12 });
        }
      }
    } else if (hasAllBounds && allBounds.isValid()) {
      map.flyToBounds(allBounds, { padding: [50, 50], duration: 1.0 });
    }
  }, [tripDays, activeDayId]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#3d4935' }} />
  );
}

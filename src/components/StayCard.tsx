'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { Stay } from '@/types';
import { useEffect, useState } from 'react';

interface StayCardProps {
  stay: Stay;
}

export function StayCard({ stay }: StayCardProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(stay.image_url);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stay.image_url && stay.booking_url && !imgSrc) {
      setLoading(true);
      fetch(`/api/fetch-og?url=${encodeURIComponent(stay.booking_url)}`)
        .then(r => r.json())
        .then(data => {
          if (data.imageUrl) setImgSrc(data.imageUrl);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [stay.booking_url, stay.image_url, imgSrc]);

  const hasImage = imgSrc && !imgError;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(200, 195, 175, 0.2)' }}>
      {loading && (
        <div className="h-36 bg-olive-700 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-cream-500 animate-spin" />
        </div>
      )}
      {hasImage && !loading && (
        <div className="relative h-36">
          <Image
            src={imgSrc}
            alt={stay.name || 'Accommodation'}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      {!hasImage && !loading && (
        <div className="h-28 bg-olive-700 flex items-center justify-center">
          <span className="text-cream-500 text-sm">{stay.name || 'Accommodation'}</span>
        </div>
      )}

      <div className="p-3" style={{ background: 'rgba(200, 195, 175, 0.08)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-cream-200 truncate">{stay.name || 'Accommodation'}</p>
            {stay.notes && (
              <p className="text-xs text-cream-500 mt-0.5 line-clamp-2">{stay.notes}</p>
            )}
          </div>
          {stay.booking_url && (
            <a
              href={stay.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg text-cream-300 hover:text-cream-100 transition-colors"
              style={{ background: 'rgba(200, 195, 175, 0.15)', border: '1px solid rgba(200, 195, 175, 0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Link2, MapPin, CheckCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Stay, LocationCategory, ALL_CATEGORIES, CATEGORY_CONFIG } from '@/types';

interface AddLocationModalProps {
  dayId: string;
  onClose: () => void;
  onSuccess: (stay: Stay) => void;
}

interface PlaceResult {
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  expandedUrl?: string;
}

export function AddLocationModal({ dayId, onClose, onSuccess }: AddLocationModalProps) {
  const supabase = createClient();
  const [mapsUrl, setMapsUrl]       = useState('');
  const [name, setName]             = useState('');
  const [category, setCategory]     = useState<LocationCategory>('other');
  const [notes, setNotes]           = useState('');
  const [imageUrl, setImageUrl]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeResult, setPlaceResult]   = useState<PlaceResult | null>(null);
  const [autoFilled, setAutoFilled]     = useState(false);
  const [placeFailed, setPlaceFailed]   = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-parse Google Maps URL
  useEffect(() => {
    if (!mapsUrl.trim()) {
      setPlaceResult(null);
      setAutoFilled(false);
      setPlaceFailed(false);
      return;
    }
    if (!mapsUrl.trim().startsWith('http')) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPlaceLoading(true);
      setAutoFilled(false);
      setPlaceFailed(false);
      try {
        const res = await fetch('/api/parse-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mapsUrl.trim() }),
        });
        const data: PlaceResult = await res.json();

        if (!res.ok || (!data.name && !data.lat)) {
          setPlaceFailed(true);
          setPlaceResult(null);
        } else {
          setPlaceResult(data);
          if (data.name && !name) setName(data.name);
          if (data.address && !notes) setNotes(data.address);
          setAutoFilled(true);
        }
      } catch {
        setPlaceFailed(true);
      } finally {
        setPlaceLoading(false);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = {
      trip_day_id:    dayId,
      name:           name.trim(),
      notes:          notes.trim() || null,
      image_url:      imageUrl.trim() || null,
      booking_url:    null,
      category:       category,
      lat:            placeResult?.lat || null,
      lng:            placeResult?.lng || null,
      address:        placeResult?.address || null,
      google_maps_url: mapsUrl.trim() || null,
    };

    // Try insert with new columns first
    let result = await supabase.from('stays').insert(payload).select().single();

    // If column doesn't exist, retry without new columns
    if (result.error?.message?.includes('does not exist')) {
      const { category: _c, lat: _la, lng: _ln, address: _a, google_maps_url: _g, ...basic } = payload;
      void _c; void _la; void _ln; void _a; void _g;
      // Store extra info in notes
      const extraInfo = [];
      if (category !== 'other') extraInfo.push(`[${CATEGORY_CONFIG[category].label}]`);
      if (placeResult?.address) extraInfo.push(placeResult.address);
      const combinedNotes = [basic.notes, ...extraInfo].filter(Boolean).join('\n');
      basic.notes = combinedNotes || null;

      result = await supabase.from('stays').insert(basic).select().single();
    }

    if (result.error || !result.data) {
      setError(result.error?.message || 'Failed to add location');
      setSaving(false);
      return;
    }

    onSuccess(result.data as Stay);
    onClose();
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-olive-800 text-cream-200 placeholder-cream-600 text-sm";
  const inputStyle = { border: '1px solid rgba(200, 195, 175, 0.2)' };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">Add Location</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Google Maps Link */}
            <div className="space-y-2">
              <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom">
                <Link2 className="w-3 h-3 inline mr-1" /> Google Maps Link
              </label>
              <div className="relative">
                <input
                  value={mapsUrl}
                  onChange={e => setMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... or Google Maps place link"
                  className={`${inputClass} pr-10`}
                  style={{
                    border: `1px solid ${autoFilled ? 'rgba(139, 154, 110, 0.6)' : 'rgba(200, 195, 175, 0.2)'}`,
                  }}
                  autoFocus
                />
                {placeLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400 animate-spin" />
                )}
                {autoFilled && !placeLoading && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                )}
                {placeFailed && !placeLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">⚠</span>
                )}
              </div>
              {placeFailed ? (
                <p className="text-amber-400/80 text-xs flex items-center gap-1">
                  <span>⚠</span> Could not parse this link. Enter details manually below.
                </p>
              ) : (
                <p className="text-cream-600 text-xs">Paste a Google Maps place link to auto-fill name &amp; location</p>
              )}

              {/* Auto-fill preview */}
              {autoFilled && placeResult && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(139, 154, 110, 0.2)', border: '1px solid rgba(139, 154, 110, 0.3)' }}>
                  {placeResult.name && (
                    <p className="text-cream-200 text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cream-400" />
                      {placeResult.name}
                    </p>
                  )}
                  {placeResult.lat && placeResult.lng && (
                    <p className="text-cream-500 text-xs">
                      {placeResult.lat.toFixed(4)}, {placeResult.lng.toFixed(4)}
                    </p>
                  )}
                  {placeResult.address && (
                    <p className="text-cream-500 text-xs line-clamp-2">{placeResult.address}</p>
                  )}
                  <p className="text-green-400/80 text-[10px] flex items-center gap-1 pt-0.5">
                    <CheckCircle className="w-3 h-3" /> Location auto-filled from link
                  </p>
                </div>
              )}
            </div>

            {/* Category Picker */}
            <div className="space-y-2">
              <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom">
                Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ALL_CATEGORIES.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const isSelected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'ring-2 scale-[1.02]'
                          : 'hover:bg-[rgba(200,195,175,0.1)]'
                      }`}
                      style={{
                        background: isSelected ? `${cfg.color}20` : 'rgba(200, 195, 175, 0.05)',
                        border: `1px solid ${isSelected ? cfg.color + '60' : 'rgba(200, 195, 175, 0.15)'}`,
                        ...(isSelected ? { '--tw-ring-color': cfg.color } as React.CSSProperties : {}),
                      }}
                    >
                      <span className="text-lg">{cfg.emoji}</span>
                      <span className={`${isSelected ? 'text-cream-200' : 'text-cream-500'} leading-tight text-center`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
                Name *
                {autoFilled && name && <span className="text-cream-600 normal-case tracking-normal ml-1">(auto-filled)</span>}
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bún Chả Hương Liên"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Image URL (optional) */}
            <div>
              <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
                Image URL <span className="text-cream-600 normal-case tracking-normal">(optional)</span>
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
              <label className="block text-cream-400 text-xs font-medium uppercase tracking-wide-custom mb-1.5">
                Notes
                {autoFilled && notes && <span className="text-cream-600 normal-case tracking-normal ml-1">(auto-filled)</span>}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opening hours, tips, address..."
                rows={2}
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
                {saving ? 'Adding...' : 'Add Location'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

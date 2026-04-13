'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Trip } from '@/types';

interface AddTripModalProps {
  onClose: () => void;
  onSuccess: (trip: Trip) => void;
}

export function AddTripModal({ onClose, onSuccess }: AddTripModalProps) {
  const supabase = createClient();
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [startDate, setStart]     = useState('');
  const [endDate, setEnd]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Trip name is required'); return; }
    setError('');
    setLoading(true);

    const { data, error: dbErr } = await supabase
      .from('trips')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date:   endDate   || null,
      })
      .select()
      .single();

    setLoading(false);
    if (dbErr || !data) { setError(dbErr?.message || 'Failed to create trip'); return; }
    onSuccess(data as Trip);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#4a5940', border: '1px solid rgba(200, 195, 175, 0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'rgba(200, 195, 175, 0.15)' }}>
          <h2 className="font-serif text-xl font-semibold text-cream-100">New Trip</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-cream-400 hover:text-cream-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-cream-300 mb-1.5">
              Trip Name <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Vietnam North to South"
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 border text-cream-200 placeholder-cream-600 text-sm transition-colors"
              style={{ borderColor: 'rgba(200, 195, 175, 0.2)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cream-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Notes about this trip..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-olive-800 border text-cream-200 placeholder-cream-600 text-sm transition-colors resize-none"
              style={{ borderColor: 'rgba(200, 195, 175, 0.2)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-olive-800 border text-cream-200 text-sm transition-colors [color-scheme:dark]"
                style={{ borderColor: 'rgba(200, 195, 175, 0.2)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-olive-800 border text-cream-200 text-sm transition-colors [color-scheme:dark]"
                style={{ borderColor: 'rgba(200, 195, 175, 0.2)' }}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-300 text-sm bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border text-cream-400 hover:text-cream-200 transition-colors text-sm font-medium"
              style={{ borderColor: 'rgba(200, 195, 175, 0.25)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-olive-900 font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#c5bca3' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

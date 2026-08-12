import React, { useState } from 'react';
import { useApp } from '../contexts/useApp';
import { RefreshCw, Trash2, X, Rss, Plus } from 'lucide-react';

interface SubscriptionManagerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal for managing remote calendar subscriptions: add a feed URL, and
 * refresh or remove existing subscribed calendars. Read-only feeds sync their
 * events through the /api/ics-proxy endpoint.
 */
const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ open, onClose }) => {
  const { calendars, events, addSubscription, refreshSubscription, removeSubscription } = useApp();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const subscriptions = calendars.filter(c => c.type === 'subscribed');
  const eventCount = (calendarId: string) => events.filter(e => e.calendarId === calendarId).length;

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await addSubscription(trimmed, name);
      setUrl('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not subscribe to that calendar.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    setError(null);
    try {
      await refreshSubscription(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh that calendar.');
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Rss className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Calendar subscriptions
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/calendar.ics"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Subscribe
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Public iCalendar (.ics) or webcal feeds. Subscriptions are read-only and refresh automatically.
          </p>
        </form>

        <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
          {subscriptions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No subscriptions yet.</p>
          ) : (
            <ul className="space-y-2">
              {subscriptions.map((cal) => (
                <li key={cal.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{cal.name}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {eventCount(cal.id)} events
                      {cal.lastSync ? ` · synced ${cal.lastSync.toLocaleDateString()} ${cal.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRefresh(cal.id)}
                    disabled={refreshingId === cal.id}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label={`Refresh ${cal.name}`}
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingId === cal.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => removeSubscription(cal.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Remove ${cal.name}`}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/useApp';
import type { CalendarEvent, RecurrenceRule } from '../types';
import { format } from 'date-fns';
import { X, Trash2, Calendar as CalendarIcon, Clock, MapPin, Loader2, Repeat } from 'lucide-react';
import { searchLocations, type GeocodingResult } from '../services/geocodingService';
import { getEventWeather, hasEventForecast, type EventWeather } from '../services/eventWeatherService';
import { isOccurrenceId } from '../services/recurrenceService';
import { useDialog } from '../hooks/useDialog';

/** Which events a delete applies to when the event belongs to a series. */
export type DeleteScope = 'occurrence' | 'series';

interface EventModalProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date | null;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (scope: DeleteScope) => void;
  onClose: () => void;
}

type RepeatFreq = RecurrenceRule['frequency'];
type RepeatEnds = 'never' | 'on' | 'after';

// Monday-first, matching the calendar grid. Values are JS weekdays (0 = Sunday).
const WEEKDAYS: Array<{ value: number; label: string; name: string }> = [
  { value: 1, label: 'M', name: 'Monday' },
  { value: 2, label: 'T', name: 'Tuesday' },
  { value: 3, label: 'W', name: 'Wednesday' },
  { value: 4, label: 'T', name: 'Thursday' },
  { value: 5, label: 'F', name: 'Friday' },
  { value: 6, label: 'S', name: 'Saturday' },
  { value: 0, label: 'S', name: 'Sunday' },
];

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  event,
  initialDate,
  onSave,
  onDelete,
  onClose,
}) => {
  const { calendars } = useApp();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: new Date(),
    end: new Date(),
    allDay: false,
    calendarId: '',
    color: '#3b82f6',
    location: '',
    locationCoords: undefined as CalendarEvent['locationCoords'],
    attendees: [] as string[],
    recurrence: undefined as RecurrenceRule | undefined,
  });

  // Delete on a series needs a scope choice, so the trash button opens a small
  // inline confirm rather than deleting outright.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Location autocomplete + per-event weather state.
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [eventWeather, setEventWeather] = useState<EventWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(isOpen, onClose, dialogRef);

  // const [attendeeInput, setAttendeeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocationResults([]);
      setIsSearchingLocation(false);
      setConfirmingDelete(false);
      if (event) {
        // Editing existing event
        setFormData({
          title: event.title,
          description: event.description || '',
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          calendarId: event.calendarId,
          color: event.color || '#3b82f6',
          location: event.location || '',
          locationCoords: event.locationCoords,
          attendees: event.attendees || [],
          recurrence: event.recurrence,
        });
      } else if (initialDate) {
        // Creating new event
        const startDate = new Date(initialDate);
        const endDate = new Date(initialDate);
        endDate.setHours(startDate.getHours() + 1);

        setFormData({
          title: '',
          description: '',
          start: startDate,
          end: endDate,
          allDay: false,
          calendarId: calendars[0]?.id || '',
          color: calendars[0]?.color || '#3b82f6',
          location: '',
          locationCoords: undefined,
          attendees: [],
          recurrence: undefined,
        });
      }
    }
  }, [isOpen, event, initialDate, calendars]);

  // Fetch the forecast at the event's location and time whenever they change.
  useEffect(() => {
    const coords = formData.locationCoords;
    if (!coords || !hasEventForecast(formData.start)) {
      setEventWeather(null);
      setWeatherLoading(false);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    getEventWeather(coords.latitude, coords.longitude, formData.start, formData.allDay)
      .then((w) => { if (!cancelled) setEventWeather(w); })
      .finally(() => { if (!cancelled) setWeatherLoading(false); });
    return () => { cancelled = true; };
  }, [formData.locationCoords, formData.start, formData.allDay]);

  // Debounced geocoding search as the user types a location.
  const handleLocationChange = (value: string) => {
    // Editing the text invalidates any previously resolved coordinates.
    setFormData((prev) => ({ ...prev, location: value, locationCoords: undefined }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setLocationResults([]);
      setIsSearchingLocation(false);
      return;
    }
    setIsSearchingLocation(true);
    searchTimer.current = setTimeout(async () => {
      try {
        setLocationResults(await searchLocations(value));
      } catch {
        setLocationResults([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  };

  const handleLocationSelect = (result: GeocodingResult) => {
    const label = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
    setFormData((prev) => ({
      ...prev,
      location: label,
      locationCoords: { latitude: result.latitude, longitude: result.longitude, timezone: result.timezone },
    }));
    setLocationResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;
    
    onSave({
      title: formData.title.trim(),
      description: formData.description.trim(),
      start: formData.start,
      end: formData.end,
      allDay: formData.allDay,
      calendarId: formData.calendarId,
      color: formData.color,
      location: formData.location.trim(),
      locationCoords: formData.locationCoords,
      attendees: formData.attendees,
      recurrence: formData.recurrence,
    });
  };

  // const handleAddAttendee = () => {
  //   if (attendeeInput.trim() && !formData.attendees.includes(attendeeInput.trim())) {
  //     setFormData({
  //       ...formData,
  //       attendees: [...formData.attendees, attendeeInput.trim()],
  //     });
  //     setAttendeeInput('');
  //   }
  // };

  // const handleRemoveAttendee = (attendee: string) => {
  //   setFormData({
  //     ...formData,
  //     attendees: formData.attendees.filter(a => a !== attendee),
  //   });
  // };

  const handleDateTimeChange = (field: 'start' | 'end', value: string) => {
    const newDate = new Date(value);
    setFormData({ ...formData, [field]: newDate });
  };

  // --- Recurrence editing -------------------------------------------------
  const rule = formData.recurrence;
  const endsMode: RepeatEnds = rule?.count != null ? 'after' : rule?.endDate ? 'on' : 'never';

  const setRule = (next: RecurrenceRule | undefined) =>
    setFormData((prev) => ({ ...prev, recurrence: next }));

  const handleFrequencyChange = (value: string) => {
    if (value === 'none') return setRule(undefined);
    const frequency = value as RepeatFreq;
    setRule({
      // Preserve interval/end when switching frequency; drop weekday selection,
      // which only means anything for weekly rules.
      interval: rule?.interval ?? 1,
      count: rule?.count,
      endDate: rule?.endDate,
      exDates: rule?.exDates,
      frequency,
      byWeekDay: frequency === 'weekly' ? rule?.byWeekDay : undefined,
    });
  };

  const toggleWeekday = (day: number) => {
    if (!rule) return;
    const current = rule.byWeekDay ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    // An empty set would generate nothing, so fall back to "same day as start".
    setRule({ ...rule, byWeekDay: next.length ? next.sort((a, b) => a - b) : undefined });
  };

  const handleEndsChange = (mode: RepeatEnds) => {
    if (!rule) return;
    if (mode === 'never') return setRule({ ...rule, count: undefined, endDate: undefined });
    if (mode === 'after') return setRule({ ...rule, count: rule.count ?? 10, endDate: undefined });
    const fallback = new Date(formData.start);
    fallback.setMonth(fallback.getMonth() + 3);
    setRule({ ...rule, endDate: rule.endDate ?? fallback, count: undefined });
  };

  // An event opened from the grid is a generated occurrence; edits fan out to
  // the whole series, so say so rather than letting the user find out.
  const isSeriesOccurrence = !!event && isOccurrenceId(event.id);
  const isRecurring = isSeriesOccurrence || !!rule;

  const handleDeleteClick = () => {
    if (isSeriesOccurrence) setConfirmingDelete(true);
    else onDelete?.('series');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 id="event-modal-title" className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {event ? 'Edit Event' : 'New Event'}
            </h3>
            <div className="flex items-center space-x-2">
              {event && onDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  aria-label="Delete event"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Delete scope — only a series forces the choice. */}
          {confirmingDelete && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
              <p className="text-sm text-red-800 dark:text-red-200">
                This event repeats. What would you like to delete?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDelete?.('occurrence')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                >
                  This event only
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.('series')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                >
                  All events in the series
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                data-autofocus
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event title"
                required
              />
            </div>

            {/* Calendar Selection */}
            <div>
              <label htmlFor="calendar" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon size={16} className="inline mr-1" />
                Calendar
              </label>
              <select
                id="calendar"
                value={formData.calendarId}
                onChange={(e) => {
                  const selectedCalendar = calendars.find(cal => cal.id === e.target.value);
                  setFormData({
                    ...formData,
                    calendarId: e.target.value,
                    color: selectedCalendar?.color || formData.color
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allDay"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="allDay" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                All day
              </label>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock size={16} className="inline mr-1" />
                  Start
                </label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  id="start"
                  value={formData.allDay
                    ? format(formData.start, 'yyyy-MM-dd')
                    : format(formData.start, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => handleDateTimeChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End
                </label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  id="end"
                  value={formData.allDay
                    ? format(formData.end, 'yyyy-MM-dd')
                    : format(formData.end, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => handleDateTimeChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Repeat */}
            <div>
              <label htmlFor="repeat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Repeat size={16} className="inline mr-1" />
                Repeat
              </label>
              <select
                id="repeat"
                value={rule?.frequency ?? 'none'}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>

              {rule && (
                <div className="mt-3 space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  {/* Interval */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="repeat-interval" className="text-sm text-gray-700 dark:text-gray-300">
                      Every
                    </label>
                    <input
                      type="number"
                      id="repeat-interval"
                      min={1}
                      max={999}
                      value={rule.interval}
                      onChange={(e) =>
                        setRule({ ...rule, interval: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {{ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[rule.frequency]}
                      {rule.interval === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Weekdays — weekly rules only */}
                  {rule.frequency === 'weekly' && (
                    <fieldset>
                      <legend className="mb-1.5 text-sm text-gray-700 dark:text-gray-300">On</legend>
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map((day) => {
                          const selected = rule.byWeekDay?.includes(day.value) ?? false;
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleWeekday(day.value)}
                              aria-pressed={selected}
                              aria-label={day.name}
                              className={
                                selected
                                  ? 'h-8 w-8 rounded-full bg-blue-600 text-xs font-semibold text-white transition-colors'
                                  : 'h-8 w-8 rounded-full bg-gray-100 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                              }
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      {!rule.byWeekDay?.length && (
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Repeats on {format(formData.start, 'EEEE')}, the day it starts.
                        </p>
                      )}
                    </fieldset>
                  )}

                  {/* Ends */}
                  <div>
                    <label htmlFor="repeat-ends" className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
                      Ends
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        id="repeat-ends"
                        value={endsMode}
                        onChange={(e) => handleEndsChange(e.target.value as RepeatEnds)}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="never">Never</option>
                        <option value="on">On date</option>
                        <option value="after">After</option>
                      </select>

                      {endsMode === 'on' && (
                        <input
                          type="date"
                          aria-label="Repeat until"
                          value={rule.endDate ? format(new Date(rule.endDate), 'yyyy-MM-dd') : ''}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            // End of the chosen day, so an occurrence on that day still counts.
                            const d = new Date(`${e.target.value}T23:59:59`);
                            setRule({ ...rule, endDate: d, count: undefined });
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}

                      {endsMode === 'after' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            aria-label="Number of occurrences"
                            min={1}
                            max={750}
                            value={rule.count ?? 10}
                            onChange={(e) =>
                              setRule({
                                ...rule,
                                count: Math.max(1, Number(e.target.value) || 1),
                                endDate: undefined,
                              })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">occurrences</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isRecurring && event && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Changes apply to every event in this series.
                </p>
              )}
            </div>

            {/* Location */}
            <div className="relative">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <MapPin size={16} className="inline mr-1" />
                Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="location"
                  autoComplete="off"
                  value={formData.location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search a place for its weather…"
                />
                {isSearchingLocation && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {locationResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-900">
                  {locationResults.map((result, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleLocationSelect(result)}
                        className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {result.name}
                        {result.admin1 ? `, ${result.admin1}` : ''}
                        {result.country ? `, ${result.country}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Per-event weather: forecast at this location and time. */}
              {formData.locationCoords && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {weatherLoading ? (
                    <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading weather…</span>
                  ) : eventWeather ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm" role="img" aria-label={eventWeather.description}>{eventWeather.emoji}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{Math.round(eventWeather.temperature)}°C</span>
                      <span className="capitalize">{eventWeather.description}</span>
                      {eventWeather.precipitationProbability != null && eventWeather.precipitationProbability > 0 && (
                        <span className="text-blue-500 dark:text-blue-400">· {Math.round(eventWeather.precipitationProbability)}% precip</span>
                      )}
                    </span>
                  ) : hasEventForecast(formData.start) ? (
                    <span>Weather unavailable for this location.</span>
                  ) : (
                    <span>Forecast only available within ~16 days.</span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event description"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {event ? 'Update' : 'Create'} Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventModal;

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/useApp';
import type { CalendarEvent } from '../types';
import { format } from 'date-fns';
import { X, Trash2, Calendar as CalendarIcon, Clock, MapPin, Loader2 } from 'lucide-react';
import { searchLocations, type GeocodingResult } from '../services/geocodingService';
import { getEventWeather, hasEventForecast, type EventWeather } from '../services/eventWeatherService';

interface EventModalProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date | null;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

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
  });

  // Location autocomplete + per-event weather state.
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [eventWeather, setEventWeather] = useState<EventWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // const [attendeeInput, setAttendeeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocationResults([]);
      setIsSearchingLocation(false);
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
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {event ? 'Edit Event' : 'New Event'}
            </h3>
            <div className="flex items-center space-x-2">
              {event && onDelete && (
                <button
                  onClick={onDelete}
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

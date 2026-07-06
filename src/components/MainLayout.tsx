import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/useApp';
import Calendar from './Calendar';
import EventModal from './EventModal';
import LocationPicker from './LocationPicker';
import type { CalendarEvent } from '../types';
import { Sun, Moon } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
} from 'date-fns';

const MainLayout: React.FC = () => {
  const {
    events,
    weatherData,
    viewState,
    location,
    dayWeatherCache,
    theme,
    setViewState,
    addEvent,
    updateEvent,
    deleteEvent,
    refreshWeatherData,
    fetchWeatherForDates,
    setLocation,
    setTheme,
    error,
    isLoading,
  } = useApp();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalDate, setEventModalDate] = useState<Date | null>(null);
  const [weatherErrorDismissed, setWeatherErrorDismissed] = useState(false);

  // Fetch Open-Meteo data for the currently visible date range
  useEffect(() => {
    if (!location) return;
    const d = viewState.currentDate;
    let start: Date;
    let end: Date;
    switch (viewState.viewType) {
      case 'month':
        start = startOfWeek(startOfMonth(d));
        end   = endOfWeek(endOfMonth(d));
        break;
      case 'week':
        start = startOfWeek(d, { weekStartsOn: 1 });
        end   = endOfWeek(d,   { weekStartsOn: 1 });
        break;
      case 'agenda':
        start = d;
        end   = addDays(d, 60);
        break;
      default: // day
        start = d;
        end   = d;
    }
    fetchWeatherForDates(start, end);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState.currentDate, viewState.viewType, location]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setViewState({ ...viewState, selectedDate: date });
  };

  const handleCreateEvent = (date: Date) => {
    setSelectedEvent(null);
    setEventModalDate(date);
    setIsEventModalOpen(true);
  };

  const handleEventSave = (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedEvent) {
      updateEvent({ ...selectedEvent, ...eventData, updatedAt: new Date() });
    } else {
      addEvent(eventData);
    }
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setEventModalDate(null);
  };

  const handleEventDelete = (eventId: string) => {
    deleteEvent(eventId);
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleModalClose = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setEventModalDate(null);
  };

  const showWeatherError = error?.code === 'WEATHER_FETCH_ERROR' && !weatherErrorDismissed;

  return (
    <div className="h-screen bg-white dark:bg-gray-900 relative overflow-hidden flex flex-col">
      {/* Slim top bar */}
      <header className="relative z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Kalendarski</h1>
          <LocationPicker currentLocation={weatherData?.location ?? location} onSelect={setLocation} />
        </div>

        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
          )}
          {weatherData?.current && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <img
                src={`https://openweathermap.org/img/wn/${weatherData.current.icon}.png`}
                alt={weatherData.current.condition.description}
                className="w-6 h-6"
              />
              <span className="font-medium">{Math.round(weatherData.current.temperature)}°C</span>
              <span className="text-gray-400 dark:text-gray-500 capitalize">{weatherData.current.condition.description}</span>
            </div>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Weather error banner */}
      {showWeatherError && (
        <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex-shrink-0">
          <span>{error!.message}</span>
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={() => { setWeatherErrorDismissed(false); refreshWeatherData(); }}
              className="font-medium underline hover:no-underline"
            >
              Retry
            </button>
            <button
              onClick={() => setWeatherErrorDismissed(true)}
              className="text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Calendar — fills remaining screen */}
      <main className="relative z-10 flex-1 overflow-hidden">
        <Calendar
          events={events}
          viewState={viewState}
          onViewStateChange={setViewState}
          onEventClick={handleEventClick}
          onDateClick={handleDateClick}
          onCreateEvent={handleCreateEvent}
          weatherData={weatherData}
          dayWeatherCache={dayWeatherCache}
          className="h-full"
        />
      </main>

      {/* Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        event={selectedEvent}
        initialDate={eventModalDate}
        onSave={handleEventSave}
        onDelete={selectedEvent ? () => handleEventDelete(selectedEvent.id) : undefined}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default MainLayout;

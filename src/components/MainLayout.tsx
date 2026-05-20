import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Calendar from './Calendar';
import WeatherHeatmapBackground from './WeatherHeatmapBackground';
import Sidebar from './Sidebar';
import EventModal from './EventModal';
import type { CalendarEvent } from '../types';
import { generateWeatherHeatmap } from '../utils/weatherHeatmap';
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
    setViewState,
    addEvent,
    updateEvent,
    deleteEvent,
    refreshWeatherData,
    fetchWeatherForDates,
    error,
    isLoading,
  } = useApp();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalDate, setEventModalDate] = useState<Date | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [weatherErrorDismissed, setWeatherErrorDismissed] = useState(false);

  // Generate weather heatmap data
  const weatherHeatmap = weatherData?.hourly && weatherData?.daily?.[0]
    ? generateWeatherHeatmap(
        weatherData.hourly,
        weatherData.daily[0].sunrise,
        weatherData.daily[0].sunset,
      )
    : undefined;

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
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Weather Heatmap Background */}
      <WeatherHeatmapBackground
        heatmapData={weatherHeatmap}
        weatherData={weatherData}
      />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen">
        <div className="flex h-screen">
          {/* Sidebar */}
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />

          {/* Main Calendar Area */}
          <main className={`flex-1 flex flex-col transition-all duration-300 ${
            isSidebarOpen ? 'ml-80' : 'ml-16'
          }`}>
            {/* Header with glass morphism effect */}
            <header className="glass border-b border-white/20 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold text-gray-900">Kalendarski</h1>
                  {weatherData?.location && (
                    <div className="text-sm text-gray-600">
                      {weatherData.location.city && weatherData.location.country
                        ? `${weatherData.location.city}, ${weatherData.location.country}`
                        : `${weatherData.location.latitude.toFixed(2)}, ${weatherData.location.longitude.toFixed(2)}`
                      }
                    </div>
                  )}
                </div>

                {/* Weather info */}
                {weatherData?.current && (
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <img
                        src={`https://openweathermap.org/img/wn/${weatherData.current.icon}@2x.png`}
                        alt={weatherData.current.condition.description}
                        className="w-8 h-8"
                      />
                      <span>{Math.round(weatherData.current.temperature)}°C</span>
                    </div>
                    <div className="text-xs">
                      {weatherData.current.condition.description}
                    </div>
                  </div>
                )}

                {/* Loading indicator for weather refresh */}
                {isLoading && !weatherData && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    <span>Loading weather…</span>
                  </div>
                )}
              </div>
            </header>

            {/* Weather error banner */}
            {showWeatherError && (
              <div className="flex items-center justify-between px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                <span>{error!.message}</span>
                <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                  <button
                    onClick={() => { setWeatherErrorDismissed(false); refreshWeatherData(); }}
                    className="font-medium underline hover:no-underline"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setWeatherErrorDismissed(true)}
                    className="text-amber-600 hover:text-amber-800"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Calendar Content */}
            <div className="flex-1 p-6 overflow-auto">
              <Calendar
                events={events}
                viewState={viewState}
                onViewStateChange={setViewState}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                onCreateEvent={handleCreateEvent}
                weatherHeatmap={weatherHeatmap}
                weatherData={weatherData}
                dayWeatherCache={dayWeatherCache}
                onRefreshWeather={refreshWeatherData}
                className="h-full"
              />
            </div>
          </main>
        </div>
      </div>

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

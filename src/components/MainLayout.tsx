import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Calendar from './Calendar';
import WeatherHeatmapBackground from './WeatherHeatmapBackground';
import Sidebar from './Sidebar';
import EventModal from './EventModal';
import TemperatureGradientDemo from './TemperatureGradientDemo';
import type {CalendarEvent} from '../types';
import { generateWeatherHeatmap } from '../utils/weatherHeatmap';

const MainLayout: React.FC = () => {
  const {
    events,
    weatherData,
    viewState,
    setViewState,
    addEvent,
    updateEvent,
    deleteEvent,
    refreshWeatherData,
    error,
    isLoading,
  } = useApp();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalDate, setEventModalDate] = useState<Date | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDemo, setShowDemo] = useState(false);

  // Generate weather heatmap data
  const weatherHeatmap = weatherData?.hourly && weatherData?.daily?.[0] 
    ? generateWeatherHeatmap(
        weatherData.hourly,
        weatherData.daily[0].sunrise,
        weatherData.daily[0].sunset
      )
    : undefined;

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-red-600 text-center mb-4">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Application Error</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      </div>
    );
  }

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

                <div className="flex items-center space-x-4">
                  {/* Demo Toggle Button */}
                  <button
                    onClick={() => setShowDemo(!showDemo)}
                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {showDemo ? 'Hide' : 'Show'} Gradient Demo
                  </button>

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
                </div>
              </div>
            </header>

            {/* Calendar Content */}
            <div className="flex-1 p-6 overflow-auto">
              {showDemo ? (
                <TemperatureGradientDemo />
              ) : isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading calendar...</p>
                  </div>
                </div>
              ) : (
                <Calendar
                  events={events}
                  viewState={viewState}
                  onViewStateChange={setViewState}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                  onCreateEvent={handleCreateEvent}
                  weatherHeatmap={weatherHeatmap}
                  onRefreshWeather={refreshWeatherData}
                  className="h-full"
                />
              )}
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

import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Calendar as CalendarIcon, Settings, Menu, RefreshCw, Plus } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { calendars, weatherData, refreshWeatherData, isLoading } = useApp();

  const handleRefreshWeather = async () => {
    await refreshWeatherData();
  };

  return (
    <div className={clsx(
      'fixed left-0 top-0 h-full bg-white/90 backdrop-blur-md border-r border-white/20 transition-all duration-300 z-20',
      isOpen ? 'w-80' : 'w-16'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu size={20} />
          </button>
          
          {isOpen && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefreshWeather}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-gray-100/50 transition-colors disabled:opacity-50"
                aria-label="Refresh weather data"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              
              <button
                className="p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
                aria-label="Settings"
              >
                <Settings size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Weather Summary */}
      {isOpen && weatherData && (
        <div className="p-4 border-b border-gray-200/50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Weather</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current</span>
              <div className="flex items-center space-x-2">
                <img 
                  src={`https://openweathermap.org/img/wn/${weatherData.current.icon}.png`}
                  alt={weatherData.current.condition.description}
                  className="w-6 h-6"
                />
                <span className="text-sm font-medium">
                  {Math.round(weatherData.current.temperature)}°C
                </span>
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Feels like {Math.round(weatherData.current.feelsLike)}°C
            </div>
            
            <div className="text-xs text-gray-500 capitalize">
              {weatherData.current.condition.description}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <span className="text-gray-500">Humidity</span>
                <div className="font-medium">{weatherData.current.humidity}%</div>
              </div>
              <div>
                <span className="text-gray-500">Wind</span>
                <div className="font-medium">{Math.round(weatherData.current.windSpeed)} m/s</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendars */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          {isOpen && (
            <>
              <h3 className="text-sm font-medium text-gray-700">Calendars</h3>
              <button
                className="p-1 rounded hover:bg-gray-100/50 transition-colors"
                aria-label="Add calendar"
              >
                <Plus size={14} />
              </button>
            </>
          )}
        </div>

        <div className="space-y-2">
          {calendars.map((calendar) => (
            <div
              key={calendar.id}
              className={clsx(
                'flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100/50 transition-colors cursor-pointer',
                !isOpen && 'justify-center'
              )}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: calendar.color }}
              />
              
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {calendar.name}
                  </div>
                  {calendar.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {calendar.description}
                    </div>
                  )}
                </div>
              )}
              
              {!isOpen && (
                <div className="sr-only">{calendar.name}</div>
              )}
            </div>
          ))}
        </div>

        {/* Mini calendar preview when collapsed */}
        {!isOpen && (
          <div className="mt-6 flex justify-center">
            <CalendarIcon size={20} className="text-gray-400" />
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {isOpen && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-gray-50/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">Quick Stats</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Calendars</span>
                <span className="font-medium">{calendars.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Events Today</span>
                <span className="font-medium">
                  {/* This would be calculated based on today's events */}
                  0
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

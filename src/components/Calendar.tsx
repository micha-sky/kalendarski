import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CalendarEvent, CalendarViewState, WeatherHeatmapData } from '../types';
import { clsx } from 'clsx';

interface CalendarProps {
  events: CalendarEvent[];
  viewState: CalendarViewState;
  onViewStateChange: (viewState: CalendarViewState) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onCreateEvent: (date: Date) => void;
  weatherHeatmap?: WeatherHeatmapData[];
  onRefreshWeather?: () => void;
  className?: string;
}

const Calendar: React.FC<CalendarProps> = ({
  events,
  viewState,
  onViewStateChange,
  onEventClick,
  onDateClick,
  onCreateEvent,
  weatherHeatmap,
  onRefreshWeather,
  className,
}) => {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const { currentDate, viewType } = viewState;

  // Auto-scroll to current hour in day view and refresh weather data
  React.useEffect(() => {
    if (viewType === 'day') {
      const currentHour = new Date().getHours();
      const isToday = isSameDay(currentDate, new Date());

      // Auto-scroll to current hour if viewing today
      if (isToday) {
        const timeline = document.getElementById('day-view-timeline');
        const currentHourElement = document.getElementById(`hour-${currentHour}`);
        if (timeline && currentHourElement) {
          setTimeout(() => {
            currentHourElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }, 100);
        }
      }

      // Refresh weather data when changing dates in day view
      // For now, we'll refresh weather data whenever the date changes in day view
      // since the current weather API provides data for the current day
      if (!isToday && onRefreshWeather) {
        // Only refresh if we're viewing a different day than today
        onRefreshWeather();
      }
    }
  }, [viewType, currentDate, weatherHeatmap, onRefreshWeather]);

  // Navigation handlers
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewType === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    onViewStateChange({ ...viewState, currentDate: newDate });
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewType === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    onViewStateChange({ ...viewState, currentDate: newDate });
  };

  const navigateToday = () => {
    onViewStateChange({ ...viewState, currentDate: new Date() });
  };

  // Get calendar days for month view
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (event.allDay) {
        return isSameDay(event.start, date);
      }
      return isSameDay(event.start, date) || isSameDay(event.end, date);
    });
  };



  const renderMonthView = () => {
    const days = getCalendarDays();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Create weather heatmap gradient style
    const weatherGradientStyle = weatherHeatmap && weatherHeatmap.length > 0 ? {
      background: `linear-gradient(135deg, ${weatherHeatmap.map((data, index) => {
        const percentage = weatherHeatmap.length === 1 ? 50 : (index / (weatherHeatmap.length - 1)) * 100;
        const hex = data.color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, 0.4) ${percentage}%`;
      }).join(', ')})`
    } : {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)'
    };

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Weather heatmap background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={weatherGradientStyle}
        />

        {/* Week day headers */}
        <div className="relative grid grid-cols-7 bg-white/80 backdrop-blur-sm border-b border-gray-200">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="relative grid grid-cols-7 gap-0">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = viewState.selectedDate && isSameDay(day, viewState.selectedDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  'relative min-h-[120px] p-2 border-r border-b border-white/20 cursor-pointer transition-all duration-150',
                  'hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
                  {
                    'bg-black/5': !isCurrentMonth,
                    'bg-blue-500/20 ring-2 ring-blue-400': isSelected,
                    'text-gray-500': !isCurrentMonth,
                  }
                )}
                onClick={() => onDateClick(day)}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                tabIndex={0}
                role="gridcell"
                aria-label={format(day, 'MMMM d, yyyy')}
              >

                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={clsx(
                      'text-sm font-medium',
                      {
                        'text-blue-600 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center shadow-sm': isTodayDate,
                        'text-gray-900 bg-white/60 px-1 rounded': isCurrentMonth && !isTodayDate,
                        'text-gray-500 bg-white/40 px-1 rounded': !isCurrentMonth,
                      }
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Add event button (visible on hover) */}
                  {hoveredDate && isSameDay(hoveredDate, day) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEvent(day);
                      }}
                      className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-sm"
                      aria-label="Add event"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={clsx(
                        'text-xs px-2 py-1 rounded text-white cursor-pointer truncate shadow-sm',
                        'hover:opacity-80 transition-opacity backdrop-blur-sm'
                      )}
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                      title={event.title}
                    >
                      {event.allDay ? event.title : `${format(event.start, 'HH:mm')} ${event.title}`}
                    </div>
                  ))}

                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-700 px-2 bg-white/60 rounded inline-block">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHeader = () => {
    const getTitle = () => {
      switch (viewType) {
        case 'month':
          return format(currentDate, 'MMMM yyyy');
        case 'week':
          const weekStart = startOfWeek(currentDate);
          const weekEnd = endOfWeek(currentDate);
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
        case 'day':
          return format(currentDate, 'EEEE, MMMM d, yyyy');
        default:
          return format(currentDate, 'MMMM yyyy');
      }
    };

    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={navigatePrevious}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>
            
            <button
              onClick={navigateToday}
              className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Today
            </button>
            
            <button
              onClick={navigateNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View type selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['month', 'week', 'day'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onViewStateChange({ ...viewState, viewType: type })}
                className={clsx(
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize',
                  {
                    'bg-white text-gray-900 shadow-sm': viewType === type,
                    'text-gray-600 hover:text-gray-900': viewType !== type,
                  }
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={() => onCreateEvent(currentDate)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>New Event</span>
          </button>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const currentHour = new Date().getHours();
    const today = new Date();

    // Get events for the entire week
    const getEventsForWeek = () => {
      return events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });
    };

    // Get events for a specific day and hour
    const getEventsForDayAndHour = (day: Date, hour: number) => {
      return getEventsForWeek().filter(event => {
        if (!isSameDay(new Date(event.start), day)) return false;

        if (event.allDay) return hour === 0; // Show all-day events at midnight

        const eventStartHour = event.start.getHours();
        const eventEndHour = event.end.getHours();
        return hour >= eventStartHour && hour <= eventEndHour;
      });
    };

    // Get all-day events for the week
    const getAllDayEvents = () => {
      return getEventsForWeek().filter(event => event.allDay);
    };

    // Get all-day events for a specific day
    const getAllDayEventsForDay = (day: Date) => {
      return getAllDayEvents().filter(event =>
        isSameDay(new Date(event.start), day)
      );
    };

    // Get all events for a specific day
    const getEventsForDay = (day: Date) => {
      return getEventsForWeek().filter(event =>
        isSameDay(new Date(event.start), day)
      );
    };

    // Create weather gradient for a specific day (if weather data available)
    const createDayWeatherGradient = (day: Date) => {
      if (!weatherHeatmap || weatherHeatmap.length === 0) {
        return 'linear-gradient(to bottom, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 50%, rgba(239, 68, 68, 0.05) 100%)';
      }

      // For now, use the same weather data for all days (in a real app, you'd have daily weather data)
      const sortedHeatmap = [...weatherHeatmap].sort((a, b) => a.hour - b.hour);
      const gradientStops = sortedHeatmap.map((data) => {
        const percentage = (data.hour / 23) * 100;
        const hex = data.color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, 0.1) ${percentage}%`;
      });

      return `linear-gradient(to bottom, ${gradientStops.join(', ')})`;
    };

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Week view header */}
        <div className="bg-white border-b border-gray-200">
          {/* Week title */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
              {weatherHeatmap && weatherHeatmap.length > 0 && (
                <div className="text-sm text-gray-600">
                  🌡️ Weather-enhanced timeline
                </div>
              )}
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            {/* Time column header */}
            <div className="p-3 text-center text-sm font-medium text-gray-500 border-r border-gray-200">
              Time
            </div>

            {/* Day headers */}
            {weekDays.map((day) => {
              const isCurrentDay = isSameDay(day, today);
              const dayEvents = getEventsForDay(day);

              return (
                <div
                  key={day.toISOString()}
                  className={clsx(
                    'p-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors',
                    {
                      'bg-blue-50 border-blue-200': isCurrentDay,
                    }
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div className={clsx(
                    'text-sm font-medium',
                    {
                      'text-blue-600': isCurrentDay,
                      'text-gray-900': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={clsx(
                    'text-lg font-semibold mt-1',
                    {
                      'text-blue-600': isCurrentDay,
                      'text-gray-700': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All-day events section */}
          {getAllDayEvents().length > 0 && (
            <div className="border-b border-gray-200 bg-gray-50/50">
              <div className="grid grid-cols-8">
                {/* All-day label */}
                <div className="p-2 text-center text-xs font-medium text-gray-500 border-r border-gray-200 flex items-center justify-center">
                  All Day
                </div>

                {/* All-day events for each day */}
                {weekDays.map((day) => {
                  const dayAllDayEvents = getAllDayEventsForDay(day);

                  return (
                    <div
                      key={`allday-${day.toISOString()}`}
                      className="p-1 border-r border-gray-200 last:border-r-0 min-h-[40px]"
                    >
                      {dayAllDayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={clsx(
                            'text-xs p-1 mb-1 rounded cursor-pointer truncate shadow-sm',
                            {
                              'bg-blue-500 text-white': event.calendarId === 'personal',
                              'bg-green-500 text-white': event.calendarId === 'work',
                              'bg-purple-500 text-white': event.calendarId === 'other',
                            }
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Week grid with hours */}
        <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <div className="relative">
            {hours.map((hour) => {
              const isCurrentHour = isSameDay(currentDate, today) && hour === currentHour;

              return (
                <div
                  key={hour}
                  className={clsx(
                    'grid grid-cols-8 border-b border-gray-100 min-h-[60px]',
                    {
                      'bg-blue-50/50': isCurrentHour,
                    }
                  )}
                >
                  {/* Time column */}
                  <div className="p-2 text-center text-sm text-gray-500 border-r border-gray-200 flex items-center justify-center">
                    <div>
                      <div className="font-medium">
                        {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}
                      </div>
                      <div className="text-xs">
                        {hour < 12 ? 'AM' : 'PM'}
                      </div>
                    </div>
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day) => {
                    const dayEvents = getEventsForDayAndHour(day, hour);
                    const isCurrentDay = isSameDay(day, today);

                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={clsx(
                          'relative border-r border-gray-200 last:border-r-0 p-1 hover:bg-gray-50/50 transition-colors cursor-pointer',
                          {
                            'bg-blue-50/30': isCurrentDay && isCurrentHour,
                          }
                        )}
                        style={{
                          background: isCurrentDay ? createDayWeatherGradient(day) : undefined,
                        }}
                        onClick={() => {
                          const eventDate = new Date(day);
                          eventDate.setHours(hour, 0, 0, 0);
                          onCreateEvent(eventDate);
                        }}
                      >
                        {/* Events for this hour */}
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className={clsx(
                              'text-xs p-1 mb-1 rounded cursor-pointer truncate shadow-sm',
                              {
                                'bg-blue-500 text-white': event.calendarId === 'personal',
                                'bg-green-500 text-white': event.calendarId === 'work',
                                'bg-purple-500 text-white': event.calendarId === 'other',
                              }
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            title={`${event.title}\n${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`}
                          >
                            {event.title}
                          </div>
                        ))}

                        {/* Add event button on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDate(currentDate);
    const currentHour = new Date().getHours();
    const isToday = isSameDay(currentDate, new Date());

    // Create vertical weather gradient for the entire day
    const createVerticalWeatherGradient = () => {
      if (!weatherHeatmap || weatherHeatmap.length === 0) {
        return 'linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 50%, rgba(239, 68, 68, 0.1) 100%)';
      }

      // Sort heatmap data by hour to ensure proper order
      const sortedHeatmap = [...weatherHeatmap].sort((a, b) => a.hour - b.hour);

      // Create gradient stops for each hour
      const gradientStops = sortedHeatmap.map((data) => {
        const percentage = (data.hour / 23) * 100; // Map hour 0-23 to 0-100%
        const hex = data.color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, 0.3) ${percentage}%`;
      });

      return `linear-gradient(to bottom, ${gradientStops.join(', ')})`;
    };



    // Get events for a specific hour
    const getEventsForHour = (hour: number) => {
      return dayEvents.filter(event => {
        if (event.allDay) return hour === 0; // Show all-day events at midnight
        const eventHour = event.start.getHours();
        const eventEndHour = event.end.getHours();
        return hour >= eventHour && hour <= eventEndHour;
      });
    };

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Vertical weather gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: createVerticalWeatherGradient() }}
        />

        {/* Day view header */}
        <div className="relative bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              {weatherHeatmap && weatherHeatmap.length > 0 && (
                <div className="text-sm text-gray-600 mt-1">
                  🌡️ Weather-based timeline colors
                </div>
              )}
            </div>
            {isToday && (
              <div className="text-right">
                <div className="text-sm text-blue-600 font-medium">
                  Current time: {format(new Date(), 'HH:mm')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Auto-scrolled to current hour
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hours timeline */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          id="day-view-timeline"
          style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '600px' }}
        >
          <div className="relative min-h-full">
            {hours.map((hour) => {
              const hourEvents = getEventsForHour(hour);
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <div
                  key={hour}
                  id={`hour-${hour}`}
                  className={clsx(
                    'relative border-b border-white/20 min-h-[80px] flex hover:bg-white/10 transition-colors',
                    {
                      'bg-blue-500/20 border-blue-300 shadow-sm': isCurrentHour,
                    }
                  )}
                  onMouseEnter={() => setHoveredDate(currentDate)}
                  onMouseLeave={() => setHoveredDate(null)}
                >

                  {/* Time column */}
                  <div className="w-24 flex-shrink-0 p-3 border-r border-white/30 bg-white/90 backdrop-blur-sm">
                    <div className={clsx(
                      'text-sm font-medium',
                      {
                        'text-blue-600': isCurrentHour,
                        'text-gray-900': !isCurrentHour,
                      }
                    )}>
                      {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                    </div>
                    <div className={clsx(
                      'text-xs',
                      {
                        'text-blue-500': isCurrentHour,
                        'text-gray-500': !isCurrentHour,
                      }
                    )}>
                      {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                    </div>
                  </div>

                  {/* Events column */}
                  <div className="flex-1 p-3 relative">
                    {/* Current time indicator */}
                    {isCurrentHour && (
                      <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-blue-500 z-10">
                        <div className="absolute left-0 w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1/2"></div>
                      </div>
                    )}

                    {/* Events */}
                    <div className="space-y-1">
                      {hourEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className={clsx(
                            'text-sm px-3 py-2 rounded-lg text-white cursor-pointer',
                            'hover:opacity-80 transition-opacity shadow-sm backdrop-blur-sm',
                            {
                              'opacity-60': event.allDay,
                            }
                          )}
                          style={{ backgroundColor: event.color || '#3b82f6' }}
                          title={event.description || event.title}
                        >
                          <div className="font-medium">{event.title}</div>
                          {!event.allDay && (
                            <div className="text-xs opacity-90">
                              {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                            </div>
                          )}
                          {event.location && (
                            <div className="text-xs opacity-75 mt-1">
                              📍 {event.location}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add event button (on hover) */}
                    {hoveredDate && isSameDay(hoveredDate, currentDate) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const eventDate = new Date(currentDate);
                          eventDate.setHours(hour, 0, 0, 0);
                          onCreateEvent(eventDate);
                        }}
                        className="absolute right-2 top-2 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-sm"
                        aria-label={`Add event at ${hour}:00`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {renderHeader()}
      
      {viewType === 'month' && renderMonthView()}

      {viewType === 'week' && renderWeekView()}

      {viewType === 'day' && renderDayView()}
    </div>
  );
};

export default Calendar;

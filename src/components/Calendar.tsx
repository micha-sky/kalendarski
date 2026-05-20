import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CalendarEvent, CalendarViewState, WeatherHeatmapData, WeatherForecast, DayCacheEntry } from '../types';
import { clsx } from 'clsx';
import { temperatureToRgba, interpolateDailyTemp } from '../utils/weatherHeatmap';

interface CalendarProps {
  events: CalendarEvent[];
  viewState: CalendarViewState;
  onViewStateChange: (viewState: CalendarViewState) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onCreateEvent: (date: Date) => void;
  weatherHeatmap?: WeatherHeatmapData[];
  weatherData?: WeatherForecast | null;
  dayWeatherCache?: Record<string, DayCacheEntry>;
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
  weatherData,
  dayWeatherCache,
  onRefreshWeather,
  className,
}) => {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Returns an rgba background color for a given day (+ optional hour).
  // Prefers the Open-Meteo day cache (full history + forecast), falls back to OWM data.
  const getCellColor = (day: Date, hour?: number): string | undefined => {
    const dayKey = format(day, 'yyyy-MM-dd');

    // --- Primary: Open-Meteo day cache (covers past + future for any date) ---
    const cacheEntry = dayWeatherCache?.[dayKey];
    if (cacheEntry) {
      const isNight = (h: number) => h < cacheEntry.sunriseHour || h > cacheEntry.sunsetHour;

      if (hour !== undefined) {
        const temp = cacheEntry.hourlyTemps[hour];
        if (temp != null) return temperatureToRgba(temp, isNight(hour), 0.28);
        // Null slot (future hour not yet modelled) — interpolate from neighbours
        const filled = cacheEntry.hourlyTemps
          .map((t, i) => (t != null ? { h: i, t } : null))
          .filter(Boolean) as { h: number; t: number }[];
        if (filled.length) {
          const before = [...filled].reverse().find(p => p.h <= hour) ?? filled[0];
          const after  = filled.find(p => p.h > hour) ?? filled[filled.length - 1];
          const factor = before === after ? 0 : (hour - before.h) / (after.h - before.h);
          return temperatureToRgba(before.t + factor * (after.t - before.t), isNight(hour), 0.28);
        }
      } else {
        // Day-level: average of valid hourly readings
        const valid = cacheEntry.hourlyTemps.filter((t): t is number => t != null);
        if (valid.length) {
          const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
          return temperatureToRgba(avg, false, 0.22);
        }
      }
    }

    // --- Fallback: OWM weatherData (today's hourly + 5-day forecast) ---
    if (!weatherData) return undefined;
    const daily = weatherData.daily;
    if (!daily.length) return undefined;

    const sunriseHour = new Date(daily[0].sunrise * 1000).getHours();
    const sunsetHour  = new Date(daily[0].sunset  * 1000).getHours();
    const isNight     = (h: number) => h < sunriseHour || h > sunsetHour;

    if (hour !== undefined) {
      if (isSameDay(day, new Date()) && weatherData.hourly.length) {
        const pts = weatherData.hourly
          .map(d => ({ h: new Date(d.timestamp * 1000).getHours(), t: d.temperature }))
          .sort((a, b) => a.h - b.h);
        const before = [...pts].reverse().find(p => p.h <= hour) ?? pts[0];
        const after  = pts.find(p => p.h > hour) ?? pts[pts.length - 1];
        const factor = before === after ? 0 : (hour - before.h) / (after.h - before.h);
        return temperatureToRgba(before.t + factor * (after.t - before.t), isNight(hour), 0.28);
      }
      const dayData = daily.find(d => d.date === dayKey);
      if (!dayData) return undefined;
      return temperatureToRgba(interpolateDailyTemp(hour, dayData.temperatureMin, dayData.temperatureMax), isNight(hour), 0.22);
    } else {
      if (isSameDay(day, new Date())) {
        return temperatureToRgba(weatherData.current.temperature, false, 0.22);
      }
      const dayData = daily.find(d => d.date === dayKey);
      if (!dayData) return undefined;
      return temperatureToRgba((dayData.temperatureMin + dayData.temperatureMax) / 2, false, 0.22);
    }
  };

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

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-white border-b border-gray-200">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = viewState.selectedDate && isSameDay(day, viewState.selectedDate);
            const isTodayDate = isToday(day);
            const cellColor = getCellColor(day);

            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  'relative min-h-[120px] p-2 border-r border-b border-gray-200/60 cursor-pointer transition-all duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
                  {
                    'ring-2 ring-inset ring-blue-400': isSelected,
                    'opacity-50': !isCurrentMonth,
                    'text-gray-500': !isCurrentMonth,
                  }
                )}
                style={{ backgroundColor: cellColor ?? (isCurrentMonth ? 'white' : '#f9fafb') }}
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
                        'text-white bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center shadow-sm': isTodayDate,
                        'text-gray-900': isCurrentMonth && !isTodayDate,
                        'text-gray-400': !isCurrentMonth,
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
                      className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"
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
            {(['month', 'week', 'day', 'agenda'] as const).map((type) => (
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

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Week view header */}
        <div className="bg-white border-b border-gray-200">
          {/* Week title */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
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
                          className="text-xs p-1 mb-1 rounded cursor-pointer truncate shadow-sm text-white"
                          style={{ backgroundColor: event.color || '#3b82f6' }}
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
                        className="relative border-r border-gray-200 last:border-r-0 p-1 transition-colors cursor-pointer hover:brightness-95"
                        style={{ backgroundColor: getCellColor(day, hour) ?? 'white' }}
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
                            className="text-xs p-1 mb-1 rounded cursor-pointer truncate shadow-sm text-white"
                            style={{ backgroundColor: event.color || '#3b82f6' }}
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
      <div className="flex-1 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Day view header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            {isToday && (
              <div className="text-sm text-blue-600 font-medium">
                {format(new Date(), 'HH:mm')}
              </div>
            )}
          </div>
        </div>

        {/* Hours timeline */}
        <div
          className="flex-1 overflow-y-auto"
          id="day-view-timeline"
          style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '600px' }}
        >
          <div className="relative min-h-full">
            {hours.map((hour) => {
              const hourEvents = getEventsForHour(hour);
              const isCurrentHour = isToday && hour === currentHour;
              const hourColor = getCellColor(currentDate, hour);

              return (
                <div
                  key={hour}
                  id={`hour-${hour}`}
                  className="relative border-b border-black/5 min-h-[80px] flex hover:brightness-95 transition-all"
                  style={{ backgroundColor: hourColor ?? 'white' }}
                  onMouseEnter={() => setHoveredDate(currentDate)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {/* Current-hour highlight bar */}
                  {isCurrentHour && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-blue-400 pointer-events-none" />
                  )}

                  {/* Time column */}
                  <div className="w-24 flex-shrink-0 p-3 border-r border-black/10 bg-white/80 backdrop-blur-sm">
                    <div className={clsx('text-sm font-medium', isCurrentHour ? 'text-blue-600' : 'text-gray-900')}>
                      {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                    </div>
                    <div className={clsx('text-xs', isCurrentHour ? 'text-blue-500' : 'text-gray-500')}>
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

  const renderAgendaView = () => {
    const windowEnd = addDays(currentDate, 60);

    // Collect events within the 60-day window, sorted by start
    const windowEvents = events
      .filter(event => {
        const start = new Date(event.start);
        return !isBefore(windowEnd, start) && !isBefore(start, currentDate);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (windowEvents.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No events in the next 60 days
        </div>
      );
    }

    // Group by date string
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of windowEvents) {
      const key = format(new Date(event.start), 'yyyy-MM-dd');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }

    return (
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm divide-y divide-gray-100">
        {Array.from(groups.entries()).map(([key, dayEvents]) => {
          const date = new Date(key);
          const todayDate = isToday(date);
          return (
            <div key={key} className="flex">
              {/* Date column */}
              <div className={clsx(
                'w-36 flex-shrink-0 p-4 border-r border-gray-100',
                todayDate ? 'bg-blue-50' : 'bg-gray-50/50'
              )}>
                <div className={clsx('text-sm font-semibold', todayDate ? 'text-blue-600' : 'text-gray-900')}>
                  {format(date, 'EEE, MMM d')}
                </div>
                {todayDate && <div className="text-xs text-blue-500 mt-0.5">Today</div>}
              </div>

              {/* Events column */}
              <div className="flex-1 divide-y divide-gray-50">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-3"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{event.title}</div>
                      {event.location && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">📍 {event.location}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                      {event.allDay ? 'All day' : `${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {renderHeader()}

      {viewType === 'month' && renderMonthView()}

      {viewType === 'week' && renderWeekView()}

      {viewType === 'day' && renderDayView()}

      {viewType === 'agenda' && renderAgendaView()}
    </div>
  );
};

export default Calendar;

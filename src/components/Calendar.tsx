import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CalendarEvent, CalendarViewState, WeatherForecast, DayCacheEntry } from '../types';
import { clsx } from 'clsx';
import { temperatureToRgba, interpolateDailyTemp, temperatureToRgbaEnhanced, daytimeColorFromRange } from '../utils/weatherHeatmap';

interface CalendarProps {
  events: CalendarEvent[];
  viewState: CalendarViewState;
  onViewStateChange: (viewState: CalendarViewState) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onCreateEvent: (date: Date) => void;
  weatherData?: WeatherForecast | null;
  dayWeatherCache?: Record<string, DayCacheEntry>;
  className?: string;
}

// Renders a tiny canvas (1px per cell) that the browser bilinearly upscales —
// giving a seamless 2D gradient across the whole calendar grid.
const GradientCanvas = ({
  colors,
  style,
}: {
  colors: (string | undefined)[][];
  style?: React.CSSProperties;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rows = colors.length;
    const cols = colors[0]?.length ?? 0;
    if (!rows || !cols) return;

    el.width = cols;
    el.height = rows;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = colors[r][c] ?? 'rgb(248,250,252)';
        ctx.fillRect(c, r, 1, 1);
      }
    }
  }, [colors]);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        imageRendering: 'auto',
        zIndex: 0,
        ...style,
      }}
    />
  );
};

const Calendar: React.FC<CalendarProps> = ({
  events,
  viewState,
  onViewStateChange,
  onEventClick,
  onDateClick,
  onCreateEvent,
  weatherData,
  dayWeatherCache,
  className,
}) => {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Period-wide temp range (for month-view cross-day normalization)
  const { periodMin, periodMax } = useMemo(() => {
    if (!dayWeatherCache || Object.keys(dayWeatherCache).length === 0) {
      return { periodMin: 0, periodMax: 30 };
    }
    let min = Infinity, max = -Infinity;
    for (const entry of Object.values(dayWeatherCache)) {
      for (const t of entry.hourlyTemps) {
        if (t != null) {
          if (t < min) min = t;
          if (t > max) max = t;
        }
      }
    }
    return {
      periodMin: isFinite(min) ? min : 0,
      periodMax: isFinite(max) ? max : 30,
    };
  }, [dayWeatherCache]);

  // Returns an rgba background color for a given day (+ optional hour).
  // Prefers the Open-Meteo day cache (full history + forecast), falls back to OWM data.
  const getCellColor = (day: Date, hour?: number): string | undefined => {
    const dayKey = format(day, 'yyyy-MM-dd');

    // --- Primary: Open-Meteo day cache (covers past + future for any date) ---
    const cacheEntry = dayWeatherCache?.[dayKey];
    if (cacheEntry) {
      const validTemps = cacheEntry.hourlyTemps.filter((t): t is number => t != null);
      const dayMin = validTemps.length ? Math.min(...validTemps) : 0;
      const dayMax = validTemps.length ? Math.max(...validTemps) : 30;

      if (hour !== undefined) {
        const temp = cacheEntry.hourlyTemps[hour];
        if (temp != null) {
          return temperatureToRgbaEnhanced(temp, hour, cacheEntry.sunriseHour, cacheEntry.sunsetHour, dayMin, dayMax);
        }
        // Null slot — interpolate from neighbours
        const filled = cacheEntry.hourlyTemps
          .map((t, i) => (t != null ? { h: i, t } : null))
          .filter(Boolean) as { h: number; t: number }[];
        if (filled.length) {
          const before = [...filled].reverse().find(p => p.h <= hour) ?? filled[0];
          const after  = filled.find(p => p.h > hour) ?? filled[filled.length - 1];
          const factor = before === after ? 0 : (hour - before.h) / (after.h - before.h);
          const interp = before.t + factor * (after.t - before.t);
          return temperatureToRgbaEnhanced(interp, hour, cacheEntry.sunriseHour, cacheEntry.sunsetHour, dayMin, dayMax);
        }
      } else {
        // Day-level (month view): daytime average normalized against period range
        return daytimeColorFromRange(cacheEntry.hourlyTemps, cacheEntry.sunriseHour, cacheEntry.sunsetHour, periodMin, periodMax);
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

  // --- Weather badge helpers ---
  const getWeatherEmoji = (cloudPct: number, rainPct: number): string => {
    if (rainPct > 60) return '🌧️';
    if (rainPct > 20) return '🌦️';
    if (cloudPct < 20) return '☀️';
    if (cloudPct < 50) return '🌤️';
    if (cloudPct < 75) return '⛅';
    return '☁️';
  };

  const getDayWeather = (day: Date): { temp: number; emoji: string; rainPercent: number } | null => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const entry = dayWeatherCache?.[dayKey];

    if (entry) {
      const daytimeSlots: number[] = [];
      for (let h = entry.sunriseHour; h <= entry.sunsetHour; h++) daytimeSlots.push(h);

      const daytimeTemps = daytimeSlots.map(h => entry.hourlyTemps[h]).filter((t): t is number => t != null);
      const daytimeClouds = daytimeSlots.map(h => entry.cloudCover[h]).filter((c): c is number => c != null);
      const allPrecip = (entry.precipitationProbability ?? []).filter((p): p is number => p != null);

      if (!daytimeTemps.length) return null;

      const avgTemp = daytimeTemps.reduce((a, b) => a + b, 0) / daytimeTemps.length;
      const avgCloud = daytimeClouds.length
        ? daytimeClouds.reduce((a, b) => a + b, 0) / daytimeClouds.length
        : 0;
      const maxRain = allPrecip.length ? Math.max(...allPrecip) : 0;

      return { temp: Math.round(avgTemp), emoji: getWeatherEmoji(avgCloud, maxRain), rainPercent: Math.round(maxRain) };
    }

    // Fallback: OWM daily data
    const dayData = weatherData?.daily.find(d => d.date === dayKey);
    if (dayData) {
      const avgTemp = (dayData.temperatureMin + dayData.temperatureMax) / 2;
      const rainPercent = Math.round(dayData.precipitationProbability ?? 0);
      return { temp: Math.round(avgTemp), emoji: getWeatherEmoji(dayData.cloudCover, rainPercent), rainPercent };
    }

    return null;
  };

  const { currentDate, viewType } = viewState;

  // Auto-scroll to the current hour when viewing today in day view.
  // (Weather for arbitrary dates is fetched by MainLayout's range effect,
  // so there's no need to trigger a refresh from here.)
  useEffect(() => {
    if (viewType !== 'day') return;
    if (!isSameDay(currentDate, new Date())) return;

    const currentHour = new Date().getHours();
    const timeline = document.getElementById('day-view-timeline');
    const currentHourElement = document.getElementById(`hour-${currentHour}`);
    if (timeline && currentHourElement) {
      const id = setTimeout(() => {
        currentHourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(id);
    }
  }, [viewType, currentDate]);

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
    const numWeeks = Math.ceil(days.length / 7);

    // 2D color grid for the gradient canvas.
    // Out-of-month cells get a neutral color so they fade naturally at the edges.
    const colorGrid: string[][] = Array.from({ length: numWeeks }, (_, r) =>
      days.slice(r * 7, (r + 1) * 7).map(day =>
        isSameMonth(day, currentDate)
          ? (getCellColor(day) ?? 'rgb(248,250,252)')
          : 'rgb(243,244,246)'
      )
    );

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-white/30 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-white/70 backdrop-blur-sm border-b border-white/30">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — canvas provides the seamless gradient; cells are transparent */}
        <div className="relative grid grid-cols-7">
          <GradientCanvas colors={colorGrid} />

          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = viewState.selectedDate && isSameDay(day, viewState.selectedDate);
            const isTodayDate = isToday(day);
            const dayWeather = getDayWeather(day);
            const isHovered = hoveredDate && isSameDay(hoveredDate, day);

            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  'relative min-h-[100px] p-2 border-r border-b border-black/[0.06] cursor-pointer z-[1]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                  { 'text-gray-400': !isCurrentMonth }
                )}
                onClick={() => onDateClick(day)}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                tabIndex={0}
                role="gridcell"
                aria-label={format(day, 'MMMM d, yyyy')}
              >
                {/* Selection / hover highlight */}
                {isSelected && (
                  <div className="absolute inset-0 ring-2 ring-inset ring-blue-400/60 pointer-events-none rounded-sm" style={{ zIndex: 20 }} />
                )}
                {isHovered && !isSelected && (
                  <div className="absolute inset-0 bg-white/20 pointer-events-none" style={{ zIndex: 20 }} />
                )}

                {/* Date number + weather badge / add button */}
                <div className="flex items-start justify-between mb-1">
                  <span
                    className={clsx(
                      'text-sm font-medium leading-none',
                      {
                        'text-white bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center shadow-sm': isTodayDate,
                        'text-gray-800': isCurrentMonth && !isTodayDate,
                        'text-gray-400': !isCurrentMonth,
                      }
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="flex flex-col items-end gap-0.5">
                    {dayWeather && !isHovered && (
                      <div className="flex items-center gap-0.5 text-[9px] leading-none text-gray-700/80">
                        <span>{dayWeather.emoji}</span>
                        <span className="font-medium">{dayWeather.temp}°</span>
                        {dayWeather.rainPercent > 0 && (
                          <span className="text-blue-600/80">💧{dayWeather.rainPercent}%</span>
                        )}
                      </div>
                    )}
                    {isHovered && (
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
                      className="text-xs px-2 py-1 rounded text-white cursor-pointer truncate shadow-sm hover:opacity-80 transition-opacity backdrop-blur-sm"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                      title={event.title}
                    >
                      {event.allDay ? event.title : `${format(event.start, 'HH:mm')} ${event.title}`}
                    </div>
                  ))}

                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-700 px-2 bg-white/50 rounded inline-block">
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
        case 'week': {
          const weekStart = startOfWeek(currentDate);
          const weekEnd = endOfWeek(currentDate);
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
        }
        case 'day':
          return format(currentDate, 'EEEE, MMMM d, yyyy');
        default:
          return format(currentDate, 'MMMM yyyy');
      }
    };

    return (
      <div className="flex items-center justify-between">
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
              const dayWeather = getDayWeather(day);

              return (
                <div
                  key={day.toISOString()}
                  className={clsx(
                    'p-2 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors',
                    {
                      'bg-blue-50 border-blue-200': isCurrentDay,
                    }
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div className={clsx(
                    'text-xs font-medium',
                    {
                      'text-blue-600': isCurrentDay,
                      'text-gray-900': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={clsx(
                    'text-lg font-semibold mt-0.5',
                    {
                      'text-blue-600': isCurrentDay,
                      'text-gray-700': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'd')}
                  </div>
                  {dayWeather && (
                    <div className="flex items-center justify-center gap-0.5 text-[9px] leading-none text-gray-600 mt-1">
                      <span>{dayWeather.emoji}</span>
                      <span>{dayWeather.temp}°</span>
                      {dayWeather.rainPercent > 0 && (
                        <span className="text-blue-500">💧{dayWeather.rainPercent}%</span>
                      )}
                    </div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="text-[9px] text-gray-400 mt-0.5">
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
          {/* Gradient canvas covers the 7 day columns (skips the 12.5% time column) */}
          {(() => {
            const weekColorGrid: string[][] = Array.from({ length: 24 }, (_, hour) =>
              weekDays.map(day => getCellColor(day, hour) ?? 'rgb(248,250,252)')
            );
            return (
              <div className="relative">
                <GradientCanvas
                  colors={weekColorGrid}
                  style={{ left: '12.5%', width: '87.5%', top: 0, bottom: 0, height: 'auto' }}
                />
                {Array.from({ length: 24 }, (_, hour) => {
                  const isCurrentHour = isSameDay(currentDate, today) && hour === currentHour;
                  return (
                    <div
                      key={hour}
                      className="grid grid-cols-8 border-b border-black/[0.05] min-h-[60px]"
                    >
                      {/* Time column — opaque so it stays legible */}
                      <div className="p-2 text-center text-sm text-gray-500 border-r border-black/[0.07] flex items-center justify-center bg-white/80 backdrop-blur-sm">
                        <div>
                          <div className={clsx('font-medium', isCurrentHour && 'text-blue-600')}>
                            {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}
                          </div>
                          <div className="text-xs">{hour < 12 ? 'AM' : 'PM'}</div>
                        </div>
                      </div>

                      {/* Day columns — transparent, canvas gradient shows through */}
                      {weekDays.map((day) => {
                        const dayEvents = getEventsForDayAndHour(day, hour);
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className={clsx(
                              'relative border-r border-black/[0.05] last:border-r-0 p-1 cursor-pointer z-[1]',
                              'hover:bg-white/20 transition-colors',
                              isCurrentHour && 'ring-1 ring-inset ring-blue-400/40'
                            )}
                            onClick={() => {
                              const eventDate = new Date(day);
                              eventDate.setHours(hour, 0, 0, 0);
                              onCreateEvent(eventDate);
                            }}
                          >
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
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                              <Plus className="w-4 h-4 text-gray-400/60" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
        {(() => {
          const hours24 = Array.from({ length: 24 }, (_, i) => i);
          const gradientStops = hours24
            .map((h, i) => `${getCellColor(currentDate, h) ?? 'rgb(248,250,252)'} ${((i / 23) * 100).toFixed(1)}%`)
            .join(', ');
          const bgGradient = `linear-gradient(to bottom, ${gradientStops})`;
          return (
        <div
          className="flex-1 overflow-y-auto"
          id="day-view-timeline"
          style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '600px', background: bgGradient }}
        >
          <div className="relative min-h-full">
            {hours.map((hour) => {
              const hourEvents = getEventsForHour(hour);
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <div
                  key={hour}
                  id={`hour-${hour}`}
                  className="relative border-b border-black/[0.05] min-h-[80px] flex hover:bg-white/10 transition-colors"
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
          );
        })()}
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
          const dayWeather = getDayWeather(date);
          return (
            <div key={key} className="flex">
              {/* Date column */}
              <div className={clsx(
                'w-36 flex-shrink-0 p-3 border-r border-gray-100',
                todayDate ? 'bg-blue-50' : 'bg-gray-50/50'
              )}>
                <div className={clsx('text-sm font-semibold', todayDate ? 'text-blue-600' : 'text-gray-900')}>
                  {format(date, 'EEE, MMM d')}
                </div>
                {todayDate && <div className="text-xs text-blue-500 mt-0.5">Today</div>}
                {dayWeather && (
                  <div className="flex items-center gap-0.5 text-[10px] leading-none text-gray-500 mt-1.5">
                    <span>{dayWeather.emoji}</span>
                    <span>{dayWeather.temp}°</span>
                    {dayWeather.rainPercent > 0 && (
                      <span className="text-blue-500 ml-0.5">💧{dayWeather.rainPercent}%</span>
                    )}
                  </div>
                )}
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
    <div className={clsx('flex flex-col h-full overflow-hidden', className)}>
      <div className="px-4 py-3 flex-shrink-0">
        {renderHeader()}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-2">
        {viewType === 'month' && renderMonthView()}
        {viewType === 'week' && renderWeekView()}
        {viewType === 'day' && renderDayView()}
        {viewType === 'agenda' && renderAgendaView()}
      </div>
    </div>
  );
};

export default Calendar;

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CalendarEvent, CalendarViewState, WeatherForecast, DayCacheEntry } from '../types';
import { clsx } from 'clsx';
import { temperatureToRgba, interpolateDailyTemp, temperatureToRgbaEnhanced, daytimeColorFromRange } from '../utils/weatherHeatmap';
import { useApp } from '../contexts/useApp';

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
  const { theme } = useApp();
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  // Fallback cell color used where there's no weather data to derive a gradient from
  const emptyCellColor = theme === 'dark' ? 'rgb(31,41,55)' : 'rgb(248,250,252)';
  const outOfMonthCellColor = theme === 'dark' ? 'rgb(17,24,39)' : 'rgb(243,244,246)';

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
  const getCellColor = useCallback((day: Date, hour?: number): string | undefined => {
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
  }, [dayWeatherCache, weatherData, periodMin, periodMax]);

  // --- Weather badge helpers ---
  const getWeatherEmoji = (cloudPct: number, rainPct: number): string => {
    if (rainPct > 60) return '🌧️';
    if (rainPct > 20) return '🌦️';
    if (cloudPct < 20) return '☀️';
    if (cloudPct < 50) return '🌤️';
    if (cloudPct < 75) return '⛅';
    return '☁️';
  };

  const getDayWeather = useCallback((day: Date): { temp: number; emoji: string; rainPercent: number } | null => {
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
  }, [dayWeatherCache, weatherData]);

  const { currentDate, viewType } = viewState;

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

  // --- Memoized weather-color derivations ---
  // The per-cell color math (array scans, min/max, interpolation) is expensive, so
  // it's memoized here and only recomputed when the underlying weather/date deps
  // change — not on every hover-triggered re-render.
  const monthDays = useMemo(() => getCalendarDays(), [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthColorGrid = useMemo<string[][]>(() => {
    const numWeeks = Math.ceil(monthDays.length / 7);
    return Array.from({ length: numWeeks }, (_, r) =>
      monthDays.slice(r * 7, (r + 1) * 7).map(day =>
        isSameMonth(day, currentDate)
          ? (getCellColor(day) ?? emptyCellColor)
          : outOfMonthCellColor
      )
    );
  }, [monthDays, currentDate, getCellColor, emptyCellColor, outOfMonthCellColor]);

  const weekViewDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const weekColorGrid = useMemo<string[][]>(() =>
    Array.from({ length: 24 }, (_, hour) =>
      weekViewDays.map(day => getCellColor(day, hour) ?? emptyCellColor)
    ),
  [weekViewDays, getCellColor, emptyCellColor]);

  const dayViewGradient = useMemo(() => {
    const stops = Array.from({ length: 24 }, (_, h) =>
      `${getCellColor(currentDate, h) ?? emptyCellColor} ${((h / 23) * 100).toFixed(1)}%`
    ).join(', ');
    return `linear-gradient(to bottom, ${stops})`;
  }, [currentDate, getCellColor, emptyCellColor]);

  const renderMonthView = () => {
    const days = monthDays;
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const colorGrid = monthColorGrid;

    return (
      <div className="flex-1 rounded-lg shadow-sm border border-white/30 dark:border-gray-700/30 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-b border-white/30 dark:border-gray-700/30">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
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
            // Screen readers get the weather even when it's visually dropped in narrow cells.
            const weatherLabel = dayWeather
              ? `, ${dayWeather.temp} degrees${dayWeather.rainPercent > 0 ? `, ${dayWeather.rainPercent}% chance of precipitation` : ''}`
              : '';

            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  'dc-cell relative min-h-[100px] p-2 border-r border-b border-black/[0.06] dark:border-white/[0.08] cursor-pointer z-[1]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                  { 'text-gray-400 dark:text-gray-500': !isCurrentMonth }
                )}
                onClick={() => { onDateClick(day); onCreateEvent(day); }}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                tabIndex={0}
                role="gridcell"
                aria-label={`${format(day, 'MMMM d, yyyy')}${weatherLabel}`}
              >
                {/* Selection / hover highlight */}
                {isSelected && (
                  <div className="absolute inset-0 ring-2 ring-inset ring-blue-400/60 pointer-events-none rounded-sm" style={{ zIndex: 20 }} />
                )}
                {isHovered && !isSelected && (
                  <div className="absolute inset-0 bg-white/20 dark:bg-white/10 pointer-events-none" style={{ zIndex: 20 }} />
                )}

                {/* Top row: day number (left) and, on hover, the add button (right).
                    Deterministic slots — the number never shares horizontal space
                    with the weather, so they cannot collide. */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span
                    className={clsx('dc-daynum', {
                      'dc-daynum--today': isTodayDate,
                      'dc-daynum--muted': !isCurrentMonth,
                    })}
                  >
                    {format(day, 'd')}
                  </span>

                  {isHovered && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEvent(day);
                      }}
                      className="w-5 h-5 shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"
                      aria-label="Add event"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Weather row: full cell width, progressive disclosure by cell
                    width (see .dc-weather container queries). aria-hidden — the
                    cell's aria-label already announces the weather. */}
                {dayWeather && !isHovered && (
                  <div className="dc-weather mb-1" aria-hidden="true">
                    <span className="dc-wx-icon">{dayWeather.emoji}</span>
                    <span className="dc-wx-temp">{dayWeather.temp}°</span>
                    {dayWeather.rainPercent > 0 && (
                      <span className="dc-wx-precip">💧{dayWeather.rainPercent}%</span>
                    )}
                  </div>
                )}

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
                    <div className="text-xs text-gray-700 dark:text-gray-300 px-2 bg-white/50 dark:bg-gray-800/50 rounded inline-block">
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
          const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
        }
        case 'day':
          return format(currentDate, 'EEEE, MMMM d, yyyy');
        default:
          return format(currentDate, 'MMMM yyyy');
      }
    };

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 gap-y-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">{getTitle()}</h1>

          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={navigatePrevious}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={navigateToday}
              className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
            >
              Today
            </button>

            <button
              onClick={navigateNext}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View type selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['month', 'week', 'day', 'agenda'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onViewStateChange({ ...viewState, viewType: type })}
                className={clsx(
                  'px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors capitalize',
                  {
                    'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm': viewType === type,
                    'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100': viewType !== type,
                  }
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={() => onCreateEvent(currentDate)}
            className="flex items-center gap-2 px-2.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
            aria-label="New Event"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Event</span>
          </button>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = weekViewDays;
    const currentHour = new Date().getHours();
    const today = new Date();

    // Events for the entire week — computed once, then filtered locally
    // (previously re-filtered the full events array for every day/hour cell).
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= weekStart && eventDate <= weekEnd;
    });

    // Get events for a specific day and hour
    const getEventsForDayAndHour = (day: Date, hour: number) => {
      return weekEvents.filter(event => {
        if (!isSameDay(new Date(event.start), day)) return false;

        if (event.allDay) return hour === 0; // Show all-day events at midnight

        const eventStartHour = event.start.getHours();
        const eventEndHour = event.end.getHours();
        return hour >= eventStartHour && hour <= eventEndHour;
      });
    };

    // Get all-day events for the week
    const getAllDayEvents = () => {
      return weekEvents.filter(event => event.allDay);
    };

    // Get all-day events for a specific day
    const getAllDayEventsForDay = (day: Date) => {
      return weekEvents.filter(event =>
        event.allDay && isSameDay(new Date(event.start), day)
      );
    };

    // Get all events for a specific day
    const getEventsForDay = (day: Date) => {
      return weekEvents.filter(event =>
        isSameDay(new Date(event.start), day)
      );
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col rounded-lg shadow-sm border border-white/30 dark:border-gray-700/30 overflow-hidden">
        {/* Week view header */}
        <div className="flex-shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-b border-white/30 dark:border-gray-700/30">
          {/* Week title */}
          <div className="p-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-black/[0.06] dark:border-white/[0.08]">
            {/* Time column header */}
            <div className="p-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-black/[0.06] dark:border-white/[0.08]">
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
                    'p-1.5 text-center border-r border-black/[0.06] dark:border-white/[0.08] last:border-r-0 cursor-pointer hover:bg-white/40 dark:hover:bg-white/5 transition-colors',
                    {
                      'bg-blue-50/70 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800': isCurrentDay,
                    }
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div className={clsx(
                    'text-[10px] font-medium',
                    {
                      'text-blue-600 dark:text-blue-400': isCurrentDay,
                      'text-gray-900 dark:text-gray-100': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={clsx(
                    'text-sm font-semibold',
                    {
                      'text-blue-600 dark:text-blue-400': isCurrentDay,
                      'text-gray-700 dark:text-gray-300': !isCurrentDay,
                    }
                  )}>
                    {format(day, 'd')}
                  </div>
                  {dayWeather && (
                    <div className="flex items-center justify-center gap-0.5 text-[9px] leading-none text-gray-600 dark:text-gray-400">
                      <span>{dayWeather.emoji}</span>
                      <span>{dayWeather.temp}°</span>
                      {dayWeather.rainPercent > 0 && (
                        <span className="text-blue-500 dark:text-blue-400">💧{dayWeather.rainPercent}%</span>
                      )}
                    </div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="text-[9px] text-gray-400 dark:text-gray-500">
                      {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All-day events section */}
          {getAllDayEvents().length > 0 && (
            <div className="border-b border-black/[0.06] dark:border-white/[0.08] bg-gray-50/50 dark:bg-gray-800/30">
              <div className="grid grid-cols-8">
                {/* All-day label */}
                <div className="p-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center">
                  All Day
                </div>

                {/* All-day events for each day */}
                {weekDays.map((day) => {
                  const dayAllDayEvents = getAllDayEventsForDay(day);

                  return (
                    <div
                      key={`allday-${day.toISOString()}`}
                      className="p-1 border-r border-black/[0.06] dark:border-white/[0.08] last:border-r-0 min-h-[28px]"
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

        {/* Week grid with hours — fills remaining height, no scroll */}
        <div className="flex-1 min-h-0">
          <div className="relative h-full flex flex-col">
          {/* Gradient canvas covers the 7 day columns (skips the 12.5% time column) */}
          {(() => {
            return (
              <>
                <GradientCanvas
                  colors={weekColorGrid}
                  style={{ left: '12.5%', width: '87.5%' }}
                />
                {Array.from({ length: 24 }, (_, hour) => {
                  const isCurrentHour = isSameDay(currentDate, today) && hour === currentHour;
                  return (
                    <div
                      key={hour}
                      className="flex-1 min-h-0 grid grid-cols-8 border-b border-black/[0.05] dark:border-white/[0.06]"
                    >
                      {/* Time column — opaque so it stays legible */}
                      <div className="px-1 text-center text-[10px] leading-none text-gray-500 dark:text-gray-400 border-r border-black/[0.07] dark:border-white/[0.08] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                        <span className={clsx('font-medium', isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200')}>
                          {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                        </span>
                      </div>

                      {/* Day columns — transparent, canvas gradient shows through */}
                      {weekDays.map((day) => {
                        const dayEvents = getEventsForDayAndHour(day, hour);
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className={clsx(
                              'relative border-r border-black/[0.05] dark:border-white/[0.06] last:border-r-0 px-0.5 overflow-hidden cursor-pointer z-[1]',
                              'hover:bg-white/20 dark:hover:bg-white/5 transition-colors',
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
                                className="text-[9px] leading-tight px-1 rounded cursor-pointer truncate shadow-sm text-white"
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
                              <Plus className="w-3 h-3 text-gray-400/60" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            );
          })()}
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
      <div className="flex-1 min-h-0 flex flex-col rounded-lg shadow-sm border border-white/30 dark:border-gray-700/30 overflow-hidden">
        {/* Day view header */}
        <div className="flex-shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-b border-white/30 dark:border-gray-700/30 p-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            {isToday && (
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {format(new Date(), 'HH:mm')}
              </div>
            )}
          </div>
        </div>

        {/* Hours timeline — fills remaining height, no scroll */}
        {(() => {
          return (
            <div
              className="flex-1 min-h-0 flex flex-col relative"
              style={{ background: dayViewGradient }}
            >
              {hours.map((hour) => {
                const hourEvents = getEventsForHour(hour);
                const isCurrentHour = isToday && hour === currentHour;

                return (
                  <div
                    key={hour}
                    className="relative flex-1 min-h-0 flex border-b border-black/[0.05] dark:border-white/[0.06] hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                    onMouseEnter={() => setHoveredDate(currentDate)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    {/* Current-hour highlight bar */}
                    {isCurrentHour && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-blue-400 pointer-events-none" />
                    )}

                    {/* Time column */}
                    <div className="w-14 flex-shrink-0 px-1 flex items-center justify-center border-r border-black/10 dark:border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                      <span className={clsx('text-[10px] leading-none font-medium', isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200')}>
                        {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                      </span>
                    </div>

                    {/* Events column — tap to create an event at this hour */}
                    <div
                      className="flex-1 px-2 py-0.5 relative overflow-hidden cursor-pointer"
                      onClick={() => {
                        const eventDate = new Date(currentDate);
                        eventDate.setHours(hour, 0, 0, 0);
                        onCreateEvent(eventDate);
                      }}
                    >
                      {/* Current time indicator */}
                      {isCurrentHour && (
                        <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-blue-500 z-10">
                          <div className="absolute left-0 w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1/2"></div>
                        </div>
                      )}

                      {/* Events */}
                      <div className="flex flex-wrap gap-1">
                        {hourEvents.map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            className={clsx(
                              'text-[10px] leading-tight px-1.5 py-0.5 rounded text-white cursor-pointer truncate max-w-full',
                              'hover:opacity-80 transition-opacity shadow-sm',
                              {
                                'opacity-60': event.allDay,
                              }
                            )}
                            style={{ backgroundColor: event.color || '#3b82f6' }}
                            title={`${event.title}${event.location ? ` — ${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`}
                          >
                            {event.title}
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
                          className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-sm"
                          aria-label={`Add event at ${hour}:00`}
                        >
                          <Plus size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
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
      <div className="flex-1 overflow-auto rounded-lg border border-white/30 dark:border-gray-700/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm divide-y divide-gray-100 dark:divide-gray-700">
        {Array.from(groups.entries()).map(([key, dayEvents]) => {
          const date = new Date(key);
          const todayDate = isToday(date);
          const dayWeather = getDayWeather(date);
          return (
            <div key={key} className="flex">
              {/* Date column */}
              <div className={clsx(
                'w-36 flex-shrink-0 p-3 border-r border-gray-100 dark:border-gray-700',
                todayDate ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-gray-50/50 dark:bg-gray-800/30'
              )}>
                <div className={clsx('text-sm font-semibold', todayDate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100')}>
                  {format(date, 'EEE, MMM d')}
                </div>
                {todayDate && <div className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Today</div>}
                {dayWeather && (
                  <div className="flex items-center gap-0.5 text-[10px] leading-none text-gray-500 dark:text-gray-400 mt-1.5">
                    <span>{dayWeather.emoji}</span>
                    <span>{dayWeather.temp}°</span>
                    {dayWeather.rainPercent > 0 && (
                      <span className="text-blue-500 dark:text-blue-400 ml-0.5">💧{dayWeather.rainPercent}%</span>
                    )}
                  </div>
                )}
              </div>

              {/* Events column */}
              <div className="flex-1 divide-y divide-gray-50 dark:divide-gray-800">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-3"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{event.title}</div>
                      {event.location && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">📍 {event.location}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-3 flex-shrink-0">
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

      <div
        className={clsx(
          'flex-1 px-4 pb-2',
          viewType === 'week' || viewType === 'day'
            ? 'overflow-hidden flex flex-col min-h-0'
            : 'overflow-auto'
        )}
      >
        {viewType === 'month' && renderMonthView()}
        {viewType === 'week' && renderWeekView()}
        {viewType === 'day' && renderDayView()}
        {viewType === 'agenda' && renderAgendaView()}
      </div>
    </div>
  );
};

export default Calendar;

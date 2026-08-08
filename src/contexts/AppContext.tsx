import { useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Calendar, CalendarEvent, WeatherForecast, Location, CalendarViewState, AppError, DayCacheEntry } from '../types';
import { getWeatherData } from '../services/weatherService';
import { getMissingDates } from '../services/openMeteoService';
import { activeProvider } from '../services/weatherProvider';
import { AppContext, type AppContextType } from './useApp';

const STORAGE_KEYS = {
  events: 'kalendarski_events',
  calendars: 'kalendarski_calendars',
  dayWeather: 'kalendarski_day_weather',
  theme: 'kalendarski_theme',
} as const;

export type Theme = 'light' | 'dark';

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const DATE_FIELDS_EVENT = ['start', 'end', 'createdAt', 'updatedAt'] as const;
const DATE_FIELDS_CALENDAR = ['createdAt', 'updatedAt', 'lastSync'] as const;

function reviveEvent(raw: Record<string, unknown>): CalendarEvent {
  const obj = { ...raw } as Record<string, unknown>;
  for (const field of DATE_FIELDS_EVENT) {
    if (typeof obj[field] === 'string') obj[field] = new Date(obj[field] as string);
  }
  return obj as unknown as CalendarEvent;
}

function reviveCalendar(raw: Record<string, unknown>): Calendar {
  const obj = { ...raw } as Record<string, unknown>;
  for (const field of DATE_FIELDS_CALENDAR) {
    if (typeof obj[field] === 'string') obj[field] = new Date(obj[field] as string);
  }
  return obj as unknown as Calendar;
}

function loadFromStorage<T>(key: string, revive: (r: Record<string, unknown>) => T): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(revive);
  } catch {
    return null;
  }
}

// Initial state
const initialViewState: CalendarViewState = {
  currentDate: new Date(),
  viewType: 'month',
};

export interface AppState {
  calendars: Calendar[];
  events: CalendarEvent[];
  weatherData: WeatherForecast | null;
  location: Location | null;
  viewState: CalendarViewState;
  isLoading: boolean;
  error: AppError | null;
  dayWeatherCache: Record<string, DayCacheEntry>;
  theme: Theme;
}

function loadDayWeatherCache(): Record<string, DayCacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dayWeather);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const initialState: AppState = {
  calendars: [],
  events: [],
  weatherData: null,
  location: null,
  viewState: initialViewState,
  isLoading: false,
  error: null,
  dayWeatherCache: loadDayWeatherCache(),
  theme: loadTheme(),
};

// Action types
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: AppError | null }
  | { type: 'SET_CALENDARS'; payload: Calendar[] }
  | { type: 'ADD_CALENDAR'; payload: Calendar }
  | { type: 'UPDATE_CALENDAR'; payload: Calendar }
  | { type: 'DELETE_CALENDAR'; payload: string }
  | { type: 'SET_EVENTS'; payload: CalendarEvent[] }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'ADD_EVENTS'; payload: CalendarEvent[] }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SET_WEATHER_DATA'; payload: WeatherForecast }
  | { type: 'SET_LOCATION'; payload: Location }
  | { type: 'SET_VIEW_STATE'; payload: CalendarViewState }
  | { type: 'MERGE_DAY_WEATHER'; payload: Record<string, DayCacheEntry> }
  | { type: 'CLEAR_DAY_WEATHER' }
  | { type: 'SET_THEME'; payload: Theme };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_CALENDARS':
      return { ...state, calendars: action.payload };
    
    case 'ADD_CALENDAR':
      return { ...state, calendars: [...state.calendars, action.payload] };
    
    case 'UPDATE_CALENDAR':
      return {
        ...state,
        calendars: state.calendars.map(cal =>
          cal.id === action.payload.id ? action.payload : cal
        ),
      };
    
    case 'DELETE_CALENDAR':
      return {
        ...state,
        calendars: state.calendars.filter(cal => cal.id !== action.payload),
        events: state.events.filter(event => event.calendarId !== action.payload),
      };
    
    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.payload] };

    case 'ADD_EVENTS': {
      // Dedup by id so re-importing the same file doesn't create duplicates.
      const existingIds = new Set(state.events.map(e => e.id));
      const fresh = action.payload.filter(e => !existingIds.has(e.id));
      return { ...state, events: [...state.events, ...fresh] };
    }
    
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(event =>
          event.id === action.payload.id ? action.payload : event
        ),
      };
    
    case 'DELETE_EVENT':
      return {
        ...state,
        events: state.events.filter(event => event.id !== action.payload),
      };
    
    case 'SET_WEATHER_DATA':
      return { ...state, weatherData: action.payload };
    
    case 'SET_LOCATION':
      return { ...state, location: action.payload };
    
    case 'SET_VIEW_STATE':
      return { ...state, viewState: action.payload };

    case 'MERGE_DAY_WEATHER':
      return { ...state, dayWeatherCache: { ...state.dayWeatherCache, ...action.payload } };

    case 'CLEAR_DAY_WEATHER':
      return { ...state, dayWeatherCache: {} };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    default:
      return state;
  }
}

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Generate unique ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Calendar actions
  const addCalendar = (calendarData: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'>) => {
    const calendar: Calendar = {
      ...calendarData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_CALENDAR', payload: calendar });
  };

  const updateCalendar = (calendar: Calendar) => {
    const updatedCalendar = {
      ...calendar,
      updatedAt: new Date(),
    };
    dispatch({ type: 'UPDATE_CALENDAR', payload: updatedCalendar });
  };

  const deleteCalendar = (calendarId: string) => {
    dispatch({ type: 'DELETE_CALENDAR', payload: calendarId });
  };

  // Event actions
  const addEvent = (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const event: CalendarEvent = {
      ...eventData,
      source: eventData.source ?? 'local',
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
  };

  // Bulk-add pre-formed events (ICS import). Returns how many were newly added.
  const importEvents = (newEvents: CalendarEvent[]): number => {
    const existingIds = new Set(state.events.map(e => e.id));
    const added = newEvents.filter(e => !existingIds.has(e.id)).length;
    dispatch({ type: 'ADD_EVENTS', payload: newEvents });
    return added;
  };

  const updateEvent = (event: CalendarEvent) => {
    const updatedEvent = {
      ...event,
      updatedAt: new Date(),
    };
    dispatch({ type: 'UPDATE_EVENT', payload: updatedEvent });
  };

  const deleteEvent = (eventId: string) => {
    dispatch({ type: 'DELETE_EVENT', payload: eventId });
  };

  // Weather actions
  const refreshWeatherData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const weatherData = await getWeatherData(state.location || undefined);
      
      dispatch({ type: 'SET_WEATHER_DATA', payload: weatherData });
      dispatch({ type: 'SET_LOCATION', payload: weatherData.location });
    } catch (error) {
      const appError: AppError = {
        code: 'WEATHER_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch weather data',
        details: error,
      };
      dispatch({ type: 'SET_ERROR', payload: appError });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Manually change the weather location (e.g. from the location picker),
  // clearing the day-weather cache since it's not keyed by location.
  const setLocation = async (newLocation: Location) => {
    dispatch({ type: 'CLEAR_DAY_WEATHER' });
    try {
      localStorage.removeItem(STORAGE_KEYS.dayWeather);
    } catch { /* ignore quota errors */ }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const weatherData = await getWeatherData(newLocation);

      dispatch({ type: 'SET_WEATHER_DATA', payload: weatherData });
      dispatch({ type: 'SET_LOCATION', payload: weatherData.location });
    } catch (error) {
      const appError: AppError = {
        code: 'WEATHER_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch weather data',
        details: error,
      };
      dispatch({ type: 'SET_ERROR', payload: appError });
      // Still record the requested location even if the weather fetch failed
      dispatch({ type: 'SET_LOCATION', payload: newLocation });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Theme actions
  const setTheme = (theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch { /* ignore quota errors */ }
  };

  // View actions
  const setViewState = (viewState: CalendarViewState) => {
    dispatch({ type: 'SET_VIEW_STATE', payload: viewState });
  };

  // Fetch Open-Meteo data for a date range, skipping already-cached dates
  const fetchWeatherForDates = async (startDate: Date, endDate: Date) => {
    if (!state.location) return;

    const missing = getMissingDates(startDate, endDate, state.dayWeatherCache);
    if (missing.length === 0) return;

    const minDate = new Date(missing[0]);
    const maxDate = new Date(missing[missing.length - 1]);

    try {
      const fetched = await activeProvider.getForecast(state.location, minDate, maxDate);
      dispatch({ type: 'MERGE_DAY_WEATHER', payload: fetched });
      // Persist merged cache
      const merged = { ...state.dayWeatherCache, ...fetched };
      try {
        localStorage.setItem(STORAGE_KEYS.dayWeather, JSON.stringify(merged));
      } catch { /* ignore quota errors */ }
    } catch {
      // Silently ignore — weather data is decorative, not critical
    }
  };

  // Apply the theme class to the document root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  // Persist events and calendars to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(state.events));
    } catch { /* ignore quota errors */ }
  }, [state.events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.calendars, JSON.stringify(state.calendars));
    } catch { /* ignore quota errors */ }
  }, [state.calendars]);

  // Initialize app data
  useEffect(() => {
    const initializeApp = async () => {
      // Load calendars from storage or seed default
      const storedCalendars = loadFromStorage(STORAGE_KEYS.calendars, reviveCalendar);
      if (storedCalendars && storedCalendars.length > 0) {
        dispatch({ type: 'SET_CALENDARS', payload: storedCalendars });
      } else {
        const defaultCalendar: Calendar = {
          id: 'default',
          name: 'Personal',
          color: '#3b82f6',
          description: 'Your personal calendar',
          isVisible: true,
          isReadOnly: false,
          type: 'personal',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dispatch({ type: 'SET_CALENDARS', payload: [defaultCalendar] });
      }

      // Load events from storage or seed samples
      const storedEvents = loadFromStorage(STORAGE_KEYS.events, reviveEvent);
      if (storedEvents && storedEvents.length > 0) {
        dispatch({ type: 'SET_EVENTS', payload: storedEvents });
      } else {
        const sampleEvents: CalendarEvent[] = [
          {
            id: 'sample-1',
            title: 'Welcome to Kalendarski!',
            description: 'This is a sample event to get you started.',
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000),
            allDay: false,
            calendarId: 'default',
            color: '#3b82f6',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sample-2',
            title: 'All Day Event',
            description: 'This is an all-day event example.',
            start: new Date(Date.now() + 24 * 60 * 60 * 1000),
            end: new Date(Date.now() + 24 * 60 * 60 * 1000),
            allDay: true,
            calendarId: 'default',
            color: '#10b981',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        dispatch({ type: 'SET_EVENTS', payload: sampleEvents });
      }

      // Fetch weather — call getWeatherData directly to avoid stale closure on state.location
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const weatherData = await getWeatherData(undefined);
        dispatch({ type: 'SET_WEATHER_DATA', payload: weatherData });
        dispatch({ type: 'SET_LOCATION', payload: weatherData.location });
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            code: 'WEATHER_FETCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch weather data',
            details: error,
          },
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeApp();
  }, []);

  const contextValue: AppContextType = {
    ...state,
    dispatch,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    addEvent,
    updateEvent,
    deleteEvent,
    importEvents,
    refreshWeatherData,
    fetchWeatherForDates,
    setLocation,
    setViewState,
    setTheme,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

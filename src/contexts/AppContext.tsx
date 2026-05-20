import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Calendar, CalendarEvent, WeatherForecast, Location, CalendarViewState, AppError } from '../types';
import { getWeatherData } from '../services/weatherService';

const STORAGE_KEYS = {
  events: 'kalendarski_events',
  calendars: 'kalendarski_calendars',
} as const;

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

interface AppState {
  calendars: Calendar[];
  events: CalendarEvent[];
  weatherData: WeatherForecast | null;
  location: Location | null;
  viewState: CalendarViewState;
  isLoading: boolean;
  error: AppError | null;
}

const initialState: AppState = {
  calendars: [],
  events: [],
  weatherData: null,
  location: null,
  viewState: initialViewState,
  isLoading: false,
  error: null,
};

// Action types
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: AppError | null }
  | { type: 'SET_CALENDARS'; payload: Calendar[] }
  | { type: 'ADD_CALENDAR'; payload: Calendar }
  | { type: 'UPDATE_CALENDAR'; payload: Calendar }
  | { type: 'DELETE_CALENDAR'; payload: string }
  | { type: 'SET_EVENTS'; payload: CalendarEvent[] }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SET_WEATHER_DATA'; payload: WeatherForecast }
  | { type: 'SET_LOCATION'; payload: Location }
  | { type: 'SET_VIEW_STATE'; payload: CalendarViewState };

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
    
    default:
      return state;
  }
}

// Context
interface AppContextType extends AppState {
  dispatch: React.Dispatch<AppAction>;
  // Calendar actions
  addCalendar: (calendar: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCalendar: (calendar: Calendar) => void;
  deleteCalendar: (calendarId: string) => void;
  // Event actions
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
  // Weather actions
  refreshWeatherData: () => Promise<void>;
  // View actions
  setViewState: (viewState: CalendarViewState) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
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
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_EVENT', payload: event });
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

  // View actions
  const setViewState = (viewState: CalendarViewState) => {
    dispatch({ type: 'SET_VIEW_STATE', payload: viewState });
  };

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
    refreshWeatherData,
    setViewState,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

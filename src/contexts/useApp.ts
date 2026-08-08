import { createContext, useContext, type Dispatch } from 'react';
import type { Calendar, CalendarEvent, CalendarViewState, Location } from '../types';
import type { AppState, AppAction, Theme } from './AppContext';

// The full value exposed through AppContext: reducer state plus action helpers.
export interface AppContextType extends AppState {
  dispatch: Dispatch<AppAction>;
  // Calendar actions
  addCalendar: (calendar: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCalendar: (calendar: Calendar) => void;
  deleteCalendar: (calendarId: string) => void;
  // Event actions
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
  /** Bulk-add already-formed events (e.g. from an ICS import), deduped by id. */
  importEvents: (events: CalendarEvent[]) => number;
  // Weather actions
  refreshWeatherData: () => Promise<void>;
  fetchWeatherForDates: (startDate: Date, endDate: Date) => Promise<void>;
  setLocation: (location: Location) => Promise<void>;
  // View actions
  setViewState: (viewState: CalendarViewState) => void;
  // Theme actions
  setTheme: (theme: Theme) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

// Hook to use the context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

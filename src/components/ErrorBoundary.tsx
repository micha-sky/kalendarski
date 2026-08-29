import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable fallback
 * instead of a blank white screen. Local data (events, calendars) lives in
 * localStorage, so a reload recovers the user's work.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept local — no external error reporting (privacy by absence).
    console.error('Kalendarski crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center dark:bg-gray-950">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          The app hit an unexpected error. Your events are saved locally, so reloading should recover them.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Reload
        </button>
      </div>
    );
  }
}

import { AppProvider } from './contexts/AppContext';
import MainLayout from './components/MainLayout';
import { UpdateToast } from './components/PWAPrompts';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
        <UpdateToast />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;

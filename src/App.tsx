import { AppProvider } from './contexts/AppContext';
import MainLayout from './components/MainLayout';
import { UpdateToast } from './components/PWAPrompts';

function App() {
  return (
    <AppProvider>
      <MainLayout />
      <UpdateToast />
    </AppProvider>
  );
}

export default App;

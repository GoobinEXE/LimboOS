import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RetroLoading from './components/player/RetroLoading';
import ErrorBoundary from './components/ErrorBoundary';

const Player = lazy(() => import('./Player'));

const AdminApp = lazy(() => import('./admin/AdminApp'));
const TerminalApp = lazy(() => import('./terminal/TerminalApp'));

function AppRoutes() {
  const { t } = useTranslation('common');

  return (
    <Suspense
      fallback={
        <RetroLoading
          fullScreen
          message={t('loadingSystem')}
          subMessage={t('loadingSystemSub')}
        />
      }
    >
      <Routes>
        <Route path="/*" element={<Player />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/terminal/*" element={<TerminalApp />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}

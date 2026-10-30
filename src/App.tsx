import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'motion/react';
import RetroLoading from './components/player/RetroLoading';
import ErrorBoundary from './components/ErrorBoundary';
import { DEFAULT_TRANSITION } from './lib/motion';

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
      {/* reducedMotion="user": respeita prefers-reduced-motion em todo o app
          (desliga transform/layout, mantém opacidade). */}
      <MotionConfig reducedMotion="user" transition={DEFAULT_TRANSITION}>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </MotionConfig>
    </BrowserRouter>
  );
}

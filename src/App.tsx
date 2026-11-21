import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'motion/react';
import RetroLoading from './components/player/RetroLoading';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import UpdateNotice from './components/UpdateNotice';
import { DEFAULT_TRANSITION } from './lib/motion';
import { useOverlayStack } from './lib/overlayStack';
import { isZoomLockedPath, setZoomLocked } from './lib/viewportZoom';

const Player = lazy(() => import('./Player'));

const AdminApp = lazy(() => import('./admin/AdminApp'));
const TerminalApp = lazy(() => import('./terminal/TerminalApp'));
const InviteApp = lazy(() => import('./invite/InviteApp'));
const OracleApp = lazy(() => import('./oracle/OracleApp'));

function AppRoutes() {
  const { t } = useTranslation('common');

  return (
    <Suspense
      fallback={
        <RetroLoading
          fullScreen
          message={t('loadingSystem')}
        />
      }
    >
      <Routes>
        <Route path="/*" element={<Player />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/terminal/*" element={<TerminalApp />} />
        <Route path="/convite/:token" element={<InviteApp />} />
        <Route path="/oraculo" element={<OracleApp />} />
        <Route path="/oraculo/:slotCode" element={<OracleApp />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Camada comum a todas as superfícies, fora do ErrorBoundary para continuar visível
 * numa tela de erro: faixa "Sem sinal", aviso de nova versão e trava de zoom por rota
 * (o player trava; um overlay com `allowZoom`, como o leitor de evidência, destrava).
 */
function GlobalShell() {
  const { pathname } = useLocation();
  const overlays = useOverlayStack();
  const playerRoute = isZoomLockedPath(pathname);
  const overlayWantsZoom = overlays.some((overlay) => overlay.allowZoom);

  useEffect(() => {
    setZoomLocked(playerRoute && !overlayWantsZoom);
  }, [playerRoute, overlayWantsZoom]);

  return (
    <>
      <OfflineBanner announceRestored={!playerRoute} />
      <UpdateNotice />
    </>
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
        <GlobalShell />
      </MotionConfig>
    </BrowserRouter>
  );
}

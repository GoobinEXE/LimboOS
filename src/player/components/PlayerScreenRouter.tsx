import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import RetroLoading from '../../components/player/RetroLoading';
import { usePlayerSession } from '../context/PlayerProviders';
import { usePlayerPlayback } from '../context/PlayerProviders';

const WalkmanShell = React.lazy(() => import('./WalkmanShell'));
const MiniAppsOverlay = React.lazy(() => import('./MiniAppsOverlay'));
const LoginScreen = React.lazy(() => import('../../components/LoginScreen'));
const CharacterSelectionScreen = React.lazy(() => import('../../components/CharacterSelectionScreen'));
const ProfileScreen = React.lazy(() => import('../../components/ProfileScreen'));
const AgentDossierOverlay = React.lazy(() =>
  import('../../components/campaign/AgentDossierOverlay').then((m) => ({ default: m.AgentDossierOverlay }))
);
const CampaignSelection = React.lazy(() => import('../../components/CampaignSelection'));

const LIMBO_EASE = [0.22, 1, 0.36, 1] as const;
const EXIT_EASE = [0.4, 0, 1, 1] as const;

// mode="wait" soma saída + entrada: a saída precisa ser curta para a troca
// de tela não parecer travada (≈140ms + 260ms em vez de 280ms + 280ms).
const screenMotion = {
  initial: { opacity: 0, transform: 'translateY(8px)' },
  animate: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: { duration: 0.26, ease: LIMBO_EASE },
  },
  exit: {
    opacity: 0,
    transform: 'translateY(-4px)',
    transition: { duration: 0.14, ease: EXIT_EASE },
  },
};

export default function PlayerScreenRouter() {
  const { t } = useTranslation('player');
  const session = usePlayerSession();
  const playback = usePlayerPlayback();

  const {
    masterAccount,
    playerData,
    screen,
    setScreen,
    limboStatus,
    intelManager,
    visualGalleryImages,
    handleCharacterSelect,
    handleCharacterSwitch,
    handleLogout,
    handleLogin,
    updateSpotify,
    updatePhone,
    selectCampaign,
  } = session;

  return (
    <AnimatePresence mode="wait">
      {screen === 'login' || !masterAccount ? (
        <motion.div
          key="login"
          {...screenMotion}
          className="w-full h-full flex items-center justify-center"
        >
          <React.Suspense fallback={<RetroLoading message={t('app.loading.terminal')} />}>
            <LoginScreen onLogin={handleLogin} />
          </React.Suspense>
        </motion.div>
      ) : screen === 'characterSelection' && masterAccount ? (
        <motion.div
          key="charSelect"
          {...screenMotion}
          className="w-full h-full flex items-center justify-center"
        >
          <React.Suspense fallback={<RetroLoading message={t('app.loading.agents')} />}>
            <CharacterSelectionScreen
              account={masterAccount}
              onSelect={handleCharacterSelect}
              onLogout={handleLogout}
            />
          </React.Suspense>
        </motion.div>
      ) : playerData === null ? (
        <RetroLoading message={t('app.loading.sync')} subMessage={t('app.loading.syncSub')} />
      ) : screen === 'profile' ? (
        <motion.div
          key="profile"
          {...screenMotion}
          className="w-full h-full flex items-center justify-center"
        >
          <React.Suspense fallback={<RetroLoading message={t('app.loading.profile')} />}>
            <ProfileScreen
              profile={playerData}
              galleryImages={visualGalleryImages}
              onBack={() => setScreen('player')}
              onLogout={handleLogout}
              onChangeMission={() => setScreen('campaignSelection')}
              onChangeCharacter={handleCharacterSwitch}
              onUpdateSpotify={updateSpotify}
              onUpdatePhoneNumber={updatePhone}
            />
          </React.Suspense>
        </motion.div>
      ) : screen === 'agentDossier' ? (
        <motion.div
          key="agentDossier"
          {...screenMotion}
          className="w-full h-full flex items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full h-full max-w-130 rounded-none sm:rounded-panel shadow-panel border-0 sm:border border-border-accent relative flex flex-col mx-auto overflow-hidden bg-surface">
            <React.Suspense fallback={<RetroLoading message={t('app.loading.dossier')} />}>
              <AgentDossierOverlay
                onClose={() => setScreen('campaignSelection')}
                playerData={playerData}
                intelManager={intelManager}
                onUpdateSpotify={updateSpotify}
              />
            </React.Suspense>
          </div>
        </motion.div>
      ) : screen === 'campaignSelection' ? (
        <motion.div
          key="campaignSelection"
          {...screenMotion}
          className="w-full h-full flex items-center justify-center p-0 sm:p-4"
        >
          <React.Suspense fallback={<RetroLoading message={t('app.loading.mission')} />}>
            <CampaignSelection
              onSelect={async (c) => {
                await selectCampaign(c);
                setScreen('player');
              }}
              onLogout={handleLogout}
              onShowProfile={() => setScreen('agentDossier')}
              onChangeCharacter={handleCharacterSwitch}
              onBack={
                playerData.character.campaignId
                  ? () => setScreen('player')
                  : undefined
              }
              playerData={playerData}
            />
          </React.Suspense>
        </motion.div>
      ) : screen === 'player' ? (
        <React.Suspense fallback={<RetroLoading message={t('app.loading.deck')} />}>
          <WalkmanShell
            currentIntel={playback.currentIntel}
            walkmanStatus={playback.walkmanStatus}
            isPlaying={playback.isPlaying}
            displayMode={playback.displayMode}
            volume={playback.volume}
            setVolume={playback.setVolume}
            intelItems={intelManager?.getAll() ?? []}
            playerData={playerData}
            onEject={playback.handleEject}
            onScanClick={playback.handleScanClick}
            onCancelScan={playback.handleCancelScan}
            onQrDetected={playback.handleQrDetected}
            onIntelSelect={playback.handleIntelSelect}
            onModeChange={playback.handleModeChange}
            onProfileOpen={playback.handleProfileOpen}
            onCharacterSwitch={handleCharacterSwitch}
            onSetIsPlaying={playback.handleSetIsPlaying}
            onRewind={playback.handleRewind}
            onTerminalOpen={playback.handleTerminalOpen}
            onMacOpen={playback.handleMacOpen}
          />
        </React.Suspense>
      ) : (
        <React.Suspense fallback={<RetroLoading message={t('app.loading.initSystem')} />}>
          <MiniAppsOverlay
            screen={screen}
            playerData={playerData}
            limboStatus={limboStatus}
            setScreen={setScreen}
          />
        </React.Suspense>
      )}
    </AnimatePresence>
  );
}

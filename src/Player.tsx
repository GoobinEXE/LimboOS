import { PlayerSessionProvider } from './player/context/PlayerProviders';
import { LandscapeLayoutProvider } from './player/context/LandscapeLayoutContext';
import PlayerRootShell from './player/components/PlayerRootShell';

export default function Player() {
  return (
    <LandscapeLayoutProvider>
      <PlayerSessionProvider>
        <PlayerRootShell />
      </PlayerSessionProvider>
    </LandscapeLayoutProvider>
  );
}

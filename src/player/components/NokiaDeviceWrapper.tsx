import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLandscapeLayout } from '../hooks/useLandscapeLayout';
import type { AppScreen, WalkmanStatus } from '../../types/player';

export interface NokiaDeviceWrapperProps {
  children: React.ReactNode;
  status: WalkmanStatus;
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  backVisible?: boolean;
  onProfileOpen?: () => void;
  onTerminalOpen?: () => void;
  hasTerminalAccess?: boolean;
}

function NavButton({
  onClick,
  disabled,
  icon,
  label,
  vertical,
}: {
  onClick?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  vertical?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 ease-limbo active:scale-95 active:translate-y-px cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
        vertical
          ? 'w-full py-2 flex flex-col items-center justify-center gap-0.5 min-h-11'
          : 'px-3 py-1.5 flex items-center gap-1'
      }`}
    >
      <span className="text-[10px] font-black">{icon}</span>
      <span className={`font-black tracking-tight uppercase ${vertical ? 'text-[8px]' : 'text-[10px]'}`}>{label}</span>
    </button>
  );
}

export default function NokiaDeviceWrapper({
  children,
  status,
  volume,
  isMuted,
  onToggleMute,
  onBack,
  screen,
  setScreen,
  backVisible,
  onProfileOpen,
  onTerminalOpen,
  hasTerminalAccess,
}: NokiaDeviceWrapperProps) {
  const { isLandscape } = useLandscapeLayout();
  const [systemTime, setSystemTime] = useState('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const isScanning = status === 'SCANNING';
  const signalBarsCount = Math.ceil((volume / 100) * 5);

  const navButtons = (
    <>
      {backVisible !== false ? (
        <NavButton onClick={onBack} icon="&lt;-" label="Voltar" vertical={isLandscape} />
      ) : (
        <div className={`opacity-0 pointer-events-none ${isLandscape ? 'py-2' : 'px-4 py-1.5'}`}>
          <NavButton icon="&lt;-" label="Voltar" vertical={isLandscape} />
        </div>
      )}

      <NavButton
        onClick={() => setScreen('player')}
        disabled={screen === 'player'}
        icon="[*]"
        label="Inicio"
        vertical={isLandscape}
      />

      <NavButton
        onClick={onToggleMute}
        icon={isMuted ? '[X]' : '[~]'}
        label={isMuted ? 'Mudo' : 'Som'}
        vertical={isLandscape}
      />

      {hasTerminalAccess && onTerminalOpen && (
        <NavButton onClick={onTerminalOpen} icon="[>]" label="DOS" vertical={isLandscape} />
      )}

      {onProfileOpen && (
        <NavButton onClick={onProfileOpen} icon="[#]" label="Perfil" vertical={isLandscape} />
      )}
    </>
  );

  return (
    <div
      // Moldura respeita notch/home indicator (safe areas) sem alterar a cor do LCD
      className="absolute inset-0 w-full h-full bg-[#edfeed] z-50 flex items-center justify-center overflow-hidden player-viewport pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pl-[max(1rem,env(safe-area-inset-left))]"
    >
      {/* Sombreamento do plástico ao redor do LCD: escurece as bordas sem mudar o tom verde */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-radial-[at_50%_45%] from-transparent via-transparent to-[#111e14]/10"
      />
      <div
        className={`w-full h-full bg-[#edfeed] rounded-xl border-4 border-[#111e14] relative shadow-[inset_0_4px_16px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.35),0_0_0_1px_rgba(17,30,20,0.35),0_10px_30px_-12px_rgba(17,30,20,0.6)] overflow-hidden max-w-4xl mx-auto ${
          isLandscape && !isScanning ? 'flex flex-row' : 'flex flex-col'
        }`}
      >
        <div
          id="nokia-lcd-screen-inner"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className={`w-full h-full bg-[#edfeed] text-[#111e14] overflow-hidden relative select-none nokia-theme-active ${
            isLandscape && !isScanning ? 'flex flex-row min-h-0' : 'flex flex-col justify-between'
          }`}
        >
          <div className="absolute inset-0 border border-[#111e14]/15 pointer-events-none z-20" />

          {!isScanning && isLandscape && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-11 shrink-0 flex flex-col justify-around items-stretch bg-[#edfeed] border-r-2 border-[#111e14] py-1.5 px-0.5 gap-0.5 z-20 select-none text-[#111e14]"
            >
              {navButtons}
            </motion.div>
          )}

          <div className={`flex flex-col min-h-0 min-w-0 ${isLandscape && !isScanning ? 'flex-1' : 'h-full'}`}>
            {!isScanning && (
              <div className="flex justify-between items-center bg-[#edfeed] px-2 border-b border-[#111e14] py-1 text-[12px] font-bold h-6 select-none z-10 leading-none shrink-0">
                <div className="flex items-end gap-px h-2.5" title="Signal">
                  <span className="text-[10px] leading-none pr-0.5 font-black">HP</span>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-0.5 ${signalBarsCount >= level ? 'bg-[#111e14]' : 'bg-[#111e14]/10'}`}
                      style={{ height: `${level * 2 + 2}px` }}
                    />
                  ))}
                </div>

                <span className="tracking-wide text-[12px] tabular-nums">{systemTime}</span>

                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] pr-0.5 font-black">MP</span>
                  <div className="flex items-center border border-[#111e14] p-px rounded-[1px] w-4.5 h-2.5">
                    <div className="bg-[#111e14] h-full w-[75%]" />
                  </div>
                  <div className="w-px h-1 bg-[#111e14] -ml-px" />
                </div>
              </div>
            )}

            <div className="grow overflow-hidden relative p-2 flex flex-col min-h-0">{children}</div>

            {!isScanning && !isLandscape && (
              <div className="flex justify-around items-center bg-[#edfeed] border-t-2 border-[#111e14] py-2 text-[12px] font-bold z-20 h-11 select-none text-[#111e14] shrink-0">
                {navButtons}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

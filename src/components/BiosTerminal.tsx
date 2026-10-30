import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { EASE_OUT } from '../lib/motion';
import { checkTerminalClosed } from '../store/firestore';
import { activityLogger } from '../services/ActivityLogger';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
import {
  matchesLimboIp,
  HELP_TEXT,
  DIR_RESPONSE,
  VER_RESPONSE,
  TIME_RESPONSE,
  MEM_RESPONSE,
  SITE_RESPONSE,
  INVALID_COMMAND_RESPONSE,
  formatSecretLog,
} from '../data/bios_terminal_commands';

const PHOSPHOR = '#33FF33';
const PHOSPHOR_DIM = 'rgba(51, 255, 51, 0.65)';

type KeyDef = string | { label: string; val: string; w?: string };

function TerminalBlock({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`whitespace-pre-wrap font-mono text-[13px] sm:text-[14px] leading-[1.65] tracking-[0.02em] ${className}`}
      style={{ textShadow: `0 0 4px ${PHOSPHOR}40`, ...style }}
    >
      {children}
    </div>
  );
}

function TerminalResponse({ text, variant = 'normal' }: { text: string; variant?: 'normal' | 'error' }) {
  return (
    <div
      className={`my-2 pl-3 border-l-2 ${
        variant === 'error'
          ? 'border-crt/50 text-crt/80'
          : 'border-crt/25 text-crt/90'
      }`}
    >
      <TerminalBlock>{text}</TerminalBlock>
    </div>
  );
}

function TerminalCommand({ cmd }: { cmd: string }) {
  return (
    <div className="mt-3 mb-1 font-mono text-[13px] sm:text-[14px] tracking-wide">
      <span className="text-crt font-bold" style={{ textShadow: `0 0 6px ${PHOSPHOR}60` }}>
        C:\&gt;
      </span>
      <span className="text-crt ml-0.5">{cmd}</span>
    </div>
  );
}

function TerminalKeyboard({
  onKey,
  compact,
  className = '',
}: {
  onKey: (key: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('player');
  const keyboardRows = useMemo<KeyDef[][]>(() => [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', { label: t('bios.key.del'), val: 'Backspace', w: 'flex-[1.6]' }],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', { label: t('bios.key.exe'), val: 'Enter', w: 'flex-[1.6]' }],
    [{ label: t('bios.key.space'), val: ' ', w: 'flex-[6] max-w-[260px]' }],
  ], [t]);
  const keyHeight = compact ? 'h-11 min-h-[44px]' : 'h-11';
  const keyMaxW = compact ? 'max-w-[40px]' : 'max-w-[44px]';
  const fontSize = compact ? 'text-[11px]' : 'text-xs sm:text-sm';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {keyboardRows.map((row, i) => (
        <div key={i} className={`flex justify-center gap-1.5 w-full px-1 ${compact ? '' : 'max-w-lg mx-auto px-2'}`}>
          {row.map((keyObj, j) => {
            const isObj = typeof keyObj === 'object';
            const label = isObj ? keyObj.label : keyObj;
            const val = isObj ? keyObj.val : keyObj;
            const widthClass = isObj && keyObj.w ? keyObj.w : `flex-1 ${keyMaxW}`;
            return (
              <button
                key={j}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onKey(val);
                }}
                className={`${keyHeight} border border-crt/60 text-crt flex items-center justify-center ${fontSize} font-bold tracking-wider active:bg-crt active:text-[#050505] active:shadow-[0_0_15px_#33ff33] active:border-crt rounded-none transition-colors ${widthClass}`}
                style={{ textShadow: `0 0 3px ${PHOSPHOR}50` }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface BiosTerminalProps {
  onIpDetected: () => void;
  uid: string;
  characterId: string;
  characterName: string;
  onClose: () => void;
  onAppLaunch?: (app: string) => void;
  onBootSystem?: () => void;
}

export default function BiosTerminal({
  onIpDetected,
  uid,
  characterId,
  characterName,
  onClose,
  onAppLaunch,
  onBootSystem,
}: BiosTerminalProps) {
  const { t } = useTranslation('player');
  const { isLandscape } = useLandscapeLayout();
  const [history, setHistory] = useState<React.ReactNode[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  // Desktop com teclado físico começa sem o teclado de tela; [⌨] reabre
  const [keyboardVisible, setKeyboardVisible] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches
  );
  const terminalRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
    void checkTerminalClosed(uid, characterId).catch((err) => {
      console.warn('[BiosTerminal] Falha ao persistir fechamento do terminal:', err);
    });
  }, [uid, characterId, onClose]);

  const processCommand = useCallback(
    (cmd: string) => {
      const cleanCmd = cmd.toLowerCase().trim();
      activityLogger.logAction('terminal', `Comando executado: ${cmd}`, { command: cmd });
      const newHistory = [...history, <TerminalCommand key={`cmd-${Date.now()}`} cmd={cmd} />];
      let response: React.ReactNode = null;

      if (matchesLimboIp(cleanCmd)) {
        onIpDetected();
        return;
      }

      const resKey = `res-${Date.now()}`;

      switch (cleanCmd) {
        case 'dir':
          response = <TerminalResponse key={resKey} text={DIR_RESPONSE} />;
          break;
        case 'cls':
          setHistory([]);
          setCurrentLine('');
          return;
        case 'ver':
          response = <TerminalResponse key={resKey} text={VER_RESPONSE} />;
          break;
        case 'help':
          response = <TerminalResponse key={resKey} text={HELP_TEXT} />;
          break;
        case 'time':
          response = <TerminalResponse key={resKey} text={TIME_RESPONSE} />;
          break;
        case 'mem':
          response = <TerminalResponse key={resKey} text={MEM_RESPONSE} />;
          break;
        case 'site':
          response = <TerminalResponse key={resKey} text={SITE_RESPONSE} />;
          break;
        case 'log':
          response = <TerminalResponse key={resKey} text={formatSecretLog(characterId, characterName)} />;
          break;
        case 'limbo':
        case 'limbo.exe':
          onIpDetected();
          return;
        case 'diskrepair':
        case 'diskrepair.exe':
          if (onAppLaunch) {
            onAppLaunch('diskRepair');
            return;
          }
          response = (
            <TerminalResponse key={resKey} text={t('bios.diskRepairUnavailable')} variant="error" />
          );
          break;
        case 'exit':
          handleClose();
          return;
        case '':
          if (onBootSystem) {
            onBootSystem();
            return;
          }
          break;
        default:
          response = <TerminalResponse key={resKey} text={INVALID_COMMAND_RESPONSE} variant="error" />;
      }

      if (response) {
        newHistory.push(response);
      }
      setHistory(newHistory);
      setCurrentLine('');
    },
    [history, onIpDetected, onAppLaunch, uid, characterName, characterId, handleClose, onBootSystem, t]
  );

  const handleKeyInput = useCallback(
    (key: string) => {
      if (navigator.vibrate) navigator.vibrate(10);
      if (key === 'Enter') {
        processCommand(currentLine);
      } else if (key === 'Backspace' || key === 'DEL') {
        setCurrentLine((prev) => prev.slice(0, -1));
      } else if (key.length === 1) {
        setCurrentLine((prev) => (prev.length < 32 ? prev + key : prev));
      }
    },
    [currentLine, processCommand]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault();
      if (e.key === 'Enter') handleKeyInput('Enter');
      else if (e.key === 'Backspace') handleKeyInput('Backspace');
      else if (e.key.length === 1) handleKeyInput(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyInput]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, currentLine]);

  const compactUi = isLandscape;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      layout
      className="focus-bare focus-crt fixed inset-0 z-50 flex flex-col bg-[#050505] overflow-hidden text-crt font-mono select-none player-viewport"
      style={{ fontFamily: '"Terminal", "Fixedsys", "Lucida Console", "Courier New", monospace' }}
    >
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.985; }
        }
        @keyframes blinker { 50% { opacity: 0; } }
        @keyframes scanlineMove {
          0% { top: -100%; } 100% { top: 100%; }
        }
      `}</style>

      <div
        className="absolute z-100 flex items-center gap-2 pointer-events-none"
        style={{
          top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
          right: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          type="button"
          onClick={() => setKeyboardVisible((v) => !v)}
          className="pointer-events-auto touch-manipulation text-crt/70 font-bold text-sm hover:text-crt transition-colors px-2 py-1 min-h-11 border border-crt/20 hover:border-crt/50"
          style={{ textShadow: `0 0 4px ${PHOSPHOR}40` }}
          title={keyboardVisible ? t('bios.hideKeyboard') : t('bios.showKeyboard')}
          aria-label={keyboardVisible ? t('bios.hideKeyboard') : t('bios.showKeyboard')}
          aria-pressed={keyboardVisible}
        >
          [⌨]
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="pointer-events-auto touch-manipulation text-crt/70 font-bold text-lg hover:text-crt transition-colors px-2 py-1 min-h-11 border border-crt/20 hover:border-crt/50"
          style={{ textShadow: `0 0 4px ${PHOSPHOR}40` }}
          aria-label={t('bios.closeAria')}
        >
          [X]
        </button>
      </div>

      <div
        className={`relative flex-1 overflow-hidden min-h-0 ${isLandscape ? 'landscape-split' : 'flex flex-col'}`}
        style={{ animation: 'flicker 4s ease-in-out infinite' }}
      >
        {/* CRT overlays */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))',
            backgroundSize: '100% 2px, 3px 100%',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none z-11"
          style={{ background: 'radial-gradient(circle, transparent 70%, rgba(0,0,0,0.5) 100%)' }}
        />
        <div
          className="absolute w-full h-full pointer-events-none z-12"
          style={{
            background:
              'linear-gradient(0deg, rgba(51,255,51,0) 0%, rgba(51,255,51,0.03) 50%, rgba(51,255,51,0) 100%)',
            animation: 'scanlineMove 12s linear infinite',
          }}
        />

        {/* Terminal output */}
        <div
          ref={terminalRef}
          className={`flex-1 min-h-0 min-w-0 overflow-y-auto no-scrollbar w-full ${
            compactUi ? 'px-3 py-3 max-w-none' : 'px-4 py-5 sm:px-8 sm:py-6 max-w-3xl mx-auto'
          }`}
        >
          <div className={`${compactUi ? 'mb-3 pb-2' : 'mb-5 pb-4'} border-b border-crt/15`}>
            <TerminalBlock className={`text-crt ${compactUi ? 'text-[12px]' : ''}`}>
              {compactUi ? t('bios.header.compact') : t('bios.header.full')}
            </TerminalBlock>
            {!compactUi && (
              <>
                <div className="h-3" />
                <TerminalBlock className="text-crt/85">{t('bios.version')}</TerminalBlock>
              </>
            )}
          </div>

          <div
            className={`${compactUi ? 'mb-3 px-2 py-2' : 'mb-5 px-3 py-3 sm:px-4'} border border-crt/20 bg-crt/3`}
            style={{ boxShadow: `inset 0 0 20px ${PHOSPHOR}08` }}
          >
            {!compactUi && (
              <div
                className="text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase mb-2"
                style={{ color: PHOSPHOR_DIM }}
              >
                {t('bios.quickHelpTitle')}
              </div>
            )}
            <TerminalBlock
              className={`${compactUi ? 'text-[11px] leading-normal' : 'text-[12px] sm:text-[13px] leading-[1.7]'}`}
              style={{ color: PHOSPHOR_DIM }}
            >
              {compactUi ? t('bios.quickHelp.compact') : t('bios.quickHelp.full')}
            </TerminalBlock>
          </div>

          <div className="space-y-1">{history}</div>

          <div
            className={`mt-4 flex items-center font-mono tracking-wide ${compactUi ? 'text-[12px]' : 'text-[13px] sm:text-[14px]'}`}
          >
            <span className="text-crt font-bold" style={{ textShadow: `0 0 6px ${PHOSPHOR}60` }}>
              C:\&gt;
            </span>
            <span className="text-crt ml-0.5">{currentLine}</span>
            <span
              className="inline-block w-2 h-4 bg-crt ml-1"
              style={{ animation: 'blinker 1s step-end infinite', boxShadow: `0 0 6px ${PHOSPHOR}` }}
            />
          </div>
        </div>

        {/* On-screen keyboard */}
        <AnimatePresence>
        {keyboardVisible && (
          <motion.div
            key="terminal-keyboard"
            initial={isLandscape ? { opacity: 0, x: 16 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={isLandscape ? { opacity: 0, x: 12 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className={`border-crt/15 bg-surface-sunken/95 z-20 touch-none shrink-0 ${
              isLandscape
                ? 'border-l w-52 sm:w-56 overflow-y-auto py-2 pl-1 pr-[max(0.5rem,env(safe-area-inset-right))]'
                : 'border-t p-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]'
            }`}
          >
            <TerminalKeyboard onKey={handleKeyInput} compact={isLandscape} />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import AppleIcon from './icons/AppleIcon';
import { checkMacClosed, firestoreUnlockIntel } from '../store/firestore';
import { analyticsTracker } from '../services/AnalyticsTracker';
import { activityLogger } from '../services/ActivityLogger';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
const TEXTO_CORROMPIDO = `S̸e̵ ̸o̸n̵d̴a̷ ̶s̵o̵n̵o̶r̶a̷ ̷a̶t̶i̵n̵g̷e̸ ̴∇̸ ̴∞̵ ̵n̷o̵ ̵m̶i̶l̶i̴s̸s̶e̵g̷u̴n̸d̸o̵ ̴d̵o̴ ̷e̶r̵r̵o̸ ̶t̴e̵m̵p̵o̶r̵a̵l̴.̶.̶.̷
O̵ ̵█̶█̶█̶█̶█̶█̶█̶█̶█̶█̶ ̷n̵ã̷o̵ ̷é̴ ̵l̵i̶n̴h̷a̴.̵ ̶É̸ ̴u̶m̸ ̷l̶o̵o̵p̸ ̷d̵e̴ ̶c̵ó̸d̵i̴g̵o̵.̶
1̷9̶0̶0̶ ̶▒̶░̶▓̶ ̶E̷R̵R̴O̷ ̸S̷I̸N̸T̸A̶X̵E̴ ̴▓̸░̸▒̸ ̶2̶0̶0̶0̵
A̶c̶h̷a̸m̴ ̴q̴u̷e̷ ̵é̶ ̵b̴u̷g̷ ̸c̷a̵l̶e̷n̸d̸á̷r̸i̴o̷.̸ ̵I̵d̴i̷o̷t̶a̵s̸.̵
L̸I̶M̵B̶O̷_̴0̶1̵ ̶é̶ ̵f̵e̵n̶d̴a̷.̸ ̶█̶█̶█̶█̶█̶█̶█̶ ̸v̵i̸v̵e̵ ̵n̷o̴ ̶e̵s̶p̵a̶ç̶o̵ ̷e̷n̸t̸r̵e̵ ̷z̶e̷r̶o̴s̸.̵
S̵e̴ ̶a̶l̴i̸m̵e̵n̴t̶a̸ ̸d̷e̴ ̴s̶i̶n̵a̵l̵.̶ ̶O̴d̴e̷i̴a̸ ̶a̷n̷a̷l̸ó̸g̵i̶c̸o̸.̸ ̷F̸i̵t̸a̸ ̸é̶ ̸â̷n̸c̶o̸r̸a̶.̶
C̷á̴l̴c̶u̵l̸o̸ ̴t̵r̶a̷n̶s̴i̷ç̸ã̶o̴:̷
(̵E̶ ̸≠ ̷h̷*̸f̴)̷ ̶/̵ █̶▓̶▒̶░̵▄̵▀̶▒̵▓̵█̶ ̵∇̵∞̶ ̵∂̷Ω̶∑̸ ̶¥̸§̷ÿ̷¢̶¿̶ ̶█̶▀̶▄̷█̴▓̷▒̷ ̸R̸E̵A̷L̷I̷D̴A̶D̵E̴ ̸O̴U̵T̶R̶A̷ ̵▒̵▓̴█̸▄̵▀̴ ̷█̴▓̷▒̷ ̵S̵Ω̸Λ̷M̷∂̴ ̸█̶█̶█̶█̶█̶█̶█̶█̶ ̶▓̴▒̸░̷ ̶A̸ ̵C̸ ̸E̷ ̸S̴ ̵S̵ ̵O̵ ̶▓̴▒̷█̴▀̸▄̵ ̶█̶▓̶▒̸ ̴S̵Ω̷Λ̸M̸∂̶ ̸░̷▄̶▀̷▒̷▓̵█̸ ̴∇̷∞̴ ̵∂̸Ω̶∑̴ ̸¥̵§̸ÿ̸¢̸¿̵ ̴█̴▀̵▄̵█̴▓̶▒̶ ̷R̷E̵A̸L̵I̷D̴A̴D̵E̴ ̵O̵U̸T̵R̶A̶ ̸▒̸▓̸█̴▄̵▀̴ ̵
S̵e̷ ̴e̷u̷ ̶s̸u̷m̷i̴r̶,̴ ̶f̴r̶e̵q̵u̶ê̵n̵c̶i̵a̶ ̵f̶u̵n̶c̸i̶o̸n̸o̷u̷.̶
M̶e̷ ̷a̵c̵h̴e̶m̷ ̴n̶o̵ ̵z̴e̴r̶o̵.̶`;
const TEXTO_LIMPO = `A Teoria das Cordas diz que existem 11 dimensões, mas todo mundo está ignorando o óbvio: o zero é a ponte.
Eu percebi que o que está acontecendo agora é uma colisão. É a minha frequência analógica (do deck mesmo) batendo de frente com esse "reset" digital do Bug do Milênio. Se a onda sonora atingir o infinito no exato milisegundo em que o erro temporal acontecer... a gente vai ver a verdade.
O Multiverso não é uma linha reta, como ensinam na escola. É um loop de código. 1900 foi um erro de sintaxe. 2000 é o próximo.
O LIMBO_01 é a fenda que abriu. E o Malware... ele não é um vírus comum. Ele é algo que vive no espaço "entre" os zeros. Ele se alimenta de sinal, por isso ele odeia tudo o que é analógico. A fita cassete é a minha única âncora aqui.
Cálculo de transição: (E=h⋅f)/Y2K_Bug=ACESSO
Se eu sumir hoje, significa que a frequência funcionou. Não me procurem no futuro. Me achem no zero.`;
type RepairStep = 'idle' | 'reading' | 'corrupted' | 'repairing' | 'restored';
type ActiveWindow = null | 'controlPanel' | 'diskRepair';
function WindowTitleBar({ title, onClose, closeAria }: { title: string; onClose: () => void; closeAria: string }) {
  return (
    <div
      className="h-5.5 shrink-0 border-b border-black flex items-center justify-center relative"
      style={{ background: 'repeating-linear-gradient(to bottom, #ddd, #ddd 1px, #aaa 1px, #aaa 2px)' }}
    >
      <button
        onClick={onClose}
        className="absolute left-1.5 w-3 h-3 bg-white border border-black active:bg-black"
        style={{ boxShadow: 'inset 1px 1px 0 #ccc' }}
        aria-label={closeAria}
      />
      <div className="bg-[#ddd] px-2 text-[12px] font-bold border-x border-black">{title}</div>
    </div>
  );
}
const PlatinumButton: React.FC<{
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}> = ({ children, disabled = false, onClick }) => {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="bg-[#ccc] px-3 py-1 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        borderTop: '2px solid #fff',
        borderLeft: '2px solid #fff',
        borderBottom: '2px solid #555',
        borderRight: '2px solid #555',
      }}
    >
      {children}
    </button>
  );
};
function DesktopIcon({ emoji, label, highlighted, onClick }: { emoji: string; label: string; highlighted?: boolean; onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onClick}>
      <div className="w-12 h-10 bg-[#eee] border border-black flex items-center justify-center text-xl group-active:invert"
        style={{ boxShadow: '1px 1px 0 white' }}
      >
        {emoji}
      </div>
      <span
        className={`px-1 text-[10px] font-bold leading-tight text-center ${
          highlighted ? 'bg-black text-white' : 'bg-white border border-black'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
interface MacOsAppProps {
  uid: string;
  characterId?: string;
  onClose: () => void;
}
import { diskRepairService } from '../services/DiskRepairService';
import { intelRegistry } from '../data/intel_registry';

export default function MacOsApp({ uid, characterId, onClose }: MacOsAppProps) {
  const { t } = useTranslation('player');
  const { t: tc } = useTranslation('common');
  const { isLandscape, viewportHeight } = useLandscapeLayout();
  const [phase, setPhase] = useState<'login' | 'desktop'>('login');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeWindow, setActiveWindow] = useState<ActiveWindow>(null);
  const [appleMenuOpen, setAppleMenuOpen] = useState(false);
  const [repairStep, setRepairStep] = useState<RepairStep>('idle');
  const [repairProgress, setRepairProgress] = useState(0);
  const [scrambleText, setScrambleText] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDesktopClick = useCallback(() => {
    setAppleMenuOpen(false);
  }, []);

  const handleClose = useCallback(async () => {
    activityLogger.logAction('macos', 'Solicitou desligamento do MacOS');
    await checkMacClosed(uid, characterId);
    onClose();
  }, [uid, characterId, onClose]);

  const handleLogin = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(20);
    activityLogger.logAction('macos', 'Entrou no Desktop MacOS');
    setPhase('desktop');
  }, [uid]);

  const insertDisk = useCallback(async () => {
    setRepairStep('reading');
    setRepairProgress(0);
    await diskRepairService.startAnalysis(uid, '', setRepairProgress);
    setScrambleText(intelRegistry.get('evidence-disk-01-corrupted')?.textContent || 'ERRO');
    setRepairStep('corrupted');
  }, [uid]);

  const startRepair = useCallback(async () => {
    setRepairStep('repairing');
    setRepairProgress(0);
    const success = await diskRepairService.startRepair(uid, '', setRepairProgress);
    setRepairStep(success ? 'restored' : 'corrupted');
  }, [uid]);

  const openDiskRepair = useCallback(() => {
    activityLogger.logAction('macos', 'Abriu aplicativo: DiskRepair Pro');
    setActiveWindow('diskRepair');
    setRepairStep('idle');
    analyticsTracker.grantAchievement('ACH-REPAIR-APP');
  }, [uid]);
  const closeWindow = useCallback(() => setActiveWindow(null), []);
  const windowMaxHeight = Math.min(480, Math.max(180, viewportHeight - (isLandscape ? 40 : 56)));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none touch-none text-black player-viewport"
      style={{
        backgroundColor: phase === 'desktop' ? '#008080' : '#808080',
        fontFamily: '"Chicago", "Geneva", sans-serif',
      }}
    >

      {phase === 'login' && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '4px 4px' }}
        />
      )}

      <div
        className={`${isLandscape ? 'h-5' : 'h-6'} shrink-0 bg-[#eee] border-b border-black flex items-center justify-between text-[12px] font-bold relative z-50`}
        style={{
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center gap-0 relative min-w-0">
    
          <div
            className={`flex items-center px-2 py-px cursor-pointer transition-colors ${appleMenuOpen ? 'bg-black text-white' : ''}`}
            onClick={(e) => { e.stopPropagation(); setAppleMenuOpen(prev => !prev); }}
          >
            <span className="text-sm"><AppleIcon /></span>
          </div>
    
          <AnimatePresence>
            {appleMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute top-full left-0 mt-px w-48 bg-white border border-black shadow-[2px_2px_0_rgba(0,0,0,0.4)] z-50 py-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[11px] text-gray-400 cursor-default">{t('macos.about')}</div>
                <div className="h-px bg-black mx-1 my-0.5" />
                <div className="px-3 py-1 text-[11px] text-gray-400 cursor-default">{t('macos.system')}</div>
                <div className="px-3 py-1 text-[11px] text-gray-400 cursor-default">{t('macos.machine')}</div>
                <div className="h-px bg-black mx-1 my-0.5" />
                <div
                  className="px-3 py-1 text-[11px] font-bold cursor-pointer hover:bg-black hover:text-white"
                  onClick={handleClose}
                >
                  {tc('os.shutdown')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {phase === 'desktop' && (
            <>
              <div className="cursor-default px-2 hover:bg-black hover:text-white transition-colors">{tc('os.file')}</div>
              <div className="cursor-default px-2 hover:bg-black hover:text-white transition-colors">{tc('os.edit')}</div>
              <div className="cursor-default px-2 hover:bg-black hover:text-white transition-colors">{tc('os.special')}</div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleClose();
            }}
            className="w-4 h-4 flex items-center justify-center border border-black bg-white text-[10px] leading-none hover:bg-black hover:text-white active:bg-black active:text-white"
            style={{ boxShadow: 'inset 1px 1px 0 #ccc' }}
            aria-label={t('macos.closeAria')}
            title={tc('os.close')}
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" onClick={handleDesktopClick}>
        <AnimatePresence mode="wait">
    
          {phase === 'login' && (
            <motion.div
              key="login"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-6"
            >
              <div className="w-full max-w-70 bg-[#eee] border-2 border-black p-4 flex flex-col items-center gap-4 text-center"
                style={{ boxShadow: '2px 2px 0 rgba(0,0,0,1)' }}
              >
                <div className="text-5xl text-black py-2"><AppleIcon size={48} /></div>
                <h2 className="font-bold text-lg tracking-tight">{t('macos.welcome')}</h2>
                <div
                  className="w-full h-8 border border-black flex items-center justify-center text-xs font-black tracking-widest uppercase"
                  style={{ background: 'repeating-linear-gradient(45deg, #eee, #eee 1px, #fff 1px, #fff 2px)' }}
                >
                  {t('macos.machine')}
                </div>
                <button
                  onClick={handleLogin}
                  className="mt-2 w-24 h-8 bg-[#eee] border-2 border-black font-bold text-sm tracking-widest uppercase active:translate-x-px active:translate-y-px"
                  style={{ boxShadow: '1px 1px 0 white, inset 1px 1px 0 white' }}
                >
                  {t('macos.login')}
                </button>
              </div>
            </motion.div>
          )}
    
          {phase === 'desktop' && (
            <motion.div
              key="desktop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
        
              <div
                className={`absolute z-10 ${
                  isLandscape
                    ? 'left-0 top-0 right-0 flex flex-row flex-wrap gap-4 items-start p-2 pl-[max(0.5rem,env(safe-area-inset-left))]'
                    : 'right-0 top-0 bottom-0 w-24 flex flex-col items-center gap-8 p-4'
                }`}
              >
                <DesktopIcon emoji="💿" label={t('macos.hd')} onClick={() => setActiveWindow('controlPanel')} />
                <DesktopIcon emoji="💾" label={t('macos.diskRepair')} highlighted onClick={openDiskRepair} />
                <div className={isLandscape ? '' : 'mt-auto'}>
                  <DesktopIcon emoji="🗑️" label={t('macos.trash')} />
                </div>
              </div>

              <div
                className={`absolute inset-0 flex pointer-events-none px-3 py-2 z-30 ${
                  isLandscape
                    ? 'items-start justify-start pt-12 pl-[max(0.5rem,env(safe-area-inset-left))]'
                    : 'items-center justify-center'
                }`}
              >
                <AnimatePresence>
            
                  {activeWindow === 'controlPanel' && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className={`pointer-events-auto w-full ${isLandscape ? 'max-w-md' : 'max-w-sm'} bg-[#ddd] border border-black flex flex-col min-h-0 overflow-hidden`}
                      style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.5)', maxHeight: windowMaxHeight }}
                    >
                      <WindowTitleBar title={t('macos.controlPanel')} onClose={closeWindow} closeAria={tc('os.closeWindowAria')} />
                      <div className="p-4 bg-white m-1 border border-black text-[11px] font-medium leading-relaxed">
                        <p className="mb-2 uppercase font-black text-center border-b border-black pb-1">{t('macos.systemStatus')}</p>
                        <p>{t('macos.speed')}</p>
                        <p>{t('macos.memory')}</p>
                        <p>{t('macos.osLine')}</p>
                        <hr className="my-2 border-black border-dashed" />
                        <p className="italic">"The computer for the rest of us."</p>
                      </div>
                    </motion.div>
                  )}
            
                  {activeWindow === 'diskRepair' && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className={`pointer-events-auto w-full ${isLandscape ? 'max-w-md' : 'max-w-lg'} bg-[#ddd] border border-black flex flex-col min-h-0 overflow-hidden`}
                      style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.5)', maxHeight: windowMaxHeight }}
                    >
                      <WindowTitleBar title={t('macos.diskRepairTitle')} onClose={closeWindow} closeAria={tc('os.closeWindowAria')} />
                      <div className="p-3 sm:p-4 flex flex-col min-h-0 flex-1 overflow-hidden">
                  
                        <div className="flex gap-2 mb-3 pb-2 shrink-0" style={{ borderBottom: '2px groove #fff' }}>
                          <PlatinumButton 
                            disabled={repairStep !== 'idle'} 
                            onClick={insertDisk}
                          >
                            {t('macos.insertDisk')}
                          </PlatinumButton>
                          <PlatinumButton 
                            disabled={repairStep !== 'corrupted'} 
                            onClick={startRepair}
                          >
                            {t('macos.rebuildSectors')}
                          </PlatinumButton>
                        </div>
                  
                        {repairStep === 'idle' && (
                          <div className="flex-1 flex items-center justify-center text-center text-sm font-bold opacity-60 whitespace-pre-wrap">
                            {t('macos.noVolume')}
                          </div>
                        )}
                        {repairStep === 'reading' && (
                          <div className="flex-1 flex items-center justify-center text-center text-sm font-bold animate-pulse">
                            {t('macos.readingBlocks')}
                          </div>
                        )}
                        {(repairStep === 'corrupted' || repairStep === 'restored') && (
                          <div className="flex-1 min-h-0 overflow-y-auto bg-white p-2 font-mono text-[11px] sm:text-[12px] whitespace-pre-wrap"
                            style={{ border: '2px inset #888' }}
                          >
                            <div className="text-[10px] text-gray-500 mb-2 border-b border-gray-200 pb-1">
                              {t('macos.explorerPreview')}<br />
                              {t('macos.fileLine', { state: repairStep === 'corrupted' ? t('macos.corrupted') : t('macos.recovered') })}
                            </div>
                            {repairStep === 'corrupted' ? TEXTO_CORROMPIDO : TEXTO_LIMPO}
                          </div>
                        )}
                        {repairStep === 'repairing' && (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <div className="text-sm font-bold text-center whitespace-pre-wrap">{t('macos.isolating')}</div>
                            <div className="w-4/5 h-5 border-2 border-black bg-white p-0.5">
                              <div className="h-full bg-black transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-100" style={{ width: `${repairProgress}%` }} />
                            </div>
                          </div>
                        )}
                        {repairStep === 'restored' && (
                          <div className="shrink-0 text-green-700 text-center font-bold text-xs mt-2 py-1 bg-green-50 border border-green-200 uppercase tracking-tight">
                            {t('macos.restoredBanner')}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

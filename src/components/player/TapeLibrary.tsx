import { AnimatePresence, motion } from 'motion/react';
import type { IntelBase } from '../../services/IntelEngine';
import type { DisplayMode } from '../../types/player';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default React.memo(function TapeLibrary({
  intelItems,
  currentIntelId,
  isPlaying,
  displayMode,
  onIntelSelect,
  landscape,
}: {
  intelItems: IntelBase[];
  currentIntelId: string | null;
  isPlaying: boolean;
  displayMode: DisplayMode;
  onIntelSelect: (intel: IntelBase) => void;
  landscape?: boolean;
}) {
  const { t } = useTranslation('player');
  const sorted = React.useMemo(() => {
    if (displayMode === 'title') return [...intelItems].sort((a, b) => a.title.localeCompare(b.title));
    if (displayMode === 'chapter')
      return [...intelItems].sort((a, b) =>
        (a.metadata?.chapter || '').localeCompare(b.metadata?.chapter || ''),
      );
    if (displayMode === 'type')
      return [...intelItems].sort(
        (a, b) => a.getTypeOrder() - b.getTypeOrder() || a.title.localeCompare(b.title),
      );
    return intelItems;
  }, [intelItems, displayMode]);

  return (
    <div
      className={`${landscape ? 'mt-0' : 'mt-6 mr-19'} flex-1 bg-surface-raised rounded-panel border border-border-strong shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden flex flex-col min-h-0`}
    >
      <div
        className={`${landscape ? 'px-2 py-1.5' : 'p-3'} border-b border-border bg-surface-panel flex items-center justify-between shrink-0`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`${landscape ? 'w-5 h-5' : 'w-6 h-6'} bg-accent rounded-inset shadow-hairline flex items-center justify-center`}
          >
            <span className="text-white font-black text-sm italic">R.</span>
          </div>
          <h2 className={`text-accent font-bold tracking-tight ${landscape ? 'text-xs' : 'text-sm'}`}>
            {t('walkman.library.title')}
          </h2>
        </div>
        <span className="text-[9px] text-ash-400 font-bold uppercase tracking-widest">
          {displayMode === 'default'
            ? t('walkman.library.sort.original')
            : displayMode === 'title'
              ? t('walkman.library.sort.az')
              : displayMode === 'chapter'
                ? t('walkman.library.sort.chapter')
                : t('walkman.library.sort.type')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <style>{`.tape-scroll::-webkit-scrollbar{width:4px}.tape-scroll::-webkit-scrollbar-track{background:var(--color-surface-raised)}.tape-scroll::-webkit-scrollbar-thumb{background:var(--color-accent);border-radius:4px}`}</style>
        <div className="tape-scroll overflow-y-auto h-full">
          {intelItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <span className="text-3xl mb-2">📼</span>
              <p className="text-ash-500 text-xs uppercase tracking-widest">{t('walkman.library.empty')}</p>
              <p className="text-ash-600 text-[10px] mt-1">
                {t('walkman.library.emptyHint')}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sorted.map((item, idx) => {
                const showGroupHeader =
                  displayMode === 'type' && (idx === 0 || sorted[idx - 1].type !== item.type);
                return (
                  <React.Fragment key={item.id}>
                    {showGroupHeader && (
                      <div className="px-3 py-1.5 bg-surface-sunken border-b border-border sticky top-0 z-10">
                        <span className="text-[9px] text-accent-80 font-bold uppercase tracking-widest">
                          {item.getTypeLabel()}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => onIntelSelect(item)}
                      className={`p-2 border-b border-border-subtle cursor-pointer transition-colors duration-150 ease-limbo flex justify-between items-center ${item.id === currentIntelId ? 'bg-accent-10 border-border-accent' : 'hover:bg-surface-container active:bg-surface-container-high'}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span
                          className={`text-xs font-bold truncate ${item.id === currentIntelId ? 'text-accent' : 'text-on-background'}`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] text-primary/80 truncate">
                          {item.metadata?.chapter}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.id === currentIntelId && isPlaying && (
                          <motion.div
                            animate={{ opacity: [0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.5 }}
                            className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-accent border-b-4 border-b-transparent"
                          />
                        )}
                        <div
                          className={`w-8 h-8 rounded-control border flex items-center justify-center text-sm ${
                            item.type === 'TEXT'
                              ? 'bg-accent-20 border-border-accent glow-orange-subtle'
                              : item.type === 'VISUAL'
                                ? 'bg-tube-600/30 border-tube-500 shadow-[0_0_0_1px_rgba(106,139,155,0.25),0_0_8px_-2px_rgba(106,139,155,0.5)]'
                                : item.type === 'META'
                                  ? 'bg-yellow-600/30 border-yellow-500 shadow-[0_0_0_1px_rgba(234,179,8,0.25),0_0_8px_-2px_rgba(234,179,8,0.5)]'
                                  : 'bg-surface-container border-border-strong shadow-hairline'
                          }`}
                        >
                          {item.getTypeIcon()}
                        </div>
                      </div>
                    </motion.div>
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
});

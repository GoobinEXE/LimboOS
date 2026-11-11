import { AnimatePresence, motion } from 'motion/react';
import type { IntelBase } from '../../services/IntelEngine';
import type { DisplayMode } from '../../types/player';
import React from 'react';
import { useTranslation } from 'react-i18next';
import IntelTypeIcon from './IntelTypeIcon';

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
      className={`${landscape ? 'mt-0' : 'mt-6 mr-19'} flex-1 bg-surface-raised rounded-panel overflow-hidden flex flex-col min-h-0`}
    >
      <div
        className={`${landscape ? 'px-2 py-1.5' : 'p-3'} bg-accent text-field-ink flex items-center justify-between shrink-0`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`${landscape ? 'w-5 h-5' : 'w-6 h-6'} bg-field-ink rounded-inset flex items-center justify-center`}
          >
            <span className="text-accent font-black text-sm italic">R.</span>
          </div>
          <h2 className={`font-display font-extrabold uppercase tracking-tight ${landscape ? 'text-xs' : 'text-sm'}`}>
            {t('walkman.library.title')}
          </h2>
        </div>
        <span className="font-mono text-[10px] text-field-ink/70 font-semibold uppercase tracking-wider">
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
        <style>{`.tape-scroll::-webkit-scrollbar{width:4px}.tape-scroll::-webkit-scrollbar-track{background:var(--color-surface-raised)}.tape-scroll::-webkit-scrollbar-thumb{background:var(--color-ash-600);border-radius:2px}`}</style>
        <div className="tape-scroll overflow-y-auto h-full">
          {intelItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <IntelTypeIcon type="AUDIO" size={28} className="text-ash-600 mb-2" />
              <p className="text-ash-400 text-protocol">{t('walkman.library.empty')}</p>
              <p className="text-ash-500 text-xs mt-1">
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
                      <div className="px-3 py-1.5 bg-surface-panel border-b border-seam sticky top-0 z-10 flex items-center gap-1.5 text-accent">
                        <IntelTypeIcon type={item.type} size={11} />
                        <span className="text-protocol text-[10px]">
                          {item.getTypeLabel()}
                        </span>
                      </div>
                    )}
                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => onIntelSelect(item)}
                      aria-current={item.id === currentIntelId ? 'true' : undefined}
                      className={`w-full text-left px-3 py-2.5 border-b border-seam cursor-pointer transition-colors duration-150 ease-limbo flex justify-between items-center focus-visible:-outline-offset-2 ${item.id === currentIntelId ? 'bg-field-bone' : 'hover:bg-surface-container active:bg-surface-container-high'}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span
                          className={`text-[13px] font-bold truncate ${item.id === currentIntelId ? 'text-field-ink' : 'text-on-background'}`}
                        >
                          {item.title}
                        </span>
                        <span className={`text-[11px] font-mono truncate ${item.id === currentIntelId ? 'text-ash-700' : 'text-ash-400'}`}>
                          {item.metadata?.chapter}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.id === currentIntelId && isPlaying && (
                          <motion.div
                            animate={{ opacity: [0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.5 }}
                            className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-field-ink border-b-4 border-b-transparent"
                          />
                        )}
                        <div
                          title={item.getTypeLabel()}
                          className={`w-8 h-8 rounded-control flex items-center justify-center ${
                            item.type === 'TEXT'
                              ? 'bg-accent text-field-ink'
                              : item.type === 'VISUAL'
                                ? 'bg-tube-300 text-tube-950'
                                : item.type === 'META'
                                  ? 'bg-yellow-400 text-yellow-950'
                                  : 'bg-surface-container-highest text-ash-100'
                          }`}
                        >
                          <IntelTypeIcon type={item.type} size={15} />
                        </div>
                      </div>
                    </motion.button>
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

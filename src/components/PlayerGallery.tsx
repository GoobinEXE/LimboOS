import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { EXIT_FAST, SPRING_INDICATOR, SPRING_SNAP } from '../lib/motion';
import { X, MapPin, Search, User, Package, Image as ImageIcon } from 'lucide-react';
import type { GalleryImage, GalleryCategory } from '../store/firestore';

interface PlayerGalleryProps {
  images: GalleryImage[];
  variant?: 'default' | 'nokia';
}

const TABS: { id: GalleryCategory; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'locais', Icon: MapPin },
  { id: 'pistas', Icon: Search },
  { id: 'pessoas', Icon: User },
  { id: 'itens', Icon: Package },
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';
const pad = (n: number) => String(n).padStart(2, '0');

const CornerMarks = ({ className = 'border-border-accent' }: { className?: string }) => (
  <>
    <span aria-hidden className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l ${className}`} />
    <span aria-hidden className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r ${className}`} />
    <span aria-hidden className={`absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l ${className}`} />
    <span aria-hidden className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r ${className}`} />
  </>
);

export default function PlayerGallery({ images, variant = 'default' }: PlayerGalleryProps) {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<GalleryCategory>('locais');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const filtered = images.filter(img => img.category === activeTab);
  const getCounts = (cat: GalleryCategory) => images.filter(i => i.category === cat).length;
  const tabLabel = (id: GalleryCategory) => t(`gallery.tab.${id}`);
  const selectedTab = selectedImage ? TABS.find(tab => tab.id === selectedImage.category) : null;

  if (variant === 'nokia') {
    if (images.length === 0) {
      return (
        <div className="text-[8px] text-center border border-dashed border-lcd-ink py-3 opacity-70 font-bold">
          {t('gallery.emptyNokia')}
        </div>
      );
    }
    return (
      <div className="space-y-1 text-lcd-ink font-mono text-[9px] uppercase relative">
        <div className="flex gap-1 mb-1 border-b border-lcd-ink pb-1">
          {TABS.map(tab => {
            const count = getCounts(tab.id);
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 border border-lcd-ink py-0.5 text-center transition ${
                  isActive ? 'bg-lcd-ink text-lcd-paper font-bold' : 'hover:bg-lcd-ink/10'
                }`}
              >
                {tabLabel(tab.id).substring(0, 3)}{count > 0 && `:${count}`}
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-1"
          >
            {filtered.length === 0 ? (
              <div className="col-span-2 text-center py-2 opacity-60 border border-dashed border-lcd-ink">{t('gallery.noRecordsNokia')}</div>
            ) : (
              filtered.map((img, idx) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className="border border-lcd-ink p-px cursor-pointer hover:bg-lcd-ink hover:text-lcd-paper group transition relative"
                >
                  <div className="aspect-square bg-black overflow-hidden relative grayscale contrast-150 brightness-75 group-hover:grayscale-0 group-hover:contrast-100 transition">
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                    />
                    <span className="absolute top-0 left-0 bg-lcd-paper text-lcd-ink text-[6px] font-bold px-0.5 leading-tight">{t('gallery.imgIndex', { n: pad(idx + 1) })}</span>
                  </div>
                  <div className="text-[7px] font-bold truncate mt-0.5 px-0.5 text-center group-hover:text-lcd-paper">{img.title}</div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-100 bg-lcd-paper flex flex-col p-1 border-2 border-lcd-ink"
              onClick={() => setSelectedImage(null)}
            >
              <div className="flex justify-between items-center border-b-2 border-lcd-ink pb-1 shrink-0 font-bold mb-1">
                <span>{t('gallery.viewerTitle')}</span>
                <button className="border border-lcd-ink px-1 hover:bg-lcd-ink hover:text-lcd-paper active:scale-[0.97] transition">{t('actions.x')}</button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>
                <div className="border-4 border-lcd-ink p-1 bg-black mb-2 grayscale contrast-125 w-full">
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.title}
                    className="w-full h-auto object-contain"
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                  />
                </div>
                <div className="text-center font-bold">{selectedImage.title}</div>
                {selectedImage.description && <div className="text-[8px] mt-1 px-2 text-center opacity-80">{selectedImage.description}</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="relative rounded-card border border-dashed border-border bg-surface-raised/40 p-6 text-center">
        <div className="w-12 h-12 rounded-control bg-surface-sunken border border-border flex items-center justify-center mx-auto mb-3 text-primary/40">
          <ImageIcon size={20} />
        </div>
        <p className="text-protocol text-ash-400 mb-1">{t('gallery.emptyTitle')}</p>
        <p className="text-[10px] text-ash-600 font-sans">{t('gallery.emptyHint')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1 mb-3 p-1 rounded-card border border-border bg-surface-sunken shadow-hairline">
        {TABS.map(tab => {
          const count = getCounts(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-control text-protocol text-[9px] transition-colors duration-200 ${
                isActive ? 'text-primary' : 'text-ash-500 hover:text-ash-300'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="gallery-tab"
                  className="absolute inset-0 rounded-control bg-accent-10 border border-border-accent"
                  transition={SPRING_INDICATOR}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <tab.Icon size={10} />
                <span className="hidden min-[360px]:inline">{tabLabel(tab.id)}</span>
                {count > 0 && (
                  <span className={`text-mono-ui text-[9px] ${isActive ? 'text-primary/80' : 'text-ash-500'}`}>{count}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-border p-6 text-center">
              <p className="text-protocol text-[9px] text-ash-500">{t('gallery.emptyCategory')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((img, idx) => (
                <motion.button
                  type="button"
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  onClick={() => setSelectedImage(img)}
                  className="relative rounded-card overflow-hidden border border-border bg-surface-raised text-left cursor-pointer group hover:border-border-accent active:scale-[0.98] transition duration-200"
                >
                  <div className="aspect-square overflow-hidden relative bg-surface-sunken">
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover saturate-[0.8] sepia-[0.15] group-hover:saturate-100 group-hover:sepia-0 transition-[filter] duration-300 ease-limbo"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                    />
                    <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
                    <span className="absolute top-1.5 left-1.5 text-mono-ui text-[8px] text-white/70 bg-black/75 px-1.5 py-0.5 rounded-inset">
                      {t('gallery.imgIndex', { n: pad(idx + 1) })}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 border-t border-border-subtle">
                    <p className="text-[10px] font-semibold text-white truncate leading-tight">{img.title}</p>
                    {img.description && (
                      <p className="text-[9px] text-ash-500 truncate mt-0.5 font-sans">{img.description}</p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-surface-overlay flex flex-col items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, transition: EXIT_FAST }}
              transition={SPRING_SNAP}
              className="relative max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative rounded-card border border-border-strong bg-surface-panel shadow-panel overflow-hidden">
                <div aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-accent via-accent-60 to-transparent z-10" />
                <div className="relative p-3 pt-4">
                  <div className="relative rounded-inset overflow-hidden bg-surface-sunken border border-border">
                    <img
                      src={selectedImage.imageUrl}
                      alt={selectedImage.title}
                      className="w-full h-auto max-h-[58vh] object-contain"
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                    />
                    <CornerMarks />
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    {selectedTab && (
                      <span className="inline-flex items-center gap-1.5 text-protocol text-[8px] text-primary/70">
                        <selectedTab.Icon size={10} />
                        {tabLabel(selectedTab.id)}
                      </span>
                    )}
                    <span className="text-mono-ui text-[9px] text-ash-600">{t('gallery.evidenceVisual')}</span>
                  </div>
                  <p className="text-display text-base text-white uppercase">{selectedImage.title}</p>
                  {selectedImage.description && (
                    <p className="text-ash-400 text-xs mt-1.5 leading-relaxed font-sans">{selectedImage.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                aria-label={t('closeAria')}
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-surface-panel border border-border-strong flex items-center justify-center text-primary hover:border-border-accent hover:bg-accent-10 transition-colors shadow-panel"
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

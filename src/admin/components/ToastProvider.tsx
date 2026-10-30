import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ADMIN_SPRING_TOAST } from '../lib/motion';
import { EXIT_FAST } from '../../lib/motion';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;

const TOAST_STYLES: Record<ToastType, { frame: string; text: string; bar: string; icon: string }> = {
  success: {
    frame: 'border-phosphor-500/30',
    text: 'text-phosphor-300',
    bar: 'bg-phosphor-400',
    icon: 'check_circle',
  },
  error: {
    frame: 'border-red-500/35',
    text: 'text-red-300',
    bar: 'bg-red-400',
    icon: 'error',
  },
  info: {
    frame: 'border-accent-40',
    text: 'text-primary',
    bar: 'bg-accent',
    icon: 'info',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast_${++counterRef.current}_${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      // FIFO: keep only the latest MAX_TOASTS
      return next.slice(-MAX_TOASTS);
    });
  }, []);

  const contextValue: ToastContextValue = {
    success: useCallback((msg: string) => addToast('success', msg), [addToast]),
    error: useCallback((msg: string) => addToast('error', msg), [addToast]),
    info: useCallback((msg: string) => addToast('info', msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Pilha de toasts — canto inferior direito, mesmo lado de entrada e saída */}
      <div
        className="fixed bottom-12 right-6 z-[9998] flex flex-col items-end gap-2 pointer-events-none w-full max-w-sm"
        role="status"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <AdminToast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function AdminToast({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const paused = hovered || pageHidden;
  const style = TOAST_STYLES[toast.type];

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Timer pausável: guarda o tempo restante ao pausar (hover ou aba oculta)
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const id = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(id);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [paused, onDismiss, toast.id]);

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 48, transition: EXIT_FAST }}
      transition={ADMIN_SPRING_TOAST}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => onDismiss(toast.id)}
      className={`pointer-events-auto relative overflow-hidden w-full flex items-center gap-3 pl-4 pr-5 py-3.5 text-left bg-surface-container-low border ${style.frame} rounded-inset shadow-xl machined-edge font-display`}
    >
      <span className={`material-symbols-outlined text-[18px] shrink-0 ${style.text}`} aria-hidden>
        {style.icon}
      </span>
      <span className={`text-[11px] font-bold uppercase tracking-[0.14em] flex-1 leading-relaxed ${style.text}`}>
        {toast.message}
      </span>
      {/* Contagem regressiva em CSS: pausa junto com o timer */}
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 right-0 h-px origin-left opacity-70 ${style.bar}`}
        style={{
          animation: `toast-countdown ${AUTO_DISMISS_MS}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.button>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components rendered outside ToastProvider (e.g. during tests)
    return {
      success: (msg) => console.log('[Toast] success:', msg),
      error: (msg) => console.error('[Toast] error:', msg),
      info: (msg) => console.info('[Toast] info:', msg),
    };
  }
  return ctx;
}

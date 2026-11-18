import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ADMIN_SPRING_TOAST } from '../lib/motion';
import { EXIT_FAST } from '../../lib/motion';
import MIcon from './MIcon';

type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  /** Ação opcional (ex.: "Desfazer"). Clicar nela executa o callback e dispensa o toast. */
  action?: ToastAction;
  /** Duração em ms; padrão 4000, ou 8000 quando há ação. */
  durationMs?: number;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  durationMs: number;
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;
const ACTION_DISMISS_MS = 8000;

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

  const addToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = `toast_${++counterRef.current}_${Date.now()}`;
    const durationMs = options?.durationMs ?? (options?.action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS);
    setToasts((prev) => {
      const next = [...prev, { id, type, message, action: options?.action, durationMs }];
      // FIFO: keep only the latest MAX_TOASTS
      return next.slice(-MAX_TOASTS);
    });
  }, []);

  const contextValue: ToastContextValue = {
    success: useCallback((msg: string, options?: ToastOptions) => addToast('success', msg, options), [addToast]),
    error: useCallback((msg: string, options?: ToastOptions) => addToast('error', msg, options), [addToast]),
    info: useCallback((msg: string, options?: ToastOptions) => addToast('info', msg, options), [addToast]),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Pilha de toasts — canto inferior direito, mesmo lado de entrada e saída */}
      <div
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] lg:bottom-12 right-6 z-[9998] flex flex-col items-end gap-2 pointer-events-none w-full max-w-sm"
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
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const remainingRef = useRef(toast.durationMs);
  const paused = hovered || focused || pageHidden;
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

  // Esc dispensa enquanto o toast está em uso (hover ou foco)
  useEffect(() => {
    if (!hovered && !focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss(toast.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hovered, focused, onDismiss, toast.id]);

  const { action } = toast;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 48, transition: EXIT_FAST }}
      transition={ADMIN_SPRING_TOAST}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => onDismiss(toast.id)}
      className={`pointer-events-auto relative overflow-hidden w-full flex items-center gap-3 pl-4 pr-3 py-2 min-h-12 text-left cursor-pointer bg-surface-container-low ${style.frame} rounded-inset shadow-panel machined-edge font-display`}
    >
      <MIcon name={style.icon} className={`text-[18px] shrink-0 ${style.text}`} />
      <span className={`text-[11px] font-bold uppercase tracking-[0.14em] flex-1 leading-relaxed ${style.text}`}>
        {toast.message}
      </span>
      {action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void action.onClick();
            onDismiss(toast.id);
          }}
          className={`shrink-0 min-h-11 min-w-11 px-3 text-[11px] font-bold uppercase tracking-[0.14em] rounded-inset bg-surface-container-high hover:bg-surface-container-highest transition-colors ${style.text}`}
        >
          {action.label}
        </button>
      )}
      {/* Contagem regressiva em CSS: pausa junto com o timer */}
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 right-0 h-px origin-left opacity-70 ${style.bar}`}
        style={{
          animation: `toast-countdown ${toast.durationMs}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.div>
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

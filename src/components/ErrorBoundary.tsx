import React, { ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Quando muda, o boundary descarta o erro e tenta renderizar de novo. */
  resetKey?: string;
  /** Chamado pelo botão da variante compacta (em vez de recarregar a página). */
  onReset?: () => void;
  /** Placa menor para mini-apps: título e botão próprios, sem recarregar. */
  variant?: 'page' | 'miniApp';
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError && this.props.variant === 'miniApp' && !this.props.fallback) {
      return (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-surface-sunken" role="alert">
          <div className="max-w-sm w-full">
            <div className="bg-[#d9ad3c] text-[#14110a] px-5 py-3 rounded-inset shadow-panel">
              <p className="font-display font-bold text-xl tracking-[0.08em] uppercase leading-none">
                {i18n.t('errorBoundary.miniApp.title', { ns: 'common' })}
              </p>
            </div>
            <div className="mt-3 bg-surface-container-lowest rounded-inset p-5 font-mono shadow-panel">
              <p className="text-sm text-ash-300 leading-relaxed mb-5">
                {i18n.t('errorBoundary.miniApp.body', { ns: 'common' })}
              </p>
              <button
                type="button"
                onClick={() => this.props.onReset?.()}
                className="lmb-btn lmb-btn-primary w-full"
              >
                {i18n.t('errorBoundary.miniApp.back', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-6" role="alert">
          <div className="max-w-md w-full">
            {/* Placa de advertência da bancada (hero: WARNING / SYSTEM INSTABILITY) */}
            <div className="bg-[#d9ad3c] text-[#14110a] px-5 py-3 rounded-inset shadow-panel">
              <p className="font-display font-bold text-2xl tracking-[0.08em] uppercase leading-none">
                {i18n.t('errorBoundary.title', { ns: 'common' })}
              </p>
            </div>
            <div className="mt-3 bg-surface-container-lowest rounded-inset p-5 font-mono shadow-panel">
              <p className="text-sm text-ash-300 leading-relaxed mb-4">
                {i18n.t('errorBoundary.body', { ns: 'common' })}
              </p>
              <pre className="bg-surface-sunken p-3 rounded-inset text-[11px] text-red-300/90 whitespace-pre-wrap break-words overflow-auto max-h-32 mb-5">
                {this.state.error?.message}
              </pre>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="lmb-btn lmb-btn-primary w-full"
              >
                {i18n.t('errorBoundary.reload', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

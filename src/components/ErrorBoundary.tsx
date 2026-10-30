import React, { ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-6" role="alert">
          <div className="max-w-md w-full">
            {/* Placa de advertência da bancada (hero: WARNING / SYSTEM INSTABILITY) */}
            <div className="border-2 border-[#d9ad3c] bg-[#d9ad3c] text-[#14110a] px-5 py-3 rounded-inset shadow-xl">
              <p className="font-display font-bold text-2xl tracking-[0.08em] uppercase leading-none">
                {i18n.t('errorBoundary.title', { ns: 'common' })}
              </p>
            </div>
            <div className="mt-3 border border-border bg-surface-container-lowest rounded-inset p-5 font-mono shadow-panel">
              <p className="text-sm text-ash-300 leading-relaxed mb-4">
                {i18n.t('errorBoundary.body', { ns: 'common' })}
              </p>
              <pre className="bg-surface-sunken p-3 rounded-inset border border-red-500/20 text-[11px] text-red-300/90 whitespace-pre-wrap break-words overflow-auto max-h-32 mb-5">
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

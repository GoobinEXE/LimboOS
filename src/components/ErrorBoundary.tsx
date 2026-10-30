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
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md w-full border border-red-900/50 bg-red-950/10 p-6 rounded-lg text-red-500 font-mono">
            <h2 className="text-xl mb-4 flex items-center gap-2">
              <span className="animate-pulse">⚠️</span> {i18n.t('errorBoundary.title', { ns: 'common' })}
            </h2>
            <p className="text-sm opacity-80 mb-6">
              {i18n.t('errorBoundary.body', { ns: 'common' })}
            </p>
            <div className="bg-black/50 p-3 rounded border border-red-900/30 text-xs overflow-auto max-h-32 mb-6">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 rounded transition-colors text-sm uppercase tracking-wider"
            >
              {i18n.t('errorBoundary.reload', { ns: 'common' })}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

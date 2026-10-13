import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CampusOS ErrorBoundary] Caught render exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleClearCacheAndReload = (): void => {
    try {
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('campus_user_data_') || key.startsWith('campus_') || key.startsWith('vtop_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('Failed clearing cache in ErrorBoundary:', e);
    }
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'CampusOS encountered a display error';
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="min-h-[500px] w-full flex items-center justify-center p-6 my-auto">
          <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-error-container/40 text-error flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-xl font-headline-md font-semibold text-on-surface mb-2">
              {title}
            </h2>

            <p className="text-sm font-body-sm text-on-surface-variant mb-4 leading-relaxed">
              CampusOS protected your session from crashing completely. You can reload the view or clear cached state.
            </p>

            <div className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-left mb-6 font-mono text-xs text-error overflow-x-auto max-h-32">
              <span className="font-semibold block mb-0.5 text-on-surface">Error details:</span>
              <span className="break-all">{errorMessage}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-lg bg-primary text-on-primary font-label-md text-xs font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
              >
                <RefreshCw size={14} />
                <span>Reload View</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-outline-variant/30"
              >
                <Home size={14} />
                <span>Return to Home</span>
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

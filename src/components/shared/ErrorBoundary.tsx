import React, { Component, ReactNode } from 'react';
import localforage from 'localforage';
import Button from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Called when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleClearStorageAndRetry = async () => {
    try {
      // Clear localforage (IndexedDB)
      await localforage.clear();
      // Also clear localStorage as fallback
      localStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Time: ${new Date().toISOString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4">
          <div className="max-w-lg w-full bg-surface-0 rounded-lg shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-validation-error-bg p-6 text-center">
              <div className="text-6xl mb-3">😵</div>
              <h2 className="text-2xl font-bold text-validation-error-text">
                Oops! Something went wrong
              </h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-text-secondary text-center">
                Guido encountered an unexpected error. Don't worry, your data might still be safe!
              </p>

              {/* Error message */}
              <div className="bg-surface-2 rounded-lg p-3 text-sm">
                <p className="text-text-primary font-mono break-all">
                  {error?.message || 'An unknown error occurred'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={this.handleRetry} type="primary" className="flex-1">
                  🔄 Try Again
                </Button>
                <Button onClick={() => window.location.reload()} type="secondary" className="flex-1">
                  🔃 Reload Page
                </Button>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => void this.handleCopyError()} 
                  type="primary-text" 
                  size="small"
                  className="flex-1"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Error Details'}
                </Button>
                <Button 
                  onClick={this.toggleDetails} 
                  type="primary-text" 
                  size="small"
                  className="flex-1"
                >
                  {showDetails ? '🔼 Hide Details' : '🔽 Show Details'}
                </Button>
              </div>

              {/* Expandable details */}
              {showDetails && (
                <div className="bg-surface-2 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 space-y-2">
                  {error?.stack && (
                    <div>
                      <p className="text-text-tertiary mb-1">Stack trace:</p>
                      <pre className="text-text-secondary whitespace-pre-wrap break-all">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {isDev && errorInfo?.componentStack && (
                    <div>
                      <p className="text-text-tertiary mb-1">Component stack:</p>
                      <pre className="text-text-secondary whitespace-pre-wrap break-all">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Nuclear option */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-text-tertiary mb-2 text-center">
                  If the error persists, try clearing cached data:
                </p>
                <Button 
                  onClick={() => void this.handleClearStorageAndRetry()} 
                  type="secondary" 
                  size="small"
                  className="w-full"
                >
                  🗑️ Clear Cache & Reload
                </Button>
                <p className="text-xs text-text-tertiary mt-1 text-center">
                  ⚠️ This will reset your saved template and settings
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
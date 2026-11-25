import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('praBin ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while loading this view.';
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string };
        if (parsed?.error) {
          friendly = parsed.error;
        }
      } catch {
        if (this.state.message) {
          friendly = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#141210] text-[#1C1917] dark:text-[#F5F2EB] flex items-center justify-center px-6">
          <div className="max-w-md w-full border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] rounded-2xl p-8 text-center">
            <h2 className="font-serif text-2xl font-semibold mb-3">Unable to display this page</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E] transition-colors"
            >
              Reload praBin
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  message?: string;
}

// App-wide safety net: if any render throws (e.g. a third-party script mutating
// the DOM out from under React), show a branded fallback instead of a blank
// white screen, with a way to recover.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : undefined };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[app] Unhandled render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0d',
          color: '#f5f5f7',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#e10600' }}>
            Parc / Fermé
          </p>
          <h1 style={{ fontSize: '1.6rem', margin: '0.75rem 0', fontWeight: 700 }}>Something interrupted the page</h1>
          <p style={{ color: '#9b9ba6', fontSize: '0.9rem', lineHeight: 1.6 }}>
            We hit an unexpected error while loading. Reloading usually clears it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              borderRadius: '9999px',
              background: '#e10600',
              color: '#0a0a0d',
              fontWeight: 700,
              border: 'none',
              padding: '0.75rem 2rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

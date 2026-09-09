import React from 'react';
import ReactDOM from 'react-dom/client';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import App from './App.jsx';
import './index.css';
import { SmartCursor } from './components/ui/SmartCursor';

// Global runtime safety: ensure React.use is defined and expose React hooks globally
if (!React.use) {
  React.use = function(usable) {
    if (usable && typeof usable === 'object') {
      return React.useContext(usable);
    }
    return React.useContext(usable);
  };
}

if (typeof window !== 'undefined') {
  window.React = React;
  window.use = React.use;
  window.useState = React.useState;
  window.useEffect = React.useEffect;
  window.useMemo = React.useMemo;
  window.useCallback = React.useCallback;
  window.useRef = React.useRef;
}
if (typeof globalThis !== 'undefined') {
  globalThis.React = React;
  globalThis.use = React.use;
  globalThis.useState = React.useState;
  globalThis.useEffect = React.useEffect;
  globalThis.useMemo = React.useMemo;
  globalThis.useCallback = React.useCallback;
  globalThis.useRef = React.useRef;
}

// Global error boundary — catches any component crash and shows recovery UI
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[LedgerMind] Uncaught render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#FAFAF8', fontFamily: 'Inter, sans-serif', gap: '16px'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: '10px 24px', borderRadius: '12px', background: '#000',
              color: '#fff', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Smart context-aware cursor — shows different labels per hovered element */}
      <SmartCursor />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

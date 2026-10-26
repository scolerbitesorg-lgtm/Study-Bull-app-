import React from 'react';
import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import { MotionProvider } from './lib/motionLazy';
import './index.css';

// Top-level safety net: an error while the app starts must never leave a blank page or an endless loader.
class RootBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('StudyBull root error:', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ fontFamily: 'system-ui,sans-serif', maxWidth: 640, margin: '0 auto', padding: '48px 20px', textAlign: 'center', color: '#0f172a' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>StudyBull</h1>
        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>पेज खुलने में दिक्कत आई।</p>
        <button
          type="button"
          onClick={() => location.reload()}
          style={{ marginTop: 14, padding: '10px 22px', border: 0, borderRadius: 12, background: '#0f766e', color: '#fff', fontSize: 15, fontWeight: 700 }}
        >
          दोबारा लोड करें
        </button>
      </main>
    );
  }
}

function Mounted() {
  React.useEffect(() => {
    (window as any).__sbMounted = true;
  }, []);
  return null;
}

(window as any).__sbMounted = false;
try {
  createRoot(document.getElementById('root')!).render(
    <RootBoundary>
      <Mounted />
      <MotionProvider>
        <App />
      </MotionProvider>
      <Analytics />
    </RootBoundary>
  );
} catch (e) {
  console.error(e);
  (window as any).__sbBootFail?.('पेज खुलने में दिक्कत आई।');
}

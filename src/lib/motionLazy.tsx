import React from 'react';
import { LazyMotion } from 'motion/react';

// The animation engine (~35 KB gzip) loads as its own chunk after the first paint. Until it arrives,
// <m.*> elements render in their final state (the first home paint uses initial={false}), so nothing waits on it.
let ready = false;
const loadFeatures = () =>
  import('./motionFeatures').then((r) => {
    ready = true;
    return r.default;
  });

export function motionFeaturesReady(): boolean {
  return ready;
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}

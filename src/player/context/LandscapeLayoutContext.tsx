import React, { createContext, useContext } from 'react';
import { useLandscapeLayoutState } from '../hooks/useLandscapeLayout';

export type LandscapeLayoutValue = {
  isLandscape: boolean;
  viewportHeight: number;
};

const LandscapeLayoutContext = createContext<LandscapeLayoutValue | null>(null);

export function LandscapeLayoutProvider({ children }: { children: React.ReactNode }) {
  const value = useLandscapeLayoutState();
  return (
    <LandscapeLayoutContext.Provider value={value}>{children}</LandscapeLayoutContext.Provider>
  );
}

/** Consome o provider único; evita N listeners de matchMedia/resize. */
export function useLandscapeLayout(): LandscapeLayoutValue {
  const ctx = useContext(LandscapeLayoutContext);
  if (!ctx) {
    throw new Error('useLandscapeLayout must be used within LandscapeLayoutProvider');
  }
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Appearance, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

// Brand roles are separate from status colors (success, warning, error).
export const brandColors = {
  forest: '#102C29',
  teal: '#247568',
  mint: '#B9E4CB',
  ivory: '#F8F7F1',
  slate: '#24343A',
} as const;

export const themeColors = {
  light: {
    background: brandColors.ivory, surface: '#ffffff', text: brandColors.slate, muted: '#596876',
    border: '#e8edf2', accent: brandColors.teal, dock: brandColors.forest, dockText: brandColors.ivory,
  },
  dark: {
    background: '#101923', surface: '#1b2937', text: brandColors.ivory, muted: '#b4c3d0',
    // Keep the existing high-contrast dark accent until every filled control can use a dark foreground.
    border: '#35495b', accent: '#72b6ff', dock: '#1b2937', dockText: brandColors.ivory,
  },
} as const;

export type AppColors = { [K in keyof typeof themeColors.light]: string };
type AppThemeValue = { mode: ThemeMode; colors: AppColors; setMode: (mode: ThemeMode) => void };
const STORAGE_KEY = 'property-peace:appearance-mode';
const ThemeContext = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === 'light' || saved === 'dark')) updateMode(saved);
      })
      .catch(() => { /* Keep the default when device storage is unavailable. */ })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    updateMode(next);
    pendingWrite.current = pendingWrite.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, next))
      .catch(() => { /* Keep the in-memory preference if storage fails. */ });
  }, []);
  useEffect(() => {
    if (ready) Appearance.setColorScheme(mode);
  }, [mode, ready]);
  const value = useMemo(() => ({ mode, colors: themeColors[mode], setMode }), [mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: themeColors.light.background, justifyContent: 'center' }}><ActivityIndicator color={themeColors.light.accent} /></View>}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeValue {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return theme;
}

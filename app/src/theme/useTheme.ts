import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { darkTheme, lightTheme, type Theme } from './index';

/**
 * Resolves the active theme from the user's themeMode preference.
 * 'system' (the default) follows the OS; 'light' = Day mode, 'dark' = Night mode.
 * Set from the Settings screen; the basemap follows via mapStyleFor (lib/map.ts).
 */
export function useTheme(): Theme {
  const mode = useSettingsStore((s) => s.themeMode);
  const scheme = useColorScheme();

  if (mode === 'light') return lightTheme;
  if (mode === 'dark') return darkTheme;
  return scheme === 'light' ? lightTheme : darkTheme;
}

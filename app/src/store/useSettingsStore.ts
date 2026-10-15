import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoutePrefs } from '@/routing/RouteProvider';

const STORAGE_KEY = '@runloop/settings';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Persisted user preferences. */
export interface Settings {
  audioCues: boolean;
  /** 'system' follows iOS appearance; 'light' = Day mode, 'dark' = Night mode. */
  themeMode: ThemeMode;
  routePrefs: RoutePrefs;
  /** [lng, lat] of the last position seen, so maps open where the user actually is
   *  rather than over the FALLBACK_CENTER. Null until the first fix ever. */
  lastMapCenter: [number, number] | null;
  /** Whether we've already spent our one shot at the iOS "Always Allow" prompt. */
  askedBackgroundLocation: boolean;
}

const DEFAULTS: Settings = {
  audioCues: true,
  themeMode: 'system',
  routePrefs: { avoidHills: false, surface: 'any' },
  lastMapCenter: null,
  askedBackgroundLocation: false,
};

interface SettingsActions {
  hydrate(): Promise<void>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
}

export const useSettingsStore = create<Settings & SettingsActions>((set, get) => ({
  ...DEFAULTS,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  },

  set: async (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>);
    // Every field of Settings must be listed here or it silently won't persist.
    const { audioCues, themeMode, routePrefs, lastMapCenter, askedBackgroundLocation } = get();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ audioCues, themeMode, routePrefs, lastMapCenter, askedBackgroundLocation }),
    );
  },
}));

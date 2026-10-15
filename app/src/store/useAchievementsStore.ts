import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@runloop/achievements-seen';

interface AchievementsState {
  /** ids of achievements already shown in a celebration overlay — never celebrate twice. */
  seenIds: string[];
}

interface AchievementsActions {
  hydrate(): Promise<void>;
  markSeen(ids: string[]): Promise<void>;
}

export const useAchievementsStore = create<AchievementsState & AchievementsActions>((set, get) => ({
  seenIds: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ seenIds: JSON.parse(raw) as string[] });
    } catch (e) {
      console.warn('Failed to load achievements', e);
    }
  },

  markSeen: async (ids) => {
    if (ids.length === 0) return;
    const merged = Array.from(new Set([...get().seenIds, ...ids]));
    set({ seenIds: merged });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  },
}));

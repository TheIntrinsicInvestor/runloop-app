import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@runloop/profile';

interface ProfileState {
  weightKg: number | null; // null until the user enters it on a run summary
}

interface ProfileActions {
  hydrate(): Promise<void>;
  setWeightKg(kg: number): Promise<void>;
}

export const useProfileStore = create<ProfileState & ProfileActions>((set) => ({
  weightKg: null,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { weightKg?: unknown };
        if (typeof parsed.weightKg === 'number') set({ weightKg: parsed.weightKg });
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
  },

  setWeightKg: async (kg) => {
    set({ weightKg: kg });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ weightKg: kg }));
  },
}));

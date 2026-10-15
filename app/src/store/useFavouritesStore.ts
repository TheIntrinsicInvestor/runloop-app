import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RouteCandidate, SavedRoute } from '@/routing/RouteProvider';

const STORAGE_KEY = '@runloop/favourites';

interface FavouritesState {
  routes: SavedRoute[];
}

interface FavouritesActions {
  hydrate(): Promise<void>;
  save(candidate: RouteCandidate, startPoint: [number, number], requestedKm: number): Promise<void>;
  remove(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
}

async function persist(routes: SavedRoute[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export const useFavouritesStore = create<FavouritesState & FavouritesActions>((set, get) => ({
  routes: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ routes: JSON.parse(raw) as SavedRoute[] });
    } catch (e) {
      console.warn('Failed to load saved routes', e);
    }
  },

  save: async (candidate, startPoint, requestedKm) => {
    const { routes } = get();
    if (routes.some((r) => r.id === candidate.id)) return;
    const entry: SavedRoute = {
      id: candidate.id,
      name: null,
      startLat: startPoint[1],
      startLng: startPoint[0],
      requestedKm,
      actualKm: candidate.actualKm,
      overlapPct: candidate.overlapPct,
      geometry: candidate.geometry,
      savedAt: new Date().toISOString(),
    };
    const updated = [entry, ...routes];
    await persist(updated);
    set({ routes: updated });
  },

  remove: async (id) => {
    const updated = get().routes.filter((r) => r.id !== id);
    await persist(updated);
    set({ routes: updated });
  },

  rename: async (id, name) => {
    const updated = get().routes.map((r) => (r.id === id ? { ...r, name } : r));
    await persist(updated);
    set({ routes: updated });
  },
}));

export function useIsSaved(id: string): boolean {
  return useFavouritesStore((s) => s.routes.some((r) => r.id === id));
}

import { create } from 'zustand';
import { httpRouteProvider } from '@/routing/HttpRouteProvider';
import type { RouteCandidate, SavedRoute } from '@/routing/RouteProvider';
import { useSettingsStore } from './useSettingsStore';

type Status = 'idle' | 'generating' | 'done' | 'error';

interface RouteState {
  startPoint: [number, number] | null;  // [lng, lat]
  distanceKm: number;
  candidateRoutes: RouteCandidate[];
  selectedRouteId: string | null;
  status: Status;
  error: string | null;
  partial: boolean;
}

interface RouteActions {
  setStartPoint(point: [number, number] | null): void;
  setDistanceKm(km: number): void;
  generate(): Promise<void>;
  selectRoute(id: string): void;
  reset(): void;
  loadSavedRoute(route: SavedRoute): void;
}

export const useRouteStore = create<RouteState & RouteActions>((set, get) => ({
  startPoint: null,
  distanceKm: 5,
  candidateRoutes: [],
  selectedRouteId: null,
  status: 'idle',
  error: null,
  partial: false,

  setStartPoint: (point) => set({ startPoint: point }),
  setDistanceKm: (km) => set({ distanceKm: km }),
  selectRoute: (id) => set({ selectedRouteId: id }),
  reset: () => set({ candidateRoutes: [], selectedRouteId: null, status: 'idle', error: null, partial: false }),

  loadSavedRoute: (route) => set({
    candidateRoutes: [{
      id: route.id,
      geometry: route.geometry,
      actualKm: route.actualKm,
      overlapPct: route.overlapPct,
      ascentM: 0,
    }],
    selectedRouteId: route.id,
    startPoint: [route.startLng, route.startLat],
    distanceKm: route.requestedKm,
    status: 'done',
    error: null,
    partial: false,
  }),

  generate: async () => {
    const { startPoint, distanceKm } = get();
    if (!startPoint) return;
    set({ status: 'generating', error: null, candidateRoutes: [], selectedRouteId: null });
    try {
      const [lng, lat] = startPoint;
      const routePrefs = useSettingsStore.getState().routePrefs;
      const result = await httpRouteProvider.generate(lat, lng, distanceKm, routePrefs);
      if (result.routes.length === 0) {
        set({ status: 'error', error: 'No routes found — try moving the start point or adjusting the distance' });
        return;
      }
      set({
        candidateRoutes: result.routes,
        partial: result.partial,
        selectedRouteId: result.routes[0]?.id ?? null,
        status: 'done',
      });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Unknown error' });
    }
  },
}));

export function useSelectedRoute(): RouteCandidate | null {
  return useRouteStore((s) => s.candidateRoutes.find((r) => r.id === s.selectedRouteId) ?? null);
}

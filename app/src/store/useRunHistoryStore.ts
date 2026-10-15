import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RouteCandidate } from '@/routing/RouteProvider';
import type { TraceSegment, Split } from '@/lib/runMetrics';

export interface Run {
  id: string;
  name?: string; // absent on legacy runs; falls back to a time-of-day default
  routeId: string | null; // null for free runs
  plannedKm: number; // 0 for free runs
  actualKm: number;
  durationSec: number; // moving time (legacy runs: wall-clock)
  elapsedSec?: number; // wall-clock time; absent on legacy runs
  startedAt: string;
  endedAt: string;
  plannedGeometry: RouteCandidate['geometry'] | null; // null for free runs
  segments: TraceSegment[];
  splits?: Split[]; // absent on legacy runs (no timestamps)
}

const STORAGE_KEY = '@runloop/run-history';

interface RunHistoryState {
  runs: Run[];
}

interface RunHistoryActions {
  hydrate(): Promise<void>;
  saveRun(run: Run): Promise<void>;
  renameRun(id: string, name: string): Promise<void>;
  removeRun(id: string): Promise<void>;
}

/** Legacy runs stored a flat `tracePoints: [lng,lat][]`; wrap it as a single segment. */
function normalizeRun(raw: Record<string, unknown>): Run {
  if (Array.isArray(raw.segments)) return raw as unknown as Run;
  const { tracePoints, ...rest } = raw as { tracePoints?: unknown } & Record<string, unknown>;
  const pts = Array.isArray(tracePoints) ? (tracePoints as TraceSegment) : [];
  return { ...(rest as unknown as Run), segments: pts.length ? [pts] : [] };
}

async function persistRuns(runs: Run[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export const useRunHistoryStore = create<RunHistoryState & RunHistoryActions>((set, get) => ({
  runs: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ runs: (JSON.parse(raw) as Record<string, unknown>[]).map(normalizeRun) });
    } catch (e) {
      console.warn('Failed to load run history', e);
    }
  },

  saveRun: async (run) => {
    const updated = [run, ...get().runs];
    await persistRuns(updated);
    set({ runs: updated });
  },

  renameRun: async (id, name) => {
    const updated = get().runs.map((r) => (r.id === id ? { ...r, name } : r));
    await persistRuns(updated);
    set({ runs: updated });
  },

  removeRun: async (id) => {
    const updated = get().runs.filter((r) => r.id !== id);
    await persistRuns(updated);
    set({ runs: updated });
  },
}));

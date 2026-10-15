import { create } from 'zustand';
import { haversineKm } from '@/lib/geo';
import { segmentsDistanceKm, computeSplits, type TracePoint, type TraceSegment, type Split } from '@/lib/runMetrics';
import type { RouteCandidate } from '@/routing/RouteProvider';

/** The route being followed, or null for a free run. */
export interface ActiveRoute {
  routeId: string;
  plannedKm: number;
  plannedGeometry: RouteCandidate['geometry'];
}

export interface ActiveRunResult {
  routeId: string | null;
  plannedKm: number;
  plannedGeometry: RouteCandidate['geometry'] | null;
  actualKm: number;
  durationSec: number; // moving time (elapsed minus paused)
  elapsedSec: number; // wall-clock time start→end
  startedAt: string;
  endedAt: string;
  segments: TraceSegment[];
  splits: Split[];
}

/** Fired once as each whole kilometre is completed, for audio cues. */
export interface SplitEvent {
  km: number;
  splitSec: number; // moving time for this kilometre alone
  avgPaceSecPerKm: number;
}

type SplitListener = (e: SplitEvent) => void;
const splitListeners = new Set<SplitListener>();

/** Subscribe to km-completion events. Returns an unsubscribe function. */
export function onSplit(cb: SplitListener): () => void {
  splitListeners.add(cb);
  return () => {
    splitListeners.delete(cb);
  };
}

interface ActiveRunState {
  isTracking: boolean;
  isPaused: boolean;
  startedAt: string | null;
  routeId: string | null;
  plannedKm: number;
  plannedGeometry: RouteCandidate['geometry'] | null;
  segments: TraceSegment[];
  liveKm: number; // incrementally accumulated distance (avoids O(n) recompute per point)
  pausedMs: number; // completed paused durations
  lastPauseAt: number | null; // epoch ms the current pause began
  announcedKm: number; // highest whole km already emitted as a SplitEvent
}

interface ActiveRunActions {
  start(route: ActiveRoute | null): void;
  addPoint(point: TracePoint): void;
  pause(): void;
  resume(): void;
  end(): ActiveRunResult | null;
  elapsedSec(): number;
  clear(): void;
}

const INITIAL: ActiveRunState = {
  isTracking: false,
  isPaused: false,
  startedAt: null,
  routeId: null,
  plannedKm: 0,
  plannedGeometry: null,
  segments: [],
  liveKm: 0,
  pausedMs: 0,
  lastPauseAt: null,
  announcedKm: 0,
};

export const useActiveRunStore = create<ActiveRunState & ActiveRunActions>((set, get) => ({
  ...INITIAL,

  start(route) {
    set({
      isTracking: true,
      isPaused: false,
      startedAt: new Date(Date.now()).toISOString(),
      routeId: route?.routeId ?? null,
      plannedKm: route?.plannedKm ?? 0,
      plannedGeometry: route?.plannedGeometry ?? null,
      segments: [[]],
      liveKm: 0,
      pausedMs: 0,
      lastPauseAt: null,
      announcedKm: 0,
    });
  },

  addPoint(point) {
    const s = get();
    if (!s.isTracking || s.isPaused) return;
    const rounded: TracePoint = [
      Math.round(point[0] * 1e6) / 1e6,
      Math.round(point[1] * 1e6) / 1e6,
      point[2],
      point[3] ?? null,
    ];
    const segments = s.segments.length ? s.segments.slice() : [[]];
    const last = segments[segments.length - 1];
    let addKm = 0;
    if (last.length > 0) {
      const prev = last[last.length - 1];
      addKm = haversineKm(prev[1], prev[0], rounded[1], rounded[0]);
    }
    segments[segments.length - 1] = [...last, rounded];
    const liveKm = s.liveKm + addKm;
    set({ segments, liveKm });

    // Emit one SplitEvent per whole km crossed. A single GPS fix can span more
    // than 1 km after a signal gap, so loop rather than assuming one crossing.
    const reached = Math.floor(liveKm);
    if (reached > s.announcedKm) {
      set({ announcedKm: reached });
      const splits = computeSplits(segments);
      for (let km = s.announcedKm + 1; km <= reached; km++) {
        const split = splits.find((sp) => sp.km === km);
        if (!split) continue;
        const done = splits.filter((sp) => sp.km <= km);
        const avg = done.reduce((acc, sp) => acc + sp.sec, 0) / done.length;
        const event: SplitEvent = { km, splitSec: split.sec, avgPaceSecPerKm: avg };
        splitListeners.forEach((cb) => cb(event));
      }
    }
  },

  pause() {
    const s = get();
    if (!s.isTracking || s.isPaused) return;
    set({ isPaused: true, lastPauseAt: Date.now() });
  },

  resume() {
    const s = get();
    if (!s.isTracking || !s.isPaused) return;
    const add = s.lastPauseAt ? Date.now() - s.lastPauseAt : 0;
    set({
      isPaused: false,
      lastPauseAt: null,
      pausedMs: s.pausedMs + add,
      segments: [...s.segments, []],
    });
  },

  elapsedSec() {
    const s = get();
    if (!s.startedAt) return 0;
    const now = Date.now();
    let paused = s.pausedMs;
    if (s.isPaused && s.lastPauseAt) paused += now - s.lastPauseAt;
    return Math.max(0, Math.round((now - new Date(s.startedAt).getTime() - paused) / 1000));
  },

  end() {
    const s = get();
    if (!s.isTracking || !s.startedAt) return null;
    const endedAtMs = Date.now();
    const startedMs = new Date(s.startedAt).getTime();
    let pausedMs = s.pausedMs;
    if (s.isPaused && s.lastPauseAt) pausedMs += endedAtMs - s.lastPauseAt;
    const elapsedSec = Math.max(0, Math.round((endedAtMs - startedMs) / 1000));
    const durationSec = Math.max(0, Math.round((endedAtMs - startedMs - pausedMs) / 1000));
    const segments = s.segments;
    const result: ActiveRunResult = {
      routeId: s.routeId,
      plannedKm: s.plannedKm,
      plannedGeometry: s.plannedGeometry,
      actualKm: segmentsDistanceKm(segments),
      durationSec,
      elapsedSec,
      startedAt: s.startedAt,
      endedAt: new Date(endedAtMs).toISOString(),
      segments,
      splits: computeSplits(segments),
    };
    set(INITIAL);
    return result;
  },

  clear() {
    set(INITIAL);
  },
}));

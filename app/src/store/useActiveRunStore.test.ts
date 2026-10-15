import { useActiveRunStore, onSplit, type ActiveRoute } from './useActiveRunStore';

const geometry = { type: 'LineString' as const, coordinates: [[103.8, 1.3], [103.9, 1.4]] as [number, number][] };
const route: ActiveRoute = { routeId: 'r1', plannedKm: 5, plannedGeometry: geometry };

beforeEach(() => {
  useActiveRunStore.getState().clear();
});

describe('useActiveRunStore', () => {
  it('starts not tracking', () => {
    expect(useActiveRunStore.getState().isTracking).toBe(false);
  });

  it('start sets tracking state and opens one segment', () => {
    useActiveRunStore.getState().start(route);
    const s = useActiveRunStore.getState();
    expect(s.isTracking).toBe(true);
    expect(s.isPaused).toBe(false);
    expect(s.routeId).toBe('r1');
    expect(s.plannedKm).toBe(5);
    expect(s.segments).toEqual([[]]);
    expect(s.liveKm).toBe(0);
  });

  it('start(null) begins a free run with no route', () => {
    useActiveRunStore.getState().start(null);
    const s = useActiveRunStore.getState();
    expect(s.isTracking).toBe(true);
    expect(s.routeId).toBeNull();
    expect(s.plannedKm).toBe(0);
    expect(s.plannedGeometry).toBeNull();
  });

  it('addPoint appends into the active segment and accumulates liveKm', () => {
    useActiveRunStore.getState().start(route);
    useActiveRunStore.getState().addPoint([0, 0, 0]);
    useActiveRunStore.getState().addPoint([0, 1, 60_000]);
    const s = useActiveRunStore.getState();
    expect(s.segments[0]).toEqual([[0, 0, 0, null], [0, 1, 60_000, null]]);
    expect(s.liveKm).toBeCloseTo(111.19, 1);
  });

  it('resume opens a new segment and pause blocks further points', () => {
    useActiveRunStore.getState().start(route);
    useActiveRunStore.getState().addPoint([0, 0, 0]);
    useActiveRunStore.getState().pause();
    useActiveRunStore.getState().addPoint([0, 5, 1000]); // ignored while paused
    expect(useActiveRunStore.getState().segments).toEqual([[[0, 0, 0, null]]]);
    useActiveRunStore.getState().resume();
    useActiveRunStore.getState().addPoint([0, 1, 2000]);
    const segs = useActiveRunStore.getState().segments;
    expect(segs.length).toBe(2);
    expect(segs[1]).toEqual([[0, 1, 2000, null]]);
  });

  it('end returns segmented trace + splits and resets state', () => {
    useActiveRunStore.getState().start(route);
    useActiveRunStore.getState().addPoint([0, 0, 0]);
    useActiveRunStore.getState().addPoint([0, 1, 60_000]);
    const result = useActiveRunStore.getState().end();
    expect(result).not.toBeNull();
    expect(result!.actualKm).toBeCloseTo(111.19, 1);
    expect(result!.routeId).toBe('r1');
    expect(result!.segments).toEqual([[[0, 0, 0, null], [0, 1, 60_000, null]]]);
    expect(result!.splits.length).toBeGreaterThan(0);
    expect(useActiveRunStore.getState().isTracking).toBe(false);
    expect(useActiveRunStore.getState().segments).toEqual([]);
  });

  it('end excludes paused time from durationSec but not elapsedSec', () => {
    const t0 = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(t0);
    useActiveRunStore.getState().start(route);
    nowSpy.mockReturnValue(t0 + 10_000); // pause 10s in
    useActiveRunStore.getState().pause();
    nowSpy.mockReturnValue(t0 + 40_000); // resume after 30s paused
    useActiveRunStore.getState().resume();
    nowSpy.mockReturnValue(t0 + 70_000); // end at 70s wall clock
    const result = useActiveRunStore.getState().end();
    expect(result!.elapsedSec).toBe(70);
    expect(result!.durationSec).toBe(40); // 70 - 30 paused
    nowSpy.mockRestore();
  });

  it('end returns null when not tracking', () => {
    expect(useActiveRunStore.getState().end()).toBeNull();
  });

  it('clear resets all state', () => {
    useActiveRunStore.getState().start(route);
    useActiveRunStore.getState().addPoint([103.8, 1.3, 0]);
    useActiveRunStore.getState().clear();
    expect(useActiveRunStore.getState().isTracking).toBe(false);
    expect(useActiveRunStore.getState().segments).toEqual([]);
  });
});

describe('split events', () => {
  // Degrees of longitude per km at the equator, from the same sphere radius as haversineKm.
  const KM_DEG = 180 / (Math.PI * 6371);
  const t0 = 1_700_000_000_000;
  // addPoint rounds to 1e-6 deg (~0.11 m), so a point placed at exactly N km can
  // land microscopically short and not register the crossing. Aim 5 m past.
  const OVERSHOOT_KM = 0.005;
  const PACE_SEC_PER_KM = 300;

  /** Place a fix `km` along the equator, timed for an exact 5:00/km pace. */
  function addAtKm(km: number) {
    useActiveRunStore.getState().addPoint([km * KM_DEG, 0, t0 + km * PACE_SEC_PER_KM * 1000]);
  }

  /** Feed `n` km of trace, one fix just past each km mark. */
  function runKm(n: number) {
    addAtKm(0);
    for (let i = 1; i <= n; i++) addAtKm(i + OVERSHOOT_KM);
  }

  it('fires exactly once per completed kilometre', () => {
    const seen: number[] = [];
    const off = onSplit((e) => seen.push(e.km));
    useActiveRunStore.getState().start(null);
    runKm(3);
    off();
    expect(seen).toEqual([1, 2, 3]);
  });

  it('does not re-fire a km when more points arrive within it', () => {
    const seen: number[] = [];
    const off = onSplit((e) => seen.push(e.km));
    useActiveRunStore.getState().start(null);
    runKm(1);
    // A few more fixes, still inside km 2.
    addAtKm(1.2);
    addAtKm(1.4);
    off();
    expect(seen).toEqual([1]);
  });

  it('emits every km crossed when one fix spans several (signal gap)', () => {
    const seen: number[] = [];
    const off = onSplit((e) => seen.push(e.km));
    useActiveRunStore.getState().start(null);
    addAtKm(0);
    addAtKm(3 + OVERSHOOT_KM); // one fix after a long signal gap
    off();
    expect(seen).toEqual([1, 2, 3]);
  });

  it('reports the split time and running average pace', () => {
    const events: { km: number; splitSec: number; avgPaceSecPerKm: number }[] = [];
    const off = onSplit((e) => events.push(e));
    useActiveRunStore.getState().start(null);
    runKm(2);
    off();
    expect(events[0].splitSec).toBeCloseTo(300, 0);
    expect(events[1].avgPaceSecPerKm).toBeCloseTo(300, 0);
  });

  it('restarts the count on a new run', () => {
    const seen: number[] = [];
    const off = onSplit((e) => seen.push(e.km));
    useActiveRunStore.getState().start(null);
    runKm(2);
    useActiveRunStore.getState().start(null);
    runKm(1);
    off();
    expect(seen).toEqual([1, 2, 1]);
  });

  it('stops notifying after unsubscribe', () => {
    const seen: number[] = [];
    const off = onSplit((e) => seen.push(e.km));
    off();
    useActiveRunStore.getState().start(null);
    runKm(2);
    expect(seen).toEqual([]);
  });
});

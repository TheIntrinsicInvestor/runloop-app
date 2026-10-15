import {
  segmentsDistanceKm,
  computeSplits,
  rollingPaceSecPerKm,
  formatPace,
  elevationGainM,
  estimateCalories,
  defaultRunName,
  type TraceSegment,
} from './runMetrics';
import { haversineKm } from './geo';

// Point moving east along the equator: derive a lng offset for a target distance in km.
function lngForKm(km: number): number {
  // 1 deg lng at lat 0 ≈ 111.195 km; refine so haversineKm matches closely.
  return km / 111.19492664455873;
}

describe('segmentsDistanceKm', () => {
  it('sums distance within segments and never bridges the gap between them', () => {
    const seg1: TraceSegment = [[0, 0], [0, 1]];
    const seg2: TraceSegment = [[0, 2], [0, 3]];
    const oneDeg = haversineKm(0, 0, 1, 0); // ~111.19 km
    // Two 1-degree legs = 2 * oneDeg. The [0,1]->[0,2] gap (another oneDeg) must NOT count.
    expect(segmentsDistanceKm([seg1, seg2])).toBeCloseTo(2 * oneDeg, 5);
  });

  it('is zero for empty / single-point segments', () => {
    expect(segmentsDistanceKm([])).toBe(0);
    expect(segmentsDistanceKm([[[0, 0]]])).toBe(0);
  });
});

describe('computeSplits', () => {
  it('produces one split per completed km, interpolating time at km boundaries', () => {
    // Single 2 km segment covered in 600 s at constant speed → both km splits ≈ 300 s.
    const seg: TraceSegment = [
      [0, 0, 0],
      [lngForKm(2), 0, 600_000],
    ];
    const splits = computeSplits([seg]);
    expect(splits.map((s) => s.km)).toEqual([1, 2]);
    expect(splits[0].sec).toBeCloseTo(300, 0);
    expect(splits[1].sec).toBeCloseTo(300, 0);
  });

  it('excludes paused (cross-segment) wall-clock time from split times', () => {
    // km1 in seg1 over 300 s; 700 s pause; km2 in seg2 over 300 s of MOVING time.
    const seg1: TraceSegment = [
      [0, 0, 0],
      [lngForKm(1), 0, 300_000],
    ];
    const seg2: TraceSegment = [
      [lngForKm(1), 0, 1_000_000], // 700 s later in wall clock (the pause)
      [lngForKm(2), 0, 1_300_000],
    ];
    const splits = computeSplits([seg1, seg2]);
    expect(splits.map((s) => s.km)).toEqual([1, 2]);
    expect(splits[0].sec).toBeCloseTo(300, 0);
    // Must be ~300, NOT ~1000 (the pause is excluded).
    expect(splits[1].sec).toBeCloseTo(300, 0);
  });

  it('returns [] when the trace has no timestamps (legacy runs)', () => {
    const seg: TraceSegment = [[0, 0], [lngForKm(2), 0]];
    expect(computeSplits([seg])).toEqual([]);
  });

  it('returns [] for a run shorter than 1 km', () => {
    const seg: TraceSegment = [[0, 0, 0], [lngForKm(0.4), 0, 120_000]];
    expect(computeSplits([seg])).toEqual([]);
  });
});

describe('rollingPaceSecPerKm', () => {
  it('computes pace over the trailing time window', () => {
    // 1 km covered in the last 300 s → 300 s/km.
    const seg: TraceSegment = [
      [0, 0, 0],
      [lngForKm(1), 0, 300_000],
    ];
    expect(rollingPaceSecPerKm(seg, 60 * 60 * 1000)).toBeCloseTo(300, 0);
  });

  it('returns null with fewer than two points or no timestamps', () => {
    expect(rollingPaceSecPerKm([[0, 0, 0]])).toBeNull();
    expect(rollingPaceSecPerKm([[0, 0], [lngForKm(1), 0]])).toBeNull();
  });
});

describe('formatPace', () => {
  it('formats seconds-per-km as M:SS', () => {
    expect(formatPace(324)).toBe('5:24');
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(605)).toBe('10:05');
  });

  it('renders an em dash for null / non-positive / non-finite', () => {
    expect(formatPace(null)).toBe('—');
    expect(formatPace(0)).toBe('—');
    expect(formatPace(Infinity)).toBe('—');
  });
});

describe('elevationGainM', () => {
  it('sums only climbs above the noise floor', () => {
    // +10, then a 2 m wobble (ignored), then +5 → 15 m of real ascent.
    const seg: TraceSegment = [
      [0, 0, 0, 100],
      [0, 0, 1, 110],
      [0, 0, 2, 112],
      [0, 0, 3, 115],
    ];
    expect(elevationGainM([seg])).toBe(15);
  });

  it('does not count descent', () => {
    const seg: TraceSegment = [[0, 0, 0, 200], [0, 0, 1, 150], [0, 0, 2, 100]];
    expect(elevationGainM([seg])).toBe(0);
  });

  it('returns null when the trace carries no altitude (legacy runs)', () => {
    const seg: TraceSegment = [[0, 0], [0, 1]];
    expect(elevationGainM([seg])).toBeNull();
  });

  it('resets its reference per segment so a pause gap adds no phantom climb', () => {
    const a: TraceSegment = [[0, 0, 0, 100], [0, 0, 1, 110]];
    const b: TraceSegment = [[0, 0, 2, 500], [0, 0, 3, 510]];
    expect(elevationGainM([a, b])).toBe(20);
  });
});

describe('estimateCalories', () => {
  it('scales with weight and distance', () => {
    expect(estimateCalories(10, 70)).toBe(725);
  });

  it('returns null for a zero-distance or unknown-weight run', () => {
    expect(estimateCalories(0, 70)).toBeNull();
    expect(estimateCalories(5, 0)).toBeNull();
  });
});

describe('defaultRunName', () => {
  it('names the run by time of day', () => {
    expect(defaultRunName('2026-07-20T07:00:00')).toBe('Morning Run');
    expect(defaultRunName('2026-07-20T13:00:00')).toBe('Afternoon Run');
    expect(defaultRunName('2026-07-20T19:00:00')).toBe('Evening Run');
    expect(defaultRunName('2026-07-20T22:00:00')).toBe('Night Run');
  });
});

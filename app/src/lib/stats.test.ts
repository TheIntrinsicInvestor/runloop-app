import {
  weeklyAggregates,
  computeRecords,
  currentStreaks,
  evaluateAchievements,
} from './stats';
import type { Run } from '@/store/useRunHistoryStore';
import type { TraceSegment } from './runMetrics';

// Point moving east along the equator: derive a lng offset for a target distance in km.
function lngForKm(km: number): number {
  return km / 111.19492664455873;
}

// Day/week bucketing is device-local, so every assertion below is read against the
// zone jest.globalSetup.js pins. Assert it up front: if that setup ever stops applying,
// these tests would otherwise keep passing while silently measuring another zone.
const SUITE_TZ = 'America/Los_Angeles';

it('runs in the pinned suite timezone', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(SUITE_TZ);
});

let nextId = 0;
function makeRun(overrides: Partial<Run> & { startedAt: string }): Run {
  nextId += 1;
  return {
    id: overrides.id ?? `run-${nextId}`,
    routeId: null,
    plannedKm: 0,
    actualKm: 5,
    durationSec: 1500,
    startedAt: overrides.startedAt,
    endedAt: overrides.startedAt,
    plannedGeometry: null,
    segments: [],
    ...overrides,
  };
}

/** A single continuous segment covering `km` at constant pace over `sec` seconds, starting at `startMs`. */
function constantPaceSegment(km: number, sec: number, startMs = 0): TraceSegment {
  return [
    [0, 0, startMs],
    [lngForKm(km), 0, startMs + sec * 1000],
  ];
}

describe('weeklyAggregates', () => {
  it('buckets runs into Mon-start weeks in local time, including empty weeks', () => {
    // 2026-07-20T07:00Z = Monday 20 July 00:00 PDT.
    const mondayThisWeek = new Date('2026-07-20T07:00:00.000Z');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(mondayThisWeek.getTime());

    const runs: Run[] = [
      makeRun({ startedAt: '2026-07-20T07:00:00.000Z', actualKm: 5 }), // this Monday
      // 3 weeks ago, no runs in weeks -1 and -2 => must appear as empty buckets
      makeRun({ startedAt: '2026-06-29T07:00:00.000Z', actualKm: 3 }),
    ];

    const weeks = weeklyAggregates(runs, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].km).toBeCloseTo(3, 5); // 3 weeks ago
    expect(weeks[1].km).toBe(0); // empty
    expect(weeks[2].km).toBe(0); // empty
    expect(weeks[3].km).toBeCloseTo(5, 5); // this week

    nowSpy.mockRestore();
  });

  it('a Sunday-night run stays in the old week; a Monday-morning run starts the new one', () => {
    // Sunday 2026-07-19 23:30 PDT = 2026-07-20 06:30 UTC.
    // Monday 2026-07-20 00:30 PDT = 2026-07-20 07:30 UTC.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-20T07:30:00.000Z').getTime());

    const runs: Run[] = [
      makeRun({ id: 'sun', startedAt: '2026-07-20T06:30:00.000Z', actualKm: 1 }),
      makeRun({ id: 'mon', startedAt: '2026-07-20T07:30:00.000Z', actualKm: 2 }),
    ];

    const weeks = weeklyAggregates(runs, 2);
    expect(weeks[0].km).toBeCloseTo(1, 5); // last week (Sunday night run)
    expect(weeks[1].km).toBeCloseTo(2, 5); // this week (Monday morning run)

    nowSpy.mockRestore();
  });
});

// Regressions for the Bay Area expansion. Under the old fixed UTC+8 bucketing, the
// SGT date rolled over at 09:00 California time, so any run from mid-morning onwards
// was filed on the following calendar day and evening runs spilled into the next week.
describe('weeklyAggregates (California calendar)', () => {
  // Verified to fail against the old fixed-offset implementation, which put this run's
  // week start at 2026-09-13T16:00Z — a Monday in SGT, still Sunday for the runner.
  it('keeps a Sunday-evening run in that Sunday\'s week rather than spilling it into the next', () => {
    // Sunday 2026-09-13 18:00 PDT = 2026-09-14T01:00Z; "now" two hours later.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-14T03:00:00.000Z').getTime());

    const weeks = weeklyAggregates([makeRun({ startedAt: '2026-09-14T01:00:00.000Z', actualKm: 5 })], 2);

    // Monday 2026-09-07 00:00 PDT, i.e. UTC-7.
    expect(weeks[1].weekStartISO).toBe('2026-09-07T07:00:00.000Z');
    expect(weeks[1].km).toBeCloseTo(5, 5);
    expect(weeks[0].km).toBe(0);

    nowSpy.mockRestore();
  });

  // Not a reproduction of the old bug: a no-DST offset was internally consistent here.
  // This guards the new code instead — reverting shiftWeekStart to fixed-millisecond
  // arithmetic while weekStartISO stays local yields a bucket key of 2026-03-02T07:00Z
  // that the 4 Mar run (2026-03-02T08:00Z) never matches, silently dropping the week.
  it('spans the spring-forward DST change without losing a week bucket', () => {
    // PST -> PDT at 02:00 on Sunday 2026-03-08, so consecutive local Mondays are 167h apart.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-09T19:00:00.000Z').getTime());

    const runs: Run[] = [
      makeRun({ id: 'pst', startedAt: '2026-03-05T02:00:00.000Z', actualKm: 4 }), // Wed 4 Mar 18:00 PST
      makeRun({ id: 'pdt', startedAt: '2026-03-09T15:00:00.000Z', actualKm: 6 }), // Mon 9 Mar 08:00 PDT
    ];
    const weeks = weeklyAggregates(runs, 2);

    expect(weeks[0].weekStartISO).toBe('2026-03-02T08:00:00.000Z'); // Mon 00:00 PST (UTC-8)
    expect(weeks[1].weekStartISO).toBe('2026-03-09T07:00:00.000Z'); // Mon 00:00 PDT (UTC-7)
    expect(weeks[0].km).toBeCloseTo(4, 5);
    expect(weeks[1].km).toBeCloseTo(6, 5);

    nowSpy.mockRestore();
  });
});

describe('currentStreaks (California calendar)', () => {
  it('counts a Sunday-evening and a Monday-morning run as two days, not one', () => {
    // Both fall on the same SGT calendar day (2026-09-14), which is exactly what the
    // old fixed-offset bucketing collapsed into a single-day streak.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-15T03:00:00.000Z').getTime());

    const runs: Run[] = [
      makeRun({ id: 'sun-pm', startedAt: '2026-09-14T01:00:00.000Z' }), // Sun 13 Sep 18:00 PDT
      makeRun({ id: 'mon-am', startedAt: '2026-09-14T15:00:00.000Z' }), // Mon 14 Sep 08:00 PDT
    ];

    expect(currentStreaks(runs).runDays).toBe(2);

    nowSpy.mockRestore();
  });
});

describe('computeRecords', () => {
  it('tracks the longest run and biggest week across legacy (no-timestamp) and V3 runs', () => {
    const legacy = makeRun({ id: 'legacy', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 12, segments: [[[0, 0], [0, 1]]] });
    const short = makeRun({ id: 'short', startedAt: '2026-06-08T00:00:00.000Z', actualKm: 5, segments: [] });
    const records = computeRecords([legacy, short]);
    expect(records.longestRunKm).toBe(12);
    expect(records.holders.longestRun).toBe('legacy');
    expect(records.biggestWeekKm).toBeCloseTo(12, 5);
  });

  it('does not compute fastest 1k/5k for legacy runs (no timestamps)', () => {
    const legacy = makeRun({ id: 'legacy', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 12, segments: [[[0, 0], [0, 1]]] });
    const records = computeRecords([legacy]);
    expect(records.fastest1kSec).toBeUndefined();
    expect(records.fastest5kSec).toBeUndefined();
    expect(records.holders.fastest1k).toBeUndefined();
  });

  it('finds the fastest 1k as the best continuous window within a single segment', () => {
    // One segment: first km slow (400s), second km fast (200s). Fastest 1km window should be ~200s,
    // not just the first-km split.
    const seg: TraceSegment = [
      [0, 0, 0],
      [lngForKm(1), 0, 400_000],
      [lngForKm(2), 0, 600_000],
    ];
    const run = makeRun({ id: 'r1', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 2, segments: [seg] });
    const records = computeRecords([run]);
    expect(records.fastest1kSec).toBeCloseTo(200, 0);
    expect(records.holders.fastest1k).toBe('r1');
  });

  it('never lets a rolling window span a pause: returns undefined when every segment is under the target distance', () => {
    // Two 0.6km segments (a pause between them) — no single segment ever reaches 1km continuously.
    const seg1 = constantPaceSegment(0.6, 180, 0);
    const seg2 = constantPaceSegment(0.6, 180, 1_000_000); // big wall-clock gap = the pause
    const run = makeRun({ id: 'paused', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 1.2, segments: [seg1, seg2] });
    const records = computeRecords([run]);
    expect(records.fastest1kSec).toBeUndefined();
  });

  it('keeps the fastest record across multiple runs', () => {
    const slow = makeRun({ id: 'slow', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 1, segments: [constantPaceSegment(1, 300)] });
    const fast = makeRun({ id: 'fast', startedAt: '2026-06-02T00:00:00.000Z', actualKm: 1, segments: [constantPaceSegment(1, 250)] });
    const records = computeRecords([slow, fast]);
    expect(records.fastest1kSec).toBeCloseTo(250, 0);
    expect(records.holders.fastest1k).toBe('fast');
  });
});

describe('currentStreaks', () => {
  it('treats 23:59 and 00:01 local as different calendar days even though they are 2 minutes apart', () => {
    // "Today" = 2026-07-20 12:00 PDT = 2026-07-20T19:00 UTC.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-20T19:00:00.000Z').getTime());

    const runs: Run[] = [
      // 2026-07-19 23:59 PDT — yesterday.
      makeRun({ id: 'y-2359', startedAt: '2026-07-20T06:59:00.000Z' }),
      // 2026-07-20 00:01 PDT — today. Both UTC timestamps fall on the same UTC calendar
      // date (2026-07-20); only the local shift correctly splits them into two days.
      makeRun({ id: 'today-0001', startedAt: '2026-07-20T07:01:00.000Z' }),
    ];

    const { runDays } = currentStreaks(runs);
    expect(runDays).toBe(2);

    nowSpy.mockRestore();
  });

  it('is zero with no runs, and a streak still counts if today has no run yet but yesterday does', () => {
    expect(currentStreaks([]).runDays).toBe(0);

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-20T19:00:00.000Z').getTime());
    const runs: Run[] = [makeRun({ startedAt: '2026-07-19T19:00:00.000Z' })]; // yesterday, local
    expect(currentStreaks(runs).runDays).toBe(1);
    nowSpy.mockRestore();
  });
});

describe('evaluateAchievements', () => {
  it('awards first-run and lifetime-distance milestones as they are crossed', () => {
    const runs: Run[] = [
      makeRun({ id: 'a', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 60 }),
      makeRun({ id: 'b', startedAt: '2026-06-02T00:00:00.000Z', actualKm: 60 }), // crosses 100km lifetime
    ];
    const records = computeRecords(runs);
    const achievements = evaluateAchievements(runs, records);
    const ids = achievements.map((a) => a.id);
    expect(ids).toContain('first-run');
    expect(ids).toContain('lifetime-100km');
    expect(achievements.find((a) => a.id === 'lifetime-100km')?.earnedByRunId).toBe('b');
    expect(ids).not.toContain('lifetime-500km');
  });

  it('returns nothing for an empty run history', () => {
    expect(evaluateAchievements([], computeRecords([]))).toEqual([]);
  });

  it('awards a record-holder badge for each key in records.holders', () => {
    const run = makeRun({ id: 'r1', startedAt: '2026-06-01T00:00:00.000Z', actualKm: 1, segments: [constantPaceSegment(1, 250)] });
    const records = computeRecords([run]);
    const achievements = evaluateAchievements([run], records);
    expect(achievements.find((a) => a.id === 'record-fastest1k')?.earnedByRunId).toBe('r1');
  });
});

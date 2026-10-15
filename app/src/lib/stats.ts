import type { Run } from '@/store/useRunHistoryStore';
import type { TraceSegment } from './runMetrics';
import { haversineKm } from './geo';

/**
 * Days and weeks are bucketed in the device's own timezone, via local Date accessors
 * rather than a fixed offset. A fixed UTC+8 filed every run started after 09:00 local
 * in California on the following calendar day; local accessors also absorb DST, which
 * a constant offset cannot.
 */

export interface WeekAgg {
  weekStartISO: string;
  km: number;
  movingSec: number;
  count: number;
}

export interface Records {
  fastest1kSec?: number;
  fastest5kSec?: number;
  longestRunKm?: number;
  biggestWeekKm?: number;
  holders: Record<string, string>; // record key -> runId
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  earnedByRunId?: string;
}

/** ISO instant for local 00:00 Monday of the week containing `iso`. */
function weekStartISO(iso: string): string {
  const d = new Date(iso);
  const diffToMonday = (d.getDay() + 6) % 7; // 0=Sun..6=Sat, on the local clock
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);
  return d.toISOString();
}

/** Calendar-day arithmetic, so a week spanning a DST change is still one week. */
function shiftWeekStart(weekStartIso: string, weeks: number): string {
  const d = new Date(weekStartIso);
  d.setDate(d.getDate() + weeks * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** "YYYY-MM-DD" local calendar date for streak comparisons. */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Weekly totals for the trailing `weeks` weeks (Mon-start, device-local), ending with the current week. Empty weeks included. */
export function weeklyAggregates(runs: Run[], weeks: number): WeekAgg[] {
  const nowWeekStart = weekStartISO(new Date(Date.now()).toISOString());
  const buckets = new Map<string, WeekAgg>();
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = shiftWeekStart(nowWeekStart, -i);
    buckets.set(ws, { weekStartISO: ws, km: 0, movingSec: 0, count: 0 });
  }
  for (const run of runs) {
    const bucket = buckets.get(weekStartISO(run.startedAt));
    if (!bucket) continue;
    bucket.km += run.actualKm;
    bucket.movingSec += run.durationSec;
    bucket.count += 1;
  }
  return Array.from(buckets.values());
}

/**
 * Fastest continuous `targetKm` window anywhere in the run, searched within a single
 * segment only — a window can never span a pause (a segment boundary), so a run whose
 * segments are all shorter than `targetKm` has no window and returns null. Requires
 * timestamps (V3+ runs); legacy runs always return null.
 */
function bestWindowSec(segments: TraceSegment[], targetKm: number): number | null {
  let best: number | null = null;
  for (const seg of segments) {
    if (seg.length < 2) continue;
    const dist: number[] = [0];
    const time: number[] = [0];
    let hasTimestamps = true;
    for (let i = 1; i < seg.length; i++) {
      if (seg[i][2] === undefined || seg[i - 1][2] === undefined) {
        hasTimestamps = false;
        break;
      }
      dist.push(dist[i - 1] + haversineKm(seg[i - 1][1], seg[i - 1][0], seg[i][1], seg[i][0]));
      time.push(time[i - 1] + ((seg[i][2] as number) - (seg[i - 1][2] as number)));
    }
    if (!hasTimestamps || dist[dist.length - 1] < targetKm) continue;

    let j = 0;
    for (let i = 0; i < dist.length; i++) {
      const targetDist = dist[i] + targetKm;
      if (targetDist > dist[dist.length - 1]) break;
      while (j < dist.length - 1 && dist[j + 1] < targetDist) j++;
      let tAtTarget: number;
      if (dist[j] >= targetDist) {
        tAtTarget = time[j];
      } else if (j + 1 < dist.length) {
        const frac = (targetDist - dist[j]) / (dist[j + 1] - dist[j]);
        tAtTarget = time[j] + frac * (time[j + 1] - time[j]);
      } else {
        continue;
      }
      const windowSec = (tAtTarget - time[i]) / 1000;
      if (best === null || windowSec < best) best = windowSec;
    }
  }
  return best;
}

export function computeRecords(runs: Run[]): Records {
  const holders: Record<string, string> = {};
  let fastest1kSec: number | undefined;
  let fastest5kSec: number | undefined;
  let longestRunKm: number | undefined;

  for (const run of runs) {
    if (longestRunKm === undefined || run.actualKm > longestRunKm) {
      longestRunKm = run.actualKm;
      holders.longestRun = run.id;
    }
    const best1k = bestWindowSec(run.segments, 1);
    if (best1k !== null && (fastest1kSec === undefined || best1k < fastest1kSec)) {
      fastest1kSec = best1k;
      holders.fastest1k = run.id;
    }
    const best5k = bestWindowSec(run.segments, 5);
    if (best5k !== null && (fastest5kSec === undefined || best5k < fastest5kSec)) {
      fastest5kSec = best5k;
      holders.fastest5k = run.id;
    }
  }

  let biggestWeekKm: number | undefined;
  const weekTotals = new Map<string, number>();
  for (const run of runs) {
    const ws = weekStartISO(run.startedAt);
    weekTotals.set(ws, (weekTotals.get(ws) ?? 0) + run.actualKm);
  }
  for (const km of weekTotals.values()) {
    if (biggestWeekKm === undefined || km > biggestWeekKm) biggestWeekKm = km;
  }

  return { fastest1kSec, fastest5kSec, longestRunKm, biggestWeekKm, holders };
}

/** Consecutive local calendar days / Mon-start weeks with at least one run, ending today (today itself may be run-less without breaking the streak). */
export function currentStreaks(runs: Run[]): { runDays: number; weeks: number } {
  if (runs.length === 0) return { runDays: 0, weeks: 0 };

  const nowIso = new Date(Date.now()).toISOString();

  const dayKeys = new Set(runs.map((r) => localDateKey(r.startedAt)));
  let runDays = 0;
  let dayCursor = localDateKey(nowIso);
  if (!dayKeys.has(dayCursor)) dayCursor = shiftDateKey(dayCursor, -1);
  while (dayKeys.has(dayCursor)) {
    runDays += 1;
    dayCursor = shiftDateKey(dayCursor, -1);
  }

  const weekKeys = new Set(runs.map((r) => weekStartISO(r.startedAt)));
  let weeks = 0;
  let weekCursor = weekStartISO(nowIso);
  if (!weekKeys.has(weekCursor)) weekCursor = shiftWeekStart(weekCursor, -1);
  while (weekKeys.has(weekCursor)) {
    weeks += 1;
    weekCursor = shiftWeekStart(weekCursor, -1);
  }

  return { runDays, weeks };
}

const RECORD_TITLES: Record<string, string> = {
  fastest1k: 'Fastest 1K',
  fastest5k: 'Fastest 5K',
  longestRun: 'Longest Run',
};

/** Display title for a Records.holders key (e.g. "fastest1k" -> "Fastest 1K"). */
export function recordTitle(key: string): string {
  return RECORD_TITLES[key] ?? key;
}

/**
 * Milestone set: first run; 10/50/100 runs; 100/500 km lifetime; first 5K/10K/half-marathon
 * distance; 3-day & 7-day run streaks; 4-week streak; current record holder for each Records key.
 */
export function evaluateAchievements(runs: Run[], records: Records): Achievement[] {
  if (runs.length === 0) return [];
  const achievements: Achievement[] = [];
  const chronological = [...runs].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  achievements.push({
    id: 'first-run',
    title: 'First Run',
    desc: 'Completed your first run',
    earnedByRunId: chronological[0].id,
  });

  for (const n of [10, 50, 100]) {
    if (chronological.length >= n) {
      achievements.push({
        id: `runs-${n}`,
        title: `${n} Runs`,
        desc: `Completed ${n} runs`,
        earnedByRunId: chronological[n - 1].id,
      });
    }
  }

  let cumKm = 0;
  const kmMilestoneRunId: Record<number, string> = {};
  for (const run of chronological) {
    cumKm += run.actualKm;
    for (const km of [100, 500]) {
      if (cumKm >= km && !(km in kmMilestoneRunId)) kmMilestoneRunId[km] = run.id;
    }
  }
  for (const km of [100, 500]) {
    if (kmMilestoneRunId[km]) {
      achievements.push({
        id: `lifetime-${km}km`,
        title: `${km} km Lifetime`,
        desc: `Ran ${km} km total`,
        earnedByRunId: kmMilestoneRunId[km],
      });
    }
  }

  const distanceMilestones = [
    { id: 'first-5k', title: 'First 5K', km: 5 },
    { id: 'first-10k', title: 'First 10K', km: 10 },
    { id: 'first-half', title: 'First Half Marathon', km: 21.1 },
  ];
  for (const dm of distanceMilestones) {
    const run = chronological.find((r) => r.actualKm >= dm.km);
    if (run) {
      achievements.push({
        id: dm.id,
        title: dm.title,
        desc: `Ran ${dm.km} km in one run`,
        earnedByRunId: run.id,
      });
    }
  }

  const { runDays, weeks } = currentStreaks(runs);
  if (runDays >= 3) achievements.push({ id: 'streak-3day', title: '3-Day Streak', desc: 'Ran 3 days in a row' });
  if (runDays >= 7) achievements.push({ id: 'streak-7day', title: '7-Day Streak', desc: 'Ran 7 days in a row' });
  if (weeks >= 4) achievements.push({ id: 'streak-4week', title: '4-Week Streak', desc: 'Ran at least once a week for 4 weeks' });

  for (const [key, runId] of Object.entries(records.holders)) {
    achievements.push({
      id: `record-${key}`,
      title: recordTitle(key),
      desc: 'Current record holder',
      earnedByRunId: runId,
    });
  }

  return achievements;
}

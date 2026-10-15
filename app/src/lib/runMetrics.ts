import { haversineKm } from './geo';

/** A tracked GPS sample. tMs/altM are absent on legacy (pre-V3) runs. */
export type TracePoint = [lng: number, lat: number, tMs?: number, altM?: number | null];
/** One continuous stretch of tracking. A pause/resume starts a new segment. */
export type TraceSegment = TracePoint[];
/** Time taken for a single completed kilometre. */
export interface Split {
  km: number;
  sec: number;
}

/** Total distance (km) summed within each segment; the gap between segments (a pause) is never counted. */
export function segmentsDistanceKm(segments: TraceSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      total += haversineKm(seg[i - 1][1], seg[i - 1][0], seg[i][1], seg[i][0]);
    }
  }
  return total;
}

interface Sample {
  dist: number; // cumulative km across all segments (gaps add 0)
  t: number; // cumulative MOVING time in ms (paused time excluded)
}

/** Build (cumulative distance, cumulative moving-time) samples, or [] if any timestamp is missing. */
function buildSamples(segments: TraceSegment[]): Sample[] {
  const samples: Sample[] = [];
  let cumDist = 0;
  let cumT = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      if (seg[i][2] === undefined) return [];
      if (i > 0) {
        cumDist += haversineKm(seg[i - 1][1], seg[i - 1][0], seg[i][1], seg[i][0]);
        cumT += (seg[i][2] as number) - (seg[i - 1][2] as number);
      }
      samples.push({ dist: cumDist, t: cumT });
    }
  }
  return samples;
}

/** Linearly interpolate cumulative moving-time (ms) at a target cumulative distance (km). */
function timeAtDistance(samples: Sample[], targetKm: number): number {
  if (targetKm <= 0) return samples[0].t;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].dist >= targetKm) {
      const d0 = samples[i - 1].dist;
      const d1 = samples[i].dist;
      const t0 = samples[i - 1].t;
      const t1 = samples[i].t;
      if (d1 === d0) return t1;
      return t0 + ((targetKm - d0) / (d1 - d0)) * (t1 - t0);
    }
  }
  return samples[samples.length - 1].t;
}

/** Per-km splits using moving time only. [] when timestamps are missing or the run is under 1 km. */
export function computeSplits(segments: TraceSegment[]): Split[] {
  const samples = buildSamples(segments);
  if (samples.length < 2) return [];
  const totalKm = samples[samples.length - 1].dist;
  const splits: Split[] = [];
  for (let km = 1; km <= Math.floor(totalKm); km++) {
    const sec = (timeAtDistance(samples, km) - timeAtDistance(samples, km - 1)) / 1000;
    splits.push({ km, sec: Math.round(sec) });
  }
  return splits;
}

/** Current pace (sec/km) over the trailing `windowMs` of one segment, or null if unavailable. */
export function rollingPaceSecPerKm(segment: TraceSegment, windowMs = 30_000): number | null {
  if (segment.length < 2) return null;
  const last = segment[segment.length - 1];
  const lastT = last[2];
  if (lastT === undefined) return null;

  let startIdx = segment.length - 1;
  for (let k = segment.length - 1; k >= 0; k--) {
    const t = segment[k][2];
    if (t === undefined) return null;
    if (lastT - t <= windowMs) startIdx = k;
    else break;
  }
  if (startIdx >= segment.length - 1) return null;

  let dist = 0;
  for (let j = startIdx + 1; j < segment.length; j++) {
    dist += haversineKm(segment[j - 1][1], segment[j - 1][0], segment[j][1], segment[j][0]);
  }
  const dtSec = (lastT - (segment[startIdx][2] as number)) / 1000;
  if (dist <= 0 || dtSec <= 0) return null;
  return dtSec / dist;
}

/**
 * Total ascent in metres from GPS altitude. Deltas under `noiseM` are dropped:
 * raw GPS altitude jitters by several metres even standing still, which would
 * otherwise accumulate into hundreds of phantom metres over a long run.
 * Returns null when the trace carries no altitude (legacy runs).
 */
export function elevationGainM(segments: TraceSegment[], noiseM = 3): number | null {
  let gain = 0;
  let sawAltitude = false;
  for (const seg of segments) {
    let ref: number | null = null;
    for (const p of seg) {
      const alt = p[3];
      if (alt == null) continue;
      sawAltitude = true;
      if (ref == null) {
        ref = alt;
        continue;
      }
      const delta = alt - ref;
      if (delta > noiseM) {
        gain += delta;
        ref = alt;
      } else if (delta < -noiseM) {
        ref = alt;
      }
    }
  }
  return sawAltitude ? Math.round(gain) : null;
}

/**
 * Rough energy burn for running, using the standard ~1.036 kcal per kg per km.
 * Distance-based, not pace-based: pace barely moves the total for running.
 */
export function estimateCalories(km: number, weightKg: number): number | null {
  if (!(km > 0) || !(weightKg > 0)) return null;
  return Math.round(1.036 * weightKg * km);
}

/** Default title for a new run, matching the convention runners expect. */
export function defaultRunName(iso: string): string {
  const h = new Date(iso).getHours();
  if (h < 12) return 'Morning Run';
  if (h < 17) return 'Afternoon Run';
  if (h < 21) return 'Evening Run';
  return 'Night Run';
}

/** Format a sec/km pace as "M:SS", or an em dash when unavailable. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return '—';
  let m = Math.floor(secPerKm / 60);
  let s = Math.round(secPerKm % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

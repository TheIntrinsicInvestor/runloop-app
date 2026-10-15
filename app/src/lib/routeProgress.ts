import { bearingDeg, haversineKm } from './geo';

export type LngLat = [number, number];

/**
 * Which way the planned route heads from here, for orienting the map "route-up".
 *
 * Aims at a point `lookaheadM` along the remaining route rather than the next
 * vertex: vertices can be metres apart, so a next-vertex bearing would swing
 * wildly. Looking ahead a fixed distance also means the map starts turning into
 * a bend slightly before you reach it, which is what makes it feel natural.
 *
 * Returns null when there is nothing meaningful to aim at (route finished, or
 * less than half the lookahead remaining) so the caller can fall back to course.
 */
export function routeAheadBearing(
  ahead: LngLat[],
  position: LngLat,
  lookaheadM = 40,
): number | null {
  if (ahead.length < 2) return null;

  let travelled = 0;
  let target: LngLat | null = null;
  for (let i = 1; i < ahead.length; i++) {
    travelled += haversineKm(ahead[i - 1][1], ahead[i - 1][0], ahead[i][1], ahead[i][0]) * 1000;
    if (travelled >= lookaheadM) {
      target = ahead[i];
      break;
    }
  }

  // Route ran out before the lookahead. Near the finish the remaining stub points
  // nowhere useful, so only aim at it while it is still a reasonable distance.
  if (!target) {
    if (travelled < lookaheadM / 2) return null;
    target = ahead[ahead.length - 1];
  }

  // A GPS fix sitting exactly on the target would make the bearing meaningless.
  if (haversineKm(position[1], position[0], target[1], target[0]) * 1000 < 1) return null;

  return bearingDeg(position, target);
}

/**
 * Index of the planned-route vertex the runner has reached.
 *
 * Search is forward-only from `fromIdx` so a loop that passes close to its own
 * start (or crosses itself) can't snap the progress marker backwards. The
 * lookahead window keeps a distant GPS spike from teleporting progress ahead.
 */
export function advanceRouteIndex(
  coords: LngLat[],
  position: LngLat,
  fromIdx: number,
  lookahead = 150,
): number {
  if (coords.length === 0) return 0;
  const start = Math.max(0, Math.min(fromIdx, coords.length - 1));
  const end = Math.min(coords.length - 1, start + lookahead);

  let bestIdx = start;
  let bestKm = Infinity;
  for (let i = start; i <= end; i++) {
    const km = haversineKm(position[1], position[0], coords[i][1], coords[i][0]);
    if (km < bestKm) {
      bestKm = km;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Replay a finished trace to recover how far along the planned route it got.
 *
 * Derived rather than stored, so runs recorded before this existed still render
 * correctly. A trace with no points leaves the whole route showing as ahead.
 */
export function progressIndexForTrace(coords: LngLat[], trace: LngLat[]): number {
  let idx = 0;
  for (const p of trace) idx = advanceRouteIndex(coords, p, idx);
  return idx;
}

/**
 * Split a planned route into the stretch already covered and the stretch still
 * ahead. The two share the vertex at `idx` so the lines meet with no visible gap.
 */
export function splitRouteAtIndex(
  coords: LngLat[],
  idx: number,
): { behind: LngLat[]; ahead: LngLat[] } {
  if (coords.length === 0) return { behind: [], ahead: [] };
  const i = Math.max(0, Math.min(idx, coords.length - 1));
  return {
    behind: coords.slice(0, i + 1),
    ahead: coords.slice(i),
  };
}

import type { LngLat } from './routeProgress';

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320;

/** How many vertices either side of the hint to search. */
export const SEARCH_WINDOW = 30;

/**
 * Project to local metres about `lat0`. Over the few hundred metres this is
 * used for, the equirectangular error is far below GPS noise.
 */
function toMetres(p: LngLat, lat0: number): [number, number] {
  const rad = (lat0 * Math.PI) / 180;
  return [p[0] * M_PER_DEG_LNG * Math.cos(rad), p[1] * M_PER_DEG_LAT];
}

/** Perpendicular distance (m) from p to segment ab, clamped to the segment. */
function pointToSegmentM(p: LngLat, a: LngLat, b: LngLat, lat0: number): number {
  const [px, py] = toMetres(p, lat0);
  const [ax, ay] = toMetres(a, lat0);
  const [bx, by] = toMetres(b, lat0);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  // Degenerate segment (duplicate vertices) → fall back to point distance.
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Shortest distance in metres from `point` to the planned route, searching only
 * a window around `hintIdx` so cost stays flat as routes get longer.
 *
 * Measures against segments, not vertices: on a sparse route a runner exactly
 * on a long straight can sit 100 m from the nearest vertex while being 0 m from
 * the line itself.
 */
export function distanceToRouteM(
  point: LngLat,
  route: LngLat[],
  hintIdx: number,
  window = SEARCH_WINDOW,
): { distM: number; nearestIdx: number } {
  if (route.length === 0) return { distM: Infinity, nearestIdx: 0 };
  if (route.length === 1) {
    const lat0 = route[0][1];
    const [px, py] = toMetres(point, lat0);
    const [ax, ay] = toMetres(route[0], lat0);
    return { distM: Math.hypot(px - ax, py - ay), nearestIdx: 0 };
  }

  const lat0 = point[1];
  const hint = Math.max(0, Math.min(hintIdx, route.length - 1));
  const from = Math.max(0, hint - window);
  const to = Math.min(route.length - 2, hint + window);

  let bestDist = Infinity;
  let bestIdx = from;
  for (let i = from; i <= to; i++) {
    const d = pointToSegmentM(point, route[i], route[i + 1], lat0);
    if (d < bestDist) {
      bestDist = d;
      // Report the nearer endpoint so the hint tracks the runner's progress.
      const da = pointToSegmentM(point, route[i], route[i], lat0);
      const db = pointToSegmentM(point, route[i + 1], route[i + 1], lat0);
      bestIdx = db < da ? i + 1 : i;
    }
  }
  return { distM: bestDist, nearestIdx: bestIdx };
}

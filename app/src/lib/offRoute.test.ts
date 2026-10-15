import { distanceToRouteM } from './offRoute';
import type { LngLat } from './routeProgress';

// West→east line at the equator; consecutive vertices are ~111 m apart.
const line: LngLat[] = Array.from({ length: 40 }, (_, i) => [i * 0.001, 0]);
const M_PER_DEG = 110_540;

describe('distanceToRouteM', () => {
  it('reports ~0 m for a point sitting on the route', () => {
    const { distM } = distanceToRouteM([0.005, 0], line, 5);
    expect(distM).toBeLessThan(0.5);
  });

  it('reports ~0 m midway along a segment, not the distance to a vertex', () => {
    // Exactly between vertices 5 and 6. A vertex-only search would say ~55 m.
    const { distM } = distanceToRouteM([0.0055, 0], line, 5);
    expect(distM).toBeLessThan(0.5);
  });

  it('measures a perpendicular offset correctly', () => {
    const offsetDeg = 50 / M_PER_DEG; // 50 m north
    const { distM } = distanceToRouteM([0.005, offsetDeg], line, 5);
    expect(distM).toBeCloseTo(50, 0);
  });

  it('handles a corner at a segment join', () => {
    // Right-angle turn: north leg then east leg, meeting at the origin.
    const corner: LngLat[] = [[0, 0.001], [0, 0], [0.001, 0]];
    // Point diagonally outside the corner is nearest the joint vertex itself.
    const d = 30 / M_PER_DEG;
    const { distM } = distanceToRouteM([-d, -d], corner, 1);
    expect(distM).toBeCloseTo(Math.hypot(30, 30), 0);
  });

  it('still finds the nearest segment when the hint is stale but in window', () => {
    const { distM, nearestIdx } = distanceToRouteM([0.020, 0], line, 5);
    expect(distM).toBeLessThan(0.5);
    expect(nearestIdx).toBe(20);
  });

  it('misses a match outside the window, which is the intended tradeoff', () => {
    // Vertex 35 is far beyond hint 0 + window 5, so the reported distance is large.
    const { distM } = distanceToRouteM([0.035, 0], line, 0, 5);
    expect(distM).toBeGreaterThan(1000);
  });

  it('returns the nearest vertex index so the hint can advance', () => {
    const { nearestIdx } = distanceToRouteM([0.0102, 0], line, 8);
    expect(nearestIdx).toBe(10);
  });

  it('handles degenerate routes', () => {
    expect(distanceToRouteM([0, 0], [], 0).distM).toBe(Infinity);
    expect(distanceToRouteM([0, 0], [[0, 0]], 0).distM).toBeCloseTo(0, 5);
  });

  it('handles duplicate consecutive vertices without dividing by zero', () => {
    const dup: LngLat[] = [[0, 0], [0, 0], [0.001, 0]];
    const { distM } = distanceToRouteM([0.0005, 0], dup, 0);
    expect(Number.isFinite(distM)).toBe(true);
    expect(distM).toBeLessThan(0.5);
  });
});

import { bearingDeg } from './geo';
import { routeAheadBearing, type LngLat } from './routeProgress';

// Singapore-ish latitude, where 0.001 deg of longitude is ~111 m and 0.001 deg of
// latitude is ~111 m too, so these fixtures are easy to reason about in metres.
const ORIGIN: LngLat = [103.85, 1.29];

/** A straight line of `n` points heading due north from ORIGIN, `stepM` apart. */
function northLine(n: number, stepM: number): LngLat[] {
  const degPerM = 1 / 111_320;
  return Array.from({ length: n }, (_, i) => [ORIGIN[0], ORIGIN[1] + i * stepM * degPerM] as LngLat);
}

/** Same, heading due east. */
function eastLine(n: number, stepM: number): LngLat[] {
  const degPerM = 1 / (111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180));
  return Array.from({ length: n }, (_, i) => [ORIGIN[0] + i * stepM * degPerM, ORIGIN[1]] as LngLat);
}

describe('bearingDeg', () => {
  it('reads 0 for due north and 90 for due east', () => {
    expect(bearingDeg(ORIGIN, [103.85, 1.3])).toBeCloseTo(0, 1);
    expect(bearingDeg(ORIGIN, [103.86, 1.29])).toBeCloseTo(90, 1);
  });

  it('reads 180 for due south and 270 for due west', () => {
    expect(bearingDeg(ORIGIN, [103.85, 1.28])).toBeCloseTo(180, 1);
    expect(bearingDeg(ORIGIN, [103.84, 1.29])).toBeCloseTo(270, 1);
  });

  it('always returns a positive angle', () => {
    expect(bearingDeg(ORIGIN, [103.849, 1.291])).toBeGreaterThanOrEqual(0);
    expect(bearingDeg(ORIGIN, [103.849, 1.291])).toBeLessThan(360);
  });
});

describe('routeAheadBearing', () => {
  it('points along a straight route', () => {
    expect(routeAheadBearing(northLine(20, 10), ORIGIN, 40)).toBeCloseTo(0, 0);
    expect(routeAheadBearing(eastLine(20, 10), ORIGIN, 40)).toBeCloseTo(90, 0);
  });

  it('aims at the lookahead point, not the next vertex', () => {
    // Two metres north, then a hard turn east. A next-vertex bearing would read
    // due north; a 40 m lookahead should be dominated by the eastward leg.
    const degLat = 1 / 111_320;
    const degLng = 1 / (111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180));
    const route: LngLat[] = [
      ORIGIN,
      [ORIGIN[0], ORIGIN[1] + 2 * degLat],
      [ORIGIN[0] + 60 * degLng, ORIGIN[1] + 2 * degLat],
    ];
    const b = routeAheadBearing(route, ORIGIN, 40);
    expect(b).not.toBeNull();
    expect(b!).toBeGreaterThan(80); // decisively eastward, not ~0
  });

  it('returns null when the route has no remaining leg', () => {
    expect(routeAheadBearing([], ORIGIN, 40)).toBeNull();
    expect(routeAheadBearing([ORIGIN], ORIGIN, 40)).toBeNull();
  });

  it('returns null when only a short stub remains', () => {
    // 15 m of route left against a 40 m lookahead — under the half-lookahead floor.
    expect(routeAheadBearing(northLine(2, 15), ORIGIN, 40)).toBeNull();
  });

  it('aims at the final point when the remaining stub is still substantial', () => {
    // 30 m left, over the 20 m floor, so it should still give a usable bearing.
    expect(routeAheadBearing(northLine(2, 30), ORIGIN, 40)).toBeCloseTo(0, 0);
  });

  it('returns null when the runner is sitting on the target', () => {
    const route = northLine(20, 10);
    // A sub-metre lookahead resolves to the very next vertex; standing on it
    // leaves no direction to derive.
    expect(routeAheadBearing(route, route[1], 0.5)).toBeNull();
  });
});

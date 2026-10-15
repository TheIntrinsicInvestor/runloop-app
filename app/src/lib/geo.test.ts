import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(1.3, 103.8, 1.3, 103.8)).toBe(0);
  });

  it('returns ~111 km per degree of latitude', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
});

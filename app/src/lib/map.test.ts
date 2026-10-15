import { MAP_STYLE_DAY, MAP_STYLE_NIGHT, mapStyleFor } from './map';

describe('mapStyleFor', () => {
  it('returns the night basemap for a dark theme', () => {
    expect(mapStyleFor(true)).toBe(MAP_STYLE_NIGHT);
  });

  it('returns the day basemap for a light theme', () => {
    expect(mapStyleFor(false)).toBe(MAP_STYLE_DAY);
  });

  it('uses distinct styles for the two modes', () => {
    expect(MAP_STYLE_NIGHT).not.toBe(MAP_STYLE_DAY);
  });
});

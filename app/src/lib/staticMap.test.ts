import { encodePolyline, staticMapUrl } from './staticMap';

describe('encodePolyline', () => {
  it('matches the canonical Google polyline algorithm example', () => {
    const points: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('returns an empty string for no points', () => {
    expect(encodePolyline([])).toBe('');
  });
});

describe('staticMapUrl', () => {
  const coords: [number, number][] = [
    [103.8, 1.3],
    [103.81, 1.31],
  ];

  it('returns null without a token', () => {
    expect(staticMapUrl(coords, { token: '' })).toBeNull();
  });

  it('returns null for fewer than 2 points', () => {
    expect(staticMapUrl([[103.8, 1.3]], { token: 'tok' })).toBeNull();
  });

  it('builds a Mapbox Static Images URL with an encoded path overlay and the token', () => {
    const url = staticMapUrl(coords, { token: 'tok123', width: 320, height: 180 });
    expect(url).toContain('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/path-6+9D6BFF-1(');
    expect(url).toContain('/auto/320x180@2x?');
    expect(url).toContain('access_token=tok123');
  });

  it('uses the light style when dark: false', () => {
    const url = staticMapUrl(coords, { token: 'tok123', dark: false });
    expect(url).toContain('/styles/v1/mapbox/light-v11/static/');
  });

  it('suppresses the baked-in Mapbox logo and attribution overlay', () => {
    const url = staticMapUrl(coords, { token: 'tok123' });
    expect(url).toContain('logo=false');
    expect(url).toContain('attribution=false');
  });

  it('passes padding through only when supplied', () => {
    expect(staticMapUrl(coords, { token: 'tok', padding: '40,110,400,110' })).toContain(
      'padding=40,110,400,110',
    );
    expect(staticMapUrl(coords, { token: 'tok' })).not.toContain('padding=');
  });

  it('defaults to a 9:16 request matching the share card frame', () => {
    const url = staticMapUrl(coords, { token: 'tok' });
    expect(url).toContain('/auto/600x1067@2x?');
  });
});

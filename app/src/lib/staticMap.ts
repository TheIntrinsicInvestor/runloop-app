/**
 * Google/Mapbox polyline algorithm (precision 5). Input points are [lat, lng] pairs.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function encodePolyline(points: [number, number][]): string {
  const factor = 1e5;
  let output = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const lat5 = Math.round(lat * factor);
    const lng5 = Math.round(lng * factor);
    output += encodeSignedNumber(lat5 - prevLat) + encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }
  return output;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  return encodeNumber(sgnNum);
}

function encodeNumber(num: number): string {
  let output = '';
  while (num >= 0x20) {
    output += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  output += String.fromCharCode(num + 63);
  return output;
}

/** Evenly-spaced subset (keeps the last point) — bounds the polyline length in the URL. */
function downsample(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = coords.length / maxPoints;
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) out.push(coords[Math.floor(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}

/**
 * Mapbox Static Images API URL for a route trace, auto-fit to bounds. `coordinates` are
 * [lng, lat] pairs (the app-wide convention). Null when there's no token or too few points
 * to draw a line.
 *
 * `padding` ("top,right,bottom,left", in request units) loosens the auto-fit so the route
 * sits in context instead of touching the edges. A large bottom value lifts the route clear
 * of the share card's gradient scrim. The Mapbox logo and attribution overlay are turned off
 * (they render clipped over a full-bleed layout); the card draws its own credit line instead,
 * which is what Mapbox's terms require.
 */
export function staticMapUrl(
  coordinates: [number, number][],
  opts: { token: string; width?: number; height?: number; dark?: boolean; padding?: string },
): string | null {
  const { token, width = 600, height = 1067, dark = true, padding } = opts;
  if (!token || coordinates.length < 2) return null;
  const points = downsample(coordinates, 150).map(([lng, lat]) => [lat, lng] as [number, number]);
  const encoded = encodePolyline(points);
  const style = dark ? 'dark-v11' : 'light-v11';
  const path = `path-6+9D6BFF-1(${encodeURIComponent(encoded)})`;
  const size = `${Math.round(width)}x${Math.round(height)}@2x`;
  const params = ['logo=false', 'attribution=false'];
  if (padding) params.push(`padding=${padding}`);
  params.push(`access_token=${token}`);
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${path}/auto/${size}?${params.join('&')}`;
}

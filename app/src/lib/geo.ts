/** Convert a [lat, lng] pair to Mapbox's [lng, lat] coordinate order. */
export function toLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat];
}

/** Format a distance in km for display, e.g. "~5.0 km". */
export function formatKm(km: number): string {
  return `~${km.toFixed(1)} km`;
}

/** Haversine distance in km between two points given as (lat, lng). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Initial great-circle bearing from one [lng, lat] point to another, in degrees
 * clockwise from true north (0..360). This is what a map camera wants for "which
 * way is up".
 */
export function bearingDeg(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const dLng = toRad(to[0] - from[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

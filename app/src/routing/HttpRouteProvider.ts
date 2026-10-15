import { ROUTE_API_BASE, ROUTE_API_KEY } from '@/config';
import type { GenerateResult, RouteProvider, RoutePrefs } from './RouteProvider';

async function postGenerate(lat: number, lng: number, distanceKm: number, prefs: RoutePrefs): Promise<GenerateResult> {
  const res = await fetch(`${ROUTE_API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ROUTE_API_KEY,
    },
    body: JSON.stringify({ lat, lng, distanceKm, avoidHills: prefs.avoidHills, surface: prefs.surface }),
  });
  if (!res.ok) throw new Error(`Route service error: ${res.status}`);
  return res.json() as Promise<GenerateResult>;
}

export const httpRouteProvider: RouteProvider = {
  async generate(lat, lng, distanceKm, prefs) {
    try {
      return await postGenerate(lat, lng, distanceKm, prefs);
    } catch {
      try {
        return await postGenerate(lat, lng, distanceKm, prefs);
      } catch (e) {
        const isHttpError = e instanceof Error && e.message.startsWith('Route service error');
        throw new Error(isHttpError
          ? 'Server error — try again'
          : "Can't reach the route service — check your connection");
      }
    }
  },
};

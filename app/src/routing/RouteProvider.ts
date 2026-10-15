export interface RouteCandidate {
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];  // [lng, lat]
  };
  actualKm: number;
  overlapPct: number;
  ascentM: number;
}

export interface GenerateResult {
  routes: RouteCandidate[];
  partial: boolean;
}

export type Surface = 'any' | 'paved' | 'trail';

export interface RoutePrefs {
  avoidHills: boolean;
  surface: Surface;
}

export interface RouteProvider {
  generate(lat: number, lng: number, distanceKm: number, prefs: RoutePrefs): Promise<GenerateResult>;
}

export interface SavedRoute {
  id: string;
  name: string | null;
  startLat: number;
  startLng: number;
  requestedKm: number;
  actualKm: number;
  overlapPct: number;
  geometry: RouteCandidate['geometry'];
  savedAt: string;
}

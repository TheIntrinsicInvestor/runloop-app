/** Last resort only: the camera to open on when neither a live fix nor a remembered
 *  centre is available, i.e. a first launch before location is granted. Marina Bay.
 *  Prefer `useSettingsStore.lastMapCenter`, which is written on each app's first fix —
 *  a Bay Area user should not be looking at Singapore. */
export const FALLBACK_CENTER: [number, number] = [103.852, 1.2903];

/** Night basemap. Note: dark-v11 suppresses park/green-space fills, so trails
 *  through gardens read much like roads (accepted tradeoff, Phase 5.5 interview).
 *  Swap to `navigation-night-v1` — dark but Streets-derived, keeps landuse — if
 *  that proves unworkable on-device. */
export const MAP_STYLE_NIGHT = 'mapbox://styles/mapbox/dark-v11';

/** Day basemap. Streets keeps parks/green space distinct from roads. */
export const MAP_STYLE_DAY = 'mapbox://styles/mapbox/streets-v12';

/** Single source of truth for the basemap. Every MapView must use this rather
 *  than inlining a style URL, so the two modes can never drift apart. */
export function mapStyleFor(dark: boolean): string {
  return dark ? MAP_STYLE_NIGHT : MAP_STYLE_DAY;
}

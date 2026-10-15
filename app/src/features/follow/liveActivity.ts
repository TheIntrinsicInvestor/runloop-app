type WidgetModule = typeof import('react-native-widget-extension');
let widgetModule: WidgetModule | null | undefined;

/**
 * Lazily load react-native-widget-extension, for the same reason useAudioCues lazily
 * loads expo-speech: a dev client built before this feature has no
 * ReactNativeWidgetExtension native module, and a module-scope import would crash the
 * app on launch rather than merely losing the lock-screen readout.
 */
function getWidgets(): WidgetModule | null {
  if (widgetModule === undefined) {
    try {
      widgetModule = require('react-native-widget-extension') as WidgetModule;
    } catch {
      widgetModule = null;
    }
  }
  return widgetModule;
}

/** False on iOS < 16.2, in the simulator, or when the user has disabled Live Activities. */
export function liveActivitiesAvailable(): boolean {
  try {
    return getWidgets()?.areActivitiesEnabled() ?? false;
  } catch {
    return false;
  }
}

export interface RunActivityState {
  distanceKm: number;
  /** Seconds per km; 0 until there is enough distance to be meaningful. */
  paceSecPerKm: number;
  elapsedSec: number;
  isPaused: boolean;
}

/**
 * Every call is wrapped: a failed Live Activity must never take down a run in progress.
 * The lock-screen readout is a convenience, the trace is the thing that matters.
 */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Intentionally silent — see above.
  }
}

export function startRunActivity(plannedKm: number, state: RunActivityState): void {
  const w = getWidgets();
  if (!w) return;
  safely(() =>
    w.startActivity(
      plannedKm,
      state.distanceKm,
      Math.round(state.paceSecPerKm),
      Math.round(state.elapsedSec),
      state.isPaused,
    ),
  );
}

export function updateRunActivity(state: RunActivityState): void {
  const w = getWidgets();
  if (!w) return;
  safely(() =>
    w.updateActivity(
      state.distanceKm,
      Math.round(state.paceSecPerKm),
      Math.round(state.elapsedSec),
      state.isPaused,
    ),
  );
}

export function endRunActivity(state: RunActivityState): void {
  const w = getWidgets();
  if (!w) return;
  safely(() =>
    w.endActivity(state.distanceKm, Math.round(state.paceSecPerKm), Math.round(state.elapsedSec)),
  );
}

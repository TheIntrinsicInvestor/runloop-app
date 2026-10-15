import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useActiveRunStore } from '@/store/useActiveRunStore';

/** Persisted by iOS across launches — never rename without stopping the old task first. */
export const RUN_LOCATION_TASK = 'runloop-background-run-location';

/**
 * Defined at module scope and imported from `index.ts`, because iOS can spin up the
 * JS bundle with no views mounted purely to deliver a batch of fixes — the task must
 * already be registered by then. Never move this inside a component or effect.
 *
 * Points land in the same module-global Zustand store the UI reads, so a screen-off
 * stretch simply appends to the trace. `addPoint` ignores fixes while paused or when
 * no run is active, which also makes a stray delivery harmless.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- executor must return a Promise
TaskManager.defineTask(RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background location task error', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
  if (!locations?.length) return;
  const { addPoint } = useActiveRunStore.getState();
  for (const loc of locations) {
    addPoint([loc.coords.longitude, loc.coords.latitude, loc.timestamp, loc.coords.altitude]);
  }
});

/** Idempotent: starting an already-running task would throw. */
export async function startBackgroundRunUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    // Blue status-bar pill while recording — required honesty, and a cue the run
    // is still live when the app is buried.
    showsBackgroundLocationIndicator: true,
    // iOS would otherwise pause updates when it thinks you've stopped moving,
    // which silently truncates a trace at a long traffic light.
    pausesUpdatesAutomatically: false,
  });
}

/** Safe to call when nothing is running. */
export async function stopBackgroundRunUpdates(): Promise<void> {
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK))) return;
    await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
  } catch {
    // Task was never registered, or already gone. Nothing to clean up.
  }
}

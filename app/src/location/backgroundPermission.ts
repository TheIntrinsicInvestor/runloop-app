import * as Location from 'expo-location';
import { useSettingsStore } from '@/store/useSettingsStore';
import { showAlert } from '@/components';

export interface BackgroundPermissionResult {
  granted: boolean;
  /** True only when we prompted on this run and were refused — so the fallback
   *  notice appears once, at the moment it is relevant, instead of every run. */
  justRefused: boolean;
}

function confirmAsync(title: string, message: string, confirm: string, cancel: string): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirm, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Resolves whether this run may record with the screen off, asking at most once
 * ever. The OS prompt is preceded by our own explainer: iOS gives exactly one
 * chance at "Always Allow", so spending it on an unexplained system dialog wastes it.
 *
 * Caveat baked into iOS: picking "Allow Once" makes the background request resolve
 * as denied with no second prompt, which is indistinguishable here from a flat no.
 * Both paths fall back to foreground tracking and point the user at Settings.
 */
export async function ensureBackgroundTracking(): Promise<BackgroundPermissionResult> {
  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === 'granted') return { granted: true, justRefused: false };

  // Already asked in a previous run, or iOS won't show the prompt again. Don't nag.
  if (useSettingsStore.getState().askedBackgroundLocation || !existing.canAskAgain) {
    return { granted: false, justRefused: false };
  }

  const wants = await confirmAsync(
    'Keep tracking with the screen off?',
    'RunLoop can keep recording while your phone is locked or in your pocket. Pick "Always Allow" on the next screen. Without it, a run only records while the app is open and the screen is on.',
    'Continue',
    'Not now',
  );
  await useSettingsStore.getState().set('askedBackgroundLocation', true);
  if (!wants) return { granted: false, justRefused: true };

  const res = await Location.requestBackgroundPermissionsAsync();
  const granted = res.status === 'granted';
  return { granted, justRefused: !granted };
}

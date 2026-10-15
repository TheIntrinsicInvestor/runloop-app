import { useEffect } from 'react';
import { onSplit, type SplitEvent } from '@/store/useActiveRunStore';

type SpeechModule = typeof import('expo-speech');
let speechModule: SpeechModule | null | undefined;

/**
 * Lazily load expo-speech. Kept out of module scope so the native module
 * (ExpoSpeech) is only touched on first use — a dev client that lacks it still
 * boots, and cues simply no-op there instead of crashing the whole app.
 */
function getSpeech(): SpeechModule | null {
  if (speechModule === undefined) {
    try {
      speechModule = require('expo-speech') as SpeechModule;
    } catch {
      speechModule = null;
    }
  }
  return speechModule;
}

/** "5 minutes 37 seconds", omitting a zero component. */
function spokenDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s > 0) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' ') : '0 seconds';
}

export function splitAnnouncement(e: SplitEvent): string {
  return (
    `Kilometre ${e.km}. ${spokenDuration(e.splitSec)}. ` +
    `Average pace ${spokenDuration(e.avgPaceSecPerKm)} per kilometre.`
  );
}

/**
 * Speaks a summary as each kilometre completes, while `enabled`.
 *
 * `useApplicationAudioSession: false` hands the session to iOS, which ducks
 * other audio for the utterance and still plays with the silent switch on.
 */
export function useAudioCues(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const Speech = getSpeech();
    if (!Speech) return; // native speech unavailable (e.g. stale dev client) — skip cues
    const unsubscribe = onSplit((e) => {
      Speech.speak(splitAnnouncement(e), { useApplicationAudioSession: false });
    });
    return () => {
      unsubscribe();
      Speech.stop();
    };
  }, [enabled]);
}

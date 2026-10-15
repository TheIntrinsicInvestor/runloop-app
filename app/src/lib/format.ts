/** Run date in the device's own locale, e.g. "Mon, 30 Jun" (short) or "Monday, 30 June" (long). */
export function formatRunDate(iso: string, style: 'short' | 'long' = 'short'): string {
  return new Date(iso).toLocaleDateString(
    undefined,
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  );
}

/** Coarse duration for lists/cards, e.g. "29 min". */
export function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)} min`;
}

/** Precise clock for the detail screen, e.g. "29:40". */
export function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Live stopwatch, e.g. "9:07" or "1:03:22" once past an hour. */
export function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

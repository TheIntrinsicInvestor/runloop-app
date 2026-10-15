import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { useRunHistoryStore, type Run } from '@/store/useRunHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { elevationGainM, estimateCalories, formatPace } from '@/lib/runMetrics';
import type { Split } from '@/lib/runMetrics';
import { computeRecords, recordTitle } from '@/lib/stats';
import { formatElapsed, formatRunDate } from '@/lib/format';
import { staticMapUrl } from '@/lib/staticMap';
import { defaultRunName } from '@/lib/runMetrics';
import { darkTheme } from '@/theme';
import { MAPBOX_TOKEN } from '@/config';
import { showAlert } from '@/components';

// 9:16 at 1/3 scale. Captured back up to 1080x1920 so the output is deterministic
// regardless of the device's pixel ratio.
const CARD_W = 360;
const CARD_H = 640;
const OUT_W = 1080;
const OUT_H = 1920;

// Height of the gradient the stats sit on, and the matching bottom map padding that
// lifts the route clear of it. Map padding is in the static request's units (600x1067).
const SCRIM_H = 380;
const MAP_PADDING = '40,110,400,110';

const MAX_SPLIT_BARS = 12;

// The card is always dark: a shared image must not change with the viewer's theme.
const t = darkTheme;
const c = t.colors;

/** Evenly-spaced subset that always keeps the final split. */
function sampleSplits(splits: Split[]): Split[] {
  if (splits.length <= MAX_SPLIT_BARS) return splits;
  const step = splits.length / (MAX_SPLIT_BARS - 1);
  const out: Split[] = [];
  for (let i = 0; i < MAX_SPLIT_BARS - 1; i++) out.push(splits[Math.floor(i * step)]);
  out.push(splits[splits.length - 1]);
  return out;
}

/** Stacked bands standing in for a linear gradient, so no native gradient dep is needed. */
function Scrim() {
  const bands = 18;
  return (
    <View style={[styles.scrim, { height: SCRIM_H }]} pointerEvents="none">
      {Array.from({ length: bands }).map((_, i) => {
        const p = (i + 1) / bands;
        return <View key={i} style={{ flex: 1, backgroundColor: `rgba(8,8,12,${(p * p * 0.97).toFixed(3)})` }} />;
      })}
    </View>
  );
}

/** Per-km pace bars, tallest = fastest, best km picked out in the bright accent. */
function SplitsStrip({ splits }: { splits: Split[] }) {
  const shown = sampleSplits(splits);
  const fastest = Math.min(...shown.map((s) => s.sec));
  const slowest = Math.max(...shown.map((s) => s.sec));
  return (
    <View style={styles.splitsStrip}>
      {shown.map((s) => {
        const norm = slowest === fastest ? 1 : (slowest - s.sec) / (slowest - fastest);
        return (
          <View
            key={s.km}
            style={{
              flex: 1,
              height: 11 + norm * 23,
              borderRadius: 2,
              backgroundColor: s.sec === fastest ? c.accentBright : 'rgba(157,107,255,0.42)',
            }}
          />
        );
      })}
    </View>
  );
}

interface CardProps {
  run: Run;
  onMapLoad?(): void;
}

/** Full-bleed route map with the run's numbers over a bottom gradient. */
export const ShareCard = forwardRef<View, CardProps>(function ShareCard({ run, onMapLoad }, ref) {
  const allRuns = useRunHistoryStore((s) => s.runs);
  const weightKg = useProfileStore((s) => s.weightKg);

  const coords = useMemo(
    () => run.segments.flatMap((seg) => seg.map((p) => [p[0], p[1]] as [number, number])),
    [run.segments],
  );
  const mapUrl = staticMapUrl(coords, { token: MAPBOX_TOKEN, padding: MAP_PADDING });

  const avgPace = run.actualKm > 0.05 ? run.durationSec / run.actualKm : null;
  const splits = run.splits ?? [];
  const bestSplitSec = splits.length ? Math.min(...splits.map((s) => s.sec)) : null;
  const gainM = useMemo(() => elevationGainM(run.segments), [run.segments]);
  const calories = weightKg != null ? estimateCalories(run.actualKm, weightKg) : null;

  const prTitles = useMemo(() => {
    const records = computeRecords(allRuns);
    return Object.entries(records.holders)
      .filter(([, runId]) => runId === run.id)
      .map(([key]) => recordTitle(key));
  }, [allRuns, run.id]);

  const stats: { label: string; value: string }[] = [
    { label: 'Time', value: formatElapsed(run.durationSec) },
    { label: 'Avg /km', value: formatPace(avgPace) },
  ];
  if (bestSplitSec != null) stats.push({ label: 'Best km', value: formatPace(bestSplitSec) });
  if (gainM != null) stats.push({ label: 'Elev', value: `${gainM}m` });
  if (calories != null) stats.push({ label: 'Cal', value: String(calories) });

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      {mapUrl ? (
        <Image source={{ uri: mapUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onMapLoad} />
      ) : null}
      <Scrim />

      <View style={styles.content}>
        {prTitles.length > 0 && (
          <View style={styles.prRow}>
            {prTitles.slice(0, 2).map((title) => (
              <View key={title} style={styles.prPill}>
                <MaterialIcons name="emoji-events" size={11} color={c.accentOn} />
                <Text style={[t.type.label, styles.prText]}>{title}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[t.type.h2, { color: c.text, fontSize: 19 }]} numberOfLines={1}>
          {run.name ?? defaultRunName(run.startedAt)}
        </Text>
        <Text style={[t.type.label, { color: c.textMuted, marginTop: 3 }]}>
          {formatRunDate(run.startedAt, 'long')}
        </Text>

        <View style={styles.heroRow}>
          <Text style={[t.type.hero, { color: c.text, fontSize: 68, lineHeight: 66 }]}>
            {run.actualKm.toFixed(2)}
          </Text>
          <Text style={[t.type.label, { color: c.textMuted, fontSize: 16, marginLeft: 7 }]}>KM</Text>
        </View>

        {splits.length >= 2 && (
          <View style={{ marginTop: 14 }}>
            <SplitsStrip splits={splits} />
            <Text style={[t.type.label, { color: c.textDim, fontSize: 9, marginTop: 5 }]}>
              Per-km pace · best {formatPace(bestSplitSec)}
            </Text>
          </View>
        )}

        <View style={[styles.rule, { backgroundColor: c.line }]} />

        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1 }}>
              <Text style={[t.type.label, { color: c.textMuted, fontSize: 9 }]}>{s.label}</Text>
              <Text style={[t.type.statMd, { color: c.text, fontSize: 21, lineHeight: 23 }]} numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[t.type.h2, { color: c.accentBright, letterSpacing: 1.6 }]}>RUNLOOP</Text>
          <Text
            style={[
              t.type.label,
              { color: c.textDim, fontSize: 8, letterSpacing: 0.2, textTransform: 'none' },
            ]}
          >
            © Mapbox © OpenStreetMap
          </Text>
        </View>
      </View>
    </View>
  );
});

interface ButtonProps {
  run: Run;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders ShareCard off-screen, waits for its map image to load, captures it to a
 * PNG and opens the native share sheet.
 */
export function ShareRunButton({ run, style }: ButtonProps) {
  const cardRef = useRef<View>(null);
  const [rendering, setRendering] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const hasMap = run.segments.some((seg) => seg.length > 1);

  async function handlePress() {
    if (!(await Sharing.isAvailableAsync())) {
      showAlert('Sharing unavailable', 'Sharing is not supported on this device.');
      return;
    }
    setMapLoaded(false);
    setRendering(true);
  }

  useEffect(() => {
    if (!rendering) return;
    if (hasMap && !mapLoaded) return; // wait for the static map image to finish loading
    const id = setTimeout(async () => {
      try {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, width: OUT_W, height: OUT_H });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share run' });
      } catch {
        showAlert('Share failed', 'Could not create the share image.');
      } finally {
        setRendering(false);
      }
    }, 120); // let the just-mounted card lay out (and the image paint) before capture
    return () => clearTimeout(id);
  }, [rendering, mapLoaded, hasMap]);

  return (
    <>
      <TouchableOpacity style={style} onPress={handlePress} accessibilityRole="button" accessibilityLabel="Share run">
        <MaterialIcons name="ios-share" size={20} color={c.accentBright} />
      </TouchableOpacity>
      {rendering && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={cardRef} run={run} onMapLoad={() => setMapLoaded(true)} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, backgroundColor: c.bg, overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  content: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 26 },
  prRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  prText: { color: c.accentOn, fontSize: 9, letterSpacing: 0.9 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  splitsStrip: { flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 3 },
  rule: { height: 1, marginTop: 16, marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18 },
  offscreen: { position: 'absolute', top: 0, left: -9999 },
});

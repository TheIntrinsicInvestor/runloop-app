import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRunHistoryStore, type Run } from '@/store/useRunHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useAchievementsStore } from '@/store/useAchievementsStore';
import { formatClock, formatElapsed, formatRunDate } from '@/lib/format';
import { elevationGainM, estimateCalories, formatPace } from '@/lib/runMetrics';
import { computeRecords, evaluateAchievements, type Achievement } from '@/lib/stats';
import { progressIndexForTrace, splitRouteAtIndex } from '@/lib/routeProgress';
import { useTheme } from '@/theme/useTheme';
import type { Theme } from '@/theme';
import { Button, BigStat, CelebrationModal, showAlert } from '@/components';
import { ShareRunButton } from '@/features/share/ShareCard';
import { mapStyleFor, FALLBACK_CENTER } from '@/lib/map';
import { useSettingsStore } from '@/store/useSettingsStore';

interface Props {
  run: Run;
  /** Called with the final name; the run is already in history by this point. */
  onSave(name: string): void;
  onDiscard(): void;
}

const PADDING_DEG = 0.0015; // ~150 m of breathing room around the trace

function boundsOf(coords: [number, number][]) {
  if (coords.length === 0) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return {
    ne: [maxLng + PADDING_DEG, maxLat + PADDING_DEG] as [number, number],
    sw: [minLng - PADDING_DEG, minLat - PADDING_DEG] as [number, number],
  };
}

export function RunSummaryView({ run, onSave, onDiscard }: Props) {
  const t = useTheme();
  const lastMapCenter = useSettingsStore((s) => s.lastMapCenter);
  const c = t.colors;
  const [mapReady, setMapReady] = useState(false);
  const [name, setName] = useState(run.name ?? '');
  const weightKg = useProfileStore((s) => s.weightKg);
  const setWeightKg = useProfileStore((s) => s.setWeightKg);
  const [weightDraft, setWeightDraft] = useState('');

  const traceGeometry = useMemo(
    () => ({
      type: 'MultiLineString' as const,
      coordinates: run.segments.map((seg) => seg.map((p) => [p[0], p[1]] as [number, number])),
    }),
    [run.segments],
  );
  const hasTrace = run.segments.some((seg) => seg.length > 1);
  const bounds = useMemo(() => boundsOf(traceGeometry.coordinates.flat()), [traceGeometry]);

  // Same rule as the live screen: only the part of the loop you never reached
  // stays as the planned line. Everything you covered is the bright trace.
  const plannedAhead = useMemo(() => {
    if (!run.plannedGeometry) return null;
    const coords = run.plannedGeometry.coordinates;
    const idx = progressIndexForTrace(coords, traceGeometry.coordinates.flat());
    return splitRouteAtIndex(coords, idx).ahead;
  }, [run.plannedGeometry, traceGeometry]);

  const avgPace = run.actualKm > 0.05 ? run.durationSec / run.actualKm : null;
  const bestSplitSec = run.splits?.length ? Math.min(...run.splits.map((s) => s.sec)) : null;
  const gainM = useMemo(() => elevationGainM(run.segments), [run.segments]);
  const calories = weightKg != null ? estimateCalories(run.actualKm, weightKg) : null;

  // Celebrate any achievement this run just earned, once, the moment it lands in history.
  const allRuns = useRunHistoryStore((s) => s.runs);
  const seenIds = useAchievementsStore((s) => s.seenIds);
  const markSeen = useAchievementsStore((s) => s.markSeen);
  const [celebrating, setCelebrating] = useState<Achievement[]>([]);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (celebratedRef.current) return;
    if (!allRuns.some((r) => r.id === run.id)) return; // wait for saveRun to land in history
    celebratedRef.current = true;
    const records = computeRecords(allRuns);
    const fresh = evaluateAchievements(allRuns, records).filter(
      (a) => a.earnedByRunId === run.id && !seenIds.includes(a.id),
    );
    if (fresh.length > 0) {
      setCelebrating(fresh);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      markSeen(fresh.map((a) => a.id)).catch(() => {});
    }
  }, [allRuns, run.id, seenIds, markSeen]);

  function handleSaveWeight() {
    const kg = Number(weightDraft);
    if (!Number.isFinite(kg) || kg < 25 || kg > 300) {
      showAlert('Check your weight', 'Enter a weight in kilograms between 25 and 300.');
      return;
    }
    setWeightKg(kg).catch(() => showAlert('Save failed', 'Your weight could not be saved.'));
  }

  function handleDiscard() {
    showAlert('Discard this run?', 'It will be deleted from your history. This cannot be undone.', [
      { text: 'Keep run', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.mapWrap, { backgroundColor: c.surface }]}>
          <MapView
            style={StyleSheet.absoluteFill}
            styleURL={mapStyleFor(t.dark)}
            logoEnabled={false}
            attributionEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            onDidFinishLoadingMap={() => setMapReady(true)}
          >
            {mapReady && bounds && (
              <>
                <Camera
                  bounds={bounds}
                  animationMode="none"
                  defaultSettings={{ centerCoordinate: lastMapCenter ?? FALLBACK_CENTER, zoomLevel: 11 }}
                />
                {plannedAhead && plannedAhead.length > 1 && (
                  <ShapeSource
                    id="summary-planned"
                    shape={{ type: 'LineString', coordinates: plannedAhead }}
                  >
                    <LineLayer
                      id="summary-planned-line"
                      style={{
                        lineColor: c.mapRouteMuted,
                        lineWidth: 4,
                        lineCap: 'round',
                        lineJoin: 'round',
                        lineOpacity: 0.8,
                      }}
                    />
                  </ShapeSource>
                )}
                {hasTrace && (
                  <ShapeSource id="summary-trace" shape={traceGeometry}>
                    <LineLayer
                      id="summary-trace-line"
                      style={{ lineColor: c.mapRoute, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
                    />
                  </ShapeSource>
                )}
              </>
            )}
          </MapView>
          {!hasTrace && (
            <View style={styles.noTrace} pointerEvents="none">
              <Text style={[t.type.body, { color: c.textMuted }]}>No GPS trace recorded</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[t.type.label, { color: c.textMuted, marginBottom: 6 }]}>
            {formatRunDate(run.startedAt, 'long')}
          </Text>

          <View style={[styles.nameRow, { borderBottomColor: c.line }]}>
            <TextInput
              style={[styles.nameInput, { color: c.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Name this run"
              placeholderTextColor={c.textDim}
              returnKeyType="done"
              maxLength={60}
            />
            <MaterialIcons name="edit" size={18} color={c.textDim} />
          </View>

          <BigStat label="Distance" value={run.actualKm.toFixed(2)} unit="km" size="hero" />

          <View style={styles.grid}>
            <Stat t={t} label="Moving time" value={formatElapsed(run.durationSec)} />
            <Stat t={t} label="Elapsed" value={formatElapsed(run.elapsedSec ?? run.durationSec)} />
            <Stat t={t} label="Avg pace" value={formatPace(avgPace)} unit="/km" />
            <Stat t={t} label="Best km" value={bestSplitSec != null ? formatPace(bestSplitSec) : '—'} unit={bestSplitSec != null ? '/km' : undefined} accent />
            <Stat t={t} label="Elevation" value={gainM != null ? String(gainM) : '—'} unit={gainM != null ? 'm' : undefined} />
            <Stat t={t} label="Calories" value={calories != null ? String(calories) : '—'} unit={calories != null ? 'kcal' : undefined} />
          </View>

          {weightKg == null && (
            <View style={[styles.weightCard, { backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.md }]}>
              <Text style={[t.type.body, { color: c.textMuted, marginBottom: 10 }]}>
                Add your weight to estimate calories
              </Text>
              <View style={styles.weightRow}>
                <TextInput
                  style={[styles.weightInput, { color: c.text, backgroundColor: c.surfaceRaised, borderColor: c.line }]}
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  placeholder="70"
                  placeholderTextColor={c.textDim}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={[t.type.body, { color: c.textMuted, marginLeft: 8, flex: 1 }]}>kg</Text>
                <Button title="Save" variant="secondary" onPress={handleSaveWeight} />
              </View>
            </View>
          )}

          {run.plannedKm > 0 && (
            <Text style={[t.type.body, { color: c.textMuted, marginTop: 14 }]}>
              Planned {run.plannedKm.toFixed(1)} km · ran {run.actualKm.toFixed(2)} km
            </Text>
          )}

          {run.splits && run.splits.length > 0 && (
            <View style={styles.splits}>
              <Text style={[t.type.label, { color: c.textMuted, marginBottom: 4 }]}>Splits</Text>
              {run.splits.map((s) => (
                <View key={s.km} style={[styles.splitRow, { borderTopColor: c.line }]}>
                  <Text style={[t.type.bodyStrong, { color: c.text, width: 56 }]}>{s.km} km</Text>
                  <Text style={[t.type.body, { color: c.textMuted, fontVariant: ['tabular-nums'] }]}>
                    {formatClock(s.sec)}
                  </Text>
                  <Text
                    style={[
                      t.type.statMd,
                      { fontSize: 17, lineHeight: 19, color: s.sec === bestSplitSec ? c.accentBright : c.text },
                    ]}
                  >
                    {formatPace(s.sec)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Button title="Discard" variant="danger" onPress={handleDiscard} style={{ flex: 1 }} />
            <ShareRunButton
              run={run}
              style={[styles.shareBtn, { backgroundColor: c.surface, borderColor: c.line }]}
            />
            <Button title="Save run" onPress={() => onSave(name.trim())} style={{ flex: 2 }} />
          </View>
        </View>
      </ScrollView>
      <CelebrationModal
        visible={celebrating.length > 0}
        achievements={celebrating}
        onDismiss={() => setCelebrating([])}
      />
    </KeyboardAvoidingView>
  );
}

function Stat({
  t,
  label,
  value,
  unit,
  accent,
}: {
  t: Theme;
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <BigStat label={label} value={value} unit={unit} size="md" accent={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 44 },
  mapWrap: { height: 260 },
  noTrace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    marginBottom: 16,
  },
  nameInput: { flex: 1, fontSize: 22, fontWeight: '700', padding: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  statCell: { width: '33.33%', paddingVertical: 10 },
  weightCard: { borderWidth: 1, padding: 14, marginTop: 12 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weightInput: {
    width: 70,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  splits: { marginTop: 22 },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  shareBtn: {
    width: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

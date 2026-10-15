import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useRunHistoryStore, type Run } from '@/store/useRunHistoryStore';
import { formatClock, formatRunDate } from '@/lib/format';
import { defaultRunName, formatPace } from '@/lib/runMetrics';
import { computeRecords, recordTitle } from '@/lib/stats';
import { progressIndexForTrace, splitRouteAtIndex } from '@/lib/routeProgress';
import { useTheme } from '@/theme/useTheme';
import { TOP_INSET } from '@/lib/insets';
import { mapStyleFor } from '@/lib/map';
import { BigStat, StatPill } from '@/components';
import { ShareRunButton } from '@/features/share/ShareCard';

interface Props {
  run: Run;
  onBack(): void;
}

export function RunDetailView({ run, onBack }: Props) {
  const t = useTheme();
  const c = t.colors;
  const [mapReady, setMapReady] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const didIntro = useRef(false);

  // Each segment (split by pauses) drawn as its own line via a MultiLineString.
  const traceGeometry = {
    type: 'MultiLineString' as const,
    coordinates: run.segments.map((seg) => seg.map((p) => [p[0], p[1]] as [number, number])),
  };
  const hasTrace = run.segments.some((seg) => seg.length > 1);

  // Only the stretch never reached stays as the planned line; the rest is the bright trace.
  const plannedAhead = useMemo(() => {
    if (!run.plannedGeometry) return null;
    const coords = run.plannedGeometry.coordinates;
    const idx = progressIndexForTrace(coords, traceGeometry.coordinates.flat());
    return splitRouteAtIndex(coords, idx).ahead;
  }, [run.plannedGeometry, traceGeometry]);

  const center =
    run.plannedGeometry?.coordinates[0] ?? run.segments.find((s) => s.length > 0)?.[0]?.slice(0, 2);

  const avgPace = run.actualKm > 0.05 ? formatPace(run.durationSec / run.actualKm) : '—';
  const fastestKm = run.splits?.length ? Math.min(...run.splits.map((s) => s.sec)) : null;

  const allRuns = useRunHistoryStore((s) => s.runs);
  const prBadges = useMemo(() => {
    const records = computeRecords(allRuns);
    return Object.entries(records.holders)
      .filter(([, runId]) => runId === run.id)
      .map(([key]) => recordTitle(key));
  }, [allRuns, run.id]);

  // Gentle zoom-in over the run location once (opens zoomed out, eases to 14).
  useEffect(() => {
    if (!mapReady || !center || didIntro.current) return;
    didIntro.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: center as [number, number],
      zoomLevel: 14,
      animationMode: 'easeTo',
      animationDuration: 1000,
    });
  }, [mapReady, center]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      {center ? (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL={mapStyleFor(t.dark)}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          {mapReady && (
            <>
              <Camera
                ref={cameraRef}
                defaultSettings={{ centerCoordinate: center as [number, number], zoomLevel: 12.5 }}
              />
              {plannedAhead && plannedAhead.length > 1 && (
              <ShapeSource id="detail-planned" shape={{ type: 'LineString', coordinates: plannedAhead }}>
                <LineLayer
                  id="detail-planned-line"
                  style={{ lineColor: c.mapRouteMuted, lineWidth: 4, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.8 }}
                />
              </ShapeSource>
            )}
            {hasTrace && (
              <ShapeSource id="detail-trace" shape={traceGeometry}>
                <LineLayer
                  id="detail-trace-line"
                  style={{ lineColor: c.mapRoute, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
                />
              </ShapeSource>
            )}
          </>
        )}
        </MapView>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: c.surface }]}>
          <MaterialIcons name="map" size={44} color={c.textDim} />
          <Text style={[t.type.h2, { color: c.text, marginTop: 8 }]}>No route recorded</Text>
          <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center' }]}>
            This run has no saved GPS trace or planned route.
          </Text>
        </View>
      )}

      <View style={[styles.hud, { top: TOP_INSET }]}>
        <View style={styles.hudTopRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
            onPress={onBack}
            accessibilityRole="button"
          >
            <MaterialIcons name="chevron-left" size={20} color={c.text} />
            <Text style={[t.type.button, { color: c.text, textTransform: 'uppercase' }]}>Back</Text>
          </TouchableOpacity>
          <ShareRunButton
            run={run}
            style={[styles.shareBtn, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
          />
        </View>
        <View style={[styles.stats, { backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.lg }, t.shadow.card]}>
          <Text style={[t.type.h2, { color: c.text }]} numberOfLines={1}>
            {run.name ?? defaultRunName(run.startedAt)}
          </Text>
          <Text style={[t.type.label, { color: c.textMuted, marginTop: 2 }]}>
            {formatRunDate(run.startedAt, 'long')}
          </Text>
          <View style={styles.statRow}>
            <BigStat label="Distance" value={run.actualKm.toFixed(2)} unit="km" size="md" />
            <BigStat label="Time" value={formatClock(run.durationSec)} size="md" />
            <BigStat label="Avg pace" value={avgPace} unit="/km" size="md" />
          </View>
          {prBadges.length > 0 && (
            <View style={styles.prRow}>
              {prBadges.map((title) => (
                <StatPill key={title} label={`PR · ${title}`} tone="accent" />
              ))}
            </View>
          )}
          <Text style={[t.type.body, { color: c.textDim, marginTop: 8 }]}>
            {run.plannedKm > 0 ? `Planned ${run.plannedKm.toFixed(1)} km` : 'Free run'}
          </Text>
        </View>
      </View>

      {/* Splits */}
      <View style={[styles.splitsCard, { backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.lg }, t.shadow.card]}>
        {run.splits && run.splits.length > 0 ? (
          <ScrollView style={styles.splitsScroll}>
            <Text style={[t.type.label, { color: c.textMuted, marginBottom: 6 }]}>Splits</Text>
            {run.splits.map((s) => (
              <View key={s.km} style={[styles.splitRow, { borderTopColor: c.line }]}>
                <Text style={[t.type.bodyStrong, { color: c.text, width: 56 }]}>{s.km} km</Text>
                <Text style={[t.type.body, { color: c.textMuted, fontVariant: ['tabular-nums'] }]}>
                  {formatClock(s.sec)}
                </Text>
                <Text
                  style={[
                    t.type.statMd,
                    { fontSize: 17, lineHeight: 19, color: s.sec === fastestKm ? c.accentBright : c.text },
                  ]}
                >
                  {formatPace(s.sec)}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center', paddingVertical: 4 }]}>
            Recorded before per-km splits existed.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  hud: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 10,
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    borderWidth: 1,
    padding: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  prRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  splitsCard: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    maxHeight: 230,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  splitsScroll: { flexGrow: 0 },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

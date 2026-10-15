import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, LineLayer, LocationPuck, MapView, ShapeSource, UserTrackingMode } from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouteStore } from '@/store/useRouteStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAudioCues } from './useAudioCues';
import { distanceToRouteM } from '@/lib/offRoute';
import { useFavouritesStore, useIsSaved } from '@/store/useFavouritesStore';
import { useActiveRunStore } from '@/store/useActiveRunStore';
import { useRunHistoryStore, type Run } from '@/store/useRunHistoryStore';
import { RunSummaryView } from '@/features/run/RunSummaryView';
import { formatElapsed } from '@/lib/format';
import { rollingPaceSecPerKm, formatPace, defaultRunName } from '@/lib/runMetrics';
import { advanceRouteIndex, routeAheadBearing, splitRouteAtIndex } from '@/lib/routeProgress';
import type { RouteCandidate } from '@/routing/RouteProvider';
import { useTheme } from '@/theme/useTheme';
import { TOP_INSET } from '@/lib/insets';
import { mapStyleFor, FALLBACK_CENTER } from '@/lib/map';
import { ensureBackgroundTracking } from '@/location/backgroundPermission';
import { startBackgroundRunUpdates, stopBackgroundRunUpdates } from '@/location/backgroundRunTask';
import { startRunActivity, updateRunActivity, endRunActivity } from './liveActivity';
import { Button, BigStat, showAlert } from '@/components';

interface Props {
  route: RouteCandidate | null; // null = free run
  onBack(): void;
}

/** Distance a finger must travel before we treat it as a pan and drop follow mode. */
const PAN_SLOP_PX = 8;

/** Off-route thresholds. Hysteresis stops the banner flickering at the boundary. */
const OFF_ROUTE_M = 35;
const BACK_ON_ROUTE_M = 20;
/** Consecutive off-route fixes before alerting, so one bad GPS spike stays quiet. */
const OFF_ROUTE_STRIKES = 3;

/** How far along the route the map aims when orienting. Shorter feels twitchy on
 *  bends, longer turns into them too early. Tune here if it reads wrong on a run. */
const BEARING_LOOKAHEAD_M = 40;

/** Distance moved before the Live Activity is pushed again. Not a tick interval:
 *  ActivityKit throttles frequent updates, so this trades lock-screen latency for
 *  staying well inside the budget. Raise it if updates start being dropped. */
const ACTIVITY_PUSH_KM = 0.05;

/** Current run state in the shape the Live Activity wants. Reads the store directly
 *  so it is safe to call from an effect cleanup, after the component's props are stale. */
function activitySnapshot() {
  const s = useActiveRunStore.getState();
  const elapsedSec = s.elapsedSec();
  return {
    distanceKm: s.liveKm,
    // Matches the on-screen average pace, including its "not yet meaningful" floor.
    paceSecPerKm: s.liveKm > 0.02 ? elapsedSec / s.liveKm : 0,
    elapsedSec,
    isPaused: s.isPaused,
  };
}

export function FollowView({ route, onBack }: Props) {
  const t = useTheme();
  const c = t.colors;
  const startPoint = useRouteStore((s) => s.startPoint);
  const distanceKm = useRouteStore((s) => s.distanceKm);
  const saveFavourite = useFavouritesStore((s) => s.save);
  const saved = useIsSaved(route?.id ?? '');

  const startRun = useActiveRunStore((s) => s.start);
  const addPoint = useActiveRunStore((s) => s.addPoint);
  const pauseRun = useActiveRunStore((s) => s.pause);
  const resumeRun = useActiveRunStore((s) => s.resume);
  const endRun = useActiveRunStore((s) => s.end);
  const clearRun = useActiveRunStore((s) => s.clear);
  const lastPushed = useRef({ km: 0, isPaused: false });
  const isTracking = useActiveRunStore((s) => s.isTracking);
  const isPaused = useActiveRunStore((s) => s.isPaused);
  const liveKm = useActiveRunStore((s) => s.liveKm);
  const segments = useActiveRunStore((s) => s.segments);
  const saveRun = useRunHistoryStore((s) => s.saveRun);
  const renameRun = useRunHistoryStore((s) => s.renameRun);
  const removeRun = useRunHistoryStore((s) => s.removeRun);

  const traceSub = useRef<Location.LocationSubscription | null>(null);
  const [savedRun, setSavedRun] = useState<Run | null>(null);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [progressIdx, setProgressIdx] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [, setTick] = useState(0); // drives the 1s timer refresh
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const offRouteStrikes = useRef(0);

  const lastMapCenter = useSettingsStore((s) => s.lastMapCenter);
  const audioCues = useSettingsStore((s) => s.audioCues);
  const setSetting = useSettingsStore((s) => s.set);
  useAudioCues(audioCues);

  useEffect(() => {
    let cancelled = false;

    // Foreground watcher: the fallback when background location is refused, and
    // still the only path that works if the user picked "Allow Once".
    async function startForegroundWatch() {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => addPoint([loc.coords.longitude, loc.coords.latitude, loc.timestamp, loc.coords.altitude]),
      );
      if (cancelled) { sub.remove(); return; } // unmounted mid-await → don't leak
      traceSub.current = sub;
    }

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Location needed', 'Enable location access to track your run.');
          return; // don't start a run we can't record
        }
        if (cancelled) return;
        startRun(route ? { routeId: route.id, plannedKm: route.actualKm, plannedGeometry: route.geometry } : null);
        startRunActivity(route?.actualKm ?? 0, {
          distanceKm: 0, paceSecPerKm: 0, elapsedSec: 0, isPaused: false,
        });

        const { granted, justRefused } = await ensureBackgroundTracking();
        if (cancelled) return;

        if (granted) {
          try {
            await startBackgroundRunUpdates();
            if (cancelled) { stopBackgroundRunUpdates().catch(() => {}); return; }
            setBackgroundTracking(true);
            return; // the task owns the trace; a second watcher would double-count
          } catch {
            // Registration failed despite permission — fall through rather than
            // leave the run recording nothing.
          }
        }

        await startForegroundWatch();
        if (!cancelled && justRefused) {
          showAlert(
            'Screen must stay on',
            'Without background location, RunLoop only records while this screen is open. Your run will have gaps if the phone locks.',
            [
              { text: 'Got it', style: 'cancel' },
              { text: 'Open Settings', onPress: () => { Linking.openURL('app-settings:').catch(() => {}); } },
            ],
          );
        }
      } catch {
        showAlert('Location unavailable', 'Could not start run tracking.');
      }
    })();

    return () => {
      cancelled = true;
      traceSub.current?.remove();
      traceSub.current = null;
      stopBackgroundRunUpdates().catch(() => {});
      // Also ends on discard/back-out, not only on an explicit finish. An activity
      // that outlives its run sits on the lock screen until the user kills the app.
      endRunActivity(activitySnapshot());
      clearRun();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 1s tick so the elapsed timer and avg pace stay live while tracking.
  useEffect(() => {
    if (!isTracking || savedRun !== null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isTracking, savedRun]);

  // Push to the lock screen on distance, not on the 1s tick: ActivityKit throttles
  // frequent updates, and elapsed time already ticks natively in the widget. ~50 m is
  // roughly one push every 15-20s at running pace.
  useEffect(() => {
    if (!isTracking || savedRun !== null) return;
    const pausedChanged = lastPushed.current.isPaused !== isPaused;
    if (!pausedChanged && Math.abs(liveKm - lastPushed.current.km) < ACTIVITY_PUSH_KM) return;
    lastPushed.current = { km: liveKm, isPaused };
    updateRunActivity(activitySnapshot());
  }, [liveKm, isPaused, isTracking, savedRun]);

  const currentSeg = segments[segments.length - 1];
  const lastPoint = currentSeg?.[currentSeg.length - 1];

  // Walk the progress marker forward along the planned loop as new fixes arrive.
  useEffect(() => {
    if (!route || !lastPoint) return;
    setProgressIdx((idx) =>
      advanceRouteIndex(route.geometry.coordinates, [lastPoint[0], lastPoint[1]], idx),
    );
  }, [route, lastPoint]);

  // Off-route watch. Route runs only, and never while paused (standing still
  // off the line is not a wrong turn). No rerouting: this only warns.
  useEffect(() => {
    if (!route || !lastPoint || isPaused) return;
    const { distM } = distanceToRouteM(
      [lastPoint[0], lastPoint[1]],
      route.geometry.coordinates,
      progressIdx,
    );

    if (distM > OFF_ROUTE_M) {
      offRouteStrikes.current += 1;
      if (offRouteStrikes.current >= OFF_ROUTE_STRIKES && !offRoute) {
        setOffRoute(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    } else if (distM < BACK_ON_ROUTE_M) {
      offRouteStrikes.current = 0;
      if (offRoute) setOffRoute(false);
    }
  }, [route, lastPoint, isPaused, progressIdx, offRoute]);

  const plannedSplit = useMemo(
    () => (route ? splitRouteAtIndex(route.geometry.coordinates, progressIdx) : null),
    [route, progressIdx],
  );

  // Which way to point the map. Aims along the route you still have to run, so
  // "up" is where you are going even when you glance down mid-stride. Null on a
  // free run, once off-route (the planned line is no longer where you are headed)
  // and at the finish — the camera falls back to course-up in those cases.
  // Rounded to whole degrees: sub-degree changes are invisible and would churn
  // the prop on every fix.
  const routeBearing = useMemo(() => {
    if (!route || !lastPoint || offRoute || !plannedSplit) return null;
    const b = routeAheadBearing(plannedSplit.ahead, [lastPoint[0], lastPoint[1]], BEARING_LOOKAHEAD_M);
    return b === null ? null : Math.round(b);
  }, [route, lastPoint, offRoute, plannedSplit]);

  // The live blue breadcrumb: one line per segment, so pauses leave a gap.
  const traceGeometry = useMemo(
    () => ({
      type: 'MultiLineString' as const,
      coordinates: segments.map((seg) => seg.map((p) => [p[0], p[1]] as [number, number])),
    }),
    [segments],
  );
  const hasTrace = segments.some((seg) => seg.length > 1);

  const movingSec = useActiveRunStore.getState().elapsedSec();
  const avgPace = liveKm > 0.02 ? movingSec / liveKm : null;
  const currentPace = !isPaused && currentSeg ? rollingPaceSecPerKm(currentSeg) : null;

  function handleEndRun() {
    traceSub.current?.remove();
    traceSub.current = null;
    // Must not outlive the run: an orphaned task keeps the GPS awake indefinitely.
    stopBackgroundRunUpdates().catch(() => {});
    setBackgroundTracking(false);
    endRunActivity(activitySnapshot());
    const result = endRun();
    if (!result) { onBack(); return; }
    // Written to history immediately: a crash on the summary screen must not lose the run.
    const run: Run = { ...result, id: String(Date.now()), name: defaultRunName(result.startedAt) };
    setSavedRun(run);
    saveRun(run).catch(() => {
      showAlert('Save failed', 'This run could not be saved to history.');
    });
  }

  function handleSaveSummary(name: string) {
    if (savedRun && name && name !== savedRun.name) {
      renameRun(savedRun.id, name).catch(() => {
        showAlert('Rename failed', 'The run was kept under its original name.');
      });
    }
    onBack();
  }

  function handleDiscardSummary() {
    if (savedRun) {
      removeRun(savedRun.id).catch(() => {
        showAlert('Discard failed', 'This run is still in your history.');
      });
    }
    onBack();
  }

  function handleBack() {
    if (isTracking) {
      showAlert('Discard run?', 'Your progress on this run will not be saved.', [
        { text: 'Keep running', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onBack },
      ]);
      return;
    }
    onBack();
  }

  if (savedRun) {
    return <RunSummaryView run={savedRun} onSave={handleSaveSummary} onDiscard={handleDiscardSummary} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Wrapper observes touches to break follow on a pan; it never claims the
          gesture, so the map still handles the drag itself. */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={(e) => {
          touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        }}
        onTouchMove={(e) => {
          const s = touchStart.current;
          if (!s || !followMode) return;
          const dx = e.nativeEvent.pageX - s.x;
          const dy = e.nativeEvent.pageY - s.y;
          if (Math.hypot(dx, dy) > PAN_SLOP_PX) setFollowMode(false);
        }}
      >
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL={mapStyleFor(t.dark)}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          {mapReady && (
            <>
              {/* Route-up while we know where the route goes, course-up otherwise.
                  Not compass-up: the magnetometer tracks the handset, which is arm
                  swing while running and meaningless in a pocket. Feeding our own
                  bearing means followUserMode must be plain Follow — the built-in
                  Course mode would compute its own and ignore followHeading. Pitch
                  stays flat so the shape of the loop ahead stays readable. */}
              <Camera
                followUserLocation={followMode}
                followUserMode={
                  routeBearing === null ? UserTrackingMode.FollowWithCourse : UserTrackingMode.Follow
                }
                followHeading={routeBearing ?? undefined}
                zoomLevel={16}
                defaultSettings={{ centerCoordinate: lastMapCenter ?? FALLBACK_CENTER, zoomLevel: 15 }}
              />
              {/* Deliberately a different bearing source from the camera: with the
                  map already rotated, a course puck would be pinned to screen-up
                  and tell you nothing. On heading it shows where the handset points
                  relative to the way you are going. */}
              <LocationPuck puckBearing="heading" puckBearingEnabled />
              {/* Only the stretch still ahead is drawn. What you've covered is
                  left to the blue trace, so the loop turns blue as you run it. */}
              {plannedSplit && plannedSplit.ahead.length > 1 && (
                <ShapeSource
                  id="follow-route-ahead"
                  shape={{ type: 'LineString', coordinates: plannedSplit.ahead }}
                >
                  <LineLayer
                    id="follow-line-ahead"
                    style={{ lineColor: c.mapCandidate, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
                  />
                </ShapeSource>
              )}
              {hasTrace && (
                <ShapeSource id="follow-trace" shape={traceGeometry}>
                  <LineLayer
                    id="follow-trace-line"
                    style={{ lineColor: c.mapRoute, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
                  />
                </ShapeSource>
              )}
            </>
          )}
        </MapView>
      </View>

      {isPaused && <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.5)' }]} pointerEvents="none" />}

      {/* Top HUD: back + audio / bookmark */}
      <View style={[styles.hud, { top: TOP_INSET }]}>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
          onPress={handleBack}
          accessibilityRole="button"
        >
          <MaterialIcons name="chevron-left" size={20} color={c.text} />
          <Text style={[t.type.button, { color: c.text, textTransform: 'uppercase' }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.hudRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
            onPress={() => setSetting('audioCues', !audioCues)}
            accessibilityLabel={audioCues ? 'Mute audio cues' : 'Unmute audio cues'}
          >
            <MaterialIcons
              name={audioCues ? 'volume-up' : 'volume-off'}
              size={20}
              color={audioCues ? c.accentBright : c.textMuted}
            />
          </TouchableOpacity>
          {route && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
              onPress={() => { if (!saved && startPoint) saveFavourite(route, startPoint, distanceKm); }}
              accessibilityLabel={saved ? 'Saved' : 'Save route'}
            >
              <MaterialIcons
                name={saved ? 'bookmark' : 'bookmark-border'}
                size={20}
                color={saved ? c.accentBright : c.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {offRoute && (
        <View style={[styles.offRouteBanner, { top: TOP_INSET + 268 }]} pointerEvents="none">
          <MaterialIcons name="warning" size={16} color="#2A1B00" />
          <Text style={styles.offRouteText}>Off route</Text>
        </View>
      )}

      {/* Live metrics cockpit */}
      <View
        style={[
          styles.metricsCard,
          { top: TOP_INSET + 56, backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.lg },
          t.shadow.card,
        ]}
      >
        <BigStat
          label={isPaused ? 'Distance · Paused' : 'Distance'}
          value={liveKm.toFixed(2)}
          unit="km"
          size="hero"
        />
        <View style={[styles.rule, { backgroundColor: c.line }]} />
        <View style={styles.metricRow}>
          <BigStat label="Time" value={formatElapsed(movingSec)} size="md" style={styles.metricCol} />
          <BigStat label="Pace /km" value={formatPace(currentPace)} size="md" style={styles.metricCol} />
          <BigStat label="Avg /km" value={formatPace(avgPace)} size="md" style={styles.metricCol} />
        </View>
        {/* Whether the phone can go in a pocket, or the screen has to stay awake. */}
        <View style={styles.trackingRow}>
          <MaterialIcons
            name={backgroundTracking ? 'lock' : 'warning'}
            size={13}
            color={backgroundTracking ? c.textMuted : c.danger}
          />
          <Text style={[t.type.label, { color: backgroundTracking ? c.textMuted : c.danger }]}>
            {backgroundTracking ? 'Records with screen off' : 'Keep screen on'}
          </Text>
        </View>
      </View>

      {/* Recentre / follow toggle */}
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: c.surface, borderColor: c.line }, t.shadow.card]}
        onPress={() => setFollowMode(true)}
        accessibilityLabel="Recentre map"
      >
        <MaterialIcons
          name={followMode ? 'my-location' : 'gps-not-fixed'}
          size={22}
          color={followMode ? c.accentBright : c.textMuted}
        />
      </TouchableOpacity>

      {/* Controls: End + Pause/Resume */}
      <View style={styles.controls}>
        <Button title="End" variant="danger" onPress={handleEndRun} style={{ flex: 1 }} />
        <Button
          title={isPaused ? 'Resume' : 'Pause'}
          onPress={() => (isPaused ? resumeRun() : pauseRun())}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hud: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offRouteBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5B23E',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  offRouteText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: '#2A1B00', textTransform: 'uppercase' },
  metricsCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  rule: { height: 1 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricCol: { flex: 1 },
  trackingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  followBtn: {
    position: 'absolute',
    right: 16,
    bottom: 118,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
});

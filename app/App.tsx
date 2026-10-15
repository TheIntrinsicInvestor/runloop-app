import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import { fontAssets } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { AlertHost, showAlert } from '@/components';
import { TOP_INSET } from '@/lib/insets';
import { MAPBOX_TOKEN } from '@/config';
import { useUserLocation } from '@/location/useUserLocation';
import { RouteMap, RouteMapHandle } from '@/features/map/RouteMap';
import { PinDropOverlay } from '@/features/map/PinDropOverlay';
import { GeneratePanel } from '@/features/generate/GeneratePanel';
import { FollowView } from '@/features/follow/FollowView';
import { SavedRoutesView } from '@/features/saved/SavedRoutesView';
import { RunHistoryView } from '@/features/history/RunHistoryView';
import { RunDetailView } from '@/features/history/RunDetailView';
import { StatsDashboardView } from '@/features/stats/StatsDashboardView';
import { SettingsView } from '@/features/settings/SettingsView';
import { useRouteStore, useSelectedRoute } from '@/store/useRouteStore';
import { useFavouritesStore } from '@/store/useFavouritesStore';
import { useRunHistoryStore } from '@/store/useRunHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAchievementsStore } from '@/store/useAchievementsStore';
import { useActiveRunStore } from '@/store/useActiveRunStore';
import { stopBackgroundRunUpdates } from '@/location/backgroundRunTask';
import type { RouteCandidate, SavedRoute } from '@/routing/RouteProvider';
import type { Run } from '@/store/useRunHistoryStore';

Mapbox.setAccessToken(MAPBOX_TOKEN);

type Screen =
  | { name: 'map' }
  | { name: 'follow'; route: RouteCandidate | null } // null = free run
  | { name: 'saved' }
  | { name: 'history' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'runDetail'; run: Run };

export default function App() {
  const t = useTheme();
  const [fontsLoaded] = useFonts(fontAssets);
  const { lngLat, permissionDenied } = useUserLocation();
  const [screen, setScreen] = useState<Screen>({ name: 'map' });
  const [pinDropMode, setPinDropMode] = useState(true);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const mapRef = useRef<RouteMapHandle>(null);

  const hydrateFavourites = useFavouritesStore((s) => s.hydrate);
  const hydrateHistory = useRunHistoryStore((s) => s.hydrate);
  const hydrateProfile = useProfileStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateAchievements = useAchievementsStore((s) => s.hydrate);
  const loadSavedRoute = useRouteStore((s) => s.loadSavedRoute);

  useEffect(() => { hydrateFavourites(); }, [hydrateFavourites]);
  useEffect(() => { hydrateHistory(); }, [hydrateHistory]);
  useEffect(() => { hydrateProfile(); }, [hydrateProfile]);
  useEffect(() => { hydrateSettings(); }, [hydrateSettings]);
  useEffect(() => { hydrateAchievements(); }, [hydrateAchievements]);

  // A crash or force-quit mid-run leaves the background location task registered
  // with no run left to feed, which keeps the GPS awake indefinitely. The run state
  // is in memory only, so a cold start means it is unrecoverable anyway — clear it.
  useEffect(() => {
    if (!useActiveRunStore.getState().isTracking) stopBackgroundRunUpdates().catch(() => {});
  }, []);

  const setStartPoint = useRouteStore((s) => s.setStartPoint);
  const startPoint = useRouteStore((s) => s.startPoint);
  const reset = useRouteStore((s) => s.reset);
  const candidateRoutes = useRouteStore((s) => s.candidateRoutes);
  const selectedRouteId = useRouteStore((s) => s.selectedRouteId);
  const selectRoute = useRouteStore((s) => s.selectRoute);
  const selectedRoute = useSelectedRoute();

  useEffect(() => {
    if (lngLat && !initialCenter) setInitialCenter(lngLat);
  }, [lngLat, initialCenter]);

  useEffect(() => {
    if (permissionDenied) {
      showAlert('Location required', 'RunLoop needs your location to generate routes. Please enable it in Settings.');
    }
  }, [permissionDenied]);

  function handleLocateMe() {
    if (permissionDenied || !lngLat) {
      showAlert('Location unavailable', 'Enable location access in Settings to use this feature.');
      return;
    }
    setInitialCenter([lngLat[0], lngLat[1]]);
    mapRef.current?.flyTo([lngLat[0], lngLat[1]]);
  }

  async function handleConfirmPin() {
    const center = await mapRef.current?.getCenter();
    if (!center) return;
    setStartPoint(center);
    setPinDropMode(false);
  }

  function handleChangeStart() {
    reset();
    setStartPoint(null);
    setPinDropMode(true);
  }

  function handleFollowSaved(route: SavedRoute) {
    loadSavedRoute(route);
    // loadSavedRoute set the store synchronously — read back the selected candidate.
    const st = useRouteStore.getState();
    const candidate = st.candidateRoutes.find((r) => r.id === st.selectedRouteId) ?? null;
    setScreen({ name: 'follow', route: candidate });
  }

  // Hold the first frame until the bundled Sport font is ready, so no screen
  // flashes with the fallback face. Native splash covers this brief gap.
  if (!fontsLoaded) return null;

  function renderMap() {
    const circle = {
      position: 'absolute' as const,
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      ...t.shadow.card,
    };
    const pillBase = {
      position: 'absolute' as const,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.space(1.5),
      paddingHorizontal: t.space(3.5),
      paddingVertical: t.space(2.5),
      borderRadius: t.radius.pill,
      ...t.shadow.card,
    };
    return (
      <View style={styles.container}>
        <RouteMap
          ref={mapRef}
          center={initialCenter}
          startPoint={startPoint}
          routes={candidateRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={selectRoute}
        />
        {pinDropMode ? (
          <>
            <PinDropOverlay onConfirm={handleConfirmPin} disabled={!initialCenter} />
            <TouchableOpacity
              style={[circle, { bottom: 200, right: 16 }]}
              onPress={handleLocateMe}
              accessibilityRole="button"
              accessibilityLabel="Centre on my location"
            >
              <MaterialIcons name="my-location" size={22} color={t.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[pillBase, { top: TOP_INSET, left: 16, backgroundColor: t.colors.accent }, t.shadow.glow]}
              onPress={() => setScreen({ name: 'follow', route: null })}
              accessibilityRole="button"
            >
              <MaterialIcons name="directions-run" size={18} color={t.colors.accentOn} />
              <Text style={[t.type.button, { color: t.colors.accentOn, textTransform: 'uppercase' }]}>
                Just run
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <GeneratePanel
              onFollow={() => {
                if (selectedRoute) setScreen({ name: 'follow', route: selectedRoute });
              }}
            />
            <TouchableOpacity
              style={[pillBase, { top: TOP_INSET, left: 16, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.line }]}
              onPress={handleChangeStart}
              accessibilityRole="button"
            >
              <MaterialIcons name="place" size={18} color={t.colors.accentBright} />
              <Text style={[t.type.button, { color: t.colors.text, textTransform: 'uppercase' }]}>
                Change start
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[circle, { top: TOP_INSET, right: 16 }]}
          onPress={() => setScreen({ name: 'saved' })}
          accessibilityRole="button"
          accessibilityLabel="Saved routes"
        >
          <MaterialIcons name="bookmark-border" size={22} color={t.colors.accentBright} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[circle, { top: TOP_INSET, right: 74 }]}
          onPress={() => setScreen({ name: 'history' })}
          accessibilityRole="button"
          accessibilityLabel="Run history"
        >
          <MaterialIcons name="history" size={22} color={t.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[circle, { top: TOP_INSET, right: 132 }]}
          onPress={() => setScreen({ name: 'settings' })}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <MaterialIcons name="settings" size={22} color={t.colors.text} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderScreen() {
    switch (screen.name) {
      case 'runDetail':
        return <RunDetailView run={screen.run} onBack={() => setScreen({ name: 'history' })} />;
      case 'follow':
        return <FollowView route={screen.route} onBack={() => setScreen({ name: 'map' })} />;
      case 'saved':
        return <SavedRoutesView onBack={() => setScreen({ name: 'map' })} onFollow={handleFollowSaved} />;
      case 'history':
        return (
          <RunHistoryView
            onBack={() => setScreen({ name: 'map' })}
            onSelect={(run) => setScreen({ name: 'runDetail', run })}
            onOpenStats={() => setScreen({ name: 'stats' })}
          />
        );
      case 'stats':
        return <StatsDashboardView onBack={() => setScreen({ name: 'history' })} />;
      case 'settings':
        return <SettingsView onBack={() => setScreen({ name: 'map' })} />;
      case 'map':
      default:
        return renderMap();
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {renderScreen()}
      <AlertHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useRouteStore } from '@/store/useRouteStore';
import { useFavouritesStore } from '@/store/useFavouritesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Surface } from '@/routing/RouteProvider';
import { formatKm } from '@/lib/geo';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/components';

const MIN_KM = 1;
const MAX_KM = 21;

const NEXT_SURFACE: Record<Surface, Surface> = { any: 'paved', paved: 'trail', trail: 'any' };
const SURFACE_LABEL: Record<Surface, string> = { any: 'Any surface', paved: 'Paved', trail: 'Trail' };

interface Props {
  onFollow(): void;
}

export function GeneratePanel({ onFollow }: Props) {
  const t = useTheme();
  const distanceKm = useRouteStore((s) => s.distanceKm);
  const setDistanceKm = useRouteStore((s) => s.setDistanceKm);
  const status = useRouteStore((s) => s.status);
  const candidateRoutes = useRouteStore((s) => s.candidateRoutes);
  const selectedRouteId = useRouteStore((s) => s.selectedRouteId);
  const partial = useRouteStore((s) => s.partial);
  const error = useRouteStore((s) => s.error);
  const generate = useRouteStore((s) => s.generate);
  const selectRoute = useRouteStore((s) => s.selectRoute);
  const startPoint = useRouteStore((s) => s.startPoint);

  const savedIds = useFavouritesStore(useShallow((s) => s.routes.map((r) => r.id)));
  const saveFavourite = useFavouritesStore((s) => s.save);

  const routePrefs = useSettingsStore((s) => s.routePrefs);
  const setSetting = useSettingsStore((s) => s.set);

  const generating = status === 'generating';
  const c = t.colors;

  const prefChipStyle = (active: boolean) => [
    styles.prefChip,
    {
      backgroundColor: active ? c.accent : c.surfaceRaised,
      borderColor: active ? 'transparent' : c.line,
      borderRadius: t.radius.pill,
    },
  ];

  const stepStyle = {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.line,
  };

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.lg },
        t.shadow.card,
      ]}
    >
      {/* Distance picker */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[stepStyle, distanceKm <= MIN_KM && { opacity: 0.4 }]}
          onPress={() => setDistanceKm(Math.max(MIN_KM, distanceKm - 1))}
          disabled={distanceKm <= MIN_KM}
          accessibilityLabel="Decrease distance"
        >
          <MaterialIcons name="remove" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={styles.distValue}>
          <Text style={[t.type.statLg, { color: c.text, fontSize: 34, lineHeight: 36 }]}>
            {distanceKm}
          </Text>
          <Text style={[t.type.label, { color: c.textMuted, marginLeft: 4, marginBottom: 4 }]}>km</Text>
        </View>
        <TouchableOpacity
          style={[stepStyle, distanceKm >= MAX_KM && { opacity: 0.4 }]}
          onPress={() => setDistanceKm(Math.min(MAX_KM, distanceKm + 1))}
          disabled={distanceKm >= MAX_KM}
          accessibilityLabel="Increase distance"
        >
          <MaterialIcons name="add" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      {/* Route preferences */}
      <View style={styles.prefsRow}>
        <TouchableOpacity
          onPress={() => setSetting('routePrefs', { ...routePrefs, avoidHills: !routePrefs.avoidHills })}
          style={prefChipStyle(routePrefs.avoidHills)}
          accessibilityLabel="Toggle avoid hills"
        >
          <MaterialIcons name="terrain" size={16} color={routePrefs.avoidHills ? c.accentOn : c.textMuted} />
          <Text style={[t.type.label, { color: routePrefs.avoidHills ? c.accentOn : c.textMuted, marginLeft: 4 }]}>
            Avoid hills
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSetting('routePrefs', { ...routePrefs, surface: NEXT_SURFACE[routePrefs.surface] })}
          style={prefChipStyle(routePrefs.surface !== 'any')}
          accessibilityLabel="Cycle surface preference"
        >
          <MaterialIcons name="grass" size={16} color={routePrefs.surface !== 'any' ? c.accentOn : c.textMuted} />
          <Text style={[t.type.label, { color: routePrefs.surface !== 'any' ? c.accentOn : c.textMuted, marginLeft: 4 }]}>
            {SURFACE_LABEL[routePrefs.surface]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Generate */}
      <Button
        title="Generate routes"
        onPress={generate}
        disabled={!startPoint}
        loading={generating}
      />

      {/* Error */}
      {status === 'error' && error ? (
        <Text style={[t.type.body, { color: c.danger, textAlign: 'center' }]}>{error}</Text>
      ) : null}

      {/* Route chips */}
      {candidateRoutes.length > 0 && (
        <>
          {partial ? (
            <Text style={[t.type.label, { color: c.textMuted }]}>Closest found</Text>
          ) : null}
          <View style={styles.chipsRow}>
            {candidateRoutes.map((r) => {
              const selected = r.id === selectedRouteId;
              const isSaved = savedIds.includes(r.id);
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => selectRoute(r.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? c.accent : c.surfaceRaised,
                      borderColor: selected ? 'transparent' : c.line,
                      borderRadius: t.radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      t.type.statMd,
                      { fontSize: 18, lineHeight: 20, color: selected ? c.accentOn : c.text },
                    ]}
                  >
                    {formatKm(r.actualKm)}
                  </Text>
                  <Text
                    style={[
                      t.type.label,
                      { color: selected ? c.accentOn : c.textMuted, marginTop: 2, letterSpacing: 0.8 },
                    ]}
                  >
                    {Math.round(r.overlapPct)}% repeat · {Math.round(r.ascentM)}m gain
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isSaved && startPoint) saveFavourite(r, startPoint, distanceKm);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.bookmark}
                    accessibilityLabel={isSaved ? 'Saved' : 'Save route'}
                  >
                    <MaterialIcons
                      name={isSaved ? 'bookmark' : 'bookmark-border'}
                      size={18}
                      color={selected ? c.accentOn : isSaved ? c.accentBright : c.textMuted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedRouteId ? (
            <Button title="Follow this route" onPress={onFollow} />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  distValue: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: 78,
    justifyContent: 'center',
  },
  prefsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'stretch',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingRight: 34,
    borderWidth: 1,
    position: 'relative',
  },
  bookmark: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});

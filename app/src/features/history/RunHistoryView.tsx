import React, { useMemo } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRunHistoryStore } from '@/store/useRunHistoryStore';
import type { Run } from '@/store/useRunHistoryStore';
import { formatDuration, formatRunDate } from '@/lib/format';
import { defaultRunName, formatPace } from '@/lib/runMetrics';
import { useTheme } from '@/theme/useTheme';
import { ScreenHeader, BigStat } from '@/components';

interface Props {
  onBack(): void;
  onSelect(run: Run): void;
  onOpenStats(): void;
}

export function RunHistoryView({ onBack, onSelect, onOpenStats }: Props) {
  const t = useTheme();
  const c = t.colors;
  const runs = useRunHistoryStore((s) => s.runs);
  const totalKm = useMemo(() => runs.reduce((sum, r) => sum + r.actualKm, 0), [runs]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Run history" onBack={onBack} />

      {runs.length > 0 && (
        <TouchableOpacity
          style={[styles.totalsRow, { borderBottomColor: c.line }]}
          onPress={onOpenStats}
          accessibilityRole="button"
        >
          <BigStat label="Lifetime" value={totalKm.toFixed(0)} unit="km" size="md" style={styles.totalCell} />
          <BigStat label="Runs" value={String(runs.length)} size="md" style={styles.totalCell} />
          <View style={styles.statsLink}>
            <Text style={[t.type.button, { color: c.accentBright, textTransform: 'uppercase', fontSize: 13 }]}>
              Stats
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={c.accentBright} />
          </View>
        </TouchableOpacity>
      )}

      {runs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="history" size={40} color={c.textDim} />
          <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center' }]}>
            No runs yet. Complete a route to see your history here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => {
            const pace = item.actualKm > 0.05 ? item.durationSec / item.actualKm : null;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: c.line }]}
                onPress={() => onSelect(item)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[t.type.h2, { color: c.text }]} numberOfLines={1}>
                    {item.name ?? defaultRunName(item.startedAt)}
                  </Text>
                  <Text style={[t.type.label, { color: c.textMuted }]}>
                    {formatRunDate(item.startedAt)}
                  </Text>
                  <View style={styles.stats}>
                    <Text style={[t.type.statMd, { fontSize: 20, lineHeight: 22, color: c.text }]}>
                      {item.plannedKm > 0
                        ? `${item.plannedKm.toFixed(1)}→${item.actualKm.toFixed(1)} km`
                        : `${item.actualKm.toFixed(2)} km`}
                    </Text>
                    <Text style={[t.type.body, { color: c.textMuted }]}>
                      {formatDuration(item.durationSec)} · {formatPace(pace)}/km
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={c.textDim} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  totalCell: { flex: 1 },
  statsLink: { flexDirection: 'row', alignItems: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2,
  },
});

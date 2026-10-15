import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRunHistoryStore } from '@/store/useRunHistoryStore';
import { weeklyAggregates, computeRecords, currentStreaks, evaluateAchievements } from '@/lib/stats';
import { formatClock } from '@/lib/format';
import { formatPace } from '@/lib/runMetrics';
import { useTheme } from '@/theme/useTheme';
import type { Theme } from '@/theme';
import { ScreenHeader, Card, BigStat, BarChart } from '@/components';

interface Props {
  onBack(): void;
}

const WEEKS_SHOWN = 8;

function weekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function StatsDashboardView({ onBack }: Props) {
  const t = useTheme();
  const c = t.colors;
  const runs = useRunHistoryStore((s) => s.runs);

  const totalKm = useMemo(() => runs.reduce((sum, r) => sum + r.actualKm, 0), [runs]);
  const weeks = useMemo(() => weeklyAggregates(runs, WEEKS_SHOWN), [runs]);
  const records = useMemo(() => computeRecords(runs), [runs]);
  const { runDays } = useMemo(() => currentStreaks(runs), [runs]);
  const achievements = useMemo(() => evaluateAchievements(runs, records), [runs, records]);

  const chartData = weeks.map((w) => ({ label: weekLabel(w.weekStartISO), value: w.km }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Stats" onBack={onBack} />
      {runs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="bar-chart" size={40} color={c.textDim} />
          <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center' }]}>
            Complete a run to start building your stats.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.totalsRow}>
            <BigStat label="Lifetime" value={totalKm.toFixed(0)} unit="km" size="lg" style={styles.totalCell} />
            <BigStat label="Runs" value={String(runs.length)} size="lg" style={styles.totalCell} />
            <BigStat
              label="Day streak"
              value={String(runDays)}
              size="lg"
              accent={runDays > 0}
              style={styles.totalCell}
            />
          </View>

          <Card style={styles.card}>
            <Text style={[t.type.label, { color: c.textMuted, marginBottom: 12 }]}>
              Last {WEEKS_SHOWN} weeks
            </Text>
            <BarChart data={chartData} valueFormat={(v) => v.toFixed(1)} />
          </Card>

          <Card style={styles.card}>
            <Text style={[t.type.label, { color: c.textMuted, marginBottom: 4 }]}>Records</Text>
            <View style={styles.recordsGrid}>
              <RecordCell
                t={t}
                label="Fastest 1K"
                value={records.fastest1kSec != null ? formatPace(records.fastest1kSec) : '—'}
              />
              <RecordCell
                t={t}
                label="Fastest 5K"
                value={records.fastest5kSec != null ? formatClock(Math.round(records.fastest5kSec)) : '—'}
              />
              <RecordCell
                t={t}
                label="Longest Run"
                value={records.longestRunKm != null ? `${records.longestRunKm.toFixed(1)} km` : '—'}
              />
              <RecordCell
                t={t}
                label="Biggest Week"
                value={records.biggestWeekKm != null ? `${records.biggestWeekKm.toFixed(1)} km` : '—'}
              />
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={[t.type.label, { color: c.textMuted, marginBottom: 4 }]}>
              Achievements ({achievements.length})
            </Text>
            {achievements.map((a) => (
              <View key={a.id} style={[styles.achievementRow, { borderTopColor: c.line }]}>
                <MaterialIcons name="emoji-events" size={18} color={c.accentBright} />
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.bodyStrong, { color: c.text }]}>{a.title}</Text>
                  <Text style={[t.type.body, { color: c.textMuted, fontSize: 12 }]}>{a.desc}</Text>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RecordCell({ t, label, value }: { t: Theme; label: string; value: string }) {
  return (
    <View style={styles.recordCell}>
      <BigStat label={label} value={value} size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  scroll: { padding: 16, gap: 16 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalCell: { flex: 1 },
  card: { marginBottom: 16 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  recordCell: { width: '50%', paddingVertical: 8 },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
});

import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSettingsStore, type ThemeMode } from '@/store/useSettingsStore';
import { useTheme } from '@/theme/useTheme';
import { Card, ScreenHeader } from '@/components';

interface Props {
  onBack(): void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { mode: 'system', label: 'System', icon: 'phone-iphone' },
  { mode: 'light', label: 'Day', icon: 'wb-sunny' },
  { mode: 'dark', label: 'Night', icon: 'nightlight-round' },
];

export function SettingsView({ onBack }: Props) {
  const t = useTheme();
  const c = t.colors;
  const themeMode = useSettingsStore((s) => s.themeMode);
  const audioCues = useSettingsStore((s) => s.audioCues);
  const setSetting = useSettingsStore((s) => s.set);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[t.type.label, { color: c.textMuted }]}>Appearance</Text>
        <Card padded={false} style={styles.card}>
          <View style={styles.segment}>
            {THEME_OPTIONS.map(({ mode, label, icon }) => {
              const active = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setSetting('themeMode', mode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label} theme`}
                  style={[
                    styles.segmentItem,
                    {
                      backgroundColor: active ? c.accent : 'transparent',
                      borderRadius: t.radius.md,
                    },
                  ]}
                >
                  <MaterialIcons name={icon} size={18} color={active ? c.accentOn : c.textMuted} />
                  <Text style={[t.type.label, { color: active ? c.accentOn : c.textMuted }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
        <Text style={[t.type.body, { color: c.textDim }]}>
          Day uses the Streets map so parks and trails stay distinct. Night uses the dark map.
        </Text>

        <Text style={[t.type.label, { color: c.textMuted, marginTop: t.space(4) }]}>During a run</Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[t.type.bodyStrong, { color: c.text }]}>Audio cues</Text>
              <Text style={[t.type.body, { color: c.textMuted }]}>Spoken split announcements.</Text>
            </View>
            <Switch
              value={audioCues}
              onValueChange={(v) => setSetting('audioCues', v)}
              trackColor={{ false: c.line, true: c.accent }}
              thumbColor={c.accentOn}
              accessibilityLabel="Toggle audio cues"
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 8 },
  card: { marginBottom: 4 },
  segment: { flexDirection: 'row', padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
});

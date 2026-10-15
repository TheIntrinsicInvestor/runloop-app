import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export interface BarChartDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarChartDatum[];
  height?: number;
  valueFormat?(value: number): string;
  style?: StyleProp<ViewStyle>;
}

/** Minimal View-based bar chart — no chart deps. Bars scale to the tallest value in the set. */
export function BarChart({ data, height = 120, valueFormat, style }: Props) {
  const t = useTheme();
  const c = t.colors;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barAreaHeight = height - 32; // leaves room for the value + label rows

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', height, gap: t.space(2) }, style]}>
      {data.map((d, i) => {
        const barHeight = d.value > 0 ? Math.max(3, (d.value / max) * barAreaHeight) : 2;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={[t.type.label, { color: c.textDim, fontSize: 9, marginBottom: 4, height: 12 }]}
              numberOfLines={1}
            >
              {d.value > 0 && valueFormat ? valueFormat(d.value) : ''}
            </Text>
            <View
              style={{
                width: '100%',
                height: barHeight,
                borderRadius: t.radius.sm,
                backgroundColor: d.value > 0 ? c.accent : c.line,
              }}
            />
            <Text
              style={[t.type.label, { color: c.textMuted, fontSize: 9, marginTop: 6 }]}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

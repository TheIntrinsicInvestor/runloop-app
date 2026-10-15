import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type Size = 'hero' | 'lg' | 'md';

interface Props {
  value: string;
  unit?: string;
  label?: string;
  size?: Size;
  /** Tint the value with the bright accent (e.g. a highlighted metric). */
  accent?: boolean;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

/** The core stat display: uppercase label over a sport-italic numeral + unit. */
export function BigStat({
  value,
  unit,
  label,
  size = 'lg',
  accent,
  align = 'left',
  style,
}: Props) {
  const t = useTheme();
  const valueStyle =
    size === 'hero' ? t.type.hero : size === 'lg' ? t.type.statLg : t.type.statMd;
  const unitSize = size === 'hero' ? 18 : size === 'lg' ? 13 : 12;

  return (
    <View style={[{ alignItems: align === 'center' ? 'center' : 'flex-start' }, style]}>
      {label ? (
        <Text style={[t.type.label, { color: t.colors.textMuted, marginBottom: t.space(1) }]}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[valueStyle, { color: accent ? t.colors.accentBright : t.colors.text }]}>
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              t.type.label,
              {
                color: t.colors.textMuted,
                fontSize: unitSize,
                lineHeight: unitSize + 3, // own line box — label's 13px clips larger units
                letterSpacing: 0.4,
                marginLeft: t.space(1.5),
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

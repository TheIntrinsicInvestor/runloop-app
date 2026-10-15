import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface Props {
  label: string;
  tone?: 'default' | 'accent';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Compact metadata pill — route tags like "4% repeat", "loop", distance chips. */
export function StatPill({ label, tone = 'default', icon, style }: Props) {
  const t = useTheme();
  const isAccent = tone === 'accent';
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space(1.5),
          paddingVertical: t.space(1.5),
          paddingHorizontal: t.space(2.5),
          borderRadius: t.radius.pill,
          backgroundColor: isAccent ? t.colors.accent : t.colors.surface,
          borderWidth: 1,
          borderColor: isAccent ? 'transparent' : t.colors.line,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          t.type.label,
          { color: isAccent ? t.colors.accentOn : t.colors.textMuted, letterSpacing: 0.8 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface Props {
  children: React.ReactNode;
  raised?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Mixed-shape surface: rounded corners, hairline border. The calm base for content. */
export function Card({ children, raised, padded = true, style }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? t.colors.surfaceRaised : t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.line,
          padding: padded ? t.space(4) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

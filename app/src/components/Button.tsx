import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress(): void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Primary action button. Mixed shape (rounded), sport-italic label, accent glow on primary. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: Props) {
  const t = useTheme();
  const c = t.colors;

  const bg =
    variant === 'primary' ? c.accent : variant === 'ghost' ? 'transparent' : c.surface;
  const fg =
    variant === 'primary'
      ? c.accentOn
      : variant === 'danger'
        ? c.danger
        : c.text;
  const border = variant === 'secondary' || variant === 'danger' ? c.line : 'transparent';

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.space(2),
          paddingVertical: t.space(3.5),
          paddingHorizontal: t.space(5),
          borderRadius: t.radius.md,
          backgroundColor: bg,
          borderWidth: border === 'transparent' ? 0 : 1,
          borderColor: border,
          opacity: disabled ? 0.5 : 1,
        },
        variant === 'primary' && t.shadow.glow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text style={[t.type.button, { color: fg, textTransform: 'uppercase' }]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

import React from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';

interface Props {
  title: string;
  onBack?(): void;
  /** Optional trailing control (share, settings, etc.). */
  right?: React.ReactNode;
  /** Show the hairline rule under the header (Mixed-shape technical detail). */
  rule?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Screen title row with optional back and trailing action. Wrap screens in a
 *  SafeAreaView (RN core) — this component owns horizontal layout only. */
export function ScreenHeader({ title, onBack, right, rule = true, style }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space(2),
          paddingHorizontal: t.space(4),
          paddingVertical: t.space(3),
          borderBottomWidth: rule ? 1 : 0,
          borderBottomColor: t.colors.line,
        },
        style,
      ]}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: t.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <MaterialIcons name="chevron-left" size={24} color={t.colors.text} />
        </TouchableOpacity>
      ) : null}
      <Text
        numberOfLines={1}
        style={[t.type.h1, { color: t.colors.text, flex: 1 }]}
      >
        {title}
      </Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/components';

const PIN_HEAD = 26;
const PIN_STEM = 20;

interface Props {
  onConfirm(): void;
  disabled?: boolean;
}

export function PinDropOverlay({ onConfirm, disabled }: Props) {
  const t = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[
          styles.pinWrapper,
          { transform: [{ translateX: -(PIN_HEAD / 2) }, { translateY: -(PIN_HEAD + PIN_STEM) }] },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.pinHead,
            { backgroundColor: t.colors.accent, borderColor: t.colors.bg },
            t.shadow.glow,
          ]}
        />
        <View style={[styles.pinStem, { backgroundColor: t.colors.accent }]} />
      </View>
      <View
        style={[
          styles.bottom,
          { backgroundColor: t.colors.surface, borderColor: t.colors.line, borderRadius: t.radius.lg },
        ]}
      >
        <Text style={[t.type.body, { color: t.colors.textMuted, textAlign: 'center' }]}>
          Move the map to set your start point
        </Text>
        <Button title="Confirm start here" onPress={onConfirm} disabled={disabled} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    borderWidth: 3,
  },
  pinStem: {
    width: 3,
    height: PIN_STEM,
  },
  bottom: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
});

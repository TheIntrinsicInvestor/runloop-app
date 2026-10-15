import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import type { Achievement } from '@/lib/stats';

interface Props {
  visible: boolean;
  achievements: Achievement[];
  onDismiss(): void;
}

/** Post-save celebration for newly earned PRs/achievements — same themed-modal shell as RenameModal. */
export function CelebrationModal({ visible, achievements, onDismiss }: Props) {
  const t = useTheme();
  const c = t.colors;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.surface,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: t.radius.lg,
            padding: t.space(5),
            gap: t.space(4),
            ...t.shadow.glow,
          }}
        >
          <View style={{ alignItems: 'center', gap: t.space(2) }}>
            <MaterialIcons name="emoji-events" size={40} color={c.accentBright} />
            <Text style={[t.type.h1, { color: c.text }]}>
              {achievements.length > 1 ? 'New Achievements' : 'New Achievement'}
            </Text>
          </View>
          <View style={{ gap: t.space(3) }}>
            {achievements.map((a) => (
              <View key={a.id} style={{ alignItems: 'center' }}>
                <Text style={[t.type.h2, { color: c.accentBright }]}>{a.title}</Text>
                <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center' }]}>{a.desc}</Text>
              </View>
            ))}
          </View>
          <Button title="Nice" onPress={onDismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

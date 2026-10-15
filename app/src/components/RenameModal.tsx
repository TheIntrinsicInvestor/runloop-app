import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title?: string;
  initialValue: string;
  placeholder?: string;
  onSubmit(name: string): void;
  onCancel(): void;
}

/** Themed inline rename dialog — cross-platform replacement for the iOS-only Alert.prompt. */
export function RenameModal({
  visible,
  title = 'Rename',
  initialValue,
  placeholder = 'Name',
  onSubmit,
  onCancel,
}: Props) {
  const t = useTheme();
  const c = t.colors;
  const [text, setText] = useState(initialValue);

  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 28,
        }}
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
            ...t.shadow.card,
          }}
        >
          <Text style={[t.type.h2, { color: c.text }]}>{title}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={c.textDim}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            maxLength={60}
            onSubmitEditing={() => text.trim() && onSubmit(text.trim())}
            style={{
              color: c.text,
              fontSize: 17,
              backgroundColor: c.surfaceRaised,
              borderColor: c.line,
              borderWidth: 1,
              borderRadius: t.radius.md,
              paddingHorizontal: t.space(3.5),
              paddingVertical: t.space(3),
            }}
          />
          <View style={{ flexDirection: 'row', gap: t.space(3) }}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title="Save"
              onPress={() => onSubmit(text.trim())}
              disabled={!text.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

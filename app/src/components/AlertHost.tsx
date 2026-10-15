import React from 'react';
import { Modal, Text, View } from 'react-native';
import { create } from 'zustand';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertStore extends AlertState {
  show(cfg: Omit<AlertState, 'visible'>): void;
  hide(): void;
}

const useAlertStore = create<AlertStore>((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [],
  show: (cfg) => set({ visible: true, ...cfg }),
  hide: () => set({ visible: false }),
}));

/**
 * Themed, in-app replacement for Alert.alert — same call signature so swaps are
 * mechanical. Callable from anywhere (handlers, non-component code). Render a
 * single <AlertHost /> near the app root. The OS permission prompt is separate
 * and cannot be themed; keep using the native APIs for that.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  useAlertStore.getState().show({
    title,
    message,
    buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
  });
}

export function AlertHost() {
  const t = useTheme();
  const c = t.colors;
  const { visible, title, message, buttons, hide } = useAlertStore();
  const stacked = buttons.length > 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 }}>
        <View
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
          {message ? <Text style={[t.type.body, { color: c.textMuted }]}>{message}</Text> : null}
          <View style={{ flexDirection: stacked ? 'column' : 'row', gap: t.space(3) }}>
            {buttons.map((b, i) => (
              <Button
                key={`${b.text}-${i}`}
                title={b.text}
                variant={
                  b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : 'primary'
                }
                onPress={() => {
                  hide();
                  b.onPress?.();
                }}
                style={stacked ? undefined : { flex: 1 }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

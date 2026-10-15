import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { SavedRoute } from '@/routing/RouteProvider';
import { useFavouritesStore } from '@/store/useFavouritesStore';
import { useTheme } from '@/theme/useTheme';
import { RenameModal, StatPill, showAlert } from '@/components';

interface Props {
  route: SavedRoute;
  onFollow(route: SavedRoute): void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
}

function autoLabel(route: SavedRoute): string {
  return `${route.actualKm.toFixed(1)} km · ${formatDate(route.savedAt)}`;
}

export function SavedRouteCard({ route, onFollow }: Props) {
  const t = useTheme();
  const c = t.colors;
  const remove = useFavouritesStore((s) => s.remove);
  const rename = useFavouritesStore((s) => s.rename);
  const [renaming, setRenaming] = useState(false);

  const displayName = route.name ?? autoLabel(route);

  function handleDelete() {
    showAlert('Delete route?', displayName, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(route.id) },
    ]);
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.line, borderRadius: t.radius.md },
      ]}
    >
      <TouchableOpacity style={styles.labelArea} onPress={() => setRenaming(true)}>
        <Text style={[t.type.h2, { color: c.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.pills}>
          <StatPill label={`${route.actualKm.toFixed(1)} km`} />
          <StatPill label={`${Math.round(route.overlapPct)}% repeat`} />
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.followBtn, { backgroundColor: c.accent }, t.shadow.glow]}
          onPress={() => onFollow(route)}
          accessibilityLabel="Follow route"
        >
          <MaterialIcons name="play-arrow" size={22} color={c.accentOn} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: c.line }]}
          onPress={handleDelete}
          accessibilityLabel="Delete route"
        >
          <MaterialIcons name="delete-outline" size={20} color={c.danger} />
        </TouchableOpacity>
      </View>

      <RenameModal
        visible={renaming}
        title="Rename route"
        initialValue={displayName}
        placeholder="Route name"
        onCancel={() => setRenaming(false)}
        onSubmit={(name) => {
          if (name) rename(route.id, name);
          setRenaming(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelArea: { flex: 1, marginRight: 12, gap: 8 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  followBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

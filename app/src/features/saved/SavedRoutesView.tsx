import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFavouritesStore } from '@/store/useFavouritesStore';
import { SavedRouteCard } from './SavedRouteCard';
import type { SavedRoute } from '@/routing/RouteProvider';
import { useTheme } from '@/theme/useTheme';
import { ScreenHeader } from '@/components';

interface Props {
  onBack(): void;
  onFollow(route: SavedRoute): void;
}

export function SavedRoutesView({ onBack, onFollow }: Props) {
  const t = useTheme();
  const c = t.colors;
  const routes = useFavouritesStore((s) => s.routes);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Saved routes" onBack={onBack} />

      {routes.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="bookmark-border" size={40} color={c.textDim} />
          <Text style={[t.type.h2, { color: c.text }]}>No saved routes yet</Text>
          <Text style={[t.type.body, { color: c.textMuted, textAlign: 'center' }]}>
            Tap the bookmark next to any generated route to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <SavedRouteCard route={item} onFollow={onFollow} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
});

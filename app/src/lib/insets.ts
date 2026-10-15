import { Platform, StatusBar } from 'react-native';

/**
 * Approximate safe-area top inset without react-native-safe-area-context (a native
 * dependency Phase 3 deliberately avoids). Good enough for floating controls over
 * the map; if we ever add safe-area-context, replace call sites with useSafeAreaInsets.
 */
export const TOP_INSET = Platform.select({
  ios: 59,
  android: (StatusBar.currentHeight ?? 24) + 8,
  default: 24,
}) as number;

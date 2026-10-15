import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { toLngLat } from '@/lib/geo';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useUserLocation() {
  const [lngLat, setLngLat] = useState<[number, number] | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const initial = await Location.getCurrentPositionAsync({});
      const first = toLngLat(initial.coords.latitude, initial.coords.longitude);
      setLngLat(first);
      // Once per launch, not per watch update: this only needs to be roughly right so
      // the next cold start opens on the right continent.
      void useSettingsStore.getState().set('lastMapCenter', first);

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => setLngLat(toLngLat(loc.coords.latitude, loc.coords.longitude)),
      );
    })();

    return () => { sub?.remove(); };
  }, []);

  return { lngLat, permissionDenied };
}

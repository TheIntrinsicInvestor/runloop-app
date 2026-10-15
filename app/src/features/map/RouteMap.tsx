import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, CircleLayer, LineLayer, LocationPuck, MapView, ShapeSource } from '@rnmapbox/maps';
import type { RouteCandidate } from '@/routing/RouteProvider';
import { useTheme } from '@/theme/useTheme';
import { mapStyleFor, FALLBACK_CENTER } from '@/lib/map';
import { useSettingsStore } from '@/store/useSettingsStore';

export interface RouteMapHandle {
  getCenter(): Promise<[number, number] | null>;
  flyTo(coord: [number, number]): void;
}

interface Props {
  center: [number, number] | null;
  startPoint: [number, number] | null;
  routes: RouteCandidate[];
  selectedRouteId: string | null;
  onSelectRoute(id: string): void;
}

export const RouteMap = forwardRef<RouteMapHandle, Props>(
  ({ center, startPoint, routes, selectedRouteId, onSelectRoute }, ref) => {
    const t = useTheme();
    const lastCenter = useSettingsStore((s) => s.lastMapCenter);
    const mapRef = useRef<MapView>(null);
    const cameraRef = useRef<Camera>(null);
    const [mapReady, setMapReady] = useState(false);
    const didIntro = useRef(false);

    useImperativeHandle(ref, () => ({
      async getCenter() {
        const pos = await mapRef.current?.getCenter();
        return pos ? [pos[0], pos[1]] : null;
      },
      flyTo(coord) {
        cameraRef.current?.setCamera({
          centerCoordinate: coord,
          zoomLevel: 15,
          animationMode: 'easeTo',
          animationDuration: 700,
        });
      },
    }));

    // Gentle zoom-in over the location once, instead of flying in from the map's
    // default (US) view. The camera opens at the remembered centre (see defaultSettings)
    // then eases to the real centre.
    useEffect(() => {
      if (!mapReady || !center || didIntro.current) return;
      didIntro.current = true;
      cameraRef.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: 14,
        animationMode: 'easeTo',
        animationDuration: 1100,
      });
    }, [mapReady, center]);

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        styleURL={mapStyleFor(t.dark)}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        {mapReady && (
          <>
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: center ?? lastCenter ?? FALLBACK_CENTER,
                zoomLevel: center ? 12.5 : 11,
              }}
            />
            <LocationPuck puckBearing="heading" puckBearingEnabled />
            {startPoint && (
              <ShapeSource
                id="start-pin"
                shape={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: startPoint } }}
              >
                <CircleLayer
                  id="start-pin-circle"
                  style={{
                    circleRadius: 7,
                    circleColor: t.colors.accent,
                    circleStrokeWidth: 3,
                    circleStrokeColor: '#FFFFFF',
                    circlePitchAlignment: 'map',
                  }}
                />
              </ShapeSource>
            )}
          </>
        )}
        {mapReady && routes.map((r) => {
          const selected = r.id === selectedRouteId;
          return (
            <ShapeSource
              key={r.id}
              id={`src-${r.id}`}
              shape={r.geometry}
              onPress={() => onSelectRoute(r.id)}
            >
              <LineLayer
                id={`line-${r.id}`}
                style={{
                  lineColor: selected ? t.colors.mapRoute : t.colors.mapCandidate,
                  lineWidth: selected ? 6 : 2.5,
                  lineOpacity: selected ? 1 : 0.65,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          );
        })}
      </MapView>
    );
  }
);

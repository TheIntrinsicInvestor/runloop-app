import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RunLoop',
  slug: 'runloop',
  scheme: 'runloop',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.brian.runloop',
    infoPlist: {
      // Only exempt encryption (HTTPS) — skips the TestFlight compliance questionnaire.
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'RunLoop uses your location to centre the map and generate routes from where you are.',
      // 'location' is also appended by the expo-location plugin below (idempotent);
      // 'audio' is ours — without it split announcements go silent once locked.
      UIBackgroundModes: ['location', 'audio'],
    },
  },
  plugins: [
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.20.1',
        // Build-time secret (DOWNLOADS:READ) to fetch the native Mapbox SDK.
        // Read from .env as MAPBOX_DOWNLOAD_TOKEN (no EXPO_PUBLIC_ prefix -> not bundled).
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'RunLoop uses your location to generate routes from where you are.',
        locationAlwaysAndWhenInUsePermission:
          'RunLoop records your run while your phone is locked or in your pocket, so the trace has no gaps.',
        isIosBackgroundLocationEnabled: true,
      },
    ],
    'expo-sharing',
    [
      // Generates the RunLoopWidgets extension target at prebuild. This MUST come from a
      // plugin: ios/ is gitignored and every workflow runs `prebuild --clean`, so a target
      // added by hand in Xcode is destroyed on the next build.
      // Also sets NSSupportsLiveActivities / ...FrequentUpdates on the app's Info.plist.
      'react-native-widget-extension',
      {
        widgetsFolder: 'widgets',
        deploymentTarget: '16.2', // ActivityKit minimum
        frequentUpdates: true,
      },
    ],
  ],
});

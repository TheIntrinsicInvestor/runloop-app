# RunLoop

RunLoop is an iOS app that plans running loops. You pick a distance and a start point, and it gives you up to three routes that start and finish in the same place and repeat as little of themselves as possible. Then it follows you around the loop, tracks the run and keeps your history on the phone.

It currently works in two regions: Singapore and the San Francisco Bay Area.

## Personal project, not distributed

This is a personal project. It is not on the App Store and is not publicly distributed, and there is no public build to download. The route service the app talks to is hosted privately and requires an API key, so a build made from this repository will not work against it.

If you want to run your own copy, you need your own GraphHopper instance, your own deployment of the route service in `service/`, a Mapbox account and token, and an Apple developer account to sign and install the app. See [Running your own copy](#running-your-own-copy).

## What it does

- **Loop generation.** Choose a start point by dropping a pin on the map, pick a distance, and get up to three candidate loops. Each one shows its actual length, how much of it repeats, and its elevation gain.
- **Route preferences.** An "avoid hills" option ranks flatter loops first, and a surface preference can favour paved roads or trails.
- **Run tracking.** Follow a planned loop or just run freely. The app records your trace, announces each kilometre split by voice, warns you when you go off route, and keeps recording while the phone is locked.
- **Lock screen Live Activity.** During a run, the lock screen shows distance, elapsed time and pace.
- **History and stats.** Completed runs, saved routes, weekly totals, records, streaks and achievements, all stored on the device. Calendar weeks and days follow the phone's own time zone.
- **Share card.** A summary image of a run with its map, for sharing.

There are no accounts and no sync. Run history never leaves the phone; the only network calls are to Mapbox for map tiles and to the route service for generating loops.

## How it works

```
iOS app  --POST /generate (x-api-key)-->  route service (FastAPI)  --round_trip-->  GraphHopper
   |
   +--> Mapbox (map tiles, static map for the share card)
```

**The app** (`app/`) is an Expo SDK 56 React Native app written in TypeScript. State lives in a handful of Zustand stores, persisted to AsyncStorage on the device. Maps are drawn with Mapbox (`@rnmapbox/maps`). The only call to first-party infrastructure is `POST /generate`, made from `src/routing/HttpRouteProvider.ts`. `app/ARCHITECTURE.md` maps the screens, modules and data flow in more detail.

**The route service** (`service/`) is a small FastAPI app. It checks the `x-api-key` header, then asks a self-hosted GraphHopper instance for walking round trips from the start point.

Loop generation is best of N rather than a single request:

1. It requests 12 round trips in parallel, each with a different random seed, and keeps those within 15% of the target distance.
2. If fewer than three qualify, it requests 8 more.
3. If GraphHopper is consistently overshooting or undershooting, it rescales the requested distance and tries again.
4. The survivors are ranked by how close they are to the target distance, then by overlap (the share of the route that runs back over a segment already used). Duplicates are removed and the best three are returned.

**Hill-aware ranking.** When "avoid hills" is on, two things change. GraphHopper is given a custom model that strongly penalises steep segments, and the ranking switches: routes are grouped into 5% distance bands, and within the best band the one with the least climbing per kilometre wins. Ascent is only used for ranking when the user asks for it, because in flat places like Singapore the elevation data is noisy enough to reorder routes on noise alone.

**Live Activity.** The lock screen widget is a WidgetKit extension written in Swift (`app/widgets/`), generated into the Xcode project at build time by `react-native-widget-extension`. The app starts, updates and ends the activity from `src/features/follow/liveActivity.ts`. Every call is wrapped so that a failure in the widget can never interrupt a run.

## Stack

- App: Expo SDK 56, React Native 0.85, TypeScript, Zustand, Mapbox (`@rnmapbox/maps`), Swift (WidgetKit / ActivityKit) for the Live Activity
- Route service: Python, FastAPI, httpx
- Routing engine: GraphHopper, self-hosted, with OpenStreetMap data and SRTM elevation
- Builds: Codemagic (`app/codemagic.yaml`)
- Tests: Jest for the app, pytest for the service

## Repository layout

```
app/       Expo React Native iOS app
service/   FastAPI route service that wraps GraphHopper
```

## Running your own copy

This is an outline, not a step by step guide.

1. **GraphHopper.** Run a GraphHopper server with the `foot` profile on an OpenStreetMap extract for your area, with elevation enabled if you want hill-aware ranking. Round trips need `ch.disable=true`, which the service already sends.
2. **Route service.** In `service/`, install `requirements.txt`, copy `.env.example` to `.env`, set `ROUTE_API_KEY` to a key of your choosing and `GH_BASE` to your GraphHopper URL, then run `uvicorn main:app`. `route-service.service` is an example systemd unit. Put it behind HTTPS.
3. **App.** In `app/`, run `npm ci`, copy `.env.example` to `.env`, and fill in your Mapbox public token, your route service URL and the same API key. A Mapbox download token (`MAPBOX_DOWNLOAD_TOKEN`) is needed at build time to fetch the native Mapbox SDK.
4. **Build.** The app uses native modules, so it needs a development or release build rather than Expo Go. You need an Apple developer account and your own bundle identifier to sign it. `codemagic.yaml` shows the build workflows used for this project.

Note that anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle, so the route API key is a gate against casual use, not a real secret.

Tests: `npm test` and `npx tsc --noEmit` in `app/`, and `pytest` in `service/` (it expects `GH_BASE` and `ROUTE_API_KEY` to be set).

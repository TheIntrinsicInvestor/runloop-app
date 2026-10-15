import ActivityKit
import WidgetKit
import SwiftUI

// Brand palette, locked 2026-07-21. Kept literal rather than pulled from an asset
// catalogue so the widget target has no dependency on the app's theme code.
private let brandSignature = Color(red: 0.369, green: 0.169, blue: 0.878) // #5E2BE0
private let brandTint      = Color(red: 0.616, green: 0.420, blue: 1.0)   // #9D6BFF
private let brandGround    = Color(red: 0.031, green: 0.031, blue: 0.047) // #08080C

private func formatDistance(_ km: Double) -> String {
    String(format: "%.2f", km)
}

/// "5:12" per km, or "--:--" until there is enough movement to be meaningful.
private func formatPace(_ secPerKm: Int) -> String {
    guard secPerKm > 0 else { return "--:--" }
    return String(format: "%d:%02d", secPerKm / 60, secPerKm % 60)
}

private func formatClock(_ sec: Int) -> String {
    let h = sec / 3600, m = (sec % 3600) / 60, s = sec % 60
    return h > 0
        ? String(format: "%d:%02d:%02d", h, m, s)
        : String(format: "%d:%02d", m, s)
}

/// Elapsed time. While running this uses the system's own timer so it ticks every second
/// without the app pushing an update; while paused it freezes at the pushed value.
private struct ElapsedText: View {
    let state: RunLiveActivityAttributes.ContentState
    var font: Font
    var body: some View {
        if state.isPaused {
            Text(formatClock(state.elapsedSec)).font(font).monospacedDigit()
        } else {
            Text(timerInterval: state.timerStart...Date.distantFuture,
                 countsDown: false)
                .font(font)
                .monospacedDigit()
        }
    }
}

private struct Metric: View {
    let label: String
    let value: String
    var accent: Color = .white
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.white.opacity(0.55))
            Text(value)
                .font(.system(size: 22, weight: .heavy))
                .italic()
                .monospacedDigit()
                .foregroundColor(accent)
        }
    }
}

struct RunLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunLiveActivityAttributes.self) { context in
            // Lock screen / banner
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.isPaused ? "PAUSED" : "RUNLOOP")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(context.state.isPaused ? .white.opacity(0.5) : brandTint)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(formatDistance(context.state.distanceKm))
                            .font(.system(size: 34, weight: .heavy))
                            .italic()
                            .monospacedDigit()
                            .foregroundColor(.white)
                        Text("km")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white.opacity(0.55))
                    }
                    if context.attributes.plannedKm > 0 {
                        Text("of \(formatDistance(context.attributes.plannedKm)) km")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.45))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 10) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("TIME")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white.opacity(0.55))
                        ElapsedText(state: context.state, font: .system(size: 20, weight: .heavy))
                            .foregroundColor(.white)
                    }
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("PACE")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white.opacity(0.55))
                        Text(formatPace(context.state.paceSecPerKm))
                            .font(.system(size: 20, weight: .heavy))
                            .monospacedDigit()
                            .foregroundColor(brandTint)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .activityBackgroundTint(brandGround)
            .activitySystemActionForegroundColor(brandTint)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Metric(label: "Distance",
                           value: "\(formatDistance(context.state.distanceKm)) km")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("PACE")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white.opacity(0.55))
                        Text(formatPace(context.state.paceSecPerKm))
                            .font(.system(size: 22, weight: .heavy))
                            .italic()
                            .monospacedDigit()
                            .foregroundColor(brandTint)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        ElapsedText(state: context.state, font: .system(size: 14, weight: .semibold))
                            .foregroundColor(.white.opacity(0.8))
                        Spacer()
                        if context.state.isPaused {
                            Text("PAUSED")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
            } compactLeading: {
                Text(formatDistance(context.state.distanceKm))
                    .font(.system(size: 13, weight: .heavy))
                    .monospacedDigit()
                    .foregroundColor(brandTint)
            } compactTrailing: {
                ElapsedText(state: context.state, font: .system(size: 13, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
                    // The compact region is a few points wide; an unbounded native timer
                    // pushes the distance out of view once a run passes an hour.
                    .frame(maxWidth: 44)
            } minimal: {
                Text(formatDistance(context.state.distanceKm))
                    .font(.system(size: 12, weight: .heavy))
                    .monospacedDigit()
                    .foregroundColor(brandTint)
            }
            .keylineTint(brandSignature)
        }
    }
}

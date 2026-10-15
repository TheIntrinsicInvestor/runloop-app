import ActivityKit
import WidgetKit
import SwiftUI

// Compiled into BOTH the app target and the widget extension (the config plugin copies
// this file to each), so the two sides agree on the shape of the activity payload.
struct RunLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var distanceKm: Double
        /// Seconds per kilometre. 0 means "not enough data yet" — render as "--:--".
        var paceSecPerKm: Int
        /// Moving seconds, used for the frozen readout while paused.
        var elapsedSec: Int
        var isPaused: Bool
        /// now - elapsedSec, recomputed on every push. Lets the lock screen tick the
        /// clock natively via Text(timerInterval:) instead of waiting for the next
        /// location fix, so a runner stopped at a light does not see a frozen timer.
        /// Recomputing it each push is what keeps it correct across pause/resume.
        var timerStart: Date
    }

    /// Target distance of the planned loop, for the "of 8.0 km" suffix.
    var plannedKm: Double
}

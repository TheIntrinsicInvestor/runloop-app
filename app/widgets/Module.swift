import ExpoModulesCore
import ActivityKit

/// Bridge for the run Live Activity. The JS side calls these through
/// `react-native-widget-extension`, which requires the native module under this exact name.
///
/// Every entry point is guarded on iOS 16.2 and no-ops below it, so the app still runs on
/// older devices with the lock-screen feature simply absent.
public class ReactNativeWidgetExtensionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ReactNativeWidgetExtension")

        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        Function("startActivity") { (plannedKm: Double, distanceKm: Double, paceSecPerKm: Int, elapsedSec: Int, isPaused: Bool) -> Void in
            let logger = Logger(logHandlers: [])
            if #available(iOS 16.2, *) {
                // Only ever one run activity at a time. A stale one from a crashed run
                // would otherwise sit on the lock screen forever, so clear first.
                Task {
                    for activity in Activity<RunLiveActivityAttributes>.activities {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }

                    let attributes = RunLiveActivityAttributes(plannedKm: plannedKm)
                    let state = RunLiveActivityAttributes.ContentState(
                        distanceKm: distanceKm,
                        paceSecPerKm: paceSecPerKm,
                        elapsedSec: elapsedSec,
                        isPaused: isPaused,
                        timerStart: Date().addingTimeInterval(-Double(elapsedSec))
                    )
                    // No staleDate: a run has no predictable end, and a stale activity
                    // renders greyed out, which would look broken on a long run.
                    let content = ActivityContent(state: state, staleDate: nil)

                    do {
                        let activity = try Activity.request(attributes: attributes, content: content)
                        logger.info("Started run Live Activity \(activity.id)")
                    } catch {
                        logger.info("Failed to start run Live Activity: \(error.localizedDescription)")
                    }
                }
            }
        }

        Function("updateActivity") { (distanceKm: Double, paceSecPerKm: Int, elapsedSec: Int, isPaused: Bool) -> Void in
            if #available(iOS 16.2, *) {
                let state = RunLiveActivityAttributes.ContentState(
                    distanceKm: distanceKm,
                    paceSecPerKm: paceSecPerKm,
                    elapsedSec: elapsedSec,
                    isPaused: isPaused,
                    timerStart: Date().addingTimeInterval(-Double(elapsedSec))
                )
                let content = ActivityContent(state: state, staleDate: nil)

                Task {
                    // No AlertConfiguration: a distance tick must never buzz the wrist.
                    for activity in Activity<RunLiveActivityAttributes>.activities {
                        await activity.update(content)
                    }
                }
            }
        }

        Function("endActivity") { (distanceKm: Double, paceSecPerKm: Int, elapsedSec: Int) -> Void in
            if #available(iOS 16.2, *) {
                let state = RunLiveActivityAttributes.ContentState(
                    distanceKm: distanceKm,
                    paceSecPerKm: paceSecPerKm,
                    elapsedSec: elapsedSec,
                    isPaused: false,
                    timerStart: Date().addingTimeInterval(-Double(elapsedSec))
                )
                let content = ActivityContent(state: state, staleDate: nil)

                Task {
                    for activity in Activity<RunLiveActivityAttributes>.activities {
                        await activity.end(content, dismissalPolicy: .immediate)
                    }
                }
            }
        }
    }
}

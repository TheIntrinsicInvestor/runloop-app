import WidgetKit
import SwiftUI

// A WidgetBundle may contain only Live Activities; no home-screen widget is shipped.
@main
struct RunLoopWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RunLiveActivity()
    }
}

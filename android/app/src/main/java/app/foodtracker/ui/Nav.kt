package app.foodtracker.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.foodtracker.data.Draft
import java.time.LocalDate

// A plain back stack. Routes are objects that keep their own screen state (a form being edited, the day being
// viewed), so it survives going deeper and coming back, and rotation (the stack lives in a ViewModel).

sealed class Route {
    data object Home : Route()
    data object Users : Route()
    data object Foods : Route()
    data object Targets : Route()
    data object Config : Route()

    /** The day shown can change without adding to the back stack (web: "replace, not push"). */
    class Consumptions : Route() {
        var day by mutableStateOf<LocalDate?>(null) // null = today
    }

    /** id = null: a new food. `form` is created on first show and kept while the route is on the stack. */
    class FoodEdit(val id: Long?) : Route() {
        var form by mutableStateOf<FoodForm?>(null)
    }

    /** "Search external", on top of a new food's editor. */
    class External(val query: String) : Route()
}

class Nav {
    val stack = mutableStateListOf<Route>(Route.Home)
    val top get() = stack.last()

    fun go(r: Route) { stack += r }
    fun back(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Picking an external result: back to the new-food editor, prefilled with the draft (replacing what was typed). */
    fun pickDraft(draft: Draft) {
        back()
        (top as? Route.FoodEdit)?.form = FoodForm.from(draft.item, isNew = true)
    }
}

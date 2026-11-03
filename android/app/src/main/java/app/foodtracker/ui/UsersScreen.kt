package app.foodtracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.foodtracker.Core
import app.foodtracker.SaveReply
import app.foodtracker.UserRow
import app.foodtracker.UsersView
import app.foodtracker.get
import app.foodtracker.js
import app.foodtracker.str
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Users, native: a port of app/src/screens/Users.jsx (data: core.js users; saving: app/src/forms.js). Tapping a user
// switches to them; ✎ edits the name.

@Composable
fun UsersScreen(view: UsersView?, core: Core) {
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize()) {
        ScreenFrame("Users", onBack = core::back) {
            if (view == null) return@ScreenFrame
            AddRow("+ add user", { editing = js("name" to "") })
            for (r in view.rows) ListCard({ scope.launch { runCatching { core.call("useUser", r.user["id"]!!) } } }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(r.name, color = C.text, fontSize = 16.sp)
                    if (r.current) Tag("current", C.kcal)
                    Box(Modifier.weight(1f))
                    SmallIconButton("Edit ${r.name}", { editing = r.user }) { Text("✎", color = C.text, fontSize = 15.sp) }
                }
                Muted(r.count)
            }
        }
        editing?.let { u -> UserEditor(core, u, view?.rows?.firstOrNull { it.user["id"] == u["id"] }, view?.canDelete == true) { editing = null } }
    }
}

@Composable
private fun UserEditor(core: Core, user: JsonObject, row: UserRow?, canDelete: Boolean, onClose: () -> Unit) {
    var name by remember(user) { mutableStateOf(user.str("name")) }
    var confirmDelete by remember(user) { mutableStateOf(false) }
    var ask by remember { mutableStateOf<Asking?>(null) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    fun run(name: String, vararg args: kotlinx.serialization.json.JsonElement) = scope.launch {
        val r = runCatching { core.get(SaveReply.serializer(), name, *args) }.getOrElse { SaveReply(alert = "Couldn't save: ${it.message}") }
        if (r.alert != null) ask = Asking(r.alert) else onClose()
    }
    SheetOverlay(onClose) {
        SheetTitle(if (user["id"] != null) "Edit user" else "New user")
        Field("Name") { TextBox(name, { name = it }, focusRequester = focus, onDone = { run("saveUser", user, JsonPrimitive(name)) }) }
        if (confirmDelete && row != null) Text(row.deleteText, color = C.warn, fontSize = 14.sp)
        SheetActions("Save", { run("saveUser", user, JsonPrimitive(name)) }, onClose,
            onDelete = if (user["id"] != null && canDelete) ({ if (confirmDelete) run("deleteUser", user["id"]!!) else confirmDelete = true }) else null,
            deleteLabel = if (confirmDelete) "Delete for good" else "Delete")
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    ask?.Show { ask = null }
}
